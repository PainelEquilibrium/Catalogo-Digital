import { test, expect, type Page } from "@playwright/test";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { countCategoriesNamed, db, mustChangePassword, setMustChangePassword } from "./support/cleanup";
import { createE2eAccount, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

test.describe.configure({ mode: "serial" });

let account: E2eAccount;
const newPassword = `Nova-${Date.now()}-Bb2!`;

test.beforeAll(async () => {
  account = await createE2eAccount();
});

test.afterAll(async () => {
  if (account) await deleteE2eAccount(account.id);
  await db.end();
});

async function login(page: Page, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(account.email);
  await page.getByLabel(copyAdminPtBr.login.password).fill(password);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
}

const setPending = (value: boolean) => setMustChangePassword(account.id, value);

test("com troca pendente, qualquer rota do painel leva à troca", async ({ page }) => {
  await login(page, account.password);
  await expect(page).toHaveURL(/\/admin\/atualizar-senha/, { timeout: 30_000 });
  await page.goto("/admin/produtos");
  await expect(page).toHaveURL(/\/admin\/atualizar-senha/);
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin\/atualizar-senha/);
});

test("Server Action do painel nega durante a troca pendente", async ({ page }) => {
  const name = `e2e-senha-${Date.now()}`;
  await setPending(false);
  await login(page, account.password);
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
  await page.goto("/admin/categorias/novo");
  await page.getByLabel(copyAdminPtBr.categories.name).fill(name);

  // A página já carregada continua com a Server Action; só o banco muda para "pendente".
  await setPending(true);
  const actionCall = page.waitForRequest((req) => req.method() === "POST" && "next-action" in req.headers());
  await page.getByRole("button", { name: copyAdminPtBr.categories.save }).click();
  const response = await (await actionCall).response();
  expect(response).not.toBeNull();

  await expect.poll(() => countCategoriesNamed(name)).toBe(0);
  await page.waitForTimeout(1_000);
  expect(await countCategoriesNamed(name)).toBe(0);
});

test("nova senha igual à temporária é recusada com mensagem", async ({ page }) => {
  await login(page, account.password);
  await expect(page).toHaveURL(/\/admin\/atualizar-senha/, { timeout: 30_000 });
  await page.getByLabel(copyAdminPtBr.password.password, { exact: true }).fill(account.password);
  await page.getByLabel(copyAdminPtBr.password.confirmation).fill(account.password);
  await page.getByRole("button", { name: copyAdminPtBr.password.update }).click();
  await expect(page.getByText(copyAdminPtBr.password.errorSamePassword)).toBeVisible({ timeout: 30_000 });
  expect(await mustChangePassword(account.id)).toBe(true);
});

test("após trocar, o painel abre e a flag cai", async ({ page }) => {
  await login(page, account.password);
  await expect(page).toHaveURL(/\/admin\/atualizar-senha/, { timeout: 30_000 });
  await page.getByLabel(copyAdminPtBr.password.password, { exact: true }).fill(newPassword);
  await page.getByLabel(copyAdminPtBr.password.confirmation).fill(newPassword);
  await page.getByRole("button", { name: copyAdminPtBr.password.update }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: copyAdminPtBr.chrome.changePassword })).toBeVisible();
  expect(await mustChangePassword(account.id)).toBe(false);
});

test("/admin/recuperar-senha retorna 404 e login não tem o link", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("link", { name: /esqueci/i })).toHaveCount(0);
  await expect(page.locator('a[href*="recuperar-senha"]')).toHaveCount(0);

  // Anônimo cai no login pelo proxy (rota protegida); logada, a rota inexistente dá 404.
  await login(page, newPassword);
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
  const response = await page.goto("/admin/recuperar-senha");
  expect(response?.status()).toBe(404);
});
