import type { GradeInfo } from './types';

export const CA_MAX = 40;
export const EXAM_MAX = 60;
export const TOTAL_MAX = 100;

export function computeGrade(total: number): GradeInfo {
  if (total >= 70) return { grade: 'A', remark: 'Excellent' };
  if (total >= 60) return { grade: 'B', remark: 'Very Good' };
  if (total >= 50) return { grade: 'C', remark: 'Good' };
  if (total >= 45) return { grade: 'D', remark: 'Fair' };
  if (total >= 40) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
}

export function clampScore(value: number, max: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return Math.round(value);
}

export function overallGrade(avg: number): GradeInfo {
  return computeGrade(avg);
}
