# Google Calendar integration plan

Google Calendar is scaffolded in the data model but is not connected yet. The Settings screen says this clearly so a saved EONIS event cannot be mistaken for a Google-synced event.

The two-way integration should be implemented in Supabase Edge Functions:

1. Start Google OAuth from EONIS and request the minimum calendar scopes needed for event read/write.
2. Exchange the authorization code on the server, validate the OAuth state, and keep refresh tokens in Supabase Vault or another server-only secret store.
3. Store only non-secret connection metadata, Google calendar IDs, and incremental sync cursors in `calendar_connections`.
4. Pull changed events with Google's incremental sync token, and turn cancelled external events into EONIS tombstones.
5. Push EONIS event changes with a stable external ID mapping and idempotency key so retries cannot create duplicates.
6. Treat imported Google events as occupied time in the planner, and make provider, last sync, and reconnect state visible to the user.
7. Resolve edits using provider event IDs plus `updated_at`/revision metadata; surface ambiguous simultaneous edits for review rather than silently duplicating events.

Before enabling it, configure Google OAuth consent, authorized redirect URLs, and the required server-side secrets. No Google credentials are needed for the local planner or current GitHub Pages build.
