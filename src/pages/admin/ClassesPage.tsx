import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { ClassRow, Teacher, Student } from '@/lib/types';
import { School, Pencil, Trash2, Plus, Users } from 'lucide-react';

export function ClassesPage() {
  const { success, error } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, t, s] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('students').select('class_id'),
    ]);
    setClasses(c.data ?? []);
    setTeachers(t.data ?? []);
    const cnt: Record<string, number> = {};
    (s.data as Student[] | null ?? []).forEach((st) => { if (st.class_id) cnt[st.class_id] = (cnt[st.class_id] ?? 0) + 1; });
    setCounts(cnt);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.full_name ?? '—';

  const openAdd = () => { setEditing({ name: '', class_teacher_id: '' }); setErrors({}); setModalOpen(true); };
  const openEdit = (c: ClassRow) => { setEditing({ ...c }); setErrors({}); setModalOpen(true); };

  const save = async () => {
    if (!editing) return;
    const e: Record<string, string> = {};
    if (!editing.name?.trim()) e.name = 'Class name is required';
    else if (classes.some((c) => c.name === editing.name?.trim() && c.id !== editing.id)) e.name = 'Class name already exists';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = { name: editing.name!.trim(), class_teacher_id: editing.class_teacher_id || null };
    const res = editing.id
      ? await supabase.from('classes').update(payload).eq('id', editing.id)
      : await supabase.from('classes').insert(payload);
    setSaving(false);
    if (res.error) { error('Failed to save class.'); return; }
    success(editing.id ? 'Class updated successfully.' : 'Class added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: err } = await supabase.from('classes').delete().eq('id', deleteId);
    setDeleteId(null);
    if (err) { error('Failed to delete class.'); return; }
    success('Class deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Class Management</h2>
          <p className="text-sm text-slate-500 mt-1">{classes.length} classes</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Class</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : classes.length === 0 ? (
        <Card><EmptyState icon={<School className="h-12 w-12" />} title="No classes found" description="Add a class to get started." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><School className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">Class Teacher: {teacherName(c.class_teacher_id)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>{counts[c.id] ?? 0} students</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing?.id ? 'Edit Class' : 'Add Class'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Class Name" required error={errors.name}>
              <Input value={editing.name ?? ''} error={!!errors.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. JSS 1" />
            </Field>
            <Field label="Class Teacher">
              <Select value={editing.class_teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, class_teacher_id: e.target.value })}>
                <option value="">Unassigned</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Class" message="Are you sure you want to delete this class? Students in this class will be unlinked." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
