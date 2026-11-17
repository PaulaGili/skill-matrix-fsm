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
});
