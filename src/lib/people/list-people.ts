import { prisma } from "@/lib/prisma/client";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

// Sem guarda própria: só a página (após requireAction) chama. A conta de suporte nunca sai daqui.
export function listPeople(): Promise<PersonRow[]> {
  return prisma.profile.findMany({
    where: { role: { not: "support" } },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}
