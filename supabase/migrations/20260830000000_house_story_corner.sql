-- Elección persistente del rincón para el tercer capítulo privado.

create table if not exists public.house_story_corner (
  identity text primary key references public.house_story_progress(identity) on delete cascade,
  corner text not null check (corner in ('bed', 'sofa', 'window')),
  placed_items text[] not null default '{}'::text[] check (placed_items <@ array['blanket','cushion','light']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.house_story_corner enable row level security;
revoke all on public.house_story_corner from anon, authenticated;

create or replace function public.get_house_story_corner()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_control public.house_story_control%rowtype;
  v_corner public.house_story_corner%rowtype;
begin
  select * into v_control from public.house_story_control where singleton = true;
  if v_caller is null or not v_control.enabled or v_caller <> v_control.target_identity then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_corner from public.house_story_corner where identity = v_caller;
  return jsonb_build_object(
    'corner', v_corner.corner,
    'placedItems', coalesce(to_jsonb(v_corner.placed_items), '[]'::jsonb)
  );
end;
$$;

create or replace function public.choose_house_story_corner(p_event_key text, p_corner text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_result jsonb;
begin
  if p_corner not in ('bed', 'sofa', 'window') then
    raise exception 'Rincón inválido' using errcode = '22023';
  end if;
  select * into v_progress from public.house_story_progress where identity = v_caller;
  if v_caller is null or v_progress.status <> 'active' or v_progress.chapter <> 3 then
    raise exception 'No se puede elegir un rincón ahora' using errcode = '42501';
  end if;

  insert into public.house_story_corner(identity, corner)
  values (v_caller, p_corner)
  on conflict (identity) do update set corner = excluded.corner, updated_at = now();

  v_result := public.advance_house_story(
    p_event_key, 'complete_step', jsonb_build_object('step','choose_corner','value',p_corner)
  );
  return v_result || jsonb_build_object('storyData', public.get_house_story_corner());
end;
$$;

create or replace function public.place_house_story_item(p_event_key text, p_item text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_corner public.house_story_corner%rowtype;
  v_step text;
  v_result jsonb;
begin
  v_step := case p_item
    when 'blanket' then 'place_blanket'
    when 'cushion' then 'place_cushion'
    when 'light' then 'place_light'
    else null
  end;
  if v_step is null then raise exception 'Objeto inválido' using errcode = '22023'; end if;
  select * into v_progress from public.house_story_progress where identity = v_caller;
  select * into v_corner from public.house_story_corner where identity = v_caller;
  if v_caller is null or v_progress.status <> 'active' or v_progress.chapter <> 3 or v_corner.corner is null then
    raise exception 'Primero hay que elegir un rincón' using errcode = '42501';
  end if;

  update public.house_story_corner
  set placed_items = case when p_item = any(placed_items) then placed_items else array_append(placed_items, p_item) end,
      updated_at = now()
  where identity = v_caller;

  v_result := public.advance_house_story(
    p_event_key, 'complete_step', jsonb_build_object('step',v_step,'value',v_corner.corner)
  );
  return v_result || jsonb_build_object('storyData', public.get_house_story_corner());
end;
$$;

revoke all on function public.get_house_story_corner() from public;
revoke all on function public.choose_house_story_corner(text,text) from public;
revoke all on function public.place_house_story_item(text,text) from public;
grant execute on function public.get_house_story_corner() to authenticated;
grant execute on function public.choose_house_story_corner(text,text) to authenticated;
grant execute on function public.place_house_story_item(text,text) to authenticated;
