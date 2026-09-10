-- Estado persistente de la transición final; la recompensa se integra después.

create table if not exists public.house_story_door (
  identity text primary key references public.house_story_progress(identity) on delete cascade,
  opened boolean not null default false,
  opened_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.house_story_door enable row level security;
revoke all on public.house_story_door from anon, authenticated;

create or replace function public.get_house_story_door()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_progress public.house_story_progress%rowtype;
  v_door public.house_story_door%rowtype;
begin
  select * into v_control from public.house_story_control where singleton = true;
  select * into v_progress from public.house_story_progress where identity = v_caller;
  if v_caller is null or not v_control.enabled or v_caller <> v_control.target_identity or v_progress.chapter < 4 then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_door from public.house_story_door where identity = v_caller;
  return jsonb_build_object(
    'opened', coalesce(v_door.opened, false),
    'openedAt', v_door.opened_at
  );
end;
$$;

create or replace function public.open_house_story_door(p_event_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_was_open boolean;
begin
  select * into v_progress from public.house_story_progress where identity = v_caller;
  if v_caller is null or v_progress.status <> 'active' or v_progress.chapter <> 4 then
    raise exception 'La puerta todavía no puede abrirse' using errcode = '42501';
  end if;
  select opened into v_was_open from public.house_story_door where identity = v_caller;
  insert into public.house_story_door(identity, opened, opened_at)
  values (v_caller, true, now())
  on conflict (identity) do update
    set opened = true,
        opened_at = coalesce(public.house_story_door.opened_at, excluded.opened_at),
        updated_at = now();
  return public.get_house_story_progress()
    || jsonb_build_object('repeated', coalesce(v_was_open, false), 'storyData', public.get_house_story_door(), 'eventKey', p_event_key);
end;
$$;

revoke all on function public.get_house_story_door() from public;
revoke all on function public.open_house_story_door(text) from public;
grant execute on function public.get_house_story_door() to authenticated;
grant execute on function public.open_house_story_door(text) to authenticated;
