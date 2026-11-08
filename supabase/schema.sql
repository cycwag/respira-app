create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  gender text check (gender in ('male', 'female')),
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  has_kidney_disease boolean default false,
  has_liver_disease boolean default false,
  is_smoker boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.risk_assessments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  pm25 numeric,
  temperature numeric,
  humidity numeric,
  rainfall numeric,
  wind_speed numeric,
  prev_cases numeric,
  score_j00 numeric,
  score_j02 numeric,
  score_j06 numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;
alter table public.risk_assessments enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can view own assessments"
  on public.risk_assessments for select
  using (auth.uid() = user_id);

create policy "Users can insert own assessments"
  on public.risk_assessments for insert
  with check (auth.uid() = user_id);
