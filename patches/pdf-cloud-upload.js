/* patches/pdf-cloud-upload.js  (V2 FIX)
   - Arma captura ANTES de que el core genere el PDF
   - Captura Blob via URL.createObjectURL
   - Sube a Firebase Storage y guarda pdfUrl en la factura (LocalStorage)
*/

(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_V2__) return;
  window.__FM_PDF_CLOUD_V2__ = true;

  const $ = (s, r=document) => r.querySelector(s);

  // ==== Ajusta si quieres (pero este patch también detecta por TEXTO) ====
  const MATCH_BTN = (btn) => {
    const t = (btn?.textContent || '').trim().toLowerCase();
    const id = (btn?.id || '').toLowerCase();
    const act = (btn?.dataset?.action || '').toLowerCase();
    // detecta "PDF+Nube", "PDF Nube", "Nube" (pero evita el botón Cloud)
    if (id.includes('cloud')) return false;
    if (act.includes('pdf') && act.includes('nube')) return true;
    if (id.includes('pdf') && (id.includes('nube') || id.includes('cloud'))) return true;
    return /pdf\s*\+\s*nube|pdf\s*nube|pdf\+nube/.test(t);
  };

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

  // Firebase (CDN)
  const [appMod, authMod, storageMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js")
  ]);

  const { initializeApp, getApps, getApp } = appMod;
  const { getAuth } = authMod;
  const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = storageMod;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);

  const log = (...a) => console.log('[PDF+NUBE V2]', ...a);

  function safeParse(raw){ try { return JSON.parse(raw); } catch { return null; } }

  function findInvoicesKey(){
    const candidates = [
      'factumiral_facturas', 'fm_facturas', 'arslan_v104_facturas', 'facturas'
    ];
    for (const k of candidates) if (localStorage.getItem(k)) return k;

    // fallback: busca JSON array con FA-
    for (const k of Object.keys(localStorage)){
      const v = localStorage.getItem(k);
      if (v && v.length > 300 && v.includes('FA-') && v.trim().startsWith('[')) return k;
    }
    return null;
  }

  function getInvoiceNumberFromDOM(){
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
    // fallback: busca cualquier texto tipo FA-...
    const any = Array.from(document.querySelectorAll('input,span,div'))
      .map(x => (x.value || x.textContent || '').trim())
      .find(t => /^FA-\d{12,}/.test(t));
    return any || `FA-${Date.now()}`;
  }

  function sanitizeFileName(s){
    return (s || 'FA-' + Date.now())
      .replace(/[^\w\-]+/g,'_')
      .replace(/_+/g,'_')
      .slice(0, 80);
  }

  function savePdfUrlIntoInvoice(numFactura, pdfUrl, pdfPath){
    const k = findInvoicesKey();
    if (!k) { log('No encuentro key de facturas'); return false; }

    const list = safeParse(localStorage.getItem(k) || '[]');
    if (!Array.isArray(list)) return false;

    const idx = list.findIndex(f => String(f?.num || f?.numero || f?.id || '').trim() === String(numFactura).trim());
    if (idx < 0) { log('No encuentro factura para guardar pdfUrl:', numFactura); return false; }

    list[idx].pdfUrl = pdfUrl;
    list[idx].pdfPath = pdfPath;
    list[idx].pdfUpdatedAt = Date.now();

    localStorage.setItem(k, JSON.stringify(list));

    // aviso para refrescos si tienes listeners
    window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
    return true;
  }

  async function uploadPdf(blob, numFactura){
    const u = auth.currentUser;
    if (!u) throw new Error('NO_AUTH');

    const safeNum = sanitizeFileName(numFactura);
    const path = `factumiral/${u.uid}/pdf/${safeNum}.pdf`;

    const r = sRef(storage, path);
    await uploadBytes(r, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);
    return { url, path };
  }

  // ====== CAPTURA Blob ======
  let armed = false;
  let armedAt = 0;
  let armedNum = '';
  let capturedBlob = null;

  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try{
      if (armed && blob instanceof Blob){
        const dt = Date.now() - armedAt;
        const type = (blob.type || '').toLowerCase();
        // ventana corta + blob grande
        if (dt >= 0 && dt < 4000 && (type.includes('pdf') || blob.size > 50_000)){
          capturedBlob = blob;
          log('Blob capturado', { size: blob.size, type: blob.type });
        }
      }
    }catch{}
    return origCreate(blob);
  };

  async function finalize(){
    const u = auth.currentUser;
    if (!u){
      alert('Primero LOGIN en Cloud para subir PDFs.');
      $('#btnCloud')?.click();
      return;
    }

    // esperamos un poco por si el core genera el bloburl al final
    await new Promise(r => setTimeout(r, 900));

    armed = false;

    if (!capturedBlob){
      alert(
        'No se detectó el PDF para subir.\n\n' +
        'Esto pasa si tu generador descarga directo (sin createObjectURL) o falla antes de generar.\n' +
        'Dime qué librería usas (jsPDF/pdfMake) o pégame el trozo de “Generar PDF” y lo adapto.'
      );
      return;
    }

    try{
      const num = armedNum || getInvoiceNumberFromDOM();
      log('Subiendo PDF…', num);

      const { url, path } = await uploadPdf(capturedBlob, num);
      const ok = savePdfUrlIntoInvoice(num, url, path);

      alert(
        '✅ PDF subido a Storage.\n\n' +
        'Factura: ' + num + '\n' +
        'Ruta: ' + path + '\n' +
        (ok ? 'pdfUrl guardado en la factura (Ver PDF funcionará).' : 'Subido OK, pero no pude guardar pdfUrl en esa factura.')
      );

      log('OK', { num, path, url });
      window.dispatchEvent(new CustomEvent('fmcloud:syncok', { detail: { key: 'pdf' } }));
    } catch (e){
      console.error(e);
      alert('❌ Error subiendo a Storage: ' + (e?.code || e?.message || e));
    }
  }

  // ====== Enganche robusto: delegación en CAPTURE ======
  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button, a');
    if (!btn) return;
    if (!MATCH_BTN(btn)) return;

    // Armamos ANTES de que el core haga nada
    armed = true;
    armedAt = Date.now();
    armedNum = getInvoiceNumberFromDOM();
    capturedBlob = null;

    log('PDF+Nube click detectado. Armado captura.', { armedNum });

    // finalizamos después (sin bloquear el click del core)
    setTimeout(() => finalize().catch(()=>{}), 0);
  }, true);

  log('Patch V2 activo ✅');
})();
