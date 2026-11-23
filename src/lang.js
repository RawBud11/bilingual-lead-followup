// Language helpers: detect a lead's language, look up UI strings, fold text.
//
// Copied from bilingual-sla-tracker (src/language.js and the t / tCount /
// foldText helpers in src/strings.js), not imported across repos. The
// detector word lists are the same; a few sales words were added
// (demo, invoice, factura, precio...).
//
// Why a word count and not a library: it runs unchanged in Apps Script and
// Node, and the owner can explain every rule. It is only used when the
// Language column is empty, and the queue then says "language guessed".

var EN_WORDS = toWordSet(
  "the and is are was were my i you your it its to of in for on with this that " +
  "have has had not cant can't dont don't didnt didn't doesnt doesn't wont won't " +
  "why what how when where do does did be been please thanks thank help hi hello " +
  "card account money charge charged payment transfer still yet never again from " +
  "at but there they we will would can get got know just an if or so after since " +
  "also need want which any all some it's im i'm sent pending login password " +
  "demo invoice invoices invoicing clients team see works work like looking");

var ES_WORDS = toWordSet(
  "el la los las del que y en un una es mi mis por para con se lo le su al pero " +
  "como cuando donde porque ya sin hay yo tu tengo puedo quiero necesito ayuda " +
  "tarjeta cuenta dinero cobro cargo pago transferencia gracias hola favor sigue " +
  "desde todavia nunca otra vez esta este estoy son fue muy mas hace dice pasa " +
  "dias cuanto cual tienen llega llego robaron perdi contrasena hicieron pedi " +
  "factura facturas facturar clientes equipo ver precio cuesta usando alguien");

var SPANISH_MARKS = "áéíóúñ¿¡";

function toWordSet(words) {
  var set = {};
  words.split(/\s+/).forEach(function (w) { if (w) set[w] = true; });
  return set;
}

// [englishScore, spanishScore] for a piece of text.
function languageScores(text) {
  var words = foldText(text).match(/[a-z']+/g) || [];
  var en = 0, es = 0;
  words.forEach(function (w) {
    if (EN_WORDS[w] === true) en++;
    if (ES_WORDS[w] === true) es++;
  });
  String(text || "").toLowerCase().split(/\s+/).forEach(function (w) {
    for (var i = 0; i < w.length; i++) {
      if (SPANISH_MARKS.indexOf(w[i]) !== -1) { es++; return; }
    }
  });
  return [en, es];
}

// "en", "es", "mixed" or "other".
function detectLanguage(text) {
  var scores = languageScores(text);
  var en = scores[0], es = scores[1];
  if (en === 0 && es === 0) return "other";
  if (Math.min(en, es) >= 2 && Math.min(en, es) / Math.max(en, es) >= 0.5) return "mixed";
  if (en === es) return "mixed";
  return en > es ? "en" : "es";
}

// Language for a lead's messages. The Language column wins. If it is empty,
// guess from notes + last reply ("guessed"). If there is nothing to go on,
// English, marked "check" so a person looks at it.
// Returns { lang: "en"|"es", note: ""|"guessed"|"check" }.
function leadLanguage(column, notes, lastReply) {
  var value = foldText(column);
  if (["en", "english", "ingles"].indexOf(value) !== -1) return { lang: "en", note: "" };
  if (["es", "spanish", "espanol"].indexOf(value) !== -1) return { lang: "es", note: "" };
  var guess = detectLanguage(String(notes || "") + " " + String(lastReply || ""));
  if (guess === "en" || guess === "es") return { lang: guess, note: "guessed" };
  return { lang: "en", note: "check" };
}

// UI string in `lang`, with "{name}" placeholders filled from vars.
function t(lang, key, vars) {
  var table = STRINGS[lang] || STRINGS.en;
  var text = key in table ? table[key] : key;
  return text.replace(/\{(\w+)\}/g, function (whole, name) {
    return vars && name in vars ? String(vars[name]) : whole;
  });
}

// Singular or plural form: tCount("en", "x", 3) uses "x_other".
function tCount(lang, key, count, vars) {
  var all = Object.assign({ count: count }, vars || {});
  return t(lang, key + (count === 1 ? "_one" : "_other"), all);
}

// Lowercase, no accents, curly apostrophes made straight, single spaces:
// "No me escriban MÁS" and "no me escriban mas" match.
function foldText(text) {
  return String(text == null ? "" : text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’´`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Find the id behind a cell value: "No contactar", "do not contact" and
// "do_not_contact" all give "do_not_contact". "" when nothing matches.
function idFromLabel(kind, value, ids, extra) {
  var folded = foldText(value);
  if (!folded) return "";
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var names = [id, id.replace(/_/g, " "), STRINGS.en[kind + "." + id], STRINGS.es[kind + "." + id]]
      .concat((extra && extra[id]) || []);
    for (var j = 0; j < names.length; j++) {
      if (foldText(names[j]) === folded) return id;
    }
  }
  return "";
}
