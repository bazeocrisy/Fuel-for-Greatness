# Fuel for Greatness — School Lunch Favorites

Upload the **contents of this folder** to your GitHub repo root.

```
index.html                 ← the entire wizard, self-contained, no build step
functions/api/submit.js    ← Cloudflare Pages Function (email delivery)
README.md
```

## Cloudflare Pages setup
1. Push these files to GitHub.
2. Cloudflare Pages → Create project → connect the repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
3. Settings → Environment variables → add as **encrypted** secrets:
   - `RESEND_API_KEY` — API key from your email provider
   - `TO_EMAIL` — `bazeocrisy@yahoo.com`
   - `FROM_EMAIL` — a verified sender on a domain you control
4. Deploy. `functions/api/submit.js` is picked up automatically and served at `/api/submit`.

Until those variables are set, the wizard will show its "We couldn't send it yet" screen on submit — selections stay saved either way.

Changing email providers means editing only `sendEmail()` in `functions/api/submit.js`. Nothing secret ever reaches the browser.

## Testing before the kids use it
Opening screen → **Enter Parent Test Mode** → preview as either child. Test progress is stored under its own `parentTest` key and can never touch Gabriella's or Christopher's saved data. Test submissions arrive with subject `[TEST] Fuel for Greatness — <name> Preview`.

## Data storage
Browser `localStorage`, key `lunchFavorites.v1`, one record per profile (`gabriella`, `christopher`, `parentTest`). Autosaves on every tap and every step change; never cleared by submitting or by a failed send. Only the parent "Start over" / "Clear this profile" / "Reset test data" buttons erase a record.

## Editing the food lists
`index.html` is a compiled file. To change foods, edit `School Lunch Favorites.dc.html` in the design project — the lists live in one block at the top of the logic section (`static CATS` for the nine categories, `static EXTRAS` for dips), each item written as `{ n: 'Name', e: '🍎' }` — then re-export this folder.
