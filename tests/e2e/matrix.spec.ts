import { expect, test } from "@playwright/test";
import { PREFIX, daysFromToday, mockFsm } from "./fsm-mock";

test("shows the status of every assignment and loads with four FSM calls", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Aerni, Anna, Welding: Valid. Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Baumann, Beat, Welding: Expiring soon. Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conti, Carla, First Aid: Expired. Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aerni, Anna, First Aid: not assigned. Assign" })).toBeVisible();
  await expect(page.getByText("Persons (3)")).toBeVisible();

  // Persons, skills, assignments and certificates. No call per person or per cell.
  expect(calls).toHaveLength(4);
});

test("a status filter keeps only the persons with a matching assignment", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");

  const status = page.getByRole("combobox", { name: "Filter by status" });
  await status.click();
  await page.keyboard.press("F4");
  await page.getByRole("option", { name: "Expired" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByText("Persons (1 of 3)")).toBeVisible();
  await expect(page.getByText("Conti, Carla")).toBeVisible();
  await expect(page.getByText("Aerni, Anna")).toBeHidden();

  // One button takes every filter away again.
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("Persons (3)")).toBeVisible();
});

test("an FSM error is shown to the user with a way to retry", async ({ page }) => {
  await mockFsm(page, { fail: true });
  await page.goto("/");

  await expect(page.getByText("FSM error (500): FSM is down")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("assigning a skill validates the dates and sends them to FSM", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Baumann, Beat, First Aid: not assigned. Assign" }).click();

  const from = page.locator("#valid-from input");
  const to = page.locator("#valid-to input");
  await from.fill("01.01.2026");
  await from.press("Tab");
  await to.fill("31.12.2025");
  await to.press("Tab");
  await expect(page.getByRole("alert")).toHaveText("Valid to must not be before valid from.");
  await expect(page.getByRole("button", { name: "Assign", exact: true })).toBeDisabled();

  await to.fill("31.12.2026");
  await to.press("Tab");
  await page.getByRole("button", { name: "Assign", exact: true }).click();

  await expect(page.getByText("Skill assigned.")).toBeVisible();
  const created = calls.find((call) => call.path === "skill/v2/skills");
  expect(created?.body).toEqual([{ tagId: "T2", technician: "P2", startDate: "2026-01-01", endDate: "2026-12-31" }]);
  // "No level" was chosen, so the default level FSM sets is cleared again.
  const cleared = calls.find((call) => call.method === "PATCH");
  expect(cleared?.body).toEqual({ proficiencyId: null, startDate: "2026-01-01", endDate: "2026-12-31", validityType: "LF" });
});

test("AI proposes the dates of a certificate and the user decides", async ({ page }) => {
  await mockFsm(page);
  await page.route("**/api/ai", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/ai/certificate", (route) => route.fulfill({ json: { holderName: "Eva Graf", validFrom: "2026-03-01", validTo: "2028-02-29" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Baumann, Beat, First Aid: not assigned. Assign" }).click();
  await page.locator("ui5-file-uploader input[type=file]").setInputFiles("tests/fixtures/sample-certificate.pdf");

  await page.getByRole("button", { name: "Read dates" }).click();
  await expect(page.getByText("Valid from 01.03.2026, valid to 29.02.2028")).toBeVisible();
  await expect(page.getByText('The certificate is issued to "Eva Graf", not to Baumann, Beat.')).toBeVisible();
  await expect(page.locator("#valid-from input")).toHaveValue("");

  await page.getByRole("button", { name: "Use these dates" }).click();
  await expect(page.locator("#valid-from input")).toHaveValue("01.03.2026");
  await expect(page.locator("#valid-to input")).toHaveValue("29.02.2028");
});

test("without an AI key the Read dates button is not offered", async ({ page }) => {
  await mockFsm(page);
  await page.route("**/api/ai", (route) => route.fulfill({ json: { enabled: false } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Baumann, Beat, First Aid: not assigned. Assign" }).click();
  await page.locator("ui5-file-uploader input[type=file]").setInputFiles("tests/fixtures/sample-certificate.pdf");

  await expect(page.getByText("sample-certificate.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read dates" })).toBeHidden();
});

test("the expiry page lists what ends soon, and on request what has already expired", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/expiry");

  await expect(page.getByText("Expiring assignments (1)")).toBeVisible();
  await expect(page.getByText("in 10 days")).toBeVisible();
  await expect(page.getByText("Baumann, Beat")).toBeVisible();
  await expect(page.getByText("Conti, Carla")).toBeHidden();
  expect(calls).toHaveLength(4);

  await page.locator("#expiry-window").click();
  await page.getByRole("option", { name: "Already expired" }).click();
  await expect(page.getByText("Expired assignments (1)")).toBeVisible();
  await expect(page.getByText("5 days ago")).toBeVisible();
  await expect(page.getByText("Conti, Carla")).toBeVisible();
});

test("a question in plain words sets the filters", async ({ page }) => {
  await mockFsm(page);
  let sent: unknown;
  await page.route("**/api/ai", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/ai/question", (route) => {
    sent = route.request().postDataJSON();
    const diving = String(route.request().postDataJSON().question).includes("diving");
    const answer = { understood: true, personSearch: null, skills: ["Welding"], statuses: [], levels: [], unknown: [] as string[] };
    return route.fulfill({ json: diving ? { ...answer, skills: [], statuses: ["valid", "expiring"], unknown: ["Diving"] } : answer });
  });
  await page.goto("/");
  const ask = async (question: string) => {
    await page.getByRole("textbox", { name: "Ask a question about the matrix" }).fill(question);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
  };

  await ask("who can weld?");
  await expect(page.getByText("Understood as: skill Welding, status Valid or Expiring soon.")).toBeVisible();
  await expect(page.getByText("Persons (2 of 3)")).toBeVisible();
  // Only the question and the names of skills and levels are sent, no persons.
  expect(sent).toEqual({ question: "who can weld?", skills: ["First Aid", "Welding"], levels: ["Basic", "Expert"] });

  // A skill that does not exist changes no filter.
  await ask("who is certified for diving?");
  await expect(page.getByText("There is no skill or level called Diving, so no filter was set.")).toBeVisible();
  await expect(page.getByText("Persons (2 of 3)")).toBeVisible();
});

test("the language switch shows the app in German and remembers the choice", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");
  await expect(page.getByText("Persons (3)")).toBeVisible();

  await page.getByText("DE", { exact: true }).click();

  await expect(page.getByRole("tab", { name: "Qualifikationsmatrix" })).toBeVisible();
  await expect(page.getByText("Personen (3)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baumann, Beat, Welding: Läuft bald ab. Bearbeiten" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Nach Status filtern" })).toBeVisible();
  await expect(page).toHaveTitle("Qualifikationsverwaltung");

  await page.getByRole("button", { name: "Baumann, Beat, First Aid: nicht zugewiesen. Zuweisen" }).click();
  await expect(page.getByText("Gültig ab", { exact: true })).toBeVisible();
  await expect(page.getByText("Zertifikate (0)")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();

  // The choice is stored, so it wins over the English browser language after a reload.
  await page.reload();
  await expect(page.getByText("Personen (3)")).toBeVisible();
});

test("a new assignment appears in the history of changes and can be undone", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Baumann, Beat, First Aid: not assigned. Assign" }).click();
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Skill assigned.")).toBeVisible();

  await page.goto("/history");
  await expect(page.getByText("Recent changes (1)")).toBeVisible();
  await expect(page.getByText("Assigned", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo: Baumann, Beat, First Aid" })).toBeVisible();
});

test("an import file is checked row by row before anything is saved", async ({ page }) => {
  const calls = await mockFsm(page);
  let titles: unknown;
  await page.route("**/api/ai", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/ai/import-columns", (route) => {
    titles = route.request().postDataJSON();
    return route.fulfill({ json: { person: "Wer", skill: "Was", level: null, validFrom: null, validTo: "Ablauf" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Additional Options" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();

  const csv = ["Wer;Was;Ablauf", "Carla Conti;Welding;31.12.2030", "Anna Aerni;Welding;", "Nobody;Welding;", "Beat Baumann;First Aid;soon"].join("\n");
  await page.locator("ui5-file-uploader input[type=file]").setInputFiles({ name: "skills.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  // Unusual titles go to the AI only on a click, the rows do not.
  expect(titles).toBeUndefined();
  await page.getByRole("button", { name: "Match columns with AI" }).click();
  await expect(page.getByText("The columns were matched by AI. Only the titles the app did not recognise were sent.")).toBeVisible();
  expect(titles).toEqual({ headers: ["Wer", "Was", "Ablauf"] });
  await expect(page.getByText("The person already has this skill.")).toBeVisible();
  await expect(page.getByText("No technician with this name.")).toBeVisible();
  await expect(page.getByText("A date could not be read. Use 31.12.2027.")).toBeVisible();

  const before = calls.length;
  await page.getByRole("button", { name: "Import 1 assignment" }).click();
  await expect(page.getByText("1 assignment imported.")).toBeVisible();
  const create = calls.slice(before).find((call) => call.path === "skill/v2/skills");
  expect(create?.body).toMatchObject([{ tagId: "T1", technician: "P3", endDate: "2030-12-31" }]);
});

test("a click on a person lists the skills, opens a certificate and offers the export", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Show all skills of Aerni, Anna" }).click();

  await expect(page.getByRole("heading", { name: "Skills (1)" })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Expert" })).toBeVisible();

  await page.getByRole("link", { name: "welding.pdf" }).click();
  await expect(page.getByText("Certificate: Aerni, Anna, Welding")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Certificate: Aerni, Anna, Welding")).toBeHidden();

  await page.locator("[ui5-dialog]").getByRole("button", { name: "Additional Options" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText("Columns to export (1 row)")).toBeVisible();
});

test("a skill column can be dragged to the right and to the left, and the order is kept", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");
  const skills = async () => (await page.getByRole("columnheader").allInnerTexts()).filter((text) => text !== "" && text !== "Person");
  const drag = (from: string, to: string) => page.getByRole("columnheader", { name: from }).dragTo(page.getByRole("columnheader", { name: to }));
  await expect.poll(skills).toEqual(["First Aid", "Welding"]);

  await drag("First Aid", "Welding");
  await expect.poll(skills).toEqual(["Welding", "First Aid"]);
  await page.reload();
  await expect.poll(skills).toEqual(["Welding", "First Aid"]);

  await drag("First Aid", "Welding");
  await expect.poll(skills).toEqual(["First Aid", "Welding"]);
});

test("the catalogue can be sorted and searched, and a skill shows who holds it", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/catalog");
  const names = page.locator("[ui5-table-row] [ui5-link]");
  await expect(names).toHaveText(["First Aid", "Welding"]);

  // The order is set in the view settings dialog.
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  await page.getByRole("listitem", { name: "Descending" }).click();
  await page.getByRole("listitem", { name: "Name" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(names).toHaveText(["Welding", "First Aid"]);

  await page.getByRole("textbox", { name: "Search skill" }).fill("weld");
  await expect(names).toHaveText(["Welding"]);

  await names.first().click();
  await expect(page.getByText("Persons (2)")).toBeVisible();
  await expect(page.getByText("Baumann, Beat")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Additional Options" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText("Excel (.xlsx)")).toBeVisible();
});

test("a technician picks the own name and sees the own skills, and the choice is remembered", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/me");
  await expect(page.getByText("My skills (0)")).toBeVisible();

  // Typing narrows the list. The first name of the list as well: a choice must be kept whichever it is.
  const name = page.locator("#me-person input");
  await name.pressSequentially("aer");
  await page.getByRole("option", { name: "Aerni, Anna" }).click();
  await expect(page.getByText("My skills (1)")).toBeVisible();
  await expect(page.getByText("welding.pdf")).toBeVisible();

  // A name typed in full is enough, without a click.
  await name.fill("");
  await name.pressSequentially("baumann, beat");
  await name.press("Enter");
  await expect(page.getByText("Expiring soon")).toBeVisible();

  await page.reload();
  await expect(page.getByText("My skills (1)")).toBeVisible();
  await expect(name).toHaveValue("Baumann, Beat");
});

// The required scope, end to end: catalogue, assignment, certificates.

test("the catalogue creates, renames and deletes a skill, always in our namespace", async ({ page }) => {
  const calls = await mockFsm(page);
  const tagWrites = () => calls.filter((call) => call.path === "skill/v2/tags");
  await page.goto("/catalog");
  await expect(page.getByText("Skills (2)")).toBeVisible();

  // A name that exists is refused before FSM is asked, whatever the capitals.
  await page.getByRole("button", { name: "Create skill" }).click();
  await page.locator("#skill-name input").fill("welding");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("A skill with this name already exists.", { exact: true })).toBeVisible();
  expect(tagWrites()).toHaveLength(0);

  await page.locator("#skill-name input").fill("Crane Operation");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Skill created.")).toBeVisible();
  expect(tagWrites()[0].body).toEqual([{ name: `${PREFIX}Crane Operation`, scaleId: "SCALE" }]);
  await expect(page.getByText("Skills (3)")).toBeVisible();

  await page.getByRole("button", { name: "Edit Crane Operation" }).click();
  await page.locator("#skill-name input").fill("Crane Operation II");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Skill saved.")).toBeVisible();
  expect(tagWrites()[1].body).toMatchObject([{ id: "T9", name: `${PREFIX}Crane Operation II` }]);

  await page.getByRole("button", { name: "Delete Crane Operation II" }).click();
  await expect(page.getByText("This skill is not assigned to anyone.")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Crane Operation II deleted.")).toBeVisible();
  expect(tagWrites()[2]).toMatchObject({ method: "DELETE", body: [{ id: "T9" }] });
  await expect(page.getByText("Skills (2)")).toBeVisible();
});

test("deleting a skill that is still assigned retires it by default and keeps the skill", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Delete Welding" }).click();
  await page.getByRole("button", { name: "Retire skill" }).click();
  await expect(page.getByText("Welding retired.")).toBeVisible();

  // Both holders end yesterday, in one request. Nothing is deleted.
  const yesterday = daysFromToday(-1);
  const ended = calls.filter((call) => call.path === "skill/v2/skills");
  expect(ended).toHaveLength(1);
  expect(ended[0].body).toMatchObject([
    { id: "A1", tagId: "T1", endDate: yesterday, validityType: "LF" },
    { id: "A2", tagId: "T1", endDate: yesterday, validityType: "LF" },
  ]);
  expect(calls.filter((call) => call.method === "DELETE")).toEqual([]);
  await expect(page.getByText("Skills (2)")).toBeVisible();
});

test("an assignment is edited: files are checked, a certificate is added and one deleted, the dates change", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Aerni, Anna, Welding: Valid. Edit" }).click();
  await expect(page.getByText("Certificates (1)")).toBeVisible();

  const files = page.locator("ui5-file-uploader input[type=file]");
  await files.setInputFiles([
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("notes") },
    { name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]);
  await expect(page.getByText("notes.txt: Only PDF, JPG and PNG files are allowed.")).toBeVisible();
  await expect(page.getByText("scan.pdf: The file is larger than 5 MB.")).toBeVisible();
  await expect(page.getByText("Certificates (1)")).toBeVisible();

  await files.setInputFiles("tests/fixtures/sample-certificate.pdf");
  await expect(page.getByText("Certificates (2)")).toBeVisible();
  await page.getByRole("button", { name: "Delete welding.pdf" }).click();
  await expect(page.getByText("Certificates (1)")).toBeVisible();

  const to = page.locator("#valid-to input");
  await to.fill("31.12.2030");
  await to.press("Tab");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Assignment saved.")).toBeVisible();

  // In this order: the assignment, the marked certificate, the new file.
  const writes = calls.filter((call) => call.method !== "POST" || call.path === "data/v4/Attachment");
  expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
    "PATCH skill/v1/tags/T1/skills/A1",
    "DELETE data/v4/Attachment/C1",
    "POST data/v4/Attachment",
  ]);
  expect(writes[0].body).toEqual({ proficiencyId: "L2", startDate: "2025-01-01", endDate: "2030-12-31", validityType: "LF" });
  expect(writes[2].body).toMatchObject({ fileName: "sample-certificate.pdf", type: "PDF", object: { objectId: "A1", objectType: "SKILL" } });
});

test("removing an assignment asks first and deletes its certificates before the assignment", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Aerni, Anna, Welding: Valid. Edit" }).click();
  await page.getByRole("button", { name: "Remove assignment..." }).click();
  expect(calls.filter((call) => call.method === "DELETE")).toEqual([]);

  await page.getByRole("button", { name: "Remove now" }).click();
  await expect(page.getByText("Assignment removed.")).toBeVisible();
  const deletes = calls.filter((call) => call.method === "DELETE");
  expect(deletes.map((call) => call.path)).toEqual(["data/v4/Attachment/C1", "skill/v2/skills"]);
  expect(deletes[1].body).toEqual([{ id: "A1" }]);
  await expect(page.getByRole("button", { name: "Aerni, Anna, Welding: not assigned. Assign" })).toBeVisible();
});
