// Opt-out / do-not-contact detection and the suppression list.
//
// A lead is opted out when ANY of these is true:
//   - Status is "Do not contact" / "No contactar"
//   - the Opt-out column says yes
//   - their last reply contains an opt-out phrase (lists below)
//   - their email or phone is on the Suppression tab, or belongs to another
//     row that opted out (so a duplicate row for the same person is blocked)
// Opt-out beats every other status, including Booked.
//
// The phrase lists lean toward over-blocking on purpose: "Can we stop by?"
// is flagged too. A missed opt-out costs a complaint; a false alarm costs a
// rep 10 seconds to check. `npm run eval` shows both on labeled samples.

// Phrases are matched on folded text (lowercase, no accents, punctuation as
// spaces), as whole words. This is a keyword list: it WILL miss some
// wordings. That is why every reply that is not caught here still goes to a
// person ("Reply needs a person", see followup.js), never to an automatic
// follow-up. The first items in each list are from the approved plan; the
// rest were added after review.
var OPT_OUT_PHRASES = {
  en: [
    "unsubscribe", "stop", "remove me", "don't contact me", "do not email", "not interested",
    "dont contact me", "do not contact me", "don't email", "dont email", "take me off",
    "opt out", "opt me out", "remove us", "take us off", "mailing list", "leave me alone",
    "do not contact us", "don't contact us", "dont contact us", "do not call", "don't call",
    "dont call", "no thanks",
  ],
  es: [
    "darme de baja", "dar de baja", "no me contacten", "no me escriban", "no me llamen",
    "dejen de escribirme", "no estoy interesado", "no estoy interesada", "cancelar suscripción",
    "cancelar mi suscripción", "no me interesa", "no nos escriban", "no nos contacten",
    "no nos llamen", "no me manden", "no me envíen", "no quiero recibir", "bórrenme", "borrarme",
    "bórrennos", "no, gracias",
    // Third person, as a rep writes it in Notes after a call.
    "no le escribamos", "no le escriban", "no le llamemos", "no le llamen", "no le contactemos",
    "no le contacten", "no lo contacten", "no la contacten", "no lo llamen", "no la llamen",
  ],
};

// Spanish verb forms that vary too much for a plain list:
// "sáquenme de su lista", "sacarme de la lista", "quítenme de esta lista"...
var OPT_OUT_PATTERNS = [
  /(^| )(sacar|sacarme|sacarnos|saquenme|saquennos|quitar|quitarme|quitenme|borrar|borrarnos|borrenme) de (la|su|sus|esta|tu|vuestra) lista($| )/,
];

// "Baja" on its own is a common one-word opt-out reply in Spanish. Inside a
// sentence ("¿baja el precio?") it is not, so it only counts alone.
var STANDALONE_OPT_OUT = ["baja", "stop", "unsubscribe"];

// Folded text with punctuation turned into spaces ("No, gracias." ->
// "no gracias"). Apostrophes stay, so "don't" is one word.
function plainWords(text) {
  return foldText(text).replace(/[^a-z0-9']+/g, " ").trim();
}

// Whole-phrase test. Letters, digits and apostrophes count as part of a
// word, so "stop" does not match "stopped" or "nonstop".
function containsPhrase(text, phrase) {
  var p = plainWords(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^| )" + p + "($| )").test(plainWords(text));
}

// The opt-out phrase found in a reply or a note, or "".
function optOutPhrase(reply) {
  var words = plainWords(reply);
  if (!words) return "";
  if (STANDALONE_OPT_OUT.indexOf(words) !== -1) return words;
  var all = OPT_OUT_PHRASES.en.concat(OPT_OUT_PHRASES.es);
  for (var i = 0; i < all.length; i++) {
    if (containsPhrase(words, all[i])) return all[i];
  }
  for (var j = 0; j < OPT_OUT_PATTERNS.length; j++) {
    var m = OPT_OUT_PATTERNS[j].exec(words);
    if (m) return m[0].trim();
  }
  return "";
}

function isOptOutYes(value) {
  return OPT_OUT_YES.indexOf(foldText(value)) !== -1;
}

// Why this lead's own row says "do not contact": { key, vars } or null.
function ownOptOut(lead) {
  if (lead.status === "do_not_contact") return { key: "optout.status", vars: {} };
  if (isOptOutYes(lead.opt_out)) return { key: "optout.column", vars: {} };
  var phrase = optOutPhrase(lead.last_reply);
  if (phrase) return { key: "optout.reply", vars: { phrase: phrase } };
  // Reps log phone opt-outs in Notes ("Called: said do not contact me").
  var note = optOutPhrase(lead.notes);
  if (note) return { key: "optout.notes", vars: { phrase: note } };
  return null;
}

// Digits only, so "+1-555-0142" and "1 555 0142" match. Very short numbers
// are ignored (too likely to collide).
function normalizePhone(phone) {
  var digits = String(phone == null ? "" : phone).replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

function normalizeEmail(email) {
  return String(email == null ? "" : email).trim().toLowerCase();
}

// Suppression list from the Suppression tab rows (without header) plus every
// lead that opted out in this sheet. Returns { emails: {}, phones: {}, added }
// where `added` lists the NEW entries for the tab: { email, phone, reason, date }.
function buildSuppression(leads, existingRows, today) {
  var list = { emails: {}, phones: {}, added: [] };
  (existingRows || []).forEach(function (row) {
    var email = normalizeEmail(row[0]);
    var phone = normalizePhone(row[1]);
    if (email) list.emails[email] = true;
    if (phone) list.phones[phone] = true;
  });
  leads.forEach(function (lead) {
    var why = ownOptOut(lead);
    if (!why) return;
    var email = normalizeEmail(lead.email);
    var phone = normalizePhone(lead.phone);
    var isNew = (email && !list.emails[email]) || (phone && !list.phones[phone]);
    if (email) list.emails[email] = true;
    if (phone) list.phones[phone] = true;
    if (isNew) list.added.push({ email: lead.email, phone: lead.phone, reason: why, date: today });
  });
  return list;
}

function isSuppressed(lead, list) {
  var email = normalizeEmail(lead.email);
  var phone = normalizePhone(lead.phone);
  return Boolean((email && list.emails[email]) || (phone && list.phones[phone]));
}
