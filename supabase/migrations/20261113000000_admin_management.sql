create table if not exists public.argos_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.argos_admins enable row level security;
revoke all on table public.argos_admins from public, anon, authenticated;

create or replace function public.is_argos_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.argos_admins where user_id = (select auth.uid())
  );
$function$;

revoke all on function public.is_argos_admin() from public, anon, authenticated;
grant execute on function public.is_argos_admin() to authenticated;

drop policy if exists "Users manage their own clients" on public.clients;
drop policy if exists "Users manage their own finance entries" on public.finance_entries;
drop policy if exists "Argos admins manage clients" on public.clients;
drop policy if exists "Argos admins manage finance entries" on public.finance_entries;
create policy "Argos admins manage clients" on public.clients
  for all to authenticated
  using ((select public.is_argos_admin()))
  with check ((select public.is_argos_admin()));
create policy "Argos admins manage finance entries" on public.finance_entries
  for all to authenticated
  using ((select public.is_argos_admin()))
  with check ((select public.is_argos_admin()));

alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status in ('pending', 'in_progress', 'finishing', 'completed'));

alter table public.finance_entries
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists payment_status text not null default 'paid';
alter table public.finance_entries drop constraint if exists finance_entries_payment_status_check;
alter table public.finance_entries add constraint finance_entries_payment_status_check
  check (payment_status in ('paid', 'pending'));
