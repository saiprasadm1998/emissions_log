// Calculation engine: turns accepted emission_events into event_co2e_segments,
// per CR-01 to CR-05. Run this AFTER seed.ts.
//
// Core idea (worked through by hand against FVE-00127, see docs/notes):
//   1. Find every month-start and factor-valid_from boundary that falls
//      strictly inside the event's [start, end) range.
//   2. Merge + dedupe + sort those into one list of cut points.
//   3. Walk consecutive pairs (including the event's own start/end as the
//      first and last edges) -- each pair is one segment.
//   4. Each segment's volume is apportioned by its share of the event's
//      TOTAL elapsed duration (CR-02): segment_volume = (segment_hours /
//      total_hours) * total_volume_ksm3.
//   5. Each segment's CO2e = segment_volume * the factor value in force
//      for that segment's dates (CR-03/CR-04).
//   6. No rounding here -- CR-05 says intermediate values stay unrounded;
//      rounding only happens at display/export time.
import "dotenv/config";
import pg from "pg";
import Decimal from "decimal.js";

// Same fix as lib/db.ts, applied independently -- this script runs in its
// own process (via tsx), not through the Next.js app, so it needs its own
// call to setTypeParser rather than inheriting the one in lib/db.ts.
// Without this, factorRows.valid_from/valid_to (DATE columns) could parse
// with a local-timezone/DST shift and corrupt the boundary comparisons in
// findFactorForDate below on any server not running in UTC.
pg.types.setTypeParser(1082, (val) => val);

const MS_PER_HOUR = 1000 * 60 * 60;

function toKsm3(volume: number, unit: string): number {
  // CR-01: normalise to kSm3. Sm3 -> divide by 1000; kSm3 -> already correct.
  // Decimal here too, same reasoning as the segment math below.
  return unit === "Sm3" ? new Decimal(volume).div(1000).toNumber() : volume;
}

function getMonthBoundaries(start: Date, end: Date): Date[] {
  const boundaries: Date[] = [];
  let candidate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  while (candidate < end) {
    if (candidate > start) boundaries.push(candidate);
    candidate = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 1));
  }
  return boundaries;
}

async function getFactorRows(client: pg.Client, factorCode: string) {
  // Pull the whole validity history for this stream once; used both to find
  // boundary dates AND to resolve which factor row applies to each segment.
  const { rows } = await client.query(
    `SELECT id, valid_from, valid_to, factor_value
     FROM emission_factors
     WHERE factor_code = $1
     ORDER BY valid_from`,
    [factorCode]
  );
  return rows as { id: string; valid_from: string; valid_to: string | null; factor_value: string }[];
}

function findFactorForDate(
  factorRows: { id: string; valid_from: string; valid_to: string | null; factor_value: string }[],
  date: Date
) {
  // CR-04: the row whose validity period contains this date. valid_to NULL
  // means open-ended / still in force.
  return factorRows.find((f) => {
    // pg returns DATE columns as JS Date objects (midnight UTC), not strings --
    // wrap with new Date() defensively either way, then push valid_to to the
    // end of that day since the validity period is inclusive of its last day.
    const from = new Date(f.valid_from);
    const to = f.valid_to ? new Date(new Date(f.valid_to).getTime() + (24 * 60 * 60 * 1000 - 1)) : null;
    return date >= from && (to === null || date <= to);
  });
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: events } = await client.query(
    `SELECT e.id, e.source_code, e.start_datetime, e.end_datetime,
            e.reported_volume, e.volume_unit, m.factor_code
     FROM emission_events e
     JOIN source_factor_mapping m ON m.source_code = e.source_code
     WHERE e.is_accepted = true`
  );

  // Cache factor history per stream so we don't re-query per event.
  const factorCache = new Map<string, Awaited<ReturnType<typeof getFactorRows>>>();

  let segmentCount = 0;

  for (const ev of events) {
    const start: Date = ev.start_datetime;
    const end: Date = ev.end_datetime;
    const totalVolume = toKsm3(parseFloat(ev.reported_volume), ev.volume_unit);
    const totalHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;

    if (!factorCache.has(ev.factor_code)) {
      factorCache.set(ev.factor_code, await getFactorRows(client, ev.factor_code));
    }
    const factorRows = factorCache.get(ev.factor_code)!;

    // Factor boundaries: valid_from dates strictly inside (start, end).
    const factorBoundaries = factorRows
      .map((f) => new Date(f.valid_from))
      .filter((d) => d > start && d < end);

    const monthBoundaries = getMonthBoundaries(start, end);

    // Merge, dedupe (by ISO string), sort.
    const cutPoints = [...new Set([...monthBoundaries, ...factorBoundaries].map((d) => d.toISOString()))]
      .map((s) => new Date(s))
      .sort((a, b) => a.getTime() - b.getTime());

    const edges = [start, ...cutPoints, end];

    for (let i = 0; i < edges.length - 1; i++) {
      const segStart = edges[i];
      const segEnd = edges[i + 1];
      // Decimal, not native JS float math: 2.05 etc. aren't exactly
      // representable in binary, so plain `*`/`/` introduces tiny errors
      // that compound across segments (verified: caused 862.647 instead of
      // the correct 862.648 on the worked example). CR-05 requires
      // intermediate values to stay unrounded -- that only means something
      // if the arithmetic itself is exact to begin with.
      const segHours = new Decimal(segEnd.getTime() - segStart.getTime()).div(MS_PER_HOUR);
      const segVolumeDec = segHours.div(totalHours).times(totalVolume);
      const segVolume = segVolumeDec.toNumber();

      // Use segStart to resolve which factor row applies -- safe since
      // boundaries guarantee no factor change mid-segment.
      const factor = findFactorForDate(factorRows, segStart);
      if (!factor) {
        throw new Error(`No factor found for event ${ev.id} segment starting ${segStart.toISOString()}`);
      }

      const co2e = segVolumeDec.times(factor.factor_value).toNumber();

      // period_month: first-of-month for the segment's own month.
      const periodMonth = `${segStart.getUTCFullYear()}-${String(segStart.getUTCMonth() + 1).padStart(2, "0")}-01`;

      await client.query(
        `INSERT INTO event_co2e_segments (event_id, factor_id, period_month, segment_volume_ksm3, co2e_tco2e)
         VALUES ($1,$2,$3,$4,$5)`,
        [ev.id, factor.id, periodMonth, segVolume, co2e]
      );
      segmentCount++;
    }
  }

  console.log(`created ${segmentCount} segments from ${events.length} accepted events`);

  // Self-check against the brief's worked example.
  const { rows: check } = await client.query(
    `SELECT SUM(co2e_tco2e) AS total
     FROM event_co2e_segments s
     JOIN emission_events e ON e.id = s.event_id
     WHERE e.event_ref = 'FVE-00127'`
  );
  const total = parseFloat(check[0].total);
  console.log(`FVE-00127 total CO2e: ${total.toFixed(3)} tCO2e (expected 862.648)`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
