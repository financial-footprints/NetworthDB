import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = join(packageRoot, "drizzle/seed/local.template.sql");
const template = readFileSync(templatePath, "utf8");

if (/\{\{[a-z_]+\}\}/.test(template)) {
  console.error(
    "local seed: skipped until foundation phase implements Argon2/SRP template rendering"
  );
  process.exit(0);
}

process.stdout.write(template);
