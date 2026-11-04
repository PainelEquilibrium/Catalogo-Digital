import { describe, expect, it } from "vitest";
import {
  canPerform,
  checkPersonAction,
  type PersonAction,
  type StaffAction,
} from "./permissions";
import type { StaffRole } from "./roles";

describe("canPerform", () => {
  it.each([
    ["manager", "catalog", true],
    ["manager", "view_meta", true],
    ["manager", "purge", false],
    ["manager", "people", false],
    ["manager", "settings", false],
    ["manager", "audit", false],
    ["owner", "purge", true],
    ["owner", "people", true],
    ["owner", "settings", true],
    ["owner", "audit", true],
    ["support", "purge", true],
    ["support", "audit", true],
  ] as [StaffRole, StaffAction, boolean][])(
    "canPerform(%s, %s) = %s",
    (role, action, expected) => {
      expect(canPerform(role, action)).toBe(expected);
    },
  );
});

const run = (
  actorRole: StaffRole,
  targetRole: StaffRole,
  action: PersonAction = "deactivate",
  over: { sameId?: boolean; activeOwnerCount?: number } = {},
) =>
  checkPersonAction({
    actor: { id: "a", role: actorRole },
    target: { id: over.sameId ? "a" : "t", role: targetRole, isActive: true },
    action,
    activeOwnerCount: over.activeOwnerCount ?? 2,
  });

describe("checkPersonAction", () => {
  it("nega a si mesmo", () => {
    expect(run("owner", "manager", "deactivate", { sameId: true })).toEqual({
      ok: false,
      code: "self",
    });
  });

  it("ninguém age sobre suporte", () => {
    for (const actor of ["support", "owner"] as const) {
      expect(run(actor, "support")).toEqual({
        ok: false,
        code: "support_protected",
      });
    }
  });

  it("dono não age sobre dono", () => {
    expect(run("owner", "owner")).toEqual({
      ok: false,
      code: "owner_requires_support",
    });
  });

  it("gestor não age sobre ninguém", () => {
    expect(run("manager", "manager")).toEqual({
      ok: false,
      code: "manager_forbidden",
    });
    expect(run("manager", "owner")).toEqual({
      ok: false,
      code: "manager_forbidden",
    });
  });

  it("dono age sobre gestor", () => {
    expect(run("owner", "manager")).toEqual({ ok: true });
  });

  it("suporte não desativa último dono ativo", () => {
    expect(
      run("support", "owner", "deactivate", { activeOwnerCount: 1 }),
    ).toEqual({ ok: false, code: "last_owner" });
  });

  it("suporte desativa dono se houver outro ativo", () => {
    expect(run("support", "owner", "deactivate")).toEqual({ ok: true });
  });

  it("suporte gera senha do único dono", () => {
    expect(
      run("support", "owner", "reset_password", { activeOwnerCount: 1 }),
    ).toEqual({ ok: true });
  });
});
