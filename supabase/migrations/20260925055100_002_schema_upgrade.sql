/*
# Phase 1 — Result system schema upgrade

Adds class arms, multi-component continuous assessment, configurable grading,
affective traits/ratings, term-level remarks, and school-wide score settings.

Term remarks are intentionally separate from subject results: a teacher/principal
comment summarizes a student's overall term performance, while results.remark
continues to hold the grade-band remark for one subject.
*/

CREATE TABLE IF NOT EXISTS arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_arms (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id uuid NOT NULL REFERENCES arms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (class_id, arm_id)
);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS arm_id uuid REFERENCES arms(id) ON DELETE SET NULL;

-- Preserve existing CA values as CA1 before removing the legacy single CA column.
ALTER TABLE results DROP COLUMN IF EXISTS total_score;
ALTER TABLE results ADD COLUMN IF NOT EXISTS ca1_score integer DEFAULT 0;
ALTER TABLE results ADD COLUMN IF NOT EXISTS ca2_score integer DEFAULT 0;
ALTER TABLE results ADD COLUMN IF NOT EXISTS ca3_score integer DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'results' AND column_name = 'ca_score'
  ) THEN
    UPDATE results SET ca1_score = COALESCE(ca_score, 0) WHERE ca1_score IS NULL OR ca1_score = 0;
    ALTER TABLE results DROP COLUMN ca_score;
  END IF;
END $$;

ALTER TABLE results ALTER COLUMN ca1_score SET DEFAULT 0;
ALTER TABLE results ALTER COLUMN ca2_score SET DEFAULT 0;
ALTER TABLE results ALTER COLUMN ca3_score SET DEFAULT 0;
ALTER TABLE results ALTER COLUMN ca1_score SET NOT NULL;
ALTER TABLE results ALTER COLUMN ca2_score SET NOT NULL;
ALTER TABLE results ALTER COLUMN ca3_score SET NOT NULL;
ALTER TABLE results ADD COLUMN IF NOT EXISTS is_offered boolean NOT NULL DEFAULT true;
ALTER TABLE results
  ADD COLUMN total_score integer GENERATED ALWAYS AS (ca1_score + ca2_score + ca3_score + exam_score) STORED;

CREATE TABLE IF NOT EXISTS grade_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score integer NOT NULL CHECK (min_score >= 0),
  max_score integer NOT NULL CHECK (max_score <= 100 AND max_score >= min_score),
  grade text UNIQUE NOT NULL,
  remark text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO grade_bands (min_score, max_score, grade, remark)
VALUES
  (70, 100, 'A', 'Excellent'),
  (60, 69, 'B', 'Very Good'),
  (50, 59, 'C', 'Good'),
  (45, 49, 'D', 'Fair'),
  (40, 44, 'E', 'Pass'),
  (0, 39, 'F', 'Fail')
ON CONFLICT (grade) DO UPDATE SET
  min_score = EXCLUDED.min_score,
  max_score = EXCLUDED.max_score,
  remark = EXCLUDED.remark;

CREATE TABLE IF NOT EXISTS affective_traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO affective_traits (name)
VALUES
  ('Attentiveness'),
  ('Honesty'),
  ('Industriousness'),
  ('Neatness'),
  ('Obedience'),
  ('Relationship With Others'),
  ('Handwriting'),
  ('Punctuality')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS affective_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trait_id uuid NOT NULL REFERENCES affective_traits(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, trait_id, session_id, term_id)
);

CREATE TABLE IF NOT EXISTS term_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  teacher_remark text NOT NULL DEFAULT '',
  principal_remark text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, session_id, term_id)
);

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS pass_percentage numeric(5,2) NOT NULL DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS motto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ca1_max_score integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS ca2_max_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ca3_max_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exam_max_score integer NOT NULL DEFAULT 60;

ALTER TABLE arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE affective_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE affective_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_remarks ENABLE ROW LEVEL SECURITY;

-- Preserve the existing demo/shared-data policy pattern for every new table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['arms','class_arms','grade_bands','affective_traits','affective_ratings','term_remarks'] LOOP
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
