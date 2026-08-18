import { Routes } from '@angular/router';
import { authGuard, redirectIfAuthedGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'signin' },
  {
    path: 'signin',
    loadComponent: () => import('./pages/signin/signin').then((m) => m.Signin),
    canActivate: [redirectIfAuthedGuard],
  },
  {
    path: 'strava/popup-complete',
    loadComponent: () =>
      import('./pages/strava-popup-complete/strava-popup-complete').then((m) => m.StravaPopupComplete),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: 'signin' },
];
