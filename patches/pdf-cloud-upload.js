/* patches/pdf-cloud-upload.js (V6)
   Sube PDF a Storage capturando blob: URL aunque no tengamos el Blob original.
   Captura blob URLs desde:
   - a[download].click
   - setAttribute('src'/'data', 'blob:...')
   - property setters (iframe.src / object.data)
*/
(async () => {
  'use strict';
  if (window.__FM_PDF_CLOUD_V6__) return;
  window.__FM_PDF_CLOUD_V6__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const log = (...a) => console.log('[PDF+NUBE V6]', ...a);

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

  const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

  function getNumFactura(){
    const cand = ['#numFactura','#facturaNum','#facNum','#invoiceNum','input[name="numFactura"]','input[name="facturaNum"]'];
    for (const s of cand){
      const el = $(s);
      const v = (el?.value || el?.textContent || '').trim();
      if (v) return v;
    }
    return `FA-${Date.now()}`;
  }

  function sanitize(s){
    return (s || `FA-${Date.now()}`).replace(/[^\w\-]+/g,'_').replace(/_+/g,'_').slice(0, 90);
  }

  function savePdfUrlSomewhere(num, url, path){
    const target = String(num).trim();

    for (const k of Object.keys(localStorage)){
      const raw = localStorage.getItem(k);
      if (!raw || raw[0] !== '[') continue;
      const arr = safeParse(raw);
      if (!Array.isArray(arr)) continue;

      const idx = arr.findIndex(f => String(f?.num ?? f?.numero ?? f?.numFactura ?? f?.id ?? '').trim() === target);
      if (idx >= 0){
        arr[idx].pdfUrl = url;
        arr[idx].pdfPath = path;
        arr[idx].pdfUpdatedAt = Date.now();
        localStorage.setItem(k, JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
        return { ok:true, key:k };
      }
    }

    const idx = safeParse(localStorage.getItem('fm_pdfindex') || '{}') || {};
    idx[target] = { url, path, ts: Date.now() };
    localStorage.setItem('fm_pdfindex', JSON.stringify(idx));
    return { ok:false, key:'fm_pdfindex' };
  }

  async function uploadPdfBlob(blob, num){
    const u = auth.currentUser;
    if (!u) throw new Error('NO_AUTH');

    const safeNum = sanitize(num);
    const filePath = `factumiral/${u.uid}/pdf/${safeNum}.pdf`;
    const r = sRef(storage, filePath);

    await uploadBytes(r, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);
    return { url, path: filePath };
  }

  // ===== Captura blob: urls =====
  let armed = false;
  let armedNum = '';
  let deadline = 0;
  const blobUrls = new Set();

  function captureBlobUrl(u, why){
    if (!armed) return;
    const s = String(u || '');
    if (!s.startsWith('blob:')) return;
    blobUrls.add(s);
    log('blobURL+', why, s);
  }

  // a[download].click
  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args){
    try{
      captureBlobUrl(this.href, 'a.click');
    }catch{}
    return origAClick.apply(this, args);
  };

  // setAttribute('src'/'data')
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value){
    try{
      const n = String(name||'').toLowerCase();
      if (n === 'src' || n === 'data') captureBlobUrl(value, `setAttribute(${n})`);
    }catch{}
    return origSetAttr.call(this, name, value);
  };

  // property setter iframe.src / object.data
  function wrapSetter(proto, prop, label){
    try{
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set || d.set.__fmWrapped) return;
      const origSet = d.set;
      const newSet = function(v){ try{ captureBlobUrl(v, label); }catch{} return origSet.call(this, v); };
      newSet.__fmWrapped = true;
      Object.defineProperty(proto, prop, { ...d, set: newSet });
    } catch {}
  }
  wrapSetter(HTMLIFrameElement.prototype, 'src', 'iframe.src');
  wrapSetter(HTMLObjectElement.prototype, 'data', 'object.data');
  wrapSetter(HTMLEmbedElement.prototype, 'src', 'embed.src');

  async function huntAndUpload(){
    const u = auth.currentUser;
    if (!u){
      alert('Primero LOGIN en Cloud para subir PDFs.');
      $('#btnCloud')?.click();
      armed = false;
      return;
    }

    while (Date.now() < deadline){
      for (const url of Array.from(blobUrls)){
        try{
          const res = await fetch(url);
          const blob = await res.blob();

          // firma rápida %PDF
          const head = await blob.slice(0,5).arrayBuffer();
          const s = String.fromCharCode(...new Uint8Array(head));
          if (s !== '%PDF-') continue;

          log('✅ PDF detectado desde blobURL', url, { size: blob.size, type: blob.type });

          const num = armedNum || getNumFactura();
          const { url:dl, path } = await uploadPdfBlob(blob, num);
          const saved = savePdfUrlSomewhere(num, dl, path);

          alert(
            '✅ PDF subido a Storage.\n\n' +
            'Factura: ' + num + '\n' +
            'Ruta: ' + path + '\n' +
            'Guardado link en: ' + saved.key + (saved.ok ? ' (en factura)' : ' (índice)')
          );

          armed = false;
          return;
        }catch(e){
          // si un blobURL caduca o falla, lo quitamos
          blobUrls.delete(url);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    armed = false;
    alert('No pude capturar un blob PDF (%PDF-). El generador PDF está fallando antes de crear el blob.');
  }

  document.addEventListener('click', (e) => {
    if (!isPdfNubeBtn(e.target)) return;
    armed = true;
    armedNum = getNumFactura();
    deadline = Date.now() + 8000;
    blobUrls.clear();
    log('ARMED', { armedNum });
    setTimeout(() => huntAndUpload().catch(err => {
      console.error(err);
      armed = false;
      alert('Error subida: ' + (err?.code || err?.message || err));
    }), 0);
  }, true);

  log('Patch V6 activo ✅');
})();
