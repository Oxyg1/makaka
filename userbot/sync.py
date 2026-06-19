#!/usr/bin/env python3
"""
SWAMP holders sync — Telethon-userbot, данные напрямую из Telegram (MTProto).

Быстрый режим работы (FULL):
  • узнаём реальный тираж коллекции (availability_issued) — не сканируем лишнее;
  • пул из CONCURRENCY воркеров с общим лимитом RATE_PER_SEC запросов/сек
    (по умолчанию 25/с — под безопасный лимит Telegram);
  • найденные лягушки отправляются в бэкенд батчами по ходу дела (не в конце);
  • понятный прогресс в логе: сколько обработано/найдено/холдеров + ETA.

Режимы (env MODE):
  full  — все лягушки с владельцами (для холдеров). По умолчанию.
  fast  — только то, что на продаже (GetResaleStarGiftsRequest, с ценами).

Отправка в бэкенд SWAMP:
  POST /api/ingest/whales  — топ-холдеры (полная замена)
  POST /api/ingest/frogs   — каталог лягушек (батчами, upsert)

thanks to @GiftChanges (api.changes.tg) — за визуалки в самом мини-аппе.
"""

import asyncio
import os
import sys
import time
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
MAX_NUM = int(os.getenv("MAX_NUM", "20000"))        # жёсткий потолок перебора
MODE = os.getenv("MODE", "full").lower()
RATE_PER_SEC = float(os.getenv("RATE_PER_SEC", "25"))   # лимит запросов/сек
CONCURRENCY = int(os.getenv("CONCURRENCY", "12"))       # параллельных воркеров
TOP_WHALES = int(os.getenv("TOP_WHALES", "100"))
SYNC_INTERVAL_HOURS = float(os.getenv("SYNC_INTERVAL_HOURS", "24"))
BATCH = int(os.getenv("BATCH", "200"))              # лягушек в одном POST
FLUSH_EVERY_SEC = 5.0

# Глобальный backoff на FloodWait — паузит всех воркеров.
_pause_until = 0.0


def log(msg: str) -> None:
    print(f"[swamp-sync] {msg}", flush=True)


def _trigger_flood(seconds: float) -> None:
    global _pause_until
    _pause_until = max(_pause_until, time.monotonic() + seconds + 1)


async def _respect_flood() -> None:
    now = time.monotonic()
    if _pause_until > now:
        await asyncio.sleep(_pause_until - now)


def _color_hex(color_int) -> str | None:
    if not color_int:
        return None
    return f"#{int(color_int) & 0xFFFFFF:06X}"


def _permille_to_fraction(p) -> float | None:
    if p is None:
        return None
    try:
        return round(float(p) / 1000.0, 4)
    except (TypeError, ValueError):
        return None


def extract_attributes(gift) -> dict:
    attrs = getattr(gift, "attributes", None) or []
    out = {"model": None, "model_rarity": None, "backdrop": None,
           "backdrop_rarity": None, "pattern": None, "pattern_rarity": None}
    for a in attrs:
        cls = type(a).__name__
        name = getattr(a, "name", None)
        rar = _permille_to_fraction(getattr(a, "rarity_permille", None))
        if "Model" in cls:
            out["model"], out["model_rarity"] = name, rar
        elif "Backdrop" in cls:
            out["backdrop"], out["backdrop_rarity"] = name, rar
        elif "Pattern" in cls:
            out["pattern"], out["pattern_rarity"] = name, rar
    return out


def extract_owner_tg(gift) -> int | None:
    peer = getattr(gift, "owner_id", None)
    uid = getattr(peer, "user_id", None) if peer is not None else None
    return int(uid) if uid else None


def gift_to_frog(gift) -> dict | None:
    slug = getattr(gift, "slug", None)
    num = getattr(gift, "num", None)
    if not slug or num is None:
        return None
    a = extract_attributes(gift)
    if not (a["model"] and a["backdrop"] and a["pattern"]):
        return None
    owner_tg = extract_owner_tg(gift)
    return {
        "gift_id": str(getattr(gift, "id", "") or slug),
        "slug": str(slug),
        "number": int(num),
        "model": a["model"], "backdrop": a["backdrop"], "pattern": a["pattern"],
        "model_rarity": a["model_rarity"],
        "backdrop_rarity": a["backdrop_rarity"],
        "pattern_rarity": a["pattern_rarity"],
        "image_url": None,
        "owner_username": None,
        "owner_telegram_id": str(owner_tg) if owner_tg else None,
    }


async def fetch_one(client, slug: str):
    await _respect_flood()
    try:
        res = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
        return res.gift
    except FloodWaitError as e:
        log(f"FloodWait {e.seconds}s — притормаживаю всех")
        _trigger_flood(e.seconds)
        await asyncio.sleep(e.seconds + 1)
        return await fetch_one(client, slug)
    except Exception as e:  # noqa: BLE001
        msg = str(e).upper()
        if "NOT_FOUND" in msg or "INVALID" in msg or "SLUG" in msg:
            return None
        log(f"{slug}: {e}")
        return None


# ── Состояние прогона ────────────────────────────────────────────────────────
class State:
    def __init__(self, total: int):
        self.total = total
        self.processed = 0
        self.found = 0
        self.frogs: list[dict] = []
        self.flushed = 0
        self.holders: dict[str, int] = defaultdict(int)
        self.lock = asyncio.Lock()
        self.done = False
        self.started = time.monotonic()


async def post_ingest(http: httpx.AsyncClient, path: str, payload: dict) -> None:
    try:
        r = await http.post(
            f"{BACKEND_URL}/api/ingest/{path}", json=payload,
            headers={"X-Ingest-Secret": INGEST_SECRET}, timeout=60,
        )
        log(f"→ ingest/{path}: {r.status_code} {r.text[:140]}")
    except Exception as e:  # noqa: BLE001
        log(f"→ ingest/{path} ОШИБКА: {e}")


async def flush_frogs(state: State, http: httpx.AsyncClient) -> None:
    async with state.lock:
        pending = state.frogs[state.flushed:]
        state.flushed = len(state.frogs)
    for i in range(0, len(pending), BATCH):
        await post_ingest(http, "frogs", {"frogs": pending[i:i + BATCH]})


async def flusher(state: State, http: httpx.AsyncClient) -> None:
    while not state.done:
        await asyncio.sleep(FLUSH_EVERY_SEC)
        await flush_frogs(state, http)


async def worker(name: int, queue: "asyncio.Queue[int]", client, state: State) -> None:
    delay = CONCURRENCY / RATE_PER_SEC  # суммарно ≈ RATE_PER_SEC запросов/сек
    while True:
        num = await queue.get()
        try:
            if num is None:
                return
            gift = await fetch_one(client, f"{COLLECTION_PREFIX}-{num}")
            if gift is not None:
                frog = gift_to_frog(gift)
                if frog:
                    async with state.lock:
                        state.frogs.append(frog)
                        tg = frog["owner_telegram_id"]
                        if tg:
                            state.holders[tg] += 1
                    state.found += 1
            state.processed += 1
            if state.processed % 500 == 0:
                el = time.monotonic() - state.started
                rate = state.processed / el if el else 0
                eta = (state.total - state.processed) / rate if rate else 0
                log(f"...{state.processed}/{state.total} | найдено {state.found} | "
                    f"холдеров {len(state.holders)} | {rate:.0f}/с | ETA {eta/60:.1f} мин")
            await asyncio.sleep(delay)
        finally:
            queue.task_done()


async def get_issued_count(client) -> int:
    for s in (f"{COLLECTION_PREFIX}-1", f"{COLLECTION_PREFIX}-2", f"{COLLECTION_PREFIX}-100"):
        g = await fetch_one(client, s)
        if g is not None:
            n = getattr(g, "availability_issued", None) or getattr(g, "availability_total", None)
            if n:
                return int(n)
    return MAX_NUM


async def scan_full(client, http: httpx.AsyncClient) -> tuple[list[dict], dict[str, int]]:
    issued = await get_issued_count(client)
    total = min(issued, MAX_NUM)
    est = total / RATE_PER_SEC / 60
    log(f"FULL: тираж ~{issued}, сканирую {total} slug при {RATE_PER_SEC:.0f}/с "
        f"({CONCURRENCY} воркеров) ≈ {est:.1f} мин")

    state = State(total)
    queue: asyncio.Queue[int] = asyncio.Queue()
    for n in range(1, total + 1):
        queue.put_nowait(n)
    for _ in range(CONCURRENCY):
        queue.put_nowait(None)  # стоп-сигналы

    flush_task = asyncio.create_task(flusher(state, http))
    workers = [asyncio.create_task(worker(i, queue, client, state)) for i in range(CONCURRENCY)]
    await asyncio.gather(*workers)
    state.done = True
    await flush_task
    await flush_frogs(state, http)  # финальный добор

    log(f"FULL готово: {state.found} лягушек, {len(state.holders)} холдеров, "
        f"{(time.monotonic() - state.started)/60:.1f} мин")
    return state.frogs, dict(state.holders)


# ── FAST: только на продаже ──────────────────────────────────────────────────
async def scan_fast(client, http: httpx.AsyncClient) -> tuple[list[dict], dict[str, int]]:
    log("FAST: GetResaleStarGiftsRequest (только на продаже)")
    gift_id = None
    for s in (f"{COLLECTION_PREFIX}-1", f"{COLLECTION_PREFIX}-100", f"{COLLECTION_PREFIX}-1000"):
        g = await fetch_one(client, s)
        if g is not None:
            gift_id = getattr(g, "gift_id", None) or getattr(g, "id", None)
            if gift_id:
                break
    if not gift_id:
        log("не удалось определить gift_id коллекции")
        return [], {}
    frogs: list[dict] = []
    holders: dict[str, int] = defaultdict(int)
    offset = ""
    while True:
        await _respect_flood()
        try:
            res = await client(functions.payments.GetResaleStarGiftsRequest(
                gift_id=gift_id, offset=offset, limit=100, sort_by_price=True))
        except FloodWaitError as e:
            _trigger_flood(e.seconds)
            await asyncio.sleep(e.seconds + 1)
            continue
        for gift in getattr(res, "gifts", []):
            frog = gift_to_frog(gift)
            if frog:
                frogs.append(frog)
                if frog["owner_telegram_id"]:
                    holders[frog["owner_telegram_id"]] += 1
        offset = getattr(res, "next_offset", None)
        if not offset:
            break
        await asyncio.sleep(CONCURRENCY / RATE_PER_SEC)
    for i in range(0, len(frogs), BATCH):
        await post_ingest(http, "frogs", {"frogs": frogs[i:i + BATCH]})
    log(f"FAST готово: {len(frogs)} на продаже")
    return frogs, dict(holders)


# ── Холдеры: топ + обогащение ────────────────────────────────────────────────
async def build_and_post_whales(client, http: httpx.AsyncClient, holders: dict[str, int]) -> None:
    top = sorted(({"telegram_id": tg, "gifts_count": c} for tg, c in holders.items()),
                 key=lambda h: h["gifts_count"], reverse=True)[:TOP_WHALES]
    log(f"обогащаю {len(top)} топ-холдеров (username/имя)")
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
    await post_ingest(http, "whales", {"holders": top})


async def run_once(client) -> None:
    if not INGEST_SECRET:
        log("ОШИБКА: задай INGEST_SECRET (как в backend/.env)")
        return
    try:
        INGEST_SECRET.encode("ascii")
    except UnicodeEncodeError:
        log("ОШИБКА: INGEST_SECRET содержит не-ASCII (кириллицу?). "
            "Сгенерируй `openssl rand -hex 24` и пропиши одинаково в backend/.env и userbot/.env.")
        return
    async with httpx.AsyncClient() as http:
        if MODE == "fast":
            _, holders = await scan_fast(client, http)
        else:
            _, holders = await scan_full(client, http)
        await build_and_post_whales(client, http, holders)
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
