# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FootStrike is an Angular 20 standalone-components frontend for a running-tracking app. It talks to a
separate backend repo (`foot-strike-backend`, sibling directory, not present here) over cookie-based
sessions — there is no local server or database in this repo.

## Commands

- `npm start` / `ng serve` — dev server at `http://localhost:4200`, auto-reloads on source changes.
- `npm run build` / `ng build` — production build to `dist/`.
- `npm run watch` — development-config build in watch mode.
- `npm test` / `ng test` — unit tests via Karma/Jasmine.
- `ng test --include='**/auth-state.spec.ts'` — run a single spec file (adjust the glob per file).
- `ng generate component pages/foo` — scaffold a new standalone component (also `directive`, `pipe`, etc.).

There is no lint script configured. Prettier config lives in `package.json` (`printWidth: 100`,
single quotes, Angular parser for `.html`).

## Architecture

**Standalone components throughout** — no `NgModule`s. Routes lazy-load each component via
`loadComponent()` in `src/app/app.routes.ts`.

**Auth flow and route guards**: `AuthState` (`src/app/services/auth-state.ts`) is the single source
of truth for session state, exposed as signals (`currentUser`, `role`, `authChecked`,
`stravaConnected`, `unit`, etc.). `ensureSessionChecked()` calls `GET /api/auth/me` exactly once
(deduplicated via `shareReplay`) and both `authGuard` and `redirectIfAuthedGuard`
(`src/app/guards/auth.guard.ts`) wait on it before deciding to redirect — this avoids bouncing an
already-authenticated user to `/signin` on page refresh before the check resolves. Sign-in itself
uses Google Identity Services (`src/app/services/google-identity.ts`), which loads Google's script
on demand and hands an ID token to `AuthState.loginWithGoogle()`.

**Route structure**: `/signin` and `/strava/popup-complete` are top-level; everything else nests
under a `Shell` layout component gated by `authGuard`. The catch-all route redirects to `/signin`.

**HTTP**: all API calls go through `credentialsInterceptor` (`src/app/interceptors/credentials.interceptor.ts`),
which forces `withCredentials: true` on every request so the session cookie round-trips to the
backend running on a different port/origin. `API_BASE_URL` comes from `src/environments/environment*.ts`
(swapped by `fileReplacements` in `angular.json` for production builds) and is re-exported from
`src/app/config/api.ts` alongside the (non-secret) Google OAuth client ID.

**Strava connection**: `AuthState.connectStrava()` opens the backend's OAuth flow in a popup window
rather than navigating away from the app. The popup lands on `/strava/popup-complete`
(`StravaPopupComplete`), which `postMessage`s a `strava-connect-result` event (`STRAVA_POPUP_MESSAGE_TYPE`)
back to the opener and closes itself; `AuthState` listens for that message to refresh status. If the
popup is blocked, it falls back to a full-page redirect, and `StravaPopupComplete` in turn falls back
to navigating to `/dashboard` if it finds no `window.opener`.

**Runs/stats data**: `Runs` service (`src/app/services/runs.ts`) holds `stats` and `list` signals,
populated by `loadFromStrava()`. `AuthState` calls `runs.clear()` whenever Strava disconnects, keeping
the two services in sync without a shared parent.

**Units**: distance/pace/duration formatting is centralized in `src/app/utils/units.ts` as pure
functions (`formatDistance`, `formatDuration`, `formatPace`, `formatStreak`) parameterized by the
user's `DistanceUnit` (`'km' | 'mi'`), which is persisted to `localStorage` (`footstrike.unit`) by
`AuthState.toggleUnit()`. Components (e.g. `Dashboard`) derive display values via `computed()` signals
that recompute when the unit changes.

**Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (see `.postcssrc.json`); global styles in
`src/styles.css`.
