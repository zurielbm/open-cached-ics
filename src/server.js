const Fastify = require('fastify');
const {loadConfig} = require('./config');
const {CalendarRegistry} = require('./calendarRegistry');
const {FileCache} = require('./cache/fileCache');
const {CalendarService} = require('./calendarService');
const {registerRoutes} = require('./routes');

async function buildServer() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  const registry = new CalendarRegistry(config);
  const cache = new FileCache({cacheDir: config.cacheDir});
  await cache.init();

  const calendarService = new CalendarService({
    cache,
    logger: app.log,
    registry,
    config,
  });

  app.decorate('config', config);
  app.decorate('registry', registry);
  app.decorate('calendarService', calendarService);

  await registerRoutes(app);
  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({
      port: app.config.port,
      host: app.config.host,
    });
  } catch (error) {
    app.log.error(error, 'failed to start server');
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  buildServer,
};
