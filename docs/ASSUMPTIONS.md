# Assumptions and Scoping Decisions

Recorded as decisions were made.

## Data model

- **Void reason stored as a column on `emission_events`
  (`void_reason TEXT`)**, not a separate table. Sufficient for this
  scope. A separate table would only be required if tracking more information.
- **`month_closures` has no status column**. A row's existence means
  the month is closed leaving no way to "un-close" schema (FR-08). If 
  reopening is ever needed, it can only be done via a manual DB procedure.
  **FR-08 also explicitly requires documenting on how to reopen a month if 
  operationally necessary**:

  1. The business reason must be documented outside the system first
     (a change ticket or equivalent). Reopening a closed month is
     never routine so a reason has to exist before anyone
     touches the database directly.
  2. Approval for the reopening itself must come from someone with
     authority over the closed period, obtained *outside* the application 
     since no role inside the app is permitted to authorise this by design.
  3. A person with direct production database access shall remove the lock 
     with a single, precise statement identifying the exact period:
     ```sql
     DELETE FROM month_closures WHERE period_month = 'YYYY-MM-01';
     ```
     This only removes the *lock*. It does not touch any event or
     segment data. Once removed, events in that period become
     editable again through the normal application flow (create,
     amend, void), with all of VR-01 to VR-04 and the calculation engine
     applying exactly as they would to any other open period.
  4. Because this action happens outside the application, it is not
     automatically captured by the in-app audit mechanism. The person
     performing it should record the action manually.
  5. Once the necessary correction is made, the month should be
     re-closed through the *normal* application flow
     (`POST /api/month-closures`) restoring the lock through the
     same controlled path every other closure goes through.

  The procedure is deliberately manual and outside the application at
  every step as per FR-08.
- **`audit_log.entity_type`/`entity_id` are not foreign keys**. They
  reference different tables depending on the action, so a normal FK
  isn't possible. Integrity here relies on application logic writing
  correct values, not database enforcement.

## Calculation

- **Floating-point precision**: `scripts/calculate.ts` uses `decimal.js`
  for all volume/CO2e arithmetic instead of native JS numbers because 
  plain `*`/`/` produced `862.647` instead of the correct `862.648` on 
  the FVE-00127 worked example. This was because factor values like 2.05 
  aren't exactly representable in binary floating point.
- **Segment boundary resolution**: when determining which factor row
  applies to a segment, the segment's *start* timestamp is used (not
  end or midpoint). This approach is safe because boundaries are defined 
  precisely so that no factor change occurs within a single segment.
- **Timezone**: all timestamps are treated as UTC throughout. The
  supplied raw event data is UTC (`Z` suffix) and no site-local
  timezone is specified anywhere in the brief or scaffold. So the
  system does not attempt any timezone conversion. Month boundaries
  (used for CR-02 splitting) are therefore calendar-month boundaries
  in UTC.

## Scope, given time constraints

- Data model, migrations, seed script (with VR-01 to VR-04 validation),
  calculation engine (CR-01 to CR-05, verified against the FVE-00127
  worked example and the 128/8 accept-reject figure), and the complete
  API + UI (every M-priority route and view) are finished and
  independently verified. Every route was tested with real requests
  against a running server, every UI view was tested through a real
  browser.
- **D-priority requirements attempted after all M requirements were
  confirmed complete**: FR-11 (factor supersession UI), FR-12
  (exception register), and FR-14 (monthly CSV export) are done and
  verified. 
- **FR-13 (bulk import) deliberately omitted**, as a scope decision
  made after design consideration. The single-event validation path 
  (VR-01 to VR-04) is well-defined for one record at a time but a 
  repeatable bulk-import feature raises a genuine ambiguity. 
  It is how to handle a re-uploaded file that partially 
  overlaps previously imported data. For example, some rows from the
  new data may share an `event_ref` with an already-stored (accepted or
  \rejected) row from an earlier import. Silently re-inserting duplicates, 
  silently skipping them, or rejecting the whole file are all defensible 
  choices with different operational implications. Picking one without 
  a clearer specification of the intended workflow felt like guessing at
  something that should be a deliberate product decision. 
- **Audit log write-side (FR-15) not included in this submission.**
  Deprioritised in favour of finishing the other D-priority items and
  preparing for review. 

## UI and D-requirement design decisions

- **FR-12 (exception register) is a filter on the existing register
  view, not a separate page.** as FR-12 only needs a way to see the 
  rejected slice of it. A second page would duplicate the table, 
  columns, and query logic for no real benefit.
- **FR-11 (factor supersession) dropdown only lists currently open
  factor streams** (`valid_to IS NULL`), not the full factor history.
  Superseding a *closed* period doesn't correspond to any real
  operation the system supports. Supersession specifically means
  closing the currently active period and opening a new one, so listing
  already-closed rows would just invite a confusing, meaningless
  selection.
- **FR-14 (export) is one row per `event_co2e_segments` row, not one
  row per `emission_events` row.** The brief asks for "monthly
  reporting figures including the emission factor version applied to
  each line". That's a segment-level export by definition, since an
  event that spans a month or factor boundary produces more than one
  reporting line, each against a different factor version. Format is
  CSV (not JSON) since "monthly reporting figures" implies a
  machine-readable output.
- **Server vs client component choices** for all UI views are covered
  separately in `docs/COMPONENT_BOUNDARY.md` and the README's TC-01
  section, not duplicated here.

## Bugs found and fixed during testing

Recorded here deliberately — these are evidence of actual testing
rigor (build it, test it with real requests/browser sessions, find
what's actually wrong, fix it, re-verify).

- **Floating-point precision** (calculation engine): see the
  Calculation section above — `decimal.js` used throughout instead of
  native JS numbers, after plain `*`/`/` produced `862.647` instead of
  the correct `862.648`.
- **DATE column timezone/DST bug**: `pg`'s default parser for
  PostgreSQL `DATE` columns (`valid_from`, `valid_to`, `period_month`)
  constructs a JavaScript `Date` using the *local* timezone
  constructor. Whether this then displays the wrong calendar day
  depends on whether that specific date falls within daylight saving
  time on the server's local clock but not just the general UTC offset.
  This was invisible in initial testing (UTC server clock) and only
  surfaced when run on a UK machine during British Summer Time: an
  October date displayed as the previous day, while a January date
  (GMT, no DST) displayed correctly with the exact same code path.
  Fixed by configuring `pg` to return `DATE` columns as raw
  `YYYY-MM-DD` strings (`pg.types.setTypeParser(1082, v => v)`) rather
  than letting it construct a `Date` object at all. Every consumer
  already wraps the value in `new Date(...)` before use, and an ISO
  date-only string is parsed as UTC unambiguously per the JS spec,
  regardless of server timezone. Applied independently in both
  `lib/db.ts` (the Next.js app) and `scripts/calculate.ts` (a separate
  process with its own database connection) since the fix doesn't
  propagate across process boundaries.
  Verified this didn't corrupt any *already-computed* segment data:
  every factor validity boundary in the supplied dataset falls on
  1 January, which sits in GMT (no DST) and was therefore never
  affected. This was confirmed by re-running the calculation engine from a
  clean slate on the affected machine post-fix and getting the
  identical `862.648` result. The bug was real and affected only the date
  *display* (dashboard, CSV export) on that machine. It did not affect
  the underlying calculation.
- **TypeScript errors caught by a full build**: `npm run dev` does not
  run complete type-checking so a production build (`npm run build`)
  was run specifically to catch this. It surfaced type errors that had
  been silently present in the API routes for some time (unnormalized
  `undefined | null` types passed into shared validation logic). This was fixed and
  then `build` re-run was clean.

