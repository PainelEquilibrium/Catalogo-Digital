import { describe, expect, it } from "vitest";
import {
  PRICE_NULL_CURSOR,
  buildKeysetWhere,
  cursorValueFromProduct,
  parseCursorDate,
} from "@/lib/catalog/catalog-where";

const numericCursor = {
  o: "preco_asc" as const,
  v: "199.90",
  i: "00000000-0000-4000-8000-000000000001",
};

describe("buildKeysetWhere — preço com nulls last", () => {
  it("preco_asc com preço numérico inclui price: null no OR", () => {
    const where = buildKeysetWhere("preco_asc", numericCursor);

    expect(where).toEqual({
      OR: [
        { price: { gt: "199.90" } },
        { price: "199.90", id: { gt: numericCursor.i } },
        { price: null },
      ],
    });
  });

  it("preco_desc com preço numérico inclui price: null no OR", () => {
    const where = buildKeysetWhere("preco_desc", {
      ...numericCursor,
      o: "preco_desc",
    });

    expect(where).toEqual({
      OR: [
        { price: { lt: "199.90" } },
        { price: "199.90", id: { lt: numericCursor.i } },
        { price: null },
      ],
    });
  });

  it("preco_asc com cursor null só pagina dentro de price null", () => {
    const where = buildKeysetWhere("preco_asc", {
      o: "preco_asc",
      v: PRICE_NULL_CURSOR,
      i: numericCursor.i,
    });

    expect(where).toEqual({ price: null, id: { gt: numericCursor.i } });
    expect(where).not.toHaveProperty("OR");
  });

  it("preco_desc com cursor null só pagina dentro de price null", () => {
    const where = buildKeysetWhere("preco_desc", {
      o: "preco_desc",
      v: PRICE_NULL_CURSOR,
      i: numericCursor.i,
    });

    expect(where).toEqual({ price: null, id: { lt: numericCursor.i } });
    expect(where).not.toHaveProperty("OR");
  });
});

describe("buildKeysetWhere — novidades (intervalo de µs no cursor)", () => {
  const productId = "00000000-0000-4000-8000-000000000099";

  it("cursorValueFromProduct e parseCursorDate usam a mesma marca ms", () => {
    const createdAt = new Date("2024-06-15T10:30:00.123Z");
    const v = cursorValueFromProduct(
      {
        id: productId,
        createdAt,
        price: null,
        isFeatured: false,
      },
      "novidades",
    );
    expect(v).toBe("2024-06-15T10:30:00.123Z");
    expect(parseCursorDate(v).getTime()).toBe(createdAt.getTime());
  });

  it("buildKeysetWhere novidades NÃO usa igualdade exata de createdAt; usa lt + intervalo [ms, ms+1) + id", () => {
    const v = "2024-06-15T10:30:00.123Z";
    const where = buildKeysetWhere("novidades", {
      o: "novidades",
      v,
      i: productId,
    });

    expect(where).toEqual({
      OR: [
        { createdAt: { lt: new Date(v) } },
        {
          AND: [
            { createdAt: { gte: new Date(v) } },
            { createdAt: { lt: new Date("2024-06-15T10:30:00.124Z") } },
            { id: { lt: productId } },
          ],
        },
      ],
    });
  });

  it("bound superior do intervalo é sempre cursor.getTime() + 1ms (cobre µs residuais no banco)", () => {
    const v = "2024-06-15T10:30:00.123Z";
    const where = buildKeysetWhere("novidades", {
      o: "novidades",
      v,
      i: productId,
    }) as {
      OR: [
        unknown,
        {
          AND: [unknown, { createdAt: { lt: Date } }, unknown];
        },
      ];
    };

    const upperBound = where.OR[1].AND[1].createdAt.lt;
    expect(upperBound.getTime()).toBe(new Date(v).getTime() + 1);
    expect(upperBound.toISOString()).toBe("2024-06-15T10:30:00.124Z");
  });
});

describe("buildKeysetWhere — destaque (mesmo padrão de intervalo)", () => {
  const productId = "00000000-0000-4000-8000-000000000098";
  const cursorDate = new Date("2024-06-15T10:30:00.123Z");
  const upperBound = new Date("2024-06-15T10:30:00.124Z");

  it("featured: usa lt + intervalo [ms, ms+1) + id dentro de isFeatured: true, mantendo ramo isFeatured: false", () => {
    const where = buildKeysetWhere("destaque", {
      o: "destaque",
      v: "1|2024-06-15T10:30:00.123Z",
      i: productId,
    });

    expect(where).toEqual({
      OR: [
        { isFeatured: true, createdAt: { lt: cursorDate } },
        {
          isFeatured: true,
          AND: [
            { createdAt: { gte: cursorDate } },
            { createdAt: { lt: upperBound } },
            { id: { lt: productId } },
          ],
        },
        { isFeatured: false },
      ],
    });
  });

  it("não-featured: usa lt + intervalo [ms, ms+1) + id dentro de isFeatured: false", () => {
    const where = buildKeysetWhere("destaque", {
      o: "destaque",
      v: "0|2024-06-15T10:30:00.123Z",
      i: productId,
    });

    expect(where).toEqual({
      isFeatured: false,
      OR: [
        { createdAt: { lt: cursorDate } },
        {
          AND: [
            { createdAt: { gte: cursorDate } },
            { createdAt: { lt: upperBound } },
            { id: { lt: productId } },
          ],
        },
      ],
    });
  });
});
