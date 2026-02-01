/* =========================================================
   FACTU MIRAL — firebase-cloud.js (COMPLETO)
   Offline-first + Cloud opcional (Firebase Auth + Realtime DB)
   - Si Firebase falla: NO rompe nada (Cloud OFF)
   - Login email/password
   - Sync DOWN (descargar + merge por updatedAt)
   - Sync UP (subir no destructivo, por ID, sin borrar)
   - UI PRO con botones (☁️ Cloud)
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
  set
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

    // ✅ REQUERIDO PARA REALTIME DATABASE:
    // IMPORTANTE: SOLO RAÍZ. SIN /final y SIN rutas.
    // Ejemplo correcto:
    // "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
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
  function mergeMaps(localMap, remoteMap){
    const out = { ...(localMap || {}) };
    for (const [id, r] of Object.entries(remoteMap || {})){
      const l = out[id];
      if (!l || updAt(r) >= updAt(l)) out[id] = r;
    }
    return out;
  }

  function cleanDbRoot(url){
    const raw = String(url || '').trim();
    if (!raw) return '';
    // quita / final + cualquier child path
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
     KEYS LOCALSTORAGE (AJUSTABLES)
     - Si tu app ya define window.K_..., se usan.
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

  function getLocalState(){
    return {
      clientes:  loadLocal(K.clientes,  []),
      productos: loadLocal(K.productos, []),
      taras:     loadLocal(K.taras,     []),
      facturas:  loadLocal(K.facturas,  []),
      ventas:    loadLocal(K.ventas,    []),        // recomendado: array con id="YYYY-MM-DD|STORE"
      contab:    loadLocal(K.contab,    []),        // array con id
      ajustes:   loadLocal(K.ajustes,   { updatedAt: 0 })
    };
  }

  function setLocalState(next){
    if (next.clientes)  saveLocal(K.clientes,  next.clientes);
    if (next.productos) saveLocal(K.productos, next.productos);
    if (next.taras)     saveLocal(K.taras,     next.taras);
    if (next.facturas)  saveLocal(K.facturas,  next.facturas);
    if (next.ventas)    saveLocal(K.ventas,    next.ventas);
    if (next.contab)    saveLocal(K.contab,    next.contab);
    if (next.ajustes)   saveLocal(K.ajustes,   next.ajustes);
  }

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
      // ✅ si el usuario pegó url con / o child path, aquí se limpia
      db = getDatabase(app, root);
      cloudEnabled = true;
    }
  } catch (e) {
    cloudEnabled = false;
    cloudInitError = friendlyError(e);
  }

  /* =========================
     CLOUD PATHS
  ========================= */
  const base = (uid) => `factumiral/${uid}`;
  const pSection = (uid, section) => `${base(uid)}/${section}`;
  const pItem = (uid, section, id) => `${base(uid)}/${section}/${id}`;

  async function readSection(uid, section){
    if (!cloudEnabled) return {};
    const snap = await get(ref(db, pSection(uid, section)));
    return snap.exists() ? (snap.val() || {}) : {};
  }

  /* =========================
     SYNC DOWN (merge updatedAt)
  ========================= */
  async function syncDownMergeAll(){
    if (!cloudEnabled) throw new Error(cloudInitError || 'Cloud OFF');
    const u = auth.currentUser;
    if (!u) throw new Error('No logueado');

    const [cR, pR, tR, fR, vR, kR, aSnap] = await Promise.all([
      readSection(u.uid, "clientes"),
      readSection(u.uid, "productos"),
      readSection(u.uid, "taras"),
      readSection(u.uid, "facturas"),
      readSection(u.uid, "ventas"),
      readSection(u.uid, "contabilidad"),
      get(ref(db, `${base(u.uid)}/ajustes`))
    ]);

    const aR = aSnap.exists() ? (aSnap.val() || null) : null;

    const L = getLocalState();

    const cM = mergeMaps(toMap(L.clientes),  cR);
    const pM = mergeMaps(toMap(L.productos), pR);
    const tM = mergeMaps(toMap(L.taras),     tR);
    const fM = mergeMaps(toMap(L.facturas),  fR);

    // ventas/contab: se guardan como mapa por id
    const vM = mergeMaps(toMap(L.ventas, "id"), vR);
    const kM = mergeMaps(toMap(L.contab, "id"), kR);

    let aM = L.ajustes || { updatedAt: 0 };
    if (aR && typeof aR.updatedAt === "number" && aR.updatedAt >= (aM.updatedAt || 0)) aM = aR;

    setLocalState({
      clientes:  toArray(cM),
      productos: toArray(pM),
      taras:     toArray(tM),
      facturas:  toArray(fM),
      ventas:    toArray(vM),
      contab:    toArray(kM),
      ajustes:   aM
    });

    return {
      ok: true,
      merged: {
        clientes:  Object.keys(cM).length,
        productos: Object.keys(pM).length,
        taras:     Object.keys(tM).length,
        facturas:  Object.keys(fM).length,
        ventas:    Object.keys(vM).length,
        contab:    Object.keys(kM).length
      }
    };
  }

  /* =========================
     SYNC UP (no destructivo)
  ========================= */
  async function setOne(uid, section, id, obj){
    if (!obj) return { ok:false, id, reason:"empty" };
    const payload = { ...obj };
    if (typeof payload.updatedAt !== "number") payload.updatedAt = nowMs();
    await set(ref(db, pItem(uid, section, id)), payload);
    return { ok:true, id };
  }

  async function syncUpAllNonDestructive(){
    if (!cloudEnabled) throw new Error(cloudInitError || 'Cloud OFF');
    const u = auth.currentUser;
    if (!u) throw new Error('No logueado');

    const L = getLocalState();

    const cM = toMap(L.clientes);
    const pM = toMap(L.productos);
    const tM = toMap(L.taras);
    const fM = toMap(L.facturas);
    const vM = toMap(L.ventas, "id");
    const kM = toMap(L.contab, "id");
    const aj = L.ajustes || null;

    // Si local está vacío, esto NO borra nada (solo sube 0).
    const tasks = [];

    for (const [id,obj] of Object.entries(cM)) if (id) tasks.push(()=>setOne(u.uid,"clientes",id,obj));
    for (const [id,obj] of Object.entries(pM)) if (id) tasks.push(()=>setOne(u.uid,"productos",id,obj));
    for (const [id,obj] of Object.entries(tM)) if (id) tasks.push(()=>setOne(u.uid,"taras",id,obj));
    for (const [id,obj] of Object.entries(fM)) if (id) tasks.push(()=>setOne(u.uid,"facturas",id,obj));
    for (const [id,obj] of Object.entries(vM)) if (id) tasks.push(()=>setOne(u.uid,"ventas",id,obj));
    for (const [id,obj] of Object.entries(kM)) if (id) tasks.push(()=>setOne(u.uid,"contabilidad",id,obj));

    if (aj && typeof aj === 'object'){
      const payload = { ...aj };
      if (typeof payload.updatedAt !== "number") payload.updatedAt = nowMs();
      tasks.push(()=>set(ref(db, `${base(u.uid)}/ajustes`), payload).then(()=>({ok:true,id:"ajustes"})));
    }

    let ok = 0, fail = 0;
    for (const fn of tasks){
      try { const r = await fn(); if (r?.ok) ok++; else fail++; }
      catch { fail++; }
    }

    return { ok:true, writesOk: ok, writesFail: fail };
  }

  /* =========================
     UPSERTS (uso recomendado)
  ========================= */
  async function upsert(section, obj, idKey="id"){
    if (!cloudEnabled) throw new Error(cloudInitError || 'Cloud OFF');
    const u = auth.currentUser;
    if (!u) throw new Error('No logueado');
    const id = obj?.[idKey];
    if (!id) throw new Error(`Falta ${idKey} en ${section}`);
    const payload = { ...obj };
    if (typeof payload.updatedAt !== "number") payload.updatedAt = nowMs();
    await set(ref(db, pItem(u.uid, section, id)), payload);
    return { ok:true, id };
  }

  function makeVentaId(date, store){ return `${date}|${store}`; }

  /* =========================
     EXPONE API GLOBAL
  ========================= */
  window.FM_CLOUD = {
    enabled: () => cloudEnabled,
    initError: () => cloudInitError,

    app,
    auth,
    db,

    user: () => auth?.currentUser || null,
    onAuth: (fn) => (auth ? onAuthStateChanged(auth, fn) : null),

    login: (email, pass) => {
      if (!cloudEnabled) return Promise.reject(new Error(cloudInitError || 'Cloud OFF'));
      return signInWithEmailAndPassword(auth, email, pass);
    },
    logout: () => {
      if (!cloudEnabled) return Promise.reject(new Error(cloudInitError || 'Cloud OFF'));
      return signOut(auth);
    },

    syncDownMergeAll,
    syncUpAllNonDestructive,

    upsertCliente:  (o)=>upsert("clientes", o),
    upsertProducto: (o)=>upsert("productos", o),
    upsertTara:     (o)=>upsert("taras", o),
    upsertFactura:  (o)=>upsert("facturas", o),
    upsertContab:   (o)=>upsert("contabilidad", o, "id"),

    makeVentaId,
    upsertVenta: (ventaObj)=>{
      const v = { ...ventaObj };
      if (!v.id) v.id = makeVentaId(v.date, v.store);
      return upsert("ventas", v, "id");
    }
  };

  // Log útil (no rompe si cloud OFF)
  try {
    if (auth) {
      onAuthStateChanged(auth, (u) => {
        console.log("[FM_CLOUD] enabled=", cloudEnabled, "auth=", u ? ("OK uid=" + u.uid) : "OUT");
      });
    } else {
      console.log("[FM_CLOUD] enabled=", cloudEnabled, "auth=NOAUTH", cloudInitError);
    }
  } catch {}

  /* =========================================================
     UI PRO — BOTÓN ☁️ + PANEL (SIN CONSOLA)
  ========================================================= */
  const LS_EMAIL = 'fm_cloud_email';

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
      .fmCloudModal{
        position:fixed; inset:0; z-index:999999; display:none;
        background:rgba(0,0,0,.55);
      }
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
        flex:1; min-width:220px;
        border:1px solid rgba(0,0,0,.25); border-radius:12px;
        padding:10px 12px; font-size:14px;
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

  function buildCloudUI(){
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
          <b>☁️ Cloud — Login + Sync</b>
          <button class="fmCloudClose" id="fmCloudClose" type="button">Cerrar</button>
        </div>

        <div class="fmCloudRow">
          <input id="fmCloudEmail" type="email" autocomplete="email" placeholder="Email (Firebase Auth)" />
          <input id="fmCloudPass" type="password" autocomplete="current-password" placeholder="Contraseña" />
        </div>

        <div class="fmCloudBtns">
          <button id="fmBtnLogin" class="primary" type="button">Login</button>
          <button id="fmBtnLogout" type="button">Logout</button>

          <button id="fmBtnFirstUse" class="primary" type="button">Primer uso en este dispositivo (DOWN + Recargar)</button>
          <button id="fmBtnDown" type="button">Sync DOWN (Descargar + Mezclar)</button>
          <button id="fmBtnUp" type="button">Sync UP (Subir cambios)</button>
        </div>

        <div class="fmCloudInfo" id="fmCloudInfo">Estado: esperando…</div>
        <div class="fmCloudMsg" id="fmCloudMsg"></div>

        <div class="fmCloudSmall">
          Nota: la contraseña NO se guarda. El email sí (opcional).
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
    const setInfo = (t) => { infoEl.textContent = t || ''; };

    function statusText(extra=''){
      const enabled = window.FM_CLOUD.enabled();
      const initErr = window.FM_CLOUD.initError();
      const u = window.FM_CLOUD.user();

      let s = `Cloud: ${enabled ? 'ON' : 'OFF'}\n`;
      if (!enabled && initErr) s += `Error: ${initErr}\n`;

      if (!u) s += `Auth: NO logueado\n`;
      else {
        const e = u.email || '(sin email)';
        const uid = (u.uid || '').slice(0,6) + '…';
        s += `Auth: LOGUEADO\nEmail: ${e}\nUID: ${uid}\n`;
      }
      if (extra) s += `\n${extra}`;
      return s;
    }

    async function refresh(extra=''){
      setInfo(statusText(extra));
    }

    // Listener auth (si existe)
    try { window.FM_CLOUD.onAuth(()=>refresh()); } catch {}

    $('#fmBtnLogin').addEventListener('click', async () => {
      setMsg('');
      const email = emailEl.value.trim();
      const pass  = passEl.value;
      if (!email || !pass) return setMsg('⚠️ Pon email y contraseña.');
      try{
        localStorage.setItem(LS_EMAIL, email);
        await window.FM_CLOUD.login(email, pass);
        passEl.value = '';
        await refresh('✅ Login OK');
      }catch(e){
        setMsg(friendlyError(e));
        await refresh();
      }
    });

    $('#fmBtnLogout').addEventListener('click', async () => {
      setMsg('');
      try{
        await window.FM_CLOUD.logout();
        await refresh('✅ Logout OK');
      }catch(e){
        setMsg(friendlyError(e));
        await refresh();
      }
    });

    $('#fmBtnDown').addEventListener('click', async () => {
      setMsg('');
      try{
        const r = await window.FM_CLOUD.syncDownMergeAll();
        await refresh(`✅ Sync DOWN OK\n${JSON.stringify(r.merged, null, 2)}`);
      }catch(e){
        setMsg(friendlyError(e));
        await refresh();
      }
    });

    $('#fmBtnUp').addEventListener('click', async () => {
      setMsg('');
      try{
        const r = await window.FM_CLOUD.syncUpAllNonDestructive();
        await refresh(`✅ Sync UP OK\nOK: ${r.writesOk}  FAIL: ${r.writesFail}`);
      }catch(e){
        setMsg(friendlyError(e));
        await refresh();
      }
    });

    $('#fmBtnFirstUse').addEventListener('click', async () => {
      setMsg('');
      const email = emailEl.value.trim();
      const pass  = passEl.value;

      try{
        if (!window.FM_CLOUD.user()){
          if (!email || !pass) return setMsg('⚠️ Para “primer uso”, pon email y contraseña.');
          localStorage.setItem(LS_EMAIL, email);
          await window.FM_CLOUD.login(email, pass);
          passEl.value = '';
        }
        await window.FM_CLOUD.syncDownMergeAll();
        setMsg('✅ Descargado. Recargando…');
        setTimeout(()=>location.reload(), 300);
      }catch(e){
        setMsg(friendlyError(e));
        await refresh();
      }
    });

    refresh('Panel listo.');
  }

  function boot(){
    injectCss();
    buildCloudUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
