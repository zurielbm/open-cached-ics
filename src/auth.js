function getProvidedToken(request) {
  return request.query?.token || request.headers['x-calendar-token'] || null;
}

function authorizeCalendarRequest(request, calendar, config) {
  const requiredToken = calendar.token || null;

  if (!requiredToken && !config.requireToken) {
    return {ok: true};
  }

  if (!requiredToken && config.requireToken) {
    return {ok: false, code: 'TOKEN_NOT_CONFIGURED'};
  }

  return getProvidedToken(request) === requiredToken
    ? {ok: true}
    : {ok: false, code: 'UNAUTHORIZED'};
}

module.exports = {
  authorizeCalendarRequest,
};

