// Small builders for test sheets, so each test only lists what it cares about.
import { loadSrc } from "./load.js";

export const src = loadSrc();
export const NOW = "2026-11-24 15:00"; // Tuesday, UTC: 10:00 New York, 07:00 Los Angeles

export function ms(text) {
  return Date.parse(text.replace(" ", "T") + ":00Z");
}

export const DEFAULT_LEAD = {
  first_name: "Alex", company: "Demo Co", email: "alex.demo@example.com", phone: "+1-555-0100",
  language: "EN", time_zone: "America/New_York", interest: "invoicing", rep_name: "Sam Demo",
  requested_on: "2026-11-23", status: "New", opt_out: "", touches: "0", last_drafted: "",
  next_due: "", appointment: "", reminder_drafted: "", notes: "", last_reply: "",
};

// Leads table with headers in `lang`. `rows` are objects keyed by column id.
export function leadTable(rows, lang = "en") {
  const header = src.LEAD_COLUMNS.map((key) => src.t(lang, "header." + key));
  return [header].concat(rows.map((row) => {
    const full = { ...DEFAULT_LEAD, ...row };
    return src.LEAD_COLUMNS.map((key) => full[key]);
  }));
}

export function run(rows, { now = NOW, lang = "en", suppressionRows = [], config } = {}) {
  return src.planRun(leadTable(rows, lang), { now: ms(now), runDate: now.slice(0, 10), suppressionRows, config });
}

// The decision for a single lead.
export function decide(row, options) {
  return run([row], options).decisions[0];
}
