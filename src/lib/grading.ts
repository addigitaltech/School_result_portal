import type { GradeBand, GradeInfo } from './types';

export const CA_MAX = 40;
export const EXAM_MAX = 60;
export const TOTAL_MAX = 100;

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { min_score: 70, max_score: 100, grade: 'A', remark: 'Excellent' },
  { min_score: 60, max_score: 69, grade: 'B', remark: 'Very Good' },
  { min_score: 50, max_score: 59, grade: 'C', remark: 'Good' },
  { min_score: 45, max_score: 49, grade: 'D', remark: 'Fair' },
  { min_score: 40, max_score: 44, grade: 'E', remark: 'Pass' },
  { min_score: 0, max_score: 39, grade: 'F', remark: 'Fail' },
];

export function computeGrade(total: number, bands: GradeBand[] = DEFAULT_GRADE_BANDS): GradeInfo {
  const effectiveBands = bands.length > 0 ? bands : DEFAULT_GRADE_BANDS;
  const matchingBand = effectiveBands.find((band) => total >= band.min_score && total <= band.max_score);
  if (matchingBand) return { grade: matchingBand.grade, remark: matchingBand.remark };

  // Preserve a safe legacy fallback for values outside a custom band's range.
  return total >= 70 ? { grade: 'A', remark: 'Excellent' } : { grade: 'F', remark: 'Fail' };
}

export function clampScore(value: number, max: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return Math.round(value);
}

export function overallGrade(avg: number, bands: GradeBand[] = DEFAULT_GRADE_BANDS): GradeInfo {
  return computeGrade(avg, bands);
}
