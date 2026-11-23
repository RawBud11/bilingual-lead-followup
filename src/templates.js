// Follow-up and reminder templates in English and Spanish, the placeholder
// filler, and the template lint that blocks risky wording.
//
// Puentara is a fictional demo company. These are draft texts for the owner
// to rewrite in their own words. Spanish: neutral Latin American, "tú".
//
// Placeholders: {{first_name}} {{company}} {{rep_name}} {{booking_link}},
// plus {{appointment_time}} in the reminder only. Lead notes are never a
// placeholder: whatever a lead or rep typed stays out of the message.

var TEMPLATES = {
  en: {
    touch1: {
      subject: "Your Puentara demo, {{first_name}}",
      body: "Hi {{first_name}},\n\n" +
        "Thanks for asking for a Puentara demo for {{company}}. I'd be glad to show you how " +
        "invoicing and getting paid work in the app.\n\n" +
        "You can pick a time that suits you here: {{booking_link}}\n\n" +
        "If now isn't a good time, just tell me and I won't follow up again.\n\n" +
        "Best,\n{{rep_name}}\nPuentara",
    },
    touch2: {
      subject: "Following up on your Puentara demo",
      body: "Hi {{first_name}},\n\n" +
        "I'm following up on your demo request for {{company}}. A 20-minute call is usually " +
        "enough to see whether Puentara fits the way you invoice clients and get paid.\n\n" +
        "Here's my calendar: {{booking_link}}\n\n" +
        "If now isn't a good time, just tell me and I won't follow up again.\n\n" +
        "Best,\n{{rep_name}}\nPuentara",
    },
    touch3: {
      subject: "Should I close your demo request?",
      body: "Hi {{first_name}},\n\n" +
        "I haven't heard back, so I'll close your demo request for {{company}} for now. " +
        "This is my last follow-up.\n\n" +
        "If you'd like a walkthrough later, you can book a time whenever it suits you: {{booking_link}}\n\n" +
        "Thanks,\n{{rep_name}}\nPuentara",
    },
    needs_rep: {
      subject: "Your questions about Puentara",
      body: "Hi {{first_name}},\n\n" +
        "Thanks for your questions about Puentara for {{company}}. The answer depends on how " +
        "your team would use the app, so I'd rather go over it with you on a short call than " +
        "guess in an email.\n\n" +
        "Pick a time here and we'll go through it together: {{booking_link}}\n\n" +
        "Best,\n{{rep_name}}\nPuentara",
    },
    reminder: {
      subject: "Reminder: your Puentara demo",
      body: "Hi {{first_name}},\n\n" +
        "Just a reminder of your Puentara demo for {{company}}: {{appointment_time}}.\n\n" +
        "If that time no longer works, you can choose a new one here: {{booking_link}}\n\n" +
        "See you then,\n{{rep_name}}\nPuentara",
    },
  },
  es: {
    touch1: {
      subject: "Tu demo de Puentara, {{first_name}}",
      body: "Hola, {{first_name}}:\n\n" +
        "Gracias por pedir una demo de Puentara para {{company}}. Con gusto te muestro cómo " +
        "funcionan la facturación y los cobros en la app.\n\n" +
        "Puedes elegir el horario que mejor te quede aquí: {{booking_link}}\n\n" +
        "Si no es buen momento, solo dímelo y no te vuelvo a escribir.\n\n" +
        "Saludos,\n{{rep_name}}\nPuentara",
    },
    touch2: {
      subject: "Seguimiento de tu demo de Puentara",
      body: "Hola, {{first_name}}:\n\n" +
        "Te escribo de nuevo por la demo que pediste para {{company}}. En una llamada de " +
        "20 minutos vemos si Puentara se ajusta a la forma en que facturas y recibes tus pagos.\n\n" +
        "Aquí está mi agenda: {{booking_link}}\n\n" +
        "Si no es buen momento, solo dímelo y no te vuelvo a escribir.\n\n" +
        "Saludos,\n{{rep_name}}\nPuentara",
    },
    touch3: {
      subject: "¿Cierro tu solicitud de demo?",
      body: "Hola, {{first_name}}:\n\n" +
        "Como no he tenido noticias tuyas, por ahora voy a cerrar tu solicitud de demo para " +
        "{{company}}. Este es mi último mensaje.\n\n" +
        "Si más adelante quieres verla, puedes agendar cuando te quede bien: {{booking_link}}\n\n" +
        "Gracias,\n{{rep_name}}\nPuentara",
    },
    needs_rep: {
      subject: "Tus preguntas sobre Puentara",
      body: "Hola, {{first_name}}:\n\n" +
        "Gracias por tus preguntas sobre Puentara para {{company}}. La respuesta depende de " +
        "cómo usaría la app tu equipo, así que prefiero revisarlo contigo en una llamada corta " +
        "en vez de adivinar por correo.\n\n" +
        "Elige un horario aquí y lo vemos juntos: {{booking_link}}\n\n" +
        "Saludos,\n{{rep_name}}\nPuentara",
    },
    reminder: {
      subject: "Recordatorio: tu demo de Puentara",
      body: "Hola, {{first_name}}:\n\n" +
        "Te recuerdo tu demo de Puentara para {{company}}: {{appointment_time}}.\n\n" +
        "Si ya no te queda bien ese horario, puedes elegir otro aquí: {{booking_link}}\n\n" +
        "Nos vemos,\n{{rep_name}}\nPuentara",
    },
  },
};

var ALLOWED_PLACEHOLDERS = ["first_name", "company", "rep_name", "booking_link", "appointment_time"];

// Wording no template may contain, checked on folded text as whole words.
// Promises about money, approvals or outcomes; legal/tax/investment advice;
// requests for data a customer must never send by email.
var BANNED_PHRASES = {
  promise: ["guaranteed", "approved", "pre-approved", "preapproved", "no fees", "lowest",
    "you will save", "risk-free", "risk free",
    "garantizado", "garantizada", "aprobado", "aprobada", "preaprobado", "preaprobada",
    "sin comisiones", "el más bajo", "la más baja", "ahorrarás", "sin riesgo", "aseguramos", "asegurado",
    "asegurada"],
  advice: ["tax deductible", "tax-deductible", "deducible de impuestos", "you should invest",
    "deberías invertir", "legal advice", "asesoría legal"],
  sensitive: ["card number", "pin", "cvv", "cvc", "password", "one-time code", "verification code",
    "security code", "code", "card details", "account number", "ssn", "social security",
    "número de tarjeta", "datos de tu tarjeta", "número de cuenta", "contraseña", "código", "clave"],
};

// Spanish words often typed without their accent. A template with one of
// these is a typo the client would notice. ("como" and "esta" are left out:
// both are correct without an accent in some sentences.)
var MISSING_ACCENT_WORDS = ["manana", "reunion", "tambien", "aqui", "facil", "rapido",
  "proximo", "despues", "informacion", "facturacion", "dias", "podras", "dimelo",
  "ultimo", "mas", "llamame", "telefono", "solicitud de reunion"];

function placeholdersIn(text) {
  var found = {};
  String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, function (whole, name) { found[name] = true; return whole; });
  return Object.keys(found).sort();
}

// Problems with a set of templates, as plain sentences ([] = all good).
// Used by the tests (the build fails on any problem) and before every run.
function lintTemplates(templates) {
  var problems = [];
  var keys = Object.keys(templates.en || {});
  ["en", "es"].forEach(function (lang) {
    var set = templates[lang] || {};
    var mine = Object.keys(set);
    keys.concat(mine).forEach(function (key) {
      if (!set[key]) problems.push(lang + "." + key + ": missing (every template needs EN and ES)");
    });
    mine.forEach(function (key) {
      ["subject", "body"].forEach(function (part) {
        var text = set[key][part] || "";
        var where = lang + "." + key + "." + part;
        if (!text.trim()) problems.push(where + ": empty");
        var folded = foldText(text);
        Object.keys(BANNED_PHRASES).forEach(function (kind) {
          BANNED_PHRASES[kind].forEach(function (phrase) {
            if (containsPhrase(folded, phrase)) problems.push(where + ': banned ' + kind + ' wording "' + phrase + '"');
          });
        });
        placeholdersIn(text).forEach(function (name) {
          if (ALLOWED_PLACEHOLDERS.indexOf(name) === -1) problems.push(where + ": unknown placeholder {{" + name + "}}");
        });
        if (lang === "es") {
          var lower = text.toLowerCase();
          MISSING_ACCENT_WORDS.forEach(function (word) {
            var re = new RegExp("(^|[^a-záéíóúñü])" + word +"($|[^a-záéíóúñü])");
            if (re.test(lower)) problems.push(where + ': "' + word + '" is missing its accent');
          });
        }
      });
      var other = lang === "en" ? templates.es : templates.en;
      if (lang === "en" && other && other[key]) {
        var a = placeholdersIn(set[key].subject + set[key].body).join(",");
        var b = placeholdersIn(other[key].subject + other[key].body).join(",");
        if (a !== b) problems.push(key + ": EN uses {{" + a + "}} but ES uses {{" + b + "}}");
      }
    });
  });
  return problems;
}

// A placeholder value is unusable when empty or when it looks like it would
// break the message (another placeholder, HTML, an email in a name field).
function placeholderProblem(name, value) {
  var v = String(value == null ? "" : value).trim();
  if (!v) return "missing";
  if (/[{}<>]/.test(v)) return "invalid";
  if (name === "booking_link") return /^https:\/\/\S+$/.test(v) ? "" : "invalid";
  if (name === "appointment_time") return ""; // built by formatAppointment, not typed
  // A link or web address in a name field would put a URL in the message.
  if (v.indexOf("://") !== -1 || /^www\./i.test(v)) return "invalid";
  if (/@/.test(v) || v.length > 60) return "invalid";
  if (name === "first_name" && /\d/.test(v)) return "invalid";
  return "";
}

// Fill a template. Returns { subject, body, problems: [{ key, vars }] }.
// Any problem means: do not draft, hold the lead. The output can never
// contain a raw "{{first_name}}".
function fillTemplate(lang, key, values) {
  var tpl = TEMPLATES[lang][key];
  var problems = [];
  placeholdersIn(tpl.subject + tpl.body).forEach(function (name) {
    var problem = placeholderProblem(name, values[name]);
    if (problem) problems.push({ key: "held." + problem + "_value", vars: { field: name } });
  });
  function fill(text) {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, function (whole, name) { return String(values[name]).trim(); });
  }
  if (problems.length) return { subject: "", body: "", problems: problems };
  return { subject: fill(tpl.subject), body: fill(tpl.body), problems: [] };
}
