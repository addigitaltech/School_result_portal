import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import type { AppUser, Role, Teacher, Student, Parent } from '@/lib/types';
import { Users2, Plus, Trash2, Search } from 'lucide-react';

const empty: Partial<AppUser> = { email: '', password_hash: '', role: 'teacher', display_name: '', teacher_id: null, student_id: null, parent_id: null };

export function UsersPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AppUser> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, t, s, p] = await Promise.all([
      supabase.from('app_users').select('*').order('created_at', { ascending: false }),
      supabase.from('teachers').select('*'),
      supabase.from('students').select('*'),
      supabase.from('parents').select('*'),
    ]);
    setUsers(u.data ?? []);
    setTeachers(t.data ?? []);
    setStudents(s.data ?? []);
    setParents(p.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const openAdd = () => { setEditing({ ...empty }); setErrors({}); setModalOpen(true); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.email?.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) e.email = 'Invalid email';
    else if (users.some((u) => u.email === editing.email?.trim().toLowerCase() && u.id !== editing.id)) e.email = 'Email already exists';
    if (!editing?.password_hash?.trim()) e.password_hash = 'Password is required';
    else if (editing.password_hash.length < 6) e.password_hash = 'Password must be at least 6 characters';
    if (!editing?.display_name?.trim()) e.display_name = 'Display name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    setSaving(true);
    const payload = {
      email: editing.email!.trim().toLowerCase(),
      password_hash: editing.password_hash!,
      role: editing.role as Role,
      display_name: editing.display_name!.trim(),
      teacher_id: editing.teacher_id || null,
      student_id: editing.student_id || null,
      parent_id: editing.parent_id || null,
    };
    const res = await supabase.from('app_users').insert(payload);
    setSaving(false);
    if (res.error) { error('Failed to create user.'); return; }
    success('User created successfully.');
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error: errm } = await supabase.from('app_users').delete().eq('id', deleteId);
    setDeleteId(null);
    if (errm) { error('Failed to delete user.'); return; }
    success('User deleted successfully.');
    load();
  };

  const roleVariant: Record<Role, 'info' | 'success' | 'warning' | 'danger'> = { admin: 'danger', teacher: 'info', student: 'success', parent: 'warning' };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">{users.length} users</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add User</Button>
      </div>

      <Card>
        <CardBody>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by name, email or role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users2 className="h-12 w-12" />} title="No users found" description="Add a new user account." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{u.display_name}</td>
                    <td className="px-5 py-3 text-slate-600">{u.email}</td>
                    <td className="px-5 py-3"><Badge variant={roleVariant[u.role]}>{u.role}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDeleteId(u.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add User" size="md"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Display Name" required error={errors.display_name}>
              <Input value={editing.display_name ?? ''} error={!!errors.display_name} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
            </Field>
            <Field label="Email" required error={errors.email}>
              <Input type="email" value={editing.email ?? ''} error={!!errors.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Password" required error={errors.password_hash} hint="Minimum 6 characters">
              <Input value={editing.password_hash ?? ''} error={!!errors.password_hash} onChange={(e) => setEditing({ ...editing, password_hash: e.target.value })} />
            </Field>
            <Field label="Role" required>
              <Select value={editing.role ?? 'teacher'} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role, teacher_id: null, student_id: null, parent_id: null })}>
                <option value="admin">Administrator</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="parent">Parent</option>
              </Select>
            </Field>
            {editing.role === 'teacher' && (
              <Field label="Linked Teacher">
                <Select value={editing.teacher_id ?? ''} onChange={(e) => setEditing({ ...editing, teacher_id: e.target.value || null })}>
                  <option value="">None</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.teacher_id})</option>)}
                </Select>
              </Field>
            )}
            {editing.role === 'student' && (
              <Field label="Linked Student">
                <Select value={editing.student_id ?? ''} onChange={(e) => setEditing({ ...editing, student_id: e.target.value || null })}>
                  <option value="">None</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</option>)}
                </Select>
              </Field>
            )}
            {editing.role === 'parent' && (
              <Field label="Linked Parent">
                <Select value={editing.parent_id ?? ''} onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}>
                  <option value="">None</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete User" message="Are you sure you want to delete this user account?" confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
