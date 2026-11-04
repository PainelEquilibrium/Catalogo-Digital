BEGIN;

-- Compare parsed expressions, not policy names: equivalent manual provisioning is safe.
CREATE TEMP TABLE image_storage_policy_contract (LIKE storage.objects) ON COMMIT DROP;

CREATE POLICY product_images_variants_public_read ON image_storage_policy_contract
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'variants');
CREATE POLICY product_images_staff_objects ON image_storage_policy_contract
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] IN ('originals', 'variants'))
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] IN ('originals', 'variants'));

CREATE POLICY product_images_staff_select ON image_storage_policy_contract
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] IN ('originals', 'variants'));
CREATE POLICY product_images_staff_insert ON image_storage_policy_contract
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] = 'originals');
CREATE POLICY product_images_staff_update ON image_storage_policy_contract
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] = 'originals')
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] = 'originals');
CREATE POLICY product_images_staff_delete ON image_storage_policy_contract
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff() AND (storage.foldername(name))[1] IN ('originals', 'variants'));

CREATE POLICY product_image_variants_staff_select ON image_storage_policy_contract
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-image-variants' AND public.is_staff() AND (storage.foldername(name))[1] = 'variants');
CREATE POLICY product_image_variants_staff_insert ON image_storage_policy_contract
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-image-variants' AND public.is_staff() AND (storage.foldername(name))[1] = 'variants');
CREATE POLICY product_image_variants_staff_update ON image_storage_policy_contract
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-image-variants' AND public.is_staff() AND (storage.foldername(name))[1] = 'variants')
  WITH CHECK (bucket_id = 'product-image-variants' AND public.is_staff() AND (storage.foldername(name))[1] = 'variants');
CREATE POLICY product_image_variants_staff_delete ON image_storage_policy_contract
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-image-variants' AND public.is_staff() AND (storage.foldername(name))[1] = 'variants');

DO $$
DECLARE
  actual record;
  expected record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images' AND name = 'product-images' AND public = false) THEN
    RAISE EXCEPTION 'product-images must already exist and remain private; review bucket configuration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE (id = 'product-image-variants' OR name = 'product-image-variants')
      AND (id <> 'product-image-variants' OR name <> 'product-image-variants' OR public IS DISTINCT FROM true
        OR file_size_limit IS NOT NULL OR allowed_mime_types IS DISTINCT FROM ARRAY['image/webp']::text[])
  ) THEN
    RAISE EXCEPTION 'Divergent product-image-variants configuration; review before migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'storage.objects must have RLS enabled';
  END IF;

  -- SQL predicates cannot safely be classified by substring. Unknown policies require review,
  -- even if their author intended them for another bucket; never retain a hidden OR bypass.
  FOR actual IN SELECT * FROM pg_policy WHERE polrelid = 'storage.objects'::regclass LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = 'image_storage_policy_contract'::regclass
        AND p.polpermissive = actual.polpermissive AND p.polcmd = actual.polcmd
        AND p.polroles = actual.polroles
        AND pg_get_expr(p.polqual, p.polrelid) IS NOT DISTINCT FROM pg_get_expr(actual.polqual, actual.polrelid)
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NOT DISTINCT FROM pg_get_expr(actual.polwithcheck, actual.polrelid)
    ) THEN
      RAISE EXCEPTION 'Unrecognized storage.objects policy %, review effective access before migration', actual.polname;
    END IF;
  END LOOP;

  INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
    VALUES ('product-image-variants', 'product-image-variants', true, ARRAY['image/webp'])
    ON CONFLICT (id) DO NOTHING;

  -- Remove every equivalent broad legacy policy, including ones provisioned under manual names.
  FOR actual IN
    SELECT p.polname FROM pg_policy p
    JOIN pg_policy old ON old.polrelid = 'image_storage_policy_contract'::regclass AND old.polname = 'product_images_staff_objects'
    WHERE p.polrelid = 'storage.objects'::regclass AND p.polcmd = old.polcmd AND p.polroles = old.polroles
      AND pg_get_expr(p.polqual, p.polrelid) = pg_get_expr(old.polqual, old.polrelid)
      AND pg_get_expr(p.polwithcheck, p.polrelid) = pg_get_expr(old.polwithcheck, old.polrelid)
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', actual.polname);
  END LOOP;

  FOR expected IN SELECT * FROM pg_policy WHERE polrelid = 'image_storage_policy_contract'::regclass AND polname <> 'product_images_staff_objects' LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p WHERE p.polrelid = 'storage.objects'::regclass
        AND p.polcmd = expected.polcmd AND p.polroles = expected.polroles AND p.polpermissive = expected.polpermissive
        AND pg_get_expr(p.polqual, p.polrelid) IS NOT DISTINCT FROM pg_get_expr(expected.polqual, expected.polrelid)
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NOT DISTINCT FROM pg_get_expr(expected.polwithcheck, expected.polrelid)
    ) THEN
      EXECUTE format('CREATE POLICY %I ON storage.objects FOR %s TO %s %s %s', expected.polname,
        CASE expected.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END,
        CASE WHEN expected.polname = 'product_images_variants_public_read' THEN 'anon, authenticated' ELSE 'authenticated' END,
        CASE WHEN expected.polqual IS NOT NULL THEN format('USING (%s)', pg_get_expr(expected.polqual, expected.polrelid)) ELSE '' END,
        CASE WHEN expected.polwithcheck IS NOT NULL THEN format('WITH CHECK (%s)', pg_get_expr(expected.polwithcheck, expected.polrelid)) ELSE '' END);
    END IF;
  END LOOP;
END $$;

COMMIT;
