import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.fn que lança falha o teste mesmo com o erro tratado (vitest 5); função comum evita isso.
const state = vi.hoisted(() => ({ impl: async (): Promise<unknown> => [], calls: 0 }));
vi.mock("@/lib/catalog/query-cart-products", () => ({
  queryCartProducts: () => {
    state.calls++;
    return state.impl();
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const call = (body: unknown) =>
  POST(new Request("http://x/api/vitrine/carrinho", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/vitrine/carrinho", () => {
  beforeEach(() => {
    state.calls = 0;
  });

  it("devolve os itens sem cache", async () => {
    state.impl = async () => [{ id: ID }];
    const res = await call({ ids: [ID] });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ items: [{ id: ID }] });
  });

  it("recusa corpo inválido, id que não é UUID e mais de 20 ids com 400", async () => {
    for (const body of ["não é json", {}, { ids: ["x"] }, { ids: Array(21).fill(ID) }]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(state.calls).toBe(0);
  });

  it("falha de banco vira 503 sem detalhe interno", async () => {
    state.impl = async () => {
      throw new Error("password authentication failed for user postgres");
    };
    const res = await call({ ids: [ID] });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/postgres|password/);
  });
});
