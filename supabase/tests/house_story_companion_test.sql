begin;
create extension if not exists pgtap with schema extensions;
select plan(11);
update public.house_story_control set enabled=true,target_identity='princesa' where singleton=true;

set local role anon;
select throws_ok($$ select public.get_house_story_companion() $$,'42501',null,'anon cannot inspect the companion');
reset role;

reset role; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); set local role authenticated;
select lives_ok($$
  select public.advance_house_story('pup-start','start','{}');
  select public.advance_house_story('pup-c1-01','complete_step','{"step":"signal_bedroom"}');
  select public.advance_house_story('pup-c1-02','complete_step','{"step":"signal_kitchen"}');
  select public.advance_house_story('pup-c1-03','complete_step','{"step":"signal_bathroom"}');
  select public.advance_house_story('pup-c2-01','complete_step','{"step":"care_plant"}');
  select public.advance_house_story('pup-c2-02','complete_step','{"step":"prepare_breakfast"}');
  select public.advance_house_story('pup-c2-03','complete_step','{"step":"warm_light"}');
  select public.choose_house_story_corner('pup-c3-01','sofa');
  select public.place_house_story_item('pup-c3-02','blanket');
  select public.place_house_story_item('pup-c3-03','cushion');
  select public.place_house_story_item('pup-c3-04','light')
$$,'the existing route reaches chapter four');

select is((public.get_house_story_companion()->>'revealed')::boolean,false,'the companion starts hidden');
select throws_ok($$ select public.reveal_house_story_companion('pup-reveal-closed') $$,'42501',null,'a closed door blocks the reveal');
select lives_ok($$ select public.open_house_story_door('pup-door-open') $$,'the final door opens first');
select is((public.reveal_house_story_companion('pup-reveal-01') #>> '{storyData,revealed}')::boolean,true,'the tiny companion arrives');
select is(public.get_house_story_progress()->>'status','completed','the reveal completes the story');
select is((public.reveal_house_story_companion('pup-reveal-01')->>'repeated')::boolean,true,'repeating the reveal is idempotent');
select is(public.get_house_story_companion()->>'stageName','tiny','the first persisted growth stage is tiny');
select ok((public.get_house_story_companion()->>'revealedAt') is not null,'the arrival time is retained');
select throws_ok($$ select count(*) from public.house_story_companion $$,'42501',null,'clients cannot inspect companion storage directly');

select * from finish();
rollback;
