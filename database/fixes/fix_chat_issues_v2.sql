-- FIX CHAT ISSUES V2 (Retry with Permissions)
-- 1. Ensure Profiles are Searchable (Public Read)
-- 2. Prevent Duplicate Conversations
-- 3. Fix Message RLS

-- 1. PROFILES: Allow authenticated users to view basic info of others
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

CREATE POLICY "Authenticated can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. CONVERSATIONS: RLS
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- 3. MESSAGES: RLS
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- 4. STORAGE: Chat Attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Chat attachments viewable by all authenticated" ON storage.objects;
CREATE POLICY "Chat attachments viewable by all authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'chat-attachments' );

DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'chat-attachments' );

-- 5. FUNCTION to safely get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(current_user_id UUID, target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    conv_id UUID;
    conv_record RECORD;
BEGIN
    -- Check for existing conversation (bidirectional)
    SELECT * INTO conv_record FROM public.conversations
    WHERE (buyer_id = current_user_id AND seller_id = target_user_id)
       OR (buyer_id = target_user_id AND seller_id = current_user_id)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('id', conv_record.id, 'is_new', false);
    END IF;

    -- Create new (current user is buyer by default structure, but it's just initiator)
    INSERT INTO public.conversations (buyer_id, seller_id, last_message_at)
    VALUES (current_user_id, target_user_id, NOW())
    RETURNING id INTO conv_id;

    RETURN jsonb_build_object('id', conv_id, 'is_new', true);
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO service_role;
