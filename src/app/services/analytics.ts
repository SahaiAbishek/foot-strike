import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Run } from '../models/run.model';
import { API_BASE_URL } from '../config/api';

export interface WeeklySummary {
  weekStart: string;
  dailyDistanceMeters: number[];
  totalDistanceMeters: number;
  totalMovingSeconds: number;
  totalRuns: number;
}

export interface PersonalRecords {
  longestRun: Run | null;
  fastestPaceRun: Run | null;
  longestStreakDays: number;
}

const WEEKS_PER_PAGE = 8;

@Injectable({ providedIn: 'root' })
export class RunAnalytics {
  private readonly http = inject(HttpClient);
  private weeksLoaded = 0;

  readonly weeks = signal<WeeklySummary[]>([]);
  readonly records = signal<PersonalRecords | null>(null);
  readonly isLoadingWeeks = signal(false);
  readonly error = signal<string | null>(null);

  /** Resets and loads the first page of weeks plus all-time records - call once when the page opens. */
  loadInitial(): void {
    this.weeks.set([]);
    this.weeksLoaded = 0;
    this.error.set(null);
    this.loadMoreWeeks();
    this.loadRecords();
  }

  /** Fetches the next page of weeks further back in time and appends it to the loaded list. */
  loadMoreWeeks(): void {
    if (this.isLoadingWeeks()) {
      return;
    }
    this.isLoadingWeeks.set(true);
    const offset = this.weeksLoaded;
    this.http
      .get<WeeklySummary[]>(`${API_BASE_URL}/api/strava/weekly-summary`, {
        params: { weeks: WEEKS_PER_PAGE, offset },
      })
      .subscribe({
        next: (page) => {
          this.weeks.update((current) => [...current, ...page]);
          this.weeksLoaded += WEEKS_PER_PAGE;
          this.isLoadingWeeks.set(false);
        },
        error: (err) => {
          this.isLoadingWeeks.set(false);
          this.error.set(describeError(err));
        },
      });
  }

  private loadRecords(): void {
    this.http.get<PersonalRecords>(`${API_BASE_URL}/api/strava/records`).subscribe({
      next: (records) => this.records.set(records),
      error: (err) => this.error.set(describeError(err)),
    });
  }
}

function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 404) {
      return "Couldn't load analytics (404) - the backend may need to be restarted to pick up this feature.";
    }
    return `Couldn't load analytics (HTTP ${err.status}).`;
  }
  return "Couldn't load analytics.";
}
