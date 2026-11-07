-- Scadenziario Pro – schema Supabase / PostgreSQL
-- Esegui questo script nel SQL Editor di Supabase, poi imposta
-- SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nelle variabili d'ambiente.

create table if not exists public.deadlines (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Impostazioni, registro avvisi inviati e altri valori chiave/valore.
create table if not exists public.kv (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- L'app accede solo lato server con la service role key:
-- attiviamo RLS senza policy per bloccare l'accesso pubblico con la anon key.
alter table public.deadlines enable row level security;
alter table public.contracts enable row level security;
alter table public.kv enable row level security;
