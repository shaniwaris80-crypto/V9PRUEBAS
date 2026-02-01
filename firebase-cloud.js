/* =========================================================
   FACTU MIRAL — firebase-cloud.js (AUTO CLOUD SYNC)
   - No modifica tu app: solo observa LocalStorage y sincroniza.
   - Auto-push: cada setItem/save sube lo cambiado (por updatedAt).
   - Auto-pull: realtime listeners bajan cambios de otros dispositivos.
   - Anti-wipe: NUNCA sube arrays vacíos.
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
  set,
  get,
  onChildAdded,
  onChildChanged,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

(() => {
  'use strict';

  /* =========================
     CONFIG (tu proyecto)
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
     Helpers
  ========================= */
  const $ = (s, r=document) => r.querySelector(s);
  const now = () => Date.now();

  function safeParse(s, fb){ try { return JSON.parse(s); } catch { return fb; } }
  function loadLS(k, fb){ const r = localStorage.getItem(k); return r==null ? fb : safeParse(r, fb); }
  function saveLS(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function cleanDbRoot(url){
    const raw = String(url || '').trim();
    if (!raw) return '';
    const noTrail = raw.replace(/\/+$/,'');
    return noTrail.replace(/^(https?:\/\/[^\/]+).*$/,'$1');
  }

  function updAt(o){ return (o && typeof o.updatedAt === 'number') ? o.updatedAt : 0; }

  function friendlyError(err){
    const msg = String(err?.code || err?.message || err || 'Error');
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) return '❌ Email/contraseña incorrectos.';
    if (msg.includes('auth/user-not-found')) return '❌ Usuario no existe (Firebase → Authentication → Users).';
    if (msg.includes('auth/unauthorized-domain')) return '❌ Dominio no autorizado (Auth → Settings → Authorized domains).';
    if (msg.toLowerCase().includes('permission_denied')) return '❌ Permission denied (Realtime DB Rules).';
    if (msg.toLowerCase().includes('database url')) return '❌ databaseURL incorrecto (debe ser la raíz del Realtime DB).';
    return `❌ ${msg}`;
  }

  /* =========================
     Firebase init (SAFE)
  ========================= */
  let app=null, auth=null, db=null;
  let enabled=false, initError='';

  try{
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    const root = cleanDbRoot(firebaseConfig.databaseURL);
    if (!root) throw new Error('Falta databaseURL');
    db = getDatabase(app, root);
    enabled = true;
  }catch(e){
    enabled = false;
    initError = friendlyError(e);
  }

  const user = () => auth?.currentUser || null;

  /* =========================
     Cloud paths
  ========================= */
  const base = (uid) => `factumiral/${uid}`;
  const pSection = (uid, section) => `${base(uid)}/${section}`;
  const pItem = (uid, section, id) => `${base(uid)}/${section}/${id}`;

  /* =========================
     KEY MAP (auto-detect)
     - No dependemos de window.K_...
     - Detecta tus keys reales en LocalStorage
  ========================= */
  const MAP_KEY = 'fm_cloud_keymap_v1';

  const DEFAULT_MAP = {
    clientes: null,
    productos: null,
    taras: null,
    facturas: null,
    ventas: null,
    contabilidad: null,
    ajustes: null
  };

  function scoreKeyForSection(parsed, section){
    // parsed: array|object
    // devolvemos score (0-100)
    let score = 0;

    if (section === 'ajustes'){
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // suele tener pins/iva/transporte/qr etc
        const s = JSON.stringify(parsed).toLowerCase();
        if (s.includes('iva')) score += 10;
        if (s.includes('transporte')) score += 10;
        if (s.includes('pin')) score += 10;
        if (s.includes('qr')) score += 10;
        score += 5;
      }
      return score;
    }

    if (!Array.isArray(parsed)) return 0;
    if (parsed.length === 0) return 0;

    const sample = parsed.slice(0, Math.min(8, parsed.length));
    const keys = new Set();
    sample.forEach(o => {
      if (o && typeof o === 'object') Object.keys(o).forEach(k => keys.add(k.toLowerCase()));
    });

    const has = (k) => keys.has(k);

    // base: arrays de objetos con id
    if (sample.some(o => o && typeof o === 'object' && ('id' in o))) score += 10;

    if (section === 'clientes'){
      if (has('nif') || has('cif')) score += 20;
      if (has('dir') || has('direccion')) score += 15;
      if (has('tel') || has('telefono')) score += 10;
      if (has('email')) score += 10;
      if (has('nombre') || has('alias')) score += 10;
    }

    if (section === 'productos'){
      if (has('modo')) score += 15;
      if (has('kgporcaja') || has('kgcaja') || has('kg_caja')) score += 15;
      if (has('precio') || has('preciokg') || has('preciocaja') || has('precioud')) score += 20;
      if (has('origen')) score += 8;
      if (has('coste')) score += 8;
    }

    if (section === 'taras'){
      if (has('tara') || has('peso') || has('pesotara')) score += 25;
      if (has('envase') || has('nombre')) score += 10;
      if (has('notas')) score += 5;
    }

    if (section === 'facturas'){
      if (has('numero') || has('nfactura') || has('num')) score += 20;
      if (has('fecha')) score += 15;
      if (has('lineas') || has('items') || has('productos')) score += 20;
      if (has('total') || has('subtotal')) score += 15;
      if (has('cliente') || has('clienteid')) score += 10;
      if (has('iva')) score += 5;
    }

    if (section === 'ventas'){
      if (has('tienda') || has('store') || has('sede')) score += 20;
      if (has('efectivo')) score += 15;
      if (has('tarjeta')) score += 15;
      if (has('total')) score += 10;
      if (has('fecha') || has('date')) score += 10;
    }

    if (section === 'contabilidad'){
      if (has('kpi') || has('margen') || has('iva')) score += 15;
      if (has('desde') || has('hasta') || has('mes') || has('trimestre')) score += 10;
      if (has('total') || has('ventas')) score += 10;
    }

    return score;
  }

  function detectKeyMap(){
    // si usuario define override, lo usamos
    if (window.FM_CLOUD_KEYMAP && typeof window.FM_CLOUD_KEYMAP === 'object') {
      return { ...DEFAULT_MAP, ...window.FM_CLOUD_KEYMAP };
    }

    const cached = loadLS(MAP_KEY, null);
    if (cached && typeof cached === 'object') return { ...DEFAULT_MAP, ...cached };

    const allKeys = Object.keys(localStorage);
    const candidates = allKeys.map(k => {
      const raw = localStorage.getItem(k) || '';
      if (raw.length < 10) return null;
      const parsed = safeParse(raw, null);
      if (!parsed) return null;
      return { k, parsed, chars: raw.length };
    }).filter(Boolean);

    const result = { ...DEFAULT_MAP };

    const sections = ['clientes','productos','taras','facturas','ventas','contabilidad','ajustes'];

    for (const sec of sections){
      let best = { key:null, score:0, chars:0 };
      for (const c of candidates){
        const s = scoreKeyForSection(c.parsed, sec);
        if (s > best.score || (s === best.score && c.chars > best.chars)){
          best = { key:c.k, score:s, chars:c.chars };
        }
      }
      // umbral mínimo (para no elegir cualquier cosa)
      const min = (sec==='ajustes') ? 10 : 25;
      result[sec] = (best.score >= min) ? best.key : null;
    }

    saveLS(MAP_KEY, result);
    return result;
  }

  let KEYMAP = detectKeyMap();

  /* =========================
     Last pushed cache (persistente)
  ========================= */
  const LP_KEY = 'fm_cloud_lastpushed_v1';
  const lastPushed = loadLS(LP_KEY, {
    clientes:{}, productos:{}, taras:{}, facturas:{}, ventas:{}, contabilidad:{}, ajustes:0
  });

  function saveLastPushed(){ saveLS(LP_KEY, lastPushed); }

  /* =========================
     Anti-loop flags
  ========================= */
  let applyingRemote = false;
  let internalWrite = false;

  /* =========================
     Queue pending writes (offline/login)
  ========================= */
  const PENDING_KEY = 'fm_cloud_pending_keys_v1';
  const pending = new Set(loadLS(PENDING_KEY, []));
  function savePending(){ saveLS(PENDING_KEY, Array.from(pending)); }

  /* =========================
     Auto-push core
  ========================= */
  const timers = new Map(); // lsKey -> timeout

  function schedulePush(lsKey){
    if (!lsKey) return;
    if (applyingRemote || internalWrite) return;

    // si la key no es de las nuestras, ignorar
    const watched = Object.values(KEYMAP).includes(lsKey);
    if (!watched) return;

    if (timers.has(lsKey)) clearTimeout(timers.get(lsKey));
    timers.set(lsKey, setTimeout(() => {
      timers.delete(lsKey);
      autoPushByLsKey(lsKey).catch(()=>{});
    }, 250));
  }

  function getSectionByLsKey(lsKey){
    for (const [sec,k] of Object.entries(KEYMAP)){
      if (k === lsKey) return sec;
    }
    return null;
  }

  function ensureUpdatedAt(arr, lsKey, section){
    // añade updatedAt si falta (sin disparar loops)
    let changed = false;
    const out = arr.map(o=>{
      if (!o || typeof o !== 'object') return o;
      if (!o.id) return o;
      if (typeof o.updatedAt === 'number') return o;
      changed = true;
      return { ...o, updatedAt: now() };
    });
    if (changed){
      internalWrite = true;
      try { saveLS(lsKey, out); } finally { internalWrite = false; }
    }
    return out;
  }

  function ventaId(o){
    // id recomendado: YYYY-MM-DD|SANPABLO
    if (o?.id) return o.id;
    const date = o?.date || o?.fecha || o?.fechaISO || o?.dia;
    const store = o?.store || o?.tienda || o?.sede || o?.shop;
    if (date && store) return `${date}|${store}`;
    return null;
  }

  async function autoPushByLsKey(lsKey){
    if (!enabled) return;
    if (!user()){
      pending.add(lsKey);
      savePending();
      return;
    }

    const uid = user().uid;
    const section = getSectionByLsKey(lsKey);
    if (!section) return;

    const raw = localStorage.getItem(lsKey);
    if (!raw) return;

    const parsed = safeParse(raw, null);
    if (!parsed) return;

    // Ajustes (objeto)
    if (section === 'ajustes'){
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const up = { ...parsed };
      if (typeof up.updatedAt !== 'number') up.updatedAt = now();

      // anti-spam
      if (up.updatedAt <= (lastPushed.ajustes || 0)) return;

      await set(ref(db, pSection(uid, 'ajustes')), up);
      lastPushed.ajustes = up.updatedAt;
      saveLastPushed();
      return;
    }

    // Arrays: anti-wipe (no sube vacío)
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    let arr = parsed;

    // ventas: id puede no existir
    if (section === 'ventas'){
      const fixed = [];
      let changed = false;
      for (const o of arr){
        if (!o || typeof o !== 'object') continue;
        const id = ventaId(o);
        if (!id) continue;
        if (o.id !== id) { changed = true; fixed.push({ ...o, id }); }
        else fixed.push(o);
      }
      if (changed){
        internalWrite = true;
        try { saveLS(lsKey, fixed); } finally { internalWrite = false; }
      }
      arr = fixed;
    }

    // asegurar updatedAt si falta
    if (section !== 'ventas') arr = ensureUpdatedAt(arr, lsKey, section);

    // subir SOLO lo nuevo/modificado por updatedAt
    const lp = lastPushed[section] || {};
    for (const o of arr){
      if (!o || typeof o !== 'object') continue;

      const id = o.id || (section==='ventas' ? ventaId(o) : null);
      if (!id) continue;

      const up = { ...o };
      if (typeof up.updatedAt !== 'number') up.updatedAt = now();

      const last = lp[id] || 0;
      if (up.updatedAt <= last) continue;

      await set(ref(db, pItem(uid, section, id)), up);
      lp[id] = up.updatedAt;
    }
    lastPushed[section] = lp;
    saveLastPushed();
  }

  async function flushPending(){
    if (!enabled || !user()) return;
    const keys = Array.from(pending);
    pending.clear();
    savePending();
    for (const k of keys){
      await autoPushByLsKey(k).catch(()=>{});
    }
  }

  /* =========================
     Auto-pull realtime
  ========================= */
  let listenersOn = false;
  const activeRefs = [];

  function applyRemoteArrayItem(lsKey, id, remoteObj){
    if (!lsKey || !id || !remoteObj) return;

    const localArr = loadLS(lsKey, []);
    if (!Array.isArray(localArr)) return;

    // buscar local
    const idx = localArr.findIndex(x => x && x.id === id);
    const localObj = idx >= 0 ? localArr[idx] : null;

    if (localObj && updAt(remoteObj) <= updAt(localObj)) return;

    applyingRemote = true;
    try{
      const next = localArr.slice();
      if (idx >= 0) next[idx] = remoteObj;
      else next.push(remoteObj);
      saveLS(lsKey, next);
    } finally {
      applyingRemote = false;
    }

    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { lsKey, id } }));
    } catch {}
  }

  function applyRemoteObject(lsKey, remoteObj){
    if (!lsKey || !remoteObj || typeof remoteObj !== 'object' || Array.isArray(remoteObj)) return;

    const localObj = loadLS(lsKey, { updatedAt: 0 });
    if (typeof remoteObj.updatedAt !== 'number') return;
    if (remoteObj.updatedAt <= (localObj.updatedAt || 0)) return;

    applyingRemote = true;
    try { saveLS(lsKey, remoteObj); } finally { applyingRemote = false; }

    try {
      window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { lsKey, id: 'ajustes' } }));
    } catch {}
  }

  function stopListeners(){
    if (!listenersOn) return;
    try { activeRefs.forEach(r => off(r)); } catch {}
    activeRefs.length = 0;
    listenersOn = false;
  }

  function startListeners(){
    if (!enabled || !user() || listenersOn) return;
    listenersOn = true;

    const uid = user().uid;

    // secciones array
    for (const sec of ['clientes','productos','taras','facturas','ventas','contabilidad']){
      const lsKey = KEYMAP[sec];
      if (!lsKey) continue;

      const r = ref(db, pSection(uid, sec));
      activeRefs.push(r);

      onChildAdded(r, snap => {
        const id = snap.key;
        const obj = snap.val();
        if (!id || !obj) return;
        applyRemoteArrayItem(lsKey, id, obj);
      });
      onChildChanged(r, snap => {
        const id = snap.key;
        const obj = snap.val();
        if (!id || !obj) return;
        applyRemoteArrayItem(lsKey, id, obj);
      });
      // Nota: NO escuchamos removals -> anti-borrado local
    }

    // ajustes object
    if (KEYMAP.ajustes){
      const rAj = ref(db, pSection(uid, 'ajustes'));
      activeRefs.push(rAj);
      onValue(rAj, snap => {
        if (!snap.exists()) return;
        applyRemoteObject(KEYMAP.ajustes, snap.val());
      });
    }
  }

  /* =========================
     Hook saves (sin tocar tu app)
  ========================= */
  function hookSaves(){
    // 1) Wrap localStorage.setItem (lo más universal)
    if (!localStorage.setItem.__fmWrapped){
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k, v){
        orig(k, v);
        schedulePush(k);
      };
      localStorage.setItem.__fmWrapped = true;
    }

    // 2) Si tu app tiene window.save(k,v), también lo envolvemos
    if (typeof window.save === 'function' && !window.save.__fmWrapped){
      const origSave = window.save;
      window.save = function(k, v){
        const r = origSave(k, v);
        schedulePush(k);
        return r;
      };
      window.save.__fmWrapped = true;
    }
  }

  /* =========================
     UI (solo login/logout + estado)
  ========================= */
  const LS_EMAIL = 'fm_cloud_email_v1';

  function injectCss(){
    if ($('#fmCloudCss')) return;
    const st = document.createElement('style');
    st.id = 'fmCloudCss';
    st.textContent = `
      .fmCloudFab{ position:fixed; right:12px; bottom:12px; z-index:99999;
        border:1px solid #111; background:#fff; color:#000; border-radius:14px;
        padding:10px 12px; font-weight:900; box-shadow:0 8px 24px rgba(0,0,0,.16); }
      .fmCloudModal{ position:fixed; inset:0; z-index:999999; display:none; background:rgba(0,0,0,.55); }
      .fmCloudModal.open{ display:block; }
      .fmCloudCard{ position:absolute; left:12px; right:12px; top:12px; bottom:12px;
        background:#fff; border:1px solid #111; border-radius:16px; padding:12px;
        display:flex; flex-direction:column; gap:10px; }
      .fmCloudTop{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .fmCloudRow{ display:flex; gap:10px; flex-wrap:wrap; }
      .fmCloudRow input{ flex:1; min-width:220px; border:1px solid rgba(0,0,0,.25);
        border-radius:12px; padding:10px 12px; font-size:14px; }
      .fmCloudBtns{ display:flex; gap:10px; flex-wrap:wrap; }
      .fmCloudBtns button{ border:1px solid #111; background:#fff; color:#000;
        border-radius:12px; padding:10px 12px; font-weight:900; }
      .fmCloudBtns button.primary{ background:#111; color:#fff; }
      .fmCloudInfo{ border:1px solid rgba(0,0,0,.18); border-radius:14px; padding:10px 12px;
        font-size:13px; line-height:1.35; background:linear-gradient(180deg,#fff,#f7f7f7);
        white-space:pre-wrap; }
      .fmCloudClose{ border:1px solid #111; background:#fff; border-radius:12px;
        padding:8px 10px; font-weight:900; }
      .fmCloudMsg{ font-size:12px; opacity:.85; white-space:pre-wrap; }
    `;
    document.head.appendChild(st);
  }

  function statusText(extra=''){
    KEYMAP = detectKeyMap(); // por si cambian keys con el tiempo
    const on = enabled ? 'ON' : 'OFF';
    const err = (!enabled && initError) ? `\nError: ${initError}` : '';
    const u = user();
    const who = u ? `\nAuth: LOGUEADO\nEmail: ${u.email||'(sin email)'}\nUID: ${(u.uid||'').slice(0,6)}…` : `\nAuth: NO logueado`;
    const km = `\n\nKEYMAP:\n` +
      `clientes: ${KEYMAP.clientes||'-'}\n` +
      `productos: ${KEYMAP.productos||'-'}\n` +
      `taras: ${KEYMAP.taras||'-'}\n` +
      `facturas: ${KEYMAP.facturas||'-'}\n` +
      `ventas: ${KEYMAP.ventas||'-'}\n` +
      `contab: ${KEYMAP.contabilidad||'-'}\n` +
      `ajustes: ${KEYMAP.ajustes||'-'}\n`;
    return `Cloud: ${on}${err}${who}${km}${extra?`\n${extra}`:''}`.trim();
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
          <b style="font:800 14px system-ui">☁️ Cloud — AutoSync</b>
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

        <div class="fmCloudInfo" id="fmCloudInfo">Estado…</div>
        <div class="fmCloudMsg" id="fmCloudMsg"></div>
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
    const refresh = (extra='') => { infoEl.textContent = statusText(extra); };

    $('#fmBtnLogin').addEventListener('click', async () => {
      setMsg('');
      const email = emailEl.value.trim();
      const pass  = passEl.value;
      if (!email || !pass) return setMsg('⚠️ Pon email y contraseña.');
      try{
        localStorage.setItem(LS_EMAIL, email);
        await signInWithEmailAndPassword(auth, email, pass);
        passEl.value = '';
        refresh('✅ Login OK — AutoSync activo');
      }catch(e){
        setMsg(friendlyError(e));
        refresh();
      }
    });

    $('#fmBtnLogout').addEventListener('click', async () => {
      setMsg('');
      try{
        await signOut(auth);
        refresh('✅ Logout OK');
      }catch(e){
        setMsg(friendlyError(e));
        refresh();
      }
    });

    refresh();
    onAuthStateChanged(auth, () => refresh());
  }

  /* =========================
     Public API minimal
  ========================= */
  window.FM_CLOUD = {
    enabled: () => enabled,
    initError: () => initError,
    keymap: () => ({...KEYMAP}),
    user: () => user()
  };

  /* =========================
     Boot
  ========================= */
  function boot(){
    hookSaves();
    injectCss();
    buildUI();

    if (!enabled) return;

    onAuthStateChanged(auth, async (u) => {
      if (u){
        KEYMAP = detectKeyMap();
        startListeners();
        await flushPending().catch(()=>{});
      } else {
        stopListeners();
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
