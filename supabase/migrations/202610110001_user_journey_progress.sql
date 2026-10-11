-- Persistent per-user completion state for The Unhindered Experience journey.
create table if not exists public.user_journey_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    milestone_number integer not null check (milestone_number between 1 and 12),
    completed_at timestamptz not null default now(),
    primary key (user_id, milestone_number)
);

alter table public.user_journey_progress enable row level security;

drop policy if exists "Users can read their own journey progress" on public.user_journey_progress;
create policy "Users can read their own journey progress"
    on public.user_journey_progress
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own journey progress" on public.user_journey_progress;
create policy "Users can insert their own journey progress"
    on public.user_journey_progress
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own journey progress" on public.user_journey_progress;
create policy "Users can delete their own journey progress"
    on public.user_journey_progress
    for delete
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can update their own journey progress" on public.user_journey_progress;
create policy "Users can update their own journey progress"
    on public.user_journey_progress
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
