create table if not exists public.jbot_coaching_journey (
    user_id text primary key references public.users_table(id) on delete cascade,
    first_coaching_experience boolean not null default false,
    coaching_journey text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coaching_journey_required_for_returning_clients
        check (
            first_coaching_experience = true
            or nullif(btrim(coaching_journey), '') is not null
        )
);

alter table public.jbot_coaching_journey enable row level security;

create policy "Users can read their own coaching journey"
    on public.jbot_coaching_journey
    for select
    using (auth.uid()::text = user_id);

create policy "Users can insert their own coaching journey"
    on public.jbot_coaching_journey
    for insert
    with check (auth.uid()::text = user_id);

create policy "Users can update their own coaching journey"
    on public.jbot_coaching_journey
    for update
    using (auth.uid()::text = user_id)
    with check (auth.uid()::text = user_id);
