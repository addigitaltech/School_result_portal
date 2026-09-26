import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/Badge';
import { Users, UserCog, School, BookOpen, ClipboardList, Clock, ArrowRight, UserPlus, BookPlus, ClipboardCheck } from 'lucide-react';
import type { Result } from '@/lib/types';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  subjects: number;
  published: number;
  pending: number;
  draft: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, t, c, sub, rPub, rPen, rDraft] = await Promise.all([
        api.from('students').select('id', { count: 'exact', head: true }),
        api.from('teachers').select('id', { count: 'exact', head: true }),
        api.from('classes').select('id', { count: 'exact', head: true }),
        api.from('subjects').select('id', { count: 'exact', head: true }),
        api.from('results').select('id', { count: 'exact', head: true }).eq('status', 'Published'),
        api.from('results').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        api.from('results').select('id', { count: 'exact', head: true }).eq('status', 'Draft'),
      ]);
      setStats({
        students: s.count ?? 0,
        teachers: t.count ?? 0,
        classes: c.count ?? 0,
        subjects: sub.count ?? 0,
        published: rPub.count ?? 0,
        pending: rPen.count ?? 0,
        draft: rDraft.count ?? 0,
      });
      const { data } = await api.from('results').select('*').order('updated_at', { ascending: false }).limit(6);
      setRecent(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  const cards = [
    { label: 'Total Students', value: stats.students, icon: <Users className="h-5 w-5" />, color: 'bg-blue-50 text-blue-600', to: '/admin/students' },
    { label: 'Total Teachers', value: stats.teachers, icon: <UserCog className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600', to: '/admin/teachers' },
    { label: 'Total Classes', value: stats.classes, icon: <School className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600', to: '/admin/classes' },
    { label: 'Total Subjects', value: stats.subjects, icon: <BookOpen className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600', to: '/admin/subjects' },
    { label: 'Published Results', value: stats.published, icon: <ClipboardCheck className="h-5 w-5" />, color: 'bg-teal-50 text-teal-600', to: '/admin/results' },
    { label: 'Pending Results', value: stats.pending + stats.draft, icon: <Clock className="h-5 w-5" />, color: 'bg-rose-50 text-rose-600', to: '/admin/results' },
  ];

  const totalResults = stats.published + stats.pending + stats.draft;
  const publishedPct = totalResults ? Math.round((stats.published / totalResults) * 100) : 0;
  const pendingPct = totalResults ? Math.round(((stats.pending + stats.draft) / totalResults) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome back, Administrator</h2>
        <p className="text-sm text-slate-500 mt-1">Here's an overview of your school's academic activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className={`inline-flex p-2.5 rounded-lg mb-3 ${c.color}`}>{c.icon}</div>
                <p className="text-2xl font-bold text-slate-800">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Results" subtitle="Latest result entries across all classes" action={<Link to="/admin/results" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Result</th>
                  <th className="text-left px-5 py-3 font-medium">CA</th>
                  <th className="text-left px-5 py-3 font-medium">Exam</th>
                  <th className="text-left px-5 py-3 font-medium">Total</th>
                  <th className="text-left px-5 py-3 font-medium">Grade</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No results yet.</td></tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">Result #{r.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-slate-600">{r.ca1_score + r.ca2_score + r.ca3_score}</td>
                    <td className="px-5 py-3 text-slate-600">{r.exam_score}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{r.total_score}</td>
                    <td className="px-5 py-3"><span className="font-semibold text-blue-700">{r.grade ?? '—'}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Result Status" subtitle="Publication progress" />
            <CardBody>
              <div className="flex items-center justify-center my-2">
                <div className="relative h-36 w-36">
                  <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#0d9488" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${publishedPct * 2.513} 251.3`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-800">{publishedPct}%</span>
                    <span className="text-xs text-slate-400">Published</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-around text-xs">
                <div className="text-center"><span className="block h-2 w-2 rounded-full bg-teal-600 mx-auto mb-1" /><span className="text-slate-600">Published {stats.published}</span></div>
                <div className="text-center"><span className="block h-2 w-2 rounded-full bg-rose-500 mx-auto mb-1" /><span className="text-slate-600">Pending {stats.pending + stats.draft}</span></div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody className="space-y-2">
              {[
                { to: '/admin/students', label: 'Add Student', icon: <UserPlus className="h-4 w-4" /> },
                { to: '/admin/teachers', label: 'Add Teacher', icon: <UserCog className="h-4 w-4" /> },
                { to: '/admin/subjects', label: 'Add Subject', icon: <BookPlus className="h-4 w-4" /> },
                { to: '/admin/results', label: 'Manage Results', icon: <ClipboardList className="h-4 w-4" /> },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-700">
                  <span className="text-blue-600">{a.icon}</span>
                  <span className="flex-1">{a.label}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent Activities" />
        <CardBody className="space-y-3">
          {[
            { text: 'Results published for First Term 2025/2026', time: '2 hours ago' },
            { text: 'New student Aisha Ibrahim added to JSS 1', time: '1 day ago' },
            { text: 'Teacher Mr. Adamu Okeke assigned to Mathematics', time: '2 days ago' },
            { text: 'Academic session 2025/2026 set as active', time: '3 days ago' },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1"><p className="text-slate-700">{a.text}</p><p className="text-xs text-slate-400 mt-0.5">{a.time}</p></div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
