#!/usr/bin/env python3
"""
Одноразовый помощник: логинимся в Telegram и печатаем SESSION_STRING,
который потом кладём в .env как TG_SESSION_STRING.

Запуск:  TG_API_ID=... TG_API_HASH=... python session_string.py
(или заполни их в .env заранее)
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from telethon import TelegramClient
from telethon.sessions import StringSession

api_id = int(os.environ["TG_API_ID"])
api_hash = os.environ["TG_API_HASH"]

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("\nTG_SESSION_STRING=" + client.session.save())
    print("\nСкопируй строку выше в userbot/.env")
