begin;
create extension if not exists pgtap with schema extensions;
select plan(18);
update public.house_story_control set enabled = true where singleton = true;

set local role anon;
select throws_ok($$ select public.get_house_story_corner() $$,'42501',null,'anon cannot read the private corner');

reset role; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); set local role authenticated;
select lives_ok($$
  select public.advance_house_story('corner-start-001','start','{}');
  select public.advance_house_story('corner-c1-001','complete_step','{"step":"signal_bedroom"}');
  select public.advance_house_story('corner-c1-002','complete_step','{"step":"signal_kitchen"}');
  select public.advance_house_story('corner-c1-003','complete_step','{"step":"signal_bathroom"}');
  select public.advance_house_story('corner-c2-001','complete_step','{"step":"care_plant"}');
  select public.advance_house_story('corner-c2-002','complete_step','{"step":"prepare_breakfast"}');
  select public.advance_house_story('corner-c2-003','complete_step','{"step":"warm_light"}')
$$,'valid prior chapters reach chapter three');
select throws_ok($$ select public.place_house_story_item_at('corner-place-000','blanket','left') $$,'42501',null,'an item cannot be placed before choosing');
select throws_ok($$ select public.choose_house_story_corner('corner-choice-000','roof') $$,'22023',null,'invalid corners are rejected');
select is(public.choose_house_story_corner('corner-choice-001','sofa') #>> '{storyData,corner}','sofa','a valid corner is persisted');
select throws_ok($$ select count(*) from public.house_story_corner $$,'42501',null,'clients cannot inspect corner storage directly');
select is((public.choose_house_story_corner('corner-choice-001','sofa')->>'repeated')::boolean,true,'repeating a choice event is idempotent');
select is(jsonb_array_length(public.place_house_story_item_at('corner-item-001','blanket','left') #> '{storyData,placedItems}'),1,'the first item is persisted');
select is(public.get_house_story_corner() #>> '{placements,blanket}','left','the chosen position is persisted');
select is(jsonb_array_length(public.choose_house_story_corner('corner-choice-002','bed') #> '{storyData,placedItems}'),1,'changing corner preserves placed items');
select throws_ok($$ select public.place_house_story_item_at('corner-item-invalid','light','center') $$,'22023',null,'the lamp only accepts a side position');
select lives_ok($$ select public.place_house_story_item_at('corner-item-002','cushion','right'); select public.place_house_story_item_at('corner-item-003','light','left') $$,'remaining items can be positioned');
select is((public.get_house_story_progress()->>'chapter')::integer,3,'placing all objects waits for explicit confirmation');
select is(public.place_house_story_item_at('corner-item-004','blanket','right') #>> '{storyData,placements,blanket}','right','an object can be repositioned before confirming');
select is((public.finish_house_story_corner('corner-finish-001')->>'chapter')::integer,4,'confirming the prepared corner advances to chapter four');
select is((public.finish_house_story_corner('corner-finish-001')->>'repeated')::boolean,true,'confirming twice is idempotent');
select is(public.get_house_story_corner()->>'corner','bed','corner choice survives a fresh read');

reset role; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true); set local role authenticated;
select ok(public.reset_house_story_progress('princesa'),'Joel can reset chapter three data by resetting progress');
select * from finish(); rollback;
