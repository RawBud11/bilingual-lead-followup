// dist/Code.gs is what gets pasted into Apps Script: it must match src/.
// Copied from bilingual-sla-tracker (tests/bundle.test.js), adjusted.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { expect, test } from "vitest";
import { bundle, DIST_FILE } from "../scripts/bundle.js";
import { SRC_DIR, srcFiles } from "./load.js";

const dist = fs.readFileSync(DIST_FILE, "utf-8").replace(/\r\n/g, "\n");

test("dist/Code.gs is up to date with src/ (run `npm run bundle` if this fails)", () => {
  expect(dist).toBe(bundle());
});

test("contains every function from src/", () => {
  for (const file of srcFiles()) {
    const code = fs.readFileSync(path.join(SRC_DIR, file), "utf-8");
    for (const [, name] of code.matchAll(/^function (\w+)\(/gm)) {
      expect(dist, `${file}: ${name}`).toContain(`function ${name}(`);
    }
  }
});

test("no Node-only code: require, module.exports, import, export, process", () => {
  expect(dist).not.toMatch(/\brequire\(|module\.exports|^\s*(import|export)\s|\bprocess\./m);
});

test("parses as plain JavaScript (Apps Script V8)", () => {
  expect(() => new vm.Script(dist)).not.toThrow();
});

test("DRY_RUN is on by default and the menu functions exist", () => {
  expect(dist).toMatch(/^var DRY_RUN = true;/m);
  for (const name of ["onOpen", "setupTabs", "loadSampleData", "runFollowups", "installHourlyTrigger"]) {
    expect(dist).toContain(`function ${name}(`);
  }
});
