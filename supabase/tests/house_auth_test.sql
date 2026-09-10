begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

set local role anon;

select is((select count(*)::integer from public.house_members), 0, 'anon cannot read memberships');
select is((select count(*)::integer from public.house_notes), 0, 'anon cannot read shared notes');
select throws_ok(
  $$ insert into public.heart_states (identity, mood) values ('joel', 'happy') $$,
  '42501', null, 'anon cannot write heart state'
);
select is(
  (select count(*)::integer from realtime.messages where topic = 'room_amor'),
  0,
  'anon cannot read house realtime'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;

select is(public.current_house_identity(), 'joel', 'JWT resolves Joel membership');
select lives_ok(
  $$ insert into public.heart_states (identity, mood) values ('joel', 'happy') $$,
  'Joel can write his own heart state'
);
select throws_ok(
  $$ insert into public.heart_states (identity, mood) values ('princesa', 'happy') $$,
  '42501', null, 'Joel cannot write Princesa heart state'
);
select lives_ok(
  $$ insert into public.house_notes (from_identity, to_identity, body) values ('joel', 'princesa', 'Prueba local') $$,
  'Joel can leave his own note'
);
select lives_ok(
  $$ select set_config('realtime.topic', 'room_amor', true);
     insert into realtime.messages (topic, extension, event, payload, private)
     values ('room_amor', 'broadcast', 'auth-test', '{}'::jsonb, true) $$,
  'Joel can send private house realtime'
);
select is(
  public.create_house_invitation('lie_together') ->> 'from',
  'joel',
  'server creates invitation as authenticated sender'
);
select throws_ok(
  $$ update public.house_device_states
     set state = state || '{"status":"accepted"}'::jsonb, updated_by = 'joel'
     where room_id = 'bedroom' and device_id = 'shared_invitation' $$,
  '42501', null, 'client cannot directly change shared invitation'
);
select throws_ok(
  $$ select public.respond_house_invitation(
       (select state ->> 'id' from public.house_device_states where room_id = 'bedroom' and device_id = 'shared_invitation'),
       true
     ) $$,
  '42501', null, 'sender cannot accept own invitation'
);
select throws_ok(
  $$ insert into public.house_notes (from_identity, to_identity, body) values ('princesa', 'joel', 'Suplantación') $$,
  '42501', null, 'Joel cannot impersonate Princesa'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

select is(public.current_house_identity(), 'princesa', 'JWT resolves Princesa membership');
select is(
  (select count(*)::integer from public.house_notes where to_identity = 'princesa'),
  1,
  'Princesa can read the shared note'
);
select is(
  public.respond_house_invitation(
    (select state ->> 'id' from public.house_device_states where room_id = 'bedroom' and device_id = 'shared_invitation'),
    true
  ) ->> 'status',
  'accepted',
  'recipient can accept invitation'
);
select is(
  (select count(*)::integer from public.house_activities
   where identity in ('joel', 'princesa') and activity = 'lying'),
  2,
  'accepted invitation creates both activities atomically'
);

select * from finish();
rollback;
