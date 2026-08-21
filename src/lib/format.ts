export function fullName(s: { first_name: string; last_name: string; other_name?: string }): string {
  return [s.first_name, s.other_name, s.last_name].filter(Boolean).join(' ').trim();
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
