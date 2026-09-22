import Link from "next/link";
import { CategoryRowActions } from "@/components/admin/category-row-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { queryAdminCategories } from "@/lib/catalog/query-admin-categories";

const copy = copyAdminPtBr.categories;

export default async function AdminCategoriesPage() {
  const categories = await queryAdminCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <Button asChild className="min-h-11">
          <Link href="/admin/categorias/novo">{copy.new}</Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">{copy.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.colName}</TableHead>
              <TableHead>{copy.colSlug}</TableHead>
              <TableHead>{copy.colActive}</TableHead>
              <TableHead>{copy.colProducts}</TableHead>
              <TableHead>{copy.colOrder}</TableHead>
              <TableHead className="text-right">{copy.edit}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell>
                  {category.isActive ? copy.activeYes : copy.activeNo}
                </TableCell>
                <TableCell>{category._count.products}</TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell>
                  <CategoryRowActions categoryId={category.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
