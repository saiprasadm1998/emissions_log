# Data Model

Schema is delivered as ordered SQL migrations in `db/` (`000_extensions.sql`
through `008_audit_log.sql`), run via `npm run migrate`. This document
explains the key decisions; for exact column definitions and constraints,
read the migration files themselves.

## Tables

1. **emission_sources** — the equipment register (Appendix A.1).
2. **emission_factors** — the versioned factor register (Appendix A.2/B).
3. **source_factor_mapping** — which factor stream each source belongs to
   (Appendix A.3).
4. **emission_events** — raw captured events (Appendix A.3/FR-04).
5. **event_co2e_segments** — calculated results, one row per
   (calendar-month × factor-validity-period) slice of an accepted event.
6. **users** — the three roles (Section 8).
7. **month_closures** — period-lock ledger (FR-07/FR-08).
8. **audit_log** — one row per mutating operation (FR-15).

## Key selection

- **`emission_sources.source_code`** and **`source_factor_mapping.source_code`**
  use natural keys — already stable and unique in the source data, so a
  surrogate key would only add a join for no benefit.
- **`emission_factors.id`**, **`emission_events.id`**,
  **`event_co2e_segments.id`**, and **`audit_log.id`** use surrogate UUID
  keys, because in each case the natural-looking column carries a business
  rule that makes it unsafe as a row identity:
  - `emission_factors.factor_code` is not unique — multiple validity
    periods share a code.
  - `emission_events.event_ref` must allow duplicates to be *stored*
    (VR-03: "every record sharing the duplicated reference shall be
    rejected [but] retained for exception reporting") — a PK here would
    make Postgres refuse the second/third copy outright.
  - `event_co2e_segments` and `audit_log` have no natural unique
    identifier at all.

## Factor versioning (the central design decision, Section 4)

`emission_factors` has one row per **validity period** of a stream
(`factor_code`), not one row per stream:

- `valid_from`/`valid_to` bound the period; `valid_to IS NULL` means
  "in force indefinitely."
- An `EXCLUDE USING gist (factor_code WITH =, daterange(valid_from,
  valid_to, '[]') WITH &&)` constraint makes it **impossible at the
  database level** to insert two overlapping validity periods for the
  same stream — enforced atomically, not by application logic.
- Superseding a factor never edits an existing row — it closes the
  current open period's `valid_to` and inserts a new row. Every
  historical calculation keeps pointing at the exact row it used.
- `event_co2e_segments.factor_id` is a direct foreign key to the
  specific `emission_factors` row applied to that segment — never a
  copy of the value, never just the `factor_code`. This is what a
  red-flagged design (RF-07) is checked against.

## Why calculation results are a separate table from events

`emission_events` stores what was reported. `event_co2e_segments` stores
what the calculation engine derived: for an accepted event, one row per
(month × factor-period) segment, each with its own apportioned volume,
the exact factor version used, and the resulting CO2e.

An event splits at every boundary — month-start **or** factor-validity-
start — that falls inside its date range, whichever comes first (CR-02).
These are two independent reasons to split (month splitting supports
period-close/reporting; factor splitting reflects a rate change) that
happen to coincide in the supplied dataset (both fall on 1 Jan 2025) but
are not the same mechanic — see `docs/ASSUMPTIONS.md` for the general
boundary-merging algorithm.

Aggregation (dashboard, exports) sums/groups over `event_co2e_segments`
in SQL — never by pulling rows into JS and reducing (TC-05).

## Validation (VR-01–VR-04)

Applied in `scripts/seed.ts` at import time, not as database CHECK/NOT
NULL constraints — because a row failing validation must still be
*insertable and retained* (FR-06), which a hard database constraint
would prevent. `emission_events.rejection_reasons` is `TEXT[]`, not a
single column, because a row can fail more than one rule simultaneously.

## Calculation (CR-01–CR-05)

- **CR-01**: `reported_volume`/`volume_unit` are kept as originally
  entered; normalisation to kSm³ happens at calculation time
  (`scripts/calculate.ts`), not by overwriting the stored value.
- **CR-02**: segment volume is apportioned by the segment's share of the
  event's total elapsed duration (hours), not evenly split.
- **CR-03/CR-04**: segment CO2e = segment volume × the factor value
  whose validity period contains that segment's dates.
- **CR-05**: all arithmetic uses `decimal.js`, not native JS floating
  point — verified necessary: an early version using plain `*`/`/`
  produced `862.647` instead of the correct `862.648` on the FVE-00127
  worked example, because `2.05`/`2.13` aren't exactly representable in
  binary floating point. Rounding to 3dp happens only at
  presentation/export, never on stored or intermediate values.
