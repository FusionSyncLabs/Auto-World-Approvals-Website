create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.notify_job_worker()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text := 'https://project--3bbed3f2-4626-49d8-ad35-1c296a2422ab.lovable.app';
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

drop trigger if exists jobs_notify_worker on public.jobs;
create trigger jobs_notify_worker
after insert on public.jobs
for each row execute function public.notify_job_worker();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create or replace function public.reap_stuck_jobs()
returns void
language sql
security definer
set search_path = public
as $$
  update public.jobs
     set status = 'failed',
         error = coalesce(error, 'Timed out — worker did not finish within 15 minutes'),
         finished_at = now()
   where status in ('queued','running')
     and created_at < now() - interval '15 minutes';
$$;

revoke execute on function public.reap_stuck_jobs() from public, anon, authenticated;
grant execute on function public.reap_stuck_jobs() to service_role;

do $cronblk$
begin
  if not exists (select 1 from cron.job where jobname = 'reap-stuck-jobs') then
    perform cron.schedule('reap-stuck-jobs','*/5 * * * *', $sched$ select public.reap_stuck_jobs(); $sched$);
  end if;
end
$cronblk$;