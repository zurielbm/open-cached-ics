function buildEventsEnvelope(payload, limit) {
  return {
    events: payload.events.slice(0, limit),
    timezone: payload.timezone,
    fetchedAt: payload.fetchedAt,
  };
}

function buildErrorResponse(code, message, fetchedAt = null) {
  return {
    error: code,
    message,
    fetchedAt,
  };
}

module.exports = {
  buildEventsEnvelope,
  buildErrorResponse,
};

