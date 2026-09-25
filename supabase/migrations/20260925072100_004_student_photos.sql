/*
# Phase 6 — Student profile photos

Stores the public Supabase Storage URL for each student's profile photo.
Photos use the existing public school-assets bucket under the student-photos/
path namespace, so no additional bucket is required.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_url text DEFAULT '';

-- The students table already has the repository's anon + authenticated CRUD policies.
