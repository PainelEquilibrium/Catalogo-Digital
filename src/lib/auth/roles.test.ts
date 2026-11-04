import { describe, expect, it } from "vitest";
import { parseStaffRole } from "./roles";

describe("parseStaffRole", () => {
  it("aceita owner e manager", () => {
    expect(parseStaffRole("owner")).toBe("owner");
    expect(parseStaffRole("manager")).toBe("manager");
  });

  it("aceita support", () => {
    expect(parseStaffRole("support")).toBe("support");
  });

  it("rejeita null, admin e string vazia", () => {
    expect(parseStaffRole(null)).toBeNull();
    expect(parseStaffRole("admin")).toBeNull();
    expect(parseStaffRole("")).toBeNull();
  });
});
