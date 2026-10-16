/* =========================================================================
   Reproductor con tres fuentes legales y gratuitas:

   1. YouTube IFrame Player API (principal): canción completa desde el video
      oficial. No necesita llave. El reproductor se muestra visible (≥200 px),
      como piden los términos de YouTube.
      https://developers.google.com/youtube/iframe_api_reference
   2. SoundCloud Widget API (respaldo): si YouTube no deja reproducir el video
      en tu país. OJO: en canciones de disqueras SoundCloud sólo da una vista
      previa de ~30 s a quien no tiene SoundCloud Go+ ("policy: SNIP").
      https://developers.soundcloud.com/docs/api/html5-widget
   3. Audio HTML5 (Audius): canciones completas que los propios artistas suben
      a Audius. Como es audio directo, el visualizador lee el espectro real.

   Si nada carga (red bloqueada), entra en "modo demo" con un reloj simulado.
   ========================================================================= */
(function () {
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach(cb => cb(data));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };

  const state = {
    engine: null,               // 'yt' | 'sc' | 'audio' | 'demo'
    source: store.get('sonia.source') === 'sc' ? 'sc' : 'yt',
    ytReady: false, scReady: false, demo: false,
    playing: false, pos: 0, dur: 0, volume: 80,
    track: null, sound: null,
  };

  let yt = null, sc = null, scFrame = null, audio = null;
  let loadToken = 0, pollTimer = null, stallTimer = null, demoTimer = null, demoLast = 0;
  let triedSc = false, triedYt = false;

  function loadScript(src, timeoutMs) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      s.src = src; s.async = true;
      s.onload = () => { clearTimeout(t); resolve(); };
      s.onerror = () => { clearTimeout(t); reject(new Error('error')); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------ YouTube ------------------------------ */
  function initYouTube(el) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 9000);
      window.onYouTubeIframeAPIReady = () => {
        const vars = { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3 };
        if (/^https?:/.test(location.protocol)) vars.origin = location.origin;
        yt = new window.YT.Player(el, {
          width: '100%', height: '100%', playerVars: vars,
          events: {
            onReady: () => { clearTimeout(timer); state.ytReady = true; yt.setVolume(state.volume); resolve(true); },
            onStateChange: onYtState,
            onError: onYtError,
          },
        });
      };
      loadScript('https://www.youtube.com/iframe_api', 8000).catch(() => { clearTimeout(timer); resolve(false); });
    });
  }

  function onYtState(e) {
    if (state.engine !== 'yt') return;
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      clearTimeout(stallTimer);
      state.playing = true;
      emit('play');
      startPoll();
    } else if (e.data === S.PAUSED) {
      state.playing = false; emit('pause');
    } else if (e.data === S.ENDED) {
      state.playing = false; stopPoll(); emit('finish');
    }
  }

  // 2 = id inválido, 5 = error HTML5, 100 = no existe, 101/150 = no se permite insertar.
  function onYtError(e) {
    if (state.engine !== 'yt') return;
    const t = state.track;
    emit('notice', { kind: 'yt-error', code: e.data, track: t });
    if (t && t.sc && state.scReady && !triedSc) { triedSc = true; playOn('sc', t, true); }
    else emit('unavailable', t);
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(() => {
      if (state.engine !== 'yt' || !yt || !yt.getCurrentTime) return;
      state.pos = yt.getCurrentTime() * 1000;
      const d = yt.getDuration() * 1000;
      if (d) state.dur = d;
      emit('progress', state);
    }, 250);
  }
  function stopPoll() { clearInterval(pollTimer); pollTimer = null; }

  /* ------------------------------ SoundCloud ------------------------------ */
  function scSrc(url) {
    const q = new URLSearchParams({
      url, auto_play: 'false', visual: 'false', show_comments: 'false', hide_related: 'true',
      show_teaser: 'false', show_reposts: 'false', color: '#ff5500',
    });
    return 'https://w.soundcloud.com/player/?' + q.toString();
  }

  async function initSoundCloud(frame, firstUrl) {
    scFrame = frame;
    try {
      await loadScript('https://w.soundcloud.com/player/api.js', 7000);
      if (!window.SC || !window.SC.Widget) throw new Error('sin SC');
    } catch (e) { return false; }
    frame.src = scSrc(firstUrl);
    sc = window.SC.Widget(frame);
    const E = window.SC.Widget.Events;
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 12000);
      sc.bind(E.READY, () => { clearTimeout(timer); state.scReady = true; sc.setVolume(state.volume); resolve(true); });
      sc.bind(E.PLAY, () => { if (state.engine !== 'sc') return; clearTimeout(stallTimer); state.playing = true; emit('play'); });
      sc.bind(E.PAUSE, () => { if (state.engine !== 'sc') return; state.playing = false; emit('pause'); });
      sc.bind(E.FINISH, () => { if (state.engine !== 'sc') return; state.playing = false; emit('finish'); });
      sc.bind(E.PLAY_PROGRESS, d => {
        if (state.engine !== 'sc') return;
        state.pos = d.currentPosition;
        emit('progress', state);
      });
      sc.bind(E.ERROR, () => { if (state.engine === 'sc') scFailed(); });
    });
  }

  function scFailed() {
    const t = state.track;
    if (t && t.yt && state.ytReady && !triedYt) { triedYt = true; playOn('yt', t, true); }
    else emit('unavailable', t);
  }

  function loadSc(track, autoplay, token) {
    sc.load(track.sc, {
      auto_play: autoplay, visual: false, show_comments: false, hide_related: true,
      show_teaser: false, show_reposts: false, color: '#ff5500',
      callback: () => {
        if (token !== loadToken) return;
        sc.setVolume(state.volume);
        sc.getCurrentSound(sound => {
          if (token !== loadToken) return;
          if (!sound) { scFailed(); return; }
          state.sound = sound;
          state.dur = sound.duration || state.dur;
          emit('sound', { artwork: sound.artwork_url ? sound.artwork_url.replace('-large', '-t500x500') : null });
          // Vista previa de disquera (~30 s): si hay video oficial, mejor usarlo.
          const isPreview = sound.policy === 'SNIP' || (sound.full_duration && sound.duration && sound.duration < sound.full_duration - 1000);
          if (isPreview) {
            if (track.yt && state.ytReady && !triedYt) {
              emit('notice', { kind: 'snip-to-yt', track });
              triedYt = true; playOn('yt', track, true); return;
            }
            emit('notice', { kind: 'snip', track });
          }
          if (autoplay) {
            sc.play();
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => { if (token === loadToken && !state.playing) emit('stalled', track); }, 4000);
          }
        });
      },
    });
  }

  /* ------------------------------ Audio HTML5 ------------------------------ */
  function initAudio(el) {
    audio = el;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.addEventListener('play', () => { if (state.engine === 'audio') { state.playing = true; emit('play'); } });
    audio.addEventListener('pause', () => { if (state.engine === 'audio') { state.playing = false; emit('pause'); } });
    audio.addEventListener('ended', () => { if (state.engine === 'audio') { state.playing = false; emit('finish'); } });
    audio.addEventListener('timeupdate', () => {
      if (state.engine !== 'audio') return;
      state.pos = audio.currentTime * 1000;
      if (isFinite(audio.duration)) state.dur = audio.duration * 1000;
      emit('progress', state);
    });
    audio.addEventListener('error', () => { if (state.engine === 'audio') emit('unavailable', state.track); });
  }

  /* ------------------------------ Demo ------------------------------ */
  function demoTick() {
    const now = performance.now();
    state.pos += now - demoLast; demoLast = now;
    if (state.pos >= state.dur) { stopDemo(); state.pos = state.dur; state.playing = false; emit('finish'); return; }
    emit('progress', state);
  }
  function stopDemo() { clearInterval(demoTimer); demoTimer = null; }

  /* ------------------------------ API pública ------------------------------ */
  async function init({ ytEl, scFrame: frame, audioEl, firstScUrl }) {
    initAudio(audioEl);
    const [okYt, okSc] = await Promise.all([initYouTube(ytEl), initSoundCloud(frame, firstScUrl)]);
    if (!okYt && !okSc) { state.demo = true; emit('ready', { demo: true, reason: 'No se pudo conectar con YouTube ni con SoundCloud' }); return; }
    emit('ready', { demo: false, yt: okYt, sc: okSc });
  }

  function stopAll(except) {
    stopPoll(); stopDemo();
    clearTimeout(stallTimer);
    if (except !== 'yt' && yt && state.ytReady && yt.pauseVideo) try { yt.pauseVideo(); } catch (e) { /* nada */ }
    if (except !== 'sc' && sc && state.scReady) sc.pause();
    if (except !== 'audio' && audio && !audio.paused) audio.pause();
  }

  function pickEngine(track) {
    if (track.audio) return 'audio';
    if (state.demo) return 'demo';
    const ytOk = track.yt && state.ytReady, scOk = track.sc && state.scReady;
    if (state.source === 'sc' && scOk) return 'sc';
    if (ytOk) return 'yt';
    if (scOk) return 'sc';
    return 'demo';
  }

  function load(track, autoplay = true) {
    triedSc = false; triedYt = false;
    playOn(pickEngine(track), track, autoplay);
  }

  function playOn(engine, track, autoplay) {
    stopAll(engine);
    state.engine = engine;
    state.track = track;
    state.pos = 0;
    state.dur = (track.dur || 200) * 1000;
    state.sound = null;
    state.playing = false;
    const token = ++loadToken;
    emit('load', { track, engine });

    if (engine === 'yt') {
      if (autoplay) yt.loadVideoById(track.yt); else yt.cueVideoById(track.yt);
      yt.setVolume(state.volume);
      if (autoplay) {
        stallTimer = setTimeout(() => { if (token === loadToken && !state.playing) emit('stalled', track); }, 6000);
      }
    } else if (engine === 'sc') {
      loadSc(track, autoplay, token);
    } else if (engine === 'audio') {
      audio.src = track.audio;
      audio.volume = state.volume / 100;
      if (autoplay) audio.play().catch(() => emit('stalled', track));
    } else {
      if (autoplay) play(); else emit('progress', state);
    }
  }

  function play() {
    const e = state.engine;
    if (e === 'yt') yt.playVideo();
    else if (e === 'sc') sc.play();
    else if (e === 'audio') audio.play().catch(() => emit('stalled', state.track));
    else if (e === 'demo') {
      if (demoTimer) return;
      demoLast = performance.now();
      demoTimer = setInterval(demoTick, 200);
      state.playing = true; emit('play');
    }
  }
  function pause() {
    const e = state.engine;
    if (e === 'yt') yt.pauseVideo();
    else if (e === 'sc') sc.pause();
    else if (e === 'audio') audio.pause();
    else if (e === 'demo') { stopDemo(); state.playing = false; emit('pause'); }
  }
  function toggle() { state.playing ? pause() : play(); }
  function seek(ms) {
    state.pos = ms;
    const e = state.engine;
    if (e === 'yt') yt.seekTo(ms / 1000, true);
    else if (e === 'sc') sc.seekTo(ms);
    else if (e === 'audio') audio.currentTime = ms / 1000;
    emit('progress', state);
  }
  function setVolume(v) {
    state.volume = v;
    if (yt && state.ytReady) yt.setVolume(v);
    if (sc && state.scReady) sc.setVolume(v);
    if (audio) audio.volume = v / 100;
  }
  function setSource(src) {
    state.source = src === 'sc' ? 'sc' : 'yt';
    store.set('sonia.source', state.source);
  }

  function on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); }

  window.SR = window.SR || {};
  window.SR.player = {
    init, load, play, pause, toggle, seek, setVolume, setSource, on, state,
    get audioEl() { return audio; },
  };
})();
