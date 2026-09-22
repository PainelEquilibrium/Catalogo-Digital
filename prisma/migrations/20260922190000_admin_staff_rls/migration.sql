-- AlterTable
ALTER TABLE "categories" ADD COLUMN "cover_storage_path" TEXT;

-- Staff helper (SECURITY DEFINER, stable, search_path locked)
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
      AND role IN ('owner', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- categories: staff CRUD without physical DELETE policy
CREATE POLICY categories_staff_select ON public.categories
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY categories_staff_insert ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY categories_staff_update ON public.categories
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- products: staff CRUD without physical DELETE policy
CREATE POLICY products_staff_select ON public.products
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY products_staff_insert ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY products_staff_update ON public.products
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- product_images: staff full access (includes DELETE)
CREATE POLICY product_images_staff_write ON public.product_images
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- profiles: self read for authenticated users
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- PostgREST grants for admin mutations (public SELECT policies unchanged)
GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Storage: staff write under product-images originals/variants
CREATE POLICY product_images_staff_objects ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_staff()
    AND (storage.foldername(name))[1] IN ('originals', 'variants')
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_staff()
    AND (storage.foldername(name))[1] IN ('originals', 'variants')
  );
