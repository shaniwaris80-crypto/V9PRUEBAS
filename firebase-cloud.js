/* =========================================================
   cloud-bridge.js — MANUAL ONLY (NO AUTO RELOAD)
   - No recarga automáticamente
   - Muestra banner "Cambios listos" + botón "Actualizar"
   - Bloquea recargas mientras escribes (si algún código intenta recargar)
========================================================= */
(() => {
  'use strict';

  const BANNER_ID = 'fmCloudBannerManual';
  let pending = false;
  let count = 0;
  let lastAt = 0;

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
        ☁️ Cambios de Cloud listos
        <div id="fmCloudBannerSub" style="font:12px system-ui;font-weight:700;opacity:.75;margin-top:2px"></div>
      </div>
      <button id="fmCloudApply" type="button"
        style="border:1px solid #111;background:#111;color:#fff;border-radius:12px;padding:10px 12px;font:900 13px system-ui">
        Actualizar
      </button>
      <button id="fmCloudDismiss" type="button"
        style="border:1px solid #111;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:900 13px system-ui">
        Ocultar
      </button>
    `;
    document.body.appendChild(b);

    b.querySelector('#fmCloudApply').addEventListener('click', () => {
      // Solo el usuario decide recargar
      try { window.__fmRealReload__ ? window.__fmRealReload__() : location.reload(); }
      catch { location.reload(); }
    });

    b.querySelector('#fmCloudDismiss').addEventListener('click', () => {
      b.remove(); // ocultar banner, pero sigue habiendo cambios pendientes
    });

    return b;
  }

  function updateBanner(){
    const b = ensureBanner();
    const sub = b.querySelector('#fmCloudBannerSub');
    const seconds = lastAt ? Math.round((Date.now() - lastAt)/1000) : 0;
    sub.textContent = `Pendientes: ${count} · Último cambio hace ${seconds}s · (no se recarga solo)`;
  }

  // ✅ Bloquear recargas mientras escribes (por si algún script intenta reload)
  try{
    const real = window.location.reload.bind(window.location);
    if (!window.__fmRealReload__) window.__fmRealReload__ = real;

    // Ojo: en algunos navegadores Location.reload puede no ser reasignable; si falla, no pasa nada
    window.location.reload = function(){
      if (isTypingNow()){
        pending = true;
        count++;
        lastAt = Date.now();
        updateBanner();
        return;
      }
      return real();
    };
  } catch {}

  // ✅ Cuando llega un cambio desde cloud
  window.addEventListener('fmcloud:changed', () => {
    pending = true;
    count++;
    lastAt = Date.now();
    updateBanner();
  });

  // Opcional: si quieres un indicador pequeño incluso sin banner,
  // déjalo así (ya está con banner).
})();
