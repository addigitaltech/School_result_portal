-- School Results Portal fresh PostgreSQL schema
-- This schema intentionally contains no Supabase RLS policies. Authorization is enforced in the API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'School Results Portal',
  address text NOT NULL DEFAULT 'No. 1 Education Avenue, Abuja, Nigeria',
  phone text NOT NULL DEFAULT '+234 800 000 0000',
  email text NOT NULL DEFAULT 'info@schoolresults.edu.ng',
  logo_url text NOT NULL DEFAULT '',
  current_session_id uuid,
  current_term_id uuid,
  pass_percentage numeric(5,2) NOT NULL DEFAULT 40.00 CHECK (pass_percentage BETWEEN 0 AND 100),
  motto text NOT NULL DEFAULT '',
  ca1_max_score integer NOT NULL DEFAULT 40 CHECK (ca1_max_score >= 0),
  ca2_max_score integer NOT NULL DEFAULT 0 CHECK (ca2_max_score >= 0),
  ca3_max_score integer NOT NULL DEFAULT 0 CHECK (ca3_max_score >= 0),
  exam_max_score integer NOT NULL DEFAULT 60 CHECK (exam_max_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, session_id)
);

CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  gender text,
  status text NOT NULL DEFAULT 'Active',
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  class_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  class_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_arms (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id uuid NOT NULL REFERENCES arms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, arm_id)
);

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_name text NOT NULL DEFAULT '',
  gender text,
  date_of_birth text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  arm_id uuid REFERENCES arms(id) ON DELETE SET NULL,
  photo_url text NOT NULL DEFAULT '',
  parent_guardian text,
  parent_phone text,
  email text,
  admission_date text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
  display_name text NOT NULL,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES parents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grade_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score integer NOT NULL CHECK (min_score >= 0),
  max_score integer NOT NULL CHECK (max_score <= 100 AND max_score >= min_score),
  grade text NOT NULL UNIQUE,
  remark text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE affective_traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  ca1_score integer NOT NULL DEFAULT 0 CHECK (ca1_score >= 0),
  ca2_score integer NOT NULL DEFAULT 0 CHECK (ca2_score >= 0),
  ca3_score integer NOT NULL DEFAULT 0 CHECK (ca3_score >= 0),
  exam_score integer NOT NULL DEFAULT 0 CHECK (exam_score >= 0),
  total_score integer GENERATED ALWAYS AS (ca1_score + ca2_score + ca3_score + exam_score) STORED,
  is_offered boolean NOT NULL DEFAULT true,
  grade text,
  remark text,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, session_id, term_id)
);

CREATE TABLE affective_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trait_id uuid NOT NULL REFERENCES affective_traits(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, trait_id, session_id, term_id)
);

CREATE TABLE term_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  teacher_remark text NOT NULL DEFAULT '',
  principal_remark text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, term_id)
);

ALTER TABLE school_settings
  ADD CONSTRAINT school_settings_current_session_fk FOREIGN KEY (current_session_id) REFERENCES academic_sessions(id) ON DELETE SET NULL,
  ADD CONSTRAINT school_settings_current_term_fk FOREIGN KEY (current_term_id) REFERENCES terms(id) ON DELETE SET NULL;

CREATE INDEX results_session_term_class_idx ON results (session_id, term_id, class_id);
CREATE INDEX results_student_session_term_idx ON results (student_id, session_id, term_id);
CREATE INDEX students_class_arm_idx ON students (class_id, arm_id);
CREATE INDEX app_users_role_idx ON app_users (role);

INSERT INTO school_settings DEFAULT VALUES;
INSERT INTO grade_bands (min_score, max_score, grade, remark) VALUES
  (70, 100, 'A', 'Excellent'),
  (60, 69, 'B', 'Very Good'),
  (50, 59, 'C', 'Good'),
  (45, 49, 'D', 'Fair'),
  (40, 44, 'E', 'Pass'),
  (0, 39, 'F', 'Fail');
INSERT INTO affective_traits (name) VALUES
  ('Attentiveness'), ('Honesty'), ('Industriousness'), ('Neatness'),
  ('Obedience'), ('Relationship With Others'), ('Handwriting'), ('Punctuality');
