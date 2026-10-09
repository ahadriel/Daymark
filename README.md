# EONIS

<p align="center">
  <img src="public/eonis.svg" width="112" height="112" alt="EONIS eclipse orbital logo" />
</p>

<p align="center"><strong>YOUR TIME. YOUR UNIVERSE.</strong></p>

EONIS is a calm, local-first planner with one shared web codebase for the browser, Windows app, and Android app.

## What is here

- Responsive Today, Tasks, Calendar, Timeline, Planner, Notes, Insights, and Settings views.
- Quick task capture, smart views, priority sorting, focus timer, daily plan suggestions, and portable JSON backups.
- Device-local storage that works before a cloud project is configured.
- Supabase email authentication, private task sync, realtime updates, SQL schema, and row-level security scaffolding.
- Installable PWA shell with offline caching for the app shell and built assets.
- Electron Windows installer and Capacitor Android build workflows using the same web app.
- A versioned Supabase Edge Function starting point for a future JARVIS API.

## Local development

Use Node.js 24 and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

Create a production web build with `pnpm build` and preview it with `pnpm preview`.

## GitHub Pages

The Pages workflow deploys on pushes to `main`. In **Settings → Pages**, set the source to **GitHub Actions**. The relative Vite asset base works at the repository Pages path.

To enable Supabase in deployed builds, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. For local development, copy `.env.example` to `.env` and fill in the same values. The anon/publishable key is intended for client use and is protected by RLS. Never put a Supabase service-role key in a browser build or commit it to GitHub.

## Supabase

Create a Supabase project, set up the CLI, and apply the migration in `supabase/migrations`. The schema includes per-user RLS, soft-delete timestamps, revisions, and Realtime publication for tasks. Task sync uses updated timestamps and revisions as a deterministic last-write-wins rule; it currently syncs tasks only. Notes, events, templates, and preferences are local-first until their sync adapters are added.

The `calendar_connections` table stores connection metadata only. Google OAuth refresh tokens belong in Supabase Vault or another server-side secret store. Google Calendar OAuth and two-way event reconciliation still need to be configured and implemented.

## Desktop and Android builds

- `pnpm desktop:build` creates a Windows NSIS installer in `release/`.
- `pnpm android:add` generates the native Capacitor Android project.
- `pnpm android:sync` copies the latest web build into the Android project.
- `pnpm android:debug` builds an installable debug APK after the Android project has been generated.

The **Build EONIS APK** workflow creates `appbuild/EONIS.apk` on manual run and relevant pushes; it also attaches a downloadable `EONIS-APK` artifact. Its web build receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Actions secrets, so the Android build can initialize the same Supabase client as the web app. The **Build EONIS Apps** workflow also creates Windows and Android artifacts on manual run or a `v*` tag. Store signing is not configured.

## Data and privacy

EONIS has no analytics or tracking. Without Supabase configuration, data stays in this browser or app installation. Export a JSON backup in Settings before changing devices or clearing site data.

## Project map

```text
src/core/                  Shared task model, quick capture, planner
src/data/                  Local-first storage
src/lib/                   Supabase client and row mapping
supabase/migrations/       PostgreSQL schema and RLS
supabase/functions/        Authenticated integration API scaffold
desktop/                   Electron desktop shell
public/                    PWA manifest, icon, service worker
.github/workflows/         Pages deployment and Windows/Android builds
```
