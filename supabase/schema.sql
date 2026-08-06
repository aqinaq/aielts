-- AIELTS — Supabase schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.

create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  mode          text not null check (mode in ('speak', 'write')),
  band          numeric(2, 1) not null check (band >= 0 and band <= 9),
  level         text,
  task          text,
  text          text not null,
  previous_band numeric(2, 1),
  metrics       jsonb,
  result        jsonb not null
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

-- Row Level Security is what makes it safe for the browser to talk to the
-- database directly with the anon key: every statement is scoped to the signed-in
-- user, so one account can never read or delete another account's attempts.
alter table public.attempts enable row level security;

drop policy if exists "attempts_select_own" on public.attempts;
create policy "attempts_select_own"
  on public.attempts for select
  using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own"
  on public.attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "attempts_delete_own" on public.attempts;
create policy "attempts_delete_own"
  on public.attempts for delete
  using (auth.uid() = user_id);

-- Attempts are immutable once written: there is deliberately no update policy.
