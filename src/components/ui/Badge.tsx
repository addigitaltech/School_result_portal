interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const variants = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-200 text-slate-600',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    Published: 'success',
    Pending: 'warning',
    Draft: 'info',
    Active: 'success',
    Inactive: 'neutral',
  };
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}
