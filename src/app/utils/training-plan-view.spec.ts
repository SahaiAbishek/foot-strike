import { WorkoutType } from '../services/training-plan';
import { WORKOUT_LABELS, addDays, formatWeekLabel } from './training-plan-view';

describe('WORKOUT_LABELS', () => {
  it('has a label for every WorkoutType', () => {
    const types: WorkoutType[] = [
      'REST',
      'RECOVERY',
      'GENERAL_AEROBIC',
      'LONG_RUN',
      'MARATHON_PACE',
      'LT',
      'VO2MAX',
      'SPEED',
      'RACE',
    ];
    for (const type of types) {
      expect(WORKOUT_LABELS[type]).toBeTruthy();
    }
  });
});

describe('addDays', () => {
  it('adds days across a month boundary in UTC', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });
});

describe('formatWeekLabel', () => {
  it('formats an ISO date as a short month/day label', () => {
    expect(formatWeekLabel('2026-09-12')).toBe('Sep 12');
  });
});
