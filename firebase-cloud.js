/* =========================================================
   firebase-cloud.js (DROP-IN) — Factu Miral
   - Offline primero: la app funciona sin cloud
   - Cloud opcional: Auth + Realtime Database
   - Sync DOWN (merge por updatedAt)
   - Sync UP NO destructivo (no borra nada en cloud)
   - Upserts por entidad (recomendado)
   ========================================================= */

/* ✅ Firebase CDN (modular) — recomendado para webs sin bundler */
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

/* =========================
   CONFIG (TUYO)
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
  authDomain: "factumiral.firebaseapp.com",
  projectId: "factumiral",
  storageBucket: "factumiral.firebasestorage.app",
  messagingSenderId: "576821038417",
  appId: "1:576821038417:web:aba329f36563134bb01770",
  measurementId: "G-HJVL8ET49L",

  // ✅ OBLIGATORIO para Realtime Database:
  // pon aquí tu URL real
  databaseURL: "https://console.firebase.google.com/project/factumiral/database/factumiral-default-rtdb/data/~2F#:~:text=link-,https%3A//factumiral%2Ddefault%2Drtdb.europe%2Dwest1.firebasedatabase.app,-mode_edit"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* =========================
   STORAGE KEYS (AJUSTA SI TU APP USA OTRAS)
   - Si tu app ya define window.K_..., lo respetamos.
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

/* =========================
   HELPERS LOCAL (NO ROMPE NADA)
========================= */
function nowMs(){ return Date.now(); }

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

/* Normaliza arrays -> map por id */
function toMap(arr, idKey="id"){
  const m = {};
  (Array.isArray(arr) ? arr : []).forEach(o=>{
    const id = o?.[idKey];
    if (id) m[id] = o;
  });
  return m;
}

/* Map -> array */
function toArray(map){
  return Object.values(map || {});
}

function updAt(obj){ return (obj && typeof obj.updatedAt === "number") ? obj.updatedAt : 0; }

/* Merge por updatedAt (gana el más nuevo). No borra ninguno. */
function mergeMaps(localMap, remoteMap){
  const out = { ...(localMap || {}) };
  for (const [id, r] of Object.entries(remoteMap || {})){
    const l = out[id];
    if (!l || updAt(r) >= updAt(l)) out[id] = r;
  }
  return out;
}

/* =========================
   PATHS CLOUD (UID)
========================= */
function base(uid){ return `factumiral/${uid}`; }
function p(uid, section, id){ return `${base(uid)}/${section}/${id}`; }
function pSection(uid, section){ return `${base(uid)}/${section}`; }

/* =========================
   CARGA LOCAL (FORMATO)
   - clientes/productos/taras/facturas: arrays
   - ventas: array de registros {date, store, ...}
   - ajustes: objeto
========================= */
function getLocalState(){
  const clientes  = loadLocal(K.clientes,  []);
  const productos = loadLocal(K.productos, []);
  const taras     = loadLocal(K.taras,     []);
  const facturas  = loadLocal(K.facturas,  []);
  const ventas    = loadLocal(K.ventas,    []);
  const contab    = loadLocal(K.contab,    []);
  const ajustes   = loadLocal(K.ajustes,   { updatedAt: 0 });

  return { clientes, productos, taras, facturas, ventas, contab, ajustes };
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
   CLOUD READERS
========================= */
async function readSection(uid, section){
  const snap = await get(ref(db, pSection(uid, section)));
  return snap.exists() ? (snap.val() || {}) : {};
}

/* =========================
   SYNC DOWN (MERGE)
   - Descarga cloud
   - Mezcla por updatedAt
   - Guarda en local
========================= */
async function syncDownMergeAll(){
  const u = auth.currentUser;
  if (!u) throw new Error("No logueado (cloud)");

  // 🔽 leer cloud
  const [cR, pR, tR, fR, vR, kR, aR] = await Promise.all([
    readSection(u.uid, "clientes"),
    readSection(u.uid, "productos"),
    readSection(u.uid, "taras"),
    readSection(u.uid, "facturas"),
    readSection(u.uid, "ventas"),
    readSection(u.uid, "contabilidad"),
    (async()=>{ const snap=await get(ref(db, `${base(u.uid)}/ajustes`)); return snap.exists()?snap.val():null; })()
  ]);

  // 🔁 local -> maps
  const L = getLocalState();
  const cL = toMap(L.clientes);
  const pL = toMap(L.productos);
  const tL = toMap(L.taras);
  const fL = toMap(L.facturas);

  // ventas: cloud lo guardamos como ventas/{id} donde id = "YYYY-MM-DD|STORE"
  const vL = toMap(L.ventas, "id");
  const kL = toMap(L.contab, "id");

  // ✅ merge
  const cM = mergeMaps(cL, cR);
  const pM = mergeMaps(pL, pR);
  const tM = mergeMaps(tL, tR);
  const fM = mergeMaps(fL, fR);
  const vM = mergeMaps(vL, vR);
  const kM = mergeMaps(kL, kR);

  // ajustes: gana el más nuevo
  let aM = L.ajustes || { updatedAt: 0 };
  if (aR && typeof aR.updatedAt === "number" && aR.updatedAt >= (aM.updatedAt || 0)) aM = aR;

  // 🔽 guardar local (arrays)
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
   SYNC UP (NO DESTRUCTIVO)
   - Sube SOLO registros locales (por id)
   - No borra nada en cloud
   - Si local está vacío, sube 0 (seguro)
   - REQUIERE que cada registro tenga updatedAt (número)
========================= */
async function setOne(uid, section, id, obj){
  // reglas: prohibido delete (null) y requiere updatedAt
  if (!obj || typeof obj.updatedAt !== "number") return { ok:false, id, reason:"missing updatedAt" };
  await set(ref(db, p(uid, section, id)), obj);
  return { ok:true, id };
}

async function syncUpAllNonDestructive(){
  const u = auth.currentUser;
  if (!u) throw new Error("No logueado (cloud)");
  const L = getLocalState();

  // map por id
  const cM = toMap(L.clientes);
  const pM = toMap(L.productos);
  const tM = toMap(L.taras);
  const fM = toMap(L.facturas);
  const vM = toMap(L.ventas, "id");
  const kM = toMap(L.contab, "id");

  const tasks = [];

  for (const [id,obj] of Object.entries(cM)) tasks.push(()=>setOne(u.uid,"clientes",id,obj));
  for (const [id,obj] of Object.entries(pM)) tasks.push(()=>setOne(u.uid,"productos",id,obj));
  for (const [id,obj] of Object.entries(tM)) tasks.push(()=>setOne(u.uid,"taras",id,obj));
  for (const [id,obj] of Object.entries(fM)) tasks.push(()=>setOne(u.uid,"facturas",id,obj));
  for (const [id,obj] of Object.entries(vM)) tasks.push(()=>setOne(u.uid,"ventas",id,obj));
  for (const [id,obj] of Object.entries(kM)) tasks.push(()=>setOne(u.uid,"contabilidad",id,obj));

  // ajustes (objeto)
  const aj = L.ajustes || null;
  if (aj && typeof aj.updatedAt === "number"){
    tasks.push(()=>set(ref(db, `${base(u.uid)}/ajustes`), aj).then(()=>({ok:true,id:"ajustes"})));
  }

  // ejecuta en serie (más estable en móvil)
  let ok = 0, fail = 0;
  for (const fn of tasks){
    try { const r = await fn(); if (r?.ok) ok++; else fail++; }
    catch { fail++; }
  }

  return { ok:true, writesOk: ok, writesFail: fail };
}

/* =========================
   UPSERTS (RECOMENDADO)
   - Úsalos cuando guardas algo: cliente/producto/tara/factura/venta
========================= */
async function upsert(section, obj, idKey="id"){
  const u = auth.currentUser;
  if (!u) throw new Error("No logueado (cloud)");
  const id = obj?.[idKey];
  if (!id) throw new Error(`Falta ${idKey} en ${section}`);
  const payload = { ...obj };
  if (typeof payload.updatedAt !== "number") payload.updatedAt = nowMs();
  await set(ref(db, p(u.uid, section, id)), payload);
  return { ok:true, id };
}

/* ventas: id = "YYYY-MM-DD|STORE" */
function makeVentaId(date, store){ return `${date}|${store}`; }

/* =========================
   API GLOBAL (para tu app)
========================= */
window.FM_CLOUD = {
  app, auth, db,
  user: () => auth.currentUser,
  onAuth: (fn) => onAuthStateChanged(auth, fn),
  login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  logout: () => signOut(auth),

  // Sync
  syncDownMergeAll,
  syncUpAllNonDestructive,

  // Upserts por entidad
  upsertCliente:  (o)=>upsert("clientes", o),
  upsertProducto: (o)=>upsert("productos", o),
  upsertTara:     (o)=>upsert("taras", o),
  upsertFactura:  (o)=>upsert("facturas", o),
  upsertContab:   (o)=>upsert("contabilidad", o, "id"),

  // Ventas (recomendado: guarda local y sube)
  makeVentaId,
  upsertVenta: async (ventaObj)=>{
    const v = { ...ventaObj };
    if (!v.id) v.id = makeVentaId(v.date, v.store);
    return upsert("ventas", v, "id");
  }
};

// Log útil
onAuthStateChanged(auth, (u) => {
  console.log("[FM_CLOUD] auth =", u ? ("OK uid=" + u.uid) : "OUT");
});
