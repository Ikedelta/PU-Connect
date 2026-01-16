-- ==============================================================================
-- UPDATE PRODUCT RPC (For System Admin Bypass)
-- ==============================================================================

CREATE OR REPLACE FUNCTION admin_update_product(
  product_id UUID,
  product_data JSONB,
  secret_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  -- Get system password
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;
  
  -- Verify secret
  IF secret_key != current_system_pass THEN 
    RAISE EXCEPTION 'Unauthorized: Invalid System Secret'; 
  END IF;

  -- Update Product
  UPDATE products
  SET
    name = COALESCE((product_data->>'name'), name),
    description = COALESCE((product_data->>'description'), description),
    category = COALESCE((product_data->>'category'), category),
    price = COALESCE((product_data->>'price')::numeric, price),
    price_type = COALESCE((product_data->>'price_type'), price_type),
    whatsapp_number = COALESCE((product_data->>'whatsapp_number'), whatsapp_number),
    
    -- Handle Images Array (JSONB -> Text Array)
    images = CASE 
      WHEN product_data ? 'images' AND jsonb_typeof(product_data->'images') = 'array' THEN 
        (SELECT array_agg(x) FROM jsonb_array_elements_text(product_data->'images') t(x))
      ELSE images 
    END,
    
    updated_at = now()
  WHERE id = product_id;

END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_product(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
