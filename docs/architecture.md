# Daymark architecture

## Shared app

The React app in `src/` is the product UI. It builds as a static site for GitHub Pages, loads inside Electron on Windows, and is bundled by Capacitor for Android. Platform shells should stay small so planning rules and the data model remain shared.

```text
Web / PWA ─┐
Windows ───┼── shared React app + core model
Android ───┘           │
                       ├── local device storage (offline baseline)
                       └── Supabase Auth + PostgreSQL + Realtime (when configured)
```

## Data model and sync

Tasks, calendar events, notes, daily templates, preferences, and Google connection metadata have versioned model types. Cloud tables include an owner ID, `updated_at`, `revision`, and a nullable `deleted_at` tombstone. Row-level security binds each row to `auth.uid()`.

The initial client sync is implemented for tasks. After sign-in it merges device and cloud rows using `updated_at`, then `revision` as a tie-breaker, uploads local-winning rows, and listens for Realtime updates. Deletes are soft deletes so other devices can receive them. This is a deterministic last-write-wins baseline; it does not yet offer a user-facing conflict review.

The other table schemas are ready, but notes, calendar events, templates, and preferences still use local storage. Their sync adapters should use the same record metadata before enabling multi-device editing.

## Integrations

- Google Calendar belongs behind Supabase Edge Functions. OAuth refresh tokens must stay server-side. Persist provider event IDs and Google sync cursors so incremental updates and deletions can be reconciled safely.
- `supabase/functions/jarvis-api` is an authenticated, user-scoped API starting point. It uses the caller's Supabase session and RLS; it never uses a service-role key for user data access.
- Keep future external integrations behind a versioned API so the assistant can call Daymark without coupling to UI internals.

## Secrets

The browser receives only the Supabase URL and anon/publishable key. RLS is the data boundary. Service-role keys, Google client secrets, refresh tokens, and signing keys belong in server-side secret storage or GitHub Actions secrets, never in the built JavaScript bundle.
