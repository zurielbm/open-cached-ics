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

    const limit = parseLimit(request.query.limit);
    const result = await app.calendarService.getEvents(calendarId, limit);
    setCacheHeaders(reply, result);
    reply.header('Cache-Control', 'public, max-age=60');
    reply.send(result.payload);
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

  app.get('/api/calendar/:calendarId/raw', async (request, reply) => {
    await calendarHandler(request, reply, app, 'raw');
  });

  app.get('/api/calendar/:calendarId/events', async (request, reply) => {
    await calendarHandler(request, reply, app, 'events');
  });
}

module.exports = {
  registerRoutes,
};
