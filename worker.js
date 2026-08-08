/**
 * Fuel for Greatness — Cloudflare Worker (Worker + Static Assets)
 *
 *   GET  /*            → static site via the ASSETS binding (index.html)
 *   POST /api/submit   → this Worker: validates, builds an HTML email + PDF
 *                        report, sends both through Resend to the parents.
 *
 * Server-side settings (Cloudflare → Settings → Variables & Secrets):
 *   RESEND_API_KEY  (Secret)  Resend API key
 *   FROM_EMAIL      (Variable) verified sender, e.g. lunch@yourdomain.com
 *   TO_EMAILS       (Variable) bazeocrisy@yahoo.com,stepflem30@gmail.com
 *
 * No credentials ever reach the browser. The browser only ever talks to /api/submit.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/submit') {
      if (request.method !== 'POST') return json({ success: false, message: 'Method not allowed' }, 405);
      return handleSubmit(request, env);
    }
    if (url.pathname.startsWith('/api/')) return json({ success: false, message: 'Not found' }, 404);

    return env.ASSETS.fetch(request);
  },
};

/* ------------------------------------------------------------------ submit */

async function handleSubmit(request, env) {
  // Cheap abuse guard: a real profile is a few KB at most.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 64 * 1024) return json({ success: false, message: 'Submission too large.' }, 413);

  let data;
  try {
    const raw = await request.text();
    if (raw.length > 64 * 1024) return json({ success: false, message: 'Submission too large.' }, 413);
    data = JSON.parse(raw);
  } catch {
    return json({ success: false, message: 'Invalid JSON body.' }, 400);
  }

  if (!data || !data.child || !data.selections || typeof data.selections !== 'object') {
    return json({ success: false, message: 'Submission data is incomplete.' }, 400);
  }

  const isTest = data.testMode === true;
  const report = normalize(data, isTest);

  const apiKey = env.RESEND_API_KEY;
  const from = env.FROM_EMAIL;
  const to = String(env.TO_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!apiKey || !from || !to.length) {
    return json(
      {
        success: false,
        configured: false,
        message: 'Email service is not configured yet.',
        missing: [!apiKey && 'RESEND_API_KEY', !from && 'FROM_EMAIL', !to.length && 'TO_EMAILS'].filter(Boolean),
      },
      503
    );
  }

  let pdfBase64, filename;
  try {
    const pdf = buildPdf(report);
    pdfBase64 = base64(pdf);
    filename = pdfFilename(report);
  } catch (err) {
    return json({ success: false, message: 'Could not generate the parent report PDF.', detail: String(err) }, 500);
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: subjectFor(report),
        html: emailHtml(report),
        text: emailText(report),
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ success: false, message: 'Email delivery failed.', detail: detail.slice(0, 400) }, 502);
    }
    const out = await res.json().catch(() => ({}));
    return json({ success: true, id: out.id || null, test: isTest });
  } catch (err) {
    return json({ success: false, message: 'Email delivery failed.', detail: String(err) }, 502);
  }
}

/* ------------------------------------------------------------- report model */

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

function subjectFor(r) {
  return r.isTest
    ? `[TEST] Fuel for Greatness — ${r.first} Preview`
    : `Fuel for Greatness — ${r.fullName} — Lunch Food Profile`;
}

function pdfFilename(r) {
  const day = r.date.toISOString().slice(0, 10);
  const slug = (r.isTest ? `${r.first}-Preview` : r.fullName.replace(/^(Ms\.|Mr\.)\s*/, '')).replace(/[^A-Za-z0-9]+/g, '-');
  return `${r.isTest ? 'TEST_' : ''}Fuel-for-Greatness_${slug}_Lunch-Profile_${day}.pdf`;
}

/* --------------------------------------------------------------- HTML email */

function emailHtml(r) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const testBanner = r.isTest
    ? `<tr><td style="padding:0 0 20px"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF4D6;border:2px solid #E0B94A;border-radius:10px"><tr><td style="padding:14px 16px;font:800 15px/1.4 Helvetica,Arial,sans-serif;color:#5A4408">TEST SUBMISSION<br><span style="font-weight:400;font-size:14px">This is a Parent/Test Mode submission and is not the child&rsquo;s final food profile.</span></td></tr></table></td></tr>`
    : '';

  const summary = r.categories
    .map(
      (c) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #EFEAE2;font:700 15px Helvetica,Arial,sans-serif;color:#191410">
          <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${c.meta.color}"></span>&nbsp; ${esc(c.name)}
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #EFEAE2;font:700 15px Helvetica,Arial,sans-serif;color:${c.meta.color}">
          ${c.items.length ? `${c.items.length} selected` : c.answered ? 'None of these' : 'Not answered'}
        </td>
      </tr>`
    )
    .join('');

  const details = r.categories
    .map((c) => {
      const body = c.items.length
        ? `<table width="100%" cellpadding="0" cellspacing="0">${c.items
            .map(
              (i) =>
                `<tr><td style="padding:4px 0;font:400 15px Helvetica,Arial,sans-serif;color:#2A2420"><span style="color:${c.meta.color};font-weight:700">&#10003;</span>&nbsp; ${esc(i)}</td></tr>`
            )
            .join('')}</table>`
        : `<div style="font:600 15px Helvetica,Arial,sans-serif;color:#6B7480">${
            c.answered ? 'No favorites selected &mdash; &ldquo;None of these for me&rdquo;' : 'Not answered'
          }</div>`;
      return `<tr><td style="padding:0 0 22px">
        <div style="border-left:6px solid ${c.meta.color};padding:2px 0 2px 12px;margin-bottom:10px;font:800 17px Helvetica,Arial,sans-serif;color:#191410">${esc(
        c.meta.icon
      )} ${esc(c.name)} <span style="font-weight:600;color:#6B7480">&mdash; ${c.items.length} ${
        c.items.length === 1 ? 'favorite' : 'favorites'
      }</span></div>
        ${body}
      </td></tr>`;
    })
    .join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background:#FFF9F0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:16px;border:1px solid #EFEAE2">
<tr><td style="padding:28px 28px 0">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td>
    <div style="font:900 12px Helvetica,Arial,sans-serif;letter-spacing:3px;color:${r.theme.color};text-transform:uppercase">Fuel for Greatness</div>
    <div style="font:900 26px/1.2 Helvetica,Arial,sans-serif;color:#191410;padding-top:6px">${esc(r.first)}&rsquo;s School Lunch Food Profile</div>
    <div style="font:700 14px Helvetica,Arial,sans-serif;color:#6B7480;padding-top:8px">FOOD &rarr; FUEL &rarr; FOCUS &rarr; PERFORMANCE</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px 0">
  ${testBanner}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F1;border-radius:12px">
    <tr><td style="padding:14px 16px;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#2A2420">
      <strong>Child:</strong> ${esc(r.fullName)}<br>
      <strong>Grade:</strong> ${esc(r.grade)}<br>
      <strong>Completed:</strong> ${esc(r.timeLabel)}<br>
      <strong>Total foods selected:</strong> ${r.total}
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 28px 0">
  <div style="font:800 18px Helvetica,Arial,sans-serif;color:#191410;padding-bottom:6px">${esc(r.first)}&rsquo;s Favorites</div>
  <table width="100%" cellpadding="0" cellspacing="0">${summary}</table>
</td></tr>
<tr><td style="padding:26px 28px 0">
  <div style="font:800 18px Helvetica,Arial,sans-serif;color:#191410;padding-bottom:14px">Every Selection</div>
  <table width="100%" cellpadding="0" cellspacing="0">${details}</table>
</td></tr>
<tr><td style="padding:6px 28px 28px;border-top:1px solid #EFEAE2">
  <div style="font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8A929C;padding-top:14px">
    The full designed report is attached as a PDF.<br>
    Parents provide the choices. Kids tell us what they like. Together, we build the plan.
  </div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function emailText(r) {
  const lines = [];
  if (r.isTest) lines.push("TEST SUBMISSION — NOT CHILD'S FINAL FOOD PROFILE", '');
  lines.push('FUEL FOR GREATNESS — School Lunch Food Profile', r.fullName, `Grade: ${r.grade}`, `Completed: ${r.timeLabel}`, `Total foods selected: ${r.total}`, '');
  for (const c of r.categories) {
    lines.push(`${c.name} (${c.items.length})`);
    lines.push(c.items.length ? c.items.map((i) => `  - ${i}`).join('\n') : c.answered ? '  None of these for me (answered intentionally)' : '  Not answered');
    lines.push('');
  }
  return lines.join('\n');
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
