// Make the synthetic demo data:
//   data/leads.csv           ~30 demo-request leads for Puentara (fictional)
//   data/optout_labeled.csv  40 labeled EN/ES replies for `npm run eval`
//   node scripts/seed.js [--seed 8] [--out data]
// Same seed, same files, byte for byte (a test checks this).
// All data is synthetic: names from short lists, emails @example.com,
// phones +1-555-01XX (reserved for fiction). Puentara is a fictional company.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../tests/load.js";
import { toCsv } from "./csv.js";
import { REPLIES } from "./replies.js";

const HEADER = ["First name", "Company", "Email", "Phone", "Language", "Time zone", "Interest",
  "Rep name", "Requested on", "Status", "Opt-out", "Touches", "Last drafted", "Next due",
  "Appointment", "Reminder drafted", "Notes", "Last reply"];

const NAMES = {
  en: [["Jordan", "Blake"], ["Avery", "Collins"], ["Riley", "Parker"], ["Morgan", "Hayes"],
    ["Casey", "Turner"], ["Taylor", "Brooks"], ["Jamie", "Foster"], ["Quinn", "Ellis"],
    ["Drew", "Morgan"], ["Skyler", "Reed"], ["Harper", "Lane"], ["Rowan", "Price"],
    ["Emerson", "Cole"], ["Reese", "Walker"], ["Sage", "Bennett"], ["Parker", "Gray"],
    ["Hayden", "Shaw"], ["Logan", "Wells"], ["Peyton", "Ford"], ["Cameron", "Holt"]],
  es: [["Lucía", "Ramírez"], ["Mateo", "Gómez"], ["Valentina", "Díaz"], ["Santiago", "Muñoz"],
    ["Camila", "Rojas"], ["Sebastián", "Herrera"], ["Isabela", "Castro"], ["Tomás", "Peña"],
    ["Mariana", "Vargas"], ["Andrés", "Ortiz"], ["Daniela", "Suárez"], ["Joaquín", "Ríos"],
    ["Gabriela", "Mendoza"], ["Emilio", "Navarro"], ["Renata", "Silva"], ["Nicolás", "Acosta"]],
};
const COMPANIES = {
  en: ["Bright Desk Studio", "North Pine Design", "Lantern Bookkeeping", "Clearpath Tutoring",
    "Blue Kettle Catering", "Oak & Ink Copywriting", "Summit Lawn Care", "Pixel Harbor Media"],
  es: ["Estudio Colibrí", "Diseño Ceiba", "Contabilidad Brisa", "Taller Arcoíris",
    "Café Montaña Eventos", "Traducciones Faro", "Jardines Sol", "Ediciones Ñandú"],
};
const ZONES = {
  en: ["America/New_York", "America/Chicago"],
  es: ["America/Bogota", "America/Mexico_City", "America/Lima"],
};
const INTERESTS = ["invoicing", "international payments", "team cards", "general"];
const REPS = ["Sam Demo", "Lucía Demo"];

// Each lead: its language, then only the fields that make it an example.
// The demo clock is Tuesday 2026-11-24 15:00 UTC (see scripts/demo.js).
const LEADS = [
  ["en", { tz: "America/New_York", requested: "2026-11-23", notes: "Wants to invoice US clients faster." }],
  ["es", { tz: "America/Bogota", requested: "2026-11-23", notes: "Quiere facturar a clientes en EE. UU." }],
  ["en", { tz: "America/Chicago", touches: 1, last: "2026-11-19", status: "Contacted" }],
  ["es", { tz: "America/Mexico_City", touches: 1, last: "2026-11-19", status: "Contacted" }],
  ["en", { tz: "America/New_York", touches: 2, last: "2026-11-13", status: "Contacted" }],
  ["es", { tz: "America/Lima", touches: 2, last: "2026-11-13", status: "Contacted" }],
  // 07:00 in Los Angeles at demo time: drafted with "send after 09:00".
  ["en", { tz: "America/Los_Angeles", requested: "2026-11-23", notes: "Design studio, 4 people." }],
  // No Language: guessed from the notes.
  ["es", { lang: "", tz: "America/Bogota", requested: "2026-11-23", notes: "Quiero ver cómo cobrar a mis clientes de afuera." }],
  // No Language and nothing to guess from: English, "check language".
  ["en", { lang: "", tz: "America/Chicago", requested: "2026-11-23", notes: "" }],
  ["en", { tz: "", requested: "2026-11-23", notes: "Met at a webinar." }],
  ["es", { tz: "Hora del Este", requested: "2026-11-23" }],
  ["en", { first: "", tz: "America/New_York", requested: "2026-11-23", notes: "Only left a company name." }],
  ["en", { tz: "America/New_York", requested: "2026-11-23", notes: "How much does it cost per invoice? Any fees for international payments?" }],
  ["es", { tz: "America/Mexico_City", requested: "2026-11-23", notes: "¿Cuánto cuesta para un equipo de 3? ¿Me aprueban rápido?" }],
  ["es", { tz: "America/Bogota", requested: "2026-11-20", notes: "Perdí mi tarjeta, alguien la está usando." }],
  ["en", { tz: "America/Chicago", touches: 1, last: "2026-11-20", status: "Replied", reply: "Sounds good, can we talk Thursday?" }],
  ["es", { tz: "America/Lima", touches: 1, last: "2026-11-20", status: "Replied", reply: "¿La app funciona en Android?" }],
  ["en", { id: "dup", tz: "America/New_York", touches: 1, last: "2026-11-19", status: "Contacted", reply: "Please remove me from your list." }],
  ["es", { tz: "America/Bogota", touches: 1, last: "2026-11-19", status: "Contacted", reply: "Por favor no me escriban más." }],
  ["es", { tz: "America/Mexico_City", touches: 1, last: "2026-11-19", status: "Contacted", reply: "Cancelar suscripción" }],
  ["es", { tz: "America/Lima", requested: "2026-11-23", status: "No contactar" }],
  ["en", { tz: "America/Chicago", requested: "2026-11-23", optOut: "Yes" }],
  // Same person as the "dup" row, entered again as a new lead.
  ["en", { sameAs: "dup", tz: "America/New_York", requested: "2026-11-23", notes: "Second form submission." }],
  ["en", { tz: "America/New_York", status: "Booked", touches: 1, last: "2026-11-19", appointment: "2026-11-25 10:00", reply: "Actually, unsubscribe me. Not interested anymore." }],
  ["en", { tz: "America/New_York", status: "Booked", touches: 1, last: "2026-11-19", appointment: "2026-11-25 10:00" }],
  ["es", { tz: "America/Bogota", status: "Booked", touches: 1, last: "2026-11-18", appointment: "2026-11-25 15:30" }],
  ["es", { tz: "America/Mexico_City", status: "Booked", touches: 2, last: "2026-11-17", appointment: "2026-11-30 11:00" }],
  ["en", { tz: "America/Chicago", status: "Closed", touches: 2, last: "2026-11-10" }],
  ["en", { tz: "America/New_York", touches: 3, last: "2026-11-12", status: "Contacted" }],
  ["es", { tz: "America/Bogota", touches: 1, last: "2026-11-23", status: "Contacted" }],
  ["en", { tz: "America/Chicago", touches: 1, last: "2026-11-24", status: "Contacted", notes: "Drafted earlier today." }],
  ["en", { tz: "America/New_York", requested: "2026-11-23", notes: "Typed card 0000 1234 5678 9012 and code 482913 into the form by mistake." }],
];

// mulberry32: a tiny seeded random generator, so the data repeats exactly.
// (Same generator as bilingual-sla-tracker/scripts/make-tickets.js.)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export function makeData(seed) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const names = { en: shuffled(NAMES.en, rand), es: shuffled(NAMES.es, rand) };
  const phones = shuffled(Array.from({ length: 100 }, (_, i) => i), rand);
  const byId = {};
  const rows = LEADS.map(([lang, spec], i) => {
    const [first, last] = names[lang].pop();
    let person = {
      first, email: `${plain(first)}.${plain(last)}@example.com`,
      phone: `+1-555-01${String(phones[i]).padStart(2, "0")}`,
    };
    if (spec.sameAs) person = byId[spec.sameAs];
    if (spec.id) byId[spec.id] = person;
    return [
      "first" in spec ? spec.first : person.first, pick(COMPANIES[lang]), person.email, person.phone,
      "lang" in spec ? spec.lang : lang.toUpperCase(), spec.tz, pick(INTERESTS), pick(REPS),
      spec.requested || "2026-11-" + String(5 + Math.floor(rand() * 5)).padStart(2, "0"),
      spec.status || "New", spec.optOut || "", spec.touches ? String(spec.touches) : "0",
      spec.last || "", "", spec.appointment || "", "", spec.notes || "", spec.reply || "",
    ];
  });
  const leads = toCsv([HEADER].concat(rows));
  const labeled = toCsv([["id", "language", "reply", "expected"]]
    .concat(REPLIES.map((r, i) => ["R" + String(i + 1).padStart(2, "0"), r[0], r[1], r[2]])));
  return { "leads.csv": leads, "optout_labeled.csv": labeled };
}

function main() {
  const args = { seed: "8", out: "data" };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    if (!(name in args) || argv[i + 1] === undefined) throw new Error(`Unknown option "${argv[i]}". Use --seed <number> --out <folder>.`);
    args[name] = argv[i + 1];
  }
  const outDir = path.resolve(ROOT, args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const files = makeData(Number(args.seed));
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), text, "utf-8");
    console.log(`Wrote ${path.join(args.out, name)} (synthetic sample data)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (err) { console.error("Error: " + err.message); process.exit(1); }
}
