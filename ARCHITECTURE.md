# Fuel for Greatness — Architecture

Current build: **2026.08.09-19**. This file describes what the application *is*. For setup
and API tables see `README.md`.

## Shape

A single Cloudflare Worker serves two static pages and one JSON API, backed by D1.
No framework, no runtime build step, no third-party services.

```
GitHub main ──► Cloudflare build ──► Worker ──► D1 (family database)
                                       │
                                       ├── /             index.html   (public)
                                       ├── /api/child/*  validation   (public)
                                       ├── /parent       parent.html  (Access)
                                       └── /api/parent/* portal API   (Access)
```

Both pages are compiled from `.dc.html` sources into self-contained files. The
compiled `index.html` / `parent.html` are build artifacts — edit the sources.

## Request routing

`worker.js` normalizes `url.pathname` before any routing decision: repeated slashes
collapsed, `%2F` decoded, `.`/`..` resolved, trailing slash dropped, lower-cased. Parent
paths that are not exactly `/parent` are 308-redirected to it, so Cloudflare Access's
`/parent*` rule cannot be sidestepped with an alternate spelling. The normalized path
is used for comparison only; response URLs are always constructed explicitly.

This depends on `"run_worker_first": true` in `wrangler.jsonc`. With a path list
instead, an alternate spelling that matches no pattern (`//parent.html`) is served
directly from static assets and none of the above runs.

## Authentication

Cloudflare Access is the only parent authentication mechanism, configured outside the
application on `/parent*` and `/api/parent/*` with a two-address Allow policy and
One-time PIN. The Worker trusts the Access identity header and nothing else, and fails
closed. There is no passcode, no signing key, no session cookie and no login form in
the app; those were considered and rejected, and no code implements them.

The child wizard and `/api/child/*` are deliberately public — they hold no
identifying data and are how the children reach the app on a shared device.

## Data model

`families` → `children` → `profile_sessions` (one row per submission, with the full
JSON snapshot) plus the projected current state in `child_food_preferences` and
`child_category_responses`. The projection tables **are** the approved profile: they
are written in exactly two places — a child's first save, and a parent's approval —
both through the same validator, so approval can never apply looser rules than the
original save. Every multi-statement write goes through `env.DB.batch()`, a single
transaction, so a half-written profile is not reachable.

## Trust boundaries

Client-supplied values that are **never** trusted: child identity (allow-listed slugs
only), category names and food names (validated against D1; unknown values are
rejected, not ignored), totals (recomputed server-side), and test mode (handled before
any D1 access). Every statement is parameterized. Request bodies are capped at 64 KB.

## History

Earlier passes shipped an email flow (Resend + a generated PDF attachment) and
considered a passcode-based parent login. Both were removed: the portal replaced
email, and Cloudflare Access replaced the passcode. If you find references to
`/api/submit`, `RESEND_API_KEY`, `FROM_EMAIL`, `TO_EMAILS`, `PARENT_PASSCODE`,
`PARENT_SIGNING_KEY` or `PARENT_GUARD` anywhere, they are stale text, not behaviour —
no code path reads any of them.
