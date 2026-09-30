-- Run once against an existing production database (safe to re-run).
CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_tokens (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS result_access_mode text NOT NULL DEFAULT 'portal';
ALTER TABLE school_settings DROP CONSTRAINT IF EXISTS school_settings_result_access_mode_check;
ALTER TABLE school_settings ADD CONSTRAINT school_settings_result_access_mode_check CHECK (result_access_mode IN ('portal','token','both'));
