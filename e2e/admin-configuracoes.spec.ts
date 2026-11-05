import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
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

const STORE_ASSETS = "variants/00000000-0000-4000-8000-000000000001/";
const storeObjects = async (): Promise<string[]> =>
  (await db.query("select name from storage.objects where bucket_id = 'product-image-variants' and name like $1", [`${STORE_ASSETS}%`]))
    .rows.map((r: { name: string }) => r.name);

test.afterAll(async () => {
  // Rede de segurança: se um teste caiu no meio, nenhum arquivo enviado fica no bucket.
  const left = await storeObjects();
  if (left.length) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.storage.from("product-image-variants").remove(left);
  }
  await db.query("delete from storage_deletions where path like $1", [`${STORE_ASSETS}%`]);
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

const entityAudit = async (action: string, entityId: string) =>
  (await db.query(
    "select count(*)::int as n from audit_log where actor_id = $1 and action = $2 and entity_type = 'settings' and entity_id = $3",
    [owner.id, action, entityId],
  )).rows[0].n;

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

  expect(await entityAudit("settings_update", "legal")).toBe(1);

  await page.goto("/termos");
  await expect(page.getByText(termsText)).toBeVisible();

  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.legal).getByRole("button", { name: copy.restore }).click();
  await expect(page.getByText(copy.restored)).toBeVisible({ timeout: 30_000 });
  expect(await entityAudit("settings_restore", "legal")).toBe(1);
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
  expect(await entityAudit("settings_update", "behavior")).toBe(1);

  await page.goto("/busca");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("article").getByText(/R\$/)).toHaveCount(0);

  await page.goto("/admin/configuracoes");
  await section(page, copy.sectionLabels.behavior).getByRole("button", { name: copy.restore }).click();
  await expect(page.getByText(copy.restored)).toBeVisible({ timeout: 30_000 });
  expect(await entityAudit("settings_restore", "behavior")).toBe(1);
});

const png = (size: number, color: string) =>
  sharp({ create: { width: size, height: size, channels: 4, background: color } }).png().toBuffer();
const settingValue = async (key: string) =>
  (await db.query("select value from store_settings where key = $1", [key])).rows[0]?.value;
const objectName = (url: string) => url.split("/product-image-variants/")[1];

test("logo e hero enviados aparecem na vitrine; o anterior sai do bucket; restaurar limpa tudo", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, owner);
  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle");
  const store = section(page, copy.sectionLabels.store);
  const upload = async (label: string, buffer: Buffer) => {
    await store.getByLabel(label).setInputFiles({ name: "arquivo.png", mimeType: "image/png", buffer });
  };

  // Logo pequeno demais é recusado e nada é gravado.
  await upload(copy.logoLight, await png(32, "#ff0000"));
  await expect(page.getByText(copy.assetTooSmall.replace("{min}", "64"))).toBeVisible({ timeout: 30_000 });
  expect(await settingValue("store")).toBeUndefined();

  await upload(copy.logoLight, await png(200, "#ff0000"));
  await expect.poll(async () => (await settingValue("store"))?.logo?.light, { timeout: 60_000 }).toContain("/product-image-variants/");
  const first = (await settingValue("store")).logo.light as string;
  const firstOg = (await settingValue("share")).og_image as string;
  expect((await page.request.get(first)).status()).toBe(200);
  expect((await page.request.get(firstOg)).headers()["content-type"]).toContain("image/jpeg");

  // Texto digitado e não salvo sobrevive ao envio do arquivo.
  await store.getByLabel(copy.storeName).fill(`${storeName}-rascunho`);
  await upload(copy.logoLight, await png(300, "#0000ff"));
  await expect.poll(async () => (await settingValue("store")).logo.light, { timeout: 60_000 }).not.toBe(first);
  const second = (await settingValue("store")).logo.light as string;
  const secondOg = (await settingValue("share")).og_image as string;
  await expect(store.getByLabel(copy.storeName)).toHaveValue(`${storeName}-rascunho`);
  // O logo anterior e o OG anterior saem do bucket e da fila.
  await expect.poll(storeObjects, { timeout: 60_000 }).toEqual([objectName(second), objectName(secondOg)].sort());
  expect((await db.query("select 1 from storage_deletions where path like $1", [`${STORE_ASSETS}%`])).rowCount).toBe(0);

  // Salvar o nome depois do upload não perde o logo.
  await store.getByLabel(copy.storeName).fill(storeName);
  await store.getByRole("button", { name: copy.save }).click();
  await expect.poll(async () => (await settingValue("store")).name, { timeout: 30_000 }).toBe(storeName);
  expect((await settingValue("store")).logo.light).toBe(second);

  await page.goto("/");
  await expect(page.locator(`img[src*="${encodeURIComponent(objectName(second))}"]`).first()).toBeAttached();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", secondOg);

  await expect.poll(() => entityAudit("settings_update", "store"), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);

  // Banner da home.
  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle");
  await section(page, copy.sectionLabels.home).getByLabel(copy.heroImage).setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: await png(900, "#00aa00") });
  await expect.poll(async () => (await settingValue("hero"))?.image_url, { timeout: 60_000 }).toContain("/product-image-variants/");
  const hero = (await settingValue("hero")).image_url as string;
  expect((await page.request.get(hero)).status()).toBe(200);

  // Restaurar volta aos arquivos locais e esvazia o bucket.
  await section(page, copy.sectionLabels.home).getByRole("button", { name: copy.restore }).click();
  await expect(page.getByText(copy.restored)).toBeVisible({ timeout: 30_000 });
  await section(page, copy.sectionLabels.store).getByRole("button", { name: copy.restore }).click();
  await expect.poll(storeObjects, { timeout: 60_000 }).toEqual([]);
  expect((await db.query("select 1 from storage_deletions where path like $1", [`${STORE_ASSETS}%`])).rowCount).toBe(0);
  expect(await settingValue("share")).toBeUndefined();
  expect(await settingValue("hero")).toBeUndefined();
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-padrao\.jpg$/);
});

test("foto real acima de 1 MB é aceita pelo upload (limite de corpo da Server Action)", async ({ page }) => {
  test.setTimeout(120_000);
  const noise = await sharp(randomBytes(1000 * 1000 * 3), { raw: { width: 1000, height: 1000, channels: 3 } }).png().toBuffer();
  expect(noise.length).toBeGreaterThan(2 * 1024 * 1024);
  await login(page, owner);
  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle");
  await section(page, copy.sectionLabels.home).getByLabel(copy.heroImage).setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: noise });
  await expect.poll(async () => (await settingValue("hero"))?.image_url, { timeout: 60_000 }).toContain("/product-image-variants/");
  await section(page, copy.sectionLabels.home).getByRole("button", { name: copy.restore }).click();
  await expect.poll(storeObjects, { timeout: 60_000 }).toEqual([]);
});

test("arquivo acima de 4 MB recebe a mensagem de tamanho, não o erro genérico", async ({ page }) => {
  test.setTimeout(120_000);
  const big = Buffer.concat([await png(100, "#ff0000"), Buffer.alloc(4 * 1024 * 1024)]);
  await login(page, owner);
  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle");
  await section(page, copy.sectionLabels.store).getByLabel(copy.logoDark).setInputFiles({ name: "enorme.png", mimeType: "image/png", buffer: big });
  await expect(page.getByText(copyAdminPtBr.upload.errorTooLarge)).toBeVisible({ timeout: 30_000 });
  expect(await settingValue("store")).toBeUndefined();
});

test("atendimento: modelo inválido é recusado, a prévia usa produto fictício e acompanha a edição", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, owner);
  await page.goto("/admin/configuracoes");
  await page.waitForLoadState("networkidle");
  const contact = section(page, copy.sectionLabels.contact);
  const preview = contact.getByTestId("whatsapp-preview");

  await expect(preview).toContainText(copy.previewLines[0].name);
  await contact.getByLabel(copy.itemTemplate).fill("{product_name} - {qty} un. teste-e2e");
  await expect(preview).toContainText(`${copy.previewLines[0].name} - 2 un. teste-e2e`);

  await contact.getByLabel(copy.itemTemplate).fill("{product_name} {preço}");
  await expect(contact.getByRole("alert")).toContainText("{preço}");
  await contact.getByRole("button", { name: copy.save }).click();
  await expect(page.getByText(/Marcador desconhecido: \{preço\}/).first()).toBeVisible({ timeout: 30_000 });
  expect(await settingValue("contact")).toBeUndefined();

  await contact.getByLabel(copy.whatsappNumber).fill("123");
  await contact.getByLabel(copy.itemTemplate).fill("{product_name} teste-e2e");
  await contact.getByRole("button", { name: copy.save }).click();
  await expect(page.getByText(copy.errorInvalid).first()).toBeVisible({ timeout: 30_000 });
  expect(await settingValue("contact")).toBeUndefined();

  await contact.getByLabel(copy.whatsappNumber).fill("+55 (00) 00000-0000");
  await contact.getByRole("button", { name: copy.save }).click();
  await expect.poll(() => settingValue("contact"), { timeout: 30_000 }).toMatchObject({
    whatsapp_number: "5500000000000",
    whatsapp_item_template: "{product_name} teste-e2e",
  });
  expect(await entityAudit("settings_update", "contact")).toBe(1);

  await contact.getByRole("button", { name: copy.restore }).click();
  await expect.poll(() => settingValue("contact"), { timeout: 30_000 }).toBeUndefined();
});
