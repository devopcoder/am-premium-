// Alight Motion Premium Generator relay — D3S Edition
// Endpoint: POST /api/am
// Body: { action: "send-magiclink" | "verify-account" | "apply-premium", ... }
// Proxy to: https://anita-studio.netlify.app/.netlify/functions/amprem

const UPSTREAM = 'https://anita-studio.netlify.app/.netlify/functions/amprem';

export const config = { maxDuration: 30 };

async function proxy(payload) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 28000);
  try {
    const r = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    clearTimeout(to);
    return { status: 0, ok: false, data: { error: String(e) } };
  }
}

function extractMagicLink(raw) {
  if (!raw) return null;
  const urls = String(raw).match(/https?:\/\/[^\s"'<>]+/gi);
  if (!urls) return String(raw).trim();
  const preferred = urls.find(u => /oobCode|mode=signIn|magic/i.test(u));
  return (preferred || urls[0]).trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      relay: 'vercel-am',
      upstream: UPSTREAM,
      actions: ['send-magiclink', 'verify-account', 'apply-premium'],
      ts: Date.now(),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, msg: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { body = Object.fromEntries(new URLSearchParams(body)); }
  }
  if (!body || typeof body !== 'object') body = {};

  const action = String(body.action || '').trim();
  if (!action) return res.status(400).json({ ok: false, msg: 'action required' });

  let upstreamPayload;
  if (action === 'send-magiclink') {
    const email = String(body.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, msg: 'invalid email' });
    }
    upstreamPayload = { action, email };
  } else if (action === 'verify-account') {
    const email = String(body.email || '').trim();
    const rawLink = extractMagicLink(body.rawLink || body.link || '');
    if (!email || !rawLink) {
      return res.status(400).json({ ok: false, msg: 'email and rawLink required' });
    }
    upstreamPayload = { action, email, rawLink };
  } else if (action === 'apply-premium') {
    const email = String(body.email || '').trim();
    const idToken = String(body.idToken || '').trim();
    if (!email || !idToken) {
      return res.status(400).json({ ok: false, msg: 'email and idToken required' });
    }
    upstreamPayload = { action, email, idToken };
  } else {
    return res.status(400).json({ ok: false, msg: 'unknown action: ' + action });
  }

  const r = await proxy(upstreamPayload);

  return res.status(200).json({
    ok: r.ok,
    status: r.status,
    action,
    upstream: r.data,
    relay: 'vercel',
  });
}
