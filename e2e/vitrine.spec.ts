import { test, expect } from "@playwright/test";
import { copyPtBr } from "../src/lib/copy/pt-br";

const THEME_STORAGE_KEY = "catalogo-theme";

function assertWaMeHref(href: string | null): URL {
  expect(href).toBeTruthy();
  const url = new URL(href!);
  expect(url.protocol).toBe("https:");
  expect(url.hostname).toBe("wa.me");
  const digits = url.pathname.replace(/\//g, "");
  expect(digits).toMatch(/^\d{10,}$/);
  return url;
}

test.describe("vitrine pública", () => {
  test("home renderiza hero (ou nome da loja) e pelo menos um card", async ({
    page,
  }) => {
    await page.goto("/");

    const heroHeading = page
      .getByRole("main")
      .getByRole("heading", { level: 1 });
    const storeHomeLink = page
      .getByRole("banner")
      .getByRole("link")
      .and(page.locator('[href="/"]'));

    const heroVisible = await heroHeading.isVisible();
    const storeVisible = await storeHomeLink.isVisible();
    expect(heroVisible || storeVisible).toBe(true);
    if (heroVisible) {
      await expect(heroHeading).toBeVisible();
    } else {
      await expect(storeHomeLink).toHaveAccessibleName(/\S+/);
    }
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("link", { name: "Equilibrium Tecnologia" }),
    ).toBeVisible();
  });

  test("coleção: filtro cor=Preto persiste na URL após reload", async ({
    page,
  }) => {
    await page.goto("/colecao/trico");

    await page.getByRole("link", { name: "Preto", exact: true }).click();
    await expect(page).toHaveURL(/cor=Preto/);

    await page.reload();
    await expect(page).toHaveURL(/cor=Preto/);
    await expect(
      page.getByRole("link", { name: "Preto", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("coleção: ordenar por preço; carregar mais quando disponível", async ({
    page,
  }) => {
    await page.goto("/colecao/trico");

    await page
      .getByLabel(copyPtBr.catalog.sortLabel)
      .selectOption("preco_asc");
    await expect(page).toHaveURL(/ordenar=preco_asc/);

    const cards = page.locator("main article");
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    const loadMore = page.getByRole("button", {
      name: copyPtBr.catalog.loadMore,
    });
    await expect(loadMore).toBeVisible();
    await loadMore.click();
    await expect
      .poll(async () => await cards.count())
      .toBeGreaterThan(initialCount);
  });

  test("produto: CTA WhatsApp wa.me; sem preço não inclui R$ no text", async ({
    page,
  }) => {
    await page.goto("/produto/blusa-trico-cashmere");

    const ctaWithPrice = page.getByRole("link", {
      name: copyPtBr.whatsapp.ctaLabel,
    });
    await expect(ctaWithPrice).toBeVisible();
    assertWaMeHref(await ctaWithPrice.getAttribute("href"));

    await page.goto("/produto/vestido-trico-midi");

    const ctaNoPrice = page.getByRole("link", {
      name: copyPtBr.whatsapp.ctaLabel,
    });
    await expect(ctaNoPrice).toBeVisible();

    const url = assertWaMeHref(await ctaNoPrice.getAttribute("href"));
    const text = decodeURIComponent(url.searchParams.get("text") ?? "");
    expect(text).not.toMatch(/R\$/);
  });

  test("slug draft retorna 404", async ({ page }) => {
    const response = await page.goto("/produto/rascunho-oculto");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: copyPtBr.notFound.title }),
    ).toBeVisible();
  });

  test("página de privacidade tem conteúdo", async ({ page }) => {
    await page.goto("/privacidade");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: copyPtBr.legal.privacidade,
      }),
    ).toBeVisible();

    const article = page.getByRole("article");
    await expect(
      article.getByRole("heading", {
        level: 2,
        name: "Dados que podemos tratar",
      }),
    ).toBeVisible();
  });

  test("toggle de tema persiste após reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => localStorage.removeItem(key), THEME_STORAGE_KEY);
    await page.reload();

    await page
      .getByRole("button", { name: copyPtBr.theme.toggleDark })
      .click();

    await expect
      .poll(async () =>
        page.evaluate(
          (key) => localStorage.getItem(key),
          THEME_STORAGE_KEY,
        ),
      )
      .toBe("dark");

    await page.reload();

    await expect
      .poll(async () =>
        page.evaluate(
          (key) => localStorage.getItem(key),
          THEME_STORAGE_KEY,
        ),
      )
      .toBe("dark");

    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
