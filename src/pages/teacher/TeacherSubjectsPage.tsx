import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { Subject, ClassRow, Arm } from '@/lib/types';
import { BookOpen, Pencil, Trash2, Plus } from 'lucide-react';

// Note: the server always forces teacher_id to the signed-in teacher on write, no matter what
// is sent here — this page can only ever create or edit that teacher's own subject assignments.
const empty: Partial<Subject> = { code: '', name: '', class_id: '', arm_id: '', status: 'Active' };

export function TeacherSubjectsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Subject> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.teacher_id) { setLoading(false); return; }
    setLoading(true);
    // GET /data/subjects is automatically scoped server-side to this teacher's own rows.
    const [s, c, a] = await Promise.all([
      api.from('subjects').select('*').order('created_at', { ascending: false }),
      api.from('classes').select('*').order('name'),
      api.from('arms').select('*').order('name'),
    ]);
    setSubjects(s.data ?? []);
    setClasses(c.data ?? []);
    setArms(a.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? '—';
  const armName = (id: string | null) => id ? (arms.find((a) => a.id === id)?.name ?? '—') : 'All Arms';

  const openAdd = () => { setEditing({ ...empty }); setErrors({}); setModalOpen(true); };
  const openEdit = (s: Subject) => { setEditing({ ...s }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.code?.trim()) e.code = 'Subject code is required';
    else if (subjects.some((s) => s.code === editing.code?.trim() && s.id !== editing.id)) e.code = 'You already have a subject with this code';
    if (!editing?.name?.trim()) e.name = 'Subject name is required';
    if (!editing?.class_id) e.class_id = 'Select a class';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = { code: editing.code!.trim(), name: editing.name!.trim(), class_id: editing.class_id || null, arm_id: editing.arm_id || null, status: editing.status };
    const res = editing.id ? await api.from('subjects').update(payload).eq('id', editing.id) : await api.from('subjects').insert(payload);
    setSaving(false);
    if (res.error) { error(`Failed to save subject: ${res.error.message}`); return; }
    success(editing.id ? 'Subject updated successfully.' : 'Subject added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: deleteError } = await api.from('subjects').delete().eq('id', deleteId);
    setDeleteId(null);
    if (deleteError) { error('Failed to delete subject.'); return; }
    success('Subject deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Subjects</h2>
          <p className="text-sm text-slate-500 mt-1">Manage which classes and arms your subjects apply to. {subjects.length} subject{subjects.length === 1 ? '' : 's'} assigned to you.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Subject</Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : subjects.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-12 w-12" />} title="No subjects yet" description="Add a subject and assign it to a class and arm." action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Subject</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Code</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Class</th>
                  <th className="text-left px-5 py-3 font-medium">Arm</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.code}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-5 py-3 text-slate-600">{className(s.class_id)}</td>
                    <td className="px-5 py-3 text-slate-600">{armName(s.arm_id)}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Subject' : 'Add Subject'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Subject Code" required error={errors.code}>
              <Input value={editing.code ?? ''} error={!!errors.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="MTH101" />
            </Field>
            <Field label="Subject Name" required error={errors.name}>
              <Input value={editing.name ?? ''} error={!!errors.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Mathematics" />
            </Field>
            <Field label="Class" required error={errors.class_id}>
              <Select value={editing.class_id ?? ''} error={!!errors.class_id} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Arm" hint="Leave as 'All Arms' to teach this subject to every arm in the class above.">
              <Select value={editing.arm_id ?? ''} onChange={(e) => setEditing({ ...editing, arm_id: e.target.value })}>
                <option value="">All Arms</option>
                {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option>Active</option><option>Inactive</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Subject" message="Are you sure you want to delete this subject assignment? Related results will also be removed." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
