import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; type: ToastType; message: string; }

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
  warning: (m: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const styles: Record<ToastType, { bg: string; icon: ReactNode }> = {
  success: { bg: 'bg-emerald-600', icon: <CheckCircle2 className="h-5 w-5" /> },
  error: { bg: 'bg-red-600', icon: <XCircle className="h-5 w-5" /> },
  info: { bg: 'bg-blue-600', icon: <Info className="h-5 w-5" /> },
  warning: { bg: 'bg-amber-500', icon: <AlertTriangle className="h-5 w-5" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
    info: (m) => toast(m, 'info'),
    warning: (m) => toast(m, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles[t.type].bg} text-white rounded-lg shadow-lg p-4 flex items-start gap-3 pointer-events-auto animate-[slideIn_0.2s_ease-out]`}
          >
            <span className="flex-shrink-0 mt-0.5">{styles[t.type].icon}</span>
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button onClick={() => remove(t.id)} className="flex-shrink-0 opacity-80 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
