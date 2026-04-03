const {extractImageUrl} = require('./extractImage');
const {findDescriptionHref, pickEventUrl} = require('./extractLinks');

function isAllDayEvent(event) {
  if (event.datetype === 'date' || event.start?.dateOnly) {
    return true;
  }

  if (!(event.start instanceof Date) || !(event.end instanceof Date)) {
    return false;
  }

  const startUtc =
    event.start.getUTCHours() === 0 &&
    event.start.getUTCMinutes() === 0 &&
    event.start.getUTCSeconds() === 0;
  const endUtc =
    event.end.getUTCHours() === 0 &&
    event.end.getUTCMinutes() === 0 &&
    event.end.getUTCSeconds() === 0;

  return startUtc && endUtc && (event.end - event.start) % 86400000 === 0;
}

function normalizeStatus(status) {
  return String(status || 'CONFIRMED').toUpperCase();
}

function toIsoString(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString() : null;
}

function toGoogleDate(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf())
    ? value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    : null;
}

function createEventId(event) {
  const seed = `${event.uid || event.summary || 'event'}|${toIsoString(event.start) || 'unknown'}`;
  return Buffer.from(seed).toString('base64url');
}

function normalizeDescription(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim() || null;
}

function deriveCalendarUrl(calendar) {
  if (calendar.calendarUrl) {
    return calendar.calendarUrl;
  }

  try {
    const parsed = new URL(calendar.icsUrl);
    const match = parsed.pathname.match(/\/ical\/([^/]+)\/basic\.ics$/);
    if (!match) {
      return null;
    }

    return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch {
    return null;
  }
}

function buildGoogleCalendarAddUrl(event, description) {
  const start = toGoogleDate(event.start);
  const end = toGoogleDate(event.end);

  if (!start || !end) {
    return null;
  }

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');

  if (event.summary) {
    url.searchParams.set('text', event.summary);
  }

  url.searchParams.set('dates', `${start}/${end}`);

  if (description) {
    url.searchParams.set('details', description);
  }

  if (event.location) {
    url.searchParams.set('location', event.location);
  }

  return url.toString();
}

function normalizeEvent(event, calendar) {
  const start = toIsoString(event.start);
  const end = toIsoString(event.end);
  if (!start || !end) {
    return null;
  }

  const status = normalizeStatus(event.status);
  const description = normalizeDescription(event.description);
  const eventUrl = pickEventUrl(event);
  const descriptionUrl = findDescriptionHref(event.description);
  const addEventUrl = buildGoogleCalendarAddUrl(event, description);
  const sourceUrl = eventUrl || addEventUrl || deriveCalendarUrl(calendar);

  return {
    eventId: createEventId(event),
    title: event.summary || null,
    description,
    location: event.location || null,
    start,
    end,
    allDay: isAllDayEvent(event),
    status,
    imageUrl: extractImageUrl(event) || null,
    ctaUrl: eventUrl || descriptionUrl || null,
    subscribeUrl: addEventUrl,
    icsUrl: null,
    sourceUrl,
  };
}

module.exports = {
  normalizeEvent,
};
