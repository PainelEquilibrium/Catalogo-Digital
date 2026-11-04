import type { SupabaseClient } from "@supabase/supabase-js";

export async function replaceUserPassword(admin: SupabaseClient, userId: string, password: string): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error("password update failed");
}
