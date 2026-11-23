// The follow-up sequence, stop statuses, support routing, pricing questions,
// language handling and idempotent write-back.
import { describe, expect, test } from "vitest";
import { src, decide, leadTable, ms, NOW } from "./helpers.js";

describe("sequence: touch 1 next business day, touch 2 +3, final +7, then stop", () => {
  test.each([
    [{ requested_on: "2026-11-23" }, "draft", "touch1"],
    [{ requested_on: "2026-11-24" }, "not_due", ""],
    [{ requested_on: "2026-11-20" }, "draft", "touch1"], // Friday -> due Monday, overdue is drafted
    [{ touches: "1", last_drafted: "2026-11-19" }, "draft", "touch2"],
    [{ touches: "1", last_drafted: "2026-11-20" }, "not_due", ""],
    [{ touches: "2", last_drafted: "2026-11-13" }, "draft", "touch3"],
    [{ touches: "2", last_drafted: "2026-11-16" }, "not_due", ""],
    [{ touches: "3", last_drafted: "2026-11-01" }, "stopped", ""],
  ])("%j -> %s %s", (row, action, template) => {
    const d = decide(row);
    expect(d.action).toBe(action);
    expect(d.template).toBe(template);
  });

  test("not due yet says when", () => {
    const d = decide({ touches: "1", last_drafted: "2026-11-23" });
    expect(src.reasonText(d.reason, "en")).toBe("next follow-up due 2026-11-26");
    expect(src.reasonText(d.reason, "es")).toBe("próximo seguimiento el 2026-11-26");
    expect(d.updates.next_due).toBe("2026-11-26");
  });

  test("gaps come from the Config tab", () => {
    const config = src.readConfig([["touch1_days", "0"]]);
    expect(decide({ requested_on: "2026-11-24" }, { config }).action).toBe("draft");
    expect(() => src.readConfig([["touch2_days", "two"]])).toThrow(/touch2_days/);
  });

  test("missing request date holds the lead", () => {
    const d = decide({ requested_on: "" });
    expect(d.action).toBe("hold");
    expect(src.reasonText(d.reason, "es")).toBe("falta fecha de solicitud");
  });
});

describe("stop statuses", () => {
  test.each(["Closed", "Cerrado"])("%s: stopped", (status) => {
    expect(decide({ status }).action).toBe("stopped");
  });
  test.each([["Replied", "en"], ["Respondió", "es"]])("%s: reply needs a person, never a follow-up", (status, lang) => {
    const d = decide({ status, touches: "1", last_drafted: "2026-11-01" }, { lang });
    expect(d.action).toBe("needs_person");
    expect(d.draft).toBeNull();
    expect(src.t("en", "action." + d.action)).toBe("Reply needs a person");
    expect(src.t("es", "action." + d.action)).toBe("La respuesta necesita a una persona");
  });
});

describe("appointment reminders", () => {
  test("one reminder the business day before, in the lead's language and time zone", () => {
    const en = decide({ status: "Booked", appointment: "2026-11-25 10:00" });
    expect(en.action).toBe("reminder");
    expect(en.draft.body).toContain("Wednesday, November 25 at 10:00 AM (New York time)");
    expect(en.draft.body).toContain("https://example.com/book/puentara-demo");
    const es = decide({ status: "Agendado", language: "ES", time_zone: "America/Bogota", appointment: "2026-11-25 15:30" }, { lang: "es" });
    expect(es.action).toBe("reminder");
    expect(es.draft.body).toContain("miércoles 25 de noviembre, 3:30 p. m. (hora de Bogotá)");
    expect(es.updates).toEqual({ reminder_drafted: "2026-11-24", next_due: "" });
  });

  test("long time zone names still fit (Mexico City, both languages)", () => {
    for (const [language, text] of [["EN", "Monday, November 30 at 11:00 AM (Mexico City time)"],
      ["ES", "lunes 30 de noviembre, 11:00 a. m. (hora de Ciudad de México)"]]) {
      const d = decide({ status: "Booked", language, time_zone: "America/Mexico_City", appointment: "2026-11-30 11:00" },
        { now: "2026-11-27 15:00" });
      expect(d.action).toBe("reminder");
      expect(d.draft.body).toContain(text);
    }
  });

  test("Monday appointment: reminder on Friday, not before", () => {
    const d = decide({ status: "Booked", appointment: "2026-11-30 11:00" });
    expect(d.action).toBe("not_due");
    expect(src.reasonText(d.reason, "en")).toBe("reminder due 2026-11-27");
    expect(decide({ status: "Booked", appointment: "2026-11-30 11:00" }, { now: "2026-11-27 15:00" }).action).toBe("reminder");
  });

  test("no second reminder, none after the appointment, hold without a time", () => {
    expect(decide({ status: "Booked", appointment: "2026-11-25 10:00", reminder_drafted: "2026-11-23" }).action).toBe("not_due");
    expect(decide({ status: "Booked", appointment: "2026-11-24 09:00" }).action).toBe("stopped");
    const d = decide({ status: "Booked", appointment: "next week" });
    expect(d.action).toBe("hold");
    expect(src.reasonText(d.reason, "en")).toBe("Booked, but no valid appointment date and time");
  });
});

describe("support issues go to support, not sales", () => {
  test.each([
    ["card_lost_stolen", "I lost my card yesterday", "Perdí mi tarjeta, alguien la está usando"],
    ["card_lost_stolen", "My card was stolen", "Me robaron la tarjeta"],
    ["account_access", "I can't log in to my account", "No puedo entrar a mi cuenta"],
    ["account_access", "I think I was hacked", "Me hackearon la cuenta"],
    ["charge_dispute", "There is a fraudulent charge on my account", "Hay un cargo que no reconozco"],
    ["charge_dispute", "I want to dispute a charge", "Quiero abrir una disputa por un cobro"],
    ["transfer_failed_pending", "My transfer is still pending", "Mi transferencia no ha llegado"],
    ["transfer_failed_pending", "The transfer failed twice", "La transferencia quedó pendiente"],
  ])("%s: EN %j / ES %j", (category, en, es) => {
    for (const [lang, notes] of [["en", en], ["es", es]]) {
      const d = decide({ notes, language: lang.toUpperCase() });
      expect(d.action, notes).toBe("support");
      expect(d.reason.vars.category).toBe(category);
      expect(d.draft).toBeNull();
    }
  });

  test("the reason is readable in both languages", () => {
    const d = decide({ notes: "perdí mi tarjeta" });
    expect(src.reasonText(d.reason, "en")).toBe("looks like a support case (card lost or stolen), not a sales lead");
    expect(src.reasonText(d.reason, "es")).toBe("parece un caso de soporte (tarjeta perdida o robada), no un prospecto de ventas");
  });

  test("a support case in the last reply also routes, even for Booked leads", () => {
    expect(decide({ status: "Booked", appointment: "2026-11-25 10:00", last_reply: "Can't log in, help" }).action).toBe("support");
  });

  test("ordinary sales notes do not route", () => {
    for (const notes of ["Wants team cards for 5 people", "Quiere tarjetas para su equipo", "International payments to Mexico"]) {
      expect(decide({ notes }).action, notes).toBe("draft");
    }
  });
});

describe("pricing or approval questions: needs rep, the draft defers to the call", () => {
  test.each([
    ["en", "How much does it cost? Any fees?"],
    ["en", "Will my account be approved quickly?"],
    ["es", "¿Cuánto cuesta el plan para 3 personas?"],
    ["es", "¿Me aprueban rápido? ¿Qué comisiones cobran?"],
  ])("%s: %s", (lang, notes) => {
    const d = decide({ notes, language: lang.toUpperCase() });
    expect(d.action).toBe("draft");
    expect(d.template).toBe("needs_rep");
    expect(d.flags[0]).toBe("flag.needs_rep");
    expect(d.draft.body).not.toMatch(/\$|\d+ ?%|approved|aprobad/i);
    expect(d.lang).toBe(lang);
  });
});

describe("bilingual: each draft in the lead's language", () => {
  test("Language column wins", () => {
    expect(decide({ language: "ES", notes: "Hello, I want to see invoicing" }).draft.body).toMatch(/^Hola, Alex:/);
    expect(decide({ language: "Spanish" }).lang).toBe("es");
    expect(decide({ language: "Inglés", notes: "Hola, quiero ver la facturación" }).draft.body).toMatch(/^Hi Alex,/);
  });

  test("blank Language: guessed from notes, and marked", () => {
    const es = decide({ language: "", notes: "Quiero ver cómo facturar a mis clientes" });
    expect(es.lang).toBe("es");
    expect(es.draft.subject).toBe("Tu demo de Puentara, Alex");
    expect(es.flags).toContain("flag.guessed");
    const en = decide({ language: "", last_reply: "Thanks, I want to see how invoicing works" });
    expect(en.lang).toBe("en");
    expect(en.flags).toContain("flag.guessed");
  });

  test("blank Language and nothing to go on: English, 'check language'", () => {
    const d = decide({ language: "", notes: "" });
    expect(d.lang).toBe("en");
    expect(d.flags).toEqual(["flag.check"]);
  });

  test("Spanish sheet headers and status labels work the same", () => {
    const d = decide({ status: "Contactado", touches: "1", last_drafted: "2026-11-19", language: "ES" }, { lang: "es" });
    expect(d.action).toBe("draft");
    expect(d.draft.subject).toBe("Seguimiento de tu demo de Puentara");
  });

  test("missing required column: clear error in the sheet's language", () => {
    const table = leadTable([{}], "es").map((row) => row.slice(1)); // drop "Nombre"
    expect(() => src.planRun(table, { now: ms(NOW) })).toThrow("A la pestaña Prospectos le faltan estas columnas: Nombre");
  });
});

describe("write-back and idempotency", () => {
  test("a draft updates Touches, Last drafted and Next due", () => {
    const d = decide({ touches: "1", last_drafted: "2026-11-19" });
    expect(d.updates).toEqual({ touches: "2", last_drafted: "2026-11-24", next_due: "2026-12-03" });
    const last = decide({ touches: "2", last_drafted: "2026-11-13" });
    expect(last.updates).toEqual({ touches: "3", last_drafted: "2026-11-24", next_due: "" });
  });

  test("running twice on the same day creates no duplicate drafts or reminders", () => {
    const rows = [{}, { email: "b@example.com", language: "ES", time_zone: "America/Lima" },
      { email: "c@example.com", status: "Booked", appointment: "2026-11-25 10:00" }];
    const table = leadTable(rows);
    const first = src.planRun(table, { now: ms(NOW), runDate: "2026-11-24" });
    expect(first.decisions.filter((d) => d.draft).length).toBe(3);
    const after = src.applyUpdates(table, first.decisions, first.lang);
    const later = src.planRun(after, { now: ms("2026-11-24 20:00"), runDate: "2026-11-24" });
    expect(later.decisions.filter((d) => d.draft)).toEqual([]);
    expect(later.decisions.map((d) => d.reason.key)).toEqual(["not_due.today", "not_due.today", "not_due.reminder_done"]);
  });

  test("write-back only touches the tool's own columns, and adds missing ones", () => {
    const table = leadTable([{ notes: "keep me" }]).map((row) => row.slice(0, 12)); // up to Touches
    const plan = src.planRun(table, { now: ms(NOW), runDate: "2026-11-24" });
    const after = src.applyUpdates(table, plan.decisions, plan.lang);
    expect(after[0].slice(12)).toEqual(["Last drafted", "Next due", "Reminder drafted"]);
    expect(after[1].slice(0, 11)).toEqual(table[1].slice(0, 11));
    expect(after[1][11]).toBe("1");
  });
});
