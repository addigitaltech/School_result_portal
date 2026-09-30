import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { apiForgotPassword } from '@/lib/apiClient';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try { setMessage(await apiForgotPassword(email)); }
    catch (err) { setError((err as Error).message || 'Something went wrong. Please try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5"><Logo size="md" /><h1 className="text-lg font-semibold text-slate-800">Reset your password</h1></div>
        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-500">Enter the email on your admin or teacher account. We'll send a link to reset your password.</p>
            <Field label="Email" required>
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" autoComplete="username" /></div>
            </Field>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} icon={loading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}>{loading ? 'Sending...' : 'Send reset link'}</Button>
          </form>
        )}
        <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
      </div>
    </div>
  );
}
