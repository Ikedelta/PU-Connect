-- ==============================================================================
-- DELETE PRODUCT RPC (For System Admin Bypass)
-- ==============================================================================

CREATE OR REPLACE FUNCTION admin_delete_product(
  target_id UUID,
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

  DELETE FROM products WHERE id = target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_product(UUID, TEXT) TO anon, authenticated, service_role;
