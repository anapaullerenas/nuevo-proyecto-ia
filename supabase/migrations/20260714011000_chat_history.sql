create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_conversations_owner_brand_updated_idx
  on public.chat_conversations(owner_id, brand_id, updated_at desc);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(conversation_id, created_at asc);

drop trigger if exists touch_chat_conversations_updated_at on public.chat_conversations;
create trigger touch_chat_conversations_updated_at
before update on public.chat_conversations
for each row execute function public.touch_updated_at();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_conversations_owner_all" on public.chat_conversations;
create policy "chat_conversations_owner_all" on public.chat_conversations
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "chat_messages_owner_all" on public.chat_messages;
create policy "chat_messages_owner_all" on public.chat_messages
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
