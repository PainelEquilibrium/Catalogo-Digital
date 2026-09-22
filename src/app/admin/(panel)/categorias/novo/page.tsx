import { CategoryForm } from "@/components/admin/category-form";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.categories;

export default function AdminNewCategoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.new}</h1>
      <CategoryForm />
    </div>
  );
}
