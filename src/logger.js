const fs = require('node:fs');
const path = require('node:path');

const LEVELS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

function ensureErrorFields(payload) {
  if (!payload || typeof payload !== 'object' || !payload.err) {
    return payload;
  }

  const error = payload.err;
  if (!(error instanceof Error)) {
    return payload;
  }

  return {
    ...payload,
    err: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    },
  };
}

function formatValue(value) {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value.includes(' ') ? JSON.stringify(value) : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatHumanLine(timestamp, level, message, payload) {
  const details = Object.entries(payload || {})
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');

  if (!details) {
    return `[${timestamp}] ${level.toUpperCase()} ${message}`;
  }

  return `[${timestamp}] ${level.toUpperCase()} ${message} ${details}`;
}

function createLogger(options = {}) {
  const level = options.level || 'info';
  const minLevel = LEVELS[level] || LEVELS.info;
  const logDir = options.logDir || path.resolve(process.cwd(), 'data/logs');

  fs.mkdirSync(logDir, {recursive: true});

  const humanStream = fs.createWriteStream(path.join(logDir, 'app.log'), {flags: 'a'});
  const jsonStream = fs.createWriteStream(path.join(logDir, 'app.jsonl'), {flags: 'a'});

  function write(levelName, payload, message) {
    if ((LEVELS[levelName] || LEVELS.info) < minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const normalizedPayload = ensureErrorFields(payload);
    const entry = {
      timestamp,
      level: levelName,
      message,
      ...(normalizedPayload || {}),
    };

    const humanLine = `${formatHumanLine(timestamp, levelName, message, normalizedPayload)}\n`;
    const jsonLine = `${JSON.stringify(entry)}\n`;

    const consoleMethod = levelName === 'error' ? console.error : levelName === 'warn' ? console.warn : console.log;
    consoleMethod(humanLine.trimEnd());
    humanStream.write(humanLine);
    jsonStream.write(jsonLine);
  }

  return {
    debug(payload, message) {
      write('debug', payload, message);
    },
    info(payload, message) {
      write('info', payload, message);
    },
    warn(payload, message) {
      write('warn', payload, message);
    },
    error(payload, message) {
      write('error', payload, message);
    },
  };
}

module.exports = {
  createLogger,
};
