import { describe, expect, it } from "vitest";
import type { CategoryField } from "./category-fields";
import {
  customerChoices,
  initialSelections,
  missingChoices,
  toSelections,
} from "./customer-choices";

const tamanho: CategoryField = {
  key: "tamanho",
  label: "Tamanho",
  type: "multiselect",
  options: ["PP", "P", "M", "G"],
  customer_selects: true,
};
const cor: CategoryField = {
  key: "cor",
  label: "Cor",
  type: "select",
  options: ["Preto", "Bege"],
  customer_selects: true,
};

describe("customerChoices", () => {
  it("multiselect com array vira opções, na ordem do produto", () => {
    expect(customerChoices([tamanho], { tamanho: ["M", "P"] })).toEqual([
      { key: "tamanho", label: "Tamanho", options: ["M", "P"] },
    ]);
  });

  it("select com string vira uma opção", () => {
    expect(customerChoices([cor], { cor: "Bege" })).toEqual([
      { key: "cor", label: "Cor", options: ["Bege"] },
    ]);
  });

  it("campo sem valor, ou com array vazio, não aparece", () => {
    expect(customerChoices([tamanho, cor], { tamanho: [] })).toEqual([]);
  });

  it("campo sem customer_selects não aparece", () => {
    const plain: CategoryField = { ...tamanho, customer_selects: undefined };
    expect(customerChoices([plain], { tamanho: ["M"] })).toEqual([]);
  });

  it("valor que não é string é ignorado sem lançar", () => {
    expect(() =>
      customerChoices([tamanho, cor], {
        tamanho: { nao: "array" },
        cor: 42,
      }),
    ).not.toThrow();
    expect(
      customerChoices([tamanho, cor], { tamanho: { nao: "array" }, cor: 42 }),
    ).toEqual([]);
  });

  it("descarta itens que não são string, vazios e duplicados", () => {
    expect(
      customerChoices([tamanho], { tamanho: ["M", 7, null, " ", "M", "G"] }),
    ).toEqual([{ key: "tamanho", label: "Tamanho", options: ["M", "G"] }]);
  });
});

describe("initialSelections", () => {
  it("opção única já vem selecionada", () => {
    const choices = customerChoices([tamanho, cor], {
      tamanho: ["M", "G"],
      cor: ["Preto"],
    });
    expect(initialSelections(choices)).toEqual({ cor: "Preto" });
  });
});

describe("missingChoices", () => {
  it("lista só o que falta", () => {
    const choices = customerChoices([tamanho, cor], {
      tamanho: ["M", "G"],
      cor: ["Preto", "Bege"],
    });
    expect(missingChoices(choices, { cor: "Bege" })).toEqual([
      { key: "tamanho", label: "Tamanho", options: ["M", "G"] },
    ]);
  });

  it("valor que não é uma das opções conta como faltando", () => {
    const choices = customerChoices([tamanho], { tamanho: ["M", "G"] });
    expect(missingChoices(choices, { tamanho: "XG" })).toEqual(choices);
  });
});

describe("toSelections", () => {
  it("devolve só as escolhas feitas, com rótulo e valor", () => {
    const choices = customerChoices([tamanho, cor], {
      tamanho: ["M", "G"],
      cor: ["Preto", "Bege"],
    });
    expect(toSelections(choices, { tamanho: "G", cor: "Preto" })).toEqual([
      { key: "tamanho", label: "Tamanho", value: "G" },
      { key: "cor", label: "Cor", value: "Preto" },
    ]);
  });
});
