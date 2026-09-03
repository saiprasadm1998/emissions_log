# API Design — Route / Role Matrix

Maps every route directly to a row in the Section 8 authorisation matrix.
Enforced server-side on every route (TC-01) — never assumed from hidden
UI elements.

| Capability (Section 8) | Route | Roles allowed | Extra condition |
|---|---|---|---|
| View dashboard/registers | `GET /api/dashboard`, `GET /api/sources`, `GET /api/factors`, `GET /api/events` | Data Entry, Approver, Auditor | — |
| Create an event | `POST /api/events` | Data Entry, Approver | event's month must not be in `month_closures` |
| Amend an event | `PATCH /api/events/:id` | Data Entry, Approver | same — target period must be open |
| Void an event | `PATCH /api/events/:id/void` | Approver only | request body must include a reason |
| Maintain source register | `POST /api/sources`, `PATCH /api/sources/:code` | Approver only | — |
| Supersede an emission factor | `POST /api/factors/supersede` | Approver only | relies on the `EXCLUDE` constraint to reject overlaps |
| Close a calendar month | `POST /api/month-closures` | Approver only | — |
| Reopen a closed month | *no route* | nobody | FR-08 — not exposed anywhere, not just permission-blocked |
| View audit trail | `GET /api/audit-log` | Approver, Auditor | Data Entry denied |
| Delete any record permanently | *no route* | nobody | same reasoning as reopen — no delete route exists at all |
| View exception register (FR-12) | `GET /api/events?status=rejected` (also `/register?status=rejected` in the UI) | Data Entry, Approver, Auditor | same route as the general event register — a filter, not a separate resource |
| Export monthly figures (FR-14) | `GET /api/export` | Data Entry, Approver, Auditor | — |

## Why two routes have no implementation, rather than a permission check that always fails

"Reopen a month" and "delete permanently" are both marked **Denied** for
every role in Section 8 — no role can ever do them. Implementing them as
routes that check role and always return 403 would still leave an attack
surface (a bug in the check could accidentally allow it) and misrepresents
the requirement, which is that the *capability itself* shouldn't exist,
not that it should be gated. Simplest and safest: the code path doesn't
exist.
