import { NavLink } from 'react-router-dom';
import type { Role } from '@/lib/types';
import { Logo } from '@/components/Logo';
import {
  LayoutDashboard, Users, UserCog, School, BookOpen, ClipboardList,
  Calendar, CalendarDays, Users2, Settings, User, LogOut, X,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/admin/students', label: 'Students', icon: <Users className="h-5 w-5" /> },
  { to: '/admin/teachers', label: 'Teachers', icon: <UserCog className="h-5 w-5" /> },
  { to: '/admin/classes', label: 'Classes', icon: <School className="h-5 w-5" /> },
  { to: '/admin/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
  { to: '/admin/results', label: 'Results', icon: <ClipboardList className="h-5 w-5" /> },
  { to: '/admin/sessions', label: 'Academic Sessions', icon: <Calendar className="h-5 w-5" /> },
  { to: '/admin/terms', label: 'Terms', icon: <CalendarDays className="h-5 w-5" /> },
  { to: '/admin/users', label: 'Users', icon: <Users2 className="h-5 w-5" /> },
  { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
];

const teacherNav: NavItem[] = [
  { to: '/teacher', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/teacher/results', label: 'Result Entry', icon: <ClipboardList className="h-5 w-5" /> },
  { to: '/teacher/profile', label: 'My Profile', icon: <UserCog className="h-5 w-5" /> },
];

const studentNav: NavItem[] = [
  { to: '/student', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/student/result', label: 'View Result', icon: <ClipboardList className="h-5 w-5" /> },
  { to: '/student/profile', label: 'My Profile', icon: <User className="h-5 w-5" /> },
];

const parentNav: NavItem[] = [
  { to: '/parent', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/parent/result', label: 'View Result', icon: <ClipboardList className="h-5 w-5" /> },
];

function navForRole(role: Role): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'teacher') return teacherNav;
  if (role === 'student') return studentNav;
  return parentNav;
}

interface SidebarProps {
  role: Role;
  userName: string;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function Sidebar({ role, userName, open, onClose, onLogout }: SidebarProps) {
  const items = navForRole(role);
  return (
    <>
      {open && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col z-40 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
          <Logo size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">School Results</p>
            <p className="text-slate-400 text-xs truncate">Portal</p>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${role}`}
              onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </nav>
        <div className="px-4 py-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 truncate">Signed in as</p>
          <p className="text-sm text-white truncate font-medium">{userName}</p>
          <p className="text-xs text-blue-400 capitalize mt-0.5">{role}</p>
        </div>
      </aside>
    </>
  );
}
