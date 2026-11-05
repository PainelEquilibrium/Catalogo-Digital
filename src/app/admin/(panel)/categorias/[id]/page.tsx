import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { parseFieldsSchema } from "@/domain/category-fields";
import { prisma } from "@/lib/prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditCategoryPage({ params }: PageProps) {
  const { id } = await params;

  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
  });

  if (!category) {
    notFound();
  }

  let parsedFields: ReturnType<typeof parseFieldsSchema> = [];
  try {
    parsedFields = parseFieldsSchema(category.fieldsSchema);
  } catch {
    parsedFields = [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
      <CategoryForm
        key={category.id}
        initial={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
          fields: parsedFields.map((field) => ({
            key: field.key,
            previousKey: field.key,
            label: field.label,
            type: field.type,
            required: field.required ?? false,
            filterable: field.filterable ?? false,
            options: field.options ?? [],
            placeholder: field.placeholder,
            customerSelects: field.customer_selects === true,
          })),
          coverImageUrl: category.coverImageUrl,
        }}
      />
    </div>
  );
}
