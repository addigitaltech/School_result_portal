import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, error, required, children, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

const baseInput = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ error, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={`${baseInput} ${error ? 'border-red-500' : ''} ${className}`} {...rest} />;
}

export function Select({ error, className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return <select className={`${baseInput} ${error ? 'border-red-500' : ''} ${className}`} {...rest}>{children}</select>;
}
