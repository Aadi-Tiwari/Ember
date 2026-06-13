"""
Discord Monitor (optional) - run this in a separate terminal if you have a bot token.

Listens to messages in your Discord server, strips content immediately,
and sends behavioral metadata (timing, channel, length) to the backend.

Setup:
1. Go to https://discord.com/developers/applications
2. Create an app, add a Bot, copy the token
3. Enable "Message Content Intent" under Bot settings
4. Invite bot to your server with message.read permissions
5. Set DISCORD_TOKEN in .env
6. Run: python monitor/discord_monitor.py

Usage:
    python monitor/discord_monitor.py
"""
import hashlib
import os
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
API_URL = "http://localhost:8000/ingest"


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:12]


def main():
    if not DISCORD_TOKEN:
        print("[PulseCheck] DISCORD_TOKEN not set in .env - Discord monitor cannot start.")
        print("[PulseCheck] Set DISCORD_TOKEN=your_bot_token in a .env file and retry.")
        return

    try:
        import discord
    except ImportError:
        print("[PulseCheck] discord.py not installed. Run: pip install discord.py")
        return

    intents = discord.Intents.default()
    intents.message_content = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        print(f"[PulseCheck] Discord monitor connected as {client.user}")
        print(f"[PulseCheck] Monitoring {len(client.guilds)} server(s). Sending to {API_URL}\n")

    @client.event
    async def on_message(message):
        if message.author.bot:
            return

        # Strip all content immediately - keep only behavioral metadata
        event = {
            "type": "message",
            "timestamp": message.created_at.replace(tzinfo=timezone.utc).isoformat(),
            "author_hash": _hash(str(message.author.id)),
            "channel_hash": _hash(str(message.channel.id)),
            "char_count": len(message.content),
            "is_reply": message.reference is not None,
            "hour": message.created_at.hour,
        }

        try:
            requests.post(API_URL, json=event, timeout=2)
            print(f"  msg: ch={event['channel_hash']} len={event['char_count']} hour={event['hour']}")
        except Exception as e:
            print(f"  [warn] send failed: {e}")

    client.run(DISCORD_TOKEN)


if __name__ == "__main__":
    main()
