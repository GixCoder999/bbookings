-- BBookings Sample Data SQL
-- Insert this into your Supabase SQL Editor after setting up auth users
--
-- Prerequisites:
-- 1. Create two auth users via Supabase Dashboard:
--    a) owner@example.com / password123 (set role to 'owner' in user metadata)
--    b) customer@example.com / password123 (set role to 'customer' in user metadata)
-- 2. Replace the UUID values below with actual auth.users IDs
--
-- Then paste this entire script into Supabase SQL Editor and execute

-- Replace these UUID values with actual auth.users IDs
-- You can find them in: Supabase Dashboard > Authentication > Users
-- Then copy/paste the entire script into Supabase SQL Editor

-- Insert public user profiles
BEGIN;

INSERT INTO public.users (id, email, role, dark_mode)
VALUES
  ('6e30cd0e-a726-4b0e-ba30-b43a9430a2f4', 'msohaib.devworks@gmail.com', 'owner', false),
  ('d82b2b36-1cda-4380-8952-6e0eacb3b950', 'msohaib0503@gmail.com', 'customer', false)
ON CONFLICT (id) DO NOTHING;

-- Insert business (owned by owner@example.com)
INSERT INTO public.businesses (
  owner_id,
  name,
  description,
  working_days,
  start_time,
  end_time,
  timezone
) VALUES (
  '6e30cd0e-a726-4b0e-ba30-b43a9430a2f4',
  'Zen Wellness Studio',
  'Professional yoga, massage, and wellness coaching services',
  ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  '08:00',
  '18:00',
  'America/New_York'
);

-- Get the business ID for subsequent inserts
-- Note: In practice, you might need to insert this separately and capture the ID

-- Insert services
-- Using a CTE to get the business ID
WITH biz AS (
  SELECT id FROM public.businesses 
  WHERE owner_id = '6e30cd0e-a726-4b0e-ba30-b43a9430a2f4'
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO public.services (business_id, name, description, duration_mins, buffer_mins, price)
SELECT 
  biz.id,
  'Vinyasa Yoga',
  '60-minute energetic flowing yoga practice',
  60,
  15,
  75.00
FROM biz
UNION ALL
SELECT
  biz.id,
  'Swedish Massage',
  '60-minute full body relaxation massage',
  60,
  15,
  85.00
FROM biz
UNION ALL
SELECT
  biz.id,
  'Deep Tissue Massage',
  '60-minute focused deep tissue therapy',
  60,
  15,
  95.00
FROM biz
UNION ALL
SELECT
  biz.id,
  'Wellness Coaching',
  '45-minute personalized wellness consultation',
  45,
  10,
  60.00
FROM biz
UNION ALL
SELECT
  biz.id,
  'Private Yoga Session',
  '90-minute customized yoga practice',
  90,
  15,
  120.00
FROM biz;

-- Example: Insert sample slots for the next 7 days
-- This creates 2 slots per day (9:00-10:00 AM and 2:00-3:00 PM) for Vinyasa Yoga
WITH biz AS (
  SELECT id FROM public.businesses 
  WHERE owner_id = '6e30cd0e-a726-4b0e-ba30-b43a9430a2f4'
  ORDER BY created_at DESC LIMIT 1
),
svc AS (
  SELECT id FROM public.services 
  WHERE business_id = (SELECT id FROM biz)
  AND name = 'Vinyasa Yoga'
  ORDER BY created_at DESC LIMIT 1
),
dates AS (
  SELECT generate_series(
    CURRENT_DATE,
    CURRENT_DATE + '7 days'::interval,
    '1 day'::interval
  )::date AS slot_date
)
INSERT INTO public.slots (service_id, business_id, date, start_time, end_time, status)
SELECT
  svc.id,
  biz.id,
  dates.slot_date,
  '09:00'::time,
  '10:00'::time,
  'available'
FROM dates, biz, svc
WHERE EXTRACT(DOW FROM dates.slot_date) NOT IN (0)  -- Exclude Sundays (DOW 0)
  AND EXTRACT(DOW FROM dates.slot_date) NOT IN (6); -- Exclude Saturdays (DOW 6)

-- Example: Create a sample booking (customer books a slot)
WITH biz AS (
  SELECT id FROM public.businesses 
  WHERE owner_id = '6e30cd0e-a726-4b0e-ba30-b43a9430a2f4'
  ORDER BY created_at DESC LIMIT 1
),
slot_to_book AS (
  SELECT id FROM public.slots
  WHERE business_id = (SELECT id FROM biz)
    AND status = 'available'
    AND date >= CURRENT_DATE
  ORDER BY date, start_time
  LIMIT 1
)
INSERT INTO public.bookings (slot_id, customer_id, status)
SELECT
  slot_to_book.id,
  'd82b2b36-1cda-4380-8952-6e0eacb3b950',
  'pending'
FROM slot_to_book;

-- Update the booked slot status
WITH biz AS (
  SELECT id FROM public.businesses 
  WHERE owner_id = '6e30cd0e-a726-4b0e-ba30-b43a9430a2f4'
  ORDER BY created_at DESC LIMIT 1
),
booked_slot AS (
  SELECT DISTINCT s.id FROM public.slots s
  WHERE s.business_id = (SELECT id FROM biz)
    AND EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.slot_id = s.id
    )
  LIMIT 1
)
UPDATE public.slots
SET status = 'booked'
WHERE id IN (SELECT id FROM booked_slot);

COMMIT;

-- Verification queries (run these to verify data was inserted)
/*
-- Check users
SELECT 'Users' as table_name, COUNT(*) as count FROM public.users;

-- Check business
SELECT 'Business' as table_name, COUNT(*) as count FROM public.businesses;

-- Check services
SELECT 'Services' as table_name, COUNT(*) as count FROM public.services;

-- Check slots
SELECT 'Slots' as table_name, COUNT(*) as count FROM public.slots;

-- Check bookings
SELECT 'Bookings' as table_name, COUNT(*) as count FROM public.bookings;

-- View owner's dashboard
SELECT 
  b.name as business_name,
  s.name as service_name,
  COUNT(*) as total_slots
FROM public.slots sl
JOIN public.services s ON sl.service_id = s.id
JOIN public.businesses b ON sl.business_id = b.id
GROUP BY b.name, s.name;

-- View sample bookings
SELECT 
  b.id,
  b.status,
  s.name as service,
  sl.date,
  sl.start_time,
  u.email as customer_email
FROM public.bookings b
JOIN public.slots sl ON b.slot_id = sl.id
JOIN public.services s ON sl.service_id = s.id
JOIN public.users u ON b.customer_id = u.id
ORDER BY sl.date, sl.start_time;
*/

