/* =========================================================
   FACTU MIRAL — firebase-cloud.js (AUTO CLOUD SYNC MIRROR)
   ✅ No modifica tu app.js
   ✅ Login/Logout
   ✅ SEED al login: sube lo que ya tienes en LocalStorage
   ✅ AutoPush: cuando localStorage cambia, sube
   ✅ AutoPull realtime: cuando otro dispositivo sube, baja y guarda
   ✅ Anti-wipe: NO sube valores vacíos
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, set, onChildAdded, onChildChanged, onValue, off } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

(() => {
  'use strict';

  // --- TU CONFIG ---
  const firebaseConfig = {
    apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
    authDomain: "factumiral.firebaseapp.com",
    projectId: "factumiral",
    storageBucket: "factumiral.firebasestorage.app",
    messagingSenderId: "576821038417",
    appId: "1:576821038417:web:aba329f36563134bb01770",
    measurementId: "G-HJVL8ET49L",
    // ✅ Raíz del RTDB (sin rutas / sin child)
    databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
  };

  const $ = (s, r=document) => r.querySelector(s);
  const now = () => Date.now();

  function cleanDbRoot(url){
    const raw = String(url || '').trim();
    return raw.replace(/\/+$/,'');
  }

  // Base64URL para usar keys como path sin romper Firebase (evita / . # $ [ ])
  function b64urlEncode(str){
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlDecode(str){
    const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
    const b64 = (str + pad).replace(/-/g,'+').replace(/_/g,'/');
    return decodeURIComponent(escape(atob(b64)));
  }

  function safeJsonParse(raw){
    try { return JSON.parse(raw); } catch { return null; }
  }

  // Anti-wipe: no sube vacíos
  function shouldUpload(raw){
    if (raw == null) return false;
    const s = String(raw);
    if (s.trim() === '') return false;
    if (s === '[]' || s === '{}' || s === 'null') return false;
    // Si es JSON y está vacío realmente, no subir
    const j = safeJsonParse(s);
    if (Array.isArray(j) && j.length === 0) return false;
    if (j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).length === 0) return false;
    return true;
  }

  // Excluye keys internas (para no sincronizar credenciales ni debug)
  const EXCLUDE_PREFIX = [
    'fm_cloud_', 'fmCloud', 'firebase:', 'grm_', 'debug_', 'GM_', 'goog:',
    'lastPushed', 'pending', 'session', 'cache'
  ];
  const EXCLUDE_EXACT = new Set([
    'fm_cloud_email_v1'
  ]);
  function isExcludedKey(k){
    if (EXCLUDE_EXACT.has(k)) return true;
    return EXCLUDE_PREFIX.some(p => k.startsWith(p));
  }

  // Firebase init
  let app, auth, db, enabled = true, initErr = '';
  try{
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app, cleanDbRoot(firebaseConfig.databaseURL));
  }catch(e){
    enabled = false;
    initErr = String(e?.message || e);
  }

  const LS_EMAIL = 'fm_cloud_email_v1';
  const META_LOCAL = 'fm_cloud_localmeta_v1';
  const localMeta = (() => {
    try { return JSON.parse(localStorage.getItem(META_LOCAL) || '{}') || {}; }
    catch { return {}; }
  })();
  function saveMeta(){
    localStorage.setItem(META_LOCAL, JSON.stringify(localMeta));
  }

  // paths
  const base = (uid) => `factumiral/${uid}`;
  const pLS   = (uid) => `${base(uid)}/ls`;
  const pOne  = (uid, encKey) => `${base(uid)}/ls/${encKey}`;
  const pMeta = (uid, name) => `${base(uid)}/meta/${name}`;

  // flags anti-loop
  let applyingRemote = false;
  let internalWrite  = false;

  // Debounce push per key
  const timers = new Map();

  async function pushKey(uid, k){
    if (!enabled || !uid) return;
    if (isExcludedKey(k)) return;

    const raw = localStorage.getItem(k);
    if (!shouldUpload(raw)) return;

    const enc = b64urlEncode(k);
    const payload = {
      k,
      raw,
      updatedAt: now()
    };

    // Escribe en RTDB
    await set(ref(db, pOne(uid, enc)), payload);

    // Guarda meta local (para comparar)
    localMeta[enc] = payload.updatedAt;
    saveMeta();
  }

  async function seedAll(uid){
    // Sube lo que ya existe en LocalStorage (sin esperar cambios)
    const keys = Object.keys(localStorage).filter(k => !isExcludedKey(k));
    for (const k of keys){
      try { await pushKey(uid, k); } catch {}
    }
    // ping visible en firebase para confirmar que escribe
    try {
      await set(ref(db, pMeta(uid, '__ping')), { ts: now(), ua: navigator.userAgent });
    } catch {}
  }

  function schedulePush(uid, k){
    if (!uid) return;
    if (applyingRemote || internalWrite) return;
    if (isExcludedKey(k)) return;

    if (timers.has(k)) clearTimeout(timers.get(k));
    timers.set(k, setTimeout(async () => {
      timers.delete(k);
      try { await pushKey(uid, k); } catch (e) { showMsg('❌ Write error: ' + (e?.code || e?.message || e)); }
    }, 250));
  }

  // Listeners realtime (auto-pull)
  let listenersOn = false;
  const activeRefs = [];

  function applyRemote(uid, snap){
    const enc = snap.key;
    const v = snap.val();
    if (!enc || !v || !v.raw) return;

    const remoteAt = Number(v.updatedAt || 0);
    const localAt  = Number(localMeta[enc] || 0);

    // Si lo local es más nuevo, no pisar
    if (remoteAt <= localAt) return;

    const k = v.k || b64urlDecode(enc);

    applyingRemote = true;
    try {
      internalWrite = true;
      localStorage.setItem(k, v.raw);
      internalWrite = false;

      localMeta[enc] = remoteAt;
      saveMeta();
    } finally {
      internalWrite = false;
      applyingRemote = false;
    }

    // Notifica a tu app (si quieres refrescar UI)
    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
    } catch {}
  }

  function stopListeners(){
    if (!listenersOn) return;
    try { activeRefs.forEach(r => off(r)); } catch {}
    activeRefs.length = 0;
    listenersOn = false;
  }

  function startListeners(uid){
    if (!enabled || listenersOn) return;
    listenersOn = true;

    const r = ref(db, pLS(uid));
    activeRefs.push(r);

    onChildAdded(r, (snap) => applyRemote(uid, snap));
    onChildChanged(r, (snap) => applyRemote(uid, snap));
  }

  // Hook: localStorage.setItem -> push automático
  function hookSave(uid){
    if (localStorage.setItem.__fmWrapped) return;
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){
      orig(k, v);
      schedulePush(uid, k);
    };
    localStorage.setItem.__fmWrapped = true;
  }

  // UI simple (solo login/logout + estado)
  function injectUI(){
    if ($('#fmCloudFab')) return;

    const css = document.createElement('style');
    css.textContent = `
      .fmFab{position:fixed;right:12px;bottom:12px;z-index:99999;border:1px solid #111;background:#fff;border-radius:14px;padding:10px 12px;font:900 13px system-ui;box-shadow:0 10px 24px rgba(0,0,0,.18)}
      .fmM{position:fixed;inset:0;z-index:999999;display:none;background:rgba(0,0,0,.55)}
      .fmM.open{display:block}
      .fmC{position:absolute;left:12px;right:12px;top:12px;bottom:12px;background:#fff;border:1px solid #111;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px}
      .fmRow{display:flex;gap:10px;flex-wrap:wrap}
      .fmRow input{flex:1;min-width:220px;border:1px solid rgba(0,0,0,.25);border-radius:12px;padding:10px 12px;font:14px system-ui}
      .fmBtns{display:flex;gap:10px;flex-wrap:wrap}
      .fmBtns button{border:1px solid #111;background:#fff;border-radius:12px;padding:10px 12px;font:900 13px system-ui}
      .fmBtns .p{background:#111;color:#fff}
      .fmInfo{border:1px solid rgba(0,0,0,.18);border-radius:14px;padding:10px 12px;background:#f7f7f7;font:12px ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;flex:1;overflow:auto}
      .fmMsg{font:12px system-ui;opacity:.85;white-space:pre-wrap}
    `;
    document.head.appendChild(css);

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
          <b style="font:900 14px system-ui">☁️ Cloud — AutoSync (Mirror)</b>
          <button id="fmClose" style="border:1px solid #111;background:#fff;border-radius:12px;padding:8px 10px;font:900 13px system-ui">Cerrar</button>
        </div>
        <div class="fmRow">
          <input id="fmEmail" type="email" autocomplete="email" placeholder="Email" />
          <input id="fmPass" type="password" autocomplete="current-password" placeholder="Contraseña" />
        </div>
        <div class="fmBtns">
          <button id="fmLogin" class="p" type="button">Login</button>
          <button id="fmLogout" type="button">Logout</button>
        </div>
        <div class="fmInfo" id="fmInfo">Estado…</div>
        <div class="fmMsg" id="fmMsg"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const info = $('#fmInfo');
    const msg  = $('#fmMsg');
    const email = $('#fmEmail');
    const pass  = $('#fmPass');

    email.value = localStorage.getItem(LS_EMAIL) || '';

    function status(extra=''){
      const u = auth?.currentUser;
      const s =
        `enabled: ${enabled}\n` +
        (enabled ? '' : `initErr: ${initErr}\n`) +
        `auth: ${u ? 'LOGUEADO' : 'NO'}\n` +
        (u ? `email: ${u.email || '-'}\nuid: ${(u.uid||'').slice(0,8)}…\n` : '') +
        `localStorage keys: ${Object.keys(localStorage).length}\n` +
        (extra ? `\n${extra}` : '');
      info.textContent = s;
    }
    function show(t){ msg.textContent = t || ''; }

    fab.onclick = () => { modal.classList.add('open'); status(); };
    $('#fmClose').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.remove('open'); });

    $('#fmLogin').onclick = async () => {
      show('');
      if (!enabled) return show('❌ Firebase init error: ' + initErr);
      const em = email.value.trim();
      const pw = pass.value;
      if (!em || !pw) return show('⚠️ Pon email y contraseña.');
      try {
        localStorage.setItem(LS_EMAIL, em);
        await signInWithEmailAndPassword(auth, em, pw);
        pass.value = '';
        status('✅ Login OK. Subiendo (SEED) todo lo local…');
      } catch (e) {
        show('❌ ' + (e?.code || e?.message || e));
        status();
      }
    };

    $('#fmLogout').onclick = async () => {
      show('');
      try { await signOut(auth); status('✅ Logout OK'); }
      catch (e) { show('❌ ' + (e?.code || e?.message || e)); status(); }
    };

    onAuthStateChanged(auth, async (u) => {
      status();
      if (!u) { stopListeners(); return; }

      // IMPORTANTÍSIMO: engancha setItem con uid ya disponible
      hookSave(u.uid);

      // Realtime listeners
      startListeners(u.uid);

      // ✅ SEED: sube lo que ya existe aunque no toques nada
      await seedAll(u.uid);

      status('✅ AutoSync activo. Mira RTDB → Data: factumiral/<uid>/ls');
    });

    // Mostrar al inicio
    status();
  }

  // mensaje externo si hay fallos
  function showMsg(t){
    try{
      const el = $('#fmMsg');
      if (el) el.textContent = t;
    }catch{}
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI, { once:true });
  } else {
    injectUI();
  }
})();
