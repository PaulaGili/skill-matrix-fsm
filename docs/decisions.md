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

The proxy limits which entities can be written, but it cannot know whose tag it is. Every update and delete therefore takes an id, reads the record back from FSM and checks that it is in our namespace before writing. The check reads our skills and assignments again, which is two or three list calls per save. That is fine at this size; with much more data it would read the single record instead.

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

- FSM gives a new skill the default level of its scale, even when no level is sent. Choosing "No level" therefore creates the skill and then clears the level with a second call. The smoke test covers this.

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
- FSM allows two skills for the same person and tag. The app refuses to create a second one, so a retry or a second browser tab cannot duplicate an assignment. If FSM holds two anyway, the cell shows the one that is valid today, and among equals the one that stays valid longest.
- The "Expiring" page lists what ends within the next 30, 60, 90 or 180 days, soonest first, from the same four calls as the matrix. A row opens the same dialog as a matrix cell, so an assignment can be renewed where the problem is seen. Expired assignments are not listed there; the matrix filter covers them. It has the same person, skill, level and missing-certificate filters as the matrix and can be exported the same way.
- Export downloads the matrix as it is shown, with the active filters, as Excel or CSV. The columns and the CSV separator can be chosen first, and the choice is remembered in the browser. The file is built in the browser, so no data leaves the app. Values that a spreadsheet would run as a formula (a skill named `=...`) are written as text.

- Tablet: the matrix keeps its person column in place and scrolls the skills inside the table, so the page itself never scrolls sideways. The list tables (catalogue, expiring) fold the columns that do not fit into the row. Checked at 820 px width.

## Reading a certificate with AI

- Optional. With `ANTHROPIC_API_KEY` set on the server, a new certificate in the assignment dialog gets a "Read dates" button. Without the key the button is not shown and nothing else changes.
- The AI only reads: holder name, title and the two dates, each of which may be "not found". It is told not to guess or calculate, and to treat the document as data.
- The code decides what is usable. Dates must be real dates in the right order, and it adds a note when the certificate has expired or is issued to someone else. These checks are pure functions with unit tests.
- The person decides. The result is a proposal in the dialog; "Use these dates" fills the form, and nothing is written to FSM before Save.
- The key stays on the server, like the FSM secret, and the bundle check covers it. The file is only sent when the user clicks the button, and there is a cap on reads per hour.
- The answer is requested as structured output, so its shape is guaranteed by the API and not parsed from free text.
- `npm run eval:ai` reads five invented certificates (English, German, an image, one without dates and one with an instruction hidden in the text) and compares the answers with the known ones. It calls the real service, so it is run by hand and not in CI.

## Tooling

- `npm run gate` runs typecheck, lint, the format check, unit tests, the build, a check that neither the OAuth secret nor the AI key is in any file the browser downloads, and the browser tests. CI runs the same steps.
- Unit tests (Vitest) cover the pure rules: statuses, dates, file checks, namespace checks and the mapping of FSM responses.
- Browser tests (Playwright) run against the production build with FSM mocked in the browser, so CI needs no credentials and never writes to the shared company. One of them checks that the matrix loads with four FSM calls.
- `npm run smoke` exercises the service layer against the real company and deletes what it created.
- `npm run seed` creates 5 skills, 10 assignments and 4 sample certificates with dates relative to today, and skips what already exists. `npm run cleanup` only lists unless called with `-- --yes`.
