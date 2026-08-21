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
import type { Subject, ClassRow, Teacher } from '@/lib/types';
import { BookOpen, Search, Pencil, Trash2, Plus } from 'lucide-react';

const empty: Partial<Subject> = { code: '', name: '', class_id: '', teacher_id: '', status: 'Active' };

export function SubjectsPage() {
  const { success, error } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Subject> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, t] = await Promise.all([
      supabase.from('subjects').select('*').order('created_at', { ascending: false }),
      supabase.from('classes').select('*').order('name'),
      supabase.from('teachers').select('*').order('full_name'),
    ]);
    setSubjects(s.data ?? []);
    setClasses(c.data ?? []);
    setTeachers(t.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? '—';
  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.full_name ?? '—';

  const filtered = subjects.filter((s) => {
    const q = search.toLowerCase();
    const ms = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    const mc = !classFilter || s.class_id === classFilter;
    return ms && mc;
  });

  const openAdd = () => { setEditing({ ...empty }); setErrors({}); setModalOpen(true); };
  const openEdit = (s: Subject) => { setEditing({ ...s }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.code?.trim()) e.code = 'Subject code is required';
    else if (subjects.some((s) => s.code === editing.code?.trim() && s.id !== editing.id)) e.code = 'Subject code already exists';
    if (!editing?.name?.trim()) e.name = 'Subject name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = {
      code: editing.code!.trim(),
      name: editing.name!.trim(),
      class_id: editing.class_id || null,
      teacher_id: editing.teacher_id || null,
      status: editing.status,
    };
    const res = editing.id
      ? await supabase.from('subjects').update(payload).eq('id', editing.id)
      : await supabase.from('subjects').insert(payload);
    setSaving(false);
    if (res.error) { error('Failed to save subject.'); return; }
    // sync teacher arrays
    if (editing.teacher_id) {
      const { data: t } = await supabase.from('teachers').select('subject_ids').eq('id', editing.teacher_id).maybeSingle();
      const arr = new Set(t?.subject_ids ?? []);
      arr.add(editing.id!);
      await supabase.from('teachers').update({ subject_ids: [...arr] }).eq('id', editing.teacher_id);
    }
    success(editing.id ? 'Subject updated successfully.' : 'Subject added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: err } = await supabase.from('subjects').delete().eq('id', deleteId);
    setDeleteId(null);
    if (err) { error('Failed to delete subject.'); return; }
    success('Subject deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subject Management</h2>
          <p className="text-sm text-slate-500 mt-1">{subjects.length} subjects</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Subject</Button>
      </div>

      <Card>
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-48">
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-12 w-12" />} title="No subjects found" description="Add a new subject to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Code</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Class</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Teacher</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.code}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-5 py-3 text-slate-600">{className(s.class_id)}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{teacherName(s.teacher_id)}</td>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing?.id ? 'Edit Subject' : 'Add Subject'}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Subject Code" required error={errors.code}>
              <Input value={editing.code ?? ''} error={!!errors.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="MTH101" />
            </Field>
            <Field label="Subject Name" required error={errors.name}>
              <Input value={editing.name ?? ''} error={!!errors.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Mathematics" />
            </Field>
            <Field label="Class">
              <Select value={editing.class_id ?? ''} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
                <option value="">General</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Teacher">
              <Select value={editing.teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, teacher_id: e.target.value })}>
                <option value="">Unassigned</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
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

      <ConfirmDialog open={!!deleteId} title="Delete Subject" message="Are you sure you want to delete this subject? Related results will also be removed." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
