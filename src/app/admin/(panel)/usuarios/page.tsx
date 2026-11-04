import { redirect } from "next/navigation";
import { PeopleTable } from "@/components/admin/people-table";
import { checkPersonAction } from "@/lib/auth/permissions";
import { parseStaffRole } from "@/lib/auth/roles";
import { requireAction, StaffAuthError, type StaffSession } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { listPeople } from "@/lib/people/list-people";

export default async function AdminPeoplePage() {
  let session: StaffSession;
  try {
    session = await requireAction("people");
  } catch (error) {
    if (error instanceof StaffAuthError) redirect("/admin/sem-acesso");
    throw error;
  }

  const rows = await listPeople();
  const activeOwnerCount = rows.filter((p) => p.role === "owner" && p.isActive).length;
  const actor = { id: session.userId, role: session.role };
  const people = rows.map((person) => {
    const target = { id: person.id, role: parseStaffRole(person.role) ?? "manager", isActive: person.isActive };
    const allowed = (action: "reset_password" | "deactivate" | "reactivate") =>
      checkPersonAction({ actor, target, action, activeOwnerCount }).ok;
    return {
      ...person,
      canReset: allowed("reset_password"),
      canToggle: allowed(person.isActive ? "deactivate" : "reactivate"),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copyAdminPtBr.people.title}</h1>
      <PeopleTable people={people} />
    </div>
  );
}
