// Runs every .sql file in db/ in filename order (000_, 001_, 002_, ...).
// Idempotent-ish via a migrations ledger table: a file that's already
// been applied is skipped on the next run — required by TC-04 (clean
// checkout reaches a working state through documented commands alone,
// repeatably).
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, "..", "db");

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = readdirSync(dbDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filename prefix (000_, 001_, ...) controls order

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM _migrations WHERE filename = $1",
      [file]
    );
    if (rows.length > 0) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(dbDir, file), "utf-8");
    console.log(`apply ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }

  await client.end();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
