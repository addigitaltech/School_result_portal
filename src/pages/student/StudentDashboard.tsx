import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/Badge';
import { fullName } from '@/lib/format';
import type { Student, ClassRow, AcademicSession, Term, Result, Subject } from '@/lib/types';
import { User, ClipboardList, BookOpen, TrendingUp, Eye } from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState('—');
  const [settings, setSettings] = useState<{ current_session_id: string | null; current_term_id: string | null } | null>(null);
  const [session, setSession] = useState<AcademicSession | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [results, setResults] = useState<(Result & { subjects?: Subject })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.student_id) { setLoading(false); return; }
    (async () => {
      const { data: stu } = await api.from('students').select('*').eq('id', user.student_id).maybeSingle();
      setStudent(stu as Student | null);
      if (stu?.class_id) {
        const { data: cls } = await api.from('classes').select('name').eq('id', stu.class_id).maybeSingle();
        setClassName(cls?.name ?? '—');
      }
      const { data: s } = await api.from('school_settings').select('current_session_id, current_term_id').limit(1).maybeSingle();
      setSettings(s);
      if (s?.current_session_id) {
        const { data: sess } = await api.from('academic_sessions').select('*').eq('id', s.current_session_id).maybeSingle();
        setSession(sess as AcademicSession | null);
      }
      if (s?.current_term_id) {
        const { data: t } = await api.from('terms').select('*').eq('id', s.current_term_id).maybeSingle();
        setTerm(t as Term | null);
      }
      // published results for current session/term
      if (s?.current_session_id && s?.current_term_id) {
        const { data: r } = await api.from('results').select('*, subjects(*)').eq('student_id', user.student_id).eq('session_id', s.current_session_id).eq('term_id', s.current_term_id).eq('status', 'Published');
        setResults(r ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!student) return <p className="text-slate-500">Student profile not found.</p>;

  const avg = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.total_score, 0) / results.length) : 0;
  const status = results.length > 0 ? 'Published' : 'No Results';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome, {fullName(student)}</h2>
        <p className="text-sm text-slate-500 mt-1">Here's your academic overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-blue-50 text-blue-600"><User className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{student.student_id}</p>
          <p className="text-xs text-slate-500 mt-1">Student ID</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-emerald-50 text-emerald-600"><BookOpen className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{className}</p>
          <p className="text-xs text-slate-500 mt-1">Current Class</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-amber-50 text-amber-600"><ClipboardList className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{session?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{term?.name ?? 'No active term'}</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-teal-50 text-teal-600"><TrendingUp className="h-5 w-5" /></div>
          <p className="text-2xl font-bold text-slate-800">{avg || '—'}</p>
          <p className="text-xs text-slate-500 mt-1">Average Score</p>
        </CardBody></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Current Term Results" subtitle={`${results.length} published subjects`} action={<Link to="/student/result"><Button size="sm" icon={<Eye className="h-4 w-4" />}>View Result</Button></Link>} />
          {results.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No results published yet" description="Your results will appear here once published by your teacher." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Subject</th>
                    <th className="text-left px-5 py-3 font-medium">Total</th>
                    <th className="text-left px-5 py-3 font-medium">Grade</th>
                    <th className="text-left px-5 py-3 font-medium">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{r.subjects?.name ?? '—'}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{r.total_score}</td>
                      <td className="px-5 py-3"><span className="font-semibold text-blue-700">{r.grade}</span></td>
                      <td className="px-5 py-3 text-slate-600 text-xs">{r.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Result Status" />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Current Status</span>
              <StatusBadge status={status} />
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">Quick Actions</p>
              <Link to="/student/result" className="block px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-sm text-slate-700 mb-2">
                View Full Result Sheet
              </Link>
              <Link to="/student/profile" className="block px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-sm text-slate-700">
                View My Profile
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
