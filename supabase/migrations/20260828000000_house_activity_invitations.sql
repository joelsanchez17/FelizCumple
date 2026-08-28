-- Invitaciones consentidas para actividades compartidas de la casita.
-- Es seguro volver a ejecutar este archivo.

create table if not exists public.house_activity_invitations (
  id uuid primary key,
  room_id text not null,
  kind text not null check (kind in ('lie_together', 'sleep_cuddled', 'private_moment')),
  from_identity text not null check (from_identity in ('joel', 'princesa')),
  to_identity text not null check (to_identity in ('joel', 'princesa')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  responded_at timestamptz,
  check (from_identity <> to_identity)
);

create index if not exists house_activity_invitations_people_idx
  on public.house_activity_invitations (to_identity, status, expires_at desc);

alter table public.house_activity_invitations enable row level security;

drop policy if exists "couple can read activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can add activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can answer activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can clear activity invitations" on public.house_activity_invitations;
create policy "couple can read activity invitations"
  on public.house_activity_invitations for select to anon, authenticated using (true);
create policy "couple can add activity invitations"
  on public.house_activity_invitations for insert to anon, authenticated
  with check (from_identity in ('joel', 'princesa') and to_identity in ('joel', 'princesa'));
create policy "couple can answer activity invitations"
  on public.house_activity_invitations for update to anon, authenticated using (true)
  with check (status in ('pending', 'accepted', 'declined'));
create policy "couple can clear activity invitations"
  on public.house_activity_invitations for delete to anon, authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'house_activity_invitations'
  ) then
    alter publication supabase_realtime add table public.house_activity_invitations;
  end if;
end $$;
