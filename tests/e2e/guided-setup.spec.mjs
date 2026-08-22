import { expect, test } from "@playwright/test";

test("guided setup covers profile-repo creation, workflow handoff, and first run", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => { globalThis.__projectMapCopied = text; },
      },
    });
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedClick() {
      if (this.href.startsWith("https://github.com/")) {
        globalThis.__projectMapOpened = this.href;
        return;
      }
      return nativeClick.call(this);
    };
  });

  await page.goto("/");
  await expect(page.locator("#createProfileRepoOnGitHub")).toBeHidden();
  await expect(page.locator("#addWorkflowOnGitHub")).toBeHidden();
  await expect(page.locator("#runWorkflowOnGitHub")).toBeHidden();

  await page.locator("#username").fill("example");
  await page.getByRole("button", { name: "Generate setup" }).click();

  const profileLink = page.locator("#createProfileRepoOnGitHub");
  const addButton = page.locator("#addWorkflowOnGitHub");
  const runLink = page.locator("#runWorkflowOnGitHub");
  await expect(profileLink).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(runLink).toBeVisible();

  const profileUrl = new URL(await profileLink.getAttribute("href"));
  expect(profileUrl.origin + profileUrl.pathname).toBe("https://github.com/new");
  expect(profileUrl.searchParams.get("name")).toBe("example");
  expect(profileUrl.searchParams.get("owner")).toBe("example");
  expect(profileUrl.searchParams.get("visibility")).toBe("public");
  await expect(profileLink).toHaveAttribute("title", /Add README/);
  await expect(runLink).toHaveAttribute("href", "https://github.com/example/example/actions/workflows/project-map.yml");

  await addButton.click();

  const handoff = await page.evaluate(() => ({
    copied: globalThis.__projectMapCopied,
    opened: globalThis.__projectMapOpened,
  }));
  expect(handoff.copied).toContain("name: Update project map");
  expect(handoff.copied).toContain("generate-project-map.yml@v1");
  expect(handoff.opened).toContain("https://github.com/example/example/new/main?");
  expect(new URL(handoff.opened).searchParams.get("filename")).toBe(".github/workflows/project-map.yml");
  await expect(page.locator("#status")).toContainText("Workflow copied");
});
