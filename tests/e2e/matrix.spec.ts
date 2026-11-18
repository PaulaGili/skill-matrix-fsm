import { expect, test } from "@playwright/test";
import { mockFsm } from "./fsm-mock";

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

  await page.getByRole("button", { name: "Expired, filter off" }).click();

  await expect(page.getByText("Persons (1)")).toBeVisible();
  await expect(page.getByText("Conti, Carla")).toBeVisible();
  await expect(page.getByText("Aerni, Anna")).toBeHidden();
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
  await page.route("**/api/ai/certificate", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { enabled: true } })
      : route.fulfill({ json: { holderName: "Eva Graf", validFrom: "2026-03-01", validTo: "2028-02-29" } }),
  );
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
  await page.route("**/api/ai/certificate", (route) => route.fulfill({ json: { enabled: false } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Baumann, Beat, First Aid: not assigned. Assign" }).click();
  await page.locator("ui5-file-uploader input[type=file]").setInputFiles("tests/fixtures/sample-certificate.pdf");

  await expect(page.getByText("sample-certificate.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read dates" })).toBeHidden();
});

test("the expiry page lists what ends soon, soonest first", async ({ page }) => {
  const calls = await mockFsm(page);
  await page.goto("/expiry");

  await expect(page.getByText("Expiring assignments (1)")).toBeVisible();
  await expect(page.getByText("in 10 days")).toBeVisible();
  await expect(page.getByText("Baumann, Beat")).toBeVisible();
  await expect(page.getByText("Conti, Carla")).toBeHidden();
  expect(calls).toHaveLength(4);
});

test("a question in plain words sets the filters", async ({ page }) => {
  await mockFsm(page);
  let sent: unknown;
  await page.route("**/api/ai/certificate", (route) => route.fulfill({ json: { enabled: true } }));
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
  await expect(page.getByText("Persons (2)")).toBeVisible();
  // Only the question and the names of skills and levels are sent, no persons.
  expect(sent).toEqual({ question: "who can weld?", skills: ["First Aid", "Welding"], levels: ["Basic", "Expert"] });

  // A skill that does not exist changes no filter.
  await ask("who is certified for diving?");
  await expect(page.getByText("There is no skill or level called Diving, so no filter was set.")).toBeVisible();
  await expect(page.getByText("Persons (2)")).toBeVisible();
});

test("the language switch shows the app in German and remembers the choice", async ({ page }) => {
  await mockFsm(page);
  await page.goto("/");
  await expect(page.getByText("Persons (3)")).toBeVisible();

  await page.getByText("DE", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Qualifikationsmatrix" })).toBeVisible();
  await expect(page.getByText("Personen (3)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baumann, Beat, Welding: Läuft bald ab. Bearbeiten" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abgelaufen, Filter aus" })).toBeVisible();
  await expect(page).toHaveTitle("Qualifikationsverwaltung");

  await page.getByRole("button", { name: "Baumann, Beat, First Aid: nicht zugewiesen. Zuweisen" }).click();
  await expect(page.getByText("Gültig ab", { exact: true })).toBeVisible();
  await expect(page.getByText("Zertifikate (0)")).toBeVisible();
  const from = page.locator("#valid-from input");
  const to = page.locator("#valid-to input");
  await from.fill("01.01.2026");
  await from.press("Tab");
  await to.fill("31.12.2025");
  await to.press("Tab");
  await expect(page.getByRole("alert")).toHaveText("Gültig bis darf nicht vor Gültig ab liegen.");
  await expect(page.getByRole("button", { name: "Zuweisen", exact: true })).toBeDisabled();
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
  await page.route("**/api/ai/certificate", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/ai/import-columns", (route) => {
    titles = route.request().postDataJSON();
    return route.fulfill({ json: { person: "Wer", skill: "Was", level: null, validFrom: null, validTo: "Ablauf" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  const csv = ["Wer;Was;Ablauf", "Carla Conti;Welding;31.12.2030", "Anna Aerni;Welding;", "Nobody;Welding;", "Beat Baumann;First Aid;soon"].join("\n");
  await page.locator("ui5-file-uploader input[type=file]").setInputFiles({ name: "skills.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  // Unusual titles go to the AI, the rows do not.
  await expect(page.getByText("The columns were matched by AI from their titles only.")).toBeVisible();
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
