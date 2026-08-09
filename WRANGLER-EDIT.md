# One manual edit to your local wrangler.jsonc

`wrangler.jsonc` is **not** in this zip on purpose — the copy in the design project
carries a placeholder `database_id`, and overwriting yours would break every
`/api/*` call. Make this one change by hand in
`C:\Fuel-for-Greatness\wrangler.jsonc`.

## Why

The parent-path hardening in `worker.js` (normalize the pathname, 308-redirect
every alternate spelling to the canonical `/parent`) only runs if the request
reaches the Worker at all. The old setting listed specific paths:

```jsonc
"run_worker_first": ["/api/*", "/parent", "/parent/*", "/parent.html"]
```

`//parent.html` — the exact bypass flagged Critical in the audit — matches none of
those patterns, so Cloudflare would serve the static portal shell directly and the
new protection would never execute.

## The change

Inside the `"assets"` block, replace that line with:

```jsonc
"run_worker_first": true
```

Every request then enters `worker.js` first. Parent spellings are normalized and
redirected; everything else falls through to `env.ASSETS.fetch(request)` and is
served exactly as before. Leave `"directory"`, `"binding"`, the `d1_databases`
block and your real `database_id` untouched.

## After the edit

Signed out, in a private window, each of these must land on the Cloudflare Access
prompt — none may render the portal:

- `/parent`
- `/parent.html`
- `//parent.html`
- `/Parent.HTML`

And `/` must still open the child wizard publicly.
