-- STEP 1: FIX NEWSLETTER TABLE AND VISIBILITY
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to subscribe
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
    FOR INSERT WITH CHECK (true);

-- Allow admins to view subscribers
DROP POLICY IF EXISTS "Admins can view newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view newsletter subscribers" ON public.newsletter_subscribers
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'super_admin') OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- STEP 2: FIX PRODUCT VISIBILITY FOR DASHBOARD
-- Ensure admins can count all products regardless of is_active
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
CREATE POLICY "Admins can view all products" ON public.products
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('admin', 'super_admin') OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- STEP 3: ENSURE PRESENCE TRACKING WORKS
-- (This is handled by Supabase Realtime automatically if enabled on the channel, which it is in the code)

-- STEP 4: FETCH DATA REFRESH (Run this in Supabase Editor to verify counts)
SELECT 
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM newsletter_subscribers) as total_subscribers,
    (SELECT count(*) FROM profiles WHERE role = 'buyer') as total_buyers,
    (SELECT count(*) FROM profiles WHERE role = 'seller') as total_sellers;
