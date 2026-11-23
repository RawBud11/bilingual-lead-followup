// Check the opt-out detector on the labeled replies in data/optout_labeled.csv.
//   npm run eval
// Sample data: synthetic, hand-written replies. The goal is to catch EVERY
// opt-out; false alarms are listed so you can see where it over-blocks.
// Exits with code 1 if any opt-out is missed.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadSrc, ROOT } from "../tests/load.js";
import { parseCsv } from "./csv.js";

export function evaluate(src, rows) {
  const result = { total: 0, optOuts: 0, caught: 0, missed: [], falseAlarms: [], byLang: {} };
  for (const [id, lang, reply, expected] of rows) {
    const phrase = src.optOutPhrase(reply);
    const flagged = phrase !== "";
    const isOptOut = expected === "opt_out";
    const by = result.byLang[lang] || (result.byLang[lang] = { optOuts: 0, caught: 0, keep: 0, falseAlarms: 0 });
    result.total++;
    if (isOptOut) {
      result.optOuts++; by.optOuts++;
      if (flagged) { result.caught++; by.caught++; } else result.missed.push({ id, lang, reply });
    } else {
      by.keep++;
      if (flagged) { by.falseAlarms++; result.falseAlarms.push({ id, lang, reply, phrase }); }
    }
  }
  return result;
}

function main() {
  const file = path.join(ROOT, "data", "optout_labeled.csv");
  if (!fs.existsSync(file)) throw new Error('data/optout_labeled.csv not found. Run "npm run seed" first.');
  const rows = parseCsv(fs.readFileSync(file, "utf-8")).slice(1).filter((r) => r.length >= 4);
  const r = evaluate(loadSrc(), rows);
  console.log("Opt-out detector check (sample data: synthetic, hand-written replies)");
  console.log(`Replies: ${r.total} (${r.optOuts} opt-outs, ${r.total - r.optOuts} other replies)`);
  console.log(`Opt-outs caught: ${r.caught} of ${r.optOuts}`);
  for (const lang of Object.keys(r.byLang).sort()) {
    const b = r.byLang[lang];
    console.log(`  ${lang.toUpperCase()}: caught ${b.caught} of ${b.optOuts}; false alarms ${b.falseAlarms} of ${b.keep}`);
  }
  console.log(`False alarms (would be blocked, a rep can check): ${r.falseAlarms.length}`);
  r.falseAlarms.forEach((f) => console.log(`  ${f.id} ${f.lang.toUpperCase()}  "${f.reply}"  (matched "${f.phrase}")`));
  if (r.missed.length) {
    console.log(`MISSED opt-outs: ${r.missed.length}`);
    r.missed.forEach((m) => console.log(`  ${m.id} ${m.lang.toUpperCase()}  "${m.reply}"`));
    process.exit(1);
  }
  console.log("Result: every opt-out in this labeled sample set was caught. This is a keyword list:");
  console.log("it will miss wordings that are not in it, so every reply still goes to a person.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error("Error: " + err.message);
    process.exit(1);
  }
}
