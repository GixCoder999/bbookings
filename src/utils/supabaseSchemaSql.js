export const SUPABASE_SCHEMA_ASSUMPTIONS = [
  'users is implemented as a public profile table linked one-to-one with auth.users',
  'services include price for revenue analytics and buffer_mins for optional scheduling buffers',
  'analytics is implemented as a security-invoker view instead of a writable base table',
  'booking creation and owner approval flow are enforced through SQL functions for atomicity and consistency',
]

export const SUPABASE_SCHEMA_SQL = String.raw`
begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('owner', 'customer');
  end if;

  if not exists (select 1 from pg_type where typname = 'slot_status') then
    create type public.slot_status as enum ('available', 'booked', 'confirmed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.user_role not null,
  dark_mode boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint users_email_format_chk check (position('@' in email) > 1)
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users (id) on delete cascade,
  name text not null,
  description text,
  working_days text[] not null,
  start_time time not null,
  end_time time not null,
  timezone text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint businesses_name_len_chk check (char_length(trim(name)) between 2 and 120),
  constraint businesses_working_days_nonempty_chk check (cardinality(working_days) > 0),
  constraint businesses_working_days_valid_chk check (
    working_days <@ array[
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ]::text[]
  ),
  constraint businesses_hours_chk check (start_time < end_time)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  duration_mins integer not null,
  buffer_mins integer not null default 0,
  price numeric(10,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint services_name_len_chk check (char_length(trim(name)) between 2 and 120),
  constraint services_duration_chk check (duration_mins between 15 and 480),
  constraint services_buffer_chk check (buffer_mins between 0 and 120),
  constraint services_price_chk check (price >= 0),
  constraint services_business_name_unique unique (business_id, name),
  constraint services_id_business_unique unique (id, business_id)
);

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status public.slot_status not null default 'available',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint slots_service_fk
    foreign key (service_id, business_id)
    references public.services (id, business_id)
    on delete cascade,
  constraint slots_time_chk check (start_time < end_time),
  constraint slots_unique_start unique (service_id, date, start_time),
  constraint slots_unique_end unique (service_id, date, end_time)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'slots_no_overlap_excl'
  ) then
    alter table public.slots
      add constraint slots_no_overlap_excl
      exclude using gist (
        service_id with =,
        tsrange((date + start_time), (date + end_time), '[)') with &&
      );
  end if;
end
$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid unique references public.slots (id) on delete set null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  slot_date date not null,
  slot_start_time time not null,
  slot_end_time time not null,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_users_role on public.users (role);
create index if not exists idx_businesses_owner on public.businesses (owner_id);
create index if not exists idx_services_business on public.services (business_id);
create index if not exists idx_slots_service_date on public.slots (service_id, date, start_time);
create index if not exists idx_slots_business_status on public.slots (business_id, status);
create index if not exists idx_bookings_customer on public.bookings (customer_id, created_at desc);
create index if not exists idx_bookings_status on public.bookings (status, created_at desc);
create index if not exists idx_bookings_business on public.bookings (business_id, created_at desc);
create index if not exists idx_bookings_service_date on public.bookings (service_id, slot_date);

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_businesses_set_updated_at on public.businesses;
create trigger trg_businesses_set_updated_at
before update on public.businesses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_services_set_updated_at on public.services;
create trigger trg_services_set_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

drop trigger if exists trg_slots_set_updated_at on public.slots;
create trigger trg_slots_set_updated_at
before update on public.slots
for each row
execute function public.set_updated_at();

drop trigger if exists trg_bookings_set_updated_at on public.bookings;
create trigger trg_bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

create or replace function public.create_service_with_slots(
  p_business_id uuid,
  p_name text,
  p_description text,
  p_duration_mins integer,
  p_buffer_mins integer,
  p_price numeric
)
returns public.services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_business public.businesses;
  v_step_mins integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_business
  from public.businesses
  where id = p_business_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Not authorized to manage this business';
  end if;

  insert into public.services (
    business_id,
    name,
    description,
    duration_mins,
    buffer_mins,
    price
  )
  values (
    p_business_id,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_duration_mins,
    greatest(coalesce(p_buffer_mins, 0), 0),
    greatest(coalesce(p_price, 0), 0)
  )
  returning *
  into v_service;

  v_step_mins := greatest(p_duration_mins + greatest(coalesce(p_buffer_mins, 0), 0), 1);

  insert into public.slots (
    business_id,
    service_id,
    date,
    start_time,
    end_time,
    status
  )
  select
    p_business_id,
    v_service.id,
    day_cursor::date,
    slot_cursor::time,
    (slot_cursor + make_interval(mins => p_duration_mins))::time,
    'available'::public.slot_status
  from generate_series(current_date, current_date + 30, interval '1 day') as day_cursor
  cross join lateral generate_series(
    day_cursor::timestamp + v_business.start_time,
    day_cursor::timestamp + v_business.end_time - make_interval(mins => p_duration_mins),
    make_interval(mins => v_step_mins)
  ) as slot_cursor
  where trim(to_char(day_cursor, 'FMDay')) = any(v_business.working_days);

  return v_service;
end;
$$;

create or replace function public.request_booking(p_slot_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.slots;
  v_booking public.bookings;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role
  into v_role
  from public.users
  where id = auth.uid();

  if v_role is distinct from 'customer' then
    raise exception 'Only customers can request bookings';
  end if;

  select *
  into v_slot
  from public.slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if v_slot.status <> 'available' then
    raise exception 'Slot is not available';
  end if;

  if v_slot.date < current_date or v_slot.date > current_date + 30 then
    raise exception 'Booking date must be within the next 30 days';
  end if;

  insert into public.bookings (
    slot_id,
    business_id,
    service_id,
    customer_id,
    slot_date,
    slot_start_time,
    slot_end_time,
    status
  )
  values (
    v_slot.id,
    v_slot.business_id,
    v_slot.service_id,
    auth.uid(),
    v_slot.date,
    v_slot.start_time,
    v_slot.end_time,
    'pending'
  )
  returning *
  into v_booking;

  delete from public.slots
  where id = v_slot.id;

  return v_booking;
end;
$$;

create or replace function public.owner_set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_business_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('confirmed'::public.booking_status, 'cancelled'::public.booking_status) then
    raise exception 'Owners may only set confirmed or cancelled';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  select owner_id
  into v_business_owner
  from public.businesses
  where id = v_booking.business_id;

  if v_business_owner <> auth.uid() then
    raise exception 'You do not own this booking';
  end if;

  update public.bookings
  set status = p_status
  where id = v_booking.id
  returning *
  into v_booking;

  if p_status = 'cancelled' then
    insert into public.slots (
      business_id,
      service_id,
      date,
      start_time,
      end_time,
      status
    )
    values (
      v_booking.business_id,
      v_booking.service_id,
      v_booking.slot_date,
      v_booking.slot_start_time,
      v_booking.slot_end_time,
      'available'
    )
    on conflict (service_id, date, start_time) do nothing;
  end if;

  return v_booking;
end;
$$;

create or replace view public.analytics
with (security_invoker = true)
as
select
  bk.business_id,
  bk.service_id,
  coalesce(svc.name, 'Deleted service') as service_name,
  bk.slot_date as date,
  count(*) filter (where bk.status = 'pending') as pending_bookings,
  count(*) filter (where bk.status = 'confirmed') as confirmed_bookings,
  count(*) filter (where bk.status = 'cancelled') as cancelled_bookings,
  count(*) as total_bookings,
  coalesce(sum(case when bk.status = 'confirmed' then svc.price else 0 end), 0)::numeric(10,2) as revenue
from public.bookings bk
left join public.services svc on svc.id = bk.service_id
group by bk.business_id, bk.service_id, coalesce(svc.name, 'Deleted service'), bk.slot_date;

alter table public.users enable row level security;
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users
for insert
with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "businesses_public_read" on public.businesses;
create policy "businesses_public_read"
on public.businesses
for select
using (true);

drop policy if exists "businesses_owner_insert" on public.businesses;
create policy "businesses_owner_insert"
on public.businesses
for insert
with check (auth.uid() = owner_id);

drop policy if exists "businesses_owner_update" on public.businesses;
create policy "businesses_owner_update"
on public.businesses
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "businesses_owner_delete" on public.businesses;
create policy "businesses_owner_delete"
on public.businesses
for delete
using (auth.uid() = owner_id);

drop policy if exists "services_public_read" on public.services;
create policy "services_public_read"
on public.services
for select
using (true);

drop policy if exists "services_owner_insert" on public.services;
create policy "services_owner_insert"
on public.services
for insert
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "services_owner_update" on public.services;
create policy "services_owner_update"
on public.services
for update
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "services_owner_delete" on public.services;
create policy "services_owner_delete"
on public.services
for delete
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "slots_public_read" on public.slots;
create policy "slots_public_read"
on public.slots
for select
using (true);

drop policy if exists "slots_owner_insert" on public.slots;
create policy "slots_owner_insert"
on public.slots
for insert
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "slots_owner_update" on public.slots;
create policy "slots_owner_update"
on public.slots
for update
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "slots_owner_delete" on public.slots;
create policy "slots_owner_delete"
on public.slots
for delete
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "bookings_customer_read_own" on public.bookings;
create policy "bookings_customer_read_own"
on public.bookings
for select
using (customer_id = auth.uid());

drop policy if exists "bookings_owner_read_business" on public.bookings;
create policy "bookings_owner_read_business"
on public.bookings
for select
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
  )
);

revoke all on function public.create_service_with_slots(uuid, text, text, integer, integer, numeric) from public;
grant execute on function public.create_service_with_slots(uuid, text, text, integer, integer, numeric) to authenticated;

revoke all on function public.request_booking(uuid) from public;
grant execute on function public.request_booking(uuid) to authenticated;

revoke all on function public.owner_set_booking_status(uuid, public.booking_status) from public;
grant execute on function public.owner_set_booking_status(uuid, public.booking_status) to authenticated;

grant select on public.businesses to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.slots to anon, authenticated;
grant select on public.analytics to authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.slots to authenticated;
grant select on public.bookings to authenticated;

revoke insert, update, delete on public.bookings from anon, authenticated;

commit;
`

export default SUPABASE_SCHEMA_SQL
