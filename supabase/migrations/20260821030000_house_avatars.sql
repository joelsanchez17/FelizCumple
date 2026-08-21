-- Permite guardar la posición compartida de Joel y Princesa en la casita.
-- Es seguro volver a ejecutar este archivo.

alter table public.house_devices
  drop constraint if exists house_devices_device_check;

alter table public.house_devices
  add constraint house_devices_device_check
  check (device in (
    'window', 'ac', 'heater', 'lamp_joel', 'lamp_princesa', 'plant',
    'avatar_joel', 'avatar_princesa'
  ));

insert into public.house_devices (device, state, updated_by)
values
  ('avatar_joel', '{"x": 0, "y": 0}'::jsonb, 'joel'),
  ('avatar_princesa', '{"x": 0, "y": 0}'::jsonb, 'princesa')
on conflict (device) do nothing;
