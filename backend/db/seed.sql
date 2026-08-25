-- Development seed data for Drift
-- Safe to re-run: uses ON CONFLICT DO NOTHING on natural keys.

INSERT INTO users (privy_did, email, display_name, is_host, surf_level) VALUES
  ('did:privy:seed-host-1', 'host@drift.surf', 'Drift Host', TRUE, 'advanced')
ON CONFLICT (privy_did) DO NOTHING;

INSERT INTO spots (slug, name, state, city, description, latitude, longitude, best_season, level) VALUES
  ('praia-do-rosa', 'Praia do Rosa', 'SC', 'Imbituba',
   'Consistent beach break with a nomad-friendly village, cafés and coworking.', -28.128, -48.642, 'Apr–Oct', 'all'),
  ('itacare', 'Itacaré', 'BA', 'Itacaré',
   'Warm water, jungle beaches and mellow point breaks. Great for learning.', -14.278, -38.996, 'Year-round', 'beginner'),
  ('florianopolis-joaquina', 'Joaquina', 'SC', 'Florianópolis',
   'Powerful beach break, home of Brazilian pro surfing. City life close by.', -27.630, -48.448, 'Apr–Sep', 'intermediate'),
  ('fernando-de-noronha', 'Cacimba do Padre', 'PE', 'Fernando de Noronha',
   'Crystal-clear tubes on a protected archipelago. Limited daily visitors.', -3.851, -32.442, 'Dec–Mar', 'advanced')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO trips (host_id, spot_id, title, description, starts_on, ends_on, capacity, price_usdc, includes, level, is_published)
SELECT
  u.id, s.id,
  'Rosa Winter Swell Week',
  '7 days at Praia do Rosa with coaching, boards and a coworking desk.',
  DATE '2026-06-15', DATE '2026-06-22', 8, 890.00,
  ARRAY['board', 'lodging', 'coaching', 'coworking'], 'all', TRUE
FROM users u, spots s
WHERE u.privy_did = 'did:privy:seed-host-1' AND s.slug = 'praia-do-rosa'
  AND NOT EXISTS (SELECT 1 FROM trips WHERE title = 'Rosa Winter Swell Week');

INSERT INTO trips (host_id, spot_id, title, description, starts_on, ends_on, capacity, price_usdc, includes, level, is_published)
SELECT
  u.id, s.id,
  'Itacaré Learn-to-Surf Retreat',
  '5 days in Bahia. Soft-tops, daily lessons, açaí bowls.',
  DATE '2026-09-02', DATE '2026-09-07', 10, 620.00,
  ARRAY['board', 'lodging', 'coaching'], 'beginner', TRUE
FROM users u, spots s
WHERE u.privy_did = 'did:privy:seed-host-1' AND s.slug = 'itacare'
  AND NOT EXISTS (SELECT 1 FROM trips WHERE title = 'Itacaré Learn-to-Surf Retreat');
