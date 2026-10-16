/* =========================================================================
   SonIA · lógica de la interfaz
   ========================================================================= */
(function () {
  const { CATALOG, GENRES, QUESTIONS, EMOTION_FLOW, engine, player, viz, api, audius, bg } = window.SR;
  const I = window.SR.icon;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const store = api.store;

  const S = {
    mode: 'full', flow: [], idx: 0, answers: {},
    profile: null, result: null, tracks: [],
    current: -1, oneOff: null,
    likes: new Set(), dislikes: new Set(), unavailable: new Set(),
    artwork: {},
  };

  $('#statSongs').textContent = CATALOG.length;
  $$('.n-songs').forEach(n => { n.textContent = CATALOG.length; });

  /* ---------------------------- utilidades ---------------------------- */
  const fmt = ms => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = t => t.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const ytUrl = id => 'https://www.youtube.com/watch?v=' + id;
  const linkOf = s => (s.audio ? s.url : s.yt ? ytUrl(s.yt) : s.sc);

  function toast(msg, ms = 4200, icon = 'info') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${I(icon, 'toast-ico')}<div>${msg}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }

  function go(view) {
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.dataset.view = view;
    syncBg();
  }

  function setAccent(genre) {
    const c = (GENRES[genre] || {}).color || '#3df5ff';
    const keys = Object.keys(GENRES);
    const i = keys.indexOf(genre);
    const c2 = GENRES[keys[((i < 0 ? 0 : i) + 4) % keys.length]].color;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-2', c2);
    viz.setColors(c, c2);
  }

  /* ------------------------ música de fondo (original) ------------------------ */
  // Preferencia: activada por defecto. El navegador sólo deja sonar audio
  // después de una interacción, así que arranca con el primer clic.
  let bgWanted = store.get('sonia.bg') !== 'off';
  let interacted = false;

  function syncBg() {
    const view = document.body.dataset.view;
    const shouldPlay = bgWanted && interacted && view !== 'results' && !player.state.playing;
    if (shouldPlay) bg.start(); else bg.stop();
    const b = $('#bgToggle');
    b.setAttribute('aria-pressed', String(bgWanted));
    b.classList.toggle('is-on', bgWanted);
    b.querySelector('.txt').textContent = bgWanted ? 'Música de fondo' : 'Sin música de fondo';
  }

  document.addEventListener('pointerdown', () => {
    if (interacted) return;
    interacted = true;
    syncBg();
  }, { capture: true });
  document.addEventListener('keydown', () => { if (!interacted) { interacted = true; syncBg(); } }, { capture: true });

  $('#bgToggle').addEventListener('click', () => {
    bgWanted = !bgWanted;
    store.set('sonia.bg', bgWanted ? 'on' : 'off');
    syncBg();
    if (bgWanted && document.body.dataset.view === 'results') toast('La música de fondo suena en el inicio y en el cuestionario; aquí se pausa para que escuches tu playlist.', 4500, 'music');
  });

  // Las barras del inicio y del botón bailan con la música de fondo real.
  const heroBars = $$('.hero-eq i'), brandBars = $$('.brand-eq i'), bgBars = $$('.bg-eq i');
  (function bgLoop() {
    const lv = bg.on ? bg.levels(16) : null;
    document.body.classList.toggle('bg-live', !!lv);
    if (lv) {
      heroBars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.08, Math.min(1, lv[i] * 1.5)).toFixed(3)})`; });
      brandBars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.2, Math.min(1, lv[i * 3] * 1.6)).toFixed(3)})`; });
      bgBars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.15, Math.min(1, lv[i * 2 + 1] * 1.7)).toFixed(3)})`; });
    } else {
      [...heroBars, ...brandBars, ...bgBars].forEach(b => { if (b.style.transform) b.style.transform = ''; });
    }
    requestAnimationFrame(bgLoop);
  })();

  /* ---------------------------- persistencia --------------------------- */
  function save() {
    try {
      store.set('sonia.last', JSON.stringify({
        mode: S.mode, answers: S.answers, profile: S.profile,
        trackIds: S.tracks.map(t => t.song.id),
        likes: [...S.likes], dislikes: [...S.dislikes],
      }));
    } catch (e) { /* sin almacenamiento */ }
  }
  function loadSaved() {
    try { return JSON.parse(store.get('sonia.last') || 'null'); } catch (e) { return null; }
  }
  if (loadSaved()) $('#resumeBtn').hidden = false;

  /* ---------------------------- cuestionario --------------------------- */
  function startQuiz(mode) {
    S.mode = mode;
    S.flow = mode === 'emotion' ? EMOTION_FLOW : QUESTIONS;
    S.idx = 0;
    S.answers = {};
    S.likes.clear(); S.dislikes.clear();
    bg.setTempo(84); bg.setMood('major');
    go('quiz');
    renderQuestion(1);
  }

  function renderQuestion(dir) {
    const q = S.flow[S.idx];
    const card = $('#qCard');
    card.classList.remove('out', 'back-in');
    void card.offsetWidth; // reinicia la animación
    if (dir < 0) card.classList.add('back-in');

    $('#qKicker').textContent = `Pregunta ${S.idx + 1}${S.mode === 'emotion' ? ' · Modo emoción' : ''}`;
    $('#qTitle').textContent = q.text;
    $('#qHint').textContent = q.hint || (q.multi > 1 ? `Elige hasta ${q.multi}` : 'Elige una opción');
    $('#quizCount').textContent = `${S.idx + 1} / ${S.flow.length}`;
    $('#quizProgress').style.width = `${(S.idx / S.flow.length) * 100}%`;
    $('#quizBack').style.visibility = S.idx === 0 ? 'hidden' : 'visible';

    const sel = S.answers[q.id] || [];
    const box = $('#qOptions');
    box.innerHTML = '';
    box.setAttribute('aria-label', q.text);
    q.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (sel.includes(o.v) ? ' sel' : '');
      b.style.animationDelay = `${i * 35}ms`;
      b.setAttribute('aria-pressed', sel.includes(o.v));
      b.dataset.v = o.v;
      b.innerHTML = `<span class="key">${o.k}</span><span class="ico">${I(o.icon)}</span><span class="lbl">${esc(o.label)}</span>`;
      b.addEventListener('click', () => choose(q, o, b, i));
      box.appendChild(b);
    });
    updateNext();
  }

  // La música de fondo reacciona a lo que eliges.
  const TEMPO = { lento: 70, moderado: 84, bailable: 104, rapido: 124 };
  const SAD = ['triste', 'nostalgico', 'cansado', 'desahogo', 'nostalgia'];

  function choose(q, o, btn, i) {
    let sel = S.answers[q.id] ? [...S.answers[q.id]] : [];
    if (q.multi === 1) sel = [o.v];
    else if (sel.includes(o.v)) sel = sel.filter(v => v !== o.v);
    else if (o.exclusive) sel = [o.v];
    else {
      sel = sel.filter(v => !q.options.find(x => x.v === v && x.exclusive));
      if (sel.length >= q.multi) sel.shift();
      sel.push(o.v);
    }
    S.answers[q.id] = sel;
    $$('#qOptions .opt').forEach(b => {
      const on = sel.map(String).includes(b.dataset.v);
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on);
    });
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    bg.blip(i || 0);
    if (q.id === 'ritmo' && TEMPO[o.v]) bg.setTempo(TEMPO[o.v]);
    if (q.id === 'emociones' || q.id === 'animo') bg.setMood(sel.some(v => SAD.includes(v)) ? 'minor' : 'major');
    if (q.id === 'meta' && o.v === 'cambiar') bg.setMood('major');
    updateNext();
    // Selección única: avanza sola tras una breve pausa.
    if (q.multi === 1) setTimeout(() => { if (S.flow[S.idx] === q) next(); }, 320);
  }

  function updateNext() {
    const q = S.flow[S.idx];
    const ok = (S.answers[q.id] || []).length > 0;
    const btn = $('#quizNext');
    btn.disabled = !ok;
    btn.firstChild.textContent = S.idx === S.flow.length - 1 ? 'Crear mi playlist ' : 'Siguiente ';
  }

  function next() {
    const q = S.flow[S.idx];
    if (!(S.answers[q.id] || []).length) return;
    if (S.idx === S.flow.length - 1) { $('#quizProgress').style.width = '100%'; think(); return; }
    $('#qCard').classList.add('out');
    setTimeout(() => { S.idx++; renderQuestion(1); }, 240);
  }

  function back() {
    if (S.idx === 0) return;
    S.idx--;
    renderQuestion(-1);
  }

  $('#quizNext').addEventListener('click', next);
  $('#quizBack').addEventListener('click', back);

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    const view = document.body.dataset.view;
    if (view === 'quiz') {
      const q = S.flow[S.idx];
      const k = e.key.toUpperCase();
      const idx = q.options.findIndex(x => x.k === k);
      if (idx >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const o = q.options[idx];
        choose(q, o, $(`#qOptions .opt[data-v="${o.v}"]`), idx);
      } else if (e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'Backspace' || e.key === 'ArrowLeft') back();
      else if (e.key === 'ArrowRight') next();
    } else if (view === 'results' && e.key === ' ' && !e.target.matches('button, a, summary')) {
      e.preventDefault(); togglePlay();
    }
  });

  /* ----------------------- "la IA está pensando" ----------------------- */
  function buildNet() {
    const svg = $('#netSvg');
    const layers = [4, 6, 6, 3];
    const nodes = [];
    let html = '';
    layers.forEach((n, li) => {
      for (let i = 0; i < n; i++) nodes.push({ li, x: 25 + li * 50, y: 100 + (i - (n - 1) / 2) * 28 });
    });
    nodes.forEach((a, ai) => nodes.forEach((b, bi) => {
      if (b.li === a.li + 1) html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }));
    nodes.forEach(n => { html += `<circle cx="${n.x}" cy="${n.y}" r="7"/>`; });
    svg.innerHTML = html;
  }

  function think() {
    go('thinking');
    buildNet();
    const lines = $$('#netSvg line'), circles = $$('#netSvg circle');
    const pulse = setInterval(() => {
      lines.forEach(l => l.classList.toggle('on', Math.random() < 0.18));
      circles.forEach(c => c.classList.toggle('on', Math.random() < 0.3));
    }, 160);
    const steps = $$('#thinkSteps li');
    steps.forEach(s => s.classList.remove('active', 'done'));

    // El cálculo real es instantáneo; la animación sólo muestra las etapas.
    S.profile = engine.buildProfile(flatAnswers(), S.mode);
    S.result = engine.recommend(S.profile);

    let i = 0;
    const advance = () => {
      if (i > 0) steps[i - 1].classList.replace('active', 'done');
      if (i < steps.length) { steps[i].classList.add('active'); i++; setTimeout(advance, 650); }
      else { clearInterval(pulse); showResults(); }
    };
    advance();
  }

  function flatAnswers() {
    const out = {};
    for (const [k, v] of Object.entries(S.answers)) {
      const q = window.SR.QBY[k];
      out[k] = q && q.multi > 1 ? v : v[0];
    }
    return out;
  }

  /* ---------------------------- resultados ---------------------------- */
  function showResults() {
    S.tracks = S.result.tracks;
    S.current = -1;
    S.oneOff = null;
    go('results');
    renderProfile();
    renderTracks();
    renderStageIdle();
    save();
    $('#discoverList').innerHTML = '';
    const top = Object.keys(S.profile.genres)[0] || (S.tracks[0] && S.tracks[0].song.g);
    setAccent(top);
    if (S.result.exhausted) toast(`El catálogo alcanzó <b>${Math.round(S.result.totalSec / 60)} min</b> con canciones que encajan contigo.`);
  }

  function renderStageIdle() {
    $('#nowEyebrow').textContent = 'Listo para sonar';
    $('#nowTitle').textContent = S.mode === 'emotion' ? `Playlist para cuando estás ${engine.MOODS[S.profile.mood].label}` : 'Tu playlist personalizada';
    $('#nowArtist').textContent = `${S.tracks.length} canciones · ${Math.round(S.result.totalSec / 60)} min`;
    $('#nowChips').innerHTML = '';
    $('#vinylArt').style.backgroundImage = '';
    showMedia(null);
    const first = S.tracks[0] && S.tracks[0].song;
    $('#openScBtn').href = first ? linkOf(first) : 'https://www.youtube.com';
  }

  function renderProfile() {
    const p = S.profile;
    const pts = engine.radar(p);
    const cx = 150, cy = 150, R = 105, n = pts.length;
    const pos = (i, r) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    let svg = '';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      svg += `<polygon class="grid" points="${pts.map((_, i) => pos(i, R * f).join(',')).join(' ')}"/>`;
    });
    pts.forEach((pt, i) => {
      const [x, y] = pos(i, R);
      svg += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      const [lx, ly] = pos(i, R + 22);
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${pt.label}</text>`;
    });
    svg += `<polygon class="shape" points="${pts.map((pt, i) => pos(i, R * (0.08 + pt.value * 0.92)).join(',')).join(' ')}"/>`;
    pts.forEach((pt, i) => { const [x, y] = pos(i, R * (0.08 + pt.value * 0.92)); svg += `<circle class="pt" cx="${x}" cy="${y}" r="3.5"/>`; });
    $('#radar').innerHTML = svg;

    const chips = [];
    Object.keys(p.genres).forEach(g => GENRES[g] && chips.push(`<span class="tag g" style="--gc:${GENRES[g].color}">${GENRES[g].name}</span>`));
    Object.keys(p.emo).slice(0, 3).forEach(e => chips.push(`<span class="tag">${I('heart-pulse')} ${engine.EMO_LABEL[e]}</span>`));
    p.ctx.forEach(c => chips.push(`<span class="tag">${I('map-pin')} ${engine.CTX_LABEL[c]}</span>`));
    if (p.mood) chips.push(`<span class="tag">${I('smile')} ${engine.MOODS[p.mood].label}</span>`);
    if (p.learnedFrom) chips.push(`<span class="tag">${I('brain')} aprendió de ${p.learnedFrom} votos</span>`);
    $('#profileChips').innerHTML = chips.join('');

    const e = p.num.e ? p.num.e.t : 0.5, v = p.num.val ? p.num.val.t : 0.5;
    const lvl = x => (x > .66 ? 'alta' : x > .36 ? 'media' : 'baja');
    const tono = v > .6 ? 'positivo' : v < .4 ? 'melancólico' : 'equilibrado';
    const gnames = Object.keys(p.genres).map(g => GENRES[g] && GENRES[g].name).filter(Boolean);
    let txt = `Buscas música de <b>energía ${lvl(e)}</b> y <b>tono ${tono}</b>`;
    if (gnames.length) txt += `, sobre todo <b>${gnames.slice(0, 3).join(', ')}</b>`;
    if (p.ctx.length) txt += `, para <b>${p.ctx.map(c => engine.CTX_LABEL[c]).join(' y ')}</b>`;
    txt += '.';
    if (p.mood) {
      const m = engine.MOODS[p.mood].label;
      txt += p.moodGoal === 'cambiar'
        ? ` Hoy te sientes <b>${m}</b>; la IA eligió canciones para mejorar tu ánimo.`
        : ` Hoy te sientes <b>${m}</b>; la IA acompaña ese ánimo.`;
    }
    if (p.explore > 0.2) txt += ' Pediste descubrir: incluí géneros fuera de tu zona de confort.';
    $('#profileSummary').innerHTML = txt;
    $('#lambdaTxt').textContent = `(λ = ${p.lambda.toFixed(2)})`;
  }

  function renderTracks() {
    const ol = $('#tracks');
    ol.innerHTML = '';
    $('#plTitle').textContent = S.mode === 'emotion' ? 'Tu playlist según tu emoción' : 'Tu playlist';
    $('#plMeta').textContent = `${S.tracks.length} canciones · ${Math.round(S.result.totalSec / 60)} min · coincidencia media ${Math.round(S.tracks.reduce((a, t) => a + t.match, 0) / (S.tracks.length || 1))}%`;
    S.tracks.forEach((t, i) => ol.appendChild(trackEl(t, i)));
    requestAnimationFrame(() => {
      $$('#tracks .match .fg').forEach(c => { c.style.strokeDashoffset = 113 - (113 * c.dataset.v) / 100; });
    });
    updateTrackStates();
    prefetchArt();
  }

  // Portadas: la miniatura del video oficial de YouTube (sin llave).
  function prefetchArt() {
    S.tracks.forEach(({ song }) => {
      if (S.artwork[song.id] || !song.yt) return;
      const url = `https://i.ytimg.com/vi/${song.yt}/mqdefault.jpg`;
      const img = new Image();
      img.onload = () => {
        S.artwork[song.id] = url;
        const cover = $(`#tracks .track[data-id="${song.id}"] .t-cover`);
        if (cover) { cover.style.backgroundImage = `url('${url}')`; cover.textContent = ''; }
        if (currentSong() === song) setArt(song);
      };
      img.src = url;
    });
  }

  function trackEl(t, i) {
    const s = t.song;
    const li = document.createElement('li');
    li.className = 'track';
    li.style.setProperty('--gc', GENRES[s.g].color);
    li.style.setProperty('--i', i);
    li.dataset.id = s.id;
    const art = S.artwork[s.id];
    li.innerHTML = `
      <span class="t-num">${i + 1}</span>
      <div class="t-cover" style="${art ? `background-image:url('${art}')` : ''}">${art ? '' : initials(s.a)}</div>
      <div class="t-main">
        <div class="t-title">${esc(s.t)}</div>
        <div class="t-artist">${esc(s.a)} · ${s.y}</div>
        <div class="t-reasons">${t.reasons.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
      </div>
      <div class="t-side">
        <div class="match" title="Coincidencia con tu perfil">
          <svg viewBox="0 0 44 44"><circle class="bgc" cx="22" cy="22" r="18"/><circle class="fg" data-v="${t.match}" cx="22" cy="22" r="18"/></svg>
          <span>${t.match}%</span>
        </div>
        <button class="mini-btn like" title="Me gusta" aria-label="Me gusta">${I('thumbs-up')}</button>
        <button class="mini-btn dislike" title="No me gusta" aria-label="No me gusta">${I('thumbs-down')}</button>
        <a class="mini-btn ext" href="${esc(linkOf(s))}" target="_blank" rel="noopener" title="Abrir el original" aria-label="Abrir el original">${I('external-link')}</a>
      </div>`;
    li.addEventListener('click', e => {
      if (e.target.closest('.mini-btn')) return;
      playIndex(i);
    });
    li.querySelector('.like').addEventListener('click', e => vote(s.id, 'like', e.currentTarget));
    li.querySelector('.dislike').addEventListener('click', e => vote(s.id, 'dislike', e.currentTarget));
    return li;
  }

  function vote(id, kind, btn) {
    const set = kind === 'like' ? S.likes : S.dislikes;
    const other = kind === 'like' ? S.dislikes : S.likes;
    if (set.has(id)) set.delete(id); else { set.add(id); other.delete(id); }
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    updateTrackStates();
    save();
    const n = S.likes.size + S.dislikes.size;
    $('#learnHint').innerHTML = n
      ? `Llevas <b>${n}</b> voto${n > 1 ? 's' : ''}. Pulsa <b>Aprender y regenerar</b> para que la IA ajuste tu perfil.`
      : `Marca ${I('thumbs-up')} o ${I('thumbs-down')} en las canciones y pulsa <b>Aprender y regenerar</b>.`;
  }

  function updateTrackStates() {
    $$('#tracks .track').forEach(li => {
      const id = li.dataset.id;
      const idx = S.tracks.findIndex(t => t.song.id === id);
      li.classList.toggle('playing', idx === S.current && !S.oneOff);
      li.classList.toggle('liked', S.likes.has(id));
      li.classList.toggle('disliked', S.dislikes.has(id));
      li.classList.toggle('unavailable', S.unavailable.has(id));
      li.querySelector('.like').classList.toggle('on-like', S.likes.has(id));
      li.querySelector('.dislike').classList.toggle('on-dislike', S.dislikes.has(id));
    });
  }

  $('#regenBtn').addEventListener('click', () => {
    if (!S.likes.size && !S.dislikes.size) { toast('Primero marca me gusta o no me gusta en algunas canciones.', 3500, 'thumbs-up'); return; }
    S.profile = engine.learn(S.profile, [...S.likes], [...S.dislikes]);
    S.result = engine.recommend(S.profile, { banned: [...S.dislikes], pinned: [...S.likes] });
    const playingId = S.current >= 0 && S.tracks[S.current] ? S.tracks[S.current].song.id : null;
    S.tracks = S.result.tracks;
    S.current = playingId ? S.tracks.findIndex(t => t.song.id === playingId) : -1;
    S.dislikes.clear();
    renderProfile();
    renderTracks();
    save();
    toast('La IA ajustó tu perfil con tus votos (Rocchio) y recalculó la playlist.', 4200, 'brain');
  });

  /* ---------------------------- reproducción ---------------------------- */
  function currentSong() {
    if (S.oneOff) return S.oneOff;
    return S.current >= 0 && S.tracks[S.current] ? S.tracks[S.current].song : null;
  }

  function playIndex(i) {
    if (!S.tracks[i]) return;
    S.oneOff = null;
    S.current = i;
    const s = S.tracks[i].song;
    player.load(s, true);
    showNow(s, S.tracks[i]);
    updateTrackStates();
  }

  function playOneOff(song) {
    S.oneOff = song;
    viz.useMediaElement(player.audioEl);
    viz.resumeMedia();
    player.load(song, true);
    showNow(song, null);
    updateTrackStates();
  }

  function nextTrack(step = 1) {
    if (!S.tracks.length) return;
    let i = S.current;
    for (let k = 0; k < S.tracks.length; k++) {
      i = (i + step + S.tracks.length) % S.tracks.length;
      if (!S.unavailable.has(S.tracks[i].song.id) && !S.dislikes.has(S.tracks[i].song.id)) break;
    }
    playIndex(i);
  }

  function togglePlay() {
    if (!currentSong()) { playIndex(0); return; }
    player.toggle();
  }

  function showNow(s, t) {
    setAccent(s.g);
    $('#playerBar').hidden = false;
    document.documentElement.style.setProperty('--pb-h', $('#playerBar').offsetHeight + 'px');
    $('#pbTitle').textContent = s.t;
    $('#pbArtist').textContent = s.a;
    $('#nowEyebrow').textContent = S.oneOff ? 'Descubrimiento · Audius' : `Sonando · ${S.current + 1} de ${S.tracks.length}`;
    $('#nowTitle').textContent = s.t;
    $('#nowArtist').textContent = `${s.a}${s.y ? ' · ' + s.y : ''}`;
    const chips = [];
    if (GENRES[s.g]) chips.push(`<span class="tag g" style="--gc:${GENRES[s.g].color}">${GENRES[s.g].name}</span>`);
    if (s.bpm) chips.push(`<span class="tag">${s.bpm} BPM</span>`);
    if (t) chips.push(`<span class="tag">${I('sparkles')} ${t.match}% contigo</span>`);
    if (t) t.reasons.slice(0, 2).forEach(r => chips.push(`<span class="tag">${esc(r)}</span>`));
    chips.push('<span class="tag src-tag" id="srcTag"></span>');
    $('#nowChips').innerHTML = chips.join('');
    fillSource(s, player.state.engine);
    setArt(s);
  }

  function setArt(s) {
    const art = S.artwork[s.id] || s.art || '';
    const css = art ? `url('${art}')` : '';
    $('#vinylArt').style.backgroundImage = css;
    $('#pbCover').style.backgroundImage = css;
  }

  // Video de YouTube visible cuando suena desde YouTube; vinilo en los demás casos.
  function showMedia(engineName) {
    const video = engineName === 'yt';
    $('#videoWrap').hidden = !video;
    $('#vinyl').hidden = video;
    $('#stage').classList.toggle('has-video', video);
  }

  const SRC_INFO = {
    yt: { label: 'YouTube · canción completa', link: 'Ver en YouTube', icon: 'youtube' },
    sc: { label: 'SoundCloud', link: 'Abrir en SoundCloud', icon: 'radio-tower' },
    audio: { label: 'Audius · canción completa', link: 'Abrir en Audius', icon: 'radio-tower' },
    demo: { label: 'Modo demo (sin audio)', link: 'Abrir original', icon: 'info' },
  };

  function fillSource(track, eng) {
    if (!track) return;
    const info = SRC_INFO[eng] || SRC_INFO.demo;
    const href = eng === 'yt' ? ytUrl(track.yt) : eng === 'sc' ? track.sc : eng === 'audio' ? track.url : linkOf(track);
    $('#openScBtn').href = href;
    $('#openSrcTxt').textContent = info.link;
    $('#openSrcIco').innerHTML = I(info.icon);
    const tag = $('#srcTag');
    if (tag) tag.innerHTML = `${I(info.icon)} ${info.label}`;
  }

  player.on('load', ({ track, engine: eng }) => {
    showMedia(eng);
    fillSource(track, eng);
    if (eng === 'sc') $('#scDock').open = true;      // el widget de SoundCloud queda visible
  });

  player.on('ready', info => {
    const st = $('#scStatus');
    const txt = st.querySelector('.txt');
    if (info.demo) {
      st.className = 'chip chip-status demo';
      txt.textContent = 'Modo demo (sin audio)';
      st.title = `${info.reason}. La interfaz y el visualizador funcionan; el audio necesita acceso a youtube.com o soundcloud.com.`;
      toast(`${info.reason}. Entro en <b>modo demo</b>: todo funciona, pero sin audio.`, 6500, 'triangle-alert');
    } else {
      st.className = 'chip chip-status ok';
      txt.textContent = info.yt && info.sc ? 'YouTube + SoundCloud listos' : info.yt ? 'YouTube listo' : 'Sólo SoundCloud';
      if (!info.yt) toast('YouTube no cargó; uso SoundCloud. Ahí algunas canciones de disquera sólo suenan 30 s.', 6000, 'triangle-alert');
    }
  });
  player.on('notice', n => {
    const name = n.track ? `<b>${esc(n.track.t)}</b>` : 'Esta canción';
    if (n.kind === 'yt-error') toast(`YouTube no permite reproducir ${name} aquí (región o restricción del canal). Intento con SoundCloud.`, 5000, 'triangle-alert');
    if (n.kind === 'snip-to-yt') toast(`SoundCloud sólo da una vista previa de 30 s de ${name}; la paso a YouTube completa.`, 5000, 'youtube');
    if (n.kind === 'snip') toast(`SoundCloud sólo ofrece una vista previa de ~30 s de ${name} (política de la disquera). Cambia la fuente a YouTube para oírla completa.`, 6500, 'info');
  });
  player.on('play', () => {
    document.body.classList.add('is-playing');
    $('#vinyl').classList.add('spinning');
    $('#playAllBtn span').textContent = 'Pausar';
    syncBg();
  });
  player.on('pause', () => {
    document.body.classList.remove('is-playing');
    $('#vinyl').classList.remove('spinning');
    $('#playAllBtn span').textContent = 'Reproducir';
  });
  player.on('finish', () => {
    document.body.classList.remove('is-playing');
    if (S.oneOff) return;
    nextTrack(1);
  });
  player.on('progress', st => {
    const pct = st.dur ? Math.min(100, (st.pos / st.dur) * 100) : 0;
    $('#pbFill').style.width = pct + '%';
    $('#pbKnob').style.left = pct + '%';
    $('#pbTime').textContent = `${fmt(st.pos)} / ${fmt(st.dur)}`;
  });
  player.on('sound', ({ artwork }) => {
    const s = currentSong();
    if (!s || !artwork || S.artwork[s.id]) return;
    S.artwork[s.id] = artwork;
    setArt(s);
  });
  player.on('unavailable', track => {
    if (!track) return;
    S.unavailable.add(track.id);
    updateTrackStates();
    toast(`<b>${esc(track.t)}</b> no está disponible ahora en ninguna fuente. Paso a la siguiente.`, 4500, 'triangle-alert');
    if (!S.oneOff) setTimeout(() => nextTrack(1), 1200);
  });
  player.on('stalled', () => {
    toast('Tu navegador pausó la reproducción automática. Pulsa <b>reproducir</b> para empezar.', 4500, 'play');
  });

  $('#pbPlay').addEventListener('click', togglePlay);
  $('#playAllBtn').addEventListener('click', togglePlay);
  $('#pbNext').addEventListener('click', () => nextTrack(1));
  $('#pbPrev').addEventListener('click', () => {
    if (player.state.pos > 4000) player.seek(0); else nextTrack(-1);
  });
  $('#pbVol').addEventListener('input', e => player.setVolume(+e.target.value));
  $('#pbProgress').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    player.seek(((e.clientX - r.left) / r.width) * (player.state.dur || 0));
  });

  // Fuente de audio: YouTube (completa) o SoundCloud.
  function syncSourceButtons() {
    $$('.seg [data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === player.state.source)));
  }
  $$('.seg [data-src]').forEach(b => b.addEventListener('click', () => {
    player.setSource(b.dataset.src);
    syncSourceButtons();
    if (!S.oneOff && S.current >= 0) playIndex(S.current);
    if (b.dataset.src === 'sc') toast('SoundCloud: en canciones de disquera puede dar sólo 30 s. Si pasa, la app cambia sola a YouTube.', 5000, 'info');
  }));
  syncSourceButtons();

  /* ---------------------------- visualizador ---------------------------- */
  viz.attach($('#vizCanvas'), () => {
    const s = currentSong();
    return {
      playing: player.state.playing,
      engine: player.state.engine,
      pos: player.state.pos,
      bpm: (s && s.bpm) || 110,
      energy: s && s.e != null ? s.e : 0.6,
      dance: s && s.dn != null ? s.dn : 0.6,
    };
  });
  const miniBars = $$('#miniEq i');
  const root = document.documentElement;
  viz.subscribe((v, evt) => {
    if (evt === 'real-off') { setRealBtn(false); return; }
    root.style.setProperty('--lvl', v.level.toFixed(3));
    miniBars.forEach((b, i) => {
      const k = Math.floor((i / miniBars.length) * viz.BARS * 0.8);
      b.style.transform = `scaleY(${Math.max(0.08, (v.left[k] + v.right[k]) / 2).toFixed(3)})`;
    });
  });

  function setRealBtn(on) {
    const b = $('#realAudioBtn');
    b.classList.toggle('is-on', on);
    b.querySelector('span').textContent = on ? 'Audio real activo' : 'Barras con audio real';
  }
  $('#realAudioBtn').addEventListener('click', async () => {
    if (viz.isReal) { viz.disableRealAudio(); setRealBtn(false); return; }
    toast('Elige <b>esta pestaña</b> y activa <b>"Compartir audio de la pestaña"</b>. Así las barras leen el espectro real (L/R).', 6000, 'sliders-vertical');
    try {
      await viz.enableRealAudio();
      setRealBtn(true);
      toast('Visualizador conectado al audio real.', 3500, 'check');
    } catch (err) {
      setRealBtn(false);
      if (err && err.name !== 'NotAllowedError') toast('No se pudo capturar el audio: ' + esc(err.message || err), 5000, 'triangle-alert');
    }
  });

  /* ---------------------------- exportar ---------------------------- */
  const exportMenu = $('#exportMenu');
  $('#exportBtn').addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.hidden = !exportMenu.hidden;
    $('#exportBtn').setAttribute('aria-expanded', !exportMenu.hidden);
  });
  document.addEventListener('click', () => { exportMenu.hidden = true; $('#exportBtn').setAttribute('aria-expanded', 'false'); });

  function playlistText() {
    const head = `SonIA · Mi playlist (${S.tracks.length} canciones, ${Math.round(S.result.totalSec / 60)} min)\n\n`;
    return head + S.tracks.map((t, i) => {
      const s = t.song;
      return `${i + 1}. ${s.t} — ${s.a}\n   YouTube: ${s.yt ? ytUrl(s.yt) : '—'}\n   SoundCloud: ${s.sc}`;
    }).join('\n');
  }

  // YouTube arma una lista temporal con los IDs (sin cuenta ni llave).
  $('#ytListBtn').addEventListener('click', () => {
    const ids = S.tracks.map(t => t.song.yt).filter(Boolean).slice(0, 50);
    if (!ids.length) return;
    window.open('https://www.youtube.com/watch_videos?video_ids=' + ids.join(','), '_blank', 'noopener');
  });
  $('#copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(playlistText()); toast('Enlaces copiados (YouTube y SoundCloud).', 3500, 'clipboard'); }
    catch (e) { toast('No se pudo copiar automáticamente; usa "Descargar playlist".', 4000, 'triangle-alert'); }
  });
  $('#downloadBtn').addEventListener('click', () => {
    const blob = new Blob([playlistText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sonia-playlist.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#saveScBtn').addEventListener('click', () => saveToSoundCloud());

  async function saveToSoundCloud() {
    if (!api.enabled) {
      toast('Guardar en tu cuenta de SoundCloud necesita el <b>backend opcional</b> (el API exige un secreto que no puede ir en una página pública). Mientras, usa <b>Abrir como lista en YouTube</b> o <b>Copiar enlaces</b>.', 8000, 'cloud-upload');
      return;
    }
    if (!api.session()) {
      store.set('sonia.pendingSave', '1');
      save();
      api.login(location.href.split('#')[0]);
      return;
    }
    try {
      toast('Guardando en tu SoundCloud…', 3000, 'cloud-upload');
      const title = S.mode === 'emotion' ? `SonIA · ${engine.MOODS[S.profile.mood].label}` : 'SonIA · Mi playlist';
      const r = await api.savePlaylist(title, 'Playlist creada por la IA de SonIA', S.tracks.map(t => t.song.sc));
      toast(`Playlist guardada (${r.added} canciones). <a href="${esc(r.url)}" target="_blank" rel="noopener">Ábrela en SoundCloud</a>`, 9000, 'check');
    } catch (e) {
      if (e.status === 401) { api.forget(); toast('Tu sesión de SoundCloud expiró; vuelve a intentarlo.', 4000, 'triangle-alert'); }
      else toast('No se pudo guardar: ' + esc(e.message), 5000, 'triangle-alert');
    }
  }

  /* ---------------------- descubrir (Audius, sin llave) ---------------------- */
  // Emociones del perfil → "moods" que usan los artistas en Audius.
  const AUDIUS_MOODS = {
    calma: ['Peaceful', 'Tender', 'Easygoing'], feliz: ['Upbeat', 'Excited', 'Cool'], nostalgia: ['Sentimental', 'Melancholy', 'Yearning'],
    motivacion: ['Empowering', 'Fiery', 'Excited'], desahogo: ['Melancholy', 'Brooding', 'Sentimental'], romance: ['Romantic', 'Sensual', 'Tender'],
    adrenalina: ['Aggressive', 'Energizing', 'Fiery'], foco: ['Peaceful', 'Easygoing', 'Cool'],
  };

  $('#discoverBtn').addEventListener('click', async () => {
    const g = Object.keys(S.profile.genres)[0] || (S.tracks[0] && S.tracks[0].song.g) || 'pop';
    const moods = Object.keys(S.profile.emo).flatMap(e => AUDIUS_MOODS[e] || []);
    const list = $('#discoverList');
    list.innerHTML = '<li class="muted">Buscando en Audius…</li>';
    try {
      const tracks = await audius.search(g, moods, 8);
      list.innerHTML = '';
      tracks.forEach((t, i) => {
        const song = {
          id: 'au' + t.id, t: t.title, a: t.user, g, y: '', bpm: t.bpm || 110, e: 0.6, dn: 0.6,
          dur: t.duration, audio: t.stream, url: t.url, art: t.artwork,
        };
        const li = document.createElement('li');
        li.className = 'track';
        li.style.setProperty('--gc', GENRES[g].color);
        li.style.setProperty('--i', i);
        li.innerHTML = `<span class="t-num">${i + 1}</span>
          <div class="t-cover" style="${t.artwork ? `background-image:url('${esc(t.artwork)}')` : ''}">${t.artwork ? '' : initials(t.user || '?')}</div>
          <div class="t-main"><div class="t-title">${esc(t.title)}</div><div class="t-artist">${esc(t.user)}${t.plays ? ' · ' + t.plays.toLocaleString('es-MX') + ' reproducciones' : ''}</div>
          <div class="t-reasons"><span class="tag">${I('audio-waveform')} espectro real</span>${t.mood ? `<span class="tag">${esc(t.mood)}</span>` : ''}</div></div>
          <div class="t-side"><a class="mini-btn ext" href="${esc(t.url)}" target="_blank" rel="noopener" title="Abrir en Audius" aria-label="Abrir en Audius">${I('external-link')}</a></div>`;
        li.addEventListener('click', e => { if (!e.target.closest('.mini-btn')) playOneOff(song); });
        list.appendChild(li);
      });
      if (!list.children.length) list.innerHTML = '<li class="muted">Sin resultados.</li>';
    } catch (e) {
      list.innerHTML = `<li class="muted">No se pudo buscar en Audius: ${esc(e.message)}</li>`;
    }
  });

  /* ---------------------------- navegación ---------------------------- */
  $$('[data-start]').forEach(b => b.addEventListener('click', () => startQuiz(b.dataset.start)));
  $$('[data-go="home"]').forEach(b => b.addEventListener('click', () => go('home')));

  function resume() {
    const d = loadSaved();
    if (!d) return false;
    S.mode = d.mode; S.answers = d.answers || {}; S.profile = d.profile;
    S.likes = new Set(d.likes || []); S.dislikes = new Set(d.dislikes || []);
    S.result = engine.recommend(S.profile, { pinned: d.trackIds || [] });
    showResults();
    return true;
  }
  $('#resumeBtn').addEventListener('click', resume);

  player.init({ ytEl: 'ytPlayer', scFrame: $('#scFrame'), audioEl: $('#audioEl'), firstScUrl: CATALOG[0].sc });
  go('home');

  // Si volvimos del login de SoundCloud con una playlist pendiente de guardar.
  if (api.enabled && api.session() && store.get('sonia.pendingSave')) {
    store.del('sonia.pendingSave');
    if (resume()) setTimeout(saveToSoundCloud, 800);
  }
  if (api.enabled) {
    api.health().then(h => {
      if (!h) toast('El backend de SoundCloud configurado no responde; sigo en modo GitHub Pages.', 5000, 'triangle-alert');
    });
  }
})();
