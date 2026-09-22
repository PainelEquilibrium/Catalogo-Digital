import { test, expect } from "@playwright/test";
import path from "node:path";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";

const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD;

const fixturePng = path.join(__dirname, "fixtures", "ok.png");

const runId = Date.now();
const categoryName = `e2e-${runId}`;
let categorySlug = "";
const productName = `e2e-produto-${runId}`;

function requireAdminSeedEnv(): void {
  if (!adminEmail?.trim() || !adminPassword?.trim()) {
    throw new Error(
      "Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD no ambiente de teste.",
    );
  }
}

async function loginAsSeedAdmin(page: import("@playwright/test").Page) {
  requireAdminSeedEnv();
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(adminEmail!);
  await page.getByLabel(copyAdminPtBr.login.password).fill(adminPassword!);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/);
}

async function expectProductOnCollection(
  page: import("@playwright/test").Page,
  slug: string,
  name: string,
  visible: boolean,
) {
  await page.goto(`/colecao/${slug}`);
  const nameLink = page.getByRole("link", { name, exact: true });
  if (visible) {
    await expect(nameLink.first()).toBeVisible();
  } else {
    await expect(nameLink).toHaveCount(0);
  }
}

test.describe.configure({ mode: "serial" });

test.describe("admin do catálogo", () => {
  test("visitante em /admin/produtos é redirecionado ao login", async ({
    page,
  }) => {
    await page.goto("/admin/produtos");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login com seed abre a lista de produtos", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: copyAdminPtBr.products.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: copyAdminPtBr.chrome.products }),
    ).toBeVisible();
  });

  test("cria categoria com campo select filterable", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await page.goto("/admin/categorias/novo");

    await page.getByLabel(copyAdminPtBr.categories.name).fill(categoryName);
    categorySlug = await page
      .getByLabel(copyAdminPtBr.categories.slug)
      .inputValue();

    await page
      .getByRole("button", { name: copyAdminPtBr.categories.addField })
      .click();

    const fieldPanel = page.locator("div.rounded-xl.border").last();
    await fieldPanel.locator('input[id$="-key"]').fill("material");
    await fieldPanel.locator('input[id$="-label"]').fill("Material");

    await fieldPanel.locator('[id$="-type"]').click();
    await page
      .getByRole("option", { name: copyAdminPtBr.categories.typeSelect })
      .click();

    await fieldPanel
      .getByRole("checkbox", { name: copyAdminPtBr.categories.fieldFilterable })
      .check();

    await fieldPanel
      .getByRole("button", { name: copyAdminPtBr.categories.addOption })
      .click();
    await fieldPanel.locator("div.flex.gap-2 input").first().fill("Algodão");

    await page
      .getByRole("button", { name: copyAdminPtBr.categories.save })
      .click();

    await expect(page).not.toHaveURL(/\/admin\/categorias\/novo$/);
    await expect(page).toHaveURL(/\/admin\/categorias\/[^/]+$/);
    await expect(
      page.getByText(copyAdminPtBr.categories.saved, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel(copyAdminPtBr.categories.name)).toHaveValue(
      categoryName,
    );
  });

  test("produto rascunho com uma foto não aparece na vitrine", async ({
    page,
  }) => {
    await loginAsSeedAdmin(page);
    await page.goto("/admin/produtos/novo");

    await page.getByLabel(copyAdminPtBr.products.category).click();
    await page.getByRole("option", { name: categoryName }).click();
    await page.getByLabel(copyAdminPtBr.products.name).fill(productName);

    await page
      .getByRole("button", { name: copyAdminPtBr.products.saveDraft })
      .click();
    await expect(page).toHaveURL(/\/admin\/produtos\/[^/]+$/);

    await page.locator("#product-gallery-file").setInputFiles(fixturePng);
    await expect(page.getByRole("listitem")).toHaveCount(1, { timeout: 60_000 });

    await expectProductOnCollection(page, categorySlug, productName, false);
  });

  test("segunda foto e publicar exibem o produto na coleção", async ({
    page,
  }) => {
    await loginAsSeedAdmin(page);
    await page.goto("/admin/produtos");
    const productRow = page.getByRole("row").filter({ hasText: productName });
    await productRow
      .getByRole("link", { name: copyAdminPtBr.products.edit })
      .click();

    await page.locator("#product-gallery-file").setInputFiles(fixturePng);
    await expect(page.getByRole("listitem")).toHaveCount(2, { timeout: 60_000 });

    await page
      .getByRole("button", { name: copyAdminPtBr.products.publish })
      .click();

    await expect(
      page.getByText(copyAdminPtBr.products.published, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expectProductOnCollection(page, categorySlug, productName, true);
  });

  test("mover para lixeira remove da vitrine; restaurar volta", async ({
    page,
  }) => {
    await loginAsSeedAdmin(page);
    await page.goto("/admin/produtos");

    const row = page.getByRole("row").filter({ hasText: productName });
    await row
      .getByRole("button", { name: copyAdminPtBr.products.trash })
      .click();
    await page
      .getByRole("button", { name: copyAdminPtBr.products.trashConfirmAction })
      .click();

    await expect(
      page.getByText(copyAdminPtBr.products.trashed, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expectProductOnCollection(page, categorySlug, productName, false);

    await page.goto("/admin/lixeira?tipo=produtos");
    const trashRow = page.getByRole("row").filter({ hasText: productName });
    await trashRow
      .getByRole("button", { name: copyAdminPtBr.trash.restore })
      .click();

    await expect(
      page.getByText(copyAdminPtBr.trash.restoredProduct, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expectProductOnCollection(page, categorySlug, productName, true);
  });

  test("sair exige login ao acessar /admin/produtos", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await page
      .getByRole("button", { name: copyAdminPtBr.chrome.signOut })
      .click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin/produtos");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login não oferece cadastro público", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByText("Criar conta", { exact: false })).toHaveCount(
      0,
    );
    await expect(page.getByText("Cadastrar", { exact: false })).toHaveCount(0);
    await expect(
      page.getByText(copyAdminPtBr.login.noSignup),
    ).toBeVisible();
  });
});
