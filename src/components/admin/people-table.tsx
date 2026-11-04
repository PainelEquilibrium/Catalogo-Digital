"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createManager,
  resetPersonPassword,
  setPersonActive,
} from "@/app/admin/(panel)/usuarios/actions";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import type { PersonRow } from "@/lib/people/list-people";

const copy = copyAdminPtBr.people;

export type PersonView = PersonRow & { canReset: boolean; canToggle: boolean };

type Outcome = { ok: true; tempPassword?: string } | { ok: false; message: string };

export function PeopleTable({ people }: { people: PersonView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function run(task: () => Promise<Outcome>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return false;
      }
      if (result.tempPassword) setTempPassword(result.tempPassword);
      router.refresh();
      return true;
    } catch {
      setError(copy.errorGeneric);
      toast.error(copy.errorGeneric);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (await run(() => createManager({ name, email }))) {
      setName("");
      setEmail("");
    }
  }

  async function toggle(person: PersonView): Promise<Outcome> {
    const result = await setPersonActive(person.id, !person.isActive);
    if (result.ok) toast.success(person.isActive ? copy.deactivated : copy.reactivated);
    return result;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => void handleCreate(event)} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="person-name">{copy.name}</Label>
          <Input id="person-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="person-email">{copy.email}</Label>
          <Input id="person-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy} className="min-h-11">
          {copy.create}
        </Button>
      </form>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {people.length === 0 ? (
        <p className="text-muted-foreground">{copy.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.colName}</TableHead>
              <TableHead>{copy.colEmail}</TableHead>
              <TableHead>{copy.colRole}</TableHead>
              <TableHead>{copy.colStatus}</TableHead>
              <TableHead className="text-right">{copy.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">{person.name}</TableCell>
                <TableCell>{person.email}</TableCell>
                <TableCell>{person.role === "owner" ? copy.roleOwner : copy.roleManager}</TableCell>
                <TableCell>
                  {person.isActive ? copy.statusActive : copy.statusInactive}
                  {person.mustChangePassword ? ` · ${copy.pendingPassword}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {person.canReset ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void run(() => resetPersonPassword(person.id))}
                      >
                        {copy.resetPassword}
                      </Button>
                    ) : null}
                    {person.canToggle ? (
                      <Button
                        type="button"
                        variant={person.isActive ? "destructive" : "outline"}
                        size="sm"
                        disabled={busy}
                        onClick={() => void run(() => toggle(person))}
                      >
                        {person.isActive ? copy.deactivate : copy.reactivate}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <TempPasswordDialog password={tempPassword} onClose={() => setTempPassword(null)} />
    </div>
  );
}
