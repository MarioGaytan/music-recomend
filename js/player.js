/* =========================================================================
   Reproductor: envuelve el Widget API de SoundCloud (no requiere llaves).
   https://developers.soundcloud.com/docs/api/html5-widget

   Si SoundCloud no carga (red bloqueada, sin internet), pasa a "modo demo":
   un reloj simulado para que la interfaz y el visualizador sigan funcionando.
   ========================================================================= */
(function () {
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach(cb => cb(data));

  const state = {
    ready: false, demo: false, playing: false,
    pos: 0, dur: 0, volume: 80,
    track: null, sound: null,
  };

  let iframe = null, widget = null, loadToken = 0, stallTimer = null;
  let demoTimer = null, demoLast = 0;

  function widgetSrc(url) {
    const q = new URLSearchParams({
      url, auto_play: 'false', visual: 'false', show_comments: 'false',
      hide_related: 'true', show_teaser: 'false', show_reposts: 'false',
      show_user: 'true', color: '#ff5500',
    });
    return 'https://w.soundcloud.com/player/?' + q.toString();
  }

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

  async function init(iframeEl, firstUrl) {
    iframe = iframeEl;
    try {
      await loadScript('https://w.soundcloud.com/player/api.js', 7000);
      if (!window.SC || !window.SC.Widget) throw new Error('sin SC');
    } catch (e) {
      enterDemo('No se pudo conectar con SoundCloud');
      return;
    }
    iframe.src = widgetSrc(firstUrl);
    widget = window.SC.Widget(iframe);
    const E = window.SC.Widget.Events;

    const readyTimer = setTimeout(() => { if (!state.ready) enterDemo('SoundCloud no respondió'); }, 12000);
    widget.bind(E.READY, () => {
      clearTimeout(readyTimer);
      state.ready = true;
      widget.setVolume(state.volume);
      emit('ready', { demo: false });
    });
    widget.bind(E.PLAY, () => { clearTimeout(stallTimer); state.playing = true; emit('play'); refreshSound(); });
    widget.bind(E.PAUSE, () => { state.playing = false; emit('pause'); });
    widget.bind(E.FINISH, () => { state.playing = false; emit('finish'); });
    widget.bind(E.PLAY_PROGRESS, d => {
      state.pos = d.currentPosition;
      if (d.relativePosition > 0) state.dur = d.currentPosition / d.relativePosition;
      emit('progress', state);
    });
    widget.bind(E.ERROR, () => emit('unavailable', state.track));
  }

  function refreshSound() {
    if (!widget) return;
    widget.getCurrentSound(sound => {
      state.sound = sound || null;
      if (sound && sound.duration) state.dur = sound.duration;
      emit('sound', sound);
    });
  }

  function enterDemo(reason) {
    state.demo = true; state.ready = true;
    emit('ready', { demo: true, reason });
  }

  function load(track, autoplay = true) {
    state.track = track;
    state.pos = 0;
    state.dur = (track.dur || 200) * 1000;
    state.sound = null;
    const token = ++loadToken;
    emit('load', track);

    if (state.demo) {
      if (autoplay) play(); else emit('progress', state);
      return;
    }
    if (!widget || !state.ready) return;

    widget.load(track.sc, {
      auto_play: autoplay, visual: false, show_comments: false, hide_related: true,
      show_teaser: false, show_reposts: false, color: '#ff5500',
      callback: () => {
        if (token !== loadToken) return;
        widget.setVolume(state.volume);
        widget.getCurrentSound(sound => {
          if (token !== loadToken) return;
          if (!sound) { emit('unavailable', track); return; }
          state.sound = sound;
          if (sound.duration) state.dur = sound.duration;
          emit('sound', sound);
          if (autoplay) {
            widget.play();
            // Si el navegador bloquea el autoplay, avisa para que el usuario dé clic.
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => { if (token === loadToken && !state.playing) emit('stalled', track); }, 4000);
          }
        });
      },
    });
  }

  /* ---------------- modo demo (reloj simulado, sin audio) ---------------- */
  function demoTick() {
    const now = performance.now();
    state.pos += now - demoLast;
    demoLast = now;
    if (state.pos >= state.dur) {
      state.pos = state.dur;
      stopDemo();
      state.playing = false;
      emit('finish');
      return;
    }
    emit('progress', state);
  }
  function stopDemo() { clearInterval(demoTimer); demoTimer = null; }

  function play() {
    if (state.demo) {
      if (demoTimer) return;
      demoLast = performance.now();
      demoTimer = setInterval(demoTick, 200);
      state.playing = true; emit('play');
      return;
    }
    widget && widget.play();
  }
  function pause() {
    if (state.demo) { stopDemo(); state.playing = false; emit('pause'); return; }
    widget && widget.pause();
  }
  function toggle() { state.playing ? pause() : play(); }
  function seek(ms) {
    state.pos = ms;
    if (state.demo) { emit('progress', state); return; }
    widget && widget.seekTo(ms);
  }
  function setVolume(v) {
    state.volume = v;
    if (widget && !state.demo) widget.setVolume(v);
  }

  function on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); }

  window.SR = window.SR || {};
  window.SR.player = { init, load, play, pause, toggle, seek, setVolume, on, state };
})();
