import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { fullName, formatDate } from '@/lib/format';
import type { Student, ClassRow } from '@/lib/types';
import { Mail, Phone, Calendar, User, BookOpen } from 'lucide-react';

export function StudentProfile() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.student_id) { setLoading(false); return; }
    (async () => {
      const { data: stu } = await supabase.from('students').select('*').eq('id', user.student_id).maybeSingle();
      setStudent(stu as Student | null);
      if (stu?.class_id) {
        const { data: cls } = await supabase.from('classes').select('name').eq('id', stu.class_id).maybeSingle();
        setClassName(cls?.name ?? '—');
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!student) return <p className="text-slate-500">Student profile not found.</p>;

  const rows: [string, string | null][] = [
    ['Student ID', student.student_id],
    ['First Name', student.first_name],
    ['Last Name', student.last_name],
    ['Other Name', student.other_name || '—'],
    ['Gender', student.gender],
    ['Date of Birth', formatDate(student.date_of_birth)],
    ['Class', className],
    ['Parent/Guardian', student.parent_guardian],
    ['Parent Phone', student.parent_phone],
    ['Email', student.email],
    ['Admission Date', formatDate(student.admission_date)],
    ['Status', student.status],
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>

      <Card>
        <CardBody>
          <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
            <div className="h-16 w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
              {student.first_name.charAt(0)}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">{fullName(student)}</p>
              <p className="text-sm text-slate-500 font-mono">{student.student_id}</p>
              <p className="text-xs text-blue-600 mt-0.5">{className}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <span className="text-xs text-slate-400 w-32 flex-shrink-0 pt-0.5">{k}</span>
                <span className="text-sm text-slate-700 font-medium">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
