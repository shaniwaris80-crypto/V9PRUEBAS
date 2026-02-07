/* =========================================================
   patches/cloud-sync-safe.js  — Cloud Sync SAFE (RTDB)
   - NO toca app.js
   - Evita borrados por dispositivos vacíos
   - Sync por registro + updatedAt
   - Realtime pull con onValue
========================================================= */
(() => {
  'use strict';
  if (window.__FM_CLOUD_SAFE_V2__) return;
  window.__FM_CLOUD_SAFE_V2__ = true;

  const FIREBASE_VER = '12.8.0';
  const MOBILE_MAX = 820;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const now = () => Date.now();

  // ---------- UI: Semáforo ----------
  function ensureDot() {
    const btn = $('#btnCloud');
    if (!btn) return null;
    let dot = $('#fmCloudDot');
    if (dot) return dot;
    dot = document.createElement('span');
    dot.id = 'fmCloudDot';
    dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:999px;margin-left:8px;vertical-align:middle;border:1px solid rgba(0,0,0,.25)';
    btn.appendChild(dot);
    return dot;
  }
  function setDot(color, title) {
    const dot = ensureDot();
    if (!dot) return;
    dot.style.background = color;
    dot.title = title || '';
  }

  // ---------- DeviceId (para debug/conflictos) ----------
  const DEVICE_ID_KEY = 'fm_device_id';
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
  const DEVICE_ID = getDeviceId();

  // ---------- Detectar keys de localStorage ----------
  function lsFindKeyAny(substrings) {
    const keys = Object.keys(localStorage);
    const lowSubs = substrings.map(s => String(s).toLowerCase());
    return keys.find(k => lowSubs.some(s => k.toLowerCase().includes(s))) || null;
  }

  function lsGetJSON(key, fallback) {
    try {
      if (!key) return fallback;
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  }
  function lsSetJSON(key, val) {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(val));
  }

  // Colecciones que sincronizamos (si existen)
  const COLS = [
    { col:'clientes',  hints:['clientes','client'] },
    { col:'productos', hints:['productos','product'] },
    { col:'taras',     hints:['taras','tara'] },
    { col:'facturas',  hints:['facturas','factura','invoices'] },
    { col:'ventas',    hints:['ventas','sales'] },
    { col:'pricehist', hints:['pricehist','hist','preciohist','price_hist'] },
    { col:'settings',  hints:['settings','ajustes'] },
    { col:'provider',  hints:['provider','proveedor'] },
  ];

  const LSKEY = {};
  for (const c of COLS) LSKEY[c.col] = lsFindKeyAny(c.hints);

  // ---------- Normalización de items ----------
  function stableId(col, it) {
    if (!it || typeof it !== 'object') return 'x_' + now();
    // ya trae id
    if (it.id) return String(it.id);

    if (col === 'facturas') {
      const num = it.numFactura || it.numero || it.num || it.facNumero || it.n;
      if (num) return String(num);
    }
    if (col === 'clientes') {
      const nif = it.nif || it.cif || it.NIF || it.CIF;
      if (nif) return 'cli_' + String(nif);
      if (it.nombre || it.nombreFiscal) return 'cli_' + String(it.nombreFiscal || it.nombre).slice(0,60);
    }
    if (col === 'productos') {
      if (it.nombre) return 'pro_' + String(it.nombre).slice(0,80);
    }
    if (col === 'taras') {
      if (it.nombre) return 'tara_' + String(it.nombre).slice(0,80);
    }
    // fallback
    return col + '_' + now() + '_' + Math.random().toString(16).slice(2);
  }

  function touch(col, it) {
    it.id = stableId(col, it);
    it.updatedAt = typeof it.updatedAt === 'number' ? it.updatedAt : now();
    it.updatedBy = it.updatedBy || DEVICE_ID;
    return it;
  }

  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
  }

  function dedupeById(col, arr) {
    const map = new Map();
    for (const raw of asArray(arr)) {
      if (!raw || typeof raw !== 'object') continue;
      const it = touch(col, { ...raw });
      const prev = map.get(it.id);
      if (!prev || (prev.updatedAt || 0) <= (it.updatedAt || 0)) map.set(it.id, it);
    }
    return Array.from(map.values());
  }

  function mergeLocalWithRemote(col, localArr, remoteObj) {
    const local = new Map();
    for (const it of dedupeById(col, localArr)) local.set(it.id, it);

    const remoteArr = asArray(remoteObj);
    for (const r0 of remoteArr) {
      if (!r0 || typeof r0 !== 'object') continue;
      const r = touch(col, { ...r0 });
      const l = local.get(r.id);
      if (!l || (l.updatedAt || 0) < (r.updatedAt || 0)) local.set(r.id, r);
    }

    return Array.from(local.values());
  }

  // ---------- Firebase load (modular) ----------
  let FB = null;

  async function loadFirebase() {
    if (FB) return FB;

    const [appMod, authMod, dbMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-database.js`),
    ]);

    const { initializeApp, getApps, getApp } = appMod;
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = authMod;
    const { getDatabase, ref, onValue, runTransaction, get, child } = dbMod;

    FB = { initializeApp, getApps, getApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, getDatabase, ref, onValue, runTransaction, get, child };
    return FB;
  }

  // ---------- Firebase config: lo lee de tu UI Ajustes ----------
  function readConfigFromUI() {
    const apiKey = ($('#fbApiKey')?.value || '').trim();
    const authDomain = ($('#fbAuthDomain')?.value || '').trim();
    const databaseURL = ($('#fbDbUrl')?.value || '').trim();
    const projectId = ($('#fbProjectId')?.value || '').trim();
    const appId = ($('#fbAppId')?.value || '').trim();
    const storageBucket = ($('#fbStorage')?.value || '').trim();

    if (!apiKey || !authDomain || !databaseURL || !projectId || !appId) return null;
    return { apiKey, authDomain, databaseURL, projectId, appId, storageBucket: storageBucket || undefined };
  }

  function cloudEnabled() {
    const chk = $('#ajCloudOn');
    if (!chk) return true; // si no existe, asumimos que sí
    return !!chk.checked;
  }

  // ---------- Estado ----------
  let app = null;
  let auth = null;
  let db = null;
  let user = null;

  let applyingRemote = false;
  let readyToPush = false;

  const loadedCols = new Set();
  const remoteCounts = {};

  function rootPath() {
    if (!user) return null;
    return `factumiral/${user.uid}`;
  }

  // ---------- Login/Logout ----------
  async function ensureInit() {
    if (!cloudEnabled()) {
      setDot('#b00', 'Cloud OFF (Ajustes)');
      return false;
    }

    const cfg = readConfigFromUI();
    if (!cfg) {
      setDot('#b00', 'Falta config Firebase en Ajustes');
      return false;
    }

    const F = await loadFirebase();
    app = F.getApps().length ? F.getApp() : F.initializeApp(cfg);
    auth = F.getAuth(app);
    db = F.getDatabase(app);

    F.onAuthStateChanged(auth, (u) => {
      user = u || null;
      if (!user) {
        readyToPush = false;
        setDot('#b00', 'No logueado');
      } else {
        setDot('#a80', 'Logueado: escuchando…');
        startRealtime();
      }
    });

    setDot('#a80', 'Cloud listo');
    return true;
  }

  async function doLogin() {
    const ok = await ensureInit();
    if (!ok) return;

    const email = prompt('Email Firebase (Auth):');
    const pass  = prompt('Contraseña:');
    if (!email || !pass) return;

    const F = await loadFirebase();
    await F.signInWithEmailAndPassword(auth, email, pass);
  }

  async function doLogout() {
    if (!auth) return;
    const F = await loadFirebase();
    await F.signOut(auth);
  }

  // ---------- Realtime Pull ----------
  function startRealtime() {
    if (!db || !user) return;
    const F = FB; // ya cargado

    for (const c of COLS) {
      const key = LSKEY[c.col];
      if (!key) continue;

      const p = `${rootPath()}/${c.col}`;
      const r = F.ref(db, p);

      F.onValue(r, (snap) => {
        const remoteVal = snap.val() || {};
        remoteCounts[c.col] = remoteVal ? Object.keys(remoteVal).length : 0;

        // merge remoto -> local sin borrar
        const localVal = lsGetJSON(key, []);
        const merged = mergeLocalWithRemote(c.col, localVal, remoteVal);

        applyingRemote = true;
        lsSetJSON(key, merged);
        applyingRemote = false;

        loadedCols.add(c.col);
        if (loadedCols.size >= Object.values(LSKEY).filter(Boolean).length) {
          readyToPush = true;
          setDot('#0a7', 'Cloud OK (Realtime)');
        }

        // Evento para tu app (si algún día lo quieres escuchar)
        window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { col: c.col, count: merged.length } }));

        // Refresh “suave”: si no estás escribiendo, intenta refrescar el tab actual
        const ae = document.activeElement;
        const writing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
        if (!writing) {
          if (c.col === 'facturas') $('#btnFacturasRefresh')?.click();
        }
      }, (err) => {
        console.warn('Cloud onValue error', c.col, err);
        setDot('#b00', 'Error onValue');
      });
    }
  }

  // ---------- Push incremental (por cambios) ----------
  async function upsertItem(col, item) {
    if (!db || !user) return { committed:false };
    const F = FB;

    const it = touch(col, { ...item, updatedAt: now(), updatedBy: DEVICE_ID });

    const p = `${rootPath()}/${col}/${encodeURIComponent(it.id)}`;
    const r = F.ref(db, p);

    // transacción: no pisa si en cloud hay uno más nuevo 
    const res = await F.runTransaction(r, (current) => {
      if (!current) return it;
      const cts = (current.updatedAt || 0);
      const nts = (it.updatedAt || 0);
      if (nts >= cts) return it;
      return; // abort
    }, { applyLocally: false });

    return res;
  }

  async function pushAll(colOnly=null) {
    if (!readyToPush || !user) return;

    // protección anti “dispositivo vacío”
    for (const c of COLS) {
      if (colOnly && c.col !== colOnly) continue;
      const key = LSKEY[c.col];
      if (!key) continue;

      const localArr = dedupeById(c.col, lsGetJSON(key, []));
      const remoteN = remoteCounts[c.col] || 0;

      if (localArr.length === 0 && remoteN > 0) {
        console.warn('Bloqueado push vacío para', c.col);
        continue;
      }

      for (const it of localArr) {
        await upsertItem(c.col, it);
      }
    }
    setDot('#0a7', 'Cloud OK (Push)');
  }

  // ---------- Hook: interceptar botones viejos (para que NO recargue) ----------
  function interceptButtons() {
    // Captura para matar handlers antiguos que hacían reload
    document.addEventListener('click', async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.id === 'btnCloudLogin') {
        e.preventDefault(); e.stopImmediatePropagation();
        await doLogin();
      }
      if (t.id === 'btnCloudLogout') {
        e.preventDefault(); e.stopImmediatePropagation();
        await doLogout();
      }
      if (t.id === 'btnCloudSync') {
        e.preventDefault(); e.stopImmediatePropagation();
        setDot('#a80', 'Sync…');
        await ensureInit();
        if (!user) await doLogin();
        await pushAll();
        setDot('#0a7', 'Cloud OK');
      }

      // Cuando “guardas” algo, empuja sin recargar
      const saveButtons = new Set(['btnGuardarFactura','btnClienteGuardar','btnClienteGuardar2','btnProdGuardar','btnTaraGuardar','btnVentasGuardar','btnAjustesGuardar','btnProvGuardar']);
      if (saveButtons.has(t.id)) {
        // deja que app.js guarde primero
        setTimeout(async () => {
          await ensureInit();
          if (!user) return;
          await pushAll();
        }, 120);
      }
    }, true);
  }

  // ---------- Hook: envolver window.save si existe (push incremental) ----------
  function wrapSave() {
    if (typeof window.save !== 'function' || window.save.__fmWrapped) return;

    const original = window.save;
    window.save = function(k, v) {
      const prevRaw = localStorage.getItem(k);
      const ret = original.apply(this, arguments);

      if (applyingRemote) return ret;
      if (!readyToPush || !user) return ret;

      // si toca una key de colecciones, sube cambios (simple: pushAll esa col)
      const hit = Object.entries(LSKEY).find(([,key]) => key === k);
      if (hit) {
        const col = hit[0];
        // debounce muy corto
        clearTimeout(window.__fmPushT);
        window.__fmPushT = setTimeout(() => pushAll(col), 300);
      }
      return ret;
    };
    window.save.__fmWrapped = true;
  }

  // ---------- UI extra móvil: botón “Subir facturas (sin duplicar)” ----------
  function mobileInvoiceButton() {
    const isMobile = window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches;
    if (!isMobile) return;

    const panel = $('#tabFacturas');
    if (!panel) return;
    if ($('#fmBtnUploadFacturasMobile')) return;

    const btn = document.createElement('button');
    btn.id = 'fmBtnUploadFacturasMobile';
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = 'Cloud: Subir facturas (sin duplicar)';
    btn.style.cssText = 'margin-left:8px;border:1px solid #111;border-radius:12px;padding:10px 12px;font-weight:900;';

    // intenta ponerlo junto a acciones del tab
    const actions = panel.querySelector('.panel__actions');
    (actions || panel).appendChild(btn);

    btn.addEventListener('click', async () => {
      await ensureInit();
      if (!user) await doLogin();
      setDot('#a80', 'Subiendo facturas…');
      await pushAll('facturas');
      setDot('#0a7', 'Facturas OK');
      alert('✅ Facturas subidas (sin duplicar: misma id = misma factura).');
    });
  }

  // ---------- Init ----------
  (async function init() {
    setDot('#b00', 'Cloud OFF/No init');
    interceptButtons();
    await ensureInit();
    wrapSave();
    mobileInvoiceButton();

    // reintentos suaves por si app.js tarda en definir save()
    for (let i=0;i<40;i++) { wrapSave(); await sleep(200); }
  })();

})();
