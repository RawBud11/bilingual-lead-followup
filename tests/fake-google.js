// A small in-memory stand-in for the Google services dist/Code.gs uses
// (SpreadsheetApp, GmailApp, LockService, ScriptApp, Utilities, Logger), so
// the Apps Script layer can run in Node. It models only what this tool calls:
// values in tabs, created drafts, the lock and triggers.
// Adapted from bilingual-sla-tracker (tests/fake-google.js): MailApp is
// replaced by GmailApp.createDraft, and formatDate also does "yyyy-MM-dd".
import fs from "node:fs";
import vm from "node:vm";
import { DIST_FILE } from "../scripts/bundle.js";

// Any chain of builder calls (getUi().createMenu().addItem()...) returns the
// same object, so menu code runs without modeling each builder.
function chain() {
  const target = function () {};
  const proxy = new Proxy(target, {
    get: (t, prop) => (prop === "then" ? undefined : () => proxy),
    apply: () => proxy,
  });
  return proxy;
}

function fakeSheet(name, rows = []) {
  let values = rows.map((r) => r.slice());
  const lastColumn = () => values.reduce((m, r) => {
    for (let i = r.length - 1; i >= 0; i--) if (String(r[i] ?? "") !== "") return Math.max(m, i + 1);
    return m;
  }, 0);
  const lastRow = () => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i].some((v) => String(v ?? "") !== "")) return i + 1;
    return 0;
  };
  const get = (r, c) => (values[r] && values[r][c] != null ? values[r][c] : "");
  function range(row, col, numRows = 1, numCols = 1) {
    const api = {
      getValue: () => get(row - 1, col - 1),
      getValues: () => Array.from({ length: numRows }, (_, i) =>
        Array.from({ length: numCols }, (_, j) => get(row - 1 + i, col - 1 + j))),
      setValues: (vals) => {
        if (vals.length !== numRows || vals.some((r) => r.length !== numCols)) {
          throw new Error(`setValues: expected ${numRows}x${numCols}`);
        }
        vals.forEach((r, i) => r.forEach((v, j) => {
          while (values.length < row + i) values.push([]);
          const target = values[row - 1 + i];
          while (target.length < col + j) target.push("");
          target[col - 1 + j] = v;
        }));
        return api;
      },
      setNumberFormat: () => api,
    };
    return api;
  }
  return {
    getName: () => name,
    getDataRange: () => range(1, 1, Math.max(lastRow(), 1), Math.max(lastColumn(), 1)),
    getRange: range,
    getLastColumn: lastColumn,
    getLastRow: lastRow,
    clearContents: () => { values = []; },
    // Test helper (not Apps Script API):
    values: () => values.map((r) => r.slice()),
  };
}

// now: "YYYY-MM-DD HH:mm" UTC. The fake spreadsheet time zone is UTC.
// draftFailsOn(to): return true to make that createDraft call throw (quota).
export function fakeGoogle({ tabs = {}, now = "2026-11-24 15:00", draftFailsOn = () => false, lockFree = true } = {}) {
  const ss = {};
  const sheets = new Map(Object.entries(tabs).map(([name, rows]) => [name, fakeSheet(name, rows)]));
  const drafts = [];
  const toasts = [];
  const triggers = [];
  const lock = { held: false, released: 0 };
  const fixed = Date.parse(now.replace(" ", "T") + ":00Z");

  Object.assign(ss, {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => { const s = fakeSheet(name); sheets.set(name, s); return s; },
    getSpreadsheetTimeZone: () => "UTC",
    toast: (message) => toasts.push(message),
  });

  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  }

  const context = vm.createContext({
    Date: FixedDate,
    Logger: { log: () => {} },
    SpreadsheetApp: { getActive: () => ss, getUi: () => chain() },
    GmailApp: {
      createDraft: (to, subject, body) => {
        if (draftFailsOn(to)) throw new Error("Service invoked too many times for one day: gmail.");
        drafts.push({ to, subject, body });
      },
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (!lockFree) return false; lock.held = true; return true; },
        releaseLock: () => { lock.held = false; lock.released++; },
      }),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (tr) => triggers.splice(triggers.indexOf(tr), 1),
      newTrigger: (handler) => {
        const builder = new Proxy({}, {
          get: (t, prop) => (prop === "create"
            ? () => { const tr = { getHandlerFunction: () => handler }; triggers.push(tr); return tr; }
            : () => builder),
        });
        return builder;
      },
    },
    Utilities: {
      formatDate: (date, tz, fmt) => {
        // Other zones only for checkTimeZoneSupport: formatted with Node's
        // Intl ("sv-SE" gives "2026-11-24 10:00").
        const iso = tz === "UTC" ? new Date(date.getTime()).toISOString()
          : new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date.getTime()).replace(" ", "T");
        if (fmt === "yyyy-MM-dd") return iso.slice(0, 10);
        if (fmt === "yyyy-MM-dd HH:mm") return iso.slice(0, 16).replace("T", " ");
        throw new Error("fake formatDate: unexpected format " + fmt);
      },
    },
  });
  vm.runInContext(fs.readFileSync(DIST_FILE, "utf-8"), context, { filename: "dist/Code.gs" });
  return { gs: context, tab: (name) => sheets.get(name), tabNames: () => [...sheets.keys()], drafts, toasts, triggers, lock };
}
