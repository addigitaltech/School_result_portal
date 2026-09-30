import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { apiResetPassword } from '@/lib/apiClient';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try { setMessage(await apiResetPassword(token, password)); setTimeout(() => navigate('/login'), 1800); }
    catch (err) { setError((err as Error).message || 'This reset link is invalid or has expired.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5"><Logo size="md" /><h1 className="text-lg font-semibold text-slate-800">Choose a new password</h1></div>
        {!token ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">This link is missing a reset token. Please use the link from your email.</p>
        ) : message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message} Redirecting to sign in…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="New Password" required>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" autoComplete="new-password" /></div>
            </Field>
            <Field label="Confirm Password" required>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" autoComplete="new-password" /></div>
            </Field>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Saving...' : 'Reset password'}</Button>
          </form>
        )}
        <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
      </div>
    </div>
  );
}
