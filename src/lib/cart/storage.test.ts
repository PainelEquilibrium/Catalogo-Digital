import { afterEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_VERSION, type CartState } from "../../domain/cart";
import { clearStoredCart, loadCart, saveCart } from "./storage";

const NOW = 1_800_000_000_000;
const P1 = "11111111-1111-4111-8111-111111111111";
const KEY = "catalogo-cart";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const cartWithLine: CartState = {
  updatedAt: NOW,
  lines: [{ productId: P1, selections: [{ key: "tamanho", label: "Tamanho", value: "M" }], qty: 3 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage do carrinho", () => {
  it("salva e carrega o mesmo carrinho na chave catalogo-cart", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });

    expect(saveCart(cartWithLine)).toBe(true);
    expect(JSON.parse(ls.data.get(KEY) ?? "null")).toEqual({
      version: CART_STORAGE_VERSION,
      updatedAt: NOW,
      lines: cartWithLine.lines,
    });
    expect(loadCart(NOW)).toEqual(cartWithLine);
  });

  it("sem dado salvo, carrega vazio", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(loadCart(NOW)).toEqual({ lines: [], updatedAt: NOW });
  });

  it("clearStoredCart remove a chave", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });
    saveCart(cartWithLine);
    clearStoredCart();
    expect(ls.data.has(KEY)).toBe(false);
  });

  it("localStorage que lança exceção: load vazio, save false, clear sem erro", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new DOMException("bloqueado", "SecurityError");
      },
    });
    expect(loadCart(NOW)).toEqual({ lines: [], updatedAt: NOW });
    expect(saveCart(cartWithLine)).toBe(false);
    expect(() => clearStoredCart()).not.toThrow();
  });

  it("setItem que lança (cota cheia): save false, sem erro", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", {
      localStorage: {
        ...ls,
        setItem: () => {
          throw new DOMException("cheio", "QuotaExceededError");
        },
      },
    });
    expect(saveCart(cartWithLine)).toBe(false);
  });

  it("window indefinido: load vazio e save false", () => {
    expect(loadCart(NOW)).toEqual({ lines: [], updatedAt: NOW });
    expect(saveCart(cartWithLine)).toBe(false);
  });
});
