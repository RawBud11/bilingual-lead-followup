// output/drafts.html for the local demo: drafts ready, appointment reminders,
// leads waiting for their local hours (not drafted yet, shown in a warning
// style), and a "Not drafted, and why" table. Labels follow --lang; each
// draft is in its lead's language. Notes are shown masked. Nothing is sent.

function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
body { font-family: Segoe UI, Arial, sans-serif; margin: 24px auto; max-width: 980px; color: #1f2933; background: #f5f7fa; }
h1 { font-size: 22px; margin-bottom: 4px; }
.meta { color: #52606d; margin: 2px 0; }
.summary { background: #fff; border: 1px solid #d9e2ec; border-radius: 6px; padding: 10px 14px; margin: 14px 0; }
.card { background: #fff; border: 1px solid #d9e2ec; border-radius: 6px; margin: 14px 0; overflow: hidden; }
.banner { background: #fff3c4; color: #8d2b0b; font-weight: 600; padding: 6px 14px; border-bottom: 1px solid #f0b429; }
.card.waiting { border: 2px dashed #c75000; background: #fffaf5; }
.card.waiting .banner { background: #ffe0c2; color: #7a2e00; border-bottom: 1px dashed #c75000; }
.card.waiting pre { opacity: 0.75; }
.fields { padding: 8px 14px 0; }
.fields div { margin: 2px 0; }
.label { color: #52606d; display: inline-block; min-width: 240px; }
.wait { color: #7a2e00; font-weight: 600; }
pre { white-space: pre-wrap; font-family: inherit; margin: 10px 14px 12px; padding: 10px; background: #f8fafc; border-left: 3px solid #9fb3c8; }
.flag { color: #8d2b0b; }
.notes { color: #52606d; font-size: 13px; padding: 0 14px 10px; }
table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
th, td { border: 1px solid #d9e2ec; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #e4e7eb; }
`;

function card(src, d, ui, t) {
  const waiting = d.action === "waiting";
  const flags = d.flags.map((key) => `<div class="flag">${esc(t(key))}</div>`).join("");
  const notes = src.maskedNotes(d.lead);
  const sendAfter = waiting
    ? `<span class="wait">${esc(src.sendAfterText(d, ui, "send.waits"))}</span>`
    : esc(src.sendAfterText(d, ui));
  return `<div class="card${waiting ? " waiting" : ""}">
  <div class="banner">${esc(t(waiting ? "html.waiting_banner" : "html.banner"))}</div>
  <div class="fields">
    <div><span class="label">${esc(t("queue.row"))}</span>${d.row} · ${esc(t("template." + d.template))} · ${d.lang.toUpperCase()}</div>
    <div><span class="label">${esc(t("html.to"))}</span>${esc(d.draft.to)}</div>
    <div><span class="label">${esc(t("queue.subject"))}</span><strong>${esc(d.draft.subject)}</strong></div>
    <div><span class="label">${esc(t("queue.send_after"))}</span>${sendAfter}</div>
    ${flags}
  </div>
  <pre>${esc(d.draft.body)}</pre>
  ${notes ? `<div class="notes">${esc(t("queue.notes"))}: ${esc(notes)}</div>` : ""}
</div>`;
}

export function draftsHtml({ src, plan, ui, runLabel, summary }) {
  const t = (key, vars) => src.t(ui, key, vars);
  const pick = (action) => plan.decisions.filter((d) => d.action === action);
  const groups = [["html.drafts", pick("draft")], ["html.reminders", pick("reminder")], ["html.waiting", pick("waiting")]];
  const sections = groups.filter(([, list]) => list.length).map(([key, list]) =>
    `<h2>${esc(t(key, { count: list.length }))}</h2>\n` + list.map((d) => card(src, d, ui, t)).join("\n")).join("\n");
  const others = plan.decisions.filter((d) => !d.draft);
  const rows = others.map((d) => `<tr><td>${d.row}</td><td>${esc(d.lead.first_name || "—")}<br>${esc(d.lead.email)}</td>` +
    `<td>${esc(t("action." + d.action))}</td><td>${esc(src.allReasons(d, ui))}</td>` +
    `<td>${esc(src.maskedNotes(d.lead))}</td></tr>`).join("\n");
  return `<!DOCTYPE html>
<html lang="${ui}">
<head>
<meta charset="utf-8">
<title>${esc(t("html.title"))}</title>
<style>${CSS}</style>
</head>
<body>
<h1>${esc(t("html.title"))}</h1>
<p class="meta">${esc(t("html.fictional"))}</p>
<p class="meta">${esc(runLabel)} · ${esc(t("console.dry_run"))}</p>
<div class="summary">${summary.map(esc).join("<br>")}</div>
${sections}
<h2>${esc(t("html.not_drafted"))} (${others.length})</h2>
<table>
<tr><th>${esc(t("queue.row"))}</th><th>${esc(t("html.lead"))}</th><th>${esc(t("html.what"))}</th><th>${esc(t("html.why"))}</th><th>${esc(t("queue.notes"))}</th></tr>
${rows}
</table>
</body>
</html>
`;
}
