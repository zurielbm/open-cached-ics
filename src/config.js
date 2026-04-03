const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function loadCalendarsFromFile(configPath) {
  const resolvedPath = resolvePath(configPath);

  if (!fs.existsSync(resolvedPath)) {
    return {calendars: {}, configPath: resolvedPath};
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Calendar config must be a JSON object keyed by calendar id');
  }

  return {calendars: parsed, configPath: resolvedPath};
}

function loadCalendars(configPath) {
  const fromFile = loadCalendarsFromFile(configPath);
  const defaultCalendarId = process.env.DEFAULT_CALENDAR_ID || 'default';
  const envIcsUrl = process.env.CALENDAR_ICS_URL;

  const calendars = {...fromFile.calendars};

  if (envIcsUrl) {
    calendars[defaultCalendarId] = {
      ...(calendars[defaultCalendarId] || {}),
      icsUrl: envIcsUrl,
      timezone: process.env.CALENDAR_TIMEZONE || calendars[defaultCalendarId]?.timezone || 'UTC',
      token: process.env.CALENDAR_TOKEN || calendars[defaultCalendarId]?.token || undefined,
      calendarUrl: process.env.CALENDAR_URL || calendars[defaultCalendarId]?.calendarUrl || undefined,
    };
  }

  if (!Object.keys(calendars).length) {
    throw new Error(
      `No calendars configured. Set CALENDAR_ICS_URL or provide a config file at ${fromFile.configPath}`,
    );
  }

  return {calendars, configPath: fromFile.configPath};
}

function loadConfig() {
  const calendarConfigPath = process.env.CALENDAR_CONFIG_PATH || './config/calendars.json';
  const {calendars, configPath} = loadCalendars(calendarConfigPath);

  return {
    port: toNumber(process.env.PORT, 3030),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    defaultCalendarId: process.env.DEFAULT_CALENDAR_ID || 'default',
    cacheDir: resolvePath(process.env.CACHE_DIR || './data/cache'),
    cacheTtlSeconds: toNumber(process.env.CACHE_TTL_SECONDS, 86400),
    cacheStaleSeconds: toNumber(process.env.CACHE_STALE_SECONDS, 86400),
    upstreamTimeoutMs: toNumber(process.env.UPSTREAM_TIMEOUT_MS, 8000),
    corsAllowOrigin: process.env.CORS_ALLOW_ORIGIN || '*',
    requireToken: toBoolean(process.env.REQUIRE_TOKEN, false),
    eventLookaheadDays: toNumber(process.env.EVENT_LOOKAHEAD_DAYS, 365),
    calendarConfigPath: configPath,
    calendars,
  };
}

module.exports = {
  loadConfig,
};
