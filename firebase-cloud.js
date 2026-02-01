/* =========================================================
   FACTU MIRAL — firebase-cloud.js (AUTO SYNC + CLOUD UI)
   - NO toca app.js
   - Botón ☁️ Cloud siempre visible
   - Login/Logout (Email/Password)
   - Auto-seed al login (sube lo que ya tienes)
   - Auto-push en cada localStorage.setItem
   - Auto-pull realtime a LocalStorage
   - Dispara evento: fmcloud:changed (para tu banner)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, set, onChildAdded, onChildChanged, onValue, off } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

(() => {
  'use strict';

  // ✅ TU CONFIG (RTDB ROOT)
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
  const META_LOCAL = 'fm_cloud_localmeta_v1';

  // Excluir cosas para no subir credenciales/ruido
  const EXCLUDE_PREFIX = [
    'fm_cloud_', 'firebase:', 'grm_', 'goog:', 'debug_', 'cache', 'session'
  ];
  const EXCLUDE_EXACT = new Set([LS_EMAIL, META_LOCAL]);
  const isExcludedKey = (k) => EXCLUDE_EXACT.has(k) || EXCLUDE_PREFIX.some(p => k.startsWith(p));

  const safeJson = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
  const shouldUpload = (raw) => {
    if (raw == null) return false;
    const s = String(raw).trim();
    if (!s || s === 'null' || s === '[]' || s === '{}') return false;
    const j = safeJson(s);
    if (Array.isArray(j) && j.length === 0) return false;
    if (j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).length === 0) return false;
    return true;
  };

  // Base64URL encode para usar keys como path sin romper RTDB
  const b64urlEncode = (str) => {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };

  // ---- UI SIEMPRE (aunque Firebase falle) ----
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
          <b style="font:900 14px system-ui">☁️ Cloud</b>
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

    const show = (t) => { msg.textContent = t || ''; };
    const status = (extra='') => {
      const u = auth?.currentUser;
      info.textContent =
        `firebaseEnabled: ${firebaseEnabled}\n` +
        (firebaseEnabled ? '' : `initError: ${initError}\n`) +
        `auth: ${u ? 'LOGUEADO' : 'NO'}\n` +
        (u ? `email: ${u.email || '-'}\nuid: ${(u.uid||'').slice(0,8)}…\n` : '') +
        `localStorage keys: ${Object.keys(localStorage).length}\n` +
        (extra ? `\n${extra}` : '');
    };

    fab.onclick = () => { modal.classList.add('open'); status(); };
    $('#fmClose').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.classList.remove('open'); });

    $('#fmLogin').onclick = async () => {
      show('');
      if (!firebaseEnabled) return show('❌ Firebase init error: ' + initError);
      const em = email.value.trim();
      const pw = pass.value;
      if (!em || !pw) return show('⚠️ Pon email y contraseña.');
      try{
        localStorage.setItem(LS_EMAIL, em);
        await signInWithEmailAndPassword(auth, em, pw);
        pass.value = '';
        status('✅ Login OK. Haciendo SEED (subida inicial)…');
      }catch(e){
        show('❌ ' + (e?.code || e?.message || e));
        status();
      }
    };

    $('#fmLogout').onclick = async () => {
      show('');
      try{ await signOut(auth); status('✅ Logout OK'); }
      catch(e){ show('❌ ' + (e?.code || e?.message || e)); status(); }
    };

    // refresco estado
    const t = setInterval(() => { if ($('#fmCloudModal')?.classList.contains('open')) status(); }, 1000);
    window.addEventListener('beforeunload', () => clearInterval(t));
  }

  // ---- Firebase init ----
  let firebaseEnabled = true;
  let initError = '';
  let app=null, auth=null, db=null;

  try{
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app, String(firebaseConfig.databaseURL||'').replace(/\/+$/,''));
  }catch(e){
    firebaseEnabled = false;
    initError = String(e?.message || e);
  }

  // Inject UI aunque Firebase falle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI, { once:true });
  } else {
    injectUI();
  }

  if (!firebaseEnabled) return;

  // ---- Meta local (para comparar updatedAt por key) ----
  const localMeta = (() => {
    try { return JSON.parse(localStorage.getItem(META_LOCAL) || '{}') || {}; }
    catch { return {}; }
  })();
  const saveMeta = () => localStorage.setItem(META_LOCAL, JSON.stringify(localMeta));

  // ---- Paths ----
  const base = (uid) => `factumiral/${uid}`;
  const pLS  = (uid) => `${base(uid)}/ls`;
  const pOne = (uid, enc) => `${base(uid)}/ls/${enc}`;
  const pPing = (uid) => `${base(uid)}/meta/__ping`;

  // ---- Flags anti-loop ----
  let applyingRemote = false;
  let internalWrite  = false;

  async function pushKey(uid, k){
    if (!uid || isExcludedKey(k)) return;
    const raw = localStorage.getItem(k);
    if (!shouldUpload(raw)) return;

    const enc = b64urlEncode(k);
    const payload = { k, raw, updatedAt: now() };

    await set(ref(db, pOne(uid, enc)), payload);

    localMeta[enc] = payload.updatedAt;
    saveMeta();
  }

  async function seedAll(uid){
    const keys = Object.keys(localStorage).filter(k => !isExcludedKey(k));
    for (const k of keys){
      try{ await pushKey(uid, k); }catch{}
    }
    try{ await set(ref(db, pPing(uid)), { ts: now(), ua: navigator.userAgent }); }catch{}
  }

  // Debounce pushes
  const timers = new Map();
  function schedulePush(uid, k){
    if (!uid || applyingRemote || internalWrite) return;
    if (isExcludedKey(k)) return;

    if (timers.has(k)) clearTimeout(timers.get(k));
    timers.set(k, setTimeout(async () => {
      timers.delete(k);
      try { await pushKey(uid, k); }
      catch {}
    }, 250));
  }

  // Hook setItem (sin tocar tu app)
  function hookSetItem(uid){
    if (localStorage.setItem.__fmWrapped) return;
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){
      orig(k, v);
      schedulePush(uid, k);
    };
    localStorage.setItem.__fmWrapped = true;
  }

  // ---- Realtime listeners (pull) ----
  let listenersOn = false;
  const activeRefs = [];

  function applyRemote(snap){
    const enc = snap.key;
    const v = snap.val();
    if (!enc || !v || !v.raw) return;

    const remoteAt = Number(v.updatedAt || 0);
    const localAt  = Number(localMeta[enc] || 0);
    if (remoteAt <= localAt) return;

    const k = v.k || '(unknown)';
    applyingRemote = true;
    try{
      internalWrite = true;
      localStorage.setItem(k, v.raw);
      internalWrite = false;

      localMeta[enc] = remoteAt;
      saveMeta();
    } finally {
      internalWrite = false;
      applyingRemote = false;
    }

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
    if (listenersOn) return;
    listenersOn = true;
    const r = ref(db, pLS(uid));
    activeRefs.push(r);
    onChildAdded(r, applyRemote);
    onChildChanged(r, applyRemote);
  }

  // ---- Auth lifecycle ----
  onAuthStateChanged(auth, async (u) => {
    if (!u){ stopListeners(); return; }
    hookSetItem(u.uid);
    startListeners(u.uid);
    await seedAll(u.uid); // ✅ para que “salgan carpetas” en Firebase aunque no toques nada
  });

})();
