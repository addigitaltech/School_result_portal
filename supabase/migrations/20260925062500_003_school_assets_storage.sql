/*
# Phase 5 — School logo storage

Creates a public bucket for the school logo and allows the existing demo/shared
anon + authenticated clients to upload, read, update, and delete objects there.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_select_school_assets" ON storage.objects;
CREATE POLICY "anon_select_school_assets"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "anon_insert_school_assets" ON storage.objects;
CREATE POLICY "anon_insert_school_assets"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "anon_update_school_assets" ON storage.objects;
CREATE POLICY "anon_update_school_assets"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'school-assets')
  WITH CHECK (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "anon_delete_school_assets" ON storage.objects;
CREATE POLICY "anon_delete_school_assets"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'school-assets');
