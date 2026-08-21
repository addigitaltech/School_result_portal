import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName, formatDate } from '@/lib/format';
import type { Student, ClassRow } from '@/lib/types';
import { UserPlus, Search, Pencil, Trash2, Eye, Users } from 'lucide-react';

const empty: Partial<Student> = {
  student_id: '', first_name: '', last_name: '', other_name: '', gender: 'Male',
  date_of_birth: '', class_id: '', parent_guardian: '', parent_phone: '', email: '',
  admission_date: new Date().toISOString().slice(0, 10), status: 'Active',
};

export function StudentsPage() {
  const { success, error } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    setStudents(data ?? []);
    const { data: cls } = await supabase.from('classes').select('*').order('name');
    setClasses(cls ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? '—';

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || fullName(s).toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);
    const matchesClass = !classFilter || s.class_id === classFilter;
    return matchesSearch && matchesClass;
  });

  const openAdd = () => { setEditing({ ...empty }); setErrors({}); setModalOpen(true); };
  const openEdit = (s: Student) => { setEditing({ ...s }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.student_id?.trim()) e.student_id = 'Student ID is required';
    else if (students.some((s) => s.student_id === editing.student_id?.trim() && s.id !== editing.id)) e.student_id = 'Student ID already exists';
    if (!editing?.first_name?.trim()) e.first_name = 'First name is required';
    if (!editing?.last_name?.trim()) e.last_name = 'Last name is required';
    if (editing?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) e.email = 'Invalid email format';
    if (!editing?.class_id) e.class_id = 'Class is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = {
      student_id: editing.student_id!.trim(),
      first_name: editing.first_name!.trim(),
      last_name: editing.last_name!.trim(),
      other_name: editing.other_name?.trim() ?? '',
      gender: editing.gender,
      date_of_birth: editing.date_of_birth || null,
      class_id: editing.class_id || null,
      parent_guardian: editing.parent_guardian || null,
      parent_phone: editing.parent_phone || null,
      email: editing.email || null,
      admission_date: editing.admission_date || null,
      status: editing.status,
    };
    let res;
    if (editing.id) {
      res = await supabase.from('students').update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('students').insert(payload);
    }
    setSaving(false);
    if (res.error) { error('Failed to save student: ' + res.error.message); return; }
    success(editing.id ? 'Student updated successfully.' : 'Student added successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: err } = await supabase.from('students').delete().eq('id', deleteId);
    setDeleteId(null);
    if (err) { error('Failed to delete student.'); return; }
    success('Student deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Student Management</h2>
          <p className="text-sm text-slate-500 mt-1">{students.length} students enrolled</p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={openAdd}>Add Student</Button>
      </div>

      <Card>
        <CardBody className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by name, ID or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
          <EmptyState icon={<Users className="h-12 w-12" />} title="No students found" description="Try adjusting your search or add a new student." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Student ID</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Gender</th>
                  <th className="text-left px-5 py-3 font-medium">Class</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Parent</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.student_id}</td>
                    <td className="px-5 py-3 text-slate-800 font-medium">{fullName(s)}</td>
                    <td className="px-5 py-3 text-slate-600">{s.gender ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{className(s.class_id)}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{s.parent_guardian ?? '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setViewing(s); setViewOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
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
        title={editing?.id ? 'Edit Student' : 'Add Student'}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}
      >
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Student ID" required error={errors.student_id}>
              <Input value={editing.student_id ?? ''} error={!!errors.student_id} onChange={(e) => setEditing({ ...editing, student_id: e.target.value })} placeholder="STU001" />
            </Field>
            <Field label="Class" required error={errors.class_id}>
              <Select value={editing.class_id ?? ''} error={!!errors.class_id} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="First Name" required error={errors.first_name}>
              <Input value={editing.first_name ?? ''} error={!!errors.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
            </Field>
            <Field label="Last Name" required error={errors.last_name}>
              <Input value={editing.last_name ?? ''} error={!!errors.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
            </Field>
            <Field label="Other Name">
              <Input value={editing.other_name ?? ''} onChange={(e) => setEditing({ ...editing, other_name: e.target.value })} />
            </Field>
            <Field label="Gender">
              <Select value={editing.gender ?? 'Male'} onChange={(e) => setEditing({ ...editing, gender: e.target.value })}>
                <option>Male</option><option>Female</option>
              </Select>
            </Field>
            <Field label="Date of Birth">
              <Input type="date" value={editing.date_of_birth ?? ''} onChange={(e) => setEditing({ ...editing, date_of_birth: e.target.value })} />
            </Field>
            <Field label="Admission Date">
              <Input type="date" value={editing.admission_date ?? ''} onChange={(e) => setEditing({ ...editing, admission_date: e.target.value })} />
            </Field>
            <Field label="Parent / Guardian">
              <Input value={editing.parent_guardian ?? ''} onChange={(e) => setEditing({ ...editing, parent_guardian: e.target.value })} />
            </Field>
            <Field label="Parent Phone">
              <Input value={editing.parent_phone ?? ''} onChange={(e) => setEditing({ ...editing, parent_phone: e.target.value })} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={editing.email ?? ''} error={!!errors.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option>Active</option><option>Inactive</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Student Details" size="md" footer={<Button variant="secondary" onClick={() => setViewOpen(false)}>Close</Button>}>
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
              <div className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold">{viewing.first_name.charAt(0)}</div>
              <div>
                <p className="font-semibold text-slate-800 text-base">{fullName(viewing)}</p>
                <p className="text-slate-500 font-mono text-xs">{viewing.student_id}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                ['Gender', viewing.gender], ['Date of Birth', formatDate(viewing.date_of_birth)], ['Class', className(viewing.class_id)],
                ['Admission Date', formatDate(viewing.admission_date)], ['Parent/Guardian', viewing.parent_guardian], ['Parent Phone', viewing.parent_phone],
                ['Email', viewing.email], ['Status', viewing.status],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-400">{k}</p><p className="text-slate-700">{v ?? '—'}</p></div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Student"
        message="Are you sure you want to delete this student? This will also remove their results. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
