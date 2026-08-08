# Fuel for Greatness — School Lunch Food Favorites

Mobile wizard where Gabriella and Christopher pick the parent-approved foods they actually like. Deployed as a **Cloudflare Worker with static assets**.

```
index.html        the whole app (self-contained, no build step)
worker.js         the backend: serves the site + handles POST /api/submit
wrangler.jsonc    Worker name, entry point, assets + D1 bindings, /api/* routing
                  NOT included in delivery zips after Phase 2 — it holds your real
                  D1 database_id. Never overwrite it from a download.
schema.sql        Cloudflare D1 schema (Phase 2 — apply once)
seed.sql          D1 reference data: family, children, categories, 201 foods
ARCHITECTURE.md   the Parent Portal + D1 plan and phase order
.assetsignore     keeps .git, backend and SQL files off the public site
.gitignore
README.md
```

## Architecture

```
browser → POST /api/submit → Worker (validates, builds HTML email + PDF) → Resend → parents
GET /   → Worker → env.ASSETS.fetch() → index.html
```

`run_worker_first: ["/api/*"]` makes the Worker execute before static-asset lookup, so `/api/submit` is genuinely server-side. The browser never talks to Resend and never sees a key.

## Cloudflare D1 (Phase 2 — new)

The family database. **Phase 2 adds the schema and the binding only** — no application
code reads or writes D1 yet, so this deploys safely alongside the working email flow.
See `ARCHITECTURE.md` for the full plan and phase order.

One-time setup:

1. **Create the database** — dashboard → Storage & Databases → D1 → Create, name it
   `fuel-for-greatness`. Or from PowerShell:
   ```powershell
   npx wrangler d1 create fuel-for-greatness
   ```
2. **Paste the returned id** into `wrangler.jsonc`, replacing `PASTE_DATABASE_ID_HERE`.
   Commit and push.
3. **Apply the schema and seed data** (once, and again only if the schema changes):
   ```powershell
   npx wrangler d1 execute fuel-for-greatness --remote --file=./schema.sql
   npx wrangler d1 execute fuel-for-greatness --remote --file=./seed.sql
   ```
4. **Verify:**
   ```powershell
   npx wrangler d1 execute fuel-for-greatness --remote --command "SELECT (SELECT COUNT(*) FROM children) AS children, (SELECT COUNT(*) FROM food_categories) AS categories, (SELECT COUNT(*) FROM food_items) AS foods;"
   ```
   Expect `2 / 10 / 201`.

Both SQL files are re-runnable — every statement is `CREATE TABLE IF NOT EXISTS` or
`INSERT OR IGNORE`, so re-applying never duplicates or destroys data.

`seed.sql` is generated from the wizard's own `CATS`/`EXTRAS`/`KIDS` lists. If you add
a food to the wizard, regenerate it rather than hand-editing, so the two cannot drift.

## Cloudflare setup (email — being retired in Phase 3)

Settings → **Variables and Secrets**:

| Name | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | Secret | your Resend API key |
| `FROM_EMAIL` | Variable | a verified sender on a domain you control, e.g. `lunch@yourdomain.com` |
| `TO_EMAILS` | Variable | `bazeocrisy@yahoo.com,stepflem30@gmail.com` |

Until all three exist, `/api/submit` returns `503 {"success":false,"configured":false}` and the app shows its "We couldn't send it yet" screen — selections stay saved either way. Nothing ever fakes success in the browser.

`FROM_EMAIL` must be on a domain verified in Resend. Yahoo/Gmail addresses cannot be used as the sender.

## What the parents receive

One email addressed to both parents containing:

- A branded HTML summary (counts per category, then every selection, category colors, child accent color)
- A designed PDF attachment: cover page with the child's name/grade/date and the FOOD → FUEL → FOCUS → PERFORMANCE line, a category summary, then two-column detail pages with colored category headers, page numbers and a footer

Test-mode submissions are prefixed `[TEST]`, carry a TEST SUBMISSION banner in the email, a TEST MODE / NOT A FINAL CHILD PROFILE block on the PDF cover, and a `TEST_` filename prefix.

Categories the child answered with "None of these for me" print as **None of these** — never as missing data.

**PDF generation:** written directly in PDF syntax inside `worker.js` using the base-14 Helvetica fonts. No headless browser, no npm dependency, no external service, no added cost. Layout is a purpose-built parent report, not a screenshot of the app.

If the PDF or the Resend call fails, the Worker returns a failure and the app keeps every selection in localStorage.

## Data storage (client)

`localStorage`, key `lunchFavorites.v1`, one record per profile (`gabriella`, `christopher`, `parentTest`). Autosaves on every tap; never cleared by submitting or by a failed send. Only the parent "Start over" / "Clear this profile" / "Reset test data" buttons erase a record.

## Editing the food lists

`index.html` is compiled. Edit `School Lunch Favorites.dc.html` in the design project — the lists live in one block at the top of the logic section (`static CATS` for the nine categories, `static EXTRAS` for dips), each item written as `{ n: 'Name', e: '🍎' }` — then re-export.

## Roadmap

Phase 2 (done): D1 schema + binding.
Phase 3: the wizard saves completed profiles to D1; email code removed.
Phases 4–6: Parent Portal dashboard, child profile view + PDF, Compare Profiles.
Then stop — weekly planner, grocery engine and prep plan are a later project.

Parent Portal auth will be **Cloudflare Access** on `/parent*` and `/api/parent/*`.
No credentials in the repo or in client JavaScript, ever.

## Local testing

```
npx wrangler dev
```
Put secrets in a local `.dev.vars` file (git-ignored).
