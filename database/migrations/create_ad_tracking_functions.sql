-- Create RPC functions for ad tracking
-- These functions safely increment impression and click counts for advertisements

-- Function to increment ad impressions
CREATE OR REPLACE FUNCTION increment_ad_impression(ad_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements
  SET impressions_count = COALESCE(impressions_count, 0) + 1
  WHERE id = ad_id;
END;
$$;

-- Function to increment ad clicks
CREATE OR REPLACE FUNCTION increment_ad_click(ad_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE advertisements
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE id = ad_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_ad_impression(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_ad_click(UUID) TO anon, authenticated;

COMMENT ON FUNCTION increment_ad_impression IS 'Safely increments the impression count for an advertisement';
COMMENT ON FUNCTION increment_ad_click IS 'Safely increments the click count for an advertisement';
