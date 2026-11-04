import { test, expect } from "@playwright/test";

test("galeria Polaroid: navegação, teclado, arraste e ampliação", async ({ page }) => {
  await page.goto("/produto/blusa-trico-cashmere");
  const gallery = page.getByRole("region", { name: "Fotos do produto" });
  await expect(gallery).toBeVisible();
  await gallery.getByRole("button", { name: "Pausar apresentação" }).click();
  const selected = gallery.locator('[data-active="true"]');
  await expect(selected).toHaveAttribute("data-slide", "0");
  await gallery.getByRole("button", { name: "Próxima imagem" }).click();
  await expect(selected).toHaveAttribute("data-slide", "1");
  await gallery.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(selected).toHaveAttribute("data-slide", "0");
  // Wait for the spring to settle before beginning a new gesture.
  await expect.poll(async () => selected.evaluate((el) => Math.abs(new DOMMatrix(getComputedStyle(el).transform).b))).toBeLessThan(0.04);
  const bounds = (await gallery.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 220, bounds.y + bounds.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(selected).not.toHaveAttribute("data-slide", "0");
  const selectedSrc = await selected.locator("img").getAttribute("src");
  await gallery.getByRole("button", { name: "Ampliar imagem" }).click();
  const dialog = page.getByRole("dialog", { name: "Blusa Tricô Cashmere" });
  await expect(dialog).toBeVisible();
  const enlargedSrc = await dialog.locator("img").getAttribute("src");
  expect(new URL(enlargedSrc!, "http://localhost").searchParams.get("url")).toBe(new URL(selectedSrc!, "http://localhost").searchParams.get("url"));
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(gallery.getByRole("button", { name: "Ampliar imagem" })).toBeFocused();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`galeria ocupa a largura e detalhes ficam abaixo em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/produto/blusa-trico-cashmere");
    const gallery = page.getByRole("region", { name: "Fotos do produto" });
    await expect(gallery).toBeVisible();
    const rejectCookies = page.getByRole("button", { name: "Recusar", exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    const bounds = (await gallery.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(width);
    const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(heading.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const button of await gallery.getByRole("button").all()) {
      const control = (await button.boundingBox())!;
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.y + control.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });
}

test("redução de movimento desativa autoplay e permite navegar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/produto/blusa-trico-cashmere");
  const gallery = page.getByRole("region", { name: "Fotos do produto" });
  await expect(gallery).toBeVisible();
  await expect(gallery.getByRole("button", { name: "Pausar apresentação" })).toHaveCount(0);
  await gallery.getByRole("button", { name: "Próxima imagem" }).click();
  await expect(gallery.locator('[data-active="true"]')).toHaveAttribute("data-slide", "1");
});

test.describe("gestos no celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("arraste horizontal seleciona e gesto vertical permite rolar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/produto/blusa-trico-cashmere");
    const gallery = page.getByRole("region", { name: "Fotos do produto" });
    await expect(gallery).toBeVisible();
    const session = await page.context().newCDPSession(page);
    const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
      for (let step = 1; step <= 10; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * step / 10, y: from.y + (to.y - from.y) * step / 10 }] });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await swipe({ x: 300, y: 350 }, { x: 70, y: 350 });
    await expect(gallery.locator('[data-active="true"]')).toHaveAttribute("data-slide", "1");
    await swipe({ x: 200, y: 400 }, { x: 200, y: 200 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
    await expect(gallery.locator('[data-active="true"]')).toHaveAttribute("data-slide", "1");
    await session.detach();
  });
});

test("capturas responsivas nos dois temas e janela baixa", async ({ page }, testInfo) => {
  for (const [width, height, theme] of [[1440, 1000, "light"], [390, 844, "dark"], [844, 390, "light"]] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => localStorage.setItem("catalogo-theme", value), theme);
    await page.goto("/produto/blusa-trico-cashmere");
    const gallery = page.getByRole("region", { name: "Fotos do produto" });
    await expect(gallery).toBeVisible();
    if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
    else await expect(page.locator("html")).not.toHaveClass(/dark/);
    const rejectCookies = page.getByRole("button", { name: "Recusar", exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    await expect.poll(() => gallery.locator('[data-active="true"] img').evaluate((image) => (image as HTMLImageElement).complete)).toBe(true);
    if (!await gallery.locator('[data-active="true"] img').evaluate((image) => (image as HTMLImageElement).naturalWidth)) {
      testInfo.annotations.push({ type: "imagem indisponível", description: "A imagem do seed não carregou; esta captura valida geometria e controles." });
    }
    const bounds = (await gallery.boundingBox())!;
    const photo = (await gallery.locator('[data-active="true"]').boundingBox())!;
    const controls = (await gallery.getByRole("button", { name: "Ampliar imagem" }).boundingBox())!;
    expect(photo.y + photo.height).toBeLessThan(controls.y);
    expect(controls.y + controls.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    await page.screenshot({ path: testInfo.outputPath(`gallery-${width}-${height}-${theme}.png`), fullPage: true });
  }
});
