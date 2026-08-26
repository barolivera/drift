-- Seed data for Drift — 2027 editions
-- Idempotent: users/spots upsert on natural keys, trips upsert on slug.

INSERT INTO users (privy_did, email, display_name, wallet_address, is_host, surf_level) VALUES
  ('did:privy:seed-host-1', 'host@drift.local', 'Drift Host', '0x1234567890123456789012345678901234567890', TRUE, 'advanced')
ON CONFLICT (privy_did) DO NOTHING;

INSERT INTO spots (slug, name, city, state, description, capacity, daily_rate_usdc, level) VALUES
  ('itamambuca',    'Itamambuca',    'Ubatuba',       'SP', 'Three-kilometre beach at the northern end of Ubatuba, river mouth at one end and a point at the other.', 16, 150, 'all'),
  ('praia-do-rosa', 'Praia do Rosa', 'Praia do Rosa', 'SC', 'Horseshoe bay an hour south of Florianópolis, held between two green headlands with a lagoon behind it.', 16, 180, 'intermediate')
ON CONFLICT (slug) DO UPDATE SET
  city = EXCLUDED.city, state = EXCLUDED.state, description = EXCLUDED.description,
  capacity = EXCLUDED.capacity, daily_rate_usdc = EXCLUDED.daily_rate_usdc, level = EXCLUDED.level;

-- Retire the pre-2027 rows (no slug). Bookings cascade.
DELETE FROM trips WHERE slug IS NULL AND title IN ('Itamambuca Jan-Feb', 'Praia do Rosa Autumn');

-- Shared daily rhythm. `highlight: true` marks the deep-work block — the product's differentiator.
CREATE TEMP TABLE seed_schedule AS SELECT $$[
  {"time": "06:45", "title": "Dawn patrol",      "detail": "Optional. The best window is before the wind comes up."},
  {"time": "08:30", "title": "Breakfast",        "detail": "Together, at the house."},
  {"time": "09:15", "title": "Yoga & mobility",  "detail": "45 minutes. Your shoulders will need it by day four."},
  {"time": "10:00", "title": "Deep work",        "detail": "Three hours, no meetings, no calls in shared space. The one rule of the house.", "highlight": true},
  {"time": "13:00", "title": "Lunch",            "detail": "Then the afternoon is yours."},
  {"time": "16:00", "title": "Coached surf",     "detail": "Split by level, video review twice a week."},
  {"time": "18:30", "title": "Programming",      "detail": "A workshop, a guest talk, or an open hack session."},
  {"time": "20:00", "title": "Dinner",           "detail": "One long table, everyone."}
]$$::jsonb AS schedule;

INSERT INTO trips (slug, spot_id, host_id, title, location, description, description_long,
                   starts_on, ends_on, capacity, price_usdc, price_full_usdc, founding_seats, includes, included, not_included,
                   who_its_for, daily_schedule, level, is_published)
SELECT
  'itamambuca-summer-2027', s.id, u.id,
  'Itamambuca — Summer Edition',
  'Itamambuca, Ubatuba, Brazil',
  'Two weeks on a three-kilometre beach four hours from São Paulo. Mornings in the water, three protected hours of work, and a demo night at the end.',
  E'Itamambuca is a three-kilometre beach at the northern end of Ubatuba, four hours from São Paulo, with a river mouth at one end and a point at the other. It works for a first week on a foam board and it works on a head-high swell, which is why it''s the right place to put sixteen people of every level in one house.\n\nThis is Drift''s first edition. Two weeks in a house a few minutes from the sand: mornings in the water, three protected hours of work in the middle of the day, and a demo night at the end. January is high summer — warm water, no wetsuit, long light until eight.',
  DATE '2027-01-16', DATE '2027-01-30', 16, 900, 1200, 8,
  ARRAY['lodging', 'coaching', 'board', 'coworking'],
  $$[
    "14 nights, room of your choice",
    "Breakfast daily and dinner at the long table",
    "Coached surf sessions, split by level, with video review",
    "Boards and wetsuits for the whole stay",
    "Morning yoga and mobility",
    "A dedicated work room — fibre, monitors, call booths",
    "The programme: workshops, hack day, demo night",
    "Airport transfer from São Paulo on arrival and departure day",
    "One off-grid day — boat or waterfall"
  ]$$::jsonb,
  $$["Flights", "Lunches", "Travel insurance", "Visa"]$$::jsonb,
  E'Anyone who works remotely and is building something they''d be glad to show on a Thursday night. All surf levels, including people who have never stood up — that''s what the first three days are for. Applications are read as they arrive.',
  (SELECT schedule FROM seed_schedule),
  'all', TRUE
FROM spots s, users u
WHERE s.slug = 'itamambuca' AND u.privy_did = 'did:privy:seed-host-1'
ON CONFLICT (slug) DO UPDATE SET
  spot_id = EXCLUDED.spot_id, title = EXCLUDED.title, location = EXCLUDED.location,
  description = EXCLUDED.description, description_long = EXCLUDED.description_long,
  starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on, capacity = EXCLUDED.capacity,
  price_usdc = EXCLUDED.price_usdc, price_full_usdc = EXCLUDED.price_full_usdc,
  founding_seats = EXCLUDED.founding_seats, includes = EXCLUDED.includes, included = EXCLUDED.included,
  not_included = EXCLUDED.not_included, who_its_for = EXCLUDED.who_its_for,
  daily_schedule = EXCLUDED.daily_schedule, level = EXCLUDED.level, is_published = EXCLUDED.is_published;

INSERT INTO trips (slug, spot_id, host_id, title, location, description, description_long,
                   starts_on, ends_on, capacity, price_usdc, price_full_usdc, founding_seats, includes, included, not_included,
                   who_its_for, daily_schedule, level, is_published)
SELECT
  'praia-do-rosa-autumn-2027', s.id, u.id,
  'Praia do Rosa — Autumn Edition',
  'Praia do Rosa, Santa Catarina, Brazil',
  'The colder, cleaner edition. A horseshoe bay in Santa Catarina with offshore mornings and consistent south swell.',
  E'Praia do Rosa is a horseshoe bay in Santa Catarina, an hour south of Florianópolis, held between two green headlands with a lagoon behind it. Autumn is the season locals wait for: clean lines from the south swell, offshore mornings, and the southern right whales calving in the bay from June.\n\nThe second edition, and the colder one — bring a 3/2. The bay is more consistent and more challenging than Itamambuca, so it suits residents who''ve already got a few weeks under them, though the beach break at the north end stays friendly. Same rhythm, same house rules, different water.',
  DATE '2027-04-24', DATE '2027-05-08', 16, 950, 1300, 8,
  ARRAY['lodging', 'coaching', 'board', 'coworking'],
  $$[
    "14 nights, room of your choice",
    "Breakfast daily and dinner at the long table",
    "Coached surf sessions, split by level, with video review",
    "Boards and 3/2 wetsuits for the whole stay",
    "Morning yoga and mobility",
    "A dedicated work room — fibre, monitors, call booths",
    "The programme: workshops, hack day, demo night",
    "Transfer from Florianópolis airport on arrival and departure day",
    "One off-grid day — the coastal trail to Praia Vermelha"
  ]$$::jsonb,
  $$["Flights", "Lunches", "Travel insurance", "Visa"]$$::jsonb,
  'Returning residents and anyone comfortable in head-high water. Same application, same sixteen seats. Alumni of the summer edition get first refusal for two weeks before it opens.',
  (SELECT schedule FROM seed_schedule),
  'intermediate', TRUE
FROM spots s, users u
WHERE s.slug = 'praia-do-rosa' AND u.privy_did = 'did:privy:seed-host-1'
ON CONFLICT (slug) DO UPDATE SET
  spot_id = EXCLUDED.spot_id, title = EXCLUDED.title, location = EXCLUDED.location,
  description = EXCLUDED.description, description_long = EXCLUDED.description_long,
  starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on, capacity = EXCLUDED.capacity,
  price_usdc = EXCLUDED.price_usdc, price_full_usdc = EXCLUDED.price_full_usdc,
  founding_seats = EXCLUDED.founding_seats, includes = EXCLUDED.includes, included = EXCLUDED.included,
  not_included = EXCLUDED.not_included, who_its_for = EXCLUDED.who_its_for,
  daily_schedule = EXCLUDED.daily_schedule, level = EXCLUDED.level, is_published = EXCLUDED.is_published;

DROP TABLE seed_schedule;
