-- Llegada persistente del nuevo habitante y base para un crecimiento lento.

create table if not exists public.house_story_companion (
  identity text primary key references public.house_story_progress(identity) on delete cascade,
  revealed_at timestamptz not null default now(),
  growth_started_at timestamptz not null default now(),
  growth_stage smallint not null default 0 check (growth_stage between 0 and 4),
  name text check (name is null or char_length(btrim(name)) between 1 and 30),
  updated_at timestamptz not null default now()
);

alter table public.house_story_companion enable row level security;
revoke all on public.house_story_companion from anon, authenticated;

create or replace function public.get_house_story_companion()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_progress public.house_story_progress%rowtype;
  v_companion public.house_story_companion%rowtype;
begin
  select * into v_control from public.house_story_control where singleton = true;
  select * into v_progress from public.house_story_progress where identity = v_caller;
  if v_caller is null or not v_control.enabled or v_caller <> v_control.target_identity or v_progress.chapter < 4 then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_companion from public.house_story_companion where identity = v_caller;
  if not found then
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
    'name', v_companion.name
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

  insert into public.house_story_companion(identity)
  values (v_caller)
  on conflict (identity) do nothing;

  v_result := public.advance_house_story(
    p_event_key,
    'complete',
    '{"reward":"companion_arrival"}'::jsonb
  );
  return v_result || jsonb_build_object('storyData', public.get_house_story_companion());
end;
$$;

revoke all on function public.get_house_story_companion() from public;
revoke all on function public.reveal_house_story_companion(text) from public;
grant execute on function public.get_house_story_companion() to authenticated;
grant execute on function public.reveal_house_story_companion(text) to authenticated;
