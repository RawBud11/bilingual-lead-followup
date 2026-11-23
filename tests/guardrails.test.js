// Guardrails that cut across files:
// 1. Never auto-send: no send calls anywhere in the shipped code; DRY_RUN on.
// 2. Sensitive data in notes is masked wherever notes are shown (EN and ES).
// 3. UI strings exist in both languages and never ask for sensitive data.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test } from "vitest";
import { ROOT } from "./load.js";
import { src, run } from "./helpers.js";

function filesIn(dir, exts) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(rel, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
  });
}

describe("1. never auto-send", () => {
  const sources = ["src", "apps-script", "scripts", "dist"].flatMap((dir) => filesIn(dir, [".js", ".gs"]));

  test("the scan covers the source files", () => {
    expect(sources.length).toBeGreaterThanOrEqual(15);
    expect(sources).toEqual(expect.arrayContaining([path.join("apps-script", "Code.gs"), path.join("dist", "Code.gs")]));
  });

  test.each(sources)("%s has no send calls", (file) => {
    const code = fs.readFileSync(path.join(ROOT, file), "utf-8");
    expect(code).not.toMatch(/sendEmail|MailApp|GmailApp\.send|\.send\(/);
  });

  test("the only Gmail call is createDraft", () => {
    const code = fs.readFileSync(path.join(ROOT, "apps-script", "Code.gs"), "utf-8");
    const calls = code.match(/GmailApp\.\w+/g);
    expect([...new Set(calls)]).toEqual(["GmailApp.createDraft"]);
  });

  test("DRY_RUN defaults to true", () => {
    const code = fs.readFileSync(path.join(ROOT, "apps-script", "Code.gs"), "utf-8");
    const ctx = vm.createContext({});
    vm.runInContext(code, ctx);
    expect(ctx.DRY_RUN).toBe(true);
  });
});

describe("2. sensitive data in notes is masked", () => {
  // The first lead is drafted (notes shown in the preview); the second has a
  // reply, so it goes to a person (reply shown in the queue).
  const LEADS = {
    en: [{ notes: "Typed card 0000 1234 5678 9012 and code 482913 by mistake" },
      { email: "b@example.com", last_reply: "the code is 482913, my password is Sunflower2024" }],
    es: [{ notes: "Escribió la tarjeta 0000-1234-5678-9012 y el código 482913 por error" },
      { email: "b@example.com", last_reply: "el código es 482913, mi contraseña es Girasol2024" }],
  };
  test.each(["en", "es"])("queue table and preview (%s)", (lang) => {
    const plan = run(LEADS[lang].map((row) => ({ ...row, language: lang.toUpperCase() })), { lang });
    const shown = JSON.stringify(src.queueTable(plan.decisions, lang)) + JSON.stringify(src.previewTable(plan.decisions, lang));
    expect(shown).toContain("[CARD NUMBER MASKED]");
    expect(shown).toContain("[CODE MASKED]");
    expect(shown).toContain("[PASSWORD MASKED]");
    expect(shown).not.toMatch(/0000.1234.5678.9012|482913|Girasol2024|Sunflower2024/);
    expect(plan.decisions.map((d) => d.action)).toEqual(["draft", "needs_person"]);
    expect(plan.decisions[0].draft.body).not.toMatch(/0000|482913/);
  });
});

describe("3. UI strings", () => {
  test("every key exists in English and Spanish", () => {
    expect(Object.keys(src.STRINGS.es).sort()).toEqual(Object.keys(src.STRINGS.en).sort());
  });

  test("the same {placeholders} in both languages", () => {
    for (const key of Object.keys(src.STRINGS.en)) {
      const names = (text) => (text.match(/\{\w+\}/g) || []).sort();
      expect(names(src.STRINGS.es[key]), key).toEqual(names(src.STRINGS.en[key]));
    }
  });

  test("no UI text asks for a PIN, CVV, card number, password or code", () => {
    const all = Object.values(src.STRINGS.en).concat(Object.values(src.STRINGS.es)).join("\n");
    expect(all).not.toMatch(/\b(pin|cvv)\b|card number|número de tarjeta|password|contraseña|código|one-time code/i);
  });

  test("Spanish UI uses tú, not usted", () => {
    const es = Object.values(src.STRINGS.es).join("\n");
    expect(es).not.toMatch(/\busted\b|\bagregue\b|\buse la\b|\bespere\b/i);
    expect(es).toMatch(/\b(agrega|usa|revísalo|espera)\b/i);
  });
});
