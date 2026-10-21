create schema if not exists extensions;

drop trigger if exists jobs_notify_worker on public.jobs;
drop extension if exists pg_net cascade;
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_job_worker()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text := 'https://project--3bbed3f2-4626-49d8-ad35-1c296a2422ab-dev.lovable.app';
begin
  perform net.http_post(
    url := base_url || '/api/public/hooks/run-job',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('id', new.id, 'token', new.trigger_token),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'notify_job_worker failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_job_worker() from public, anon, authenticated;
grant execute on function public.notify_job_worker() to service_role;

create trigger jobs_notify_worker
after insert on public.jobs
for each row execute function public.notify_job_worker();