import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, apiReportBundle, type ReportBundle } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { ResultSheet } from '@/components/ResultSheet';
import { fullName } from '@/lib/format';
import type { Result, Student, Subject, ClassRow, Arm, AcademicSession, Term } from '@/lib/types';
import { ClipboardList, Plus, Pencil, Eye } from 'lucide-react';

export function TeacherResultsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<(Result & { students?: Student; subjects?: Subject; classes?: ClassRow })[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ session: '', term: '', classId: '', armId: '' });
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!user?.teacher_id) { setLoading(false); return; }
    (async () => {
      const [r, s, t, c, a] = await Promise.all([
        api.from('results').select('*, students(*), subjects(*), classes(*)').eq('teacher_id', user.teacher_id).order('updated_at', { ascending: false }),
        api.from('academic_sessions').select('*').order('name'),
        api.from('terms').select('*').order('name'),
        api.from('classes').select('*').order('name'),
        api.from('arms').select('*').order('name'),
      ]);
      setResults(r.data ?? []);
      setSessions(s.data ?? []);
      setTerms(t.data ?? []);
      setClasses(c.data ?? []);
      setArms(a.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const availableTerms = useMemo(() => (filters.session ? terms.filter((t) => t.session_id === filters.session) : terms), [terms, filters.session]);
  const filtered = results.filter((r) => {
    if (filters.session && r.session_id !== filters.session) return false;
    if (filters.term && r.term_id !== filters.term) return false;
    if (filters.classId && r.class_id !== filters.classId) return false;
    if (filters.armId && r.students?.arm_id !== filters.armId) return false;
    return true;
  });

  const openPreview = async (row: Result & { student_id: string; session_id: string; term_id: string }) => {
    setBundle(null);
    setPreviewLoading(true);
    try { setBundle(await apiReportBundle(row.student_id, row.session_id, row.term_id)); }
    finally { setPreviewLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Results</h2>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} of {results.length} result entries. You can enter scores only for your own subjects, but you can preview and print any student's complete result here.</p>
        </div>
        <Link to="/teacher/results/entry"><Button icon={<Plus className="h-4 w-4" />}>Enter New Results</Button></Link>
      </div>

      <Card><CardBody className="space-y-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value, term: '' })}>
            <option value="">All Sessions</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={filters.term} onChange={(e) => setFilters({ ...filters, term: e.target.value })}>
            <option value="">All Terms</option>
            {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={filters.classId} onChange={(e) => setFilters({ ...filters, classId: e.target.value, armId: '' })}>
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.armId} onChange={(e) => setFilters({ ...filters, armId: e.target.value })}>
            <option value="">All Arms</option>
            {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
      </CardBody></Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No results found" description="Select a class and subject to start entering results, or adjust the filters above." action={<Link to="/teacher/results/entry"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Enter Results</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Student</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Subject</th>
                  <th className="text-left px-5 py-3 font-medium">CA</th>
                  <th className="text-left px-5 py-3 font-medium">Exam</th>
                  <th className="text-left px-5 py-3 font-medium">Total</th>
                  <th className="text-left px-5 py-3 font-medium">Grade</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.students ? fullName(r.students) : '—'}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{r.subjects?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{r.ca1_score + r.ca2_score + r.ca3_score}</td>
                    <td className="px-5 py-3 text-slate-600">{r.exam_score}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{r.total_score}</td>
                    <td className="px-5 py-3"><span className="font-semibold text-blue-700">{r.grade ?? '—'}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openPreview(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Preview / Print complete result"><Eye className="h-4 w-4" /></button>
                        <Link to={`/teacher/results/entry?session=${r.session_id}&term=${r.term_id}&class=${r.class_id ?? ''}&arm=${r.students?.arm_id ?? ''}&subject=${r.subject_id}`} className="inline-flex p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={previewLoading || !!bundle} onClose={() => setBundle(null)} title={bundle ? `Complete Result — ${fullName(bundle.student)}` : 'Loading...'} size="xl">
        {previewLoading || !bundle ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : (
          <ResultSheet student={bundle.student} settings={bundle.settings} session={bundle.session} term={bundle.term} results={bundle.results} className={bundle.className} bundle={bundle} />
        )}
      </Modal>
    </div>
  );
}
