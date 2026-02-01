/* =========================================================
   cloud-bridge.js
   Hace visible el sync sin tocar tu app.
========================================================= */
(() => {
  let t = null;
  let pending = false;

  function isTyping(){
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function doReload(){
    pending = false;
    location.reload();
  }

  window.addEventListener('fmcloud:changed', () => {
    // Si estás escribiendo, no interrumpe: espera a que salgas del input
    if (isTyping()){
      pending = true;
      return;
    }
    clearTimeout(t);
    t = setTimeout(doReload, 250);
  });

  // Cuando dejas de escribir, si había cambios pendientes, recarga
  document.addEventListener('focusout', () => {
    if (!pending) return;
    if (isTyping()) return;
    clearTimeout(t);
    t = setTimeout(doReload, 250);
  }, true);
})();
