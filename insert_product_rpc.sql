-- ==============================================================================
-- INSERT PRODUCT RPC (For System Admin Bypass)
-- ==============================================================================

CREATE OR REPLACE FUNCTION admin_insert_product(
  product_data JSONB,
  secret_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system_pass TEXT;
  new_id UUID;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO products (
    seller_id,
    name,
    description,
    category,
    price,
    price_type,
    images,
    whatsapp_number,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    (product_data->>'seller_id')::UUID,
    (product_data->>'name'),
    (product_data->>'description'),
    (product_data->>'category'),
    (product_data->>'price')::numeric,
    (product_data->>'price_type'),
    (SELECT array_agg(x) FROM jsonb_array_elements_text(product_data->'images') t(x)),
    (product_data->>'whatsapp_number'),
    COALESCE((product_data->>'is_active')::boolean, true),
    now(),
    now()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_product(JSONB, TEXT) TO anon, authenticated, service_role;
