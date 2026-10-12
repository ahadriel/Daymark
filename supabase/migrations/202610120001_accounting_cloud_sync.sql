-- EONIS Accounting cloud ledger. Local storage remains the offline-first cache.
create table if not exists public.accounting_ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"events":[],"transactions":[],"deletedTransactionIds":[]}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_ledgers_data_is_object check (jsonb_typeof(data) = 'object')
);

alter table public.accounting_ledgers enable row level security;
drop policy if exists "Users manage their own accounting ledger" on public.accounting_ledgers;
create policy "Users manage their own accounting ledger"
  on public.accounting_ledgers for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.accounting_ledgers to authenticated;
