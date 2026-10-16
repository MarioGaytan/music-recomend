# SonIA · Recomendador musical con IA

Práctica 9 (Periodo 2, Práctica 3) · Tópicos de IA

Proyecto en equipo: **Mario Gaytán**, **Rosario Rosas** y **Jorge Robles**.

SonIA es una página web en la que respondes preguntas cerradas sobre tus gustos y tu estado de ánimo. Con esas respuestas, nuestro algoritmo de IA arma una playlist a tu medida, la reproduce con **SoundCloud** y mueve un visualizador de barras estéreo al ritmo de la música. Si marcas 👍 o 👎, la IA aprende de ti y recalcula la playlist.

**▶ Demo en línea:** `https://mariogaytan.github.io/Practica9_Topicos_IA/` (si el repositorio se llama así; ver [Publicar en GitHub Pages](#publicar-en-github-pages)).

---

## Qué hicimos

| Parte | Qué hace |
|---|---|
| **Cuestionario** | Las 15 preguntas cerradas que definimos, más una 16.ª: *¿Cómo te sientes en este momento?* |
| **Modo emoción** | Un camino rápido de 3 preguntas: cómo te sientes, si quieres que la música te **acompañe** o te **cambie** el ánimo, y cuánto debe durar. |
| **Motor de IA** | Filtrado basado en contenido + MMR + aprendizaje con Rocchio (detalle abajo). |
| **Catálogo** | 63 canciones de los 11 géneros del cuestionario. Revisamos cada enlace de SoundCloud y la mayoría son subidas oficiales del artista o de su disquera. |
| **Reproductor** | Widget API oficial de SoundCloud: reproducir, pausar, siguiente, barra de progreso, volumen y portada real. |
| **Visualizador** | Barras estéreo estilo LED (canal L ← centro → canal R) con picos que caen despacio y reflejo. |
| **Enviar a SoundCloud** | Copiar los enlaces, descargar la playlist en `.txt`, abrir en SoundCloud o, con el backend opcional, **guardarla como playlist en tu cuenta**. |
| **UI/UX** | Tema oscuro con efecto de vidrio, fondo animado, transiciones entre preguntas, vinilo que gira, radar de tu perfil, anillos de coincidencia, atajos de teclado y diseño para celular. |

## Cómo funciona la IA

Lo que hicimos es un **sistema de recomendación basado en contenido**. No usa una API de IA externa: todo el cálculo corre en el navegador, en `js/engine.js`.

### 1. Cada canción es un vector de rasgos

En `js/catalog.js` describimos cada canción con:

- **Rasgos numéricos (0 a 1):** energía, valencia (qué tan positiva suena), bailabilidad, acústica, instrumental, peso de la letra, popularidad y tempo (BPM normalizado).
- **Rasgos de categoría:** género, década, idioma, tipo de voz, emociones que transmite, situaciones en las que encaja y tipo de producción.

### 2. Tus respuestas se vuelven un perfil con pesos

Cada respuesta fija un **objetivo** y un **peso**. Algunos ejemplos:

| Respuesta | Efecto en el perfil |
|---|---|
| Ritmo *Alegre y bailable* | energía → 0.72 (peso 1.3), bailabilidad → 0.90 (peso 0.9) |
| Letra *Muy importante* | letra → 0.9 (peso 1.2) |
| Voz *Prefiero instrumental* | instrumental → 1.0 (peso 1.5) |
| Popularidad *Artistas independientes* | popularidad → 0.45 (peso 1.0) |
| Variedad *Un solo género* | sólo ese género (o sus afines si no alcanza la duración) |
| *Que la IA me sorprenda por completo* | más exploración y más ruido aleatorio |

Si dos respuestas tocan el mismo rasgo, los objetivos se combinan con un **promedio ponderado**.

**Ánimo (pregunta 16 y modo emoción).** Usamos el **modelo circumplejo de Russell**: cada emoción es un punto en el plano *valencia × energía*. Por ejemplo, *triste* ≈ (0.20, 0.30) y *motivado* ≈ (0.75, 0.85). En el modo emoción eliges si la música debe **acompañar** ese punto o llevarte a otro mejor; por ejemplo, *triste → cambiar* apunta a (0.65, 0.50) con emociones de calma y felicidad.

### 3. Similitud canción ↔ perfil

Para cada canción calculamos un puntaje entre 0 y 1:

```
puntaje(c) = Σ wₖ · simₖ(c) / Σ wₖ
```

- Rasgos numéricos: `sim = 1 − 1.3·|valor − objetivo|` (recortado a 0..1).
- Género: 1 si coincide. Si no, usamos una **matriz de afinidad** entre géneros (rock↔indie 0.7, urbano↔hip-hop 0.6…). Si pediste explorar, una parte del puntaje premia los géneros que **no** elegiste.
- Emociones y situaciones: pesan más si son la etiqueta principal de la canción.
- Década: 1 si coincide y 0.35 si es la década vecina.

Ese puntaje es el **% de coincidencia** que aparece en cada canción. Debajo de cada una mostramos las 3 razones que más pesaron (por ejemplo, «Reggaetón / urbano · Energía alta · Muy bailable»).

### 4. Selección con MMR (Maximal Marginal Relevance)

Escoger solo las canciones con mejor puntaje da playlists repetitivas, así que seleccionamos una por una con:

```
siguiente = argmax  λ · (puntaje(c) + T·Gumbel)  −  (1 − λ) · máx similitud(c, ya elegidas)
```

- **λ** viene de la pregunta *¿Qué tan variada quieres tu playlist?* (0.92 para un solo género y 0.45 para una mezcla inesperada).
- **T·Gumbel** es un ruido controlado que agrega sorpresa. Su tamaño sale de *¿Qué tan parecido a tus gustos?*.
- Un **umbral de relevancia** evita que se cuelen canciones que casi no coinciden contigo.
- Se agregan canciones hasta llegar a la duración elegida (15–30 min, 30–60 min, etc.).

Al final ordenamos la playlist como un **arco de energía**: empieza suave, sube a la mitad y baja al final. Si buscas calma, va bajando poco a poco.

### 5. Aprendizaje con tus votos (algoritmo de Rocchio)

Al pulsar **Aprender y regenerar**:

```
objetivo' = objetivo + β·(promedio 👍 − objetivo) − γ·(promedio 👎 − objetivo)     β = 0.45, γ = 0.2
```

También sube el peso de los géneros y emociones de lo que te gustó y baja el de lo que no. Las canciones con 👍 se quedan, las de 👎 salen y el resto se recalcula.

## SoundCloud: qué usamos y por qué

Revisamos la [guía del API de SoundCloud](https://developers.soundcloud.com/docs/api/guide):

- El **API oficial** pide `client_id` **y** `client_secret` para obtener cualquier token, también para buscar. La guía trata a todos los clientes como confidenciales, así que ese secreto **no puede ir dentro de una página pública** de GitHub Pages.
- El **Widget API** (`w.soundcloud.com/player/api.js`) **no necesita llaves** y permite reproducir, pausar, adelantar, cambiar el volumen y recibir eventos.
- El **oEmbed** público (`soundcloud.com/oembed`) tampoco necesita llaves. Lo usamos para traer la portada de cada canción y para validar que todos los enlaces del catálogo existen.

Por eso armamos el proyecto en dos capas:

1. **GitHub Pages (0 MB de RAM, lo principal):** catálogo + motor de IA + Widget + oEmbed. Funciona solo, sin servidor.
2. **Backend opcional en Railway (`/api`):** sólo si quieres **buscar canciones en vivo** en el API de SoundCloud y **guardar la playlist en tu cuenta** con OAuth 2.1 + PKCE.

### ¿Por qué las barras no leen el audio directamente?

El audio de SoundCloud suena dentro de un `iframe` de otro dominio, y el navegador no deja leer sus frecuencias. Resolvimos esto de dos formas:

- **Modo sincronizado (por defecto):** las barras se generan con la **posición real** de la canción, su **BPM** y su **energía**: bombo en cada tiempo, caja en el 2 y el 4, y hi-hats en los contratiempos. Así se mueven al ritmo de la canción.
- **Modo audio real (botón «Barras con audio real»):** compartes el audio de la pestaña (`getDisplayMedia`) y un `AnalyserNode` de Web Audio lee el **espectro real de cada canal (L y R)** con una escala logarítmica, como un ecualizador de verdad. Funciona en Chrome y Edge.

## Cómo correrlo en local

Es HTML, CSS y JS sin compilar. Basta con un servidor estático:

```bash
python -m http.server 5500
```

Luego abre `http://localhost:5500`. Si se abre con doble clic (`file://`) también funciona, pero algunos navegadores limitan el widget de SoundCloud.

> Si tu red bloquea `soundcloud.com`, la página entra en **modo demo**: todo funciona (cuestionario, IA, visualizador), pero sin audio. El indicador de la esquina superior lo avisa.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio **público** (por ejemplo `Practica9_Topicos_IA`).
2. En el repositorio entra a **Settings → Pages**.
3. En **Build and deployment → Source** elige **Deploy from a branch**, la rama **main** y la carpeta **/ (root)**. Pulsa **Save**.
4. En 1 o 2 minutos queda en `https://<usuario>.github.io/Practica9_Topicos_IA/`.

El archivo `.nojekyll` evita que GitHub procese los archivos. Cada `git push` actualiza la página.

## Backend opcional (Railway, mínima RAM)

Sólo hace falta para **guardar la playlist en tu cuenta de SoundCloud** y para la sección **Descubrimientos en vivo**. Está en `api/server.js`: es Node puro, **sin dependencias**, con las sesiones en memoria y el heap limitado a 64 MB (`--max-old-space-size=64`). Usa alrededor de 40 MB de RAM.

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | Estado del servicio |
| `GET /api/search?q=&genres=&limit=` | Busca canciones reproducibles (`GET /tracks`, token de *client credentials* reutilizado) |
| `GET /api/auth/login?return=` | Inicia OAuth 2.1 con PKCE (S256) en `secure.soundcloud.com/authorize` |
| `GET /api/auth/callback` | Cambia el código por el token y regresa a la página con la sesión |
| `POST /api/playlists` | Resuelve cada enlace (`/resolve`) y crea la playlist (`POST /playlists`) |

Pasos:

1. Registra una app en <https://soundcloud.com/you/apps> y anota el `client_id` y el `client_secret`. Como **Redirect URI** pon `https://TU-SERVICIO.up.railway.app/api/auth/callback`.
2. En Railway crea un servicio desde este repositorio con **Root Directory = `api`**. Railway detecta Node y ejecuta `npm start`.
3. Define estas variables de entorno:
   - `SC_CLIENT_ID` y `SC_CLIENT_SECRET`
   - `PUBLIC_URL` = `https://TU-SERVICIO.up.railway.app`
   - `FRONTEND_ORIGIN` = `https://<usuario>.github.io` (puedes poner varias separadas por coma)
4. En `js/config.js` pon `API_BASE: 'https://TU-SERVICIO.up.railway.app'`. Para probar sin editar, también se puede abrir la página con `?api=https://TU-SERVICIO.up.railway.app`.

> El secreto **nunca** va en el frontend: sólo vive en las variables de entorno de Railway.

## Estructura

```
practica9_recomendador_musical/
├── index.html          # Vistas: inicio, cuestionario, "IA pensando", resultados
├── css/styles.css      # Diseño, animaciones y diseño para celular
├── js/
│   ├── config.js       # API_BASE del backend opcional
│   ├── catalog.js      # 63 canciones con sus rasgos y enlaces de SoundCloud
│   ├── questions.js    # 16 preguntas cerradas + flujo del modo emoción
│   ├── engine.js       # Perfil, similitud, MMR, arco de energía, Rocchio
│   ├── player.js       # Widget API de SoundCloud (y modo demo)
│   ├── visualizer.js   # Barras estéreo sincronizadas / audio real
│   ├── api.js          # Cliente del backend opcional
│   └── app.js          # Lógica de la interfaz
├── api/
│   ├── server.js       # Backend opcional (Node sin dependencias)
│   └── package.json
└── .nojekyll
```

## Cómo lo probamos

- Corrimos el motor en Node con varios perfiles de prueba: fiesta de reguetón, estudio instrumental, rock de un solo género, «sorpréndeme» de más de 2 horas, y triste con *acompañar* y con *cambiar*. También probamos el aprendizaje con 👍/👎.
- Validamos los **63 enlaces** con el oEmbed de SoundCloud desde el navegador: todos responden.
- Reprodujimos canciones reales con el widget: suenan, traen su portada y el visualizador reacciona.
- Revisamos el diseño en escritorio y en celular (375 px), sin desbordes horizontales.
- Del backend probamos `health`, validación de `return`, el redirect a OAuth con PKCE, el CORS y el rechazo de sesiones inválidas. **No** pudimos probar la búsqueda ni el guardado contra SoundCloud real, porque requieren una app registrada con su `client_secret`.

## Limitaciones

- Los rasgos de cada canción (energía, valencia, etc.) los asignamos nosotros a mano. SoundCloud no publica métricas de audio como las de otros servicios.
- Alguna canción puede no estar disponible en ciertos países o desaparecer de SoundCloud. Si pasa, la app lo avisa y salta a la siguiente.
- Algunos navegadores bloquean la reproducción automática. En ese caso basta con pulsar ▶ una vez.

## Créditos

- Música: cada canción pertenece a sus autores y se reproduce con el reproductor oficial de SoundCloud.
- Tipografías: Outfit y Space Grotesk (Google Fonts).
- Desarrollo: **Mario Gaytán, Rosario Rosas y Jorge Robles**.
