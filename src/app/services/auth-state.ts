import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { AuthUser, Role } from '../models/auth.model';
import { API_BASE_URL } from '../config/api';
import { DistanceUnit } from '../utils/units';
import { Runs } from './runs';

interface StravaStatusResponse {
  connected: boolean;
  athleteFirstName: string | null;
  athleteLastName: string | null;
}

const UNIT_STORAGE_KEY = 'footstrike.unit';
export const STRAVA_POPUP_MESSAGE_TYPE = 'strava-connect-result';

function loadStoredUnit(): DistanceUnit {
  const stored = localStorage.getItem(UNIT_STORAGE_KEY);
  return stored === 'mi' ? 'mi' : 'km';
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  private readonly http = inject(HttpClient);
  private readonly runs = inject(Runs);
  private sessionCheck$: Observable<void> | null = null;

  readonly currentUser = signal<AuthUser | null>(null);
  readonly authChecked = signal(false);
  readonly role = signal<Role>(null);
  readonly stravaConnected = signal(false);
  readonly weeklyEmail = signal(true);
  readonly groupReminders = signal(false);
  readonly unit = signal<DistanceUnit>(loadStoredUnit());

  /**
   * Ensures a GET /api/auth/me check has run at least once, so the route guard can wait
   * for it before deciding whether to bounce to /signin. Safe to call from multiple
   * guards/components at once - the request only actually fires once.
   */
  ensureSessionChecked(): Observable<void> {
    if (this.authChecked()) {
      return of(undefined);
    }
    if (!this.sessionCheck$) {
      this.sessionCheck$ = this.http.get<AuthUser>(`${API_BASE_URL}/api/auth/me`).pipe(
        tap((user) => {
          this.currentUser.set(user);
          this.role.set(user.role);
        }),
        catchError(() => {
          this.currentUser.set(null);
          return of(null);
        }),
        tap(() => this.authChecked.set(true)),
        map(() => undefined),
        shareReplay(1),
      );
    }
    return this.sessionCheck$;
  }

  /**
   * Sends the Google ID token to the backend, which verifies it and starts a session.
   * `role` is only applied by the backend on this user's first-ever login - on a later
   * login it's ignored and the previously-persisted role comes back instead.
   */
  loginWithGoogle(credential: string, role: Exclude<Role, null>): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${API_BASE_URL}/api/auth/google`, { credential, role }).pipe(
      tap((user) => {
        this.currentUser.set(user);
        this.role.set(user.role);
        this.authChecked.set(true);
      }),
    );
  }

  signOut(): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/auth/logout`, {}).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      tap(() => {
        this.currentUser.set(null);
        this.role.set(null);
        this.markStravaDisconnected();
      }),
    );
  }

  /**
   * Opens the backend's OAuth flow in a popup instead of navigating away from the app.
   * The popup lands on /strava/popup-complete, which posts a message back here and closes
   * itself; falls back to a full-page redirect if the popup was blocked.
   */
  connectStrava(): void {
    const popup = window.open(
      `${API_BASE_URL}/api/strava/connect`,
      'strava-connect',
      'width=600,height=720',
    );

    if (!popup) {
      window.location.href = `${API_BASE_URL}/api/strava/connect`;
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== STRAVA_POPUP_MESSAGE_TYPE) {
        return;
      }
      cleanup();
      this.refreshStravaStatus();
    };

    const pollClosed = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
      }
    }, 500);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(pollClosed);
    };

    window.addEventListener('message', handleMessage);
  }

  /** Asks the backend whether a Strava account is currently linked, and updates the local signal. */
  refreshStravaStatus(): void {
    this.http.get<StravaStatusResponse>(`${API_BASE_URL}/api/strava/status`).subscribe({
      next: (status) => {
        if (status.connected) {
          this.stravaConnected.set(true);
        } else {
          this.markStravaDisconnected();
        }
      },
      error: () => this.markStravaDisconnected(),
    });
  }

  toggleStrava(): void {
    if (this.stravaConnected()) {
      this.http.delete(`${API_BASE_URL}/api/strava/connection`).subscribe({
        next: () => this.markStravaDisconnected(),
        error: () => this.markStravaDisconnected(),
      });
    } else {
      this.connectStrava();
    }
  }

  /** Flips the connected flag off and wipes any previously loaded runs/stats in one place. */
  private markStravaDisconnected(): void {
    this.stravaConnected.set(false);
    this.runs.clear();
  }

  toggleWeeklyEmail(): void {
    this.weeklyEmail.update((value) => !value);
  }

  toggleGroupReminders(): void {
    this.groupReminders.update((value) => !value);
  }

  toggleUnit(): void {
    this.unit.update((value) => {
      const next = value === 'km' ? 'mi' : 'km';
      localStorage.setItem(UNIT_STORAGE_KEY, next);
      return next;
    });
  }
}
