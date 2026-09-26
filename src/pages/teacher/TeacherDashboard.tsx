import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/Badge';
import { fullName } from '@/lib/format';
import type { Teacher, Subject, ClassRow, Result, Student } from '@/lib/types';
import { BookOpen, School, ClipboardList, Users, ClipboardEdit, ArrowRight } from 'lucide-react';

export function TeacherDashboard() {
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [results, setResults] = useState<(Result & { students?: Student; subjects?: Subject })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.teacher_id) { setLoading(false); return; }
    (async () => {
      const { data: tch } = await api.from('teachers').select('*').eq('id', user.teacher_id).maybeSingle();
      setTeacher(tch as Teacher | null);
      const [subRes, clsRes, rRes] = await Promise.all([
        api.from('subjects').select('*').in('id', (tch as Teacher)?.subject_ids ?? []),
        api.from('classes').select('*').in('id', (tch as Teacher)?.class_ids ?? []),
        api.from('results').select('*, students(*), subjects(*)').eq('teacher_id', user.teacher_id).order('updated_at', { ascending: false }).limit(8),
      ]);
      setSubjects(subRes.data ?? []);
      setClasses(clsRes.data ?? []);
      setResults(rRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const published = results.filter((r) => r.status === 'Published').length;
  const pending = results.filter((r) => r.status !== 'Published').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome, {teacher?.full_name ?? user?.display_name}</h2>
        <p className="text-sm text-slate-500 mt-1">Here's an overview of your teaching assignments and recent results.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-blue-50 text-blue-600"><School className="h-5 w-5" /></div>
          <p className="text-2xl font-bold text-slate-800">{classes.length}</p>
          <p className="text-xs text-slate-500 mt-1">Assigned Classes</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-emerald-50 text-emerald-600"><BookOpen className="h-5 w-5" /></div>
          <p className="text-2xl font-bold text-slate-800">{subjects.length}</p>
          <p className="text-xs text-slate-500 mt-1">Assigned Subjects</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-teal-50 text-teal-600"><ClipboardList className="h-5 w-5" /></div>
          <p className="text-2xl font-bold text-slate-800">{published}</p>
          <p className="text-xs text-slate-500 mt-1">Published Results</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-amber-50 text-amber-600"><ClipboardEdit className="h-5 w-5" /></div>
          <p className="text-2xl font-bold text-slate-800">{pending}</p>
          <p className="text-xs text-slate-500 mt-1">Pending/Draft Results</p>
        </CardBody></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="My Subjects" subtitle="Subjects you are assigned to teach" />
          <CardBody className="space-y-2">
            {subjects.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-10 w-10" />} title="No subjects assigned" description="Contact the administrator to be assigned subjects." />
            ) : (
              subjects.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.code}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My Classes" subtitle="Classes you teach" action={<Link to="/teacher/results" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">Enter Results <ArrowRight className="h-3 w-3" /></Link>} />
          <CardBody className="space-y-2">
            {classes.length === 0 ? (
              <EmptyState icon={<School className="h-10 w-10" />} title="No classes assigned" description="Contact the administrator to be assigned classes." />
            ) : (
              classes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><School className="h-4 w-4" /></div>
                  <p className="font-medium text-slate-800 text-sm flex-1">{c.name}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Results" subtitle="Results you have recently entered" action={<Link to="/teacher/results" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">Enter new <ArrowRight className="h-3 w-3" /></Link>} />
        {results.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No results entered yet" description="Select a class and subject to start entering results." action={<Link to="/teacher/results"><button className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">Enter Results</button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Student</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Subject</th>
                  <th className="text-left px-5 py-3 font-medium">Total</th>
                  <th className="text-left px-5 py-3 font-medium">Grade</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.students ? fullName(r.students) : '—'}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{r.subjects?.name ?? '—'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{r.total_score}</td>
                    <td className="px-5 py-3"><span className="font-semibold text-blue-700">{r.grade ?? '—'}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
