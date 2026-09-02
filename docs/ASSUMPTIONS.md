# Assumptions and Scoping Decisions

Recorded as decisions were made, not reconstructed afterward.

## Data model

- **Void reason stored as a column on `emission_events`
  (`void_reason TEXT`)**, not a separate table. Sufficient for this
  scope; a separate table would only be worth it if tracking who/when
  needed to be independent of `remarks`.
- **`month_closures` has no status column** — a row's existence means
  the month is closed. Deliberately no way to "un-close" via the
  schema (FR-08); reopening, if ever needed, would be a manual DB
  procedure, not a feature.
- **`audit_log.entity_type`/`entity_id` are not foreign keys** — they
  reference different tables depending on the action, so a normal FK
  isn't possible. Integrity here relies on application logic writing
  correct values, not database enforcement.

## Calculation

- **Floating-point precision**: `scripts/calculate.ts` uses `decimal.js`
  for all volume/CO2e arithmetic, not native JS numbers. Verified
  necessary during development — plain `*`/`/` produced `862.647`
  instead of the correct `862.648` on the FVE-00127 worked example,
  because factor values like 2.05 aren't exactly representable in
  binary floating point.
- **Segment boundary resolution**: when determining which factor row
  applies to a segment, the segment's *start* timestamp is used (not
  end or midpoint) — safe because boundaries are defined precisely so
  that no factor change occurs within a single segment.
- **Timezone**: all timestamps are treated as UTC throughout — the
  supplied raw event data is UTC (`Z` suffix), and no site-local
  timezone is specified anywhere in the brief or scaffold, so the
  system does not attempt any timezone conversion. Month boundaries
  (used for CR-02 splitting) are therefore calendar-month boundaries
  in UTC, not in any local site time.

## Scope, given time constraints

- Data model, migrations, seed script (with VR-01–VR-04 validation),
  and the calculation engine (CR-01–CR-05, verified against the
  FVE-00127 worked example and the 128/8 accept-reject figure) are
  complete and independently verified.
- Given the available time, API and UI are being attempted next, in
  that order, prioritising server-side RBAC correctness over UI polish.
  This log will be updated with what was and wasn't completed.
