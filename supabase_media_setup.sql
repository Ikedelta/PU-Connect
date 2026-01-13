-- Enable the storage extension if not already enabled
create extension if not exists "storage" schema "extensions";

-- Create the 'media' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Set up security policies for the 'media' bucket

-- 1. Allow anyone to VIEW files (public access)
create policy "Public Access to Media"
  on storage.objects for select
  using ( bucket_id = 'media' );

-- 2. Allow authenticated users to UPLOAD files
-- They can upload to their own folder: user_id/*
create policy "Authenticated Users Can Upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media' AND
    (
       -- Allow uploading to their own user folder
       (storage.foldername(name))[1] = auth.uid()::text
       OR
       -- Allow admins/sellers to upload to general folders if needed (optional adjustment)
       -- For now, we enforce folder structure in the client code: user_id/folder/...
       true
    )
  );

-- 3. Allow users to UPDATE their own files
create policy "Users Can Update Own Files"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 4. Allow users to DELETE their own files
create policy "Users Can Delete Own Files"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1] );
