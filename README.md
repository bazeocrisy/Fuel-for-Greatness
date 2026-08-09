# Fuel for Greatness

A school-lunch food-favorites app for the Bazemore family. Two children complete a
guided wizard about what they like to eat; their parents review and approve the
results in a private portal.

```
index.html        the child wizard (self-contained, no build step)
parent.html       the Parent Portal, served at /parent (Cloudflare Access)
build.js          the single build stamp both pages display
worker.js         the backend: routing, validation, D1 reads/writes, PDF
wrangler.jsonc    Worker name, entry point, assets + D1 binding, /api/* routing
schema.sql        D1 tables (apply once)
seed.sql          children + food catalog (apply once, after schema)
```

Current build: **2026.08.09-16**

## Deployment

GitHub `main` is the deployment path. Push to `main` and Cloudflare builds and
deploys the Worker. `wrangler.jsonc` is tracked in the repo because the build needs
the D1 binding; it holds a database id, not a secret.

```powershell
cd C:\Fuel-for-Greatness
git add -A
git commit -m "..."
git push
```

## Architecture

```
GET  /                        → Worker → env.ASSETS.fetch() → index.html      (public)
POST /api/child/:slug/profile → Worker → validate → D1                        (public)
GET  /api/child/:slug/status  → Worker → D1 (has-profile flags only)          (public)
GET  /parent                  → Cloudflare Access → Worker → parent.html
*    /api/parent/*            → Cloudflare Access → Worker → D1
```

`run_worker_first` is `true`, so **every** request enters the Worker before static
assets are considered. That matters: a path *list* only covers the spellings it
literally matches, and `//parent.html` matches none of them — the portal shell would
have been served straight off static assets with no Worker involvement. The Worker
normalizes the request path, 308-redirects any non-canonical parent spelling
(`/parent.html`, `//parent.html`, `/Parent/`, `/parent/./x`) to `/parent` so the
Access rule always evaluates it, and falls through to `env.ASSETS.fetch(request)` for
ordinary files.

There is no email in this application. No Resend, no API key, no `/api/submit`.
Parents read profiles in the portal and print the PDF from there.

## Parent authentication — Cloudflare Access only

- Application paths: `/parent*` and `/api/parent/*` on the Worker domain.
- Policy: **Allow**, Include → *Emails* → the two parent addresses.
- Login method: **One-time PIN**.

The Worker reads only the Access identity header
(`cf-access-authenticated-user-email`, or `cf-access-jwt-assertion`) and fails
**closed**: no identity means `401` and no family data. There is no application
password. `PARENT_PASSCODE`, `PARENT_SIGNING_KEY` and the old `ffg_parent` cookie
are gone from the code and can be deleted from the Worker's secrets. Sign out links
to `/cdn-cgi/access/logout`.

Destructive parent POSTs (reset, approve, decline) additionally require a
same-origin `Origin` header.

## Profile lifecycle

| Event | Result |
|---|---|
| First completed wizard | session v1 `approved`; preference tables populated; `children.active_session_id` set |
| Retake while a profile exists | new session `pending`; approved data untouched |
| Parent APPROVE UPDATE | snapshot revalidated; old approved → `superseded`; pending → `approved`; tables replaced; `active_session_id` repointed |
| Parent DECLINE UPDATE | pending → `declined`; approved data untouched |
| Parent RESET FOOD PROFILE | that child's preferences, category responses and **all** sessions deleted; `active_session_id` NULL |

Reset keeps the child row, name, grade, theme, family link, the food catalog and all
app configuration, and never touches the other child. It requires both a confirmation
modal and `{confirm:true}` on the API. Reset is parent-only — the child app has no
reset control anywhere.

After a reset, the child's device reconciles on next load: a **completed** local draft
whose server profile no longer exists is discarded so the old picks cannot be
re-submitted. An in-progress first-time draft is never discarded, and if the status
check fails the local data is preserved untouched.

## API

### Public
| Route | Purpose |
|---|---|
| `POST /api/child/:slug/profile` | save a completed wizard (64 KB cap, slug allow-list, categories and food names validated against D1, server-computed totals, test mode discarded before any D1 access) |
| `GET /api/child/:slug/status` | `{exists, saved, pending, lastCompletedAt}` — no food data |

### Cloudflare Access required
| Route | Purpose |
|---|---|
| `GET /api/parent/session` | identity probe |
| `GET /api/parent/children` | both children: status, version, last updated, counts, pending info |
| `GET /api/parent/children/:slug/profile` | the approved profile |
| `GET /api/parent/children/:slug/pending` | read-only diff of a waiting retake |
| `GET /api/parent/children/:slug/report.pdf` | PDF of the **active approved** profile; a child with none gets a friendly HTML page, never raw JSON |
| `GET /api/parent/compare` | both-like / only-A / only-B, overall and per category (approved data only) |
| `POST /api/parent/children/:slug/pending/approve` | promote the pending snapshot |
| `POST /api/parent/children/:slug/pending/decline` | mark it declined |
| `POST /api/parent/children/:slug/reset` | `{confirm:true}` — erase this child's food profile |

## Database

D1, binding name `DB`. Apply once:

```powershell
npx wrangler d1 execute fuel-for-greatness --remote --file=schema.sql
npx wrangler d1 execute fuel-for-greatness --remote --file=seed.sql
```

`seed.sql` is generated from the wizard's `Component.CATS` / `Component.EXTRAS`. If you
add a food, regenerate it rather than hand-editing, so the two cannot drift.

## Data storage (client)

The wizard autosaves to `localStorage` under `lunchFavorites.v1`, keyed per child,
with Test Mode isolated under its own key. Test Mode never writes to D1: the Worker
returns before any database access, so it creates no session and cannot change an
approved profile.

## PDF

Written directly in PDF syntax in `worker.js` using the base-14 Helvetica fonts — no
headless browser, no npm dependency, no external service. It always renders the active
approved session; a pending or declined submission never appears.

## Build stamp

`build.js` sets `window.FFG_BUILD`, and both pages display it. Bump it there and
nowhere else — the child and parent footers cannot drift apart.
