-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper Function: Check if user is a seller
CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'seller'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. PROFILES
-- ==========================================
-- Allow public read access to basic profile info (needed for seller pages, reviews, etc.)
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Allow users to insert their own profile (during sign up)
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
-- CRITICAL: Prevent role escalation via Trigger (see below)
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Trigger to protect 'role' field from being changed by non-admins
CREATE OR REPLACE FUNCTION public.protect_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being changed
  IF NEW.role <> OLD.role THEN
    -- Allow if the user is an admin (or service role)
    IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
       RAISE EXCEPTION 'You are not authorized to change your user role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_role_change();


-- ==========================================
-- 2. SELLER APPLICATIONS
-- ==========================================
-- Users can see their own applications
CREATE POLICY "Users can view own applications"
ON public.seller_applications FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.seller_applications FOR SELECT
USING (public.is_admin());

-- Authenticated users can submit applications
CREATE POLICY "Users can submit applications"
ON public.seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only Admins can update applications (e.g. status)
CREATE POLICY "Admins can update applications"
ON public.seller_applications FOR UPDATE
USING (public.is_admin());


-- ==========================================
-- 3. SELLER PROFILES
-- ==========================================
-- Public read
CREATE POLICY "Seller profiles are viewable by everyone"
ON public.seller_profiles FOR SELECT
USING (true);

-- Admins can manage all
CREATE POLICY "Admins can manage seller profiles"
ON public.seller_profiles FOR ALL
USING (public.is_admin());

-- Sellers can update their own business info
CREATE POLICY "Sellers can update own profile"
ON public.seller_profiles FOR UPDATE
USING (auth.uid() = user_id);


-- ==========================================
-- 4. PRODUCTS
-- ==========================================
-- Everyone can view active products
CREATE POLICY "Active products are public"
ON public.products FOR SELECT
USING (is_active = true);

-- Sellers see their own products (even inactive)
CREATE POLICY "Sellers see own products"
ON public.products FOR SELECT
USING (auth.uid() = seller_id);

-- Admins see all products
CREATE POLICY "Admins see all products"
ON public.products FOR SELECT
USING (public.is_admin());

-- Sellers can insert products
CREATE POLICY "Sellers can insert products"
ON public.products FOR INSERT
WITH CHECK (auth.uid() = seller_id AND public.is_seller());

-- Sellers can update their own products
CREATE POLICY "Sellers can update own products"
ON public.products FOR UPDATE
USING (auth.uid() = seller_id);

-- Sellers can delete their own products
CREATE POLICY "Sellers can delete own products"
ON public.products FOR DELETE
USING (auth.uid() = seller_id);

-- Admins can update/delete any product
CREATE POLICY "Admins can manage all products"
ON public.products FOR ALL
USING (public.is_admin());


-- ==========================================
-- 5. CAMPUS NEWS
-- ==========================================
-- Public read of published news
CREATE POLICY "Published news is public"
ON public.campus_news FOR SELECT
USING (is_published = true);

-- Admins/Publishers see all news
CREATE POLICY "Admins view all news"
ON public.campus_news FOR SELECT
USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'news_publisher')
);

-- Admins/Publishers can manage news
CREATE POLICY "Admins manage news"
ON public.campus_news FOR ALL
USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'news_publisher')
);
