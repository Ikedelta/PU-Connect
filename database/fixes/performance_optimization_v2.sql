-- Optimization script for database performance
-- These indexes will speed up common queries used in Home and Marketplace

-- 1. Index for active products by category (Marketplace filtering)
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products (is_active, category) WHERE is_active = true;

-- 2. Index for products by views_count (Trending section)
CREATE INDEX IF NOT EXISTS idx_products_views_count ON public.products (views_count DESC) WHERE is_active = true;

-- 3. Index for news by publication status and date
CREATE INDEX IF NOT EXISTS idx_news_published_date ON public.campus_news (is_published, created_at DESC) WHERE is_published = true;

-- 4. Index for unread messages (Navbar unread count)
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages (receiver_id, is_read) WHERE is_read = false;

-- 5. Index for profiles by role (Admin dashboard stats)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 6. Indexes for conversations by participants (Chat speed)
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON public.conversations (buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON public.conversations (seller_id);

-- 7. Analyze tables to update statistics
ANALYZE public.products;
ANALYZE public.profiles;
ANALYZE public.messages;
ANALYZE public.campus_news;
ANALYZE public.seller_applications;
