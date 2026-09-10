-- Cuidados compartidos y recuperables del cachorro.
-- La necesidad cambia con el tiempo, pero nunca bloquea acciones ni causa daño irreversible.

alter table public.house_story_companion
  add column if not exists last_watered_at timestamptz not null default now(),
  add column if not exists last_petted_at timestamptz not null default now(),
  add column if not exists last_played_at timestamptz not null default now();

alter table public.house_story_companion_events
  drop constraint if exists house_story_companion_events_action_check;
alter table public.house_story_companion_events
  add constraint house_story_companion_events_action_check
  check (action in ('name', 'move', 'sleep', 'care'));

create or replace function public.get_house_story_companion()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_companion public.house_story_companion%rowtype;
  v_hydration integer;
  v_affection integer;
  v_play integer;
  v_mood text;
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

  v_hydration := greatest(0, least(100, floor(100 - extract(epoch from (now() - v_companion.last_watered_at)) / 1080)))::integer;
  v_affection := greatest(0, least(100, floor(100 - extract(epoch from (now() - v_companion.last_petted_at)) / 1728)))::integer;
  v_play := greatest(0, least(100, floor(100 - extract(epoch from (now() - v_companion.last_played_at)) / 1296)))::integer;
  v_mood := case
    when v_companion.is_sleeping then 'sleeping'
    when v_hydration < 25 then 'thirsty'
    when v_affection < 25 then 'needs_cuddles'
    when v_play < 25 then 'bored'
    when least(v_hydration, v_affection, v_play) >= 75 then 'happy'
    else 'calm'
  end;

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
    'care', jsonb_build_object(
      'hydration', v_hydration,
      'affection', v_affection,
      'play', v_play,
      'mood', v_mood,
      'lastWateredAt', v_companion.last_watered_at,
      'lastPettedAt', v_companion.last_petted_at,
      'lastPlayedAt', v_companion.last_played_at,
      'checkedAt', now()
    ),
    'updatedAt', v_companion.updated_at
  );
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
  v_care text;
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
  elsif p_action = 'care' then
    v_care := p_payload ->> 'kind';
    if v_care not in ('water', 'affection', 'play') then
      raise exception 'Cuidado inválido' using errcode = '22023';
    end if;
    update public.house_story_companion
      set last_watered_at = case when v_care = 'water' then now() else last_watered_at end,
          last_petted_at = case when v_care = 'affection' then now() else last_petted_at end,
          last_played_at = case when v_care = 'play' then now() else last_played_at end,
          updated_at = now()
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
