// Reasonable local hours: the lead's own time zone decides "send after".
import { describe, expect, test } from "vitest";
import { src, ms, decide } from "./helpers.js";

const WINDOW = src.readConfig([]).window; // Mon-Fri 09:00-18:00

function sendAfter(nowUtc, tz) {
  return src.sendWindow(ms(nowUtc), tz, WINDOW);
}

describe("send window", () => {
  test("08:59 local is outside, 09:00 is inside (New York, UTC-5 in November)", () => {
    expect(sendAfter("2026-11-24 13:59", "America/New_York")).toEqual({ inWindow: false, date: "2026-11-24", minutes: 540 });
    expect(sendAfter("2026-11-24 14:00", "America/New_York")).toEqual({ inWindow: true, date: "2026-11-24", minutes: 540 });
  });

  test("18:00 is the end of the window (end is not included)", () => {
    expect(sendAfter("2026-11-24 22:59", "America/New_York").inWindow).toBe(true);
    expect(sendAfter("2026-11-24 23:00", "America/New_York")).toEqual({ inWindow: false, date: "2026-11-25", minutes: 540 });
  });

  test("Friday 18:30 rolls to Monday 09:00", () => {
    // Friday 2026-11-27 18:30 in Bogotá (UTC-5) = 23:30 UTC.
    expect(sendAfter("2026-11-27 23:30", "America/Bogota")).toEqual({ inWindow: false, date: "2026-11-30", minutes: 540 });
  });

  test("weekend rolls to Monday", () => {
    expect(sendAfter("2026-11-28 15:00", "America/Chicago")).toEqual({ inWindow: false, date: "2026-11-30", minutes: 540 });
  });

  test("same UTC instant: inside for Los Angeles, outside for Lima", () => {
    // 23:30 UTC = 15:30 in Los Angeles (UTC-8), 18:30 in Lima (UTC-5).
    expect(sendAfter("2026-11-24 23:30", "America/Los_Angeles").inWindow).toBe(true);
    expect(sendAfter("2026-11-24 23:30", "America/Lima")).toEqual({ inWindow: false, date: "2026-11-25", minutes: 540 });
  });

  test("Mexico City has no daylight saving time; New York does", () => {
    expect(src.localNow(ms("2026-07-01 15:00"), "America/Mexico_City").minutes).toBe(9 * 60);
    expect(src.localNow(ms("2026-07-01 15:00"), "America/New_York").minutes).toBe(11 * 60);
  });

  test("the window is configurable", () => {
    const config = src.readConfig([["window_start", "08:00"], ["window_end", "12:00"], ["window_days", "Mon,Tue"]]);
    expect(src.sendWindow(ms("2026-11-24 13:30"), "America/New_York", config.window).inWindow).toBe(true);
    expect(src.sendWindow(ms("2026-11-24 17:00"), "America/New_York", config.window).date).toBe("2026-11-30");
  });
});

describe("time zone checks: never guess", () => {
  test.each([
    ["America/Bogota", ""], ["UTC", ""], ["", "missing"], ["   ", "missing"],
    ["Eastern", "invalid"], ["EST", "invalid"], ["Hora del Este", "invalid"], ["America/Nowhere", "invalid"],
  ])("%j -> %j", (tz, problem) => {
    expect(src.timeZoneProblem(tz)).toBe(problem);
  });

  test.each(["en", "es"])("missing and invalid time zones hold the lead (%s sheet)", (lang) => {
    const missing = decide({ time_zone: "" }, { lang });
    expect(missing.action).toBe("hold");
    expect(src.reasonText(missing.reason, "en")).toBe("missing time zone");
    expect(src.reasonText(missing.reason, "es")).toBe("falta zona horaria");
    const invalid = decide({ time_zone: "Eastern", language: lang.toUpperCase() }, { lang });
    expect(invalid.action).toBe("hold");
    expect(src.reasonText(invalid.reason, "en")).toBe('invalid time zone "Eastern"');
    expect(src.reasonText(invalid.reason, "es")).toBe('zona horaria no válida "Eastern"');
    expect(invalid.draft).toBeNull();
  });
});

describe("labels in the rep's language", () => {
  test("send after: now vs next window, EN and ES", () => {
    const la = decide({ time_zone: "America/Los_Angeles" });
    expect(la.action).toBe("waiting"); // 07:00 there: not drafted yet, nothing stamped
    expect(la.updates).toEqual({});
    expect(src.sendAfterText(la, "en")).toBe("next window: Tue Nov 24, 09:00 (Los Angeles time)");
    expect(src.sendAfterText(la, "es")).toBe("próxima franja: mar 24 nov, 09:00 (hora de Los Ángeles)");
    const ny = decide({});
    expect(src.sendAfterText(ny, "en")).toBe("now: Tue Nov 24, 10:00 (New York time)");
    expect(src.sendAfterText(ny, "es")).toBe("ahora: mar 24 nov, 10:00 (hora de Nueva York)");
  });

  test("appointment time in the lead's language and time zone", () => {
    expect(src.formatAppointment({ date: "2026-11-24", minutes: 600 }, "America/New_York", "en"))
      .toBe("Tuesday, November 24 at 10:00 AM (New York time)");
    expect(src.formatAppointment({ date: "2026-11-24", minutes: 600 }, "America/Bogota", "es"))
      .toBe("martes 24 de noviembre, 10:00 a. m. (hora de Bogotá)");
    expect(src.formatAppointment({ date: "2026-11-25", minutes: 930 }, "America/Mexico_City", "es"))
      .toBe("miércoles 25 de noviembre, 3:30 p. m. (hora de Ciudad de México)");
    expect(src.formatAppointment({ date: "2026-11-25", minutes: 0 }, "America/Chicago", "en"))
      .toBe("Wednesday, November 25 at 12:00 AM (Chicago time)");
  });
});

describe("business days", () => {
  test("add business days skips weekends", () => {
    const days = WINDOW.days;
    expect(src.addBusinessDays("2026-11-20", 1, days)).toBe("2026-11-23"); // Fri -> Mon
    expect(src.addBusinessDays("2026-11-19", 3, days)).toBe("2026-11-24");
    expect(src.addBusinessDays("2026-11-13", 7, days)).toBe("2026-11-24");
    expect(src.businessDayBefore("2026-11-30", days)).toBe("2026-11-27"); // Mon -> Fri
  });

  test("dates are checked", () => {
    expect(src.parseDate("2026-02-31")).toBeNull();
    expect(src.parseDate("2026-11-24 00:00")).toBe("2026-11-24");
    expect(src.parseDateTime("2026-11-25 10:00")).toEqual({ date: "2026-11-25", minutes: 600 });
    expect(src.parseDateTime("tomorrow 10am")).toBeNull();
  });
});
