-- Las invitaciones compartidas se crean y responden en servidor para impedir
-- que una sesión escriba actividades o respuestas en nombre del otro miembro.

drop policy if exists "member can add room device state" on public.house_device_states;
drop policy if exists "member can update room devices" on public.house_device_states;
create policy "member can add room device state"
  on public.house_device_states for insert to authenticated
  with check (
    updated_by = public.current_house_identity()
    and device_id <> 'shared_invitation'
  );
create policy "member can update room devices"
  on public.house_device_states for update to authenticated
  using (public.is_house_member())
  with check (
    updated_by = public.current_house_identity()
    and device_id <> 'shared_invitation'
  );

create or replace function public.create_house_invitation(p_kind text, p_ttl_seconds integer default 300)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_house_identity();
  v_partner text;
  v_now timestamptz := now();
  v_invitation jsonb;
begin
  if v_caller not in ('joel', 'princesa') then
    raise exception 'house membership required' using errcode = '42501';
  end if;
  if p_kind not in ('lie_together', 'sleep_cuddle', 'private_moment') then
    raise exception 'invalid invitation kind' using errcode = '22023';
  end if;
  v_partner := case when v_caller = 'joel' then 'princesa' else 'joel' end;
  v_invitation := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'kind', p_kind,
    'from', v_caller,
    'to', v_partner,
    'status', 'pending',
    'created_at', v_now,
    'expires_at', v_now + make_interval(secs => greatest(1, least(coalesce(p_ttl_seconds, 300), 300)))
  );
  insert into public.house_device_states (room_id, device_id, state, updated_by, updated_at)
  values ('bedroom', 'shared_invitation', v_invitation, v_caller, v_now)
  on conflict (room_id, device_id) do update set
    state = excluded.state,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  return v_invitation;
end;
$$;

create or replace function public.respond_house_invitation(p_invitation_id text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_house_identity();
  v_now timestamptz := now();
  v_invitation jsonb;
  v_kind text;
  v_activity text;
  v_style text;
  v_status text;
  v_person text;
begin
  if v_caller not in ('joel', 'princesa') then
    raise exception 'house membership required' using errcode = '42501';
  end if;
  select state into v_invitation
  from public.house_device_states
  where room_id = 'bedroom' and device_id = 'shared_invitation'
  for update;

  if v_invitation is null or v_invitation ->> 'id' <> p_invitation_id or v_invitation ->> 'status' <> 'pending' then
    raise exception 'invitation is no longer pending' using errcode = 'P0002';
  end if;
  if (v_invitation ->> 'expires_at')::timestamptz <= v_now then
    raise exception 'invitation expired' using errcode = 'P0002';
  end if;
  if v_caller not in (v_invitation ->> 'from', v_invitation ->> 'to') then
    raise exception 'not an invitation participant' using errcode = '42501';
  end if;
  if p_accept and v_caller <> v_invitation ->> 'to' then
    raise exception 'only recipient can accept' using errcode = '42501';
  end if;

  v_kind := v_invitation ->> 'kind';
  if p_accept and v_kind in ('sleep_cuddle', 'private_moment') and (
    select count(*) from public.house_activities
    where identity in ('joel', 'princesa') and room_id = 'bedroom' and activity = 'lying'
  ) <> 2 then
    raise exception 'both members must be awake in bed' using errcode = '55000';
  end if;

  if p_accept then
    v_status := 'accepted';
    if v_kind = 'lie_together' then v_activity := 'lying'; v_style := 'koala'; end if;
    if v_kind = 'sleep_cuddle' then v_activity := 'sleeping'; v_style := 'cuddle'; end if;
    if v_activity is not null then
      foreach v_person in array array['joel', 'princesa'] loop
        insert into public.house_activities (identity, room_id, activity, state, started_at, expires_at, updated_at)
        values (
          v_person, 'bedroom', v_activity,
          jsonb_build_object(
            'style', v_style,
            'shared', 'together',
            'invitation_id', p_invitation_id,
            'together_with', case when v_person = 'joel' then 'princesa' else 'joel' end
          ),
          v_now, null, v_now
        )
        on conflict (identity) do update set
          room_id = excluded.room_id,
          activity = excluded.activity,
          state = excluded.state,
          started_at = excluded.started_at,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at;
      end loop;
    end if;
  else
    v_status := case when v_caller = v_invitation ->> 'to' then 'declined' else 'cancelled' end;
  end if;

  v_invitation := v_invitation || jsonb_build_object(
    'status', v_status,
    'responded_at', v_now,
    'responded_by', v_caller
  );
  update public.house_device_states set
    state = v_invitation,
    updated_by = v_caller,
    updated_at = v_now
  where room_id = 'bedroom' and device_id = 'shared_invitation';
  return v_invitation;
end;
$$;

revoke all on function public.create_house_invitation(text, integer) from public;
revoke all on function public.respond_house_invitation(text, boolean) from public;
grant execute on function public.create_house_invitation(text, integer) to authenticated;
grant execute on function public.respond_house_invitation(text, boolean) to authenticated;
