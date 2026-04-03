# open-cached-ics

Small self-hosted calendar proxy for Google Calendar ICS feeds.

It fetches a Google Calendar ICS URL, caches the upstream response, filters to future non-cancelled events, and exposes:

- raw cached ICS
- normalized JSON for a homepage or frontend
- per-event ICS download links
- add-to-calendar links

## What It Exposes

- `GET /health`
- `GET /api/calendar/:calendarId/events`
- `GET /api/calendar/:calendarId/raw`
- `GET /api/calendar/:calendarId/events/:eventId/ics`
- `GET /api/calendar/:calendarId/events/:eventId/image`

Default calendar id: `default`

Default port: `3030`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the env file:

```bash
cp .env.example .env
```

3. Edit `.env` and set at least `CALENDAR_ICS_URL`

Example:

```env
PORT=3030
CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/your-calendar-id/public/basic.ics
CALENDAR_TIMEZONE=America/New_York
CALENDAR_URL=https://calendar.google.com/calendar/embed?src=your-calendar-id
CALENDAR_TOKEN=
```

4. Start the server:

```bash
npm start
```

Force a manual data refresh from the terminal:

```bash
pnpm refresh
```

This refreshes:

- raw ICS cache
- normalized JSON cache
- cached images for current upcoming events that have an image

Refresh one specific calendar:

```bash
pnpm refresh default
```

## URLs To Use

After startup, these are the main URLs to test in your browser or with `curl`.

Health check:

```text
http://localhost:3030/health
```

Normalized upcoming events JSON:

```text
http://localhost:3030/api/calendar/default/events
```

Raw cached ICS feed:

```text
http://localhost:3030/api/calendar/default/raw
```

Protected calendar example with token:

```text
http://localhost:3030/api/calendar/default/events?token=YOUR_TOKEN
http://localhost:3030/api/calendar/default/raw?token=YOUR_TOKEN
```

Per-event ICS download:

1. First fetch:

```text
http://localhost:3030/api/calendar/default/events
```

2. Copy an event's `icsUrl` field. It will look like:

```text
http://localhost:3030/api/calendar/default/events/EVENT_ID/ics
```

Per-event cached image:

1. First fetch:

```text
http://localhost:3030/api/calendar/default/events
```

2. Copy an event's `imageUrl` field. It will look like:

```text
http://localhost:3030/api/calendar/default/events/EVENT_ID/image
```

Whole-calendar subscription URL:

Use the raw endpoint:

```text
http://localhost:3030/api/calendar/default/raw
```

If you want to subscribe in another app, use that URL as the calendar feed URL.

## Example Event JSON

The `/api/calendar/default/events` response looks like:

```json
{
  "events": [
    {
      "eventId": "YWJjfDIwMjYtMDQtMDVUMTQ6MDA6MDAuMDAwWg",
      "title": "Sunday Event",
      "description": "Sunday Event Description",
      "location": "123 Main St, Anytown, USA",
      "start": "2026-04-05T14:00:00.000Z",
      "end": "2026-04-05T16:30:00.000Z",
      "allDay": false,
      "status": "CONFIRMED",
      "imageUrl": "http://localhost:3030/api/calendar/default/events/EVENT_ID/image",
      "ctaUrl": null,
      "subscribeUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE...",
      "icsUrl": "http://localhost:3030/api/calendar/default/events/EVENT_ID/ics",
      "sourceUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE..."
    }
  ],
  "timezone": "America/New_York",
  "fetchedAt": "2026-04-03T01:00:00.000Z",
  "subscribeUrl": "http://localhost:3030/api/calendar/default/raw"
}
```

Field behavior:

- `ctaUrl`: explicit event URL from the ICS, or first link from the description, otherwise `null`
- `subscribeUrl` on each event: Google Calendar "add event" link
- `imageUrl`: locally proxied and cached image URL when the event has an image
- `icsUrl`: direct downloadable ICS file for that event
- top-level `subscribeUrl`: whole-calendar raw ICS feed from this proxy

## How To Get Your Google Calendar URL

In Google Calendar:

1. Open calendar settings for the calendar
2. Find `Integrate calendar`
3. Copy `Public address in iCal format`

Use that as:

```env
CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/.../public/basic.ics
```

If you also want a fallback calendar page URL, use either:

- `Public URL to this calendar`
- the `src=` URL from the embed code

Example:

```env
CALENDAR_URL=https://calendar.google.com/calendar/embed?src=your-calendar-id
```

Do not expose the `Secret address in iCal format` publicly unless you understand the risk. If you use the secret ICS URL, protect your proxy with `CALENDAR_TOKEN`.

## Environment Variables

Every supported env var from [.env.example](/Users/zuriel/Code/open-cached-ics/.env.example#L1) is listed here.

### `PORT`

Port the HTTP server listens on.

Example:

```env
PORT=3030
```

### `HOST`

Bind address for the server.

Use `0.0.0.0` in Docker or Dockploy so the container is reachable.

Example:

```env
HOST=0.0.0.0
```

### `DEFAULT_CALENDAR_ID`

The default calendar id used by routes such as `/api/calendar/default/events`.

Example:

```env
DEFAULT_CALENDAR_ID=default
```

### `CALENDAR_CONFIG_PATH`

Path to the JSON calendar registry file for multi-calendar setups.

If `CALENDAR_ICS_URL` is set, the app can run without this file for the default calendar.

Example:

```env
CALENDAR_CONFIG_PATH=./config/calendars.json
```

### `CALENDAR_ICS_URL`

The upstream Google Calendar ICS URL for the default calendar.

This is the main setting you need for a single calendar setup.

Example:

```env
CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/your-calendar-id/public/basic.ics
```

### `CALENDAR_TIMEZONE`

Timezone returned in the JSON response for frontend display.

Dates in the API are still returned as UTC ISO strings.

Example:

```env
CALENDAR_TIMEZONE=America/New_York
```

### `CALENDAR_URL`

Optional fallback calendar landing page URL.

Used as a source/fallback URL when the service can derive a calendar page link.

Example:

```env
CALENDAR_URL=https://calendar.google.com/calendar/embed?src=your-calendar-id
```

### `CALENDAR_TOKEN`

Optional shared secret for protecting requests.

If this is set for the default calendar, requests can pass it with:

- `?token=YOUR_TOKEN`
- header `x-calendar-token: YOUR_TOKEN`

Example:

```env
CALENDAR_TOKEN=my-shared-secret
```

### `CACHE_DIR`

Directory where cache files are written.

Persist this directory in Dockploy if you want cache reuse across restarts.

Example:

```env
CACHE_DIR=./data/cache
```

### `CACHE_TTL_SECONDS`

How long cached data is considered fresh.

Example:

```env
CACHE_TTL_SECONDS=86400
```

Common values:

- `900` = 15 minutes
- `3600` = 1 hour
- `86400` = 24 hours

### `CACHE_STALE_SECONDS`

How long stale cache may still be served while the app refreshes in the background.

Example:

```env
CACHE_STALE_SECONDS=86400
```

Recommended faster-refresh example:

```env
CACHE_TTL_SECONDS=900
CACHE_STALE_SECONDS=3600
```

### `IMAGE_CACHE_TTL_SECONDS`

How long cached images are considered fresh.

If omitted, it falls back to `CACHE_TTL_SECONDS`.

Example:

```env
IMAGE_CACHE_TTL_SECONDS=86400
```

### `IMAGE_CACHE_STALE_SECONDS`

How long stale cached images may still be served while the image refresh happens in the background.

If omitted, it falls back to `CACHE_STALE_SECONDS`.

Example:

```env
IMAGE_CACHE_STALE_SECONDS=86400
```

### `UPSTREAM_TIMEOUT_MS`

Timeout for the upstream Google Calendar fetch.

Example:

```env
UPSTREAM_TIMEOUT_MS=8000
```

### `CORS_ALLOW_ORIGIN`

CORS allow origin value.

Use `*` for public access or a comma-separated allowlist for a locked-down frontend.

Examples:

```env
CORS_ALLOW_ORIGIN=*
```

```env
CORS_ALLOW_ORIGIN=https://your-site.com,https://www.your-site.com
```

### `LOG_LEVEL`

Fastify log level.

Example:

```env
LOG_LEVEL=info
```

### `EVENT_LOOKAHEAD_DAYS`

How far ahead recurring event expansion looks when parsing ICS data.

Example:

```env
EVENT_LOOKAHEAD_DAYS=365
```

### `REQUIRE_TOKEN`

If `true`, requests require a token. This is mainly useful when you want to enforce protection globally.

Example:

```env
REQUIRE_TOKEN=false
```

## Single Calendar Setup For Dockploy

For Dockploy, the simplest production setup is env-only:

```env
PORT=3030
HOST=0.0.0.0
DEFAULT_CALENDAR_ID=default
CALENDAR_ICS_URL=https://calendar.google.com/calendar/ical/your-calendar-id/public/basic.ics
CALENDAR_TIMEZONE=America/New_York
CALENDAR_URL=https://calendar.google.com/calendar/embed?src=your-calendar-id
CALENDAR_TOKEN=
CACHE_DIR=/app/data/cache
CACHE_TTL_SECONDS=900
CACHE_STALE_SECONDS=3600
IMAGE_CACHE_TTL_SECONDS=86400
IMAGE_CACHE_STALE_SECONDS=604800
UPSTREAM_TIMEOUT_MS=8000
CORS_ALLOW_ORIGIN=*
LOG_LEVEL=info
EVENT_LOOKAHEAD_DAYS=365
REQUIRE_TOKEN=false
```

Mount `CACHE_DIR` as persistent storage, for example:

```text
/app/data/cache
```

## Multi-Calendar Setup

For multiple calendars later, keep using env for shared runtime settings and define calendars in `config/calendars.json`.

Example:

```json
{
  "default": {
    "icsUrl": "https://calendar.google.com/calendar/ical/aaa/basic.ics",
    "timezone": "America/New_York",
    "calendarUrl": "https://calendar.google.com/calendar/embed?src=aaa"
  },
  "students": {
    "icsUrl": "https://calendar.google.com/calendar/ical/bbb/basic.ics",
    "timezone": "America/New_York",
    "calendarUrl": "https://calendar.google.com/calendar/embed?src=bbb",
    "token": "students-secret"
  }
}
```

Then use:

- `http://localhost:3030/api/calendar/default/events`
- `http://localhost:3030/api/calendar/students/events?token=students-secret`

## Cache Behavior

Two cache files are maintained per calendar:

- raw upstream ICS cache
- normalized JSON cache
- image cache files for per-event image requests

On refresh, the app does not delete the cache directory. It overwrites the calendar's cache files in place with the latest data.

When the cache is stale:

- stale data can be returned immediately
- refresh happens in the background
- stale data is used as a fallback if upstream is slow or unavailable
- repeated event image requests are served from local cache instead of refetching the upstream image every time

To force a refresh during testing:

```bash
pnpm refresh
```

From a Dockploy terminal inside the container, run:

```bash
cd /app
node src/refresh.js
```

## Useful Test Commands

Health:

```bash
curl http://localhost:3030/health
```

Events JSON:

```bash
curl http://localhost:3030/api/calendar/default/events
```

Raw ICS:

```bash
curl http://localhost:3030/api/calendar/default/raw
```

Protected events JSON:

```bash
curl "http://localhost:3030/api/calendar/default/events?token=YOUR_TOKEN"
```

Download one event ICS:

```bash
curl -OJ http://localhost:3030/api/calendar/default/events/EVENT_ID/ics
```

## Docker

Build:

```bash
docker build -t open-cached-ics .
```

Run:

```bash
docker run --rm -p 3030:3030 -v "$PWD/data:/app/data" open-cached-ics
```
