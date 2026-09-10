begin;

create extension if not exists pgtap with schema extensions;

update public.house_story_control set enabled = false where singleton = true;

select plan(28);

set local role anon;

select throws_ok(
  $$ select public.get_house_story_progress() $$,
  '42501', null, 'anon cannot call the private story engine'
);
select throws_ok(
  $$ select count(*) from public.house_story_progress $$,
  '42501', null, 'anon cannot inspect private progress'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;

select is(
  (public.get_house_story_progress() ->> 'available')::boolean,
  false,
  'Joel does not receive an inactive private experience'
);
select throws_ok(
  $$ update public.house_story_control set enabled = true $$,
  '42501', null, 'authenticated clients cannot enable the experience'
);
select ok(public.reset_house_story_progress('princesa'), 'Joel can perform the private reset');

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

select is(
  (public.get_house_story_progress() ->> 'available')::boolean,
  false,
  'target cannot see the experience while the server flag is disabled'
);
select throws_ok(
  $$ select public.advance_house_story('event-disabled', 'start', '{}'::jsonb) $$,
  '42501', null, 'target cannot advance while the server flag is disabled'
);

reset role;
update public.house_story_control set enabled = true where singleton = true;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

select is(
  (public.get_house_story_progress() ->> 'available')::boolean,
  true,
  'server flag makes the experience available to its target'
);
select is(public.get_house_story_progress() ->> 'status', 'not_started', 'new progress starts cleanly');
select is(
  (public.advance_house_story('event-start-001', 'start', '{}'::jsonb) ->> 'chapter')::integer,
  1,
  'start opens the first chapter'
);
select is(
  (public.advance_house_story('event-start-001', 'start', '{}'::jsonb) ->> 'repeated')::boolean,
  true,
  'repeating the same event key is idempotent'
);
select is(
  (public.advance_house_story('event-start-001', 'start', '{}'::jsonb) ->> 'revision')::integer,
  1,
  'idempotent repetition does not change the revision'
);
select throws_ok(
  $$ select public.advance_house_story('event-start-001', 'use_hint', '{"level":1}'::jsonb) $$,
  '23505', null, 'an event key cannot be reused with different data'
);
select throws_ok(
  $$ select public.advance_house_story('event-invalid-step', 'complete_step', '{"step":"not_real"}'::jsonb) $$,
  '22023', null, 'unknown steps cannot advance a chapter'
);
select is(
  public.advance_house_story('event-hint-001', 'use_hint', '{"level":1}'::jsonb) #>> '{hintsUsed,1}',
  '1',
  'hint usage is persisted'
);
select is(
  (public.advance_house_story('event-step-001', 'complete_step', '{"step":"signal_bedroom"}'::jsonb) ->> 'chapter')::integer,
  1,
  'an incomplete challenge stays in its chapter'
);
select is(
  (public.advance_house_story('event-step-003', 'complete_step', '{"step":"signal_bathroom"}'::jsonb) ->> 'chapter')::integer,
  1,
  'missing requirements cannot be skipped'
);
select is(
  (public.advance_house_story('event-step-002', 'complete_step', '{"step":"signal_kitchen"}'::jsonb) ->> 'chapter')::integer,
  2,
  'the chapter advances automatically after every required step'
);
select is(
  (public.get_house_story_progress() ->> 'chapter')::integer,
  2,
  'a fresh read restores progress after reload or reconnection'
);
select is(
  jsonb_array_length(public.get_house_story_progress() -> 'solvedSteps'),
  3,
  'restored progress contains each solved step exactly once'
);

reset role;
update public.house_story_progress set schema_version = 0 where identity = 'princesa';
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

select is(
  (public.get_house_story_progress() ->> 'schemaVersion')::integer,
  1,
  'an older compatible schema migrates on recovery'
);
select is(
  (public.get_house_story_progress() ->> 'chapter')::integer,
  2,
  'schema migration preserves the current chapter'
);
select lives_ok(
  $$ select public.advance_house_story('event-care-001', 'complete_step', '{"step":"care_plant"}'::jsonb);
     select public.advance_house_story('event-care-002', 'complete_step', '{"step":"prepare_breakfast"}'::jsonb);
     select public.advance_house_story('event-care-003', 'complete_step', '{"step":"warm_light"}'::jsonb);
     select public.advance_house_story('event-place-001', 'complete_step', '{"step":"choose_corner"}'::jsonb);
     select public.advance_house_story('event-place-002', 'complete_step', '{"step":"place_blanket"}'::jsonb);
     select public.advance_house_story('event-place-003', 'complete_step', '{"step":"place_cushion"}'::jsonb);
     select public.advance_house_story('event-place-004', 'complete_step', '{"step":"place_light"}'::jsonb) $$,
  'all remaining valid steps can be applied after recovery'
);
select is(
  (public.get_house_story_progress() ->> 'chapter')::integer,
  4,
  'completing the challenges reaches the final chapter'
);
select is(
  public.advance_house_story('event-finish-001', 'complete', '{}'::jsonb) ->> 'status',
  'completed',
  'completion is persisted explicitly'
);
select throws_ok(
  $$ select public.reset_house_story_progress('princesa') $$,
  '42501', null, 'the target cannot reset private progress'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select ok(public.reset_house_story_progress('princesa'), 'Joel can recover the experience with a clean reset');

reset role;
select is(
  (select count(*)::integer from public.house_story_progress where identity = 'princesa'),
  0,
  'private reset removes progress without touching other house data'
);

select * from finish();
rollback;
