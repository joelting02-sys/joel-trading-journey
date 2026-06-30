-- Trading Journal - Supabase 数据库 schema
-- 在 Supabase 控制台 -> SQL Editor 里跑一次

-- 启用必要的扩展
create extension if not exists "uuid-ossp";

-- 1. accounts 账户
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  broker text not null,
  balance numeric not null default 0,
  equity numeric not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- 2. trades 交易记录
create table if not exists public.trades (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_price numeric not null default 0,
  exit_price numeric not null default 0,
  quantity numeric not null default 0,
  pnl numeric not null default 0,
  pnl_percent numeric not null default 0,
  fee numeric default 0,
  open_date date not null,
  close_date date not null,
  status text not null default 'closed' check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_id_idx on public.trades(user_id);
create index if not exists trades_account_id_idx on public.trades(account_id);
create index if not exists trades_open_date_idx on public.trades(open_date desc);

-- 3. sop_rules 交易 SOP
create table if not exists public.sop_rules (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('entry', 'exit', 'risk', 'psychology')),
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- 4. user_settings 每个用户的设置(语言/币种/AI 配置/聊天记录)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text default 'en',
  currency text default 'USD',
  ai_endpoint text default '',
  ai_key text default '',
  ai_model text default '',
  chat_messages jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- === Row Level Security (关键!) ===
-- 用户只能看到/改自己的数据
alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.sop_rules enable row level security;
alter table public.user_settings enable row level security;

-- 删除默认策略(如有)
drop policy if exists "Users can view own accounts" on public.accounts;
drop policy if exists "Users can insert own accounts" on public.accounts;
drop policy if exists "Users can update own accounts" on public.accounts;
drop policy if exists "Users can delete own accounts" on public.accounts;

drop policy if exists "Users can view own trades" on public.trades;
drop policy if exists "Users can insert own trades" on public.trades;
drop policy if exists "Users can update own trades" on public.trades;
drop policy if exists "Users can delete own trades" on public.trades;

drop policy if exists "Users can view own sop_rules" on public.sop_rules;
drop policy if exists "Users can insert own sop_rules" on public.sop_rules;
drop policy if exists "Users can update own sop_rules" on public.sop_rules;
drop policy if exists "Users can delete own sop_rules" on public.sop_rules;

drop policy if exists "Users can view own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;

-- accounts
create policy "Users can view own accounts"
  on public.accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts"
  on public.accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts"
  on public.accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts"
  on public.accounts for delete using (auth.uid() = user_id);

-- trades
create policy "Users can view own trades"
  on public.trades for select using (auth.uid() = user_id);
create policy "Users can insert own trades"
  on public.trades for insert with check (auth.uid() = user_id);
create policy "Users can update own trades"
  on public.trades for update using (auth.uid() = user_id);
create policy "Users can delete own trades"
  on public.trades for delete using (auth.uid() = user_id);

-- sop_rules
create policy "Users can view own sop_rules"
  on public.sop_rules for select using (auth.uid() = user_id);
create policy "Users can insert own sop_rules"
  on public.sop_rules for insert with check (auth.uid() = user_id);
create policy "Users can update own sop_rules"
  on public.sop_rules for update using (auth.uid() = user_id);
create policy "Users can delete own sop_rules"
  on public.sop_rules for delete using (auth.uid() = user_id);

-- user_settings
create policy "Users can view own settings"
  on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);
