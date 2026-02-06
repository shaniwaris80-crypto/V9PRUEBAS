/* patches/pdf-cloud-upload.js
   PDF + Nube (Storage) sin tocar el core:
   - Captura el Blob PDF cuando tu app genera el PDF (createObjectURL)
   - Sube a Firebase Storage
   - Guarda pdfUrl/pdfPath en la factura (LocalStorage)
   Requisitos:
   - Estar logueado en Firebase Auth (tu modal Cloud)
*/

(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_PATCH__) return;
  window.__FM_PDF_CLOUD_PATCH__ = true;

  const $ = (s, r=document) => r.querySelector(s);

  // ===== Ajusta aquí si tu botón tiene otro selector =====
  const PDF_CLOUD_SELECTORS = [
    '#btnPdfCloud', '#btnPDFCloud', '#btnPdfNube', '#btnPDFNube',
    '[data-action="pdfcloud"]', '[data-action="pdf+nube"]', '[data-action="pdfnube"]',
    '.btnPdfCloud', '.btnPDFCloud'
  ];

  // Firebase modular CDN
  const [appMod, authMod, storageMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js")
  ]);

  const { initializeApp, getApps, getApp } = appMod;
  const { getAuth } = authMod;
  const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = storageMod;

  // TU CONFIG (igual que el test)
  const firebaseConfig = {
    apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
    authDomain: "factumiral.firebaseapp.com",
    projectId: "factumiral",
    storageBucket: "factumiral.firebasestorage.app",
    messagingSenderId: "576821038417",
    appId: "1:576821038417:web:aba329f36563134bb01770",
    measurementId: "G-HJVL8ET49L",
    databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);

  const toast = (title, msg) => {
    try {
      if (typeof window.toast === 'function') return window.toast(title, msg);
    } catch {}
    console.log(`[${title}]`, msg);
  };

  const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

  function findInvoicesKey(){
    const candidates = [
      'factumiral_facturas', 'fm_facturas', 'arslan_v104_facturas', 'facturas'
    ];
    for (const k of candidates) if (localStorage.getItem(k)) return k;

    // fallback: buscar JSON grande que contenga FA-
    for (const k of Object.keys(localStorage)){
      const v = localStorage.getItem(k);
      if (v && v.length > 300 && v.includes('FA-') && v.includes('factur')) return k;
    }
    // fallback 2: buscar arrays con "FA-"
    for (const k of Object.keys(localStorage)){
      const v = localStorage.getItem(k);
      if (!v || v.length < 80) continue;
      if (v.includes('FA-') && v.trim().startsWith('[')) return k;
    }
    return null;
  }

  function getCurrentInvoiceNumber(){
    // intenta leer desde DOM
    const cand = [
      '#numFactura', '#facturaNum', '#facNum', '#invoiceNum',
      'input[name="numFactura"]', 'input[name="facturaNum"]'
    ];
    for (const s of cand){
      const el = $(s);
      if (el && (el.value || el.textContent)){
        const v = (el.value || el.textContent || '').trim();
        if (v) return v;
      }
    }

    // fallback: si tienes un campo visible con FA-...
    const any = Array.from(document.querySelectorAll('input,span,div'))
      .map(x => (x.value || x.textContent || '').trim())
      .find(t => /^FA-\d{12,}/.test(t));
    return any || '';
  }

  function sanitizeFileName(s){
    return (s || 'SIN-NUM')
      .replace(/[^\w\-]+/g,'_')
      .replace(/_+/g,'_')
      .slice(0, 80);
  }

  function updateInvoicePdfUrl(numFactura, pdfUrl, pdfPath){
    const k = findInvoicesKey();
    if (!k) {
      toast('PDF+Nube', 'No encuentro la key de facturas en LocalStorage');
      return false;
    }
    const list = safeParse(localStorage.getItem(k) || '[]');
    if (!Array.isArray(list)) return false;

    const findMatch = (f) => {
      const n = (f?.num || f?.numero || f?.n || f?.id || '').toString().trim();
      return n === numFactura;
    };

    const idx = list.findIndex(findMatch);
    if (idx < 0) {
      toast('PDF+Nube', `Subido OK, pero no encontré la factura ${numFactura} para guardar pdfUrl`);
      return false;
    }

    list[idx].pdfUrl = pdfUrl;
    list[idx].pdfPath = pdfPath;
    list[idx].pdfUpdatedAt = Date.now();

    localStorage.setItem(k, JSON.stringify(list));

    // Notifica (si tienes refresco por cloud)
    window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
    return true;
  }

  async function uploadPdfBlobToStorage(pdfBlob, numFactura){
    const u = auth.currentUser;
    if (!u) throw new Error('NO_AUTH');

    const safeNum = sanitizeFileName(numFactura);
    const fileName = `${safeNum}.pdf`;
    const path = `factumiral/${u.uid}/pdf/${fileName}`;

    const r = sRef(storage, path);
    await uploadBytes(r, pdfBlob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);
    return { url, path };
  }

  function findPdfCloudButton(){
    for (const s of PDF_CLOUD_SELECTORS){
      const b = $(s);
      if (b) return b;
    }
    // fallback por texto
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /pdf\s*\+\s*nube|pdf\+nube|nube/i.test((b.textContent||'').trim())) || null;
  }

  // ---- Captura del Blob cuando tu app genera PDF
  let armed = false;
  let capturedBlob = null;
  let lastArmTS = 0;

  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try{
      if (armed && blob instanceof Blob) {
        const t = (blob.type || '').toLowerCase();
        // muchos generadores ponen application/pdf, otros octet-stream
        if (t.includes('pdf') || t.includes('octet-stream')) {
          capturedBlob = blob;
        }
      }
    } catch {}
    return origCreate(blob);
  };

  async function runPdfCloudFlow(){
    const btn = findPdfCloudButton();
    if (!btn) {
      alert('No encontré el botón PDF+Nube. Dime su ID/clase y lo ajusto.');
      return;
    }

    const u = auth.currentUser;
    if (!u) {
      alert('Primero haz LOGIN en Cloud (Firebase) para poder subir a Storage.');
      $('#btnCloud')?.click();
      return;
    }

    const numFactura = getCurrentInvoiceNumber() || `FA-${Date.now()}`;
    toast('PDF+Nube', 'Preparando captura del PDF…');

    // “armar” captura
    armed = true;
    capturedBlob = null;
    lastArmTS = Date.now();

    // esperamos a que tu handler genere el PDF y llame a createObjectURL
    await new Promise(r => setTimeout(r, 900));

    armed = false;

    if (!capturedBlob) {
      alert(
        'No pude capturar el PDF.\n\n' +
        'Causa típica: tu generador NO usa createObjectURL (descarga directo).\n' +
        'Solución: dime qué librería usas (jsPDF / pdfMake) o pégame el trozo de generar PDF.'
      );
      return;
    }

    try{
      toast('PDF+Nube', 'Subiendo a Storage…');
      const { url, path } = await uploadPdfBlobToStorage(capturedBlob, numFactura);

      const ok = updateInvoicePdfUrl(numFactura, url, path);

      toast('PDF+Nube', '✅ Subido OK');
      alert(
        '✅ PDF subido a la nube.\n\n' +
        'Factura: ' + numFactura + '\n' +
        'Guardado en Storage: ' + path + '\n' +
        (ok ? 'pdfUrl guardado en la factura (Ver PDF funcionará).' : 'Subido OK, pero no pude guardar pdfUrl en esa factura.')
      );
      console.log('PDF+Nube OK', { numFactura, path, url, capturedSize: capturedBlob.size, capturedType: capturedBlob.type });
    }catch(e){
      console.error(e);
      alert('❌ Falló subida a Storage: ' + (e?.code || e?.message || e));
    }
  }

  // Engancha: en CAPTURE para armar antes de que corra tu handler del botón
  function hook(){
    const btn = findPdfCloudButton();
    if (!btn) {
      console.warn('PDF+Nube: botón no encontrado (ajusta selectors).');
      return;
    }

    btn.addEventListener('click', async () => {
      // tu handler ya generará el PDF; nosotros solo hacemos flow después
      // evitamos doble click
      if (Date.now() - lastArmTS < 1200) return;
      setTimeout(() => runPdfCloudFlow().catch(()=>{}), 50);
    }, true);

    toast('PDF+Nube', 'Patch activo ✅');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hook, { once:true });
  } else {
    hook();
  }

})();
