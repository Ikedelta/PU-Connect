-- SCHEMA FIX: Add missing columns and functions for performance tracking

-- 1. Ensure views_count exists on products
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='views_count') THEN
        ALTER TABLE public.products ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Ensure views_count exists on campus_news
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campus_news' AND column_name='views_count') THEN
        ALTER TABLE public.campus_news ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Create RPC functions for incrementing views safely
CREATE OR REPLACE FUNCTION public.increment_product_views(product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.products
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_news_views(news_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.campus_news
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = news_id;
END;
$$;

-- 4. Re-apply indexes from optimization script
-- These will now work since the columns are guaranteed to exist

-- Index for active products by category
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products (is_active, category) WHERE is_active = true;

-- Index for products by views_count (Trending section)
CREATE INDEX IF NOT EXISTS idx_products_views_count ON public.products (views_count DESC) WHERE is_active = true;

-- Index for news by publication status and date
CREATE INDEX IF NOT EXISTS idx_news_published_date ON public.campus_news (is_published, created_at DESC) WHERE is_published = true;

-- Index for unread messages (Navbar unread count)
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages (receiver_id, is_read) WHERE is_read = false;

-- Index for profiles by role (Admin dashboard stats)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 5. Index for conversations (participants) - Only if table exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='conversations') THEN
        CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON public.conversations (buyer_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON public.conversations (seller_id);
    END IF;
END $$;

-- Analyze tables (safely)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products') THEN ANALYZE public.products; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='profiles') THEN ANALYZE public.profiles; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='messages') THEN ANALYZE public.messages; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='campus_news') THEN ANALYZE public.campus_news; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='seller_applications') THEN ANALYZE public.seller_applications; END IF; END $$;
