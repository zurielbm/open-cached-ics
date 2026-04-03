# open-cached-ics

Small self-hosted calendar proxy for Google Calendar ICS feeds. It exposes:

- `GET /health`
- `GET /api/calendar/:calendarId/raw`
- `GET /api/calendar/:calendarId/events`

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

For Dockploy, the easiest setup is to define your calendar directly in env and avoid editing JSON on the server.

The default port is `3030`.

## Environment

See `.env.example` for the full set. The main ones are:

- `PORT`
- `CALENDAR_ICS_URL`
- `CALENDAR_TIMEZONE`
- `CALENDAR_URL`
- `CALENDAR_TOKEN`
- `CALENDAR_CONFIG_PATH`
- `CACHE_DIR`
- `CACHE_TTL_SECONDS`
- `CACHE_STALE_SECONDS`
- `UPSTREAM_TIMEOUT_MS`
- `CORS_ALLOW_ORIGIN`

## Calendar config

For a single production calendar, configure it directly in `.env` or Dockploy:

```env
CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/xxx/basic.ics
CALENDAR_TIMEZONE=America/New_York
CALENDAR_URL=https://calendar.google.com/calendar/embed?src=xxx
CALENDAR_TOKEN=
```

If `CALENDAR_ICS_URL` is set, it populates the `default` calendar automatically.

For multiple calendars later, create `config/calendars.json` from the example file and provide at least one calendar:

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
