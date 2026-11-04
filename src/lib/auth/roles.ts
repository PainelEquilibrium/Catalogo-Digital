export type StaffRole = "owner" | "manager" | "support";

const STAFF_ROLES: ReadonlySet<string> = new Set([
  "owner",
  "manager",
  "support",
]);

export function parseStaffRole(
  role: string | null | undefined,
): StaffRole | null {
  if (role == null || role === "") {
    return null;
  }
  if (STAFF_ROLES.has(role)) {
    return role as StaffRole;
  }
  return null;
}
