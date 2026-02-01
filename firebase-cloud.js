/* =========================================================
   FACTU MIRAL — firebase-cloud.js PRO (B/W + EASY SYNC)
   - Sin reload automático
   - Auto-sync con debounce (opcional)
   - Sync ahora = Recibir (merge) + Enviar
   - Indicador estado + cola pendiente
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, get, update, onChildAdded, onChildChanged, off } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

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

  // ========= Helpers =========
  const $ = (s, r=document) => r.querySelector(s);
  const now = () => Date.now();
  const pad2 = (n) => String(n).padStart(2,'0');
  const fmt = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };

  const LS_EMAIL   = 'fm_cloud_email_v2';
  const TEAM_EMAIL = "shaniwaris80@gmail.com"; // ✅ login único
  const LS_AUTO    = 'fm_cloud_auto_v2';        // "1" / "0"
  const LS_UIREF   = 'fm_cloud_uirefresh_v2';   // "1" / "0"
  const LS_DEVICE  = 'fm_cloud_device_v2';
  const LS_META    = 'fm_cloud_meta_v2';        // { keyEnc: updatedAt }

  const EXCLUDE_PREFIX = ['firebase:', 'grm_', 'goog:', 'debug_', 'cache', 'session', 'fm_cloud_'];
  const EXCLUDE_EXACT  = new Set([LS_EMAIL, LS_AUTO, LS_UIREF, LS_DEVICE, LS_META]);

  const isExcludedKey = (k) => EXCLUDE_EXACT.has(k) || EXCLUDE_PREFIX.some(p => k.startsWith(p));

  const safeJson = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
  const looksData = (k, raw) => {
    // Heurística para no subir “estado UI” pequeñito
    const nameOk = /(clientes|productos|taras|facturas|settings|provider|precio|pricehist|ventas)/i.test(k)
                || /factu|miral|arslan|v\d+/i.test(k);
    const s = String(raw || '').trim();
    const jsonLike = s.startsWith('{') || s.startsWith('[');
    const j = jsonLike ? safeJson(s) : null;
    const bigEnough = s.length > 20;
    const notTinyObject = !(j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).length <= 1 && s.length < 80);
    return (nameOk && jsonLike && bigEnough && notTinyObject) || (jsonLike && s.length > 400); // segunda vía: JSON grande
  };

  // Base64URL para usar keys en RTDB sin romper paths
  const b64urlEncode = (str) => {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };

  // ========= Estado =========
  let enabled = true;
  let initErr = '';
  let app=null, auth=null, db=null;

  let uid = null;
  let deviceId = localStorage.getItem(LS_DEVICE);
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
    localStorage.setItem(LS_DEVICE, deviceId);
  }

  let autoSync = (localStorage.getItem(LS_AUTO) ?? '1') === '1';         // por defecto ON (más fácil)
  let uiRefresh = (localStorage.getItem(LS_UIREF) ?? '0') === '1';       // por defecto OFF (evita saltos)
  let pendingCount = 0;
  let lastPush = 0;
  let lastPull = 0;
  let lastRemoteApplied = 0;

  let applyingRemote = false;
  let listenersOn = false;
  let kvRef = null;

  const meta = (() => {
    try { return JSON.parse(localStorage.getItem(LS_META) || '{}') || {}; }
    catch { return {}; }
  })();
  const saveMeta = () => localStorage.setItem(LS_META, JSON.stringify(meta));

  function rootPath(_uid){ return `factumiral/${_uid}`; }
  function kvPath(_uid){ return `${rootPath(_uid)}/kv`; }
  function metaPath(_uid){ return `${rootPath(_uid)}/meta`; }

  // ========= UI (B/W PRO) =========
  function injectUI(){
    if ($('#fmCloudFab')) return;

    const st = document.createElement('style');
    st.textContent = `
      .fmFab{position:fixed;right:12px;bottom:12px;z-index:999999;border:1px solid #111;background:#fff;border-radius:14px;padding:10px 12px;font:900 13px system-ui;box-shadow:0 10px 24px rgba(0,0,0,.18);display:flex;gap:10px;align-items:center}
      .fmDot{width:10px;height:10px;border-radius:999px;border:1px solid #111;background:#fff}
      .fmDot.on{background:#111}
      .fmDot.warn{background:#fff; box-shadow:0 0 0 2px #111 inset}
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
      .fmTog{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .fmTog label{display:flex;gap:8px;align-items:center;border:1px solid rgba(0,0,0,.2);border-radius:999px;padding:8px 10px;font:800 12px system-ui}
      .fmTog input{transform:scale(1.1)}
    `;
    document.head.appendChild(st);

    const fab = document.createElement('button');
    fab.id = 'fmCloudFab';
    fab.className = 'fmFab';
    fab.type = 'button';
    fab.innerHTML = `<span id="fmDot" class="fmDot"></span><span id="fmFabTxt">☁️ Cloud</span>`;
    document.body.appendChild(fab);

    const modal = document.createElement('div');
    modal.id = 'fmCloudModal';
    modal.className = 'fmM';
    modal.innerHTML = `
      <div class="fmC">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <b style="font:900 14px system-ui">☁️ Cloud · PRO Sync</b>
          <button id="fmClose" style="border:1px solid #111;background:#fff;border-radius:12px;padding:8px 10px;font:900 13px system-ui">Cerrar</button>
        </div>

        <div class="fmRow" id="fmLoginRow">
          <input id="fmEmail" type="email" autocomplete="email" placeholder="Email" />
          <input id="fmPass" type="password" autocomplete="current-password" placeholder="Contraseña" />
        </div>

        <div class="fmTog">
          <label><input id="fmAuto" type="checkbox"> Auto-sync</label>
          <label><input id="fmUI" type="checkbox"> Refrescar UI</label>
        </div>

        <div class="fmBtns">
          <button id="fmLogin" class="p" type="button">Login</button>
          <button id="fmLogout" type="button">Logout</button>
          <button id="fmSync" class="p" type="button">⚡ Sincronizar ahora</button>
          <button id="fmPull" type="button">⬇️ Recibir</button>
          <button id="fmPush" type="button">⬆️ Enviar</button>
        </div>

        <div class="fmInfo" id="fmInfo">Estado…</div>
        <div class="fmMsg" id="fmMsg"></div>
      </div>
    `;
    document.body.appendChild(modal);

    $('#fmEmail').value = localStorage.getItem(LS_EMAIL) || '';
    $('#fmAuto').checked = autoSync;
    $('#fmUI').checked = uiRefresh;

    fab.onclick = () => { modal.classList.add('open'); render(); };
    $('#fmClose').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.classList.remove('open'); });
  }

  function setDot(mode){
    const dot = $('#fmDot');
    if (!dot) return;
    dot.classList.remove('on','warn');
    if (mode === 'on') dot.classList.add('on');
    if (mode === 'warn') dot.classList.add('warn');
  }

  function msg(t){ const m = $('#fmMsg'); if (m) m.textContent = t || ''; }

  function render(extra=''){
    const info = $('#fmInfo');
    const txt  = $('#fmFabTxt');
    const u = auth?.currentUser;
    const logged = !!u;

    // dot
    if (!logged) setDot(''); else if (pendingCount > 0) setDot('warn'); else setDot('on');

    if (txt) {
      const state = logged ? (pendingCount > 0 ? `Pendiente (${pendingCount})` : 'OK') : 'OFF';
      txt.textContent = `☁️ Cloud · ${state}`;
    }

    if (!info) return;
    info.textContent =
      `enabled: ${enabled}\n` +
      (enabled ? '' : `initErr: ${initErr}\n`) +
      `auth: ${logged ? 'LOGUEADO' : 'NO'}\n` +
      (logged ? `email: ${u.email || '-'}\nuid: ${(u.uid||'').slice(0,8)}…\n` : '') +
      `device: ${deviceId}\n` +
      `autoSync: ${autoSync}\n` +
      `uiRefresh: ${uiRefresh}\n` +
      `pendientes: ${pendingCount}\n` +
      `lastPush: ${fmt(lastPush)}\n` +
      `lastPull: ${fmt(lastPull)}\n` +
      `lastRemoteApplied: ${fmt(lastRemoteApplied)}\n` +
      (extra ? `\n${extra}` : '');
  }

  // ========= Firebase init =========
  try{
    app = initializeApp(firebaseConfig);
    setPersistence(auth, browserLocalPersistence).catch(()=>{});
    db = getDatabase(app);
  }catch(e){
    enabled = false;
    initErr = String(e?.message || e);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectUI(); render(); wireUI(); }, { once:true });
  } else {
    injectUI(); render(); wireUI();
  }

  if (!enabled) return;

  // ========= Sync core =========
  function getDataKeys(){
    const keys = [];
    for (const k of Object.keys(localStorage)){
      if (isExcludedKey(k)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      if (looksData(k, raw)) keys.push(k);
    }
    // fallback: si no encuentra nada, sube todo menos excluidos
    if (keys.length === 0) {
      for (const k of Object.keys(localStorage)){
        if (!isExcludedKey(k)) keys.push(k);
      }
    }
    return Array.from(new Set(keys));
  }

  async function pushKeys(keys){
    if (!uid) throw new Error('No auth');
    const base = kvPath(uid);
    const ts = now();
    const updatesMap = {};

    for (const k of keys){
      if (isExcludedKey(k)) continue;
      const raw = localStorage.getItem(k);
      if (raw == null) continue;

      const enc = b64urlEncode(k);
      updatesMap[`${base}/${enc}`] = { k, raw, updatedAt: ts, deviceId };
      meta[enc] = ts;
    }

    // meta ping
    updatesMap[`${metaPath(uid)}/lastPush`] = { ts, deviceId };

    await update(ref(db), updatesMap);
    saveMeta();
    lastPush = ts;
    pendingCount = 0;
    render(`✅ Push OK · keys=${keys.length}`);
  }

  async function pullOnce(){
    if (!uid) throw new Error('No auth');
    const base = kvPath(uid);
    const snap = await get(ref(db, base));
    if (!snap.exists()) { lastPull = now(); render('ℹ️ Pull: vacío'); return 0; }

    const obj = snap.val() || {};
    let applied = 0;
    applyingRemote = true;

    try{
      for (const enc of Object.keys(obj)){
        const row = obj[enc];
        if (!row || typeof row.raw !== 'string' || !row.k) continue;

        const remoteAt = Number(row.updatedAt || 0);
        const localAt  = Number(meta[enc] || 0);

        // aplica solo si es más nuevo
        if (remoteAt > localAt){
          localStorage.setItem(row.k, row.raw);
          meta[enc] = remoteAt;
          applied++;
        }
      }
      saveMeta();
    } finally {
      applyingRemote = false;
    }

    lastPull = now();
    lastRemoteApplied = applied ? lastPull : lastRemoteApplied;

    // Opcional: refrescar UI de tu app SOLO si lo activas
    if (uiRefresh && applied){
      try { window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail:{ reason:'pulled', applied } })); } catch {}
    }

    render(`✅ Pull OK · applied=${applied}`);
    return applied;
  }

  // Sincronizar PRO: recibe, luego envía (source-of-truth final = local)
  async function syncNow(){
    msg('');
    if (!uid) return msg('⚠️ Haz login primero.');
    try{
      render('⏳ Sync… (pull+push)');
      await pullOnce();
      const keys = getDataKeys();
      await pushKeys(keys);
      msg('✅ Sync OK (sin reload)');
    }catch(e){
      msg('❌ ' + (e?.code || e?.message || e));
      render('❌ Error sync');
    }
  }

  // ========= Auto-sync (debounce) =========
  const pending = new Set();
  let flushTimer = null;

  function scheduleAutoPush(k){
    if (!uid) return;
    if (!autoSync) return;
    if (applyingRemote) return;
    if (isExcludedKey(k)) return;

    const raw = localStorage.getItem(k);
    if (!looksData(k, raw)) return;

    pending.add(k);
    pendingCount = pending.size;
    render();

    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      if (!uid || !autoSync) return;
      const list = Array.from(pending);
      pending.clear();
      pendingCount = 0;
      try{
        await pushKeys(list);
        msg(`✅ Auto-sync · ${list.length} keys`);
      }catch{
        // si falla, volvemos a poner pendiente
        list.forEach(x => pending.add(x));
        pendingCount = pending.size;
        render('⚠️ Auto-sync falló (queda pendiente)');
      }
    }, 500);
  }

  function hookLocalStorage(){
    if (localStorage.setItem.__fmWrapped) return;

    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){
      orig(k, v);
      scheduleAutoPush(k);
    };
    localStorage.setItem.__fmWrapped = true;
  }

  // ========= Realtime pull (sin romper UI) =========
  function startRealtime(){
    if (listenersOn || !uid) return;
    listenersOn = true;
    hookLocalStorage();

    kvRef = ref(db, kvPath(uid));
    const handler = (snap) => {
      const enc = snap.key;
      const row = snap.val();
      if (!enc || !row || !row.k || typeof row.raw !== 'string') return;

      // no reaplicar tus propios writes (opcional)
      if (row.deviceId && row.deviceId === deviceId) return;

      const remoteAt = Number(row.updatedAt || 0);
      const localAt  = Number(meta[enc] || 0);
      if (remoteAt <= localAt) return;

      applyingRemote = true;
      try{
        localStorage.setItem(row.k, row.raw);
        meta[enc] = remoteAt;
        saveMeta();
      } finally {
        applyingRemote = false;
      }

      lastRemoteApplied = now();
      render(`📥 Cambio remoto: ${row.k}`);

      if (uiRefresh){
        try { window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail:{ reason:'realtime', key: row.k } })); } catch {}
      }
    };

    onChildAdded(kvRef, handler);
    onChildChanged(kvRef, handler);
  }

  function stopRealtime(){
    if (!listenersOn) return;
    try { if (kvRef) off(kvRef); } catch {}
    listenersOn = false;
    kvRef = null;
  }

  // ========= UI wiring =========
  function wireUI(){
    // toggles
    $('#fmAuto')?.addEventListener('change', (e) => {
      autoSync = !!e.target.checked;
      localStorage.setItem(LS_AUTO, autoSync ? '1' : '0');
      render();
    });

    $('#fmUI')?.addEventListener('change', (e) => {
      uiRefresh = !!e.target.checked;
      localStorage.setItem(LS_UIREF, uiRefresh ? '1' : '0');
      render();
    });

    // login/logout/sync
    $('#fmLogin')?.addEventListener('click', async () => {
      msg('');
      const em = ($('#fmEmail')?.value || '').trim();
      const pw = $('#fmPass')?.value || '';
      if (!em || !pw) return msg('⚠️ Pon email y contraseña.');

      try{
        localStorage.setItem(LS_EMAIL, em);
        await signInWithEmailAndPassword(auth, em, pw);
        if ($('#fmPass')) $('#fmPass').value = '';
        msg('✅ Login OK');
      }catch(e){
        msg('❌ ' + (e?.code || e?.message || e));
      }
      render();
    });

    $('#fmLogout')?.addEventListener('click', async () => {
      msg('');
      try { await signOut(auth); msg('✅ Logout'); }
      catch(e){ msg('❌ ' + (e?.code || e?.message || e)); }
      render();
    });

    $('#fmSync')?.addEventListener('click', syncNow);

    $('#fmPull')?.addEventListener('click', async () => {
      msg('');
      if (!uid) return msg('⚠️ Haz login primero.');
      try{ await pullOnce(); msg('✅ Recibir OK'); }
      catch(e){ msg('❌ ' + (e?.code || e?.message || e)); }
    });

    $('#fmPush')?.addEventListener('click', async () => {
      msg('');
      if (!uid) return msg('⚠️ Haz login primero.');
      try{
        const keys = getDataKeys();
        await pushKeys(keys);
        msg(`✅ Enviar OK · ${keys.length} keys`);
      }catch(e){
        msg('❌ ' + (e?.code || e?.message || e));
      }
    });

    // auto-fill email
    const e = $('#fmEmail');
    if (e) e.value = localStorage.getItem(LS_EMAIL) || '';
  }

  // ========= Auth lifecycle =========
  onAuthStateChanged(auth, (u) => {
    uid = u?.uid || null;
    if (uid) {
      startRealtime();
      render('✅ Realtime ON');
    } else {
      stopRealtime();
      pendingCount = 0;
      render('ℹ️ OFF');
    }
  });

})();
