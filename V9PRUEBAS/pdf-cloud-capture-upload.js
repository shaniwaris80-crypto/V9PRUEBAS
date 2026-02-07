/* =========================================================
   PDF CLOUD CAPTURE UPLOAD (PERMANENTE)
   - NO cambia tu formato de factura
   - Captura el PDF que genera TU botón (jsPDF/saveAs/blob/data)
   - Lo sube a Firebase Storage
   - Abre el PDF desde la nube
   ========================================================= */

(async () => {
  'use strict';
  if (window.__FM_PDF_CAPTURE_CLOUD_PERM__) return;
  window.__FM_PDF_CAPTURE_CLOUD_PERM__ = true;

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

  // ====== TU FIREBASE CONFIG ======
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

  // ====== UI: badge + botón ======
  function badge(text, color='#111'){
    let b = $('#fmCloudPdfBadge');
    if(!b){
      b = document.createElement('div');
      b.id = 'fmCloudPdfBadge';
      b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:999999;padding:8px 10px;border-radius:10px;font:12px/1.2 system-ui;color:#fff;opacity:.92;max-width:90vw;';
      document.body.appendChild(b);
    }
    b.style.background = color;
    b.textContent = text;
  }

  function ensureGreenButton(){
    if ($('#fmBtnUploadMyPdfCloud')) return;

    const host = document.querySelector('.topbar__right') || document.body;

    const b = document.createElement('button');
    b.id = 'fmBtnUploadMyPdfCloud';
    b.type = 'button';
    b.textContent = 'SUBIR MI PDF A CLOUD';
    b.title = 'Captura el PDF que genera tu sistema y lo sube a Firebase Storage';
    b.style.cssText =
      'background:#26d06a;color:#000;border:1px solid rgba(0,0,0,.25);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;white-space:nowrap;margin-left:8px;';

    host.appendChild(b);
    badge('✅ PDF Cloud listo. Pulsa "SUBIR MI PDF A CLOUD".', '#111');
  }

  // ====== Helpers ======
  const firstVal = (sels) => {
    for (const s of sels) {
      const el = $(s);
      const v = (el?.value ?? el?.textContent ?? '').toString().trim();
      if (v) return v;
    }
    return '';
  };

  const sanitize = (s) => (s || `FA-${Date.now()}`)
    .replace(/[^\w\-]+/g,'_').replace(/_+/g,'_').slice(0, 90);

  function getFacturaNum(){
    return firstVal(['#numFactura','#facturaNum','#facNum','input[name="numFactura"]']) || `FA-${Date.now()}`;
  }

  function dataUriToBlob(dataUri){
    try{
      const m = String(dataUri).match(/^data:([^;]+);base64,(.*)$/);
      if (!m) return null;
      const mime = m[1] || 'application/pdf';
      const b64 = m[2] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }catch{ return null; }
  }

  async function isPdfBlob(blob){
    try{
      if (!(blob instanceof Blob)) return false;
      const head = await blob.slice(0,5).arrayBuffer();
      const sig = String.fromCharCode(...new Uint8Array(head));
      return sig === '%PDF-';
    }catch{ return false; }
  }

  // ====== Firebase modular (sin tocar tu app.js) ======
  const [appMod, authMod, storageMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js"),
  ]);

  const { initializeApp, getApps, getApp } = appMod;
  const { getAuth, signInWithEmailAndPassword } = authMod;
  const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = storageMod;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);

  async function ensureLogin(){
    if (auth.currentUser) return auth.currentUser;

    // si tienes botón Cloud de tu UI, lo abrimos
    $('#btnCloud')?.click();

    // fallback rápido
    const email = prompt('Email Firebase (Cloud):');
    const pass  = prompt('Contraseña:');
    if (!email || !pass) throw new Error('Login cancelado');
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }

  async function uploadPdfBlob(blob, facturaNum){
    const user = await ensureLogin();
    const safe = sanitize(facturaNum);
    const path = `factumiral/${user.uid}/pdf/${safe}.pdf`;
    const r = sRef(storage, path);
    await uploadBytes(r, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);
    return { url, path };
  }

  function openCloudPdf(url){
    const old = $('#fmCloudPdfModal'); if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'fmCloudPdfModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML = `
      <div style="width:min(980px,100%);height:min(92vh,100%);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eee;">
          <strong>PDF (Cloud)</strong>
          <button id="fmCloudPdfClose" style="padding:8px 10px;border:1px solid #ddd;background:#f5f5f5;border-radius:10px;cursor:pointer;">Cerrar</button>
        </div>
        <iframe style="flex:1;border:0;width:100%;" src="${url}"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.remove(); });
    $('#fmCloudPdfClose').onclick = () => modal.remove();
  }

  // ====== CAPTURA (solo cuando se arma) ======
  let ARMED = false;
  let CAPTURED = null;

  async function capture(blob, source){
    if (!ARMED) return;
    if (!(blob instanceof Blob)) return;
    if (await isPdfBlob(blob)){
      CAPTURED = blob;
      window.__fm_last_pdf_blob = blob;
      badge(`✅ PDF capturado (${source})`, '#0a7');
      console.log('[PDF CAPTURADO]', source, blob);
    }
  }

  // Hook: URL.createObjectURL
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function(obj){
    try { if (ARMED) capture(obj, 'URL.createObjectURL'); } catch {}
    return origCreate.call(URL, obj);
  };

  // Hook: saveAs (si tu app lo usa)
  if (window.saveAs && !window.saveAs.__fmWrapped){
    const origSaveAs = window.saveAs;
    window.saveAs = function(blob, name, opts){
      try { if (ARMED) capture(blob, 'saveAs'); } catch {}
      return origSaveAs.call(this, blob, name, opts);
    };
    window.saveAs.__fmWrapped = true;
  }

  // Hook: msSaveOrOpenBlob
  if (navigator.msSaveOrOpenBlob && !navigator.msSaveOrOpenBlob.__fmWrapped){
    const origMs = navigator.msSaveOrOpenBlob;
    navigator.msSaveOrOpenBlob = function(blob, name){
      try { if (ARMED) capture(blob, 'msSaveOrOpenBlob'); } catch {}
      return origMs.call(this, blob, name);
    };
    navigator.msSaveOrOpenBlob.__fmWrapped = true;
  }

  // Hook: <a href="data:application/pdf;base64,...">
  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args){
    try{
      if (ARMED){
        const href = String(this.href || '');
        if (href.startsWith('data:application/pdf')){
          const b = dataUriToBlob(href);
          if (b) capture(b, 'a.click data:pdf');
        }
      }
    }catch{}
    return origAClick.apply(this, args);
  };

  // Hook: jsPDF (si tu PDF usa jsPDF)
  function hookJsPdf(){
    try{
      const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDF || jsPDF.__fmWrapped) return;

      const proto = jsPDF.prototype;

      if (proto.output && !proto.output.__fmWrapped){
        const origOut = proto.output;
        proto.output = function(type){
          const out = origOut.apply(this, arguments);
          try{
            if (ARMED){
              if (type === 'blob' && out) capture(out, 'jsPDF.output(blob)');
              if (type === 'datauristring' && typeof out === 'string'){
                const b = dataUriToBlob(out);
                if (b) capture(b, 'jsPDF.output(datauristring)');
              }
              if (type === 'arraybuffer' && out instanceof ArrayBuffer){
                capture(new Blob([out], { type:'application/pdf' }), 'jsPDF.output(arraybuffer)');
              }
            }
          }catch{}
          return out;
        };
        proto.output.__fmWrapped = true;
      }

      if (proto.save && !proto.save.__fmWrapped){
        const origSave = proto.save;
        proto.save = function(){
          try{
            if (ARMED){
              try { capture(this.output('blob'), 'jsPDF.save->output(blob)'); } catch {}
            }
          }catch{}
          return origSave.apply(this, arguments);
        };
        proto.save.__fmWrapped = true;
      }

      jsPDF.__fmWrapped = true;
      console.log('✅ Hook jsPDF activo');
    }catch{}
  }
  hookJsPdf();
  // reintento por si jsPDF carga después
  (async ()=>{ for(let i=0;i<30;i++){ hookJsPdf(); await sleep(200); } })();

  // ====== Intenta pulsar tu botón Generar PDF (si lo encuentra) ======
  function findGeneratePdfBtn(){
    const items = $$('button, a');
    const ok = (el) => {
      const id = (el.id||'').toLowerCase();
      const t  = (el.textContent||'').trim().toLowerCase();
      const a  = (el.dataset?.action||'').toLowerCase();
      return (
        id.includes('pdf') ||
        a.includes('pdf') ||
        t === 'generar pdf' || t.includes('generar pdf') || t === 'pdf'
      );
    };
    return items.find(ok) || null;
  }

  // ====== Click del botón verde ======
  async function onClickUpload(){
    const btn = $('#fmBtnUploadMyPdfCloud');
    try{
      btn.disabled = true;
      CAPTURED = null;
      ARMED = true;
      badge('🟡 Armado: generando/capturando tu PDF…', '#a80');

      // intenta auto-click
      const pdfBtn = findGeneratePdfBtn();
      if (pdfBtn){
        pdfBtn.click();
      } else {
        badge('🟡 Pulsa tu botón "Generar PDF" ahora (10s)…', '#a80');
        alert('Pulsa tu botón normal "Generar PDF" ahora. Yo lo capturo y lo subo.');
      }

      const end = Date.now() + 12000;
      while (Date.now() < end && !CAPTURED) await sleep(150);
      ARMED = false;

      if (!CAPTURED){
        badge('🔴 No capturé PDF. Tu generador no expuso blob/data/saveAs.', '#b00');
        alert('No pude capturar el PDF.\n\nPero como a ti te funcionó antes, dime si tu PDF:\n- descarga archivo\n- abre visor\n- abre pestaña\n\ny lo adapto a ese modo.');
        return;
      }

      btn.textContent = 'Subiendo…';
      badge('⬆️ Subiendo a Firebase Storage…', '#05a');

      const num = getFacturaNum();
      const up = await uploadPdfBlob(CAPTURED, num);

      badge('✅ Subido a Storage ✔', '#0a7');
      btn.textContent = '✅ Subido';
      setTimeout(()=> btn.textContent = 'SUBIR MI PDF A CLOUD', 900);

      console.log('✅ PDF SUBIDO:', up);
      openCloudPdf(up.url);

    } catch (e){
      console.error(e);
      badge('🔴 Error: ' + (e?.message || e), '#b00');
      alert('❌ Error: ' + (e?.message || e));
    } finally {
      ARMED = false;
      btn.disabled = false;
    }
  }

  // crear botón y activar
  function init(){
    ensureGreenButton();
    const b = $('#fmBtnUploadMyPdfCloud');
    b.onclick = onClickUpload;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  console.log('✅ pdf-cloud-capture-upload.js cargado (permanente)');
})();
