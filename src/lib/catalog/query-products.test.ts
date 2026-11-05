import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("searchProductIds", () => {
  it("busca inclui valores textuais de attributes (spec §9.2)", () => {
    const source = readFileSync(
      join(__dirname, "query-products.ts"),
      "utf-8",
    );
    expect(source).toContain("p.attributes::text");
    expect(source).toContain("extensions.unaccent(p.attributes::text)");
  });

  it("busca inclui a descrição do produto (spec §7.4)", () => {
    const source = readFileSync(
      join(__dirname, "query-products.ts"),
      "utf-8",
    );
    expect(source).toContain("extensions.unaccent(COALESCE(p.description, ''))");
  });
});
