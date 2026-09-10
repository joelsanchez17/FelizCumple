-- Posiciones elegidas para los objetos del rincón y confirmación explícita.

alter table public.house_story_corner
  add column if not exists placements jsonb not null default '{}'::jsonb
  check (jsonb_typeof(placements) = 'object');

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
    'placedItems', coalesce(to_jsonb(v_corner.placed_items), '[]'::jsonb),
    'placements', coalesce(v_corner.placements, '{}'::jsonb)
  );
end;
$$;

create or replace function public.place_house_story_item_at(p_event_key text, p_item text, p_slot text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_corner public.house_story_corner%rowtype;
begin
  if p_item not in ('blanket','cushion','light') then
    raise exception 'Objeto inválido' using errcode = '22023';
  end if;
  if p_slot not in ('left','center','right') or (p_item = 'light' and p_slot = 'center') then
    raise exception 'Posición inválida' using errcode = '22023';
  end if;
  select * into v_progress from public.house_story_progress where identity = v_caller;
  select * into v_corner from public.house_story_corner where identity = v_caller;
  if v_caller is null or v_progress.status <> 'active' or v_progress.chapter <> 3 or v_corner.corner is null then
    raise exception 'Primero hay que elegir un rincón' using errcode = '42501';
  end if;

  update public.house_story_corner
  set placed_items = case when p_item = any(placed_items) then placed_items else array_append(placed_items, p_item) end,
      placements = coalesce(placements, '{}'::jsonb) || jsonb_build_object(p_item, p_slot),
      updated_at = now()
  where identity = v_caller;

  return public.get_house_story_progress()
    || jsonb_build_object('eventKey', p_event_key, 'storyData', public.get_house_story_corner());
end;
$$;

create or replace function public.finish_house_story_corner(p_event_key text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller text := public.current_house_identity();
  v_progress public.house_story_progress%rowtype;
  v_corner public.house_story_corner%rowtype;
  v_result jsonb;
begin
  select * into v_progress from public.house_story_progress where identity = v_caller;
  if v_caller is null or v_progress.status <> 'active' then
    raise exception 'No se puede confirmar el rincón ahora' using errcode = '42501';
  end if;
  if v_progress.chapter >= 4 then
    return public.get_house_story_progress() || jsonb_build_object('repeated', true, 'storyData', public.get_house_story_corner());
  end if;
  select * into v_corner from public.house_story_corner where identity = v_caller;
  if v_progress.chapter <> 3
     or not (array['blanket','cushion','light']::text[] <@ v_corner.placed_items)
     or not (v_corner.placements ?& array['blanket','cushion','light']) then
    raise exception 'Todavía falta acomodar el rincón' using errcode = '22023';
  end if;

  perform public.advance_house_story(p_event_key || ':blanket','complete_step','{"step":"place_blanket"}'::jsonb);
  perform public.advance_house_story(p_event_key || ':cushion','complete_step','{"step":"place_cushion"}'::jsonb);
  v_result := public.advance_house_story(p_event_key || ':light','complete_step','{"step":"place_light"}'::jsonb);
  return v_result || jsonb_build_object('storyData', public.get_house_story_corner());
end;
$$;

revoke all on function public.place_house_story_item_at(text,text,text) from public;
revoke all on function public.finish_house_story_corner(text) from public;
grant execute on function public.place_house_story_item_at(text,text,text) to authenticated;
grant execute on function public.finish_house_story_corner(text) to authenticated;
