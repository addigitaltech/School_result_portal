import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';
import type { Parent, Student, ClassRow, AcademicSession, Term } from '@/lib/types';
import { User, BookOpen, ClipboardList, Eye, GraduationCap } from 'lucide-react';

export function ParentDashboard() {
  const { user } = useAuth();
  const [parent, setParent] = useState<Parent | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState('—');
  const [session, setSession] = useState<AcademicSession | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.parent_id) { setLoading(false); return; }
    (async () => {
      const { data: par } = await api.from('parents').select('*').eq('id', user.parent_id).maybeSingle();
      setParent(par as Parent | null);
      if (par?.student_id) {
        const { data: stu } = await api.from('students').select('*').eq('id', par.student_id).maybeSingle();
        setStudent(stu as Student | null);
        if (stu?.class_id) {
          const { data: cls } = await api.from('classes').select('name').eq('id', stu.class_id).maybeSingle();
          setClassName(cls?.name ?? '—');
        }
      }
      const { data: s } = await api.from('school_settings').select('current_session_id, current_term_id').limit(1).maybeSingle();
      if (s?.current_session_id) {
        const { data: sess } = await api.from('academic_sessions').select('*').eq('id', s.current_session_id).maybeSingle();
        setSession(sess as AcademicSession | null);
      }
      if (s?.current_term_id) {
        const { data: t } = await api.from('terms').select('*').eq('id', s.current_term_id).maybeSingle();
        setTerm(t as Term | null);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!parent || !student) return <p className="text-slate-500">Parent profile or linked student not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome, {parent.full_name}</h2>
        <p className="text-sm text-slate-500 mt-1">Here's an overview of your child's academic information.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-blue-50 text-blue-600"><User className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{parent.full_name}</p>
          <p className="text-xs text-slate-500 mt-1">Parent Name</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-emerald-50 text-emerald-600"><GraduationCap className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{fullName(student)}</p>
          <p className="text-xs text-slate-500 mt-1">Student Name</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-amber-50 text-amber-600"><BookOpen className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{className}</p>
          <p className="text-xs text-slate-500 mt-1">Class / {student.student_id}</p>
        </CardBody></Card>
        <Card><CardBody>
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-teal-50 text-teal-600"><ClipboardList className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-slate-800 truncate">{session?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{term?.name ?? 'No active term'}</p>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader title="Linked Student" subtitle="Your child's information" action={<Link to="/parent/result"><Button size="sm" icon={<Eye className="h-4 w-4" />}>View Result</Button></Link>} />
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold">
              {student.first_name.charAt(0)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 flex-1">
              <div><p className="text-xs text-slate-400">Full Name</p><p className="text-sm font-medium text-slate-800">{fullName(student)}</p></div>
              <div><p className="text-xs text-slate-400">Student ID</p><p className="text-sm font-medium text-slate-800">{student.student_id}</p></div>
              <div><p className="text-xs text-slate-400">Class</p><p className="text-sm font-medium text-slate-800">{className}</p></div>
              <div><p className="text-xs text-slate-400">Gender</p><p className="text-sm font-medium text-slate-800">{student.gender ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Session</p><p className="text-sm font-medium text-slate-800">{session?.name ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Term</p><p className="text-sm font-medium text-slate-800">{term?.name ?? '—'}</p></div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Quick Actions" />
        <CardBody className="space-y-2">
          <Link to="/parent/result" className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-700">
            <Eye className="h-4 w-4 text-blue-600" />
            <span className="flex-1">View Student's Result</span>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
