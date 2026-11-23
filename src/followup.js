// The follow-up decision for every lead: draft, remind, hold, or skip
// (and why). Plain functions on a 2D array (the Leads tab or a CSV), so the
// same code runs in Apps Script and in the Node demo and tests.
//
// Order of the checks matters and is deliberate:
//   1. opted out (own row, or email/phone on the suppression list): beats all
//   2. looks like a support case (lost card, fraud...): route to support
//   3. any Last reply: a person answers (never an automatic follow-up)
//   4. unknown Status: hold; Closed / Replied / sequence finished: stop
//   5. missing or invalid time zone: hold, never guess the lead's hours
//   6. Booked: appointment reminder; otherwise the next follow-up if due
//   7. missing or unusable placeholder value: hold with the reason
//   8. outside the lead's local hours: "waiting", drafted by a later run

var MAX_TOUCHES = 3;

// Notes or a reply that look like an urgent support case. Shared ticket
// categories from the demo world; patterns adapted from bilingual-sla-tracker
// (src/config.js CATEGORY_KEYWORDS). Run on folded text, first match wins.
var SUPPORT_PATTERNS = [
  // "uso" alone is left out on purpose: folded, "usó" (used) and "uso" (use)
  // look the same, and "el uso de tarjetas" is a normal sales question.
  ["card_lost_stolen", [/\b(card|cards|tarjeta|tarjetas)\b/,
    /\b(lost|lose|stolen|stole|cloned|someone used|used my card|using my card|perdi|perdida|perdio|extravie|extraviada|robaron|robada|robo|usaron|usando|alguien (la |lo )?uso|clonaron|clonada|clonado)\b/]],
  ["account_access", [/\b(can'?t|cannot|unable to) (log ?in|sign ?in|access|get into)\b|\blocked\b|\bhacked\b|\bforgot my password\b|\bno puedo (entrar|ingresar|iniciar sesion|acceder)\b|\b(hackearon|hackeada|hackeado|bloquearon|bloqueada|bloqueado|bloqueo)\b|\bolvide mi contrasena\b/]],
  ["charge_dispute", [/\b(fraud|fraudulent|unauthori[sz]ed|fraude|no reconozco|don'?t recognize|didn'?t make|no hice|dispute|chargeback|disputa|contracargo|someone is using|alguien (la|lo) esta usando)\b/]],
  ["transfer_failed_pending", [/\b(transfer|transfers|transferencia|transferencias)\b/,
    /\b(failed|pending|didn'?t arrive|never arrived|stuck|fallo|fallida|pendiente|no (me )?llego|no ha llegado)\b/]],
];

// A pricing or approval question: the rep answers on a call, the draft
// only defers to it (no numbers, no promises).
var PRICING_PATTERN = /\b(price|prices|pricing|cost|costs|how much|fee|fees|rate|rates|quote|approval|approve|approved|credit|loan|precio|precios|cuanto cuesta|cuanto cobran|costo|costos|comision|comisiones|tarifa|tarifas|cotizacion|aprobacion|aprueban|aprobado|credito|prestamo)\b/;

function supportCategory(text) {
  var folded = foldText(text);
  for (var i = 0; i < SUPPORT_PATTERNS.length; i++) {
    var all = SUPPORT_PATTERNS[i][1].every(function (re) { return re.test(folded); });
    if (all) return SUPPORT_PATTERNS[i][0];
  }
  return "";
}

function asksAboutPricing(text) {
  return PRICING_PATTERN.test(foldText(text));
}

// --- Reading the sheet --------------------------------------------------------

function columnAliases(key) {
  var names = [key, key.replace(/_/g, " "), STRINGS.en["header." + key], STRINGS.es["header." + key]]
    .concat(EXTRA_COLUMN_ALIASES[key] || []);
  return names.map(foldText);
}

// headerRow -> { key: columnIndex }. Throws a clear error naming the missing
// required columns, in the sheet's language.
function mapColumns(headerRow, lang) {
  var folded = headerRow.map(foldText);
  var map = {};
  LEAD_COLUMNS.forEach(function (key) {
    var aliases = columnAliases(key);
    for (var i = 0; i < folded.length; i++) {
      if (aliases.indexOf(folded[i]) !== -1 && !(key in map)) { map[key] = i; return; }
    }
  });
  var missing = REQUIRED_LEAD_COLUMNS.filter(function (key) { return !(key in map); });
  if (missing.length) {
    var names = missing.map(function (key) { return t(lang, "header." + key); });
    throw new Error(t(lang, "error.missing_columns", { columns: names.join(", ") }));
  }
  return map;
}

// "es" when most headers are the Spanish ones. New headers and the menu
// follow the language the sheet already uses.
function sheetLanguage(headerRow) {
  var en = 0, es = 0;
  (headerRow || []).map(foldText).forEach(function (h) {
    LEAD_COLUMNS.forEach(function (key) {
      if (h === foldText(STRINGS.en["header." + key])) en++;
      if (h === foldText(STRINGS.es["header." + key])) es++;
    });
  });
  return es > en ? "es" : "en";
}

// Table -> leads: { row (sheet row number), <column>: text, status: id }.
function readLeads(table, lang) {
  var map = mapColumns(table[0] || [], lang);
  var leads = table.slice(1).map(function (cells, i) {
    var lead = { row: i + 2 };
    LEAD_COLUMNS.forEach(function (key) {
      var v = key in map ? cells[map[key]] : "";
      lead[key] = v == null ? "" : String(v).trim();
    });
    lead.blank = cells.every(function (v) { return String(v == null ? "" : v).trim() === ""; });
    // Keep what the person typed (shown in the queue). Blank means New; any
    // other text we don't recognise is "unknown" and holds the lead.
    lead.statusRaw = lead.status;
    lead.status = lead.status ? (idFromLabel("status", lead.status, LEAD_STATUSES, EXTRA_STATUS_NAMES) || "unknown") : "new";
    return lead;
  });
  return { map: map, leads: leads };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

// --- Deciding -----------------------------------------------------------------

// ctx: { now (ms), config, suppression }. Returns a decision:
// { row, lead, action, reason: { key, vars }, lang, flags, template, draft,
//   sendAfter, updates }. `updates` are the write-back values for this row.
function decideLead(lead, ctx) {
  var language = leadLanguage(lead.language, lead.notes, lead.last_reply);
  var d = {
    row: lead.row, lead: lead, action: "", reason: null, lang: language.lang,
    flags: language.note ? ["flag." + language.note] : [], template: "", draft: null,
    sendAfter: null, updates: {},
  };
  function done(action, key, vars) {
    d.action = action;
    d.reason = key ? { key: key, vars: vars || {} } : null;
    return d;
  }

  var own = ownOptOut(lead);
  if (own) return done("opted_out", own.key, own.vars);
  if (isSuppressed(lead, ctx.suppression)) return done("opted_out", "optout.suppressed");
  var category = supportCategory(lead.notes + " \n " + lead.last_reply);
  if (category) return done("support", "support.route", { category: category });
  // Any reply that is not an opt-out goes to a person, whatever the Status:
  // the opt-out list will miss some wordings, so no reply ever leads to an
  // automatic follow-up. The rep clears Last reply to resume the sequence.
  if (lead.last_reply) return done("needs_person", "needs_person.reply");
  if (lead.status === "unknown") return done("hold", "held.status", { status: lead.statusRaw });
  if (lead.status === "closed") return done("stopped", "stopped.closed");
  if (lead.status === "replied") return done("needs_person", "needs_person.replied");
  var touches = Math.max(0, parseInt(lead.touches, 10) || 0);
  if (lead.status !== "booked" && touches >= MAX_TOUCHES) {
    return done("stopped", "stopped.finished", { count: touches });
  }

  var tzProblem = timeZoneProblem(lead.time_zone);
  if (tzProblem) return done("hold", "held." + tzProblem + "_tz", { tz: lead.time_zone });
  var tz = lead.time_zone;
  var now = localNow(ctx.now, tz);
  var days = ctx.config.window.days;
  var values = {
    first_name: lead.first_name, company: lead.company, rep_name: lead.rep_name,
    booking_link: ctx.config.booking_link,
  };

  if (lead.status === "booked") {
    var appt = parseDateTime(lead.appointment);
    if (!appt) return done("hold", "held.missing_appointment");
    if (lead.reminder_drafted) return done("not_due", "not_due.reminder_done");
    if (appt.date < now.date || (appt.date === now.date && appt.minutes <= now.minutes)) {
      return done("stopped", "stopped.past");
    }
    var remindOn = businessDayBefore(appt.date, days);
    if (now.date < remindOn) {
      d.updates.next_due = remindOn;
      return done("not_due", "not_due.reminder", { date: remindOn });
    }
    values.appointment_time = formatAppointment(appt, tz, d.lang);
    d.template = "reminder";
    if (!finishDraft(d, values, ctx, tz)) return d;
    d.updates = { reminder_drafted: now.date, next_due: "" };
    return waitIfOutsideWindow(done("reminder"));
  }

  // Follow-up sequence: touch 1 counts from the request date, later touches
  // from the last draft. Touches already drafted today are never repeated.
  var requested = parseDate(lead.requested_on);
  var last = parseDate(lead.last_drafted);
  var base = touches === 0 ? requested : (last || requested);
  if (!base) return done("hold", "held.missing_value", { field: touches === 0 ? "requested_on" : "last_drafted" });
  var gaps = [ctx.config.touch1_days, ctx.config.touch2_days, ctx.config.touch3_days];
  var due = addBusinessDays(base, gaps[touches], days);
  if (last === now.date) return done("not_due", "not_due.today");
  if (now.date < due) {
    d.updates.next_due = due;
    return done("not_due", "not_due.touch", { date: due });
  }
  d.template = asksAboutPricing(lead.notes + " \n " + lead.last_reply) ? "needs_rep" : "touch" + (touches + 1);
  if (d.template === "needs_rep") d.flags.unshift("flag.needs_rep");
  if (!finishDraft(d, values, ctx, tz)) return d;
  d.updates = {
    touches: String(touches + 1),
    last_drafted: now.date,
    next_due: touches + 1 < MAX_TOUCHES ? addBusinessDays(now.date, gaps[touches + 1], days) : "",
  };
  return waitIfOutsideWindow(done("draft"));
}

// Check the email, fill the template and work out "send after".
// Returns false (and marks the decision "hold") when something is missing.
function finishDraft(d, values, ctx, tz) {
  var problems = [];
  if (!validEmail(d.lead.email)) {
    problems.push({ key: d.lead.email ? "held.invalid_value" : "held.missing_value", vars: { field: "email" } });
  }
  var filled = fillTemplate(d.lang, d.template, values);
  problems = problems.concat(filled.problems);
  if (problems.length) {
    d.action = "hold";
    d.reason = problems[0];
    d.moreReasons = problems.slice(1);
    return false;
  }
  d.draft = { to: d.lead.email, subject: filled.subject, body: filled.body };
  var win = sendWindow(ctx.now, tz, ctx.config.window);
  d.sendAfter = { inWindow: win.inWindow, date: win.date, minutes: win.minutes, tz: tz };
  return true;
}

// Outside the lead's local window: no draft yet and nothing stamped, so a
// later (hourly) run drafts it once the window opens. The text is kept so
// the demo and the preview can show what will be drafted.
function waitIfOutsideWindow(d) {
  if (d.sendAfter.inWindow) return d;
  d.action = "waiting";
  d.updates = {};
  return d;
}

// The whole run. options: { now (ms), config, suppressionRows, runDate }.
// Throws if the templates fail the lint: nothing is drafted from a bad template.
function planRun(table, options) {
  var lang = sheetLanguage(table[0]);
  var problems = lintTemplates(TEMPLATES);
  if (problems.length) throw new Error(t(lang, "error.lint", { problems: problems.join("; ") }));
  var read = readLeads(table, lang);
  var config = options.config || readConfig([]);
  var leads = read.leads.filter(function (lead) { return !lead.blank; });
  var suppression = buildSuppression(leads, options.suppressionRows || [], options.runDate);
  var ctx = { now: options.now, config: config, suppression: suppression };
  var decisions = leads.map(function (lead) { return decideLead(lead, ctx); });
  return { lang: lang, map: read.map, decisions: decisions, suppression: suppression };
}
