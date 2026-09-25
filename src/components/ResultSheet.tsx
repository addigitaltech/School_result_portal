import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { computeGrade, overallGrade } from '@/lib/grading';
import { fullName } from '@/lib/format';
import { Logo } from '@/components/Logo';
import type { Student, SchoolSettings, AcademicSession, Term, Result, Subject, TermRemark, GradeBand } from '@/lib/types';
import { Printer, Download } from 'lucide-react';

interface ResultSheetProps {
  student: Student;
  settings: SchoolSettings | null;
  session: AcademicSession | null;
  term: Term | null;
  results: (Result & { subjects?: Subject })[];
  className: string;
}

export function ResultSheet({ student, settings, session, term, results, className }: ResultSheetProps) {
  const [termRemark, setTermRemark] = useState<TermRemark | null>(null);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const handlePrint = () => window.print();

  useEffect(() => {
    if (!session?.id || !term?.id) { setTermRemark(null); return; }
    (async () => {
      const [remarkResponse, bandsResponse] = await Promise.all([
        supabase.from('term_remarks').select('*').eq('student_id', student.id).eq('session_id', session.id).eq('term_id', term.id).maybeSingle(),
        supabase.from('grade_bands').select('*').order('min_score', { ascending: false }),
      ]);
      setTermRemark(remarkResponse.data as TermRemark | null);
      setGradeBands((bandsResponse.data ?? []) as GradeBand[]);
    })();
  }, [student.id, session?.id, term?.id]);

  const offeredResults = results.filter((result) => result.is_offered !== false);
  const totalScore = offeredResults.reduce((sum, r) => sum + r.total_score, 0);
  const avg = offeredResults.length > 0 ? Math.round(totalScore / offeredResults.length) : 0;
  const { grade: overallG, remark: overallR } = overallGrade(avg, gradeBands);
  const caMax = (settings?.ca1_max_score ?? 40) + (settings?.ca2_max_score ?? 0) + (settings?.ca3_max_score ?? 0);
  const examMax = settings?.exam_max_score ?? 60;

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
          <Printer className="h-4 w-4" /> Print Result
        </button>
        <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
          <Download className="h-4 w-4" /> Download
        </button>
      </div>

      <div className="print-area bg-white border border-slate-300 rounded-lg p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-800">
          <Logo size="lg" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-slate-900">{settings?.school_name ?? 'School Results Portal'}</h1>
            <p className="text-sm text-slate-600">{settings?.address ?? '—'}</p>
            <p className="text-sm text-slate-600">Tel: {settings?.phone ?? '—'} | Email: {settings?.email ?? '—'}</p>
          </div>
          <div className="w-14" />
        </div>

        <h2 className="text-center text-lg font-bold uppercase tracking-wide text-slate-800 my-4">
          Student Academic Result
        </h2>

        {/* Student info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4 bg-slate-50 p-4 rounded-lg">
          <div><span className="text-slate-500">Student Name:</span> <span className="font-semibold text-slate-800">{fullName(student)}</span></div>
          <div><span className="text-slate-500">Student ID:</span> <span className="font-semibold text-slate-800">{student.student_id}</span></div>
          <div><span className="text-slate-500">Class:</span> <span className="font-semibold text-slate-800">{className}</span></div>
          <div><span className="text-slate-500">Session:</span> <span className="font-semibold text-slate-800">{session?.name ?? '—'}</span></div>
          <div><span className="text-slate-500">Term:</span> <span className="font-semibold text-slate-800">{term?.name ?? '—'}</span></div>
          <div><span className="text-slate-500">Gender:</span> <span className="font-semibold text-slate-800">{student.gender ?? '—'}</span></div>
        </div>

        {/* Results table */}
        <table className="w-full text-sm border border-slate-300 mb-4">
          <thead className="bg-slate-800 text-white text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2 border border-slate-400">Subject</th>
              <th className="text-center px-3 py-2 border border-slate-400">CA ({caMax})</th>
              <th className="text-center px-3 py-2 border border-slate-400">Exam ({examMax})</th>
              <th className="text-center px-3 py-2 border border-slate-400">Total (100)</th>
              <th className="text-center px-3 py-2 border border-slate-400">Grade</th>
              <th className="text-left px-3 py-2 border border-slate-400">Remark</th>
            </tr>
          </thead>
          <tbody>
            {offeredResults.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400 border border-slate-300">No published results available for this term.</td></tr>
            ) : offeredResults.map((r) => (
              <tr key={r.id} className="even:bg-slate-50">
                <td className="px-3 py-2 border border-slate-300 font-medium text-slate-800">{r.subjects?.name ?? '—'}</td>
                <td className="px-3 py-2 border border-slate-300 text-center text-slate-700">{r.ca1_score + r.ca2_score + r.ca3_score}</td>
                <td className="px-3 py-2 border border-slate-300 text-center text-slate-700">{r.exam_score}</td>
                <td className="px-3 py-2 border border-slate-300 text-center font-semibold text-slate-900">{r.total_score}</td>
                <td className="px-3 py-2 border border-slate-300 text-center font-bold text-blue-700">{r.grade ?? computeGrade(r.total_score, gradeBands).grade}</td>
                <td className="px-3 py-2 border border-slate-300 text-slate-600">{r.remark ?? computeGrade(r.total_score, gradeBands).remark}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-xs text-slate-500">Total Score</p>
            <p className="text-xl font-bold text-slate-800">{totalScore}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg text-center">
            <p className="text-xs text-slate-500">Average Score</p>
            <p className="text-xl font-bold text-slate-800">{avg}</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg text-center">
            <p className="text-xs text-slate-500">Overall Grade</p>
            <p className="text-xl font-bold text-blue-700">{overallG}</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-lg text-center">
            <p className="text-xs text-slate-500">Overall Remark</p>
            <p className="text-sm font-semibold text-slate-800">{overallR}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Class Position</p>
            <p className="font-semibold text-slate-800">—</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Number of Students</p>
            <p className="font-semibold text-slate-800">—</p>
          </div>
        </div>

        {/* Comments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="border border-slate-200 rounded-lg p-3 min-h-[80px]">
            <p className="text-slate-500 text-xs font-medium mb-1">Teacher's Comment</p>
            <p className="text-slate-700 italic">{termRemark?.teacher_remark || 'No teacher remark recorded.'}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 min-h-[80px]">
            <p className="text-slate-500 text-xs font-medium mb-1">Principal's Comment</p>
            <p className="text-slate-700 italic">{termRemark?.principal_remark || 'No principal remark recorded.'}</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© 2026 DevCore 7-Innovators. School Results Portal.</p>
      </div>
    </div>
  );
}
