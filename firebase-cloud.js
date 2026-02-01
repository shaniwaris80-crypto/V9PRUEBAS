/* =========================================================
   FACTU MIRAL — firebase-cloud.js (CLOUD UI + MANUAL SYNC)
   - NO toca tu app.js
   - NO recarga automáticamente
   - Botón ☁️ Cloud + modal (email/pass)
   - Subir ahora / Bajar ahora
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

(() => {
  'use strict';

  // ========= TU CONFIG =========
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

  const $ = (s, r=document) => r.querySelector(s);
  const now = () => Date.now();
  const LS_EMAIL = 'fm_cloud_email_v1';

  // Excluir keys “basura/privadas”
  const EXCLUDE_PREFIX = ['firebase:', 'grm_', 'goog:', 'debug_', 'cache', 'session', 'fm_cloud_'];
  const EXCLUDE_EXACT = new Set([LS_EMAIL]);
  const isExcludedKey = (k) => EXCLUDE_EXACT.has(k) || EXCLUDE_PREFIX.some(p => k.startsWith(p));

  // Base64URL para keys en paths RTDB (evita / . # $ [ ])
  function b64urlEncode(str){
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  // ========= UI =========
  function injectUI(){
    if ($('#fmCloudFab')) return;

    const st = document.createElement('style');
    st.textContent = `
      .fmFab{position:fixed;right:12px;bottom:12px;z-index:999999;border:1px solid #111;background:#fff;border-radius:14px;padding:10px 12px;font:900 13px system-ui;box-shadow:0 10px 24px rgba(0,0,0,.18)}
      .fmM{position:fixed;inset:0;z-index:9999999;display:none;background:rgba(0,0,0,.55)}
      .fmM.open{display:block}
      .fmC{position:absolute;left:12px;right:12px;top:12px;bottom:12px;background:#fff;border:1px solid #111;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px}
      .fmRow{display:flex;gap:10px;flex-wrap:wrap}
      .fmRow input{flex:1;min-width:220px;border:1px solid rgba(0,0,0,.25);border-radius:12px;padding:10px 12px;font:14px system-ui}
      .fmBtns{display:flex;gap:10px;flex-wrap:wrap}
      .fmBtns button{border:1px solid #111;background:#fff;border-radius:12px;padding:10px 12px;font:900 13px system-ui}
      .fmBtns .p{background:#111;color:#fff}
      .fmInfo{border:1px solid rgba(0,0,0,.18);border-radius:14px;padding:10px 12px;background:#f7f7f7;font:12px ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;flex:1;overflow:auto}
      .fmMsg{font:12px system-ui;opacity:.85;white-space:pre-wrap}
      .fmSmall{font:12px system-ui;opacity:.75}
    `;
    document.head.appendChild(st);

    const fab = document.createElement('button');
    fab.id = 'fmCloudFab';
    fab.className = 'fmFab';
    fab.textContent = '☁️ Cloud';
    document.body.appendChild(fab);

    const modal = document.createElement('div');
    modal.id = 'fmCloudModal';
    modal.className = 'fmM';
    modal.innerHTML = `
      <div class="fmC">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <b style="font:900 14px system-ui">☁️ Cloud — Prueba Manual</b>
          <button id="fmClose" style="border:1px solid #111;background:#fff;border-radius:12px;padding:8px 10px;font:900 13px system-ui">Cerrar</button>
        </div>

        <div class="fmRow">
          <input id="fmEmail" type="email" autocomplete="email" placeholder="Email" />
          <input id="fmPass" type="password" autocomplete="current-password" placeholder="Contraseña" />
        </div>

        <div class="fmBtns">
          <button id="fmLogin" class="p" type="button">Login</button>
          <button id="fmLogout" type="button">Logout</button>
          <button id="fmPush" class="p" type="button">⬆️ Subir ahora</button>
          <button id="fmPull" type="button">⬇️ Bajar ahora</button>
          <button id="fmManualReload" type="button">🔄 Recargar (manual)</button>
        </div>

        <div class="fmSmall">
          Nota: aquí NO hay recarga automática. “Recargar (manual)” solo si tú lo pulsas.
        </div>

        <div class="fmInfo" id="fmInfo">Estado…</div>
        <div class="fmMsg" id="fmMsg"></div>
      </div>
    `;
    document.body.appendChild(modal);

    fab.onclick = () => modal.classList.add('open');
    $('#fmClose').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.classList.remove('open'); });

    // cache email
    $('#fmEmail').value = localStorage.getItem(LS_EMAIL) || '';
  }

  // ========= Firebase init =========
  let enabled = true;
  let initErr = '';
  let app=null, auth=null, db=null;

  try{
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  }catch(e){
    enabled = false;
    initErr = String(e?.message || e);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI, { once:true });
  } else {
    injectUI();
  }

  function setInfo(extra=''){
    const info = $('#fmInfo');
    if (!info) return;
    const u = auth?.currentUser;
    info.textContent =
      `enabled: ${enabled}\n` +
      (enabled ? '' : `initErr: ${initErr}\n`) +
      `auth: ${u ? 'LOGUEADO' : 'NO'}\n` +
      (u ? `email: ${u.email || '-'}\nuid: ${(u.uid||'').slice(0,8)}…\n` : '') +
      `localStorage keys: ${Object.keys(localStorage).length}\n` +
      (extra ? `\n${extra}` : '');
  }
  function msg(t){ const m = $('#fmMsg'); if (m) m.textContent = t || ''; }

  // ========= Sync helpers =========
  function rootPath(uid){ return `factumiral/${uid}`; }

  async function pushAll(uid){
    const base = rootPath(uid);
    const updatesMap = {};

    let count = 0;
    const ts = now();

    // meta ping
    updatesMap[`${base}/meta/lastPush`] = { ts, ua: navigator.userAgent };

    for (const k of Object.keys(localStorage)){
      if (isExcludedKey(k)) continue;
      const raw = localStorage.getItem(k);
      if (raw == null || String(raw).trim() === '') continue;

      const enc = b64urlEncode(k);
      updatesMap[`${base}/ls/${enc}`] = { k, raw, updatedAt: ts };
      count++;
    }

    await update(ref(db), updatesMap);
    return count;
  }

  async function pullAll(uid){
    const base = rootPath(uid);
    const snap = await get(ref(db, `${base}/ls`));
    if (!snap.exists()) return 0;

    const obj = snap.val() || {};
    let applied = 0;

    for (const enc of Object.keys(obj)){
      const row = obj[enc];
      if (!row || typeof row.raw !== 'string' || !row.k) continue;
      localStorage.setItem(row.k, row.raw);
      applied++;
    }

    // Notificar a la app (sin recargar)
    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { reason: 'pulled' } }));
    } catch {}

    return applied;
  }

  // ========= Wire UI =========
  function wireUI(){
    const emailEl = $('#fmEmail');
    const passEl  = $('#fmPass');

    $('#fmLogin').onclick = async () => {
      msg('');
      if (!enabled) return msg('❌ Firebase init error: ' + initErr);
      const em = (emailEl.value || '').trim();
      const pw = passEl.value || '';
      if (!em || !pw) return msg('⚠️ Pon email y contraseña.');
      try{
        localStorage.setItem(LS_EMAIL, em);
        await signInWithEmailAndPassword(auth, em, pw);
        passEl.value = '';
        msg('✅ Login OK');
      }catch(e){
        msg('❌ ' + (e?.code || e?.message || e));
      }
      setInfo();
    };

    $('#fmLogout').onclick = async () => {
      msg('');
      try{ await signOut(auth); msg('✅ Logout OK'); }
      catch(e){ msg('❌ ' + (e?.code || e?.message || e)); }
      setInfo();
    };

    $('#fmPush').onclick = async () => {
      msg('');
      const u = auth.currentUser;
      if (!u) return msg('⚠️ Haz login primero.');
      try{
        setInfo('Subiendo…');
        const n = await pushAll(u.uid);
        msg(`✅ Subido OK. Keys: ${n}`);
        setInfo(`✅ Subido OK. Keys: ${n}\nRuta: factumiral/${u.uid}/ls`);
        // aviso a banner (sin recargar)
        try { window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { reason:'push-ok' } })); } catch {}
      }catch(e){
        msg('❌ Error subir: ' + (e?.code || e?.message || e));
        setInfo('❌ Error subir');
      }
    };

    $('#fmPull').onclick = async () => {
      msg('');
      const u = auth.currentUser;
      if (!u) return msg('⚠️ Haz login primero.');
      try{
        setInfo('Bajando…');
        const n = await pullAll(u.uid);
        msg(`✅ Bajado OK. Aplicados: ${n}`);
        setInfo(`✅ Bajado OK. Aplicados: ${n}\n(La UI puede necesitar refresco manual si no escucha localStorage)`);
      }catch(e){
        msg('❌ Error bajar: ' + (e?.code || e?.message || e));
        setInfo('❌ Error bajar');
      }
    };

    $('#fmManualReload').onclick = () => {
      // SOLO manual
      location.reload();
    };
  }

  // ========= Auth observer =========
  if (enabled) {
    onAuthStateChanged(auth, () => setInfo());
  }

  // Boot UI wiring when ready
  const boot = () => { wireUI(); setInfo(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
