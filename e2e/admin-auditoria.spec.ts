import { test, expect, type Page } from "@playwright/test";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { createE2eAccount, db, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

test.describe.configure({ mode: "serial" });

const runId = Date.now();
const categoryName = `e2e-aud-cat-${runId}`;
const firstName = `e2e-aud-${runId}`;
const secondName = `e2e-aud-editado-${runId}`;
let account: E2eAccount;
let accountName = "";

test.beforeAll(async () => {
  account = await createE2eAccount({ mustChangePassword: false });
  accountName = `e2e-autor-${runId}`;
  await db.query("update profiles set name = $2 where id = $1", [account.id, accountName]);
  await db.query("insert into categories (name, slug) values ($1, $2)", [categoryName, categoryName]);
});

test.afterAll(async () => {
  await db.query("delete from audit_log where actor_id = $1", [account.id]);
  await db.query("delete from products where name in ($1, $2)", [firstName, secondName]);
  await db.query("delete from categories where name = $1", [categoryName]);
  await deleteE2eAccount(account.id);
  await db.end();
});

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(account.email);
  await page.getByLabel(copyAdminPtBr.login.password).fill(account.password);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
}

test("criar, editar, mover à lixeira e restaurar geram 4 linhas com o autor certo", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  await page.goto("/admin/produtos/novo");
  await page.getByLabel(copyAdminPtBr.products.category).click();
  await page.getByRole("option", { name: categoryName }).click();
  await page.getByLabel(copyAdminPtBr.products.name).fill(firstName);
  await page.getByRole("button", { name: copyAdminPtBr.products.saveDraft }).click();
  await expect(page).toHaveURL(/\/admin\/produtos\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/, { timeout: 30_000 });

  await page.getByLabel(copyAdminPtBr.products.name).fill(secondName);
  await page.getByRole("button", { name: copyAdminPtBr.products.saveDraft }).click();
  await expect.poll(async () => (await db.query("select 1 from audit_log where actor_id = $1 and action = 'update'", [account.id])).rowCount, { timeout: 30_000 }).toBe(1);

  await page.goto("/admin/produtos");
  await page.getByRole("row").filter({ hasText: secondName })
    .getByRole("button", { name: copyAdminPtBr.products.trash }).click();
  await page.getByRole("button", { name: copyAdminPtBr.products.trashConfirmAction }).click();
  await expect(page.getByText(copyAdminPtBr.products.trashed, { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/lixeira?tipo=produtos");
  await page.getByRole("row").filter({ hasText: secondName })
    .getByRole("button", { name: copyAdminPtBr.trash.restore }).click();
  await expect(page.getByText(copyAdminPtBr.trash.restoredProduct, { exact: true })).toBeVisible({ timeout: 30_000 });

  const { rows } = await db.query(
    "select action, actor_id, actor_name, entity_type, entity_label from audit_log where actor_id = $1 order by created_at",
    [account.id],
  );
  expect(rows.map((r) => r.action)).toEqual(["create", "update", "trash", "restore"]);
  for (const row of rows) {
    expect(row.entity_type).toBe("product");
    expect(row.actor_id).toBe(account.id);
    expect(row.actor_name).toBe(accountName);
  }
  expect(rows[0].entity_label).toBe(firstName);
  expect(rows[3].entity_label).toBe(secondName);
});
