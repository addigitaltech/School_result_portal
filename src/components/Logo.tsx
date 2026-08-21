import { GraduationCap } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
  const icon = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div className={`${dims[size]} rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center shadow-md`}>
      <GraduationCap className={icon[size]} />
    </div>
  );
}
