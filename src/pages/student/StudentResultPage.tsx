import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { apiReportCard } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { ResultSheet } from '@/components/ResultSheet';
import type { Student, ClassRow, AcademicSession, Term, Result, Subject, SchoolSettings } from '@/lib/types';
import { ClipboardList } from 'lucide-react';

export function StudentResultPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState('—');
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [results, setResults] = useState<(Result & { subjects?: Subject })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!user?.student_id) { setLoading(false); return; }
    (async () => {
      const { data: stu } = await api.from('students').select('*').eq('id', user.student_id).maybeSingle();
      setStudent(stu as Student | null);
      if (stu?.class_id) {
        const { data: cls } = await api.from('classes').select('name').eq('id', stu.class_id).maybeSingle();
        setClassName(cls?.name ?? '—');
      }
      const { data: s } = await api.from('school_settings').select('*').limit(1).maybeSingle();
      setSettings(s as SchoolSettings | null);
      const { data: sess } = await api.from('academic_sessions').select('*').order('name');
      setSessions(sess ?? []);
      const { data: t } = await api.from('terms').select('*').order('name');
      setTerms(t ?? []);
      // default to current
      if (s?.current_session_id) setSelectedSession(s.current_session_id);
      if (s?.current_term_id) setSelectedTerm(s.current_term_id);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedSession || !selectedTerm || !user?.student_id) { setResults([]); return; }
    setLoadingResults(true);
    (async () => {
      const data = await apiReportCard<(Result & { subjects?: Subject })>(user.student_id!, selectedSession, selectedTerm);
      setResults(data);
      setLoadingResults(false);
    })();
  }, [selectedSession, selectedTerm, user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!student) return <p className="text-slate-500">Student profile not found.</p>;

  const availableTerms = selectedSession ? terms.filter((t) => t.session_id === selectedSession) : terms;
  const sessionObj = sessions.find((s) => s.id === selectedSession) ?? null;
  const termObj = availableTerms.find((t) => t.id === selectedTerm) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">My Result</h2>
        <p className="text-sm text-slate-500 mt-1">Select a session and term to view your published results.</p>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Academic Session</span>
              <Select value={selectedSession} onChange={(e) => { setSelectedSession(e.target.value); setSelectedTerm(''); }}>
                <option value="">Select session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Term</span>
              <Select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled={!selectedSession}>
                <option value="">Select term</option>
                {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </label>
          </div>
        </CardBody>
      </Card>

      {loadingResults ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : !selectedSession || !selectedTerm ? (
        <Card><EmptyState icon={<ClipboardList className="h-12 w-12" />} title="Select a session and term" description="Choose a session and term to view your results." /></Card>
      ) : results.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList className="h-12 w-12" />} title="No published results" description="Your results for this term have not been published yet. Please check back later." /></Card>
      ) : (
        <ResultSheet student={student} settings={settings} session={sessionObj} term={termObj} results={results} className={className} />
      )}
    </div>
  );
}
