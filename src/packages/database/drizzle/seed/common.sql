INSERT INTO accounts (
  created_at,
  updated_at,
  opening_date,
  closing_date,
  account_type,
  id,
  user_id,
  bank,
  variant,
  label,
  account_number,
  secrets
)
SELECT
  NOW(),
  NOW(),
  users.created_at::date,
  NULL,
  'unknown',
  gen_random_uuid(),
  users.id,
  'Unknown',
  NULL,
  'Unknown',
  '-',
  NULL
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE accounts.user_id = users.id AND accounts.account_type = 'unknown'
);

INSERT INTO accounts (
  created_at,
  updated_at,
  opening_date,
  closing_date,
  account_type,
  id,
  user_id,
  bank,
  variant,
  label,
  account_number,
  secrets
)
SELECT
  NOW(),
  NOW(),
  users.created_at::date,
  NULL,
  'revenue',
  gen_random_uuid(),
  users.id,
  'Revenue',
  NULL,
  'Revenue',
  '-',
  NULL
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE accounts.user_id = users.id AND accounts.account_type = 'revenue'
);

INSERT INTO accounts (
  created_at,
  updated_at,
  opening_date,
  closing_date,
  account_type,
  id,
  user_id,
  bank,
  variant,
  label,
  account_number,
  secrets
)
SELECT
  NOW(),
  NOW(),
  users.created_at::date,
  NULL,
  'expense',
  gen_random_uuid(),
  users.id,
  'Expense',
  NULL,
  'Expense',
  '-',
  NULL
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE accounts.user_id = users.id AND accounts.account_type = 'expense'
);

INSERT INTO accounts (
  created_at,
  updated_at,
  opening_date,
  closing_date,
  account_type,
  id,
  user_id,
  bank,
  variant,
  label,
  account_number,
  secrets
)
SELECT
  NOW(),
  NOW(),
  users.created_at::date,
  NULL,
  'tumbler',
  gen_random_uuid(),
  users.id,
  'Tumbler',
  NULL,
  'Tumbler',
  '-',
  NULL
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE accounts.user_id = users.id AND accounts.account_type = 'tumbler'
);

INSERT INTO transaction_categories (
  created_at,
  updated_at,
  id,
  user_id,
  parent_id,
  name
)
SELECT
  NOW(),
  NOW(),
  gen_random_uuid(),
  users.id,
  NULL,
  roots.name
FROM users
CROSS JOIN (
  VALUES
    ('Food'),
    ('Transport'),
    ('Housing'),
    ('Income'),
    ('Health'),
    ('Shopping'),
    ('Transfers'),
    ('Other')
) AS roots(name)
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_categories c
  WHERE c.user_id = users.id
);

INSERT INTO transaction_categories (
  created_at,
  updated_at,
  id,
  user_id,
  parent_id,
  name
)
SELECT
  NOW(),
  NOW(),
  gen_random_uuid(),
  parent.user_id,
  parent.id,
  children.name
FROM transaction_categories parent
INNER JOIN (
  VALUES
    ('Food', 'Groceries'),
    ('Food', 'Dining'),
    ('Transport', 'Fuel'),
    ('Transport', 'Transit'),
    ('Housing', 'Rent'),
    ('Housing', 'Utilities'),
    ('Income', 'Salary')
) AS children(parent_name, name) ON parent.name = children.parent_name
WHERE parent.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM transaction_categories existing
    WHERE existing.user_id = parent.user_id
      AND existing.parent_id = parent.id
      AND existing.name = children.name
  );

INSERT INTO transactions (
  created_at,
  updated_at,
  amount,
  date,
  id,
  user_id,
  source_account_id,
  destination_account_id,
  category_id,
  subcategory_id,
  import_id,
  description,
  ref_no
)
SELECT
  NOW(),
  NOW(),
  10000,
  CURRENT_DATE,
  gen_random_uuid(),
  src.user_id,
  src.id,
  dst.id,
  NULL,
  NULL,
  NULL,
  'Seed ledger row',
  'seed-readonly-test'
FROM accounts src
INNER JOIN accounts dst
  ON dst.user_id = src.user_id
  AND dst.account_type = 'unknown'
WHERE src.account_type = 'expense'
  AND src.id <> dst.id
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.user_id = src.user_id
      AND t.ref_no = 'seed-readonly-test'
  );
