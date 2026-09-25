import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { computeGrade, overallGrade } from '@/lib/grading';
import { fullName } from '@/lib/format';
import { Logo } from '@/components/Logo';
import type { Student, SchoolSettings, AcademicSession, Term, Result, Subject, TermRemark, GradeBand, AffectiveTrait, AffectiveRating } from '@/lib/types';
import { Printer, Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ResultSheetProps {
  student: Student;
  settings: SchoolSettings | null;
  session: AcademicSession | null;
  term: Term | null;
  results: (Result & { subjects?: Subject })[];
  className: string;
}

interface SubjectStat {
  subjectId: string;
  subjectName: string;
  studentScore: number;
  classAverage: number;
  high: number;
  low: number;
  position: number;
  population: number;
}

interface StudentMetric {
  studentId: string;
  average: number;
  armId: string | null;
}

const ratingLabels: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent' };

export function ResultSheet({ student, settings, session, term, results, className }: ResultSheetProps) {
  const [termRemark, setTermRemark] = useState<TermRemark | null>(null);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const [traits, setTraits] = useState<AffectiveTrait[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [armName, setArmName] = useState('');
  const [allResults, setAllResults] = useState<(Result & { subjects?: Subject })[]>([]);
  const [classStudents, setClassStudents] = useState<Pick<Student, 'id' | 'class_id' | 'arm_id'>[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!session?.id || !term?.id) {
      setTermRemark(null);
      setGradeBands([]);
      setTraits([]);
      setRatings({});
      setArmName('');
      setAllResults([]);
      setClassStudents([]);
      setLoadingStats(false);
      return;
    }

    let cancelled = false;
    setLoadingStats(true);
    (async () => {
      const [remarkResponse, bandsResponse, traitsResponse, ratingsResponse, studentsResponse, armResponse] = await Promise.all([
        supabase.from('term_remarks').select('*').eq('student_id', student.id).eq('session_id', session.id).eq('term_id', term.id).maybeSingle(),
        supabase.from('grade_bands').select('*').order('min_score', { ascending: false }),
        supabase.from('affective_traits').select('*').order('name'),
        supabase.from('affective_ratings').select('*').eq('student_id', student.id).eq('session_id', session.id).eq('term_id', term.id),
        student.class_id ? supabase.from('students').select('id, class_id, arm_id').eq('class_id', student.class_id) : Promise.resolve({ data: [] }),
        student.arm_id ? supabase.from('arms').select('name').eq('id', student.arm_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const scopedStudents = (studentsResponse.data ?? []) as Pick<Student, 'id' | 'class_id' | 'arm_id'>[];
      const armStudentIds = scopedStudents.filter((row) => row.arm_id === student.arm_id).map((row) => row.id);
      let scopedResults: (Result & { subjects?: Subject })[] = [];
      if (armStudentIds.length) {
        const { data } = await supabase.from('results').select('*, subjects(*)').in('student_id', armStudentIds).eq('session_id', session.id).eq('term_id', term.id).eq('status', 'Published');
        scopedResults = (data ?? []) as (Result & { subjects?: Subject })[];
      }

      if (cancelled) return;
      setTermRemark(remarkResponse.data as TermRemark | null);
      setGradeBands((bandsResponse.data ?? []) as GradeBand[]);
      setTraits((traitsResponse.data ?? []) as AffectiveTrait[]);
      const ratingMap: Record<string, number> = {};
      (ratingsResponse.data ?? []).forEach((rating: AffectiveRating) => { ratingMap[rating.trait_id] = rating.rating; });
      setRatings(ratingMap);
      setArmName((armResponse.data as { name?: string } | null)?.name ?? '');
      setClassStudents(scopedStudents);
      setAllResults(scopedResults);
      setLoadingStats(false);
    })();

    return () => { cancelled = true; };
  }, [student.id, student.class_id, session?.id, term?.id]);

  const offeredResults = results.filter((result) => result.is_offered !== false);
  const totalMax = (settings?.ca1_max_score ?? 40) + (settings?.ca2_max_score ?? 0) + (settings?.ca3_max_score ?? 0) + (settings?.exam_max_score ?? 60);
  const caMax = (settings?.ca1_max_score ?? 40) + (settings?.ca2_max_score ?? 0) + (settings?.ca3_max_score ?? 0);
  const examMax = settings?.exam_max_score ?? 60;
  const passPercentage = settings?.pass_percentage ?? 40;
  const totalScore = offeredResults.reduce((sum, result) => sum + result.total_score, 0);
  const averageScore = offeredResults.length > 0 ? Math.round(totalScore / offeredResults.length) : 0;
  const { grade: overallG, remark: overallR } = overallGrade(averageScore, gradeBands);

  const passScore = (score: number) => totalMax > 0 ? (score / totalMax) * 100 : score;
  const passedResults = offeredResults.filter((result) => passScore(result.total_score) >= passPercentage);
  const failedResults = offeredResults.filter((result) => passScore(result.total_score) < passPercentage);

  const subjectStats = useMemo<SubjectStat[]>(() => {
    const bySubject = new Map<string, (Result & { subjects?: Subject })[]>();
    allResults.filter((result) => result.is_offered !== false).forEach((result) => {
      const list = bySubject.get(result.subject_id) ?? [];
      list.push(result);
      bySubject.set(result.subject_id, list);
    });
    return offeredResults.map((result) => {
      const population = bySubject.get(result.subject_id) ?? [];
      const scores = population.map((item) => item.total_score);
      const higherScores = scores.filter((score) => score > result.total_score).length;
      return {
        subjectId: result.subject_id,
        subjectName: result.subjects?.name ?? population[0]?.subjects?.name ?? 'Subject',
        studentScore: result.total_score,
        classAverage: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
        high: scores.length ? Math.max(...scores) : 0,
        low: scores.length ? Math.min(...scores) : 0,
        position: higherScores + 1,
        population: scores.length,
      };
    });
  }, [allResults, offeredResults]);

  const studentMetrics = useMemo<StudentMetric[]>(() => {
    const byStudent = new Map<string, { scores: number[]; armId: string | null }>();
    allResults.filter((result) => result.is_offered !== false).forEach((result) => {
      const classStudent = classStudents.find((item) => item.id === result.student_id);
      const metric = byStudent.get(result.student_id) ?? { scores: [], armId: classStudent?.arm_id ?? null };
      metric.scores.push(result.total_score);
      byStudent.set(result.student_id, metric);
    });
    return [...byStudent.entries()].map(([studentId, metric]) => ({ studentId, armId: metric.armId, average: metric.scores.reduce((sum, score) => sum + score, 0) / metric.scores.length }));
  }, [allResults, classStudents]);

  const currentMetric = studentMetrics.find((metric) => metric.studentId === student.id);
  const classPosition = currentMetric ? studentMetrics.filter((metric) => metric.average > currentMetric.average).length + 1 : null;
  const armMetrics = studentMetrics.filter((metric) => metric.armId === student.arm_id);
  const armPosition = currentMetric && student.arm_id ? armMetrics.filter((metric) => metric.average > currentMetric.average).length + 1 : null;
  const classStudentCount = classStudents.length;
  const armStudentCount = student.arm_id ? classStudents.filter((item) => item.arm_id === student.arm_id).length : 0;
  const chartData = subjectStats.map((stat) => ({ subject: stat.subjectName.length > 16 ? `${stat.subjectName.slice(0, 14)}…` : stat.subjectName, 'Student Score': stat.studentScore, 'Class Average': stat.classAverage }));

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"><Printer className="h-4 w-4" /> Print Result</button>
        <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"><Download className="h-4 w-4" /> Download</button>
      </div>

      <div className="print-area bg-white border border-slate-300 rounded-lg p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-800">
          <Logo size="lg" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-slate-900">{settings?.school_name ?? 'School Results Portal'}</h1>
            {settings?.motto && <p className="text-sm font-semibold italic text-blue-700">{settings.motto}</p>}
            <p className="text-sm text-slate-600">{settings?.address ?? '—'}</p>
            <p className="text-sm text-slate-600">Tel: {settings?.phone ?? '—'} | Email: {settings?.email ?? '—'}</p>
          </div>
          <div className="w-14" />
        </div>

        <h2 className="text-center text-lg font-bold uppercase tracking-wide text-slate-800 my-4">Student Academic Result</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4 bg-slate-50 p-4 rounded-lg">
          <div><span className="text-slate-500">Student Name:</span> <span className="font-semibold text-slate-800">{fullName(student)}</span></div>
          <div><span className="text-slate-500">Student ID:</span> <span className="font-semibold text-slate-800">{student.student_id}</span></div>
          <div><span className="text-slate-500">Class:</span> <span className="font-semibold text-slate-800">{className}</span></div>
          <div><span className="text-slate-500">Session:</span> <span className="font-semibold text-slate-800">{session?.name ?? '—'}</span></div>
          <div><span className="text-slate-500">Term:</span> <span className="font-semibold text-slate-800">{term?.name ?? '—'}</span></div>
          <div><span className="text-slate-500">Gender:</span> <span className="font-semibold text-slate-800">{student.gender ?? '—'}</span></div>
          <div><span className="text-slate-500">Arm:</span> <span className="font-semibold text-slate-800">{armName || '—'}</span></div>
        </div>

        <table className="w-full text-sm border border-slate-300 mb-4">
          <thead className="bg-slate-800 text-white text-xs uppercase"><tr><th className="text-left px-3 py-2 border border-slate-400">Subject</th><th className="text-center px-3 py-2 border border-slate-400">CA ({caMax})</th><th className="text-center px-3 py-2 border border-slate-400">Exam ({examMax})</th><th className="text-center px-3 py-2 border border-slate-400">Total ({totalMax})</th><th className="text-center px-3 py-2 border border-slate-400">Grade</th><th className="text-left px-3 py-2 border border-slate-400">Remark</th></tr></thead>
          <tbody>{offeredResults.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400 border border-slate-300">No published results available for this term.</td></tr> : offeredResults.map((result) => <tr key={result.id} className="even:bg-slate-50"><td className="px-3 py-2 border border-slate-300 font-medium text-slate-800">{result.subjects?.name ?? '—'}</td><td className="px-3 py-2 border border-slate-300 text-center text-slate-700">{result.ca1_score + result.ca2_score + result.ca3_score}</td><td className="px-3 py-2 border border-slate-300 text-center text-slate-700">{result.exam_score}</td><td className="px-3 py-2 border border-slate-300 text-center font-semibold text-slate-900">{result.total_score}</td><td className="px-3 py-2 border border-slate-300 text-center font-bold text-blue-700">{result.grade ?? computeGrade(result.total_score, gradeBands).grade}</td><td className="px-3 py-2 border border-slate-300 text-slate-600">{result.remark ?? computeGrade(result.total_score, gradeBands).remark}</td></tr>)}</tbody>
        </table>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Total Score</p><p className="text-xl font-bold text-slate-800">{totalScore}</p></div>
          <div className="bg-emerald-50 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Average Score</p><p className="text-xl font-bold text-slate-800">{averageScore}</p></div>
          <div className="bg-amber-50 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Overall Grade</p><p className="text-xl font-bold text-blue-700">{overallG}</p></div>
          <div className="bg-slate-100 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Overall Remark</p><p className="text-sm font-semibold text-slate-800">{overallR}</p></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="border border-slate-200 rounded-lg p-3"><p className="text-slate-500 text-xs">Class Term Position</p><p className="font-semibold text-slate-800">{loadingStats ? 'Loading…' : classPosition ? `${classPosition} / ${studentMetrics.length}` : '—'}</p></div>
          <div className="border border-slate-200 rounded-lg p-3"><p className="text-slate-500 text-xs">Arm Position</p><p className="font-semibold text-slate-800">{loadingStats ? 'Loading…' : armPosition ? `${armPosition} / ${armMetrics.length}` : '—'}</p></div>
          <div className="border border-slate-200 rounded-lg p-3"><p className="text-slate-500 text-xs">Total Students</p><p className="font-semibold text-slate-800">{classStudentCount} / {armStudentCount || '—'} (class / arm)</p></div>
          <div className="border border-slate-200 rounded-lg p-3"><p className="text-slate-500 text-xs">Pass Percentage</p><p className="font-semibold text-slate-800">{offeredResults.length ? `${Math.round((passedResults.length / offeredResults.length) * 100)}%` : '—'}</p></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Subjects Offered</p><p className="font-semibold text-slate-800">{offeredResults.length}</p></div>
          <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-slate-500">Subjects Passed</p><p className="font-semibold text-emerald-700">{passedResults.length}</p></div>
          <div className="bg-rose-50 rounded-lg p-3"><p className="text-xs text-slate-500">Subjects Failed</p><p className="font-semibold text-rose-700">{failedResults.length}</p></div>
          <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-slate-500">Average Term Score</p><p className="font-semibold text-blue-700">{averageScore}</p></div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-slate-800 mb-2">Subject Performance</h3>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 36 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 10 }} /><YAxis domain={[0, totalMax]} tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Student Score" fill="#2563eb" /><Bar dataKey="Class Average" fill="#94a3b8" /></BarChart></ResponsiveContainer></div>
        </div>

        <table className="w-full text-xs border border-slate-300 mb-4"><thead className="bg-slate-100"><tr><th className="text-left px-2 py-2 border border-slate-300">Subject</th><th className="px-2 py-2 border border-slate-300">Student</th><th className="px-2 py-2 border border-slate-300">Class Avg</th><th className="px-2 py-2 border border-slate-300">High</th><th className="px-2 py-2 border border-slate-300">Low</th><th className="px-2 py-2 border border-slate-300">Position</th></tr></thead><tbody>{subjectStats.map((stat) => <tr key={stat.subjectId}><td className="px-2 py-1.5 border border-slate-300">{stat.subjectName}</td><td className="text-center px-2 py-1.5 border border-slate-300">{stat.studentScore}</td><td className="text-center px-2 py-1.5 border border-slate-300">{stat.classAverage}</td><td className="text-center px-2 py-1.5 border border-slate-300">{stat.high}</td><td className="text-center px-2 py-1.5 border border-slate-300">{stat.low}</td><td className="text-center px-2 py-1.5 border border-slate-300">{stat.position} / {stat.population}</td></tr>)}</tbody></table>

        <div className="border border-slate-200 rounded-lg p-4 mb-4"><h3 className="font-semibold text-slate-800 mb-3">Affective / Psychomotor Assessment</h3><div className="overflow-x-auto"><table className="w-full text-xs border border-slate-300"><thead className="bg-slate-100"><tr><th className="text-left px-2 py-2 border border-slate-300">Trait</th><th className="px-2 py-2 border border-slate-300">Rating</th><th className="text-left px-2 py-2 border border-slate-300">Description</th></tr></thead><tbody>{traits.length ? traits.map((trait) => <tr key={trait.id}><td className="px-2 py-1.5 border border-slate-300">{trait.name}</td><td className="text-center px-2 py-1.5 border border-slate-300">{ratings[trait.id] ?? '—'} / 5</td><td className="px-2 py-1.5 border border-slate-300">{ratings[trait.id] ? ratingLabels[ratings[trait.id]] : 'Not rated'}</td></tr>) : <tr><td colSpan={3} className="px-2 py-3 text-center text-slate-400">No affective traits configured.</td></tr>}</tbody></table></div></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div className="border border-slate-200 rounded-lg p-3 min-h-[80px]"><p className="text-slate-500 text-xs font-medium mb-1">Teacher's Comment</p><p className="text-slate-700 italic">{termRemark?.teacher_remark || 'No teacher remark recorded.'}</p></div><div className="border border-slate-200 rounded-lg p-3 min-h-[80px]"><p className="text-slate-500 text-xs font-medium mb-1">Principal's Comment</p><p className="text-slate-700 italic">{termRemark?.principal_remark || 'No principal remark recorded.'}</p></div></div>
        <p className="text-center text-xs text-slate-400 mt-6">© 2026 DevCore 7-Innovators. School Results Portal.</p>
      </div>
    </div>
  );
}
