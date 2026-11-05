import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { parseFieldsSchema } from "@/domain/category-fields";
import { decimalToNumber } from "@/domain/product";
import { queryAdminCategories } from "@/lib/catalog/query-admin-categories";
import { prisma } from "@/lib/prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditProductPage({ params }: PageProps) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    queryAdminCategories(),
  ]);

  if (!product) {
    notFound();
  }

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

  const attributes =
    product.attributes != null &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes)
      ? (product.attributes as Record<string, unknown>)
      : {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
      <ProductForm
        categories={options}
        initial={{
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          slug: product.slug,
          price: decimalToNumber(product.price),
          promoPrice: decimalToNumber(product.promoPrice),
          description: product.description,
          isFeatured: product.isFeatured,
          status: product.status,
          attributes,
          images: product.images.map((image) => ({
            id: image.id,
            thumbUrl: image.thumbUrl,
            sortOrder: image.sortOrder,
          })),
        }}
      />
    </div>
  );
}
