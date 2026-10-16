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

  window.SR = window.SR || {};
  window.SR.api = api;
})();
