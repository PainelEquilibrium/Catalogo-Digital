import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { copyPtBr } from "../src/lib/copy/pt-br";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { createE2eAccount, db, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

// Cria categoria e peças próprias (prefixo e2e-), marca "Cliente escolhe" pelo editor do admin
// e apaga tudo no fim. Não mexe nas categorias do seed.
test.describe.configure({ mode: "serial" });

const copy = copyPtBr.cart;
const FAKE_NUMBER = "5511999998888"; // mesmo valor de WHATSAPP_NUMBER em playwright.config.ts
const runId = Date.now();
const categorySlug = `e2e-carrinho-${runId}`;
const SIZES_21 = Array.from({ length: 21 }, (_, i) => `T${i + 1}`);

let owner: E2eAccount;
let categoryId = "";
const ids: Record<"promo" | "consulta" | "sumiu" | "muitos", string> = { promo: "", consulta: "", sumiu: "", muitos: "" };
const slug = (key: keyof typeof ids) => `e2e-${key}-${runId}`;
const nameOf = (key: keyof typeof ids) => `E2E Peça ${key} ${runId}`;

async function insertProduct(key: keyof typeof ids, price: string | null, promo: string | null, attributes: object) {
  const { rows } = await db.query(
    `insert into products (category_id, name, slug, price, promo_price, status, attributes)
     values ($1, $2, $3, $4, $5, 'published', $6::jsonb) returning id`,
    [categoryId, nameOf(key), slug(key), price, promo, JSON.stringify(attributes)],
  );
  ids[key] = rows[0].id;
}

test.beforeAll(async ({ browser }) => {
  const field = (key: string, label: string, options: string[]) => ({ key, type: "multiselect", label, options, filterable: false });
  categoryId = (await db.query(
    "insert into categories (name, slug, fields_schema) values ($1, $2, $3::jsonb) returning id",
    [`e2e-carrinho-${runId}`, categorySlug, JSON.stringify([field("cor", "Cor", ["Bege", "Preto"]), field("tamanho", "Tamanho", SIZES_21)])],
  )).rows[0].id;
  await insertProduct("promo", "100.00", "80.00", { cor: ["Bege"], tamanho: ["M", "G"] });
  await insertProduct("consulta", null, null, { tamanho: ["M"] });
  await insertProduct("sumiu", "50.00", null, { tamanho: ["P", "M"] });
  await insertProduct("muitos", "9999.00", null, { tamanho: SIZES_21 });

  // "Cliente escolhe" marcado pela tela do admin, o caminho real da lojista.
  owner = await createE2eAccount({ role: "owner", mustChangePassword: false });
  const page = await browser.newPage({ baseURL: "http://localhost:3000" });
  try {
    await page.goto("/admin/login");
    await page.getByLabel(copyAdminPtBr.login.email).fill(owner.email);
    await page.getByLabel(copyAdminPtBr.login.password).fill(owner.password);
    await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
    await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 30_000 });
    await page.goto(`/admin/categorias/${categoryId}`);
    await page.waitForLoadState("networkidle");
    const boxes = page.getByRole("checkbox", { name: copyAdminPtBr.categories.fieldCustomerSelects });
    await expect(boxes).toHaveCount(2);
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.getByRole("button", { name: copyAdminPtBr.categories.save }).click();
    await expect(page.getByText(copyAdminPtBr.categories.saved, { exact: true })).toBeVisible({ timeout: 30_000 });
  } finally {
    await page.close();
  }
  const saved = (await db.query("select fields_schema from categories where id = $1", [categoryId])).rows[0].fields_schema;
  expect(saved.map((f: { customer_selects?: boolean }) => f.customer_selects)).toEqual([true, true]);
});

test.afterAll(async () => {
  if (categoryId) {
    await db.query("delete from products where category_id = $1", [categoryId]);
    await db.query("delete from categories where id = $1", [categoryId]);
  }
  if (owner) await deleteE2eAccount(owner.id);
  await db.end();
});

const stubWhatsapp = (context: BrowserContext) =>
  context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));

const dialog = (page: Page) => page.getByRole("dialog", { name: copy.title });
const cartButton = (page: Page, lines?: number) =>
  page.getByRole("button", { name: lines === undefined ? /^Abrir carrinho$/ : copy.openWithLines(lines) });
const openCart = async (page: Page) => {
  await page.getByRole("button", { name: /^Abrir carrinho/ }).click();
  await expect(dialog(page)).toBeVisible();
};
const goProduct = async (page: Page, key: keyof typeof ids) => {
  await page.goto(`/produto/${slug(key)}`);
  await page.waitForLoadState("networkidle"); // hidratação antes de clicar
};
const choose = (page: Page, label: string, option: string) =>
  page.getByRole("group", { name: label }).getByRole("radio", { name: option, exact: true }).check({ force: true });
const addButton = (page: Page) => page.getByRole("button", { name: copy.add, exact: true });
const lineItems = (page: Page) => dialog(page).getByRole("listitem");
const alertWith = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text });

async function addToCart(page: Page, key: keyof typeof ids, size: string) {
  await goProduct(page, key);
  await choose(page, "Tamanho", size);
  await addButton(page).click();
  await expect(page.getByText(copy.added)).toBeVisible();
}

async function sendOrder(page: Page): Promise<{ url: URL; text: string }> {
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    dialog(page).getByRole("button", { name: copy.send }).click(),
  ]);
  await popup.waitForURL(/wa\.me/);
  const url = new URL(popup.url());
  return { url, text: url.searchParams.get("text") ?? "" };
}

async function seedCart(page: Page, lines: { productId: string; size: string }[], updatedAt = Date.now()) {
  await page.goto("/");
  await page.evaluate(
    ({ lines, updatedAt }) =>
      localStorage.setItem(
        "catalogo-cart",
        JSON.stringify({
          version: 1,
          updatedAt,
          lines: lines.map((l) => ({
            productId: l.productId,
            selections: [{ key: "tamanho", label: "Tamanho", value: l.size }],
            qty: 1,
          })),
        }),
      ),
    { lines, updatedAt },
  );
  await page.reload();
}

test("sem escolher tamanho, adicionar mostra o que falta em role=alert", async ({ page }) => {
  await goProduct(page, "promo");
  await addButton(page).click();
  await expect(alertWith(page, "Tamanho")).toBeVisible();
  await expect(alertWith(page, "Cor")).toHaveCount(0); // única opção já vem marcada
  await expect(cartButton(page)).toBeVisible(); // nada entrou

  await page.getByRole("button", { name: copyPtBr.whatsapp.ctaLabel }).click();
  await expect(alertWith(page, "Tamanho")).toBeVisible();
});

test("mesma peça em dois tamanhos vira duas linhas", async ({ page }) => {
  await addToCart(page, "promo", "M");
  await choose(page, "Tamanho", "G");
  await addButton(page).click();
  await expect(cartButton(page, 2)).toBeVisible();
  await openCart(page);
  await expect(lineItems(page)).toHaveCount(2);
  await expect(lineItems(page).nth(0)).toContainText("Tamanho: M");
  await expect(lineItems(page).nth(1)).toContainText("Tamanho: G");
});

test("carrinho sobrevive a recarregar e a fechar a aba", async ({ page, context }) => {
  await addToCart(page, "promo", "M");
  await page.reload();
  await expect(cartButton(page, 1)).toBeVisible();
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(cartButton(fresh, 1)).toBeVisible();
});

test("expirado com 7 dias some ao carregar", async ({ page }) => {
  const day = 24 * 60 * 60 * 1000;
  await seedCart(page, [{ productId: ids.promo, size: "M" }], Date.now() - 8 * day);
  await expect(cartButton(page)).toBeVisible();
  await openCart(page);
  await expect(dialog(page).getByText(copy.empty)).toBeVisible();
  await page.keyboard.press("Escape");

  await seedCart(page, [{ productId: ids.promo, size: "M" }], Date.now() - 6 * day);
  await expect(cartButton(page, 1)).toBeVisible();
});

test("vitrine funciona com localStorage bloqueado", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await addToCart(page, "promo", "M");
  await openCart(page);
  await expect(lineItems(page)).toHaveCount(1); // segue na memória
  await expect(dialog(page).getByText(copy.storageFailed)).toBeVisible();
  expect(errors).toEqual([]);
});

test("mensagem do carrinho traz produto, escolhas, quantidade e link", async ({ page, context, baseURL }) => {
  await stubWhatsapp(context);
  await addToCart(page, "promo", "M");
  await openCart(page);
  await dialog(page).getByRole("button", { name: copy.increase(nameOf("promo")) }).click();
  await expect(dialog(page).getByRole("spinbutton", { name: copy.quantity(nameOf("promo")) })).toHaveValue("2");
  const { url, text } = await sendOrder(page);
  expect(url.pathname).toBe(`/${FAKE_NUMBER}`);
  expect(text).toContain(nameOf("promo"));
  expect(text).toContain("Tamanho: M");
  expect(text).toContain("Cor: Bege");
  expect(text).toMatch(/x2/);
  expect(text).toContain(`${baseURL}/produto/${slug("promo")}`);
  expect(text).not.toMatch(/\{\w+\}/);
});

test("promoção e Sob consulta seguem a regra", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "promo", "G");
  await addToCart(page, "consulta", "M");
  await openCart(page);
  await expect(lineItems(page).nth(0)).toContainText("R$ 80,00");
  await expect(lineItems(page).nth(1)).toContainText(copyPtBr.price.onRequest);
  const { text } = await sendOrder(page);
  expect(text).toMatch(/R\$\s*80,00/);
  expect(text).not.toMatch(/100,00/);
  const consultaLine = text.split("\n").find((l) => l.includes(nameOf("consulta")))!;
  expect(consultaLine).not.toMatch(/R\$/);
  expect(text).toContain(copyPtBr.whatsapp.orderPendingItems);
});

test("item despublicado aparece indisponível e fica fora da mensagem", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "promo", "M");
  await addToCart(page, "sumiu", "P");
  await db.query("update products set status = 'draft' where id = $1", [ids.sumiu]);
  try {
    await openCart(page);
    await expect(lineItems(page)).toHaveCount(2);
    await expect(lineItems(page).filter({ hasText: copy.unavailableHint })).toHaveCount(1);
    const { text } = await sendOrder(page);
    expect(text).toContain(nameOf("promo"));
    expect(text).not.toContain(nameOf("sumiu"));
  } finally {
    await db.query("update products set status = 'published' where id = $1", [ids.sumiu]);
  }
});

test("opção que saiu do produto segue na mensagem como a cliente escolheu", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "sumiu", "P");
  await db.query(`update products set attributes = '{"tamanho":["M"]}'::jsonb where id = $1`, [ids.sumiu]);
  try {
    await openCart(page);
    const { text } = await sendOrder(page);
    expect(text).toContain("Tamanho: P");
  } finally {
    await db.query(`update products set attributes = '{"tamanho":["P","M"]}'::jsonb where id = $1`, [ids.sumiu]);
  }
});

test("revalidação falhou: avisa, bloqueia envio, tentar de novo recupera", async ({ page }) => {
  await addToCart(page, "promo", "M");
  await page.route("**/api/vitrine/carrinho", (route) => route.fulfill({ status: 503, json: { error: "x" } }));
  await openCart(page);
  await expect(alertWith(page, copy.revalidationFailed)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: copy.send })).toBeDisabled();

  await page.unroute("**/api/vitrine/carrinho");
  await dialog(page).getByRole("button", { name: copy.retry }).click();
  await expect(alertWith(page, copy.revalidationFailed)).toHaveCount(0);
  await expect(dialog(page).getByRole("button", { name: copy.send })).toBeEnabled();
});

test("falha na revalidação ao finalizar não abre o WhatsApp e não deixa aba vazia", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "promo", "M");
  await openCart(page);
  await expect(dialog(page).getByRole("button", { name: copy.send })).toBeEnabled();
  await page.route("**/api/vitrine/carrinho", (route) => route.fulfill({ status: 503, json: { error: "x" } }));
  const popups: Page[] = [];
  context.on("page", (p) => popups.push(p));
  await dialog(page).getByRole("button", { name: copy.send }).click();
  await expect(alertWith(page, copy.revalidationFailed)).toBeVisible();
  await expect.poll(() => popups.filter((p) => !p.isClosed()).length).toBe(0);
});

test("após abrir o WhatsApp, oferece Limpar carrinho e não esvazia sozinho", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "promo", "M");
  await openCart(page);
  await expect(dialog(page).getByRole("button", { name: copy.clear })).toHaveCount(0);
  await sendOrder(page);
  await expect(dialog(page).getByText(copy.afterSend)).toBeVisible();
  await expect(lineItems(page)).toHaveCount(1); // não esvaziou sozinho
  await page.reload();
  await expect(cartButton(page, 1)).toBeVisible();
  await openCart(page);
  await sendOrder(page);
  await dialog(page).getByRole("button", { name: copy.clear }).click();
  await expect(dialog(page).getByText(copy.empty)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cartButton(page)).toBeVisible();
});

test("Comprar pelo WhatsApp envia só aquele item, com as escolhas", async ({ page, context }) => {
  await stubWhatsapp(context);
  await addToCart(page, "consulta", "M"); // já está no carrinho: não entra na compra direta
  await goProduct(page, "promo");
  await choose(page, "Tamanho", "G");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: copyPtBr.whatsapp.ctaLabel }).click(),
  ]);
  await popup.waitForURL(/wa\.me/);
  const text = new URL(popup.url()).searchParams.get("text") ?? "";
  expect(text).toContain(nameOf("promo"));
  expect(text).toContain("Tamanho: G");
  expect(text).toContain("Cor: Bege");
  expect(text).not.toContain(nameOf("consulta"));
  await expect(cartButton(page, 1)).toBeVisible();
});

test("20 linhas: a 21ª dá aviso", async ({ page }) => {
  await seedCart(page, SIZES_21.slice(0, 20).map((size) => ({ productId: ids.muitos, size })));
  await expect(cartButton(page, 20)).toBeVisible();
  await goProduct(page, "muitos");
  await choose(page, "Tamanho", "T21");
  await addButton(page).click();
  await expect(alertWith(page, copy.cartFull)).toBeVisible();
  await expect(cartButton(page, 20)).toBeVisible();
});

test("quantidade acima de 10 volta a 10; cabeçalho cabe em 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await addToCart(page, "promo", "M");
  await openCart(page);
  const qty = dialog(page).getByRole("spinbutton", { name: copy.quantity(nameOf("promo")) });
  await qty.fill("99");
  await qty.blur();
  await expect(qty).toHaveValue("10");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /^Abrir carrinho/ })).toBeInViewport();
});
