-- ============================================================
-- HOK STUDIO — CREDITS SYSTEM (Shto pas setup.sql)
-- Ekzekuto ne Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. FUNCTION: Zbrit kredite (deduct)
create or replace function public.deduct_credits(user_id uuid, amount integer)
returns void as $$
begin
  update public.profiles
  set credits = credits - amount
  where id = user_id and credits >= amount;

  if not found then
    raise exception 'Insufficient credits or user not found';
  end if;
end;
$$ language plpgsql security definer;

-- 2. FUNCTION: Shto kredite (add) pas pagesës
create or replace function public.add_credits(user_id uuid, amount integer, new_plan text)
returns void as $$
begin
  update public.profiles
  set
    credits = credits + amount,
    plan    = new_plan
  where id = user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$ language plpgsql security definer;

-- 3. SERVICE ROLE policy për profiles (backend server.js përdor service role)
-- Kjo lejon backend të lexojë/shkruajë profiles pa RLS
create policy "Service role full access profiles"
  on public.profiles
  for all
  using (true)
  with check (true);

-- Nëse ke gabim "policy already exists", ignore këtë dhe vazhdo.

-- 4. SERVICE ROLE policy për generations
create policy "Service role full access generations"
  on public.generations
  for all
  using (true)
  with check (true);

-- 5. PAYMENTS TABLE — regjistron pagesat
create table if not exists public.payments (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  stripe_session  text unique,
  plan            text not null,
  credits         integer not null,
  amount_cents    integer not null,
  status          text default 'completed',
  created_at      timestamptz default now()
);

alter table public.payments enable row level security;

create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Service role full access payments"
  on public.payments
  for all
  using (true)
  with check (true);

-- Index
create index if not exists idx_payments_user_id on public.payments(user_id);

-- 6. Shto 50 kredite falas per users ekzistues (opsionale)
-- UPDATE public.profiles SET credits = 50 WHERE credits = 0;
