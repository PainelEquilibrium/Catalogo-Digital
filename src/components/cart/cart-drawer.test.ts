// @vitest-environment jsdom
import { createElement, act, Fragment, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CartDrawer } from "./cart-drawer";
import { CartProvider, useCart, type CartConfig } from "./cart-provider";
import { copyPtBr } from "@/lib/copy/pt-br";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = (whatsappNumber: string | null): CartConfig => ({
  whatsappNumber,
  itemTemplate: "{product_name}",
  orderTemplate: "{items_list}",
  showPrices: true,
  currency: "BRL",
  siteUrl: "https://loja.test",
});

function Opener() {
  const { setOpen } = useCart();
  return createElement("button", { onClick: () => setOpen(true) }, "abrir");
}

async function renderOpen(whatsappNumber: string | null) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(
        CartProvider,
        { config: config(whatsappNumber) } as ComponentProps<typeof CartProvider>, // createElement não vê os filhos do 3º argumento
        createElement(Fragment, null, createElement(Opener), createElement(CartDrawer)),
      ));
  });
  await act(async () => host.querySelector("button")!.click());
  return () => act(async () => root.unmount());
}

describe("CartDrawer sem número", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("avisa e deixa o envio indisponível quando a loja não tem número", async () => {
    const unmount = await renderOpen(null);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain(copyPtBr.cart.noNumber);
    const send = [...dialog.querySelectorAll("button")].find((b) => b.textContent === copyPtBr.cart.send);
    expect(send?.disabled).toBe(true);
    await unmount();
  });

  it("número só com símbolos também conta como sem número", async () => {
    const unmount = await renderOpen("+--");
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(copyPtBr.cart.noNumber);
    await unmount();
  });
});
