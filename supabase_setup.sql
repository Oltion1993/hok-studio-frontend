-- ============================================================
-- HOK STUDIO — SUPABASE SETUP
-- Ekzekuto kete ne Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES (kredite + info per cdo user)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text,
  email       text,
  credits     integer not null default 0,
  plan        text    not null default 'free',
  created_at  timestamptz default now()
);

-- Auto-create profile kur regjistrohet user i ri
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, credits, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    0,
    'free'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. GENERATIONS (te gjitha gjenercimet e perdoruesve)
create table if not exists public.generations (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  type          text not null check (type in ('image','video','audio','character')),
  prompt        text,
  model         text,
  aspect        text,
  duration      text,
  credits_used  integer default 0,
  status        text default 'completed' check (status in ('queued','processing','completed','failed')),
  result_url    text,
  created_at    timestamptz default now()
);

-- 3. RLS (Row Level Security) — secili sheh vetem gjenercimet e veta
alter table public.profiles    enable row level security;
alter table public.generations enable row level security;

-- Profiles: lexo/shkruaj vetem profilin tend
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Generations: CRUD vetem per generimet e tua
create policy "Users can view own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own generations"
  on public.generations for delete
  using (auth.uid() = user_id);

-- 4. INDEXES per performance
create index if not exists idx_generations_user_id   on public.generations(user_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_generations_type        on public.generations(type);
