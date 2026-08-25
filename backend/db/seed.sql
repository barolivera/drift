-- Seed data for Drift
-- Safe to re-run: ON CONFLICT DO NOTHING on natural keys (privy_did, slug, title).

INSERT INTO users (privy_did, email, display_name, wallet_address, is_host, surf_level) VALUES
  ('did:privy:seed-host-1', 'host@drift.local', 'Drift Host', '0x1234567890123456789012345678901234567890', TRUE, 'advanced')
ON CONFLICT (privy_did) DO NOTHING;

INSERT INTO spots (slug, name, city, state, description, capacity, daily_rate_usdc, level) VALUES
  ('itamambuca',    'Itamambuca',    'Itamambuca',    'SP', 'Beachfront house with workspace and community vibes', 12, 150, 'all'),
  ('praia-do-rosa', 'Praia do Rosa', 'Praia do Rosa', 'SC', 'Luxury eco-house, perfect for builders',             10, 180, 'all')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO trips (spot_id, host_id, title, description, starts_on, ends_on, price_usdc, capacity, includes, level, is_published)
SELECT s.id, u.id,
       'Itamambuca Jan-Feb',
       'Summer residency in Itamambuca — surf, build, connect',
       DATE '2027-01-15', DATE '2027-02-15', 4500, 12,
       ARRAY['lodging', 'coworking', 'board'], 'all', TRUE
FROM spots s, users u
WHERE s.slug = 'itamambuca' AND u.privy_did = 'did:privy:seed-host-1'
  AND NOT EXISTS (SELECT 1 FROM trips WHERE title = 'Itamambuca Jan-Feb');

INSERT INTO trips (spot_id, host_id, title, description, starts_on, ends_on, price_usdc, capacity, includes, level, is_published)
SELECT s.id, u.id,
       'Praia do Rosa Autumn',
       'Autumn builder retreat in Praia do Rosa — less crowded, perfect for focus',
       DATE '2027-04-20', DATE '2027-05-20', 5000, 10,
       ARRAY['lodging', 'coworking', 'board'], 'all', TRUE
FROM spots s, users u
WHERE s.slug = 'praia-do-rosa' AND u.privy_did = 'did:privy:seed-host-1'
  AND NOT EXISTS (SELECT 1 FROM trips WHERE title = 'Praia do Rosa Autumn');
