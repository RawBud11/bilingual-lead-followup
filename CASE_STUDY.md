# Case study: lead follow-up drafts in English and Spanish from a Google Sheet

**Demo scenario. Puentara is a fictional company.** All leads and numbers below are synthetic sample data.

## 1. The situation

Puentara is a money app for freelancers and small businesses, with customers in the US and Latin America. People ask for a demo through a web form. A small sales team keeps those requests in a Google Sheet: name, company, email, language, time zone, status and notes. Some leads write in English, others in Spanish, and they live anywhere from Los Angeles to Lima.

## 2. The problem

Follow-ups depend on someone remembering. On a busy week, a lead who asked for a demo on Monday hears nothing until the next week, and by then they have moved on.

Each rep rewrites the same "just checking in" email in two languages, every day. The wording drifts. Sometimes it promises something sales cannot promise.

Worse mistakes happen too. Someone writes again to a person who already asked to be left alone. Someone emails a lead in Los Angeles at 6 a.m. their time. A customer who wrote "someone is using my card" gets a cheerful sales email instead of help. Each of these loses a lead, earns a complaint or hurts the brand.

## 3. The solution

The team keeps working in the same Google Sheet. Once an hour, the tool looks at every lead and decides what should happen today.

For a rep, it looks like this:

- A **Queue** tab lists every lead with an action and a reason: drafted, waiting for local hours, held (missing time zone, missing first name), opted out, route to support, reply needs a person, not due yet, or stopped.
- **Gmail drafts** appear in the Drafts folder of the account that runs the tool, already in the lead's language, with their name, company and the booking link filled in. The rep reads each one, adjusts it if needed, and clicks Send. Nothing is sent automatically.
- Each draft has a **"Send after"** time in the lead's own time zone, so nobody gets an email before 9 a.m. their time.
- Anyone who asked to stop, in English or Spanish, is blocked for good, even if they appear again in a second row.
- A lead with a pricing or approval question gets a short message that moves the answer to a call. Sales never puts a price or a promise in writing by accident.
- A lead who mentions a lost card, fraud or a login problem is sent to support, not sales.
- A lead who booked a demo gets one reminder draft the business day before, with the time written for them: "Wednesday, November 25 at 10:00 AM (New York time)" or "miércoles 25 de noviembre, 3:30 p. m. (hora de Bogotá)".

For the lead, it simply means a timely, polite message in their language, at a normal hour, and no more messages once they say no.

## 4. What was built

- **Google Apps Script** inside the sheet: a menu, the hourly run, Gmail drafts and the Queue, Summary and Suppression tabs. `DRY_RUN` is on by default, so the first runs only fill a preview tab.
- **Plain JavaScript rules** shared by Apps Script and a local demo: follow-up schedule, opt-out check, local-hours check, templates and a template check that blocks promises, advice and requests for sensitive data.
- **307 automated tests** (vitest), in English and Spanish, including a test that fails if any code could send an email.
- A **local demo** (`npm run demo`) that runs on a sample CSV with no Google account, and writes a draft preview page.

## 5. What the demo shows (sample data)

One run of `npm run demo` on 32 synthetic leads, at a fixed time (Tuesday 2026-11-24 15:00 UTC):

| Result | Leads |
|---|---|
| Follow-up drafts ready | 11 (2 of them "needs rep" pricing questions) |
| Appointment reminders | 2 (one English, one Spanish) |
| Waiting for the lead's local hours (Los Angeles, 07:00) | 1 |
| Held for a person to fix (missing time zone, invalid time zone, missing first name) | 3 |
| Opted out (including a Booked lead who wrote "unsubscribe", and a duplicate row of someone who opted out) | 7 |
| Routed to support ("Perdí mi tarjeta, alguien la está usando.") | 1 |
| Reply needs a person | 2 |
| Not due yet | 3 |
| Stopped (closed, or 3 follow-ups done) | 2 |

A separate check (`npm run eval`) ran the opt-out detector on 55 hand-written sample replies. It caught all 31 opt-outs and flagged 5 normal replies by mistake, such as "Can we stop by your office on Friday?". That is on purpose: blocking too much is safer than writing to someone who said no. The set is small and includes the phrases the list was built from, so real replies will include wordings it misses. That is why every reply still goes to a person.

The tool has not yet been tested in a live Google Sheet. The Apps Script part has only run against test fakes of Google's services.

## 6. Adapting it for a real team

- **Your sheet.** Column names can be in English or Spanish, and other common names can be added in one settings file. If your leads live in HubSpot or another CRM, the same rules can run there instead of a sheet.
- **Your messages.** Your own wording, tone and signature replace the sample templates, in both languages. The template check still blocks promises and requests for card numbers or passwords.
- **Your schedule.** Days between follow-ups, the number of follow-ups and the local hours are settings on the Config tab. Check the contact rules that apply to your business; the defaults are a starting point, not legal advice.
- **Your booking link** and rep names.
- **Your opt-out words.** We would go through real replies from your inbox and add the ways your leads actually say "stop".
- **A test run first**, on a copy of your sheet with drafts only, before anyone sends a message.

Want to see it with your leads? Send me a few sample rows (with fake names) and I'll show you what the queue and drafts would look like.
