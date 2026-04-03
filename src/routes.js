const {authorizeCalendarRequest} = require('./auth');

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4;
  }

  return Math.min(50, Math.floor(parsed));
}

function setCorsHeaders(reply, request, config) {
  const requestOrigin = request.headers.origin;
  const allowOrigin = config.corsAllowOrigin;

  if (allowOrigin === '*') {
    reply.header('Access-Control-Allow-Origin', '*');
  } else {
    const allowed = allowOrigin
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (requestOrigin && allowed.includes(requestOrigin)) {
      reply.header('Access-Control-Allow-Origin', requestOrigin);
    }
  }

  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, x-calendar-token');
}

function setCacheHeaders(reply, result) {
  reply.header('X-Cache', result.cacheStatus);
  if (result.cacheAge !== null && result.cacheAge !== undefined) {
    reply.header('X-Cache-Age', String(result.cacheAge));
  }

  if (result.warning) {
    reply.header('Warning', '110 - "Response is stale"');
  }
}

function getBaseUrl(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return host ? `${protocol}://${host}` : '';
}

function enrichEventsPayload(payload, calendarId, request) {
  const baseUrl = getBaseUrl(request);
  return {
    ...payload,
    events: payload.events.map((event) => ({
      ...event,
      icsUrl: `${baseUrl}/api/calendar/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.eventId)}/ics`,
    })),
    subscribeUrl: `${baseUrl}/api/calendar/${encodeURIComponent(calendarId)}/raw`,
  };
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildEventIcs(event) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//open-cached-ics//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.eventId)}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(event.start)}`,
    `DTEND:${toIcsDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title || 'Event')}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.sourceUrl) {
    lines.push(`URL:${escapeIcsText(event.sourceUrl)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

async function calendarHandler(request, reply, app, type) {
  const calendarId = request.params.calendarId || app.config.defaultCalendarId;
  const calendar = app.registry.getCalendar(calendarId);

  if (!calendar) {
    reply.code(404).send({error: 'CALENDAR_NOT_FOUND', message: 'Calendar not found'});
    return;
  }

  const auth = authorizeCalendarRequest(request, calendar, app.config);
  if (!auth.ok) {
    app.log.warn({calendarId, reason: auth.code}, 'calendar auth failed');
    reply.code(401).send({error: auth.code, message: 'Unauthorized'});
    return;
  }

  try {
    if (type === 'raw') {
      const result = await app.calendarService.getRaw(calendarId);
      setCacheHeaders(reply, result);
      reply.header('Cache-Control', 'public, max-age=60');
      reply.type(result.payload.contentType || 'text/calendar; charset=utf-8');
      reply.send(result.payload.text);
      return;
    }

    if (type === 'event-ics') {
      const result = await app.calendarService.getEvent(calendarId, request.params.eventId);
      if (!result.payload) {
        reply.code(404).send({error: 'EVENT_NOT_FOUND', message: 'Event not found'});
        return;
      }

      setCacheHeaders(reply, result);
      reply.header('Cache-Control', 'public, max-age=60');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${(result.payload.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics"`,
      );
      reply.type('text/calendar; charset=utf-8');
      reply.send(buildEventIcs(result.payload));
      return;
    }

    const limit = parseLimit(request.query.limit);
    const result = await app.calendarService.getEvents(calendarId, limit);
    setCacheHeaders(reply, result);
    reply.header('Cache-Control', 'public, max-age=60');
    reply.send(enrichEventsPayload(result.payload, calendarId, request));
  } catch (error) {
    app.log.error({calendarId, err: error}, 'calendar request failed');
    reply.code(502).send(app.calendarService.buildErrorPayload(error));
  }
}

async function registerRoutes(app) {
  app.addHook('onRequest', async (request, reply) => {
    app.log.info({method: request.method, url: request.url}, 'request started');
    setCorsHeaders(reply, request, app.config);
    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    app.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      'request completed',
    );
  });

  app.get('/health', async () => ({
    ok: true,
    time: new Date().toISOString(),
  }));

  app.options('/health', async (request, reply) => {
    reply.code(204).send();
  });

  app.options('/api/calendar/:calendarId/raw', async (request, reply) => {
    reply.code(204).send();
  });

  app.options('/api/calendar/:calendarId/events', async (request, reply) => {
    reply.code(204).send();
  });

  app.options('/api/calendar/:calendarId/events/:eventId/ics', async (request, reply) => {
    reply.code(204).send();
  });

  app.get('/api/calendar/:calendarId/raw', async (request, reply) => {
    await calendarHandler(request, reply, app, 'raw');
  });

  app.get('/api/calendar/:calendarId/events', async (request, reply) => {
    await calendarHandler(request, reply, app, 'events');
  });

  app.get('/api/calendar/:calendarId/events/:eventId/ics', async (request, reply) => {
    await calendarHandler(request, reply, app, 'event-ics');
  });
}

module.exports = {
  registerRoutes,
};
