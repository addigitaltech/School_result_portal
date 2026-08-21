import { Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TopbarProps {
  title: string;
  onMenu: () => void;
}

export function Topbar({ title, onMenu }: TopbarProps) {
  const { user } = useAuth();
  const initial = user?.display_name?.charAt(0).toUpperCase() ?? '?';
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="flex-1 text-lg font-semibold text-slate-800 truncate">{title}</h1>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
          {initial}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-slate-700 leading-tight">{user?.display_name}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
        </div>
      </div>
    </header>
  );
}
