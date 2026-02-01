/* =========================================================
   FACTU MIRAL — firebase-cloud.js (AUTO SYNC)
   - Offline primero (LocalStorage)
   - Cloud opcional (Firebase Auth + Realtime Database)
   - AUTO-PUSH: cuando se guarda cualquier cosa local
   - AUTO-PULL: cambios en tiempo real desde otros dispositivos
   - Sin sync manual (solo login/logout + estado)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onChildAdded,
  onChildChanged,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

(() => {
  'use strict';

  /* =========================
     CONFIG — EDITA SOLO ESTO
  ========================= */
  const firebaseConfig = {
    apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
    authDomain: "factumiral.firebaseapp.com",
    projectId: "factumiral",
    storageBucket: "factumiral.firebasestorage.app",
    messagingSenderId: "576821038417",
    appId: "1:576821038417:web:aba329f36563134bb01770",
    measurementId: "G-HJVL8ET49L",

    // ✅ SOLO RAÍZ, SIN "/" final, SIN rutas
    databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
  };

  /* =========================
     HELPERS
  ========================= */
  const $ = (s, r=document) => r.querySelector(s);
  const nowMs = () => Date.now();

  function safeJsonParse(s, fallback){
    try { return JSON.parse(s); } catch { return fallback; }
  }
  function loadLocal(key, fallback){
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return safeJsonParse(raw, fallback);
  }
  function saveLocal(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  }
  function updAt(obj){ return (obj && typeof obj.updatedAt === "number") ? obj.updatedAt : 0; }

  function toMap(arr, idKey="id"){
    const m = {};
    (Array.isArray(arr) ? arr : []).forEach(o=>{
      const id = o?.[idKey];
      if (id) m[id] = o;
    });
    return m;
  }
  function toArray(map){
    return Object.values(map || {});
  }
  function mergeOneIntoArrayById(arr, id, obj){
    const out = Array.isArray(arr) ? arr.slice() : [];
    const idx = out.findIndex(x => x && x.id === id);
    if (idx >= 0) out[idx] = obj;
    else out.push(obj);
    return out;
  }

  function cleanDbRoot(url){
    const raw = String(url || '').trim();
    if (!raw) return '';
    const noTrail = raw.replace(/\/+$/,'');
    const root = noTrail.replace(/^(https?:\/\/[^\/]+).*$/,'$1');
    return root;
  }

  function friendlyError(err){
    const msg = String(err?.code || err?.message || err || 'Error');
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) return '❌ Email/contraseña incorrectos.';
    if (msg.includes('auth/user-not-found')) return '❌ Usuario no existe (Firebase → Authentication → Users).';
    if (msg.includes('auth/unauthorized-domain')) return '❌ Dominio no autorizado (Firebase Auth → Settings → Authorized domains).';
    if (msg.toLowerCase().includes('permission_denied')) return '❌ Permission denied (Rules).';
    if (msg.toLowerCase().includes('database url')) return '❌ databaseURL incorrecto (debe ser la raíz del Realtime DB).';
    return `❌ ${msg}`;
  }

  /* =========================
     LOCALSTORAGE KEYS
     (usa los tuyos si existen)
  ========================= */
  const K = {
    clientes:  window.K_CLIENTES   || "factumiral_clientes",
    productos: window.K_PRODUCTOS  || "factumiral_productos",
    taras:     window.K_TARAS      || "factumiral_taras",
    facturas:  window.K_FACTURAS   || "factumiral_facturas",
    ajustes:   window.K_AJUSTES    || "factumiral_ajustes",
    ventas:    window.K_VENTAS     || "factumiral_ventas",
    contab:    window.K_CONTAB     || "factumiral_contabilidad"
  };

  const KEY_TO_SECTION = new Map([
    [K.clientes,  { section:"clientes",  type:"array" }],
    [K.productos, { section:"productos", type:"array" }],
    [K.taras,     { section:"taras",     type:"array" }],
    [K.facturas,  { section:"facturas",  type:"array" }],
    [K.ventas,    { section:"ventas",    type:"arrayVentas" }],
    [K.contab,    { section:"contabilidad", type:"arrayById" }],
    [K.ajustes,   { section:"ajustes",   type:"object" }]
  ]);

  /* =========================
     INIT FIREBASE (SAFE)
  ========================= */
  let app = null;
  let auth = null;
  let db = null;
  let cloudEnabled = false;
  let cloudInitError = '';

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    const root = cleanDbRoot(firebaseConfig.databaseURL);
    if (!root) {
      cloudEnabled = false;
      cloudInitError = 'Falta databaseURL (Realtime Database URL).';
    } else {
      db = getDatabase(app, root);
      cloudEnabled = true;
    }
  } catch (e) {
    cloudEnabled = false;
    cloudInitError = friendlyError(e);
  }

  /* =========================
     PATHS CLOUD
  ========================= */
  const base = (uid) => `factumiral/${uid}`;
  const pSection = (uid, section) => `${base(uid)}/${section}`;
  const pItem = (uid, section, id) => `${base(uid)}/${section}/${id}`;

  /* =========================================================
     AUTO SYNC CORE
  ========================================================= */
  // Evitar bucles:
  let applyingRemote = false;   // escribo local desde cloud
  let internalWrite = false;    // escribo local desde este módulo

  // Debounce por key (cuando guardas varias veces seguidas)
  const pushTimers = new Map();          // key -> timeout id
  const pendingKeys = new Set();         // keys pendientes si no hay login
  const LS_PENDING = 'fm_cloud_pending_keys';

  // Recordatorio de lo último subido por ID (para no reenviar todo)
  const pushedAt = {
    clientes: new Map(),
    productos: new Map(),
    taras: new Map(),
    facturas: new Map(),
    ventas: new Map(),
    contabilidad: new Map(),
    ajustes: 0
  };

  let listenersActive = false;
  const activeRefs = []; // para limpiar listeners

  function persistPending(){
    try { localStorage.setItem(LS_PENDING, JSON.stringify(Array.from(pendingKeys))); } catch {}
  }
  function loadPending(){
    const arr = loadLocal(LS_PENDING, []);
    if (Array.isArray(arr)) arr.forEach(k => pendingKeys.add(k));
  }
  loadPending();

  function cloudUser(){
    return auth?.currentUser || null;
  }

  function canSync(){
    return cloudEnabled && !!cloudUser();
  }

  function schedulePushByKey(key){
    if (!KEY_TO_SECTION.has(key)) return;
    if (applyingRemote || internalWrite) return;

    // Debounce
    if (pushTimers.has(key)) clearTimeout(pushTimers.get(key));
    pushTimers.set(key, setTimeout(() => {
      pushTimers.delete(key);
      autoPushKey(key).catch(()=>{});
    }, 350));
  }

  async function autoPushKey(key){
    if (!KEY_TO_SECTION.has(key)) return;
    if (!cloudEnabled) return;

    if (!cloudUser()){
      pendingKeys.add(key);
      persistPending();
      return;
    }

    const meta = KEY_TO_SECTION.get(key);
    const section = meta.section;
    const uid = cloudUser().uid;

    if (meta.type === 'object'){
      const obj = loadLocal(key, null);
      if (!obj || typeof obj !== 'object') return;

      const up = { ...obj };
      if (typeof up.updatedAt !== 'number') up.updatedAt = nowMs();

      // evita re-push infinito
      if (up.updatedAt <= pushedAt.ajustes) return;

      pushedAt.ajustes = up.updatedAt;
      await set(ref(db, pSection(uid, "ajustes")), up);
      setStatus(`✅ AutoSync: Ajustes subidos (${new Date().toLocaleTimeString()})`);
      return;
    }

    if (meta.type === 'array'){
      const arr = loadLocal(key, []);
      if (!Array.isArray(arr) || arr.length === 0) return; // vacío => no sube nada (anti-wipe)

      for (const item of arr){
        if (!item || !item.id) continue;
        const up = { ...item };
        if (typeof up.updatedAt !== 'number') {
          // añade updatedAt y lo escribe en local (sin disparar push)
          up.updatedAt = nowMs();
          internalWrite = true;
          try{
            const fixedArr = arr.map(x => (x?.id === up.id ? up : x));
            saveLocal(key, fixedArr);
          } finally {
            internalWrite = false;
          }
        }

        const last = pushedAt[section]?.get(up.id) || 0;
        if (up.updatedAt <= last) continue;

        await set(ref(db, pItem(uid, section, up.id)), up);
        pushedAt[section].set(up.id, up.updatedAt);
      }

      setStatus(`✅ AutoSync: ${section} subido (${new Date().toLocaleTimeString()})`);
      return;
    }

    if (meta.type === 'arrayVentas'){
      const arr = loadLocal(key, []);
      if (!Array.isArray(arr) || arr.length === 0) return;

      for (const item of arr){
        if (!item) continue;

        // id recomendado: "YYYY-MM-DD|SANPABLO"
        let id = item.id;
        const date = item.date || item.fecha || item.fechaISO || item.dia;
        const store = item.store || item.tienda || item.sede || item.shop;
        if (!id && date && store) id = `${date}|${store}`;

        if (!id) continue;

        const up = { ...item, id };
        if (typeof up.updatedAt !== 'number') up.updatedAt = nowMs();

        const last = pushedAt.ventas.get(id) || 0;
        if (up.updatedAt <= last) continue;

        await set(ref(db, pItem(uid, "ventas", id)), up);
        pushedAt.ventas.set(id, up.updatedAt);
      }

      setStatus(`✅ AutoSync: ventas subidas (${new Date().toLocaleTimeString()})`);
      return;
    }

    if (meta.type === 'arrayById'){
      const arr = loadLocal(key, []);
      if (!Array.isArray(arr) || arr.length === 0) return;

      for (const item of arr){
        if (!item) continue;
        const id = item.id;
        if (!id) continue;
        const up = { ...item };
        if (typeof up.updatedAt !== 'number') up.updatedAt = nowMs();

        const last = pushedAt.contabilidad.get(id) || 0;
        if (up.updatedAt <= last) continue;

        await set(ref(db, pItem(uid, "contabilidad", id)), up);
        pushedAt.contabilidad.set(id, up.updatedAt);
      }

      setStatus(`✅ AutoSync: contabilidad subida (${new Date().toLocaleTimeString()})`);
      return;
    }
  }

  async function flushPending(){
    if (!canSync()) return;
    const keys = Array.from(pendingKeys);
    pendingKeys.clear();
    persistPending();
    for (const k of keys){
      await autoPushKey(k).catch(()=>{});
    }
  }

  /* =========================
     AUTO PULL (Realtime listeners)
  ========================= */
  function applyRemoteToLocal(sectionKey, keyName, id, remoteObj){
    if (!remoteObj || !id) return;

    const localArr = loadLocal(keyName, []);
    const localMap = toMap(localArr);
    const localObj = localMap[id];

    // si el remoto no es más nuevo, no tocamos
    if (localObj && updAt(remoteObj) <= updAt(localObj)) return;

    applyingRemote = true;
    try{
      const merged = mergeOneIntoArrayById(localArr, id, remoteObj);
      saveLocal(keyName, merged);
    } finally {
      applyingRemote = false;
    }

    // Aviso para tu app (si quieres refrescar listas sin recargar)
    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { section: sectionKey, id } }));
    } catch {}

    setStatus(`⬇️ Cloud → Local: ${sectionKey} actualizado (${new Date().toLocaleTimeString()})`);
  }

  function applyRemoteObjectToLocal(keyName, remoteObj){
    if (!remoteObj || typeof remoteObj !== 'object') return;
    const localObj = loadLocal(keyName, { updatedAt: 0 });
    if (typeof remoteObj.updatedAt !== 'number') return;

    if (remoteObj.updatedAt <= (localObj.updatedAt || 0)) return;

    applyingRemote = true;
    try { saveLocal(keyName, remoteObj); }
    finally { applyingRemote = false; }

    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { section: 'ajustes' } }));
    } catch {}

    setStatus(`⬇️ Cloud → Local: ajustes actualizado (${new Date().toLocaleTimeString()})`);
  }

  function startRealtimeListeners(){
    if (!canSync() || listenersActive) return;
    const uid = cloudUser().uid;

    listenersActive = true;
    activeRefs.length = 0;

    const makeSec = (section, localKey, label) => {
      const rSec = ref(db, pSection(uid, section));
      activeRefs.push({ r: rSec, type: 'child' });

      onChildAdded(rSec, (snap) => {
        const id = snap.key;
        const obj = snap.val();
        applyRemoteToLocal(label, localKey, id, obj);
      });

      onChildChanged(rSec, (snap) => {
        const id = snap.key;
        const obj = snap.val();
        applyRemoteToLocal(label, localKey, id, obj);
      });
    };

    makeSec("clientes",  K.clientes,  "clientes");
    makeSec("productos", K.productos, "productos");
    makeSec("taras",     K.taras,     "taras");
    makeSec("facturas",  K.facturas,  "facturas");
    makeSec("ventas",    K.ventas,    "ventas");
    makeSec("contabilidad", K.contab, "contabilidad");

    // ajustes (objeto) con onValue
    const rAj = ref(db, pSection(uid, "ajustes"));
    activeRefs.push({ r: rAj, type: 'value' });
    onValue(rAj, (snap) => {
      if (!snap.exists()) return;
      applyRemoteObjectToLocal(K.ajustes, snap.val());
    });

    setStatus(`🟢 AutoSync ON (Realtime)`);
  }

  function stopRealtimeListeners(){
    if (!listenersActive) return;
    try{
      for (const it of activeRefs){
        off(it.r);
      }
    } catch {}
    activeRefs.length = 0;
    listenersActive = false;
    setStatus(`🟠 AutoSync OFF`);
  }

  /* =========================
     INTERCEPTAR GUARDADOS LOCALES
     - Wrap window.save si existe
     - Wrap localStorage.setItem como fallback
  ========================= */
  function hookLocalSaves(){
    // Wrap window.save (si tu app lo usa)
    if (typeof window.save === 'function' && !window.save.__fmWrapped){
      const orig = window.save;
      const wrapped = function(k, v){
        const res = orig(k, v);
        schedulePushByKey(k);
        return res;
      };
      wrapped.__fmWrapped = true;
      window.save = wrapped;
    }

    // Fallback: interceptar localStorage.setItem
    if (!localStorage.setItem.__fmWrapped){
      const origSetItem = localStorage.setItem.bind(localStorage);
      const wrappedSetItem = function(k, v){
        origSetItem(k, v);
        schedulePushByKey(k);
      };
      wrappedSetItem.__fmWrapped = true;
      localStorage.setItem = wrappedSetItem;
    }
  }

  /* =========================
     API GLOBAL
  ========================= */
  window.FM_CLOUD = {
    enabled: () => cloudEnabled,
    initError: () => cloudInitError,
    user: () => cloudUser(),
    login: async (email, pass) => {
      if (!cloudEnabled) throw new Error(cloudInitError || 'Cloud OFF');
      return signInWithEmailAndPassword(auth, email, pass);
    },
    logout: async () => {
      if (!cloudEnabled) throw new Error(cloudInitError || 'Cloud OFF');
      return signOut(auth);
    }
  };

  /* =========================
     UI B/W PRO (solo login/logout + estado)
  ========================= */
  const LS_EMAIL = 'fm_cloud_email';

  let statusLine = '';
  function setStatus(t){
    statusLine = t || '';
    const el = $('#fmCloudInfo');
    if (el) el.textContent = getStatusText();
  }

  function getStatusText(){
    const enabled = cloudEnabled ? 'ON' : 'OFF';
    const err = (!cloudEnabled && cloudInitError) ? `\nError: ${cloudInitError}` : '';
    const u = cloudUser();
    const who = u ? `\nAuth: LOGUEADO\nEmail: ${u.email || '(sin email)'}\nUID: ${(u.uid||'').slice(0,6)}…` : `\nAuth: NO logueado`;
    return `Cloud: ${enabled}${err}${who}\n\n${statusLine || ''}`.trim();
  }

  function injectCss(){
    if ($('#fmCloudCss')) return;
    const st = document.createElement('style');
    st.id = 'fmCloudCss';
    st.textContent = `
      .fmCloudFab{
        position:fixed; right:12px; bottom:12px; z-index:99999;
        border:1px solid #111; background:#fff; color:#000;
        border-radius:14px; padding:10px 12px; font-weight:900;
        box-shadow:0 8px 24px rgba(0,0,0,.16);
      }
      .fmCloudModal{ position:fixed; inset:0; z-index:999999; display:none; background:rgba(0,0,0,.55); }
      .fmCloudModal.open{ display:block; }
      .fmCloudCard{
        position:absolute; left:12px; right:12px; top:12px; bottom:12px;
        background:#fff; border:1px solid #111; border-radius:16px;
        padding:12px; display:flex; flex-direction:column; gap:10px;
      }
      .fmCloudTop{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .fmCloudTop b{ font-size:14px; }
      .fmCloudRow{ display:flex; gap:10px; flex-wrap:wrap; }
      .fmCloudRow input{
        flex:1; min-width:220px; border:1px solid rgba(0,0,0,.25);
        border-radius:12px; padding:10px 12px; font-size:14px;
      }
      .fmCloudBtns{ display:flex; gap:10px; flex-wrap:wrap; }
      .fmCloudBtns button{
        border:1px solid #111; background:#fff; color:#000;
        border-radius:12px; padding:10px 12px; font-weight:900;
      }
      .fmCloudBtns button.primary{ background:#111; color:#fff; }
      .fmCloudInfo{
        border:1px solid rgba(0,0,0,.18); border-radius:14px;
        padding:10px 12px; font-size:13px; line-height:1.35;
        background:linear-gradient(180deg,#fff,#f7f7f7);
        white-space:pre-wrap;
      }
      .fmCloudMsg{ font-size:12px; opacity:.85; line-height:1.3; white-space:pre-wrap; }
      .fmCloudClose{
        border:1px solid #111; background:#fff; border-radius:12px;
        padding:8px 10px; font-weight:900;
      }
      .fmCloudSmall{ font-size:12px; opacity:.7; }
    `;
    document.head.appendChild(st);
  }

  function buildUI(){
    if ($('#fmCloudFab')) return;

    const fab = document.createElement('button');
    fab.id = 'fmCloudFab';
    fab.className = 'fmCloudFab';
    fab.type = 'button';
    fab.textContent = '☁️ Cloud';
    document.body.appendChild(fab);

    const modal = document.createElement('div');
    modal.id = 'fmCloudModal';
    modal.className = 'fmCloudModal';
    modal.innerHTML = `
      <div class="fmCloudCard" role="dialog" aria-modal="true">
        <div class="fmCloudTop">
          <b>☁️ Cloud — AutoSync</b>
          <button class="fmCloudClose" id="fmCloudClose" type="button">Cerrar</button>
        </div>

        <div class="fmCloudRow">
          <input id="fmCloudEmail" type="email" autocomplete="email" placeholder="Email (Firebase Auth)" />
          <input id="fmCloudPass" type="password" autocomplete="current-password" placeholder="Contraseña" />
        </div>

        <div class="fmCloudBtns">
          <button id="fmBtnLogin" class="primary" type="button">Login</button>
          <button id="fmBtnLogout" type="button">Logout</button>
        </div>

        <div class="fmCloudInfo" id="fmCloudInfo">Estado: …</div>
        <div class="fmCloudMsg" id="fmCloudMsg"></div>

        <div class="fmCloudSmall">
          AutoSync: al guardar cualquier cosa se sube solo. En otros dispositivos baja en tiempo real.
          (La contraseña NO se guarda.)
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const open = () => modal.classList.add('open');
    const close = () => modal.classList.remove('open');

    fab.addEventListener('click', open);
    $('#fmCloudClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const emailEl = $('#fmCloudEmail');
    const passEl  = $('#fmCloudPass');
    const infoEl  = $('#fmCloudInfo');
    const msgEl   = $('#fmCloudMsg');

    emailEl.value = localStorage.getItem(LS_EMAIL) || '';

    const setMsg = (t) => { msgEl.textContent = t || ''; };
    const refresh = () => { infoEl.textContent = getStatusText(); };

    $('#fmBtnLogin').addEventListener('click', async () => {
      setMsg('');
      const email = emailEl.value.trim();
      const pass  = passEl.value;
      if (!email || !pass) return setMsg('⚠️ Pon email y contraseña.');
      try{
        localStorage.setItem(LS_EMAIL, email);
        await window.FM_CLOUD.login(email, pass);
        passEl.value = '';
        setStatus('🟢 AutoSync ON (conectado)');
        refresh();
      }catch(e){
        setMsg(friendlyError(e));
        refresh();
      }
    });

    $('#fmBtnLogout').addEventListener('click', async () => {
      setMsg('');
      try{
        await window.FM_CLOUD.logout();
        setStatus('🟠 AutoSync OFF (logout)');
        refresh();
      }catch(e){
        setMsg(friendlyError(e));
        refresh();
      }
    });

    refresh();
  }

  /* =========================
     BOOT
  ========================= */
  function boot(){
    injectCss();
    buildUI();
    hookLocalSaves();

    // Auto start/stop listeners + flush pending cuando hay login
    if (auth) {
      onAuthStateChanged(auth, async (u) => {
        if (!cloudEnabled) {
          setStatus(`Cloud OFF: ${cloudInitError}`);
          return;
        }

        if (u) {
          setStatus('🟢 AutoSync ON (conectando realtime…)');
          startRealtimeListeners();
          await flushPending().catch(()=>{});
          setStatus('🟢 AutoSync ON (realtime activo)');
        } else {
          stopRealtimeListeners();
          setStatus('🟠 AutoSync OFF (sin login)');
        }
      });
    } else {
      setStatus(`Cloud OFF: ${cloudInitError || 'sin auth'}`);
    }

    // estado inicial
    setStatus(cloudEnabled ? '🟠 AutoSync OFF (sin login)' : `Cloud OFF: ${cloudInitError}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
