// Settings and sheet layout. Everything a client might want to change is here
// or on the Config tab (key / value rows, read by readConfig below).

// Defaults. The Config tab can override each one.
var DEFAULT_CONFIG = {
  // Business days after the demo request / after the previous draft.
  touch1_days: 1,
  touch2_days: 3,
  touch3_days: 7,
  // Local window for "Send after", in the LEAD's time zone. A sensible
  // default, not legal advice: each client checks the rules that apply to them.
  window_start: "09:00",
  window_end: "18:00",
  window_days: "Mon,Tue,Wed,Thu,Fri",
  booking_link: "https://example.com/book/puentara-demo",
};

// Statuses that end the sequence for good. "replied" means a person answers.
var LEAD_STATUSES = ["new", "contacted", "replied", "booked", "closed", "do_not_contact"];
// Other names people type for the same status. A status that matches none
// of these (and is not blank) holds the lead: we never guess.
var EXTRA_STATUS_NAMES = {
  do_not_contact: ["dnc", "opted out", "opt-out", "opt out", "unsubscribed", "unsubscribe",
    "do not call", "not interested", "dado de baja", "baja", "no contactar", "no llamar",
    "no interesado", "no interesada"],
  replied: ["respondio", "respondida"],
  booked: ["scheduled", "agendada", "reunion agendada"],
  closed: ["lost", "bounced", "perdido", "rebotado"],
};

// --- Columns ----------------------------------------------------------------
// Leads tab. Each column is found by its English or Spanish header (from
// strings.js) or by one of these extra names. Add your own here if needed.
var LEAD_COLUMNS = [
  "first_name", "company", "email", "phone", "language", "time_zone", "interest",
  "rep_name", "requested_on", "status", "opt_out", "touches", "last_drafted",
  "next_due", "appointment", "reminder_drafted", "notes", "last_reply",
];
var REQUIRED_LEAD_COLUMNS = ["first_name", "email", "status"];
var EXTRA_COLUMN_ALIASES = {
  first_name: ["name", "first", "nombre de pila"],
  company: ["business", "negocio"],
  email: ["e-mail", "email address", "correo electronico"],
  phone: ["phone number", "telefono", "celular"],
  time_zone: ["timezone", "tz", "zona horaria"],
  rep_name: ["rep", "owner", "sales rep", "vendedor", "asesor"],
  requested_on: ["created", "date", "fecha", "fecha de solicitud"],
  opt_out: ["unsubscribed", "baja"],
  appointment: ["appointment time", "meeting", "cita", "reunion"],
  last_reply: ["reply", "respuesta"],
};

// The columns the tool writes back. Everything else is the team's.
var WRITE_BACK_COLUMNS = ["touches", "last_drafted", "next_due", "reminder_drafted"];

// Suppression tab: anyone who opted out, by email and phone.
var SUPPRESSION_COLUMNS = ["email", "phone", "reason", "added_on"];

// Values in the Opt-out column that mean "yes".
var OPT_OUT_YES = ["yes", "y", "true", "x", "1", "si", "opted out", "opt out"];

var WEEKDAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Config tab (2 columns: key, value) -> settings, with defaults for anything
// missing. Bad values throw a clear error naming the key.
function readConfig(table) {
  var config = Object.assign({}, DEFAULT_CONFIG);
  (table || []).forEach(function (row) {
    var key = foldText(row[0]).replace(/ /g, "_");
    if (key in DEFAULT_CONFIG && String(row[1] == null ? "" : row[1]).trim() !== "") {
      config[key] = typeof DEFAULT_CONFIG[key] === "number" ? Number(row[1]) : String(row[1]).trim();
    }
  });
  ["touch1_days", "touch2_days", "touch3_days"].forEach(function (key) {
    if (!(config[key] >= 0 && config[key] === Math.floor(config[key]))) {
      throw new Error("Config: " + key + " must be a whole number of business days, like 3.");
    }
  });
  var start = clockMinutes(config.window_start);
  var end = clockMinutes(config.window_end);
  if (start === null || end === null || start >= end) {
    throw new Error("Config: window_start and window_end must look like 09:00 and 18:00, start before end.");
  }
  var days = String(config.window_days).split(/[\s,]+/).map(function (d) {
    return WEEKDAY_IDS.indexOf(foldText(d).slice(0, 3));
  });
  if (!days.length || days.indexOf(-1) !== -1) {
    throw new Error("Config: window_days must list days like Mon,Tue,Wed,Thu,Fri.");
  }
  if (!/^https:\/\/\S+$/.test(config.booking_link)) {
    throw new Error("Config: booking_link must be a full https:// link.");
  }
  config.window = { start: start, end: end, days: days };
  return config;
}

// "09:00" -> 540 minutes after midnight, or null.
function clockMinutes(text) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim());
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
