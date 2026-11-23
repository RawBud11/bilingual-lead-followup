// ---------------------------------------------------------------------------
// Apps Script layer: the only part that touches Google Sheets, Gmail and
// triggers. All the rules (sequence, opt-outs, local hours, templates) are
// the plain functions from src/ above, tested locally with `npm test`.
//
// Setup (copy and paste, about 5 minutes):
//   1. In the repo: npm run bundle  (writes dist/Code.gs)
//   2. Open a Google Sheet you own > Extensions > Apps Script.
//   3. Replace the editor's Code.gs with the whole of dist/Code.gs. Save.
//   4. Reload the sheet. Use the new menu: "Set up tabs", then optionally
//      "Load sample data" (synthetic leads; Puentara is fictional).
//   5. "Prepare today's drafts". Google asks for permission the first time.
//   6. Check the Queue, Draft preview and Summary tabs. Once, from the
//      editor, run checkTimeZoneSupport and check the log says OK.
//   7. Only when the preview looks right: set DRY_RUN = false below. Then each
//      run creates Gmail DRAFTS. This script never sends anything; a person
//      reviews and sends each draft from Gmail.
//
// tests/apps-script.test.js runs this file against a fake of Google's
// services. It has not yet been tested in a live sheet.
// ---------------------------------------------------------------------------

// DRY_RUN = true: drafts are written to the "Draft preview" tab only, and the
// Leads tab is not changed. false: Gmail drafts are created (only for leads
// inside their local hours right now) and Touches /
// Last drafted / Next due are written back. Never sends either way.
var DRY_RUN = true;

// Language for new tabs, headers and the menu: "en" or "es". Once the Leads
// tab exists, its header row decides the language instead.
var SETUP_LANGUAGE = "en";

// --- Menu ------------------------------------------------------------------

function onOpen() {
  var lang = currentLanguage_();
  SpreadsheetApp.getUi().createMenu(t(lang, "menu.title"))
    .addItem(t(lang, "menu.run"), "runFollowups")
    .addSeparator()
    .addItem(t(lang, "menu.setup"), "setupTabs")
    .addItem(t(lang, "menu.sample"), "loadSampleData")
    .addItem(t(lang, "menu.trigger"), "installHourlyTrigger")
    .addToUi();
}

// --- Setup -----------------------------------------------------------------

// Creates any missing tab with its header row. Safe to run again: existing
// tabs and rows are kept.
function setupTabs() {
  var lang = currentLanguage_();
  var leads = tabOrNew_("leads", lang);
  if (leads.getLastColumn() === 0) {
    writeRows_(leads, [LEAD_COLUMNS.map(function (key) { return t(lang, "header." + key); })]);
  }
  var config = tabOrNew_("config", lang);
  if (config.getLastColumn() === 0) {
    var rows = [["key", "value"]];
    Object.keys(DEFAULT_CONFIG).forEach(function (key) { rows.push([key, String(DEFAULT_CONFIG[key])]); });
    writeRows_(config, rows);
  }
  var suppression = tabOrNew_("suppression", lang);
  if (suppression.getLastColumn() === 0) {
    writeRows_(suppression, [SUPPRESSION_COLUMNS.map(function (key) { return t(lang, "header." + key); })]);
  }
  ["queue", "preview", "summary"].forEach(function (key) { tabOrNew_(key, lang); });
  notify_(t(lang, "done.setup", { tab: leads.getName() }));
}

// Fills an EMPTY Leads tab with the synthetic sample leads from data/leads.csv
// (bundled as SAMPLE_LEADS). Their dates are set around 2026-11-24, so on
// other days more of them will be due. Refuses to touch a tab with leads.
function loadSampleData() {
  setupTabs();
  var lang = currentLanguage_();
  var leads = findTab_("leads");
  if (leads.getDataRange().getValues().length > 1) throw new Error(t(lang, "error.sample_not_empty"));
  leads.clearContents();
  // Plain text format first: otherwise Sheets reads "+1-555-0142" as a formula.
  leads.getRange(1, 1, SAMPLE_LEADS.length, SAMPLE_LEADS[0].length).setNumberFormat("@");
  writeRows_(leads, SAMPLE_LEADS);
  notify_(t(lang, "done.sample"));
}

// --- The run ---------------------------------------------------------------

// A script lock stops a menu click and the hourly trigger from running at the
// same moment (which could create the same draft twice).
function runFollowups() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) throw new Error(t(currentLanguage_(), "error.busy"));
  try {
    return runFollowupsLocked_();
  } finally {
    lock.releaseLock();
  }
}

function runFollowupsLocked_() {
  var leadsTab = findTab_("leads");
  if (!leadsTab) throw new Error(t(SETUP_LANGUAGE, "error.no_leads_tab"));
  var table = readTable_(leadsTab);
  var lang = sheetLanguage(table[0] || []);
  var configTab = findTab_("config");
  var config = readConfig(configTab ? readTable_(configTab) : []);
  var suppressionTab = tabOrNew_("suppression", lang);
  if (suppressionTab.getLastColumn() === 0) {
    writeRows_(suppressionTab, [SUPPRESSION_COLUMNS.map(function (key) { return t(lang, "header." + key); })]);
  }
  var runDate = Utilities.formatDate(new Date(), teamTimeZone_(), "yyyy-MM-dd");
  var plan = planRun(table, {
    now: Date.now(), config: config, runDate: runDate,
    suppressionRows: readTable_(suppressionTab).slice(1),
  });

  // Opt-outs are recorded even in DRY_RUN: they are a safety list, not a send.
  var added = suppressionRows(plan.suppression.added, lang);
  if (added.length) {
    suppressionTab.getRange(suppressionTab.getLastRow() + 1, 1, added.length, added[0].length).setValues(added);
  }

  // Only leads whose local window is open NOW get a Gmail draft. Leads
  // outside it are "waiting": listed in the Queue, not stamped, and drafted
  // by a later hourly run once their window opens.
  var drafts = plan.decisions.filter(function (d) { return d.action === "draft" || d.action === "reminder"; });
  var waiting = plan.decisions.filter(function (d) { return d.action === "waiting"; }).length;
  if (DRY_RUN) {
    writeRows_(tabOrNew_("preview", lang), previewTable(plan.decisions, lang), true);
    writeReports_(plan, lang, runDate);
    notify_(t(lang, "done.preview", { count: drafts.length, waiting: waiting, tab: tabOrNew_("preview", lang).getName() }));
    return plan;
  }

  // Drafts only. If Gmail fails part way (quota), rows whose draft was not
  // created keep their old values, so the next run picks them up again.
  var errors = [];
  drafts.forEach(function (d) {
    try {
      GmailApp.createDraft(d.draft.to, d.draft.subject, d.draft.body);
    } catch (e) {
      d.updates = {};
      d.action = "hold";
      d.reason = { key: "held.gmail_error", vars: { error: e && e.message ? e.message : String(e) } };
      d.draft = null;
      errors.push(d.lead.email);
    }
  });
  writeBack_(leadsTab, table, plan.decisions, lang);
  writeReports_(plan, lang, runDate);
  var created = drafts.length - errors.length;
  if (errors.length) throw new Error(t(lang, "error.gmail", { created: created, failed: errors.length }));
  notify_(t(lang, "done.drafted", { count: created, waiting: waiting }));
  return plan;
}

// Every hour. Each run only drafts what is due AND inside each lead's local
// window, so a Los Angeles lead is drafted on a run after 09:00 Los Angeles
// time. Runs already drafted today are skipped (Last drafted), so hourly
// runs never create the same draft twice.
function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "runFollowups") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("runFollowups").timeBased().everyHours(1).create();
  notify_(t(currentLanguage_(), "done.trigger"));
}

// One-time check for the owner: run it from the Apps Script editor (select
// checkTimeZoneSupport, click Run, open the Execution log). It compares our
// Intl-based local time (src/hours.js) with Google's own Utilities.formatDate
// for each demo time zone. Every line should say OK.
function checkTimeZoneSupport() {
  var now = Date.now();
  var lines = Object.keys(CITY_NAMES).map(function (tz) {
    var ours = localNow(now, tz);
    var oursText = ours.date + " " + pad2(Math.floor(ours.minutes / 60)) + ":" + pad2(ours.minutes % 60);
    var google = Utilities.formatDate(new Date(now), tz, "yyyy-MM-dd HH:mm");
    return (oursText === google ? "OK   " : "DIFF ") + tz + "  ours " + oursText + "  Google " + google;
  });
  lines.forEach(function (line) { Logger.log(line); });
  return lines;
}

// --- Sheet helpers ---------------------------------------------------------

function teamTimeZone_() {
  return SpreadsheetApp.getActive().getSpreadsheetTimeZone();
}

// A tab by its English or Spanish name, or null.
function findTab_(key) {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(t("en", "tab." + key)) || ss.getSheetByName(t("es", "tab." + key));
}

function tabOrNew_(key, lang) {
  return findTab_(key) || SpreadsheetApp.getActive().insertSheet(t(lang, "tab." + key));
}

function currentLanguage_() {
  var leads = findTab_("leads");
  if (!leads || leads.getLastColumn() === 0) return SETUP_LANGUAGE;
  return sheetLanguage(leads.getRange(1, 1, 1, leads.getLastColumn()).getValues()[0]);
}

// All values of a tab as text. Date cells become "YYYY-MM-DD HH:mm" in the
// spreadsheet time zone: the same digits the person typed.
function readTable_(sheet) {
  if (sheet.getLastColumn() === 0) return [[]];
  var tz = teamTimeZone_();
  return sheet.getDataRange().getValues().map(function (row) {
    return row.map(function (value) {
      return value instanceof Date ? Utilities.formatDate(value, tz, "yyyy-MM-dd HH:mm") : value;
    });
  });
}

// Write a table at A1 (rows padded to the same width). clearFirst empties
// the tab before writing (Queue, Draft preview, Summary are rebuilt each run).
function writeRows_(sheet, rows, clearFirst) {
  if (clearFirst) sheet.clearContents();
  var width = rows.reduce(function (w, row) { return Math.max(w, row.length); }, 0);
  var padded = rows.map(function (row) {
    var copy = row.slice();
    while (copy.length < width) copy.push("");
    return copy;
  });
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
}

function writeReports_(plan, lang, runDate) {
  writeRows_(tabOrNew_("queue", lang), queueTable(plan.decisions, lang), true);
  writeRows_(tabOrNew_("summary", lang), summaryTable(countDecisions(plan.decisions), lang, runDate), true);
}

// Write back only the tool's own columns, one column at a time, so the
// columns people type in (names, notes, status) are never overwritten.
function writeBack_(sheet, table, decisions, lang) {
  if (table.length < 2) return;
  var u = columnUpdates(table, decisions, lang);
  if (u.header.length > table[0].length) sheet.getRange(1, 1, 1, u.header.length).setValues([u.header]);
  WRITE_BACK_COLUMNS.forEach(function (key) {
    var values = u.columns[key].map(function (v) { return [v]; });
    sheet.getRange(2, u.map[key] + 1, values.length, 1).setValues(values);
  });
}

// Message for the person at the sheet. Triggers have no UI, so it also goes
// to the execution log.
function notify_(message) {
  Logger.log(message);
  try {
    SpreadsheetApp.getActive().toast(message, t(currentLanguage_(), "menu.title"), 8);
  } catch (e) {
    // No spreadsheet UI (time-based trigger): the log line above is enough.
  }
}
