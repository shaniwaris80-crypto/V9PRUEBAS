/* patches/pdf-cloud-upload.js (V4)
   Captura PDFs aunque tu core:
   - abra data:application/pdf
   - haga descarga con <a download>
   - use URL.createObjectURL
   - use jsPDF.save() / jsPDF.output()
   Luego sube a Firebase Storage y guarda pdfUrl en la factura.
*/
(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_V4__) return;
  window.__FM_PDF_CLOUD_V4__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const log = (...a) => console.log('[PDF+NUBE V4]', ...a);

  // ==== Detectar el botón PDF+Nube ====
  const isPdfNubeBtn = (el) => {
    const btn = el?.closest?.('button,a');
    if (!btn) return false;

    const id  = (btn.id || '').toLowerCase();
    const act = (btn.dataset?.action || '').toLowerCase();
    const txt = (btn.textContent || '').trim().toLowerCase();

    // evita confundir con Cloud
    if (id === 'btncloud' || txt === 'cloud') return false;

    if (act.includes('pdf') && (act.includes('nube') || act.includes('cloud'))) return true;
    if (id.includes('pdf') && (id.includes('nube') || id.includes('cloud'))) return true;

    return /pdf\s*\+\s*nube|pdf\+nube|pdf\s*nube/.test(txt);
  };

  // ==== Firebase config (tuya) ====
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

  // Firebase modular CDN
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

  // ==== Helpers ====
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

  function dataUrlToBlob(dataUrl){
    // data:application/pdf;base64,....
    const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1];
    const b64 = m[2];
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/pdf' });
  }

  function savePdfUrlSomewhere(num, url, path){
    // 1) intenta localizar la lista de facturas en cualquier key (sin saber el nombre)
    const targetNum = String(num).trim();
    for (const k of Object.keys(localStorage)){
      const raw = localStorage.getItem(k);
      if (!raw || raw.length < 50 || raw[0] !== '[') continue;
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

    // 2) fallback: índice externo (para que "Ver PDF" pueda usarlo si lo adaptas)
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

  // ==== Captura (múltiples vías) ====
  let armed = false;
  let armedAt = 0;
  let armedNum = '';
  let capturedBlob = null;
  let capturedDataUrl = null;

  const captureBlob = (blob, why) => {
    if (!armed || capturedBlob) return;
    if (!(blob instanceof Blob)) return;
    const dt = Date.now() - armedAt;
    if (dt < 0 || dt > 8000) return;

    const type = (blob.type || '').toLowerCase();
    if (!type.includes('pdf') && blob.size < 50_000) return;
    capturedBlob = blob;
    log('✅ Capturado BLOB via', why, { size: blob.size, type: blob.type });
  };

  const captureDataUrl = (u, why) => {
    if (!armed || capturedDataUrl) return;
    const s = String(u || '');
    const dt = Date.now() - armedAt;
    if (dt < 0 || dt > 8000) return;

    if (s.startsWith('data:application/pdf;base64,')) {
      capturedDataUrl = s;
      log('✅ Capturado DATAURL via', why, { len: s.length });
    }
  };

  // 1) URL.createObjectURL
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try { captureBlob(blob, 'createObjectURL'); } catch {}
    return origCreate(blob);
  };

  // 2) window.open(data:application/pdf)
  const origOpen = window.open.bind(window);
  window.open = function(url, ...rest){
    try { captureDataUrl(url, 'window.open'); } catch {}
    return origOpen(url, ...rest);
  };

  // 3) Click en <a download> con data:pdf
  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args){
    try{
      const href = this.getAttribute('href') || '';
      const dl = this.getAttribute('download') || '';
      if (armed && (dl.toLowerCase().endsWith('.pdf') || href.startsWith('data:application/pdf'))) {
        captureDataUrl(href, 'a[download].click');
      }
    }catch{}
    return origAClick.apply(this, args);
  };

  // 4) jsPDF hook (si existe)
  function hookJsPDF(){
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF || null;
    if (!jsPDF || jsPDF.prototype.__fmPdfNubePatched) return;

    const p = jsPDF.prototype;
    const origOutput = p.output;
    const origSave = p.save;

    if (typeof origOutput === 'function'){
      p.output = function(type, ...rest){
        const out = origOutput.call(this, type, ...rest);
        try{
          if (type === 'blob' && out instanceof Blob) captureBlob(out, 'jsPDF.output(blob)');
          if (type === 'datauristring' && typeof out === 'string') captureDataUrl(out, 'jsPDF.output(datauristring)');
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

    p.__fmPdfNubePatched = true;
    log('Hook jsPDF ✅');
  }
  hookJsPDF();
  setTimeout(hookJsPDF, 1200);

  async function finalize(){
    armed = false;

    const u = auth.currentUser;
    if (!u){
      alert('Primero haz LOGIN en Cloud para subir a Storage.');
      $('#btnCloud')?.click();
      return;
    }

    // espera final por si genera tarde
    await new Promise(r => setTimeout(r, 600));

    if (!capturedBlob && capturedDataUrl){
      capturedBlob = dataUrlToBlob(capturedDataUrl);
      if (capturedBlob) log('✅ Convertido DATAURL->BLOB', { size: capturedBlob.size, type: capturedBlob.type });
    }

    if (!capturedBlob){
      alert(
        'No se detectó el PDF para subir.\n\n' +
        'Abre Consola y mira si aparece algún "✅ Capturado".\n' +
        'Si NO aparece, el click no está entrando o el PDF no es blob/dataurl.\n\n' +
        'Dime el texto exacto del botón PDF+Nube o pégame el <button>…</button>.'
      );
      return;
    }

    try{
      const num = armedNum || getNumFactura();
      log('Subiendo a Storage…', num);

      const { url, path } = await uploadPdf(capturedBlob, num);
      const saved = savePdfUrlSomewhere(num, url, path);

      alert(
        '✅ PDF subido a Storage.\n\n' +
        'Factura: ' + num + '\n' +
        'Ruta: ' + path + '\n' +
        'Guardado link en: ' + saved.key + (saved.ok ? ' (dentro de la factura)' : ' (índice externo)')
      );

      window.dispatchEvent(new CustomEvent('fmcloud:syncok', { detail: { key: 'pdf' } }));
      log('OK', { num, path, url, saved });

    } catch (e){
      console.error(e);
      alert('❌ Error subiendo a Storage: ' + (e?.code || e?.message || e));
    } finally {
      capturedBlob = null;
      capturedDataUrl = null;
    }
  }

  // Enganche ANTES del core
  document.addEventListener('click', (e) => {
    if (!isPdfNubeBtn(e.target)) return;

    armed = true;
    armedAt = Date.now();
    armedNum = getNumFactura();
    capturedBlob = null;
    capturedDataUrl = null;

    log('Click PDF+Nube detectado. Armado.', { armedNum });

    // deja correr tu core y luego subimos
    setTimeout(() => finalize().catch(()=>{}), 1800);
  }, true);

  log('Patch V4 activo ✅');
})();
