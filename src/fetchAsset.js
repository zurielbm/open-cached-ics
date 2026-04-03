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

async function fetchAsset(url, options = {}) {
  const {signal, cleanup} = createTimeoutSignal(options.timeoutMs || 8000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      signal,
      redirect: 'follow',
    });

    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      const error = new Error(`Upstream returned ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return {
      status: response.status,
      body: Buffer.from(await response.arrayBuffer()),
      durationMs,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    };
  } finally {
    cleanup();
  }
}

module.exports = {
  fetchAsset,
};
