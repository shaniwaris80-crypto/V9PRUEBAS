/* =========================================================
   patches/pdf-cloud-permanent.js  — PDF -> Firebase Storage
   - NO toca tu generador: lo “captura” y sube
========================================================= */
(() => {
  'use strict';
  if (window.__FM_PDF_CLOUD_PERM__) return;
  window.__FM_PDF_CLOUD_PERM__ = true;

  const FIREBASE_VER = '12.8.0';

  const $ = (s, r=document) => r.querySelector(s);
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

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

  function sanitize(s){
    return String(s || `FA-${Date.now()}`).replace(/[^\w\-]+/g,'_').slice(0,120);
  }

  function getFacturaNum(){
    return ($('#facNumero')?.value || $('#facNumeroLabel')?.textContent || '').trim() || `FA-${Date.now()}`;
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

  // ---------- Firebase modules ----------
  let FB = null;
  async function getFirebase(){
    if (FB) return FB;

    const [appMod, authMod, dbMod, stMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-database.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-storage.js`),
    ]);

    const { initializeApp, getApps, getApp } = appMod;
    const { getAuth, signInWithEmailAndPassword } = authMod;
    const { getDatabase, ref: dRef, set: dSet } = dbMod;
    const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = stMod;

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);
    const storage = getStorage(app);

    FB = { auth, db, storage, signInWithEmailAndPassword, dRef, dSet, sRef, uploadBytes, getDownloadURL };
    return FB;
  }

  async function ensureLogin(){
    const { auth, signInWithEmailAndPassword } = await getFirebase();
    if (auth.currentUser) return auth.currentUser;
    const email = prompt('Email Firebase (para subir PDF):');
    const pass  = prompt('Contraseña:');
    if (!email || !pass) throw new Error('Login cancelado');
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }

  async function uploadPdf(blob, facturaNum){
    const { storage, sRef, uploadBytes, getDownloadURL } = await getFirebase();
    const u = await ensureLogin();

    const safe = sanitize(facturaNum);
    const path = `factumiral/${u.uid}/pdf/${safe}.pdf`;

    const r = sRef(storage, path);
    await uploadBytes(r, blob, { contentType:'application/pdf' }); // :contentReference[oaicite:7]{index=7}
    const url = await getDownloadURL(r); // :contentReference[oaicite:8]{index=8}
    return { url, path, uid: u.uid };
  }

  async function savePdfUrlToRTDB(uid, facturaId, url, path){
    const { db, dRef, dSet } = await getFirebase();
    const p = `factumiral/${uid}/facturas/${encodeURIComponent(facturaId)}/pdf`;
    await dSet(dRef(db, p), { url, path, updatedAt: Date.now() });
  }

  // ---------- Captura del PDF (sin romper tu generador) ----------
  let ARMED = false;
  let CAPTURED = null;

  async function capture(blob, source){
    if (!ARMED) return;
    if (!(blob instanceof Blob)) return;
    if (await isPdfBlob(blob)){
      CAPTURED = blob;
      console.log('✅ PDF capturado:', source, blob);
    }
  }

  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function(obj){
    try { if (ARMED) capture(obj, 'URL.createObjectURL'); } catch {}
    return origCreate.call(URL, obj);
  };

  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args){
    try{
      if (ARMED){
        const href = String(this.href || '');
        if (href.startsWith('data:application/pdf')) {
          const b = dataUriToBlob(href);
          if (b) capture(b, 'a.click data:pdf');
        }
      }
    }catch{}
    return origAClick.apply(this, args);
  };

  function hookJsPdf(){
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
          }
        }catch{}
        return out;
      };
      proto.output.__fmWrapped = true;
    }
    jsPDF.__fmWrapped = true;
  }
  hookJsPdf();

  async function runUploadFlow() {
    const facturaNum = getFacturaNum();

    ARMED = true;
    CAPTURED = null;

    // intenta usar tu botón PDF normal
    $('#btnPdf')?.click();

    // espera captura
    const end = Date.now() + 12000;
    while (Date.now() < end && !CAPTURED) await sleep(150);

    ARMED = false;

    if (!CAPTURED) {
      alert('❌ No detecté el PDF. Pulsa "Generar PDF" y mira consola por errores.');
      return;
    }

    const up = await uploadPdf(CAPTURED, facturaNum);

    // guarda URL en RTDB dentro de la factura
    await savePdfUrlToRTDB(up.uid, facturaNum, up.url, up.path);

    alert('✅ PDF subido a Cloud y enlazado a la factura.');
    window.open(up.url, '_blank');
  }

  // Enganchar a tu botón PDF+Nube
  function bind() {
    const btn = $('#btnPdfNube');
    if (btn && !btn.__fmBound) {
      btn.__fmBound = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        try { await runUploadFlow(); }
        catch (err) { console.error(err); alert('Error PDF Cloud: ' + (err?.message || err)); }
      }, true);
    }

    // Botón verde extra (opcional)
    if (!$('#fmBtnPdfCloudGreen')) {
      const host = document.querySelector('.panel__actions') || document.body;
      const b = document.createElement('button');
      b.id = 'fmBtnPdfCloudGreen';
      b.type = 'button';
      b.textContent = 'PDF CLOUD ✅';
      b.style.cssText = 'background:#26d06a;color:#000;border:1px solid rgba(0,0,0,.25);padding:10px 12px;border-radius:12px;font-weight:900;cursor:pointer;margin-left:8px;';
      host.appendChild(b);
      b.addEventListener('click', () => runUploadFlow());
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    // reintentos por si tu app pinta tarde
    let n = 0;
    const t = setInterval(() => { bind(); if (++n > 30) clearInterval(t); }, 300);
  });

})();
