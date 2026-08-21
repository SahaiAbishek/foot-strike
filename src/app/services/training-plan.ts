import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../config/api';

export type WorkoutType = 'REST' | 'EASY' | 'TEMPO' | 'LONG';

export interface TrainingPlanDay {
  id: number;
  dayIndex: number;
  workoutType: WorkoutType;
  targetDistanceMeters: number;
  targetPaceSecondsPerKm: number | null;
  done: boolean;
}

export interface TrainingPlanWeek {
  weekStart: string;
  days: TrainingPlanDay[];
  totalDistanceMeters: number;
}

@Injectable({ providedIn: 'root' })
export class TrainingPlan {
  private readonly http = inject(HttpClient);

  readonly week = signal<TrainingPlanWeek | null>(null);
  readonly isLoading = signal(false);
  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);

  /** Loads whatever plan already exists for the upcoming week, if 'Generate' was already clicked. */
  load(): void {
    this.isLoading.set(true);
    this.http
      .get<TrainingPlanWeek | null>(`${API_BASE_URL}/api/training-plan/next-week`)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (week) => this.week.set(week),
        error: (err) => this.error.set(describeError(err)),
      });
  }

  /** Generates (or, if one already exists, replaces) the plan for the upcoming week. */
  generate(): void {
    if (this.isGenerating()) {
      return;
    }
    this.isGenerating.set(true);
    this.error.set(null);
    this.http
      .post<TrainingPlanWeek>(`${API_BASE_URL}/api/training-plan/generate`, {})
      .pipe(finalize(() => this.isGenerating.set(false)))
      .subscribe({
        next: (week) => this.week.set(week),
        error: (err) => this.error.set(describeError(err)),
      });
  }

  /** Optimistically toggles a day's done flag, reverting if the request fails. */
  setDone(dayId: number, done: boolean): void {
    const previous = this.week();
    if (!previous) {
      return;
    }
    this.week.set({
      ...previous,
      days: previous.days.map((day) => (day.id === dayId ? { ...day, done } : day)),
    });
    this.http.post(`${API_BASE_URL}/api/training-plan/days/${dayId}/done`, { done }).subscribe({
      error: () => this.week.set(previous),
    });
  }

  /** Wipes any previously loaded plan - call whenever the Strava connection goes away. */
  clear(): void {
    this.week.set(null);
    this.error.set(null);
  }
}

function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return `Couldn't generate a plan (HTTP ${err.status}).`;
  }
  return "Couldn't generate a plan.";
}
