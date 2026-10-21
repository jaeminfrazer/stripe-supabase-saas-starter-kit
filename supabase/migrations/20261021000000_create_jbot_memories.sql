create table if not exists public.jbot_memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users_table(id) on delete cascade,
  conversation_id uuid null references public.jbot_conversations(id) on delete set null,
  source_message_id uuid null references public.jbot_messages(id) on delete set null,
  memory_type text not null default 'client_declared'
    check (memory_type in ('client_declared', 'investigation_fact', 'working_hypothesis', 'goal', 'preference')),
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jbot_memories_user_active_created_idx
  on public.jbot_memories (user_id, is_active, created_at desc);

create index if not exists jbot_memories_conversation_idx
  on public.jbot_memories (conversation_id);

alter table public.jbot_memories enable row level security;

drop policy if exists "Users can read their own Jbot memories" on public.jbot_memories;
create policy "Users can read their own Jbot memories"
  on public.jbot_memories for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users can create their own Jbot memories" on public.jbot_memories;
create policy "Users can create their own Jbot memories"
  on public.jbot_memories for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their own Jbot memories" on public.jbot_memories;
create policy "Users can update their own Jbot memories"
  on public.jbot_memories for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete their own Jbot memories" on public.jbot_memories;
create policy "Users can delete their own Jbot memories"
  on public.jbot_memories for delete
  using (auth.uid()::text = user_id);
