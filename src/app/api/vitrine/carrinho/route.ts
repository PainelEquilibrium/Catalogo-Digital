import { NextResponse } from "next/server";
import { z } from "zod";
import { queryCartProducts } from "@/lib/catalog/query-cart-products";
import { MAX_CART_LINES } from "@/domain/cart";

const bodySchema = z.object({ ids: z.array(z.uuid()).max(MAX_CART_LINES) });

// Resposta depende do banco no momento do pedido: nunca pode vir de cache.
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: noStore });
  }

  try {
    const items = await queryCartProducts([...new Set(parsed.data.ids)]);
    return NextResponse.json({ items }, { headers: noStore });
  } catch (error) {
    // Só a classe do erro: a mensagem pode trazer dados de conexão.
    console.error("Cart revalidation failed", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Indisponível no momento." }, { status: 503, headers: noStore });
  }
}
