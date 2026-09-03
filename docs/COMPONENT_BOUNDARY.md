# Server / Client Component Boundary (TC-01)

Every component in this app, and why it's server or client. Default is
server; a component is only marked `"use client"` when it genuinely
needs something only the browser provides.

## Layout and navigation

| Component | Type | Why |
|---|---|---|
| `app/layout.tsx` | Server | Static shell (fonts, metadata, wraps children); also reads the session server-side to pass username/role down as props. No state, no interactivity of its own. |
| `components/Nav.tsx` | **Client** | Uses `usePathname()`/`useSearchParams()` to highlight the active link (including query-string-based links like "Exceptions"), and has a click handler for the sign-out button. Both only work in the browser. |

## Pages that only display data

| Component | Type | Why |
|---|---|---|
| `app/page.tsx` (dashboard) | Server | Queries the database directly via `lib/dashboard.ts` at request time. The period selector and the clickable month-drill-down bars are plain `<form method="GET">`/`<Link>` elements — the server component re-reads `searchParams` on each navigation, no client JS needed. |
| `app/register/page.tsx` | Server | Same reasoning — queries directly, renders a table. The filter form (source/date/status) is a plain `<form method="GET">`; submitting reloads with new query params, which the server component reads via `searchParams`. |
| `app/sources/page.tsx` | Server | Pure display — one query, one table, no interactivity beyond following links. |
| `app/factors/page.tsx` | Server | Same — one query, grouped display, a link to the supersede page (not a client-side action itself). |

## Pages that host a form

These pages are themselves server components — they only fetch context
(existing record, list of sources, session/role) and hand it to a
client-component form as props. The *page* never holds form state.

| Page (server) | Client form it hosts | Why the form must be client |
|---|---|---|
| `app/login/page.tsx` | `components/LoginForm.tsx` | `useState` for field values/submit status, `onSubmit` handler, `fetch` to `/api/login`. |
| `app/register/new/page.tsx` | `components/EventForm.tsx` | Same — field state, live validation-error display, `fetch` to `/api/events`. |
| `app/register/[id]/edit/page.tsx` | `components/EventForm.tsx` (shared, edit mode) | Same component, reused — see below. |
| `app/register/[id]/void/page.tsx` | `components/VoidEventForm.tsx` | Needs to capture a typed reason and show a submit/error state live. |
| `app/factors/supersede/page.tsx` | `components/SupersedeFactorForm.tsx` | Needs live field state (selected stream, new value) and to show the currently-open factor's details as the selection changes. |
| `app/month-close/page.tsx` | `components/MonthCloseForm.tsx` | Needs submit/error state and to refresh the closed-months list after a successful close, without a full page reload. |

**Why `EventForm.tsx` is one component, not two:** create and amend
need identical field state, validation-error display, and submission
handling — the only difference is which HTTP method and URL to submit
to, and whether fields start pre-filled. Splitting it into two nearly
identical components would just be duplicated code with two places to
fix the same bug.

## Why none of the filter/query forms are client components

This was a deliberate choice, not an oversight, and applies to every
filter across the app (register, dashboard period selector): a
`<select>`/`<input>` inside a plain `<form method="GET">` needs zero
JavaScript to work — the browser's native form submission already
turns field values into URL query parameters and reloads the page.
Since the destination page is a server component reading
`searchParams`, this "just works" without `useState`, `onChange`
handlers, or `"use client"` anywhere. A JavaScript-driven filter
(updating results without a page reload) would be a legitimate
alternative, but it would be added complexity for a marginal UX gain —
not something to reach for by default.
