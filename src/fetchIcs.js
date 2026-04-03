function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
    },
  };
}

async function fetchIcs(calendar, options = {}) {
  const headers = {};
  if (options.etag) {
    headers['If-None-Match'] = options.etag;
  }

  if (options.lastModified) {
    headers['If-Modified-Since'] = options.lastModified;
  }

  const {signal, cleanup} = createTimeoutSignal(options.timeoutMs || 8000);
  const startedAt = Date.now();

  try {
    const response = await fetch(calendar.icsUrl, {
      headers,
      signal,
      redirect: 'follow',
    });

    const durationMs = Date.now() - startedAt;

    if (response.status === 304) {
      return {
        status: 304,
        durationMs,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    }

    if (!response.ok) {
      const error = new Error(`Upstream returned ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    const text = await response.text();
    return {
      status: response.status,
      text,
      durationMs,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      contentType: response.headers.get('content-type') || 'text/calendar; charset=utf-8',
    };
  } finally {
    cleanup();
  }
}

module.exports = {
  fetchIcs,
};

