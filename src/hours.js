// Time zones, business days and the lead's local "send after" window.
//
// No date library: Intl.DateTimeFormat with a timeZone works in Node and in
// Apps Script (V8). Dates are handled as "YYYY-MM-DD" text and times as
// minutes after midnight, so the math is easy to read and to test.
// The run time ("now") is a real instant (milliseconds); everything else is
// the lead's own wall-clock time.

// Display names for the time zones the demo uses. Others show the IANA city.
var CITY_NAMES = {
  "America/New_York": ["New York", "Nueva York"],
  "America/Chicago": ["Chicago", "Chicago"],
  "America/Los_Angeles": ["Los Angeles", "Los Ángeles"],
  "America/Bogota": ["Bogotá", "Bogotá"],
  "America/Mexico_City": ["Mexico City", "Ciudad de México"],
  "America/Lima": ["Lima", "Lima"],
};

var DATE_NAMES = {
  en: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"],
  },
  es: {
    days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
      "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  },
};

// "" when the time zone is usable, else "missing" or "invalid".
// Only "Area/City" names (America/Bogota) and UTC are accepted: short forms
// like "EST" or "Eastern" are ambiguous, and we never guess a lead's hours.
function timeZoneProblem(tz) {
  var name = String(tz == null ? "" : tz).trim();
  if (!name) return "missing";
  if (name !== "UTC" && !/^[A-Za-z_]+\/[A-Za-z_\/-]+$/.test(name)) return "invalid";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return "";
  } catch (e) {
    return "invalid";
  }
}

// The lead's wall clock at instant `ms`: { date: "YYYY-MM-DD", minutes, weekday }.
function localNow(ms, tz) {
  var parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
  // Some engines write midnight as "24"; treat it as 0.
  var hour = Number(parts.hour) % 24;
  var date = parts.year + "-" + parts.month + "-" + parts.day;
  return { date: date, minutes: hour * 60 + Number(parts.minute), weekday: weekdayOf(date) };
}

// "YYYY-MM-DD" -> 0 (Sunday) .. 6 (Saturday).
function weekdayOf(date) {
  var p = date.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

function addDays(date, n) {
  var p = date.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

// n business days after `date` (days = weekday numbers that count, Mon-Fri
// by default). Holidays are not modelled (out of scope).
function addBusinessDays(date, n, days) {
  var d = date;
  var left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (days.indexOf(weekdayOf(d)) !== -1) left--;
  }
  return d;
}

// The last business day before `date` (Friday for a Monday appointment).
function businessDayBefore(date, days) {
  var d = addDays(date, -1);
  while (days.indexOf(weekdayOf(d)) === -1) d = addDays(d, -1);
  return d;
}

// "2026-11-24" or a "2026-11-24 10:00" cell -> "2026-11-24", or null.
function parseDate(text) {
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{1,2}:\d{2})?$/.exec(String(text == null ? "" : text).trim());
  if (!m) return null;
  var date = m[1] + "-" + m[2] + "-" + m[3];
  return addDays(date, 0) === date ? date : null; // rejects 2026-02-31
}

// "2026-11-25 10:00" -> { date, minutes }, or null.
function parseDateTime(text) {
  var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})$/.exec(String(text == null ? "" : text).trim());
  if (!m || !parseDate(m[1])) return null;
  var minutes = clockMinutes(m[2]);
  return minutes === null || minutes >= 1440 ? null : { date: m[1], minutes: minutes };
}

// When a draft for this lead may be sent, in the lead's time:
// { inWindow: true, date, minutes } now, or the start of the next window.
function sendWindow(ms, tz, window) {
  var now = localNow(ms, tz);
  var workday = window.days.indexOf(now.weekday) !== -1;
  if (workday && now.minutes >= window.start && now.minutes < window.end) {
    return { inWindow: true, date: now.date, minutes: now.minutes };
  }
  var date = now.date;
  if (!(workday && now.minutes < window.start)) {
    do { date = addDays(date, 1); } while (window.days.indexOf(weekdayOf(date)) === -1);
  }
  return { inWindow: false, date: date, minutes: window.start };
}

function cityName(tz, lang) {
  var names = CITY_NAMES[tz];
  if (names) return names[lang === "es" ? 1 : 0];
  return String(tz).split("/").pop().replace(/_/g, " ");
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

// Short label for the rep: "Tue Nov 24, 09:00 (Los Angeles time)" /
// "mar 24 nov, 09:00 (hora de Los Ángeles)". 24-hour clock, no ambiguity.
function shortLocalTime(date, minutes, tz, lang) {
  var names = DATE_NAMES[lang === "es" ? "es" : "en"];
  var p = date.split("-").map(Number);
  var day = names.days[weekdayOf(date)].slice(0, 3);
  var month = names.months[p[1] - 1].slice(0, 3);
  var clock = pad2(Math.floor(minutes / 60)) + ":" + pad2(minutes % 60);
  var when = lang === "es" ? day + " " + p[2] + " " + month + ", " + clock : day + " " + month + " " + p[2] + ", " + clock;
  return when + " (" + t(lang, "time.zone_label", { city: cityName(tz, lang) }) + ")";
}

// Appointment time for the reminder, in the lead's language:
// "Wednesday, November 25 at 10:00 AM (New York time)" /
// "miércoles 25 de noviembre, 10:00 a. m. (hora de Bogotá)".
// Built by hand (not toLocaleString) so Node and Apps Script print the same.
function formatAppointment(appt, tz, lang) {
  var names = DATE_NAMES[lang === "es" ? "es" : "en"];
  var p = appt.date.split("-").map(Number);
  var hour = Math.floor(appt.minutes / 60);
  var h12 = hour % 12 === 0 ? 12 : hour % 12;
  var clock = h12 + ":" + pad2(appt.minutes % 60);
  var city = cityName(tz, lang);
  var day = names.days[weekdayOf(appt.date)];
  var month = names.months[p[1] - 1];
  if (lang === "es") {
    return day + " " + p[2] + " de " + month + ", " + clock + (hour < 12 ? " a. m." : " p. m.") +
      " (hora de " + city + ")";
  }
  return day + ", " + month + " " + p[2] + " at " + clock + (hour < 12 ? " AM" : " PM") + " (" + city + " time)";
}
