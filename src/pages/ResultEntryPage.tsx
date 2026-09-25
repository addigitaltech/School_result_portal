import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';
import { computeGrade, clampScore } from '@/lib/grading';
import type { AcademicSession, Term, ClassRow, Subject, Student, Result, SchoolSettings, GradeBand, AffectiveTrait, AffectiveRating, TermRemark } from '@/lib/types';
import { ArrowLeft, Save, Send, ClipboardList, SlidersHorizontal } from 'lucide-react';

interface RowState {
  ca1: string;
  ca2: string;
  ca3: string;
  exam: string;
  offered: boolean;
  status: Result['status'];
  existingId?: string;
  teacherRemark: string;
  principalRemark: string;
  ratings: Record<string, number>;
}

const defaultSettings: Pick<SchoolSettings, 'ca1_max_score' | 'ca2_max_score' | 'ca3_max_score' | 'exam_max_score'> = {
  ca1_max_score: 40,
  ca2_max_score: 0,
  ca3_max_score: 0,
  exam_max_score: 60,
};

const ratingLabels: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };

export function ResultEntryPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const { success, error } = useToast();
  const isAdmin = user?.role === 'admin';

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const [traits, setTraits] = useState<AffectiveTrait[]>([]);
  const [teacher, setTeacher] = useState<{ id: string; subject_ids: string[]; class_ids: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const makeDefaultRow = (): RowState => ({ ca1: '', ca2: '', ca3: '', exam: '', offered: true, status: 'Draft', teacherRemark: '', principalRemark: '', ratings: {} });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t, c, sub, school, bands, traitRows] = await Promise.all([
      supabase.from('academic_sessions').select('*').order('name'),
      supabase.from('terms').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('school_settings').select('ca1_max_score, ca2_max_score, ca3_max_score, exam_max_score').limit(1).maybeSingle(),
      supabase.from('grade_bands').select('*').order('min_score', { ascending: false }),
      supabase.from('affective_traits').select('*').order('name'),
    ]);
    setSessions(s.data ?? []);
    setTerms(t.data ?? []);
    setClasses(c.data ?? []);
    setSubjects(sub.data ?? []);
    setSettings({ ...defaultSettings, ...(school.data ?? {}) });
    setGradeBands((bands.data ?? []) as GradeBand[]);
    setTraits((traitRows.data ?? []) as AffectiveTrait[]);

    if (user?.role === 'teacher' && user.teacher_id) {
      const { data: tch } = await supabase.from('teachers').select('id, subject_ids, class_ids').eq('id', user.teacher_id).maybeSingle();
      setTeacher(tch as { id: string; subject_ids: string[]; class_ids: string[] } | null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

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

  useEffect(() => {
    if (!classId) { setStudents([]); setRows({}); return; }
    (async () => {
      const { data: studs } = await supabase.from('students').select('*').eq('class_id', classId).order('first_name');
      const loadedStudents = (studs ?? []) as Student[];
      setStudents(loadedStudents);
      const map: Record<string, RowState> = {};
      loadedStudents.forEach((student) => { map[student.id] = makeDefaultRow(); });

      if (session && term && subjectId && loadedStudents.length) {
        const { data: existing } = await supabase.from('results').select('*').eq('session_id', session).eq('term_id', term).eq('subject_id', subjectId).eq('class_id', classId);
        (existing ?? []).forEach((result: Result) => {
          const row = map[result.student_id] ?? makeDefaultRow();
          map[result.student_id] = {
            ...row,
            ca1: String(result.ca1_score), ca2: String(result.ca2_score), ca3: String(result.ca3_score), exam: String(result.exam_score),
            offered: result.is_offered !== false, status: result.status, existingId: result.id,
          };
        });
      }

      if (session && term && loadedStudents.length) {
        const studentIds = loadedStudents.map((student) => student.id);
        const [ratingResponse, remarkResponse] = await Promise.all([
          supabase.from('affective_ratings').select('*').in('student_id', studentIds).eq('session_id', session).eq('term_id', term),
          supabase.from('term_remarks').select('*').in('student_id', studentIds).eq('session_id', session).eq('term_id', term),
        ]);
        (ratingResponse.data ?? []).forEach((rating: AffectiveRating) => {
          const row = map[rating.student_id] ?? makeDefaultRow();
          map[rating.student_id] = { ...row, ratings: { ...row.ratings, [rating.trait_id]: rating.rating } };
        });
        (remarkResponse.data ?? []).forEach((remark: TermRemark) => {
          const row = map[remark.student_id] ?? makeDefaultRow();
          map[remark.student_id] = { ...row, teacherRemark: remark.teacher_remark, principalRemark: remark.principal_remark };
        });
      }
      setRows(map);
    })();
  }, [classId, session, term, subjectId]);

  const setRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? makeDefaultRow()), ...patch } }));
  };

  const setRating = (studentId: string, traitId: string, rating: number) => {
    const row = rows[studentId] ?? makeDefaultRow();
    setRow(studentId, { ratings: { ...row.ratings, [traitId]: rating } });
  };

  const canEnter = session && term && classId && subjectId;
  const maxTotal = settings.ca1_max_score + settings.ca2_max_score + settings.ca3_max_score + settings.exam_max_score;
  const offeredStudents = students.filter((student) => rows[student.id]?.offered !== false);

  const saveAll = async (publish: boolean) => {
    if (!canEnter) { error('Please select session, term, class and subject.'); return; }
    if (students.length === 0) { error('No students in the selected class.'); return; }
    setSaving(true);
    let saved = 0;
    for (const student of students) {
      const row = rows[student.id] ?? makeDefaultRow();
      const ca1 = row.ca1 === '' ? null : clampScore(Number(row.ca1), settings.ca1_max_score);
      const ca2 = row.ca2 === '' ? null : clampScore(Number(row.ca2), settings.ca2_max_score);
      const ca3 = row.ca3 === '' ? null : clampScore(Number(row.ca3), settings.ca3_max_score);
      const exam = row.exam === '' ? null : clampScore(Number(row.exam), settings.exam_max_score);
      const hasScores = ca1 !== null || ca2 !== null || ca3 !== null || exam !== null;
      const hasAdditionalData = row.teacherRemark.trim() !== '' || row.principalRemark.trim() !== '' || Object.keys(row.ratings).length > 0;
      if (!hasScores && row.offered && !hasAdditionalData) continue;
      const ca1Val = ca1 ?? 0;
      const ca2Val = ca2 ?? 0;
      const ca3Val = ca3 ?? 0;
      const examVal = exam ?? 0;
      const total = ca1Val + ca2Val + ca3Val + examVal;
      const { grade, remark } = row.offered ? computeGrade(total, gradeBands) : { grade: null, remark: null };
      const status: Result['status'] = publish ? 'Published' : (row.status ?? 'Pending');
      const payload = {
        student_id: student.id, subject_id: subjectId, teacher_id: teacher?.id ?? (user?.teacher_id ?? null), class_id: classId,
        session_id: session, term_id: term, ca1_score: ca1Val, ca2_score: ca2Val, ca3_score: ca3Val, exam_score: examVal,
        is_offered: row.offered, grade, remark, status, updated_at: new Date().toISOString(),
      };
      if (hasScores || !row.offered) {
        const resultResponse = row.existingId
          ? await supabase.from('results').update(payload).eq('id', row.existingId)
          : await supabase.from('results').insert(payload);
        if (resultResponse.error) { error(`Failed to save result for ${fullName(student)}`); continue; }
      }

      const { error: remarkError } = await supabase.from('term_remarks').upsert({
        student_id: student.id, session_id: session, term_id: term, teacher_remark: row.teacherRemark.trim(), principal_remark: row.principalRemark.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,session_id,term_id' });
      if (remarkError) { error(`Failed to save term remarks for ${fullName(student)}`); continue; }

      const ratings = traits.filter((trait) => row.ratings[trait.id]).map((trait) => ({ student_id: student.id, trait_id: trait.id, session_id: session, term_id: term, rating: row.ratings[trait.id], updated_at: new Date().toISOString() }));
      if (ratings.length) {
        const { error: ratingError } = await supabase.from('affective_ratings').upsert(ratings, { onConflict: 'student_id,trait_id,session_id,term_id' });
        if (ratingError) { error(`Failed to save affective ratings for ${fullName(student)}`); continue; }
      }
      saved++;
    }
    setSaving(false);
    if (saved > 0) {
      success(publish ? `${saved} student results published successfully.` : `${saved} student results saved successfully.`);
      const { data: existing } = await supabase.from('results').select('*').eq('session_id', session).eq('term_id', term).eq('subject_id', subjectId).eq('class_id', classId);
      const map = { ...rows };
      (existing ?? []).forEach((result: Result) => {
        const row = map[result.student_id] ?? makeDefaultRow();
        map[result.student_id] = { ...row, ca1: String(result.ca1_score), ca2: String(result.ca2_score), ca3: String(result.ca3_score), exam: String(result.exam_score), offered: result.is_offered !== false, status: result.status, existingId: result.id };
      });
      setRows(map);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Link to={isAdmin ? '/admin/results' : '/teacher/results'} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><ArrowLeft className="h-5 w-5" /></Link><div><h2 className="text-2xl font-bold text-slate-800">Result Entry</h2><p className="text-sm text-slate-500 mt-1">Enter CA1, CA2, CA3 and Exam scores. Maximums are configured in school settings.</p></div></div>

      <Card><CardBody><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">Academic Session</span><Select value={session} onChange={(e) => { setSession(e.target.value); setTerm(''); }}><option value="">Select session</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label><label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">Term</span><Select value={term} onChange={(e) => setTerm(e.target.value)} disabled={!session}><option value="">Select term</option>{availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></label><label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">Class</span><Select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Select class</option>{availableClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label><label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">Subject</span><Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!classId}><option value="">Select subject</option>{availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label></div></CardBody></Card>

      {canEnter && <Card><CardHeader title="Student Scores" subtitle={`${students.length} students · ${offeredStudents.length} offered · ${maxTotal} total points`} action={<div className="flex gap-2"><Button size="sm" variant="secondary" icon={<Save className="h-4 w-4" />} onClick={() => saveAll(false)} disabled={saving || students.length === 0}>{saving ? 'Saving...' : 'Save as Pending'}</Button><Button size="sm" variant="success" icon={<Send className="h-4 w-4" />} onClick={() => saveAll(true)} disabled={saving || students.length === 0}>Save & Publish</Button></div>} /></Card>}
      {canEnter && (students.length === 0 ? <Card><EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No students in this class" description="Add students to this class first." /></Card> : <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-4 py-3 font-medium">Student</th><th className="text-left px-4 py-3 font-medium">Offered</th><th className="text-left px-4 py-3 font-medium">CA1 (/{settings.ca1_max_score})</th><th className="text-left px-4 py-3 font-medium">CA2 (/{settings.ca2_max_score})</th><th className="text-left px-4 py-3 font-medium">CA3 (/{settings.ca3_max_score})</th><th className="text-left px-4 py-3 font-medium">Exam (/{settings.exam_max_score})</th><th className="text-left px-4 py-3 font-medium">Total</th><th className="text-left px-4 py-3 font-medium">Grade</th><th className="text-left px-4 py-3 font-medium">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => { const row = rows[student.id] ?? makeDefaultRow(); const ca1 = row.ca1 === '' ? 0 : Number(row.ca1) || 0; const ca2 = row.ca2 === '' ? 0 : Number(row.ca2) || 0; const ca3 = row.ca3 === '' ? 0 : Number(row.ca3) || 0; const exam = row.exam === '' ? 0 : Number(row.exam) || 0; const total = ca1 + ca2 + ca3 + exam; const graded = row.offered ? computeGrade(total, gradeBands) : { grade: 'N/A', remark: 'Not offered' }; return <tr key={student.id} className={`align-top hover:bg-slate-50 ${!row.offered ? 'bg-slate-50/70' : ''}`}><td className="px-4 py-3 font-medium text-slate-800">{fullName(student)}<span className="block font-mono text-xs text-slate-400">{student.student_id}</span></td><td className="px-4 py-3"><label className="inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={row.offered} onChange={(e) => setRow(student.id, { offered: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Yes</label></td>{([['ca1', settings.ca1_max_score], ['ca2', settings.ca2_max_score], ['ca3', settings.ca3_max_score], ['exam', settings.exam_max_score]] as const).map(([field, max]) => { const value = row[field]; const invalid = value !== '' && (Number(value) < 0 || Number(value) > max); return <td key={field} className="px-4 py-3"><input type="number" min={0} max={max} value={value} onChange={(e) => setRow(student.id, { [field]: e.target.value })} disabled={!row.offered || max === 0} className={`w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${invalid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'} disabled:bg-slate-100 disabled:text-slate-400`} placeholder="0" />{invalid && <p className="text-xs text-red-600 mt-0.5">Max {max}</p>}</td>; })}<td className="px-4 py-3 font-semibold text-slate-800">{row.offered ? total : '—'}</td><td className="px-4 py-3"><span className="font-semibold text-blue-700">{graded.grade}</span><span className="block text-xs text-slate-500">{graded.remark}</span></td><td className="px-4 py-3"><details className="min-w-[260px]"><summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-blue-700"><SlidersHorizontal className="h-3.5 w-3.5" /> Affective / remarks</summary><div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Affective / Psychomotor Ratings</p>{traits.length === 0 ? <p className="text-xs text-slate-400">No traits configured.</p> : <div className="space-y-2">{traits.map((trait) => <div key={trait.id} className="flex flex-wrap items-center gap-2"><span className="w-36 text-xs text-slate-700">{trait.name}</span>{([1, 2, 3, 4, 5] as const).map((rating) => <label key={rating} className="flex items-center gap-1 text-[11px] text-slate-500"><input type="radio" name={`${student.id}-${trait.id}`} checked={row.ratings[trait.id] === rating} onChange={() => setRating(student.id, trait.id, rating)} />{ratingLabels[rating]}</label>)}</div>)}</div>}</div><label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Teacher's Remark</span><textarea value={row.teacherRemark} onChange={(e) => setRow(student.id, { teacherRemark: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter teacher's remark for this term" /></label><label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Principal's Remark</span><textarea value={row.principalRemark} onChange={(e) => setRow(student.id, { principalRemark: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter principal's remark for this term" /></label></div></details></td></tr>; })}</tbody></table></div></Card>)}

      {!canEnter && <Card><EmptyState icon={<ClipboardList className="h-12 w-12" />} title="Select all filters to begin" description="Choose a session, term, class and subject to enter scores for students." /></Card>}
    </div>
  );
}
