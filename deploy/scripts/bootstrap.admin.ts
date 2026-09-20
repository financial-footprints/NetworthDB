import { randomUUID } from "node:crypto";
import { seedHashPassword } from "@ndb/auth";
import { dbPoolConfig } from "@ndb/database/config";
import { parseDbEnv } from "@ndb/database/env";
import { Pool } from "pg";

const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!username || !password) {
  console.log("deploy.bootstrap.admin.skipped.no-env");
  process.exit(0);
}

const pool = new Pool(dbPoolConfig(parseDbEnv()));

try {
  const countResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::int AS count FROM users"
  );
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count > 0) {
    console.log("deploy.bootstrap.admin.skipped.users-exist");
    process.exit(0);
  }

  const passwordHash = await seedHashPassword(password);
  const id = randomUUID();
  const createdAt = new Date();

  await pool.query(
    `INSERT INTO users (
      id,
      username,
      password_hash,
      role,
      created_at,
      multifactor_enabled,
      multifactor_failed_count
    ) VALUES ($1, $2, $3, 'administrator', $4, false, 0)`,
    [id, username, passwordHash, createdAt]
  );

  console.log("deploy.bootstrap.admin.created", { username });
} finally {
  await pool.end();
}
