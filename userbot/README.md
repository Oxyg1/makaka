# SWAMP holders userbot (Telethon / MTProto)

Демон, который берёт данные **напрямую из Telegram** (MTProto, без сторонних API),
собирает всех KissedFrog с владельцами и отдаёт снимок в бэкенд SWAMP. Так
топ-холдеров мы держим у себя в БД — быстро и стабильно.

## Как работает

Два режима (`MODE` в `.env`):
- **full** (по умолчанию) — перебор `KissedFrog-1..MAX_NUM` через
  `payments.GetUniqueStarGiftRequest`. Возвращает каждую существующую лягушку с
  атрибутами (модель/фон/узор + цвета + редкость) и **владельцем** (`owner_id`).
  Это режим для холдеров. ~15 000 запросов × `DELAY_SECONDS` ≈ пара часов.
- **fast** — `payments.GetResaleStarGiftsRequest`: только то, что сейчас на
  продаже (быстро, с ценами).

Каждый прогон:
1. собирает лягушки (`gift_to_frog`);
2. агрегирует холдеров по `owner_id` (PeerUser → telegram_id);
3. обогащает топ-`TOP_WHALES` через `get_entity` (username/имя), аватар — по
   `see.tg/api/avatar/{username}`;
4. шлёт в бэкенд: `POST /api/ingest/whales` (полная замена) и
   `POST /api/ingest/frogs` (каталог батчами).

## Установка

```bash
cd userbot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # заполни значения
```

`INGEST_SECRET` тут и в `backend/.env` должны совпадать.

Вход в Telegram — один из двух способов:
- указать `PHONE_NUMBER` (на первом запуске спросит код), или
- получить session-строку и положить в `TG_SESSION_STRING`:
  ```bash
  python session_string.py
  ```

## Запуск

```bash
SYNC_INTERVAL_HOURS=0 python sync.py     # разовый прогон (для проверки/cron)
python sync.py                            # демон: прогон + сон сутки
```

cron (раз в день, full ночью):
```cron
0 4 * * *  cd /var/www/swamp/userbot && SYNC_INTERVAL_HOURS=0 .venv/bin/python sync.py >> sync.log 2>&1
```

## Куда ещё можно деть эти данные (идеи)

Парсинг через MTProto даёт богатый набор — не только холдеров. Что из этого
можно выжать (готов реализовать по запросу):

1. **Настоящие цены / floor на карточках.** `resell_amount` (режим fast) — цена в
   TON. Можно показывать «на продаже за X TON», бейдж и сортировку по цене, а из
   `Холдеров` сделать полноценный маркет с флором.
2. **Свой словарь цветов фонов.** Из `starGiftAttributeBackdrop` приходят
   `center/edge/pattern/text_color` — это авторитетные цвета прямо из Telegram.
   Можно хранить их у себя и отдавать в preload вместо зависимости от changes.tg
   (сейчас бэкенд эти `colors` в payload игнорирует — поле уже шлётся, осталось
   добавить таблицу + отдачу).
3. **Бейджи редкости.** `rarity_permille` для модели/фона/узора → «rare / epic /
   legendary» прямо на карточке и в детали.
4. **Лидерборд по стоимости портфеля.** Кол-во × floor = ценность коллекции
   холдера, отдельная сортировка китов.
5. **Авто-подбор обменов.** Раз у нас есть полные коллекции всех — можно
   подсказывать «у кого есть то, что ты хочешь, и кто хочет то, что есть у тебя».

## Важно

- На первом прогоне глянь лог: имена классов атрибутов и поля владельца берутся
  по эталону (`Model`/`Backdrop`/`Pattern`, `owner_id.user_id`), но если Telegram
  что-то переименует — парсинг (`extract_attributes`/`extract_owner_tg`) правится
  в одном месте.
- Пока userbot не отработал, бэкенд отдаёт холдеров live-фоллбэком с poso.

thanks to @GiftChanges (api.changes.tg) for the in-app gift visuals.
