/* =========================================================================
   Catálogo de canciones con rasgos musicales para el motor de IA.
   Cada enlace de SoundCloud se verificó a mano (subida oficial cuando existe).

   Rasgos numéricos (0..1):
     e   energía          val valencia (qué tan positiva suena)
     dn  bailabilidad     ac  acústica
     ins instrumental     ly  peso de la letra
     pop popularidad
   ========================================================================= */
(function () {
  const SC = 'https://soundcloud.com/';

  // S(id, título, artista, género, año, idioma, voces, "e val dn ac ins ly pop", bpm,
  //   emociones, contextos, producción, duración(seg), ruta SoundCloud, nota)
  function S(id, t, a, g, y, l, v, f, bpm, emo, ctx, prod, dur, path, note) {
    const [e, val, dn, ac, ins, ly, pop] = f.split(' ').map(Number);
    return {
      id, t, a, g, y, l, v, bpm, emo, ctx, prod, dur, note: note || '',
      e, val, dn, ac, ins, ly, pop,
      d: decadeOf(y),
      sc: SC + path,
    };
  }

  function decadeOf(y) {
    if (y < 1970) return 'pre70';
    if (y < 1990) return '70s80s';
    if (y < 2000) return '90s';
    if (y < 2010) return '00s';
    if (y < 2020) return '10s';
    return '20s';
  }

  const CATALOG = [
    // ---------------- Pop ----------------
    S('levitating', 'Levitating', 'Dua Lipa', 'pop', 2020, 'en', ['f', 'potente'], '.80 .90 .85 .10 .00 .40 .95', 103,
      ['feliz', 'motivacion'], ['fiesta', 'ejercicio', 'cotidiano'], ['electronica', 'elaborada'], 230,
      'dualipa/levitating'),
    S('billiejean', 'Billie Jean', 'Michael Jackson', 'pop', 1982, 'en', ['m', 'fx'], '.70 .60 .90 .10 .00 .60 .98', 117,
      ['feliz', 'nostalgia'], ['fiesta', 'cotidiano', 'viaje'], ['bajos', 'elaborada'], 294,
      'iranilton-rodrigues/michael-jackson-billie-jean-1'),
    S('hipsdontlie', "Hips Don't Lie", 'Shakira ft. Wyclef Jean', 'pop', 2006, 'en', ['f', 'm', 'potente'], '.85 .85 .90 .20 .00 .40 .95', 100,
      ['feliz', 'adrenalina'], ['fiesta', 'ejercicio'], ['bajos', 'elaborada'], 230,
      'shakira/hips-dont-lie'),
    S('shapeofyou', 'Shape of You', 'Ed Sheeran', 'pop', 2017, 'en', ['m', 'suave'], '.65 .85 .85 .30 .00 .45 .98', 96,
      ['feliz', 'romance'], ['cotidiano', 'fiesta', 'viaje'], ['electronica', 'bajos'], 234,
      'edsheeran/shape-of-you'),
    S('dancingqueen', 'Dancing Queen', 'ABBA', 'pop', 1976, 'en', ['f'], '.70 .90 .75 .20 .00 .40 .92', 101,
      ['feliz', 'nostalgia'], ['fiesta', 'cotidiano'], ['elaborada'], 231,
      'abba-official/dancing-queen', 'En vivo'),
    S('flowers', 'Flowers', 'Miley Cyrus', 'pop', 2023, 'en', ['f', 'potente'], '.65 .70 .75 .20 .00 .70 .95', 118,
      ['motivacion', 'feliz'], ['cotidiano', 'viaje', 'ejercicio'], ['elaborada'], 200,
      'piklu-999589542/miley-cyrus-flowers-official'),
    S('bzrp53', 'Bzrp Music Sessions #53', 'Bizarrap & Shakira', 'pop', 2023, 'es', ['f', 'potente', 'fx'], '.85 .40 .80 .00 .00 .90 .95', 122,
      ['desahogo', 'adrenalina', 'motivacion'], ['fiesta', 'ejercicio', 'cotidiano'], ['electronica', 'bajos'], 217,
      'bizarrap/bizarrap-shakira-shakira-bzrp'),

    // ---------------- Rock / alternativo ----------------
    S('bohemian', 'Bohemian Rhapsody', 'Queen', 'rock', 1975, 'en', ['m', 'potente'], '.60 .40 .30 .30 .10 .85 .98', 72,
      ['nostalgia', 'adrenalina', 'desahogo'], ['casa', 'viaje'], ['elaborada', 'orquestal'], 355,
      'wesley-prinsen/queen-bohemian-rhapsodywav'),
    S('teenspirit', 'Smells Like Teen Spirit', 'Nirvana', 'rock', 1991, 'en', ['m', 'potente', 'fx'], '.95 .30 .50 .10 .00 .60 .95', 117,
      ['adrenalina', 'desahogo'], ['ejercicio', 'viaje'], ['bajos'], 301,
      'nirvana/sets/smells-like-teen-spirit-in-1'),
    S('musicaligera', 'De Música Ligera', 'Soda Stereo', 'rock', 1990, 'es', ['m'], '.85 .70 .60 .10 .00 .55 .90', 132,
      ['nostalgia', 'adrenalina', 'feliz'], ['viaje', 'fiesta', 'ejercicio'], ['elaborada'], 214,
      'sodastereoofficial/de-m-sica-ligera', 'Remasterizado 2007'),
    S('doiwannaknow', 'Do I Wanna Know?', 'Arctic Monkeys', 'rock', 2013, 'en', ['m', 'suave'], '.55 .30 .55 .10 .00 .70 .93', 85,
      ['romance', 'nostalgia'], ['viaje', 'casa', 'cotidiano'], ['bajos'], 272,
      'arcticmonkeys/do-i-wanna-know'),
    S('celula', 'La Célula Que Explota', 'Caifanes', 'rock', 1990, 'es', ['m', 'potente'], '.70 .40 .45 .30 .00 .80 .80', 120,
      ['nostalgia', 'desahogo', 'romance'], ['viaje', 'casa'], ['elaborada', 'acustica'], 220,
      'caifanesofficial/la-celula-que-explota'),
    S('labiosrotos', 'Labios Rotos', 'Zoé', 'rock', 2011, 'es', ['m', 'suave'], '.40 .40 .35 .70 .00 .80 .82', 116,
      ['romance', 'nostalgia', 'calma'], ['casa', 'viaje', 'dormir'], ['acustica', 'orquestal'], 250,
      'zoevevogdrebirth/zoe-labios-rotos-mtv-unplugged', 'MTV Unplugged'),
    S('believer', 'Believer', 'Imagine Dragons', 'rock', 2017, 'en', ['m', 'potente'], '.90 .50 .70 .10 .00 .65 .95', 125,
      ['motivacion', 'adrenalina'], ['ejercicio', 'viaje'], ['bajos', 'elaborada'], 215,
      'imaginedragons/believer'),

    // ---------------- Reggaetón / urbano ----------------
    S('titi', 'Tití Me Preguntó', 'Bad Bunny', 'urbano', 2022, 'es', ['m', 'fx'], '.80 .70 .85 .00 .00 .60 .97', 106,
      ['feliz', 'adrenalina'], ['fiesta', 'ejercicio', 'cotidiano'], ['bajos', 'electronica'], 243,
      'un-verano-sin-ti/titi-me-pregunto'),
    S('gasolina', 'Gasolina', 'Daddy Yankee', 'urbano', 2004, 'es', ['m', 'potente'], '.95 .80 .90 .00 .00 .40 .95', 96,
      ['adrenalina', 'feliz', 'nostalgia'], ['fiesta', 'ejercicio'], ['bajos', 'electronica'], 193,
      'lucia-rodriguez-332309950/daddy-yankee-gasolina'),
    S('tusa', 'Tusa', 'Karol G & Nicki Minaj', 'urbano', 2019, 'es', ['f', 'potente'], '.75 .55 .85 .00 .00 .60 .96', 101,
      ['desahogo', 'feliz'], ['fiesta', 'cotidiano'], ['bajos', 'electronica'], 201,
      'karolgofficial/karol-g-nicki-minaj-tusa'),
    S('tododeti', 'Todo de Ti', 'Rauw Alejandro', 'urbano', 2021, 'es', ['m', 'suave'], '.75 .90 .85 .00 .00 .50 .93', 128,
      ['feliz', 'romance'], ['fiesta', 'viaje', 'cotidiano'], ['electronica', 'bajos'], 199,
      'rauwalejandro/rauw-alejandro-todo-de-ti'),

    // ---------------- Hip-hop / rap ----------------
    S('californialove', 'California Love', '2Pac ft. Dr. Dre', 'hiphop', 1995, 'en', ['m', 'fx'], '.80 .80 .85 .00 .00 .70 .92', 92,
      ['feliz', 'nostalgia'], ['fiesta', 'viaje'], ['bajos', 'electronica'], 285,
      '2pac/california-love-original'),
    S('loseyourself', 'Lose Yourself', 'Eminem', 'hiphop', 2002, 'en', ['m', 'potente'], '.85 .40 .70 .00 .00 .95 .97', 86,
      ['motivacion', 'adrenalina'], ['ejercicio', 'estudio'], ['bajos'], 326,
      'eminemofficial/lose-yourself'),
    S('feelgood', 'Feel Good Inc.', 'Gorillaz', 'hiphop', 2005, 'en', ['m', 'fx'], '.70 .60 .80 .20 .00 .60 .92', 139,
      ['nostalgia', 'feliz'], ['viaje', 'cotidiano'], ['bajos', 'elaborada'], 221,
      'gorillaz/feel-good-inc'),
    S('selfcare', 'Self Care', 'Mac Miller', 'hiphop', 2018, 'en', ['m', 'suave'], '.40 .40 .60 .10 .10 .85 .80', 70,
      ['calma', 'desahogo', 'nostalgia'], ['casa', 'viaje', 'estudio'], ['lofi', 'elaborada'], 345,
      'larryfisherman/self-care'),
    S('esepico', 'Es Épico', 'Canserbero', 'hiphop', 2012, 'es', ['m', 'potente'], '.75 .35 .55 .10 .00 1 .75', 92,
      ['motivacion', 'adrenalina', 'desahogo'], ['ejercicio', 'viaje', 'estudio'], ['bajos'], 340,
      'eljustincriollo/canserbero-es-epico'),

    // ---------------- Electrónica ----------------
    S('levels', 'Levels (Skrillex Remix)', 'Avicii', 'electronica', 2011, 'inst', ['fx'], '.95 .70 .70 .00 .80 .10 .88', 128,
      ['adrenalina', 'feliz', 'motivacion'], ['ejercicio', 'fiesta'], ['electronica', 'bajos'], 280,
      'aviciiofficial/avicii-levels-skrillex-remix'),
    S('momentapart', 'A Moment Apart', 'ODESZA', 'electronica', 2017, 'inst', ['fx'], '.65 .60 .55 .10 .85 .05 .70', 120,
      ['nostalgia', 'motivacion', 'foco'], ['viaje', 'estudio', 'ejercicio'], ['electronica', 'elaborada'], 234,
      'odesza/a-moment-apart'),
    S('kerala', 'Kerala', 'Bonobo', 'electronica', 2016, 'inst', ['fx'], '.55 .55 .65 .20 .90 .05 .60', 122,
      ['foco', 'calma', 'feliz'], ['estudio', 'viaje', 'cotidiano'], ['electronica', 'elaborada'], 250,
      'bonobo/kerala'),
    S('firestone', 'Firestone', 'Kygo ft. Conrad Sewell', 'electronica', 2014, 'en', ['m', 'suave'], '.60 .65 .70 .30 .20 .40 .88', 114,
      ['feliz', 'romance', 'calma'], ['viaje', 'fiesta', 'casa'], ['electronica'], 271,
      'kygo/firestone-ft-conrad'),
    S('aruarian', 'Aruarian Dance', 'Nujabes', 'electronica', 2004, 'inst', ['inst'], '.30 .55 .55 .50 1 0 .65', 90,
      ['calma', 'foco', 'nostalgia'], ['estudio', 'casa', 'dormir'], ['lofi'], 250,
      'tetsujin/nujabes-aruarian-dance'),

    // ---------------- Regional mexicano ----------------
    S('volver', 'Volver, Volver', 'Vicente Fernández', 'regional', 1972, 'es', ['m', 'potente'], '.55 .45 .40 .90 .00 .90 .92', 92,
      ['nostalgia', 'desahogo', 'romance'], ['fiesta', 'casa'], ['acustica', 'orquestal'], 200,
      'vicentefernandez/volver-volver'),
    S('ellabaila', 'Ella Baila Sola', 'Eslabon Armado & Peso Pluma', 'regional', 2023, 'es', ['m', 'suave'], '.60 .55 .70 .80 .00 .60 .95', 148,
      ['romance', 'feliz'], ['fiesta', 'viaje', 'cotidiano'], ['acustica'], 165,
      'vibehigher/ella-baila-sola-eslabon'),
    S('unx100to', 'un x100to', 'Grupo Frontera & Bad Bunny', 'regional', 2023, 'es', ['m'], '.55 .40 .60 .70 .00 .75 .93', 83,
      ['desahogo', 'romance', 'nostalgia'], ['fiesta', 'viaje', 'casa'], ['acustica'], 194,
      'luis-z-yt/grupo-frontera-x-bad-bunny-un'),
    S('adiosamor', 'Adiós Amor', 'Christian Nodal', 'regional', 2016, 'es', ['m', 'potente'], '.50 .35 .45 .85 .00 .80 .88', 78,
      ['desahogo', 'romance'], ['fiesta', 'casa'], ['acustica', 'orquestal'], 210,
      'christiannodal/adios-amor-christian-nodal-2016'),
    S('nuncaessuficiente', 'Nunca Es Suficiente', 'Los Ángeles Azules ft. Natalia Lafourcade', 'regional', 2018, 'es', ['f', 'suave'], '.60 .65 .80 .60 .00 .70 .90', 97,
      ['romance', 'feliz', 'nostalgia'], ['fiesta', 'cotidiano'], ['acustica', 'orquestal'], 280,
      'juan-alanis-2/nunca-es-suficiente-los'),
    S('querida', 'Querida', 'Juan Gabriel', 'regional', 1984, 'es', ['m', 'potente'], '.65 .55 .60 .70 .00 .85 .90', 130,
      ['nostalgia', 'desahogo', 'romance'], ['fiesta', 'casa'], ['orquestal', 'elaborada'], 300,
      'juan-gabriel-official/querida-en-vivo-desde-el', 'En vivo · Bellas Artes'),

    // ---------------- R&B / soul ----------------
    S('blindinglights', 'Blinding Lights', 'The Weeknd', 'rnb', 2019, 'en', ['m', 'potente'], '.80 .60 .70 .00 .00 .55 .98', 171,
      ['nostalgia', 'adrenalina', 'romance'], ['viaje', 'ejercicio', 'fiesta'], ['electronica', 'elaborada'], 200,
      'theweeknd/blinding-lights'),
    S('thinkin', 'Thinkin Bout You', 'Frank Ocean', 'rnb', 2012, 'en', ['m', 'suave'], '.35 .40 .50 .30 .00 .80 .85', 129,
      ['romance', 'nostalgia', 'calma'], ['casa', 'dormir', 'viaje'], ['elaborada'], 220,
      'lava2810/frank-ocean-thinkin-bout-you', 'En vivo'),
    S('letsgetiton', "Let's Get It On", 'Marvin Gaye', 'rnb', 1973, 'en', ['m', 'suave'], '.45 .70 .60 .50 .00 .70 .85', 82,
      ['romance', 'calma'], ['casa'], ['acustica', 'elaborada'], 285,
      'marvin-gaye/lets-get-it-on'),
    S('backtoblack', 'Back to Black', 'Amy Winehouse', 'rnb', 2006, 'en', ['f', 'potente'], '.50 .25 .50 .50 .00 .85 .90', 123,
      ['desahogo', 'nostalgia'], ['casa', 'viaje'], ['orquestal', 'elaborada'], 240,
      'amy-winehouse/back-to-black-original-demo', 'Demo original'),
    S('getyou', 'Get You', 'Daniel Caesar ft. Kali Uchis', 'rnb', 2016, 'en', ['m', 'f', 'suave'], '.30 .55 .55 .50 .00 .70 .80', 140,
      ['romance', 'calma'], ['casa', 'dormir'], ['acustica', 'elaborada'], 278,
      'danielcaesar/get-you-kali-uchis'),
    S('killbill', 'Kill Bill', 'SZA', 'rnb', 2022, 'en', ['f', 'suave'], '.60 .45 .65 .20 .00 .80 .95', 89,
      ['desahogo', 'romance'], ['cotidiano', 'viaje', 'casa'], ['elaborada'], 154,
      'szababy2/kill-bill'),

    // ---------------- Indie / folk ----------------
    S('hastalaraiz', 'Hasta la Raíz', 'Natalia Lafourcade', 'indie', 2015, 'es', ['f', 'suave'], '.50 .65 .55 .80 .00 .85 .80', 96,
      ['nostalgia', 'feliz', 'romance'], ['casa', 'viaje', 'cotidiano'], ['acustica'], 220,
      'natalialafourcade/hasta-la-raiz'),
    S('skinnylove', 'Skinny Love', 'Bon Iver', 'indie', 2008, 'en', ['m', 'suave'], '.30 .25 .30 .95 .00 .85 .80', 75,
      ['desahogo', 'nostalgia', 'calma'], ['casa', 'dormir'], ['acustica'], 238,
      'paolo-giarrusso/bon-iver-skinny-love-live', 'En vivo · Jools Holland'),
    S('lessiknow', 'The Less I Know the Better', 'Tame Impala', 'indie', 2015, 'en', ['m', 'suave', 'fx'], '.70 .70 .80 .10 .10 .55 .90', 117,
      ['feliz', 'nostalgia'], ['viaje', 'fiesta', 'cotidiano'], ['bajos', 'elaborada'], 218,
      'tame-impala/the-less-i-know-the-better'),
    S('loquesiento', 'Lo Que Siento', 'Cuco', 'indie', 2016, 'es', ['m', 'suave'], '.35 .50 .50 .40 .10 .70 .70', 96,
      ['romance', 'calma', 'nostalgia'], ['casa', 'dormir', 'estudio'], ['lofi'], 315,
      'deivi-esthefano/cuco-lo-que-siento'),
    S('takemetochurch', 'Take Me to Church', 'Hozier', 'indie', 2013, 'en', ['m', 'potente'], '.55 .30 .45 .60 .00 .90 .93', 129,
      ['desahogo', 'adrenalina'], ['casa', 'viaje'], ['acustica', 'elaborada'], 242,
      'hozier/sets/hozer-take-me-to-church-ep'),
    S('tufalta', 'Tu Falta de Querer', 'Mon Laferte', 'indie', 2015, 'es', ['f', 'potente'], '.45 .25 .40 .70 .00 .90 .85', 74,
      ['desahogo', 'romance'], ['casa', 'viaje'], ['acustica', 'orquestal'], 290,
      'monlaferte/tu-falta-de-querer'),

    // ---------------- Jazz / blues ----------------
    S('sowhat', 'So What', 'Miles Davis', 'jazz', 1959, 'inst', ['inst'], '.35 .50 .40 .95 1 0 .80', 136,
      ['calma', 'foco'], ['estudio', 'casa'], ['acustica', 'elaborada'], 562,
      'milesdavissonymusic/so-what-zoroty-remaster'),
    S('takefive', 'Take Five', 'Dave Brubeck Quartet', 'jazz', 1959, 'inst', ['inst'], '.45 .60 .50 .95 1 0 .85', 172,
      ['foco', 'calma', 'feliz'], ['estudio', 'casa', 'cotidiano'], ['acustica', 'elaborada'], 322,
      'davebrubeck/take-five'),
    S('atlast', 'At Last', 'Etta James', 'jazz', 1960, 'en', ['f', 'potente'], '.30 .70 .30 .70 .00 .70 .88', 87,
      ['romance', 'calma', 'nostalgia'], ['casa', 'dormir'], ['orquestal'], 180,
      'ettajamesofficial/at-last-remastered'),
    S('thrillisgone', 'The Thrill Is Gone', 'B.B. King', 'jazz', 1969, 'en', ['m', 'potente'], '.40 .25 .40 .70 .40 .70 .80', 92,
      ['desahogo', 'nostalgia'], ['casa', 'viaje'], ['acustica', 'orquestal'], 325,
      'shen23/bb-king-5'),
    S('dontknowwhy', "Don't Know Why", 'Norah Jones', 'jazz', 2002, 'en', ['f', 'suave'], '.20 .45 .40 .90 .00 .65 .82', 88,
      ['calma', 'romance', 'nostalgia'], ['casa', 'dormir', 'estudio'], ['acustica'], 186,
      'hemi-sarah/norah-jones-dont-know-why'),
    S('wonderfulworld', 'What a Wonderful World', 'Louis Armstrong', 'jazz', 1967, 'en', ['m'], '.15 .80 .20 .80 .00 .75 .95', 78,
      ['calma', 'feliz', 'nostalgia'], ['casa', 'dormir'], ['orquestal'], 140,
      'louisarmstrongofficial/what-a-wonderful-94292852', 'Versión restaurada'),

    // ---------------- Clásica / instrumental ----------------
    S('clairdelune', 'Clair de Lune', 'Claude Debussy', 'clasica', 1905, 'inst', ['inst'], '.10 .40 .05 1 1 0 .85', 66,
      ['calma', 'foco', 'nostalgia'], ['estudio', 'dormir', 'casa'], ['acustica', 'orquestal'], 300,
      'claude-debussy/clair-de-lune'),
    S('moonlight', 'Sonata Claro de Luna (I)', 'Ludwig van Beethoven', 'clasica', 1801, 'inst', ['inst'], '.10 .15 .05 1 1 0 .90', 54,
      ['calma', 'desahogo', 'foco'], ['estudio', 'dormir'], ['acustica', 'orquestal'], 360,
      'user-301803379-68850866/moonlight-sonata-1st-movement-ludwig-van-beethoven'),
    S('primavera', 'La Primavera (Allegro)', 'Antonio Vivaldi', 'clasica', 1725, 'inst', ['inst'], '.55 .85 .30 .90 1 0 .85', 100,
      ['feliz', 'foco', 'motivacion'], ['estudio', 'cotidiano'], ['orquestal'], 210,
      'beleefklassiek/1-four-seasons-spring-allegro'),
    S('nuvole', 'Nuvole Bianche', 'Ludovico Einaudi', 'clasica', 2004, 'inst', ['inst'], '.20 .35 .10 1 1 0 .85', 80,
      ['calma', 'nostalgia', 'foco'], ['estudio', 'dormir', 'casa'], ['acustica'], 357,
      'ludovicoeinaudi/nuvole-bianche'),
    S('time', 'Time (Inception)', 'Hans Zimmer', 'clasica', 2010, 'inst', ['inst'], '.45 .35 .10 .40 1 0 .88', 60,
      ['motivacion', 'foco', 'nostalgia'], ['estudio', 'viaje'], ['orquestal', 'elaborada'], 275,
      'haydigital/time-hans-zimmer', 'Versión orquestal'),
    S('onesummer', "One Summer's Day", 'Joe Hisaishi', 'clasica', 2001, 'inst', ['inst'], '.20 .55 .10 .80 1 0 .80', 84,
      ['nostalgia', 'calma', 'feliz'], ['estudio', 'dormir', 'casa'], ['orquestal', 'acustica'], 240,
      'joe-hisaishi-official/one-summers-day'),

    // ---------------- Otros / variado ----------------
    S('threebirds', 'Three Little Birds', 'Bob Marley', 'otros', 1977, 'en', ['m', 'suave'], '.45 .90 .70 .60 .00 .60 .92', 74,
      ['feliz', 'calma'], ['casa', 'cotidiano', 'viaje'], ['acustica', 'bajos'], 180,
      'bobmarley876/three-little-birds'),
    S('chanchan', 'Chan Chan', 'Buena Vista Social Club', 'otros', 1997, 'es', ['m', 'suave'], '.35 .55 .60 .95 .20 .60 .80', 80,
      ['nostalgia', 'calma', 'romance'], ['casa', 'cotidiano', 'viaje'], ['acustica'], 256,
      'buena-vista-social-club/chan-chan'),
    S('carnaval', 'La Vida Es un Carnaval', 'Celia Cruz', 'otros', 1998, 'es', ['f', 'potente'], '.85 .95 .90 .60 .00 .70 .90', 100,
      ['feliz', 'motivacion'], ['fiesta', 'cotidiano'], ['acustica', 'orquestal'], 280,
      'celia-cruz-official/la-vida-es-un-carnaval-en-vivo', 'En vivo · 1999'),
    S('dynamite', 'Dynamite', 'BTS', 'otros', 2020, 'en', ['m'], '.80 .95 .85 .10 .00 .40 .93', 114,
      ['feliz', 'motivacion'], ['fiesta', 'ejercicio', 'cotidiano'], ['electronica', 'elaborada'], 199,
      'user-206388608/bts-dynamite-official-audio'),
    S('alorsondanse', 'Alors on danse', 'Stromae', 'otros', 2010, 'otro', ['m', 'fx'], '.85 .45 .90 .00 .20 .60 .85', 120,
      ['adrenalina', 'desahogo'], ['fiesta', 'ejercicio'], ['electronica', 'bajos'], 200,
      'stromae/alors-on-danse'),
  ];

  // Video de YouTube de cada canción (canal oficial del artista, disquera,
  // VEVO o "- Topic"). Todos se revisaron con el oEmbed de YouTube para
  // confirmar que permiten insertarse en otras páginas.
  const YT = {
    levitating: 'TUVcZfQe-Kw', billiejean: 'Zi_XLOBDo_Y', hipsdontlie: 'DUT5rEU6pqM', shapeofyou: 'JGwWNGJdvx8',
    dancingqueen: 'xFrGuyw1V8s', flowers: 'G7KNmW9a75Y', bzrp53: 'CocEMWdc7Ck', bohemian: 'fJ9rUzIMcZQ',
    teenspirit: 'hTWKbfoikeg', musicaligera: 'T_FkEw27XJ0', doiwannaknow: 'bpOSxM0rNPM', celula: 'NxFEyQ8D1GM',
    labiosrotos: '7h2ryr_uUEs', believer: '7wtfhZwyrcc', titi: 'Cr8K88UcO0s', gasolina: 'CCF1_jI8Prk',
    tusa: 'tbneQDc2H3I', tododeti: 'CFPLIaMpGrY', californialove: 'J7_bMdYfSws', loseyourself: 'xFYQQPAOz7Y',
    feelgood: 'HyHNuVaZJ-k', selfcare: 'SsKT0s5J8ko', esepico: 'sq6oc066w14', levels: '_ovdm2yX4MA',
    momentapart: 'xarC5jAiO7w', kerala: 'S0Q4gqBUs7c', firestone: '9Sc-ir2UwGU', aruarian: 'qYcoJpqCha4',
    volver: 'NPg_jbGYzgA', ellabaila: 'OAdErROwTEE', unx100to: '3inw26U-os4', adiosamor: 'ETLoTxVVvjM',
    nuncaessuficiente: 'rJAZtuQqerE', querida: 'AQOJ4qF0alk', blindinglights: '4NRXx6U8ABQ', thinkin: '6JHu3b-pbh8',
    letsgetiton: 'AqPBfbLoF_M', backtoblack: 'TJAfLE39ZZ8', getyou: 'uQFVqltOXRg', killbill: 'MSRcC626prw',
    hastalaraiz: 'IKmPci5VXz0', skinnylove: '95FyXUHv8hk', lessiknow: 'sBzrzS1Ag_g', loquesiento: 'AjGkbFqi67c',
    takemetochurch: 'PVjiKRfKpPI', tufalta: 'WT-VE9OyAJk', sowhat: 'ylXk1LBvIqU', takefive: '-DHuW1h1wHw',
    atlast: 'cZag0E32is0', thrillisgone: 'kpC69qIe02E', dontknowwhy: 'tO4dxvguQDk', wonderfulworld: 'rBrd_3VMC3c',
    clairdelune: '-Bxpm0EmOMU', moonlight: '21EU31SqQEg', primavera: 'bQujhuIst5E', nuvole: 'sR2W2scFS4Y',
    time: 'WxNbZLh0PaA', onesummer: 'TK1Ij_-mank', threebirds: 'HNBCVM4KbUM', chanchan: 'fE4Sf7vXgbo',
    carnaval: '7Ho86ggAVrY', dynamite: 'gdZLi9oWNZg', alorsondanse: 'VHoT4N43jK8',
  };
  CATALOG.forEach(s => { s.yt = YT[s.id] || null; });

  // Géneros con color (también se usan para pintar el visualizador).
  const GENRES = {
    pop:         { name: 'Pop',                 color: '#ff5fa2' },
    rock:        { name: 'Rock / alternativo',  color: '#ff6b3d' },
    urbano:      { name: 'Reggaetón / urbano',  color: '#ffc93d' },
    hiphop:      { name: 'Hip-hop / rap',       color: '#c2f03d' },
    electronica: { name: 'Electrónica',         color: '#3df5ff' },
    regional:    { name: 'Regional mexicano',   color: '#ff9a3d' },
    rnb:         { name: 'R&B / soul',          color: '#b26bff' },
    indie:       { name: 'Indie / folk',        color: '#6bffb0' },
    jazz:        { name: 'Jazz / blues',        color: '#ffd98a' },
    clasica:     { name: 'Clásica / instrumental', color: '#9ec5ff' },
    otros:       { name: 'Otros / variado',     color: '#ff8af0' },
  };

  // Afinidad entre géneros (0..1): "varios géneros similares" la usa.
  const GENRE_AFFINITY = {
    pop:         { urbano: .6, rnb: .6, electronica: .5, indie: .4, rock: .3, otros: .4 },
    rock:        { indie: .7, pop: .3, hiphop: .2 },
    urbano:      { pop: .6, hiphop: .6, regional: .3, otros: .4, electronica: .3 },
    hiphop:      { urbano: .6, rnb: .6, electronica: .4, jazz: .2 },
    electronica: { pop: .5, hiphop: .4, otros: .3, clasica: .2 },
    regional:    { otros: .5, urbano: .3, indie: .3, pop: .2 },
    rnb:         { hiphop: .6, pop: .6, jazz: .5, indie: .3 },
    indie:       { rock: .7, pop: .4, rnb: .3, regional: .3, jazz: .2 },
    jazz:        { rnb: .5, clasica: .5, indie: .2, otros: .3 },
    clasica:     { jazz: .5, electronica: .2, indie: .2 },
    otros:       { regional: .5, urbano: .4, pop: .4, jazz: .3, electronica: .3 },
  };

  window.SR = window.SR || {};
  window.SR.CATALOG = CATALOG;
  window.SR.GENRES = GENRES;
  window.SR.GENRE_AFFINITY = GENRE_AFFINITY;
  window.SR.decadeOf = decadeOf;
})();
