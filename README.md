# open-cached-ics

Small self-hosted calendar proxy for Google Calendar ICS feeds. It exposes:

- `GET /health`
- `GET /api/calendar/:calendarId/raw`
- `GET /api/calendar/:calendarId/events`

## Quick start

```bash
npm install
cp .env.example .env
cp config/calendars.example.json config/calendars.json
npm start
```

## Environment

See `.env.example` for the full set. The main ones are:

- `PORT`
- `CALENDAR_CONFIG_PATH`
- `CACHE_DIR`
- `CACHE_TTL_SECONDS`
- `CACHE_STALE_SECONDS`
- `UPSTREAM_TIMEOUT_MS`
- `CORS_ALLOW_ORIGIN`

## Calendar config

Create `config/calendars.json` from the example file and provide at least one calendar:

```json
{
  "default": {
    "icsUrl": "https://calendar.google.com/calendar/ical/xxx/basic.ics",
    "timezone": "America/New_York",
    "calendarUrl": "https://calendar.google.com/calendar/embed?src=xxx"
  }
}
```

`token` is optional per calendar. When present, requests must send either `?token=...` or `x-calendar-token`.

## Cache behavior

- Fresh for `CACHE_TTL_SECONDS`
- Stale-while-revalidate for an additional `CACHE_STALE_SECONDS`
- Falls back to stale cache when upstream refresh fails

Persist `CACHE_DIR` as a Dockploy volume, for example `/app/data/cache`.

