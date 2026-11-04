"use server";

import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { createServerSupabase, requireSignedInProfile } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { prisma } from "@/lib/prisma/client";

const copy = copyAdminPtBr.password;

export async function changeOwnPassword(input: {
  password: string;
  confirmation: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireSignedInProfile();

  if (input.password.length < 8) {
    return { ok: false, message: copy.errorTooShort };
  }
  if (input.password !== input.confirmation) {
    return { ok: false, message: copy.errorMismatch };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    return {
      ok: false,
      message: error.code === "same_password" ? copy.errorSamePassword : copy.errorGeneric,
    };
  }

  const actor = auditActorFor(session);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: session.userId },
        data: { mustChangePassword: false },
      });
      await recordAudit(tx, actor, {
        entityType: "person",
        entityId: session.userId,
        entityLabel: actor.name,
        action: "password_changed",
      });
    });
  } catch {
    console.error("Password change flag persistence failed", { failure: "persistence" });
    return { ok: false, message: copy.errorGeneric };
  }
  return { ok: true };
}
