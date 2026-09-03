# Server / Client Component Boundary (TC-01)

Every component in this app, and why it's server or client. Default is
server; a component is only marked `"use client"` when it genuinely
needs something only the browser provides.

| Component | Type | Why |
|---|---|---|
| `app/layout.tsx` | Server | Static shell (fonts, metadata, wraps children). No state, no interactivity. |
| `components/Nav.tsx` | **Client** | Uses `usePathname()` to highlight the active link. That hook only works in the browser, since it reads the live route — there's no server-side equivalent that doesn't require a full page reload to know "where am I now." |
| `app/page.tsx` (dashboard) | Server | Queries the database directly via `lib/dashboard.ts` at request time and renders static HTML. No user interaction on this page beyond following links (which are plain `<Link>`s, not stateful). |
| `app/register/page.tsx` | Server | Same reasoning — queries directly, renders a table. The filter "form" is a plain HTML `<form method="GET">`: submitting it reloads the page with new `?source_code=...` query params, which the server component reads via `searchParams`. No client JS needed for filtering at all. |
| `app/register/new/page.tsx` | Server | Only fetches the list of active sources for the dropdown (a direct DB query) and renders the client form component with that data as a prop. The page itself holds no state. |
| `components/EventForm.tsx` | **Client** | The one component that genuinely can't be server-rendered: it needs `useState` for field values and submission status, an `onSubmit` handler, and a `fetch` call to the API from the browser (the browser has no direct DB access, unlike a server component — see docs/ASSUMPTIONS.md). |

## Why the filter form on the register page is NOT a client component

This was a deliberate choice, not an oversight: a `<select>`/`<input>`
inside a plain `<form method="GET">` needs zero JavaScript to work — the
browser's native form submission already turns field values into URL
query parameters and reloads the page. Since the register page is a
server component reading `searchParams`, this "just works" without
`useState`, `onChange` handlers, or `"use client"` anywhere. A
JavaScript-driven filter (updating results without a page reload) would
be a legitimate alternative, but it would be added complexity for a
marginal UX gain — not something to reach for by default.
