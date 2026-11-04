import Link from "next/link";
import { redirect } from "next/navigation";
import { AuditFiltersForm } from "@/components/admin/audit-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseAuditFilters, queryAudit } from "@/lib/audit/query-audit";
import { requireAction, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.audit;

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

function Json({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-w-xl overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  try {
    await requireAction("audit");
  } catch (error) {
    if (error instanceof StaffAuthError) redirect("/admin/sem-acesso");
    throw error;
  }

  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])),
  );
  const { rows, nextCursor } = await queryAudit(parseAuditFilters(params));

  const moreParams = new URLSearchParams(params);
  if (nextCursor) moreParams.set("cursor", nextCursor);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <AuditFiltersForm
        values={{
          entidade: params.get("entidade") ?? "",
          pessoa: params.get("pessoa") ?? "",
          de: params.get("de") ?? "",
          ate: params.get("ate") ?? "",
        }}
      />
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{copy.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.colWhen}</TableHead>
              <TableHead>{copy.colActor}</TableHead>
              <TableHead>{copy.colEntity}</TableHead>
              <TableHead>{copy.colAction}</TableHead>
              <TableHead>{copy.colDetails}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </TableCell>
                <TableCell>{row.actorName}</TableCell>
                <TableCell>
                  {copy.entities[row.entityType as keyof typeof copy.entities] ?? row.entityType}
                  {": "}
                  {row.entityLabel}
                </TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell>
                  {row.before == null && row.after == null ? null : (
                    <details>
                      <summary className="cursor-pointer text-sm">{copy.colDetails}</summary>
                      <div className="mt-2 space-y-2">
                        <Json label={copy.before} value={row.before} />
                        <Json label={copy.after} value={row.after} />
                      </div>
                    </details>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {nextCursor ? (
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/admin/auditoria?${moreParams.toString()}`}>{copy.loadMore}</Link>
        </Button>
      ) : null}
    </div>
  );
}
