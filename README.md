# Flare and Vent Emissions Log (LA-ASM-WEB-001)

## What this is
A system for recording flare/vent emission events, validating them,
calculating CO2e against time-versioned emission factors and
reporting on the results as per LA-ASM-WEB-001 Rev 0.

## Stack
- PostgreSQL (schema in `db/`, raw SQL migrations)
- Node.js + TypeScript (seed and calculation scripts in `scripts/`)
- Next.js App Router (API routes + UI, server components by default)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Postgres database and set `DATABASE_URL` and `JWT_SECRET`
   in a `.env` file (not committed so refer `.env.example` for the format):
   ```
   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/emissions_log
   JWT_SECRET=<any random string>
   ```

3. Run the migrations (creates all tables, in dependency order):
   ```bash
   npm run migrate
   ```

4. Seed the database from the supplied CSVs (`data/`). Validates every
   raw event against VR-01 to VR-04 and records accept/reject state:
   ```bash
   npm run seed
   ```
   Expected output: `128 accepted, 8 rejected` (matches the brief's
   stated reference outcome).

5. Run the calculation engine which splits accepted events into
   month/factor-boundary segments and calculates CO2e for each:
   ```bash
   npm run calculate
   ```
   Expected output includes `FVE-00127 total CO2e: 862.648 tCO2e`,
   matching the brief's worked example exactly.

6. Create the three demo users (one per role). Refer
   `docs/SEED_CREDENTIALS.md` for the exact steps and credentials.

7. Build check (also run this before submitting since `npm run dev` does
   not run full type-checking, so this is the only way to be sure the
   whole app actually compiles clean):
   ```bash
   npm run build
   ```

8. Start the app:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` — you'll be redirected to `/login`.

## Documentation
- `docs/DATA_MODEL.md` — schema design and the reasoning behind each
  table's key structure and constraints.
- `docs/API_DESIGN.md` — every route mapped to the Section 8
  authorisation matrix.
- `docs/ASSUMPTIONS.md` — judgment calls made where the brief was
  silent or ambiguous, bugs found and fixed during testing, and current
  scope status.
- `docs/SEED_CREDENTIALS.md` — the three demo user credentials.
- `docs/COMPONENT_BOUNDARY.md` — server vs client component reasoning
  (TC-01).

## Status

**All M-priority requirements are complete and independently verified**
— data model, migrations, seed script with VR-01to VR-04 validation,
calculation engine (verified against the FVE-00127 worked example and
the 128/8 accept-reject figure), full API with server-side RBAC on
every route, and a complete UI (dashboard, event register with
filtering, entry/amend/void forms, source and factor registers,
month-close). Every piece was tested through real requests and a real
browser.

**D-priority progress:**
- Done and verified: FR-11 (factor supersession UI), FR-12 (exception
  register — a filter on the existing register view, not a separate
  page), FR-14 (monthly CSV export).
- Deliberately omitted: FR-15 (audit trail write-side) and FR-13 (bulk
  import) — see `docs/ASSUMPTIONS.md` for the reasoning behind each.

Refer `docs/ASSUMPTIONS.md` for the full reasoning behind every decision
above.
