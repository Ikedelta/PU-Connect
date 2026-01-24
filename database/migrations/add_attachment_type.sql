-- Add attachment_type to messages table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_type') THEN
        ALTER TABLE messages ADD COLUMN attachment_type TEXT CHECK (attachment_type IN ('image', 'video', 'file'));
    END IF;
END $$;
