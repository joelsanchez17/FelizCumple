-- Datos de desarrollo opcionales.
-- Mantener este archivo libre de información personal y secretos.

-- Cuentas estrictamente locales. No reutilizar estos correos ni esta contraseña.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'joel.local@casita.test',
    extensions.crypt('casita-local-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'princesa.local@casita.test',
    extensions.crypt('casita-local-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', false, false
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  (
    '31111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"joel.local@casita.test"}',
    'email', now(), now(), now()
  ),
  (
    '32222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"princesa.local@casita.test"}',
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.house_members (user_id, identity)
values
  ('11111111-1111-4111-8111-111111111111', 'joel'),
  ('22222222-2222-4222-8222-222222222222', 'princesa')
on conflict (user_id) do update set identity = excluded.identity;

-- La experiencia se habilita solo en Supabase local para la vista previa privada.
update public.house_story_control set enabled = true where singleton = true;
