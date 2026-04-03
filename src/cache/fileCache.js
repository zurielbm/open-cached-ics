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
    this.memoryMeta = {
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

  async readFileStat(filePath) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async read(kind, calendarId) {
    const map = this.memory[kind];
    const metaMap = this.memoryMeta[kind];
    const filePath = this.buildPath(kind, calendarId);

    if (map.has(calendarId)) {
      const stat = await this.readFileStat(filePath);
      if (!stat) {
        map.delete(calendarId);
        metaMap.delete(calendarId);
        return null;
      }

      const cachedMtimeMs = metaMap.get(calendarId);
      if (cachedMtimeMs === stat.mtimeMs) {
        return map.get(calendarId);
      }
    }

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const stat = await this.readFileStat(filePath);
      map.set(calendarId, parsed);
      metaMap.set(calendarId, stat?.mtimeMs || null);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        map.delete(calendarId);
        metaMap.delete(calendarId);
        return null;
      }

      throw error;
    }
  }

  async write(kind, calendarId, data) {
    const map = this.memory[kind];
    const metaMap = this.memoryMeta[kind];
    const filePath = this.buildPath(kind, calendarId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    const stat = await this.readFileStat(filePath);
    map.set(calendarId, data);
    metaMap.set(calendarId, stat?.mtimeMs || null);
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
    const metaMap = this.memoryMeta.image;
    const metaPath = this.buildImageMetaPath(cacheKey);

    if (map.has(cacheKey)) {
      const stat = await this.readFileStat(metaPath);
      if (!stat) {
        map.delete(cacheKey);
        metaMap.delete(cacheKey);
        return null;
      }

      const cachedMtimeMs = metaMap.get(cacheKey);
      if (cachedMtimeMs === stat.mtimeMs) {
        return map.get(cacheKey);
      }
    }

    try {
      const [metaRaw, body] = await Promise.all([
        fs.readFile(metaPath, 'utf8'),
        fs.readFile(this.buildImageBodyPath(cacheKey)),
      ]);
      const payload = {
        ...JSON.parse(metaRaw),
        body,
      };
      const stat = await this.readFileStat(metaPath);
      map.set(cacheKey, payload);
      metaMap.set(cacheKey, stat?.mtimeMs || null);
      return payload;
    } catch (error) {
      if (error.code === 'ENOENT') {
        map.delete(cacheKey);
        metaMap.delete(cacheKey);
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

    const stat = await this.readFileStat(this.buildImageMetaPath(cacheKey));
    this.memory.image.set(cacheKey, payload);
    this.memoryMeta.image.set(cacheKey, stat?.mtimeMs || null);

    return payload;
  }
}

module.exports = {
  FileCache,
};
