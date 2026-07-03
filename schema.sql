-- Supabase PostgreSQL Table Schema
-- Paste this script in the Supabase SQL Editor to initialize your sync table and security policies.

create table if not exists user_sync (
  id uuid references auth.users not null primary key,
  trades_data jsonb,
  accounts_data jsonb,
  settings_data jsonb,
  sop_data jsonb,
  updated_at bigint not null
);

-- Enable Row Level Security (RLS)
alter table user_sync enable row level security;

-- Create policy to allow users to read only their own record
create policy "Users can select their own sync record"
  on user_sync for select
  using (auth.uid() = id);

-- Create policy to allow users to insert only their own record
create policy "Users can upsert their own sync record"
  on user_sync for insert
  with check (auth.uid() = id);

-- Create policy to allow users to update only their own record
create policy "Users can update their own sync record"
  on user_sync for update
  using (auth.uid() = id);
