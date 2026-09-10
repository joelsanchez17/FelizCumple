-- Broadcast y presencia de la casita requieren una sesión miembro.
-- Postgres Changes conserva además el filtro RLS de cada tabla.

drop policy if exists "members can receive house realtime" on realtime.messages;
drop policy if exists "members can send house realtime" on realtime.messages;

create policy "members can receive house realtime"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() = 'room_amor'
    and public.is_house_member()
  );

create policy "members can send house realtime"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() = 'room_amor'
    and public.is_house_member()
  );
