import { ProductForm } from "@/components/admin/product-form";
import { parseFieldsSchema } from "@/domain/category-fields";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { queryAdminCategories } from "@/lib/catalog/query-admin-categories";

const copy = copyAdminPtBr.products;

export default async function AdminNewProductPage() {
  const categories = await queryAdminCategories();

  const options = categories.map((category) => {
    let fields: ReturnType<typeof parseFieldsSchema> = [];
    try {
      fields = parseFieldsSchema(category.fieldsSchema);
    } catch {
      fields = [];
    }
    return {
      id: category.id,
      name: category.name,
      fields,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.new}</h1>
      {options.length === 0 ? (
        <p className="text-muted-foreground">{copy.errorNoCategories}</p>
      ) : (
        <ProductForm categories={options} />
      )}
    </div>
  );
}
