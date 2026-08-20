-- Agrega la calefacción a los objetos compartidos de la casita.
-- Ejecutar una sola vez después de 20260821010000_house_devices.sql.

alter table public.house_devices
  drop constraint if exists house_devices_device_check;

alter table public.house_devices
  add constraint house_devices_device_check
  check (device in ('window', 'ac', 'heater', 'lamp_joel', 'lamp_princesa', 'plant'));

insert into public.house_devices (device, state, updated_by)
values ('heater', '{"on": false}'::jsonb, 'joel')
on conflict (device) do nothing;
