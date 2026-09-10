-- Primera vida permanente del nuevo habitante: nombre, cuarto y descanso.

alter table public.house_story_companion
  add column if not exists current_room text not null default 'bedroom'
    check (current_room in ('bedroom', 'kitchen', 'bathroom', 'dining')),
  add column if not exists is_sleeping boolean not null default false,
  add column if not exists named_at timestamptz;

create table if not exists public.house_story_companion_events (
  identity text not null references public.house_story_companion(identity) on delete cascade,
  event_key text not null,
  actor_identity text not null check (actor_identity in ('joel', 'princesa')),
  action text not null check (action in ('name', 'move', 'sleep')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (identity, event_key)
);

alter table public.house_story_companion_events enable row level security;
revoke all on public.house_story_companion_events from anon, authenticated;

create or replace function public.get_house_story_companion()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_companion public.house_story_companion%rowtype;
begin
  if v_caller is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_control from public.house_story_control where singleton = true;
  select * into v_companion from public.house_story_companion where identity = v_control.target_identity;
  if not found then
    if v_caller <> v_control.target_identity then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    return jsonb_build_object('revealed', false, 'growthStage', 0, 'stageName', 'tiny');
  end if;

  return jsonb_build_object(
    'revealed', true,
    'revealedAt', v_companion.revealed_at,
    'growthStartedAt', v_companion.growth_started_at,
    'growthStage', v_companion.growth_stage,
    'stageName', case v_companion.growth_stage
      when 0 then 'tiny' when 1 then 'puppy' when 2 then 'young' when 3 then 'adolescent' else 'grown'
    end,
    'ageDays', greatest(0, floor(extract(epoch from (now() - v_companion.growth_started_at)) / 86400))::integer,
    'name', v_companion.name,
    'namedAt', v_companion.named_at,
    'currentRoom', v_companion.current_room,
    'isSleeping', v_companion.is_sleeping,
    'updatedAt', v_companion.updated_at
  );
end;
$$;

create or replace function public.reveal_house_story_companion(p_event_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_door public.house_story_door%rowtype;
  v_existing public.house_story_companion%rowtype;
  v_corner text;
  v_room text := 'bedroom';
  v_result jsonb;
begin
  select * into v_progress from public.house_story_progress where identity = v_caller for update;
  select * into v_existing from public.house_story_companion where identity = v_caller;
  if found then
    return public.house_story_snapshot(v_caller, true)
      || jsonb_build_object('storyData', public.get_house_story_companion(), 'eventKey', p_event_key);
  end if;
  if v_caller is null or v_progress.status <> 'active' or v_progress.chapter <> 4 then
    raise exception 'La llegada todavía no puede comenzar' using errcode = '42501';
  end if;
  select * into v_door from public.house_story_door where identity = v_caller;
  if not coalesce(v_door.opened, false) then
    raise exception 'La puerta todavía está cerrada' using errcode = '42501';
  end if;

  select corner into v_corner from public.house_story_corner where identity = v_caller;
  if v_corner = 'sofa' then v_room := 'dining'; end if;
  insert into public.house_story_companion(identity, current_room)
  values (v_caller, v_room)
  on conflict (identity) do nothing;

  v_result := public.advance_house_story(
    p_event_key,
    'complete',
    '{"reward":"companion_arrival"}'::jsonb
  );
  return v_result || jsonb_build_object('storyData', public.get_house_story_companion());
end;
$$;

create or replace function public.update_house_story_companion(
  p_event_key text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_companion public.house_story_companion%rowtype;
  v_existing public.house_story_companion_events%rowtype;
  v_name text;
  v_room text;
  v_sleep boolean;
begin
  if v_caller is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_event_key is null or char_length(p_event_key) not between 8 and 100 then
    raise exception 'Clave de evento inválida' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Datos de evento inválidos' using errcode = '22023';
  end if;

  select * into v_control from public.house_story_control where singleton = true;
  select * into v_companion from public.house_story_companion
    where identity = v_control.target_identity for update;
  if not found then raise exception 'El nuevo habitante todavía no llegó' using errcode = '42501'; end if;

  select * into v_existing from public.house_story_companion_events
    where identity = v_companion.identity and event_key = p_event_key;
  if found then
    if v_existing.action <> p_action or v_existing.payload <> p_payload then
      raise exception 'La clave de evento ya fue usada con otros datos' using errcode = '23505';
    end if;
    return jsonb_build_object('repeated', true, 'eventKey', p_event_key, 'storyData', public.get_house_story_companion());
  end if;

  if p_action = 'name' then
    v_name := nullif(btrim(p_payload ->> 'name'), '');
    if v_name is null or char_length(v_name) > 30 then
      raise exception 'Nombre inválido' using errcode = '22023';
    end if;
    update public.house_story_companion
      set name = v_name, named_at = coalesce(named_at, now()), updated_at = now()
      where identity = v_companion.identity;
  elsif p_action = 'move' then
    v_room := p_payload ->> 'room';
    if v_room not in ('bedroom', 'kitchen', 'bathroom', 'dining') then
      raise exception 'Habitación inválida' using errcode = '22023';
    end if;
    update public.house_story_companion
      set current_room = v_room, is_sleeping = false, updated_at = now()
      where identity = v_companion.identity;
  elsif p_action = 'sleep' then
    if jsonb_typeof(p_payload -> 'sleeping') <> 'boolean' then
      raise exception 'Estado de descanso inválido' using errcode = '22023';
    end if;
    v_sleep := (p_payload ->> 'sleeping')::boolean;
    update public.house_story_companion
      set is_sleeping = v_sleep, updated_at = now()
      where identity = v_companion.identity;
  else
    raise exception 'Acción desconocida' using errcode = '22023';
  end if;

  insert into public.house_story_companion_events(identity,event_key,actor_identity,action,payload)
  values (v_companion.identity,p_event_key,v_caller,p_action,p_payload);
  return jsonb_build_object('repeated', false, 'eventKey', p_event_key, 'storyData', public.get_house_story_companion());
end;
$$;

revoke all on function public.update_house_story_companion(text,text,jsonb) from public;
grant execute on function public.update_house_story_companion(text,text,jsonb) to authenticated;
