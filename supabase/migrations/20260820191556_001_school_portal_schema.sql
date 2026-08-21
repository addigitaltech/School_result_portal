/*
# School Results Portal — Core Schema

Builds a multi-role academic result management system.

## Tables
- `app_users` — login accounts (email, password_hash, role: admin/teacher/student/parent, linked entity id)
- `school_settings` — single row of school info
- `academic_sessions` — e.g. 2025/2026
- `terms` — First/Second/Third term, tied to a session, with is_current flag
- `classes` — JSS 1..SS 3 with class teacher
- `subjects` — subject code/name/class/teacher
- `teachers` — teacher profile
- `students` — student profile with class
- `parents` — parent profile linked to a student
- `results` — score record linking student/subject/teacher/class/session/term with ca/exam/total/grade/remark/status

## Security
- RLS enabled on every table.
- This is a demo capstone with pre-seeded demo accounts and shared data, so policies use `TO anon, authenticated` with `USING (true)` — the data is intentionally shared across demo logins. The custom auth layer (app_users.password_hash) enforces role checks client-side; RLS keeps the table open to the anon-key client the app uses.
*/

CREATE TABLE IF NOT EXISTS school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'School Results Portal',
  address text NOT NULL DEFAULT 'No. 1 Education Avenue, Abuja, Nigeria',
  phone text NOT NULL DEFAULT '+234 800 000 0000',
  email text NOT NULL DEFAULT 'info@schoolresults.edu.ng',
  logo_url text DEFAULT '',
  current_session_id uuid,
  current_term_id uuid,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','teacher','student','parent')),
  display_name text NOT NULL,
  teacher_id uuid,
  student_id uuid,
  parent_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  gender text,
  status text DEFAULT 'Active',
  subject_ids uuid[] DEFAULT '{}',
  class_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  class_teacher_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  status text DEFAULT 'Active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_name text DEFAULT '',
  gender text,
  date_of_birth text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  parent_guardian text,
  parent_phone text,
  email text,
  admission_date text,
  status text DEFAULT 'Active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE CASCADE,
  ca_score integer DEFAULT 0,
  exam_score integer DEFAULT 0,
  total_score integer GENERATED ALWAYS AS (ca_score + exam_score) STORED,
  grade text,
  remark text,
  status text DEFAULT 'Draft' CHECK (status IN ('Draft','Pending','Published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, subject_id, session_id, term_id)
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Demo/shared data: allow anon + authenticated full CRUD on all tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_settings','app_users','academic_sessions','terms','teachers','classes','subjects','students','parents','results'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true);', t, t);
  END LOOP;
END $$;