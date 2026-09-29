import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../config/api';

export type WorkoutType =
  | 'REST'
  | 'RECOVERY'
  | 'GENERAL_AEROBIC'
  | 'LONG_RUN'
  | 'MARATHON_PACE'
  | 'LT'
  | 'VO2MAX'
  | 'SPEED'
  | 'RACE';
export type GoalType = 'MARATHON' | 'HALF_MARATHON' | 'TEN_K' | 'FIVE_K' | 'FITNESS';
export type TrainingPlanPhase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER';
export type CurrentWeekStatus = 'NO_PLAN' | 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED';

export interface TrainingPlanDay {
  id: number;
  dayIndex: number;
  workoutType: WorkoutType;
  targetDistanceMeters: number;
  targetPaceSecondsPerKm: number | null;
  done: boolean;
  matchedRunId: number | null;
  description: string | null;
}

export interface TrainingPlanWeek {
  weekNumber: number;
  phase: TrainingPlanPhase;
  weekStart: string;
  days: TrainingPlanDay[];
  totalDistanceMeters: number;
}

export interface TrainingPlanSummary {
  id: number;
  goalType: GoalType;
  targetRaceDate: string | null;
  planStartDate: string;
  lengthWeeks: number;
  weeks: TrainingPlanWeek[];
}

export interface TrainingPlanPreferences {
  goalType: GoalType;
  targetRaceDate: string | null;
  weeklyMileageMeters: number;
  runsPerWeek: number;
  marathonTimeSeconds: number;
  tenKTimeSeconds: number;
  fiveKTimeSeconds: number;
}

export interface CurrentWeek {
  status: CurrentWeekStatus;
  weeksUntilStart: number | null;
  week: TrainingPlanWeek | null;
}

@Injectable({ providedIn: 'root' })
export class TrainingPlan {
  private readonly http = inject(HttpClient);

  readonly plan = signal<TrainingPlanSummary | null>(null);
  readonly currentWeek = signal<CurrentWeek | null>(null);
  readonly isLoading = signal(false);
  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);
  readonly notEnoughTimeError = signal<string | null>(null);

  /** Loads the signed-in user's active plan in full, if one has been generated. */
  loadPlan(): void {
    this.isLoading.set(true);
    this.http
      .get<TrainingPlanSummary | null>(`${API_BASE_URL}/api/training-plan/plan`)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (plan) => this.plan.set(plan),
        error: (err) => this.error.set(describeError(err)),
      });
  }

  /** Loads the dashboard's compact view: this week's days, or why there isn't one to show. */
  loadCurrentWeek(): void {
    this.http.get<CurrentWeek>(`${API_BASE_URL}/api/training-plan/current-week`).subscribe({
      next: (week) => this.currentWeek.set(week),
      error: (err) => this.error.set(describeError(err)),
    });
  }

  /**
   * Submits the questionnaire and generates (or replaces) the active plan. A 422 response means
   * the target race date leaves too little time to train - surfaced separately via
   * notEnoughTimeError so the form can show it inline rather than as a generic error.
   */
  submitPreferences(preferences: TrainingPlanPreferences): void {
    if (this.isGenerating()) {
      return;
    }
    this.isGenerating.set(true);
    this.error.set(null);
    this.notEnoughTimeError.set(null);
    this.http
      .post<TrainingPlanSummary>(`${API_BASE_URL}/api/training-plan/preferences`, preferences)
      .pipe(finalize(() => this.isGenerating.set(false)))
      .subscribe({
        next: (plan) => this.plan.set(plan),
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 422) {
            this.notEnoughTimeError.set(err.error?.message ?? "There isn't enough time to train for this goal.");
          } else {
            this.error.set(describeError(err));
          }
        },
      });
  }

  /** Optimistically toggles a day's done flag (in whichever loaded views contain it), reverting on failure. */
  setDone(dayId: number, done: boolean): void {
    const previousPlan = this.plan();
    const previousCurrentWeek = this.currentWeek();
    if (previousPlan) {
      this.plan.set({ ...previousPlan, weeks: previousPlan.weeks.map((week) => setDoneInWeek(week, dayId, done)) });
    }
    if (previousCurrentWeek?.week) {
      this.currentWeek.set({ ...previousCurrentWeek, week: setDoneInWeek(previousCurrentWeek.week, dayId, done) });
    }
    this.http.post(`${API_BASE_URL}/api/training-plan/days/${dayId}/done`, { done }).subscribe({
      error: () => {
        this.plan.set(previousPlan);
        this.currentWeek.set(previousCurrentWeek);
      },
    });
  }

  /** Wipes any previously loaded plan - call whenever the Strava connection goes away. */
  clear(): void {
    this.plan.set(null);
    this.currentWeek.set(null);
    this.error.set(null);
    this.notEnoughTimeError.set(null);
  }
}

function setDoneInWeek(week: TrainingPlanWeek, dayId: number, done: boolean): TrainingPlanWeek {
  return { ...week, days: week.days.map((day) => (day.id === dayId ? { ...day, done } : day)) };
}

function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return `Couldn't load the training plan (HTTP ${err.status}).`;
  }
  return "Couldn't load the training plan.";
}
