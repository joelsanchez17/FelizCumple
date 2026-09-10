begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
update public.house_story_control set enabled = true where singleton = true;

set local role anon;
select throws_ok($$ select public.get_house_story_door() $$,'42501',null,'anon cannot inspect the final door');

reset role; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); set local role authenticated;
select lives_ok($$
  select public.advance_house_story('door-start','start','{}');
  select public.advance_house_story('door-c1-1','complete_step','{"step":"signal_bedroom"}');
  select public.advance_house_story('door-c1-2','complete_step','{"step":"signal_kitchen"}');
  select public.advance_house_story('door-c1-3','complete_step','{"step":"signal_bathroom"}');
  select public.advance_house_story('door-c2-1','complete_step','{"step":"care_plant"}');
  select public.advance_house_story('door-c2-2','complete_step','{"step":"prepare_breakfast"}');
  select public.advance_house_story('door-c2-3','complete_step','{"step":"warm_light"}');
  select public.choose_house_story_corner('door-c3-choice','sofa');
  select public.place_house_story_item('door-c3-1','blanket');
  select public.place_house_story_item('door-c3-2','cushion');
  select public.place_house_story_item('door-c3-3','light')
$$,'the prior route reaches chapter four');
select is((public.get_house_story_door()->>'opened')::boolean,false,'the door starts closed');
select is((public.open_house_story_door('door-open-1') #>> '{storyData,opened}')::boolean,true,'opening is persisted');
select is((public.open_house_story_door('door-open-1')->>'repeated')::boolean,true,'opening twice is idempotent');
select ok((public.get_house_story_door()->>'openedAt') is not null,'the first opening time is retained');
select throws_ok($$ select count(*) from public.house_story_door $$,'42501',null,'clients cannot inspect door storage directly');

select * from finish(); rollback;
