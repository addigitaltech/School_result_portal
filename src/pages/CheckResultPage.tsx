import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Lock, User, LogIn, ArrowLeft, Printer } from 'lucide-react';
import { apiCheckerReport, apiCheckerVerify, apiPublicSettings, type CheckerInfo, type PublicAppSettings, type ReportBundle } from '@/lib/apiClient';
import { Logo } from '@/components/Logo';
import { ResultSheet } from '@/components/ResultSheet';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';

/** Public result checker: a student enters their surname (username) and the token given by the school. No account or password. */
export function CheckResultPage() {
  const [surname, setSurname] = useState('');
  const [token, setToken] = useState('');
  const [info, setInfo] = useState<CheckerInfo | null>(null);
  const [periodKey, setPeriodKey] = useState('');
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicSettings, setPublicSettings] = useState<PublicAppSettings | null>(null);
  const [checkingMode, setCheckingMode] = useState(true);

  useEffect(() => { apiPublicSettings().then(setPublicSettings).catch(() => setPublicSettings(null)).finally(() => setCheckingMode(false)); }, []);
  const tokenCheckerEnabled = !publicSettings || publicSettings.result_access_mode === 'token' || publicSettings.result_access_mode === 'both';

  const currentKey = info?.school?.current_session_id && info.school.current_term_id ? `${info.school.current_session_id}|${info.school.current_term_id}` : '';

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!surname.trim() || !token.trim()) { setError('Enter the student surname and the result token.'); return; }
    setLoading(true);
    try {
      const data = await apiCheckerVerify(surname, token);
      setInfo(data);
      const keys = data.periods.map((period) => `${period.session_id}|${period.term_id}`);
      const preferred = data.school?.current_session_id && data.school.current_term_id ? `${data.school.current_session_id}|${data.school.current_term_id}` : '';
      setPeriodKey(keys.includes(preferred) ? preferred : keys[0] ?? '');
      setBundle(null);
    } catch (err) { setError((err as Error).message); }
    setLoading(false);
  };

  const viewResult = async () => {
    if (!periodKey) return;
    const [sessionId, termId] = periodKey.split('|');
    setError('');
    setLoading(true);
    try { setBundle(await apiCheckerReport(surname, token, sessionId, termId)); }
    catch (err) { setError((err as Error).message); }
    setLoading(false);
  };

  const reset = () => { setInfo(null); setBundle(null); setToken(''); setError(''); };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-700 to-slate-900 text-white no-print">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {info?.school?.logo_url ? <img src={info.school.logo_url} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-0.5" /> : <Logo size="md" />}
            <div><p className="font-bold leading-tight">{info?.school?.school_name ?? 'School Results Portal'}</p><p className="text-xs text-blue-200">Online Result Checker</p></div>
          </div>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white"><LogIn className="h-4 w-4" /> Staff login</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {checkingMode ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !tokenCheckerEnabled ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold text-slate-800">Online result checking is not available</h1>
            <p className="text-sm text-slate-500">This school uses the student and parent portal instead. Please sign in there, or contact the school office.</p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"><LogIn className="h-4 w-4" /> Go to sign in</Link>
          </div>
        ) : (<>
        {!info && (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1"><Search className="h-5 w-5 text-blue-700" /><h1 className="text-xl font-semibold text-slate-800">Check your result</h1></div>
            <p className="text-sm text-slate-500 mb-5">Enter your surname as your username, and the result token given to you by the school.</p>
            <form onSubmit={verify} className="space-y-4">
              <Field label="Username (Surname)" required>
                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="e.g. ADEBAYO" className="pl-9 uppercase" autoComplete="off" /></div>
              </Field>
              <Field label="Result Token" required>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="XXXX-XXXX-XXXX" className="pl-9 font-mono uppercase" autoComplete="off" /></div>
              </Field>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading} icon={loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}>{loading ? 'Checking...' : 'Continue'}</Button>
            </form>
          </div>
        )}

        {info && !bundle && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-4">
              {info.student.photo_url ? <img src={info.student.photo_url} alt="" className="h-16 w-16 rounded-full object-cover border border-slate-200" /> : <div className="h-16 w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-semibold">{info.student.first_name.charAt(0)}</div>}
              <div><p className="font-semibold text-slate-800">{fullName(info.student)}</p><p className="text-sm text-slate-500">{info.student.class_name ?? '—'}{info.student.arm_name ? ` (${info.student.arm_name})` : ''} · {info.student.student_id}</p></div>
            </div>
            {info.periods.length === 0 ? (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">No published results are available for this student yet. Please check back later.</p>
            ) : (
              <>
                <Field label="Session and term" hint={currentKey && periodKey === currentKey ? 'Showing the current term. Choose another to view past results.' : undefined}>
                  <Select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
                    {info.periods.map((period) => <option key={`${period.session_id}|${period.term_id}`} value={`${period.session_id}|${period.term_id}`}>{period.session_name} — {period.term_name}</option>)}
                  </Select>
                </Field>
                {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <Button onClick={viewResult} disabled={loading || !periodKey} className="w-full" icon={loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}>{loading ? 'Loading...' : 'View result'}</Button>
              </>
            )}
            <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Check a different student</button>
          </div>
        )}

        {info && bundle && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 no-print">
              <button onClick={() => setBundle(null)} className="text-sm text-slate-600 hover:text-slate-800 inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Choose another term</button>
              <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print result</Button>
            </div>
            <ResultSheet student={bundle.student} settings={bundle.settings} session={bundle.session} term={bundle.term} results={bundle.results} className={bundle.className} bundle={bundle} />
          </div>
        )}
      </>)}
      </main>
    </div>
  );
}
