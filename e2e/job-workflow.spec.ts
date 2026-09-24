import { expect, test } from "@playwright/test";

const posting = `Example Company is hiring a Software Engineer for a remote role. This sample posting asks for TypeScript, React, accessible interfaces, API integration, and clear collaboration with product partners. The engineer will build and maintain web features, review code, document decisions, and help troubleshoot production issues. Applicants should be comfortable learning unfamiliar tools and explaining tradeoffs.`;

test("a candidate can save a profile, analyze a job, and retain its status", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create candidate profile" }).first().click();

  await page.getByLabel("Headline").fill("Sample software engineer");
  await page.getByLabel("Education").fill("Sample coursework: web application development");
  await page.getByLabel("Skills").fill("TypeScript\nReact");
  await page.getByLabel("Résumé text").fill("Sample profile for a local workflow test. Coursework covered TypeScript and React web applications.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile version 1 saved");

  await page.getByLabel("Headline").fill("Sample full-stack software engineer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile version 2 saved");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Pipeline" }).click();
  await page.getByRole("link", { name: "Add a job" }).first().click();
  await page.getByRole("textbox", { name: "Job description", exact: true }).fill(posting);
  await page.getByRole("radio", { name: /Demo · mock mode/ }).check();
  await page.getByRole("button", { name: "Save job & analyze" }).click();
  await expect(page.getByRole("heading", { name: "Job saved" })).toBeVisible();
  await page.getByRole("link", { name: "Open saved job" }).click();

  await expect(page.getByRole("region", { name: "Current fit analysis" }).getByLabel("Fit score 82 out of 100")).toBeVisible();
  await expect(page.getByRole("region", { name: "Current résumé suggestions" })).toContainText("Review the candidate profile");
  await expect(page.getByRole("region", { name: "Current application draft" })).toContainText("Dear hiring team");
  await expect(page.getByRole("region", { name: "Workflow progress" }).getByRole("listitem")).toHaveCount(3);

  await page.getByLabel("Current status").selectOption("applied");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Status:")).toContainText("applied");

  await page.reload();
  await expect(page.getByLabel("Current status")).toHaveValue("applied");
  await expect(page.getByRole("region", { name: "Current fit analysis" }).getByLabel("Fit score 82 out of 100")).toBeVisible();
  await expect(page.getByRole("region", { name: "Current résumé suggestions" })).toContainText("Review the candidate profile");
  await expect(page.getByRole("region", { name: "Current application draft" })).toContainText("Dear hiring team");
});
