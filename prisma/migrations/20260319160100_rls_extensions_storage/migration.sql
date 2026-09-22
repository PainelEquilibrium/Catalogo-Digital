-- Extensions
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- auth.users → profiles (FK not modeled in Prisma)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- Checks
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'manager'));

ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'published'));

ALTER TABLE public.products
  ADD CONSTRAINT products_promo_requires_price
  CHECK (promo_price IS NULL OR price IS NOT NULL);

ALTER TABLE public.products
  ADD CONSTRAINT products_promo_less_than_price
  CHECK (promo_price IS NULL OR promo_price < price);

-- Partial unique slugs
CREATE UNIQUE INDEX categories_slug_active_unique
  ON public.categories (slug)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX products_slug_active_unique
  ON public.products (slug)
  WHERE deleted_at IS NULL;

-- Vitrine indexes
CREATE INDEX products_category_published_idx
  ON public.products (category_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX products_featured_published_idx
  ON public.products (is_featured)
  WHERE deleted_at IS NULL AND status = 'published' AND is_featured = true;

CREATE INDEX products_attributes_gin_idx
  ON public.products USING GIN (attributes);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_categories
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_touch_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_touch_store_settings
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_public_select
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active AND deleted_at IS NULL);

CREATE POLICY products_public_select
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY product_images_public_select
  ON public.product_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY store_settings_public_select
  ON public.store_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- PostgREST / Data API: SELECT only where RLS allows
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;

-- Signup profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'manager')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket (empty; public read under variants/)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS product_images_variants_public_read ON storage.objects;

CREATE POLICY product_images_variants_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'variants'
  );
