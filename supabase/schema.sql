-- Users table (extends Supabase auth)
create table profiles (
  id uuid references auth.users on delete cascade,
  username text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id)
);

-- Positions table
create table positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  ticker text not null,
  type text not null check (type in ('Call', 'Put')),
  strike numeric not null,
  expiration date not null,
  quantity integer not null,
  entry_price numeric not null,
  current_price numeric,
  status text not null check (status in ('Open', 'Closed')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Watchlist table
create table watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  ticker text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
