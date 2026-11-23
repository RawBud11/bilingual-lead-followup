// Templates: EN/ES parity, safe wording (lint), placeholders that never leak.
import { describe, expect, test } from "vitest";
import { src, decide } from "./helpers.js";

const clone = () => JSON.parse(JSON.stringify(src.TEMPLATES));
const VALUES = { first_name: "Ana", company: "Estudio Demo", rep_name: "Sam Demo",
  booking_link: "https://example.com/book/puentara-demo", appointment_time: "martes 24 de noviembre" };

describe("the shipped templates", () => {
  test("pass the lint (no banned wording, placeholders match, accents present)", () => {
    expect(src.lintTemplates(src.TEMPLATES)).toEqual([]);
  });

  test("every template exists in EN and ES with the same placeholders", () => {
    const keys = Object.keys(src.TEMPLATES.en).sort();
    expect(keys).toEqual(["needs_rep", "reminder", "touch1", "touch2", "touch3"]);
    expect(Object.keys(src.TEMPLATES.es).sort()).toEqual(keys);
    for (const key of keys) {
      const en = src.placeholdersIn(src.TEMPLATES.en[key].subject + src.TEMPLATES.en[key].body);
      const es = src.placeholdersIn(src.TEMPLATES.es[key].subject + src.TEMPLATES.es[key].body);
      expect(es, key).toEqual(en);
      expect(en, key).toEqual(expect.arrayContaining(["booking_link", "first_name", "rep_name"]));
    }
  });

  test("Spanish uses tú and has its accents", () => {
    const es = Object.values(src.TEMPLATES.es).map((tpl) => tpl.subject + "\n" + tpl.body).join("\n");
    expect(es).toMatch(/\b(tu|te|puedes|quieres|dímelo)\b/);
    expect(es).not.toMatch(/\b(usted|su demo|puede elegir)\b/i);
    for (const word of ["manana", "reunion", "aqui", "facturacion", "ultimo", "dimelo"]) {
      expect(es, word).not.toMatch(new RegExp(`(^|[^a-záéíóúñ])${word}($|[^a-záéíóúñ])`, "i"));
    }
    expect(es).toContain("aquí");
    expect(es).toContain("facturación");
  });

  test("no template asks the lead for anything sensitive", () => {
    for (const lang of ["en", "es"]) {
      for (const tpl of Object.values(src.TEMPLATES[lang])) {
        expect(tpl.body).not.toMatch(/card number|pin\b|cvv|password|one-time code|número de tarjeta|contraseña|código/i);
      }
    }
  });
});

describe("the lint catches an injected bad template", () => {
  const BAD = {
    en: ["You are pre-approved!", "Guaranteed results", "No fees, ever", "our lowest rate",
      "You will save $200", "Risk-free trial", "This is tax deductible", "you should invest in it",
      "This is not legal advice", "Reply with your card number", "Send your PIN", "What's your CVV?",
      "Confirm your password", "Send the one-time code"],
    es: ["Ya estás preaprobado", "Resultado garantizado", "Sin comisiones", "El más bajo del mercado",
      "Ahorrarás mucho", "Sin riesgo", "Es deducible de impuestos", "Deberías invertir ya",
      "Te damos asesoría legal", "Envíanos tu número de tarjeta", "Mándanos tu contraseña",
      "Comparte el código que te llegó", "Tu crédito está aprobado"],
  };
  for (const lang of ["en", "es"]) {
    test.each(BAD[lang])(`${lang}: %s`, (bad) => {
      const templates = clone();
      templates[lang].touch2.body += "\n" + bad;
      const problems = src.lintTemplates(templates);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join("\n")).toMatch(/banned (promise|advice|sensitive) wording/);
    });
  }

  test("missing Spanish version, unknown placeholder, placeholder mismatch, missing accent", () => {
    let t = clone(); delete t.es.touch3;
    expect(src.lintTemplates(t).join()).toContain("es.touch3: missing");
    t = clone(); t.en.touch1.body += " {{notes}}";
    expect(src.lintTemplates(t).join()).toContain("unknown placeholder {{notes}}");
    t = clone(); t.es.touch1.body = t.es.touch1.body.replace("{{company}}", "tu empresa");
    expect(src.lintTemplates(t).join()).toContain("touch1: EN uses");
    t = clone(); t.es.touch2.body += " Nos vemos manana en la reunion.";
    const problems = src.lintTemplates(t).join("\n");
    expect(problems).toContain('"manana" is missing its accent');
    expect(problems).toContain('"reunion" is missing its accent');
  });

  test("a run refuses to draft from templates that fail the lint", () => {
    const saved = src.TEMPLATES.en.touch1.body;
    src.TEMPLATES.en.touch1.body = saved + "\nYou're pre-approved.";
    try {
      expect(() => decide({})).toThrow(/safety check/);
    } finally {
      src.TEMPLATES.en.touch1.body = saved;
    }
  });
});

describe("filling placeholders", () => {
  test.each(["en", "es"])("all values present (%s): nothing left in braces", (lang) => {
    for (const key of Object.keys(src.TEMPLATES[lang])) {
      const out = src.fillTemplate(lang, key, VALUES);
      expect(out.problems).toEqual([]);
      expect(out.subject + out.body).not.toMatch(/[{}]/);
    }
  });

  test.each([
    ["first_name", "", "missing first name", "falta nombre"],
    ["company", "  ", "missing company", "falta empresa"],
    ["first_name", "{{first_name}}", "check first name", "revisar nombre"],
    ["first_name", "ana@example.com", "check first name", "revisar nombre"],
    ["rep_name", "", "missing rep name", "falta nombre del asesor"],
  ])("%s = %j holds the lead", (field, value, en, es) => {
    const d = decide({ [field]: value });
    expect(d.action).toBe("hold");
    expect(d.draft).toBeNull();
    expect(src.reasonText(d.reason, "en")).toBe(en);
    expect(src.reasonText(d.reason, "es")).toBe(es);
  });

  test("bad booking link in Config is refused", () => {
    expect(() => src.readConfig([["booking_link", "example.com/book"]])).toThrow(/booking_link/);
  });

  test("notes are never pasted into a message", () => {
    const notes = "VIP, call her husband, budget 5k";
    const d = decide({ notes });
    expect(d.action).toBe("draft");
    expect(d.draft.body).not.toContain("VIP");
    expect(d.draft.body).not.toContain("budget");
  });
});
