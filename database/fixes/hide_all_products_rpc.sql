-- Add 'is_active' column to profiles (if global user disable is needed later)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Important: We already have 'is_active' in 'seller_profiles' and 'products'.
-- We need to ensure that when products are fetched, we join on seller_profiles
-- and check if the seller is active AND approved.

-- But standard RLS or queries are easier.
-- Let's create a Database View or Function to reliably hide products from unapproved/banned sellers.
-- However, since the front-end uses direct table access, let's fix it at the Application Level + RLS.

-- RPC to Hide All Products of a Seller (Admin Action)
CREATE OR REPLACE FUNCTION admin_hide_all_seller_products(
  target_seller_id uuid,
  secret_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF secret_key != 'your_secret_admin_key_here' AND secret_key != 'puconnect@!' THEN
     RAISE EXCEPTION 'Invalid secret key';
  END IF;

  UPDATE products
  SET is_active = false
  WHERE seller_id = target_seller_id;
END;
$$;

-- RPC to Restore All Products of a Seller
CREATE OR REPLACE FUNCTION admin_restore_all_seller_products(
  target_seller_id uuid,
  secret_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF secret_key != 'your_secret_admin_key_here' AND secret_key != 'puconnect@!' THEN
     RAISE EXCEPTION 'Invalid secret key';
  END IF;

  UPDATE products
  SET is_active = true
  WHERE seller_id = target_seller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_hide_all_seller_products(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION admin_restore_all_seller_products(uuid, text) TO public;
