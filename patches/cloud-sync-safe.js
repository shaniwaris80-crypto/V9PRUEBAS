(() => {
  'use strict';
  if (window.__FM_CLOUD_SAFE__) return;
  window.__FM_CLOUD_SAFE__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------- Mini UI (toast + semáforo) ----------
  function toast(title, msg){
    if (typeof window.toast === 'function') return window.toast(title, msg);
    let box = $('#fmToastBox');
    if (!box){
      box = document.createElement('div');
      box.id = 'fmToastBox';
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.style.cssText = 'background:#111;color:#fff;padding:10px 12px;border-radius:12px;max-width:92vw;box-shadow:0 10px 24px rgba(0,0,0,.25);font:13px system-ui;opacity:.96;';
    t.innerHTML = `<div style="font-weight:900">${escapeHtml(title||'Cloud')}</div><div style="opacity:.85;margin-top:2px">${escapeHtml(msg||'')}</div>`;
    box.appendChild(t);
    setTimeout(()=>t.remove(), 3200);
  }
  function escapeHtml(s){ return (s??'').toString().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  function setDot(state){ // off / warn / ok / busy
    const btn = $('#btnCloud');
    if (!btn) return;
    let dot = $('#fmCloudDot');
    if (!dot){
      dot = document.createElement('span');
      dot.id = 'fmCloudDot';
      dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:999px;margin-left:8px;border:1px solid rgba(0,0,0,.35);vertical-align:middle;';
      btn.appendChild(dot);
    }
    const map = { off:'#999', warn:'#f4b400', ok:'#0f9d58', busy:'#4285f4' };
    dot.style.background = map[state] || '#999';
  }

  function diag(modeTxt, cloudTxt, savedTxt){
    const a = $('#diagMode');  if (a && modeTxt!=null) a.textContent = modeTxt;
    const b = $('#diagCloud'); if (b && cloudTxt!=null) b.textContent = cloudTxt;
    const c = $('#diagSaved'); if (c && savedTxt!=null) c.textContent = savedTxt;
  }

  // ---------- Config ----------
  const CFG = window.FM_FIREBASE_DEFAULT_CONFIG || null;

  // ---------- DeviceId (para evitar bucles) ----------
  const DEVICE_KEY = 'fm_device_id';
  const deviceId = localStorage.getItem(DEVICE_KEY) || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+'_'+Math.random().toString(16).slice(2));
  localStorage.setItem(DEVICE_KEY, deviceId);

  // ---------- Keys localStorage: usa LS si existe, si no adivina ----------
  function pickKey(keys, needles){
    const low = keys.map(k=>k.toLowerCase());
    for (let i=0;i<keys.length;i++){
      const k = keys[i], kl = low[i];
      if (needles.some(n => kl.includes(n))) return k;
    }
    return null;
  }

  function resolveLSKeys(){
    // si tu app expone un mapa LS (ideal)
    const W = window.LS;
    if (W && typeof W === 'object'){
      const ok = ['provider','settings','clientes','productos','taras','facturas','pricehist','ventas'].every(k => typeof W[k] === 'string');
      if (ok) return { ...W };
    }

    const keys = Object.keys(localStorage);
    return {
      provider:  pickKey(keys, ['provider','proveedor','prov_','prov']),
      settings:  pickKey(keys, ['settings','ajustes','config']),
      clientes:  pickKey(keys, ['clientes','clients']),
      productos: pickKey(keys, ['productos','products','vocab']),
      taras:     pickKey(keys, ['taras','envases']),
      facturas:  pickKey(keys, ['facturas','invoices']),
      pricehist: pickKey(keys, ['pricehist','histprecio','historialprecio']),
      ventas:    pickKey(keys, ['ventas','sales'])
    };
  }

  // ---------- JSON safe ----------
  function jget(k, fallback){
    try{
      if (!k) return fallback;
      const raw = localStorage.getItem(k);
      if (!raw) return fallback;
      return JSON.parse(raw);
    }catch{ return fallback; }
  }
  function jset(k, v){
    if (!k) return;
    localStorage.setItem(k, JSON.stringify(v));
  }

  // ---------- Merge helpers (NO BORRA, solo une) ----------
  function normKey(s){ return (s??'').toString().trim().toLowerCase(); }

  function best(a,b){
    // elige el más “nuevo” si hay timestamps comunes
    const ta = a?.updatedAt || a?.updated_at || a?.ts || a?.t || 0;
    const tb = b?.updatedAt || b?.updated_at || b?.ts || b?.t || 0;
    if (ta && tb) return tb >= ta ? b : a;
    // si no hay ts: el que tenga más campos
    const ca = a && typeof a==='object' ? Object.keys(a).length : 0;
    const cb = b && typeof b==='object' ? Object.keys(b).length : 0;
    return cb >= ca ? b : a;
  }

  function mergeObj(a, b){
    // une objetos, si hay conflicto elige “best”
    if (!a) return b;
    if (!b) return a;
    if (typeof a !== 'object' || typeof b !== 'object') return b ?? a;
    const out = { ...a };
    for (const k of Object.keys(b)){
      if (out[k] == null) out[k] = b[k];
      else out[k] = best(out[k], b[k]);
    }
    return out;
  }

  function mergeArrayByKey(A, B, getK){
    const map = new Map();
    (Array.isArray(A) ? A : []).forEach(it => {
      const k = getK(it);
      if (!k) return;
      map.set(k, it);
    });
    (Array.isArray(B) ? B : []).forEach(it => {
      const k = getK(it);
      if (!k) return;
      const prev = map.get(k);
      map.set(k, prev ? best(prev, it) : it);
    });
    return Array.from(map.values());
  }

  // ---------- Snapshot local <-> cloud ----------
  function readLocalSnapshot(LSK){
    return {
      provider:  jget(LSK.provider,  {}),
      settings:  jget(LSK.settings,  {}),
      clientes:  jget(LSK.clientes,  []),
      productos: jget(LSK.productos, []),
      taras:     jget(LSK.taras,     []),
      facturas:  jget(LSK.facturas,  []),
      pricehist: jget(LSK.pricehist, []),
      ventas:    jget(LSK.ventas,    []),

      __meta: {
        deviceId,
        updatedMs: Date.now()
      }
    };
  }

  function mergeSnapshots(cloud, local){
    const C = cloud || {};
    const L = local || {};

    const out = {
      provider:  mergeObj(C.provider,  L.provider),
      settings:  mergeObj(C.settings,  L.settings),

      clientes:  mergeArrayByKey(C.clientes,  L.clientes,  x => normKey(x?.id || x?.nif || x?.cif || x?.nombre)),
      productos: mergeArrayByKey(C.productos, L.productos, x => normKey(x?.id || x?.nombre)),
      taras:     mergeArrayByKey(C.taras,     L.taras,     x => normKey(x?.id || x?.nombre)),
      facturas:  mergeArrayByKey(C.facturas,  L.facturas,  x => normKey(x?.numFactura || x?.numero || x?.num || x?.id)),
      pricehist: mergeObj(C.pricehist, L.pricehist),
      ventas:    mergeArrayByKey(C.ventas,    L.ventas,    x => normKey(x?.id || x?.fecha))
    };

    out.__meta = {
      deviceId,
      updatedMs: Date.now(),
      cloudUpdatedMs: Math.max(C?.__meta?.cloudUpdatedMs||0, Date.now())
    };

    return out;
  }

  function applySnapshotToLocal(LSK, snap){
    if (!snap || typeof snap !== 'object') return;

    // ✅ solo escribe en claves que existan/estén detectadas (no inventa)
    if (LSK.provider)  jset(LSK.provider,  snap.provider  ?? {});
    if (LSK.settings)  jset(LSK.settings,  snap.settings  ?? {});
    if (LSK.clientes)  jset(LSK.clientes,  snap.clientes  ?? []);
    if (LSK.productos) jset(LSK.productos, snap.productos ?? []);
    if (LSK.taras)     jset(LSK.taras,     snap.taras     ?? []);
    if (LSK.facturas)  jset(LSK.facturas,  snap.facturas  ?? []);
    if (LSK.pricehist) jset(LSK.pricehist, snap.pricehist ?? []);
    if (LSK.ventas)    jset(LSK.ventas,    snap.ventas    ?? []);
  }

  // ---------- Firebase (modular) ----------
  let FB = null;
  async function getFirebase(){
    if (FB) return FB;
    if (!CFG) throw new Error('Firebase config no detectada (firebase-default-config.js)');

    const [appMod, authMod, dbMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js'),
    ]);

    const { initializeApp, getApps, getApp } = appMod;
    const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } = authMod;
    const { getDatabase, ref, get, onValue, off, runTransaction, serverTimestamp, set } = dbMod;

    const app = getApps().length ? getApp() : initializeApp(CFG);
    const auth = getAuth(app);
    const db = getDatabase(app);

    FB = { auth, db, ref, get, onValue, off, runTransaction, serverTimestamp, set, signOut, signInWithEmailAndPassword, onAuthStateChanged };
    return FB;
  }

  function cloudRoot(uid){
    // ✅ usa estructura simple y estable
    return {
      ls:   `factumiral/${uid}/ls`,
      meta: `factumiral/${uid}/meta`
    };
  }

  // ---------- Estado ----------
  const S = {
    enabled: false,
    syncing: false,
    uid: null,
    lastRemoteUpdatedMs: 0,
    unsub: null,
    debounce: null,
  };

  function cloudEnabled(){
    const on = $('#ajCloudOn');
    return !!on && !!on.checked;
  }

  function isTyping(){
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }

  // ---------- Login / Logout ----------
  async function login(){
    const { auth, signInWithEmailAndPassword } = await getFirebase();
    if (auth.currentUser) return auth.currentUser;

    const email = prompt('Email Firebase (Cloud):');
    const pass  = prompt('Contraseña:');
    if (!email || !pass) throw new Error('Login cancelado');

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }

  async function logout(){
    const { auth, signOut } = await getFirebase();
    await signOut(auth);
  }

  // ---------- Sync (merge seguro con transaction) ----------
  async function syncSafe(reason='manual'){
    if (!cloudEnabled()) {
      toast('Cloud', 'Cloud está OFF (actívalo en Ajustes).');
      setDot('off');
      diag('Local', 'Off', '—');
      return;
    }

    const LSK = resolveLSKeys();
    const local = readLocalSnapshot(LSK);

    const { auth, db, ref, get, runTransaction, serverTimestamp, set } = await getFirebase();
    const user = auth.currentUser || await login();
    S.uid = user.uid;

    const paths = cloudRoot(user.uid);
    const lsRef = ref(db, paths.ls);
    const metaRef = ref(db, paths.meta);

    setDot('busy');
    diag('Cloud', 'On', 'Sincronizando…');

    S.syncing = true;
    try{
      // Transaction = no permite “pisar” con vacío; siempre mergea con lo que hay en cloud
      const tx = await runTransaction(lsRef, (current) => {
        const merged = mergeSnapshots(current || {}, local);
        return merged;
      });

      if (!tx.committed){
        toast('Cloud', 'No se pudo hacer commit (intenta de nuevo).');
        setDot('warn');
        diag('Cloud', 'On', 'Commit falló');
        return;
      }

      const merged = tx.snapshot.val() || {};

      // meta (para detectar cambios y mostrar diagnóstico)
      await set(metaRef, {
        updatedAt: serverTimestamp(),
        updatedMs: Date.now(),
        deviceId,
        reason,
      });

      // aplicar a local (sin borrar)
      applySnapshotToLocal(LSK, merged);

      // refresco suave (sin reload)
      const now = new Date();
      diag('Cloud', 'On', now.toLocaleString());
      setDot('ok');
      toast('Cloud', 'Sync OK (merge seguro, sin recargar)');

      // si estás en tabs con botón “Actualizar”, lo pulsa (solo si NO estás escribiendo)
      if (!isTyping()){
        $('#btnFacturasRefresh')?.click();
      }

      // evento para que tu app (si quiere) refresque
      window.dispatchEvent(new CustomEvent('fmcloud.changed', { detail: { reason, updatedMs: Date.now() } }));

    }catch(e){
      console.error(e);
      setDot('warn');
      diag('Cloud', 'On', 'Error');
      toast('Cloud', 'Error sync: ' + (e?.message || e));
    }finally{
      S.syncing = false;
    }
  }

  // ---------- Listener remoto (baja cambios sin recargar) ----------
  async function startRemoteListener(){
    if (!cloudEnabled()) return;

    const { auth, db, ref, onValue, off, get } = await getFirebase();
    const user = auth.currentUser || await login();
    S.uid = user.uid;

    const LSK = resolveLSKeys();
    const paths = cloudRoot(user.uid);
    const lsRef = ref(db, paths.ls);
    const metaRef = ref(db, paths.meta);

    // evita duplicar listener
    if (S.unsub){
      try { S.unsub(); } catch {}
      S.unsub = null;
    }

    // track meta updatedMs para ignorar “eco”
    onValue(metaRef, (snap)=>{
      const m = snap.val() || {};
      if (m.deviceId === deviceId) return;
      const u = m.updatedMs || 0;
      if (u && u > S.lastRemoteUpdatedMs) S.lastRemoteUpdatedMs = u;
    });

    const unsub = onValue(lsRef, (snap) => {
      const remote = snap.val();
      if (!remote) return;

      // si estamos escribiendo o sincronizando, no molestamos, pero sí guardamos local
      applySnapshotToLocal(LSK, remote);

      if (!S.syncing && !isTyping()){
        toast('Cloud', 'Datos nuevos desde otro dispositivo ✅');
        $('#btnFacturasRefresh')?.click();
        window.dispatchEvent(new CustomEvent('fmcloud.changed', { detail: { reason:'remote' } }));
      }
      setDot('ok');
      diag('Cloud', 'On', new Date().toLocaleString());
    });

    S.unsub = () => { try { off(lsRef); } catch {} try { unsub(); } catch {} };

    setDot('ok');
    diag('Cloud', 'On', 'Escuchando cambios…');
  }

  // ---------- Botones extra (subir local) ----------
  function mountButtons(){
    // botón “SUBIR LOCAL” dentro de Ajustes (si existe zona)
    const host = $('#tabAjustes .rowActions') || $('#tabAjustes') || document.body;
    if (!host) return;

    if (!$('#btnCloudPushLocal')){
      const b = document.createElement('button');
      b.id = 'btnCloudPushLocal';
      b.type = 'button';
      b.className = 'btn btn--primary';
      b.textContent = 'Subir local → Cloud';
      b.style.marginLeft = '8px';
      host.appendChild(b);

      b.addEventListener('click', async ()=>{
        await syncSafe('push_local');
        await startRemoteListener();
      });
    }
  }

  // ---------- Hook a botones “Guardar” (auto-sync suave) ----------
  function debounceSync(reason){
    if (!cloudEnabled()) return;
    if (S.debounce) clearTimeout(S.debounce);
    S.debounce = setTimeout(() => {
      // si estás escribiendo, espera un poco más
      if (isTyping()) return debounceSync(reason);
      syncSafe(reason);
    }, 2500);
  }

  function hookSaveButtons(){
    const ids = [
      'btnGuardarFactura','btnClienteGuardar','btnClienteGuardar2',
      'btnProdGuardar','btnTaraGuardar','btnVentasGuardar',
      'btnAjustesGuardar','btnProvGuardar','btnAddPay'
    ];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (!el || el.__fmHooked) return;
      el.__fmHooked = true;
      el.addEventListener('click', () => debounceSync('save_click'));
    });

    // Ctrl+S (guardar) -> sync suave
    document.addEventListener('keydown', (e)=>{
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){
        debounceSync('ctrl_s');
      }
    }, { capture:true });
  }

  // ---------- Integración con tus botones cloud existentes ----------
  function hookCloudUi(){
    $('#btnCloudLogin')?.addEventListener('click', async ()=>{
      try{
        setDot('busy');
        await login();
        toast('Cloud', 'Login OK');
        setDot('ok');
        await startRemoteListener();
      }catch(e){
        console.error(e);
        setDot('warn');
        toast('Cloud', 'Login error: ' + (e?.message||e));
      }
    });

    $('#btnCloudLogout')?.addEventListener('click', async ()=>{
      try{
        await logout();
        toast('Cloud', 'Sesión cerrada');
        setDot('off');
        diag('Local', 'Off', '—');
      }catch(e){
        console.error(e);
        toast('Cloud', 'Logout error');
      }
    });

    $('#btnCloudSync')?.addEventListener('click', async ()=>{
      await syncSafe('manual_sync');
      await startRemoteListener();
    });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', async ()=>{
    setDot(cloudEnabled() ? 'warn' : 'off');
    diag(cloudEnabled() ? 'Cloud' : 'Local', cloudEnabled() ? 'On' : 'Off', '—');

    mountButtons();
    hookSaveButtons();
    hookCloudUi();

    // si cloud ON, intenta escuchar (si no hay login pedirá cuando sincronices)
    if (cloudEnabled()){
      toast('Cloud', 'Listo. Usa “Sync” o “Subir local → Cloud”.');
    }
  });

})();
