export function fullName(s: { first_name: string; last_name: string; other_name?: string }): string {
  return [s.first_name, s.other_name, s.last_name].filter(Boolean).join(' ').trim();
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Whole years since the given date of birth, as of today. Returns null for a missing/invalid date. */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

/** "12 Mar 2014 (12 yrs)" style combined display, matching the reference portal's DOB (Age) format. */
export function formatDateWithAge(dateOfBirth: string | null | undefined): string {
  const formatted = formatDate(dateOfBirth);
  const age = calculateAge(dateOfBirth);
  return age === null ? formatted : `${formatted} (${age} yrs)`;
}
