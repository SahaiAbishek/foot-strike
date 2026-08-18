import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthState } from '../services/auth-state';

/**
 * Blocks on the (deduplicated) GET /api/auth/me check before deciding, so a page refresh
 * never bounces to /signin before we've had a chance to find out a session already exists.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);

  return auth.ensureSessionChecked().pipe(map(() => (auth.currentUser() ? true : router.parseUrl('/signin'))));
};

/** Keeps an already-signed-in user from seeing the signin screen again (e.g. a bookmarked /signin). */
export const redirectIfAuthedGuard: CanActivateFn = () => {
  const auth = inject(AuthState);
  const router = inject(Router);

  return auth.ensureSessionChecked().pipe(map(() => (auth.currentUser() ? router.parseUrl('/dashboard') : true)));
};
