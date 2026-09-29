-- Daymark v1 data model. Every user-owned row is isolated by RLS.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.daymark_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  new.revision = old.revision + 1;
  return new;
end;
$$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 1440),
  category text not null default 'Personal',
  tags text[] not null default '{}',
  completed_at timestamptz,
  recurrence text,
  revision integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);
create index tasks_user_due_idx on public.tasks(user_id, due_at) where deleted_at is null;
create trigger tasks_touch_updated_at before update on public.tasks for each row execute function public.daymark_touch_updated_at();

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  source text not null default 'daymark' check (source in ('daymark', 'google')),
  external_id text,
  location text not null default '',
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (user_id, source, external_id)
);
create index calendar_events_user_time_idx on public.calendar_events(user_id, starts_at) where deleted_at is null;
create trigger calendar_events_touch_updated_at before update on public.calendar_events for each row execute function public.daymark_touch_updated_at();

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null default '',
  day date not null default current_date,
  revision integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);
create index notes_user_day_idx on public.notes(user_id, day desc) where deleted_at is null;
create trigger notes_touch_updated_at before update on public.notes for each row execute function public.daymark_touch_updated_at();

create table public.daily_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  blocks jsonb not null default '[]'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);
create trigger daily_templates_touch_updated_at before update on public.daily_templates for each row execute function public.daymark_touch_updated_at();

-- OAuth refresh tokens are deliberately excluded from user-readable tables.
-- Store them in Supabase Vault or another server-side secret store when Google sync is added.
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'google'),
  account_email text not null default '',
  calendar_id text not null default 'primary',
  sync_cursor text,
  last_synced_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected')),
  revision integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider)
);
create trigger calendar_connections_touch_updated_at before update on public.calendar_connections for each row execute function public.daymark_touch_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['tasks', 'calendar_events', 'notes', 'daily_templates', 'calendar_connections'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "Users manage their own %s" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

alter publication supabase_realtime add table public.tasks;
