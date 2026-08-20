-- Estado persistente y compartido de los objetos de la casita.
-- Es seguro volver a ejecutar este archivo.

create table if not exists public.house_devices (
  device text primary key check (device in ('window', 'ac', 'lamp_joel', 'lamp_princesa', 'plant')),
  state jsonb not null default '{}'::jsonb,
  updated_by text not null check (updated_by in ('joel', 'princesa')),
  updated_at timestamptz not null default now()
);

alter table public.house_devices enable row level security;

drop policy if exists "couple can read house devices" on public.house_devices;
drop policy if exists "couple can add house devices" on public.house_devices;
drop policy if exists "couple can update house devices" on public.house_devices;

create policy "couple can read house devices"
  on public.house_devices for select to anon, authenticated using (true);
create policy "couple can add house devices"
  on public.house_devices for insert to anon, authenticated
  with check (updated_by in ('joel', 'princesa'));
create policy "couple can update house devices"
  on public.house_devices for update to anon, authenticated using (true)
  with check (updated_by in ('joel', 'princesa'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_devices'
  ) then
    alter publication supabase_realtime add table public.house_devices;
  end if;
end $$;
