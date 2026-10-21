drop policy if exists "Users read their own or admins read all jobs" on public.jobs;
drop policy if exists "Users update their own jobs (for cancel)" on public.jobs;

create policy "Users read their own or admins read all jobs"
  on public.jobs for select to authenticated
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

create policy "Users update their own jobs (for cancel)"
  on public.jobs for update to authenticated
  using (auth.uid() = user_id or private.is_admin(auth.uid()));