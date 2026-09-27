import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName } from '@/lib/format';
import type { Parent, Student } from '@/lib/types';
import { UserPlus, Search, Pencil, Trash2, Contact } from 'lucide-react';

const empty: Partial<Parent> = { full_name: '', email: '', phone: '', student_id: '' };

export function ParentsPage() {
  const { success, error } = useToast();
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Parent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, st] = await Promise.all([
      api.from('parents').select('*').order('created_at', { ascending: false }),
      api.from('students').select('*').order('first_name'),
    ]);
    setParents((p.data ?? []) as Parent[]);
    setStudents((st.data ?? []) as Student[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const studentName = (id: string) => { const s = students.find((student) => student.id === id); return s ? `${fullName(s)} (${s.student_id})` : '—'; };

  const filtered = parents.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.full_name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || studentName(p.student_id).toLowerCase().includes(q);
  });

  const openAdd = () => { setEditing({ ...empty }); setErrors({}); setModalOpen(true); };
  const openEdit = (parent: Parent) => { setEditing({ ...parent }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.full_name?.trim()) e.full_name = 'Full name is required';
    if (editing?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) e.email = 'Invalid email format';
    if (!editing?.student_id) e.student_id = 'Select the linked student';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = { full_name: editing.full_name!.trim(), email: editing.email?.trim() || null, phone: editing.phone?.trim() || null, student_id: editing.student_id };
    const response = editing.id ? await api.from('parents').update(payload).eq('id', editing.id) : await api.from('parents').insert(payload);
    setSaving(false);
    if (response.error) { error(`Failed to save parent: ${response.error.message}`); return; }
    success(editing.id ? 'Parent updated successfully.' : 'Parent added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: deleteError } = await api.from('parents').delete().eq('id', deleteId);
    setDeleteId(null);
    if (deleteError) { error('Failed to delete parent.'); return; }
    success('Parent deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Parent / Guardian Management</h2>
          <p className="text-sm text-slate-500 mt-1">{parents.length} parents linked to students. To give a parent portal access, create their login from the Users page after adding them here.</p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={openAdd}>Add Parent</Button>
      </div>

      <Card><CardBody><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search by name, email or student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div></CardBody></Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Contact className="h-12 w-12" />} title="No parents found" description="Add a parent or guardian and link them to a student." action={<Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={openAdd}>Add Parent</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 font-medium">Linked Student</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((parent) => (
                  <tr key={parent.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{parent.full_name}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{parent.email ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600 hidden sm:table-cell">{parent.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{studentName(parent.student_id)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openEdit(parent)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteId(parent.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Parent' : 'Add Parent'} size="md"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Full Name" required error={errors.full_name}>
              <Input value={editing.full_name ?? ''} error={!!errors.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
            </Field>
            <Field label="Linked Student" required error={errors.student_id} hint="A parent account can view results for this student.">
              <Select value={editing.student_id ?? ''} error={!!errors.student_id} onChange={(e) => setEditing({ ...editing, student_id: e.target.value })}>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_id})</option>)}
              </Select>
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={editing.email ?? ''} error={!!errors.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Parent" message="Are you sure you want to delete this parent/guardian record? Any login account linked to them will no longer work." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
