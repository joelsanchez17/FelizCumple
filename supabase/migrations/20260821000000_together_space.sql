-- Nuestra casa, estados del corazón y diario compartido.
-- Es seguro volver a ejecutar este archivo.

create table if not exists public.house_notes (
  id uuid primary key default gen_random_uuid(),
  from_identity text not null check (from_identity in ('joel', 'princesa')),
  to_identity text not null check (to_identity in ('joel', 'princesa')),
  body text not null check (char_length(body) between 1 and 180),
  is_read boolean not null default false,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_identity <> to_identity)
);

create table if not exists public.heart_states (
  identity text primary key check (identity in ('joel', 'princesa')),
  mood text not null check (mood in ('happy', 'tired', 'miss_you', 'need_hug', 'talk', 'proud')),
  notified_at timestamptz,
  journaled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.heart_states add column if not exists notified_at timestamptz;
alter table public.heart_states add column if not exists journaled_at timestamptz;

create table if not exists public.love_journal (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  from_identity text not null check (from_identity in ('joel', 'princesa')),
  event_type text not null check (event_type in ('drawing', 'mimo', 'note', 'heart')),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 240),
  drawing_id uuid references public.drawings(id) on delete set null,
  note_id uuid references public.house_notes(id) on delete set null,
  is_favorite boolean not null default false,
  comment text check (comment is null or char_length(comment) <= 180),
  created_at timestamptz not null default now()
);

create index if not exists house_notes_people_created_idx
  on public.house_notes (to_identity, created_at desc);
create index if not exists heart_states_updated_idx
  on public.heart_states (updated_at desc);
create index if not exists love_journal_created_idx
  on public.love_journal (created_at desc);
create index if not exists love_journal_type_created_idx
  on public.love_journal (event_type, created_at desc);

alter table public.house_notes enable row level security;
alter table public.heart_states enable row level security;
alter table public.love_journal enable row level security;

drop policy if exists "couple can read house notes" on public.house_notes;
drop policy if exists "couple can leave house notes" on public.house_notes;
drop policy if exists "couple can update house notes" on public.house_notes;
create policy "couple can read house notes"
  on public.house_notes for select to anon, authenticated using (true);
create policy "couple can leave house notes"
  on public.house_notes for insert to anon, authenticated
  with check (from_identity in ('joel', 'princesa') and to_identity in ('joel', 'princesa') and from_identity <> to_identity);
create policy "couple can update house notes"
  on public.house_notes for update to anon, authenticated using (true) with check (true);

drop policy if exists "couple can read heart states" on public.heart_states;
drop policy if exists "couple can set heart states" on public.heart_states;
drop policy if exists "couple can update heart states" on public.heart_states;
drop policy if exists "couple can clear heart states" on public.heart_states;
create policy "couple can read heart states"
  on public.heart_states for select to anon, authenticated using (true);
create policy "couple can set heart states"
  on public.heart_states for insert to anon, authenticated
  with check (identity in ('joel', 'princesa'));
create policy "couple can update heart states"
  on public.heart_states for update to anon, authenticated using (true)
  with check (identity in ('joel', 'princesa'));
create policy "couple can clear heart states"
  on public.heart_states for delete to anon, authenticated using (true);

drop policy if exists "couple can read journal" on public.love_journal;
drop policy if exists "couple can add journal moments" on public.love_journal;
drop policy if exists "couple can update journal moments" on public.love_journal;
create policy "couple can read journal"
  on public.love_journal for select to anon, authenticated using (true);
create policy "couple can add journal moments"
  on public.love_journal for insert to anon, authenticated
  with check (from_identity in ('joel', 'princesa'));
create policy "couple can update journal moments"
  on public.love_journal for update to anon, authenticated using (true) with check (true);

create or replace function public.journal_from_drawing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.love_journal (
    event_key, from_identity, event_type, title, body, drawing_id, created_at
  ) values (
    'drawing:' || new.id,
    new.from_identity,
    'drawing',
    case when new.from_identity = 'joel' then 'Joel dejó un dibujo' else 'Princesa dejó un dibujo' end,
    'Un pedacito hecho a mano para el otro.',
    new.id,
    new.created_at
  ) on conflict (event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists drawings_to_love_journal on public.drawings;
create trigger drawings_to_love_journal
after insert on public.drawings
for each row execute function public.journal_from_drawing();

create or replace function public.journal_from_house_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.love_journal (
    event_key, from_identity, event_type, title, body, note_id, created_at
  ) values (
    'note:' || new.id,
    new.from_identity,
    'note',
    case when new.from_identity = 'joel' then 'Joel dejó una nota en casa' else 'Princesa dejó una nota en casa' end,
    new.body,
    new.id,
    new.created_at
  ) on conflict (event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notes_to_love_journal on public.house_notes;
create trigger notes_to_love_journal
after insert on public.house_notes
for each row execute function public.journal_from_house_note();

-- Agrega al diario los dibujos que ya existían antes de esta función.
insert into public.love_journal (
  event_key, from_identity, event_type, title, body, drawing_id, created_at
)
select
  'drawing:' || d.id,
  d.from_identity,
  'drawing',
  case when d.from_identity = 'joel' then 'Joel dejó un dibujo' else 'Princesa dejó un dibujo' end,
  'Un pedacito hecho a mano para el otro.',
  d.id,
  d.created_at
from public.drawings d
on conflict (event_key) do nothing;

-- Realtime: solo se agrega cada tabla si todavía no pertenece a la publicación.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'house_notes'
  ) then alter publication supabase_realtime add table public.house_notes; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'heart_states'
  ) then alter publication supabase_realtime add table public.heart_states; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'love_journal'
  ) then alter publication supabase_realtime add table public.love_journal; end if;
end $$;
