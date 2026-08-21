import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Footer } from './Footer';

const titles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/students': 'Student Management',
  '/admin/teachers': 'Teacher Management',
  '/admin/classes': 'Class Management',
  '/admin/subjects': 'Subject Management',
  '/admin/results': 'Results Management',
  '/admin/results/entry': 'Result Entry',
  '/admin/sessions': 'Academic Sessions',
  '/admin/terms': 'Terms',
  '/admin/users': 'User Management',
  '/admin/settings': 'Settings',
  '/teacher': 'Teacher Dashboard',
  '/teacher/results': 'My Results',
  '/teacher/results/entry': 'Result Entry',
  '/teacher/profile': 'My Profile',
  '/student': 'Student Dashboard',
  '/student/result': 'My Result',
  '/student/profile': 'My Profile',
  '/parent': 'Parent Dashboard',
  '/parent/result': "Student's Result",
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] ?? 'Dashboard';

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        role={user.role}
        userName={user.display_name}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
