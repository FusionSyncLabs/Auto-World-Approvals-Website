create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('logo_generate','logo_remix','logo_upload','banner_variations','banner_remix')),
  label text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  progress int not null default 0,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  trigger_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

grant select, insert, update on public.jobs to authenticated;
grant all on public.jobs to service_role;

alter table public.jobs enable row level security;

do $pol$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='Users read their own or admins read all jobs') then
    create policy "Users read their own or admins read all jobs"
      on public.jobs for select to authenticated
      using (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='Users create their own jobs') then
    create policy "Users create their own jobs"
      on public.jobs for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='jobs' and policyname='Users update their own jobs (for cancel)') then
    create policy "Users update their own jobs (for cancel)"
      on public.jobs for update to authenticated
      using (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
end $pol$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

do $pub$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end $pub$;

create or replace function public.notify_job_worker()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
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
$fn$;

drop trigger if exists jobs_notify_worker on public.jobs;
create trigger jobs_notify_worker
  after insert on public.jobs
  for each row execute function public.notify_job_worker();

create or replace function public.reap_stuck_jobs()
returns void
language sql
security definer
set search_path = public
as $reap$
  update public.jobs
     set status = 'failed',
         error = coalesce(error, 'Timed out — worker did not finish within 15 minutes'),
         finished_at = now()
   where status in ('queued','running')
     and created_at < now() - interval '15 minutes';
$reap$;

do $cronblk$ begin
  if not exists (select 1 from cron.job where jobname = 'reap-stuck-jobs') then
    perform cron.schedule('reap-stuck-jobs','*/5 * * * *', $sched$ select public.reap_stuck_jobs(); $sched$);
  end if;
end $cronblk$;
