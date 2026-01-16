-- MASTER SCRIPT TO CONNECT FRONTEND TO BACKEND
-- Run this script in Supabase SQL Editor to fix ALL permission issues.

-- ==========================================
-- 1. PROFILES (Users)
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Everyone can read profiles (needed for showing seller names on products)
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile (to change roles, etc.)
CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==========================================
-- 2. SELLER PROFILES (Shops)
-- ==========================================
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view seller profiles" ON seller_profiles;
DROP POLICY IF EXISTS "Sellers can manage own profile" ON seller_profiles;
DROP POLICY IF EXISTS "Admins can manage all seller profiles" ON seller_profiles;

-- Public can view active seller profiles (Shop pages)
CREATE POLICY "Public view seller profiles" 
ON seller_profiles FOR SELECT USING (true);

-- Sellers can manage their own shop
CREATE POLICY "Sellers can manage own profile" 
ON seller_profiles FOR ALL USING (user_id = auth.uid());

-- Admins can manage all shops
CREATE POLICY "Admins can manage all seller profiles" 
ON seller_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==========================================
-- 3. PRODUCTS (Marketplace)
-- ==========================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view active products" ON products;
DROP POLICY IF EXISTS "Sellers manage own products" ON products;
DROP POLICY IF EXISTS "Admins manage all products" ON products;

-- Public can view ACTIVE products only
CREATE POLICY "Public view active products" 
ON products FOR SELECT USING (is_active = true);

-- Sellers can manage their OWN products
CREATE POLICY "Sellers manage own products" 
ON products FOR ALL USING (seller_id = auth.uid());

-- Admins can manage ALL products (view hidden, delete, etc.)
CREATE POLICY "Admins manage all products" 
ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==========================================
-- 4. SELLER APPLICATIONS
-- ==========================================
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit applications" ON seller_applications;
DROP POLICY IF EXISTS "Users view own applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins manage applications" ON seller_applications;

-- Authenticated users can submit an application
CREATE POLICY "Users can submit applications" 
ON seller_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own application status
CREATE POLICY "Users view own applications" 
ON seller_applications FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and update ALL applications
CREATE POLICY "Admins manage applications" 
ON seller_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==========================================
-- 5. SUPPORT TICKETS
-- ==========================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins manage tickets" ON support_tickets;

-- Users can create tickets
CREATE POLICY "Users create tickets" 
ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own tickets
CREATE POLICY "Users view own tickets" 
ON support_tickets FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage ALL tickets
CREATE POLICY "Admins manage tickets" 
ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==========================================
-- 6. CAMPUS NEWS
-- ==========================================
ALTER TABLE campus_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view news" ON campus_news;
DROP POLICY IF EXISTS "Admins manage news" ON campus_news;

-- Everyone can view published news
CREATE POLICY "Public view news" 
ON campus_news FOR SELECT USING (is_published = true);

-- Admins can manage all news
CREATE POLICY "Admins manage news" 
ON campus_news FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'news_publisher'))
);


-- ==========================================
-- 7. ACTIVITY LOGS
-- ==========================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System insert logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins view logs" ON activity_logs;

-- Authenticated users can insert logs (e.g. "User logged in")
CREATE POLICY "System insert logs" 
ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Only Admins can view logs
CREATE POLICY "Admins view logs" 
ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- ==========================================
-- 8. FAVOURITES
-- ==========================================
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage favorites" ON favorites;

-- Users can manage their own favorites
CREATE POLICY "Users manage favorites" 
ON favorites FOR ALL USING (user_id = auth.uid());
