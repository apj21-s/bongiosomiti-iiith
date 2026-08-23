insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'admin@utsavpass.local') ON CONFLICT (id) DO NOTHING;
