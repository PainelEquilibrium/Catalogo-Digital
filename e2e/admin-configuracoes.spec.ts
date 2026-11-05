import { test, expect, type Page } from "@playwright/test";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { createE2eAccount, db, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

// Grava em store_settings, que a vitrine inteira lê: roda em série e restaura tudo no fim.
test.describe.configure({ mode: "serial" });

const copy = copyAdminPtBr.settings;
const runId = Date.now();
const storeName = `e2e-loja-${runId}`;
const termsText = `e2e termos ${runId}`;
let owner: E2eAccount;
let manager: E2eAccount;
let snapshot: { key: string; value: unknown; updated_by: string | null }[] = [];

test.beforeAll(async () => {
  snapshot = (await db.query("select key, value, updated_by from store_settings")).rows;
  owner = await createE2eAccount({ role: "owner", mustChangePassword: false });
  manager = await createE2eAccount({ mustChangePassword: false });
});

test.afterAll(async () => {
  await db.query("delete from store_settings");
  for (const row of snapshot) {
    await db.query("insert into store_settings (key, value, updated_by) values ($1, $2::jsonb, $3)", [
      row.key,
      JSON.stringify(row.value),
      row.updated_by,
    ]);
  }
  await deleteE2eAccount(owner.id);
  await deleteE2eAccount(manager.id);
  await db.end();
});

async function login(page: Page, who: E2eAccount) {
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(who.email);
  await page.getByLabel(copyAdminPtBr.login.password).fill(who.password);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
}

const section = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const auditCount = async (action: string) =>
  (await db.query("select count(*)::int as n from audit_log where actor_id = $1 and action = $2", [owner.id, action]))
    .rows[0].n;

test("gestor é negado na tela e não vê o menu", async ({ page }) => {
  await login(page, manager);
  await expect(page.getByRole("link", { name: copyAdminPtBr.chrome.settings })).toHaveCount(0);
  await page.goto("/admin/configuracoes");
  await expect(page).toHaveURL(/\/admin\/sem-acesso/);
});

test("dono altera nome e cor, a vitrine reflete e restaurar volta", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner);
  await page.goto("/admin/configuracoes");

  await section(page, copy.sectionLabels.store).getByLabel(copy.storeName).fill(storeName);
  await section(page, copy.sectionLabels.store).getByRole("button", { name: copy.save }).click();
  await expect(page.getByText(copy.saved)).toBeVisible({ timeout: 30_000 });

  await section(page, copy.sectionLabels.theme).getByLabel(copy.colorPrimary).fill("#123456");
  await section(page, copy.sectionLabels.theme).getByRole("button", { name: copy.save }).click();
  await expect.poll(() => auditCount("settings_update"), { timeout: 30_000 }).toBe(2);

  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: storeName })).toBeVisible();
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim().toLowerCase(),
  );
  expect(primary).toBe("#123456");

  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.store).getByRole("button", { name: copy.restore }).click();
  await expect.poll(() => auditCount("settings_restore"), { timeout: 30_000 }).toBe(1);
  await section(page, copy.sectionLabels.theme).getByRole("button", { name: copy.restore }).click();
  await expect.poll(() => auditCount("settings_restore"), { timeout: 30_000 }).toBe(2);
  const left = await db.query("select 1 from store_settings where key in ('store', 'theme')");
  expect(left.rowCount).toBe(0);
});

test("dono altera os termos e /termos reflete", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner);
  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.legal).getByLabel(copy.legalTerms).fill(termsText);
  await section(page, copy.sectionLabels.legal).getByRole("button", { name: copy.save }).click();
  await expect(page.getByText(copy.saved)).toBeVisible({ timeout: 30_000 });

  await page.goto("/termos");
  await expect(page.getByText(termsText)).toBeVisible();

  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.legal).getByRole("button", { name: copy.restore }).click();
  await expect(page.getByText(copy.restored)).toBeVisible({ timeout: 30_000 });
  await page.goto("/termos");
  await expect(page.getByText(termsText)).toHaveCount(0);
  await expect(page.getByText(/suporte técnico/i).first()).toBeVisible();
});

test("desligar preços pede confirmação e a vitrine deixa de mostrar preços", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner);
  await page.goto("/busca");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("article").getByText(/R\$/).first()).toBeVisible();

  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle"); // hidratação: antes dela o checkbox é nativo e o React o reverte
  await section(page, copy.sectionLabels.behavior).getByLabel(copy.showPrices).uncheck();
  await section(page, copy.sectionLabels.behavior).getByRole("button", { name: copy.save }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/Meta/);
  const early = await db.query("select 1 from store_settings where key = 'behavior'");
  expect(early.rowCount).toBe(0);
  await dialog.getByRole("button", { name: copy.showPricesConfirmAction }).click();
  await expect(page.getByText(copy.saved)).toBeVisible({ timeout: 30_000 });

  await page.goto("/busca");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("article").getByText(/R\$/)).toHaveCount(0);

  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.behavior).getByRole("button", { name: copy.restore }).click();
  await expect(page.getByText(copy.restored)).toBeVisible({ timeout: 30_000 });
});
