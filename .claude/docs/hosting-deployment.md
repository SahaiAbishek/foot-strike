# Hosting & deployment guide

Step-by-step walkthrough for putting Foot Strike online for $0/mo:

- **Frontend** (`foot-strike`, this repo) → **Cloudflare Workers** (static assets)
- **Backend** (`foot-strike-backend`) → **Render**, deployed via Docker
- **Database** → **Neon Postgres** (already provisioned — see below)

**Note on Cloudflare naming:** Cloudflare is folding "Pages" into a unified "Workers"
product. Connecting a git repo through the current dashboard flow creates a *Workers*
project (deploy command `npx wrangler deploy`, URL on `*.workers.dev`) rather than the
older, separate *Pages* product (`*.pages.dev`) that most existing tutorials describe.
Functionally equivalent for a static SPA, but the config mechanism differs — a Workers
static-assets project needs a `wrangler.jsonc` telling it where the build output is,
whereas classic Pages read that from a dashboard field alone. This repo now has that file
(`wrangler.jsonc` at the root) — see the fix below.

Rationale/cost comparison lives in `foot-strike-backend/.claude/docs/db-and-hosting-design.md`.
This doc is the operational how-to.

## Before you start: code fixes this plan required

1. **Cookie `SameSite` fix (backend, already applied).** The session cookie
   (`SessionCookies.java`) was hardcoded to `SameSite=Lax`. That works today only because
   `localhost:4200` and `localhost:8080` are the same registrable domain (different ports
   don't count as cross-site). Once the frontend lives on `*.workers.dev` and the backend
   on `*.onrender.com`, those are genuinely different sites, and browsers strip `Lax`
   cookies from cross-site `fetch()` calls — every API call after login would silently
   lose the session. Fixed to use `SameSite=None` whenever `secure=true` (i.e. in the
   `prod` profile), keeping `Lax` for local dev. No action needed, just don't revert it.
2. **`wrangler.jsonc` (frontend, already added — the actual fix for the 404 you hit).**
   Cloudflare's git-connected deploy runs `npx wrangler deploy`, which has no idea where
   your built app lives unless told. Without this file, wrangler deployed a near-empty
   default Worker instead of the Angular build (visible in the build log as
   `Total Upload: 0.33 KiB` — a real build is hundreds of KB+). The file now at the repo
   root points `assets.directory` at `./dist/foot-strike/browser` (must match
   `angular.json`'s output path) and sets `not_found_handling: "single-page-application"`
   so client-side routes like `/dashboard` serve `index.html` instead of 404ing (replaces
   what a Pages `_redirects` file would have done — that file was removed since it doesn't
   apply to Workers static assets). `name` is set to `foot-strike` to match the Worker
   that already exists from your first deploy, so pushing this redeploys the same project
   rather than creating a second one.

## Important ordering note

`src/environments/environment.prod.ts` already hardcodes the production `API_BASE_URL` as
`https://foot-strike-backend.onrender.com`. That means **the Render service must be named
`foot-strike-backend`** (Render URLs are `https://<service-name>.onrender.com`). If you
name it anything else, update that file and redeploy the frontend afterward. The steps
below assume you keep that name.

## Prerequisite: get both repos onto GitHub

Neither repo is a git repository yet, and both Render and Cloudflare Workers work best via a
connected GitHub repo (push-to-deploy, no manual uploads later). Do this for **both**
`foot-strike` and `foot-strike-backend`:

```bash
cd /Users/abhisheksahai/git/foot-strike        # then repeat for foot-strike-backend
git init
git add .
git commit -m "Initial commit"
```

Then on GitHub: create two new repos (public or private, either works on free tiers) —
e.g. `foot-strike` and `foot-strike-backend` — and push:

```bash
git remote add origin https://github.com/<your-username>/foot-strike.git
git branch -M main
git push -u origin main
```

---

## Part 1 — Frontend: Cloudflare Workers (static assets)

1. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com) (free, no card
   required).
2. Left sidebar → **Compute** → **Workers & Pages** → **Create** → connect to the
   `foot-strike` GitHub repo.
3. Build settings the dashboard asks for:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy` (default — leave as-is)
   - **Root directory**: `/`
4. No environment variables needed — `API_BASE_URL` is baked into the bundle at build
   time via `environment.prod.ts` (see ordering note above), not read at runtime.
5. Deploy. You'll get a URL like `https://foot-strike.<your-account-subdomain>.workers.dev`
   — note it, you'll need it for the backend's `FRONTEND_ORIGIN` in Part 2.
6. Every future `git push` to `main` auto-redeploys (triggers the same build → `wrangler
   deploy` pipeline).
7. *(Optional)* **Custom domain**: project → **Settings** → **Domains & Routes** → add one
   you own; Cloudflare issues the certificate automatically.

**If you deployed before `wrangler.jsonc` existed** (e.g. you hit a 404 on the
`workers.dev` URL with nothing on the page): that's expected from the first attempt — the
build had no asset config to work from. Now that the file's in the repo, just push it and
either wait for auto-redeploy or trigger **Retry build** / **New deployment** from the
project's **Deployments** tab. Confirm the fix by checking the build log's upload size —
it should jump from ~0.3 KiB to a size in the hundreds of KB, matching the real bundle.

At this point the site loads but sign-in will fail — the backend doesn't exist yet. That's
expected; move to Part 2.

---

## Part 2 — Backend: Render

**Does this need a Docker image? Yes.** Render has no native Java/JVM runtime (it natively
supports Node, Python, Ruby, Go, Rust, Elixir only) — for Java it deploys via Docker. The
repo already has exactly the `Dockerfile` needed (multi-stage: Maven build → slim JRE
runtime), so there's nothing new to write; Render just builds and runs it.

1. Sign up / log in at [dashboard.render.com](https://dashboard.render.com) (free, no card
   required for the free tier).
2. **New** → **Web Service** → connect your GitHub account → select `foot-strike-backend`.
3. Render should auto-detect the `Dockerfile` and set **Runtime: Docker**. If it offers a
   language runtime instead, manually switch the environment to **Docker**.
4. **Name**: `foot-strike-backend` (must match — see ordering note above).
5. **Region**: pick one close to you or your users (e.g. Oregon/US or Frankfurt/EU).
6. **Instance type**: **Free**.
7. **Environment variables** — add these before the first deploy (Render's dashboard has
   an "Environment" tab/section on the service):

   | Key | Value |
   |---|---|
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `DATABASE_URL` | your Neon connection string, `jdbc:postgresql://...` (see Part 3) |
   | `DATABASE_USERNAME` | from Neon |
   | `DATABASE_PASSWORD` | from Neon |
   | `FRONTEND_ORIGIN` | your Cloudflare Workers URL, e.g. `https://foot-strike.sahaiabhi.workers.dev` (no trailing slash) |
   | `GOOGLE_CLIENT_ID` | same client ID already in `foot-strike/src/app/config/api.ts` |
   | `GOOGLE_ALLOWED_EMAILS` | comma-separated allowlist, e.g. `sahaiabhi@gmail.com` |
   | `STRAVA_CLIENT_ID` | from your Strava API app |
   | `STRAVA_CLIENT_SECRET` | from your Strava API app |
   | `STRAVA_REDIRECT_URI` | `https://foot-strike-backend.onrender.com/api/strava/callback` |
   | `STRAVA_FRONTEND_SUCCESS_URL` | `https://foot-strike.sahaiabhi.workers.dev/strava/popup-complete?status=connected` |
   | `STRAVA_FRONTEND_FAILURE_URL` | `https://foot-strike.sahaiabhi.workers.dev/strava/popup-complete?status=error` |

8. Click **Create Web Service**. Render builds the Docker image and deploys — first build
   takes a few minutes (Maven dependency resolution isn't cached yet).
9. Once live, sanity-check it directly: `https://foot-strike-backend.onrender.com/swagger-ui.html`
   should load the API docs.
10. Every future `git push` to `main` auto-redeploys.
11. **Free-tier behavior to expect**: the service sleeps after 15 minutes with no traffic;
    the next request wakes it in ~30-60s. Fine for a personal app; upgrade to the $7/mo
    Starter plan later if that becomes annoying.

---

## Part 3 — Database: Neon (already provisioned)

You already have a Neon project — `application-local.yml` (gitignored, not committed)
points at a real Neon host under `*.neon.tech`. **It will keep working**: Postgres over
the internet doesn't care whether the client (Spring Boot) runs on your laptop or on
Render, so the same database is reachable from both.

**Decision: reuse the existing branch for prod, or create a separate one?**
For a pre-launch, single-user app, reusing the same Neon branch for local dev and Render
is the simplest path and what "already on Neon, should keep working" implies — that's
what the env vars in Part 2 assume. If you'd rather isolate prod data from whatever test
data is in there from local development, create a second branch in the same Neon project
(Neon console → your project → **Branches** → **New Branch**, branch from `main`/`production`)
and use *that* branch's connection string for Render's `DATABASE_URL` instead. Either way:

1. Neon console → your project → **Connection Details**.
2. Copy the **direct/unpooled** connection string (not the `-pooler` one — Spring Boot's
   HikariCP already pools connections itself).
3. Split it into `DATABASE_URL` (`jdbc:postgresql://<host>/<db>?sslmode=require`),
   `DATABASE_USERNAME`, `DATABASE_PASSWORD` for Render's env vars in Part 2.
4. Flyway runs its migrations automatically against this database on the backend's first
   startup — no manual schema step needed.

---

## Part 4 — Update the OAuth apps for the new domains

Both Google and Strava need to know about your production URLs, or sign-in / Strava
connect will fail even though hosting itself is working.

**Google Cloud Console** (console.cloud.google.com/apis/credentials → your OAuth client):
- Under **Authorized JavaScript origins**, add your Cloudflare Workers URL (e.g.
  `https://foot-strike.sahaiabhi.workers.dev`) and any custom domain. Keep `http://localhost:4200` too
  — you'll still want it for local dev.
- No redirect URI needed (Google Identity Services' button flow doesn't use one, per
  `GOOGLE_AUTH_SETUP.md`).
- Consent screen is presumably still in **Testing** mode — make sure everyone in
  `GOOGLE_ALLOWED_EMAILS` is also in the **Test users** list, or they'll be blocked by
  Google before your app's own check ever runs.

**Strava API settings** (strava.com/settings/api):
- **Authorization Callback Domain** accepts only *one* bare domain (no protocol/port), and
  it currently holds `localhost` for local dev. Production needs
  `foot-strike-backend.onrender.com` instead — but Strava won't let both coexist on one
  app. Two options:
  - **Simplest for now**: swap this field to `foot-strike-backend.onrender.com` once
    you're done with local testing for a while; swap back to `localhost` when you need to
    develop locally again.
  - **Cleaner long-term**: create a *second* Strava API application dedicated to
    production, with its own Client ID/Secret (used only in Render's env vars), and leave
    your original app's callback domain as `localhost` for local dev permanently. This
    avoids ever having to touch Strava settings again after initial setup.

---

## Part 5 — Verify end to end

1. Open your Cloudflare Workers URL (`https://foot-strike.sahaiabhi.workers.dev`).
2. Click **Continue with Google**, sign in with an allowed email.
3. Refresh the page — you should stay signed in (confirms the `SameSite=None` cookie fix
   is working cross-site; if you get bounced to `/signin`, check the browser console/network
   tab for a failing `GET /api/auth/me`, and confirm `FRONTEND_ORIGIN` on Render exactly
   matches the Workers URL, including `https://` and no trailing slash).
4. Click **Connect to Strava**, authorize, confirm the popup closes and runs load on the
   dashboard.
5. Sign out, sign back in — session should still resume correctly (Postgres-backed
   sessions survive Render's cold starts and restarts).

## Troubleshooting quick reference

| Symptom | Likely cause |
|---|---|
| CORS error in browser console | `FRONTEND_ORIGIN` on Render doesn't exactly match the Workers URL |
| Signed in, but bounced to `/signin` on refresh | Cookie not round-tripping — check `SameSite=None`/`Secure` are actually active (`SPRING_PROFILES_ACTIVE=prod` must be set on Render) |
| "Access blocked" from Google before your app's error | Email missing from Google's **Test users** list |
| Strava "Bad Request" / invalid redirect_uri | Authorization Callback Domain doesn't match the Render domain |
| First request after idle takes ~30-60s | Expected — Render free tier cold start |
| 502/503 right after deploy | Backend still booting (Flyway migrations + Spring context startup) — wait ~30s and retry |
