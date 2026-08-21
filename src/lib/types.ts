export type Role = 'admin' | 'teacher' | 'student' | 'parent';

export interface AppUser {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  display_name: string;
  teacher_id: string | null;
  student_id: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface SchoolSettings {
  id: string;
  school_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  current_session_id: string | null;
  current_term_id: string | null;
  updated_at: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  session_id: string;
  is_current: boolean;
  created_at: string;
}

export interface Teacher {
  id: string;
  teacher_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  status: string;
  subject_ids: string[] | null;
  class_ids: string[] | null;
  created_at: string;
}

export interface ClassRow {
  id: string;
  name: string;
  class_teacher_id: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  class_id: string | null;
  teacher_id: string | null;
  status: string;
  created_at: string;
}

export interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  other_name: string;
  gender: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  parent_guardian: string | null;
  parent_phone: string | null;
  email: string | null;
  admission_date: string | null;
  status: string;
  created_at: string;
}

export interface Parent {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  student_id: string;
  created_at: string;
}

export type ResultStatus = 'Draft' | 'Pending' | 'Published';

export interface Result {
  id: string;
  student_id: string;
  subject_id: string;
  teacher_id: string | null;
  class_id: string | null;
  session_id: string;
  term_id: string;
  ca_score: number;
  exam_score: number;
  total_score: number;
  grade: string | null;
  remark: string | null;
  status: ResultStatus;
  created_at: string;
  updated_at: string;
}

export interface GradeInfo {
  grade: string;
  remark: string;
}

export interface ResultWithRelations extends Result {
  students?: Student;
  subjects?: Subject;
  teachers?: Teacher;
  classes?: ClassRow;
  academic_sessions?: AcademicSession;
  terms?: Term;
}
