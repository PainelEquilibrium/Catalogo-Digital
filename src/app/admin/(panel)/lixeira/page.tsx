import Link from "next/link";
import { TrashRestoreButton } from "@/components/admin/trash-restore-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canPerform } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { daysUntilPurge } from "@/lib/maintenance/purge-trash";
import { queryTrash } from "./actions";

const copy = copyAdminPtBr.trash;
const chromeCopy = copyAdminPtBr.chrome;

type PageProps = {
  searchParams: Promise<{ tipo?: string }>;
};

function parseTipo(raw: string | undefined): "produtos" | "categorias" {
  if (raw === "categorias") {
    return "categorias";
  }
  return "produtos";
}

export default async function AdminTrashPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tipo = parseTipo(params.tipo);
  const { products, categories } = await queryTrash();
  const canPurge = canPerform((await requireStaff()).role, "purge");
  const now = new Date();

  const items = tipo === "produtos" ? products : categories;
  const emptyMessage =
    tipo === "produtos" ? copy.emptyProducts : copy.emptyCategories;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {chromeCopy.trash}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.policyNote}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tipo === "produtos" ? "default" : "outline"}
          className="min-h-11"
          asChild
        >
          <Link href="/admin/lixeira?tipo=produtos">{copy.tabProducts}</Link>
        </Button>
        <Button
          variant={tipo === "categorias" ? "default" : "outline"}
          className="min-h-11"
          asChild
        >
          <Link href="/admin/lixeira?tipo=categorias">
            {copy.tabCategories}
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">{emptyMessage}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.colName}</TableHead>
              <TableHead>{copy.colSlug}</TableHead>
              <TableHead>{copy.colDeletedAt}</TableHead>
              <TableHead>{copy.colRemaining}</TableHead>
              <TableHead className="text-right">{copy.restore}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.slug}</TableCell>
                <TableCell>
                  {item.deletedAt.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  {copy.remainingDays(daysUntilPurge(item.deletedAt, now))}
                </TableCell>
                <TableCell className="text-right">
                  <TrashRestoreButton
                    canPurge={canPurge}
                    kind={tipo === "produtos" ? "product" : "category"}
                    itemId={item.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
