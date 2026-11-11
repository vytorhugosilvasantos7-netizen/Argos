alter table public.clients
  add column if not exists project_description text not null default '',
  add column if not exists progress integer not null default 0,
  add column if not exists preview_desktop_url text,
  add column if not exists preview_mobile_url text,
  add column if not exists included_items text[] not null default '{}',
  add column if not exists project_steps jsonb not null default '[]'::jsonb,
  add column if not exists portal_token uuid not null default gen_random_uuid(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.clients
  drop constraint if exists clients_progress_range_check;
alter table public.clients
  add constraint clients_progress_range_check check (progress between 0 and 100);

alter table public.clients
  drop constraint if exists clients_project_steps_array_check;
alter table public.clients
  add constraint clients_project_steps_array_check check (jsonb_typeof(project_steps) = 'array');

create unique index if not exists clients_portal_token_idx
  on public.clients (portal_token);

create or replace function public.set_client_portal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists set_client_portal_updated_at on public.clients;
create trigger set_client_portal_updated_at
  before update on public.clients
  for each row
  execute function public.set_client_portal_updated_at();

create or replace function public.get_client_portal(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'name', clients.name,
    'service', clients.service,
    'status', clients.status,
    'due_date', clients.due_date,
    'project_description', clients.project_description,
    'progress', clients.progress,
    'preview_desktop_url', clients.preview_desktop_url,
    'preview_mobile_url', clients.preview_mobile_url,
    'included_items', clients.included_items,
    'project_steps', clients.project_steps,
    'updated_at', clients.updated_at
  )
  from public.clients
  where clients.portal_token = p_token
  limit 1;
$function$;

revoke all on function public.get_client_portal(uuid) from public, anon, authenticated;
grant execute on function public.get_client_portal(uuid) to anon, authenticated;
