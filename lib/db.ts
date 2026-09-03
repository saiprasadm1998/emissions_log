// Single shared Postgres connection pool, reused across all API routes
// (not one new client per request -- that would exhaust connections
// under any real load).
import pg from "pg";

// node-postgres's default parser for DATE columns (OID 1082) constructs
// a JS Date using the LOCAL-timezone constructor (new Date(y, m, d)) --
// whether this then shifts to the wrong calendar day when displayed
// depends on whether that specific date falls in daylight saving time
// on the server's local clock, not just the general UTC offset. Found
// this the hard way: a January date (GMT, no DST) parsed correctly in
// testing, but an October date (BST, DST active) silently rolled back
// to the previous day once converted via toISOString(). Returning the
// raw "YYYY-MM-DD" string instead sidesteps the Date construction
// entirely -- every consumer already does new Date(theString), and an
// ISO date-only string is always parsed as UTC per the JS spec, which
// is unambiguous and correct regardless of server timezone or DST.
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
