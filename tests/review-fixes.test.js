// Cases from review round 1: replies the first opt-out list missed, unknown
// statuses, opt-outs logged in Notes, more support wordings, links in name
// fields, and more banned template wording. EN and ES throughout.
import { describe, expect, test } from "vitest";
import { src, run, decide } from "./helpers.js";

describe("opt-out replies the first list missed", () => {
  test.each([
    "No me manden más correos", "Please opt me out", "Remove us from your mailing list",
    "Bórrenme de su lista", "Do not contact us", "No quiero recibir más correos",
    "Sáquenme de su lista por favor", "Leave me alone", "No me envíen más mensajes",
    "No thanks, we're all set", "No, gracias", "sacarme de la lista", "Quítenme de esta lista",
    "No nos escriban", "no nos contacten", "Please take us off", "opt-out", "borrarme",
  ])("%s", (reply) => {
    expect(src.optOutPhrase(reply)).not.toBe("");
    expect(decide({ last_reply: reply }).action).toBe("opted_out");
  });
});

describe("any other reply goes to a person, whatever the Status", () => {
  test.each([
    ["en", "New", "Sounds good, what's next?"],
    ["en", "Contacted", "Who is this?"],
    ["en", "Booked", "See you then"],
    ["es", "Nuevo", "Suena bien, ¿qué sigue?"],
    ["es", "Contactado", "¿Quién habla?"],
    ["es", "Agendado", "Nos vemos"],
  ])("%s, Status %s, reply %j", (lang, status, reply) => {
    const d = decide({ status, last_reply: reply, appointment: "2026-11-25 10:00", language: lang.toUpperCase() }, { lang });
    expect(d.action).toBe("needs_person");
    expect(d.draft).toBeNull();
    expect(src.reasonText(d.reason, "en")).toContain("clear Last reply to resume");
    expect(src.reasonText(d.reason, "es")).toContain("borra Última respuesta para retomar");
  });

  test("clearing Last reply resumes the sequence", () => {
    expect(decide({ last_reply: "ok" }).action).toBe("needs_person");
    expect(decide({ last_reply: "" }).action).toBe("draft");
  });
});

describe("Status: unknown values hold the lead, aliases are recognised", () => {
  test.each([["en", "Maybe later", 'check status "Maybe later"'], ["es", "Quizás luego", 'revisa el estado "Quizás luego"']])(
    "%s: %j", (lang, status, text) => {
      const plan = run([{ status }], { lang });
      const d = plan.decisions[0];
      expect(d.action).toBe("hold");
      expect(src.reasonText(d.reason, lang)).toBe(text);
      // The queue shows the status exactly as typed.
      expect(src.queueTable(plan.decisions, lang)[1][3]).toBe(status);
      expect(src.summaryLines(src.countDecisions(plan.decisions), lang)[0])
        .toContain(lang === "en" ? "(check status 1)" : "(revisa el estado 1)");
    });

  test("blank Status means New", () => {
    expect(decide({ status: "" }).action).toBe("draft");
  });

  test.each(["Do not call", "No llamar", "Unsubscribe", "Baja", "Opt-out", "Not interested", "No interesado", "No interesada"])(
    "%s -> opted out", (status) => {
      const d = decide({ status });
      expect(d.action).toBe("opted_out");
      expect(d.reason.key).toBe("optout.status");
    });

  test.each(["Lost", "Bounced", "Perdido", "Rebotado"])("%s -> stopped (closed)", (status) => {
    expect(decide({ status }).reason.key).toBe("stopped.closed");
  });
});

describe("opt-outs logged in Notes", () => {
  test.each([
    "Called: lead said do not contact me again",
    "Llamé: pidió que no le escribamos más, darme de baja",
    "Llamé: pidió que no le escribamos más",
    "Pidió que no le llamen",
    "Dijo que no lo contacten",
  ])("%s", (notes) => {
    const d = decide({ notes });
    expect(d.action).toBe("opted_out");
    expect(d.reason.key).toBe("optout.notes");
    expect(src.reasonText(d.reason, "en")).toMatch(/^notes say "/);
    expect(src.reasonText(d.reason, "es")).toMatch(/^las notas dicen "/);
  });

  test("a notes opt-out also goes on the suppression list", () => {
    const plan = run([{ notes: "Do not call this lead" }, { email: "other@example.com", phone: "+1-555-0100" }]);
    expect(plan.decisions.map((d) => d.action)).toEqual(["opted_out", "opted_out"]);
  });
});

describe("support wordings added after review", () => {
  test.each([
    ["card_lost_stolen", "Someone used my card", "Alguien usó mi tarjeta"],
    ["card_lost_stolen", "My card was cloned", "Me clonaron la tarjeta"],
    ["card_lost_stolen", "People are using my card", "Están usando mi tarjeta"],
    ["account_access", "My account got locked and I forgot my password", "No puedo ingresar a mi cuenta"],
    ["account_access", "I forgot my password", "Olvidé mi contraseña"],
    ["account_access", "My account is locked", "Me bloquearon la cuenta"],
  ])("%s: EN %j / ES %j", (category, en, es) => {
    for (const notes of [en, es]) {
      const d = decide({ notes });
      expect(d.action, notes).toBe("support");
      expect(d.reason.vars.category, notes).toBe(category);
    }
  });

  test("ordinary card questions still do not route", () => {
    for (const notes of ["Quiero saber el uso de tarjetas para mi equipo", "Wants team cards"]) {
      expect(decide({ notes }).action, notes).toBe("draft");
    }
  });
});

describe("links in name fields hold the lead", () => {
  test.each([
    ["company", "https://spam.example", "check company", "revisar empresa"],
    ["company", "www.example.com", "check company", "revisar empresa"],
    ["first_name", "http://x.example", "check first name", "revisar nombre"],
    ["rep_name", "WWW.rep.example", "check rep name", "revisar nombre del asesor"],
  ])("%s = %j", (field, value, en, es) => {
    const d = decide({ [field]: value });
    expect(d.action).toBe("hold");
    expect(src.reasonText(d.reason, "en")).toBe(en);
    expect(src.reasonText(d.reason, "es")).toBe(es);
  });
});

describe("more banned template wording", () => {
  test.each([
    ["en", "Reply with the code we texted you"], ["en", "Send us your card details"],
    ["en", "What's your account number?"], ["en", "Confirm your SSN"], ["en", "and your social security number"],
    ["es", "Envíanos los datos de tu tarjeta"], ["es", "Confirma tu número de cuenta"],
    ["es", "Te aseguramos el mejor resultado"], ["es", "Resultado asegurado"],
  ])("%s: %s", (lang, bad) => {
    const templates = JSON.parse(JSON.stringify(src.TEMPLATES));
    templates[lang].touch1.body += "\n" + bad;
    expect(src.lintTemplates(templates).join("\n")).toMatch(/banned (promise|sensitive) wording/);
  });

  test("the real templates still pass", () => {
    expect(src.lintTemplates(src.TEMPLATES)).toEqual([]);
  });
});
