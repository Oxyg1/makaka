#!/usr/bin/env python3
"""
SWAMP holders sync — Telethon-userbot, данные напрямую из Telegram (MTProto).

Источник истины — сам Telegram, без сторонних API:
  • FULL  — перебор slug KissedFrog-1..MAX_NUM через GetUniqueStarGiftRequest.
            Даёт ВСЕ существующие лягушки с владельцами, атрибутами и цветами.
            Это режим для холдеров (по умолчанию).
  • FAST  — GetResaleStarGiftsRequest: только то, что на продаже (быстро, цены).

Что делает каждый прогон:
  1. Собирает лягушки (slug, num, модель, фон, узор, цвета, редкость, владелец).
  2. Агрегирует холдеров (сколько лягушек у каждого telegram-владельца).
  3. Обогащает топ-холдеров username/именем (get_entity), аватар — через see.tg.
  4. Шлёт снимок в бэкенд SWAMP:
        POST /api/ingest/whales  — топ-холдеры (полная замена)
        POST /api/ingest/frogs   — каталог лягушек (батчами, upsert)

Запуск:
  python sync.py            # демон: прогон + сон SYNC_INTERVAL_HOURS
  SYNC_INTERVAL_HOURS=0 python sync.py        # один прогон (для cron)
  MODE=fast python sync.py                    # только то, что на продаже

thanks to @GiftChanges (api.changes.tg) — за визуалки в самом мини-аппе.
"""

import asyncio
import os
import sys
from collections import defaultdict

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from telethon import TelegramClient, functions
from telethon.sessions import StringSession
from telethon.errors import FloodWaitError

# ── Конфиг ───────────────────────────────────────────────────────────────────
API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")
PHONE_NUMBER = os.getenv("PHONE_NUMBER", "")
SESSION_STRING = os.getenv("TG_SESSION_STRING", "").strip()
SESSION_NAME = os.getenv("SESSION_NAME", "swamp_session")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001").rstrip("/")
INGEST_SECRET = os.getenv("INGEST_SECRET", "")
POSO_BASE = os.getenv("POSO_BASE", "https://poso.see.tg").rstrip("/")

COLLECTION_PREFIX = os.getenv("COLLECTION_SLUG", "KissedFrog")
MAX_NUM = int(os.getenv("MAX_NUM", "15000"))
MODE = os.getenv("MODE", "full").lower()
DELAY_SECONDS = float(os.getenv("DELAY_SECONDS", "0.6"))
TOP_WHALES = int(os.getenv("TOP_WHALES", "100"))
SYNC_INTERVAL_HOURS = float(os.getenv("SYNC_INTERVAL_HOURS", "24"))
BATCH = 500


def log(msg: str) -> None:
    print(f"[swamp-sync] {msg}", flush=True)


def _color_hex(color_int) -> str | None:
    if not color_int:
        return None
    return f"#{int(color_int) & 0xFFFFFF:06X}"


def _permille_to_fraction(p) -> float | None:
    """rarity_permille (0..1000) → доля (0..1), как хранит бэкенд."""
    if p is None:
        return None
    try:
        return round(float(p) / 1000.0, 4)
    except (TypeError, ValueError):
        return None


def extract_attributes(gift) -> dict:
    """Модель/фон/узор из gift.attributes (по имени класса, как в эталоне)."""
    attrs = getattr(gift, "attributes", None) or []
    out = {
        "model": None, "model_rarity": None,
        "backdrop": None, "backdrop_rarity": None,
        "pattern": None, "pattern_rarity": None,
        "center_color": None, "edge_color": None,
        "pattern_color": None, "text_color": None,
    }
    for a in attrs:
        cls = type(a).__name__
        name = getattr(a, "name", None)
        rar = _permille_to_fraction(getattr(a, "rarity_permille", None))
        if "Model" in cls:
            out["model"], out["model_rarity"] = name, rar
        elif "Backdrop" in cls:
            out["backdrop"], out["backdrop_rarity"] = name, rar
            out["center_color"] = _color_hex(getattr(a, "center_color", 0))
            out["edge_color"] = _color_hex(getattr(a, "edge_color", 0))
            out["pattern_color"] = _color_hex(getattr(a, "pattern_color", 0))
            out["text_color"] = _color_hex(getattr(a, "text_color", 0))
        elif "Pattern" in cls:
            out["pattern"], out["pattern_rarity"] = name, rar
    return out


def extract_owner_tg(gift) -> int | None:
    """telegram_id владельца, если это реальный пользователь (PeerUser)."""
    peer = getattr(gift, "owner_id", None)
    if peer is None:
        return None
    uid = getattr(peer, "user_id", None)
    return int(uid) if uid else None


def gift_to_frog(gift) -> dict | None:
    """StarGiftUnique → запись каталога для /api/ingest/frogs."""
    slug = getattr(gift, "slug", None)
    num = getattr(gift, "num", None)
    if not slug or num is None:
        return None
    a = extract_attributes(gift)
    if not (a["model"] and a["backdrop"] and a["pattern"]):
        return None
    owner_tg = extract_owner_tg(gift)
    return {
        "gift_id": str(getattr(gift, "id", "") or f"{slug}"),
        "slug": str(slug),
        "number": int(num),
        "model": a["model"],
        "backdrop": a["backdrop"],
        "pattern": a["pattern"],
        "model_rarity": a["model_rarity"],
        "backdrop_rarity": a["backdrop_rarity"],
        "pattern_rarity": a["pattern_rarity"],
        "image_url": None,
        "owner_username": None,
        "owner_telegram_id": str(owner_tg) if owner_tg else None,
        # бонус-данные (бэкенд пока игнорирует, но пригодятся — см. README):
        "colors": {k: a[k] for k in ("center_color", "edge_color", "pattern_color", "text_color")},
    }


# ── FULL: перебор всех slug ──────────────────────────────────────────────────
async def fetch_one(client, slug: str):
    try:
        res = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
        return res.gift
    except FloodWaitError as e:
        log(f"FloodWait {e.seconds}s")
        await asyncio.sleep(e.seconds + 2)
        return await fetch_one(client, slug)
    except Exception as e:  # noqa: BLE001
        msg = str(e).upper()
        if "NOT_FOUND" in msg or "INVALID" in msg or "SLUG" in msg:
            return None
        log(f"{slug}: {e}")
        return None


async def scan_full(client) -> list[dict]:
    log(f"FULL: перебор {COLLECTION_PREFIX}-1..{MAX_NUM}")
    frogs: list[dict] = []
    for num in range(1, MAX_NUM + 1):
        gift = await fetch_one(client, f"{COLLECTION_PREFIX}-{num}")
        if gift is not None:
            frog = gift_to_frog(gift)
            if frog:
                frogs.append(frog)
        if num % 500 == 0:
            log(f"...{num}/{MAX_NUM}, найдено {len(frogs)}")
        await asyncio.sleep(DELAY_SECONDS)
    log(f"FULL готово: {len(frogs)} лягушек")
    return frogs


# ── FAST: только на продаже ──────────────────────────────────────────────────
async def scan_fast(client) -> list[dict]:
    log("FAST: GetResaleStarGiftsRequest (только на продаже)")
    # gift_id коллекции достаём из любого известного slug
    gift_id = None
    for s in (f"{COLLECTION_PREFIX}-1", f"{COLLECTION_PREFIX}-100", f"{COLLECTION_PREFIX}-1000"):
        g = await fetch_one(client, s)
        if g is not None:
            gift_id = getattr(g, "gift_id", None) or getattr(g, "id", None)
            if gift_id:
                break
    if not gift_id:
        log("не удалось определить gift_id коллекции")
        return []
    frogs: list[dict] = []
    offset = ""
    while True:
        try:
            res = await client(functions.payments.GetResaleStarGiftsRequest(
                gift_id=gift_id, offset=offset, limit=100, sort_by_price=True,
            ))
        except FloodWaitError as e:
            await asyncio.sleep(e.seconds + 2)
            continue
        for gift in getattr(res, "gifts", []):
            frog = gift_to_frog(gift)
            if frog:
                frogs.append(frog)
        offset = getattr(res, "next_offset", None)
        if not offset:
            break
        await asyncio.sleep(DELAY_SECONDS)
    log(f"FAST готово: {len(frogs)} на продаже")
    return frogs


# ── Холдеры + обогащение ─────────────────────────────────────────────────────
async def build_holders(client, frogs: list[dict]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for f in frogs:
        tg = f.get("owner_telegram_id")
        if tg:
            counts[tg] += 1
    holders = [{"telegram_id": tg, "gifts_count": c} for tg, c in counts.items()]
    holders.sort(key=lambda h: h["gifts_count"], reverse=True)
    top = holders[:TOP_WHALES]

    log(f"обогащаю {len(top)} топ-холдеров")
    for h in top:
        try:
            ent = await client.get_entity(int(h["telegram_id"]))
            if getattr(ent, "username", None):
                h["username"] = ent.username
                h["photo_url"] = f"{POSO_BASE}/api/avatar/{ent.username}"
            nm = " ".join(x for x in [getattr(ent, "first_name", None), getattr(ent, "last_name", None)] if x)
            if nm:
                h["name"] = nm
        except Exception as e:  # noqa: BLE001
            log(f"  enrich {h['telegram_id']}: {e}")
        await asyncio.sleep(0.2)
    return top


# ── Отправка в бэкенд ────────────────────────────────────────────────────────
async def post_ingest(http: httpx.AsyncClient, path: str, payload: dict) -> None:
    r = await http.post(
        f"{BACKEND_URL}/api/ingest/{path}", json=payload,
        headers={"X-Ingest-Secret": INGEST_SECRET}, timeout=60,
    )
    log(f"ingest/{path} -> {r.status_code} {r.text[:160]}")


async def run_once(client) -> None:
    if not INGEST_SECRET:
        log("ОШИБКА: задай INGEST_SECRET (как в backend/.env)")
        return
    frogs = await (scan_fast(client) if MODE == "fast" else scan_full(client))
    holders = await build_holders(client, frogs)
    async with httpx.AsyncClient() as http:
        await post_ingest(http, "whales", {"holders": holders})
        for i in range(0, len(frogs), BATCH):
            await post_ingest(http, "frogs", {"frogs": frogs[i:i + BATCH]})
    log("sync done")


async def main() -> None:
    if not (API_ID and API_HASH):
        log("нет TG_API_ID/TG_API_HASH — заполни .env"); return
    if SESSION_STRING:
        client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    else:
        client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.start(phone=PHONE_NUMBER or None)
    log("Telegram авторизация ок")

    await run_once(client)
    if SYNC_INTERVAL_HOURS > 0:
        while True:
            log(f"сон {SYNC_INTERVAL_HOURS}ч")
            await asyncio.sleep(SYNC_INTERVAL_HOURS * 3600)
            try:
                await run_once(client)
            except Exception as e:  # noqa: BLE001
                log(f"run failed: {e}")
    await client.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
