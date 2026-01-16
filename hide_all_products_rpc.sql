-- ==============================================================================
-- HIDE ALL PRODUCTS FOR A USER (RPC for Admin)
-- ==============================================================================

CREATE OR REPLACE FUNCTION admin_hide_all_products(
  target_user_id UUID,
  secret_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE products 
  SET is_active = false 
  WHERE seller_id = target_user_id;

END;
$$;

GRANT EXECUTE ON FUNCTION admin_hide_all_products(UUID, TEXT) TO anon, authenticated, service_role;
