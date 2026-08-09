/**
 * Fuel for Greatness — Cloudflare Worker (Worker + Static Assets + D1)
 *
 * PUBLIC (no auth — a child's phone has no login)
 *   GET  /*                        static site via the ASSETS binding
 *   POST /api/child/:slug/profile  save a completed food profile to D1
 *   GET  /api/child/:slug/status   {saved, lastCompletedAt, pending} — no food data
 *
 * PARENT (Phase 4+, behind Cloudflare Access on /parent* and /api/parent/*)
 *   GET  /api/parent/children, .../:slug/profile, .../:slug/report.pdf, /api/parent/compare
 *   GET  /api/parent/children/:slug/pending          diff of the waiting retake
 *   POST /api/parent/children/:slug/pending/approve  promote it to the active profile
 *   POST /api/parent/children/:slug/pending/decline   keep the approved profile
 *   POST /api/parent/children/:slug/reset             erase this child's food profile
 *
 * Binding: DB (Cloudflare D1). Schema in schema.sql, reference data in seed.sql.
 * The browser never talks to D1 — only to these endpoints.
 */

const ALLOWED_CHILDREN = ['gabriella', 'christopher'];
const MAX_BODY = 64 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    // The portal shell is public; it renders a sign-in gate and every byte of
    // family data behind it comes from the guarded /api/parent/* endpoints.
    if (p === '/parent' || p === '/parent/' || p.startsWith('/parent/') || p === '/parent.html') {
      return env.ASSETS.fetch(new Request(new URL('/parent.html', url.origin), request));
    }

    if (p.startsWith('/api/')) {
      let m;
      if (p.startsWith('/api/parent/')) {
        // Auth endpoints are the only unguarded part of the parent namespace.
        if (p === '/api/parent/login')  return request.method === 'POST' ? parentLogin(request, env) : json({ success: false, message: 'Method not allowed' }, 405);
        if (p === '/api/parent/logout') return parentLogout();
        if (p === '/api/parent/session') return parentSession(request, env);

        const guard = await requireParent(request, env);
        if (guard) return guard;
        if (request.method === 'GET') {
          if (p === '/api/parent/children') return parentChildren(env);
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/profile$/))) return parentProfile(env, m[1]);
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/pending$/))) return parentPending(env, m[1]);
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/report\.pdf$/))) return parentReport(env, m[1]);
          if (p === '/api/parent/compare') return parentCompare(env);
          return json({ success: false, message: 'Not found' }, 404);
        }
        if (request.method === 'POST') {
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/pending\/approve$/))) return parentApprove(env, m[1]);
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/pending\/decline$/))) return parentDecline(env, m[1]);
          if ((m = p.match(/^\/api\/parent\/children\/([a-z0-9-]+)\/reset$/))) return parentReset(request, env, m[1]);
          return json({ success: false, message: 'Not found' }, 404);
        }
        return json({ success: false, message: 'Method not allowed' }, 405);
      }
      if ((m = p.match(/^\/api\/child\/([a-z0-9-]+)\/profile$/))) {
        if (request.method !== 'POST') return json({ success: false, message: 'Method not allowed' }, 405);
        return saveChildProfile(request, env, m[1]);
      }
      if ((m = p.match(/^\/api\/child\/([a-z0-9-]+)\/status$/))) {
        if (request.method !== 'GET') return json({ success: false, message: 'Method not allowed' }, 405);
        return childStatus(env, m[1]);
      }
      return json({ success: false, message: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

/* ------------------------------------------------------------ parent access

   Two accepted identities, checked in order:

   1. Cloudflare Access — if a cf-access-* identity header is present the request
      was already authenticated at the edge. Costs nothing to honour, so moving to
      Access later (once a custom domain exists) needs no code change.
   2. Passphrase session — PARENT_PASSCODE (a Cloudflare Secret) is exchanged once
      for an HMAC-SHA256 signed, HttpOnly, Secure, SameSite=Strict cookie signed
      with PARENT_SIGNING_KEY. The passcode never reaches browser JavaScript, and
      neither value is ever in the repo.

   Fails CLOSED: with no secrets configured, parent data is refused outright.   */

const COOKIE = 'ffg_parent';
const SESSION_DAYS = 30;

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

// Length-independent comparison — no early exit on the first differing byte.
function safeEqual(a, b) {
  const A = enc.encode(String(a)), B = enc.encode(String(b));
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] || 0) ^ (B[i] || 0);
  return diff === 0;
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function signingKey(env) {
  // Falls back to the passcode so a single secret is enough to run securely.
  return env.PARENT_SIGNING_KEY || env.PARENT_PASSCODE || '';
}

async function makeToken(env) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = b64url(enc.encode(JSON.stringify({ exp })));
  return payload + '.' + (await hmac(signingKey(env), payload));
}

async function validToken(env, token) {
  if (!token || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  const expect = await hmac(signingKey(env), payload);
  if (!safeEqual(sig, expect)) return false;
  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && Date.now() < exp;
  } catch { return false; }
}

function parentConfigured(env) { return !!(env.PARENT_PASSCODE && String(env.PARENT_PASSCODE).length >= 6); }

async function isParent(request, env) {
  if (request.headers.get('cf-access-authenticated-user-email') || request.headers.get('cf-access-jwt-assertion')) return true;
  if (!parentConfigured(env)) return false;
  return validToken(env, readCookie(request, COOKIE));
}

async function requireParent(request, env) {
  if (!parentConfigured(env)) {
    return json({ success: false, code: 'not_configured', message: 'Parent access is not configured yet. Set the PARENT_PASSCODE secret in Cloudflare.' }, 503);
  }
  if (await isParent(request, env)) return null;
  return json({ success: false, code: 'auth_required', message: 'Parent sign-in required.' }, 401);
}

async function parentLogin(request, env) {
  if (!parentConfigured(env)) return json({ success: false, code: 'not_configured', message: 'Parent access is not configured yet. Set the PARENT_PASSCODE secret in Cloudflare.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid request.' }, 400); }
  const given = String((body && body.passcode) || '');
  if (!given) return json({ success: false, message: 'Enter the family passcode.' }, 400);

  // Constant delay on every attempt: no timing signal, and brute force is slow.
  await new Promise((r) => setTimeout(r, 400));
  if (!safeEqual(given, String(env.PARENT_PASSCODE))) {
    return json({ success: false, message: 'That passcode is not right.' }, 401);
  }
  const token = await makeToken(env);
  return new Response(JSON.stringify({ success: true, message: 'Signed in.' }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + SESSION_DAYS * 86400,
    },
  });
}

function parentLogout() {
  return new Response(JSON.stringify({ success: true, message: 'Signed out.' }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}

async function parentSession(request, env) {
  return json({ success: true, configured: parentConfigured(env), authed: await isParent(request, env) });
}

/* --------------------------------------------------------- parent: reads */

async function parentChildren(env) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const kids = (await env.DB.prepare(
    'SELECT id, slug, full_name, first_name, grade, accent, active_session_id, updated_at FROM children ORDER BY id'
  ).all()).results || [];

  const out = [];
  for (const k of kids) {
    const approved = await env.DB.prepare(
      "SELECT id, version, completed_at, total_selected FROM profile_sessions WHERE child_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1"
    ).bind(k.id).first();
    const pending = await env.DB.prepare(
      "SELECT id, version, completed_at, total_selected FROM profile_sessions WHERE child_id = ? AND status = 'pending' ORDER BY version DESC LIMIT 1"
    ).bind(k.id).first();
    const counts = await env.DB.prepare(
      'SELECT (SELECT COUNT(*) FROM child_food_preferences WHERE child_id = ?1) AS liked, (SELECT COUNT(*) FROM child_category_responses WHERE child_id = ?1) AS answered, (SELECT COUNT(*) FROM child_category_responses WHERE child_id = ?1 AND none_selected = 1) AS none'
    ).bind(k.id).first();

    out.push({
      slug: k.slug, fullName: k.full_name, firstName: k.first_name, grade: k.grade, accent: k.accent,
      status: approved ? 'complete' : 'none',
      version: approved ? approved.version : null,
      lastUpdated: approved ? approved.completed_at : null,
      totalFavorites: Number((counts && counts.liked) || 0),
      categoriesAnswered: Number((counts && counts.answered) || 0),
      categoriesNone: Number((counts && counts.none) || 0),
      pending: pending ? { version: pending.version, completedAt: pending.completed_at, totalSelected: pending.total_selected } : null,
    });
  }
  return json({ success: true, family: 'Bazemore Family', children: out });
}

async function loadApproved(env, slug) {
  const child = await env.DB.prepare('SELECT id, slug, full_name, first_name, grade, accent FROM children WHERE slug = ?').bind(slug).first();
  if (!child) return null;
  const cats = (await env.DB.prepare('SELECT id, slug, display_name, emoji, sort_order FROM food_categories ORDER BY sort_order').all()).results || [];
  const prefs = (await env.DB.prepare(
    'SELECT f.name, f.emoji, f.category_id FROM child_food_preferences p JOIN food_items f ON f.id = p.food_item_id WHERE p.child_id = ? ORDER BY f.name'
  ).bind(child.id).all()).results || [];
  const responses = (await env.DB.prepare('SELECT category_id, answered, none_selected, updated_at FROM child_category_responses WHERE child_id = ?').bind(child.id).all()).results || [];
  const session = await env.DB.prepare(
    "SELECT version, completed_at, total_selected FROM profile_sessions WHERE child_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1"
  ).bind(child.id).first();
  const pending = await env.DB.prepare(
    "SELECT version, completed_at, total_selected FROM profile_sessions WHERE child_id = ? AND status = 'pending' ORDER BY version DESC LIMIT 1"
  ).bind(child.id).first();

  const respBy = new Map(responses.map((r) => [r.category_id, r]));
  const categories = cats.map((c) => {
    const items = prefs.filter((p) => p.category_id === c.id).map((p) => ({ name: p.name, emoji: p.emoji }));
    const r = respBy.get(c.id);
    return {
      slug: c.slug, name: c.display_name, emoji: c.emoji,
      items, count: items.length,
      answered: !!(r && r.answered), noneSelected: !!(r && r.none_selected),
    };
  });
  return { child, session, pending, categories };
}

async function parentProfile(env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const data = await loadApproved(env, slug);
  if (!data) return json({ success: false, message: 'Unknown child.' }, 404);
  return json({
    success: true,
    child: { slug: data.child.slug, fullName: data.child.full_name, firstName: data.child.first_name, grade: data.child.grade, accent: data.child.accent },
    approved: data.session ? { version: data.session.version, completedAt: data.session.completed_at, totalSelected: data.session.total_selected } : null,
    pending: data.pending ? { version: data.pending.version, completedAt: data.pending.completed_at, totalSelected: data.pending.total_selected } : null,
    totalFavorites: data.categories.reduce((a, c) => a + c.count, 0),
    categories: data.categories,
  });
}

async function parentCompare(env) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const a = await loadApproved(env, 'gabriella');
  const b = await loadApproved(env, 'christopher');
  if (!a || !b) return json({ success: false, message: 'Both children need a profile first.' }, 404);

  const byCat = a.categories.map((ca, i) => {
    const cb = b.categories[i] || { items: [] };
    const A = new Set(ca.items.map((x) => x.name));
    const B = new Set(cb.items.map((x) => x.name));
    return {
      name: ca.name, emoji: ca.emoji, slug: ca.slug,
      both: [...A].filter((n) => B.has(n)).sort(),
      onlyA: [...A].filter((n) => !B.has(n)).sort(),
      onlyB: [...B].filter((n) => !A.has(n)).sort(),
    };
  });
  const flat = (key) => byCat.reduce((acc, c) => acc.concat(c[key]), []);
  return json({
    success: true,
    a: { slug: 'gabriella', firstName: a.child.first_name, accent: a.child.accent },
    b: { slug: 'christopher', firstName: b.child.first_name, accent: b.child.accent },
    overall: { both: flat('both'), onlyA: flat('onlyA'), onlyB: flat('onlyB') },
    categories: byCat,
  });
}

async function parentReport(env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await env.DB.prepare('SELECT id, slug FROM children WHERE slug = ?').bind(slug).first();
  if (!child) return json({ success: false, message: 'Unknown child.' }, 404);
  const session = await env.DB.prepare(
    "SELECT snapshot_json FROM profile_sessions WHERE child_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1"
  ).bind(child.id).first();
  if (!session) return json({ success: false, message: 'No approved profile yet.' }, 404);

  let payload;
  try { payload = JSON.parse(session.snapshot_json); } catch { return json({ success: false, message: 'Stored profile could not be read.' }, 500); }
  const report = normalize(payload, false);
  // buildPdf() returns a LATIN-1 STRING whose xref offsets are code-unit counts.
  // Response() would encode it as UTF-8 and shift every offset past the first
  // non-ASCII character, producing a "damaged file". Convert 1 code unit -> 1 byte.
  const pdf = buildPdf(report);
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="' + pdfFilename(report) + '"',
      'cache-control': 'no-store',
    },
  });
}

/* -------------------------------------------- shared: catalog + validation

   One validator serves both the child's save and the parent's approval, so a
   snapshot can never be projected into the active profile under looser rules
   than the ones it was accepted with.                                        */

async function loadCatalog(env) {
  const cats = (await env.DB.prepare('SELECT id, slug, display_name, emoji, sort_order FROM food_categories ORDER BY sort_order').all()).results || [];
  const items = (await env.DB.prepare('SELECT id, name, emoji, category_id FROM food_items WHERE active = 1').all()).results || [];
  return { cats, items };
}

// -> { rows:[{categoryId, foodIds, foodNames, answered, noneSelected}], problems, missing }
function rowsFromSnapshot(data, cats, items) {
  const catByName = new Map(cats.map((c) => [c.display_name, c]));
  const key = (categoryId, name) => categoryId + '|' + name;
  const byKey = new Map(items.map((i) => [key(i.category_id, i.name), i]));
  const answeredMap = data && data.answered && typeof data.answered === 'object' ? data.answered : {};
  const selections = (data && data.selections) || {};
  const rows = [], problems = [];

  for (const [name, value] of Object.entries(selections)) {
    const cat = catByName.get(name);
    if (!cat) { problems.push('Unknown category: ' + name); continue; }
    const picks = Array.isArray(value) ? value : [];
    const foodIds = [], foodNames = [];
    for (const foodName of picks) {
      const item = byKey.get(key(cat.id, String(foodName)));
      if (!item) { problems.push('Unknown food in ' + name + ': ' + foodName); continue; }
      foodIds.push(item.id); foodNames.push(item.name);
    }
    const answered = answeredMap[name] === true || foodIds.length > 0;
    rows.push({ categoryId: cat.id, categoryName: cat.display_name, foodIds, foodNames, answered, noneSelected: answered && foodIds.length === 0 });
  }
  const answeredIds = new Set(rows.filter((r) => r.answered).map((r) => r.categoryId));
  const missing = cats.filter((c) => !answeredIds.has(c.id)).map((c) => c.display_name);
  return { rows, problems, missing };
}

// Statements that replace the ACTIVE profile tables with `rows`. Used on the
// child's first save and on a parent approval — nowhere else.
function projectStatements(env, childId, rows) {
  const out = [
    env.DB.prepare('DELETE FROM child_food_preferences WHERE child_id = ?').bind(childId),
    env.DB.prepare('DELETE FROM child_category_responses WHERE child_id = ?').bind(childId),
  ];
  for (const r of rows) {
    out.push(env.DB.prepare('INSERT INTO child_category_responses (child_id, category_id, answered, none_selected) VALUES (?, ?, 1, ?)').bind(childId, r.categoryId, r.noneSelected ? 1 : 0));
    for (const fid of r.foodIds) {
      out.push(env.DB.prepare('INSERT OR REPLACE INTO child_food_preferences (child_id, food_item_id, liked) VALUES (?, ?, 1)').bind(childId, fid));
    }
  }
  return out;
}

/* ------------------------------------------- parent: review a pending retake */

async function childRow(env, slug) {
  return env.DB.prepare('SELECT id, slug, full_name, first_name, grade, accent FROM children WHERE slug = ?').bind(slug).first();
}
function latestPending(env, childId) {
  return env.DB.prepare(
    "SELECT id, version, completed_at, total_selected, snapshot_json FROM profile_sessions WHERE child_id = ? AND status = 'pending' ORDER BY version DESC LIMIT 1"
  ).bind(childId).first();
}

// GET: what would change if this update were approved. Read-only.
async function parentPending(env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await childRow(env, slug);
  if (!child) return json({ success: false, message: 'Unknown child.' }, 404);
  const pending = await latestPending(env, child.id);
  if (!pending) return json({ success: false, code: 'no_pending', message: 'No update is waiting for review.' }, 404);

  let snap;
  try { snap = JSON.parse(pending.snapshot_json); } catch { return json({ success: false, message: 'The submitted update could not be read.' }, 500); }
  const { cats, items } = await loadCatalog(env);
  const { rows, problems } = rowsFromSnapshot(snap, cats, items);
  const rowByCat = new Map(rows.map((r) => [r.categoryId, r]));

  const approvedPrefs = (await env.DB.prepare(
    'SELECT f.name, f.category_id FROM child_food_preferences p JOIN food_items f ON f.id = p.food_item_id WHERE p.child_id = ?'
  ).bind(child.id).all()).results || [];
  const approvedResp = (await env.DB.prepare('SELECT category_id, none_selected FROM child_category_responses WHERE child_id = ?').bind(child.id).all()).results || [];
  const noneBy = new Map(approvedResp.map((r) => [r.category_id, !!r.none_selected]));
  const approvedSession = await env.DB.prepare(
    "SELECT version, completed_at, total_selected FROM profile_sessions WHERE child_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1"
  ).bind(child.id).first();

  let added = 0, removed = 0;
  const categories = cats.map((c) => {
    const now = new Set(approvedPrefs.filter((p) => p.category_id === c.id).map((p) => p.name));
    const next = new Set((rowByCat.get(c.id) || { foodNames: [] }).foodNames);
    const a = [...next].filter((n) => !now.has(n)).sort();
    const r = [...now].filter((n) => !next.has(n)).sort();
    added += a.length; removed += r.length;
    return {
      slug: c.slug, name: c.display_name, emoji: c.emoji,
      added: a, removed: r, kept: [...next].filter((n) => now.has(n)).sort(),
      approvedCount: now.size, pendingCount: next.size,
      approvedNone: !!noneBy.get(c.id), pendingNone: !!(rowByCat.get(c.id) || {}).noneSelected,
    };
  });

  return json({
    success: true,
    child: { slug: child.slug, fullName: child.full_name, firstName: child.first_name, grade: child.grade, accent: child.accent },
    approved: approvedSession ? { version: approvedSession.version, completedAt: approvedSession.completed_at, totalSelected: approvedSession.total_selected } : null,
    pending: { version: pending.version, completedAt: pending.completed_at, totalSelected: pending.total_selected },
    changes: { added, removed, unchanged: added === 0 && removed === 0 },
    problems: problems.slice(0, 10),
    categories,
  });
}

// POST: promote the pending snapshot into the active profile tables.
async function parentApprove(env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await childRow(env, slug);
  if (!child) return json({ success: false, message: 'Unknown child.' }, 404);
  const pending = await latestPending(env, child.id);
  if (!pending) return json({ success: false, code: 'no_pending', message: 'No update is waiting for review.' }, 404);

  let snap;
  try { snap = JSON.parse(pending.snapshot_json); } catch { return json({ success: false, message: 'The submitted update could not be read.' }, 500); }
  const { cats, items } = await loadCatalog(env);
  if (!cats.length || !items.length) return json({ success: false, message: 'Reference data missing — apply seed.sql.' }, 503);
  const { rows, missing } = rowsFromSnapshot(snap, cats, items);
  if (missing.length) return json({ success: false, message: 'That update is missing answers and cannot be approved.', missing }, 400);

  const batch = [
    env.DB.prepare("UPDATE profile_sessions SET status = 'superseded', reviewed_at = datetime('now') WHERE child_id = ? AND status = 'approved'").bind(child.id),
    env.DB.prepare("UPDATE profile_sessions SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?").bind(pending.id),
    ...projectStatements(env, child.id, rows),
    env.DB.prepare("UPDATE children SET active_session_id = ?, updated_at = datetime('now') WHERE id = ?").bind(pending.id, child.id),
  ];
  try { await env.DB.batch(batch); }
  catch (err) { return json({ success: false, message: 'Could not approve the update.', detail: String(err).slice(0, 300) }, 500); }

  return json({ success: true, status: 'approved', version: pending.version, totalSelected: rows.reduce((a, r) => a + r.foodIds.length, 0), message: 'Update approved — it is now the active profile.' });
}

// POST: reject it. The approved profile and its tables are not touched at all.
async function parentDecline(env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await childRow(env, slug);
  if (!child) return json({ success: false, message: 'Unknown child.' }, 404);
  const pending = await latestPending(env, child.id);
  if (!pending) return json({ success: false, code: 'no_pending', message: 'No update is waiting for review.' }, 404);
  try {
    await env.DB.prepare("UPDATE profile_sessions SET status = 'declined', reviewed_at = datetime('now') WHERE id = ?").bind(pending.id).run();
  } catch (err) {
    return json({ success: false, message: 'Could not decline the update.', detail: String(err).slice(0, 300) }, 500);
  }
  return json({ success: true, status: 'declined', version: pending.version, message: 'Update declined. The current approved profile stays active.' });
}

/* --------------------------------------------------- parent: reset a profile

   Destructive and parent-only. Clears this child's food answers and their whole
   submission history, then returns the child to "No food profile yet". The child
   record (name, grade, theme, family link), the food catalog, and every app
   setting are untouched — nothing outside these three statements is written.  */

async function parentReset(request, env, slug) {
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await childRow(env, slug);
  if (!child) return json({ success: false, message: 'Unknown child.' }, 404);

  // The portal asks the parent to confirm; the API insists on hearing it too.
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  if (!body || body.confirm !== true) {
    return json({ success: false, code: 'confirm_required', message: 'Reset requires an explicit confirmation.' }, 400);
  }

  const before = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM child_food_preferences WHERE child_id = ?1) AS prefs, (SELECT COUNT(*) FROM child_category_responses WHERE child_id = ?1) AS responses, (SELECT COUNT(*) FROM profile_sessions WHERE child_id = ?1) AS sessions'
  ).bind(child.id).first();

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM child_food_preferences WHERE child_id = ?').bind(child.id),
      env.DB.prepare('DELETE FROM child_category_responses WHERE child_id = ?').bind(child.id),
      env.DB.prepare('DELETE FROM profile_sessions WHERE child_id = ?').bind(child.id),
      env.DB.prepare("UPDATE children SET active_session_id = NULL, updated_at = datetime('now') WHERE id = ?").bind(child.id),
    ]);
  } catch (err) {
    return json({ success: false, message: 'Could not reset the profile.', detail: String(err).slice(0, 300) }, 500);
  }

  return json({
    success: true,
    reset: true,
    child: { slug: child.slug, firstName: child.first_name },
    deleted: {
      foodPreferences: Number((before && before.prefs) || 0),
      categoryResponses: Number((before && before.responses) || 0),
      sessions: Number((before && before.sessions) || 0),
    },
    message: child.first_name + "'s food profile was reset. They can take the wizard again from scratch.",
  });
}

/* ------------------------------------------------- public: save a profile */

async function saveChildProfile(request, env, slug) {
  if (!ALLOWED_CHILDREN.includes(slug)) return json({ success: false, message: 'Unknown child.' }, 404);
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);

  // Size guard before any parsing or database work.
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
    return json({ success: false, message: 'Submission too large.' }, 413);
  }
  let data;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ success: false, message: 'Submission too large.' }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ success: false, message: 'Invalid JSON body.' }, 400);
  }
  if (!data || typeof data !== 'object' || !data.selections || typeof data.selections !== 'object') {
    return json({ success: false, message: 'Submission data is incomplete.' }, 400);
  }

  // Test Mode is accepted so the child sees a normal success screen, and discarded.
  if (data.testMode === true) {
    return json({ success: true, saved: false, testMode: true, status: 'discarded', message: 'Test Mode submission — nothing was written to the family database.' });
  }

  const child = await env.DB.prepare('SELECT id, full_name, grade FROM children WHERE slug = ?').bind(slug).first();
  if (!child) return json({ success: false, message: 'That child is not set up in the database yet.' }, 404);

  // ---- validate every category and every food name against D1 ----
  const { cats, items } = await loadCatalog(env);
  if (!cats.length || !items.length) return json({ success: false, message: 'Reference data missing — apply seed.sql.' }, 503);

  const { rows, problems, missing } = rowsFromSnapshot(data, cats, items);
  if (problems.length) return json({ success: false, message: 'Submission rejected.', problems: problems.slice(0, 10) }, 400);
  // Every category must carry an intentional answer — same rule the wizard enforces.
  if (missing.length) return json({ success: false, message: 'Some categories were not answered.', missing }, 400);

  // ---- versioning: first ever profile auto-approves, later retakes go pending ----
  const prior = await env.DB.prepare(
    "SELECT MAX(version) AS maxV, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedCount FROM profile_sessions WHERE child_id = ?"
  ).bind(child.id).first();
  const version = Number(prior && prior.maxV ? prior.maxV : 0) + 1;
  const hasApproved = Number(prior && prior.approvedCount ? prior.approvedCount : 0) > 0;
  const status = hasApproved ? 'pending' : 'approved';

  const completedAt = safeDate(data.submittedAt);
  const totalSelected = rows.reduce((a, r) => a + r.foodIds.length, 0);

  const batch = [];
  // Only the newest pending submission stays reviewable.
  if (status === 'pending') {
    batch.push(env.DB.prepare("UPDATE profile_sessions SET status = 'superseded', reviewed_at = datetime('now') WHERE child_id = ? AND status = 'pending'").bind(child.id));
  }
  batch.push(
    env.DB.prepare('INSERT INTO profile_sessions (child_id, version, status, completed_at, reviewed_at, total_selected, snapshot_json, app_build) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(child.id, version, status, completedAt, status === 'approved' ? completedAt : null, totalSelected, JSON.stringify(data), String(data.appBuild || ''))
  );

  // The preference tables ARE the approved profile — written only on approval.
  if (status === 'approved') batch.push(...projectStatements(env, child.id, rows));

  try {
    await env.DB.batch(batch);
    if (status === 'approved') {
      const row = await env.DB.prepare('SELECT id FROM profile_sessions WHERE child_id = ? AND version = ?').bind(child.id, version).first();
      await env.DB.prepare("UPDATE children SET active_session_id = ?, updated_at = datetime('now') WHERE id = ?").bind(row ? row.id : null, child.id).run();
    }
  } catch (err) {
    return json({ success: false, message: 'Could not save the profile.', detail: String(err).slice(0, 300) }, 500);
  }

  return json({
    success: true,
    saved: true,
    status,
    version,
    totalSelected,
    pendingReview: status === 'pending',
    message: status === 'approved'
      ? 'Profile saved and active.'
      : 'Profile saved. It is waiting for a parent to review the changes; the current profile stays active until then.',
  });
}

/* ------------------------------------------------- public: tiny status ping */

async function childStatus(env, slug) {
  if (!ALLOWED_CHILDREN.includes(slug)) return json({ success: false, message: 'Unknown child.' }, 404);
  if (!env.DB) return json({ success: false, message: 'The family database is not connected yet.' }, 503);
  const child = await env.DB.prepare('SELECT id FROM children WHERE slug = ?').bind(slug).first();
  if (!child) return json({ success: true, saved: false, pending: false, lastCompletedAt: null });
  const row = await env.DB.prepare(
    "SELECT MAX(CASE WHEN status = 'approved' THEN completed_at END) AS approvedAt, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingCount FROM profile_sessions WHERE child_id = ?"
  ).bind(child.id).first();
  return json({
    success: true,
    saved: !!(row && row.approvedAt),
    lastCompletedAt: (row && row.approvedAt) || null,
    pending: Number((row && row.pendingCount) || 0) > 0,
  });
}

function safeDate(v) {
  const d = v ? new Date(v) : new Date();
  return (isNaN(d.getTime()) ? new Date() : d).toISOString();
}

/* ------------------------------------------------------------- report model
   normalize() + buildPdf() below are the parent report generator, preserved
   untouched from the email build. They are wired to a route in Phase 5:
   GET /api/parent/children/:slug/report.pdf (behind Cloudflare Access).       */

const CATEGORY_META = {
  'Proteins': { icon: '💪', color: '#E8720C', rgb: [0.91, 0.45, 0.05] },
  'Energy Foods': { icon: '⚡', color: '#C08A00', rgb: [0.75, 0.54, 0.0] },
  'Fruit': { icon: '🍓', color: '#D6336C', rgb: [0.84, 0.2, 0.42] },
  'Vegetables': { icon: '🥦', color: '#2F9E44', rgb: [0.18, 0.62, 0.27] },
  'Dairy': { icon: '🥛', color: '#1C7ED6', rgb: [0.11, 0.49, 0.84] },
  'Cold Lunches': { icon: '🧊', color: '#0C9AA8', rgb: [0.05, 0.6, 0.66] },
  'Thermos Meals': { icon: '🔥', color: '#E8590C', rgb: [0.91, 0.35, 0.05] },
  'Snacks': { icon: '🍎', color: '#6BA524', rgb: [0.42, 0.65, 0.14] },
  'Drinks': { icon: '💧', color: '#1971C2', rgb: [0.1, 0.44, 0.76] },
  'Dips & Extras': { icon: '🥄', color: '#8A6D3B', rgb: [0.54, 0.43, 0.23] },
};

const CHILD_THEME = {
  Gabriella: { color: '#9F3CAB', rgb: [0.62, 0.24, 0.67] },
  Christopher: { color: '#4569CA', rgb: [0.27, 0.41, 0.79] },
};

function normalize(data, isTest) {
  const first = data.firstName || String(data.child).split(' ')[1] || String(data.child);
  const theme = CHILD_THEME[first] || { color: '#E8720C', rgb: [0.91, 0.45, 0.05] };
  const when = data.submittedAt ? new Date(data.submittedAt) : new Date();
  const categories = Object.keys(data.selections).map((name) => {
    const items = Array.isArray(data.selections[name]) ? data.selections[name] : [];
    const answered = data.answered ? data.answered[name] !== false : true;
    return { name, items, answered, meta: CATEGORY_META[name] || { icon: '•', color: '#6B7480', rgb: [0.42, 0.45, 0.5] } };
  });
  return {
    isTest,
    first,
    fullName: data.child,
    grade: data.grade || '',
    date: when,
    dateLabel: when.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    timeLabel: when.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }),
    total: categories.reduce((a, c) => a + c.items.length, 0),
    theme,
    categories,
  };
}


function pdfFilename(r) {
  const day = r.date.toISOString().slice(0, 10);
  const slug = (r.isTest ? `${r.first}-Preview` : r.fullName.replace(/^(Ms\.|Mr\.)\s*/, '')).replace(/[^A-Za-z0-9]+/g, '-');
  return `${r.isTest ? 'TEST_' : ''}Fuel-for-Greatness_${slug}_Lunch-Profile_${day}.pdf`;
}

/* ------------------------------------------------------------ PDF generation
   Written directly in PDF syntax with the base-14 Helvetica fonts: no external
   service, no npm dependency, no headless browser — everything a Worker can do
   natively. Layout is a dedicated parent report, not a page screenshot.        */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

function buildPdf(r) {
  const pages = [];
  let ops = [];
  let y = PAGE_H - MARGIN;

  const push = (s) => ops.push(s);
  const endPage = () => { pages.push(ops); ops = []; y = PAGE_H - MARGIN; };
  const room = (need) => { if (y - need < MARGIN + 40) endPage(); };

  const text = (str, x, yy, size, bold, rgb) => {
    const [rr, gg, bb] = rgb || [0.1, 0.08, 0.06];
    push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rr} ${gg} ${bb} rg ${x} ${yy} Td (${pdfEscape(str)}) Tj ET`);
  };
  const rect = (x, yy, w, h, rgb) => push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x} ${yy} ${w} ${h} re f`);
  const para = (str, size, rgb, lead) => {
    for (const line of wrap(str, size, CONTENT_W, false)) {
      room(lead);
      text(line, MARGIN, y - size, size, false, rgb);
      y -= lead;
    }
  };

  /* ---- cover ---- */
  rect(0, PAGE_H - 8, PAGE_W, 8, r.theme.rgb);
  y -= 6;
  text('FUEL FOR GREATNESS', MARGIN, y - 26, 26, true, r.theme.rgb);
  y -= 42;
  text('School Lunch Food Profile', MARGIN, y - 15, 15, false, [0.42, 0.45, 0.5]);
  y -= 34;

  if (r.isTest) {
    rect(MARGIN, y - 46, CONTENT_W, 46, [1, 0.96, 0.84]);
    text('TEST MODE', MARGIN + 14, y - 20, 13, true, [0.35, 0.27, 0.03]);
    text('NOT A FINAL CHILD PROFILE', MARGIN + 14, y - 36, 11, false, [0.35, 0.27, 0.03]);
    y -= 62;
  }

  text(r.fullName, MARGIN, y - 20, 20, true, [0.1, 0.08, 0.06]);
  y -= 32;
  text(`Grade: ${r.grade}`, MARGIN, y - 12, 12, false, [0.25, 0.22, 0.2]);
  y -= 18;
  text(`Completed: ${r.timeLabel}`, MARGIN, y - 12, 12, false, [0.25, 0.22, 0.2]);
  y -= 18;
  text(`Total foods selected: ${r.total}`, MARGIN, y - 12, 12, false, [0.25, 0.22, 0.2]);
  y -= 34;

  rect(MARGIN, y - 30, CONTENT_W, 30, [0.98, 0.96, 0.93]);
  text('FOOD  >  FUEL  >  FOCUS  >  PERFORMANCE', MARGIN + 14, y - 20, 12, true, r.theme.rgb);
  y -= 46;

  para(
    `This profile represents the parent-approved foods that ${r.first} identified as foods they actually like and would be willing to eat for school lunch. These selections will be used to build individualized lunches and future meal-planning systems.`,
    11,
    [0.28, 0.25, 0.22],
    16
  );
  y -= 14;

  text('CATEGORY SUMMARY', MARGIN, y - 12, 12, true, [0.1, 0.08, 0.06]);
  y -= 22;
  for (const c of r.categories) {
    room(20);
    rect(MARGIN, y - 12, 8, 8, c.meta.rgb);
    text(c.name, MARGIN + 18, y - 12, 11, false, [0.18, 0.16, 0.14]);
    const right = c.items.length ? `${c.items.length} selected` : c.answered ? 'None of these' : 'Not answered';
    text(right, PAGE_W - MARGIN - widthOf(right, 11, true), y - 12, 11, true, c.meta.rgb);
    y -= 19;
  }

  /* ---- detail pages ---- */
  endPage();

  for (const c of r.categories) {
    const bodyLines = c.items.length ? c.items.length : 1;
    room(46 + Math.min(bodyLines, 4) * 16);
    rect(MARGIN, y - 26, CONTENT_W, 26, tintOf(c.meta.rgb));
    text(c.name.toUpperCase(), MARGIN + 12, y - 18, 13, true, c.meta.rgb);
    const count = c.items.length
      ? `${c.items.length} ${c.items.length === 1 ? 'favorite' : 'favorites'}`
      : c.answered
        ? 'None of these for me'
        : 'Not answered';
    text(count, PAGE_W - MARGIN - 12 - widthOf(count, 10, false), y - 18, 10, false, [0.4, 0.38, 0.35]);
    y -= 38;

    if (c.items.length) {
      const colW = CONTENT_W / 2 - 10;
      const rows = Math.ceil(c.items.length / 2);
      for (let i = 0; i < rows; i++) {
        room(17);
        for (let col = 0; col < 2; col++) {
          const item = c.items[i + col * rows];
          if (!item) continue;
          const x = MARGIN + col * (colW + 20);
          text('\u2022', x, y - 11, 11, true, c.meta.rgb);
          text(clip(item, 11, colW - 14), x + 12, y - 11, 11, false, [0.18, 0.16, 0.14]);
        }
        y -= 17;
      }
    } else {
      room(18);
      text(
        c.answered ? 'No favorites selected - answered intentionally.' : 'This category was not answered.',
        MARGIN,
        y - 11,
        11,
        false,
        [0.45, 0.43, 0.4]
      );
      y -= 17;
    }
    y -= 16;
  }
  endPage();

  /* ---- footers ---- */
  const total = pages.length;
  pages.forEach((pOps, i) => {
    pOps.push(`0.87 0.85 0.82 rg ${MARGIN} ${MARGIN + 26} ${CONTENT_W} 0.7 re f`);
    pOps.push(
      `BT /F2 8 Tf 0.42 0.4 0.38 rg ${MARGIN} ${MARGIN + 12} Td (${pdfEscape('FUEL FOR GREATNESS')}) Tj ET`
    );
    pOps.push(
      `BT /F1 8 Tf 0.55 0.53 0.5 rg ${MARGIN + 116} ${MARGIN + 12} Td (${pdfEscape(
        'Parents provide the choices. Kids tell us what they like. Together, we build the plan.'
      )}) Tj ET`
    );
    const pn = `Page ${i + 1} of ${total}`;
    pOps.push(`BT /F1 8 Tf 0.55 0.53 0.5 rg ${PAGE_W - MARGIN - widthOf(pn, 8, false)} ${MARGIN + 12} Td (${pdfEscape(pn)}) Tj ET`);
  });

  return assemblePdf(pages, r);
}

function tintOf(rgb) {
  return rgb.map((v) => Math.min(1, v + (1 - v) * 0.88));
}
function widthOf(str, size, bold) {
  return String(str).length * size * (bold ? 0.55 : 0.5);
}
function clip(str, size, maxW) {
  let s = String(str);
  while (widthOf(s, size, false) > maxW && s.length > 4) s = s.slice(0, -2);
  return s === String(str) ? s : s + '...';
}
function wrap(str, size, maxW, bold) {
  const words = String(str).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (widthOf(test, size, bold) > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}
function pdfEscape(s) {
  return String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '>')
    .replace(/\u2022/g, '\x95')
    .replace(/[^\x20-\xFF]/g, '')
    .replace(/([\\()])/g, '\\$1');
}

function assemblePdf(pages, r) {
  const catalogId = 1;
  const pagesId = 2;
  const fontRegId = 3;
  const fontBoldId = 4;
  let nextId = 5;

  const pageIds = [];
  const bodies = [];
  for (const ops of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const stream = ops.join('\n');
    bodies.push({ id: contentId, body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream` });
    bodies.push({
      id: pageId,
      body: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    });
  }

  const all = [
    { id: catalogId, body: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` },
    { id: pagesId, body: `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>` },
    { id: fontRegId, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    { id: fontBoldId, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' },
    ...bodies,
  ].sort((a, b) => a.id - b.id);

  const info = `<< /Title (${pdfEscape(`Fuel for Greatness - ${r.fullName}`)}) /Producer (Fuel for Greatness Worker) >>`;
  const infoId = nextId++;
  all.push({ id: infoId, body: info });

  let out = '%PDF-1.4\n';
  const offsets = {};
  for (const o of all) {
    offsets[o.id] = out.length;
    out += `${o.id} 0 obj\n${o.body}\nendobj\n`;
  }
  const xrefPos = out.length;
  const maxId = all[all.length - 1].id;
  out += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxId; i++) {
    const off = offsets[i] || 0;
    out += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return out;
}

function base64(latin1) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < latin1.length; i += chunk) out += latin1.slice(i, i + chunk);
  return btoa(out);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
