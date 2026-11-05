import type { Prisma } from "@/generated/prisma/client";

// Serializa ler-e-gravar da mesma chave de store_settings (upload x salvar texto). Advisory lock vale
// também para chave ainda inexistente, onde FOR UPDATE não trava nada. Ordem fixa evita deadlock.
export async function lockSettingKeys(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`store_settings:${key}`}))`;
  }
}
