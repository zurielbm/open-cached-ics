const ical = require('node-ical');
const {normalizeEvent} = require('./normalizeEvent');

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.uid || event.summary || 'event'}:${event.start?.toISOString?.() || 'unknown'}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function expandEvent(event, from, to) {
  try {
    return ical.expandRecurringEvent(event, {
      from,
      to,
      includeOverrides: true,
      excludeExdates: true,
      expandOngoing: false,
    });
  } catch {
    return [event];
  }
}

function parseCalendar(icsText, calendar, options = {}) {
  const now = options.now || new Date();
  const lookaheadDays = options.lookaheadDays || 365;
  const to = new Date(now.getTime() + lookaheadDays * 86400000);
  const parsed = ical.sync.parseICS(icsText);

  const vevents = Object.values(parsed).filter((entry) => entry?.type === 'VEVENT');
  const expanded = [];

  for (const event of vevents) {
    const instances = event.rrule ? expandEvent(event, now, to) : [event];
    expanded.push(...instances);
  }

  const uniqueEvents = dedupeEvents(expanded);
  const futureEvents = uniqueEvents.filter((event) => {
    if (!(event.start instanceof Date) || !(event.end instanceof Date)) {
      return false;
    }

    const status = String(event.status || 'CONFIRMED').toUpperCase();
    return event.start >= now && status !== 'CANCELLED';
  });

  futureEvents.sort((a, b) => a.start - b.start);

  const normalizedEvents = futureEvents
    .map((event) => normalizeEvent(event, calendar))
    .filter(Boolean);

  return {
    events: normalizedEvents,
    eventCount: vevents.length,
    filteredCount: normalizedEvents.length,
  };
}

module.exports = {
  parseCalendar,
};

