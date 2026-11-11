create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  service text not null check (char_length(service) between 1 and 120),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 160),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists clients_owner_created_at_idx
  on public.clients (owner_id, created_at desc);
create index if not exists finance_entries_owner_occurred_on_idx
  on public.finance_entries (owner_id, occurred_on desc);

alter table public.clients enable row level security;
alter table public.finance_entries enable row level security;

revoke all on table public.clients, public.finance_entries from anon, public;
grant select, insert, update, delete on table public.clients, public.finance_entries to authenticated;

drop policy if exists "Users manage their own clients" on public.clients;
create policy "Users manage their own clients"
  on public.clients
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users manage their own finance entries" on public.finance_entries;
create policy "Users manage their own finance entries"
  on public.finance_entries
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
