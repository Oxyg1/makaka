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
import json
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

# Дайджесты смен владельцев в канал (#7)
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
CHANNEL_ID = os.getenv("CHANNEL_ID", "").strip()      # напр. -1004345157016
POST_CHANGES = os.getenv("POST_CHANGES", "1") == "1"
SNAPSHOT_FILE = os.getenv("SNAPSHOT_FILE", os.path.join(os.path.dirname(__file__), "owners_snapshot.json"))
MAX_TRANSFERS = int(os.getenv("MAX_TRANSFERS", "150"))  # потолок переходов в посте за прогон
PER_MSG = int(os.getenv("PER_MSG", "15"))              # переходов в одном сообщении

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


def backdrop_palette(gift):
    """(name, {center/edge/pattern/text_color}) из атрибута фона."""
    for a in getattr(gift, "attributes", None) or []:
        if "Backdrop" in type(a).__name__:
            return getattr(a, "name", None), {
                "center_color": _color_hex(getattr(a, "center_color", 0)),
                "edge_color": _color_hex(getattr(a, "edge_color", 0)),
                "pattern_color": _color_hex(getattr(a, "pattern_color", 0)),
                "text_color": _color_hex(getattr(a, "text_color", 0)),
            }
    return None, None


def extract_owner(gift) -> tuple[str | None, str | None]:
    """(telegram_id, wallet_address). Один из двух или оба None."""
    peer = getattr(gift, "owner_id", None)
    uid = getattr(peer, "user_id", None) if peer is not None else None
    if uid:
        return str(uid), None
    addr = getattr(gift, "owner_address", None)
    if addr:
        return None, str(addr)
    return None, None


def gift_to_frog(gift) -> dict | None:
    slug = getattr(gift, "slug", None)
    num = getattr(gift, "num", None)
    if not slug or num is None:
        return None
    a = extract_attributes(gift)
    if not (a["model"] and a["backdrop"] and a["pattern"]):
        return None
    owner_tg, owner_addr = extract_owner(gift)
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
        "owner_telegram_id": owner_tg,
        "owner_address": owner_addr,
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
        self.wallet_holders: dict[str, int] = defaultdict(int)
        self.backdrops: dict[str, dict] = {}
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
                        elif frog.get("owner_address"):
                            state.wallet_holders[frog["owner_address"]] += 1
                        bname = frog["backdrop"]
                        if bname not in state.backdrops:
                            pal = backdrop_palette(gift)[1]
                            if pal:
                                state.backdrops[bname] = pal
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


async def scan_full(client, http: httpx.AsyncClient) -> tuple[list[dict], dict[str, int], dict[str, int], dict[str, dict]]:
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
        f"{len(state.wallet_holders)} кошельков, {len(state.backdrops)} фонов, "
        f"{(time.monotonic() - state.started)/60:.1f} мин")
    return state.frogs, dict(state.holders), dict(state.wallet_holders), dict(state.backdrops)


# ── FAST: только на продаже ──────────────────────────────────────────────────
async def scan_fast(client, http: httpx.AsyncClient) -> tuple[list[dict], dict[str, int], dict[str, int], dict[str, dict]]:
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
        return [], {}, {}, {}
    frogs: list[dict] = []
    holders: dict[str, int] = defaultdict(int)
    wallet_holders: dict[str, int] = defaultdict(int)
    backdrops: dict[str, dict] = {}
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
                elif frog.get("owner_address"):
                    wallet_holders[frog["owner_address"]] += 1
                if frog["backdrop"] not in backdrops:
                    pal = backdrop_palette(gift)[1]
                    if pal:
                        backdrops[frog["backdrop"]] = pal
        offset = getattr(res, "next_offset", None)
        if not offset:
            break
        await asyncio.sleep(CONCURRENCY / RATE_PER_SEC)
    for i in range(0, len(frogs), BATCH):
        await post_ingest(http, "frogs", {"frogs": frogs[i:i + BATCH]})
    log(f"FAST готово: {len(frogs)} на продаже")
    return frogs, dict(holders), dict(wallet_holders), dict(backdrops)


# ── Холдеры: топ (юзеры + кошельки) + обогащение ─────────────────────────────
async def build_and_post_whales(client, http: httpx.AsyncClient,
                                holders: dict[str, int], wallet_holders: dict[str, int]) -> None:
    combined: list[dict] = [{"telegram_id": tg, "gifts_count": c, "kind": "user"} for tg, c in holders.items()]
    combined += [{"address": a, "gifts_count": c, "kind": "wallet"} for a, c in wallet_holders.items()]
    combined.sort(key=lambda h: h["gifts_count"], reverse=True)
    # +50 с запасом: бэкенд отсеет маркеты и оставит топ.
    top = combined[:TOP_WHALES + 50]
    users = [h for h in top if h.get("kind") == "user"]
    log(f"обогащаю {len(users)} топ-холдеров (username/имя), кошельков в топе: {len(top) - len(users)}")
    for h in users:
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


# ── Дайджест смен владельцев в канал (#7) ────────────────────────────────────
def load_snapshot() -> dict[str, str]:
    try:
        with open(SNAPSHOT_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return {}


def save_snapshot(m: dict[str, str]) -> None:
    try:
        with open(SNAPSHOT_FILE, "w", encoding="utf-8") as fh:
            json.dump(m, fh)
    except Exception as e:  # noqa: BLE001
        log(f"snapshot save failed: {e}")


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def tg_send(http: httpx.AsyncClient, text: str) -> None:
    while True:
        r = await http.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={"chat_id": CHANNEL_ID, "text": text, "parse_mode": "HTML",
                  "disable_web_page_preview": True},
            timeout=30,
        )
        if r.status_code == 429:
            retry = r.json().get("parameters", {}).get("retry_after", 5)
            log(f"channel 429 — жду {retry}s")
            await asyncio.sleep(retry + 1)
            continue
        if r.status_code != 200:
            log(f"channel send {r.status_code}: {r.text[:160]}")
        return


async def resolve_names(client, ids: set[str]) -> dict[str, str]:
    names: dict[str, str] = {}
    for tg in list(ids)[:2 * MAX_TRANSFERS]:
        try:
            ent = await client.get_entity(int(tg))
            if getattr(ent, "username", None):
                names[tg] = f"@{ent.username}"
            else:
                nm = " ".join(x for x in [getattr(ent, "first_name", None), getattr(ent, "last_name", None)] if x)
                names[tg] = esc(nm) if nm else f"id{tg}"
        except Exception:  # noqa: BLE001
            names[tg] = f"id{tg}"
        await asyncio.sleep(0.15)
    return names


async def post_owner_changes(client, http: httpx.AsyncClient, frogs: list[dict]) -> None:
    cur = {f["slug"]: f["owner_telegram_id"] for f in frogs if f.get("owner_telegram_id")}
    if not (POST_CHANGES and BOT_TOKEN and CHANNEL_ID):
        save_snapshot(cur)
        return
    prev = load_snapshot()
    if not prev:
        log("снимок владельцев базовый — посты не шлём, сохраняю baseline")
        save_snapshot(cur)
        return

    fmap = {f["slug"]: f for f in frogs}
    changes = []
    for slug, new in cur.items():
        old = prev.get(slug)
        if old and new and old != new:
            f = fmap[slug]
            changes.append((slug, str(f.get("model", "?")), f.get("number", ""), old, new))
    if not changes:
        log("смен владельцев нет")
        save_snapshot(cur)
        return

    log(f"смен владельцев: {len(changes)} — шлю дайджест в канал")
    shown = changes[:MAX_TRANSFERS]
    extra = len(changes) - len(shown)
    ids: set[str] = set()
    for _slug, _m, _n, o, n in shown:
        ids.add(o); ids.add(n)
    names = await resolve_names(client, ids)

    for i in range(0, len(shown), PER_MSG):
        chunk = shown[i:i + PER_MSG]
        lines = ["🐸 <b>Переходы KissedFrog</b>\n"]
        for slug, model, num, o, n in chunk:
            on = names.get(o, f"id{o}")
            nn = names.get(n, f"id{n}")
            lines.append(f'🔄 <a href="https://t.me/nft/{slug}">{esc(model)} #{num}</a>\n   {on} → {nn}')
        await tg_send(http, "\n".join(lines))
        await asyncio.sleep(3)  # пауза между постами — анти-рейтлимит
    if extra > 0:
        await tg_send(http, f"…и ещё <b>{extra}</b> переходов за период.")

    save_snapshot(cur)


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
            frogs, holders, wallet_holders, backdrops = await scan_fast(client, http)
        else:
            frogs, holders, wallet_holders, backdrops = await scan_full(client, http)
        if backdrops:
            await post_ingest(http, "backdrops",
                              {"backdrops": [{"name": n, **c} for n, c in backdrops.items()]})
        await build_and_post_whales(client, http, holders, wallet_holders)
        if MODE != "fast":
            try:
                await post_owner_changes(client, http, frogs)
            except Exception as e:  # noqa: BLE001
                log(f"owner-changes failed: {e}")
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
