/* =========================================================================
   Motor de recomendación (IA basada en contenido).

   1. Perfil: cada respuesta suma "objetivos" ponderados sobre los rasgos
      de las canciones (energía, valencia, género, contexto, emociones...).
   2. Puntuación: similitud ponderada canción ↔ perfil (0..1).
   3. Selección: MMR (Maximal Marginal Relevance) + ruido de Gumbel
      para equilibrar relevancia, diversidad y sorpresa.
   4. Aprendizaje: retroalimentación 👍/👎 con el algoritmo de Rocchio.
   El modelo de ánimo usa el modelo circumplejo de Russell (valencia × energía).
   ========================================================================= */
(function () {
  const { CATALOG, GENRES, GENRE_AFFINITY } = window.SR;

  const NUM_KEYS = ['e', 'val', 'dn', 'ac', 'ins', 'ly', 'pop', 'bpmN'];
  const NUM_LABEL = {
    e: 'Energía', val: 'Positividad', dn: 'Bailable', ac: 'Acústica',
    ins: 'Instrumental', ly: 'Letra', pop: 'Popularidad', bpmN: 'Tempo',
  };
  const RADAR_KEYS = ['e', 'val', 'dn', 'ac', 'ins', 'ly', 'pop'];

  const DECADES = ['pre70', '70s80s', '90s', '00s', '10s', '20s'];
  const DECADE_LABEL = { pre70: 'antes de los 70', '70s80s': 'los 70–80', '90s': 'los 90', '00s': 'los 2000', '10s': 'los 2010', '20s': 'los 2020' };
  const LANG_LABEL = { es: 'español', en: 'inglés', otro: 'otro idioma', inst: 'instrumental' };
  const EMO_LABEL = {
    feliz: 'felicidad', calma: 'tranquilidad', nostalgia: 'nostalgia', motivacion: 'motivación',
    desahogo: 'desahogo', romance: 'romance', adrenalina: 'adrenalina', foco: 'concentración',
  };
  const CTX_LABEL = {
    estudio: 'estudiar', ejercicio: 'hacer ejercicio', viaje: 'viajar', fiesta: 'fiestas',
    casa: 'descansar en casa', dormir: 'antes de dormir', cotidiano: 'tareas cotidianas',
  };
  const PROD_LABEL = {
    acustica: 'acústica', electronica: 'electrónica', bajos: 'con bajos marcados',
    orquestal: 'orquestal', lofi: 'lo-fi', elaborada: 'muy elaborada',
  };
  const VOICE_LABEL = { m: 'masculina', f: 'femenina', suave: 'suave', potente: 'potente', fx: 'con efectos', inst: 'instrumental' };

  // Estado de ánimo → objetivo en el plano valencia/energía (Russell) y emociones.
  // acompanar = reflejar el ánimo, cambiar = llevarlo a un lugar mejor.
  const MOODS = {
    feliz:      { label: 'feliz',       acompanar: { val: .85, e: .70, emo: ['feliz'] },              cambiar: { val: .90, e: .85, emo: ['feliz', 'adrenalina'] } },
    triste:     { label: 'triste',      acompanar: { val: .20, e: .30, emo: ['desahogo', 'nostalgia'] }, cambiar: { val: .65, e: .50, emo: ['calma', 'feliz'] } },
    estresado:  { label: 'estresado',   acompanar: { val: .35, e: .75, emo: ['adrenalina', 'desahogo'] }, cambiar: { val: .60, e: .20, emo: ['calma', 'foco'] } },
    enojado:    { label: 'enojado',     acompanar: { val: .25, e: .92, emo: ['adrenalina', 'desahogo'] }, cambiar: { val: .60, e: .45, emo: ['calma', 'motivacion'] } },
    cansado:    { label: 'cansado',     acompanar: { val: .50, e: .20, emo: ['calma'] },              cambiar: { val: .75, e: .70, emo: ['motivacion', 'feliz'] } },
    enamorado:  { label: 'enamorado',   acompanar: { val: .75, e: .45, emo: ['romance'] },            cambiar: { val: .85, e: .65, emo: ['romance', 'feliz'] } },
    nostalgico: { label: 'nostálgico',  acompanar: { val: .40, e: .35, emo: ['nostalgia'] },          cambiar: { val: .75, e: .60, emo: ['feliz', 'nostalgia'] } },
    motivado:   { label: 'motivado',    acompanar: { val: .75, e: .85, emo: ['motivacion', 'adrenalina'] }, cambiar: { val: .80, e: .95, emo: ['adrenalina', 'motivacion'] } },
    aburrido:   { label: 'aburrido',    acompanar: { val: .60, e: .55, emo: ['feliz'] },              cambiar: { val: .80, e: .85, emo: ['adrenalina', 'feliz'] } },
    tranquilo:  { label: 'tranquilo',   acompanar: { val: .65, e: .25, emo: ['calma', 'foco'] },      cambiar: { val: .75, e: .45, emo: ['feliz', 'calma'] } },
  };

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const bpmNorm = bpm => clamp((bpm - 55) / 125);
  CATALOG.forEach(s => { s.bpmN = bpmNorm(s.bpm); });

  /* ---------------------------- Perfil ---------------------------- */

  function emptyProfile() {
    return {
      num: {},                 // k -> {t, w}
      genres: {}, genreW: 0,
      voices: [], voiceW: 0,
      emo: {}, emoW: 0,
      ctx: [], ctxW: 0,
      decades: [], decW: 0,
      lang: {}, langW: 0,
      prod: [], prodW: 0,
      lambda: 0.7,             // MMR: 1 = sólo relevancia, 0 = sólo diversidad
      temp: 0.05,              // ruido de Gumbel (sorpresa)
      explore: 0,              // bonificación a géneros no elegidos
      singleGenre: false,
      targetMin: 45,
      mood: null, moodGoal: 'acompanar',
      mode: 'full',
    };
  }

  // Mezcla un objetivo nuevo con el que ya existe (promedio ponderado).
  function addNum(p, k, t, w) {
    const cur = p.num[k];
    if (!cur) { p.num[k] = { t, w }; return; }
    const W = cur.w + w;
    p.num[k] = { t: (cur.t * cur.w + t * w) / W, w: W };
  }

  function applyMood(p, moodKey, goal, strength) {
    const m = MOODS[moodKey];
    if (!m) return;
    const tgt = m[goal] || m.acompanar;
    addNum(p, 'val', tgt.val, 1.2 * strength);
    addNum(p, 'e', tgt.e, 1.2 * strength);
    tgt.emo.forEach((k, i) => { p.emo[k] = Math.max(p.emo[k] || 0, Math.min(1, (i === 0 ? 1 : 0.7) * strength)); });
    p.emoW = Math.max(p.emoW, 1.2 * strength);
    p.mood = moodKey; p.moodGoal = goal;
  }

  function buildProfile(ans, mode) {
    const p = emptyProfile();
    p.mode = mode;
    const one = id => (Array.isArray(ans[id]) ? ans[id][0] : ans[id]);
    const many = id => (Array.isArray(ans[id]) ? ans[id] : ans[id] != null ? [ans[id]] : []);

    p.targetMin = one('duracion') || 45;

    if (mode === 'emotion') {
      applyMood(p, one('animo'), one('meta') || 'acompanar', 1.6);
      // Contexto implícito según la energía objetivo.
      const e = p.num.e ? p.num.e.t : .5;
      addNum(p, 'dn', clamp(e + .05), .5);
      addNum(p, 'ac', clamp(1 - e), .4);
      p.lambda = 0.65; p.temp = 0.06;
      return p;
    }

    // 1. Géneros
    const g = many('generos');
    g.forEach((k, i) => { p.genres[k] = 1 - i * 0.08; });
    p.genreW = g.length ? 2.2 : 0;
    if (g.includes('otros')) { p.genreW *= 0.7; p.explore += 0.1; }

    // 2. Ritmo
    const ritmo = one('ritmo');
    const RITMO = {
      lento:    { e: .20, dn: .20, bpmN: .15, val: .45 },
      moderado: { e: .42, dn: .45, bpmN: .35 },
      bailable: { e: .72, dn: .90, bpmN: .45, val: .80 },
      rapido:   { e: .92, dn: .65, bpmN: .65 },
    };
    if (RITMO[ritmo]) {
      const r = RITMO[ritmo];
      addNum(p, 'e', r.e, 1.3);
      addNum(p, 'dn', r.dn, 0.9);
      addNum(p, 'bpmN', r.bpmN, 0.35);
      if (r.val != null) addNum(p, 'val', r.val, 0.5);
    }

    // 3. Lo que más valora
    let voiceBoost = 1, prodBoost = 1, emoBoost = 1;
    switch (one('valora')) {
      case 'letra': addNum(p, 'ly', .9, 1.2); addNum(p, 'ins', 0, .6); break;
      case 'melodia': addNum(p, 'ins', .35, .3); addNum(p, 'ac', .6, .3); addNum(p, 'val', .6, .2); break;
      case 'beat': addNum(p, 'dn', .85, .9); addNum(p, 'e', .7, .3); p.prod.push('bajos'); p.prodW = Math.max(p.prodW, .6); break;
      case 'voz': addNum(p, 'ins', 0, 1.0); voiceBoost = 1.5; break;
      case 'produccion': addNum(p, 'ins', .5, .3); prodBoost = 1.6; break;
      case 'emocion': emoBoost = 1.5; break;
    }

    // 4. Voz
    const voz = one('voz');
    if (voz === 'ambas') addNum(p, 'ins', .05, .4);
    else if (voz === 'inst') { addNum(p, 'ins', 1, 1.5); p.voices = ['inst']; p.voiceW = 1.2; }
    else if (voz) { p.voices = [voz]; p.voiceW = 1.0; }
    p.voiceW *= voiceBoost;

    // 5. Emociones buscadas
    many('emociones').forEach((k, i) => { p.emo[k] = i === 0 ? 1 : 0.85; });
    if (many('emociones').length) p.emoW = 1.4 * emoBoost;

    // 6. Situación
    p.ctx = many('situacion');
    p.ctxW = p.ctx.length ? 1.1 : 0;

    // 7. Décadas
    const dec = many('decadas').filter(d => d !== 'any');
    p.decades = dec; p.decW = dec.length ? 0.9 : 0;

    // 8. Letra
    switch (one('letra')) {
      case 'muy': addNum(p, 'ly', .9, 1.2); break;
      case 'media': addNum(p, 'ly', .6, .6); break;
      case 'poca': addNum(p, 'ly', .2, .8); addNum(p, 'ins', .5, .5); break;
      case 'inst': addNum(p, 'ins', 1, 1.4); addNum(p, 'ly', 0, 1); break;
    }

    // 9. Idioma
    const LANG = {
      es: { es: 1, inst: .5, otro: .1 }, en: { en: 1, inst: .5, otro: .1 },
      es_en: { es: 1, en: 1, inst: .5 }, otro: { otro: 1, inst: .6, en: .25, es: .1 },
    };
    const idioma = one('idioma');
    if (LANG[idioma]) { p.lang = LANG[idioma]; p.langW = 1.1; }

    // 10. Descubrir
    switch (one('descubrir')) {
      case 'favoritos': addNum(p, 'pop', .92, .8); p.temp *= 0.5; break;
      case 'mezcla': addNum(p, 'pop', .72, .3); break;
      case 'nuevos': addNum(p, 'pop', .55, .6); p.temp += 0.04; break;
      case 'generos': p.explore += 0.3; p.temp += 0.04; break;
    }

    // 11. Producción
    const prod = one('produccion');
    if (prod && prod !== 'any') { if (!p.prod.includes(prod)) p.prod.unshift(prod); p.prodW = 1.0; }
    p.prodW *= prodBoost;
    if (prod === 'acustica') addNum(p, 'ac', .9, .6);
    if (prod === 'electronica') addNum(p, 'ac', .05, .6);
    if (prod === 'orquestal') addNum(p, 'ins', .7, .4);

    // 12. Popularidad
    switch (one('popularidad')) {
      case 'hits': addNum(p, 'pop', .95, 1.0); break;
      case 'mezcla': addNum(p, 'pop', .72, .4); break;
      case 'indie': addNum(p, 'pop', .45, 1.0); break;
    }

    // 13. Variedad
    switch (one('variedad')) {
      case 'uno': p.singleGenre = true; p.lambda = 0.92; break;
      case 'similares': p.lambda = 0.78; break;
      case 'mezcla': p.lambda = 0.62; p.genreW *= 0.85; break;
      case 'todo': p.lambda = 0.45; p.genreW *= 0.6; p.temp += 0.05; break;
    }

    // 14. Parecido a sus gustos
    switch (one('parecido')) {
      case 'muy': p.temp = Math.min(p.temp, 0.02); break;
      case 'similar': p.temp += 0.02; p.explore += 0.05; break;
      case 'diferente': p.temp += 0.08; p.explore += 0.25; break;
      case 'sorpresa': p.temp += 0.18; p.explore += 0.45; p.lambda = Math.min(p.lambda, 0.5); break;
    }
    p.explore = clamp(p.explore, 0, 0.6);

    // 16. Ánimo actual (más peso si el ritmo "depende de mi estado de ánimo")
    if (one('animo')) applyMood(p, one('animo'), 'acompanar', ritmo === 'animo' ? 1.3 : 0.6);

    return p;
  }

  /* --------------------------- Puntuación -------------------------- */

  const POS_W = [1, 0.7, 0.5]; // el primer tag de la canción es el más representativo

  function tagScore(songTags, prefWeights) {
    let best = 0;
    songTags.forEach((tag, i) => {
      const pw = prefWeights[tag];
      if (pw) best = Math.max(best, pw * (POS_W[i] || .4));
    });
    return best;
  }

  function genreScore(song, p) {
    let s = 0;
    for (const [g, w] of Object.entries(p.genres)) {
      if (song.g === g) s = Math.max(s, w);
      else {
        const aff = (GENRE_AFFINITY[g] || {})[song.g] || 0;
        s = Math.max(s, aff * w * (p.lambda >= 0.75 ? 0.9 : 0.65));
      }
    }
    // Exploración: una parte del puntaje premia géneros que NO eligió.
    return (1 - p.explore) * s + p.explore * (1 - s) * 0.8;
  }

  function decadeScore(song, p) {
    const i = DECADES.indexOf(song.d);
    let s = 0;
    p.decades.forEach(d => {
      const j = DECADES.indexOf(d);
      s = Math.max(s, i === j ? 1 : Math.abs(i - j) === 1 ? 0.35 : 0);
    });
    return s;
  }

  function scoreSong(song, p) {
    const parts = [];
    const push = (key, label, w, s) => { if (w > 0) parts.push({ key, label, w, s }); };

    for (const k of NUM_KEYS) {
      const o = p.num[k];
      if (!o) continue;
      push(k, NUM_LABEL[k], o.w, clamp(1 - Math.abs(song[k] - o.t) * 1.3));
    }
    if (p.genreW) push('g', 'Género', p.genreW, genreScore(song, p));
    if (p.voiceW) push('v', 'Voz', p.voiceW, song.v.some(v => p.voices.includes(v)) ? 1 : 0);
    if (p.emoW) push('emo', 'Emoción', p.emoW, tagScore(song.emo, p.emo));
    if (p.ctxW) push('ctx', 'Situación', p.ctxW, tagScore(song.ctx, Object.fromEntries(p.ctx.map((c, i) => [c, i ? .85 : 1]))));
    if (p.decW) push('d', 'Época', p.decW, decadeScore(song, p));
    if (p.langW) push('l', 'Idioma', p.langW, p.lang[song.l] || 0);
    if (p.prodW) push('prod', 'Producción', p.prodW, tagScore(song.prod, Object.fromEntries(p.prod.map((c, i) => [c, i ? .7 : 1]))));

    const W = parts.reduce((a, x) => a + x.w, 0) || 1;
    const score = parts.reduce((a, x) => a + x.w * x.s, 0) / W;
    return { score, parts, W };
  }

  // Frases cortas de "por qué te la recomiendo".
  function explain(song, res, p) {
    const level = x => (x > .66 ? 'alta' : x > .36 ? 'media' : 'baja');
    const reasons = res.parts
      .filter(x => x.s >= 0.6)
      .sort((a, b) => b.w * b.s - a.w * a.s)
      .slice(0, 3)
      .map(x => {
        switch (x.key) {
          case 'g': return p.genres[song.g] ? GENRES[song.g].name : `Explorar ${GENRES[song.g].name.toLowerCase()}`;
          case 'e': return `Energía ${level(song.e)}`;
          case 'val': return song.val > .6 ? 'Tono positivo' : song.val < .4 ? 'Tono melancólico' : 'Tono equilibrado';
          case 'dn': return song.dn > .65 ? 'Muy bailable' : song.dn > .4 ? 'Ritmo constante' : 'Ritmo pausado';
          case 'ac': return song.ac > .6 ? 'Sonido acústico' : 'Sonido producido';
          case 'ins': return song.ins > .6 ? 'Instrumental' : 'Con voz protagonista';
          case 'ly': return song.ly > .6 ? 'Letra con peso' : 'Poca letra';
          case 'pop': return song.pop > .85 ? 'Un éxito' : 'Joya menos conocida';
          case 'bpmN': return `${song.bpm} BPM`;
          case 'v': return `Voz ${VOICE_LABEL[song.v.find(v => p.voices.includes(v))] || ''}`;
          case 'emo': return `Transmite ${EMO_LABEL[song.emo.find(e => p.emo[e])] || ''}`;
          case 'ctx': return `Para ${CTX_LABEL[song.ctx.find(c => p.ctx.includes(c))] || ''}`;
          case 'd': return `De ${DECADE_LABEL[song.d]}`;
          case 'l': return `En ${LANG_LABEL[song.l]}`;
          case 'prod': return `Producción ${PROD_LABEL[song.prod.find(c => p.prod.includes(c))] || ''}`;
          default: return x.label;
        }
      });
    return reasons.length ? reasons : ['Para variar tu playlist'];
  }

  /* ---------------------------- Selección --------------------------- */

  // Similitud entre dos canciones (para la diversidad del MMR).
  function songSim(a, b) {
    let d = 0;
    for (const k of ['e', 'val', 'dn', 'ac', 'ins', 'ly']) d += (a[k] - b[k]) ** 2;
    const num = 1 - Math.sqrt(d / 6);
    const sameG = a.g === b.g ? 1 : (GENRE_AFFINITY[a.g] || {})[b.g] || 0;
    const sameA = a.a === b.a ? 1 : 0;
    return clamp(0.5 * num + 0.35 * sameG + 0.15 * sameA);
  }

  function gumbel() {
    const u = Math.random() * 0.999 + 0.0005;
    return -Math.log(-Math.log(u));
  }

  function recommend(p, opts = {}) {
    const banned = new Set(opts.banned || []);
    const pinned = (opts.pinned || []).map(id => CATALOG.find(s => s.id === id)).filter(Boolean);

    let pool = CATALOG.filter(s => !banned.has(s.id));
    const scored = new Map(pool.map(s => [s.id, scoreSong(s, p)]));

    // "Un solo género": se queda con el género favorito y, si no alcanza, con los afines.
    if (p.singleGenre && Object.keys(p.genres).length) {
      const top = Object.keys(p.genres)[0];
      const same = pool.filter(s => s.g === top);
      const minutes = same.reduce((a, s) => a + s.dur, 0) / 60;
      if (minutes >= p.targetMin * 0.9) pool = same;
      else {
        const aff = GENRE_AFFINITY[top] || {};
        pool = pool.filter(s => s.g === top || (aff[s.g] || 0) >= 0.5);
      }
    }

    const targetSec = p.targetMin * 60;
    const chosen = [...pinned];
    let total = chosen.reduce((a, s) => a + s.dur, 0);
    const noisy = new Map(pool.map(s => [s.id, scored.get(s.id).score + p.temp * gumbel()]));
    let rest = pool.filter(s => !chosen.includes(s));
    // Umbral de relevancia: evita colar canciones que casi no coinciden
    // (más permisivo si pidió que la IA lo sorprenda).
    const topScore = Math.max(...pool.map(s => scored.get(s.id).score));
    const floor = topScore * (p.explore >= 0.4 ? 0.35 : 0.6);

    while (total < targetSec && rest.length) {
      const good = rest.filter(s => scored.get(s.id).score >= floor);
      const candidates = good.length ? good : rest;
      let best = null, bestVal = -Infinity;
      for (const s of candidates) {
        const div = chosen.length ? Math.max(...chosen.map(c => songSim(s, c))) : 0;
        const val = p.lambda * noisy.get(s.id) - (1 - p.lambda) * div;
        if (val > bestVal) { bestVal = val; best = s; }
      }
      chosen.push(best);
      total += best.dur;
      rest = rest.filter(s => s !== best);
    }

    // Orden final: arco de energía suave (sube a la mitad y baja al final).
    const ordered = energyArc(chosen, p);
    return {
      tracks: ordered.map(s => {
        const res = scored.get(s.id) || scoreSong(s, p);
        return { song: s, match: Math.round(res.score * 100), reasons: explain(s, res, p), parts: res.parts };
      }),
      totalSec: total,
      exhausted: total < targetSec,
    };
  }

  function energyArc(list, p) {
    if (list.length < 4) return list;
    const calm = p.num.e && p.num.e.t < 0.35;
    const sorted = [...list].sort((a, b) => a.e - b.e);
    // Intercala: bajas al inicio, altas al centro, bajas al final.
    const out = new Array(sorted.length);
    let l = 0, r = sorted.length - 1, k = 0;
    for (const s of sorted) {
      if (k % 2 === 0) out[l++] = s; else out[r--] = s;
      k++;
    }
    // Si buscó calma (dormir/relajarse) termina en lo más suave.
    if (calm) return [...list].sort((a, b) => b.e - a.e);
    return out;
  }

  /* --------------------------- Aprendizaje -------------------------- */

  // Rocchio: mueve los objetivos hacia lo que le gustó y lejos de lo que no.
  function learn(p, likedIds, dislikedIds) {
    const liked = likedIds.map(id => CATALOG.find(s => s.id === id)).filter(Boolean);
    const disliked = dislikedIds.map(id => CATALOG.find(s => s.id === id)).filter(Boolean);
    if (!liked.length && !disliked.length) return p;
    const q = JSON.parse(JSON.stringify(p));
    const BETA = 0.45, GAMMA = 0.2;
    const mean = (arr, k) => arr.reduce((a, s) => a + s[k], 0) / arr.length;

    for (const k of NUM_KEYS) {
      const cur = q.num[k] || { t: 0.5, w: 0 };
      let t = cur.t;
      if (liked.length) t += BETA * (mean(liked, k) - cur.t);
      if (disliked.length) t -= GAMMA * (mean(disliked, k) - cur.t);
      q.num[k] = { t: clamp(t), w: Math.max(cur.w, liked.length ? 0.5 : 0) + 0.15 * liked.length };
    }
    liked.forEach(s => { q.genres[s.g] = clamp((q.genres[s.g] || 0) + 0.35); });
    disliked.forEach(s => { q.genres[s.g] = clamp((q.genres[s.g] || 0) - 0.3); if (q.genres[s.g] === 0) delete q.genres[s.g]; });
    if (Object.keys(q.genres).length) q.genreW = Math.max(q.genreW, 1.5);
    liked.forEach(s => s.emo.slice(0, 1).forEach(e => { q.emo[e] = clamp((q.emo[e] || 0) + 0.3); }));
    if (Object.keys(q.emo).length) q.emoW = Math.max(q.emoW, 1);
    q.learnedFrom = (p.learnedFrom || 0) + liked.length + disliked.length;
    return q;
  }

  // Vector para la gráfica de radar del perfil.
  function radar(p) {
    return RADAR_KEYS.map(k => ({ key: k, label: NUM_LABEL[k], value: p.num[k] ? p.num[k].t : 0.5, known: !!p.num[k] }));
  }

  window.SR.engine = {
    buildProfile, recommend, learn, scoreSong, radar,
    MOODS, GENRES, EMO_LABEL, CTX_LABEL,
  };
})();
