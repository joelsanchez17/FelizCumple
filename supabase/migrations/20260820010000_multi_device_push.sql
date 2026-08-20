-- Permite que Joel y Princesa reciban notificaciones en más de un dispositivo
-- (iPhone, Android y Windows) sin que el último registro reemplace a los demás.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_identity_key;

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);
