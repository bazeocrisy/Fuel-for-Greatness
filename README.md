# Fuel for Greatness — School Lunch Food Favorites

Mobile wizard where Gabriella and Christopher pick the parent-approved foods they actually like. Deployed as a **Cloudflare Worker with static assets**.

```
index.html        the whole app (self-contained, no build step)
worker.js         the backend: serves the site + handles POST /api/submit
wrangler.jsonc    Worker name, entry point, assets binding, /api/* routing
.assetsignore     keeps .git and backend files off the public site
.gitignore
README.md
```

## Architecture

```
browser → POST /api/submit → Worker (validates, builds HTML email + PDF) → Resend → parents
GET /   → Worker → env.ASSETS.fetch() → index.html
```

`run_worker_first: ["/api/*"]` makes the Worker execute before static-asset lookup, so `/api/submit` is genuinely server-side. The browser never talks to Resend and never sees a key.

## Cloudflare setup

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

## Local testing

```
npx wrangler dev
```
Put secrets in a local `.dev.vars` file (git-ignored).
