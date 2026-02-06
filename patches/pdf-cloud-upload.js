/* patches/pdf-cloud-upload.js (V5)
   Captura PDF verificando firma %PDF y sube a Firebase Storage.
   - Hook Blob, URL.createObjectURL, window.open(data:pdf), a[download]
   - Cuando haces click en "PDF+Nube", busca durante 8s un blob que empiece por %PDF
*/

(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_V5__) return;
  window.__FM_PDF_CLOUD_V5__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const log = (...a) => console.log('[PDF+NUBE V5]', ...a);

  const isPdfNubeBtn = (el) => {
    const btn = el?.closest?.('button,a');
    if (!btn) return false;

    const id  = (btn.id || '').toLowerCase();
    const act = (btn.dataset?.action || '').toLowerCase();
    const txt = (btn.textContent || '').trim().toLowerCase();

    if (id === 'btncloud' || txt === 'cloud') return false;
    if (act.includes('pdf') && (act.includes('nube') || act.includes('cloud'))) return true;
    if (id.includes('pdf') && (id.includes('nube') || id.includes('cloud'))) return true;
    return /pdf\s*\+\s*nube|pdf\+nube|pdf\s*nube/.test(txt);
  };

  // --- Firebase config ---
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

  // --- helpers ---
  const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

  function getNumFactura(){
    const cand = ['#numFactura','#facturaNum','#facNum','#invoiceNum','input[name="numFactura"]','input[name="facturaNum"]'];
    for (const s of cand){
      const el = $(s);
      const v = (el?.value || el?.textContent || '').trim();
      if (v) return v;
    }
    const any = Array.from(document.querySelectorAll('input,span,div'))
      .map(x => (x.value || x.textContent || '').trim())
      .find(t => /^FA-\d{10,}/.test(t));
    return any || `FA-${Date.now()}`;
  }

  function sanitize(s){
    return (s || `FA-${Date.now()}`).replace(/[^\w\-]+/g,'_').replace(/_+/g,'_').slice(0, 90);
  }

  async function isRealPdfBlob(blob){
    try{
      const ab = await blob.slice(0, 5).arrayBuffer();
      const u8 = new Uint8Array(ab);
      const s = String.fromCharCode(...u8);
      return s === '%PDF-';
    }catch{
      return false;
    }
  }

  function dataUrlToBlob(dataUrl){
    const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1] || 'application/pdf';
    const b64 = m[2];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function savePdfUrlIntoInvoice(num, url, path){
    const targetNum = String(num).trim();

    // buscar cualquier array JSON que contenga esa factura
    for (const k of Object.keys(localStorage)){
      const raw = localStorage.getItem(k);
      if (!raw || raw[0] !== '[') continue;
      const arr = safeParse(raw);
      if (!Array.isArray(arr)) continue;

      const idx = arr.findIndex(f => String(f?.num ?? f?.numero ?? f?.numFactura ?? f?.id ?? '').trim() === targetNum);
      if (idx >= 0){
        arr[idx].pdfUrl = url;
        arr[idx].pdfPath = path;
        arr[idx].pdfUpdatedAt = Date.now();
        localStorage.setItem(k, JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
        return { ok:true, key:k };
      }
    }

    // fallback: índice
    const idx = safeParse(localStorage.getItem('fm_pdfindex') || '{}') || {};
    idx[targetNum] = { url, path, ts: Date.now() };
    localStorage.setItem('fm_pdfindex', JSON.stringify(idx));
    return { ok:false, key:'fm_pdfindex' };
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

  // --- capture queue ---
  let armed = false;
  let armedAt = 0;
  let armedNum = '';
  let deadline = 0;
  const queue = []; // blobs candidates
  const seen = new WeakSet();

  function pushCandidate(blob, why){
    if (!armed) return;
    if (!(blob instanceof Blob)) return;
    if (seen.has(blob)) return;
    seen.add(blob);
    queue.push({ blob, why, ts: Date.now() });
    log('candidate+', why, { size: blob.size, type: blob.type });
  }

  // Hook Blob()
  const OrigBlob = window.Blob;
  if (OrigBlob && !OrigBlob.__fmWrappedV5){
    function BlobProxy(parts, opts){
      const b = new OrigBlob(parts, opts);
      try { pushCandidate(b, 'Blob()'); } catch {}
      return b;
    }
    BlobProxy.prototype = OrigBlob.prototype;
    BlobProxy.__fmWrappedV5 = true;
    window.Blob = BlobProxy;
  }

  // Hook createObjectURL
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try { pushCandidate(blob, 'createObjectURL'); } catch {}
    return origCreate(blob);
  };

  // Hook window.open(data:pdf)
  const origOpen = window.open.bind(window);
  window.open = function(url, ...rest){
    try{
      if (typeof url === 'string' && url.startsWith('data:application/pdf;base64,')){
        const b = dataUrlToBlob(url);
        if (b) pushCandidate(b, 'window.open(dataurl)');
      }
    }catch{}
    return origOpen(url, ...rest);
  };

  // Hook <a download>
  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args){
    try{
      const href = this.getAttribute('href') || '';
      const dl = (this.getAttribute('download') || '').toLowerCase();
      if (href.startsWith('data:application/pdf;base64,')){
        const b = dataUrlToBlob(href);
        if (b) pushCandidate(b, 'a[download](dataurl)');
      }
      if (href.startsWith('blob:') && dl.endsWith('.pdf')){
        // no podemos convertir blob:->Blob aquí, pero al menos sabemos que createObjectURL debió pasar
      }
    }catch{}
    return origAClick.apply(this, args);
  };

  async function huntAndUpload(){
    const u = auth.currentUser;
    if (!u){
      alert('Primero LOGIN en Cloud para subir PDFs.');
      $('#btnCloud')?.click();
      return;
    }

    while (Date.now() < deadline){
      // procesa candidatos
      while (queue.length){
        const { blob, why } = queue.shift();

        // filtro rápido: tamaño mínimo
        if (blob.size < 2000) continue;

        const ok = await isRealPdfBlob(blob);
        if (!ok) continue;

        log('✅ PDF real detectado via', why, { size: blob.size, type: blob.type });

        const num = armedNum || getNumFactura();
        const { url, path } = await uploadPdf(blob, num);
        const saved = savePdfUrlIntoInvoice(num, url, path);

        alert(
          '✅ PDF subido a Storage.\n\n' +
          'Factura: ' + num + '\n' +
          'Ruta: ' + path + '\n' +
          'Guardado link en: ' + saved.key + (saved.ok ? ' (en factura)' : ' (índice)')
        );

        armed = false;
        return;
      }

      await new Promise(r => setTimeout(r, 200));
    }

    armed = false;
    alert('No se encontró un PDF real (%PDF-) en 8 segundos. El generador PDF está fallando o no está llegando a generar el blob.');
  }

  // click hook (antes del core)
  document.addEventListener('click', (e) => {
    if (!isPdfNubeBtn(e.target)) return;

    armed = true;
    armedAt = Date.now();
    armedNum = getNumFactura();
    deadline = Date.now() + 8000;
    queue.length = 0;

    log('ARMED', { armedNum });

    setTimeout(() => huntAndUpload().catch(err => {
      console.error(err);
      armed = false;
      alert('Error en subida: ' + (err?.code || err?.message || err));
    }), 0);
  }, true);

  log('Patch V5 activo ✅');
})();
