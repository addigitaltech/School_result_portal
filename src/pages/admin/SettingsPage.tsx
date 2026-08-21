import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';
import { Logo } from '@/components/Logo';
import type { SchoolSettings, AcademicSession, Term } from '@/lib/types';
import { Save } from 'lucide-react';

export function SettingsPage() {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, se, t] = await Promise.all([
      supabase.from('school_settings').select('*').limit(1).maybeSingle(),
      supabase.from('academic_sessions').select('*').order('name'),
      supabase.from('terms').select('*').order('name'),
    ]);
    setSettings(s.data as SchoolSettings | null);
    setSessions(se.data ?? []);
    setTerms(t.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<SchoolSettings>) => setSettings((prev) => prev ? { ...prev, ...patch } : prev);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error: err } = await supabase.from('school_settings').update({
      school_name: settings.school_name,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      current_session_id: settings.current_session_id,
      current_term_id: settings.current_term_id,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);
    setSaving(false);
    if (err) { error('Failed to save settings.'); return; }
    success('Settings saved successfully.');
  };

  if (loading || !settings) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const availableTerms = terms.filter((t) => t.session_id === settings.current_session_id);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage school information and current academic period.</p>
      </div>

      <Card>
        <CardHeader title="School Information" subtitle="Appears on result sheets and login page" />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-4">
            <Logo size="lg" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">School Logo</p>
              <p className="text-xs text-slate-400 mt-0.5">Logo placeholder is shown on result sheets.</p>
            </div>
          </div>
          <Field label="School Name">
            <Input value={settings.school_name} onChange={(e) => update({ school_name: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={settings.address} onChange={(e) => update({ address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone">
              <Input value={settings.phone} onChange={(e) => update({ phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={settings.email} onChange={(e) => update({ email: e.target.value })} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Current Academic Period" subtitle="Used as the default session and term across the portal" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Current Session">
              <Select value={settings.current_session_id ?? ''} onChange={(e) => update({ current_session_id: e.target.value || null, current_term_id: null })}>
                <option value="">Select session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Current Term">
              <Select value={settings.current_term_id ?? ''} onChange={(e) => update({ current_term_id: e.target.value || null })}>
                <option value="">Select term</option>
                {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button icon={<Save className="h-4 w-4" />} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
      </div>

      {user?.role === 'admin' && (
        <p className="text-xs text-slate-400 text-center">Signed in as administrator. Changes affect all users.</p>
      )}
    </div>
  );
}
