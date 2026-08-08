# Fuel for Greatness — Architecture Pass: Parent Portal + Cloudflare D1

Status: **proposal — awaiting approval.** No structural code has been changed.
Current live build: `2026.08.08-6`.

---

## 1. Architecture Audit — what exists today

### Front end — `index.html` (built from `School Lunch Favorites.dc.html`)

One self-contained page. No build step at runtime; the `.dc.html` source is bundled
into a single `index.html` before deploy.

| Concern | Where it lives | Verdict |
| --- | --- | --- |
| Child wizard (20 steps: intro → 10× edu/select → review) | `steps()` | **Keep as-is** |
| Two child personas + personalization | `Component.KIDS` | **Keep**, becomes seed data for D1 `children` |
| Food catalog (10 categories + Dips & Extras) | `Component.CATS`, `Component.EXTRAS` | **Keep**, becomes seed data for `food_categories` / `food_items` |
| Selections + intentional "None" | `state.sel`, `state.none` | **Keep**, becomes the payload written to D1 |
| Category validation | `answered()`, `stepAnswered()`, `firstGapStep()` | **Keep** — unchanged |
| Autosave / resume | `persist()` → `localStorage['lunchFavorites.v1']` | **Keep** as working copy |
| Parent/Test Mode | `TEST_KEY`, `enterTest/continueTest/resetTest` | **Keep** — test sessions must NOT write to D1 |
| Review screen + in-page parent summary + `window.print()` | review branch of `renderVals()` | **Keep**, later duplicated in the portal |
| Submission | `submit()` → `POST api/submit`, success only on `data.success === true` | **Refactor** — same shape, new endpoint and meaning |
| Bottom fixed nav, mobile layout, build stamp | template | **Keep** |

### Back end — `worker.js` (490 lines)

| Block | Lines (approx) | Verdict |
| --- | --- | --- |
| `fetch()` router: `/api/submit`, else `env.ASSETS.fetch` | 17–29 | **Refactor** into a small route table |
| `handleSubmit()` — parse, size guard, validate | 33–95 | **Reuse** the validation; drop the email half |
| `CATEGORY_META`, `CHILD_THEME`, `normalize()` | 97–150 | **Reuse verbatim** — this is the report model, not email |
| `buildPdf()` + PDF primitives (`pdfFilename`, `base64`, text/rect helpers) | ~200–470 | **Reuse verbatim** — moves behind a portal endpoint |
| `emailHtml()`, `emailText()`, `subjectFor()` | ~150–200 | **Remove** — email-only |
| Resend `fetch()` call + `RESEND_API_KEY` / `FROM_EMAIL` / `TO_EMAILS` handling | 45–92 | **Remove** |
| `json()` helper | end | **Keep** |

**Nothing in the PDF generator touches Resend.** It takes a `report` object from
`normalize()` and returns bytes. That is a clean seam — the PDF survives the email
removal untouched, and the same bytes get served as `application/pdf` from the portal.

### Config

- `wrangler.jsonc` — Worker + ASSETS binding. Needs a `d1_databases` block added.
- `.assetsignore` — keeps `worker.js`, `*.md`, `*.sql` off the public site. Needs `schema.sql` added.

### Known constraints carried into the new design

- The app is served from a Worker at the domain root, so relative `api/...` paths resolve correctly. The GitHub Pages copy has no backend and will not save to D1 — the portal will show a clear "offline / no server" state rather than failing silently.
- Test Mode must never create or overwrite a real D1 profile.

---

## 2. Proposed D1 Schema

Deliberately small. Everything the wizard produces fits; the future modules get
their own tables later without touching these.

```sql
-- schema.sql  (Phase 2)

CREATE TABLE IF NOT EXISTS families (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,          -- 'bazemore'
  display_name TEXT NOT NULL,                -- 'Bazemore Family'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   INTEGER NOT NULL REFERENCES families(id),
  slug        TEXT NOT NULL UNIQUE,          -- 'gabriella' | 'christopher'
  full_name   TEXT NOT NULL,                 -- 'Ms. Gabriella Bazemore'
  first_name  TEXT NOT NULL,
  grade       TEXT NOT NULL,
  accent      TEXT,                          -- hex, mirrors the wizard theme
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS food_categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,         -- 'protein','carbs','fruit',…,'extras'
  display_name TEXT NOT NULL,                -- 'Proteins'
  emoji        TEXT,
  sort_order   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS food_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES food_categories(id),
  name        TEXT NOT NULL,                 -- 'Roasted Chickpeas'
  emoji       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  UNIQUE (category_id, name)
);

-- One row per liked food. Absence = not selected.
CREATE TABLE IF NOT EXISTS child_food_preferences (
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  food_item_id INTEGER NOT NULL REFERENCES food_items(id),
  liked        INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, food_item_id)
);

-- Preserves the intentional "None of these for me" answer.
CREATE TABLE IF NOT EXISTS child_category_responses (
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES food_categories(id),
  answered      INTEGER NOT NULL DEFAULT 0,
  none_selected INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, category_id)
);

-- One row per completed run. History is free and useful ("what changed since spring?").
CREATE TABLE IF NOT EXISTS profile_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  completed_at  TEXT NOT NULL,
  total_selected INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,               -- the exact payload the wizard sent
  app_build     TEXT
);

CREATE INDEX IF NOT EXISTS idx_prefs_child ON child_food_preferences(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_child ON profile_sessions(child_id, completed_at DESC);
```

**Design notes**

- `snapshot_json` on every completed run means a profile can always be rebuilt or a PDF regenerated exactly as the child submitted it, even if the food catalog later changes.
- The normalized tables are what Compare and the future grocery engine query.
- Categories and items are seeded from the same lists the wizard already ships, via `schema.sql` + a one-time `POST /api/admin/seed` (protected) or a generated `seed.sql`.
- Future tables (`weekly_plans`, `weekly_plan_meals`, `grocery_lists`, `grocery_items`, `prep_tasks`) attach to `children` / `food_items` with no change to the above.

---

## 3. Parent Portal — information architecture

Separate route, separate visual language: dark slate header, no kid emoji hero,
data-dense rows. It should read as a tool, not a game.

```
/                     Child wizard (unchanged)
/parent               Family Dashboard
/parent/child/:slug   Child Fuel Profile
/parent/compare       Compare Profiles
```

**Family Dashboard**
- Header: "Bazemore Family" · last activity date
- One card per child: name, grade, profile status (Complete / In progress / Not started), last updated, total favorites, per-category answered count
- Card actions: **VIEW PROFILE** · **PLAN LUNCHES** (disabled, "Coming next")
- Family actions row: **COMPARE PROFILES** (live) · **PLAN THIS WEEK** · **BUILD GROCERY LIST** · **PREP PLAN** (all three visibly disabled with a "Phase 7+" tag — present so the shape is legible, not clickable stubs)

**Child Fuel Profile**
- Header: full name, grade, last updated, total favorites
- One section per category in wizard order: count badge, the selected foods as chips, or "None of these for me — answered intentionally"
- Actions: **PRINT / SAVE PDF** (hits the Worker, streams the existing branded PDF) · **RETAKE / UPDATE PROFILE** (opens the wizard for that child; D1 is only rewritten on completion) · **VIEW HISTORY** (list of `profile_sessions`)

**Compare Profiles**
- Summary strip: shared count, Gabriella-only count, Christopher-only count
- Three columns: **Both Like** · **Gabriella Only** · **Christopher Only**
- Toggle: overall ↔ by category
- "Both Like" is labeled **Family Favorites** — the seed of the shared-shopping logic later

Explicitly **not** built in this pass: any grocery list. Per your rule, groceries come from the weekly plan, not from the preference profile.

---

## 4. Files to change

**Created**
- `schema.sql` — the D1 schema above
- `seed.sql` — families/children/categories/items generated from the wizard's own lists
- `Parent Portal.dc.html` → bundled to `deploy/parent.html` — dashboard, child profile, compare
- `deploy/ARCHITECTURE.md` — this document

**Modified**
- `worker.js` — route table; remove Resend + email builders; add D1 handlers; PDF moves behind `GET /api/children/:slug/report.pdf`
- `wrangler.jsonc` — add `d1_databases` binding `DB`; keep ASSETS
- `School Lunch Favorites.dc.html` — `submit()` posts to `api/children/:slug/profile`; button copy → **SAVE MY FOOD FAVORITES**; success copy → "saved and ready for Mom and Dad to review"; Test Mode short-circuits the save; add a Parent Portal entry on the welcome screen
- `.assetsignore` — add `*.sql`
- `README.md` — new setup steps

**Removed**
- `emailHtml()`, `emailText()`, `subjectFor()` and the Resend call in `worker.js`
- Cloudflare vars `RESEND_API_KEY`, `FROM_EMAIL`, `TO_EMAILS` (deleted in the dashboard after deploy)

**Unchanged**
- All wizard steps, validation, personalization, autosave, mobile nav, build stamp
- `normalize()`, `buildPdf()` and every PDF primitive

---

## 5. API surface (Worker)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/children` | parent | Summaries for the dashboard |
| GET | `/api/children/:slug/profile` | parent | One child's full profile |
| POST | `/api/children/:slug/profile` | open (child device) | Save a completed profile; writes prefs, responses, and a `profile_sessions` row |
| GET | `/api/children/:slug/report.pdf` | parent | The existing branded PDF, generated on demand |
| GET | `/api/compare` | parent | Both / only-A / only-B, overall and by category |

The POST is the one open endpoint (a child's phone has no login). It is bounded by:
the 64KB size guard already shipped, a slug allow-list (`gabriella`, `christopher`),
server-side validation of every category and food name against `food_items`, and
`testMode: true` being accepted-but-discarded so Test Mode never writes.

---

## 6. Parent authentication — recommendation

**Recommended: Cloudflare Access (Zero Trust).**

Why:
1. No password logic, no session code, no credential storage in the repo — it's enforced at Cloudflare's edge before your Worker runs.
2. Free tier covers up to 50 users; a two-parent family is well inside it.
3. Login is "email me a one-time PIN" or Google — nothing new to remember, and it works on a phone.
4. Protects `/parent*` and `/api/children*` with a policy of two email addresses. Revoking access later is one dashboard edit.
5. Zero code risk to the working child wizard: the wizard path stays public.

Setup is a policy in the Cloudflare dashboard, not a code change: application path `/parent*` and `/api/children*` (excluding the child POST), policy = Allow, emails = your two addresses.

**Fallback if you'd rather not enable Zero Trust: a Worker-side passphrase.**
`PARENT_PASSCODE` stored as a Cloudflare **Secret**; `POST /api/parent/login` compares it and returns an HttpOnly, Secure, SameSite=Strict cookie holding an HMAC-signed token (WebCrypto, 30-day expiry) signed with a second secret. Parent routes verify the signature. The passcode never reaches browser JavaScript and never enters the repo. More code, slightly weaker, but fully self-contained.

I recommend Access, with the passphrase as plan B. Either way: no credentials in `index.html`, no credentials in client JS.

---

## 7. Migration plan — existing local selections

Nothing is lost and nothing is auto-uploaded without a person deciding.

1. **Ship the new build.** localStorage keeps working exactly as it does now — same key, same shape. An interrupted wizard still resumes.
2. **On the wizard's review screen**, if a completed local profile exists and no D1 profile exists yet for that child, the button reads **SAVE MY FOOD FAVORITES** and one tap writes the existing local selections straight to D1. No re-take needed — the data already on the device is the migration.
3. **On the Parent Dashboard**, a child with no D1 row shows "Not saved yet — open the wizard on the device that has it and tap Save." (Cross-device by definition; localStorage can't be read from another phone.)
4. **After a successful save**, local data is kept, not cleared — the device stays a working copy, and re-saving is idempotent (same child slug overwrites prefs/responses, appends a new `profile_sessions` row).
5. **Test Mode data** is never migrated.

---

## 8. What you will do in Cloudflare

After I make the code changes and you push:

1. **Create the D1 database** — Cloudflare dashboard → Storage & Databases → D1 → Create → name it `fuel-for-greatness`. Copy the database ID it gives you.
2. **Paste that ID into `wrangler.jsonc`** (I'll leave a clearly marked `PASTE_DATABASE_ID_HERE` placeholder — I will not invent an ID), commit, push.
3. **Apply the schema** — either the dashboard's D1 console (paste `schema.sql`, then `seed.sql`), or from PowerShell:
   ```powershell
   npx wrangler d1 execute fuel-for-greatness --remote --file=./schema.sql
   npx wrangler d1 execute fuel-for-greatness --remote --file=./seed.sql
   ```
4. **Set up Access** — Zero Trust → Access → Applications → Add → Self-hosted → path `/parent*` → policy Allow → your two emails. (Or, for plan B, add the `PARENT_PASSCODE` and `PARENT_SIGNING_KEY` secrets.)
5. **Delete the old email variables** — `RESEND_API_KEY`, `FROM_EMAIL`, `TO_EMAILS`. Optionally close the Resend account.
6. **Cloudflare handles automatically after `git push`:** build + deploy of the Worker and static assets, the `DB` binding wiring, and TLS. You do not re-run the schema on later pushes — only when the schema itself changes.

---

## 9. Build order

| Phase | Deliverable | Risk |
| --- | --- | --- |
| 1 | Wizard stays stable (done — build 2026.08.08-6) | — |
| 2 | `schema.sql`, `seed.sql`, `wrangler.jsonc` D1 binding | none — nothing reads it yet |
| 3 | `POST /api/children/:slug/profile`; wizard saves to D1; email code removed | medium — the one change to the live child flow |
| 4 | Parent Dashboard + Access | low — new route |
| 5 | Child Fuel Profile view + PDF endpoint | low |
| 6 | Compare Profiles | low |
| — | **STOP.** Weekly planner, grocery engine, prep plan are the next project. | — |

Each phase ships with its own build number so you can see exactly what landed.

---

---

# ADDENDUM — Approved decisions (awaiting sign-off on the three items below)

Decisions locked: **Cloudflare Access** for parent auth (no custom passcode);
**pending-then-approved** retakes; **Worker URL is production**, custom domain later;
**split API namespaces** (`/api/child/*` public, `/api/parent/*` protected).

## A. Schema modification for pending / approved profiles

The insight that avoids a second set of tables: **`child_food_preferences` and
`child_category_responses` ARE the active approved profile — nothing else.** A pending
submission lives only as `snapshot_json` on its `profile_sessions` row. Approving it
projects that snapshot into the two preference tables. So there is exactly one place
that answers "what is this child actually approved to eat", and it is the same place
the future weekly planner and grocery engine will read.

Three additions, no new tables:

```sql
-- profile_sessions gains status + version + review stamp
CREATE TABLE IF NOT EXISTS profile_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id       INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,            -- 1,2,3… per child
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','superseded','declined')),
  completed_at   TEXT NOT NULL,               -- when the child tapped save
  reviewed_at    TEXT,                        -- when a parent decided
  total_selected INTEGER NOT NULL,
  snapshot_json  TEXT NOT NULL,               -- exact payload as submitted
  app_build      TEXT
);

-- children gains a pointer to the live profile
ALTER TABLE children ADD COLUMN active_session_id INTEGER REFERENCES profile_sessions(id);

CREATE INDEX IF NOT EXISTS idx_sessions_child_status
  ON profile_sessions(child_id, status, version DESC);
```

**Lifecycle**

| Event | What happens |
| --- | --- |
| First completion ever | Session `version 1`, status `approved` (nothing to compare against), projected into the preference tables, `children.active_session_id` set. No parent gate on the very first profile. |
| Retake | New session, `version n+1`, status **`pending`**. Preference tables untouched. Dashboard shows "1 update waiting for review". |
| Parent approves | Old approved session → `superseded`; new session → `approved`; preference tables rewritten from its snapshot; `active_session_id` repointed; `reviewed_at` stamped. |
| Parent keeps current | New session → `declined`, `reviewed_at` stamped. Nothing operational changes. History keeps the submission. |
| Second retake while one is pending | Earlier pending → `superseded`; only the newest pending is reviewable. |

The Phase 2 schema ships with all of this in place. Phase 4 renders the "1 update
waiting" badge; the REVIEW CHANGES / APPROVE / KEEP CURRENT screen is Phase 6.5 —
until it exists, a pending session sits safely in history and the approved profile
keeps driving everything. Nothing operational can change silently, which was the point.

`report.pdf` reads `children.active_session_id` — the approved profile, never a pending one.

## B. Final API route map

**Public — no authentication**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` and static assets | The child wizard |
| POST | `/api/child/:slug/profile` | The only public write. Guards: 64KB cap, slug allow-list (`gabriella`, `christopher`), every category slug and food name validated against `food_categories` / `food_items`, all-categories-answered check, `testMode:true` accepted and discarded, no child creation, no free-form columns — the request body is read field-by-field, never spread into SQL. |
| GET | `/api/child/:slug/status` | Tiny: `{saved, lastCompletedAt, pending}` so the wizard can say "already saved" without exposing any food data. |

**Protected — Cloudflare Access on the path**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/parent*` | Portal HTML |
| GET | `/api/parent/children` | Dashboard summaries incl. pending-update flag |
| GET | `/api/parent/children/:slug/profile` | Active approved profile, by category |
| GET | `/api/parent/children/:slug/report.pdf` | `normalize()` → `buildPdf()`, active session |
| GET | `/api/parent/compare` | Both / Gabriella-only / Christopher-only, overall + by category |

Reserved for later, same namespace: `/api/parent/children/:slug/sessions`,
`.../sessions/:id/approve`, `.../sessions/:id/decline`.

Access is configured on two paths only — `/parent*` and `/api/parent/*` — so the
boundary is readable in the dashboard with no exception rules. Anything unmatched
under `/api/` returns 404 from the Worker.

## C. Exact Phase 2 files

Phase 2 is **schema and binding only** — no route changes, no wizard changes, nothing
in the live child flow moves. It is safe to deploy on its own.

**Created**
- `schema.sql` — the 7 tables with the status/version additions above
- `seed.sql` — `families` (Bazemore), `children` (both, with slugs/grades/accents), `food_categories` (11 incl. Dips & Extras, in wizard order), `food_items` (every food from `Component.CATS` + `Component.EXTRAS`), generated directly from the wizard's own lists so they cannot drift

**Modified**
- `wrangler.jsonc` — add the `d1_databases` block, binding `DB`, database name `fuel-for-greatness`, `database_id: "PASTE_DATABASE_ID_HERE"` (I will not invent an ID)
- `.assetsignore` — add `*.sql` so schema files never serve publicly
- `README.md` — D1 creation + schema-apply steps
- `deploy/ARCHITECTURE.md` — this addendum

**Not touched in Phase 2**
- `worker.js`, `School Lunch Favorites.dc.html`, `deploy/index.html` — untouched. Email code stays live and working until Phase 3 replaces it, exactly as you asked ("remove after the D1 replacement is functioning").

Phase 3 is where `worker.js` and the wizard change; I'll flag that build separately.
