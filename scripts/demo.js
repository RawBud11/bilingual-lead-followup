// Local demo: run the same follow-up logic as the Google Sheet, on CSV files.
//   npm run demo
//   npm run demo -- --lang es
//   npm run demo -- --now "2026-11-27 13:00" --out output
// --now is UTC. No Google account and no API key needed. Nothing is sent:
// drafts are written to output/drafts.html and output/queue.csv.
import fs from "node:fs";
import path from "node:path";
import { loadSrc, ROOT } from "../tests/load.js"; // loads src/*.js like Apps Script does
import { parseCsv, toCsv } from "./csv.js";
import { draftsHtml } from "./html.js";

// Tuesday: 10:00 in New York and Bogotá, 07:00 in Los Angeles.
const DEFAULT_NOW = "2026-11-24 15:00";

function readArgs(argv) {
  const args = { now: DEFAULT_NOW, lang: "en", out: "output" };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    if (!(name in args) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete option "${argv[i]}". Use --now "YYYY-MM-DD HH:mm" (UTC), --lang en|es, --out <folder>.`);
    }
    args[name] = argv[++i];
  }
  return args;
}

function readCsvFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${path.relative(ROOT, file)}. Run "npm run seed" to create the sample data.`);
  }
  return parseCsv(fs.readFileSync(file, "utf-8"));
}

function main() {
  // Windows consoles: make sure accents and the "·" print correctly.
  if (process.stdout.setDefaultEncoding) process.stdout.setDefaultEncoding("utf-8");
  const args = readArgs(process.argv.slice(2));
  const ui = args.lang;
  if (!["en", "es"].includes(ui)) throw new Error(`--lang must be "en" or "es", not "${ui}".`);
  const src = loadSrc();
  // Same rule as parseDateTime in src/hours.js: "2026-02-31 10:00" is
  // rejected instead of silently becoming March 3.
  const when = src.parseDateTime(args.now);
  if (!when) throw new Error(src.t(ui, "error.bad_now", { value: args.now }));
  const nowMs = Date.parse(`${when.date}T00:00:00Z`) + when.minutes * 60000;
  const nowText = new Date(nowMs).toISOString().slice(0, 16).replace("T", " ");

  const table = readCsvFile(path.join(ROOT, "data", "leads.csv"));
  const plan = src.planRun(table, { now: nowMs, runDate: nowText.slice(0, 10), suppressionRows: [] });
  const counts = src.countDecisions(plan.decisions);
  const summary = src.summaryLines(counts, ui);

  console.log(src.t(ui, "console.banner"));
  console.log(src.t(ui, "console.dry_run"));
  console.log(src.t(ui, "console.now", { now: nowText }));
  console.log("");
  summary.forEach((line) => console.log(line));
  console.log("");
  // Same three groups and counts as the summary line and drafts.html.
  for (const [action, heading] of [["draft", "console.drafts"], ["reminder", "console.reminders"], ["waiting", "console.waiting"]]) {
    const list = plan.decisions.filter((x) => x.action === action);
    if (!list.length) continue;
    if (action !== "draft") console.log("");
    console.log(src.t(ui, heading, { count: list.length }));
    for (const d of list) {
      const flag = d.flags.includes("flag.needs_rep") ? "  [" + src.t(ui, "flag.needs_rep_short") + "]" : "";
      console.log(`  ${String(d.row).padStart(2)}  ${d.lang.toUpperCase()}  ${d.draft.to.padEnd(30)}  ` +
        `${src.t(ui, "template." + d.template).padEnd(27)}  ${src.sendAfterText(d, ui)}${flag}`);
    }
  }

  // Outputs.
  const outDir = path.resolve(ROOT, args.out);
  const outName = path.relative(ROOT, outDir).split(path.sep).join("/") + "/";
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  const write = (name, text) => {
    fs.writeFileSync(path.join(outDir, name), text, "utf-8");
    written.push(outName + name);
  };
  write("queue.csv", toCsv(src.queueTable(plan.decisions, ui)));
  const runLabel = src.t(ui, "console.now", { now: nowText });
  write("drafts.html", draftsHtml({ src, plan, ui, runLabel, summary }));
  // What the Leads tab would look like after the run (Touches, Last drafted,
  // Next due, Reminder drafted), and the Suppression tab.
  write("leads_after_run.csv", toCsv(src.applyUpdates(table, plan.decisions, plan.lang)));
  const suppressionHeader = src.SUPPRESSION_COLUMNS.map((key) => src.t(ui, "header." + key));
  write("suppression.csv", toCsv([suppressionHeader].concat(src.suppressionRows(plan.suppression.added, ui))));
  console.log("");
  console.log(src.t(ui, "console.files"));
  written.forEach((f) => console.log("  " + f));
}

try {
  main();
} catch (err) {
  // A clear one-line message instead of a stack trace.
  console.error("Error: " + err.message);
  process.exit(1);
}
