import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';
import { computeGrade, clampScore, CA_MAX, EXAM_MAX } from '@/lib/grading';
import type { AcademicSession, Term, ClassRow, Subject, Student, Result } from '@/lib/types';
import { ArrowLeft, Save, Send, ClipboardList } from 'lucide-react';

interface RowState {
  ca: string;
  exam: string;
  status: Result['status'];
  existingId?: string;
}

export function ResultEntryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { success, error } = useToast();
  const isAdmin = user?.role === 'admin';

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacher, setTeacher] = useState<{ id: string; subject_ids: string[]; class_ids: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t, c, sub] = await Promise.all([
      supabase.from('academic_sessions').select('*').order('name'),
      supabase.from('terms').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
    ]);
    setSessions(s.data ?? []);
    setTerms(t.data ?? []);
    setClasses(c.data ?? []);
    setSubjects(sub.data ?? []);

    // Load teacher's assignments if teacher
    if (user?.role === 'teacher' && user.teacher_id) {
      const { data: tch } = await supabase.from('teachers').select('id, subject_ids, class_ids').eq('id', user.teacher_id).maybeSingle();
      setTeacher(tch as { id: string; subject_ids: string[]; class_ids: string[] } | null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Auto-select from query params
  useEffect(() => {
    if (!loading && sessions.length) {
      const qs = params.get('session');
      const qt = params.get('term');
      const qc = params.get('class');
      const qsub = params.get('subject');
      if (qs) setSession(qs);
      if (qt) setTerm(qt);
      if (qc) setClassId(qc);
      if (qsub) setSubjectId(qsub);
    }
  }, [loading, sessions, params]);

  const availableTerms = useMemo(() => (session ? terms.filter((t) => t.session_id === session) : terms), [session, terms]);
  const availableClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (teacher) return classes.filter((c) => (teacher.class_ids ?? []).includes(c.id));
    return [];
  }, [isAdmin, teacher, classes]);
  const availableSubjects = useMemo(() => {
    let list = subjects;
    if (classId) list = list.filter((s) => s.class_id === classId);
    if (!isAdmin && teacher) list = list.filter((s) => (teacher.subject_ids ?? []).includes(s.id));
    return list;
  }, [subjects, classId, isAdmin, teacher]);

  // Load students + existing results when class selected
  useEffect(() => {
    if (!classId) { setStudents([]); setRows({}); return; }
    (async () => {
      const { data: studs } = await supabase.from('students').select('*').eq('class_id', classId).order('first_name');
      setStudents(studs ?? []);
      if (session && term && subjectId) {
        const { data: existing } = await supabase.from('results').select('*').eq('session_id', session).eq('term_id', term).eq('subject_id', subjectId).eq('class_id', classId);
        const map: Record<string, RowState> = {};
        (existing ?? []).forEach((r: Result) => {
          map[r.student_id] = { ca: String(r.ca1_score + r.ca2_score + r.ca3_score), exam: String(r.exam_score), status: r.status, existingId: r.id };
        });
        setRows(map);
      } else {
        setRows({});
      }
    })();
  }, [classId, session, term, subjectId]);

  const setRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => {
      const base: RowState = prev[studentId] ?? { ca: '', exam: '', status: 'Draft' };
      return { ...prev, [studentId]: { ...base, ...patch } };
    });
  };

  const canEnter = session && term && classId && subjectId;

  const saveAll = async (publish: boolean) => {
    if (!canEnter) { error('Please select session, term, class and subject.'); return; }
    if (students.length === 0) { error('No students in the selected class.'); return; }
    setSaving(true);
    let saved = 0;
    for (const stu of students) {
      const row = rows[stu.id];
      const ca = row?.ca !== undefined && row.ca !== '' ? clampScore(Number(row.ca), CA_MAX) : null;
      const exam = row?.exam !== undefined && row.exam !== '' ? clampScore(Number(row.exam), EXAM_MAX) : null;
      if (ca === null && exam === null) continue;
      const caVal = ca ?? 0;
      const examVal = exam ?? 0;
      const total = caVal + examVal;
      const { grade, remark } = computeGrade(total);
      const status: Result['status'] = publish ? 'Published' : (row?.status ?? 'Pending');
      const payload = {
        student_id: stu.id,
        subject_id: subjectId,
        teacher_id: teacher?.id ?? (user?.teacher_id ?? null),
        class_id: classId,
        session_id: session,
        term_id: term,
        ca1_score: caVal,
        ca2_score: 0,
        ca3_score: 0,
        exam_score: examVal,
        grade,
        remark,
        status,
        updated_at: new Date().toISOString(),
      };
      if (row?.existingId) {
        const { error: e } = await supabase.from('results').update(payload).eq('id', row.existingId);
        if (e) { error(`Failed to save result for ${fullName(stu)}`); continue; }
      } else {
        const { error: e } = await supabase.from('results').insert(payload);
        if (e) { error(`Failed to save result for ${fullName(stu)}`); continue; }
      }
      saved++;
    }
    setSaving(false);
    if (saved > 0) {
      success(publish ? `${saved} results published successfully.` : `${saved} results saved successfully.`);
      // reload existing
      const { data: existing } = await supabase.from('results').select('*').eq('session_id', session).eq('term_id', term).eq('subject_id', subjectId).eq('class_id', classId);
      const map: Record<string, RowState> = {};
      (existing ?? []).forEach((r: Result) => {
        map[r.student_id] = { ca: String(r.ca1_score + r.ca2_score + r.ca3_score), exam: String(r.exam_score), status: r.status, existingId: r.id };
      });
      setRows(map);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={isAdmin ? '/admin/results' : '/teacher/results'} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Result Entry</h2>
          <p className="text-sm text-slate-500 mt-1">Enter CA (max {CA_MAX}) and Exam (max {EXAM_MAX}) scores. Total, grade and remark are calculated automatically.</p>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Academic Session</span>
              <Select value={session} onChange={(e) => { setSession(e.target.value); setTerm(''); }}>
                <option value="">Select session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Term</span>
              <Select value={term} onChange={(e) => setTerm(e.target.value)} disabled={!session}>
                <option value="">Select term</option>
                {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Class</span>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select class</option>
                {availableClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Subject</span>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!classId}>
                <option value="">Select subject</option>
                {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
          </div>
        </CardBody>
      </Card>

      {canEnter && (
        <Card>
          <CardHeader
            title="Student Scores"
            subtitle={`${students.length} students`}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={<Save className="h-4 w-4" />} onClick={() => saveAll(false)} disabled={saving || students.length === 0}>
                  {saving ? 'Saving...' : 'Save as Pending'}
                </Button>
                <Button size="sm" variant="success" icon={<Send className="h-4 w-4" />} onClick={() => saveAll(true)} disabled={saving || students.length === 0}>
                  Save & Publish
                </Button>
              </div>
            }
          />
          {students.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No students in this class" description="Add students to this class first." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Student ID</th>
                    <th className="text-left px-4 py-3 font-medium">Student Name</th>
                    <th className="text-left px-4 py-3 font-medium">CA (/{CA_MAX})</th>
                    <th className="text-left px-4 py-3 font-medium">Exam (/{EXAM_MAX})</th>
                    <th className="text-left px-4 py-3 font-medium">Total</th>
                    <th className="text-left px-4 py-3 font-medium">Grade</th>
                    <th className="text-left px-4 py-3 font-medium">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((stu) => {
                    const row = rows[stu.id] ?? { ca: '', exam: '', status: 'Draft' as const };
                    const caNum = row.ca === '' ? 0 : Number(row.ca) || 0;
                    const examNum = row.exam === '' ? 0 : Number(row.exam) || 0;
                    const total = caNum + examNum;
                    const { grade, remark } = computeGrade(total);
                    const caError = row.ca !== '' && (Number(row.ca) > CA_MAX || Number(row.ca) < 0);
                    const examError = row.exam !== '' && (Number(row.exam) > EXAM_MAX || Number(row.exam) < 0);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{stu.student_id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{fullName(stu)}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={CA_MAX}
                            value={row.ca}
                            onChange={(e) => setRow(stu.id, { ca: e.target.value })}
                            className={`w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${caError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                            placeholder="0"
                          />
                          {caError && <p className="text-xs text-red-600 mt-0.5">Max {CA_MAX}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={EXAM_MAX}
                            value={row.exam}
                            onChange={(e) => setRow(stu.id, { exam: e.target.value })}
                            className={`w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${examError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                            placeholder="0"
                          />
                          {examError && <p className="text-xs text-red-600 mt-0.5">Max {EXAM_MAX}</p>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{total}</td>
                        <td className="px-4 py-3"><span className="font-semibold text-blue-700">{grade}</span></td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{remark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!canEnter && (
        <Card>
          <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="Select all filters to begin" description="Choose a session, term, class and subject to enter scores for students." />
        </Card>
      )}
    </div>
  );
}
