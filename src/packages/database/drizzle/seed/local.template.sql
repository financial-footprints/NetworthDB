-- Local-only fixtures. Rendered from this template at seed time (admin/admin).
INSERT INTO users (
  id, username, password_hash, srp_salt, srp_verifier, role, mfa_enabled, created_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin',
  {{password_hash}},
  {{srp_salt}},
  {{srp_verifier}},
  'administrator',
  false,
  NOW()
)
ON CONFLICT (username) DO NOTHING;
