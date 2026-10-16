/* =========================================================================
   Cliente del backend opcional (carpeta /api, para Railway).
   El API oficial de SoundCloud pide client_secret para cualquier token,
   y ese secreto no puede vivir en una página pública. Por eso, sólo si
   hay API_BASE se activan "buscar en SoundCloud" y "guardar playlist".
   ========================================================================= */
(function () {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('api');
  const base = (fromUrl || (window.SR_CONFIG && window.SR_CONFIG.API_BASE) || '').replace(/\/+$/, '');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
  };

  // Al volver del login de SoundCloud el backend deja la sesión en el hash.
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('sc_session')) {
    store.set('sonia.scSession', hash.get('sc_session'));
    history.replaceState(null, '', location.pathname + location.search);
  }

  async function req(path, opts = {}) {
    const r = await fetch(base + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { status: r.status });
    return data;
  }

  const api = {
    enabled: !!base,
    base,
    async health() {
      if (!base) return null;
      try { return await req('/api/health'); } catch (e) { return null; }
    },
    search(q, genre, limit = 8) {
      const u = new URLSearchParams({ q, limit: String(limit) });
      if (genre) u.set('genres', genre);
      return req('/api/search?' + u.toString());
    },
    session() { return store.get('sonia.scSession'); },
    login(returnTo) {
      location.href = base + '/api/auth/login?return=' + encodeURIComponent(returnTo || location.href);
    },
    savePlaylist(title, description, urls) {
      return req('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ session: store.get('sonia.scSession'), title, description, urls }),
      });
    },
    forget() { store.del('sonia.scSession'); },
    store,
  };

  /* -------------------------------------------------------------------
     Audius: API abierta y gratuita, sin llave, con CORS. Los artistas
     suben su propia música, así que el streaming completo es legal.
     https://docs.audius.org/api  · Se pide app_name para identificarnos.
     ------------------------------------------------------------------- */
  const AUDIUS_GENRE = {
    pop: 'Pop', rock: 'Rock', urbano: 'Latin', hiphop: 'Hip-Hop/Rap', electronica: 'Electronic',
    regional: 'Latin', rnb: 'R&B/Soul', indie: 'Alternative', jazz: 'Jazz', clasica: 'Classical', otros: 'World',
  };
  let audiusHost = null;
  const audius = {
    async host() {
      if (audiusHost) return audiusHost;
      const r = await fetch('https://api.audius.co');
      const j = await r.json();
      audiusHost = (j.data && j.data[0]) || 'https://api.audius.co';
      return audiusHost;
    },
    // Toma lo más escuchado del mes en ese género y deja SÓLO música original:
    // fuera remixes, covers, edits y bootlegs de canciones de otros artistas.
    async search(genreKey, moods = [], limit = 8) {
      const h = await audius.host();
      const genre = AUDIUS_GENRE[genreKey] || '';
      const q = new URLSearchParams({ time: 'month', app_name: 'SonIA' });
      if (genre) q.set('genre', genre);
      const r = await fetch(`${h}/v1/tracks/trending?${q.toString()}`);
      if (!r.ok) throw new Error('Audius HTTP ' + r.status);
      const j = await r.json();
      const notOriginal = /\b(edit|remix|rmx|bootleg|mashup|flip|cover|rework|vip|sped|slowed|nightcore|type beat|repost)\b/i;
      const originals = (j.data || []).filter(t =>
        t.is_streamable !== false && !t.is_stream_gated && t.duration > 90 && t.duration < 600 &&
        !(t.remix_of && t.remix_of.tracks && t.remix_of.tracks.length) &&
        !t.cover_original_song_title && !notOriginal.test(t.title));
      // Primero las que coinciden con el ánimo buscado; después el resto.
      const wanted = new Set(moods);
      originals.sort((a, b) => (wanted.has(b.mood) ? 1 : 0) - (wanted.has(a.mood) ? 1 : 0));
      return originals
        .slice(0, limit)
        .map(t => ({
          id: t.id, title: t.title, user: t.user && t.user.name,
          duration: t.duration, bpm: t.bpm ? Math.round(t.bpm) : null, plays: t.play_count,
          artwork: t.artwork && (t.artwork['480x480'] || t.artwork['150x150']),
          stream: (t.stream && t.stream.url) || `${h}/v1/tracks/${t.id}/stream?app_name=SonIA`,
          url: 'https://audius.co' + (t.permalink || ''),
          mood: t.mood, genre: t.genre,
        }));
    },
  };

  window.SR = window.SR || {};
  window.SR.api = api;
  window.SR.audius = audius;
})();
