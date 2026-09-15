-- Seed Events
insert into events (id, slug, name, event_date, venue, capacity, price, category, description, image_url, status)
values
('11111111-1111-1111-1111-111111111111', 'mahalaya', 'Mahalaya Bhoj', '2026-10-12', 'Community Courtyard', 120, 250, 'Neighbourhood bhoj', 'Bengali food • Adda • Celebration', 'assets/mahalaya-bhoj.webp', 'OPEN'),
('22222222-2222-2222-2222-222222222222', 'saraswati', 'Saraswati Puja', '2027-01-21', 'College Campus', 180, 0, 'Campus celebration', 'Yellow blooms • Anjali • Music • Culture', 'assets/saraswati-puja.webp', 'OPEN')
ON CONFLICT (id) DO NOTHING;

-- Seed Auth User (id: 33333333-3333-3333-3333-333333333333)
-- Password is 'password123'
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
select
'33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'admin@utsavpass.local', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"IIIT Bongio Samiti Admin"}', now(), now(), 'authenticated', 'authenticated'
where not exists (select 1 from auth.users where id = '33333333-3333-3333-3333-333333333333');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
'33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@utsavpass.local","email_verified":true}', 'email', now(), now(), now()
where not exists (select 1 from auth.identities where id = '33333333-3333-3333-3333-333333333333');

insert into admin_profiles (id, name, email, role)
values
('33333333-3333-3333-3333-333333333333', 'IIIT Bongio Samiti Admin', 'admin@utsavpass.local', 'organiser')
ON CONFLICT (id) DO NOTHING;

-- Seed Tickets
insert into tickets (id, token, event_id, participant_name, college_id, email, phone, utr, amount, payment_status, status, num_passes, food_pref, is_iiit, coupon_code, discount_amount, redeemed_at, redeemed_gate, redeemed_by, created_at)
values
(gen_random_uuid(), 'MBH-DEMO-001', '11111111-1111-1111-1111-111111111111', 'Arka Mukhopadhyay', '202401042', 'arka.m@research.iiit.ac.in', '+91 98765 43210', 'UPI-429810294812', 250, 'APPROVED', 'UNUSED', 1, 'Non-Veg (Authentic Bhoj)', true, null, 0, null, null, null, '2026-08-08 10:30:00+00'),
(gen_random_uuid(), 'SPJ-DEMO-001', '22222222-2222-2222-2222-222222222222', 'Ananya Sen', '202402118', 'ananya.sen@students.iiit.ac.in', '+91 98301 22334', 'FREE-PASS', 0, 'APPROVED', 'UNUSED', 1, 'Khichuri Prosad Feast (Sit-down Lunch)', true, null, 0, null, null, null, '2026-08-09 14:15:00+00'),
('44444444-4444-4444-4444-444444444444', 'MBH-2026-USED1', '11111111-1111-1111-1111-111111111111', 'Debjit Roy', '202301994', 'debjit.roy@iiit.ac.in', '+91 98111 55667', 'UPI-884920194821', 250, 'APPROVED', 'USED', 1, 'Non-Veg (Authentic Bhoj)', true, null, 0, '2026-08-10 11:45:00+00', 'Gate 1', '33333333-3333-3333-3333-333333333333', '2026-08-07 09:00:00+00'),
(gen_random_uuid(), 'MBH-2026-PEND1', '11111111-1111-1111-1111-111111111111', 'Priyanka Banerjee', '202401887', 'priyanka.b@iiit.ac.in', '+91 98777 66554', 'UPI-992817263541', 250, 'PENDING', 'PENDING_PAYMENT', 1, 'Veg (Special Veg Thali)', true, null, 0, null, null, null, '2026-08-10 12:00:00+00')
ON CONFLICT (token) DO NOTHING;

-- Seed Checkins
insert into checkins (ticket_id, gate, scanned_by, created_at)
values
('44444444-4444-4444-4444-444444444444', 'Gate 1', '33333333-3333-3333-3333-333333333333', '2026-08-10 11:45:00+00');
