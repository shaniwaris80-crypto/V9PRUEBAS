/* =========================================================
   cloud-bridge.js — REFRESH SUAVE (no corta escritura)
   - Muestra aviso "Hay cambios"
   - Recarga solo si estás inactivo X segundos y NO escribiendo
========================================================= */
(() => {
  'use strict';

  const AUTO_RELOAD_WHEN_IDLE = true;   // pon false si quieres SOLO botón
  const IDLE_MS = 9000;                 // 9s sin tocar nada => puede recargar
  const CHECK_EVERY_MS = 800;           // chequeo
  const MIN_BETWEEN_RELOAD_MS = 20000;  // evita loops

  const BANNER_ID = 'fmCloudBanner';
  let pending = false;
  let lastUserActionAt = Date.now();
  let timer = null;
  let lastReloadAt = 0;

  function markUserAction() { lastUserActionAt = Date.now(); }

  // Detecta actividad del usuario (escritura/touch/click)
  ['input','keydown','pointerdown','touchstart','focusin','scroll'].forEach(ev => {
    document.addEventListener(ev, markUserAction, true);
  });

  function isTypingNow(){
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function ensureBanner(){
    let b = document.getElementById(BANNER_ID);
    if (b) return b;

    b = document.createElement('div');
    b.id = BANNER_ID;
    b.style.cssText =
      "position:fixed;left:10px;right:10px;top:10px;z-index:999999;" +
      "border:1px solid #111;background:#fff;border-radius:14px;padding:10px 12px;" +
      "box-shadow:0 12px 26px rgba(0,0,0,.18);display:flex;gap:10px;align-items:center;";

    b.innerHTML = `
      <div style="flex:1;font:900 13px system-ui;color:#111">
        ☁️ Hay cambios de Cloud listos
        <div style="font:12px system-ui;font-weight:600;opacity:.75;margin-top:2px">
          No se aplican en pantalla hasta actualizar.
        </div>
      </div>
      <button id="fmCloudApply" type="button"
        style="border:1px solid #111;background:#111;color:#fff;border-radius:12px;padding:10px 12px;font:900 13px system-ui">
        Actualizar
      </button>
      <button id="fmCloudDismiss" type="button"
        style="border:1px solid #111;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:900 13px system-ui">
        Cerrar
      </button>
    `;
    document.body.appendChild(b);

    b.querySelector('#fmCloudApply').addEventListener('click', () => doReload());
    b.querySelector('#fmCloudDismiss').addEventListener('click', () => {
      pending = false;
      b.remove();
    });

    return b;
  }

  function scheduleCheck(){
    clearTimeout(timer);
    timer = setTimeout(checkReload, CHECK_EVERY_MS);
  }

  function doReload(){
    if (Date.now() - lastReloadAt < MIN_BETWEEN_RELOAD_MS) return;
    lastReloadAt = Date.now();
    pending = false;
    const b = document.getElementById(BANNER_ID);
    if (b) b.remove();
    location.reload();
  }

  function checkReload(){
    if (!pending) return;

    // Si estás escribiendo, NO recargar
    if (isTypingNow()) return scheduleCheck();

    // Si el usuario estuvo activo hace poco, NO recargar
    const idle = Date.now() - lastUserActionAt;
    if (idle < IDLE_MS) return scheduleCheck();

    if (AUTO_RELOAD_WHEN_IDLE) doReload();
  }

  window.addEventListener('fmcloud:changed', (e) => {
    pending = true;
    ensureBanner();

    // “Hack” útil: si tu app escucha el evento storage, lo forzamos
    try{
      const k = e?.detail?.key || null;
      window.dispatchEvent(new StorageEvent('storage', {
        key: k,
        newValue: k ? localStorage.getItem(k) : null,
        storageArea: localStorage,
        url: location.href
      }));
    }catch{}

    scheduleCheck();
  });
})();
