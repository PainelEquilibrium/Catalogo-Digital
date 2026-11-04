BEGIN;

-- profiles: pessoas, ativação e troca de senha pendente
ALTER TABLE "profiles" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "profiles" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_role_check";
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_check" CHECK (role IN ('owner', 'manager', 'support'));

-- catálogo
ALTER TABLE "products" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "cover_og_url" TEXT;

-- auditoria e fila de remoção de objetos do Storage (só servidor via Prisma)
CREATE TABLE "audit_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "actor_name" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "entity_label" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" ("created_at" DESC);
CREATE INDEX "audit_log_entity_type_created_at_idx" ON "audit_log" ("entity_type", "created_at" DESC);

CREATE TABLE "storage_deletions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bucket" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "storage_deletions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "storage_deletions_bucket_path_key" ON "storage_deletions" ("bucket", "path");

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
REVOKE ALL ON public.storage_deletions FROM anon, authenticated;

-- staff = papel válido, conta ativa e sem troca de senha pendente (Storage herda)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner', 'manager', 'support')
      AND is_active
      AND NOT must_change_password
  );
$$;

-- conta nascida fora do painel fica sem acesso até ser ativada pelo servidor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active, must_change_password)
  VALUES (NEW.id, NEW.email, 'manager', false, true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- escritas só pelo servidor (Prisma); leitura continua pelas policies existentes
REVOKE INSERT, UPDATE, DELETE ON public.categories FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_images FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.store_settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS categories_staff_insert ON public.categories;
DROP POLICY IF EXISTS categories_staff_update ON public.categories;
DROP POLICY IF EXISTS products_staff_insert ON public.products;
DROP POLICY IF EXISTS products_staff_update ON public.products;
DROP POLICY IF EXISTS product_images_staff_write ON public.product_images;

-- bucket público de variantes aceita JPEG além de WebP
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/webp', 'image/jpeg'] WHERE id = 'product-image-variants';

-- whatsapp_message_default -> whatsapp_item_template ({price} -> {unit_price}); valor já existente do novo campo vence
UPDATE public.store_settings
SET value = jsonb_build_object(
      'whatsapp_item_template',
      replace(value->>'whatsapp_message_default', '{price}', '{unit_price}')
    ) || (value - 'whatsapp_message_default')
WHERE key = 'contact' AND value ? 'whatsapp_message_default';

COMMIT;
