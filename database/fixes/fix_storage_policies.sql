-- Storage RLS Policies for 'media' bucket
-- This script enables authenticated users to upload and manage their own media, 
-- and allows public read access for marketplace/profile images.

-- 1. Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS
-- (Bucket RLS is enabled by default in Supabase, we just need to add policies)

-- 3. Policy: Allow Public Read Access
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'media' );

-- 4. Policy: Allow Authenticated Users to Upload (INSERT)
-- This allows any logged-in user to upload to the media bucket.
-- You can restrict this to specific folders like 'avatars/' if needed.
CREATE POLICY "Allow Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'media' );

-- 5. Policy: Allow Users to Update/Delete their own files
CREATE POLICY "Allow Individual Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'media' AND auth.uid() = owner );

CREATE POLICY "Allow Individual Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'media' AND auth.uid() = owner );

-- 6. SPECIAL: Admin bypass for media bucket
-- If you want admins to be able to manage ALL files in the media bucket
CREATE POLICY "Admin Full Control"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'media' AND 
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
  ))
);
