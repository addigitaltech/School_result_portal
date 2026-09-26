import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { Term, AcademicSession } from '@/lib/types';
import { CalendarDays, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';

export function TermsPage() {
  const { success, error } = useToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Term> | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s] = await Promise.all([
      api.from('terms').select('*').order('created_at', { ascending: false }),
      api.from('academic_sessions').select('*').order('name'),
    ]);
    setTerms(t.data ?? []);
    setSessions(s.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? '—';

  const openAdd = () => { setEditing({ name: '', session_id: sessions[0]?.id ?? '', is_current: false }); setErr(''); setModalOpen(true); };
  const openEdit = (t: Term) => { setEditing({ ...t }); setErr(''); setModalOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setErr('Term name is required'); return; }
    if (!editing.session_id) { setErr('Session is required'); return; }
    setSaving(true);
    const payload = { name: editing.name!.trim(), session_id: editing.session_id, is_current: editing.is_current ?? false };
    const res = editing.id
      ? await api.from('terms').update(payload).eq('id', editing.id)
      : await api.from('terms').insert(payload);
    if (!res.error && editing.is_current) {
      const newId = editing.id ?? (res.data as { id: string }[] | null)?.[0]?.id;
      if (newId) {
        await api.from('terms').update({ is_current: false }).neq('id', newId);
        await api.from('school_settings').update({ current_term_id: newId }).neq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    setSaving(false);
    if (res.error) { error('Failed to save term.'); return; }
    success(editing.id ? 'Term updated successfully.' : 'Term added successfully.');
    setModalOpen(false);
    load();
  };

  const setCurrent = async (t: Term) => {
    await api.from('terms').update({ is_current: false }).neq('id', t.id);
    await api.from('terms').update({ is_current: true }).eq('id', t.id);
    await api.from('school_settings').update({ current_term_id: t.id }).neq('id', '00000000-0000-0000-0000-000000000000');
    success(`${t.name} set as current term.`);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: errm } = await api.from('terms').delete().eq('id', deleteId);
    setDeleteId(null);
    if (errm) { error('Failed to delete term.'); return; }
    success('Term deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Terms</h2>
          <p className="text-sm text-slate-500 mt-1">Manage terms within academic sessions</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} disabled={sessions.length === 0}>Add Term</Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : terms.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-12 w-12" />} title="No terms found" description="Add a term to an academic session." />
        ) : (
          <div className="divide-y divide-slate-100">
            {terms.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><CalendarDays className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{sessionName(t.session_id)}</p>
                  </div>
                  <div className="ml-2">{t.is_current ? <Badge variant="success">Current</Badge> : <Badge variant="neutral">Inactive</Badge>}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!t.is_current && <Button size="sm" variant="outline" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setCurrent(t)}>Set Current</Button>}
                  <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Term' : 'Add Term'} size="sm"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Term Name" required error={err}>
              <Select value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}>
                <option value="">Select term</option>
                <option>First Term</option><option>Second Term</option><option>Third Term</option>
              </Select>
            </Field>
            <Field label="Academic Session" required>
              <Select value={editing.session_id ?? ''} onChange={(e) => setEditing({ ...editing, session_id: e.target.value })}>
                <option value="">Select session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={editing.is_current ?? false} onChange={(e) => setEditing({ ...editing, is_current: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Set as current term
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Term" message="Deleting a term will also delete its results. Continue?" confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
