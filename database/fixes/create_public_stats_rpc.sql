-- Create a public RPC function to get system stats safely
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with service role privileges
AS $$
DECLARE
    product_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT count(*) INTO product_count FROM public.products WHERE is_active = true;
    SELECT count(*) INTO user_count FROM public.profiles;
    
    RETURN json_build_object(
        'products', product_count,
        'users', user_count
    );
END;
$$;

-- Grant execution to public
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO authenticated;
