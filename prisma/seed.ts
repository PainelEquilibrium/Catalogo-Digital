import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";

const FIELDS_SCHEMA = [
  {
    key: "cor",
    label: "Cor",
    type: "multiselect",
    filterable: true,
    options: ["Preto", "Branco", "Bege", "Azul", "Rosa", "Jeans"],
  },
  {
    key: "tamanho",
    label: "Tamanho",
    type: "multiselect",
    filterable: true,
    options: ["PP", "P", "M", "G", "GG"],
  },
  {
    key: "composicao",
    label: "Composição",
    type: "text",
    placeholder: "Ex.: 100% algodão",
  },
  {
    key: "busto_cm",
    label: "Busto (cm)",
    type: "number",
  },
] as const;

function imageUrls(productSlug: string, index: number) {
  const label = `${productSlug}-${index}`;
  return {
    storagePath: `seed/${productSlug}/${index}.webp`,
    thumbUrl: `https://placehold.co/400x400/png?text=${encodeURIComponent(label)}`,
    cardUrl: `https://placehold.co/800x800/png?text=${encodeURIComponent(label)}`,
    detailUrl: `https://placehold.co/1600x1600/png?text=${encodeURIComponent(label)}`,
    ogUrl: `https://placehold.co/1200x630/png?text=${encodeURIComponent(label)}`,
    width: 800,
    height: 800,
    sizeKb: 120,
  };
}

type SeedProduct = {
  slug: string;
  name: string;
  categorySlug: "trico" | "jeans";
  status: "published" | "draft";
  price: string | null;
  promoPrice?: string | null;
  isFeatured?: boolean;
  attributes: Record<string, string | number | string[]>;
};

const PUBLISHED_PRODUCTS: SeedProduct[] = [
  {
    slug: "blusa-trico-cashmere",
    name: "Blusa Tricô Cashmere",
    categorySlug: "trico",
    status: "published",
    price: "189.90",
    promoPrice: "149.90",
    isFeatured: true,
    attributes: {
      cor: ["Bege"],
      tamanho: ["M", "G"],
      composicao: "70% viscose, 30% poliamida",
      busto_cm: 92,
    },
  },
  {
    slug: "cardigan-listrado",
    name: "Cardigan Listrado",
    categorySlug: "trico",
    status: "published",
    price: "219.00",
    attributes: {
      cor: ["Azul", "Branco"],
      tamanho: ["P", "M"],
      composicao: "100% algodão",
    },
  },
  {
    slug: "vestido-trico-midi",
    name: "Vestido Tricô Midi",
    categorySlug: "trico",
    status: "published",
    price: null,
    attributes: {
      cor: ["Preto"],
      tamanho: ["M"],
      composicao: "Malha premium",
    },
  },
  {
    slug: "colete-trico-fendi",
    name: "Colete Tricô Textura",
    categorySlug: "trico",
    status: "published",
    price: "159.90",
    attributes: { cor: ["Rosa"], tamanho: ["P"], composicao: "Acrylic blend" },
  },
  {
    slug: "blusa-gola-alta",
    name: "Blusa Gola Alta",
    categorySlug: "trico",
    status: "published",
    price: "129.90",
    attributes: { cor: ["Branco"], tamanho: ["G"], composicao: "Lã merino" },
  },
  {
    slug: "saia-trico-plissada",
    name: "Saia Tricô Plissada",
    categorySlug: "trico",
    status: "published",
    price: "179.00",
    attributes: { cor: ["Bege"], tamanho: ["M", "G"] },
  },
  {
    slug: "poncho-trico-leve",
    name: "Poncho Tricô Leve",
    categorySlug: "trico",
    status: "published",
    price: "199.90",
    attributes: { cor: ["Azul"], tamanho: ["G"] },
  },
  {
    slug: "regata-trico-fina",
    name: "Regata Tricô Fina",
    categorySlug: "trico",
    status: "published",
    price: "89.90",
    attributes: { cor: ["Preto"], tamanho: ["P", "M"] },
  },
  {
    slug: "casaco-trico-oversized",
    name: "Casaco Tricô Oversized",
    categorySlug: "trico",
    status: "published",
    price: "249.90",
    attributes: { cor: ["Bege"], tamanho: ["M", "G"], composicao: "Lã e acrílico" },
  },
  {
    slug: "shorts-trico-conforto",
    name: "Shorts Tricô Conforto",
    categorySlug: "trico",
    status: "published",
    price: "119.00",
    attributes: { cor: ["Rosa"], tamanho: ["P", "PP"], composicao: "100% algodão" },
  },
  {
    slug: "top-trico-croche",
    name: "Top Tricô Crochê",
    categorySlug: "trico",
    status: "published",
    price: "99.90",
    attributes: { cor: ["Branco"], tamanho: ["P", "M"], composicao: "Algodão premium" },
  },
  {
    slug: "calca-trico-leve",
    name: "Calça Tricô Leve",
    categorySlug: "trico",
    status: "published",
    price: "169.90",
    attributes: { cor: ["Azul"], tamanho: ["G", "GG"] },
  },
  {
    slug: "cachecol-trico-soft",
    name: "Cachecol Tricô Soft",
    categorySlug: "trico",
    status: "published",
    price: "79.90",
    attributes: { cor: ["Preto"], tamanho: ["PP"], composicao: "Cashmere blend" },
  },
  {
    slug: "calca-jeans-wide",
    name: "Calça Jeans Wide Leg",
    categorySlug: "jeans",
    status: "published",
    price: "249.90",
    promoPrice: "199.90",
    attributes: {
      cor: ["Jeans"],
      tamanho: ["38", "40", "42"],
      composicao: "98% algodão, 2% elastano",
    },
  },
  {
    slug: "jaqueta-jeans-cropped",
    name: "Jaqueta Jeans Cropped",
    categorySlug: "jeans",
    status: "published",
    price: "279.00",
    attributes: { cor: ["Jeans"], tamanho: ["P", "M"] },
  },
  {
    slug: "short-jeans-barra",
    name: "Short Jeans Barra Desfiada",
    categorySlug: "jeans",
    status: "published",
    price: "139.90",
    attributes: { cor: ["Jeans"], tamanho: ["36", "38"] },
  },
  {
    slug: "saia-jeans-midi",
    name: "Saia Jeans Midi",
    categorySlug: "jeans",
    status: "published",
    price: "169.90",
    attributes: { cor: ["Jeans"], tamanho: ["38", "40"] },
  },
  {
    slug: "colete-jeans",
    name: "Colete Jeans",
    categorySlug: "jeans",
    status: "published",
    price: "159.00",
    attributes: { cor: ["Jeans"], tamanho: ["M"] },
  },
  {
    slug: "calca-jeans-skinny",
    name: "Calça Jeans Skinny",
    categorySlug: "jeans",
    status: "published",
    price: "199.90",
    attributes: { cor: ["Jeans"], tamanho: ["36", "38", "40"] },
  },
  {
    slug: "macacao-jeans",
    name: "Macacão Jeans",
    categorySlug: "jeans",
    status: "published",
    price: "329.90",
    attributes: { cor: ["Jeans"], tamanho: ["P", "M"] },
  },
  {
    slug: "camisa-jeans-oversized",
    name: "Camisa Jeans Oversized",
    categorySlug: "jeans",
    status: "published",
    price: "189.00",
    attributes: { cor: ["Jeans"], tamanho: ["M", "G"] },
  },
];

const DRAFT_PRODUCT: SeedProduct = {
  slug: "rascunho-oculto",
  name: "Produto Rascunho (não publicar)",
  categorySlug: "trico",
  status: "draft",
  price: "99.90",
  attributes: { cor: ["Preto"], tamanho: ["M"] },
};

function createClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for seed");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function seedOwner(prisma: PrismaClient) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!url || !serviceRole || !email || !password) {
    throw new Error(
      "Seed do owner exige NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD",
    );
  }
  const admin = createSupabaseClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;
  if (!userId) {
    const listed = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = listed.data.users.find((user) => user.email === email)?.id;
  }
  if (!userId)
    throw new Error("Não foi possível resolver o id do owner de seed");
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email, role: "owner" },
    update: { email, role: "owner" },
  });
  const row = await prisma.profile.findUnique({ where: { id: userId } });
  if (row?.role !== "owner")
    throw new Error("Seed não promoveu profile a owner");
}

async function main() {
  const prisma = createClient();

  const categoryDefs = [
    {
      slug: "trico",
      name: "Tricô",
      description: "Peças em malha e tricô para o dia a dia.",
      sortOrder: 0,
      isActive: true,
    },
    {
      slug: "jeans",
      name: "Jeans",
      description: "Jeans e alfaiataria casual.",
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: "acessorios-inativos",
      name: "Acessórios (inativa)",
      description: "Categoria desativada para testes.",
      sortOrder: 99,
      isActive: false,
    },
  ];

  const categoryIds: Record<string, string> = {};

  for (const cat of categoryDefs) {
    const existing = await prisma.category.findFirst({
      where: { slug: cat.slug, deletedAt: null },
    });
    const row = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: {
            name: cat.name,
            description: cat.description,
            fieldsSchema: FIELDS_SCHEMA,
            sortOrder: cat.sortOrder,
            isActive: cat.isActive,
          },
        })
      : await prisma.category.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            fieldsSchema: FIELDS_SCHEMA,
            sortOrder: cat.sortOrder,
            isActive: cat.isActive,
          },
        });
    categoryIds[cat.slug] = row.id;
  }

  const allProducts = [...PUBLISHED_PRODUCTS, DRAFT_PRODUCT];

  for (const product of allProducts) {
    const existingProduct = await prisma.product.findFirst({
      where: { slug: product.slug, deletedAt: null },
    });
    const saved = existingProduct
      ? await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name: product.name,
            categoryId: categoryIds[product.categorySlug],
            status: product.status,
            price: product.price,
            promoPrice: product.promoPrice ?? null,
            isFeatured: product.isFeatured ?? false,
            attributes: product.attributes,
          },
        })
      : await prisma.product.create({
          data: {
            name: product.name,
            slug: product.slug,
            categoryId: categoryIds[product.categorySlug],
            status: product.status,
            price: product.price,
            promoPrice: product.promoPrice ?? null,
            isFeatured: product.isFeatured ?? false,
            attributes: product.attributes,
          },
        });

    if (product.status === "published") {
      const existingImages = await prisma.productImage.count({
        where: { productId: saved.id },
      });
      if (existingImages < 2) {
        await prisma.productImage.deleteMany({ where: { productId: saved.id } });
        for (let i = 0; i < 2; i++) {
          const urls = imageUrls(product.slug, i + 1);
          await prisma.productImage.create({
            data: {
              productId: saved.id,
              ...urls,
              sortOrder: i,
            },
          });
        }
      }
    }
  }

  await seedOwner(prisma);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
