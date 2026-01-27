/* =========================================================
   ARSLAN • FACTURAS PRO — KIWI Edition (v1.3)
   ✅ Modo local completo (sin nube)
   ✅ Nube opcional: Sync + PDFs Storage
   ✅ Facturas FULL + GRID PRO 1 línea + PDF GRID
   ✅ Autocomplete MANUAL (NO sustituye)
   ✅ Catálogo: precio venta + coste + kg/caja + tara def + historial 5
   ✅ Cobros: pagos múltiples (Pendiente/Parcial/Pagada)
   ✅ Contabilidad + Ventas + Márgenes (PIN protegido)
   ✅ Export: CSV + Libro mensual AEAT
   ✅ QR Tributario AEAT (payload + hash) EN PDF
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getDatabase, ref as dbRef, get, set } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { getStorage, ref as stRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

/* =========================
   🔧 TU FIREBASE CONFIG (opcional)
   - Si NO lo rellenas: modo local sin nube.
   ========================= */
const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI",
  databaseURL: "PEGAR_AQUI",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
};

const VAT_RATE = 4; // 4%
const LS_KEY = "arslan_facturas_kiwi_pro_v13";
const LS_BACKUP = "arslan_facturas_kiwi_pro_backup_v13";

const DEFAULT_PIN = "7392"; // puedes cambiarlo en Ajustes

const EMPTY_DATA = () => ({
  meta: { version: "KIWI_PRO_V13", updatedAt: Date.now() },
  settings: {
    provider: {
      name: "Mohammad Arslan Waris",
      nif: "X6389988J",
      addr: "Calle San Pablo 17, 09003 Burgos",
      phone: "631 667 893",
      email: "shaniwaris80@gmail.com"
    },
    security: {
      accountingPin: DEFAULT_PIN
    }
  },
  clients: [],
  invoices: [],
  catalog: { products: {} } // key: UPPER name
});

/* =========================
   📚 VOCABULARIO (manual)
   ========================= */
const VOCAB_RAW = `
MANZANA PINK LADY
MANDARINA COLOMBE
MANDARINA PLASENCIA
MANDARINA USOPRADES
MANZANA GRNNY SMITH
NARANJA MESA USOPRADES
NARANJA ZUMO USOPRADES
MANZANA STORY
GUAYABA
ROMANESCU
PATATA AGRIA
PATATA MONALISA
PATATA SPUNTA
CEBOLLINO
ENELDO
REMOLACHA
LECHUGA ROBLE
ESCAROLA
GUISANTES
KIWI MARIPOSA
AGUACATE LISO
KIWI ZESPRI GOLD
PARAGUAYO
KIWI TOMASIN PLANCHA
PERA RINCON DEL SOTO
MELOCOTON PRIMERA
AGUACATE GRANEL
MARACUYA
MANZANA GOLDEN 24
PLATANO CANARIO PRIMERA
MANDARINA HOJA
MANZANA GOLDEN 20
NARANJA TOMASIN
NECTARINA
NUECES
SANDIA
LIMON SEGUNDA
MANZANA FUJI
NARANJA MESA SONRISA
JENGIBRE
BATATA
AJO PRIMERA
CEBOLLA NORMAL
CALABAZA GRANDE
PATATA LAVADA
TOMATE CHERRY RAMA
TOMATE CHERRY PERA
TOMATE DANIELA
TOMATE ROSA PRIMERA
CEBOLLINO
TOMATE ASURCADO MARRON
TOMATE RAMA
PIMIENTO PADRON
ZANAHORIA
PEPINO
CEBOLLETA
PUERROS
BROCOLI
JUDIA VERDE
BERENJENA
PIMIENTO ITALIANO VERDE
PIMIENTO ITALIANO ROJO
CHAMPINON
UVA ROJA
UVA BLANCA
ALCACHOFA
CALABACIN
COLIFLOR
BATAVIA
ICEBERG
MANDARINA SEGUNDA
MANZANA GOLDEN 28
NARANJA ZUMO
KIWI SEGUNDA
MANZANA ROYAL GALA 24
PLATANO CANARIO SUELTO
CEREZA
FRESAS
ARANDANOS
ESPINACA
PEREJIL
CILANTRO
ACELGAS
PIMIENTO VERDE
PIMIENTO ROJO
MACHO VERDE
MACHO MADURO
YUCA
AVOCADO
PERA CONFERENCIA PRIMERA BIS
REINETA PARDA
POMELO CHINO
MANDARINA TABALET
BERZA
COL DE BRUSELAS
NUECES SEGUNDA
ESCAROLA
CEBOLLA ROJA
MENTA
HABANERO
RABANITOS
POMELO
PAPAYA
REINETA 28
NISPERO
ALBARICOQUE
TOMATE PERA
TOMATE BOLA
TOMATE PINK
VALVENOSTA GOLDEN
MELOCOTON ROJO
MELON GALIA
APIO
NARANJA SANHUJA
LIMON PRIMERA
MANGO
MELOCOTON AMARILLO
VALVENOSTA ROJA
PINA
NARANJA HOJA
PERA CONFERENCIA SEGUNDA
CEBOLLA DULCE
TOMATE ASURCADO AZUL
ESPARRAGOS BLANCOS
ESPARRAGOS TRIGUEROS
REINETA PRIMERA
AGUACATE PRIMERA
COCO
NECTARINA SEGUNDA
REINETA 24
NECTARINA CARNE BLANCA
GUINDILLA
REINETA VERDE
PATATA 25KG
PATATA 5 KG
TOMATE RAFF
REPOLLO
KIWI ZESPRI
PARAGUAYO SEGUNDA
MELON
REINETA 26
TOMATE ROSA
MANZANA CRISPS
ALOE VERA PIEZAS
TOMATE ENSALADA
PATATA 10KG
MELON BOLLO
CIRUELA ROJA
LIMA
GUINEO VERDE
SETAS
BANANA
BONIATO
FRAMBUESA
BREVAS
PERA AGUA
YAUTIA
YAME
OKRA
MANZANA MELASSI
CACAHUETE
SANDIA NEGRA
SANDIA RAYADA
HIGOS
KUMATO
KIWI CHILE
MELOCOTON AMARILLO SEGUNDA
HIERBABUENA
REMOLACHA
LECHUGA ROMANA
KAKI
CIRUELA CLAUDIA
PERA LIMONERA
CIRUELA AMARILLA
HIGOS BLANCOS
UVA ALVILLO
LIMON EXTRA
PITAHAYA ROJA
HIGO CHUMBO
CLEMENTINA
GRANADA
NECTARINA PRIMERA BIS
CHIRIMOYA
UVA CHELVA
PIMIENTO CALIFORNIA VERDE
KIWI TOMASIN
PIMIENTO CALIFORNIA ROJO
MANDARINA SATSUMA
CASTANA
CAKI
MANZANA KANZI
PERA ERCOLINA
NABO
UVA ALVILLO NEGRA
CHAYOTE
ROYAL GALA 28
MANDARINA PRIMERA
PIMIENTO PINTON
MELOCOTON AMARILLO DE CALANDA
HINOJOS
MANDARINA DE HOJA
UVA ROJA PRIMERA
UVA BLANCA PRIMERA
`.trim();

const VOCAB = uniq(
  VOCAB_RAW.split("\n").map(s => s.trim()).filter(Boolean)
);

/* =========================
   Utils
   ========================= */
function $(id){ return document.getElementById(id); }
function euro(n){
  const v = isFinite(n) ? n : 0;
  return v.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " €";
}
function num(v){
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(",", ".").replace(/[^\d.-]/g,"");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function nowISOForInput(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function makeInvoiceNumber(ts=Date.now()){
  const d = new Date(ts);
  const pad = (x)=> String(x).padStart(2,"0");
  return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}
function uid(prefix="id"){
  return prefix + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function uniq(arr){
  const s = new Set();
  const out=[];
  for (const x of arr){
    const k = (x||"").trim();
    if(!k) continue;
    const up = k.toUpperCase();
    if (s.has(up)) continue;
    s.add(up);
    out.push(k);
  }
  return out;
}
function normName(s){ return (s||"").trim().toUpperCase(); }
function safeTags(s){ return uniq((s||"").split(",").map(x=>x.trim()).filter(Boolean)); }
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
function toInput(v){
  const n = num(v);
  if(!n) return "";
  return String(n).replace(".", ",");
}
function fmtNum(v){
  const n=num(v);
  return n.toLocaleString("es-ES",{minimumFractionDigits:2, maximumFractionDigits:2});
}
function formatDateForPdf(dateISO){
  if(!dateISO) return "";
  return dateISO.replace("T"," ");
}
function downloadFile(name, blob){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function sha256Hex(text){
  // Hash interno para “QR AEAT” (integridad)
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2,"0")).join("");
}
function isConfigReady(cfg){
  const vals = Object.values(cfg || {});
  if(vals.length===0) return false;
  return vals.every(v => typeof v==="string" && v && !String(v).includes("PEGAR_AQUI"));
}
/* =========================
   Local Storage
   ========================= */
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return EMPTY_DATA();
    const d = JSON.parse(raw);
    return mergeData(EMPTY_DATA(), d);
  }catch(e){
    console.warn("loadLocal error:", e);
    return EMPTY_DATA();
  }
}
function saveLocal(){
  DATA.meta.updatedAt = Date.now();
  localStorage.setItem(LS_BACKUP, localStorage.getItem(LS_KEY) || "");
  localStorage.setItem(LS_KEY, JSON.stringify(DATA));
}

/* =========================
   Merge inteligente
   ========================= */
function isDefaultEmpty(d){
  const c0 = (d?.clients||[]).length===0;
  const i0 = (d?.invoices||[]).length===0;
  return c0 && i0;
}
function mergeData(base, extra){
  const out = JSON.parse(JSON.stringify(base||{}));

  function deepMerge(a,b){
    if(!b || typeof b!=="object") return a;
    for(const k of Object.keys(b)){
      const bv=b[k];
      if(Array.isArray(bv)){
        a[k] = bv;
      }else if(bv && typeof bv==="object"){
        a[k] = a[k] && typeof a[k]==="object" ? a[k] : {};
        deepMerge(a[k], bv);
      }else{
        a[k]=bv;
      }
    }
    return a;
  }
  deepMerge(out, extra);

  // clients merge
  const aClients = (base?.clients||[]);
  const bClients = (extra?.clients||[]);
  out.clients = mergeClients(aClients, bClients);

  // remap old client ids
  const mapClient = buildClientRemap(aClients, out.clients);

  // invoices merge
  const aInv = (base?.invoices||[]).map(inv => ({...inv, clientId: mapClient[inv.clientId] || inv.clientId}));
  const bInv = (extra?.invoices||[]).map(inv => ({...inv, clientId: mapClient[inv.clientId] || inv.clientId}));
  out.invoices = mergeInvoices(aInv, bInv);

  // catalog merge
  out.catalog = out.catalog || {products:{}};
  out.catalog.products = out.catalog.products || {};
  const catA = (base?.catalog?.products)||{};
  const catB = (extra?.catalog?.products)||{};
  out.catalog.products = {...catA, ...catB};

  // ensure settings security
  out.settings = out.settings || {};
  out.settings.security = out.settings.security || {};
  if(!out.settings.security.accountingPin) out.settings.security.accountingPin = DEFAULT_PIN;

  return out;
}
function mergeClients(a,b){
  const out=[];
  const byId=new Map();
  const byName=new Map();

  const push = (c)=>{
    if(!c) return;
    if(!c.id) c.id = uid("cli");
    c.name = (c.name||"").trim();
    const nameKey = normName(c.name);
    if(byId.has(c.id)) return;
    if(nameKey && byName.has(nameKey)){
      const existing = byName.get(nameKey);
      Object.assign(existing, c);
      byId.set(existing.id, existing);
      return;
    }
    out.push(c);
    byId.set(c.id, c);
    if(nameKey) byName.set(nameKey, c);
  };

  [...a, ...b].forEach(c => push(JSON.parse(JSON.stringify(c))));
  return out;
}
function buildClientRemap(oldClients, newClients){
  const map = {};
  const byName = new Map(newClients.map(c => [normName(c.name), c]));
  for(const oc of (oldClients||[])){
    const nk = normName(oc.name);
    const nc = byName.get(nk);
    if(nc && oc.id && nc.id && oc.id !== nc.id){
      map[oc.id] = nc.id;
    }
  }
  return map;
}
function mergeInvoices(a,b){
  const out=[];
  const seen = new Map();
  function key2(inv){
    return "k:" + `${inv?.dateISO||""}||${inv?.number||""}||${normName(inv?.clientNameCache||"")}`;
  }
  function upsert(inv){
    if(!inv) return;
    if(!inv.id) inv.id = uid("inv");
    inv.lines = Array.isArray(inv.lines) ? inv.lines : [];
    inv.payments = Array.isArray(inv.payments) ? inv.payments : []; // ✅ B
    const k1 = "id:"+inv.id;
    const k2 = key2(inv);
    const existing = seen.get(k1) || seen.get(k2);
    if(!existing){
      out.push(inv);
      seen.set(k1, inv); seen.set(k2, inv);
    }else{
      const aT = existing.updatedAt || existing.createdAt || 0;
      const bT = inv.updatedAt || inv.createdAt || 0;
      if(bT >= aT) Object.assign(existing, inv);
      seen.set(k1, existing); seen.set(k2, existing);
    }
  }
  [...a, ...b].forEach(inv => upsert(JSON.parse(JSON.stringify(inv))));
  out.sort((x,y)=> (y.createdAt||0) - (x.createdAt||0));
  return out;
}

/* =========================
   Firebase init (opcional)
   ========================= */
let app=null, auth=null, db=null, storage=null;
let currentUser=null;

if(isConfigReady(firebaseConfig)){
  try{
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    storage = getStorage(app);
  }catch(e){
    console.warn("Firebase init error:", e);
  }
}

/* =========================
   State
   ========================= */
let DATA = loadLocal();
let CURRENT_INVOICE_ID = null;
let CURRENT_CLIENT_ID = null;

let ACC_UNLOCKED = false;
let pendingProtectedAction = null; // función a ejecutar tras PIN

/* =========================
   Cloud paths
   ========================= */
function cloudPath(uid){
  return `arslan_facturas_kiwi_pro/users/${uid}/data`;
}
async function cloudLoad(){
  if(!currentUser || !db) return null;
  const snap = await get(dbRef(db, cloudPath(currentUser.uid)));
  return snap.exists() ? snap.val() : null;
}
async function cloudSave(data){
  if(!currentUser || !db) return;
  await set(dbRef(db, cloudPath(currentUser.uid)), data);
}
function setCloudStatus(txt){
  $("cloudStatus").textContent = txt;
}
async function smartSync(){
  if(!currentUser || !db){
    setCloudStatus("Local · sin nube (inicia sesión en Ajustes)");
    return;
  }
  try{
    setCloudStatus("Sincronizando…");
    const cloud = await cloudLoad();

    if(!cloud){
      await cloudSave(DATA);
      setCloudStatus("☁️ Nube creada · OK");
      return;
    }

    const localEmpty = isDefaultEmpty(DATA);
    const cloudEmpty = isDefaultEmpty(cloud);

    let merged;
    if(localEmpty && !cloudEmpty){
      merged = mergeData(cloud, DATA);
    }else if(!localEmpty && cloudEmpty){
      merged = mergeData(DATA, cloud);
    }else{
      merged = mergeData(DATA, cloud);
      merged = mergeData(merged, DATA);
    }

    DATA = merged;
    saveLocal();
    await cloudSave(DATA);
    setCloudStatus("☁️ Sync OK · " + new Date().toLocaleTimeString("es-ES"));
    renderAll();
  }catch(e){
    console.warn("smartSync error:", e);
    setCloudStatus("⚠️ Sync error");
  }
}

async function uploadInvoicePdf(inv, blob){
  if(!currentUser || !storage) throw new Error("No user/storage");
  const path = `arslan_facturas_kiwi_pro/pdfs/${currentUser.uid}/${inv.id}.pdf`;
  const r = stRef(storage, path);
  await uploadBytes(r, blob, { contentType: "application/pdf" });
  const url = await getDownloadURL(r);
  return { path, url };
}

/* =========================
   Views + protección PIN
   ========================= */
const views = ["facturas","clientes","catalogo","contabilidad","ajustes"];
function showView(name){
  // PIN: contabilidad protegida
  if(name==="contabilidad" && !ACC_UNLOCKED){
    pendingProtectedAction = ()=> { showView("contabilidad"); renderAccounting($("accMonth").value || ""); };
    openPinModal();
    return;
  }

  for(const v of views){
    const el = $("view-"+v);
    if(el) el.style.display = (v===name) ? "" : "none";
  }
  document.querySelectorAll(".nav-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===name);
  });

  // al entrar contabilidad ya desbloqueado
  if(name==="contabilidad"){
    renderAccounting($("accMonth").value || "");
  }
}

document.addEventListener("click",(e)=>{
  const b = e.target.closest(".nav-btn");
  if(b) showView(b.dataset.view);
});

/* =========================
   PIN Modal
   ========================= */
function openPinModal(){
  $("pinMsg").textContent = "—";
  $("pinInput").value = "";
  $("pinModal").style.display = "";
  setTimeout(()=> $("pinInput").focus(), 50);
}
function closePinModal(){
  $("pinModal").style.display = "none";
}
function checkPinAndUnlock(){
  const pin = ($("pinInput").value || "").trim();
  const real = String(DATA.settings?.security?.accountingPin || DEFAULT_PIN);
  if(pin === real){
    ACC_UNLOCKED = true;
    $("pinMsg").textContent = "OK ✅";
    closePinModal();
    const act = pendingProtectedAction;
    pendingProtectedAction = null;
    if(typeof act === "function") act();
  }else{
    $("pinMsg").textContent = "PIN incorrecto ❌";
  }
}
function lockAccounting(){
  ACC_UNLOCKED = false;
}

/* =========================
   Autocomplete MANUAL
   ========================= */
function attachManualAutocomplete(inputEl, listEl, getOptionsFn, onPick){
  let items=[];
  let active=-1;
  let open=false;

  function close(){
    listEl.style.display="none";
    listEl.innerHTML="";
    open=false; active=-1;
  }
  function openList(){
    if(items.length===0){ close(); return; }
    listEl.style.display="block";
    open=true;
  }
  function render(){
    listEl.innerHTML="";
    items.forEach((txt, idx)=>{
      const div=document.createElement("div");
      div.className="ac-item" + (idx===active ? " active" : "");
      div.textContent=txt;
      div.addEventListener("mousedown",(ev)=>{
        ev.preventDefault();
        onPick(txt);
        close();
      });
      listEl.appendChild(div);
    });
  }

  inputEl.addEventListener("input",()=>{
    const q = normName(inputEl.value);
    const opts = getOptionsFn();
    if(!q){
      items = opts.slice(0,25);
      active=-1; render(); openList();
      return;
    }
    items = opts.filter(x => normName(x).includes(q)).slice(0,35);
    active = -1;
    render(); openList();
  });

  inputEl.addEventListener("keydown",(ev)=>{
    if(!open && (ev.key==="ArrowDown" || ev.key==="ArrowUp")) {
      items = getOptionsFn().slice(0,35);
      render(); openList();
      active = 0;
      render();
      return;
    }
    if(!open) return;

    if(ev.key==="ArrowDown"){
      ev.preventDefault();
      active = Math.min(items.length-1, active+1);
      render();
    }else if(ev.key==="ArrowUp"){
      ev.preventDefault();
      active = Math.max(0, active-1);
      render();
    }else if(ev.key==="Enter"){
      // ✅ SOLO si hay selección
      if(active>=0 && items[active]){
        ev.preventDefault();
        onPick(items[active]);
        close();
      }
    }else if(ev.key==="Escape"){
      close();
    }
  });

  document.addEventListener("click",(ev)=>{
    if(ev.target===inputEl || listEl.contains(ev.target)) return;
    close();
  });

  return { close };
}
/* =========================
   Modelos
   ========================= */
function newLine(){
  return {
    id: uid("ln"),
    product: "",
    mode: "kg",   // kg | unidad | caja
    qty: 1,
    bruto: 0,
    tara: 0,
    neto: 0,
    price: 0,
    origin: "",
    amount: 0
  };
}
function newInvoice(){
  const ts = Date.now();
  return {
    id: uid("inv"),
    createdAt: ts,
    updatedAt: ts,
    number: makeInvoiceNumber(ts),
    dateISO: new Date(ts).toISOString().slice(0,16),
    status: "pendiente",       // pendiente | parcial | pagada
    payment: "efectivo",
    clientId: "",
    clientNameCache: "",
    tags: [],
    vatMode: "add",            // add | included
    notes: "",
    lines: [ newLine() ],
    payments: [],              // ✅ B
    totals: { subtotal:0, vat:0, total:0 }
  };
}

/* =========================
   Catálogo helpers (A/C)
   ========================= */
function ensureCatalogBase(){
  DATA.catalog = DATA.catalog || {products:{}};
  DATA.catalog.products = DATA.catalog.products || {};

  // meter vocab sin pisar
  for(const name of VOCAB){
    const k = normName(name);
    if(!DATA.catalog.products[k]){
      DATA.catalog.products[k] = {
        name,
        mode: "kg",
        price: 0,       // venta
        cost: 0,        // coste (margen)
        boxKg: 0,
        taraDef: 0,     // ✅ C tara por defecto
        origin: "",
        history: []     // últimas 5 ediciones
      };
    }
  }
}
function getProductFromCatalog(name){
  const key = normName(name);
  return DATA.catalog?.products?.[key] || null;
}
function getAllProductOptions(){
  ensureCatalogBase();
  const fromCat = Object.keys(DATA.catalog.products||{}).map(k=>DATA.catalog.products[k]?.name || k);
  const fromInv = (DATA.invoices||[]).flatMap(inv => (inv.lines||[]).map(l=>l.product)).filter(Boolean);
  return uniq([...VOCAB, ...fromCat, ...fromInv].map(x=>x.trim()).filter(Boolean));
}

/* =========================
   Cálculos de líneas/totales
   (C) Reglas por modo + tara default + kg/caja
   ========================= */
function calcLine(line){
  const mode = line.mode || "kg";
  const qty = num(line.qty);
  const bruto = num(line.bruto);
  const tara = num(line.tara);
  let neto = num(line.neto);
  const price = num(line.price);

  if(mode==="kg"){
    if(bruto>0) neto = Math.max(0, bruto - tara);
    else if(neto<=0 && qty>0) neto = qty;
  }else if(mode==="unidad"){
    neto = qty;
  }else if(mode==="caja"){
    const p = getProductFromCatalog(line.product);
    const boxKg = num(p?.boxKg || 0);
    if(boxKg>0) neto = qty * boxKg;
    else neto = num(line.neto)>0 ? num(line.neto) : qty;
  }

  const amount = neto * price;

  return {
    ...line,
    qty,
    bruto: (mode==="unidad") ? 0 : bruto,
    tara: (mode==="unidad") ? 0 : tara,
    neto,
    price,
    amount
  };
}
function calcTotals(inv){
  const lines = (inv.lines||[]).map(calcLine);
  const subtotal = lines.reduce((a,l)=>a + num(l.amount), 0);

  if(inv.vatMode==="included"){
    const total = subtotal;
    const vat = total * (VAT_RATE/(100+VAT_RATE));
    return { lines, subtotal: total, vat, total };
  }else{
    const vat = subtotal * (VAT_RATE/100);
    const total = subtotal + vat;
    return { lines, subtotal, vat, total };
  }
}

/* =========================
   Cobros (B)
   ========================= */
function sumPayments(inv){
  return (inv.payments||[]).reduce((a,p)=>a + num(p.amount), 0);
}
function recomputeInvoiceStatusFromPayments(inv){
  const total = num(inv.totals?.total || 0);
  const paid = sumPayments(inv);
  const pending = Math.max(0, total - paid);

  if(total <= 0){
    inv.status = inv.status || "pendiente";
    return { paid, pending };
  }
  if(paid <= 0.0001){
    inv.status = "pendiente";
  }else if(pending <= 0.01){
    inv.status = "pagada";
  }else{
    inv.status = "parcial";
  }
  return { paid, pending };
}

/* =========================
   Facturas CRUD + autosave (A)
   ========================= */
function getCurrentInvoice(){
  let inv = DATA.invoices.find(x=>x.id===CURRENT_INVOICE_ID);
  if(!inv){
    inv = newInvoice();
    CURRENT_INVOICE_ID = inv.id;
    DATA.invoices.unshift(inv);
    saveLocal();
  }
  inv.lines = Array.isArray(inv.lines) ? inv.lines : [];
  inv.payments = Array.isArray(inv.payments) ? inv.payments : [];
  return inv;
}
function touchInvoice(inv){
  inv.updatedAt = Date.now();

  inv.number = $("invNumber").value.trim() || inv.number;
  inv.dateISO = $("invDate").value || inv.dateISO;
  inv.payment = $("invPay").value || inv.payment;

  inv.clientNameCache = $("invClient").value.trim() || inv.clientNameCache;
  inv.tags = safeTags($("invTags").value);
  inv.vatMode = $("invVatMode").value || inv.vatMode || "add";
  inv.notes = $("invNotes").value || inv.notes || "";

  // clientId by name if possible
  const c = DATA.clients.find(x=> normName(x.name)===normName(inv.clientNameCache));
  inv.clientId = c ? c.id : inv.clientId;

  // totals
  const t = calcTotals(inv);
  inv.lines = t.lines;
  inv.totals = { subtotal: t.subtotal, vat: t.vat, total: t.total };

  // status by payments (B)
  const { paid, pending } = recomputeInvoiceStatusFromPayments(inv);
  $("invStatus").value = inv.status;
  renderPayments(inv, paid, pending);

  saveLocal();
  renderInvoiceList();
  renderTotals(inv);
}
function openInvoice(id){
  const inv = DATA.invoices.find(x=>x.id===id);
  if(!inv) return;
  CURRENT_INVOICE_ID = id;
  renderInvoiceEditor();
}
function createNewInvoice(){
  const inv = newInvoice();
  inv.dateISO = nowISOForInput();
  inv.number = makeInvoiceNumber(Date.now());
  DATA.invoices.unshift(inv);
  CURRENT_INVOICE_ID = inv.id;
  saveLocal();
  renderInvoiceList();
  renderInvoiceEditor();
}
function duplicateInvoice(){ // ✅ A
  const src = getCurrentInvoice();
  touchInvoice(src);
  const ts = Date.now();
  const inv = JSON.parse(JSON.stringify(src));
  inv.id = uid("inv");
  inv.createdAt = ts;
  inv.updatedAt = ts;
  inv.dateISO = nowISOForInput();
  inv.number = makeInvoiceNumber(ts);
  inv.pdfUrl = "";
  inv.pdfPath = "";
  inv.payments = []; // duplicar sin cobros
  inv.status = "pendiente";
  inv.lines = (inv.lines||[]).map(l=>({ ...l, id: uid("ln") }));
  DATA.invoices.unshift(inv);
  CURRENT_INVOICE_ID = inv.id;
  saveLocal();
  renderInvoiceList();
  renderInvoiceEditor();
}
function addLine(){
  const inv = getCurrentInvoice();
  inv.lines.push(newLine());
  touchInvoice(inv);
  renderLines(inv);
}
function clearLines(){
  const inv=getCurrentInvoice();
  inv.lines=[newLine()];
  touchInvoice(inv);
  renderLines(inv);
}
function saveInvoice(){
  const inv = getCurrentInvoice();
  touchInvoice(inv);
  renderInvoiceEditor();
}

/* =========================
   Facturas List + Editor
   ========================= */
function renderInvoiceList(){
  const box = $("invoiceList");
  const q = normName($("qInvoice").value);
  const st = $("fStatus").value;
  const mo = $("fMonth").value;

  let list = [...(DATA.invoices||[])];

  if(q){
    list = list.filter(inv=>{
      const hay = [
        inv.number,
        inv.clientNameCache,
        (inv.tags||[]).join(",")
      ].join(" ").toUpperCase();
      return hay.includes(q);
    });
  }
  if(st) list = list.filter(inv => (inv.status||"")==st);
  if(mo) list = list.filter(inv => (inv.dateISO||"").slice(0,7)===mo);

  $("invCount").textContent = `${list.length} facturas`;
  box.innerHTML="";

  list.forEach(inv=>{
    const card=document.createElement("div");
    card.className="item";
    const tot = inv?.totals?.total ?? 0;

    const badge =
      inv.status==="pagada" ? "ok" :
      inv.status==="parcial" ? "" : "bad";

    card.innerHTML = `
      <div class="t">${escapeHtml(inv.number || "—")} · ${euro(tot)}</div>
      <div class="s">
        <span class="badge ${badge}">${escapeHtml(inv.status || "—")}</span>
        <span class="badge">${escapeHtml((inv.dateISO||"").replace("T"," "))}</span>
        <span class="badge">${escapeHtml(inv.clientNameCache||"—")}</span>
        ${(inv.tags||[]).slice(0,3).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join("")}
        ${inv.pdfUrl ? `<span class="badge ok">PDF</span>` : `<span class="badge">sin PDF</span>`}
      </div>
    `;
    card.addEventListener("click",()=> openInvoice(inv.id));
    box.appendChild(card);
  });
}

function renderInvoiceEditor(){
  const inv = getCurrentInvoice();

  $("invTitle").textContent = "Editar factura";
  $("invBadge").textContent = inv.id;

  $("invNumber").value = inv.number || "";
  $("invDate").value = inv.dateISO || nowISOForInput();
  $("invStatus").value = inv.status || "pendiente";
  $("invPay").value = inv.payment || "efectivo";
  $("invClient").value = inv.clientNameCache || "";
  $("invTags").value = (inv.tags||[]).join(", ");
  $("invVatMode").value = inv.vatMode || "add";
  $("invNotes").value = inv.notes || "";

  renderLines(inv);

  // Cobros
  const { paid, pending } = recomputeInvoiceStatusFromPayments(inv);
  renderPayments(inv, paid, pending);

  renderTotals(inv);
}

function renderTotals(inv){
  const { lines, subtotal, vat, total } = calcTotals(inv);
  inv.lines = lines;
  inv.totals = { subtotal, vat, total };
  $("tSubtotal").textContent = euro(subtotal);
  $("tVat").textContent = euro(vat);
  $("tTotal").textContent = euro(total);

  if(inv.vatMode==="included"){
    $("tVatNote").textContent = "IVA incluido en los precios (se muestra la cuota incluida).";
  }else{
    $("tVatNote").textContent = "IVA 4% añadido aparte al subtotal.";
  }

  // actualizar estado por cobros
  const { paid, pending } = recomputeInvoiceStatusFromPayments(inv);
  $("payPaid").textContent = `Pagado: ${euro(paid)}`;
  $("payPending").textContent = `Pendiente: ${euro(pending)}`;
}

/* =========================
   Líneas GRID PRO + tooltip últimos precios (solo UI)
   ========================= */
function renderLines(inv){
  ensureCatalogBase();
  const wrap = $("lines");
  wrap.innerHTML="";

  inv.lines = inv.lines || [];
  inv.lines.forEach((line)=>{
    const row = document.createElement("div");
    row.className="line";
    row.dataset.lineId = line.id;

 row.innerHTML = `
  <!-- Producto -->
  <div class="cell-prod ac-wrap">
    <input class="prod" data-k="product" placeholder="Producto" value="${escapeHtml(line.product||"")}" autocomplete="off"/>
    <div class="ac"></div>
  </div>

  <!-- Modo -->
  <div class="cell-mode">
    <select data-k="mode" title="Modo">
      <option value="kg" ${line.mode==="kg"?"selected":""}>kg</option>
      <option value="unidad" ${line.mode==="unidad"?"selected":""}>ud</option>
      <option value="caja" ${line.mode==="caja"?"selected":""}>caja</option>
    </select>
  </div>

  <!-- Cantidad -->
  <div class="cell-qty">
    <input data-k="qty" inputmode="decimal" placeholder="Cant" value="${toInput(line.qty)}"/>
  </div>

  <!-- Precio -->
  <div class="cell-price">
    <input data-k="price" inputmode="decimal" placeholder="Precio" value="${toInput(line.price)}"/>
  </div>

  <!-- Importe -->
  <div class="cell-amount money">${euro(line.amount||0)}</div>

  <!-- Delete -->
  <div class="cell-del">
    <button class="icon-btn danger" title="Eliminar">✖</button>
  </div>

  <!-- Bruto -->
  <div class="cell-bruto">
    <input data-k="bruto" inputmode="decimal" placeholder="Bruto" value="${toInput(line.bruto)}"/>
  </div>

  <!-- Tara -->
  <div class="cell-tara">
    <input data-k="tara" inputmode="decimal" placeholder="Tara" value="${toInput(line.tara)}"/>
  </div>

  <!-- Neto -->
  <div class="cell-neto">
    <input data-k="neto" inputmode="decimal" placeholder="Neto" value="${toInput(line.neto)}"/>
  </div>

  <!-- Origen -->
  <div class="cell-origin">
    <input data-k="origin" placeholder="Origen" value="${escapeHtml(line.origin||"")}"/>
  </div>
`;


      <div class="money">${euro(line.amount||0)}</div>

      <button class="icon-btn danger" title="Eliminar">✖</button>
    `;

    const prodInput = row.querySelector('input[data-k="product"]');
    const ac = row.querySelector(".ac");

    attachManualAutocomplete(
      prodInput,
      ac,
      ()=> getAllProductOptions(),
      (picked)=>{
        prodInput.value = picked;

        const p = getProductFromCatalog(picked);
        if(p){
          const modeSel = row.querySelector('select[data-k="mode"]');
          if(p.mode && modeSel) modeSel.value = p.mode;

          // precio solo si vacío
          const priceInput = row.querySelector('input[data-k="price"]');
          if(priceInput && !num(priceInput.value)) priceInput.value = toInput(p.price);

          // tara default si está vacío y modo kg
          const taraInput = row.querySelector('input[data-k="tara"]');
          if(taraInput && !num(taraInput.value) && num(p.taraDef)>0) taraInput.value = toInput(p.taraDef);

          // origen
          const originInput = row.querySelector('input[data-k="origin"]');
          if(originInput && !originInput.value) originInput.value = p.origin || "";

          // tooltip “últimos precios” solo UI
          const hist = (p.history||[]).slice(0,5).map(h=>{
            const dt = new Date(h.ts||0).toLocaleDateString("es-ES");
            return `${dt}: ${Number(h.price||0).toFixed(2)}€`;
          }).join(" | ");
          if(hist) prodInput.title = `Últimos precios (solo pantalla): ${hist}`;
        }

        commitLineFromRow(row);
      }
    );

    // listeners
    row.querySelectorAll("input,select").forEach(el=>{
      el.addEventListener("change", ()=> commitLineFromRow(row));
      el.addEventListener("input", ()=> commitLineFromRow(row));

      el.addEventListener("keydown",(ev)=>{
        if(ev.key==="Enter"){
          // Shift+Enter -> nueva línea
          if(ev.shiftKey){
            ev.preventDefault();
            addLine();
            // focus primer input de la nueva línea
            setTimeout(()=>{
              const inv = getCurrentInvoice();
              const last = inv.lines[inv.lines.length-1];
              const elRow = $("lines").querySelector(`[data-line-id="${last.id}"] input[data-k="product"]`);
              if(elRow) elRow.focus();
            }, 50);
            return;
          }

          // Enter -> siguiente celda
          const focusables = row.querySelectorAll("input,select,button");
          const arr = Array.from(focusables).filter(x=>!x.classList.contains("danger"));
          const i = arr.indexOf(ev.target);
          if(i>=0 && arr[i+1]){
            ev.preventDefault();
            arr[i+1].focus();
          }
        }
      });
    });

    // delete
    row.querySelector("button.icon-btn").addEventListener("click",()=>{
      inv.lines = inv.lines.filter(l=>l.id!==line.id);
      if(inv.lines.length===0) inv.lines.push(newLine());
      touchInvoice(inv);
      renderLines(inv);
      renderTotals(inv);
    });

    wrap.appendChild(row);
  });

  inv.lines = inv.lines.map(calcLine);
  inv.lines.forEach((l)=>{
    const el = wrap.querySelector(`[data-line-id="${l.id}"] .money`);
    if(el) el.textContent = euro(l.amount||0);
  });
}

function commitLineFromRow(row){
  const inv = getCurrentInvoice();
  const id = row.dataset.lineId;
  const line = inv.lines.find(l=>l.id===id);
  if(!line) return;

  const read = (k)=> row.querySelector(`[data-k="${k}"]`)?.value || "";

  line.product = read("product");
  line.mode = read("mode") || "kg";
  line.qty = num(read("qty"));
  line.bruto = num(read("bruto"));
  line.tara = num(read("tara"));
  line.neto = num(read("neto"));
  line.price = num(read("price"));
  line.origin = read("origin");

  const cl = calcLine(line);
  Object.assign(line, cl);

  const m = row.querySelector(".money");
  if(m) m.textContent = euro(line.amount||0);

  touchInvoice(inv);
}

/* =========================
   Cobros UI (B)
   ========================= */
function renderPayments(inv, paid, pending){
  $("payPaid").textContent = `Pagado: ${euro(paid)}`;
  $("payPending").textContent = `Pendiente: ${euro(pending)}`;

  const box = $("paymentsList");
  const list = (inv.payments||[]).slice().sort((a,b)=> (b.ts||0)-(a.ts||0));

  if(list.length===0){
    box.innerHTML = `<div class="muted">Sin pagos aún.</div>`;
    return;
  }

  box.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>Fecha</th><th>Método</th><th>Importe</th><th>Nota</th><th></th></tr>
      </thead>
      <tbody>
        ${list.map(p=>`
          <tr>
            <td>${escapeHtml(p.date || "")}</td>
            <td>${escapeHtml(p.method || "")}</td>
            <td>${euro(p.amount || 0)}</td>
            <td>${escapeHtml(p.note || "")}</td>
            <td><button class="btn ghost" data-paydel="${p.id}">Eliminar</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  box.querySelectorAll("[data-paydel]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-paydel");
      inv.payments = (inv.payments||[]).filter(x=>x.id!==id);
      touchInvoice(inv);
      renderInvoiceEditor();
    });
  });
}

function addPayment(){
  const inv = getCurrentInvoice();
  touchInvoice(inv);

  const amount = num($("payAmount").value);
  if(amount<=0){ alert("Importe inválido"); return; }

  const method = $("payMethod").value || "efectivo";
  const date = $("payDate").value || new Date().toISOString().slice(0,10);
  const note = $("payNote").value || "";

  inv.payments = inv.payments || [];
  inv.payments.push({
    id: uid("pay"),
    ts: Date.now(),
    date,
    method,
    amount,
    note
  });

  $("payAmount").value="";
  $("payNote").value="";

  touchInvoice(inv);
  renderInvoiceEditor();
}

/* =========================
   Clientes (A)
   ========================= */
function renderClientList(){
  const box=$("clientList");
  const q = normName($("qClient").value);
  let list=[...(DATA.clients||[])];
  if(q){
    list = list.filter(c => normName(c.name).includes(q) || normName(c.nif).includes(q));
  }
  box.innerHTML="";
  list.forEach(c=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="t">${escapeHtml(c.name||"—")}</div>
      <div class="s">
        <span class="badge">${escapeHtml(c.nif||"—")}</span>
        ${(c.tags||[]).slice(0,3).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join("")}
      </div>
    `;
    div.addEventListener("click",()=> openClient(c.id));
    box.appendChild(div);
  });
}

function openClient(id){
  const c = DATA.clients.find(x=>x.id===id);
  if(!c) return;
  CURRENT_CLIENT_ID = id;
  $("cName").value = c.name||"";
  $("cNif").value = c.nif||"";
  $("cAddr").value = c.addr||"";
  $("cCity").value = c.city||"";
  $("cPhone").value = c.phone||"";
  $("cEmail").value = c.email||"";

  $("cVatPref").value = c.vatPref || "";
  $("cPayPref").value = c.payPref || "";
  $("cTags").value = (c.tags||[]).join(", ");
  $("cNotesPref").value = c.notesPref || "";
}

function newClient(){
  const c = {
    id: uid("cli"),
    name:"",
    nif:"",
    addr:"",
    city:"",
    phone:"",
    email:"",
    tags:[],
    vatPref:"",
    payPref:"",
    notesPref:""
  };
  DATA.clients.unshift(c);
  saveLocal();
  renderClientList();
  openClient(c.id);
}

function saveClient(){
  const c = DATA.clients.find(x=>x.id===CURRENT_CLIENT_ID);
  if(!c) return;

  c.name = $("cName").value.trim();
  c.nif = $("cNif").value.trim();
  c.addr = $("cAddr").value.trim();
  c.city = $("cCity").value.trim();
  c.phone = $("cPhone").value.trim();
  c.email = $("cEmail").value.trim();

  c.vatPref = $("cVatPref").value || "";
  c.payPref = $("cPayPref").value || "";
  c.tags = safeTags($("cTags").value);
  c.notesPref = $("cNotesPref").value || "";

  saveLocal();
  renderClientList();
}

function deleteClient(){
  if(!CURRENT_CLIENT_ID) return;
  const id=CURRENT_CLIENT_ID;
  DATA.clients = DATA.clients.filter(c=>c.id!==id);
  CURRENT_CLIENT_ID=null;
  saveLocal();
  renderClientList();
}

/* =========================
   Clientes autocomplete (manual) + aplicar plantilla (A)
   ========================= */
function initClientsAutocomplete(){
  const input = $("invClient");
  const list = $("acClients");

  attachManualAutocomplete(
    input, list,
    ()=> uniq(DATA.clients.map(c=>c.name).filter(Boolean)),
    (picked)=>{
      input.value = picked;
      const c = DATA.clients.find(x=> normName(x.name)===normName(picked));
      const inv = getCurrentInvoice();
      if(inv){
        inv.clientId = c ? c.id : "";
        inv.clientNameCache = picked;

        // aplicar plantilla A
        if(c?.vatPref) $("invVatMode").value = c.vatPref;
        if(c?.payPref) $("invPay").value = c.payPref;
        if((c?.tags||[]).length){
          const merged = uniq([...(safeTags($("invTags").value)), ...(c.tags||[])]);
          $("invTags").value = merged.join(", ");
        }
        if(c?.notesPref && !$("invNotes").value) $("invNotes").value = c.notesPref;

        touchInvoice(inv);
        renderInvoiceList();
        renderTotals(inv);
      }
    }
  );
}

/* =========================
   Catálogo (C + márgenes)
   - precio venta, coste, kg/caja, tara default
   ========================= */
function renderCatalog(){
  ensureCatalogBase();
  const box = $("catalogList");
  const q = normName($("qProd").value);

  let keys = Object.keys(DATA.catalog.products||{});
  keys.sort((a,b)=> a.localeCompare(b, "es"));

  if(q){
    keys = keys.filter(k => k.includes(q) || normName(DATA.catalog.products[k].name).includes(q));
  }

  box.innerHTML="";
  keys.forEach(k=>{
    const p = DATA.catalog.products[k];
    const hist = (p.history||[]).slice(0,5).map(h=>{
      const dt = new Date(h.ts||0).toLocaleDateString("es-ES");
      const pr = Number(h.price||0).toFixed(2);
      const co = Number(h.cost||0).toFixed(2);
      const bx = Number(h.boxKg||0).toFixed(2);
      const ta = Number(h.taraDef||0).toFixed(2);
      return `• ${dt} · v:${pr}€ · c:${co}€ · caja:${bx}kg · tara:${ta}`;
    }).join("<br>");

    const row=document.createElement("div");
    row.className="cat-row";
    row.dataset.key = k;
    row.innerHTML = `
      <input data-k="name" value="${escapeHtml(p.name||"")}" />
      <select data-k="mode">
        <option value="kg" ${p.mode==="kg"?"selected":""}>kg</option>
        <option value="unidad" ${p.mode==="unidad"?"selected":""}>unidad</option>
        <option value="caja" ${p.mode==="caja"?"selected":""}>caja</option>
      </select>
      <input data-k="price" inputmode="decimal" value="${toInput(p.price)}" placeholder="Venta"/>
      <input data-k="cost" inputmode="decimal" value="${toInput(p.cost)}" placeholder="Coste"/>
      <input data-k="boxKg" inputmode="decimal" value="${toInput(p.boxKg)}" placeholder="Kg/caja"/>
      <input data-k="origin" value="${escapeHtml(p.origin||"")}" placeholder="Origen"/>
      <div class="smallhist">${hist || "—"}</div>
      <button class="icon-btn danger" title="Eliminar">✖</button>
    `;

    // Tara default aparece en tooltip del campo nombre (para mantener grid limpio)
    row.querySelector('input[data-k="name"]').title = `Tara default: ${Number(p.taraDef||0).toFixed(2)} (edítala en el código si quieres un campo visible)`;

    row.querySelectorAll("input,select").forEach(el=>{
      el.addEventListener("change",()=> commitCatalogRow(row));
      el.addEventListener("input",()=> commitCatalogRow(row));
    });
    row.querySelector("button").addEventListener("click",()=>{
      delete DATA.catalog.products[k];
      saveLocal();
      renderCatalog();
    });

    box.appendChild(row);
  });
}

function commitCatalogRow(row){
  const oldKey = row.dataset.key;
  const read = (k)=> row.querySelector(`[data-k="${k}"]`)?.value || "";
  const name = read("name").trim();
  const key = normName(name || oldKey);
  const p = DATA.catalog.products[oldKey] || DATA.catalog.products[key] || { history:[] };

  // NOTE: taraDef se mantiene aunque no haya campo visible aquí.
  const next = {
    ...p,
    name: name || p.name || oldKey,
    mode: read("mode") || p.mode || "kg",
    price: num(read("price")),
    cost: num(read("cost")),
    boxKg: num(read("boxKg")),
    origin: read("origin") || "",
    taraDef: num(p.taraDef||0),
  };

  const changed = (
    num(next.price)!==num(p.price) ||
    num(next.cost)!==num(p.cost) ||
    num(next.boxKg)!==num(p.boxKg) ||
    num(next.taraDef)!==num(p.taraDef)
  );

  if(changed){
    next.history = Array.isArray(p.history) ? [...p.history] : [];
    next.history.unshift({ ts: Date.now(), price: num(next.price), cost: num(next.cost), boxKg: num(next.boxKg), taraDef: num(next.taraDef) });
    next.history = next.history.slice(0,5);
  }

  if(oldKey !== key){
    delete DATA.catalog.products[oldKey];
    DATA.catalog.products[key] = next;
    row.dataset.key = key;
  }else{
    DATA.catalog.products[oldKey] = next;
  }

  saveLocal();
}

/* =========================
   QR AEAT payload + PDF GRID
   - “Últimos precios” NO se imprime
   ========================= */
async function buildAeatPayload(inv){
  const prov = DATA.settings?.provider || EMPTY_DATA().settings.provider;
  const total = Number(num(inv.totals?.total || 0)).toFixed(2);
  const date = (inv.dateISO || "").slice(0,10);
  const baseStr = `NIF=${prov.nif}|NUM=${inv.number}|FECHA=${date}|TOTAL=${total}`;
  const hash = await sha256Hex(baseStr);
  // Payload robusto (no afirmamos URL oficial)
  return `AEAT|${baseStr}|HASH=${hash}`;
}

async function buildPdfBlob(inv){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const prov = DATA.settings?.provider || EMPTY_DATA().settings.provider;
  const client = resolveClient(inv);

  const margin = 36;
  let y = 42;

  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text("FACTURA", margin, y);

  doc.setFontSize(11);
  doc.setFont("helvetica","normal");
  doc.text(`Nº: ${inv.number}`, 360, y);
  doc.text(`Fecha: ${formatDateForPdf(inv.dateISO)}`, 360, y+16);

  y += 26;

  // Proveedor
  doc.setFont("helvetica","bold");
  doc.text(prov.name || "Mohammad Arslan Waris", margin, y);
  doc.setFont("helvetica","normal");
  y += 14;
  doc.text(`${prov.nif || ""}`, margin, y); y += 14;
  doc.text(`${prov.addr || ""}`, margin, y); y += 14;
  doc.text(`${prov.phone || ""}`, margin, y); y += 14;
  doc.text(`${prov.email || ""}`, margin, y);

  // Cliente
  let cy = 68;
  doc.setFont("helvetica","bold");
  doc.text("Cliente:", 290, cy);
  doc.setFont("helvetica","bold");
  doc.text(client.name || inv.clientNameCache || "—", 290, cy+16);

  doc.setFont("helvetica","normal");
  const clientLines = [
    client.nif || "",
    client.addr || "",
    client.city || "",
    client.phone || "",
    client.email || ""
  ].filter(Boolean);

  let cLineY = cy + 32;
  for(const line of clientLines.slice(0,6)){
    doc.text(line, 290, cLineY);
    cLineY += 14;
  }

  // QR AEAT (abajo derecha) + etiqueta
  const aeatPayload = await buildAeatPayload(inv);
  try{
    $("qrTmp").innerHTML = "";
    const qrDiv = document.createElement("div");
    $("qrTmp").appendChild(qrDiv);
    // eslint-disable-next-line no-undef
    new QRCode(qrDiv, { text: aeatPayload, width: 92, height: 92, correctLevel: QRCode.CorrectLevel.M });
    await new Promise(r=>setTimeout(r, 60));
    const img = qrDiv.querySelector("img");
    if(img && img.src){
      doc.setFont("helvetica","bold");
      doc.setFontSize(9);
      doc.text("QR Tributario (AEAT)", 460, 205);
      doc.addImage(img.src, "PNG", 470, 210, 92, 92);
    }
  }catch(_){}

  // Tabla GRID (Producto | Modo | Cant | Bruto | Tara | Neto | Precio | Origen | Importe)
  const rows = (inv.lines||[]).map(calcLine).map(l=>{
    return [
      l.product || "",
      l.mode || "",
      String(num(l.qty)||""),
      (l.mode==="unidad" ? "" : fmtNum(l.bruto)),
      (l.mode==="unidad" ? "" : fmtNum(l.tara)),
      fmtNum(l.neto),
      fmtNum(l.price) + " €",
      l.origin || "",
      fmtNum(l.amount) + " €"
    ];
  });

  doc.autoTable({
    startY: 320,
    margin: { left: margin, right: margin },
    head: [[ "Producto","Modo","Cant.","Bruto","Tara","Neto","Precio","Origen","Importe" ]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [240,240,240], textColor:[20,20,20], fontStyle:"bold" },
    alternateRowStyles: { fillColor: [250,250,250] },
    tableLineColor: [200,200,200],
    tableLineWidth: 0.7
  });

  const endY = doc.lastAutoTable.finalY || 320;

  // Totales
  const t = calcTotals(inv);
  inv.lines = t.lines;
  inv.totals = { subtotal: t.subtotal, vat: t.vat, total: t.total };

  let ty = endY + 20;
  doc.setFont("helvetica","bold");
  doc.text(`Subtotal: ${euro(t.subtotal)}`, margin, ty);
  ty += 16;
  doc.text(`IVA (${VAT_RATE}%): ${euro(t.vat)}`, margin, ty);
  ty += 16;
  doc.setFontSize(12);
  doc.text(`Total: ${euro(t.total)}`, margin, ty);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("ARSLAN · KIWI Edition — Facturas PRO", margin, 820);
  doc.setTextColor(0);

  return doc.output("blob");
}

function resolveClient(inv){
  const c = DATA.clients.find(x=>x.id===inv.clientId) ||
            DATA.clients.find(x=>normName(x.name)===normName(inv.clientNameCache));
  return c || { name: inv.clientNameCache||"", nif:"", addr:"", city:"", phone:"", email:"" };
}

/* =========================
   WhatsApp PRO
   ========================= */
function buildWhatsText(inv){
  const lines = (inv.lines||[]).map(calcLine).filter(l=>l.product);
  const head = `🧾 *FACTURA* ${inv.number}\n👤 ${inv.clientNameCache||"—"}\n📅 ${formatDateForPdf(inv.dateISO)}\n`;
  const body = lines.slice(0,30).map(l=>{
    const modo = l.mode;
    const cant = (modo==="unidad") ? `${num(l.qty)} ud` :
                 (modo==="caja") ? `${num(l.qty)} cajas` :
                 `${fmtNum(l.neto)} kg`;
    return `• ${l.product} — ${cant} × ${fmtNum(l.price)}€ = ${fmtNum(l.amount)}€`;
  }).join("\n");
  const tail = `\n\nSubtotal: ${euro(inv.totals?.subtotal||0)}\nIVA(${VAT_RATE}%): ${euro(inv.totals?.vat||0)}\nTOTAL: *${euro(inv.totals?.total||0)}*\nEstado: ${inv.status}\nPago: ${inv.payment}`;
  const pdf = inv.pdfUrl ? `\n\n📎 PDF: ${inv.pdfUrl}` : "";
  return head + body + tail + pdf;
}
function openWhats(text){
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

/* =========================
   Contabilidad + Ventas + Márgenes (PIN)
   + Export CSV + Libro AEAT (I)
   ========================= */
function estimateMarginForInvoice(inv){
  // margen estimado = Σ (venta - coste) * neto
  let margin = 0;
  for(const l0 of (inv.lines||[])){
    const l = calcLine(l0);
    const p = getProductFromCatalog(l.product);
    const cost = num(p?.cost || 0);
    const sale = num(l.price || 0);
    const neto = num(l.neto || 0);
    if(cost>0 && sale>0 && neto>0){
      margin += (sale - cost) * neto;
    }
  }
  return margin;
}
function collectedInMonth(inv, monthYYYYMM){
  // suma pagos dentro del mes
  const pays = inv.payments || [];
  return pays.reduce((a,p)=>{
    if((p.date||"").slice(0,7)===monthYYYYMM) return a + num(p.amount);
    return a;
  }, 0);
}

function renderAccounting(monthYYYYMM){
  ensureCatalogBase();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const m = monthYYYYMM || defaultMonth;

  const invs = (DATA.invoices||[]).filter(inv => (inv.dateISO||"").slice(0,7)===m);

  const sales = invs.reduce((a,inv)=>a + num(inv.totals?.total||0), 0);
  const collected = invs.reduce((a,inv)=>a + collectedInMonth(inv, m), 0);

  const allPending = (DATA.invoices||[]).reduce((a,inv)=>{
    const total = num(inv.totals?.total||0);
    const paid = sumPayments(inv);
    return a + Math.max(0, total - paid);
  }, 0);

  const margin = invs.reduce((a,inv)=>a + estimateMarginForInvoice(inv), 0);
  const marginCoverage = invs.filter(inv => estimateMarginForInvoice(inv) !== 0).length;

  $("kSales").textContent = euro(sales);
  $("kSales2").textContent = `${invs.length} facturas (${m})`;
  $("kCollected").textContent = euro(collected);
  $("kCollected2").textContent = `Pagos recibidos en ${m}`;
  $("kPending").textContent = euro(allPending);
  $("kPending2").textContent = `Pendiente total (todas)`;
  $("kMargin").textContent = euro(margin);
  $("kMargin2").textContent = `Estimado (con coste) · ${marginCoverage}/${invs.length} con coste`;

  const rows = invs.map(inv=>{
    const total = num(inv.totals?.total||0);
    const vat = num(inv.totals?.vat||0);
    const base = inv.vatMode==="included" ? (total - vat) : num(inv.totals?.subtotal||0);
    const paid = sumPayments(inv);
    const pending = Math.max(0, total - paid);
    const mar = estimateMarginForInvoice(inv);

    return {
      date: (inv.dateISO||"").slice(0,10),
      number: inv.number||"",
      client: inv.clientNameCache||"",
      status: inv.status||"",
      tags: (inv.tags||[]).join("|"),
      base, vat, total,
      paid, pending,
      margin: mar,
      pdfUrl: inv.pdfUrl || ""
    };
  });

  $("accTable").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th><th>Nº</th><th>Cliente</th><th>Estado</th><th>Base</th><th>IVA</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Margen</th><th>Tags</th><th>PDF</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r=>`
          <tr>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.number)}</td>
            <td>${escapeHtml(r.client)}</td>
            <td>${escapeHtml(r.status)}</td>
            <td>${euro(r.base)}</td>
            <td>${euro(r.vat)}</td>
            <td>${euro(r.total)}</td>
            <td>${euro(r.paid)}</td>
            <td>${euro(r.pending)}</td>
            <td>${euro(r.margin)}</td>
            <td>${escapeHtml(r.tags)}</td>
            <td>${r.pdfUrl ? `<a href="${r.pdfUrl}" target="_blank" style="color:#bff6d4">Ver</a>` : "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  return rows;
}

function exportAccountingCSV(rows){
  const head = ["Fecha","Numero","Cliente","Estado","Base","IVA","Total","Pagado","Pendiente","Margen","Tags","PDF"];
  const lines = rows.map(r=>[
    r.date, r.number, r.client, r.status,
    String(r.base).replace(".",","), String(r.vat).replace(".",","), String(r.total).replace(".",","),
    String(r.paid).replace(".",","), String(r.pending).replace(".",","), String(r.margin).replace(".",","),
    r.tags, r.pdfUrl
  ].map(x=> `"${String(x||"").replaceAll('"','""')}"`).join(";"));

  const csv = head.join(";") + "\n" + lines.join("\n");
  downloadFile("contabilidad.csv", new Blob([csv], {type:"text/csv;charset=utf-8"}));
}

function exportLedgerAEAT(monthYYYYMM){
  // Export “Libro mensual” (I): columnas AEAT-friendly
  const rows = renderAccounting(monthYYYYMM);
  const head = ["Fecha","Numero","Cliente","NIF","Base","IVA","Total","Estado","Metodo","Tags","PDF","VAT_MODE"];
  const lines = rows.map(r=>{
    const inv = DATA.invoices.find(x=>x.number===r.number) || {};
    const cli = DATA.clients.find(c=>normName(c.name)===normName(r.client)) || {};
    const method = inv.payment || "";
    const vatMode = inv.vatMode || "";
    return [
      r.date, r.number, r.client, cli.nif || "",
      String(r.base).replace(".",","), String(r.vat).replace(".",","), String(r.total).replace(".",","),
      r.status, method, r.tags, r.pdfUrl, vatMode
    ].map(x=> `"${String(x||"").replaceAll('"','""')}"`).join(";");
  });

  const csv = head.join(";") + "\n" + lines.join("\n");
  downloadFile(`libro_facturas_${monthYYYYMM||"mensual"}.csv`, new Blob([csv], {type:"text/csv;charset=utf-8"}));
}

/* =========================
   Export/Import JSON
   ========================= */
function exportJson(){
  const blob = new Blob([JSON.stringify(DATA,null,2)], {type:"application/json"});
  downloadFile("arslan_facturas_kiwi_pro.json", blob);
}

/* =========================
   Eventos UI + atajos
   ========================= */
function bindEvents(){
  $("btnFocus").addEventListener("click",()=>{
    document.body.classList.toggle("focus-facturas");
  });

  $("btnSync").addEventListener("click", async ()=>{ await smartSync(); });

  $("btnExportJson").addEventListener("click", exportJson);

  $("fileImportJson").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const txt = await f.text();
    try{
      const imported = JSON.parse(txt);
      DATA = mergeData(DATA, imported);
      saveLocal();
      renderAll();
      $("sysMsg").textContent = "Import OK (merge inteligente).";
    }catch(err){
      $("sysMsg").textContent = "Import error.";
    }
    e.target.value="";
  });

  $("qInvoice").addEventListener("input", renderInvoiceList);
  $("fStatus").addEventListener("change", renderInvoiceList);
  $("fMonth").addEventListener("change", renderInvoiceList);
  $("btnClearFilters").addEventListener("click",()=>{
    $("qInvoice").value="";
    $("fStatus").value="";
    $("fMonth").value="";
    renderInvoiceList();
  });

  $("btnNewInvoice").addEventListener("click", createNewInvoice);
  $("btnDupInvoice").addEventListener("click", duplicateInvoice);
  $("btnSaveInvoice").addEventListener("click", saveInvoice);
  $("btnAddLine").addEventListener("click", addLine);
  $("btnClearLines").addEventListener("click", clearLines);

  // PDF local
  $("btnPdfInvoice").addEventListener("click", async ()=>{
    const inv = getCurrentInvoice();
    touchInvoice(inv);
    const blob = await buildPdfBlob(inv);
    downloadFile(`${inv.number}.pdf`, blob);
  });

  // Subir PDF (requiere nube)
  $("btnPdfCloud").addEventListener("click", async ()=>{
    const inv = getCurrentInvoice();
    try{
      if(!currentUser) { alert("Inicia sesión en Ajustes para subir a nube."); return; }
      touchInvoice(inv);
      const blob = await buildPdfBlob(inv);
      const { url, path } = await uploadInvoicePdf(inv, blob);
      inv.pdfUrl = url;
      inv.pdfPath = path;
      touchInvoice(inv);
      await smartSync();
      alert("PDF subido a nube ✅");
    }catch(e){
      alert("Error subiendo PDF. Revisa Firebase Storage + sesión.");
    }
  });

  $("btnWhatsInvoice").addEventListener("click", ()=>{
    const inv = getCurrentInvoice();
    touchInvoice(inv);
    openWhats(buildWhatsText(inv));
  });

  // Editor changes
  ["invNumber","invDate","invPay","invClient","invTags","invVatMode","invNotes"].forEach(id=>{
    $(id).addEventListener("change",()=> touchInvoice(getCurrentInvoice()));
    $(id).addEventListener("input",()=> touchInvoice(getCurrentInvoice()));
  });

  // Cobros
  $("payDate").value = new Date().toISOString().slice(0,10);
  $("btnAddPayment").addEventListener("click", addPayment);

  // Clientes
  $("qClient").addEventListener("input", renderClientList);
  $("btnNewClient").addEventListener("click", newClient);
  $("btnSaveClient").addEventListener("click", saveClient);
  $("btnDeleteClient").addEventListener("click", deleteClient);

  // Catálogo
  $("qProd").addEventListener("input", renderCatalog);
  $("btnAddProduct").addEventListener("click", ()=>{
    ensureCatalogBase();
    const key = normName("NUEVO PRODUCTO " + Math.floor(Math.random()*999));
    DATA.catalog.products[key] = { name: key, mode:"kg", price:0, cost:0, boxKg:0, taraDef:0, origin:"", history:[] };
    saveLocal(); renderCatalog();
  });
  $("btnSaveCatalog").addEventListener("click", ()=>{
    saveLocal();
    alert("Catálogo guardado ✅");
  });

  // Contabilidad (PIN)
  $("btnAccBuild").addEventListener("click", ()=>{
    if(!ACC_UNLOCKED){ pendingProtectedAction = ()=> renderAccounting($("accMonth").value||""); openPinModal(); return; }
    renderAccounting($("accMonth").value||"");
  });
  $("btnAccExport").addEventListener("click", ()=>{
    if(!ACC_UNLOCKED){ pendingProtectedAction = ()=> exportAccountingCSV(renderAccounting($("accMonth").value||"")); openPinModal(); return; }
    exportAccountingCSV(renderAccounting($("accMonth").value||""));
  });
  $("btnLedgerExport").addEventListener("click", ()=>{
    if(!ACC_UNLOCKED){ pendingProtectedAction = ()=> exportLedgerAEAT($("accMonth").value||""); openPinModal(); return; }
    exportLedgerAEAT($("accMonth").value||"");
  });

  // PIN modal
  $("btnPinOk").addEventListener("click", checkPinAndUnlock);
  $("btnPinCancel").addEventListener("click", ()=>{
    pendingProtectedAction = null;
    closePinModal();
    showView("facturas");
  });
  $("pinInput").addEventListener("keydown",(e)=>{
    if(e.key==="Enter") checkPinAndUnlock();
    if(e.key==="Escape"){ pendingProtectedAction=null; closePinModal(); showView("facturas"); }
  });

  // Ajustes provider
  $("btnSaveSettings").addEventListener("click", ()=>{
    DATA.settings = DATA.settings || {};
    DATA.settings.provider = DATA.settings.provider || {};
    DATA.settings.provider.name = $("sProvName").value.trim();
    DATA.settings.provider.nif = $("sProvNif").value.trim();
    DATA.settings.provider.addr = $("sProvAddr").value.trim();
    DATA.settings.provider.phone = $("sProvPhone").value.trim();
    DATA.settings.provider.email = $("sProvEmail").value.trim();
    saveLocal();
    $("sysMsg").textContent = "Ajustes guardados ✅";
  });

  // PIN settings
  $("btnSavePin").addEventListener("click", ()=>{
    const p1 = ($("sPin").value||"").trim();
    const p2 = ($("sPin2").value||"").trim();
    if(!p1 || p1.length<4){ alert("PIN mínimo 4 dígitos"); return; }
    if(p1!==p2){ alert("PIN no coincide"); return; }
    DATA.settings.security.accountingPin = p1;
    saveLocal();
    $("sysMsg").textContent = "PIN guardado ✅";
    $("sPin").value=""; $("sPin2").value="";
  });
  $("btnLockAcc").addEventListener("click", ()=>{
    lockAccounting();
    $("sysMsg").textContent = "Contabilidad bloqueada 🔒";
  });

  $("btnHardSync").addEventListener("click", async ()=>{
    await smartSync();
    $("sysMsg").textContent = "Sync completo ✅";
  });

  $("btnResetLocal").addEventListener("click", ()=>{
    if(!confirm("¿Reset local? (no borra nube)")) return;
    DATA = EMPTY_DATA();
    saveLocal();
    renderAll();
    $("sysMsg").textContent = "Local reseteado ✅";
  });

  // Auth (opcional)
  $("btnLogin").addEventListener("click", async ()=>{
    $("loginMsg").textContent = "—";
    if(!auth){ $("loginMsg").textContent = "Firebase no configurado (solo local)."; return; }
    const email = $("loginEmail").value.trim();
    const pass = $("loginPass").value;
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      $("loginMsg").textContent = "Sesión iniciada ✅";
    }catch(e){
      $("loginMsg").textContent = "Login error. Revisa email/contraseña.";
    }
  });

  $("btnRegister").addEventListener("click", async ()=>{
    if(!auth){ alert("Firebase no configurado (solo local)."); return; }
    const email = $("loginEmail").value.trim();
    const pass = $("loginPass").value;
    try{
      await createUserWithEmailAndPassword(auth, email, pass);
      alert("Cuenta creada ✅");
    }catch(e){
      alert("Error creando usuario (mínimo 6 caracteres / email válido).");
    }
  });

  $("btnLogout").addEventListener("click", async ()=>{
    if(!auth){ $("loginMsg").textContent = "Sin nube."; return; }
    await signOut(auth);
  });

  // Atajos globales (A)
  document.addEventListener("keydown",(e)=>{
    if(e.altKey && e.key.toLowerCase()==="p"){ e.preventDefault(); $("btnPdfInvoice").click(); }
    if(e.altKey && e.key.toLowerCase()==="w"){ e.preventDefault(); $("btnWhatsInvoice").click(); }
    if(e.ctrlKey && e.key==="Enter"){ e.preventDefault(); $("btnSaveInvoice").click(); }
  });
}

/* =========================
   Render settings + list
   ========================= */
function renderSettings(){
  const prov = DATA.settings?.provider || EMPTY_DATA().settings.provider;
  $("sProvName").value = prov.name || "";
  $("sProvNif").value = prov.nif || "";
  $("sProvAddr").value = prov.addr || "";
  $("sProvPhone").value = prov.phone || "";
  $("sProvEmail").value = prov.email || "";

  // PIN inputs vacíos (no mostrar PIN real)
  $("sPin").value = "";
  $("sPin2").value = "";
}
function renderAll(){
  DATA = mergeData(EMPTY_DATA(), DATA);
  ensureCatalogBase();
  saveLocal();

  renderInvoiceList();
  renderInvoiceEditor();
  renderClientList();
  renderCatalog();
  renderSettings();

  // contabilidad se renderiza solo si desbloqueado y estás en esa vista
}

/* =========================
   Boot + autosave (A)
   ========================= */
function boot(){
  bindEvents();
  initClientsAutocomplete();

  // default view
  showView("facturas");

  // ensure at least one invoice exists
  if((DATA.invoices||[]).length===0){
    const inv = newInvoice();
    DATA.invoices.unshift(inv);
    CURRENT_INVOICE_ID = inv.id;
    saveLocal();
  }else{
    CURRENT_INVOICE_ID = DATA.invoices[0].id;
  }

  // Firebase auth state (opcional)
  if(auth){
    onAuthStateChanged(auth, async (user)=>{
      currentUser = user || null;
      if(!user){
        $("userPill").textContent = "Modo local";
        setCloudStatus("Local · sin nube");
      }else{
        $("userPill").textContent = user.email || "Nube OK";
        await smartSync();
      }
    });
  }else{
    $("userPill").textContent = "Modo local";
    setCloudStatus("Local · sin nube (Firebase no configurado)");
  }

  // autosave cada 4s
  setInterval(()=> {
    try{
      saveLocal();
    }catch(_){}
  }, 4000);

  window.addEventListener("beforeunload", ()=> {
    try{ saveLocal(); }catch(_){}
  });

  renderAll();
}

boot();
