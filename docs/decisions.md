# Decisions

The main decisions and the reasons behind them. Statements about FSM behaviour were checked against the assessment company with objects in the `paulagili::` namespace, which were deleted afterwards.

## Which API for which task

- Persons come from the Query API: one call with a server-side filter and sort.
- The certificate list also comes from the Query API. A single JOIN over Attachment, Skill and Tag returns the certificates of all our skills, with no call per assignment.
- Skills (tags), the scale and assignments use the Skill Service, the only API that exposes `scaleId` and the proficiency level.
- Certificate files are uploaded, downloaded and deleted through the Data API, the only one that handles attachment files.

The matrix loads with four list calls in parallel, regardless of the number of persons or skills. The app shell adds one small call that checks the connection. The scale is not part of it: it is read when a skill is created or a dialog that offers levels opens (assign, edit, assign to several, import).

## Names

The app uses the words of the assignment: Skill (FSM Tag), Assignment (FSM Skill), Certificate (FSM Attachment), Level (FSM Proficiency). The translation happens in one place, `src/lib/fsm/services`.

## Dates and statuses

- Dates stay `yyyy-MM-dd` strings and are compared as text. `new Date("2026-11-17")` is midnight UTC and can shift the day. "Today" is the date in Europe/Zurich.
- The end date is the last valid day (FSM stores `endTime 23:59:59`). A skill that ends today is expiring, one that ended yesterday is expired. The expiring window is today to today + 30 days, inclusive.
- A fifth status, not yet valid, covers a start date in the future. The assignment lists four statuses, but a skill that only starts next month should not look valid today.
- An empty "valid from" is saved as today. The Skill Service rejects a skill without a start date, and a skill created through the Data API without one is returned with today's date anyway. The form therefore rejects a "valid to" in the past when "valid from" is empty.

## Writes in the shared company

The proxy of the assessment limits which entities can be written, but it cannot know whose tag it is. Ownership is therefore checked in two places.

- On the server, in front of the proxy (`src/proxy.ts`, `src/lib/fsm/write-guard.ts`). Every write to FSM is inspected before it is passed on: a tag or scale must carry our prefix, and a tag, skill, scale or attachment that is changed or deleted must be one that FSM lists in our namespace. For that the server reads our ids from FSM itself, with one to three list calls per write, and trusts nothing the browser sent. A write the app does not make at all is refused. If FSM cannot be asked, nothing is written. This check cannot be skipped by calling `/api/fsm` directly.
- In the browser, in the services. Every update and delete takes an id, reads the record back from FSM and checks it before writing. This is what gives the user a clear message in the right language, and it notices a change someone else made in the meantime.

The first version had only the check in the browser, with the access code in front of a hosted copy. A review pointed out that the browser is the wrong place to enforce a rule, so the server check was added. The price is the extra reads on every write; reads are not affected.

Scripts (`seed`, `cleanup`, the smoke test) go through the app's proxy as well, so the same rules apply to them.

## Removing data

- FSM refuses to delete a tag that still has skills.
- FSM keeps an attachment when its skill is deleted. Removing an assignment therefore deletes its certificates first, so no orphaned files stay in the company. The assignment is checked before anything is deleted. A certificate that someone else deleted in the meantime is skipped.

Deleting a skill in the catalogue:

- A skill without assignments is deleted after a simple confirmation.
- A skill that is still assigned offers two actions. "Retire skill" (the default) ends every assignment that is valid today and keeps the skill, its history and the certificates of the ended assignments: the end date is yesterday, so it shows as expired at once, or today for an assignment that only started today. Assignments that start after today were never valid and are removed, together with their certificates. Ending them is one request for all holders: the bulk route of the Skill Service updates a skill that is sent with its id, respects the end date when `validityType` goes with it, and keeps the level. This was checked against FSM with an Advanced level and with no level. "Delete everything" removes certificates, assignments and the skill, and asks the user to type the skill name first.
- Qualifications and certificates are evidence. If someone asks next year whether a technician was certified in 2026, the answer should still be in FSM, so the safe action is the default and the destructive one takes an extra step.
- Only blocking the delete would be safe, but the catalogue could never be cleaned up. Deactivating the tag does not work either: `Tag.inactive` can be set through the Data API, but the Skill Service ignores it and still accepts new assignments for an inactive tag, so the app would be the only thing enforcing it.
- Deleting checks ownership more than once on purpose. Removing a skill with its assignments reads the skill and assignment lists again before each step (certificates, assignments, the tag), seven reads for two writes, plus one delete per certificate. Deleting is rare and the reads are cheap, and in a shared company a second check costs less than one wrong delete. The path used every day, loading the matrix, stays at four calls.

## Assigning and editing

- Clicking a matrix cell opens one dialog for level, validity, certificates and removal. Nothing is written until Save; Cancel discards everything, including certificates marked for deletion and files waiting to be uploaded.
- Save writes in a fixed order: the assignment, certificates to delete, then new files. The assignment goes first because that step reads it back from FSM and refuses a change someone else made in the meantime; if it is refused, no certificate has been touched. What fails after it (a certificate that cannot be deleted, a file that cannot be uploaded) is shown next to the saved assignment: the dialog stays open, names the file and the reason, and Save can be pressed again. An earlier version deleted the certificates first, and a refused update then left a certificate deleted with nothing to show for it; a review of the change found that.
- "Assign to several" gives one skill to several persons in one request, with the same level and either the same validity for everyone or dates per person. It only offers persons who do not have the skill yet and stops at 20 persons, because the shared company allows no bulk imports beyond a few dozen records.
- A file travels as base64 inside a JSON request, a third larger than the file. Locally the 5 MB limit holds. A hosting platform can cut the request earlier: Vercel does at 4.5 MB, so a hosted copy takes files up to about 3 MB and says so when one is larger. Uploading in parts or straight to FSM would lift this; it was not worth the extra code here.
- Files are checked twice: when they are picked (type and 5 MB limit) and again in the service before upload.
- A certificate opens in a viewer dialog, the same one from the assignment, the person view, the skill view and the expiry list. FSM serves attachments as downloads, so the file is fetched and shown from memory instead of pointing an iframe at the URL.
- FSM silently ignores a new end date on an open-ended skill (it answers 200 and keeps `9999-12-31`) unless `validityType` changes with it: `LF` for a date range, `PE` for no end date. `updateAssignment` always sends both. The smoke test covers a date range becoming open-ended through `updateAssignment`, and open-ended becoming a date range through the bulk route that retire uses.

- FSM gives a new skill the first level of its scale, whatever is sent: leaving the level out, sending `null`, a bulk update and a scale without a default level were all tried against the real company. Choosing "No level" therefore creates the skill and then clears the level with a second call per skill; for several persons these calls run together. If that second call fails, the assignment keeps the default level and the matrix shows it, which is what FSM holds. The smoke test covers the normal case.

## Concurrent edits

Before an update the service re-reads the assignment, which it does anyway for the ownership check. If the dates or level differ from what the user was looking at, the update is refused with a message to reload, instead of overwriting the other change.

The Data API has its own optimistic lock: a `PATCH` on `Skill` without `forceUpdate` and with a stale `lastChanged` fails with `409 CA-27`. It is stricter (no gap between check and write), but the level can only be written through the Skill Service, which has no such check, so one edit would need two APIs and could be saved halfway. The chosen check costs no extra call and covers dates and level together; a small window between the read and the write remains.

## My skills

- The optional self-service view is a page of its own: a technician picks the own name and sees the own skills, their validity and the certificates, read-only. It shows the same table as the person view of the matrix.
- The app has no login, so the name is chosen once and remembered in the browser. With a login the person would come from the FSM user, and the page would not offer the other names.

## Proficiency scale

One scale, `paulagili::Levels` (Basic, Advanced, Expert), found by exact name and created only if missing. Loading the matrix does not touch it. `cleanup` deletes every scale with that name.

## Persons

Every active person exists twice in the demo company, once as `EMPLOYEE` and once as `ERPUSER`, with the same name, and one technical person has no name. The matrix shows technicians (named employees) by default, and an entry in the overflow menu of the toolbar adds the system users. All of them stay reachable, as the assignment asks for active persons, but the default view cannot assign a skill to the wrong twin.

## Matrix

- `AnalyticalTable` with the person column pinned, so names stay visible while the skills scroll sideways. The pinning plugin is marked experimental in UI5 Web Components for React 2.27, so it was tried first in a spike with all 26 persons: pinning, cell clicks and a narrow viewport all worked. A plain table with a CSS sticky column was the fallback.
- A cell shows the standard status indicator (icon, colour and text) and a certificate icon on the first line, and the level and the date that matters on the second ("Expert - 29.11.2026"). The status says what the date means, and the full sentence is the tooltip. The short text lets seven skill columns fit a laptop screen.
- Filters: person search, skill selection, level selection and status selection. System users are shown from the overflow menu of the toolbar. They combine by one rule, written as pure functions with unit tests:
  - Statuses are alternatives ("expired or expiring soon"), and so are levels. "No certificate" is a separate condition that must hold in the same cell, so "Valid" plus "No certificate" finds valid skills without proof.
  - With skills selected, a person needs a passing cell in every selected skill. Selecting the first skill switches on "Valid" and "Expiring soon", which answers "who can do Welding and First Aid today?". The default is visible and can be changed: "Welding" plus "Expired" shows whose welding has expired, and with all statuses off everyone is listed, which is the view for assigning the skill to someone new.
  - Without skills selected, one passing cell in any skill is enough, and the columns without a passing cell are hidden so the result is not a grid of dashes.
  - With a filter on, a cell that does not pass is left blank, so "No certificate" does not show the same person's certified skills next to the uncertified one.
- The matrix page was reduced to one thing per row: one main action in a UI5 toolbar, with export, import, system users and refresh in its overflow menu; one bar with four filters of the same kind; then the table. An overview line with counts and a coloured stripe per row were tried and removed, as they repeated what the status filter and the Expiring page already say and made the page busy. Colour is used for the status only.
- Cells of persons who do not have a skill are empty. A dash in every one of them made the least important thing the most visible; "Assign" appears when the pointer or the keyboard is on the cell.
- The larger SAP size is the default, because the users are not all young and some work on a tablet. A button in the header switches to the compact size, with smaller fields and buttons, and the choice is remembered in the browser. The rows of the matrix keep their height, as a cell has two lines.
- A click on a person opens a read-only list of all skills of that person with level, status, validity and certificates. It uses the data the matrix has already loaded, so it costs no FSM call.
- Every page has the same frame: the title with the count, the actions at the end of that line (main action, Sort, overflow menu), one row of filters of the same width, then the table. Title, filters and table start at the same place on every page, so nothing jumps when the tab changes.
- Each page answers one question. The catalogue shows per skill the number of assignments, and a click on a skill name lists who holds it; what expires is the question of the Expiring page and is not repeated in the catalogue. The Expiring page can also list what has already expired.
- The list tables are sorted from a Sort button that opens the UI5 view settings dialog, and the filters sit in the UI5 filter bar, as in a Fiori list report. The matrix is sorted from the same Sort button. A skill column puts the problems first (expired, expiring soon), then valid, then the persons without the skill. The skill columns can be dragged into another order, which is remembered in the browser.
- FSM allows two skills for the same person and tag. The app reads the assignments before it creates one and refuses a second one, so a retry or a second browser tab does not duplicate an assignment. Two saves in the same second could still both pass the check, as FSM itself has no such rule. If FSM holds two anyway, the cell shows the one that is valid today, and among equals the one that stays valid longest.
- The "Expiring" page lists what ends within the next 30, 60, 90 or 180 days, soonest first, from the same four calls as the matrix. The pencil in a row opens the same dialog as a matrix cell, so an assignment can be renewed where the problem is seen. It can also list what has already expired, latest first. It has person, skill, level and certificate filters of the same kind as the matrix and can be exported the same way.
- Export downloads the matrix with the active filters and the column order shown, the rows in the order shown, as Excel or CSV. The columns and the CSV separator can be chosen first, and the choice is remembered in the browser. The file is built in the browser, so no data leaves the app. Values that a spreadsheet would run as a formula (a skill named `=...`) are written as text.

- Tablet: the matrix keeps its person column in place and scrolls the skills inside the table, so the page itself never scrolls sideways. The list tables (catalogue, expiring) keep the columns that matter in one line: the columns have an importance, the actions stay in the row, and the least important ones (level and certificate on the Expiring page, the description in the catalogue) are left out when there is no room, as they are one click away. Checked at 820 px width. On a phone the pages fold the same way and the dialog shows its fields below each other, checked at 390 px; the matrix itself stays a wide table that scrolls sideways, so a phone is fine for looking something up, not for working in it.

## Reading a certificate with AI

- Optional. With `ANTHROPIC_API_KEY` set on the server, a new certificate in the assignment dialog gets a "Read dates" button. Without the key the button is not shown and nothing else changes.
- The AI only reads: holder name, whether the document is for this skill, and the two dates, each of which may be "not found". It is told not to guess or calculate, and to treat the document as data.
- The code decides what is usable. Dates must be real dates in the right order, and it adds a note when the certificate has expired or is issued to someone else. These checks are pure functions with unit tests.
- The person decides. The result is a proposal in the dialog; "Use these dates" fills the form, and nothing is written to FSM before Save.
- The certificate is also checked against what is stored: a note appears when the AI says it is clearly for another skill, or when a date printed on it differs from the date of the assignment. Only a date that is on the certificate is compared.
- When a skill is created, the AI is asked once whether the catalogue already has one that means the same (a translation or another word). Only skill names are sent, an answer counts only if that skill exists, and the user can still create the skill.
- One small model runs all four features. The first version read certificates with the strong model, on the assumption that a scan needs it. The evaluation then compared the two on seven certificates, two of them made to look like phone photos, five times each: the same answers from both, 1.4 s per file instead of 1.9 s, at a fraction of the cost. The two runs are in `tests/ai-eval/model-comparison.txt`. So the strong model went. If real scans turn out harder than these, the comparison is one command away.
- The key stays on the server, like the FSM secret. The bundle check looks for it in the browser files on a machine that has the key; in CI there is no key to look for. The file is only sent when the user clicks the button, and there is a cap on reads per hour. The cap is one counter for all AI features, kept in memory per server, and the AI routes do not ask who is calling, so a hosted copy needs an access code in front of it.
- The answer is requested as structured output, so its shape is guaranteed by the API and not parsed from free text.
- Whether it reads correctly is measured, not assumed: see "Evaluating the AI features" below.

## What the AI features send

All four are off without `ANTHROPIC_API_KEY`. With it, data goes to the Anthropic API, a company in the United States. The app itself keeps none of it.

| Feature       | What is sent                                                                                | When                    |
| ------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| Read dates    | The whole certificate file and the name of the skill. A certificate names its holder.       | On a click              |
| Ask           | The question and the names of skills and levels. A person's name only if the user types it. | On a click              |
| Match columns | The titles of the first row that the code did not recognise                                 | On a click              |
| Similar skill | The new skill name and the names in the catalogue                                           | When a skill is created |

Persons and assignments from FSM are never sent. The certificate is the one case with personal data, so a real installation needs a data processing agreement with the provider and a note for the technicians before this is switched on (GDPR, Swiss FADP). The MCP server is different: it hands the matrix to whichever assistant the user connects, which is that user's decision.

## Asking the matrix a question

- With the AI key set, the matrix has an "Ask" field: "who can do Welding and First Aid?" sets the skill, status and level filters.
- The AI turns the question into filter values and nothing else. It does not answer and it never sees the persons or assignments of the company: only the question and the names of skills and levels are sent. A name the user types in the question is part of the question and is sent with it; the tooltip says so. A browser test checks the request.
- The code keeps only names and statuses that exist, tells the user what was left out, and the matrix computes the result with the same tested filter rules as a manual filter. A wrong answer from the AI can therefore only produce a wrong filter, which is visible and can be changed by hand.
- A question about a skill that does not exist sets no filter at all and says which name was not found. The first version left the unknown skill out and kept the rest, so "who is certified for diving?" showed everyone with any valid skill. The evaluation found that.

## Evaluating the AI features

`npm run eval:ai` calls the real service with known inputs and compares the result with the known one. For questions, similar names and column titles the answer first goes through the checking code of the app, so what is compared is what the app would do. For certificates the four fields the AI returns are compared directly. It costs a few cents and needs the key, so it is run by hand and not in CI. The result of the last run, with date and models, is in `tests/ai-eval/last-run.txt`.

| Feature       | Cases                                                                                                                                                                       | What has to match                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Certificates  | 7 files: English, German, an image, one without dates, one with an instruction hidden in the text, and two made to look like phone photos (tilted, blurred, low resolution) | Holder, both dates, and whether it is for the skill                |
| Questions     | 10: English and German, a level range, a status together with a missing certificate, a person's name, a skill that does not exist, an instruction hidden in the question    | The skill, status and level filters and the person search          |
| Similar skill | 6 names: translations, a spelling variant, unrelated names, an instruction                                                                                                  | The existing skill, or none                                        |
| Column titles | 6 header rows: German, French, abbreviations, a sheet that is not about skills, an instruction as a title                                                                   | The column of each field, after the code has matched what it knows |

- The same input can get a different answer the next time. `npm run eval:ai -- 3` asks every case three times and counts it only when all three match.
- Each feature has a case that tries to give the model an instruction. The answer must be the same as without it.
- A second argument reads the certificates with another model (`npm run eval:ai -- 5 claude-opus-5-5`). That comparison is why the app uses one small model: see "Reading a certificate with AI".
- Repeating found two cases that passed in one run and failed in the next, with the same model: the column title "MA", and a question that asks for a status and a missing certificate at once. Both prompts were made clearer, and each got control cases with wording the prompt does not mention, to check that the fix is general and not fitted to the one case.
- Last run: 29 of 29 cases right in all five runs, between 1.2 and 1.6 seconds per call. Before the two prompt fixes, the question that asks for a status and a missing certificate was right in 3 of 5 runs, twice in a row.
- Limits: the cases are few. Seven files, two of them made to look like phone photos, do not show how it copes with real scans, and 100 % here says the prompts work on these inputs, not on all.

## Importing assignments from a file

Assignments can be created from an Excel or CSV file, up to 20 rows, the same limit as assigning to several persons. The file is read in the browser. Every row is matched by code to a technician, a skill and a level, and the dates are checked with the same rules as the dialog. A row that does not match exactly, that the person already has, or that is in the file twice is shown with the reason and cannot be imported. The user sees all rows and unticks what should not be saved.

The usual column titles in English and German are recognised by code. If titles are left over, a "Match columns with AI" button sends them, and nothing else, to the AI, which answers with the title for each field that is still open. An answer that is not one of the titles in the file is dropped, and a column that no field uses is named in a warning above the rows. Nothing is sent without that click. The first row counts as the titles, so in a file without a title row the click sends the first data row; every other row stays in the browser.

The import writes all rows in one request through the same service as the dialogs, so the namespace check and the duplicate check apply. Saving 20 rows costs three calls (skills, assignments, create), plus one for each row without a level. FSM answers per row: if one row fails, the request counts as failed, the matrix reloads, and the rows that were saved show as already assigned, without an entry in the history. If the request fails, the matrix reloads and shows what FSM saved.

## Demo mode

- `NEXT_PUBLIC_DEMO_MODE=1` runs the app on invented sample data, read-only. The FSM credentials of the assessment are revoked after the deadline, and the app should still be showable.
- It is a second small route, `/api/demo`, that answers the same read calls as the FSM proxy. The app only changes the base URL, so every screen runs the same code as with FSM. Writes are refused with a clear message, and a banner says that the data is not real.
- The dates of the sample data are relative to today, so every status is always present.
- In demo mode `src/proxy.ts` answers 403 on the real FSM proxy and on the AI routes, so a public demo copy can neither write to FSM nor spend the AI key, whatever variables are set next to it.

## Languages

- The app is in English and German, with an EN / DE switch in the top bar. The first visit follows the browser: German when its language starts with `de`, otherwise English. The choice is remembered in `localStorage`.
- The texts are two plain objects, `src/lib/i18n/en.ts` and `de.ts`. The English one defines the keys and the German one is typed against it, so a missing key does not compile. One `translate` function fills `{name}` placeholders and chooses between `one` and `other` by a `count` parameter, which is all the plural handling these two languages need. A unit test checks that both files have the same keys and placeholders.
- No library: `next-intl` or `i18next` bring routing by locale, message formats and loaders that an app with two languages and about 290 texts does not use, and the assessment should stay explainable line by line. If a third language with other plural rules were added, `Intl.PluralRules` would replace the `count === 1` check.
- The pure rules in `src/lib/domain` return a message key with parameters instead of a sentence (`{ key: "hint.until", params: { date } }`), and the UI translates it. They stay free of React and their tests do not depend on wording. The one exception is the export table, which builds finished cell texts and therefore receives the translate function.
- Errors from the services are `UserError` objects with the same key and parameters. Their own `message` is the English text, so scripts and logs stay readable, and `toUserMessage` translates them for the screen.
- The pages are prerendered in English. The provider reads the language with `useSyncExternalStore` and an English server snapshot, so the first browser render matches the HTML and React switches to German right after. A German user sees the English shell for a moment on a cold load; avoiding that would need a cookie and server rendering per request.
- The built-in texts of the UI5 components (calendar, table, tooltips) follow the same switch through UI5's own `setLanguage`.
- German is written for Switzerland: `ss` instead of the sharp s, formal address, SAP wording. Dates are `dd.MM.yyyy` in both languages.
- Not translated: names of skills, persons, levels and job titles, because they are data from FSM; the texts FSM itself returns, which are shown inside "FSM error (status): ..."; the placeholder name "(no name)" of a technical person without a name, which is part of the name the search and the sort order use; and the texts of the server routes. For the AI routes the UI shows its own translated text by HTTP status, and for demo mode it translates the read-only refusal.

## MCP server

- `npm run mcp` starts a small MCP server, so an AI assistant can answer questions about the matrix: which skills exist, who holds one, what a person has, what expires soon.
- Read-only by design: it has four tools and none of them writes. It reads through the app's proxy like the other scripts, so it needs no FSM credentials of its own, only the access code when the copy asks for one. It needs the live FSM connection: it does not work against a demo copy or after the assessment credentials are revoked.
- The answers are built by pure functions on top of the same rules as the app (status, expiry window, which assignment counts), with unit tests. The assistant gets facts and does not calculate a status itself.
- Unlike the AI features in the app, this one does hand person data to the assistant that is connected. That is the purpose, and the user chooses which assistant to connect.

## Access code

- The app has no login. The server keeps every write inside our namespace, but a copy on a public URL would still let anyone change our own data and use the AI key.
- `APP_ACCESS_CODE` closes that: when it is set, `src/proxy.ts` answers every page and every API route, the FSM proxy and the AI routes included, with 401 until the browser sends the code. Without the variable nothing changes, so local work, the tests and CI are not affected.
- It is one shared code, not a login per person: enough to keep a demo URL private, not a replacement for real authentication.
- In demo mode the 403 above comes before the code is asked for.
- A copy on Vercel that talks to the real FSM without `APP_ACCESS_CODE` answers 503 on every request and says which variable is missing, so a real copy cannot go online unprotected by accident.
- The code is compared in constant time. The app also sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and `Referrer-Policy: same-origin`, and `Content-Security-Policy: sandbox` on everything that comes from FSM, so an uploaded file is shown or downloaded and never run as a page of the app.
- Not covered: wrong codes are not counted or slowed down.

## History of changes

- The "Changes" page lists what was assigned, edited or removed, newest first, with Undo.
- FSM offers the app no change log and the app has no database, so the history is kept in the browser. It therefore covers the changes made in this browser only, and the empty page and the help say so.
- The description of a change is built by the code from the old and new values. An AI would add nothing here and would need person names.
- Undo writes the opposite change through the same services as any save, so the ownership and conflict checks apply: if someone changed the assignment afterwards, undo is refused. Only the latest change of an assignment can be undone, because undoing an older one would overwrite a later change. Certificates deleted with an assignment do not come back, and the list says how many were lost. Undoing a new assignment deletes it, so it is refused once the assignment has a certificate or was changed.
- The history holds person names in the browser storage of that computer, which matters on a shared machine.
- Changes to the catalogue are not in the history.

## Tooling

- `npm run gate` runs typecheck, lint, the format check, unit tests, the build, a check that neither the OAuth secret nor the AI key is in any file the browser downloads, and the browser tests. CI runs the same steps.
- Unit tests (Vitest) cover the pure rules: statuses, dates, file checks, namespace checks and the mapping of FSM responses.
- Browser tests (Playwright) run against the production build with FSM mocked in the browser, so CI needs no credentials and never writes to the shared company. One of them checks that the matrix loads with four FSM calls.
- `npm run smoke` exercises the service layer against the real company and deletes what it created.
- Two review agents live in `.claude/agents`: a code reviewer and an evaluator that scores the repository against the assignment. Both are read-only. Their findings were checked against the code before anything was changed.
- `package.json` forces a newer `minimatch` inside the TypeScript lint parser, because the version it asks for has a known advisory. It is a development tool only. The other `npm install` warnings come from `picomatch`, for which no fixed version exists yet; `npm audit --omit=dev` reports nothing.
- `npm run seed` creates 7 skills, 13 assignments and 5 sample certificates with dates relative to today, and skips what already exists. `npm run cleanup` only lists unless called with `-- --yes`.
