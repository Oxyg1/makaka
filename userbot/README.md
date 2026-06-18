# SWAMP holders userbot

Демон на Telethon, который раз в день собирает всех **KissedFrog** с владельцами
и отдаёт их в бэкенд SWAMP. Так топ-холдеров мы держим у себя в БД (быстро и
стабильно), а не дёргаем сторонний API на каждом открытии экрана.

## Как это работает

1. `sync.py` постранично тянет `GET {POSO_BASE}/api/gifts?slug=KissedFrog`
   (публичный see.tg) — все лягушки с владельцами.
2. Агрегирует холдеров (сколько лягушек у кого) и берёт топ `TOP_WHALES`.
3. Опционально обогащает топ через Telethon (username / имя / аватар).
4. Шлёт снимок в бэкенд:
   - `POST /api/ingest/whales` — топ-холдеры (полная замена списка);
   - `POST /api/ingest/frogs` — каталог лягушек батчами (upsert) — заодно
     наполняет фильтры и реальные данные карточек.

> Почему Telethon не тянет коллекцию сам: MTProto отдаёт гифты **конкретного**
> пользователя, но глобального индекса «все владельцы коллекции» в Telegram нет.
> Поэтому список берём из see.tg, а Telethon-аккаунт — это раннер и обогатитель.
> Источник в `fetch_all_frogs()` легко заменить на свой.

## Установка

```bash
cd userbot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # заполни значения
```

`INGEST_SECRET` в `userbot/.env` должен совпадать с `INGEST_SECRET` в `backend/.env`.

Telethon-обогащение необязательно — без `TG_*` скрипт работает (username/аватар
возьмутся из данных see.tg, насколько они там есть). Чтобы включить:

```bash
# 1. API_ID/API_HASH: https://my.telegram.org → API development tools
# 2. получить session string (один раз, попросит телефон + код):
python session_string.py
# 3. вставить TG_SESSION_STRING в .env
```

## Запуск

Разовый прогон (для проверки / cron):
```bash
SYNC_INTERVAL_HOURS=0 python sync.py
```

Демоном (сам спит сутки между прогонами):
```bash
python sync.py
# или под pm2:
pm2 start "python sync.py" --name swamp-sync --interpreter none
```

Либо через cron (раз в день в 5 утра), без внутреннего цикла:
```cron
0 5 * * *  cd /var/www/swamp/userbot && SYNC_INTERVAL_HOURS=0 .venv/bin/python sync.py >> sync.log 2>&1
```

## Важно

- Скрипт **не протестирован на живом API** из этой среды — точные имена полей в
  ответе `/api/gifts` (особенно объект владельца) могут чуть отличаться. Парсинг
  сделан защитным (`extract_owner` / `normalize_frog`); при первом прогоне глянь
  лог и при необходимости поправь имена ключей.
- Пока userbot не прогонялся, бэкенд отдаёт холдеров live-фоллбэком с poso.

thanks to @GiftChanges (api.changes.tg) and poso.see.tg for the gift data.
