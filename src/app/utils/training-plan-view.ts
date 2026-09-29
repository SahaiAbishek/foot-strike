import { WorkoutType } from '../services/training-plan';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  REST: 'Rest',
  RECOVERY: 'Recovery run',
  GENERAL_AEROBIC: 'General aerobic',
  LONG_RUN: 'Long run',
  MARATHON_PACE: 'Marathon pace',
  LT: 'Lactate threshold',
  VO2MAX: 'VO2max intervals',
  SPEED: 'Speed / strides',
  RACE: 'Race day',
};

export function formatWeekLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
