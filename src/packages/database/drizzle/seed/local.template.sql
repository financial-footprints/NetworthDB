-- Create Users
INSERT INTO users (
  id, username, password_hash, role, multifactor_enabled, created_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin',
  {{password_hash}},
  'administrator',
  false,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
  id, username, password_hash, role, multifactor_enabled, created_at
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  'manasi',
  {{password_hash}},
  'manager',
  false,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
  id, username, password_hash, role, multifactor_enabled, created_at
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  'usher',
  {{password_hash}},
  'user',
  false,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
