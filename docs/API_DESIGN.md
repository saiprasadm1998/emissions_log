# API Design — Route / Role Matrix

Maps every route directly to a row in the Section 8 authorisation matrix.
Enforced server-side on every route (TC-01)

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

## Why two routes have no implementation, rather than a permission check that always fails

"Reopen a month" and "delete permanently" are both marked **Denied** for
every role in Section 8 — no role can do them. The code path doesn't
exist.
