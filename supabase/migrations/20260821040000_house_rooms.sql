-- Cimientos de la casa con varias habitaciones.
-- Migra la habitación actual a "bedroom" sin borrar las tablas anteriores.
-- Es seguro volver a ejecutar este archivo.

create table if not exists public.house_device_states (
  room_id text not null,
  device_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_by text not null check (updated_by in ('joel', 'princesa')),
  updated_at timestamptz not null default now(),
  primary key (room_id, device_id)
);

create table if not exists public.house_avatar_positions (
  identity text not null check (identity in ('joel', 'princesa')),
  room_id text not null,
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (identity, room_id)
);

create table if not exists public.house_activities (
  identity text primary key check (identity in ('joel', 'princesa')),
  room_id text not null,
  activity text not null,
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.house_notes
  add column if not exists room_id text not null default 'bedroom';

create index if not exists house_device_states_room_updated_idx
  on public.house_device_states (room_id, updated_at desc);
create index if not exists house_avatar_positions_room_updated_idx
  on public.house_avatar_positions (room_id, updated_at desc);
create index if not exists house_activities_room_updated_idx
  on public.house_activities (room_id, updated_at desc);
create index if not exists house_notes_room_created_idx
  on public.house_notes (room_id, created_at desc);

alter table public.house_device_states enable row level security;
alter table public.house_avatar_positions enable row level security;
alter table public.house_activities enable row level security;

drop policy if exists "couple can read room devices" on public.house_device_states;
drop policy if exists "couple can add room devices" on public.house_device_states;
drop policy if exists "couple can update room devices" on public.house_device_states;
create policy "couple can read room devices"
  on public.house_device_states for select to anon, authenticated using (true);
create policy "couple can add room devices"
  on public.house_device_states for insert to anon, authenticated
  with check (updated_by in ('joel', 'princesa'));
create policy "couple can update room devices"
  on public.house_device_states for update to anon, authenticated using (true)
  with check (updated_by in ('joel', 'princesa'));

drop policy if exists "couple can read avatar positions" on public.house_avatar_positions;
drop policy if exists "couple can add avatar positions" on public.house_avatar_positions;
drop policy if exists "couple can update avatar positions" on public.house_avatar_positions;
create policy "couple can read avatar positions"
  on public.house_avatar_positions for select to anon, authenticated using (true);
create policy "couple can add avatar positions"
  on public.house_avatar_positions for insert to anon, authenticated
  with check (identity in ('joel', 'princesa'));
create policy "couple can update avatar positions"
  on public.house_avatar_positions for update to anon, authenticated using (true)
  with check (identity in ('joel', 'princesa'));

drop policy if exists "couple can read house activities" on public.house_activities;
drop policy if exists "couple can add house activities" on public.house_activities;
drop policy if exists "couple can update house activities" on public.house_activities;
drop policy if exists "couple can clear house activities" on public.house_activities;
create policy "couple can read house activities"
  on public.house_activities for select to anon, authenticated using (true);
create policy "couple can add house activities"
  on public.house_activities for insert to anon, authenticated
  with check (identity in ('joel', 'princesa'));
create policy "couple can update house activities"
  on public.house_activities for update to anon, authenticated using (true)
  with check (identity in ('joel', 'princesa'));
create policy "couple can clear house activities"
  on public.house_activities for delete to anon, authenticated using (true);

-- Conserva todos los estados de la habitación que ya existe.
insert into public.house_device_states (room_id, device_id, state, updated_by, updated_at)
select 'bedroom', device, state, updated_by, updated_at
from public.house_devices
where device not in ('avatar_joel', 'avatar_princesa')
on conflict (room_id, device_id) do nothing;

-- Convierte las posiciones actuales si existen; usa una posición cómoda como respaldo.
insert into public.house_avatar_positions (identity, room_id, x, y, updated_at)
select
  case when device = 'avatar_joel' then 'joel' else 'princesa' end,
  'bedroom',
  case
    when jsonb_typeof(state -> 'rx') = 'number' then greatest(0.075, least(0.925, (state ->> 'rx')::double precision))
    when device = 'avatar_joel' then 0.31 else 0.69
  end,
  case
    when jsonb_typeof(state -> 'ry') = 'number' then greatest(0.10, least(0.86, (state ->> 'ry')::double precision))
    else 0.58
  end,
  updated_at
from public.house_devices
where device in ('avatar_joel', 'avatar_princesa')
on conflict (identity, room_id) do nothing;

insert into public.house_avatar_positions (identity, room_id, x, y)
values
  ('joel', 'bedroom', 0.31, 0.58),
  ('princesa', 'bedroom', 0.69, 0.58),
  ('joel', 'kitchen', 0.31, 0.64),
  ('princesa', 'kitchen', 0.69, 0.64),
  ('joel', 'bathroom', 0.31, 0.65),
  ('princesa', 'bathroom', 0.69, 0.65)
on conflict (identity, room_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_device_states'
  ) then alter publication supabase_realtime add table public.house_device_states; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_avatar_positions'
  ) then alter publication supabase_realtime add table public.house_avatar_positions; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_activities'
  ) then alter publication supabase_realtime add table public.house_activities; end if;
end $$;
