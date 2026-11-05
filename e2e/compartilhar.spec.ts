import { test, expect, type Page } from "@playwright/test";
import { getSiteUrl } from "../src/config/site";
import { copyPtBr } from "../src/lib/copy/pt-br";
import { db } from "./support/cleanup";

// Cria categorias e peças próprias (prefixo e2e-) e apaga tudo no fim. Não lê nem grava
// configurações globais: o logo esperado é o que a própria vitrine publica em "/".
test.describe.configure({ mode: "serial" });

const runId = Date.now();
const COVER_OG = "https://cdn.example.test/e2e-capa-og.jpg";
const PRODUCT_OG = "https://cdn.example.test/e2e-produto-og.jpg";
const LOCAL_WEBP = "/images/clothes-placeholder-imagem.webp";
const withCover = `e2e-compartilhar-capa-${runId}`;
const noCover = `e2e-compartilhar-sem-capa-${runId}`;
const slugs = {
  jpg: `e2e-jpg-${runId}`,
  webp: `e2e-webp-${runId}`,
  trash: `e2e-lixeira-${runId}`,
  draft: `e2e-rascunho-${runId}`,
};
const categoryIds: string[] = [];
const productIds: string[] = [];

async function insertCategory(slug: string, coverOg: string | null): Promise<string> {
  const field = { key: "cor", type: "multiselect", label: "Cor", options: ["Preto", "Bege"], filterable: true };
  const { rows } = await db.query(
    "insert into categories (name, slug, fields_schema, cover_image_url, cover_og_url) values ($1, $1, $2::jsonb, $3, $4) returning id",
    [slug, JSON.stringify([field]), coverOg ? LOCAL_WEBP : null, coverOg],
  );
  categoryIds.push(rows[0].id);
  return rows[0].id;
}

async function insertProduct(categoryId: string, slug: string, opts: { status?: string; deleted?: boolean; cor: string; ogUrl?: string }) {
  const { rows } = await db.query(
    `insert into products (category_id, name, slug, price, status, deleted_at, attributes)
     values ($1, $2, $2, 10, $3, $4, $5::jsonb) returning id`,
    [categoryId, slug, opts.status ?? "published", opts.deleted ? new Date() : null, JSON.stringify({ cor: [opts.cor] })],
  );
  productIds.push(rows[0].id);
  if (opts.ogUrl) {
    await db.query(
      `insert into product_images (product_id, storage_path, thumb_url, card_url, detail_url, og_url, sort_order)
       values ($1, $2, $3, $3, $3, $4, 0)`,
      [rows[0].id, `e2e/${slug}`, LOCAL_WEBP, opts.ogUrl],
    );
  }
}

test.beforeAll(async () => {
  const capa = await insertCategory(withCover, COVER_OG);
  await insertCategory(noCover, null);
  await insertProduct(capa, slugs.jpg, { cor: "Preto", ogUrl: PRODUCT_OG });
  await insertProduct(capa, slugs.webp, { cor: "Bege", ogUrl: "https://cdn.example.test/e2e-antigo-og.webp" });
  await insertProduct(capa, slugs.trash, { cor: "Preto", deleted: true });
  await insertProduct(capa, slugs.draft, { cor: "Preto", status: "draft" });
});

test.afterAll(async () => {
  if (productIds.length) {
    await db.query("delete from product_images where product_id = any($1)", [productIds]);
    await db.query("delete from products where id = any($1)", [productIds]);
  }
  if (categoryIds.length) await db.query("delete from categories where id = any($1)", [categoryIds]);
  await db.end();
});

const ogImage = (page: Page) => page.locator('meta[property="og:image"]').first().getAttribute("content");

test("rotas públicas abrem sem login; produto na lixeira, rascunho e slug inválido dão 404", async ({ page }) => {
  for (const path of ["/", `/colecao/${withCover}`, `/produto/${slugs.jpg}`, "/busca", "/privacidade", "/cookies", "/termos"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(new URL(page.url()).pathname, path).toBe(path);
  }
  for (const path of [`/produto/${slugs.trash}`, `/produto/${slugs.draft}`, "/produto/Slug Inválido!!", "/produto/e2e-nao-existe", "/colecao/e2e-nao-existe"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    expect(await page.title(), path).not.toContain("e2e-");
  }
});

test("produto: og:image absoluto em JPG; sem JPG cai no logo", async ({ page }) => {
  await page.goto("/");
  const logo = await ogImage(page);
  expect(logo).toMatch(/^https?:\/\//);

  await page.goto(`/produto/${slugs.jpg}`);
  expect(await ogImage(page)).toBe(PRODUCT_OG);

  await page.goto(`/produto/${slugs.webp}`);
  expect(await ogImage(page)).toBe(logo);
});

test("coleção: capa da categoria, a mesma com filtro; sem capa, logo", async ({ page }) => {
  await page.goto("/");
  const logo = await ogImage(page);

  await page.goto(`/colecao/${withCover}`);
  expect(await ogImage(page)).toBe(COVER_OG);
  await page.goto(`/colecao/${withCover}?cor=Preto`);
  expect(await ogImage(page)).toBe(COVER_OG);

  await page.goto(`/colecao/${noCover}`);
  expect(await ogImage(page)).toBe(logo);
});

test("demais rotas usam o logo, absoluto e em JPG", async ({ page }) => {
  await page.goto("/");
  const logo = await ogImage(page);
  expect(logo).toMatch(/^https?:\/\/.+\.jpg$/i);
  for (const path of ["/busca", "/termos", "/privacidade", "/cookies"]) {
    await page.goto(path);
    expect(await ogImage(page), path).toBe(logo);
  }
});

test("compartilhar na coleção e na busca usa a URL atual, e o link reproduz os mesmos cards", async ({ page, browser }) => {
  await page.addInitScript(() => {
    (navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async (data) => {
      (window as unknown as { __shared: unknown }).__shared = data;
    };
  });
  const cards = (p: Page) => p.locator("main article a").evaluateAll((links) => links.map((l) => l.getAttribute("href")));

  for (const [path, query] of [
    [`/colecao/${withCover}`, "cor=Preto&ordenar=preco_asc"],
    ["/busca", "q=e2e&ordenar=preco_asc"],
  ] as const) {
    await page.goto(`${path}?${query}`);
    const before = await cards(page);
    await page.getByRole("button", { name: copyPtBr.share.share }).click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string } }).__shared.url);
    expect(shared).toBe(`${getSiteUrl()}${path}?${query}`);

    const other = await browser.newContext({ baseURL: "http://localhost:3000" });
    try {
      const copy = await other.newPage();
      const url = new URL(shared);
      await copy.goto(url.pathname + url.search);
      expect(await cards(copy)).toEqual(before);
    } finally {
      await other.close();
    }
  }
  // Filtro realmente muda o resultado (o teste acima não passa por acaso).
  await page.goto(`/colecao/${withCover}`);
  await expect(page.locator("main article")).toHaveCount(2);
  await page.goto(`/colecao/${withCover}?cor=Preto`);
  await expect(page.locator("main article")).toHaveCount(1);
});
