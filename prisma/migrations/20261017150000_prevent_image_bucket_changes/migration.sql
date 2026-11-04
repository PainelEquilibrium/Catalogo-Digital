BEGIN;

-- Permissive UPDATE policies combine USING and WITH CHECK independently across buckets.
CREATE FUNCTION public.prevent_product_image_bucket_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Product image objects cannot change buckets'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER prevent_product_image_bucket_change
BEFORE UPDATE OF bucket_id ON storage.objects
FOR EACH ROW
WHEN (
  OLD.bucket_id IS DISTINCT FROM NEW.bucket_id
  AND (
    OLD.bucket_id IN ('product-images', 'product-image-variants')
    OR NEW.bucket_id IN ('product-images', 'product-image-variants')
  )
)
EXECUTE FUNCTION public.prevent_product_image_bucket_change();

COMMIT;
