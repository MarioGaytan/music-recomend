/* =========================================================================
   Música de fondo ORIGINAL, generada en tiempo real con Web Audio.
   No usa grabaciones de nadie: acordes, bajo, batería, melodía y "ruido de
   vinilo" se sintetizan con osciladores y ruido. Así no hay temas de
   derechos de autor y no se descarga ningún archivo.

   Reacciona al cuestionario:
     - setTempo(bpm)   ← respuesta de ritmo
     - setMood('minor'|'major') ← emociones / ánimo
     - blip()          ← nota corta al elegir una opción
   ========================================================================= */
(function () {
  const BG = {
    ctx: null, master: null, analyser: null, bus: null, echo: null,
    on: false, bpm: 84, mood: 'major', step: 0, nextTime: 0, timer: null,
    crackle: null, freq: null,
  };

  const PROG = {
    // Grados relativos a C4 (MIDI 60). Un acorde por compás.
    major: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]],   // Cmaj7 · Am7 · Fmaj7 · G7
    minor: [[-3, 0, 4, 7], [-7, -3, 0, 4], [0, 4, 7, 11], [-5, -1, 2, 7]],   // Am7 · Fmaj7 · Cmaj7 · G
  };
  const PENTA = { major: [0, 2, 4, 7, 9, 12, 14, 16], minor: [-3, 0, 2, 4, 7, 9, 12, 14] };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function setup() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    BG.ctx = ctx;

    BG.master = ctx.createGain();
    BG.master.gain.value = 0;
    const tone = ctx.createBiquadFilter();       // color "lo-fi"
    tone.type = 'lowpass'; tone.frequency.value = 3800; tone.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    BG.analyser = ctx.createAnalyser();
    BG.analyser.fftSize = 256; BG.analyser.smoothingTimeConstant = 0.75;
    BG.freq = new Uint8Array(BG.analyser.frequencyBinCount);

    BG.bus = ctx.createGain();
    BG.bus.connect(tone); tone.connect(comp); comp.connect(BG.master);
    BG.master.connect(BG.analyser); BG.analyser.connect(ctx.destination);

    // Eco para la melodía
    BG.echo = ctx.createDelay(1);
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.35;
    BG.echo.connect(fb); fb.connect(BG.echo); BG.echo.connect(echoOut); echoOut.connect(BG.bus);
    return true;
  }

  function noiseBuffer(seconds, crackle) {
    const ctx = BG.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = crackle ? (Math.random() < 0.0008 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.015) : Math.random() * 2 - 1;
    }
    return buf;
  }

  function env(g, t, a, peak, r) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }

  /* ---------------------------- instrumentos ---------------------------- */
  function pad(notes, t, dur) {
    const ctx = BG.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.5);
    g.gain.setValueAtTime(0.05, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    f.connect(g); g.connect(BG.bus);
    notes.forEach(n => [-6, 6].forEach(det => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz(48 + n + 12); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.5);
    }));
  }

  function keys(notes, t, vel) {
    const ctx = BG.ctx;
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o2.type = 'triangle';
      o.frequency.value = hz(60 + n); o2.frequency.value = hz(72 + n);
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(BG.bus);
      const tt = t + i * 0.012;                      // acorde "rasgueado"
      env(g, tt, 0.01, 0.06 * vel, 0.9);
      o.start(tt); o2.start(tt); o.stop(tt + 1.1); o2.stop(tt + 1.1);
    });
  }

  function bass(n, t, len) {
    const ctx = BG.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(36 + ((n % 12) + 12) % 12);
    o.connect(g); g.connect(BG.bus);
    env(g, t, 0.02, 0.22, len);
    o.start(t); o.stop(t + len + 0.1);
  }

  function kick(t) {
    const ctx = BG.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    o.connect(g); g.connect(BG.bus);
    env(g, t, 0.005, 0.5, 0.25);
    o.start(t); o.stop(t + 0.35);
  }

  function noiseHit(t, type, freq, peak, len) {
    const ctx = BG.ctx;
    const s = ctx.createBufferSource(); s.buffer = BG.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(BG.bus);
    env(g, t, 0.003, peak, len);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }

  function melody(n, t) {
    const ctx = BG.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(72 + n);
    o.connect(g); g.connect(BG.bus); g.connect(BG.echo);
    env(g, t, 0.01, 0.07, 0.5);
    o.start(t); o.stop(t + 0.6);
  }

  /* ---------------------------- secuenciador ---------------------------- */
  function scheduleStep(step, t) {
    const sixteenth = 60 / BG.bpm / 4;
    const prog = PROG[BG.mood];
    const chord = prog[Math.floor(step / 16) % prog.length];
    const s = step % 16;
    const swing = s % 2 === 1 ? sixteenth * 0.18 : 0;   // swing lo-fi
    const tt = t + swing;

    if (s === 0) { pad(chord, tt, sixteenth * 16); bass(chord[0], tt, sixteenth * 6); }
    if (s === 10) bass(chord[0] + (Math.random() < 0.5 ? 7 : 0), tt, sixteenth * 4);
    if (s === 0 || s === 6 || (s === 11 && Math.random() < 0.6)) keys(chord, tt, s === 0 ? 1 : 0.7);
    if (s === 0 || s === 8 || (s === 7 && Math.random() < 0.25)) kick(tt);
    if (s === 4 || s === 12) noiseHit(tt, 'bandpass', 1800, 0.12, 0.16);
    if (s % 2 === 0) noiseHit(tt, 'highpass', 7000, s % 4 === 2 ? 0.05 : 0.03, 0.05);
    if (s % 2 === 0 && Math.random() < 0.16) {
      const sc = PENTA[BG.mood];
      melody(sc[Math.floor(Math.random() * sc.length)], tt);
    }
  }

  function scheduler() {
    const ahead = 0.12;
    while (BG.nextTime < BG.ctx.currentTime + ahead) {
      scheduleStep(BG.step, BG.nextTime);
      BG.nextTime += 60 / BG.bpm / 4;
      BG.step++;
    }
  }

  function startCrackle() {
    const s = BG.ctx.createBufferSource();
    s.buffer = noiseBuffer(4, true); s.loop = true;
    const f = BG.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
    const g = BG.ctx.createGain(); g.gain.value = 0.6;
    s.connect(f); f.connect(g); g.connect(BG.bus);
    s.start();
    BG.crackle = s;
  }

  /* ---------------------------- API pública ---------------------------- */
  function start() {
    if (BG.on) return;
    if (!BG.ctx && !setup()) return;
    if (BG.ctx.state === 'suspended') BG.ctx.resume();
    if (!BG.noise) BG.noise = noiseBuffer(1, false);
    if (!BG.crackle) startCrackle();
    BG.on = true;
    BG.nextTime = BG.ctx.currentTime + 0.05;
    BG.timer = setInterval(scheduler, 25);
    const g = BG.master.gain, now = BG.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.linearRampToValueAtTime(0.55, now + 2.5);
  }

  function stop(fade = 1.2) {
    if (!BG.on) return;
    BG.on = false;
    const g = BG.master.gain, now = BG.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { if (!BG.on) clearInterval(BG.timer); }, fade * 1000 + 100);
  }

  function setTempo(bpm) { BG.bpm = Math.max(60, Math.min(140, bpm)); }
  function setMood(m) { BG.mood = m === 'minor' ? 'minor' : 'major'; }

  // Nota corta al elegir una opción (en la escala actual).
  function blip(i = 0) {
    if (!BG.on) return;
    const sc = PENTA[BG.mood];
    const t = BG.ctx.currentTime + 0.01;
    melody(sc[i % sc.length] + 12, t);
  }

  // Niveles 0..1 de n bandas (para animar barras con el sonido real).
  function levels(n) {
    if (!BG.analyser) return null;
    BG.analyser.getByteFrequencyData(BG.freq);
    const out = [], len = BG.freq.length * 0.7;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.pow(i / n, 1.6) * len), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.6) * len));
      let s = 0;
      for (let k = a; k < b; k++) s += BG.freq[k];
      out.push(s / (b - a) / 255);
    }
    return out;
  }

  window.SR = window.SR || {};
  window.SR.bg = { start, stop, setTempo, setMood, blip, levels, get on() { return BG.on; } };
})();
