begin;
create extension if not exists pgtap with schema extensions;
select plan(23);
update public.house_story_control set enabled=true,target_identity='princesa' where singleton=true;

set local role anon;
select throws_ok($$ select public.update_house_story_companion('anon-event','sleep','{"sleeping":true}') $$,'42501',null,'anon cannot change the companion');

reset role; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); set local role authenticated;
select lives_ok($$
  select public.advance_house_story('home-start','start','{}');
  select public.advance_house_story('home-c1-01','complete_step','{"step":"signal_bedroom"}');
  select public.advance_house_story('home-c1-02','complete_step','{"step":"signal_kitchen"}');
  select public.advance_house_story('home-c1-03','complete_step','{"step":"signal_bathroom"}');
  select public.advance_house_story('home-c2-01','complete_step','{"step":"care_plant"}');
  select public.advance_house_story('home-c2-02','complete_step','{"step":"prepare_breakfast"}');
  select public.advance_house_story('home-c2-03','complete_step','{"step":"warm_light"}');
  select public.choose_house_story_corner('home-c3-01','sofa');
  select public.place_house_story_item('home-c3-02','blanket');
  select public.place_house_story_item('home-c3-03','cushion');
  select public.place_house_story_item('home-c3-04','light');
  select public.open_house_story_door('home-door');
  select public.reveal_house_story_companion('home-reveal')
$$,'the companion is revealed after the complete route');
select is(public.get_house_story_companion()->>'currentRoom','dining','the chosen sofa becomes the initial room');
select is(public.update_house_story_companion('home-name-01','name','{"name":"Nube"}') #>> '{storyData,name}','Nube','Princesa can name the puppy');
select is(public.update_house_story_companion('home-move-01','move','{"room":"kitchen"}') #>> '{storyData,currentRoom}','kitchen','Princesa can call it into another room');
select is((public.update_house_story_companion('home-sleep-01','sleep','{"sleeping":true}') #>> '{storyData,isSleeping}')::boolean,true,'the puppy can fall asleep');
select is((public.update_house_story_companion('home-sleep-01','sleep','{"sleeping":true}')->>'repeated')::boolean,true,'sleep retries are idempotent');
select throws_ok($$ select public.update_house_story_companion('home-sleep-01','sleep','{"sleeping":false}') $$,'23505',null,'an event key cannot be reused with another payload');
select throws_ok($$ select public.update_house_story_companion('home-room-bad','move','{"room":"roof"}') $$,'22023',null,'invalid rooms are rejected');
select throws_ok($$ select public.update_house_story_companion('home-name-bad','name','{"name":""}') $$,'22023',null,'empty names are rejected');
select ok((public.update_house_story_companion('home-care-water','care','{"kind":"water"}') #>> '{storyData,care,hydration}')::integer >= 99,'water restores hydration');
select ok((public.update_house_story_companion('home-care-love','care','{"kind":"affection"}') #>> '{storyData,care,affection}')::integer >= 99,'affection restores cuddles');
select ok((public.update_house_story_companion('home-care-play','care','{"kind":"play"}') #>> '{storyData,care,play}')::integer >= 99,'play restores fun');
select is((public.update_house_story_companion('home-care-play','care','{"kind":"play"}')->>'repeated')::boolean,true,'care retries are idempotent');
select throws_ok($$ select public.update_house_story_companion('home-care-bad','care','{"kind":"food"}') $$,'22023',null,'unknown care is rejected');
reset role;
select is((select count(*)::integer from public.house_story_companion_events),6,'only successful unique actions are recorded');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); set local role authenticated;

reset role; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true); set local role authenticated;
select is(public.get_house_story_companion()->>'name','Nube','Joel sees the same named puppy');
select is((public.get_house_story_companion()->>'isSleeping')::boolean,true,'Joel sees its shared sleep state');
select is(public.update_house_story_companion('home-wake-joel','sleep','{"sleeping":false}') #>> '{storyData,isSleeping}','false','Joel can wake it');
select is(public.update_house_story_companion('home-move-joel','move','{"room":"bedroom"}') #>> '{storyData,currentRoom}','bedroom','Joel can call it too');
select throws_ok($$ select count(*) from public.house_story_companion_events $$,'42501',null,'clients cannot inspect companion events directly');
select ok((public.get_house_story_companion()->>'growthStartedAt') is not null,'growth timing survives shared actions');
select ok((public.get_house_story_companion() #>> '{care,mood}') in ('happy','calm'),'Joel sees the shared care mood');

select * from finish();
rollback;
