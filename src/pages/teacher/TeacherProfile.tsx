import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import type { Teacher, Subject, ClassRow } from '@/lib/types';
import { Mail, Phone, BookOpen, School, UserCog } from 'lucide-react';

export function TeacherProfile() {
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.teacher_id) { setLoading(false); return; }
    (async () => {
      const { data: tch } = await api.from('teachers').select('*').eq('id', user.teacher_id).maybeSingle();
      setTeacher(tch as Teacher | null);
      const [s, c] = await Promise.all([
        api.from('subjects').select('*').in('id', tch?.subject_ids ?? []),
        api.from('classes').select('*').in('id', tch?.class_ids ?? []),
      ]);
      setSubjects(s.data ?? []);
      setClasses(c.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!teacher) return <p className="text-slate-500">Teacher profile not found.</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>

      <Card>
        <CardBody>
          <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
            <div className="h-16 w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
              {teacher.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">{teacher.full_name}</p>
              <p className="text-sm text-slate-500 font-mono">{teacher.teacher_id}</p>
              <p className="text-xs text-blue-600 capitalize mt-0.5">{teacher.status}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="h-4 w-4 text-slate-400" /> {teacher.email ?? '—'}</div>
            <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="h-4 w-4 text-slate-400" /> {teacher.phone ?? '—'}</div>
            <div className="flex items-center gap-2 text-sm text-slate-600"><UserCog className="h-4 w-4 text-slate-400" /> {teacher.gender ?? '—'}</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Assigned Subjects" subtitle={`${subjects.length} subjects`} />
        <CardBody className="space-y-2">
          {subjects.length === 0 ? <p className="text-sm text-slate-400">No subjects assigned.</p> : (
            subjects.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <div className="flex-1"><p className="text-sm font-medium text-slate-800">{s.name}</p><p className="text-xs text-slate-400">{s.code}</p></div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Assigned Classes" subtitle={`${classes.length} classes`} />
        <CardBody className="space-y-2">
          {classes.length === 0 ? <p className="text-sm text-slate-400">No classes assigned.</p> : (
            classes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200">
                <School className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-medium text-slate-800">{c.name}</p>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
