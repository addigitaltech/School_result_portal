import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';
import type { Result, Student, Subject, ClassRow, AcademicSession, Term, Teacher, ResultStatus } from '@/lib/types';
import { ClipboardList, Search, Pencil, Eye, Send, SendHorizontal, Plus } from 'lucide-react';

export function ResultsPage() {
  const { success, error } = useToast();
  const [results, setResults] = useState<(Result & { students?: Student; subjects?: Subject; classes?: ClassRow })[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ session: '', term: '', classId: '', subjectId: '', studentId: '', status: '', search: '' });
  const [statusTarget, setStatusTarget] = useState<{ id: string; status: ResultStatus } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s, t, c, sub, st] = await Promise.all([
      supabase.from('results').select('*, students(*), subjects(*), classes(*)').order('updated_at', { ascending: false }),
      supabase.from('academic_sessions').select('*').order('name'),
      supabase.from('terms').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('students').select('*').order('first_name'),
    ]);
    setResults(r.data ?? []);
    setSessions(s.data ?? []);
    setTerms(t.data ?? []);
    setClasses(c.data ?? []);
    setSubjects(sub.data ?? []);
    setStudents(st.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableTerms = filters.session ? terms.filter((t) => t.session_id === filters.session) : terms;

  const filtered = results.filter((r) => {
    if (filters.session && r.session_id !== filters.session) return false;
    if (filters.term && r.term_id !== filters.term) return false;
    if (filters.classId && r.class_id !== filters.classId) return false;
    if (filters.subjectId && r.subject_id !== filters.subjectId) return false;
    if (filters.studentId && r.student_id !== filters.studentId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = r.students ? fullName(r.students).toLowerCase() : '';
      if (!name.includes(q) && !r.students?.student_id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const updateStatus = async () => {
    if (!statusTarget) return;
    const { error: err } = await supabase.from('results').update({ status: statusTarget.status, updated_at: new Date().toISOString() }).eq('id', statusTarget.id);
    setStatusTarget(null);
    if (err) { error('Failed to update result status.'); return; }
    success(`Result ${statusTarget.status === 'Published' ? 'published' : statusTarget.status === 'Pending' ? 'marked pending' : 'unpublished'} successfully.`);
    load();
  };

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? '—';
  const termName = (id: string) => terms.find((t) => t.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Results Management</h2>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} results</p>
        </div>
        <Link to="/admin/results/entry"><Button icon={<Plus className="h-4 w-4" />}>Enter Results</Button></Link>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search by student name or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            <Select value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value, term: '' })}>
              <option value="">All Sessions</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={filters.term} onChange={(e) => setFilters({ ...filters, term: e.target.value })}>
              <option value="">All Terms</option>
              {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={filters.classId} onChange={(e) => setFilters({ ...filters, classId: e.target.value })}>
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}>
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={filters.studentId} onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}>
              <option value="">All Students</option>
              {students.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_id})</option>)}
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              <option>Draft</option><option>Pending</option><option>Published</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No results found" description="Adjust filters or enter new results." action={<Link to="/admin/results/entry"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Enter Results</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Student</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Class</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Session/Term</th>
                  <th className="text-left px-4 py-3 font-medium">CA</th>
                  <th className="text-left px-4 py-3 font-medium">Exam</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Grade</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.students ? fullName(r.students) : '—'}</p>
                      <p className="text-xs text-slate-400">{r.students?.student_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.subjects?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{r.classes?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden xl:table-cell text-xs">{sessionName(r.session_id)} / {termName(r.term_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.ca1_score + r.ca2_score + r.ca3_score}</td>
                    <td className="px-4 py-3 text-slate-600">{r.exam_score}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.total_score}</td>
                    <td className="px-4 py-3"><span className="font-semibold text-blue-700">{r.grade ?? '—'}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/admin/results/entry?session=${r.session_id}&term=${r.term_id}&class=${r.class_id ?? ''}&subject=${r.subject_id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></Link>
                        {r.status !== 'Published' ? (
                          <button onClick={() => setStatusTarget({ id: r.id, status: 'Published' })} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Publish"><Send className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => setStatusTarget({ id: r.id, status: 'Draft' })} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Unpublish"><SendHorizontal className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.status === 'Published' ? 'Publish Result' : 'Unpublish Result'}
        message={statusTarget?.status === 'Published' ? 'Publish this result so the student and parent can view it?' : 'Unpublish this result? It will no longer be visible to students and parents.'}
        confirmLabel={statusTarget?.status === 'Published' ? 'Publish' : 'Unpublish'}
        danger={statusTarget?.status !== 'Published'}
        onConfirm={updateStatus}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
