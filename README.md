# SWAMP

Telegram mini-app для обмена NFT-подарками KissedFrog внутри комьюнити лягушек.

## Что это

- Авторизация через Telegram, синхронизация подарков с профиля через [poso.see.tg](https://poso.see.tg/api/docs).
- Инвентарь — все ваши `KissedFrog` собираются в одно место с атрибутами (модель, фон, узор, номер).
- Маркет — открытые ордеры на обмен / продажу с фильтрами по модели, фону, узору.
- Поиск — найти конкретную лягушку по ссылке или по фильтрам, предложить обмен даже если ордера нет.
- Сделки — входящие и исходящие офферы; обмен через эскроу на аккаунте `kissedfrog`-бота.

## Благодарности

- **[@GiftChanges](https://t.me/GiftChanges)** ([api.changes.tg](https://api.changes.tg)) — визуалки моделей, фонов и узоров для подарков.
- **[poso.see.tg](https://poso.see.tg)** — данные о владельцах и подарках.

## Стек

- **Backend**: Node + Express + SQLite (`better-sqlite3`), TG init-data auth.
- **Frontend**: React 19 + Vite + `@telegram-apps/sdk-react`.
- **Дизайн**: тёмная тема в стиле [Portals](https://portal-market.com) с лягушачьим акцентом.

## Запуск

```bash
npm install
npm run dev
```

Backend на `:3001`, frontend на `:5173`. Vite проксирует `/api` на бекенд.

## Переменные окружения (backend/.env)

```
BOT_TOKEN=...                   # для верификации initData
POSO_API_BASE=https://poso.see.tg/api
ESCROW_USERNAME=kissedfrog      # юзернейм бот-аккаунта, куда отправляются лягушки
FRONTEND_URL=http://localhost:5173
```
