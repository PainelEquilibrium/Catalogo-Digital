import { describe, expect, it } from "vitest";
import { isEnabled } from "./is-enabled";

describe("isEnabled", () => {
  it("retorna false para flag desconhecida (arquivo vazio)", () => {
    expect(isEnabled("client_only_feature")).toBe(false);
  });

  it("FLAGS_JSON válido liga flag quando chave existe no env", () => {
    expect(isEnabled("x", '{"x":true}')).toBe(true);
    expect(isEnabled("y", '{"x":true}')).toBe(false);
  });

  it("JSON inválido ignora env e usa só o arquivo", () => {
    expect(isEnabled("x", "not-json")).toBe(false);
    expect(isEnabled("x", '{"x":')).toBe(false);
  });

  it("env sobrescreve valor do arquivo quando a chave está no JSON", () => {
    expect(isEnabled("preview_mode", '{"preview_mode":true}')).toBe(true);
  });
});
