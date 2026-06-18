#!/usr/bin/env python3
"""
SWAMP holders sync — userbot на Telethon.

Что делает:
  1. Собирает ВСЕ гифты коллекции KissedFrog с владельцами
     (источник — публичный see.tg /api/gifts, постранично).
  2. Агрегирует холдеров: считает сколько лягушек у каждого владельца.
  3. (опционально) Обогащает топ-холдеров username/аватаркой через Telethon.
  4. Шлёт снимок в бэкенд SWAMP:
        POST /api/ingest/whales  — топ-холдеры (полная замена)
        POST /api/ingest/frogs   — каталог лягушек (батчами, upsert)

Запуск раз в день: переменная SYNC_INTERVAL_HOURS (0 = один прогон и выход).

Почему Telethon не тянет коллекцию напрямую:
  MTProto умеет отдавать гифты КОНКРЕТНОГО пользователя, но не «всех владельцев
  коллекции» — глобального индекса в Telegram нет. Поэтому список берём из see.tg,
  а Telethon-аккаунт используем как демон-раннер и для обогащения (username/аватар).
  Источник данных в fetch_all_frogs() можно заменить на свой.

thanks to @GiftChanges (api.changes.tg) and poso.see.tg for the gift data.
"""

import asyncio
import os
import sys
from collections import defaultdict
from typing import Any

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001").rstrip("/")
INGEST_SECRET = os.getenv("INGEST_SECRET", "")
POSO_BASE = os.getenv("POSO_BASE", "https://poso.see.tg").rstrip("/")
COLLECTION_SLUG = os.getenv("COLLECTION_SLUG", "KissedFrog")
TOP_WHALES = int(os.getenv("TOP_WHALES", "100"))
SYNC_INTERVAL_HOURS = float(os.getenv("SYNC_INTERVAL_HOURS", "24"))
PAGE_LIMIT = 50  # see.tg максимум

TG_API_ID = os.getenv("TG_API_ID", "").strip()
TG_API_HASH = os.getenv("TG_API_HASH", "").strip()
TG_SESSION_STRING = os.getenv("TG_SESSION_STRING", "").strip()


def log(msg: str) -> None:
    print(f"[swamp-sync] {msg}", flush=True)


def first(d: dict, *keys, default=None):
    for k in keys:
        v = d.get(k)
        if v not in (None, ""):
            return v
    return default


def extract_owner(gift: dict) -> dict | None:
    """Достаём владельца из объекта гифта. Возвращаем dict или None (скрытый/маркет)."""
    owner = gift.get("owner") or gift.get("current_owner")
    if isinstance(owner, dict):
        tg = first(owner, "telegram_id", "tg_id")
        if tg is None:
            return None
        return {
            "telegram_id": str(tg),
            "username": first(owner, "username"),
            "name": first(owner, "name", "first_name", "title"),
            "photo_url": first(owner, "photo_url", "avatar"),
        }
    # иногда владелец приходит плоскими полями
    tg = first(gift, "current_owner_telegram_id", "owner_telegram_id")
    if tg is not None:
        return {
            "telegram_id": str(tg),
            "username": first(gift, "owner_username"),
            "name": first(gift, "owner_name"),
            "photo_url": None,
        }
    return None


def normalize_frog(gift: dict, owner: dict | None) -> dict | None:
    gift_id = first(gift, "gift_id", "id")
    num = first(gift, "num", "number")
    slug = first(gift, "slug")
    model = first(gift, "model_name", "model")
    backdrop = first(gift, "backdrop_name", "backdrop")
    pattern = first(gift, "pattern_name", "pattern", "symbol_name")
    if not (gift_id and num is not None and model and backdrop and pattern):
        return None
    if not slug:
        slug = f"{COLLECTION_SLUG}-{num}"
    return {
        "gift_id": str(gift_id),
        "slug": str(slug),
        "number": int(num),
        "model": str(model),
        "backdrop": str(backdrop),
        "pattern": str(pattern),
        "model_rarity": gift.get("model_rarity"),
        "backdrop_rarity": gift.get("backdrop_rarity"),
        "pattern_rarity": gift.get("pattern_rarity"),
        "image_url": first(gift, "image_url", "image"),
        "owner_username": owner.get("username") if owner else None,
        "owner_telegram_id": owner.get("telegram_id") if owner else None,
    }


async def fetch_all_frogs(client: httpx.AsyncClient) -> tuple[list[dict], dict[str, dict]]:
    """Постранично тянем все гифты коллекции. Возвращаем (frogs, holders_by_tg)."""
    frogs: list[dict] = []
    holders: dict[str, dict] = {}
    offset = 0
    while True:
        params = {
            "slug": COLLECTION_SLUG,
            "limit": PAGE_LIMIT,
            "offset": offset,
            "sort_by": "num",
            "order": "asc",
        }
        r = await client.get(f"{POSO_BASE}/api/gifts", params=params, timeout=30)
        if r.status_code != 200:
            log(f"gifts {r.status_code} at offset {offset}, stop")
            break
        data: Any = r.json()
        page = data if isinstance(data, list) else first(
            data, "results", "items", "gifts", "data", default=[]
        )
        if not page:
            break
        for gift in page:
            if not isinstance(gift, dict):
                continue
            owner = extract_owner(gift)
            frog = normalize_frog(gift, owner)
            if frog:
                frogs.append(frog)
            if owner and owner["telegram_id"]:
                tg = owner["telegram_id"]
                h = holders.get(tg)
                if h is None:
                    holders[tg] = {**owner, "gifts_count": 1}
                else:
                    h["gifts_count"] += 1
                    # подхватываем более полные данные, если появились
                    for k in ("username", "name", "photo_url"):
                        if not h.get(k) and owner.get(k):
                            h[k] = owner[k]
        offset += PAGE_LIMIT
        if len(page) < PAGE_LIMIT:
            break
        if offset % 500 == 0:
            log(f"...{offset} gifts scanned, {len(holders)} holders so far")
    log(f"collected {len(frogs)} frogs / {len(holders)} holders")
    return frogs, holders


async def enrich_with_telethon(holders: list[dict]) -> None:
    """Опционально: дозаполняем username/name/photo_url топ-холдеров через Telethon."""
    if not (TG_API_ID and TG_API_HASH and TG_SESSION_STRING):
        return
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        log("telethon не установлен — пропускаю обогащение")
        return

    client = TelegramClient(StringSession(TG_SESSION_STRING), int(TG_API_ID), TG_API_HASH)
    await client.start()
    log("telethon: обогащаю топ-холдеров")
    for h in holders:
        if h.get("username") and h.get("photo_url"):
            continue
        try:
            ent = await client.get_entity(int(h["telegram_id"]))
            if not h.get("username") and getattr(ent, "username", None):
                h["username"] = ent.username
            if not h.get("name"):
                nm = " ".join(x for x in [getattr(ent, "first_name", None), getattr(ent, "last_name", None)] if x)
                if nm:
                    h["name"] = nm
        except Exception as e:  # noqa: BLE001
            log(f"  enrich {h['telegram_id']} failed: {e}")
    await client.disconnect()

    # фоллбэк-аватар через see.tg, если username есть, а фото нет
    for h in holders:
        if not h.get("photo_url") and h.get("username"):
            h["photo_url"] = f"{POSO_BASE}/api/avatar/{h['username']}"


async def post_ingest(client: httpx.AsyncClient, path: str, payload: dict) -> None:
    r = await client.post(
        f"{BACKEND_URL}/api/ingest/{path}",
        json=payload,
        headers={"X-Ingest-Secret": INGEST_SECRET},
        timeout=60,
    )
    if r.status_code == 200:
        log(f"ingest/{path} -> {r.json()}")
    else:
        log(f"ingest/{path} FAILED {r.status_code}: {r.text[:200]}")


async def run_once() -> None:
    if not INGEST_SECRET:
        log("ОШИБКА: задай INGEST_SECRET (такой же, как в backend/.env)")
        return
    async with httpx.AsyncClient(headers={"Accept": "application/json"}) as client:
        frogs, holders_map = await fetch_all_frogs(client)
        holders = sorted(holders_map.values(), key=lambda h: h["gifts_count"], reverse=True)
        top = holders[:TOP_WHALES]
        await enrich_with_telethon(top)

        await post_ingest(client, "whales", {"holders": top})
        # каталог лягушек — батчами по 500
        for i in range(0, len(frogs), 500):
            await post_ingest(client, "frogs", {"frogs": frogs[i:i + 500]})
    log("sync done")


async def main() -> None:
    await run_once()
    if SYNC_INTERVAL_HOURS <= 0:
        return
    while True:
        log(f"sleep {SYNC_INTERVAL_HOURS}h")
        await asyncio.sleep(SYNC_INTERVAL_HOURS * 3600)
        try:
            await run_once()
        except Exception as e:  # noqa: BLE001
            log(f"run failed: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
