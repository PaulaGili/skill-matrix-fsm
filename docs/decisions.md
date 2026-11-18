# Decisions

The main decisions and the reasons behind them. Statements about FSM behaviour were checked against the assessment company with objects in the `paulagili::` namespace, which were deleted afterwards.

## Which API for which task

- Persons come from the Query API: one call with a server-side filter and sort.
- The certificate list also comes from the Query API. A single JOIN over Attachment, Skill and Tag returns the certificates of all our skills, with no call per assignment.
- Skills (tags), the scale and assignments use the Skill Service, the only API that exposes `scaleId` and the proficiency level.
- Certificate files are uploaded, downloaded and deleted through the Data API, the only one that handles attachment files.

The matrix loads with four list calls in parallel, regardless of the number of persons or skills. The scale is only read when a skill is created or an assignment is edited.

## Names

The app uses the words of the assignment: Skill (FSM Tag), Assignment (FSM Skill), Certificate (FSM Attachment), Level (FSM Proficiency). The translation happens in one place, `src/lib/fsm/services`.

## Dates and statuses

- Dates stay `yyyy-MM-dd` strings and are compared as text. `new Date("2026-11-17")` is midnight UTC and can shift the day. "Today" is the date in Europe/Zurich.
- The end date is the last valid day (FSM stores `endTime 23:59:59`). A skill that ends today is expiring, one that ended yesterday is expired. The expiring window is today to today + 30 days, inclusive.
- A fifth status, not yet valid, covers a start date in the future. The assignment lists four statuses, but a skill that only starts next month should not look valid today.
- An empty "valid from" is saved as today. The Skill Service rejects a skill without a start date, and a skill created through the Data API without one is returned with today's date anyway. The form therefore rejects a "valid to" in the past when "valid from" is empty.

## Writes in the shared company

The proxy limits which entities can be written, but it cannot know whose tag it is. Every update and delete therefore takes an id, reads the record back from FSM and checks that it is in our namespace before writing. The check reads our skills and assignments again. A save does this once: creating or updating the assignment checks it, and the certificate upload in the same save reuses that check. With much more data it would read the single record instead.

Scripts (`seed`, `cleanup`, the smoke test) go through the app's proxy as well, so the same write rules apply to them.

## Removing data

- FSM refuses to delete a tag that still has skills.
- FSM keeps an attachment when its skill is deleted. Removing an assignment therefore deletes its certificates first, so no orphaned files stay in the company. The assignment is checked before anything is deleted. A certificate that someone else deleted in the meantime is skipped.

Deleting a skill in the catalogue:

- A skill without assignments is deleted after a simple confirmation.
- A skill that is still assigned offers two actions. "Retire skill" (the default) ends every assignment that is valid today and keeps the skill, its history and all certificates: the end date is yesterday, so it shows as expired at once, or today for an assignment that only started today. Assignments that start after today were never valid and are removed. "Delete everything" removes certificates, assignments and the skill, and asks the user to type the skill name first.
- Qualifications and certificates are evidence. If someone asks next year whether a technician was certified in 2026, the answer should still be in FSM, so the safe action is the default and the destructive one takes an extra step.
- Only blocking the delete would be safe, but the catalogue could never be cleaned up. Deactivating the tag does not work either: `Tag.inactive` can be set through the Data API, but the Skill Service ignores it and still accepts new assignments for an inactive tag, so the app would be the only thing enforcing it.

## Assigning and editing

- Clicking a matrix cell opens one dialog for level, validity, certificates and removal. Nothing is written until Save; Cancel discards everything, including certificates marked for deletion and files waiting to be uploaded.
- Save writes in a fixed order: the assignment, certificates to delete, then new files. If a file fails, the others are still uploaded, the dialog stays open and names the file and the reason.
- "Assign to several" gives one skill to several persons in one request, with the same level and either the same validity for everyone or dates per person. It only offers persons who do not have the skill yet and stops at 20 persons, because the shared company allows no bulk imports beyond a few dozen records.
- Files are checked twice: when they are picked (type and 5 MB limit) and again in the service before upload.
- A certificate can be previewed inside the dialog. FSM serves attachments as downloads, so the file is fetched and shown from memory instead of pointing an iframe at the URL.
- FSM silently ignores a new end date on an open-ended skill (it answers 200 and keeps `9999-12-31`) unless `validityType` changes with it: `LF` for a date range, `PE` for no end date. `updateAssignment` always sends both. The smoke test covers both directions.

- FSM gives a new skill the default level of its scale, even when no level is sent. Choosing "No level" therefore creates the skill and then clears the level with a second call. If that second call fails, the assignment keeps the default level and the matrix shows it, which is what FSM holds. The smoke test covers the normal case.

## Concurrent edits

Before an update the service re-reads the assignment, which it does anyway for the ownership check. If the dates or level differ from what the user was looking at, the update is refused with a message to reload, instead of overwriting the other change.

The Data API has its own optimistic lock: a `PATCH` on `Skill` without `forceUpdate` and with a stale `lastChanged` fails with `409 CA-27`. It is stricter (no gap between check and write), but the level can only be written through the Skill Service, which has no such check, so one edit would need two APIs and could be saved halfway. The chosen check costs no extra call and covers dates and level together; a small window between the read and the write remains.

## Proficiency scale

One scale, `paulagili::Levels` (Basic, Advanced, Expert), found by exact name and created only if missing. Loading the matrix only reads it. `cleanup` deletes every scale with that name.

## Persons

Every active person exists twice in the demo company, once as `EMPLOYEE` and once as `ERPUSER`, with the same name, and one technical person has no name. The matrix shows technicians (named employees) by default, and a switch adds the system users. All of them stay reachable, as the assignment asks for active persons, but the default view cannot assign a skill to the wrong twin.

## Matrix

- `AnalyticalTable` with the person column pinned, so names stay visible while the skills scroll sideways. The pinning plugin is marked experimental in UI5 Web Components for React 2.27, so it was tried first in a spike with all 26 persons: pinning, cell clicks and a narrow viewport all worked. A plain table with a CSS sticky column was the fallback.
- A cell shows the standard status indicator (icon, colour and text) and a certificate icon on the first line, and the level and the date that matters on the second ("until 29.11.2026"). Unassigned cells show a dash to keep the grid quiet.
- Filters: person search, skill selection, level selection, status buttons and the system-user switch. They combine by one rule, written as pure functions with unit tests:
  - Statuses are alternatives ("expired or expiring soon"), and so are levels. "No certificate" is a separate condition that must hold in the same cell, so "Valid" plus "No certificate" finds valid skills without proof.
  - With skills selected, a person needs a passing cell in every selected skill. Selecting the first skill switches on "Valid" and "Expiring soon", which answers "who can do Welding and First Aid today?". The default is visible and can be changed: "Welding" plus "Expired" shows whose welding has expired, and with all statuses off everyone is listed, which is the view for assigning the skill to someone new.
  - Without skills selected, one passing cell in any skill is enough, and the columns without a passing cell are hidden so the result is not a grid of dashes.
  - With a filter on, a cell that does not pass is left blank, so "No certificate" does not show the same person's certified skills next to the uncertified one.
- The screen follows "overview first, then filter, then detail": a line above the table says how many assignments are expired, expiring soon or without a certificate among all technicians, and a click on a number sets that filter. All filters sit in one bar, and the status filters are toggle buttons.
- Cells of persons who do not have a skill are empty. A dash in every one of them made the least important thing the most visible; "Assign" appears when the pointer or the keyboard is on the cell.
- The larger SAP size is the default, because the users are not all young and some work on a tablet. A button in the header switches to the compact size, with smaller fields and buttons, and the choice is remembered in the browser. The rows of the matrix keep their height, as a cell has two lines.
- A click on a person opens a read-only list of all skills of that person with level, status, validity and certificates. It uses the data the matrix has already loaded, so it costs no FSM call.
- A row starts with a red line when one of the shown skills of that person has expired, and an orange one when something expires soon.
- The catalogue shows per skill how many assignments are expired, expiring soon, valid or not yet valid, in the colours of the matrix.
- A click on a column header sorts the rows. A skill column puts the problems first (expired, expiring soon), then valid, then the persons without the skill. The skill columns can be dragged into another order, which is remembered in the browser.
- FSM allows two skills for the same person and tag. The app reads the assignments before it creates one and refuses a second one, so a retry or a second browser tab does not duplicate an assignment. Two saves in the same second could still both pass the check, as FSM itself has no such rule. If FSM holds two anyway, the cell shows the one that is valid today, and among equals the one that stays valid longest.
- The "Expiring" page lists what ends within the next 30, 60, 90 or 180 days, soonest first, from the same four calls as the matrix. A row opens the same dialog as a matrix cell, so an assignment can be renewed where the problem is seen. Expired assignments are not listed there; the matrix filter covers them. It has the same person, skill, level and missing-certificate filters as the matrix and can be exported the same way.
- Export downloads the matrix as it is shown, with the active filters, as Excel or CSV. The columns and the CSV separator can be chosen first, and the choice is remembered in the browser. The file is built in the browser, so no data leaves the app. Values that a spreadsheet would run as a formula (a skill named `=...`) are written as text.

- Tablet: the matrix keeps its person column in place and scrolls the skills inside the table, so the page itself never scrolls sideways. The list tables (catalogue, expiring) fold the columns that do not fit into the row. Checked at 820 px width. On a phone the pages fold the same way and the dialog shows its fields below each other, checked at 390 px; the matrix itself stays a wide table that scrolls sideways, so a phone is fine for looking something up, not for working in it.

## Reading a certificate with AI

- Optional. With `ANTHROPIC_API_KEY` set on the server, a new certificate in the assignment dialog gets a "Read dates" button. Without the key the button is not shown and nothing else changes.
- The AI only reads: holder name, title and the two dates, each of which may be "not found". It is told not to guess or calculate, and to treat the document as data.
- The code decides what is usable. Dates must be real dates in the right order, and it adds a note when the certificate has expired or is issued to someone else. These checks are pure functions with unit tests.
- The person decides. The result is a proposal in the dialog; "Use these dates" fills the form, and nothing is written to FSM before Save.
- The certificate is also checked against what is stored: a note appears when the AI says it is clearly for another skill, or when a date printed on it differs from the date of the assignment. Only a date that is on the certificate is compared.
- When a skill is created, the AI is asked once whether the catalogue already has one that means the same (a translation or another word). Only skill names are sent, an answer counts only if that skill exists, and the user can still create the skill.
- Two models are used. Reading a scanned certificate runs on the strong model. The three short text tasks (question to filters, similar skill name, column titles) run on the small model, which is faster and costs a fraction. The evaluation is the check that the small model is good enough for them.
- The key stays on the server, like the FSM secret, and the bundle check covers it. The file is only sent when the user clicks the button, and there is a cap on reads per hour. The cap is counted in memory per server, and the AI routes do not ask who is calling, so a hosted copy needs an access code in front of it.
- The answer is requested as structured output, so its shape is guaranteed by the API and not parsed from free text.
- `npm run eval:ai` reads five invented certificates (English, German, an image, one without dates and one with an instruction hidden in the text) and compares the answers with the known ones. It calls the real service, so it is run by hand and not in CI. Last run: 20 of 20 fields correct, about 2 seconds per file. Five clean files do not show how it copes with a poor scan.

## Asking the matrix a question

- With the AI key set, the matrix has an "Ask" field: "who can do Welding and First Aid?" sets the skill, status and level filters.
- The AI turns the question into filter values and nothing else. It does not answer and it never sees persons or assignments: only the question and the names of skills and levels are sent. A browser test checks the request.
- The code keeps only names and statuses that exist, tells the user what was left out, and the matrix computes the result with the same tested filter rules as a manual filter. A wrong answer from the AI can therefore only produce a wrong filter, which is visible and can be changed by hand.
- A question about a skill that does not exist sets no filter at all and says which name was not found. The first version left the unknown skill out and kept the rest, so "who is certified for diving?" showed everyone with any valid skill. The evaluation found that.
- `npm run eval:ai` also runs six questions with known filters, including German, a skill that does not exist and an instruction hidden in the question. The same question can get a different answer the next time, so `npm run eval:ai -- 3` asks each one three times and only counts it when all three match. Last run: 6 of 6 questions correct in all three runs. Before the fix above it was 4 of 6. The same command checks six skill names against the catalogue and the column titles of five import files; last run 6 of 6 and 5 of 5 in all three runs, on the small model.

## Importing assignments from a file

Assignments can be created from an Excel or CSV file, up to 20 rows, the same limit as assigning to several persons. The file is read in the browser. Every row is matched by code to a technician, a skill and a level, and the dates are checked with the same rules as the dialog. A row that does not match exactly, that the person already has, or that is in the file twice is shown with the reason and cannot be imported. The user sees all rows and unticks what should not be saved.

The usual column titles in English and German are recognised by code. Titles that are left over, and nothing else, are sent to the AI, which answers with the title for each field that is still open. An answer that is not one of the titles in the file is dropped, and a column that no field uses is named in a warning above the rows. No row of the file leaves the browser.

The import writes one request per skill through the same service as the dialogs, so the namespace check and the duplicate check apply. If one request fails, the rows saved before it show as already assigned after the reload.

## Demo mode

- `NEXT_PUBLIC_DEMO_MODE=1` runs the app on invented sample data, read-only. The FSM credentials of the assessment are revoked after the deadline, and the app should still be showable.
- It is a second small route, `/api/demo`, that answers the same read calls as the FSM proxy. The app only changes the base URL, so every screen runs the same code as with FSM. Writes are refused with a clear message, and a banner says that the data is not real.
- The dates of the sample data are relative to today, so every status is always present.

## Languages

- The app is in English and German, with an EN / DE switch in the shell bar. The first visit follows the browser: German when its language starts with `de`, otherwise English. The choice is remembered in `localStorage`.
- The texts are two plain objects, `src/lib/i18n/en.ts` and `de.ts`. The English one defines the keys and the German one is typed against it, so a missing key does not compile. One `translate` function fills `{name}` placeholders and chooses between `one` and `other` by a `count` parameter, which is all the plural handling these two languages need. A unit test checks that both files have the same keys and placeholders.
- No library: `next-intl` or `i18next` bring routing by locale, message formats and loaders that an app with two languages and about 220 texts does not use, and the assessment should stay explainable line by line. If a third language with other plural rules were added, `Intl.PluralRules` would replace the `count === 1` check.
- The pure rules in `src/lib/domain` return a message key with parameters instead of a sentence (`{ key: "hint.until", params: { date } }`), and the UI translates it. They stay free of React and their tests do not depend on wording. The one exception is the export table, which builds finished cell texts and therefore receives the translate function.
- Errors from the services are `UserError` objects with the same key and parameters. Their own `message` is the English text, so scripts and logs stay readable, and `toUserMessage` translates them for the screen.
- The pages are prerendered in English. The provider reads the language with `useSyncExternalStore` and an English server snapshot, so the first browser render matches the HTML and React switches to German right after. A German user sees the English shell for a moment on a cold load; avoiding that would need a cookie and server rendering per request.
- The built-in texts of the UI5 components (calendar, table, tooltips) follow the same switch through UI5's own `setLanguage`.
- German is written for Switzerland: `ss` instead of the sharp s, formal address, SAP wording. Dates are `dd.MM.yyyy` in both languages.
- Not translated: names of skills, persons, levels and job titles, because they are data from FSM; the texts FSM itself returns, which are shown inside "FSM error (status): ..."; the placeholder name "(no name)" of a technical person without a name, which is part of the name the search and the sort order use; and the texts of the server routes. For the AI routes the UI shows its own translated text by HTTP status, and for demo mode it translates the read-only refusal.

## MCP server

- `npm run mcp` starts a small MCP server, so an AI assistant can answer questions about the matrix: which skills exist, who holds one, what a person has, what expires soon.
- Read-only by design: it has four tools and none of them writes. It reads through the app's proxy like the other scripts, so it needs no credentials of its own.
- The answers are built by pure functions on top of the same rules as the app (status, expiry window, which assignment counts), with unit tests. The assistant gets facts and does not calculate a status itself.
- Unlike the two AI features in the app, this one does hand person data to the assistant that is connected. That is the purpose, and the user chooses which assistant to connect.

## History of changes

- The "Changes" page lists what was assigned, edited or removed, newest first, with Undo.
- FSM offers the app no change log and the app has no database, so the history is kept in the browser. It therefore covers the changes made in this browser only, and the page says so.
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
- `npm run seed` creates 5 skills, 10 assignments and 4 sample certificates with dates relative to today, and skips what already exists. `npm run cleanup` only lists unless called with `-- --yes`.
