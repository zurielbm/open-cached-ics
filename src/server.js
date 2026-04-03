const Fastify = require('fastify');
const {loadConfig} = require('./config');
const {CalendarRegistry} = require('./calendarRegistry');
const {FileCache} = require('./cache/fileCache');
const {CalendarService} = require('./calendarService');
const {registerRoutes} = require('./routes');
const {createLogger} = require('./logger');

async function buildServer() {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    logDir: config.logDir,
  });
  const app = Fastify({
    logger: false,
  });

  const registry = new CalendarRegistry(config);
  const cache = new FileCache({cacheDir: config.cacheDir});
  await cache.init();

  const calendarService = new CalendarService({
    cache,
    logger,
    registry,
    config,
  });

  app.decorate('config', config);
  app.decorate('logger', logger);
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
    app.logger.info(
      {
        host: app.config.host,
        port: app.config.port,
      },
      'server started',
    );
  } catch (error) {
    app.logger.error({err: error}, 'failed to start server');
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  buildServer,
};
