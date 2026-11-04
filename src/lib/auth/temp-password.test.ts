import { describe, expect, it } from "vitest";
import { generateTempPassword } from "@/lib/auth/temp-password";

describe("generateTempPassword", () => {
  it("senha temporária tem 24 caracteres base64url e não repete", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(a).not.toBe(b);
  });
});
