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

function normalizeEvent(event, calendar) {
  const start = toIsoString(event.start);
  const end = toIsoString(event.end);
  if (!start || !end) {
    return null;
  }

  const status = normalizeStatus(event.status);
  const eventUrl = pickEventUrl(event);
  const descriptionUrl = findDescriptionHref(event.description);
  const fallbackUrl = deriveCalendarUrl(calendar);
  const sourceUrl = eventUrl || fallbackUrl;

  return {
    title: event.summary || null,
    description: normalizeDescription(event.description),
    location: event.location || null,
    start,
    end,
    allDay: isAllDayEvent(event),
    status,
    imageUrl: extractImageUrl(event) || null,
    ctaUrl: eventUrl || descriptionUrl || fallbackUrl,
    sourceUrl,
  };
}

module.exports = {
  normalizeEvent,
};
