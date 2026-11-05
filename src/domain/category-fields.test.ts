import { describe, expect, it } from "vitest";
import { parseFieldsSchema } from "./category-fields";

describe("parseFieldsSchema", () => {
  it("rejeita type group", () => {
    expect(() =>
      parseFieldsSchema([
        { key: "secao", label: "Seção", type: "group" },
      ]),
    ).toThrow();
  });

  it("rejeita key duplicada", () => {
    expect(() =>
      parseFieldsSchema([
        { key: "cor", label: "Cor", type: "text" },
        { key: "cor", label: "Cor 2", type: "text" },
      ]),
    ).toThrow();
  });

  it("rejeita select sem options", () => {
    expect(() =>
      parseFieldsSchema([{ key: "marca", label: "Marca", type: "select" }]),
    ).toThrow();
  });

  it("rejeita multiselect com options vazio", () => {
    expect(() =>
      parseFieldsSchema([
        { key: "cor", label: "Cor", type: "multiselect", options: [] },
      ]),
    ).toThrow();
  });

  it("rejeita key fora do slug [a-z0-9_]", () => {
    expect(() =>
      parseFieldsSchema([{ key: "Cor", label: "Cor", type: "text" }]),
    ).toThrow();
  });

  it("aceita schema válido de categoria", () => {
    const fields = parseFieldsSchema([
      {
        key: "cor",
        label: "Cor",
        type: "multiselect",
        filterable: true,
        options: ["Preto", "Bege", "Branco"],
      },
      {
        key: "tamanho",
        label: "Tamanho",
        type: "multiselect",
        filterable: true,
        options: ["P", "M", "G"],
      },
      { key: "composicao", label: "Composição", type: "text" },
      { key: "busto_cm", label: "Busto (cm)", type: "number" },
    ]);

    expect(fields).toHaveLength(4);
    expect(fields[0]).toMatchObject({
      key: "cor",
      type: "multiselect",
      filterable: true,
    });
  });
});

describe("customer_selects", () => {
  it("aceita customer_selects em select e multiselect", () => {
    expect(() =>
      parseFieldsSchema([
        {
          key: "cor",
          label: "Cor",
          type: "select",
          options: ["Preto"],
          customer_selects: true,
        },
        {
          key: "tamanho",
          label: "Tamanho",
          type: "multiselect",
          options: ["P"],
          customer_selects: true,
        },
      ]),
    ).not.toThrow();
  });

  it("rejeita customer_selects em campo text", () => {
    expect(() =>
      parseFieldsSchema([
        { key: "composicao", label: "Composição", type: "text", customer_selects: true },
      ]),
    ).toThrow();
  });

  it("aceita schema antigo sem customer_selects", () => {
    expect(() =>
      parseFieldsSchema([
        { key: "cor", label: "Cor", type: "multiselect", options: ["Preto"] },
      ]),
    ).not.toThrow();
  });
});
