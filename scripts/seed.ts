// Loads the four scaffold CSVs into the schema, in FK dependency order:
// sources -> factors -> mapping -> events. Then validates every raw event
// against VR-01..VR-04 and stores accept/reject state directly on the row.
//
// The CO2e calculation engine (segment-splitting across month/factor
// boundaries) is NOT in this file on purpose -- that's the part worth
// building by hand, since it's the conceptual core the review discussion
// will probe. See calculate.ts (build this next).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");

function loadCsv<T = Record<string, string>>(filename: string): T[] {
  const raw = readFileSync(join(dataDir, filename), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true });
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // --- 1. emission_sources ---
  const sources = loadCsv("emission_sources.csv");
  for (const s of sources) {
    await client.query(
      `INSERT INTO emission_sources (source_code, source_name, source_type, process_unit, area, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [s.source_code, s.source_name, s.source_type, s.process_unit, s.area, s.status]
    );
  }
  console.log(`seeded ${sources.length} emission_sources`);

  // --- 2. emission_factors ---
  const factors = loadCsv("emission_factors.csv");
  for (const f of factors) {
    await client.query(
      `INSERT INTO emission_factors (factor_code, stream, factor_value, factor_unit, valid_from, valid_to, basis)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        f.factor_code,
        f.stream,
        f.factor_value,
        f.factor_unit,
        f.valid_from,
        f.valid_to || null, // blank CSV value -> NULL -> "open-ended"
        f.basis,
      ]
    );
  }
  console.log(`seeded ${factors.length} emission_factors`);

  // --- 3. source_factor_mapping ---
  const mappings = loadCsv("source_factor_mapping.csv");
  for (const m of mappings) {
    await client.query(
      `INSERT INTO source_factor_mapping (source_code, factor_code) VALUES ($1,$2)`,
      [m.source_code, m.factor_code]
    );
  }
  console.log(`seeded ${mappings.length} source_factor_mapping`);

  // --- 4. emission_events (raw, with validation) ---
  type RawEvent = {
    event_ref: string;
    source_code: string;
    start_datetime: string;
    end_datetime: string;
    reported_volume: string;
    volume_unit: string;
    cause: string;
    recorded_by: string;
    remarks: string;
  };
  const rawEvents = loadCsv<RawEvent>("flare_vent_events_raw.csv");

  // Lookup maps built once, not re-queried per row.
  const refCounts: Record<string, number> = {};
  for (const e of rawEvents) {
    refCounts[e.event_ref] = (refCounts[e.event_ref] ?? 0) + 1;
  }
  const sourceStatus: Record<string, string> = {};
  for (const s of sources) {
    sourceStatus[s.source_code] = s.status;
  }

  let accepted = 0;
  let rejected = 0;

  for (const e of rawEvents) {
    const reasons: string[] = [];

    // VR-01
    if (!e.end_datetime || new Date(e.end_datetime) <= new Date(e.start_datetime)) {
      reasons.push("END_NOT_AFTER_START");
    }
    // VR-02
    if (e.reported_volume === "" || e.reported_volume === undefined) {
      reasons.push("VOLUME_MISSING");
    }
    // VR-03
    if (refCounts[e.event_ref] > 1) {
      reasons.push("DUPLICATE_REF");
    }
    // VR-04
    if (sourceStatus[e.source_code] !== "ACTIVE") {
      reasons.push("SOURCE_NOT_ACTIVE");
    }

    const isAccepted = reasons.length === 0;
    isAccepted ? accepted++ : rejected++;

    await client.query(
      `INSERT INTO emission_events
        (event_ref, source_code, start_datetime, end_datetime, reported_volume, volume_unit, cause, recorded_by, remarks, is_accepted, rejection_reasons)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        e.event_ref,
        e.source_code,
        e.start_datetime,
        e.end_datetime || null,
        e.reported_volume === "" ? null : e.reported_volume,
        e.volume_unit || null,
        e.cause,
        e.recorded_by,
        e.remarks,
        isAccepted,
        reasons,
      ]
    );
  }

  console.log(`seeded ${rawEvents.length} emission_events -> ${accepted} accepted, ${rejected} rejected`);
  console.log(
    accepted === 128 && rejected === 8
      ? "matches brief's stated reference outcome (128 accepted / 8 rejected)"
      : "DOES NOT match brief's stated outcome (expected 128 / 8) -- check validation logic"
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
