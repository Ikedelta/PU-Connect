-- PERFORMANCE & OPTIMIZATION INDEXES
-- 1. Products Optimization
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products(is_active, category);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- 2. Profiles Optimization
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. Messaging Optimization (Realtime ready)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_conversations_user_ids ON public.conversations(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at ON public.conversations(last_message_at DESC);

-- 4. News Optimization
CREATE INDEX IF NOT EXISTS idx_campus_news_published_created ON public.campus_news(is_published, created_at DESC);

-- 5. Activity Logs (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'activity_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);
    END IF;
END $$;
