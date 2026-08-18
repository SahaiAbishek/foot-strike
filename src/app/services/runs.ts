import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../config/api';

export interface RunStats {
  totalDistanceMeters: number;
  totalRuns: number;
  totalMovingSeconds: number;
  streakDays: number;
}

interface SyncResult {
  newRunsAdded: number;
}

const EMPTY_STATS: RunStats = {
  totalDistanceMeters: 0,
  totalRuns: 0,
  totalMovingSeconds: 0,
  streakDays: 0,
};

@Injectable({ providedIn: 'root' })
export class Runs {
  private readonly http = inject(HttpClient);

  readonly stats = signal<RunStats>(EMPTY_STATS);
  readonly isSyncing = signal(false);

  /** Loads whatever stats are already stored for this user - no Strava call. */
  loadFromStrava(): void {
    this.http.get<RunStats>(`${API_BASE_URL}/api/strava/stats`).subscribe((stats) => this.stats.set(stats));
  }

  /**
   * Pulls only activities newer than the most recently stored run from Strava, then reloads.
   * `onSynced` fires after a successful sync, once stats have been refreshed - callers with
   * other data derived from the same runs (e.g. weekly analytics) should refresh there too.
   */
  syncFromStrava(onSynced?: () => void): void {
    if (this.isSyncing()) {
      return;
    }
    this.isSyncing.set(true);
    this.http
      .post<SyncResult>(`${API_BASE_URL}/api/strava/sync`, {})
      .pipe(finalize(() => this.isSyncing.set(false)))
      .subscribe({
        next: () => {
          this.loadFromStrava();
          onSynced?.();
        },
        error: () => {},
      });
  }

  /** Wipes any previously loaded Strava data - call whenever the connection goes away. */
  clear(): void {
    this.stats.set(EMPTY_STATS);
  }
}
