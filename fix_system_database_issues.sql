-- ==========================================
-- COMPREHENSIVE DATABASE FIX SCRIPT
-- Run this in your Supabase SQL Editor to fix missing columns and tables
-- ==========================================

-- 1. FIX PROFILES TABLE
-- Ensure all necessary columns exist for user management and online status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'buyer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS faculty TEXT;

-- 2. FIX CAMPUS NEWS TABLE
-- Fix the specific issue where 'is_published' might be missing or named differently
CREATE TABLE IF NOT EXISTS public.campus_news (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 3. FIX PRODUCTS TABLE
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'fixed';

-- 4. FIX SELLER APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.seller_applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    business_name TEXT NOT NULL,
    business_category TEXT NOT NULL,
    business_description TEXT,
    contact_phone TEXT NOT NULL,
    contact_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. RPC FUNCTIONS (Remote Procedure Calls)
-- Function to safely increment news views
CREATE OR REPLACE FUNCTION increment_news_views(news_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.campus_news
  SET views_count = views_count + 1
  WHERE id = news_id;
END;
$$;

-- Function to safely increment product views
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET views_count = views_count + 1
  WHERE id = product_id;
END;
$$;

-- Function to check if user is admin (helper for RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. STORAGE BUCKETS SETUP
-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('news', 'news', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true) ON CONFLICT (id) DO NOTHING;

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

-- 8. BASIC RLS POLICIES (Idempotent - will fail safely if exists, or you can drop first)
-- Profiles: Public read, User update own
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- News: Public read, Admin/Publisher write
DROP POLICY IF EXISTS "News is viewable by everyone" ON public.campus_news;
CREATE POLICY "News is viewable by everyone" ON public.campus_news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and Publishers can manage news" ON public.campus_news;
CREATE POLICY "Admins and Publishers can manage news" ON public.campus_news FOR ALL USING (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and (profiles.role in ('admin', 'super_admin', 'news_publisher'))
  )
);

-- Products: Active products viewable by everyone
DROP POLICY IF EXISTS "Active products are public" ON public.products;
CREATE POLICY "Active products are public" ON public.products FOR SELECT USING (is_active = true);

-- Messages RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
