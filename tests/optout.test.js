// Opt-out / do-not-contact, English and Spanish. Opt-out beats everything.
import { describe, expect, test } from "vitest";
import { src, run, decide } from "./helpers.js";

describe("every opt-out phrase, in a sentence, upper and lower case", () => {
  const phrases = src.OPT_OUT_PHRASES.en.concat(src.OPT_OUT_PHRASES.es);
  test.each(phrases)("%s", (phrase) => {
    expect(src.optOutPhrase(`Hi, ${phrase}. Thanks`)).not.toBe("");
    expect(src.optOutPhrase(phrase.toUpperCase())).not.toBe("");
  });

  test("the approved plan's phrases are all in the lists", () => {
    const plan = ["unsubscribe", "stop", "remove me", "don't contact me", "do not email", "not interested",
      "darme de baja", "dar de baja", "no me contacten", "no me escriban", "no me llamen",
      "dejen de escribirme", "no estoy interesado", "no estoy interesada", "cancelar suscripción"];
    for (const p of plan) expect(src.optOutPhrase(p), p).not.toBe("");
  });
});

describe("accents, case and apostrophes do not matter", () => {
  test.each([
    "Cancelar suscripción", "cancelar suscripcion", "CANCELAR SUSCRIPCIÓN",
    "No me escriban más", "no me escriban mas", "I\u2019m not interested", "Don\u2019t contact me",
  ])("%s", (reply) => {
    expect(src.optOutPhrase(reply)).not.toBe("");
  });
});

describe("'baja' only counts as a standalone reply", () => {
  test.each(["Baja", "baja.", "  BAJA!  "])("%j is an opt-out", (reply) => {
    expect(src.optOutPhrase(reply)).toBe("baja");
  });
  test.each(["¿Baja el precio si somos varios?", "La tarifa baja en diciembre?"])("%j is not", (reply) => {
    expect(src.optOutPhrase(reply)).toBe("");
  });
  test("'stop' does not match 'stopped' or 'nonstop'", () => {
    expect(src.optOutPhrase("The app stopped loading")).toBe("");
    expect(src.optOutPhrase("We work nonstop")).toBe("");
  });
});

describe("opted-out leads get no draft", () => {
  test.each([
    ["en", { last_reply: "Please remove me from your list." }, "optout.reply"],
    ["es", { language: "ES", last_reply: "Por favor no me escriban más." }, "optout.reply"],
    ["en", { status: "Do not contact" }, "optout.status"],
    ["es", { status: "No contactar" }, "optout.status"],
    ["en", { opt_out: "Yes" }, "optout.column"],
    ["es", { opt_out: "Sí" }, "optout.column"],
  ])("%s sheet: %j", (lang, row, key) => {
    const d = decide(row, { lang });
    expect(d.action).toBe("opted_out");
    expect(d.reason.key).toBe(key);
    expect(d.draft).toBeNull();
  });

  test("Booked + opted out: no appointment reminder (EN and ES)", () => {
    for (const reply of ["Actually, unsubscribe me.", "Mejor no me contacten, gracias."]) {
      const d = decide({ status: "Booked", appointment: "2026-11-25 10:00", last_reply: reply });
      expect(d.action).toBe("opted_out");
      expect(d.draft).toBeNull();
    }
  });

  test("opt-out beats a support issue and a pricing question", () => {
    const d = decide({ notes: "Lost my card. How much does it cost?", last_reply: "stop" });
    expect(d.action).toBe("opted_out");
  });
});

describe("suppression list (sticky)", () => {
  test("a duplicate row with a suppressed email is blocked, even above the opt-out row", () => {
    const plan = run([
      { email: "same.person@example.com", phone: "+1-555-0111", notes: "second form" },
      { email: "Same.Person@example.com", phone: "+1-555-0112", last_reply: "no me llamen" },
    ]);
    expect(plan.decisions.map((d) => d.action)).toEqual(["opted_out", "opted_out"]);
    expect(plan.decisions[0].reason.key).toBe("optout.suppressed");
  });

  test("a duplicate row with the same phone (other format) is blocked", () => {
    const plan = run([
      { email: "a@example.com", phone: "+1-555-0142", status: "Do not contact" },
      { email: "b@example.com", phone: "1 (555) 0142" },
    ]);
    expect(plan.decisions[1].action).toBe("opted_out");
  });

  test("existing Suppression tab rows block the lead", () => {
    const d = run([{}], { suppressionRows: [["alex.demo@example.com", "", "unsubscribe", "2026-11-01"]] }).decisions[0];
    expect(d.action).toBe("opted_out");
    expect(src.reasonText(d.reason, "es")).toBe("el correo o el teléfono está en la lista de supresión");
  });

  test("new opt-outs are added once, with the reason in the sheet's language", () => {
    const plan = run([
      { email: "x@example.com", phone: "+1-555-0150", last_reply: "Dejen de escribirme" },
      { email: "x@example.com", phone: "+1-555-0150", status: "Do not contact" },
    ]);
    const rows = src.suppressionRows(plan.suppression.added, "es");
    expect(rows).toEqual([["x@example.com", "+1-555-0150", 'la última respuesta dice "dejen de escribirme"', "2026-11-24"]]);
  });

  test("already suppressed people are not added twice", () => {
    const plan = run([{ status: "Do not contact" }], { suppressionRows: [["alex.demo@example.com", "+1-555-0100"]] });
    expect(plan.suppression.added).toEqual([]);
  });
});
