/* =========================================================================
   SonIA · backend opcional (Railway). Node 18+, sin dependencias.

   ¿Por qué existe? El API oficial de SoundCloud exige client_secret para
   pedir cualquier token, y ese secreto no puede ir en GitHub Pages.
   Este servidor lo guarda y ofrece sólo 3 cosas:
     GET  /api/search      → busca canciones (client credentials)
     GET  /api/auth/login  → inicia OAuth 2.1 + PKCE con la cuenta del usuario
     POST /api/playlists   → crea la playlist en la cuenta del usuario
   Usa ~40 MB de RAM: sin frameworks, sesiones en memoria.

   Variables de entorno:
     SC_CLIENT_ID, SC_CLIENT_SECRET  (de https://soundcloud.com/you/apps)
     PUBLIC_URL       URL pública de este servidor (para el redirect_uri)
     FRONTEND_ORIGIN  origen de la página, p. ej. https://usuario.github.io
     PORT             lo pone Railway
   ========================================================================= */
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const CLIENT_ID = process.env.SC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SC_CLIENT_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5500')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const REDIRECT_URI = PUBLIC_URL + '/api/auth/callback';

const SC_API = 'https://api.soundcloud.com';
const SC_AUTH = 'https://secure.soundcloud.com';

/* ----------------------------- utilidades ----------------------------- */
const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n = 32) => b64url(crypto.randomBytes(n));

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && FRONTEND_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, data = '';
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function allowedReturn(url) {
  try {
    const u = new URL(url);
    return FRONTEND_ORIGINS.includes(u.origin) ? u.toString() : null;
  } catch (e) { return null; }
}

async function tokenRequest(params, basic) {
  const headers = {
    accept: 'application/json; charset=utf-8',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (basic) headers.Authorization = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const r = await fetch(SC_AUTH + '/oauth/token', { method: 'POST', headers, body: new URLSearchParams(params) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.error || `token HTTP ${r.status}`);
  return data;
}

async function scGet(path, token) {
  const r = await fetch(SC_API + path, { headers: { accept: 'application/json', Authorization: 'OAuth ' + token } });
  if (!r.ok) throw Object.assign(new Error(`SoundCloud HTTP ${r.status}`), { status: r.status });
  return r.json();
}

/* ------------------- token de la app (client credentials) ------------------- */
// Límite de SoundCloud: 50 tokens / 12 h por app, así que se reutiliza.
let appToken = null;
async function getAppToken() {
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.value;
  const t = await tokenRequest({ grant_type: 'client_credentials' }, true);
  appToken = { value: t.access_token, exp: Date.now() + (t.expires_in || 3600) * 1000 };
  return appToken.value;
}

/* ------------------------ sesiones de usuario (PKCE) ------------------------ */
const pending = new Map();   // state -> { verifier, returnTo, at }
const sessions = new Map();  // sessionId -> { access, refresh, exp }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > 10 * 60_000) pending.delete(k);
  for (const [k, v] of sessions) if (now - v.exp > 7 * 24 * 3600_000) sessions.delete(k);
}, 5 * 60_000).unref();

async function userToken(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (s.exp > Date.now() + 30_000) return s.access;
  if (!s.refresh) return null;
  const t = await tokenRequest({
    grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: s.refresh,
  });
  // Los refresh tokens de SoundCloud son de un solo uso: guarda el nuevo.
  sessions.set(sessionId, { access: t.access_token, refresh: t.refresh_token || null, exp: Date.now() + (t.expires_in || 3600) * 1000 });
  return t.access_token;
}

/* -------------------------------- rutas -------------------------------- */
async function route(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url.pathname === '/' || url.pathname === '/api/health') {
    return send(res, 200, { ok: true, soundcloud: !!(CLIENT_ID && CLIENT_SECRET) });
  }
  if (!CLIENT_ID || !CLIENT_SECRET) return send(res, 503, { error: 'Faltan SC_CLIENT_ID y SC_CLIENT_SECRET' });

  // Buscar canciones reproducibles
  if (url.pathname === '/api/search' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').slice(0, 100);
    const genres = (url.searchParams.get('genres') || '').slice(0, 60);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));
    const params = new URLSearchParams({ q, access: 'playable', limit: String(limit) });
    if (genres) params.set('genres', genres);
    const data = await scGet('/tracks?' + params.toString(), await getAppToken());
    const list = Array.isArray(data) ? data : data.collection || [];
    return send(res, 200, {
      tracks: list.map(t => ({
        id: t.id, title: t.title, user: t.user && t.user.username,
        duration: t.duration, url: t.permalink_url,
        artwork: t.artwork_url ? t.artwork_url.replace('-large', '-t300x300') : null,
        bpm: t.bpm || null, plays: t.playback_count || null,
        year: t.created_at ? String(t.created_at).slice(0, 4) : null,
      })),
    });
  }

  // OAuth 2.1 + PKCE: paso 1
  if (url.pathname === '/api/auth/login' && req.method === 'GET') {
    const returnTo = allowedReturn(url.searchParams.get('return') || '');
    if (!returnTo) return send(res, 400, { error: 'return no permitido' });
    const verifier = rand(48);
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = rand(16);
    pending.set(state, { verifier, returnTo, at: Date.now() });
    const auth = new URL(SC_AUTH + '/authorize');
    auth.search = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code',
      code_challenge: challenge, code_challenge_method: 'S256', state,
    }).toString();
    res.writeHead(302, { Location: auth.toString() });
    res.end();
    return;
  }

  // OAuth 2.1 + PKCE: paso 2 (SoundCloud regresa aquí)
  if (url.pathname === '/api/auth/callback' && req.method === 'GET') {
    const state = url.searchParams.get('state');
    const p = state && pending.get(state);
    if (!p) return send(res, 400, { error: 'state inválido o expirado' });
    pending.delete(state);
    const code = url.searchParams.get('code');
    if (!code) { res.writeHead(302, { Location: p.returnTo }); res.end(); return; }
    const t = await tokenRequest({
      grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, code_verifier: p.verifier, code,
    });
    const sessionId = rand(24);
    sessions.set(sessionId, { access: t.access_token, refresh: t.refresh_token || null, exp: Date.now() + (t.expires_in || 3600) * 1000 });
    const back = new URL(p.returnTo);
    back.hash = 'sc_session=' + sessionId;
    res.writeHead(302, { Location: back.toString() });
    res.end();
    return;
  }

  // Crear la playlist en la cuenta del usuario
  if (url.pathname === '/api/playlists' && req.method === 'POST') {
    const body = await readJson(req);
    const token = await userToken(body.session);
    if (!token) return send(res, 401, { error: 'sesión inválida' });
    const urls = (Array.isArray(body.urls) ? body.urls : []).filter(u => /^https:\/\/soundcloud\.com\//.test(u)).slice(0, 60);
    const ids = [];
    for (const u of urls) {
      try {
        const r = await scGet('/resolve?url=' + encodeURIComponent(u), token);
        if (r.kind === 'track') ids.push(r.id);
        else if (r.kind === 'playlist' && r.tracks && r.tracks[0]) ids.push(r.tracks[0].id);
      } catch (e) { /* pista no disponible: se omite */ }
    }
    if (!ids.length) return send(res, 422, { error: 'ninguna canción se pudo resolver' });
    const r = await fetch(SC_API + '/playlists', {
      method: 'POST',
      headers: { accept: 'application/json; charset=utf-8', 'Content-Type': 'application/json', Authorization: 'OAuth ' + token },
      body: JSON.stringify({
        playlist: {
          title: String(body.title || 'SonIA').slice(0, 100),
          description: String(body.description || '').slice(0, 500),
          sharing: 'public',
          tracks: ids.map(id => ({ id })),
        },
      }),
    });
    const pl = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 502, { error: pl.error || `SoundCloud HTTP ${r.status}` });
    return send(res, 200, { url: pl.permalink_url, id: pl.id, added: ids.length, skipped: urls.length - ids.length });
  }

  send(res, 404, { error: 'no encontrado' });
}

http.createServer((req, res) => {
  route(req, res).catch(err => {
    console.error(err);
    if (!res.headersSent) send(res, err.status === 401 ? 401 : 500, { error: err.message });
  });
}).listen(PORT, () => console.log(`SonIA API escuchando en ${PORT} · redirect_uri=${REDIRECT_URI}`));
