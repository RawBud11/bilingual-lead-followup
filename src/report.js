// Turn decisions into what people read: reasons, the queue table, the draft
// preview, the summary counts, and the values written back to the Leads tab.
// `ui` is the language of the labels (the sales team's language), which is
// separate from each draft's language (the lead's).

// A reason as text: "missing first name" / "falta nombre".
function reasonText(reason, ui) {
  if (!reason) return "";
  var vars = Object.assign({}, reason.vars);
  if (vars.field) vars.field = t(ui, "field." + vars.field);
  if (vars.category) vars.category = t(ui, "category." + vars.category);
  return t(ui, reason.key, vars);
}

function allReasons(d, ui) {
  return [d.reason].concat(d.moreReasons || []).filter(Boolean)
    .map(function (r) { return reasonText(r, ui); }).join("; ");
}

// "now: Tue Nov 24, 10:00 (New York time)" or, for a lead outside its local
// hours, "next window: ..." (style "send.waits" for the demo page).
function sendAfterText(d, ui, waitStyle) {
  if (!d.sendAfter) return "";
  var s = d.sendAfter;
  var key = s.inWindow ? "send.now" : (waitStyle || "send.next");
  return t(ui, key, { time: shortLocalTime(s.date, s.minutes, s.tz, ui) });
}

// Notes and last reply as shown to the team: masked, never in a message.
function maskedNotes(lead) {
  var text = lead.notes;
  if (lead.last_reply) text += (text ? " | " : "") + "“" + lead.last_reply + "”";
  return maskSensitive(text).text;
}

function flagsText(d, ui) {
  return d.flags.map(function (key) { return t(ui, key); }).join(" ");
}

function countDecisions(decisions) {
  var c = { drafts: 0, waiting: 0, held: 0, heldDetail: [], opted_out: 0, support: 0,
    reminders: 0, needs_person: 0, not_due: 0, stopped: 0 };
  var detail = {};
  decisions.forEach(function (d) {
    if (d.action === "draft") c.drafts++;
    if (d.action === "waiting") c.waiting++;
    if (d.action === "reminder") c.reminders++;
    if (d.action === "opted_out") c.opted_out++;
    if (d.action === "support") c.support++;
    if (d.action === "needs_person") c.needs_person++;
    if (d.action === "not_due") c.not_due++;
    if (d.action === "stopped") c.stopped++;
    if (d.action === "hold") {
      c.held++;
      // Group by reason kind (and field), not by the exact bad value.
      var id = d.reason.key + "|" + (d.reason.vars.field || "");
      if (!(id in detail)) { detail[id] = c.heldDetail.length; c.heldDetail.push({ reason: d.reason, count: 0 }); }
      c.heldDetail[detail[id]].count++;
    }
  });
  return c;
}

// The two summary lines for the terminal and the Summary tab.
function summaryLines(counts, ui) {
  var held = counts.heldDetail.map(function (h) {
    // Kinds whose text includes the bad value have a "_short" label.
    var short = h.reason.key + "_short";
    var r = short in STRINGS[ui] ? { key: short, vars: {} } : h.reason;
    return reasonText(r, ui) + " " + h.count;
  });
  return [
    t(ui, "summary.line", {
      drafts: counts.drafts, waiting: counts.waiting,
      held: counts.held, held_detail: held.length ? " (" + held.join(", ") + ")" : "",
      opted_out: counts.opted_out, support: counts.support, reminders: counts.reminders,
    }),
    t(ui, "summary.line2", { needs_person: counts.needs_person, not_due: counts.not_due, stopped: counts.stopped }),
  ];
}

// One row per lead: what happened and why. Same table for output/queue.csv
// and the Queue tab.
function queueTable(decisions, ui) {
  var header = [t(ui, "queue.row"), t(ui, "header.first_name"), t(ui, "header.email"),
    t(ui, "header.status"), t(ui, "queue.action"), t(ui, "queue.reason"), t(ui, "queue.template"),
    t(ui, "queue.draft_language"), t(ui, "queue.send_after"), t(ui, "queue.subject"),
    t(ui, "queue.flags"), t(ui, "queue.notes")];
  return [header].concat(decisions.map(function (d) {
    // Status exactly as typed in the sheet, so an unrecognised one is visible.
    return [d.row, d.lead.first_name, d.lead.email, d.lead.statusRaw,
      t(ui, "action." + d.action), allReasons(d, ui), d.template ? t(ui, "template." + d.template) : "",
      d.draft ? d.lang.toUpperCase() : "", sendAfterText(d, ui), d.draft ? d.draft.subject : "",
      flagsText(d, ui), maskedNotes(d.lead)];
  }));
}

// Drafts only, with the full body: the Draft preview tab (DRY_RUN).
function previewTable(decisions, ui) {
  var rows = [[t(ui, "queue.row"), t(ui, "html.to"), t(ui, "queue.subject"), "Body / Cuerpo",
    t(ui, "queue.send_after"), t(ui, "queue.flags")]];
  decisions.forEach(function (d) {
    if (d.draft) rows.push([d.row, d.draft.to, d.draft.subject, d.draft.body, sendAfterText(d, ui), flagsText(d, ui)]);
  });
  return rows;
}

// Summary tab: title, the two lines, then one count per action.
function summaryTable(counts, ui, date) {
  var rows = [[t(ui, "summary.title", { date: date })]];
  summaryLines(counts, ui).forEach(function (line) { rows.push([line]); });
  rows.push([t(ui, "queue.action"), t(ui, "summary.count")]);
  [["draft", counts.drafts], ["reminder", counts.reminders], ["waiting", counts.waiting], ["hold", counts.held],
    ["opted_out", counts.opted_out], ["support", counts.support], ["needs_person", counts.needs_person],
    ["not_due", counts.not_due], ["stopped", counts.stopped]].forEach(function (pair) {
    rows.push([t(ui, "action." + pair[0]), pair[1]]);
  });
  return rows;
}

// New Suppression tab rows: email, phone, reason (in `ui`), date added.
function suppressionRows(added, ui) {
  return added.map(function (s) { return [s.email, s.phone, reasonText(s.reason, ui), s.date]; });
}

// Write-back: { header, map, columns: { key: [value per data row] } }.
// Missing write-back columns are added at the end with headers in `lang`.
// Only rows with a decision change; every other cell keeps its value.
function columnUpdates(table, decisions, lang) {
  var header = table[0].slice();
  var map = mapColumns(header, lang);
  WRITE_BACK_COLUMNS.forEach(function (key) {
    if (!(key in map)) { map[key] = header.length; header.push(t(lang, "header." + key)); }
  });
  var byRow = {};
  decisions.forEach(function (d) { byRow[d.row] = d.updates; });
  var columns = {};
  WRITE_BACK_COLUMNS.forEach(function (key) {
    columns[key] = table.slice(1).map(function (cells, i) {
      var updates = byRow[i + 2];
      if (updates && key in updates) return updates[key];
      var v = cells[map[key]];
      return v == null ? "" : v;
    });
  });
  return { header: header, map: map, columns: columns };
}

// The table after write-back (used by the demo and the tests).
function applyUpdates(table, decisions, lang) {
  var u = columnUpdates(table, decisions, lang);
  var out = [u.header].concat(table.slice(1).map(function (cells) {
    var row = cells.slice();
    while (row.length < u.header.length) row.push("");
    return row;
  }));
  Object.keys(u.columns).forEach(function (key) {
    u.columns[key].forEach(function (v, i) { out[i + 1][u.map[key]] = v; });
  });
  return out;
}
