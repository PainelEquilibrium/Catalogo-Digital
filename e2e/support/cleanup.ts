import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

// Helpers de E2E: contas `e2e-*` no DEV, sempre apagadas ao final. A chave de serviço
// só é lida aqui (código de teste), nunca no runtime da aplicação. SQL direto via pg
// porque o cliente Prisma gerado é ESM e o Playwright carrega os testes como CJS.
export const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

export type E2eAccount = { id: string; email: string; password: string };

export async function createE2eAccount(
  options: { role?: string; mustChangePassword?: boolean } = {},
): Promise<E2eAccount> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = `Tmp-${suffix}-Aa1!`;
  const { data, error } = await authAdmin().createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser falhou: ${error?.message}`);

  const id = data.user.id;
  // O trigger já criou o perfil (inativo); ativamos para o teste.
  await db.query(
    `insert into profiles (id, email, name, role, is_active, must_change_password)
     values ($1, $2, $3, $4, true, $5)
     on conflict (id) do update set role = $4, is_active = true, must_change_password = $5`,
    [id, email, `e2e-${suffix}`, options.role ?? "manager", options.mustChangePassword ?? true],
  );
  return { id, email, password };
}

export async function deleteE2eAccount(id: string): Promise<void> {
  await db.query("delete from profiles where id = $1", [id]);
  await authAdmin().deleteUser(id);
}

export async function mustChangePassword(id: string): Promise<boolean> {
  const { rows } = await db.query("select must_change_password from profiles where id = $1", [id]);
  return rows[0]?.must_change_password;
}

export const setMustChangePassword = (id: string, value: boolean) =>
  db.query("update profiles set must_change_password = $2 where id = $1", [id, value]);

export async function countCategoriesNamed(name: string): Promise<number> {
  const { rows } = await db.query("select count(*)::int as n from categories where name = $1", [name]);
  return rows[0].n;
}
