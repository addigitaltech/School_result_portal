import { useEffect, useState, useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { fullName, formatDate } from '@/lib/format';
import type { Arm, ClassArm, Student, ClassRow } from '@/lib/types';
import { ImagePlus, UserPlus, Search, Pencil, Trash2, Eye, Users, Upload, X } from 'lucide-react';

const empty: Partial<Student> = {
  student_id: '', first_name: '', last_name: '', other_name: '', gender: 'Male',
  date_of_birth: '', class_id: '', arm_id: '', parent_guardian: '', parent_phone: '', email: '', photo_url: '',
  admission_date: new Date().toISOString().slice(0, 10), status: 'Active',
};

function Avatar({ student, size = 'md' }: { student: Pick<Student, 'first_name' | 'photo_url'>; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'sm' ? 'h-9 w-9 text-sm' : size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-12 w-12 text-lg';
  return student.photo_url ? <img src={student.photo_url} alt={`${student.first_name} profile`} className={`${dimensions} rounded-full object-cover border border-slate-200`} /> : <div className={`${dimensions} rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold`}>{student.first_name.charAt(0).toUpperCase()}</div>;
}

export function StudentsPage() {
  const { success, error } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [st, cls, a, ca] = await Promise.all([
      api.from('students').select('*').order('created_at', { ascending: false }),
      api.from('classes').select('*').order('name'),
      api.from('arms').select('*').order('name'),
      api.from('class_arms').select('*'),
    ]);
    setStudents((st.data ?? []) as Student[]);
    setClasses(cls.data ?? []);
    setArms(a.data ?? []);
    setClassArms(ca.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => { if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? '—';
  const armName = (id: string | null) => arms.find((a) => a.id === id)?.name ?? '—';
  const availableArms = (classId: string | null | undefined) => classArms.filter((ca) => ca.class_id === classId).map((ca) => arms.find((a) => a.id === ca.arm_id)).filter((a): a is Arm => !!a);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || fullName(s).toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);
    return matchesSearch && (!classFilter || s.class_id === classFilter);
  });

  const resetPhoto = () => {
    if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAdd = () => { resetPhoto(); setEditing({ ...empty }); setErrors({}); setModalOpen(true); };
  const openEdit = (student: Student) => { resetPhoto(); setEditing({ ...student }); setPhotoPreview(student.photo_url ?? ''); setErrors({}); setModalOpen(true); };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { error('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { error('Student photos must be 2 MB or smaller.'); return; }
    if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = (): boolean => {
    const validationErrors: Record<string, string> = {};
    if (!editing?.student_id?.trim()) validationErrors.student_id = 'Student ID is required';
    else if (students.some((s) => s.student_id === editing.student_id?.trim() && s.id !== editing.id)) validationErrors.student_id = 'Student ID already exists';
    if (!editing?.first_name?.trim()) validationErrors.first_name = 'First name is required';
    if (!editing?.last_name?.trim()) validationErrors.last_name = 'Last name is required';
    if (editing?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) validationErrors.email = 'Invalid email format';
    if (!editing?.class_id) validationErrors.class_id = 'Class is required';
    if (editing?.arm_id && !availableArms(editing.class_id).some((arm) => arm.id === editing.arm_id)) validationErrors.arm_id = 'Select an arm assigned to this class';
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const uploadPhoto = async (studentId: string) => {
    if (!photoFile) return editing?.photo_url ?? '';
    const extension = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `student-photos/${studentId}-${Date.now()}.${extension}`;
    const { error: uploadError } = await api.storage.from('school-assets').upload(path, photoFile, { upsert: true, contentType: photoFile.type });
    if (uploadError) throw uploadError;
    return api.storage.from('school-assets').getPublicUrl(path).data.publicUrl;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = {
      student_id: editing.student_id!.trim(), first_name: editing.first_name!.trim(), last_name: editing.last_name!.trim(), other_name: editing.other_name?.trim() ?? '',
      gender: editing.gender, date_of_birth: editing.date_of_birth || null, class_id: editing.class_id || null, arm_id: editing.arm_id || null,
      parent_guardian: editing.parent_guardian || null, parent_phone: editing.parent_phone || null, email: editing.email || null,
      admission_date: editing.admission_date || null, status: editing.status,
    };
    const response = editing.id ? await api.from('students').update(payload).eq('id', editing.id).select('*').single() : await api.from('students').insert(payload).select('*').single();
    if (response.error || !response.data) { setSaving(false); error('Failed to save student: ' + (response.error?.message ?? 'No student returned')); return; }
    let savedStudent = response.data as Student;
    if (photoFile) {
      try {
        const photoUrl = await uploadPhoto(savedStudent.id);
        const photoResponse = await api.from('students').update({ photo_url: photoUrl }).eq('id', savedStudent.id).select('*').single();
        if (photoResponse.error || !photoResponse.data) throw photoResponse.error ?? new Error('Photo URL could not be saved');
        savedStudent = photoResponse.data as Student;
      } catch (photoError) {
        setSaving(false);
        error(`Student saved, but photo upload failed: ${(photoError as Error).message}`);
        setModalOpen(false);
        await load();
        return;
      }
    } else if (editing.id && editing.photo_url !== undefined && editing.photo_url !== savedStudent.photo_url) {
      const photoResponse = await api.from('students').update({ photo_url: editing.photo_url || null }).eq('id', savedStudent.id).select('*').single();
      if (!photoResponse.error && photoResponse.data) savedStudent = photoResponse.data as Student;
    }
    setSaving(false);
    success(editing.id ? 'Student updated successfully.' : 'Student added successfully.');
    setModalOpen(false);
    setViewing(savedStudent);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: deleteError } = await api.from('students').delete().eq('id', deleteId);
    setDeleteId(null);
    if (deleteError) { error('Failed to delete student.'); return; }
    success('Student deleted successfully.');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-800">Student Management</h2><p className="text-sm text-slate-500 mt-1">{students.length} students enrolled</p></div><Button icon={<UserPlus className="h-4 w-4" />} onClick={openAdd}>Add Student</Button></div>
      <Card><CardBody className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search by name, ID or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div><Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-48"><option value="">All Classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></CardBody></Card>
      <Card>{loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : filtered.length === 0 ? <EmptyState icon={<Users className="h-12 w-12" />} title="No students found" description="Try adjusting your search or add a new student." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-5 py-3 font-medium">Photo</th><th className="text-left px-5 py-3 font-medium">Student ID</th><th className="text-left px-5 py-3 font-medium">Name</th><th className="text-left px-5 py-3 font-medium">Gender</th><th className="text-left px-5 py-3 font-medium">Class</th><th className="text-left px-5 py-3 font-medium">Arm</th><th className="text-left px-5 py-3 font-medium hidden md:table-cell">Parent</th><th className="text-left px-5 py-3 font-medium">Status</th><th className="text-right px-5 py-3 font-medium">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((student) => <tr key={student.id} className="hover:bg-slate-50"><td className="px-5 py-3"><Avatar student={student} size="sm" /></td><td className="px-5 py-3 font-mono text-xs text-slate-600">{student.student_id}</td><td className="px-5 py-3 text-slate-800 font-medium">{fullName(student)}</td><td className="px-5 py-3 text-slate-600">{student.gender ?? '—'}</td><td className="px-5 py-3 text-slate-600">{className(student.class_id)}</td><td className="px-5 py-3 text-slate-600">{armName(student.arm_id)}</td><td className="px-5 py-3 text-slate-600 hidden md:table-cell">{student.parent_guardian ?? '—'}</td><td className="px-5 py-3"><StatusBadge status={student.status} /></td><td className="px-5 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => { setViewing(student); setViewOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="h-4 w-4" /></button><button onClick={() => openEdit(student)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteId(student.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}</Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Student' : 'Add Student'} size="lg" footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></>}>{editing && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="sm:col-span-2 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><Avatar student={{ first_name: editing.first_name ?? '?', photo_url: photoPreview || editing.photo_url || null }} size="lg" /><div><p className="text-sm font-medium text-slate-700">Student Photo</p><p className="text-xs text-slate-400 mt-0.5">Image up to 2 MB.</p><input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" /><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>Choose Photo</Button>{(photoPreview || editing.photo_url) && <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => { resetPhoto(); setEditing({ ...editing, photo_url: '' }); }}>Remove</Button>}</div></div></div><Field label="Student ID" required error={errors.student_id}><Input value={editing.student_id ?? ''} error={!!errors.student_id} onChange={(e) => setEditing({ ...editing, student_id: e.target.value })} placeholder="STU001" /></Field><Field label="Class" required error={errors.class_id}><Select value={editing.class_id ?? ''} error={!!errors.class_id} onChange={(e) => setEditing({ ...editing, class_id: e.target.value, arm_id: '' })}><option value="">Select class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Arm" error={errors.arm_id}><Select value={editing.arm_id ?? ''} error={!!errors.arm_id} onChange={(e) => setEditing({ ...editing, arm_id: e.target.value })} disabled={!editing.class_id}><option value="">No arm</option>{availableArms(editing.class_id).map((arm) => <option key={arm.id} value={arm.id}>{arm.name}</option>)}</Select></Field><Field label="First Name" required error={errors.first_name}><Input value={editing.first_name ?? ''} error={!!errors.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></Field><Field label="Last Name" required error={errors.last_name}><Input value={editing.last_name ?? ''} error={!!errors.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></Field><Field label="Other Name"><Input value={editing.other_name ?? ''} onChange={(e) => setEditing({ ...editing, other_name: e.target.value })} /></Field><Field label="Gender"><Select value={editing.gender ?? 'Male'} onChange={(e) => setEditing({ ...editing, gender: e.target.value })}><option>Male</option><option>Female</option></Select></Field><Field label="Date of Birth"><Input type="date" value={editing.date_of_birth ?? ''} onChange={(e) => setEditing({ ...editing, date_of_birth: e.target.value })} /></Field><Field label="Admission Date"><Input type="date" value={editing.admission_date ?? ''} onChange={(e) => setEditing({ ...editing, admission_date: e.target.value })} /></Field><Field label="Parent / Guardian"><Input value={editing.parent_guardian ?? ''} onChange={(e) => setEditing({ ...editing, parent_guardian: e.target.value })} /></Field><Field label="Parent Phone"><Input value={editing.parent_phone ?? ''} onChange={(e) => setEditing({ ...editing, parent_phone: e.target.value })} /></Field><Field label="Email" error={errors.email}><Input type="email" value={editing.email ?? ''} error={!!errors.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field><Field label="Status"><Select value={editing.status ?? 'Active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option>Active</option><option>Inactive</option></Select></Field></div>}</Modal>
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Student Details" size="md" footer={<Button variant="secondary" onClick={() => setViewOpen(false)}>Close</Button>}>{viewing && <div className="space-y-3 text-sm"><div className="flex items-center gap-4 pb-4 border-b border-slate-200"><Avatar student={viewing} size="lg" /><div><p className="font-semibold text-slate-800 text-base">{fullName(viewing)}</p><p className="text-slate-500 font-mono text-xs">{viewing.student_id}</p></div></div><div className="grid grid-cols-2 gap-x-4 gap-y-2">{[['Gender', viewing.gender], ['Date of Birth', formatDate(viewing.date_of_birth)], ['Class', className(viewing.class_id)], ['Arm', armName(viewing.arm_id)], ['Admission Date', formatDate(viewing.admission_date)], ['Parent/Guardian', viewing.parent_guardian], ['Parent Phone', viewing.parent_phone], ['Email', viewing.email], ['Status', viewing.status]].map(([key, value]) => <div key={key}><p className="text-xs text-slate-400">{key}</p><p className="text-slate-700">{value ?? '—'}</p></div>)}</div></div>}</Modal>
      <ConfirmDialog open={!!deleteId} title="Delete Student" message="Are you sure you want to delete this student? This will also remove their results. This action cannot be undone." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
