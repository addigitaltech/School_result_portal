import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { AcademicSession } from '@/lib/types';
import { Calendar, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';

export function SessionsPage() {
  const { success, error } = useToast();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AcademicSession> | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('academic_sessions').select('*').order('created_at', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ name: '', is_active: false }); setErr(''); setModalOpen(true); };
  const openEdit = (s: AcademicSession) => { setEditing({ ...s }); setErr(''); setModalOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setErr('Session name is required'); return; }
    setSaving(true);
    const payload = { name: editing.name!.trim(), is_active: editing.is_active ?? false };
    let res;
    if (editing.id) {
      res = await supabase.from('academic_sessions').update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('academic_sessions').insert(payload);
    }
    if (!res.error && editing.is_active) {
      // deactivate others + update school settings
      const newId = editing.id ?? (res.data as { id: string }[] | null)?.[0]?.id;
      if (newId) {
        await supabase.from('academic_sessions').update({ is_active: false }).neq('id', newId);
        await supabase.from('school_settings').update({ current_session_id: newId }).neq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    setSaving(false);
    if (res.error) { error('Failed to save session.'); return; }
    success(editing.id ? 'Session updated successfully.' : 'Session added successfully.');
    setModalOpen(false);
    load();
  };

  const setActive = async (s: AcademicSession) => {
    await supabase.from('academic_sessions').update({ is_active: false }).neq('id', s.id);
    await supabase.from('academic_sessions').update({ is_active: true }).eq('id', s.id);
    await supabase.from('school_settings').update({ current_session_id: s.id }).neq('id', '00000000-0000-0000-0000-000000000000');
    success(`${s.name} set as active session.`);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: errm } = await supabase.from('academic_sessions').delete().eq('id', deleteId);
    setDeleteId(null);
    if (errm) { error('Failed to delete session.'); return; }
    success('Session deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Academic Sessions</h2>
          <p className="text-sm text-slate-500 mt-1">Manage academic years</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Session</Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={<Calendar className="h-12 w-12" />} title="No sessions found" description="Add an academic session to get started." />
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Calendar className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!s.is_active && <Button size="sm" variant="outline" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setActive(s)}>Set Active</Button>}
                  <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Session' : 'Add Session'} size="sm"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Session Name" required error={err}>
              <Input value={editing.name ?? ''} error={!!err} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="2025/2026" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={editing.is_active ?? false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Set as active session
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Session" message="Deleting a session will also delete its terms and results. Continue?" confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
