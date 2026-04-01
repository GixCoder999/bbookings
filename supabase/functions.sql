-- Apply this in the Supabase SQL editor.
-- It switches booking + slot management to SQL RPCs only.

begin;

alter table public.bookings
  add column if not exists business_id uuid references public.businesses (id) on delete cascade,
  add column if not exists service_id uuid references public.services (id) on delete cascade,
  add column if not exists slot_date date,
  add column if not exists slot_start_time time,
  add column if not exists slot_end_time time;

update public.bookings bk
set
  business_id = sl.business_id,
  service_id = sl.service_id,
  slot_date = sl.date,
  slot_start_time = sl.start_time,
  slot_end_time = sl.end_time
from public.slots sl
where sl.id = bk.slot_id
  and (
    bk.business_id is null
    or bk.service_id is null
    or bk.slot_date is null
    or bk.slot_start_time is null
    or bk.slot_end_time is null
  );

alter table public.bookings
  alter column business_id set not null,
  alter column service_id set not null,
  alter column slot_date set not null,
  alter column slot_start_time set not null,
  alter column slot_end_time set not null,
  alter column slot_id drop not null;

do $$
declare
  slot_fk_name text;
begin
  select tc.constraint_name
  into slot_fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'bookings'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'slot_id'
  limit 1;

  if slot_fk_name is not null then
    execute format('alter table public.bookings drop constraint %I', slot_fk_name);
  end if;
end
$$;

alter table public.bookings
  drop constraint if exists bookings_slot_id_fkey;

alter table public.bookings
  add constraint bookings_slot_id_fkey
  foreign key (slot_id)
  references public.slots (id)
  on delete set null;

create index if not exists idx_bookings_business on public.bookings (business_id, created_at desc);
create index if not exists idx_bookings_service_date on public.bookings (service_id, slot_date);

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

commit;
