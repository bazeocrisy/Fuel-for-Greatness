/**
 * Cloudflare Pages Function — POST /api/submit
 *
 * The wizard posts the child's completed selections here. This is the ONLY
 * place credentials live; nothing secret is ever shipped to the browser.
 *
 * Set these in Cloudflare Pages → Settings → Environment variables (Secrets):
 *   RESEND_API_KEY   your email-provider API key
 *   TO_EMAIL         bazeocrisy@yahoo.com
 *   FROM_EMAIL       a verified sender on your domain, e.g. lunch@yourdomain.com
 *
 * Provider is swappable: replace sendEmail() below (Resend, SendGrid, Postmark,
 * Mailgun, MailChannels…) without touching the wizard front end.
 */

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  if (!data || !data.child || !data.selections) {
    return json({ ok: false, error: 'missing fields' }, 400);
  }

  try {
    await sendEmail(env, {
      to: env.TO_EMAIL,
      from: env.FROM_EMAIL,
      subject: data.testMode
        ? `[TEST] Fuel for Greatness — ${data.firstName} Preview`
        : `School Lunch Favorites — ${data.child} (${data.grade})`,
      html: renderHtml(data),
      text: renderText(data),
    });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
}

/* ---------- provider adapter (swap this one function) ---------- */
async function sendEmail(env, msg) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) throw new Error(`email provider ${res.status}: ${await res.text()}`);
}

/* ---------- formatting ---------- */
function renderText(d) {
  const lines = [];
  if (d.testMode) lines.push("TEST SUBMISSION — NOT CHILD'S FINAL FOOD PROFILE", '');
  lines.push(
    d.child,
    `Grade: ${d.grade}`,
    `Submitted: ${new Date(d.submittedAt).toLocaleString()}`,
    `Total foods selected: ${d.totalSelected}`,
    ''
  );
  for (const [cat, items] of Object.entries(d.selections)) {
    lines.push(`${cat} (${items.length})`);
    lines.push(items.length ? items.map((i) => `  • ${i}`).join('\n') : '  — none selected —');
    lines.push('');
  }
  return lines.join('\n');
}

function renderHtml(d) {
  const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const blocks = Object.entries(d.selections)
    .map(
      ([cat, items]) =>
        `<h3 style="margin:18px 0 4px;font:700 15px Helvetica,Arial,sans-serif">${esc(cat)} (${items.length})</h3>
         <div style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#333">${
           items.length ? items.map(esc).join(' &middot; ') : '&mdash; none selected &mdash;'
         }</div>`
    )
    .join('');
  const testBanner = d.testMode
    ? '<div style="background:#FDF3D0;border:2px solid #E0B94A;border-radius:8px;padding:12px;margin-bottom:16px;font:800 14px Helvetica,Arial,sans-serif;color:#5A4408">TEST SUBMISSION &mdash; NOT CHILD&rsquo;S FINAL FOOD PROFILE</div>'
    : '';
  return `<div style="max-width:640px;margin:0 auto;padding:24px;font-family:Helvetica,Arial,sans-serif">
    ${testBanner}
    <h1 style="margin:0 0 4px;font-size:22px">${esc(d.child)}</h1>
    <div style="color:#666;font-size:14px">${esc(d.grade)} &middot; submitted ${esc(
      new Date(d.submittedAt).toLocaleString()
    )} &middot; ${d.totalSelected} foods selected</div>
    ${blocks}
  </div>`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
