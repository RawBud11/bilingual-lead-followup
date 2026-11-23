// The Apps Script layer (dist/Code.gs) against a fake of Google's services.
// Not a substitute for a run in a real sheet (see the README), but it checks
// the wiring: tabs, DRY_RUN, drafts only, write-back, lock, trigger.
import { describe, expect, test } from "vitest";
import { fakeGoogle } from "./fake-google.js";
import { leadTable } from "./helpers.js";

function laEmail(g) {
  const rows = g.tab("Leads").values();
  return rows.find((r) => r[rows[0].indexOf("Time zone")] === "America/Los_Angeles")[2];
}

function withSample() {
  const g = fakeGoogle();
  g.gs.loadSampleData();
  return g;
}

describe("setup and sample data", () => {
  test("setupTabs creates every tab with headers; safe to run twice", () => {
    const g = fakeGoogle();
    g.gs.setupTabs();
    g.gs.setupTabs();
    expect(g.tabNames().sort()).toEqual(["Config", "Draft preview", "Leads", "Queue", "Summary", "Suppression"]);
    expect(g.tab("Leads").values()[0].slice(0, 3)).toEqual(["First name", "Company", "Email"]);
    expect(g.tab("Config").values()).toContainEqual(["booking_link", "https://example.com/book/puentara-demo"]);
  });

  test("Spanish setup: Spanish tab names and headers", () => {
    const g = fakeGoogle();
    g.gs.SETUP_LANGUAGE = "es";
    g.gs.setupTabs();
    expect(g.tabNames()).toContain("Prospectos");
    expect(g.tab("Prospectos").values()[0].slice(0, 3)).toEqual(["Nombre", "Empresa", "Correo"]);
  });

  test("Load sample data fills an empty Leads tab, and refuses a tab with leads", () => {
    const g = withSample();
    expect(g.tab("Leads").values().length).toBeGreaterThan(30);
    expect(() => g.gs.loadSampleData()).toThrow(/already has leads/);
  });
});

describe("runFollowups", () => {
  test("DRY_RUN (default): preview tab only, no Gmail drafts, Leads unchanged", () => {
    // 13 ready (11 follow-ups + 2 reminders) + 1 Los Angeles lead waiting for 09:00 there.
    const g = withSample();
    const before = g.tab("Leads").values();
    g.gs.runFollowups();
    expect(g.gs.DRY_RUN).toBe(true);
    expect(g.drafts).toEqual([]);
    expect(g.tab("Leads").values()).toEqual(before);
    const preview = g.tab("Draft preview").values();
    expect(preview.length - 1).toBe(14);
    expect(g.tab("Queue").values().length).toBe(before.length);
    expect(g.tab("Summary").values()[0][0]).toBe("Follow-up summary for 2026-11-24");
    expect(g.tab("Suppression").values().length - 1).toBe(6);
    expect(g.toasts.at(-1)).toMatch(/^DRY RUN: 13 draft\(s\) ready and 1 waiting for the lead's local hours/);
    expect(g.lock).toMatchObject({ held: false, released: 1 });
  });

  test("DRY_RUN off: Gmail drafts (never sent), write-back, and no duplicates on a second run", () => {
    const g = withSample();
    g.gs.DRY_RUN = false;
    g.gs.runFollowups();
    // Only leads inside their local window: the Los Angeles lead (07:00 there) waits.
    expect(g.drafts.length).toBe(13);
    expect(g.drafts.map((d) => d.to)).not.toContain(laEmail(g));
    expect(g.drafts.every((d) => !/\{\{|\}\}/.test(d.subject + d.body))).toBe(true);
    const leads = g.tab("Leads").values();
    const header = leads[0];
    const row = leads.find((r) => r[header.indexOf("Last drafted")] === "2026-11-24" && r[header.indexOf("Touches")] === "1");
    expect(row).toBeTruthy();
    g.gs.runFollowups();
    expect(g.drafts.length).toBe(13);
    expect(g.toasts.at(-1)).toMatch(/^0 Gmail draft\(s\) created; 1 waiting/);
  });

  test("DRY_RUN off: a lead outside its local hours is drafted by a later run, once", () => {
    const g = fakeGoogle({ now: "2026-11-24 15:00" });
    g.gs.loadSampleData();
    g.gs.DRY_RUN = false;
    g.gs.runFollowups();
    const leads = g.tab("Leads").values();
    const header = leads[0];
    const la = leads.find((r) => r[header.indexOf("Time zone")] === "America/Los_Angeles");
    expect(la[header.indexOf("Last drafted")]).toBe(""); // waiting: not stamped
    const queue = g.tab("Queue").values();
    expect(queue.find((r) => r[2] === la[2])[4]).toBe("Waiting for local hours");
    // Same sheet, 18:00 UTC = 10:00 in Los Angeles: an hourly run drafts it.
    const later = fakeGoogle({ now: "2026-11-24 18:00", tabs: { Leads: leads } });
    later.gs.DRY_RUN = false;
    later.gs.runFollowups();
    expect(later.drafts.map((d) => d.to)).toEqual([la[2]]);
    later.gs.runFollowups();
    expect(later.drafts.length).toBe(1);
  });

  test("Gmail fails part way: only created drafts are stamped, a clear error", () => {
    let failed = "";
    let calls = 0;
    const g2 = fakeGoogle({ draftFailsOn: (to) => { calls++; if (calls === 3) { failed = to; return true; } return false; } });
    g2.gs.loadSampleData();
    g2.gs.DRY_RUN = false;
    expect(() => g2.gs.runFollowups()).toThrow(/12 draft\(s\) created, 1 failed/);
    const leads = g2.tab("Leads").values();
    const header = leads[0];
    const failedRow = leads.find((r) => r[header.indexOf("Email")] === failed);
    expect(failedRow[header.indexOf("Last drafted")]).not.toBe("2026-11-24"); // old value kept
    expect(g2.lock.held).toBe(false);
    expect(g2.drafts.length).toBe(12);
  });

  test("a second run while one is in progress stops with a clear message", () => {
    const g = fakeGoogle({ tabs: { Leads: leadTable([{}]) }, lockFree: false });
    expect(() => g.gs.runFollowups()).toThrow("Another run is in progress. Wait a minute and try again.");
    expect(g.drafts).toEqual([]);
  });

  test("date cells from Sheets are read as dates", () => {
    const g = fakeGoogle({ tabs: { Leads: leadTable([{ requested_on: "" }]) } });
    // Requested on (column I), as a Date cell made inside the fake's realm.
    g.tab("Leads").getRange(2, 9).setValues([[new g.gs.Date(Date.UTC(2026, 10, 23))]]);
    g.gs.DRY_RUN = false;
    g.gs.runFollowups();
    expect(g.drafts.length).toBe(1);
  });

  test("missing Leads tab: clear message", () => {
    expect(() => fakeGoogle().gs.runFollowups()).toThrow("No Leads tab found. Use the menu item Set up tabs first.");
  });
});

test("checkTimeZoneSupport compares our local time with Google's for each zone", () => {
  const lines = fakeGoogle().gs.checkTimeZoneSupport();
  expect(lines.length).toBe(6);
  expect(lines[0]).toBe("OK   America/New_York  ours 2026-11-24 10:00  Google 2026-11-24 10:00");
  expect(lines.every((line) => line.startsWith("OK"))).toBe(true);
});

test("installHourlyTrigger keeps exactly one trigger", () => {
  const g = fakeGoogle();
  g.gs.installHourlyTrigger();
  g.gs.installHourlyTrigger();
  expect(g.triggers.map((tr) => tr.getHandlerFunction())).toEqual(["runFollowups"]);
});
