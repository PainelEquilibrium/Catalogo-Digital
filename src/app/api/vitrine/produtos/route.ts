import { NextResponse } from "next/server";
import { queryProducts } from "@/lib/catalog/query-products";
import { queryCategoryBySlug } from "@/lib/catalog/query-categories";
import {
  parseVitrineFieldsSchema,
  parseVitrineProductsRequest,
} from "@/lib/catalog/parse-vitrine-request";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const slugParam = searchParams.get("slug");

  if (slugParam === null || slugParam.trim().length === 0) {
    return NextResponse.json(
      { error: "slug é obrigatório" },
      { status: 400 },
    );
  }

  const category = await queryCategoryBySlug(slugParam.trim());
  if (!category) {
    return NextResponse.json(
      { error: "categoria não encontrada" },
      { status: 404 },
    );
  }

  const fieldsSchema = parseVitrineFieldsSchema(category.fieldsSchema);
  if (!fieldsSchema) {
    return NextResponse.json(
      { error: "schema da categoria inválido" },
      { status: 400 },
    );
  }

  const parsed = parseVitrineProductsRequest(searchParams, fieldsSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }

  const result = await queryProducts({
    categorySlug: parsed.slug,
    query: parsed.query,
  });

  return NextResponse.json(result);
}
