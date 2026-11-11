create table if not exists public.form_rate_limits (
  subject_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null
);

alter table public.form_rate_limits enable row level security;
revoke all on table public.form_rate_limits from public, anon, authenticated;

create or replace function public.consume_form_rate_limit(
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  allowed boolean;
begin
  insert into public.form_rate_limits as current_window (
    subject_hash,
    window_started_at,
    request_count
  )
  values (p_subject_hash, now(), 1)
  on conflict (subject_hash) do update
  set
    window_started_at = case
      when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else current_window.window_started_at
    end,
    request_count = case
      when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else current_window.request_count + 1
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$function$;

revoke all on function public.consume_form_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_form_rate_limit(text, integer, integer) to service_role;
