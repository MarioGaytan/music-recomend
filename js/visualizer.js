/* =========================================================================
   Visualizador estéreo (canal izquierdo ← centro → canal derecho).

   - Modo "sincronizado": el audio de SoundCloud vive en un iframe de otro
     dominio, así que el navegador no deja leer sus frecuencias. Las barras
     se generan con el BPM, la energía y la posición real de la canción
     (bombo en cada tiempo, caja en 2 y 4, hi-hats en contratiempos).
   - Modo "audio real": el usuario comparte el audio de la pestaña y un
     AnalyserNode (Web Audio) lee el espectro real de cada canal.
   ========================================================================= */
(function () {
  const BARS = 40;            // por canal
  const viz = {
    canvas: null, ctx: null, dpr: 1,
    left: new Float32Array(BARS), right: new Float32Array(BARS),
    peakL: new Float32Array(BARS), peakR: new Float32Array(BARS),
    color: '#3df5ff', color2: '#ff5fa2',
    getState: null,           // () => { playing, pos(ms), bpm, energy, dance }
    real: null,               // { analyserL, analyserR, bufL, bufR, stream }
    level: 0,                 // nivel global (para pulsos de UI)
    subscribers: [],
  };

  // Ruido suave determinista (suma de senos) para que no se vea aleatorio.
  function smoothNoise(i, t, seed) {
    return (
      Math.sin(t * 1.7 + i * 0.9 + seed) * 0.5 +
      Math.sin(t * 3.1 + i * 0.37 + seed * 2.1) * 0.3 +
      Math.sin(t * 5.3 + i * 1.3 + seed * 0.7) * 0.2
    ) * 0.5 + 0.5;
  }

  function simulate(out, st, t, seed) {
    const beat = (st.pos / 1000) * (st.bpm / 60);
    const ph = beat % 1;
    const kick = Math.exp(-ph * 7);
    const snare = Math.floor(beat) % 2 === 1 ? Math.exp(-ph * 9) : 0;
    const hat = Math.exp(-((beat * 2) % 1) * 12);
    const e = 0.55 + st.energy * 0.6;
    for (let i = 0; i < BARS; i++) {
      const f = i / (BARS - 1);                     // 0 = graves, 1 = agudos
      const n = smoothNoise(i, t * (0.8 + st.energy), seed);
      let v;
      if (f < 0.18) v = kick * (0.75 + st.dance * 0.35) + n * 0.25;
      else if (f < 0.55) v = n * 0.55 + snare * 0.45 * (1 - Math.abs(f - 0.35) * 2) + kick * 0.15;
      else v = hat * 0.45 * st.energy + n * 0.4 * (1.15 - f);
      out[i] = Math.min(1, v * e * (1 - f * 0.25));
    }
  }

  function idle(out, t, seed) {
    for (let i = 0; i < BARS; i++) {
      out[i] = 0.05 + 0.06 * (Math.sin(t * 1.4 + i * 0.35 + seed) * 0.5 + 0.5);
    }
  }

  function fromAnalyser(out, analyser, buf) {
    analyser.getByteFrequencyData(buf);
    const n = buf.length;
    // Escala logarítmica: más barras para los graves (como un ecualizador real).
    for (let i = 0; i < BARS; i++) {
      const a = Math.floor(Math.pow(i / BARS, 2.0) * n * 0.7);
      const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BARS, 2.0) * n * 0.7));
      let s = 0;
      for (let k = a; k < b; k++) s += buf[k];
      out[i] = Math.min(1, (s / (b - a)) / 255 * 1.15);
    }
  }

  const target = { L: new Float32Array(BARS), R: new Float32Array(BARS) };

  function frame(ts) {
    const t = ts / 1000;
    const st = viz.getState ? viz.getState() : { playing: false };
    const live = viz.real || (st.engine === 'audio' && viz.media);
    if (live) {
      fromAnalyser(target.L, live.analyserL, live.bufL);
      fromAnalyser(target.R, live.analyserR, live.bufR);
    } else if (st.playing) {
      simulate(target.L, st, t, 0.0);
      simulate(target.R, st, t + 0.11, 1.7);
    } else {
      idle(target.L, t, 0); idle(target.R, t, 2);
    }
    let lvl = 0;
    for (let i = 0; i < BARS; i++) {
      // Ataque rápido, caída lenta: como los vúmetros de un estéreo.
      viz.left[i] += (target.L[i] - viz.left[i]) * (target.L[i] > viz.left[i] ? 0.55 : 0.14);
      viz.right[i] += (target.R[i] - viz.right[i]) * (target.R[i] > viz.right[i] ? 0.55 : 0.14);
      viz.peakL[i] = Math.max(viz.peakL[i] - 0.008, viz.left[i]);
      viz.peakR[i] = Math.max(viz.peakR[i] - 0.008, viz.right[i]);
      lvl += viz.left[i] + viz.right[i];
    }
    viz.level = lvl / (BARS * 2);
    draw();
    viz.subscribers.forEach(cb => cb(viz));
    requestAnimationFrame(frame);
  }

  function resize() {
    const c = viz.canvas;
    if (!c) return;
    viz.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * viz.dpr));
    c.height = Math.max(1, Math.round(r.height * viz.dpr));
  }

  function draw() {
    const c = viz.canvas, ctx = viz.ctx;
    if (!c || !ctx) return;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const mid = W / 2;
    const gap = Math.max(1, W * 0.0035);
    const bw = (mid - gap * BARS) / BARS;
    const base = H * 0.78;            // línea base; debajo va el reflejo
    const maxH = base * 0.94;

    const grad = ctx.createLinearGradient(0, base, 0, base - maxH);
    grad.addColorStop(0, viz.color);
    grad.addColorStop(0.65, viz.color2);
    grad.addColorStop(1, '#ffffff');

    for (const side of [-1, 1]) {
      const vals = side < 0 ? viz.left : viz.right;
      const peaks = side < 0 ? viz.peakL : viz.peakR;
      for (let i = 0; i < BARS; i++) {
        const x = side < 0 ? mid - (i + 1) * (bw + gap) : mid + i * (bw + gap) + gap;
        const h = Math.max(2 * viz.dpr, vals[i] * maxH);
        // Barra segmentada (estilo LED)
        ctx.fillStyle = grad;
        const seg = 5 * viz.dpr, sgap = 2 * viz.dpr;
        for (let y = 0; y < h; y += seg + sgap) {
          ctx.fillRect(x, base - y - seg, bw, Math.min(seg, h - y));
        }
        // Pico que cae despacio
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.fillRect(x, base - peaks[i] * maxH - 3 * viz.dpr, bw, 2 * viz.dpr);
        // Reflejo
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(x, base + 3 * viz.dpr, bw, h * 0.22);
      }
    }
    // Etiquetas de canal
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = `${10 * viz.dpr}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('L', 4 * viz.dpr, H - 6 * viz.dpr);
    ctx.textAlign = 'right'; ctx.fillText('R', W - 4 * viz.dpr, H - 6 * viz.dpr);
  }

  function attach(canvas, getState) {
    viz.canvas = canvas;
    viz.ctx = canvas.getContext('2d');
    viz.getState = getState;
    resize();
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    requestAnimationFrame(frame);
  }

  function setColors(a, b) { viz.color = a; viz.color2 = b; }

  // Audio real: el usuario comparte esta pestaña "con audio".
  async function enableRealAudio() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Tu navegador no permite capturar el audio de la pestaña.');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include',
    });
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('No se compartió audio. Marca "Compartir audio de la pestaña".');
    }
    stream.getVideoTracks().forEach(t => t.stop()); // sólo necesitamos el audio
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const split = ac.createChannelSplitter(2);
    const mk = () => { const a = ac.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.6; return a; };
    const analyserL = mk(), analyserR = mk();
    src.connect(split);
    split.connect(analyserL, 0);
    split.connect(analyserR, 1);
    viz.real = {
      analyserL, analyserR, stream, ac,
      bufL: new Uint8Array(analyserL.frequencyBinCount),
      bufR: new Uint8Array(analyserR.frequencyBinCount),
    };
    stream.getAudioTracks()[0].addEventListener('ended', disableRealAudio);
    return true;
  }

  // Audio directo (Audius): se conecta una sola vez el <audio> a dos analizadores L/R.
  function useMediaElement(el) {
    if (viz.media || !el) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaElementSource(el);
    const split = ac.createChannelSplitter(2);
    const mk = () => { const a = ac.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.6; return a; };
    const analyserL = mk(), analyserR = mk();
    src.connect(split); split.connect(analyserL, 0); split.connect(analyserR, 1);
    src.connect(ac.destination);
    viz.media = {
      ac, analyserL, analyserR,
      bufL: new Uint8Array(analyserL.frequencyBinCount),
      bufR: new Uint8Array(analyserR.frequencyBinCount),
    };
  }
  function resumeMedia() { if (viz.media && viz.media.ac.state === 'suspended') viz.media.ac.resume(); }

  function disableRealAudio() {
    if (!viz.real) return;
    viz.real.stream.getTracks().forEach(t => t.stop());
    viz.real.ac.close();
    viz.real = null;
    viz.subscribers.forEach(cb => cb(viz, 'real-off'));
  }

  function subscribe(cb) { viz.subscribers.push(cb); }

  window.SR = window.SR || {};
  window.SR.viz = {
    attach, setColors, enableRealAudio, disableRealAudio, subscribe, useMediaElement, resumeMedia,
    get isReal() { return !!viz.real; },
    get level() { return viz.level; },
    bars: viz,
    BARS,
  };
})();
