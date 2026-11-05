import { test, expect, request } from "@playwright/test";
import path from "node:path";
import { copyPtBr } from "../src/lib/copy/pt-br";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";

const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD;

// Foto de teste de cadastro de produto: placeholder 800x800 (mínimo do upload).
const fixturePhoto = path.join(
  __dirname,
  "..",
  "public",
  "images",
  "clothes-placeholder-imagem.webp",
);

const runId = Date.now();
const categoryName = `e2e-${runId}`;
let categorySlug = "";
let productEditorUrl = "";
let categoryEditorUrl = "";
let uploadedVariantUrls: string[] = [];
const productName = `e2e-produto-${runId}`;
const descriptionFragment = `Lavagem a frio ${runId}`;
const productDescription = `Modelagem ampla em linho natural.\n${descriptionFragment}.`;

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
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
}

async function expectLoadedImages(images: import("@playwright/test").Locator) {
  await expect(images.first()).toBeAttached();
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) =>
      node.complete && node.naturalWidth > 0)).toBe(true);
  }
}

async function expectPublicImage(page: import("@playwright/test").Page, url: string) {
  // A separate request context carries no cookies from the logged-in browser.
  const anonymous = await request.newContext();
  try {
    const response = await anonymous.get(new URL(url, page.url()).href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
  } finally { await anonymous.dispose(); }
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
    await expectLoadedImages(page.getByRole("article").filter({ hasText: name }).locator("img"));
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
    categoryEditorUrl = page.url();
    await expect(page.getByLabel(copyAdminPtBr.categories.name)).toHaveValue(
      categoryName,
    );
  });

  test("produto rascunho com uma foto não aparece na vitrine", async ({
    page,
  }) => {
    // Upload envia original + 4 variantes ao Storage remoto: dá mais folga que o padrão.
    test.setTimeout(90_000);
    await loginAsSeedAdmin(page);
    await page.goto("/admin/produtos/novo");

    await page.getByLabel(copyAdminPtBr.products.category).click();
    await page.getByRole("option", { name: categoryName }).click();
    await page.getByLabel(copyAdminPtBr.products.name).fill(productName);

    await page
      .getByRole("button", { name: copyAdminPtBr.products.saveDraft })
      .click();
    await expect(page).toHaveURL(/\/admin\/produtos\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);

    productEditorUrl = page.url();
    await page.locator("#product-gallery-file").setInputFiles(fixturePhoto);
    await expect(page.getByRole("listitem")).toHaveCount(1, { timeout: 60_000 });
    await expectLoadedImages(page.getByRole("listitem").locator("img"));

    await expectProductOnCollection(page, categorySlug, productName, false);
  });

  test("segunda foto e publicar exibem o produto na coleção", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAsSeedAdmin(page);
    await page.goto("/admin/produtos");
    const productRow = page.getByRole("row").filter({ hasText: productName });
    await productRow
      .getByRole("link", { name: copyAdminPtBr.products.edit })
      .click();

    await page.locator("#product-gallery-file").setInputFiles(fixturePhoto);
    await expect(page.getByRole("listitem")).toHaveCount(2, { timeout: 60_000 });
    await expectLoadedImages(page.getByRole("listitem").locator("img"));
    uploadedVariantUrls = await page.getByRole("listitem").locator("img").evaluateAll(
      (images) => images.map((image) => (image as HTMLImageElement).src),
    );

    await page
      .getByRole("button", { name: copyAdminPtBr.products.publish })
      .click();

    await expect(
      page.getByText(copyAdminPtBr.products.published, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expectProductOnCollection(page, categorySlug, productName, true);
  });

  test("descrição salva aparece no produto e entra na busca", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await page.goto(productEditorUrl);
    await page.getByLabel(copyAdminPtBr.products.description).fill(productDescription);
    await page
      .getByRole("button", { name: copyAdminPtBr.products.publish })
      .click();
    await expect(
      page.getByText(copyAdminPtBr.products.published, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto(`/colecao/${categorySlug}`);
    await page.getByRole("link", { name: productName, exact: true }).first().click();
    await expect(page.getByText(descriptionFragment, { exact: false })).toBeVisible();

    await page.goto(`/busca?q=${encodeURIComponent(descriptionFragment)}`);
    await expect(
      page.getByRole("link", { name: productName, exact: true }).first(),
    ).toBeVisible();
  });

  test("variantes reais no admin, home, galeria, OG e otimizador", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await expectLoadedImages(page.getByRole("row").filter({ hasText: productName }).locator("img"));
    await page.goto(`/colecao/${categorySlug}`);
    const productLink = page.getByRole("link", { name: productName, exact: true });
    await productLink.first().click();
    await expectLoadedImages(page.getByRole("region", { name: copyPtBr.gallery.label }).locator("img"));
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toContain("/object/public/product-image-variants/variants/");
    await expectPublicImage(page, og!);
    const variant = uploadedVariantUrls[0];
    expect(variant).toContain("/object/public/product-image-variants/variants/");
    await expectPublicImage(page, variant);
    await expectPublicImage(page, `/_next/image?url=${encodeURIComponent(variant)}&w=640&q=75`);
    await page.goto("/");
    await expectLoadedImages(page.getByRole("article").filter({ hasText: productName }).locator("img"));
  });

  test("duas capas confirmadas; aviso de limpeza e falha preservam a última", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsSeedAdmin(page);
    await page.goto(categoryEditorUrl);
    const cover = page.locator('img[src*="product-image-variants"]');
    await page.locator("#category-cover-file").setInputFiles(fixturePhoto);
    await expect(page.getByText(copyAdminPtBr.upload.coverSaved, { exact: true })).toBeVisible({ timeout: 60_000 });
    await expectLoadedImages(cover);
    const first = await cover.getAttribute("src");
    // Keep the native multipart upload intact; route.fetch can omit its File payload.
    await page.evaluate(() => {
      const nativeFetch = window.fetch;
      const categoryPath = window.location.pathname;
      window.fetch = async (...args) => {
        const [input, init] = args;
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const pathname = new URL(input instanceof Request ? input.url : input.toString(), window.location.href).pathname;
        if (!headers.has("next-action") || pathname !== categoryPath) return nativeFetch(...args);
        try {
          const response = await nativeFetch(...args);
          const body = await response.text();
          if (!body.includes('"ok":true')) throw new Error(`Cover upload failed: ${body}`);
          return new Response(body.replace('"ok":true', '"ok":true,"cleanupPending":true'), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } finally {
          window.fetch = nativeFetch;
        }
      };
    });
    await page.locator("#category-cover-file").setInputFiles(fixturePhoto);
    await expect(page.getByText(copyAdminPtBr.upload.coverCleanupPending, { exact: true })).toBeVisible({ timeout: 60_000 });
    await expectLoadedImages(cover);
    const confirmed = await cover.getAttribute("src");
    expect(confirmed).not.toBe(first);
    // Abort before the server: no third persisted upload is created by this fixture.
    await page.route("**/admin/categorias/**", (route) =>
      route.request().headers()["next-action"] ? route.abort("failed") : route.continue(), { times: 1 });
    await page.locator("#category-cover-file").setInputFiles(fixturePhoto);
    await expect(page.getByText(copyAdminPtBr.upload.errorGeneric, { exact: true })).toBeVisible();
    await expect(cover).toHaveAttribute("src", confirmed!);
    await page.reload();
    await expect(cover).toHaveAttribute("src", confirmed!);
    await expectLoadedImages(cover);
    await page.goto("/");
    await expectLoadedImages(page.locator(`a[href="/colecao/${categorySlug}"] img`));
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
    for (const url of uploadedVariantUrls) await expectPublicImage(page, url);

    await page.goto("/admin/lixeira?tipo=produtos");
    const trashRow = page.getByRole("row").filter({ hasText: productName });
    await trashRow
      .getByRole("button", { name: copyAdminPtBr.trash.restore })
      .click();

    await expect(
      page.getByText(copyAdminPtBr.trash.restoredProduct, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expectProductOnCollection(page, categorySlug, productName, true);
    for (const url of uploadedVariantUrls) await expectPublicImage(page, url);
  });

  test("remove somente uma foto própria e mantém a outra carregando", async ({ page }) => {
    await loginAsSeedAdmin(page);
    await page.goto(productEditorUrl);
    await page.getByRole("button", { name: copyAdminPtBr.upload.removePhoto }).last().click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expectLoadedImages(page.getByRole("listitem").locator("img"));
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
