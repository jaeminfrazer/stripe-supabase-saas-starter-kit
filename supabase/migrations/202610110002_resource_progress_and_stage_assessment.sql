-- Resource participation and provisional, evidence-based journey assessments.
create table if not exists public.user_resource_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    resource_id uuid not null references public.jbot_resources(id) on delete cascade,
    completed_at timestamptz not null default now(),
    primary key (user_id, resource_id)
);
alter table public.user_resource_progress enable row level security;
drop policy if exists "Users can read their own resource progress" on public.user_resource_progress;
create policy "Users can read their own resource progress" on public.user_resource_progress
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own resource progress" on public.user_resource_progress;
create policy "Users can insert their own resource progress" on public.user_resource_progress
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own resource progress" on public.user_resource_progress;
create policy "Users can delete their own resource progress" on public.user_resource_progress
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.jbot_stage_assessments (
    user_id uuid not null references auth.users(id) on delete cascade,
    milestone_number integer not null check (milestone_number between 1 and 12),
    status text not null default 'pending' check (status in ('pending','investigating','complete')),
    assessment jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, milestone_number)
);
alter table public.jbot_stage_assessments enable row level security;
drop policy if exists "Users can read their own stage assessments" on public.jbot_stage_assessments;
create policy "Users can read their own stage assessments" on public.jbot_stage_assessments
  for select to authenticated using (auth.uid() = user_id);
-- Assessment rows are read-only to the client. Trusted server code writes via
-- the service-role client after verifying the authenticated conversation owner.
drop policy if exists "Users can insert their own stage assessments" on public.jbot_stage_assessments;
drop policy if exists "Users can update their own stage assessments" on public.jbot_stage_assessments;


-- Append-only history preserves how the assessment changes across conversations.
create table if not exists public.jbot_stage_assessment_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    milestone_number integer not null check (milestone_number between 1 and 12),
    status text not null check (status in ('pending','investigating','complete')),
    assessment jsonb not null,
    created_at timestamptz not null default now()
);
alter table public.jbot_stage_assessment_history enable row level security;
drop policy if exists "Users can read their own stage assessment history" on public.jbot_stage_assessment_history;
create policy "Users can read their own stage assessment history" on public.jbot_stage_assessment_history
  for select to authenticated using (auth.uid() = user_id);
