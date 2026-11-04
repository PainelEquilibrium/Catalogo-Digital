import { test, expect } from "@playwright/test";
import { copyPtBr } from "../src/lib/copy/pt-br";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";

test("tema: área logada compartilha preferência com a vitrine", async ({ page }) => {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) throw new Error("Defina as credenciais ADMIN_SEED para testar o painel.");

  await page.addInitScript(() => {
    if (!localStorage.getItem("catalogo-theme")) localStorage.setItem("catalogo-theme", "light");
  });
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(email);
  await page.getByLabel(copyAdminPtBr.login.password).fill(password);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
  const shell = page.locator(".admin-shell");
  const lightBackground = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: copyPtBr.theme.toggleDark }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).not.toHaveClass(/theme-transition/);
  expect(await shell.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  await page.reload();
  await expect(page.getByRole("button", { name: copyPtBr.theme.toggleLight })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: copyPtBr.theme.toggleLight })).toBeVisible();
});

for (const scenario of ["animated", "unsupported", "reduced-motion", "blocked-storage"] as const) {
  test(`tema: ${scenario}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: scenario === "reduced-motion" ? "reduce" : "no-preference" });
    await page.addInitScript((scenario) => {
      localStorage.setItem("catalogo-theme", "light");
      if (scenario === "unsupported") {
        Object.defineProperty(document, "startViewTransition", { value: undefined });
      }
      if (scenario === "blocked-storage") {
        Storage.prototype.setItem = () => { throw new Error("Storage blocked"); };
      }
    }, scenario);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const toggle = page.getByRole("button", { name: copyPtBr.theme.toggleDark });
    await expect(toggle.locator("svg")).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: copyPtBr.theme.toggleLight })).toBeVisible();
    if (scenario !== "blocked-storage") {
      expect(await page.evaluate(() => localStorage.getItem("catalogo-theme"))).toBe("dark");
    }
    await expect(page.locator("html")).not.toHaveClass(/theme-transition/);
    await page.getByRole("button", { name: copyPtBr.theme.toggleLight }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });
}
