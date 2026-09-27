import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiReportCard } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { ResultSheet } from '@/components/ResultSheet';
import { fullName } from '@/lib/format';
import type { Result, Student, Subject, ClassRow, AcademicSession, Term, SchoolSettings } from '@/lib/types';
import { ClipboardList, Plus, Pencil, Eye } from 'lucide-react';

export function TeacherResultsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<(Result & { students?: Student; subjects?: Subject; classes?: ClassRow })[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ student: Student; className: string; session: AcademicSession | null; term: Term | null } | null>(null);
  const [previewResults, setPreviewResults] = useState<(Result & { subjects?: Subject })[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!user?.teacher_id) { setLoading(false); return; }
    (async () => {
      const [r, s, t, settingsRes] = await Promise.all([
        api.from('results').select('*, students(*), subjects(*), classes(*)').eq('teacher_id', user.teacher_id).order('updated_at', { ascending: false }),
        api.from('academic_sessions').select('*').order('name'),
        api.from('terms').select('*').order('name'),
        api.from('school_settings').select('*').limit(1).maybeSingle(),
      ]);
      setResults(r.data ?? []);
      setSessions(s.data ?? []);
      setTerms(t.data ?? []);
      setSettings((settingsRes.data as SchoolSettings | null) ?? null);
      setLoading(false);
    })();
  }, [user]);

  const openPreview = async (row: Result & { students?: Student; classes?: ClassRow }) => {
    if (!row.students) return;
    setPreview({ student: row.students, className: row.classes?.name ?? '—', session: sessions.find((s) => s.id === row.session_id) ?? null, term: terms.find((t) => t.id === row.term_id) ?? null });
    setPreviewLoading(true);
    const data = await apiReportCard<Result & { subjects?: Subject }>(row.student_id, row.session_id, row.term_id);
    setPreviewResults(data);
    setPreviewLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Results</h2>
          <p className="text-sm text-slate-500 mt-1">{results.length} result entries</p>
        </div>
        <Link to="/teacher/results/entry"><Button icon={<Plus className="h-4 w-4" />}>Enter New Results</Button></Link>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : results.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No results entered yet" description="Select a class and subject to start entering results." action={<Link to="/teacher/results/entry"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Enter Results</Button></Link>} />
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
                  <th className="text-right px-5 py-3 font-medium">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
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
                        <button onClick={() => openPreview(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Preview / Print Report Card"><Eye className="h-4 w-4" /></button>
                        <Link to={`/teacher/results/entry?session=${r.session_id}&term=${r.term_id}&class=${r.class_id ?? ''}&subject=${r.subject_id}`} className="inline-flex p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
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

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `Report Card — ${fullName(preview.student)}` : ''} size="xl">
        {previewLoading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : preview ? (
          <ResultSheet student={preview.student} settings={settings} session={preview.session} term={preview.term} results={previewResults} className={preview.className} />
        ) : null}
      </Modal>
    </div>
  );
}
