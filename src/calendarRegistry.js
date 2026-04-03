class CalendarRegistry {
  constructor(config) {
    this.defaultCalendarId = config.defaultCalendarId;
    this.calendars = config.calendars;
  }

  getCalendar(calendarId) {
    const id = calendarId || this.defaultCalendarId;
    const calendar = this.calendars[id];

    if (!calendar || !calendar.icsUrl) {
      return null;
    }

    return {
      id,
      icsUrl: calendar.icsUrl,
      timezone: calendar.timezone || 'UTC',
      token: calendar.token || null,
      calendarUrl: calendar.calendarUrl || null,
    };
  }
}

module.exports = {
  CalendarRegistry,
};

