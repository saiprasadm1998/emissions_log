# Flare and Vent Emissions Log — LA-ASM-WEB-001

## What this is
A system for recording flare/vent emission events, validating them,
calculating CO2e against time-versioned emission factors (correctly
apportioned across calendar-month and factor-validity boundaries), and
reporting on the results — per LA-ASM-WEB-001 Rev 0.

## Stack
- PostgreSQL (schema in `db/`, raw SQL migrations)
- Node.js + TypeScript (seed and calculation scripts in `scripts/`)
- Next.js (API + UI — in progress)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Postgres database and set `DATABASE_URL` in a `.env` file
   (not committed — see `.env.example` for the format):
   ```
   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/emissions_log
   ```

3. Run the migrations (creates all tables, in dependency order):
   ```bash
   npm run migrate
   ```

4. Seed the database from the supplied CSVs (`data/`). Validates every
   raw event against VR-01–VR-04 and records accept/reject state:
   ```bash
   npm run seed
   ```
   Expected output: `128 accepted, 8 rejected` (matches the brief's
   stated reference outcome).

5. Run the calculation engine — splits accepted events into
   month/factor-boundary segments and calculates CO2e for each:
   ```bash
   npm run calculate
   ```
   Expected output includes `FVE-00127 total CO2e: 862.648 tCO2e`,
   matching the brief's worked example exactly.

## Technology choices and justification (TC-01, TC-02)

- **API implemented as Next.js Route Handlers**, not a separate
  Express/Fastify service. Given the scope (one frontend, one API, no
  separate deployment target for either), a single Next.js project
  avoids running two servers and two deploy pipelines for no added
  benefit — Route Handlers give the same request/response model with
  less infrastructure. A separate service would be justified if the API
  needed to be consumed by something other than this UI, which isn't
  the case here.
- **Client vs server components**: pages that only display data (the
  register, the dashboard) are server components by default — they
  fetch and render on the server, which keeps the database query logic
  off the client entirely and avoids shipping DB-adjacent code to the
  browser. Anything with interactivity (the event entry form, sorting
  controls) is marked `"use client"` explicitly, and only that specific
  component — not its parent page — so as little JavaScript as possible
  ships to the browser. Each client component's directive is
  accompanied by a one-line comment stating why it needs to be one
  (state, event handlers, or browser-only APIs).

- `docs/DATA_MODEL.md` — schema design and the reasoning behind each
  table's key structure and constraints.
- `docs/ASSUMPTIONS.md` — judgment calls made where the brief was silent
  or ambiguous, and why.

## Status
Data model, migrations, seed, and calculation engine are complete and
verified. API and UI are in progress — see `docs/ASSUMPTIONS.md` for
current scope decisions given the assessment time budget.
