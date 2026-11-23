// Every text the tool shows to the sales team, in English and Spanish, in one
// place. (Messages to leads are in templates.js.) Spanish: neutral Latin
// American, "tú". Keys are the same in both languages (a test checks this).
// "{name}" placeholders are filled by t() in lang.js.

var STRINGS = {
  en: {
    "header.first_name": "First name", "header.company": "Company", "header.email": "Email",
    "header.phone": "Phone", "header.language": "Language", "header.time_zone": "Time zone",
    "header.interest": "Interest", "header.rep_name": "Rep name", "header.requested_on": "Requested on",
    "header.status": "Status", "header.opt_out": "Opt-out", "header.touches": "Touches",
    "header.last_drafted": "Last drafted", "header.next_due": "Next due",
    "header.appointment": "Appointment", "header.reminder_drafted": "Reminder drafted",
    "header.notes": "Notes", "header.last_reply": "Last reply",
    "header.reason": "Reason", "header.added_on": "Added on",

    "status.new": "New", "status.contacted": "Contacted", "status.replied": "Replied",
    "status.booked": "Booked", "status.closed": "Closed", "status.do_not_contact": "Do not contact",

    "field.first_name": "first name", "field.company": "company", "field.rep_name": "rep name",
    "field.booking_link": "booking link", "field.appointment_time": "appointment time", "field.email": "email",
    "field.requested_on": "request date", "field.last_drafted": "last drafted date",

    "category.account_access": "account access", "category.card_lost_stolen": "card lost or stolen",
    "category.charge_dispute": "charge dispute or fraud", "category.transfer_failed_pending": "failed or pending transfer",

    "action.draft": "Drafted", "action.reminder": "Reminder drafted", "action.hold": "Held",
    "action.opted_out": "Opted out", "action.support": "Route to support",
    "action.needs_person": "Reply needs a person", "action.not_due": "Not due yet", "action.stopped": "Stopped",
    "action.waiting": "Waiting for local hours",

    "template.touch1": "Follow-up 1", "template.touch2": "Follow-up 2", "template.touch3": "Final follow-up",
    "template.needs_rep": "Questions: defer to a call", "template.reminder": "Appointment reminder",

    "held.missing_tz": "missing time zone", "held.invalid_tz": "invalid time zone \"{tz}\"",
    "held.invalid_tz_short": "invalid time zone",
    "held.status": 'check status "{status}"', "held.status_short": "check status",
    "held.gmail_error": "Gmail could not create the draft ({error}); it will be tried again next run",
    "held.missing_value": "missing {field}", "held.invalid_value": "check {field}",
    "held.missing_appointment": "Booked, but no valid appointment date and time",
    "optout.status": "Status is Do not contact", "optout.column": "Opt-out column is yes",
    "optout.reply": "last reply says \"{phrase}\"", "optout.notes": 'notes say "{phrase}"', "optout.suppressed": "email or phone is on the suppression list",
    "support.route": "looks like a support case ({category}), not a sales lead",
    "needs_person.replied": "the lead replied: a person answers, no automatic follow-up",
    "needs_person.reply": "there is a reply: a person reads it and answers (clear Last reply to resume follow-ups)",
    "not_due.touch": "next follow-up due {date}", "not_due.reminder": "reminder due {date}",
    "not_due.today": "already drafted today", "not_due.reminder_done": "reminder already drafted",
    "stopped.closed": "Status is Closed", "stopped.finished": "sequence finished ({count} follow-ups drafted)",
    "stopped.past": "appointment time has passed",

    "flag.needs_rep": "Needs rep: pricing or approval question. Check before sending.",
    "flag.needs_rep_short": "needs rep",
    "flag.guessed": "Language guessed from notes and reply.",
    "flag.check": "Check language: none given, English used.",

    "send.now": "now: {time}", "send.next": "next window: {time}",
    "send.waits": "not drafted yet: waits until {time}", "time.zone_label": "{city} time",

    "summary.line": "Drafts ready: {drafts} · Appointment reminders: {reminders} · Waiting for local hours: {waiting} · " +
      "Held: {held}{held_detail} · Opted out: {opted_out} · Routed to support: {support}",
    "summary.line2": "Reply needs a person: {needs_person} · Not due yet: {not_due} · Stopped: {stopped}",
    "summary.title": "Follow-up summary for {date}",
    "summary.count": "Count",

    "console.banner": "Puentara lead follow-up (Puentara is a fictional company; all data is synthetic sample data)",
    "console.dry_run": "Drafts only: nothing is sent.",
    "console.now": "Run time: {now} UTC",
    "console.drafts": "Drafts ready ({count}), each in the lead's language:",
    "console.reminders": "Appointment reminders ({count}):",
    "console.waiting": "Waiting for the lead's local hours ({count}), not drafted yet:",
    "error.bad_now": "--now must be a real date and time in UTC, like \"2026-11-24 15:00\", not \"{value}\".",
    "console.files": "Files written:",

    "queue.row": "Row", "queue.action": "Action", "queue.reason": "Reason", "queue.template": "Template",
    "queue.draft_language": "Draft language", "queue.send_after": "Send after (lead's local time)",
    "queue.subject": "Subject", "queue.notes": "Notes (masked)", "queue.flags": "Flags",

    "html.title": "Puentara follow-up drafts",
    "html.banner": "DRAFT — not sent",
    "html.fictional": "Puentara is a fictional company. All leads are synthetic sample data.",
    "html.to": "To", "html.drafts": "Drafts ready ({count})",
    "html.reminders": "Appointment reminders ({count})", "html.waiting": "Waiting for local hours ({count}): not drafted yet",
    "html.waiting_banner": "NOT DRAFTED YET — waits for the lead's local hours", "html.not_drafted": "Not drafted, and why",
    "html.lead": "Lead", "html.what": "What happened", "html.why": "Why",

    "tab.leads": "Leads", "tab.config": "Config", "tab.queue": "Queue", "tab.preview": "Draft preview",
    "tab.summary": "Summary", "tab.suppression": "Suppression",
    "menu.title": "Lead follow-up", "menu.setup": "Set up tabs", "menu.run": "Prepare today's drafts",
    "menu.sample": "Load sample data", "menu.trigger": "Run every hour",

    "done.setup": "Tabs are ready. Add leads to the {tab} tab, then use Prepare today's drafts.",
    "done.preview": "DRY RUN: {count} draft(s) ready and {waiting} waiting for the lead's local hours, in the {tab} tab. Nothing was created in Gmail.",
    "done.drafted": "{count} Gmail draft(s) created; {waiting} waiting for the lead's local hours (a later run drafts them). Nothing was sent: review them in Gmail Drafts.",
    "done.sample": "Sample leads loaded (synthetic data; Puentara is fictional).",
    "done.trigger": "Hourly run installed. Each run only drafts what is due and inside each lead's local hours.",

    "error.missing_columns": "The Leads tab is missing these columns: {columns}. Add them to the header row.",
    "error.no_leads_tab": "No Leads tab found. Use the menu item Set up tabs first.",
    "error.busy": "Another run is in progress. Wait a minute and try again.",
    "error.sample_not_empty": "The Leads tab already has leads. Load sample data into a new, empty sheet instead.",
    "error.gmail": "{created} draft(s) created, {failed} failed in Gmail (see the Queue tab). Run again later to retry them.",
    "error.lint": "Templates failed the safety check, so nothing was drafted: {problems}",
  },
  es: {
    "header.first_name": "Nombre", "header.company": "Empresa", "header.email": "Correo",
    "header.phone": "Teléfono", "header.language": "Idioma", "header.time_zone": "Zona horaria",
    "header.interest": "Interés", "header.rep_name": "Asesor", "header.requested_on": "Solicitado el",
    "header.status": "Estado", "header.opt_out": "Baja", "header.touches": "Contactos",
    "header.last_drafted": "Último borrador", "header.next_due": "Próximo seguimiento",
    "header.appointment": "Cita", "header.reminder_drafted": "Recordatorio creado",
    "header.notes": "Notas", "header.last_reply": "Última respuesta",
    "header.reason": "Motivo", "header.added_on": "Agregado el",

    "status.new": "Nuevo", "status.contacted": "Contactado", "status.replied": "Respondió",
    "status.booked": "Agendado", "status.closed": "Cerrado", "status.do_not_contact": "No contactar",

    "field.first_name": "nombre", "field.company": "empresa", "field.rep_name": "nombre del asesor",
    "field.booking_link": "enlace para agendar", "field.appointment_time": "hora de la cita", "field.email": "correo",
    "field.requested_on": "fecha de solicitud", "field.last_drafted": "fecha del último borrador",

    "category.account_access": "acceso a la cuenta", "category.card_lost_stolen": "tarjeta perdida o robada",
    "category.charge_dispute": "disputa de cobro o fraude", "category.transfer_failed_pending": "transferencia fallida o pendiente",

    "action.draft": "Borrador creado", "action.reminder": "Recordatorio creado", "action.hold": "En espera",
    "action.opted_out": "Dado de baja", "action.support": "Pasar a soporte",
    "action.needs_person": "La respuesta necesita a una persona", "action.not_due": "Aún no toca",
    "action.stopped": "Detenido", "action.waiting": "Espera el horario local",

    "template.touch1": "Seguimiento 1", "template.touch2": "Seguimiento 2", "template.touch3": "Último seguimiento",
    "template.needs_rep": "Preguntas: dejarlas para la llamada", "template.reminder": "Recordatorio de cita",

    "held.missing_tz": "falta zona horaria", "held.invalid_tz": "zona horaria no válida \"{tz}\"",
    "held.invalid_tz_short": "zona horaria no válida",
    "held.status": 'revisa el estado "{status}"', "held.status_short": "revisa el estado",
    "held.gmail_error": "Gmail no pudo crear el borrador ({error}); se intentará de nuevo en la próxima ejecución",
    "held.missing_value": "falta {field}", "held.invalid_value": "revisar {field}",
    "held.missing_appointment": "Agendado, pero sin fecha y hora de cita válidas",
    "optout.status": "el estado es No contactar", "optout.column": "la columna Baja dice sí",
    "optout.reply": "la última respuesta dice \"{phrase}\"", "optout.notes": 'las notas dicen "{phrase}"',
    "optout.suppressed": "el correo o el teléfono está en la lista de supresión",
    "support.route": "parece un caso de soporte ({category}), no un prospecto de ventas",
    "needs_person.replied": "el prospecto respondió: contesta una persona, sin seguimiento automático",
    "needs_person.reply": "hay una respuesta: una persona la lee y contesta (borra Última respuesta para retomar el seguimiento)",
    "not_due.touch": "próximo seguimiento el {date}", "not_due.reminder": "recordatorio el {date}",
    "not_due.today": "ya se creó un borrador hoy", "not_due.reminder_done": "el recordatorio ya se creó",
    "stopped.closed": "el estado es Cerrado", "stopped.finished": "secuencia terminada ({count} seguimientos creados)",
    "stopped.past": "la hora de la cita ya pasó",

    "flag.needs_rep": "Necesita al asesor: pregunta sobre precio o aprobación. Revísalo antes de enviar.",
    "flag.needs_rep_short": "necesita al asesor",
    "flag.guessed": "Idioma detectado a partir de las notas y la respuesta.",
    "flag.check": "Revisa el idioma: no se indicó y se usó inglés.",

    "send.now": "ahora: {time}", "send.next": "próxima franja: {time}",
    "send.waits": "aún sin borrador: espera hasta {time}", "time.zone_label": "hora de {city}",

    "summary.line": "Borradores listos: {drafts} · Recordatorios de cita: {reminders} · Esperan el horario local: {waiting} · " +
      "En espera: {held}{held_detail} · Dados de baja: {opted_out} · Pasados a soporte: {support}",
    "summary.line2": "Respuestas que necesitan a una persona: {needs_person} · Aún no toca: {not_due} · Detenidos: {stopped}",
    "summary.title": "Resumen de seguimiento del {date}",
    "summary.count": "Cantidad",

    "console.banner": "Seguimiento de prospectos de Puentara (Puentara es una empresa ficticia; todos los datos son de muestra, sintéticos)",
    "console.dry_run": "Solo borradores: no se envía nada.",
    "console.now": "Hora de ejecución: {now} UTC",
    "console.drafts": "Borradores listos ({count}), cada uno en el idioma del prospecto:",
    "console.reminders": "Recordatorios de cita ({count}):",
    "console.waiting": "Esperan el horario local del prospecto ({count}), aún sin borrador:",
    "error.bad_now": "--now debe ser una fecha y hora reales en UTC, como \"2026-11-24 15:00\", no \"{value}\".",
    "console.files": "Archivos creados:",

    "queue.row": "Fila", "queue.action": "Acción", "queue.reason": "Motivo", "queue.template": "Plantilla",
    "queue.draft_language": "Idioma del borrador", "queue.send_after": "Enviar después de (hora local del prospecto)",
    "queue.subject": "Asunto", "queue.notes": "Notas (enmascaradas)", "queue.flags": "Avisos",

    "html.title": "Borradores de seguimiento de Puentara",
    "html.banner": "BORRADOR — no enviado",
    "html.fictional": "Puentara es una empresa ficticia. Todos los prospectos son datos de muestra sintéticos.",
    "html.to": "Para", "html.drafts": "Borradores listos ({count})",
    "html.reminders": "Recordatorios de cita ({count})", "html.waiting": "Esperan el horario local ({count}): aún sin borrador",
    "html.waiting_banner": "AÚN SIN BORRADOR — espera el horario local del prospecto", "html.not_drafted": "Sin borrador, y por qué",
    "html.lead": "Prospecto", "html.what": "Qué pasó", "html.why": "Por qué",

    "tab.leads": "Prospectos", "tab.config": "Configuración", "tab.queue": "Cola",
    "tab.preview": "Vista previa de borradores", "tab.summary": "Resumen", "tab.suppression": "Supresión",
    "menu.title": "Seguimiento de prospectos", "menu.setup": "Crear pestañas",
    "menu.run": "Preparar borradores de hoy", "menu.sample": "Cargar datos de muestra",
    "menu.trigger": "Ejecutar cada hora",

    "done.setup": "Las pestañas están listas. Agrega prospectos en la pestaña {tab} y luego usa Preparar borradores de hoy.",
    "done.preview": "MODO DE PRUEBA: {count} borrador(es) listos y {waiting} esperan el horario local del prospecto, en la pestaña {tab}. No se creó nada en Gmail.",
    "done.drafted": "Se crearon {count} borrador(es) en Gmail; {waiting} esperan el horario local del prospecto (una ejecución posterior los crea). No se envió nada: revísalos en Borradores de Gmail.",
    "done.sample": "Prospectos de muestra cargados (datos sintéticos; Puentara es ficticia).",
    "done.trigger": "Ejecución cada hora instalada. Cada ejecución solo crea lo que toca y dentro del horario local de cada prospecto.",

    "error.missing_columns": "A la pestaña Prospectos le faltan estas columnas: {columns}. Agrégalas en la fila de encabezados.",
    "error.no_leads_tab": "No se encontró la pestaña Prospectos. Primero usa la opción Crear pestañas del menú.",
    "error.busy": "Hay otra ejecución en curso. Espera un minuto e inténtalo de nuevo.",
    "error.sample_not_empty": "La pestaña Prospectos ya tiene prospectos. Carga los datos de muestra en una hoja nueva y vacía.",
    "error.gmail": "Se crearon {created} borrador(es) y fallaron {failed} en Gmail (revisa la pestaña Cola). Vuelve a ejecutar más tarde para reintentarlos.",
    "error.lint": "Las plantillas no pasaron la revisión de seguridad, así que no se creó ningún borrador: {problems}",
  },
};
