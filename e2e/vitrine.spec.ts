import { test, expect, request } from "@playwright/test";
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
    // O CDN do selo pode barrar navegador headless (ERR_BLOCKED_BY_ORB); sem a
    // imagem o link fica sem tamanho. O teste cobre o rodapé, não esse CDN.
    await page.route("https://assets.equilibriumtecnologia.com.br/**", (route) =>
      route.fulfill({ path: "public/images/logo-black-3.webp" }),
    );
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
    // O selo do rodapé usa imagem com loading="lazy": só tem tamanho depois
    // de entrar na tela. Rolamos até o rodapé antes de checar a visibilidade.
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(
      footer.getByRole("link", { name: "Equilibrium Tecnologia" }),
    ).toBeVisible();
  });

  test("coleção: filtro cor=Preto persiste na URL após reload", async ({
    page,
  }) => {
    await page.goto("/colecao/trico");

    const cardLinks = page.locator("main article a");
    const unfiltered = await cardLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );

    await page.getByRole("link", { name: "Preto", exact: true }).click();
    await expect(page).toHaveURL(/cor=Preto/);
    // Sem recarregar, a grade já mostra o resultado filtrado.
    await expect
      .poll(() =>
        cardLinks.evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")),
        ),
      )
      .not.toEqual(unfiltered);
    const filtered = await cardLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );

    await page.reload();
    await expect(page).toHaveURL(/cor=Preto/);
    await expect(
      page.getByRole("link", { name: "Preto", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        cardLinks.evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")),
        ),
      )
      .toEqual(filtered);
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

    // Trocar a ordem recomeça a lista: a grade reflete a URL, não o estado antigo.
    const ascFirst = await cards.first().locator("a").first().getAttribute("href");
    await page
      .getByLabel(copyPtBr.catalog.sortLabel)
      .selectOption("preco_desc");
    await expect(page).toHaveURL(/ordenar=preco_desc/);
    await expect
      .poll(() => cards.first().locator("a").first().getAttribute("href"))
      .not.toBe(ascFirst);
    await expect.poll(() => cards.count()).toBeLessThanOrEqual(initialCount);
  });

  test("produto: CTA WhatsApp leva número, nome, link e preço", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/produto/blusa-trico-cashmere");

    const ctaWithPrice = page.getByRole("link", {
      name: copyPtBr.whatsapp.ctaLabel,
    });
    await expect(ctaWithPrice).toBeVisible();
    const urlWithPrice = assertWaMeHref(await ctaWithPrice.getAttribute("href"));
    expect(urlWithPrice.pathname).toBe("/5511999998888");
    const textWithPrice = urlWithPrice.searchParams.get("text") ?? "";
    expect(textWithPrice).toContain("Blusa Tricô Cashmere");
    expect(textWithPrice).toContain(`${baseURL}/produto/blusa-trico-cashmere`);
    // Promoção: a mensagem leva o preço promocional, não o de tabela.
    expect(textWithPrice).toMatch(/R\$\s*149,90/);
    expect(textWithPrice).not.toMatch(/189,90/);
    expect(textWithPrice).not.toMatch(/\{\w+\}/);

    await page.goto("/produto/vestido-trico-midi");

    const ctaNoPrice = page.getByRole("link", {
      name: copyPtBr.whatsapp.ctaLabel,
    });
    await expect(ctaNoPrice).toBeVisible();

    const urlNoPrice = assertWaMeHref(await ctaNoPrice.getAttribute("href"));
    const textNoPrice = urlNoPrice.searchParams.get("text") ?? "";
    expect(textNoPrice).toContain("Vestido Tricô Midi");
    expect(textNoPrice).toContain(`${baseURL}/produto/vestido-trico-midi`);
    expect(textNoPrice).not.toMatch(/R\$/);
    expect(textNoPrice).not.toMatch(/\{\w+\}/);
  });

  test("busca do header encontra produto de qualquer categoria", async ({
    page,
  }) => {
    await page.goto("/colecao/jeans");
    const href = await page
      .locator("main article a")
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    const name = await page.getByRole("heading", { level: 1 }).innerText();

    await page.goto("/");
    const search = page.getByRole("searchbox", {
      name: copyPtBr.catalog.searchPlaceholder,
    });
    await search.fill(name);
    await search.press("Enter");

    await expect(page).toHaveURL(/\/busca\?q=/);
    await expect(page.locator(`main article a[href="${href}"]`).first()).toBeVisible();
  });

  test("CTA do hero abre todos os produtos, com ordenação e carregar mais", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver novidades" }).click();
    await expect(page).toHaveURL(/\/busca$/);

    const cards = page.locator("main article");
    await expect(cards.first()).toBeVisible();
    const initialCount = await cards.count();

    const loadMore = page.getByRole("button", {
      name: copyPtBr.catalog.loadMore,
    });
    await loadMore.click();
    await expect
      .poll(async () => await cards.count())
      .toBeGreaterThan(initialCount);

    const firstHref = () => cards.first().locator("a").first().getAttribute("href");
    const newestHref = await firstHref();
    await page
      .getByLabel(copyPtBr.catalog.sortLabel)
      .selectOption("preco_asc");
    await expect(page).toHaveURL(/\/busca\?ordenar=preco_asc/);
    // A grade precisa refletir a nova ordem, não só a URL.
    await expect.poll(firstHref).not.toBe(newestHref);
  });

  test("produto migrado carrega galeria, OG e variante sem sessão", async ({ page }) => {
    await page.goto("/produto/blusa-trico-cashmere");
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    const variantPrefix = "/storage/v1/object/public/product-image-variants/variants/";
    const isExpectedVariant = (source: string) => {
      let url = new URL(source, page.url());
      if (url.origin === new URL(page.url()).origin && url.pathname === "/_next/image") {
        url = new URL(url.searchParams.get("url") ?? "", page.url());
      }
      return url.origin === expectedOrigin && url.pathname.startsWith(variantPrefix);
    };
    const images = page.getByRole("region", { name: copyPtBr.gallery.label }).locator("img");
    await expect(images.first()).toBeAttached();
    let relevantImages = 0;
    for (const image of await images.all()) {
      if (!isExpectedVariant((await image.getAttribute("src")) ?? "")) continue;
      relevantImages++;
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) =>
        node.complete && node.naturalWidth > 0)).toBe(true);
    }
    expect(relevantImages).toBeGreaterThan(0);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    expect(new URL(og!).origin).toBe(expectedOrigin);
    expect(new URL(og!).pathname.startsWith(variantPrefix)).toBe(true);
    const anonymous = await request.newContext();
    try {
      for (const url of [og!, `/_next/image?url=${encodeURIComponent(og!)}&w=640&q=75`]) {
        const response = await anonymous.get(new URL(url, page.url()).href);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toMatch(/^image\//);
      }
    } finally { await anonymous.dispose(); }
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
