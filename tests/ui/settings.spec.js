import { test, expect } from "@playwright/test";

test("browser preview updates the countdown without export or module-save actions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByLabel("Inactivity duration")).toHaveValue("360");
  await page.getByRole("button", { name: "2 hours", exact: true }).click();
  await page.getByRole("switch", { name: "Dry run" }).click();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.locator("#remaining")).toHaveText("02:00:00");
  await page.getByRole("slider", { name: "Idle time", exact: true }).press("End");
  await expect(page.locator("#preview-state")).toHaveText(
    "Would log a dry-run event",
  );
  await page.getByRole("button", { name: "Screen on", exact: true }).click();
  await expect(page.locator("#remaining")).toHaveText("02:00:00");
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export config.sh" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("accelerated preview runs, pauses, and resets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator("#elapsed")).not.toHaveText("00:00:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#remaining")).toHaveText("06:00:00");
});

test("KernelSU bridge loads and saves actual module settings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.commands = [];
    window.ksu = {
      exec(command, options, callback) {
        window.commands.push(command);
        const stdout = command.endsWith(" read")
          ? "INACTIVE_MINUTES=90\nCHECK_INTERVAL=30\nBOOT_GRACE_SECONDS=60\nDRY_RUN=1\n"
          : "";
        setTimeout(() => window[callback](0, stdout, ""), 0);
      },
    };
  });
  await page.goto("/");
  await expect(page.getByLabel("Inactivity duration")).toHaveValue("90");
  await page.getByLabel("Inactivity duration").fill("120");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#feedback")).toContainText(
    "Changes apply at the next check",
  );
  expect(await page.evaluate(() => window.commands.at(-1))).toContain(
    "settings.sh save 120 30 60 1",
  );
  await expect(
    page.getByRole("button", { name: "Export config.sh" }),
  ).toBeHidden();
});

test("device read errors block saving until retry succeeds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let attempts = 0;
    window.ksu = {
      exec(command, options, callback) {
        const errno = attempts++ === 0 ? 1 : 0;
        setTimeout(
          () =>
            window[callback](
              errno,
              "INACTIVE_MINUTES=360\nCHECK_INTERVAL=60\nBOOT_GRACE_SECONDS=300\nDRY_RUN=0\n",
              "",
            ),
          0,
        );
      },
    };
  });
  await page.goto("/");
  await expect(page.locator("#feedback")).toContainText("Could not access");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
});

test("mobile pages fit the viewport and keep controls above the bottom bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByLabel("Inactivity duration")).toHaveValue("360");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  const navigation = page.getByRole("tablist", { name: "Main navigation" });
  await expect(navigation).toBeInViewport();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.locator("#remaining")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.locator("#reset-preview").scrollIntoViewIfNeeded();
  const reset = await page.locator("#reset-preview").boundingBox();
  const bar = await navigation.boundingBox();
  expect(reset.y + reset.height).toBeLessThanOrEqual(bar.y);
  await page.screenshot({
    path: "test-results/mobile-preview.png",
    fullPage: true,
  });
});

test("bottom navigation separates pages, preserves edits and pauses the counter", async ({ page }) => {
  await page.goto("/");
  const home = page.getByRole("tab", { name: "Home", exact: true });
  const preview = page.getByRole("tab", { name: "Preview", exact: true });
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Home", exact: true })).toBeVisible();
  await expect(page.locator("#preview-panel")).toBeHidden();
  await page.getByRole("button", { name: "3 days", exact: true }).click();
  await home.focus();
  await home.press("ArrowRight");
  await expect(preview).toBeFocused();
  await expect(preview).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#home-panel")).toBeHidden();
  await expect(page.locator("#remaining")).toHaveText("72:00:00");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator("#elapsed")).not.toHaveText("00:00:00");
  await home.click();
  const elapsed = await page.locator("#elapsed").textContent();
  await expect(page.getByLabel("Inactivity duration")).toHaveValue("4320");
  await preview.click();
  await expect(page.locator("#elapsed")).toHaveText(elapsed);
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  await preview.focus();
  await preview.press("Home");
  await expect(home).toBeFocused();
  await page.getByRole("button", { name: "24 hrs", exact: true }).click();
  await home.press("End");
  await expect(preview).toBeFocused();
  await expect(page.locator("#elapsed")).toHaveText("00:00:00");
  await expect(page.locator("#remaining")).toHaveText("24:00:00");
});

test("long-duration chips update the preview threshold", async ({ page }) => {
  await page.goto("/");
  for (const [label, minutes, remaining] of [
    ["24 hrs", "1440", "24:00:00"],
    ["3 days", "4320", "72:00:00"],
    ["7 days", "10080", "168:00:00"],
  ]) {
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByLabel("Inactivity duration")).toHaveValue(minutes);
    await page.getByRole("tab", { name: "Preview", exact: true }).click();
    await expect(page.locator("#remaining")).toHaveText(remaining);
    await page.getByRole("slider", { name: "Idle time", exact: true }).press("End");
    await expect(page.locator("#preview-state")).toHaveText("Would request a reboot");
  }
});

test("light and dark toggle follows system initially and persists an explicit choice", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode", exact: true });
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/m-theme-dark/);
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("html")).not.toHaveClass(/m-theme-dark/);
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/m-theme-dark/);
});

test("MiSans is loaded through jsDelivr", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator('link[rel="stylesheet"][href="https://cdn.jsdelivr.net/npm/misans@5.0.0/lib/Normal/MiSansVF.min.css"]'),
  ).toHaveCount(1);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("MiSans VF");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family === "MiSans VF" && font.status === "loaded",
      ),
    ),
  ).toBe(true);
});
