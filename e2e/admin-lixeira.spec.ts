import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { createE2eAccount, db, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

test.describe.configure({ mode: "serial" });

const fixturePhoto = path.join(__dirname, "..", "public", "images", "clothes-placeholder-imagem.webp");
const copy = copyAdminPtBr.trash;
const runId = Date.now();
const categoryName = `e2e-lix-cat-${runId}`;
const productName = `e2e-lix-prod-${runId}`;
let owner: E2eAccount;
let manager: E2eAccount;
let productId = "";

test.beforeAll(async () => {
  owner = await createE2eAccount({ role: "owner", mustChangePassword: false });
  manager = await createE2eAccount({ mustChangePassword: false });
  const { rows } = await db.query("insert into categories (name, slug) values ($1, $1) returning id", [categoryName]);
  const product = await db.query(
    "insert into products (category_id, name, slug) values ($1, $2, $2) returning id",
    [rows[0].id, productName],
  );
  productId = product.rows[0].id;
});

test.afterAll(async () => {
  await db.query("delete from audit_log where actor_id = $1 or entity_label = $2", [owner.id, productName]);
  await db.query("delete from product_images where product_id = $1", [productId]);
  await db.query("delete from products where name in ($1, $2)", [productName, `${productName}-g`]);
  await db.query("delete from categories where name = $1", [categoryName]);
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

test("dono exclui de vez: arquivos saem do Storage, URL pública some e a auditoria fica", async ({ page, request }) => {
  test.setTimeout(150_000);
  await login(page, owner);

  await page.goto(`/admin/produtos/${productId}`);
  await page.locator("#product-gallery-file").setInputFiles(fixturePhoto);
  await expect(page.getByRole("listitem")).toHaveCount(1, { timeout: 60_000 });
  const variantUrl = await page.getByRole("listitem").locator("img").first().evaluate((img) => (img as HTMLImageElement).src);
  const { rows: images } = await db.query("select storage_path from product_images where product_id = $1", [productId]);
  const storagePath: string = images[0].storage_path;
  expect(storagePath).toBeTruthy();
  expect((await request.get(variantUrl)).ok()).toBe(true);

  // Cinco dias na lixeira: a tela deve mostrar quantos dias faltam.
  await db.query("update products set deleted_at = now() - interval '5 days' where id = $1", [productId]);
  await page.goto("/admin/lixeira?tipo=produtos");
  const row = page.getByRole("row").filter({ hasText: productName });
  await expect(row.getByText(copy.remainingDays(25))).toBeVisible();

  await row.getByRole("button", { name: copy.purge }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: copy.purge }).click();
  await expect(page.getByText(copy.purgedProduct, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("row").filter({ hasText: productName })).toHaveCount(0);

  expect((await db.query("select 1 from products where id = $1", [productId])).rowCount).toBe(0);
  expect((await db.query("select 1 from storage.objects where bucket_id = 'product-images' and name = $1", [storagePath])).rowCount).toBe(0);
  expect((await db.query("select 1 from storage_deletions where path = $1", [storagePath])).rowCount).toBe(0);
  // A CDN do Storage pode servir cache por alguns segundos depois da remoção.
  await expect.poll(async () => (await request.get(variantUrl)).status(), { timeout: 60_000 }).toBeGreaterThanOrEqual(400);

  const { rows: audit } = await db.query(
    "select action, actor_id from audit_log where entity_id = $1 and action = 'purge'",
    [productId],
  );
  expect(audit).toEqual([{ action: "purge", actor_id: owner.id }]);
});

test("gestor não vê o botão de exclusão definitiva", async ({ page }) => {
  const { rows } = await db.query("insert into products (category_id, name, slug, deleted_at) select id, $2, $2, now() from categories where name = $1 returning id", [categoryName, `${productName}-g`]);
  await login(page, manager);
  await page.goto("/admin/lixeira?tipo=produtos");
  const row = page.getByRole("row").filter({ hasText: `${productName}-g` });
  await expect(row.getByRole("button", { name: copy.restore })).toBeVisible();
  await expect(row.getByRole("button", { name: copy.purge })).toHaveCount(0);
  await db.query("delete from products where id = $1", [rows[0].id]);
});
