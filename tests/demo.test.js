// The 60-second demo, the eval and the seed: run offline, write the
// documented files, and repeat exactly.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { ROOT } from "./load.js";
import { makeData } from "../scripts/seed.js";
import { parseCsv } from "../scripts/csv.js";

const tempDirs = [];
afterAll(() => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lfu-"));
  tempDirs.push(dir);
  return dir;
}

function node(args) {
  return execFileSync(process.execPath, args, { cwd: ROOT, encoding: "utf-8" });
}

function runDemo(args = []) {
  const out = tempDir();
  const stdout = node(["scripts/demo.js", "--out", out, ...args]);
  const read = (name) => fs.readFileSync(path.join(out, name), "utf-8");
  return { stdout, read, files: fs.readdirSync(out).sort() };
}

describe("npm run demo", () => {
  const en = runDemo();
  const es = runDemo(["--lang", "es"]);

  test("English summary and files", () => {
    expect(en.stdout).toContain("Puentara is a fictional company");
    expect(en.stdout).toContain("Drafts only: nothing is sent.");
    expect(en.stdout).toContain("Run time: 2026-11-24 15:00 UTC");
    expect(en.stdout).toContain("Drafts ready: 11 · Appointment reminders: 2 · Waiting for local hours: 1 · " +
      "Held: 3 (missing time zone 1, invalid time zone 1, missing first name 1) · Opted out: 7 · Routed to support: 1");
    // The lists under the summary use the same counts.
    expect(en.stdout).toContain("Drafts ready (11), each in the lead's language:");
    expect(en.stdout).toContain("Appointment reminders (2):");
    expect(en.stdout).toContain("Waiting for the lead's local hours (1), not drafted yet:");
    expect(en.files).toEqual(["drafts.html", "leads_after_run.csv", "queue.csv", "suppression.csv"]);
  });

  test("Spanish labels with --lang es; each draft stays in its lead's language", () => {
    expect(es.stdout).toContain("Solo borradores: no se envía nada.");
    expect(es.stdout).toMatch(/Borradores listos: 11 .*· En espera: 3 \(falta zona horaria 1, zona horaria no válida 1, falta nombre 1\)/);
    const html = es.read("drafts.html");
    expect(html).toContain("BORRADOR — no enviado");
    expect(html).toContain("Sin borrador, y por qué");
    expect(html).toContain("Hi "); // English leads still get English drafts
    expect(html).toContain("Hola, ");
    expect(es.read("queue.csv").split("\n")[0]).toContain("Enviar después de (hora local del prospecto)");
  });

  test("drafts.html: banner, To, Subject, Send after, not-drafted table, masked notes", () => {
    const html = en.read("drafts.html");
    expect(html).toContain("DRAFT — not sent");
    expect(html).toContain("Not drafted, and why");
    expect(html).toContain("Send after (lead's local time)");
    expect(html).toContain("Drafts ready (11)");
    expect(html).toContain("Appointment reminders (2)");
    expect(html).toContain("Waiting for local hours (1): not drafted yet");
    expect(html).toContain('class="card waiting"');
    expect(html).toContain("NOT DRAFTED YET — waits for the lead's local hours");
    expect(html).toContain("not drafted yet: waits until Tue Nov 24, 09:00 (Los Angeles time)");
    expect(html).toContain("[CARD NUMBER MASKED]");
    expect(html).not.toContain("0000 1234 5678 9012");
    expect(html).not.toContain("482913");
    expect(html).not.toContain("{{");
  });

  test("queue.csv masks notes too and lists every lead", () => {
    const queue = en.read("queue.csv");
    const rows = parseCsv(queue);
    const leads = parseCsv(fs.readFileSync(path.join(ROOT, "data", "leads.csv"), "utf-8"));
    expect(rows.length).toBe(leads.length);
    expect(queue).toContain("[CODE MASKED]");
    expect(queue).not.toContain("482913");
  });

  test("--now moves the clock; a bad --now or --lang gives a clear error", () => {
    const later = runDemo(["--now", "2026-11-27 13:00"]);
    expect(later.stdout).toContain("Run time: 2026-11-27 13:00 UTC");
    for (const args of [["--now", "tomorrow"], ["--now", "2026-02-31 10:00"], ["--lang", "fr"], ["--colour", "red"]]) {
      const r = spawnSync(process.execPath, ["scripts/demo.js", ...args], { cwd: ROOT, encoding: "utf-8" });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/^Error: /);
      expect(r.stderr).not.toContain("    at ");
    }
    const bad = spawnSync(process.execPath, ["scripts/demo.js", "--now", "2026-02-31 10:00"], { cwd: ROOT, encoding: "utf-8" });
    expect(bad.stderr).toContain('--now must be a real date and time in UTC, like "2026-11-24 15:00", not "2026-02-31 10:00".');
    const badEs = spawnSync(process.execPath, ["scripts/demo.js", "--lang", "es", "--now", "2026-02-31 10:00"], { cwd: ROOT, encoding: "utf-8" });
    expect(badEs.stderr).toContain("--now debe ser una fecha y hora reales en UTC");
  });
});

describe("npm run eval", () => {
  test("catches every opt-out in the labeled set and labels it sample data", () => {
    const out = node(["scripts/eval.js"]);
    expect(out).toContain("sample data");
    expect(out).toContain("Opt-outs caught: 31 of 31");
    expect(out).toContain("Result: every opt-out in this labeled sample set was caught.");
    expect(out).toContain("every reply still goes to a person");
  });
});

describe("seed data", () => {
  test("same seed, same files; matches the committed data/", () => {
    const a = makeData(8);
    const b = makeData(8);
    expect(a).toEqual(b);
    for (const [name, text] of Object.entries(a)) {
      expect(fs.readFileSync(path.join(ROOT, "data", name), "utf-8"), name).toBe(text);
    }
  });

  test("clearly fake people: example.com emails, 555-01XX phones", () => {
    const rows = parseCsv(makeData(8)["leads.csv"]).slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(30);
    for (const row of rows) {
      expect(row[2]).toMatch(/^[a-z]+\.[a-z]+@example\.com$/);
      expect(row[3]).toMatch(/^\+1-555-01\d\d$/);
    }
  });

  test("labeled replies: 55, 31 opt-outs, both languages", () => {
    const rows = parseCsv(makeData(8)["optout_labeled.csv"]).slice(1);
    expect(rows.length).toBe(55);
    expect(rows.filter((r) => r[3] === "opt_out").length).toBe(31);
    expect(rows.filter((r) => r[1] === "es").length).toBe(28);
  });
});
