-- MASTER FIX SCRIPT FOR ADMIN DASHBOARD & NEWSLETTER

-- 1. Fix User/Profile Permissions (RLS) to prevent "Something went wrong" on User Page
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own profile (Critical for auth check)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Allow admins to view ALL profiles (Critical for User Management page)
DROP POLICY IF EXISTS "Allow admins to view all profiles" ON public.profiles;
CREATE POLICY "Allow admins to view all profiles"
    ON public.profiles FOR SELECT
    USING (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
    );

-- Allow admins to update profiles (Critical for suspending users)
DROP POLICY IF EXISTS "Allow admins to update any profile" ON public.profiles;
CREATE POLICY "Allow admins to update any profile"
    ON public.profiles FOR UPDATE
    USING (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
    );


-- 2. Fix Newsletter Table (Missing Table Error)
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for newsletter
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow ANYONE (including unauthenticated) to insert/subscribe
DROP POLICY IF EXISTS "Allow public insert to newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Allow public insert to newsletter_subscribers"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

-- Allow admins to view/manage subscribers
DROP POLICY IF EXISTS "Allow admins to view newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Allow admins to view newsletter_subscribers"
    ON public.newsletter_subscribers FOR SELECT
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Allow admins to delete newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Allow admins to delete newsletter_subscribers"
    ON public.newsletter_subscribers FOR DELETE
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );


-- 3. Fix Products Permissions (Just in case)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to update products" ON public.products;
CREATE POLICY "Allow admins to update products"
    ON public.products FOR UPDATE
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );
