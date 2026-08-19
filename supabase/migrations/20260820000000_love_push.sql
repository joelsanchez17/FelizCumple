create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  identity text unique not null check (identity in ('joel', 'princesa')),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.drawings (
  id uuid default gen_random_uuid() primary key,
  from_identity text not null check (from_identity in ('joel', 'princesa')),
  data text not null,
  date text,
  created_at timestamptz default now() not null
);

-- La app usa la publishable key. Estas políticas limitan las operaciones públicas
-- a lo estrictamente necesario; el envío lee suscripciones con service_role.
alter table public.push_subscriptions enable row level security;
alter table public.drawings enable row level security;

create policy "upsert own push subscription"
  on public.push_subscriptions for insert to anon, authenticated with check (identity in ('joel', 'princesa'));
create policy "update own push subscription"
  on public.push_subscriptions for update to anon, authenticated using (identity in ('joel', 'princesa')) with check (identity in ('joel', 'princesa'));
create policy "remove subscription from this device"
  on public.push_subscriptions for delete to anon, authenticated using (identity in ('joel', 'princesa'));
create policy "share drawings"
  on public.drawings for insert to anon, authenticated with check (from_identity in ('joel', 'princesa'));
