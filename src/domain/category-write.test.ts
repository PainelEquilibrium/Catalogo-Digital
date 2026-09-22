import { describe, expect, it } from "vitest";
import {
  renamedFieldKeys,
  suggestCopySlug,
  trashCategoryBlocker,
} from "./category-write";

describe("trashCategoryBlocker", () => {
  it("bloqueia quando há produto não deletado", () => {
    expect(trashCategoryBlocker(1)).toBe("has_active_products");
    expect(trashCategoryBlocker(0)).toBeNull();
  });
});

describe("renamedFieldKeys", () => {
  it("acusa troca de key e ignora remoção", () => {
    expect(
      renamedFieldKeys({
        previousKeys: ["cor", "tamanho"],
        next: [{ key: "cores", previousKey: "cor" }, { key: "composicao" }],
      }),
    ).toEqual(["cor"]);
  });
});

describe("suggestCopySlug", () => {
  it("sufixa -copia e incrementa", () => {
    expect(suggestCopySlug("trico", new Set(["trico"]))).toBe("trico-copia");
    expect(suggestCopySlug("trico", new Set(["trico", "trico-copia"]))).toBe(
      "trico-copia-2",
    );
  });
});
