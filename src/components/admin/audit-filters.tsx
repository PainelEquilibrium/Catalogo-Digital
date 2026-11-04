import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIT_ENTITIES } from "@/lib/audit/query-audit";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.audit;

type Props = { values: { entidade: string; pessoa: string; de: string; ate: string } };

// Formulário GET puro: a URL é a fonte do filtro, sem estado no cliente.
export function AuditFiltersForm({ values }: Props) {
  return (
    <form method="get" className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[12rem] space-y-2">
        <Label htmlFor="audit-entidade">{copy.filterEntity}</Label>
        <select
          id="audit-entidade"
          name="entidade"
          defaultValue={values.entidade}
          className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-sm"
        >
          <option value="">{copy.filterEntityAll}</option>
          {AUDIT_ENTITIES.map((e) => (
            <option key={e} value={e}>{copy.entities[e]}</option>
          ))}
        </select>
      </div>
      <div className="min-w-[12rem] flex-1 space-y-2">
        <Label htmlFor="audit-pessoa">{copy.filterPerson}</Label>
        <Input id="audit-pessoa" name="pessoa" defaultValue={values.pessoa} className="min-h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="audit-de">{copy.filterFrom}</Label>
        <Input id="audit-de" name="de" type="date" defaultValue={values.de} className="min-h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="audit-ate">{copy.filterUntil}</Label>
        <Input id="audit-ate" name="ate" type="date" defaultValue={values.ate} className="min-h-11" />
      </div>
      <Button type="submit" className="min-h-11">{copy.filterSubmit}</Button>
    </form>
  );
}
