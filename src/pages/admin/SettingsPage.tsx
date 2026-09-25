import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';
import { Logo } from '@/components/Logo';
import type { SchoolSettings, AcademicSession, Term, GradeBand } from '@/lib/types';
import { ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react';

interface EditableGradeBand extends GradeBand {
  clientId: string;
}

const makeClientId = () => `band-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function SettingsPage() {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [gradeBands, setGradeBands] = useState<EditableGradeBand[]>([]);
  const [deletedBandIds, setDeletedBandIds] = useState<string[]>([]);
  const [gradeBandError, setGradeBandError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, se, t, bands] = await Promise.all([
      supabase.from('school_settings').select('*').limit(1).maybeSingle(),
      supabase.from('academic_sessions').select('*').order('name'),
      supabase.from('terms').select('*').order('name'),
      supabase.from('grade_bands').select('*').order('min_score'),
    ]);
    setSettings(s.data as SchoolSettings | null);
    setSessions(se.data ?? []);
    setTerms(t.data ?? []);
    setGradeBands((bands.data ?? []).map((band) => ({ ...(band as GradeBand), clientId: band.id ?? makeClientId() })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<SchoolSettings>) => setSettings((prev) => prev ? { ...prev, ...patch } : prev);

  const updateBand = (clientId: string, patch: Partial<GradeBand>) => {
    setGradeBands((prev) => prev.map((band) => band.clientId === clientId ? { ...band, ...patch } : band));
    setGradeBandError('');
  };

  const addBand = () => {
    setGradeBands((prev) => [...prev, { clientId: makeClientId(), min_score: 0, max_score: 0, grade: '', remark: '' }]);
    setGradeBandError('');
  };

  const removeBand = (band: EditableGradeBand) => {
    if (band.id) setDeletedBandIds((prev) => [...prev, band.id as string]);
    setGradeBands((prev) => prev.filter((item) => item.clientId !== band.clientId));
    setGradeBandError('');
  };

  const validateGradeBands = () => {
    if (gradeBands.length === 0) return 'Add at least one grade band.';
    const sorted = [...gradeBands].sort((a, b) => a.min_score - b.min_score || a.max_score - b.max_score);
    const grades = new Set<string>();
    for (const band of sorted) {
      if (!Number.isInteger(band.min_score) || !Number.isInteger(band.max_score) || band.min_score < 0 || band.max_score > 100 || band.min_score > band.max_score) {
        return `Invalid range for grade ${band.grade || '(unnamed)'}. Scores must be whole numbers from 0 to 100, with minimum no greater than maximum.`;
      }
      if (!band.grade.trim() || !band.remark.trim()) return 'Every grade band needs a grade and remark.';
      if (grades.has(band.grade.trim().toUpperCase())) return `Duplicate grade “${band.grade}”.`;
      grades.add(band.grade.trim().toUpperCase());
    }
    if (sorted[0].min_score !== 0) return 'Grade bands must start at 0 to provide full 0–100 coverage.';
    if (sorted[sorted.length - 1].max_score !== 100) return 'Grade bands must end at 100 to provide full 0–100 coverage.';
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].min_score <= sorted[index - 1].max_score) return `Grade bands overlap between ${sorted[index - 1].grade} and ${sorted[index].grade}.`;
      if (sorted[index].min_score !== sorted[index - 1].max_score + 1) return `There is a coverage gap between ${sorted[index - 1].grade} and ${sorted[index].grade}.`;
    }
    return '';
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;
    if (!file.type.startsWith('image/')) { error('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { error('Logo images must be 2 MB or smaller.'); return; }
    setUploadingLogo(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `school-logos/${settings.id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setUploadingLogo(false); error(`Logo upload failed: ${uploadError.message}`); return; }
    const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
    update({ logo_url: data.publicUrl });
    setUploadingLogo(false);
    success('Logo uploaded. Save Settings to keep the new logo URL.');
  };

  const save = async () => {
    if (!settings) return;
    const bandError = validateGradeBands();
    if (bandError) { setGradeBandError(bandError); error(bandError); return; }
    if (settings.pass_percentage < 0 || settings.pass_percentage > 100) { error('Pass percentage must be between 0 and 100.'); return; }
    const maxima = [settings.ca1_max_score, settings.ca2_max_score, settings.ca3_max_score, settings.exam_max_score];
    if (maxima.some((value) => !Number.isInteger(value) || value < 0) || maxima.reduce((sum, value) => sum + value, 0) <= 0) { error('Assessment maximums must be whole numbers, non-negative, and have a total greater than zero.'); return; }

    setSaving(true);
    const settingsResponse = await supabase.from('school_settings').update({
      school_name: settings.school_name, address: settings.address, phone: settings.phone, email: settings.email, logo_url: settings.logo_url,
      motto: settings.motto, pass_percentage: settings.pass_percentage, ca1_max_score: settings.ca1_max_score, ca2_max_score: settings.ca2_max_score,
      ca3_max_score: settings.ca3_max_score, exam_max_score: settings.exam_max_score, current_session_id: settings.current_session_id, current_term_id: settings.current_term_id,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);
    if (settingsResponse.error) { setSaving(false); error(`Failed to save school settings: ${settingsResponse.error.message}`); return; }

    if (deletedBandIds.length) {
      const deletion = await supabase.from('grade_bands').delete().in('id', deletedBandIds);
      if (deletion.error) { setSaving(false); error(`Failed to delete grade bands: ${deletion.error.message}`); return; }
    }
    const bandPayload = gradeBands.map(({ clientId, ...band }) => ({ ...(band.id ? { id: band.id } : {}), min_score: band.min_score, max_score: band.max_score, grade: band.grade.trim(), remark: band.remark.trim() }));
    const bandsResponse = await supabase.from('grade_bands').upsert(bandPayload);
    setSaving(false);
    if (bandsResponse.error) { error(`Failed to save grade bands: ${bandsResponse.error.message}`); return; }
    setDeletedBandIds([]);
    setGradeBandError('');
    success('Settings and grade bands saved successfully.');
  };

  if (loading || !settings) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  const availableTerms = terms.filter((term) => term.session_id === settings.current_session_id);

  return (
    <div className="space-y-4 max-w-4xl">
      <div><h2 className="text-2xl font-bold text-slate-800">Settings</h2><p className="text-sm text-slate-500 mt-1">Manage school information, grading, assessment maximums, and the current academic period.</p></div>

      <Card><CardHeader title="School Information" subtitle="Appears on result sheets and the school portal" /><CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-4"><div className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">{settings.logo_url ? <img src={settings.logo_url} alt="School logo preview" className="h-full w-full object-contain" /> : <Logo size="lg" />}</div><div className="flex-1"><p className="text-sm font-medium text-slate-700">School Logo</p><p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP or another image format up to 2 MB.</p><input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" /><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</Button>{settings.logo_url && <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => update({ logo_url: '' })}>Remove</Button>}</div></div></div>
        <Field label="School Name"><Input value={settings.school_name} onChange={(e) => update({ school_name: e.target.value })} /></Field>
        <Field label="School Motto"><Input value={settings.motto} onChange={(e) => update({ motto: e.target.value })} placeholder="Enter the school motto" /></Field>
        <Field label="Address"><Input value={settings.address} onChange={(e) => update({ address: e.target.value })} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Phone"><Input value={settings.phone} onChange={(e) => update({ phone: e.target.value })} /></Field><Field label="Email"><Input type="email" value={settings.email} onChange={(e) => update({ email: e.target.value })} /></Field></div>
        <Field label="Pass Percentage" hint="A subject passes when its percentage score is at least this value."><Input type="number" min={0} max={100} step={0.01} value={settings.pass_percentage} onChange={(e) => update({ pass_percentage: Number(e.target.value) })} /></Field>
      </CardBody></Card>

      <Card><CardHeader title="Assessment Maximums" subtitle="Used by result entry and report-card calculations" /><CardBody><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{([['ca1_max_score', 'CA1'], ['ca2_max_score', 'CA2'], ['ca3_max_score', 'CA3'], ['exam_max_score', 'Exam']] as const).map(([field, label]) => <Field key={field} label={`${label} Maximum`}><Input type="number" min={0} step={1} value={settings[field]} onChange={(e) => update({ [field]: Number(e.target.value) })} /></Field>)}</div><p className="mt-3 text-xs text-slate-400">The total maximum is {settings.ca1_max_score + settings.ca2_max_score + settings.ca3_max_score + settings.exam_max_score} points.</p></CardBody></Card>

      <Card><CardHeader title="Grade Settings" subtitle="Grade bands must cover every whole-number score from 0 through 100 exactly once" action={<Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addBand}>Add Band</Button>} /><CardBody><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Min</th><th className="text-left px-3 py-2">Max</th><th className="text-left px-3 py-2">Grade</th><th className="text-left px-3 py-2">Remark</th><th className="px-3 py-2">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{gradeBands.map((band) => <tr key={band.clientId}><td className="px-3 py-2"><Input type="number" min={0} max={100} value={band.min_score} onChange={(e) => updateBand(band.clientId, { min_score: Number(e.target.value) })} /></td><td className="px-3 py-2"><Input type="number" min={0} max={100} value={band.max_score} onChange={(e) => updateBand(band.clientId, { max_score: Number(e.target.value) })} /></td><td className="px-3 py-2"><Input value={band.grade} onChange={(e) => updateBand(band.clientId, { grade: e.target.value })} placeholder="A" /></td><td className="px-3 py-2"><Input value={band.remark} onChange={(e) => updateBand(band.clientId, { remark: e.target.value })} placeholder="Excellent" /></td><td className="px-3 py-2 text-center"><button type="button" onClick={() => removeBand(band)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Delete grade ${band.grade}`}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>{gradeBands.length === 0 && <p className="py-4 text-sm text-slate-500">No grade bands configured. Add bands covering 0–100.</p>}{gradeBandError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{gradeBandError}</p>}<p className="mt-3 text-xs text-slate-400">Example valid coverage: 0–39, 40–44, 45–49, 50–59, 60–69, 70–100.</p></CardBody></Card>

      <Card><CardHeader title="Current Academic Period" subtitle="Used as the default session and term across the portal" /><CardBody><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Current Session"><Select value={settings.current_session_id ?? ''} onChange={(e) => update({ current_session_id: e.target.value || null, current_term_id: null })}><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</Select></Field><Field label="Current Term"><Select value={settings.current_term_id ?? ''} onChange={(e) => update({ current_term_id: e.target.value || null })}><option value="">Select term</option>{availableTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</Select></Field></div></CardBody></Card>

      <div className="flex justify-end"><Button icon={<Save className="h-4 w-4" />} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button></div>
      {user?.role === 'admin' && <p className="text-xs text-slate-400 text-center">Signed in as administrator. Changes affect all users.</p>}
    </div>
  );
}
