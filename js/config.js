/* Configuración.
   API_BASE vacío  → todo corre en GitHub Pages (catálogo + Widget de SoundCloud).
   API_BASE con URL → además usa el backend opcional de /api (Railway) para
   buscar en el API oficial de SoundCloud y guardar la playlist en tu cuenta.
   Ejemplo: API_BASE: 'https://sonia-api.up.railway.app'
   También se puede pasar en la URL: ?api=https://sonia-api.up.railway.app */
window.SR_CONFIG = {
  API_BASE: '',
};
