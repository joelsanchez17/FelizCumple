-- Motor privado, versionado e invisible para una experiencia futura.
-- No habilita ninguna pantalla: el lanzamiento se controla exclusivamente en servidor.

create table if not exists public.house_story_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  story_version integer not null default 1 check (story_version >= 1),
  target_identity text not null default 'princesa' check (target_identity in ('joel', 'princesa')),
  requirements jsonb not null default '{
    "1": ["signal_bedroom", "signal_kitchen", "signal_bathroom"],
    "2": ["care_plant", "prepare_breakfast", "warm_light"],
    "3": ["choose_corner", "place_blanket", "place_cushion", "place_light"]
  }'::jsonb check (jsonb_typeof(requirements) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.house_story_control (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.house_story_progress (
  identity text primary key check (identity in ('joel', 'princesa')),
  schema_version integer not null default 1 check (schema_version >= 0),
  story_version integer not null check (story_version >= 1),
  status text not null default 'not_started' check (status in ('not_started', 'active', 'completed')),
  chapter integer not null default 0 check (chapter between 0 and 4),
  solved_steps text[] not null default '{}'::text[],
  hints_used jsonb not null default '{}'::jsonb check (jsonb_typeof(hints_used) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.house_story_events (
  identity text not null check (identity in ('joel', 'princesa')),
  event_key text not null check (char_length(event_key) between 8 and 100),
  action text not null check (action in ('start', 'complete_step', 'use_hint', 'complete')),
  chapter integer not null check (chapter between 0 and 4),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (identity, event_key)
);

create index if not exists house_story_events_identity_created_idx
  on public.house_story_events (identity, created_at desc);

alter table public.house_story_control enable row level security;
alter table public.house_story_progress enable row level security;
alter table public.house_story_events enable row level security;

-- Sin políticas directas: incluso un miembro autenticado usa exclusivamente las RPC.
revoke all on public.house_story_control from anon, authenticated;
revoke all on public.house_story_progress from anon, authenticated;
revoke all on public.house_story_events from anon, authenticated;

create or replace function public.house_story_snapshot(p_identity text, p_repeated boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'available', true,
    'repeated', p_repeated,
    'schemaVersion', progress.schema_version,
    'storyVersion', progress.story_version,
    'status', progress.status,
    'chapter', progress.chapter,
    'solvedSteps', to_jsonb(progress.solved_steps),
    'hintsUsed', progress.hints_used,
    'revision', progress.revision,
    'startedAt', progress.started_at,
    'completedAt', progress.completed_at,
    'updatedAt', progress.updated_at
  )
  from public.house_story_progress progress
  where progress.identity = p_identity
$$;

create or replace function public.ensure_house_story_progress(p_identity text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_story_version integer;
  v_schema_version constant integer := 1;
begin
  select story_version into v_story_version
  from public.house_story_control
  where singleton = true;

  insert into public.house_story_progress (identity, schema_version, story_version)
  values (p_identity, v_schema_version, v_story_version)
  on conflict (identity) do nothing;

  -- Las migraciones compatibles conservan capítulo, pasos y pistas.
  update public.house_story_progress
  set schema_version = v_schema_version,
      story_version = v_story_version,
      solved_steps = coalesce(solved_steps, '{}'::text[]),
      hints_used = coalesce(hints_used, '{}'::jsonb),
      revision = revision + 1,
      updated_at = now()
  where identity = p_identity
    and (schema_version < v_schema_version or story_version < v_story_version);

  if exists (
    select 1 from public.house_story_progress
    where identity = p_identity
      and (schema_version > v_schema_version or story_version > v_story_version)
  ) then
    raise exception 'La versión guardada es más nueva que este motor' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_house_story_progress()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
begin
  if v_caller is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_control from public.house_story_control where singleton = true;
  if not v_control.enabled or v_caller <> v_control.target_identity then
    return jsonb_build_object('available', false);
  end if;

  perform public.ensure_house_story_progress(v_caller);
  return public.house_story_snapshot(v_caller);
end;
$$;

create or replace function public.advance_house_story(
  p_event_key text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_progress public.house_story_progress%rowtype;
  v_existing public.house_story_events%rowtype;
  v_step text;
  v_level integer;
  v_required jsonb;
  v_all_complete boolean;
begin
  if v_caller is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_event_key is null or char_length(p_event_key) not between 8 and 100 then
    raise exception 'Clave de evento inválida' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Datos de evento inválidos' using errcode = '22023';
  end if;

  select * into v_control from public.house_story_control where singleton = true for update;
  if not v_control.enabled or v_caller <> v_control.target_identity then
    raise exception 'Experiencia no disponible' using errcode = '42501';
  end if;

  perform public.ensure_house_story_progress(v_caller);
  select * into v_progress
  from public.house_story_progress
  where identity = v_caller
  for update;

  select * into v_existing
  from public.house_story_events
  where identity = v_caller and event_key = p_event_key;
  if found then
    if v_existing.action <> p_action or v_existing.payload <> p_payload then
      raise exception 'La clave de evento ya fue usada con otros datos' using errcode = '23505';
    end if;
    return public.house_story_snapshot(v_caller, true);
  end if;

  if p_action = 'start' then
    if v_progress.status = 'not_started' then
      update public.house_story_progress
      set status = 'active', chapter = 1, started_at = coalesce(started_at, now()),
          revision = revision + 1, updated_at = now()
      where identity = v_caller;
    end if;

  elsif p_action = 'use_hint' then
    if v_progress.status <> 'active' or v_progress.chapter not between 1 and 3 then
      raise exception 'No hay una pista disponible ahora' using errcode = '22023';
    end if;
    v_level := nullif(p_payload ->> 'level', '')::integer;
    if v_level not between 1 and 2 then
      raise exception 'Nivel de pista inválido' using errcode = '22023';
    end if;
    update public.house_story_progress
    set hints_used = jsonb_set(
          hints_used,
          array[v_progress.chapter::text],
          to_jsonb(greatest(coalesce((hints_used ->> v_progress.chapter::text)::integer, 0), v_level)),
          true
        ),
        revision = revision + 1,
        updated_at = now()
    where identity = v_caller;

  elsif p_action = 'complete_step' then
    if v_progress.status <> 'active' or v_progress.chapter not between 1 and 3 then
      raise exception 'No hay un desafío activo ahora' using errcode = '22023';
    end if;
    v_step := nullif(btrim(p_payload ->> 'step'), '');
    v_required := v_control.requirements -> v_progress.chapter::text;
    if v_step is null or v_required is null or not (v_required ? v_step) then
      raise exception 'Paso no válido para este capítulo' using errcode = '22023';
    end if;

    if not (v_step = any(v_progress.solved_steps)) then
      v_progress.solved_steps := array_append(v_progress.solved_steps, v_step);
    end if;
    select not exists (
      select 1 from jsonb_array_elements_text(v_required) required(step)
      where not (required.step = any(v_progress.solved_steps))
    ) into v_all_complete;

    update public.house_story_progress
    set solved_steps = v_progress.solved_steps,
        chapter = case when v_all_complete then chapter + 1 else chapter end,
        revision = revision + 1,
        updated_at = now()
    where identity = v_caller;

  elsif p_action = 'complete' then
    if v_progress.status <> 'active' or v_progress.chapter <> 4 then
      raise exception 'La historia todavía no puede completarse' using errcode = '22023';
    end if;
    update public.house_story_progress
    set status = 'completed', completed_at = now(), revision = revision + 1, updated_at = now()
    where identity = v_caller;

  else
    raise exception 'Acción desconocida' using errcode = '22023';
  end if;

  insert into public.house_story_events (identity, event_key, action, chapter, payload)
  values (v_caller, p_event_key, p_action, v_progress.chapter, p_payload);

  return public.house_story_snapshot(v_caller);
end;
$$;

create or replace function public.reset_house_story_progress(p_identity text default 'princesa')
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_house_identity() <> 'joel' then
    raise exception 'Solo el administrador de la casa puede reiniciar la historia' using errcode = '42501';
  end if;
  if p_identity not in ('joel', 'princesa') then
    raise exception 'Identidad inválida' using errcode = '22023';
  end if;

  delete from public.house_story_events where identity = p_identity;
  delete from public.house_story_progress where identity = p_identity;
  return true;
end;
$$;

revoke all on function public.house_story_snapshot(text, boolean) from public;
revoke all on function public.ensure_house_story_progress(text) from public;
revoke all on function public.get_house_story_progress() from public;
revoke all on function public.advance_house_story(text, text, jsonb) from public;
revoke all on function public.reset_house_story_progress(text) from public;

grant execute on function public.get_house_story_progress() to authenticated;
grant execute on function public.advance_house_story(text, text, jsonb) to authenticated;
grant execute on function public.reset_house_story_progress(text) to authenticated;
