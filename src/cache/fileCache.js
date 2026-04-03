const fs = require('node:fs/promises');
const path = require('node:path');

class FileCache {
  constructor(options) {
    this.cacheDir = options.cacheDir;
    this.imageDir = path.join(this.cacheDir, 'images');
    this.memory = {
      raw: new Map(),
      normalized: new Map(),
      image: new Map(),
    };
  }

  async init() {
    await fs.mkdir(this.cacheDir, {recursive: true});
    await fs.mkdir(this.imageDir, {recursive: true});
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

  buildImageMetaPath(cacheKey) {
    return path.join(this.imageDir, `${cacheKey}.json`);
  }

  buildImageBodyPath(cacheKey) {
    return path.join(this.imageDir, `${cacheKey}.body`);
  }

  async getImage(cacheKey) {
    const map = this.memory.image;
    if (map.has(cacheKey)) {
      return map.get(cacheKey);
    }

    try {
      const [metaRaw, body] = await Promise.all([
        fs.readFile(this.buildImageMetaPath(cacheKey), 'utf8'),
        fs.readFile(this.buildImageBodyPath(cacheKey)),
      ]);
      const payload = {
        ...JSON.parse(metaRaw),
        body,
      };
      map.set(cacheKey, payload);
      return payload;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async setImage(cacheKey, data) {
    const payload = {
      contentType: data.contentType,
      fetchedAt: data.fetchedAt,
      sourceUrl: data.sourceUrl,
      body: Buffer.isBuffer(data.body) ? data.body : Buffer.from(data.body),
    };

    this.memory.image.set(cacheKey, payload);

    await Promise.all([
      fs.writeFile(
        this.buildImageMetaPath(cacheKey),
        JSON.stringify(
          {
            contentType: payload.contentType,
            fetchedAt: payload.fetchedAt,
            sourceUrl: payload.sourceUrl,
          },
          null,
          2,
        ),
        'utf8',
      ),
      fs.writeFile(this.buildImageBodyPath(cacheKey), payload.body),
    ]);

    return payload;
  }
}

module.exports = {
  FileCache,
};
