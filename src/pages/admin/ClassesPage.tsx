import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { Arm, ClassArm, ClassRow, Teacher, Student } from '@/lib/types';
import { School, Pencil, Trash2, Plus, Users, Layers, Settings2 } from 'lucide-react';

export function ClassesPage() {
  const { success, error } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [armModalOpen, setArmModalOpen] = useState(false);
  const [armEditing, setArmEditing] = useState<Partial<Arm> | null>(null);
  const [armSaving, setArmSaving] = useState(false);
  const [armErrors, setArmErrors] = useState<Record<string, string>>({});
  const [armDeleteId, setArmDeleteId] = useState<string | null>(null);
  const [assignmentClass, setAssignmentClass] = useState<ClassRow | null>(null);
  const [selectedArmIds, setSelectedArmIds] = useState<string[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, t, s, a, ca] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('students').select('class_id'),
      supabase.from('arms').select('*').order('name'),
      supabase.from('class_arms').select('*'),
    ]);
    setClasses(c.data ?? []);
    setTeachers(t.data ?? []);
    setArms(a.data ?? []);
    setClassArms(ca.data ?? []);
    const cnt: Record<string, number> = {};
    (s.data as Student[] | null ?? []).forEach((st) => { if (st.class_id) cnt[st.class_id] = (cnt[st.class_id] ?? 0) + 1; });
    setCounts(cnt);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.full_name ?? '—';
  const armsForClass = (classId: string) => classArms.filter((ca) => ca.class_id === classId).map((ca) => arms.find((a) => a.id === ca.arm_id)).filter((a): a is Arm => !!a);

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

  const openArmAdd = () => { setArmEditing({ name: '' }); setArmErrors({}); setArmModalOpen(true); };
  const openArmEdit = (arm: Arm) => { setArmEditing({ ...arm }); setArmErrors({}); setArmModalOpen(true); };

  const saveArm = async () => {
    if (!armEditing) return;
    const e: Record<string, string> = {};
    if (!armEditing.name?.trim()) e.name = 'Arm name is required';
    else if (arms.some((a) => a.name.toLowerCase() === armEditing.name!.trim().toLowerCase() && a.id !== armEditing.id)) e.name = 'Arm name already exists';
    setArmErrors(e);
    if (Object.keys(e).length) return;
    setArmSaving(true);
    const payload = { name: armEditing.name!.trim() };
    const res = armEditing.id
      ? await supabase.from('arms').update(payload).eq('id', armEditing.id)
      : await supabase.from('arms').insert(payload);
    setArmSaving(false);
    if (res.error) { error('Failed to save arm.'); return; }
    success(armEditing.id ? 'Arm updated successfully.' : 'Arm added successfully.');
    setArmModalOpen(false);
    load();
  };

  const confirmArmDelete = async () => {
    if (!armDeleteId) return;
    const { error: err } = await supabase.from('arms').delete().eq('id', armDeleteId);
    setArmDeleteId(null);
    if (err) { error('Failed to delete arm.'); return; }
    success('Arm deleted successfully.');
    load();
  };

  const openAssignment = (classRow: ClassRow) => {
    setAssignmentClass(classRow);
    setSelectedArmIds(classArms.filter((ca) => ca.class_id === classRow.id).map((ca) => ca.arm_id));
  };

  const saveAssignment = async () => {
    if (!assignmentClass) return;
    setAssignmentSaving(true);
    const { error: deleteError } = await supabase.from('class_arms').delete().eq('class_id', assignmentClass.id);
    if (deleteError) { setAssignmentSaving(false); error('Failed to update class arms.'); return; }
    if (selectedArmIds.length > 0) {
      const { error: insertError } = await supabase.from('class_arms').insert(selectedArmIds.map((arm_id) => ({ class_id: assignmentClass.id, arm_id })));
      if (insertError) { setAssignmentSaving(false); error('Failed to update class arms.'); return; }
    }
    setAssignmentSaving(false);
    success('Class arms updated successfully.');
    setAssignmentClass(null);
    load();
  };

  return (
    <div className="space-y-6">
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
          {classes.map((c) => {
            const assignedArms = armsForClass(c.id);
            return (
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
                  <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                    <Layers className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Arms</p>
                      <div className="flex flex-wrap gap-1">
                        {assignedArms.length ? assignedArms.map((arm) => <span key={arm.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{arm.name}</span>) : <span className="text-xs text-slate-400">None assigned</span>}
                      </div>
                    </div>
                    <button onClick={() => openAssignment(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Manage arms"><Settings2 className="h-4 w-4" /></button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h3 className="font-semibold text-slate-800">Arms</h3><p className="text-sm text-slate-500">Create reusable arms and assign them to classes.</p></div>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openArmAdd}>Add Arm</Button>
        </div>
        {arms.length === 0 ? <p className="px-5 py-6 text-sm text-slate-400">No arms created yet.</p> : (
          <div className="divide-y divide-slate-100">
            {arms.map((arm) => <div key={arm.id} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-slate-700">{arm.name}</span><div className="flex gap-1"><button onClick={() => openArmEdit(arm)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="h-4 w-4" /></button><button onClick={() => setArmDeleteId(arm.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button></div></div>)}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Class' : 'Add Class'} size="sm" footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>
        {editing && <div className="space-y-4"><Field label="Class Name" required error={errors.name}><Input value={editing.name ?? ''} error={!!errors.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. JSS 1" /></Field><Field label="Class Teacher"><Select value={editing.class_teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, class_teacher_id: e.target.value })}><option value="">Unassigned</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></Field></div>}
      </Modal>

      <Modal open={armModalOpen} onClose={() => setArmModalOpen(false)} title={armEditing?.id ? 'Edit Arm' : 'Add Arm'} size="sm" footer={<><Button variant="secondary" onClick={() => setArmModalOpen(false)}>Cancel</Button><Button onClick={saveArm} disabled={armSaving}>{armSaving ? 'Saving...' : 'Save'}</Button></>}>
        {armEditing && <Field label="Arm Name" required error={armErrors.name}><Input value={armEditing.name ?? ''} error={!!armErrors.name} onChange={(e) => setArmEditing({ ...armEditing, name: e.target.value })} placeholder="e.g. A" /></Field>}
      </Modal>

      <Modal open={!!assignmentClass} onClose={() => setAssignmentClass(null)} title={`Assign Arms — ${assignmentClass?.name ?? ''}`} size="sm" footer={<><Button variant="secondary" onClick={() => setAssignmentClass(null)}>Cancel</Button><Button onClick={saveAssignment} disabled={assignmentSaving}>{assignmentSaving ? 'Saving...' : 'Save Assignment'}</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select the arms that belong to this class. Students can only be assigned to these arms.</p>
          {arms.length === 0 ? <p className="text-sm text-slate-400">Create an arm first.</p> : arms.map((arm) => <label key={arm.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"><input type="checkbox" checked={selectedArmIds.includes(arm.id)} onChange={() => setSelectedArmIds((prev) => prev.includes(arm.id) ? prev.filter((id) => id !== arm.id) : [...prev, arm.id])} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm text-slate-700">{arm.name}</span></label>)}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Class" message="Are you sure you want to delete this class? Students in this class will be unlinked." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
      <ConfirmDialog open={!!armDeleteId} title="Delete Arm" message="Are you sure you want to delete this arm? It will be removed from all class assignments and students will be unlinked from it." confirmLabel="Delete" onConfirm={confirmArmDelete} onCancel={() => setArmDeleteId(null)} />
    </div>
  );
}
