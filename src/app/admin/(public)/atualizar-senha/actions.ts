"use server";

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

  // Auditoria entra na Task 4; aqui só a flag cai.
  await prisma.profile.update({
    where: { id: session.userId },
    data: { mustChangePassword: false },
  });
  return { ok: true };
}
