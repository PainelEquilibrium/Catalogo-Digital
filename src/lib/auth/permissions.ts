import type { StaffRole } from "@/lib/auth/roles";

export type StaffAction =
  | "catalog"
  | "view_meta"
  | "purge"
  | "people"
  | "settings"
  | "audit";

const ALL: readonly StaffAction[] = [
  "catalog",
  "view_meta",
  "purge",
  "people",
  "settings",
  "audit",
];

const ALLOWED: Record<StaffRole, readonly StaffAction[]> = {
  owner: ALL,
  support: ALL,
  manager: ["catalog", "view_meta"],
};

export function canPerform(role: StaffRole, action: StaffAction): boolean {
  return ALLOWED[role].includes(action);
}

export type PersonAction = "deactivate" | "reactivate" | "reset_password";

export type PersonActionCode =
  | "self"
  | "support_protected"
  | "owner_requires_support"
  | "manager_forbidden"
  | "last_owner";

export function checkPersonAction(input: {
  actor: { id: string; role: StaffRole };
  target: { id: string; role: StaffRole; isActive: boolean };
  action: PersonAction;
  activeOwnerCount: number;
}): { ok: true } | { ok: false; code: PersonActionCode } {
  const { actor, target, action, activeOwnerCount } = input;
  if (actor.id === target.id) return { ok: false, code: "self" };
  if (target.role === "support") return { ok: false, code: "support_protected" };
  if (actor.role === "manager") return { ok: false, code: "manager_forbidden" };
  if (actor.role === "owner" && target.role === "owner") {
    return { ok: false, code: "owner_requires_support" };
  }
  if (
    action === "deactivate" &&
    target.role === "owner" &&
    target.isActive &&
    activeOwnerCount <= 1
  ) {
    return { ok: false, code: "last_owner" };
  }
  return { ok: true };
}
