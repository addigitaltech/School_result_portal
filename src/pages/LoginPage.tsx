import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Lock, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiPublicSettings, type PublicAppSettings } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function LoginPage() {
  const { login } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [publicSettings, setPublicSettings] = useState<PublicAppSettings | null>(null);

  useEffect(() => { apiPublicSettings().then(setPublicSettings).catch(() => setPublicSettings(null)); }, []);
  const checkerEnabled = publicSettings?.result_access_mode === 'token' || publicSettings?.result_access_mode === 'both';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!email.trim() || !password) {
      setErr('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setErr(result.error ?? 'Login failed.');
      toastError(result.error ?? 'Login failed.');
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-8">
            <Logo size="lg" />
            <div>
              <h1 className="text-2xl font-bold">School Results Portal</h1>
              <p className="text-blue-200 text-sm">A Web-Based Academic Result Management System</p>
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
            Manage student results with clarity and confidence.
          </h2>
          <p className="text-blue-100 text-base lg:text-lg max-w-md">
            A complete platform for administrators, teachers, students and parents to handle academic results end-to-end.
          </p>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-4 max-w-md">
          {['Role-based access', 'Automated grading', 'Printable result sheets', 'Secure & responsive'].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" /> {f}
            </div>
          ))}
        </div>
        <p className="relative text-xs text-blue-200 mt-8">© 2026 DevCore 7-Innovators. School Results Portal.</p>
      </div>

      {/* Right login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <Logo size="md" />
            <h1 className="text-xl font-bold text-slate-800">School Results Portal</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-6">Sign in to access your dashboard.</p>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Email or Student ID" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu.ng or STU001"
                    className="pl-9"
                    autoComplete="username"
                  />
                </div>
              </Field>

              <Field label="Password" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {err && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">Forgot password?</Link>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting} icon={<LogIn className="h-4 w-4" />}>
                {submitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {checkerEnabled && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p className="text-sm text-slate-500 mb-2">Student or parent checking a result?</p>
                <Link to="/check-result" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"><Search className="h-4 w-4" /> Check result with surname &amp; token</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
