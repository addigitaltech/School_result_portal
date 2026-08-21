import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { Teacher, Subject, ClassRow } from '@/lib/types';
import { UserCog, Search, Pencil, Trash2, UserPlus } from 'lucide-react';

const empty: Partial<Teacher> = {
  teacher_id: '', full_name: '', email: '', phone: '', gender: 'Male', status: 'Active',
  subject_ids: [], class_ids: [],
};

export function TeachersPage() {
  const { success, error } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Teacher> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s, c] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('subjects').select('*'),
      supabase.from('classes').select('*').order('name'),
    ]);
    setTeachers(t.data ?? []);
    setSubjects(s.data ?? []);
    setClasses(c.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? '—';
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? '—';

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.full_name.toLowerCase().includes(q) || t.teacher_id.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q);
  });

  const openAdd = () => { setEditing({ ...empty, subject_ids: [], class_ids: [] }); setErrors({}); setModalOpen(true); };
  const openEdit = (t: Teacher) => { setEditing({ ...t, subject_ids: t.subject_ids ?? [], class_ids: t.class_ids ?? [] }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.teacher_id?.trim()) e.teacher_id = 'Teacher ID is required';
    else if (teachers.some((t) => t.teacher_id === editing.teacher_id?.trim() && t.id !== editing.id)) e.teacher_id = 'Teacher ID already exists';
    if (!editing?.full_name?.trim()) e.full_name = 'Full name is required';
    if (editing?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) e.email = 'Invalid email format';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toggleArr = (arr: string[] | undefined, id: string): string[] => {
    const a = arr ?? [];
    return a.includes(id) ? a.filter((x) => x !== id) : [...a, id];
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = {
      teacher_id: editing.teacher_id!.trim(),
      full_name: editing.full_name!.trim(),
      email: editing.email || null,
      phone: editing.phone || null,
      gender: editing.gender,
      status: editing.status,
      subject_ids: editing.subject_ids ?? [],
      class_ids: editing.class_ids ?? [],
    };
    const res = editing.id
      ? await supabase.from('teachers').update(payload).eq('id', editing.id)
      : await supabase.from('teachers').insert(payload);
    setSaving(false);
    if (res.error) { error('Failed to save teacher: ' + res.error.message); return; }
    // keep subjects in sync with teacher
    if (editing.id) {
      await supabase.from('subjects').update({ teacher_id: null }).eq('teacher_id', editing.id).not('id', 'in', `(${(editing.subject_ids ?? []).join(',')})`);
      for (const sid of editing.subject_ids ?? []) {
        await supabase.from('subjects').update({ teacher_id: editing.id }).eq('id', sid);
      }
    }
    success(editing.id ? 'Teacher updated successfully.' : 'Teacher added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('subjects').update({ teacher_id: null }).eq('teacher_id', deleteId);
    const { error: err } = await supabase.from('teachers').delete().eq('id', deleteId);
    setDeleteId(null);
    if (err) { error('Failed to delete teacher.'); return; }
    success('Teacher deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Teacher Management</h2>
          <p className="text-sm text-slate-500 mt-1">{teachers.length} teachers</p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={openAdd}>Add Teacher</Button>
      </div>

      <Card>
        <CardBody>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by name, ID or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserCog className="h-12 w-12" />} title="No teachers found" description="Add a new teacher to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Teacher ID</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Subjects</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Classes</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{t.teacher_id}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{t.full_name}</p>
                      <p className="text-xs text-slate-400">{t.email ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">
                      {(t.subject_ids ?? []).map((id) => subjectName(id)).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden lg:table-cell">
                      {(t.class_ids ?? []).map((id) => className(id)).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing?.id ? 'Edit Teacher' : 'Add Teacher'}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teacher ID" required error={errors.teacher_id}>
                <Input value={editing.teacher_id ?? ''} error={!!errors.teacher_id} onChange={(e) => setEditing({ ...editing, teacher_id: e.target.value })} placeholder="TCH001" />
              </Field>
              <Field label="Full Name" required error={errors.full_name}>
                <Input value={editing.full_name ?? ''} error={!!errors.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input type="email" value={editing.email ?? ''} error={!!errors.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
              <Field label="Gender">
                <Select value={editing.gender ?? 'Male'} onChange={(e) => setEditing({ ...editing, gender: e.target.value })}>
                  <option>Male</option><option>Female</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option>Active</option><option>Inactive</option>
                </Select>
              </Field>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Assigned Subjects</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                {subjects.length === 0 && <p className="text-xs text-slate-400 col-span-full">No subjects available.</p>}
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={(editing.subject_ids ?? []).includes(s.id)} onChange={() => setEditing({ ...editing, subject_ids: toggleArr(editing.subject_ids ?? undefined, s.id) })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Assigned Classes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border border-slate-200 rounded-lg">
                {classes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={(editing.class_ids ?? []).includes(c.id)} onChange={() => setEditing({ ...editing, class_ids: toggleArr(editing.class_ids ?? undefined, c.id) })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Teacher" message="Are you sure you want to delete this teacher? Assigned subjects will be unlinked." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
