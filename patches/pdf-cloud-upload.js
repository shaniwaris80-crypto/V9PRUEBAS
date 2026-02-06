/* patches/pdf-cloud-upload.js (V3)
   Captura PDF aunque NO use createObjectURL:
   - Intercepta Blob (type pdf)
   - Intercepta URL.createObjectURL
   - Hook jsPDF.save/output si existe
   Luego sube a Firebase Storage y guarda pdfUrl en la factura.
*/
(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_V3__) return;
  window.__FM_PDF_CLOUD_V3__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const log = (...a) => console.log('[PDF+NUBE V3]', ...a);

  // Detecta tu botón PDF+Nube por texto/ids/dataset
  const isPdfNubeBtn = (el) => {
    const btn = el?.closest?.('button,a');
    if (!btn) return false;

    const id = (btn.id || '').toLowerCase();
    const act = (btn.dataset?.action || '').toLowerCase();
    const txt = (btn.textContent || '').trim().toLowerCase();

    // evita confundir con el botón Cloud
    if (id === 'btncloud' || txt === 'cloud') return false;

    if (act.includes('pdf') && (act.includes('nube') || act.includes('cloud'))) return true;
    if (id.includes('pdf') && (id.includes('nube') || id.includes('cloud'))) return true;

    // texto
    if (txt.includes('pdf') && (txt.includes('nube') || txt.includes('+'))) return true;
    return /pdf\s*\+\s*nube|pdf\+nube|pdf\s*nube/.test(txt);
  };

  // ===== Firebase CDN =====
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

  // ===== Helpers =====
  const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

  function findInvoicesKey(){
    const candidates = ['factumiral_facturas','fm_facturas','arslan_v104_facturas','facturas'];
    for (const k of candidates) if (localStorage.getItem(k)) return k;

    for (const k of Object.keys(localStorage)){
      const v = localStorage.getItem(k);
      if (v && v.length > 300 && v.includes('FA-') && v.trim().startsWith('[')) return k;
    }
    return null;
  }

  function getNumFactura(){
    const cand = [
      '#numFactura','#facturaNum','#facNum','#invoiceNum',
      'input[name="numFactura"]','input[name="facturaNum"]'
    ];
    for (const s of cand){
      const el = $(s);
      const v = (el?.value || el?.textContent || '').trim();
      if (v) return v;
    }
    // fallback
    const any = Array.from(document.querySelectorAll('input,span,div'))
      .map(x => (x.value || x.textContent || '').trim())
      .find(t => /^FA-\d{10,}/.test(t));
    return any || `FA-${Date.now()}`;
  }

  function sanitize(s){
    return (s || 'FA-'+Date.now())
      .replace(/[^\w\-]+/g,'_')
      .replace(/_+/g,'_')
      .slice(0, 90);
  }

  function savePdfUrlToInvoice(num, url, path){
    const key = findInvoicesKey();
    if (!key) {
      // fallback: guardamos índice aparte para no perder el link
      const idx = safeParse(localStorage.getItem('fm_pdfindex') || '{}') || {};
      idx[num] = { url, path, ts: Date.now() };
      localStorage.setItem('fm_pdfindex', JSON.stringify(idx));
      return false;
    }

    const list = safeParse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(list)) return false;

    const match = (f) => {
      const n = String(f?.num ?? f?.numero ?? f?.numFactura ?? f?.id ?? '').trim();
      return n === String(num).trim();
    };

    const i = list.findIndex(match);
    if (i < 0) return false;

    list[i].pdfUrl = url;
    list[i].pdfPath = path;
    list[i].pdfUpdatedAt = Date.now();

    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key } }));
    return true;
  }

  async function uploadPdf(blob, num){
    const u = auth.currentUser;
    if (!u) throw new Error('NO_AUTH');
    const safeNum = sanitize(num);
    const filePath = `factumiral/${u.uid}/pdf/${safeNum}.pdf`;
    const r = sRef(storage, filePath);
    await uploadBytes(r, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);
    return { url, path: filePath };
  }

  // ===== Captura PDF (3 vías) =====
  let armed = false;
  let armedAt = 0;
  let armedNum = '';
  let captured = null;

  const captureBlob = (blob, why='') => {
    if (!armed) return;
    const dt = Date.now() - armedAt;
    if (dt < 0 || dt > 8000) return;

    if (!(blob instanceof Blob)) return;
    const type = (blob.type || '').toLowerCase();

    // condiciones para “parece pdf”
    const looksPdf = type.includes('pdf') || (blob.size > 50_000 && type !== 'image/png' && type !== 'image/jpeg');
    if (!looksPdf) return;

    // primera captura gana
    if (!captured) {
      captured = blob;
      log('✅ Capturado', { why, size: blob.size, type: blob.type });
    }
  };

  // 1) hook Blob constructor (muy efectivo)
  const OrigBlob = window.Blob;
  if (OrigBlob && !OrigBlob.__fmWrapped){
    function BlobProxy(parts, opts){
      const b = new OrigBlob(parts, opts);
      try { captureBlob(b, 'Blob()'); } catch {}
      return b;
    }
    BlobProxy.prototype = OrigBlob.prototype;
    BlobProxy.__fmWrapped = true;
    window.Blob = BlobProxy;
  }

  // 2) hook createObjectURL
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try { captureBlob(blob, 'createObjectURL'); } catch {}
    return origCreate(blob);
  };

  // 3) hook jsPDF si existe (opcional)
  function hookJsPDF(){
    const jsPDF =
      window.jspdf?.jsPDF ||
      window.jsPDF ||
      null;

    if (!jsPDF || jsPDF.prototype?.__fmPatched) return;

    const p = jsPDF.prototype;
    const origSave = p.save;
    const origOutput = p.output;

    if (typeof origOutput === 'function'){
      p.output = function(type, ...rest){
        const out = origOutput.call(this, type, ...rest);
        try{
          if (type === 'blob' && out instanceof Blob) captureBlob(out, 'jsPDF.output(blob)');
        }catch{}
        return out;
      };
    }

    if (typeof origSave === 'function'){
      p.save = function(...args){
        try{
          if (typeof this.output === 'function'){
            const b = this.output('blob');
            if (b instanceof Blob) captureBlob(b, 'jsPDF.save->output(blob)');
          }
        }catch{}
        return origSave.apply(this, args);
      };
    }

    p.__fmPatched = true;
    log('Hook jsPDF ✅');
  }
  hookJsPDF();
  setTimeout(hookJsPDF, 1500); // por si carga tarde

  // ===== Flujo PDF+Nube =====
  async function finalize(){
    armed = false;

    if (!captured){
      alert(
        'No se detectó el PDF para subir.\n\n' +
        'Ahora ya capturamos por Blob/createObjectURL/jsPDF.\n' +
        'Si sigue fallando, tu PDF se genera fuera del navegador o en otro método.\n\n' +
        'Abre Consola y dime si aparece: [PDF+NUBE V3] ✅ Capturado'
      );
      return;
    }

    try{
      const u = auth.currentUser;
      if (!u){
        alert('Primero LOGIN en Cloud (Firebase) para subir PDFs.');
        $('#btnCloud')?.click();
        return;
      }

      const num = armedNum || getNumFactura();
      log('Subiendo...', num);

      const { url, path } = await uploadPdf(captured, num);
      const ok = savePdfUrlToInvoice(num, url, path);

      alert(
        '✅ PDF subido a Storage.\n\n' +
        'Factura: ' + num + '\n' +
        'Ruta: ' + path + '\n' +
        (ok ? 'pdfUrl guardado en la factura (Ver PDF funcionará).' : 'Subido OK, pero no encontré esa factura para guardar pdfUrl (guardé fm_pdfindex).')
      );

      window.dispatchEvent(new CustomEvent('fmcloud:syncok', { detail: { key: 'pdf' } }));
      log('OK', { num, path, url });

    } catch (e){
      console.error(e);
      alert('❌ Error subiendo a Storage: ' + (e?.code || e?.message || e));
    } finally {
      captured = null;
    }
  }

  // Enganche: armamos ANTES de que corra tu handler core
  document.addEventListener('click', (e) => {
    if (!isPdfNubeBtn(e.target)) return;

    // armamos
    armed = true;
    armedAt = Date.now();
    armedNum = getNumFactura();
    captured = null;

    log('Click PDF+Nube detectado. Armado.', { armedNum });

    // dejamos que el core genere PDF y luego subimos
    setTimeout(() => finalize().catch(()=>{}), 1800);
  }, true);

  log('Patch V3 activo ✅');
})();
