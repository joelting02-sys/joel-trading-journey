-- Sync schema for the trading journal. Safe to run repeatedly.
create table if not exists user_sync (
  id uuid references auth.users not null primary key,
  trades_data jsonb,
  journal_data jsonb,
  accounts_data jsonb,
  settings_data jsonb,
  sop_data jsonb,
  updated_at bigint not null
);

alter table user_sync add column if not exists journal_data jsonb;
alter table user_sync add column if not exists trades_data jsonb;
alter table user_sync add column if not exists accounts_data jsonb;
alter table user_sync add column if not exists settings_data jsonb;
alter table user_sync add column if not exists sop_data jsonb;
alter table user_sync add column if not exists updated_at bigint;

alter table user_sync enable row level security;
drop policy if exists "Users can select their own sync record" on user_sync;
drop policy if exists "Users can insert their own sync record" on user_sync;
drop policy if exists "Users can update their own sync record" on user_sync;
create policy "Users can select their own sync record" on user_sync for select using (auth.uid() = id);
create policy "Users can insert their own sync record" on user_sync for insert with check (auth.uid() = id);
create policy "Users can update their own sync record" on user_sync for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists user_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  device_id text not null,
  device_name text not null default 'Unknown Device',
  browser text not null default 'Unknown',
  os text not null default 'Unknown',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);
alter table user_devices enable row level security;
drop policy if exists "Users can select their own devices" on user_devices;
drop policy if exists "Users can insert their own devices" on user_devices;
drop policy if exists "Users can update their own devices" on user_devices;
drop policy if exists "Users can delete their own devices" on user_devices;
create policy "Users can select their own devices" on user_devices for select using (auth.uid() = user_id);
create policy "Users can insert their own devices" on user_devices for insert with check (auth.uid() = user_id);
create policy "Users can update their own devices" on user_devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own devices" on user_devices for delete using (auth.uid() = user_id);
