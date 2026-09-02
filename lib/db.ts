// Single shared Postgres connection pool, reused across all API routes
// (not one new client per request -- that would exhaust connections
// under any real load).
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
