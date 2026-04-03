const {fetchIcs} = require('./fetchIcs');
const {parseCalendar} = require('./parseCalendar');
const {buildEventsEnvelope, buildErrorResponse} = require('./responseBuilder');

class UpstreamUnavailableError extends Error {
  constructor(message, fetchedAt = null) {
    super(message);
    this.name = 'UpstreamUnavailableError';
    this.fetchedAt = fetchedAt;
  }
}

function classifyCache(entry, now, ttlMs, staleMs) {
  if (!entry) {
    return {state: 'miss', ageSeconds: null};
  }

  const ageMs = Math.max(0, now.getTime() - new Date(entry.fetchedAt).getTime());
  if (ageMs <= ttlMs) {
    return {state: 'fresh', ageSeconds: Math.floor(ageMs / 1000)};
  }

  if (ageMs <= ttlMs + staleMs) {
    return {state: 'stale', ageSeconds: Math.floor(ageMs / 1000)};
  }

  return {state: 'expired', ageSeconds: Math.floor(ageMs / 1000)};
}

class CalendarService {
  constructor(options) {
    this.cache = options.cache;
    this.logger = options.logger;
    this.registry = options.registry;
    this.config = options.config;
    this.refreshPromises = new Map();
  }

  refreshInBackground(calendarId) {
    this.refreshCalendar(calendarId).catch((error) => {
      this.logger.warn({calendarId, err: error}, 'background refresh failed');
    });
  }

  refreshCalendar(calendarId) {
    if (this.refreshPromises.has(calendarId)) {
      return this.refreshPromises.get(calendarId);
    }

    const promise = this.performRefresh(calendarId).finally(() => {
      this.refreshPromises.delete(calendarId);
    });

    this.refreshPromises.set(calendarId, promise);
    return promise;
  }

  async performRefresh(calendarId) {
    const calendar = this.registry.getCalendar(calendarId);
    if (!calendar) {
      const error = new Error(`Unknown calendar: ${calendarId}`);
      error.statusCode = 404;
      throw error;
    }

    const existingRaw = await this.cache.getRaw(calendarId);
    const fetchResult = await fetchIcs(calendar, {
      timeoutMs: this.config.upstreamTimeoutMs,
      etag: existingRaw?.etag,
      lastModified: existingRaw?.lastModified,
    });

    if (fetchResult.status === 304 && existingRaw) {
      const refreshedRaw = {
        ...existingRaw,
        fetchedAt: new Date().toISOString(),
        etag: fetchResult.etag || existingRaw.etag || null,
        lastModified: fetchResult.lastModified || existingRaw.lastModified || null,
      };

      await this.cache.setRaw(calendarId, refreshedRaw);

      const existingNormalized = await this.cache.getNormalized(calendarId);
      const normalizedPayload = existingNormalized
        ? {
            ...existingNormalized,
            fetchedAt: refreshedRaw.fetchedAt,
          }
        : {
            events: parseCalendar(refreshedRaw.text, calendar, {
              now: new Date(),
              lookaheadDays: this.config.eventLookaheadDays,
            }).events,
            timezone: calendar.timezone,
            fetchedAt: refreshedRaw.fetchedAt,
          };

      await this.cache.setNormalized(calendarId, normalizedPayload);

      this.logger.info({calendarId, durationMs: fetchResult.durationMs}, 'upstream not modified');
      return {
        raw: refreshedRaw,
        normalized: normalizedPayload,
      };
    }

    const fetchedAt = new Date().toISOString();
    const parsed = parseCalendar(fetchResult.text, calendar, {
      now: new Date(),
      lookaheadDays: this.config.eventLookaheadDays,
    });

    const rawPayload = {
      text: fetchResult.text,
      fetchedAt,
      etag: fetchResult.etag || null,
      lastModified: fetchResult.lastModified || null,
      contentType: fetchResult.contentType,
    };

    const normalizedPayload = {
      events: parsed.events,
      timezone: calendar.timezone,
      fetchedAt,
    };

    await Promise.all([
      this.cache.setRaw(calendarId, rawPayload),
      this.cache.setNormalized(calendarId, normalizedPayload),
    ]);

    this.logger.info(
      {
        calendarId,
        durationMs: fetchResult.durationMs,
        eventCount: parsed.eventCount,
        filteredCount: parsed.filteredCount,
      },
      'calendar refreshed',
    );

    return {
      raw: rawPayload,
      normalized: normalizedPayload,
    };
  }

  async getRaw(calendarId) {
    const now = new Date();
    const ttlMs = this.config.cacheTtlSeconds * 1000;
    const staleMs = this.config.cacheStaleSeconds * 1000;
    const cached = await this.cache.getRaw(calendarId);
    const classification = classifyCache(cached, now, ttlMs, staleMs);

    if (classification.state === 'fresh') {
      return {payload: cached, cacheStatus: 'HIT', cacheAge: classification.ageSeconds};
    }

    if (classification.state === 'stale') {
      this.refreshInBackground(calendarId);
      return {payload: cached, cacheStatus: 'STALE', cacheAge: classification.ageSeconds};
    }

    try {
      const refreshed = await this.refreshCalendar(calendarId);
      return {
        payload: refreshed.raw,
        cacheStatus: classification.state === 'miss' ? 'MISS' : 'REFRESH',
        cacheAge: 0,
      };
    } catch (error) {
      if (cached) {
        this.logger.warn({calendarId, err: error}, 'serving stale raw cache after refresh failure');
        return {payload: cached, cacheStatus: 'STALE', cacheAge: classification.ageSeconds, warning: true};
      }

      throw new UpstreamUnavailableError('Failed to refresh calendar feed');
    }
  }

  async getEvents(calendarId, limit) {
    const now = new Date();
    const ttlMs = this.config.cacheTtlSeconds * 1000;
    const staleMs = this.config.cacheStaleSeconds * 1000;
    const cached = await this.cache.getNormalized(calendarId);
    const classification = classifyCache(cached, now, ttlMs, staleMs);

    if (classification.state === 'fresh') {
      return {
        payload: buildEventsEnvelope(cached, limit),
        cacheStatus: 'HIT',
        cacheAge: classification.ageSeconds,
      };
    }

    if (classification.state === 'stale') {
      this.refreshInBackground(calendarId);
      return {
        payload: buildEventsEnvelope(cached, limit),
        cacheStatus: 'STALE',
        cacheAge: classification.ageSeconds,
      };
    }

    try {
      const refreshed = await this.refreshCalendar(calendarId);
      return {
        payload: buildEventsEnvelope(refreshed.normalized, limit),
        cacheStatus: classification.state === 'miss' ? 'MISS' : 'REFRESH',
        cacheAge: 0,
      };
    } catch (error) {
      if (cached) {
        this.logger.warn({calendarId, err: error}, 'serving stale normalized cache after refresh failure');
        return {
          payload: buildEventsEnvelope(cached, limit),
          cacheStatus: 'STALE',
          cacheAge: classification.ageSeconds,
          warning: true,
        };
      }

      throw new UpstreamUnavailableError('Failed to refresh calendar feed');
    }
  }

  buildErrorPayload(error) {
    return buildErrorResponse('UPSTREAM_UNAVAILABLE', error.message, error.fetchedAt || new Date().toISOString());
  }
}

module.exports = {
  CalendarService,
  UpstreamUnavailableError,
};
