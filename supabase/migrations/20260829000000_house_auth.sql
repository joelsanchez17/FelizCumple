-- Autenticación real para los dos integrantes de la casita.
-- No crea cuentas: vincula usuarios existentes de Supabase Auth con su identidad.

create table if not exists public.house_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identity text not null unique check (identity in ('joel', 'princesa')),
  created_at timestamptz not null default now()
);

alter table public.house_members enable row level security;

create or replace function public.current_house_identity()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select identity
  from public.house_members
  where user_id = auth.uid()
$$;

create or replace function public.is_house_member()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_house_identity() is not null
$$;

revoke all on function public.current_house_identity() from public;
revoke all on function public.is_house_member() from public;
grant execute on function public.current_house_identity() to authenticated;
grant execute on function public.is_house_member() to authenticated;

drop policy if exists "member can read own membership" on public.house_members;
create policy "member can read own membership"
  on public.house_members for select to authenticated
  using (user_id = auth.uid());

-- Suscripciones push y dibujos.
drop policy if exists "upsert own push subscription" on public.push_subscriptions;
drop policy if exists "update own push subscription" on public.push_subscriptions;
drop policy if exists "remove subscription from this device" on public.push_subscriptions;
create policy "member can add own push subscription"
  on public.push_subscriptions for insert to authenticated
  with check (identity = public.current_house_identity());
create policy "member can update own push subscription"
  on public.push_subscriptions for update to authenticated
  using (identity = public.current_house_identity())
  with check (identity = public.current_house_identity());
create policy "member can remove own push subscription"
  on public.push_subscriptions for delete to authenticated
  using (identity = public.current_house_identity());

drop policy if exists "share drawings" on public.drawings;
drop policy if exists "read shared drawings" on public.drawings;
create policy "members can read drawings"
  on public.drawings for select to authenticated
  using (public.is_house_member());
create policy "member can share own drawing"
  on public.drawings for insert to authenticated
  with check (from_identity = public.current_house_identity());

-- Notas, estados y diario.
drop policy if exists "couple can read house notes" on public.house_notes;
drop policy if exists "couple can leave house notes" on public.house_notes;
drop policy if exists "couple can update house notes" on public.house_notes;
create policy "members can read house notes"
  on public.house_notes for select to authenticated
  using (public.is_house_member());
create policy "member can leave own house note"
  on public.house_notes for insert to authenticated
  with check (
    from_identity = public.current_house_identity()
    and to_identity <> public.current_house_identity()
  );
create policy "participants can update house notes"
  on public.house_notes for update to authenticated
  using (public.current_house_identity() in (from_identity, to_identity))
  with check (public.current_house_identity() in (from_identity, to_identity));

drop policy if exists "couple can read heart states" on public.heart_states;
drop policy if exists "couple can set heart states" on public.heart_states;
drop policy if exists "couple can update heart states" on public.heart_states;
drop policy if exists "couple can clear heart states" on public.heart_states;
create policy "members can read heart states"
  on public.heart_states for select to authenticated
  using (public.is_house_member());
create policy "member can set own heart state"
  on public.heart_states for insert to authenticated
  with check (identity = public.current_house_identity());
create policy "member can update own heart state"
  on public.heart_states for update to authenticated
  using (identity = public.current_house_identity())
  with check (identity = public.current_house_identity());
create policy "member can clear own heart state"
  on public.heart_states for delete to authenticated
  using (identity = public.current_house_identity());

drop policy if exists "couple can read journal" on public.love_journal;
drop policy if exists "couple can add journal moments" on public.love_journal;
drop policy if exists "couple can update journal moments" on public.love_journal;
create policy "members can read journal"
  on public.love_journal for select to authenticated
  using (public.is_house_member());
create policy "member can add own journal moment"
  on public.love_journal for insert to authenticated
  with check (from_identity = public.current_house_identity());
create policy "members can update journal moments"
  on public.love_journal for update to authenticated
  using (public.is_house_member())
  with check (public.is_house_member());

-- Dispositivos, avatares y actividades.
drop policy if exists "couple can read house devices" on public.house_devices;
drop policy if exists "couple can add house devices" on public.house_devices;
drop policy if exists "couple can update house devices" on public.house_devices;
create policy "members can read house devices"
  on public.house_devices for select to authenticated
  using (public.is_house_member());
create policy "member can add house device state"
  on public.house_devices for insert to authenticated
  with check (updated_by = public.current_house_identity());
create policy "member can update house devices"
  on public.house_devices for update to authenticated
  using (public.is_house_member())
  with check (updated_by = public.current_house_identity());

drop policy if exists "couple can read room devices" on public.house_device_states;
drop policy if exists "couple can add room devices" on public.house_device_states;
drop policy if exists "couple can update room devices" on public.house_device_states;
create policy "members can read room devices"
  on public.house_device_states for select to authenticated
  using (public.is_house_member());
create policy "member can add room device state"
  on public.house_device_states for insert to authenticated
  with check (updated_by = public.current_house_identity());
create policy "member can update room devices"
  on public.house_device_states for update to authenticated
  using (public.is_house_member())
  with check (updated_by = public.current_house_identity());

drop policy if exists "couple can read avatar positions" on public.house_avatar_positions;
drop policy if exists "couple can add avatar positions" on public.house_avatar_positions;
drop policy if exists "couple can update avatar positions" on public.house_avatar_positions;
create policy "members can read avatar positions"
  on public.house_avatar_positions for select to authenticated
  using (public.is_house_member());
create policy "member can add own avatar position"
  on public.house_avatar_positions for insert to authenticated
  with check (identity = public.current_house_identity());
create policy "member can update own avatar position"
  on public.house_avatar_positions for update to authenticated
  using (identity = public.current_house_identity())
  with check (identity = public.current_house_identity());

drop policy if exists "couple can read house activities" on public.house_activities;
drop policy if exists "couple can add house activities" on public.house_activities;
drop policy if exists "couple can update house activities" on public.house_activities;
drop policy if exists "couple can clear house activities" on public.house_activities;
create policy "members can read house activities"
  on public.house_activities for select to authenticated
  using (public.is_house_member());
create policy "member can add own house activity"
  on public.house_activities for insert to authenticated
  with check (identity = public.current_house_identity());
create policy "member can update own house activity"
  on public.house_activities for update to authenticated
  using (identity = public.current_house_identity())
  with check (identity = public.current_house_identity());
create policy "member can clear own house activity"
  on public.house_activities for delete to authenticated
  using (identity = public.current_house_identity());

-- Invitaciones consentidas.
drop policy if exists "couple can read activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can add activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can answer activity invitations" on public.house_activity_invitations;
drop policy if exists "couple can clear activity invitations" on public.house_activity_invitations;
create policy "members can read activity invitations"
  on public.house_activity_invitations for select to authenticated
  using (public.current_house_identity() in (from_identity, to_identity));
create policy "member can send own activity invitation"
  on public.house_activity_invitations for insert to authenticated
  with check (
    from_identity = public.current_house_identity()
    and to_identity <> public.current_house_identity()
    and status = 'pending'
  );
create policy "recipient can answer activity invitation"
  on public.house_activity_invitations for update to authenticated
  using (to_identity = public.current_house_identity())
  with check (to_identity = public.current_house_identity());
create policy "participants can clear activity invitation"
  on public.house_activity_invitations for delete to authenticated
  using (public.current_house_identity() in (from_identity, to_identity));
