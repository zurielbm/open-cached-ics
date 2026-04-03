const fs = require('node:fs/promises');
const path = require('node:path');

class FileCache {
  constructor(options) {
    this.cacheDir = options.cacheDir;
    this.memory = {
      raw: new Map(),
      normalized: new Map(),
    };
  }

  async init() {
    await fs.mkdir(this.cacheDir, {recursive: true});
  }

  buildPath(kind, calendarId) {
    return path.join(this.cacheDir, `${calendarId}.${kind}.json`);
  }

  async read(kind, calendarId) {
    const map = this.memory[kind];
    if (map.has(calendarId)) {
      return map.get(calendarId);
    }

    try {
      const filePath = this.buildPath(kind, calendarId);
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      map.set(calendarId, parsed);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async write(kind, calendarId, data) {
    const map = this.memory[kind];
    map.set(calendarId, data);
    const filePath = this.buildPath(kind, calendarId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  getRaw(calendarId) {
    return this.read('raw', calendarId);
  }

  setRaw(calendarId, data) {
    return this.write('raw', calendarId, data);
  }

  getNormalized(calendarId) {
    return this.read('normalized', calendarId);
  }

  setNormalized(calendarId, data) {
    return this.write('normalized', calendarId, data);
  }
}

module.exports = {
  FileCache,
};

