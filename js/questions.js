/* =========================================================================
   Cuestionario cerrado (16 preguntas).
   multi: cuántas opciones se pueden marcar (1 = selección única).
   ========================================================================= */
(function () {
  const Q = [
    {
      id: 'generos', multi: 3,
      text: '¿Qué géneros musicales te gustan más?',
      hint: 'Elige hasta 3',
      options: [
        { k: 'A', v: 'pop',         icon: 'mic-vocal', label: 'Pop' },
        { k: 'B', v: 'rock',        icon: 'guitar', label: 'Rock / alternativo' },
        { k: 'C', v: 'urbano',      icon: 'flame', label: 'Reggaetón / urbano' },
        { k: 'D', v: 'hiphop',      icon: 'headphones', label: 'Hip-hop / rap' },
        { k: 'E', v: 'electronica', icon: 'audio-waveform', label: 'Electrónica' },
        { k: 'F', v: 'regional',    icon: 'drum', label: 'Regional mexicano' },
        { k: 'G', v: 'rnb',         icon: 'heart', label: 'R&B / soul' },
        { k: 'H', v: 'indie',       icon: 'leaf', label: 'Indie / folk' },
        { k: 'I', v: 'jazz',        icon: 'disc-3', label: 'Jazz / blues' },
        { k: 'J', v: 'clasica',     icon: 'piano', label: 'Música clásica / instrumental' },
        { k: 'K', v: 'otros',       icon: 'globe', label: 'Otros / variado' },
      ],
    },
    {
      id: 'ritmo', multi: 1,
      text: '¿Qué tipo de ritmo prefieres?',
      options: [
        { k: 'A', v: 'lento',    icon: 'turtle', label: 'Lento y relajante' },
        { k: 'B', v: 'moderado', icon: 'footprints', label: 'Moderado y tranquilo' },
        { k: 'C', v: 'bailable', icon: 'party-popper', label: 'Alegre y bailable' },
        { k: 'D', v: 'rapido',   icon: 'zap', label: 'Rápido e intenso' },
        { k: 'E', v: 'animo',    icon: 'drama', label: 'Depende de mi estado de ánimo' },
      ],
    },
    {
      id: 'valora', multi: 1,
      text: '¿Qué es lo que más valoras de una canción?',
      options: [
        { k: 'A', v: 'letra',      icon: 'file-text', label: 'La letra y su significado' },
        { k: 'B', v: 'melodia',    icon: 'music', label: 'La melodía' },
        { k: 'C', v: 'beat',       icon: 'drum', label: 'El ritmo y el beat' },
        { k: 'D', v: 'voz',        icon: 'mic', label: 'La voz del cantante' },
        { k: 'E', v: 'produccion', icon: 'sliders-horizontal', label: 'Los instrumentos y la producción' },
        { k: 'F', v: 'emocion',    icon: 'heart-pulse', label: 'La emoción que me transmite' },
      ],
    },
    {
      id: 'voz', multi: 1,
      text: '¿Qué tipo de voz prefieres?',
      options: [
        { k: 'A', v: 'm',       icon: 'user', label: 'Voces masculinas' },
        { k: 'B', v: 'f',       icon: 'user-round', label: 'Voces femeninas' },
        { k: 'C', v: 'ambas',   icon: 'users', label: 'Ambas por igual' },
        { k: 'D', v: 'suave',   icon: 'feather', label: 'Voces suaves y delicadas' },
        { k: 'E', v: 'potente', icon: 'megaphone', label: 'Voces potentes y expresivas' },
        { k: 'F', v: 'fx',      icon: 'bot', label: 'Voces distorsionadas o efectos vocales' },
        { k: 'G', v: 'inst',    icon: 'piano', label: 'Prefiero música instrumental' },
      ],
    },
    {
      id: 'emociones', multi: 2,
      text: '¿Qué emociones buscas sentir cuando escuchas música?',
      hint: 'Elige hasta 2',
      options: [
        { k: 'A', v: 'feliz',      icon: 'smile', label: 'Felicidad' },
        { k: 'B', v: 'calma',      icon: 'wind', label: 'Tranquilidad' },
        { k: 'C', v: 'nostalgia',  icon: 'sunset', label: 'Nostalgia' },
        { k: 'D', v: 'motivacion', icon: 'trophy', label: 'Motivación' },
        { k: 'E', v: 'desahogo',   icon: 'cloud-rain', label: 'Tristeza o desahogo emocional' },
        { k: 'F', v: 'romance',    icon: 'heart', label: 'Romance' },
        { k: 'G', v: 'adrenalina', icon: 'zap', label: 'Adrenalina o intensidad' },
        { k: 'H', v: 'foco',       icon: 'target', label: 'Concentración' },
      ],
    },
    {
      id: 'situacion', multi: 2,
      text: '¿En qué situación escuchas música con mayor frecuencia?',
      hint: 'Elige hasta 2',
      options: [
        { k: 'A', v: 'estudio',   icon: 'book-open', label: 'Estudiando o trabajando' },
        { k: 'B', v: 'ejercicio', icon: 'dumbbell', label: 'Haciendo ejercicio' },
        { k: 'C', v: 'viaje',     icon: 'bus', label: 'Viajando o en el transporte' },
        { k: 'D', v: 'fiesta',    icon: 'party-popper', label: 'En fiestas o reuniones' },
        { k: 'E', v: 'casa',      icon: 'sofa', label: 'Descansando en casa' },
        { k: 'F', v: 'dormir',    icon: 'moon', label: 'Antes de dormir' },
        { k: 'G', v: 'cotidiano', icon: 'list-checks', label: 'Mientras realizo tareas cotidianas' },
      ],
    },
    {
      id: 'decadas', multi: 3,
      text: '¿Qué décadas musicales prefieres?',
      hint: 'Elige hasta 3',
      options: [
        { k: 'A', v: 'pre70',  icon: 'radio', label: 'Antes de los años 70' },
        { k: 'B', v: '70s80s', icon: 'disc', label: 'Años 70 y 80' },
        { k: 'C', v: '90s',    icon: 'cassette-tape', label: 'Años 90' },
        { k: 'D', v: '00s',    icon: 'disc-3', label: 'Años 2000' },
        { k: 'E', v: '10s',    icon: 'smartphone', label: 'Años 2010' },
        { k: 'F', v: '20s',    icon: 'rocket', label: 'Años 2020 en adelante' },
        { k: 'G', v: 'any',    icon: 'infinity', label: 'No tengo preferencia por una época', exclusive: true },
      ],
    },
    {
      id: 'letra', multi: 1,
      text: '¿Qué tan importante es la letra de una canción para ti?',
      options: [
        { k: 'A', v: 'muy',    icon: 'heart', label: 'Muy importante; me identifico con ella' },
        { k: 'B', v: 'media',  icon: 'scale', label: 'Importante, pero también me importa el sonido' },
        { k: 'C', v: 'igual',  icon: 'meh', label: 'Me da igual mientras me guste la canción' },
        { k: 'D', v: 'poca',   icon: 'volume-1', label: 'Prefiero canciones con pocas letras' },
        { k: 'E', v: 'inst',   icon: 'piano', label: 'Prefiero música instrumental' },
      ],
    },
    {
      id: 'idioma', multi: 1,
      text: '¿Qué idioma prefieres escuchar en la música?',
      options: [
        { k: 'A', v: 'es',    icon: 'txt:ES', label: 'Español' },
        { k: 'B', v: 'en',    icon: 'txt:EN', label: 'Inglés' },
        { k: 'C', v: 'es_en', icon: 'languages', label: 'Español e inglés por igual' },
        { k: 'D', v: 'otro',  icon: 'globe', label: 'Otros idiomas' },
        { k: 'E', v: 'any',   icon: 'handshake', label: 'No tengo preferencia' },
      ],
    },
    {
      id: 'descubrir', multi: 1,
      text: '¿Qué tan dispuesto estás a descubrir artistas nuevos?',
      options: [
        { k: 'A', v: 'favoritos', icon: 'star', label: 'Prefiero escuchar mis artistas favoritos' },
        { k: 'B', v: 'mezcla',    icon: 'shuffle', label: 'Me gusta combinar artistas conocidos y nuevos' },
        { k: 'C', v: 'nuevos',    icon: 'telescope', label: 'Me encanta descubrir artistas nuevos' },
        { k: 'D', v: 'generos',   icon: 'compass', label: 'Me gusta explorar géneros que nunca he escuchado' },
      ],
    },
    {
      id: 'produccion', multi: 1,
      text: '¿Qué tipo de producción musical prefieres?',
      options: [
        { k: 'A', v: 'acustica',    icon: 'guitar', label: 'Acústica y natural' },
        { k: 'B', v: 'electronica', icon: 'cpu', label: 'Electrónica y sintetizada' },
        { k: 'C', v: 'bajos',       icon: 'speaker', label: 'Potente, con bajos marcados' },
        { k: 'D', v: 'orquestal',   icon: 'music-2', label: 'Instrumental y orquestal' },
        { k: 'E', v: 'lofi',        icon: 'coffee', label: 'Lo-fi y ambiental' },
        { k: 'F', v: 'elaborada',   icon: 'gem', label: 'Una producción elaborada, con muchos detalles' },
        { k: 'G', v: 'any',         icon: 'handshake', label: 'No tengo preferencia' },
      ],
    },
    {
      id: 'popularidad', multi: 1,
      text: '¿Qué tan popular te gusta que sea la música que escuchas?',
      options: [
        { k: 'A', v: 'hits',   icon: 'trending-up', label: 'Prefiero éxitos populares y canciones virales' },
        { k: 'B', v: 'mezcla', icon: 'dice-5', label: 'Escucho una mezcla de éxitos y canciones menos conocidas' },
        { k: 'C', v: 'indie',  icon: 'search', label: 'Prefiero artistas independientes o poco conocidos' },
        { k: 'D', v: 'any',    icon: 'handshake', label: 'No me importa la popularidad' },
      ],
    },
    {
      id: 'variedad', multi: 1,
      text: '¿Qué tan variada quieres que sea tu playlist?',
      options: [
        { k: 'A', v: 'uno',       icon: 'crosshair', label: 'Un solo género musical' },
        { k: 'B', v: 'similares', icon: 'puzzle', label: 'Varios géneros similares' },
        { k: 'C', v: 'mezcla',    icon: 'palette', label: 'Una mezcla de géneros diferentes' },
        { k: 'D', v: 'todo',      icon: 'tornado', label: 'Una mezcla inesperada de todo tipo de música' },
      ],
    },
    {
      id: 'parecido', multi: 1,
      text: '¿Qué tan parecido a tus gustos actuales quieres que sea el contenido de la playlist?',
      options: [
        { k: 'A', v: 'muy',       icon: 'target', label: 'Muy parecido a lo que ya escucho' },
        { k: 'B', v: 'similar',   icon: 'plus', label: 'Similar, pero con algunas canciones nuevas' },
        { k: 'C', v: 'diferente', icon: 'refresh-cw', label: 'Quiero descubrir música diferente' },
        { k: 'D', v: 'sorpresa',  icon: 'gift', label: 'Quiero que la IA me sorprenda por completo' },
      ],
    },
    {
      id: 'duracion', multi: 1,
      text: '¿Cuánto tiempo quieres que dure tu playlist?',
      options: [
        { k: 'A', v: 25,  icon: 'timer', label: '15–30 minutos' },
        { k: 'B', v: 45,  icon: 'clock-3', label: '30–60 minutos' },
        { k: 'C', v: 90,  icon: 'clock-6', label: '1–2 horas' },
        { k: 'D', v: 150, icon: 'clock-9', label: 'Más de 2 horas' },
      ],
    },
    {
      id: 'animo', multi: 1,
      text: '¿Cómo te sientes en este momento?',
      hint: 'La IA ajusta la energía y el tono de la playlist a tu estado de ánimo',
      options: [
        { k: 'A', v: 'feliz',      icon: 'smile', label: 'Feliz' },
        { k: 'B', v: 'triste',     icon: 'frown', label: 'Triste' },
        { k: 'C', v: 'estresado',  icon: 'cloud-lightning', label: 'Estresado o ansioso' },
        { k: 'D', v: 'enojado',    icon: 'angry', label: 'Enojado' },
        { k: 'E', v: 'cansado',    icon: 'battery-low', label: 'Cansado' },
        { k: 'F', v: 'enamorado',  icon: 'heart', label: 'Enamorado' },
        { k: 'G', v: 'nostalgico', icon: 'sunset', label: 'Nostálgico' },
        { k: 'H', v: 'motivado',   icon: 'rocket', label: 'Motivado' },
        { k: 'I', v: 'aburrido',   icon: 'meh', label: 'Aburrido' },
        { k: 'J', v: 'tranquilo',  icon: 'feather', label: 'Tranquilo' },
      ],
    },
  ];

  // Pregunta extra del "modo emoción".
  const META = {
    id: 'meta', multi: 1,
    text: '¿Qué quieres que haga la música con lo que sientes?',
    options: [
      { k: 'A', v: 'acompanar', icon: 'handshake', label: 'Acompañar cómo me siento' },
      { k: 'B', v: 'cambiar',   icon: 'rainbow', label: 'Cambiar o mejorar mi ánimo' },
    ],
  };

  const byId = Object.fromEntries(Q.map(q => [q.id, q]));
  byId.meta = META;

  window.SR = window.SR || {};
  window.SR.QUESTIONS = Q;
  window.SR.QBY = byId;
  // Modo emoción: ánimo + qué hacer con él + duración.
  window.SR.EMOTION_FLOW = [byId.animo, META, byId.duracion];
})();
