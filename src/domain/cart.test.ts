import { describe, expect, it } from "vitest";
import type { Selection } from "./customer-choices";
import {
  CART_STORAGE_VERSION,
  CART_TTL_MS,
  MAX_CART_LINES,
  addLine,
  lineKey,
  parseStoredCart,
  removeLine,
  setLineQty,
  type CartLine,
  type CartState,
} from "./cart";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;

const sel = (key: string, value: string, label = key): Selection => ({ key, label, value });
const line = (over: Partial<CartLine> = {}): CartLine => ({
  productId: P1,
  selections: [sel("tamanho", "M")],
  qty: 1,
  ...over,
});
const cart = (lines: CartLine[] = [], updatedAt = NOW): CartState => ({ lines, updatedAt });
const stored = (lines: unknown[], updatedAt = NOW) =>
  JSON.stringify({ version: CART_STORAGE_VERSION, updatedAt, lines });

describe("lineKey", () => {
  it("ignora a ordem das escolhas", () => {
    expect(lineKey(line({ selections: [sel("a", "1"), sel("b", "2")] }))).toBe(
      lineKey(line({ selections: [sel("b", "2"), sel("a", "1")] })),
    );
  });

  it("ignora o rótulo da escolha", () => {
    expect(lineKey(line({ selections: [sel("a", "1", "Antigo")] }))).toBe(
      lineKey(line({ selections: [sel("a", "1", "Novo")] })),
    );
  });

  it("mesma peça em outro tamanho tem outra chave", () => {
    expect(lineKey(line({ selections: [sel("tamanho", "M")] }))).not.toBe(
      lineKey(line({ selections: [sel("tamanho", "G")] })),
    );
  });

  it("separador dentro do valor não colide", () => {
    expect(lineKey(line({ selections: [sel("a", "b|c")] }))).not.toBe(
      lineKey(line({ selections: [sel("a|b", "c")] })),
    );
  });

  it("produtos diferentes têm chaves diferentes", () => {
    expect(lineKey(line({ productId: P1 }))).not.toBe(lineKey(line({ productId: P2 })));
  });
});

describe("addLine", () => {
  it("mesma peça em outro tamanho vira outra linha", () => {
    const r = addLine(cart([line()]), line({ selections: [sel("tamanho", "G")] }), NOW);
    expect(r.result).toBe("added");
    expect(r.state.lines).toHaveLength(2);
  });

  it("mesma combinação em ordem diferente soma na mesma linha", () => {
    const a = line({ selections: [sel("tamanho", "M"), sel("cor", "azul")], qty: 1 });
    const b = line({ selections: [sel("cor", "azul"), sel("tamanho", "M")], qty: 2 });
    const r = addLine(cart([a]), b, NOW);
    expect(r.result).toBe("merged");
    expect(r.state.lines).toHaveLength(1);
    expect(r.state.lines[0].qty).toBe(3);
  });

  it("soma que passa de 10 para em 10 e devolve qty_capped", () => {
    const r = addLine(cart([line({ qty: 8 })]), line({ qty: 5 }), NOW);
    expect(r.result).toBe("qty_capped");
    expect(r.state.lines[0].qty).toBe(10);
  });

  it("soma numa linha já em 10 não muda o carrinho e devolve qty_capped", () => {
    const full = cart([line({ qty: 10 })], 5);
    const r = addLine(full, line({ qty: 1 }), NOW);
    expect(r.result).toBe("qty_capped");
    expect(r.state).toBe(full);
  });

  it("linha nova com quantidade acima de 10 para em 10", () => {
    const r = addLine(cart(), line({ qty: 15 }), NOW);
    expect(r.result).toBe("qty_capped");
    expect(r.state.lines[0].qty).toBe(10);
  });

  it("linha 21 é recusada e o carrinho fica igual", () => {
    const lines = Array.from({ length: MAX_CART_LINES }, (_, i) =>
      line({ selections: [sel("n", String(i))] }),
    );
    const full = cart(lines, 5);
    const r = addLine(full, line({ selections: [sel("n", "novo")] }), NOW);
    expect(r.result).toBe("cart_full");
    expect(r.state).toBe(full);
    expect(r.state.updatedAt).toBe(5);
  });

  it("carrinho cheio ainda soma numa linha existente", () => {
    const lines = Array.from({ length: MAX_CART_LINES }, (_, i) =>
      line({ selections: [sel("n", String(i))] }),
    );
    const r = addLine(cart(lines), line({ selections: [sel("n", "0")] }), NOW);
    expect(r.result).toBe("merged");
    expect(r.state.lines[0].qty).toBe(2);
  });

  it("quantidade 0, negativa ou fracionada é normalizada para 1 ou inteiro", () => {
    expect(addLine(cart(), line({ qty: 0 }), NOW).state.lines[0].qty).toBe(1);
    expect(addLine(cart(), line({ qty: -4 }), NOW).state.lines[0].qty).toBe(1);
    expect(addLine(cart(), line({ qty: 2.7 }), NOW).state.lines[0].qty).toBe(2);
  });

  it("altera updatedAt ao adicionar", () => {
    expect(addLine(cart([], 5), line(), NOW).state.updatedAt).toBe(NOW);
  });
});

describe("setLineQty e removeLine", () => {
  const base = cart([line()], 5);
  const key = lineKey(line());

  it("quantidade fica entre 1 e 10", () => {
    expect(setLineQty(base, key, 50, NOW).lines[0].qty).toBe(10);
    expect(setLineQty(base, key, 0, NOW).lines[0].qty).toBe(1);
    expect(setLineQty(base, key, 3.9, NOW).lines[0].qty).toBe(3);
    expect(setLineQty(base, key, Number.NaN, NOW).lines[0].qty).toBe(1);
  });

  it("chave inexistente não muda nada, nem updatedAt", () => {
    expect(setLineQty(base, "nao-existe", 3, NOW)).toBe(base);
    expect(removeLine(base, "nao-existe", NOW)).toBe(base);
  });

  it("mesma quantidade não renova updatedAt", () => {
    expect(setLineQty(base, key, 1, NOW)).toBe(base);
  });

  it("mudar quantidade renova updatedAt", () => {
    expect(setLineQty(base, key, 2, NOW).updatedAt).toBe(NOW);
  });

  it("remover tira a linha e renova updatedAt", () => {
    const r = removeLine(base, key, NOW);
    expect(r.lines).toEqual([]);
    expect(r.updatedAt).toBe(NOW);
  });
});

describe("parseStoredCart", () => {
  const valid = { productId: P1, selections: [sel("tamanho", "M")], qty: 2 };

  it("sem dado salvo dá carrinho vazio", () => {
    expect(parseStoredCart(null, NOW)).toEqual(cart([], NOW));
  });

  it("JSON inválido dá carrinho vazio", () => {
    expect(parseStoredCart("{nao-json", NOW).lines).toEqual([]);
  });

  it.each(["42", "null", "[]", '"texto"'])("valor que não é objeto (%s) dá carrinho vazio", (raw) => {
    expect(parseStoredCart(raw, NOW).lines).toEqual([]);
  });

  it("versão antiga dá carrinho vazio", () => {
    expect(
      parseStoredCart(JSON.stringify({ version: 0, updatedAt: NOW, lines: [valid] }), NOW).lines,
    ).toEqual([]);
  });

  it("carrinho válido é lido com o updatedAt salvo", () => {
    const r = parseStoredCart(stored([valid], NOW - 1000), NOW);
    expect(r.lines).toEqual([valid]);
    expect(r.updatedAt).toBe(NOW - 1000);
  });

  it("com 7 dias exatos ainda vale", () => {
    expect(parseStoredCart(stored([valid], NOW - CART_TTL_MS), NOW).lines).toHaveLength(1);
  });

  it("com 7 dias e 1 ms expira", () => {
    expect(parseStoredCart(stored([valid], NOW - CART_TTL_MS - 1), NOW).lines).toEqual([]);
  });

  it("updatedAt no futuro é descartado, para não manter o carrinho vivo para sempre", () => {
    expect(parseStoredCart(stored([valid], NOW + 1), NOW).lines).toEqual([]);
  });

  it("linha malformada é descartada e as demais ficam", () => {
    const r = parseStoredCart(stored([valid, { productId: "x" }, 42, valid]), NOW);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(4);
  });

  it("productId fora do formato UUID é descartado", () => {
    expect(parseStoredCart(stored([{ ...valid, productId: "1; DROP" }]), NOW).lines).toEqual([]);
  });

  it("quantidade é normalizada para 1 a 10", () => {
    const qtys = [0, -3, 2.5, 50].map((qty, i) => ({ ...valid, selections: [sel("n", String(i))], qty }));
    const r = parseStoredCart(stored(qtys), NOW);
    expect(r.lines.map((l) => l.qty)).toEqual([1, 1, 2, 10]);
  });

  it("quantidade que não é número descarta a linha", () => {
    expect(parseStoredCart(stored([{ ...valid, qty: "3" }]), NOW).lines).toEqual([]);
  });

  it("duplicatas são somadas dentro do limite de 10", () => {
    const r = parseStoredCart(stored([valid, { ...valid, qty: 9 }, { ...valid, selections: [sel("tamanho", "G")] }]), NOW);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].qty).toBe(10);
    expect(r.lines[1].qty).toBe(2);
  });

  it("mais de 20 linhas são cortadas em 20", () => {
    const many = Array.from({ length: MAX_CART_LINES + 5 }, (_, i) => ({
      ...valid,
      selections: [sel("n", String(i))],
    }));
    const r = parseStoredCart(stored(many), NOW);
    expect(r.lines).toHaveLength(MAX_CART_LINES);
    expect(r.lines[0].selections[0].value).toBe("0");
  });

  it("valor de escolha acima do limite descarta a linha", () => {
    const big = { ...valid, selections: [sel("tamanho", "x".repeat(201))] };
    expect(parseStoredCart(stored([big]), NOW).lines).toEqual([]);
  });

  it("dado acima de 64 KB é descartado inteiro, sem lançar", () => {
    const raw = JSON.stringify({ version: CART_STORAGE_VERSION, updatedAt: NOW, lines: [valid], pad: "x".repeat(70_000) });
    expect(parseStoredCart(raw, NOW).lines).toEqual([]);
  });
});
