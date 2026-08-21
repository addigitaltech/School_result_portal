import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, hasRole } from '@/context/AuthContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FullPageLoader } from '@/components/ui/Feedback';
import { LoginPage } from '@/pages/LoginPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { StudentsPage } from '@/pages/admin/StudentsPage';
import { TeachersPage } from '@/pages/admin/TeachersPage';
import { ClassesPage } from '@/pages/admin/ClassesPage';
import { SubjectsPage } from '@/pages/admin/SubjectsPage';
import { ResultsPage } from '@/pages/admin/ResultsPage';
import { SessionsPage } from '@/pages/admin/SessionsPage';
import { TermsPage } from '@/pages/admin/TermsPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard';
import { TeacherResultsPage } from '@/pages/teacher/TeacherResultsPage';
import { TeacherProfile } from '@/pages/teacher/TeacherProfile';
import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { StudentResultPage } from '@/pages/student/StudentResultPage';
import { StudentProfile } from '@/pages/student/StudentProfile';
import { ParentDashboard } from '@/pages/parent/ParentDashboard';
import { ParentResultPage } from '@/pages/parent/ParentResultPage';
import { ResultEntryPage } from '@/pages/ResultEntryPage';
import type { Role } from '@/lib/types';

function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !hasRole(user, ...roles)) {
    // redirect to the user's own dashboard
    const home = `/${user.role}`;
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleHome />} />

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth roles={['admin']}><DashboardLayout><AdminDashboard /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/students" element={<RequireAuth roles={['admin']}><DashboardLayout><StudentsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/teachers" element={<RequireAuth roles={['admin']}><DashboardLayout><TeachersPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/classes" element={<RequireAuth roles={['admin']}><DashboardLayout><ClassesPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/subjects" element={<RequireAuth roles={['admin']}><DashboardLayout><SubjectsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/results" element={<RequireAuth roles={['admin']}><DashboardLayout><ResultsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/results/entry" element={<RequireAuth roles={['admin']}><DashboardLayout><ResultEntryPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/sessions" element={<RequireAuth roles={['admin']}><DashboardLayout><SessionsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/terms" element={<RequireAuth roles={['admin']}><DashboardLayout><TermsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth roles={['admin']}><DashboardLayout><UsersPage /></DashboardLayout></RequireAuth>} />
      <Route path="/admin/settings" element={<RequireAuth roles={['admin']}><DashboardLayout><SettingsPage /></DashboardLayout></RequireAuth>} />

      {/* Teacher */}
      <Route path="/teacher" element={<RequireAuth roles={['teacher']}><DashboardLayout><TeacherDashboard /></DashboardLayout></RequireAuth>} />
      <Route path="/teacher/results" element={<RequireAuth roles={['teacher']}><DashboardLayout><TeacherResultsPage /></DashboardLayout></RequireAuth>} />
      <Route path="/teacher/results/entry" element={<RequireAuth roles={['teacher']}><DashboardLayout><ResultEntryPage /></DashboardLayout></RequireAuth>} />
      <Route path="/teacher/profile" element={<RequireAuth roles={['teacher']}><DashboardLayout><TeacherProfile /></DashboardLayout></RequireAuth>} />

      {/* Student */}
      <Route path="/student" element={<RequireAuth roles={['student']}><DashboardLayout><StudentDashboard /></DashboardLayout></RequireAuth>} />
      <Route path="/student/result" element={<RequireAuth roles={['student']}><DashboardLayout><StudentResultPage /></DashboardLayout></RequireAuth>} />
      <Route path="/student/profile" element={<RequireAuth roles={['student']}><DashboardLayout><StudentProfile /></DashboardLayout></RequireAuth>} />

      {/* Parent */}
      <Route path="/parent" element={<RequireAuth roles={['parent']}><DashboardLayout><ParentDashboard /></DashboardLayout></RequireAuth>} />
      <Route path="/parent/result" element={<RequireAuth roles={['parent']}><DashboardLayout><ParentResultPage /></DashboardLayout></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
