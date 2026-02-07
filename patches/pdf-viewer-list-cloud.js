/* =========================================================
   patches/pdf-viewer-list-cloud.js
   - Arregla "Ver PDF" en lista de facturas
   - Prioriza PDF en Cloud (RTDB->pdf.url) si existe
   - Si no hay Cloud, intenta abrir el PDF local en el visor (#pdfModal)
   - NO toca app.js
========================================================= */
(() => {
  'use strict';
  if (window.__FM_PDF_LIST_CLOUD_V1__) return;
  window.__FM_PDF_LIST_CLOUD_V1__ = true;

  const FIREBASE_VER = '12.8.0';
  const $ = (s, r=document) => r.querySelector(s);

  // ---------- LocalStorage helpers ----------
  function lsFindKey(subs) {
    const keys = Object.keys(localStorage);
    const low = subs.map(s => s.toLowerCase());
    return keys.find(k => low.some(x => k.toLowerCase().includes(x))) || null;
  }
  function lsGetJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; }
    catch { return fallback; }
  }

  const LS_FACT = lsFindKey(['facturas','factura','invoices']);

  // ---------- Detectar nº factura desde un item del listado ----------
  function detectFacturaIdFromNode(node) {
    if (!node) return '';

    // 1) datasets típicos
    const ds = node.dataset || {};
    const cand = ds.id || ds.factura || ds.facturaId || ds.num || ds.numero || ds.invoice || ds.invoiceId;
    if (cand) return String(cand).trim();

    // 2) buscar FA-... en texto
    const txt = (node.textContent || '').toUpperCase();
    const m = txt.match(/FA[-\s]?\d[\w-]*/);
    if (m) return m[0].replace(/\s+/g,'').replace('FA', 'FA-').replace('FA--','FA-').trim();

    return '';
  }

  function findFacturaInLocal(id) {
    if (!LS_FACT) return null;
    const arr = lsGetJSON(LS_FACT, []);
    const s = String(id || '').trim();
    if (!s) return null;

    return arr.find(f => {
      const num = (f?.numFactura || f?.numero || f?.num || f?.facNumero || f?.n || f?.id || '').toString().trim();
      return num === s;
    }) || null;
  }

  // ---------- Visor PDF interno (tu #pdfModal) ----------
  function openPdfInModal(urlOrBlobUrl) {
    const modal = $('#pdfModal');
    const obj = $('#pdfObject');
    const frame = $('#pdfFrame');

    if (modal) modal.classList.remove('is-hidden');

    if (obj) obj.setAttribute('data', urlOrBlobUrl || '');
    if (frame) frame.setAttribute('src', urlOrBlobUrl || '');

    // botón cerrar (si no está enganchado por app)
    $('#btnPdfCerrar')?.addEventListener('click', () => modal?.classList.add('is-hidden'), { once:false });
  }

  // ---------- Firebase (leer pdf.url desde RTDB) ----------
  let FB = null;

  function readConfigFromUI() {
    const apiKey = ($('#fbApiKey')?.value || '').trim();
    const authDomain = ($('#fbAuthDomain')?.value || '').trim();
    const databaseURL = ($('#fbDbUrl')?.value || '').trim();
    const projectId = ($('#fbProjectId')?.value || '').trim();
    const appId = ($('#fbAppId')?.value || '').trim();
    const storageBucket = ($('#fbStorage')?.value || '').trim();

    // si no está en UI, usamos tu config fija (fallback)
    const fallback = {
      apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
      authDomain: "factumiral.firebaseapp.com",
      projectId: "factumiral",
      storageBucket: "factumiral.firebasestorage.app",
      messagingSenderId: "576821038417",
      appId: "1:576821038417:web:aba329f36563134bb01770",
      measurementId: "G-HJVL8ET49L",
      databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
    };

    if (!apiKey || !authDomain || !databaseURL || !projectId || !appId) return fallback;

    return { apiKey, authDomain, databaseURL, projectId, appId, storageBucket: storageBucket || undefined };
  }

  async function getFirebase() {
    if (FB) return FB;

    const [appMod, authMod, dbMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-database.js`),
    ]);

    const { initializeApp, getApps, getApp } = appMod;
    const { getAuth, signInWithEmailAndPassword } = authMod;
    const { getDatabase, ref, get, child } = dbMod;

    const cfg = readConfigFromUI();
    const app = getApps().length ? getApp() : initializeApp(cfg);
    const auth = getAuth(app);
    const db = getDatabase(app);

    FB = { auth, db, signInWithEmailAndPassword, ref, get, child };
    return FB;
  }

  async function ensureLogin() {
    const { auth, signInWithEmailAndPassword } = await getFirebase();
    if (auth.currentUser) return auth.currentUser;

    // intenta abrir tu modal cloud si existe
    $('#btnCloud')?.click();

    const email = prompt('Email Firebase (Cloud):');
    const pass  = prompt('Contraseña:');
    if (!email || !pass) throw new Error('Login cancelado');
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }

  async function getCloudPdfUrl(facturaId) {
    const { db, ref, get, child } = await getFirebase();
    const u = await ensureLogin();
    const root = `factumiral/${u.uid}/facturas/${encodeURIComponent(String(facturaId))}/pdf`;
    const snap = await get(child(ref(db), root));
    const v = snap.val();
    return v?.url || '';
  }

  // ---------- Detectar click en "Ver PDF" dentro del listado ----------
  function isVerPdfClick(target) {
    const el = target?.closest?.('button,a');
    if (!el) return false;

    const id = (el.id || '').toLowerCase();
    const txt = (el.textContent || '').toLowerCase();
    const act = (el.dataset?.action || '').toLowerCase();

    // cubrimos distintos nombres
    if (id.includes('verpdf')) return true;
    if (act.includes('verpdf') || act.includes('pdf')) return true;
    if (txt.includes('ver pdf')) return true;

    return false;
  }

  function findItemRoot(target) {
    // intenta subir a contenedor de item
    return target.closest?.('.listItem, .item, .row, .card, [data-id], [data-factura], [data-num]') || target.closest?.('#facturasList > *') || null;
  }

  async function handleVerPdfFromListClick(e) {
    const btn = e.target.closest?.('button,a');
    if (!btn) return;

    const item = findItemRoot(btn) || btn.parentElement;
    const facturaId = detectFacturaIdFromNode(item);

    if (!facturaId) {
      alert('No pude detectar el Nº de factura en este item.');
      return;
    }

    // 1) si hay pdfUrl guardado en local factura, abrirlo directo
    const f = findFacturaInLocal(facturaId);
    const localUrl = f?.pdfUrl || f?.pdfCloudUrl || f?.pdf?.url || '';
    if (localUrl) {
      openPdfInModal(localUrl);
      return;
    }

    // 2) pedir a cloud (si existe)
    try {
      const cloudUrl = await getCloudPdfUrl(facturaId);
      if (cloudUrl) {
        openPdfInModal(cloudUrl);

        // opcional: guardar en localStorage para próximas veces
        try {
          if (f && LS_FACT) {
            const arr = lsGetJSON(LS_FACT, []);
            const idx = arr.findIndex(x => {
              const num = (x?.numFactura || x?.numero || x?.num || x?.facNumero || x?.n || x?.id || '').toString().trim();
              return num === facturaId;
            });
            if (idx >= 0) {
              arr[idx].pdfUrl = cloudUrl;
              localStorage.setItem(LS_FACT, JSON.stringify(arr));
            }
          }
        } catch {}

        return;
      }
    } catch (err) {
      console.warn('Cloud PDF error:', err);
    }

    alert('No hay PDF en Cloud para esta factura. Sube primero con "PDF + Nube".');
  }

  // ---------- Añadir botón extra "PDF Cloud" en cada item (opcional) ----------
  function injectButtonsIfMissing() {
    const list = $('#facturasList');
    if (!list) return;

    const items = Array.from(list.children || []);
    items.forEach(item => {
      if (!(item instanceof HTMLElement)) return;
      if (item.querySelector('.fmPdfCloudBtn')) return;

      const id = detectFacturaIdFromNode(item);
      if (!id) return;

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--ghost fmPdfCloudBtn';
      b.textContent = 'PDF Cloud';
      b.style.cssText = 'margin-left:8px;border:1px solid #111;border-radius:12px;padding:8px 10px;font-weight:900;';
      b.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          const url = await getCloudPdfUrl(id);
          if (!url) return alert('No hay PDF en Cloud para esta factura.');
          openPdfInModal(url);
        } catch (e2) {
          alert('Error Cloud: ' + (e2?.message || e2));
        }
      });

      // intenta ponerlo al final del item sin romper estilos
      item.appendChild(b);
    });
  }

  function startObserver() {
    const list = $('#facturasList');
    if (!list) return;

    const mo = new MutationObserver(() => injectButtonsIfMissing());
    mo.observe(list, { childList:true, subtree:false });
    injectButtonsIfMissing();
  }

  // ---------- Init ----------
  document.addEventListener('click', (e) => {
    if (!isVerPdfClick(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handleVerPdfFromListClick(e);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    startObserver();
    // por si el listado se pinta tarde
    let n = 0;
    const t = setInterval(() => {
      injectButtonsIfMissing();
      if (++n > 25) clearInterval(t);
    }, 400);
  });

})();
