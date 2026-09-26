-- Rotate the pass tokens that were exposed in scratch/api_debug.log.
--
-- That file was committed to the repository, so every token below has to be
-- treated as public: anyone holding one could present it at the gate, and the
-- legitimate attendee would then be turned away as "already used".
--
-- The registration ID (the part before the underscore) is preserved so payment
-- records and admin lookups still line up; only the pass code half changes.
-- Already-delivered QR emails stop working, so re-send passes afterwards with
--   node scripts/resend-passes.js <email> [...]

begin;

create temporary table leaked_tokens (token text primary key);

insert into leaked_tokens (token) values
  ('10431_MAHAZ409H'),
  ('24236_MAH1PHQDC'),
  ('24236_MAH9QXIFW'),
  ('24236_MAHLBOB3U'),
  ('36597_MAH88WASZ'),
  ('36597_MAHF1KHE8'),
  ('36597_MAHONWQ2X'),
  ('63982_MAHBUMIKP'),
  ('93789_MAH2OPAEW'),
  ('93789_MAHOUA3AF'),
  ('93789_MAHYK2M5V'),
  ('MAH-MU35G4GB-8XLZ'),
  ('MAH-MU35G4GB-9DQ8');

-- Remember which rows are being rotated so the result can be verified after.
create temporary table rotated as
select id, token as old_token, participant_name, email
from tickets
where token in (select token from leaked_tokens);

update tickets t
set token =
  case
    when position('_' in t.token) > 0 then split_part(t.token, '_', 1)
    else lpad((10000 + floor(random() * 90000))::int::text, 5, '0')
  end
  || '_MAH'
  || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))
where t.id in (select id from rotated);

-- Old and new token side by side, plus the addresses that need a fresh pass.
select r.old_token, t.token as new_token, t.participant_name, t.email, t.status
from rotated r
join tickets t on t.id = r.id
order by t.created_at;

commit;
