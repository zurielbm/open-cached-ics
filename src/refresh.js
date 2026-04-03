const {loadConfig} = require('./config');
const {CalendarRegistry} = require('./calendarRegistry');
const {FileCache} = require('./cache/fileCache');
const {CalendarService} = require('./calendarService');

async function main() {
  const config = loadConfig();
  const registry = new CalendarRegistry(config);
  const cache = new FileCache({cacheDir: config.cacheDir});
  await cache.init();

  const logger = {
    info(payload, message) {
      console.log(message, payload ? JSON.stringify(payload) : '');
    },
    warn(payload, message) {
      console.warn(message, payload ? JSON.stringify(payload) : '');
    },
    error(payload, message) {
      console.error(message, payload ? JSON.stringify(payload) : '');
    },
  };

  const calendarService = new CalendarService({
    cache,
    logger,
    registry,
    config,
  });

  const requestedIds = process.argv.slice(2).filter(Boolean);
  const calendarIds = requestedIds.length ? requestedIds : registry.listCalendarIds();

  if (!calendarIds.length) {
    throw new Error('No calendars available to refresh');
  }

  for (const calendarId of calendarIds) {
    const startedAt = Date.now();
    console.log(`Refreshing calendar: ${calendarId}`);
    const refreshed = await calendarService.refreshCalendar(calendarId);
    const eventsWithImages = (refreshed.normalized?.events || []).filter((event) => event.imageSourceUrl);
    let refreshedImages = 0;

    for (const event of eventsWithImages) {
      try {
        await calendarService.refreshEventImage(calendarId, event.eventId, event.imageSourceUrl);
        refreshedImages += 1;
      } catch (error) {
        logger.warn(
          {
            calendarId,
            eventId: event.eventId,
            sourceUrl: event.imageSourceUrl,
            err: error.message,
          },
          'image refresh failed',
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify(
        {
          calendarId,
          durationMs,
          fetchedAt: refreshed.normalized?.fetchedAt || refreshed.raw?.fetchedAt || null,
          eventCount: refreshed.normalized?.events?.length || 0,
          imageCount: eventsWithImages.length,
          refreshedImages,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
