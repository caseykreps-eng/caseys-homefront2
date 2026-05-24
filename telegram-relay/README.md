# Telegram Relay

MTProto relay that monitors Telegram channels and exposes messages via HTTP for the intel dashboard.

## Quick Start

```bash
cd telegram-relay
npm install
cp .env.example .env
# Fill in TG_API_ID, TG_API_HASH, TG_PHONE in .env
node relay.js
```

On first run you'll be prompted for your phone verification code. After that the session is saved and it runs headlessly.

## Getting API Credentials

1. Go to https://my.telegram.org
2. Log in with your phone number
3. Click **API Development Tools**
4. Create an app (any name/platform)
5. Copy **App api_id** → `TG_API_ID`
6. Copy **App api_hash** → `TG_API_HASH`

## Default Channels Monitored

- `rybar` — Russian milblogger (translated by followers)
- `wartranslated` — Translation of Russian/Ukrainian mil sources
- `intelslava` — Intel Slava Z
- `militarylandnet` — Military Land

Add more in `.env` under `TG_CHANNELS` as comma-separated usernames.

## HTTP API

| Endpoint | Description |
|---|---|
| `GET /health` | Connection status, uptime |
| `GET /messages?limit=50&channel=rybar` | Paginated messages |
| `GET /channels` | List channels with message counts |

All endpoints except `/health` require `x-relay-secret` header matching `RELAY_SECRET`.

## Connecting to the Dashboard

In your Next.js `.env`:
```
TG_RELAY_URL=http://localhost:3001
TG_RELAY_SECRET=same-value-as-relay-RELAY_SECRET
```

The dashboard's `/api/telegram-feed` route proxies requests to this relay.
