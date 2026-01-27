/* =========================================================
   ARSLAN • FACTURAS PRO — KIWI Edition (B/W)
   APP.JS (PARTE 1/2)
   - Offline first (localStorage)
   - Clientes + Proveedor siempre cargan (defaults)
   - Vocabulario grande + Autocomplete (NO sustituye automático)
   - Editor Facturas GRID PRO sin scroll horizontal
   - Catálogo Productos (kg/caja + historial 5) SOLO pantalla
   - Contabilidad bloqueada por PIN (se implementa en PARTE 2/2)
   - Nube Firebase opcional + PDF + QR AEAT (PARTE 2/2)
========================================================= */

/* -----------------------------
   Helpers
----------------------------- */
const $ = (id) => document.getElementById(id);

const APP_KEY = "arslan_facturas_kiwi_bw_v1";
const APP_NS  = "arslan_facturas_bw";
const VERSION = "1.0";

const euroFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function euro(n){
  const x = Number(n || 0);
  return euroFmt.format(isFinite(x) ? x : 0);
}

function nowMs(){ return Date.now(); }

function uuid(prefix="id"){
  // uuid simple para offline
  const s = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return `${prefix}_${nowMs().toString(16)}_${s.slice(0,10)}`;
}

function escapeHtml(str=""){
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function normalizeName(str=""){
  return String(str).trim().toLowerCase().replace(/\s+/g," ");
}

function parseDec(v){
  // acepta "1,25" o "1.25"
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function toInput(n){
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (!isFinite(x)) return "";
  // no forzamos decimales, solo normalizamos
  return String(x).replace(".", ",");
}

function safeJsonParse(s, fallback){
  try { return JSON.parse(s); } catch { return fallback; }
}

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

/* -----------------------------
   Defaults (Proveedor / Clientes / Settings)
----------------------------- */
function defaultProvider(){
  return {
    name: "Mohammad Arslan Waris",
    nif: "X6389988J",
    addr: "Calle San Pablo 17, Burgos",
    city: "09003 Burgos",
    phone: "631667893",
    email: "shaniwaris80@gmail.com",
    iban: "",
    bic: ""
  };
}

function defaultClients(){
  // ✅ Semillas con los clientes que tenemos confirmados en tu sistema
  return [
    {
      id:"cli_goldengarden",
      name:"Golden Garden",
      fiscalName:"David Herrera Estalayo",
      nif:"71281665L",
      addr:"Trinidad, 12, 09003, Burgos",
      phone:"",
      email:"",
      tags:"GoldenGarden",
      taxMode:"included_no_breakdown" // ✅ IVA incluido, sin desglose (tu regla)
    },
    {
      id:"cli_consentidos",
      name:"Con/sentidos",
      fiscalName:"Cuevas Palacios Restauración S.L.",
      nif:"B10694792",
      addr:"C/ San Lesmes, 1 - 09004 Burgos",
      phone:"947 20 35 51",
      email:"",
      tags:"Con/sentidos",
      taxMode:"normal"
    },
    {
      id:"cli_alpanpan",
      name:"Al Pan Pan Burgos",
      fiscalName:"Al Pan Pan Burgos, S.L.",
      nif:"B09569344",
      addr:"C/ Miranda, 17 Bajo, 09002 Burgos",
      phone:"947277977",
      email:"bertiz.miranda@gmail.com",
      tags:"Al Pan Pan",
      taxMode:"normal"
    },
    {
      id:"cli_cafenuovo",
      name:"CAFÉ BAR NUOVO",
      fiscalName:"EINY MERCEDES OLIVO JIMENEZ",
      nif:"120221393",
      addr:"C/ San Juan de Ortega 14, 09007 Burgos",
      phone:"",
      email:"",
      tags:"Nuovo",
      taxMode:"normal"
    },
    {
      id:"cli_alesalpan",
      name:"ALESAL PAN / CAFÉ DE CALLE SAN LESMES",
      fiscalName:"Alesal Pan y Café S.L",
      nif:"B09582420",
      addr:"Calle San Lesmes 1",
      phone:"",
      email:"",
      tags:"Alesal Pan",
      taxMode:"normal"
    },
    {
      id:"cli_riviera",
      name:"RIVIERA",
      fiscalName:"CONOR ESY SLU",
      nif:"B16794893",
      addr:"Paseo del Espolón, 09003 Burgos",
      phone:"",
      email:"",
      tags:"Riviera",
      taxMode:"normal"
    },
    {
      id:"cli_adnanasif",
      name:"Adnan Asif",
      fiscalName:"Adnan Asif",
      nif:"X7128589S",
      addr:"Calle Padre Flórez 3, Burgos",
      phone:"",
      email:"",
      tags:"Adnan",
      taxMode:"normal"
    }
  ];
}

function defaultSettings(){
  return {
    version: VERSION,
    taxRate: 0.04,
    prefix: "FA-",
    pin: "7392",
    qrBase: "",
    firebase: { apiKey:"", authDomain:"", databaseURL:"", projectId:"", storageBucket:"", appId:"" }
  };
}

function defaultDB(){
  return {
    version: VERSION,
    createdAt: nowMs(),
    updatedAt: nowMs(),
    provider: defaultProvider(),
    settings: defaultSettings(),
    clients: defaultClients(),
    products: {},     // key -> {id,key,name,unit,kgBox,cost,price,hist:[{t,cost,price}]}
    invoices: []      // {id, number, dateISO, clientId, clientNameCache, tags, notes, lines[], totals, pdfUrl?...}
  };
}

/* -----------------------------
   Load/Save local
----------------------------- */
function loadLocal(){
  const raw = localStorage.getItem(APP_KEY);
  const db = safeJsonParse(raw, null);
  if (!db || typeof db !== "object") return defaultDB();
  return migrateAndFix(db);
}

function saveLocal(){
  state.db.updatedAt = nowMs();
  localStorage.setItem(APP_KEY, JSON.stringify(state.db));
}

function migrateAndFix(db){
  const out = deepClone(db);

  // básicos
  out.version = out.version || VERSION;
  out.provider = out.provider && typeof out.provider === "object" ? out.provider : defaultProvider();
  out.settings = out.settings && typeof out.settings === "object" ? out.settings : defaultSettings();

  // clients
  if (!Array.isArray(out.clients)) out.clients = [];
  // si está vacío, sembrar defaults
  if (out.clients.length === 0) out.clients = defaultClients();

  // products/invoices
  if (!out.products || typeof out.products !== "object") out.products = {};
  if (!Array.isArray(out.invoices)) out.invoices = [];

  // limpiar nulos en invoices
  out.invoices = out.invoices.filter(Boolean).map(inv => ({
    id: inv.id || uuid("inv"),
    number: inv.number || "",
    dateISO: inv.dateISO || new Date().toISOString().slice(0,10),
    clientId: inv.clientId || "",
    clientNameCache: inv.clientNameCache || "",
    tags: inv.tags || "",
    notes: inv.notes || "",
    status: inv.status || "draft",
    createdAt: inv.createdAt || nowMs(),
    updatedAt: inv.updatedAt || nowMs(),
    pdfUrl: inv.pdfUrl || "",
    pdfUpdatedAt: inv.pdfUpdatedAt || 0,
    lines: Array.isArray(inv.lines) ? inv.lines.map(lineFix) : []
  }));

  return out;
}

function lineFix(l){
  const line = l && typeof l === "object" ? l : {};
  return {
    id: line.id || uuid("ln"),
    product: line.product || "",
    mode: line.mode || "kg",        // kg | unidad | caja
    qty: Number(line.qty || 0),
    price: Number(line.price || 0),
    bruto: Number(line.bruto || 0),
    tara: Number(line.tara || 0),
    neto: Number(line.neto || 0),
    origin: line.origin || "",
    amount: Number(line.amount || 0)
  };
}

/* -----------------------------
   Merge (local + import/cloud)
----------------------------- */
function mergeClients(aList, bList){
  const a = Array.isArray(aList) ? aList : [];
  const b = Array.isArray(bList) ? bList : [];
  const out = [];
  const byId = new Map();
  const byName = new Map();

  function upsert(c){
    const cc = deepClone(c);
    cc.id = cc.id || uuid("cli");
    const n = normalizeName(cc.name || cc.fiscalName || "");
    if (byId.has(cc.id)) return;
    if (n && byName.has(n)) return; // evita duplicado por nombre
    out.push(cc);
    byId.set(cc.id, cc);
    if (n) byName.set(n, cc);
  }

  a.forEach(upsert);
  b.forEach((c)=>{
    const n = normalizeName(c?.name || c?.fiscalName || "");
    const id = c?.id || "";
    if (id && byId.has(id)){
      // merge suave: rellena campos vacíos
      const dst = byId.get(id);
      for (const k of Object.keys(c)){
        if ((dst[k] === "" || dst[k] === null || dst[k] === undefined) && c[k] !== "" && c[k] !== null && c[k] !== undefined){
          dst[k] = c[k];
        }
      }
      return;
    }
    if (n && byName.has(n)){
      const dst = byName.get(n);
      for (const k of Object.keys(c)){
        if ((dst[k] === "" || dst[k] === null || dst[k] === undefined) && c[k] !== "" && c[k] !== null && c[k] !== undefined){
          dst[k] = c[k];
        }
      }
      return;
    }
    upsert(c);
  });

  return out;
}

function invKey(inv){
  const d = inv?.dateISO || "";
  const num = (inv?.number || "").trim().toLowerCase();
  const cli = (inv?.clientNameCache || "").trim().toLowerCase();
  return `${d}__${num}__${cli}`;
}

function mergeInvoices(aList, bList){
  const a = Array.isArray(aList) ? aList : [];
  const b = Array.isArray(bList) ? bList : [];
  const out = [];
  const byId = new Map();
  const byKey = new Map();

  function add(inv){
    const x = deepClone(inv);
    x.id = x.id || uuid("inv");
    x.lines = Array.isArray(x.lines) ? x.lines.map(lineFix) : [];
    const k = invKey(x);
    out.push(x);
    byId.set(x.id, x);
    if (k) byKey.set(k, x);
  }

  a.forEach(add);

  b.forEach((inv)=>{
    const id = inv?.id || "";
    const k  = invKey(inv);
    if (id && byId.has(id)){
      const dst = byId.get(id);
      // coge el más actualizado
      const aT = Number(dst.updatedAt||0);
      const bT = Number(inv.updatedAt||0);
      if (bT > aT){
        Object.assign(dst, deepClone(inv));
        dst.lines = Array.isArray(dst.lines) ? dst.lines.map(lineFix) : [];
      }
      return;
    }
    if (k && byKey.has(k)){
      const dst = byKey.get(k);
      const aT = Number(dst.updatedAt||0);
      const bT = Number(inv.updatedAt||0);
      if (bT > aT){
        Object.assign(dst, deepClone(inv));
        dst.lines = Array.isArray(dst.lines) ? dst.lines.map(lineFix) : [];
        if (id && !dst.id) dst.id = id;
        byId.set(dst.id, dst);
      }
      return;
    }
    add(inv);
  });

  // orden por fecha desc
  out.sort((x,y)=> (y.dateISO||"").localeCompare(x.dateISO||"") || (Number(y.createdAt||0)-Number(x.createdAt||0)));
  return out;
}

function mergeDB(localDB, incomingDB){
  const L = migrateAndFix(localDB || defaultDB());
  const R = migrateAndFix(incomingDB || defaultDB());

  const out = migrateAndFix(L);

  // provider/settings: rellena vacíos sin pisar
  out.provider = out.provider || defaultProvider();
  for (const k of Object.keys(R.provider||{})){
    if ((out.provider[k] === "" || out.provider[k] === null || out.provider[k] === undefined) && R.provider[k]){
      out.provider[k] = R.provider[k];
    }
  }

  out.settings = out.settings || defaultSettings();
  for (const k of Object.keys(R.settings||{})){
    if ((out.settings[k] === "" || out.settings[k] === null || out.settings[k] === undefined) && R.settings[k] !== undefined){
      out.settings[k] = R.settings[k];
    }
  }

  // clients
  out.clients = mergeClients(L.clients, R.clients);

  // products: merge por key
  out.products = out.products || {};
  const incProd = R.products || {};
  for (const key of Object.keys(incProd)){
    if (!out.products[key]) out.products[key] = deepClone(incProd[key]);
    else {
      const dst = out.products[key];
      const src = incProd[key];
      // merge suave
      for (const k of Object.keys(src)){
        if ((dst[k] === "" || dst[k] === null || dst[k] === undefined) && src[k] !== "" && src[k] !== null && src[k] !== undefined){
          dst[k] = src[k];
        }
      }
      // hist
      if (Array.isArray(src.hist)){
        dst.hist = Array.isArray(dst.hist) ? dst.hist : [];
        const merged = [...dst.hist, ...src.hist].filter(Boolean);
        merged.sort((a,b)=> (b.t||0)-(a.t||0));
        dst.hist = merged.slice(0,5);
      }
    }
  }

  // invoices
  out.invoices = mergeInvoices(L.invoices, R.invoices);

  out.updatedAt = nowMs();
  return out;
}

/* -----------------------------
   Vocabulario (usuario) + autocomplete
   - NO sustituye automático
   - solo sugiere y el usuario elige
----------------------------- */
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

function buildVocab(){
  const arr = VOCAB_RAW.split("\n").map(s=>s.trim()).filter(Boolean);
  // suma también nombres del catálogo y normaliza duplicados
  const set = new Map();
  for (const s of arr){
    const key = normalizeName(s);
    if (!set.has(key)) set.set(key, s);
  }
  // catálogo actual
  for (const k of Object.keys(state.db.products || {})){
    const p = state.db.products[k];
    if (p?.name){
      const key = normalizeName(p.name);
      if (!set.has(key)) set.set(key, p.name);
    }
  }
  // devolver en mayúsculas visualmente, pero guardar original
  return Array.from(set.values());
}

/* -----------------------------
   State
----------------------------- */
const state = {
  db: loadLocal(),
  view: "facturas",
  currentInvoiceId: "",
  currentClientId: "",
  currentProductKey: "",
  vocab: [],
  accUnlocked: false,     // contabilidad (PIN) - se usa en PARTE 2
  cloud: {
    enabled: false,
    ready: false,
    user: null,
    msg: "Modo local"
  }
};

// ✅ Asegurar semillas (por si el usuario tenía data corrupta)
(function ensureSeeds(){
  if (!state.db.provider) state.db.provider = defaultProvider();
  if (!state.db.settings) state.db.settings = defaultSettings();
  if (!Array.isArray(state.db.clients) || state.db.clients.length === 0) state.db.clients = defaultClients();
  if (!state.db.products || typeof state.db.products !== "object") state.db.products = {};
  if (!Array.isArray(state.db.invoices)) state.db.invoices = [];
  saveLocal();
})();

/* -----------------------------
   DOM refs (con null-checks)
----------------------------- */
const el = {
  // top
  cloudPill: $("cloudPill"),
  btnLogin: $("btnLogin"),
  btnLogout: $("btnLogout"),
  btnSync: $("btnSync"),
  btnExport: $("btnExport"),
  fileImport: $("fileImport"),

  // nav
  nav: $("nav"),

  // views
  vFact: $("view-facturas"),
  vClients: $("view-clientes"),
  vProd: $("view-productos"),
  vAcc: $("view-contabilidad"),
  vSettings: $("view-ajustes"),

  // facturas list/editor
  invList: $("invList"),
  invSearch: $("invSearch"),
  btnClearSearch: $("btnClearSearch"),
  invCount: $("invCount"),
  invDraftCount: $("invDraftCount"),

  btnNewInvoice: $("btnNewInvoice"),
  btnDuplicateInvoice: $("btnDuplicateInvoice"),
  btnDeleteInvoice: $("btnDeleteInvoice"),

  invTitle: $("invTitle"),
  invMeta: $("invMeta"),
  btnSaveInvoice: $("btnSaveInvoice"),
  btnPDF: $("btnPDF"),
  btnPDFUpload: $("btnPDFUpload"),
  btnWhatsApp: $("btnWhatsApp"),

  invClient: $("invClient"),
  clientInfo: $("clientInfo"),
  invDate: $("invDate"),
  invNumber: $("invNumber"),
  invTags: $("invTags"),
  invNotes: $("invNotes"),
  btnAddLine: $("btnAddLine"),
  lines: $("lines"),

  tSubtotal: $("tSubtotal"),
  tIVA: $("tIVA"),
  tTotal: $("tTotal"),

  pdfState: $("pdfState"),
  btnOpenPdf: $("btnOpenPdf"),
  btnCopyPdf: $("btnCopyPdf"),

  // clients
  clientSearch: $("clientSearch"),
  clientList: $("clientList"),
  btnNewClient: $("btnNewClient"),
  btnSaveClient: $("btnSaveClient"),
  btnDeleteClient: $("btnDeleteClient"),
  clientTitle: $("clientTitle"),
  clientId: $("clientId"),
  cName: $("cName"),
  cNif: $("cNif"),
  cAddr: $("cAddr"),
  cPhone: $("cPhone"),
  cEmail: $("cEmail"),
  cTags: $("cTags"),

  // products
  prodSearch: $("prodSearch"),
  prodList: $("prodList"),
  btnNewProduct: $("btnNewProduct"),
  btnSaveProduct: $("btnSaveProduct"),
  btnDeleteProduct: $("btnDeleteProduct"),
  prodTitle: $("prodTitle"),
  prodKey: $("prodKey"),
  pName: $("pName"),
  pUnit: $("pUnit"),
  pKgBox: $("pKgBox"),
  pCost: $("pCost"),
  pPrice: $("pPrice"),
  pHist: $("pHist"),

  // contabilidad
  btnUnlock: $("btnUnlock"),
  btnLock: $("btnLock"),
  accFrom: $("accFrom"),
  accTo: $("accTo"),
  accClient: $("accClient"),
  accTag: $("accTag"),
  btnAccRun: $("btnAccRun"),
  accStatus: $("accStatus"),
  accSales: $("accSales"),
  accIva: $("accIva"),
  accN: $("accN"),
  accMargin: $("accMargin"),
  accTable: $("accTable"),

  // settings
  btnSaveSettings: $("btnSaveSettings"),
  sProvName: $("sProvName"),
  sProvNif: $("sProvNif"),
  sProvAddr: $("sProvAddr"),
  sProvCity: $("sProvCity"),
  sProvPhone: $("sProvPhone"),
  sProvEmail: $("sProvEmail"),
  sProvIban: $("sProvIban"),
  sProvBic: $("sProvBic"),

  sTaxRate: $("sTaxRate"),
  sPrefix: $("sPrefix"),
  sPin: $("sPin"),
  sQrBase: $("sQrBase"),

  fbApiKey: $("fbApiKey"),
  fbAuthDomain: $("fbAuthDomain"),
  fbDbUrl: $("fbDbUrl"),
  fbProjectId: $("fbProjectId"),
  fbStorage: $("fbStorage"),
  fbAppId: $("fbAppId"),

  // login modal
  loginModal: $("loginModal"),
  loginEmail: $("loginEmail"),
  loginPass: $("loginPass"),
  btnLoginDo: $("btnLoginDo"),
  btnSignupDo: $("btnSignupDo"),
  btnLoginClose: $("btnLoginClose"),
  loginMsg: $("loginMsg"),

  // pin modal
  pinModal: $("pinModal"),
  pinInput: $("pinInput"),
  btnPinOk: $("btnPinOk"),
  btnPinCancel: $("btnPinCancel"),
  pinMsg: $("pinMsg"),
};

/* -----------------------------
   View switching
----------------------------- */
function setView(view){
  state.view = view;

  const map = { facturas: el.vFact, clientes: el.vClients, productos: el.vProd, contabilidad: el.vAcc, ajustes: el.vSettings };
  for (const k of Object.keys(map)){
    if (map[k]) map[k].style.display = (k === view ? "block" : "none");
  }

  // nav active
  if (el.nav){
    [...el.nav.querySelectorAll(".nav-btn")].forEach(b=>{
      b.classList.toggle("active", b.dataset.view === view);
    });
  }

  // render view-specific
  if (view === "facturas") renderFacturas();
  if (view === "clientes") renderClientes();
  if (view === "productos") renderProductos();
  if (view === "ajustes") renderAjustes();
  if (view === "contabilidad") renderContabilidadGate(); // (PARTE 2)
}

/* -----------------------------
   Cloud UI (solo visual aquí)
----------------------------- */
function renderCloudPill(){
  if (!el.cloudPill) return;
  el.cloudPill.textContent = state.cloud.user ? `Nube: ${state.cloud.user.email||"OK"}` : "Modo local";
  if (el.btnLogin) el.btnLogin.style.display = state.cloud.user ? "none" : "inline-flex";
  if (el.btnLogout) el.btnLogout.style.display = state.cloud.user ? "inline-flex" : "none";
  if (el.btnSync) el.btnSync.style.display = state.cloud.user ? "inline-flex" : "none";
}

/* -----------------------------
   Clientes
----------------------------- */
function getClientById(id){
  return (state.db.clients || []).find(c=>c.id === id) || null;
}

function renderClientSelects(){
  // invClient + accClient
  const list = state.db.clients || [];
  const opts = [`<option value="">— Seleccionar —</option>`]
    .concat(list.map(c=>{
      const label = (c.name || c.fiscalName || "Cliente");
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
    }));

  if (el.invClient){
    el.invClient.innerHTML = opts.join("");
  }
  if (el.accClient){
    el.accClient.innerHTML = opts.join("");
  }
}

function renderClientes(){
  if (!el.clientList) return;

  const q = normalizeName(el.clientSearch?.value || "");
  const list = (state.db.clients || [])
    .filter(c=>{
      if (!q) return true;
      const s = normalizeName(`${c.name||""} ${c.fiscalName||""} ${c.nif||""} ${c.addr||""}`);
      return s.includes(q);
    })
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  el.clientList.innerHTML = list.map(c=>{
    const title = escapeHtml(c.name || c.fiscalName || "Cliente");
    const sub = escapeHtml(`${c.nif||""} · ${c.addr||""}`.trim());
    return `
      <div class="item" data-cli="${escapeHtml(c.id)}">
        <div class="t">${title}</div>
        <div class="s">
          <span class="badge">${sub || "—"}</span>
          <span class="badge">${escapeHtml(c.tags||"")}</span>
        </div>
      </div>
    `;
  }).join("") || `<div class="muted">No hay clientes.</div>`;

  // click select
  [...el.clientList.querySelectorAll(".item")].forEach(it=>{
    it.addEventListener("click", ()=>{
      state.currentClientId = it.dataset.cli || "";
      loadClientToForm(state.currentClientId);
    });
  });

  // si ninguno seleccionado, selecciona primero
  if (!state.currentClientId && list[0]){
    state.currentClientId = list[0].id;
    loadClientToForm(state.currentClientId);
  } else if (state.currentClientId){
    loadClientToForm(state.currentClientId);
  }
}

function loadClientToForm(id){
  const c = getClientById(id);
  if (!c) return;

  if (el.clientTitle) el.clientTitle.textContent = c.name || c.fiscalName || "Cliente";
  if (el.clientId) el.clientId.textContent = c.id || "—";

  if (el.cName) el.cName.value = c.name || "";
  if (el.cNif) el.cNif.value = c.nif || "";
  if (el.cAddr) el.cAddr.value = c.addr || "";
  if (el.cPhone) el.cPhone.value = c.phone || "";
  if (el.cEmail) el.cEmail.value = c.email || "";
  if (el.cTags) el.cTags.value = c.tags || "";
}

function saveClientFromForm(){
  const id = state.currentClientId || uuid("cli");
  let c = getClientById(id);
  const isNew = !c;

  const obj = {
    id,
    name: (el.cName?.value || "").trim(),
    fiscalName: (el.cName?.value || "").trim(), // si quieres separar fiscalName luego se añade
    nif: (el.cNif?.value || "").trim(),
    addr: (el.cAddr?.value || "").trim(),
    phone: (el.cPhone?.value || "").trim(),
    email: (el.cEmail?.value || "").trim(),
    tags: (el.cTags?.value || "").trim(),
    taxMode: c?.taxMode || "normal"
  };

  if (isNew){
    state.db.clients.push(obj);
  } else {
    Object.assign(c, obj);
  }

  saveLocal();
  state.currentClientId = id;
  renderClientSelects();
  renderClientes();
  renderFacturas(); // por si cambió nombre
}

function deleteClient(){
  const id = state.currentClientId;
  if (!id) return;
  state.db.clients = (state.db.clients || []).filter(c=>c.id !== id);
  // limpiar referencias en facturas (no borramos facturas)
  (state.db.invoices || []).forEach(inv=>{
    if (inv.clientId === id) inv.clientId = "";
  });
  state.currentClientId = "";
  saveLocal();
  renderClientSelects();
  renderClientes();
  renderFacturas();
}

/* -----------------------------
   Productos catálogo
----------------------------- */
function productKeyFromName(name){
  return normalizeName(name).toUpperCase().replace(/\s+/g,"_").slice(0,80);
}

function getProductByKey(key){
  return (state.db.products && state.db.products[key]) ? state.db.products[key] : null;
}

function renderProductos(){
  if (!el.prodList) return;

  const q = normalizeName(el.prodSearch?.value || "");
  const all = Object.keys(state.db.products || {}).map(k=>state.db.products[k]).filter(Boolean);
  const list = all.filter(p=>{
    if (!q) return true;
    return normalizeName(p.name||"").includes(q);
  }).sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  el.prodList.innerHTML = list.map(p=>{
    const hist = Array.isArray(p.hist) ? p.hist : [];
    const last = hist[0] || null;
    const lastText = last ? `Últ: ${last.price!==undefined? euro(last.price):""} ${last.cost!==undefined? " · Coste "+euro(last.cost):""}` : "—";
    return `
      <div class="item" data-pkey="${escapeHtml(p.key)}">
        <div class="t">${escapeHtml(p.name || p.key)}</div>
        <div class="s">
          <span class="badge">${escapeHtml(p.unit||"kg")}${p.kgBox? " · "+escapeHtml(String(p.kgBox))+" kg/caja":""}</span>
          <span class="badge">${escapeHtml(lastText)}</span>
        </div>
      </div>
    `;
  }).join("") || `<div class="muted">No hay productos guardados aún. Puedes crear desde aquí.</div>`;

  [...el.prodList.querySelectorAll(".item")].forEach(it=>{
    it.addEventListener("click", ()=>{
      state.currentProductKey = it.dataset.pkey || "";
      loadProductToForm(state.currentProductKey);
    });
  });

  if (!state.currentProductKey && list[0]){
    state.currentProductKey = list[0].key;
    loadProductToForm(state.currentProductKey);
  } else if (state.currentProductKey){
    loadProductToForm(state.currentProductKey);
  }
}

function loadProductToForm(key){
  const p = getProductByKey(key);
  if (!p) {
    if (el.prodTitle) el.prodTitle.textContent = "Producto";
    if (el.prodKey) el.prodKey.textContent = "—";
    if (el.pName) el.pName.value = "";
    if (el.pUnit) el.pUnit.value = "kg";
    if (el.pKgBox) el.pKgBox.value = "";
    if (el.pCost) el.pCost.value = "";
    if (el.pPrice) el.pPrice.value = "";
    if (el.pHist) el.pHist.textContent = "—";
    return;
  }

  if (el.prodTitle) el.prodTitle.textContent = p.name || "Producto";
  if (el.prodKey) el.prodKey.textContent = p.key || "—";
  if (el.pName) el.pName.value = p.name || "";
  if (el.pUnit) el.pUnit.value = p.unit || "kg";
  if (el.pKgBox) el.pKgBox.value = (p.kgBox ? toInput(p.kgBox) : "");
  if (el.pCost) el.pCost.value = (p.cost!==undefined ? toInput(p.cost) : "");
  if (el.pPrice) el.pPrice.value = (p.price!==undefined ? toInput(p.price) : "");

  const hist = Array.isArray(p.hist) ? p.hist : [];
  if (el.pHist){
    el.pHist.innerHTML = hist.length
      ? hist.map(h=>{
          const d = new Date(h.t||0);
          const dt = `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;
          const txt = `${dt} · Precio: ${h.price!==undefined? euro(h.price):"—"} · Coste: ${h.cost!==undefined? euro(h.cost):"—"}`;
          return `<div>${escapeHtml(txt)}</div>`;
        }).join("")
      : "—";
  }
}

function saveProductFromForm(){
  const name = (el.pName?.value || "").trim();
  if (!name) return;

  const key = state.currentProductKey || productKeyFromName(name);
  const unit = el.pUnit?.value || "kg";
  const kgBox = parseDec(el.pKgBox?.value || "");
  const cost = parseDec(el.pCost?.value || "");
  const price = parseDec(el.pPrice?.value || "");

  let p = getProductByKey(key);
  const isNew = !p;

  const obj = p ? p : { id: uuid("prd"), key, name:"", unit:"kg", kgBox:0, cost:0, price:0, hist:[] };

  const changed = (obj.cost !== cost) || (obj.price !== price);
  obj.key = key;
  obj.name = name;
  obj.unit = unit;
  obj.kgBox = kgBox || 0;
  obj.cost = cost || 0;
  obj.price = price || 0;

  if (!Array.isArray(obj.hist)) obj.hist = [];
  if (changed){
    obj.hist.unshift({ t: nowMs(), cost: obj.cost, price: obj.price });
    obj.hist = obj.hist.slice(0,5);
  }

  state.db.products[key] = obj;
  saveLocal();

  state.currentProductKey = key;
  state.vocab = buildVocab(); // refresca para autocomplete
  renderProductos();
}

function deleteProduct(){
  const key = state.currentProductKey;
  if (!key) return;
  delete state.db.products[key];
  state.currentProductKey = "";
  saveLocal();
  state.vocab = buildVocab();
  renderProductos();
}

/* -----------------------------
   Facturas
----------------------------- */
function newInvoice(){
  const inv = {
    id: uuid("inv"),
    number: suggestInvoiceNumber(),
    dateISO: new Date().toISOString().slice(0,10),
    clientId: "",
    clientNameCache: "",
    tags: "",
    notes: "",
    status: "draft",
    createdAt: nowMs(),
    updatedAt: nowMs(),
    pdfUrl: "",
    pdfUpdatedAt: 0,
    lines: [
      { id: uuid("ln"), product:"", mode:"kg", qty:0, price:0, bruto:0, tara:0, neto:0, origin:"", amount:0 }
    ]
  };
  state.db.invoices.unshift(inv);
  state.currentInvoiceId = inv.id;
  saveLocal();
  renderFacturas();
  loadInvoiceToEditor(inv.id);
}

function suggestInvoiceNumber(){
  const pref = (state.db.settings?.prefix || "FA-");
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${pref}${stamp}`;
}

function getInvoiceById(id){
  return (state.db.invoices || []).find(x=>x.id === id) || null;
}

function renderFacturas(){
  if (!el.invList) return;

  // counters
  const invs = state.db.invoices || [];
  if (el.invCount) el.invCount.textContent = `${invs.length} facturas`;
  const drafts = invs.filter(x=> (x.status||"draft")==="draft").length;
  if (el.invDraftCount) el.invDraftCount.textContent = `${drafts} borradores`;

  const q = normalizeName(el.invSearch?.value || "");
  const list = invs.filter(inv=>{
    if (!q) return true;
    const s = normalizeName(`${inv.number||""} ${inv.clientNameCache||""} ${inv.dateISO||""} ${inv.tags||""}`);
    return s.includes(q);
  });

  el.invList.innerHTML = list.map(inv=>{
    const title = escapeHtml(inv.number || "Sin número");
    const cli = escapeHtml(inv.clientNameCache || "—");
    const date = escapeHtml(inv.dateISO || "");
    const tags = escapeHtml(inv.tags || "");
    const total = calcInvoiceTotals(inv).total;
    const pdfBadge = inv.pdfUrl ? `<span class="badge">PDF ✔</span>` : `<span class="badge">PDF —</span>`;
    return `
      <div class="item" data-inv="${escapeHtml(inv.id)}">
        <div class="t">${title}</div>
        <div class="s">
          <span class="badge">${date}</span>
          <span class="badge">${cli}</span>
          <span class="badge">${euro(total)}</span>
          ${pdfBadge}
          ${tags? `<span class="badge">${tags}</span>`:""}
        </div>
      </div>
    `;
  }).join("") || `<div class="muted">No hay facturas.</div>`;

  [...el.invList.querySelectorAll(".item")].forEach(it=>{
    it.addEventListener("click", ()=>{
      const id = it.dataset.inv || "";
      loadInvoiceToEditor(id);
    });
  });

  // auto select
  if (!state.currentInvoiceId && invs[0]) state.currentInvoiceId = invs[0].id;
  if (state.currentInvoiceId) loadInvoiceToEditor(state.currentInvoiceId, {silent:true});
}

function loadInvoiceToEditor(id, opts={silent:false}){
  const inv = getInvoiceById(id);
  if (!inv) return;

  state.currentInvoiceId = inv.id;

  // title/meta
  if (el.invTitle) el.invTitle.textContent = inv.number || "Factura";
  if (el.invMeta) el.invMeta.textContent = `${inv.dateISO || ""} · ${inv.clientNameCache || "—"}`;

  // client select
  renderClientSelects();
  if (el.invClient) el.invClient.value = inv.clientId || "";

  // info
  const c = inv.clientId ? getClientById(inv.clientId) : null;
  if (el.clientInfo){
    el.clientInfo.textContent = c
      ? `${c.nif||"—"} · ${c.addr||"—"}`
      : "—";
  }

  if (el.invDate) el.invDate.value = inv.dateISO || new Date().toISOString().slice(0,10);
  if (el.invNumber) el.invNumber.value = inv.number || "";
  if (el.invTags) el.invTags.value = inv.tags || "";
  if (el.invNotes) el.invNotes.value = inv.notes || "";

  // pdf state
  if (el.pdfState) el.pdfState.textContent = inv.pdfUrl ? `PDF guardado ✔` : "PDF —";
  if (el.btnOpenPdf) el.btnOpenPdf.disabled = !inv.pdfUrl;
  if (el.btnCopyPdf) el.btnCopyPdf.disabled = !inv.pdfUrl;

  // lines
  renderLines(inv);

  // totals
  updateTotals(inv);

  if (!opts.silent){
    saveLocal();
  }
}

function updateTotals(inv){
  const t = calcInvoiceTotals(inv);
  if (el.tSubtotal) el.tSubtotal.textContent = euro(t.subtotal);
  if (el.tIVA) el.tIVA.textContent = t.hideTax ? "—" : euro(t.iva);
  if (el.tTotal) el.tTotal.textContent = euro(t.total);
}

function calcInvoiceTotals(inv){
  const lines = Array.isArray(inv.lines) ? inv.lines : [];
  let subtotal = 0;
  for (const l of lines){
    subtotal += Number(l.amount || 0);
  }

  const c = inv.clientId ? getClientById(inv.clientId) : null;
  const taxRate = Number(state.db.settings?.taxRate || 0.04);

  // ✅ Golden Garden (IVA incluido sin desglose)
  const hideTax = (c && c.taxMode === "included_no_breakdown");
  const iva = hideTax ? 0 : (subtotal * taxRate);
  const total = hideTax ? subtotal : (subtotal + iva);

  return { subtotal, iva, total, hideTax };
}

/* -----------------------------
   Lines render (GRID PRO sin scroll)
----------------------------- */
function renderLines(inv){
  if (!el.lines) return;
  const lines = Array.isArray(inv.lines) ? inv.lines : [];
  el.lines.innerHTML = "";

  lines.forEach((line, idx)=>{
    const row = document.createElement("div");
    row.className = "line";
    row.dataset.lid = line.id;

    row.innerHTML = `
      <div class="cell-prod ac-wrap">
        <input class="prod" data-k="product" placeholder="Producto" value="${escapeHtml(line.product||"")}" autocomplete="off"/>
        <div class="ac"></div>
        <div class="hint" data-h="last" style="margin-top:6px;"></div>
      </div>

      <div class="cell-mode">
        <select data-k="mode" title="Modo">
          <option value="kg" ${line.mode==="kg"?"selected":""}>kg</option>
          <option value="unidad" ${line.mode==="unidad"?"selected":""}>ud</option>
          <option value="caja" ${line.mode==="caja"?"selected":""}>caja</option>
        </select>
      </div>

      <div class="cell-qty">
        <input data-k="qty" inputmode="decimal" placeholder="Cant" value="${toInput(line.qty)}"/>
      </div>

      <div class="cell-price">
        <input data-k="price" inputmode="decimal" placeholder="Precio" value="${toInput(line.price)}"/>
      </div>

      <div class="cell-amount money">${euro(line.amount||0)}</div>

      <div class="cell-del">
        <button class="icon-btn danger" title="Eliminar">✖</button>
      </div>

      <div class="cell-bruto">
        <input data-k="bruto" inputmode="decimal" placeholder="Bruto" value="${toInput(line.bruto)}"/>
      </div>

      <div class="cell-tara">
        <input data-k="tara" inputmode="decimal" placeholder="Tara" value="${toInput(line.tara)}"/>
      </div>

      <div class="cell-neto">
        <input data-k="neto" inputmode="decimal" placeholder="Neto" value="${toInput(line.neto)}"/>
      </div>

      <div class="cell-origin">
        <input data-k="origin" placeholder="Origen" value="${escapeHtml(line.origin||"")}"/>
      </div>
    `;

    // delete
    const delBtn = row.querySelector(".icon-btn");
    delBtn.addEventListener("click", ()=>{
      inv.lines = inv.lines.filter(x=>x.id !== line.id);
      inv.updatedAt = nowMs();
      saveLocal();
      renderLines(inv);
      updateTotals(inv);
    });

    // change handlers
    row.querySelectorAll("input[data-k], select[data-k]").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        applyLineChange(inv, line.id, row);
      });
      inp.addEventListener("change", ()=>{
        applyLineChange(inv, line.id, row);
      });
    });

    // autocomplete
    const prodInput = row.querySelector('input[data-k="product"]');
    const ac = row.querySelector(".ac");
    const hintLast = row.querySelector('[data-h="last"]');

    setupAutocomplete(prodInput, ac, (picked)=>{
      // user elige: aplicamos producto y sugerencias del catálogo
      prodInput.value = picked;
      const li = inv.lines.find(x=>x.id === line.id);
      if (li){
        li.product = picked;
        // si existe en catálogo, sugerimos unidad y precio, pero NO obligamos
        const p = findProductByName(picked);
        if (p){
          const modeSel = row.querySelector('select[data-k="mode"]');
          if (modeSel && !li.mode) li.mode = p.unit==="ud"?"unidad":(p.unit||"kg");
          if (modeSel && li.mode && modeSel.value !== li.mode) modeSel.value = li.mode;

          // sugerencia: si precio en línea está vacío -> poner sugerido
          const priceInp = row.querySelector('input[data-k="price"]');
          if (priceInp && (!li.price || Number(li.price)===0) && p.price){
            li.price = Number(p.price||0);
            priceInp.value = toInput(li.price);
          }

          // hint últimos 5
          if (hintLast){
            const hist = Array.isArray(p.hist) ? p.hist : [];
            const t = hist[0];
            hintLast.textContent = t ? `Últimos: ${hist.map(h=> euro(h.price||0)).join(" · ")}` : "";
          }
        } else {
          if (hintLast) hintLast.textContent = "";
        }

        inv.updatedAt = nowMs();
        applyLineChange(inv, line.id, row, {silent:true});
        saveLocal();
      }
    });

    // hint inicial
    const p0 = findProductByName(line.product||"");
    if (hintLast){
      const hist = p0 && Array.isArray(p0.hist) ? p0.hist : [];
      hintLast.textContent = hist[0] ? `Últimos: ${hist.map(h=> euro(h.price||0)).join(" · ")}` : "";
    }

    el.lines.appendChild(row);
  });
}

function applyLineChange(inv, lineId, row, opts={silent:false}){
  const line = inv.lines.find(x=>x.id === lineId);
  if (!line) return;

  const getV = (k)=>{
    const node = row.querySelector(`[data-k="${k}"]`);
    if (!node) return "";
    return node.value;
  };

  line.product = (getV("product") || "").trim();
  line.mode = getV("mode") || "kg";
  line.qty = parseDec(getV("qty"));
  line.price = parseDec(getV("price"));

  line.bruto = parseDec(getV("bruto"));
  line.tara  = parseDec(getV("tara"));
  line.neto  = parseDec(getV("neto"));
  line.origin = (getV("origin") || "").trim();

  // si neto está vacío y hay bruto/tara => calcular neto
  if ((!line.neto || line.neto===0) && (line.bruto || line.tara)){
    const n = Math.max(0, (line.bruto||0) - (line.tara||0));
    line.neto = n;
    const netInp = row.querySelector('input[data-k="neto"]');
    if (netInp) netInp.value = toInput(line.neto);
  }

  // si modo=caja y hay catálogo con kg/caja, sugerir neto si vacío
  if (line.mode === "caja"){
    const p = findProductByName(line.product);
    if (p && p.kgBox && (!line.neto || line.neto===0)){
      line.neto = (line.qty||0) * Number(p.kgBox||0);
      const netInp = row.querySelector('input[data-k="neto"]');
      if (netInp) netInp.value = toInput(line.neto);
    }
  }

  // amount:
  // - kg: amount = neto*price si neto>0, si no neto => qty*price
  // - ud: amount = qty*price
  // - caja: amount = neto*price (neto kg total)
  let amount = 0;
  if (line.mode === "unidad"){
    amount = (line.qty||0) * (line.price||0);
  } else if (line.mode === "caja"){
    const base = (line.neto||0) > 0 ? (line.neto||0) : (line.qty||0);
    amount = base * (line.price||0);
  } else { // kg
    const base = (line.neto||0) > 0 ? (line.neto||0) : (line.qty||0);
    amount = base * (line.price||0);
  }
  line.amount = isFinite(amount) ? amount : 0;

  // update UI money
  const money = row.querySelector(".cell-amount.money");
  if (money) money.textContent = euro(line.amount);

  inv.updatedAt = nowMs();
  updateTotals(inv);

  if (!opts.silent){
    saveLocal();
  }
}

function addLine(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;
  inv.lines.push({ id: uuid("ln"), product:"", mode:"kg", qty:0, price:0, bruto:0, tara:0, neto:0, origin:"", amount:0 });
  inv.updatedAt = nowMs();
  saveLocal();
  renderLines(inv);
  updateTotals(inv);
}

/* -----------------------------
   Autocomplete (manual selection)
----------------------------- */
function findProductByName(name){
  const n = normalizeName(name||"");
  if (!n) return null;
  const prods = state.db.products || {};
  for (const k of Object.keys(prods)){
    const p = prods[k];
    if (normalizeName(p?.name||"") === n) return p;
  }
  return null;
}

function setupAutocomplete(inputEl, listEl, onPick){
  if (!inputEl || !listEl) return;

  let items = [];
  let active = -1;

  function close(){
    listEl.style.display = "none";
    listEl.innerHTML = "";
    active = -1;
  }

  function open(){
    if (!items.length) return close();
    listEl.style.display = "block";
  }

  function render(){
    listEl.innerHTML = items.map((txt, i)=>{
      return `<div class="ac-item ${i===active?"active":""}" data-i="${i}">${escapeHtml(txt)}</div>`;
    }).join("");
    open();
    [...listEl.querySelectorAll(".ac-item")].forEach(it=>{
      it.addEventListener("mousedown", (e)=>{
        e.preventDefault();
        const i = Number(it.dataset.i);
        const v = items[i];
        if (v) onPick(v);
        close();
      });
    });
  }

  function rebuild(q){
    const query = normalizeName(q);
    const vocab = state.vocab || [];
    if (!query){
      items = vocab.slice(0,20);
      active = -1;
      render();
      return;
    }
    const scored = [];
    for (const w of vocab){
      const wn = normalizeName(w);
      if (wn.includes(query)){
        // score: prefix better
        const score = wn.startsWith(query) ? 0 : 1;
        scored.push({ w, score });
      }
    }
    scored.sort((a,b)=> a.score-b.score || a.w.localeCompare(b.w));
    items = scored.slice(0,20).map(x=>x.w);
    active = -1;
    render();
  }

  inputEl.addEventListener("focus", ()=>{
    rebuild(inputEl.value || "");
  });

  inputEl.addEventListener("input", ()=>{
    rebuild(inputEl.value || "");
  });

  inputEl.addEventListener("keydown", (e)=>{
    if (listEl.style.display !== "block"){
      if (e.key === "ArrowDown") rebuild(inputEl.value||"");
      return;
    }

    if (e.key === "Escape"){
      close(); return;
    }
    if (e.key === "ArrowDown"){
      e.preventDefault();
      active = Math.min(items.length-1, active+1);
      render();
    }
    if (e.key === "ArrowUp"){
      e.preventDefault();
      active = Math.max(0, active-1);
      render();
    }
    if (e.key === "Enter"){
      if (active >= 0 && items[active]){
        e.preventDefault();
        onPick(items[active]);
        close();
      }
    }
  });

  // click fuera
  document.addEventListener("click", (e)=>{
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)){
      close();
    }
  });
}

/* -----------------------------
   Factura: guardar / duplicar / borrar
----------------------------- */
function saveInvoiceFromEditor(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;

  inv.clientId = el.invClient?.value || "";
  const c = inv.clientId ? getClientById(inv.clientId) : null;
  inv.clientNameCache = c ? (c.name || c.fiscalName || "") : "";

  inv.dateISO = el.invDate?.value || new Date().toISOString().slice(0,10);
  inv.number  = (el.invNumber?.value || "").trim();
  inv.tags    = (el.invTags?.value || "").trim();
  inv.notes   = (el.invNotes?.value || "").trim();

  inv.status  = "saved";
  inv.updatedAt = nowMs();

  // recalcular amounts por si acaso
  inv.lines = (inv.lines||[]).map(lineFix);
  inv.lines.forEach(l=>{
    // amount coherente
    const tmpRow = null;
    // recalculo simple:
    let amount = 0;
    if (l.mode === "unidad") amount = (l.qty||0)*(l.price||0);
    else if (l.mode === "caja"){
      const base = (l.neto||0)>0 ? l.neto : l.qty;
      amount = base*(l.price||0);
    } else {
      const base = (l.neto||0)>0 ? l.neto : l.qty;
      amount = base*(l.price||0);
    }
    l.amount = isFinite(amount)? amount : 0;
  });

  saveLocal();
  renderFacturas();
  loadInvoiceToEditor(inv.id, {silent:true});
}

function duplicateInvoice(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;
  const copy = deepClone(inv);
  copy.id = uuid("inv");
  copy.number = suggestInvoiceNumber();
  copy.status = "draft";
  copy.createdAt = nowMs();
  copy.updatedAt = nowMs();
  copy.pdfUrl = "";
  copy.pdfUpdatedAt = 0;
  copy.lines = (copy.lines||[]).map(l=>({ ...lineFix(l), id: uuid("ln") }));
  state.db.invoices.unshift(copy);
  state.currentInvoiceId = copy.id;
  saveLocal();
  renderFacturas();
  loadInvoiceToEditor(copy.id);
}

function deleteInvoice(){
  const id = state.currentInvoiceId;
  if (!id) return;
  state.db.invoices = (state.db.invoices||[]).filter(x=>x.id !== id);
  state.currentInvoiceId = (state.db.invoices[0]?.id || "");
  saveLocal();
  renderFacturas();
}

/* -----------------------------
   WhatsApp (resumen pro)
----------------------------- */
function invoiceToWhatsText(inv){
  const t = calcInvoiceTotals(inv);
  const c = inv.clientId ? getClientById(inv.clientId) : null;
  const header = `*${inv.number || "Factura"}*%0A${inv.dateISO || ""}%0ACliente: ${encodeURIComponent(c ? (c.name||c.fiscalName||"") : (inv.clientNameCache||""))}%0A`;
  const lines = (inv.lines||[]).map(l=>{
    const name = encodeURIComponent(l.product||"");
    const q = (l.mode==="unidad" ? `${l.qty||0} ud` : (l.mode==="caja" ? `${l.qty||0} caja` : `${(l.neto||0)>0? (l.neto||0):(l.qty||0)} kg`));
    const p = euro(l.price||0);
    const a = euro(l.amount||0);
    return `- ${name} (${encodeURIComponent(q)}) · ${encodeURIComponent(p)} · ${encodeURIComponent(a)}`;
  }).join("%0A");

  const totals = t.hideTax
    ? `%0A%0A*TOTAL:* ${encodeURIComponent(euro(t.total))}%0A(IVA incluido en precios)`
    : `%0A%0ASubtotal: ${encodeURIComponent(euro(t.subtotal))}%0AIVA: ${encodeURIComponent(euro(t.iva))}%0A*TOTAL:* ${encodeURIComponent(euro(t.total))}`;

  return header + lines + totals;
}

function openWhatsApp(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;
  const text = invoiceToWhatsText(inv);
  const url = `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

/* -----------------------------
   Export / Import JSON
----------------------------- */
function exportJSON(){
  const data = JSON.stringify(state.db, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ARSLAN_FACTURAS_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
}

async function importJSONFile(file){
  if (!file) return;
  const txt = await file.text();
  const incoming = safeJsonParse(txt, null);
  if (!incoming) return;
  state.db = mergeDB(state.db, incoming);
  saveLocal();
  state.vocab = buildVocab();
  renderClientSelects();
  renderFacturas();
  renderClientes();
  renderProductos();
  renderAjustes();
  renderCloudPill();
}

/* -----------------------------
   Ajustes (Proveedor + IVA + PIN + Firebase)
----------------------------- */
function renderAjustes(){
  const prov = state.db.provider || defaultProvider();
  const s = state.db.settings || defaultSettings();
  const fb = s.firebase || {};

  if (el.sProvName) el.sProvName.value = prov.name || "";
  if (el.sProvNif) el.sProvNif.value = prov.nif || "";
  if (el.sProvAddr) el.sProvAddr.value = prov.addr || "";
  if (el.sProvCity) el.sProvCity.value = prov.city || "";
  if (el.sProvPhone) el.sProvPhone.value = prov.phone || "";
  if (el.sProvEmail) el.sProvEmail.value = prov.email || "";
  if (el.sProvIban) el.sProvIban.value = prov.iban || "";
  if (el.sProvBic) el.sProvBic.value = prov.bic || "";

  if (el.sTaxRate) el.sTaxRate.value = toInput(s.taxRate ?? 0.04);
  if (el.sPrefix) el.sPrefix.value = s.prefix || "FA-";
  if (el.sPin) el.sPin.value = s.pin || "7392";
  if (el.sQrBase) el.sQrBase.value = s.qrBase || "";

  if (el.fbApiKey) el.fbApiKey.value = fb.apiKey || "";
  if (el.fbAuthDomain) el.fbAuthDomain.value = fb.authDomain || "";
  if (el.fbDbUrl) el.fbDbUrl.value = fb.databaseURL || "";
  if (el.fbProjectId) el.fbProjectId.value = fb.projectId || "";
  if (el.fbStorage) el.fbStorage.value = fb.storageBucket || "";
  if (el.fbAppId) el.fbAppId.value = fb.appId || "";
}

function saveAjustes(){
  state.db.provider = {
    name: (el.sProvName?.value||"").trim(),
    nif: (el.sProvNif?.value||"").trim(),
    addr: (el.sProvAddr?.value||"").trim(),
    city: (el.sProvCity?.value||"").trim(),
    phone: (el.sProvPhone?.value||"").trim(),
    email: (el.sProvEmail?.value||"").trim(),
    iban: (el.sProvIban?.value||"").trim(),
    bic: (el.sProvBic?.value||"").trim()
  };

  const taxRate = parseDec(el.sTaxRate?.value || "0.04");
  state.db.settings.taxRate = taxRate || 0.04;
  state.db.settings.prefix = (el.sPrefix?.value || "FA-").trim() || "FA-";
  state.db.settings.pin = (el.sPin?.value || "7392").trim() || "7392";
  state.db.settings.qrBase = (el.sQrBase?.value || "").trim();

  state.db.settings.firebase = {
    apiKey: (el.fbApiKey?.value||"").trim(),
    authDomain: (el.fbAuthDomain?.value||"").trim(),
    databaseURL: (el.fbDbUrl?.value||"").trim(),
    projectId: (el.fbProjectId?.value||"").trim(),
    storageBucket: (el.fbStorage?.value||"").trim(),
    appId: (el.fbAppId?.value||"").trim()
  };

  saveLocal();
  renderAjustes();
  renderCloudPill();
}

/* -----------------------------
   Events (sin nube todavía; nube/PDF/PIN en PARTE 2/2)
----------------------------- */
function wireEventsPart1(){
  // nav
  if (el.nav){
    [...el.nav.querySelectorAll(".nav-btn")].forEach(b=>{
      b.addEventListener("click", ()=> setView(b.dataset.view));
    });
  }

  // top actions
  el.btnExport?.addEventListener("click", exportJSON);
  el.fileImport?.addEventListener("change", (e)=> importJSONFile(e.target.files?.[0]));

  // facturas
  el.invSearch?.addEventListener("input", renderFacturas);
  el.btnClearSearch?.addEventListener("click", ()=>{ if (el.invSearch) el.invSearch.value=""; renderFacturas(); });

  el.btnNewInvoice?.addEventListener("click", newInvoice);
  el.btnDuplicateInvoice?.addEventListener("click", duplicateInvoice);
  el.btnDeleteInvoice?.addEventListener("click", deleteInvoice);

  el.btnSaveInvoice?.addEventListener("click", saveInvoiceFromEditor);
  el.btnAddLine?.addEventListener("click", addLine);

  el.invClient?.addEventListener("change", ()=>{
    const inv = getInvoiceById(state.currentInvoiceId);
    if (!inv) return;
    inv.clientId = el.invClient.value || "";
    const c = inv.clientId ? getClientById(inv.clientId) : null;
    inv.clientNameCache = c ? (c.name||c.fiscalName||"") : "";
    if (el.clientInfo) el.clientInfo.textContent = c ? `${c.nif||"—"} · ${c.addr||"—"}` : "—";
    inv.updatedAt = nowMs();
    saveLocal();
    renderFacturas();
    updateTotals(inv);
  });

  // editor fields auto-save soft (no molestar)
  [el.invDate, el.invNumber, el.invTags, el.invNotes].forEach(inp=>{
    inp?.addEventListener("change", ()=> {
      const inv = getInvoiceById(state.currentInvoiceId);
      if (!inv) return;
      inv.dateISO = el.invDate?.value || inv.dateISO;
      inv.number  = (el.invNumber?.value || inv.number || "").trim();
      inv.tags    = (el.invTags?.value || inv.tags || "").trim();
      inv.notes   = (el.invNotes?.value || inv.notes || "").trim();
      inv.updatedAt = nowMs();
      saveLocal();
      renderFacturas();
    });
  });

  el.btnWhatsApp?.addEventListener("click", openWhatsApp);

  // clientes
  el.clientSearch?.addEventListener("input", renderClientes);
  el.btnNewClient?.addEventListener("click", ()=>{
    state.currentClientId = "";
    if (el.cName) el.cName.value = "";
    if (el.cNif) el.cNif.value = "";
    if (el.cAddr) el.cAddr.value = "";
    if (el.cPhone) el.cPhone.value = "";
    if (el.cEmail) el.cEmail.value = "";
    if (el.cTags) el.cTags.value = "";
    if (el.clientTitle) el.clientTitle.textContent = "Nuevo cliente";
    if (el.clientId) el.clientId.textContent = "—";
  });
  el.btnSaveClient?.addEventListener("click", saveClientFromForm);
  el.btnDeleteClient?.addEventListener("click", deleteClient);

  // productos
  el.prodSearch?.addEventListener("input", renderProductos);
  el.btnNewProduct?.addEventListener("click", ()=>{
    state.currentProductKey = "";
    loadProductToForm("");
    if (el.prodTitle) el.prodTitle.textContent = "Nuevo producto";
    if (el.prodKey) el.prodKey.textContent = "—";
  });
  el.btnSaveProduct?.addEventListener("click", saveProductFromForm);
  el.btnDeleteProduct?.addEventListener("click", deleteProduct);

  // ajustes
  el.btnSaveSettings?.addEventListener("click", saveAjustes);

  // botones PDF y nube: se conectan en PARTE 2 (para evitar errores)
}

/* -----------------------------
   Boot (PARTE 2/2 termina el init y añade Nube+PDF+PIN+Contabilidad)
----------------------------- */
function initPart1(){
  // vocab
  state.vocab = buildVocab();

  // selects
  renderClientSelects();

  // si no hay facturas, crear una
  if ((state.db.invoices||[]).length === 0){
    newInvoice();
  } else {
    state.currentInvoiceId = state.db.invoices[0]?.id || "";
  }

  // render inicial
  renderCloudPill();
  setView("facturas");

  wireEventsPart1();
}

// ⚠️ NO llamamos a initPart1 aquí.
// La llamada final está en PARTE 2/2 para que el archivo quede completo.
/* =========================================================
   APP.JS (PARTE 2/2)
   - PDF PRO (jsPDF + AutoTable)
   - QR AEAT (opcional)
   - Firebase opcional (Auth + Realtime DB + Storage)
   - Guardar PDFs en nube + ver/copy link
   - Contabilidad + PIN (bloqueo real)
   - Final init (llama initPart1)
========================================================= */

/* -----------------------------
   Contabilidad (PIN gate)
----------------------------- */
function isAccUnlocked(){
  if (state.accUnlocked) return true;
  try { return sessionStorage.getItem(`${APP_KEY}_accUnlocked`) === "1"; } catch { return false; }
}

function setAccUnlocked(v){
  state.accUnlocked = !!v;
  try { sessionStorage.setItem(`${APP_KEY}_accUnlocked`, v ? "1" : "0"); } catch {}
}

function showPinModal(show){
  if (!el.pinModal) return;
  el.pinModal.style.display = show ? "flex" : "none";
  if (show){
    if (el.pinInput) el.pinInput.value = "";
    if (el.pinMsg) el.pinMsg.textContent = "—";
    setTimeout(()=> el.pinInput?.focus(), 50);
  }
}

function renderContabilidadGate(){
  // Actualiza estado y controles
  const ok = isAccUnlocked();
  if (el.accStatus) el.accStatus.textContent = ok ? "Desbloqueado" : "Bloqueado";
  // No ocultamos la vista (ya está en HTML) pero bloqueamos interacción y mostramos mensaje
  const disabled = !ok;

  [el.accFrom, el.accTo, el.accClient, el.accTag].forEach(x=>{
    if (x) x.disabled = disabled;
  });
  if (el.btnAccRun) el.btnAccRun.disabled = disabled;

  // KPIs a 0 si bloqueado
  if (!ok){
    if (el.accSales) el.accSales.textContent = euro(0);
    if (el.accIva) el.accIva.textContent = euro(0);
    if (el.accN) el.accN.textContent = "0";
    if (el.accMargin) el.accMargin.textContent = euro(0);
    if (el.accTable){
      const tb = el.accTable.querySelector("tbody");
      if (tb) tb.innerHTML = `<tr><td colspan="5" class="muted">Contabilidad bloqueada. Pulsa “Desbloquear”.</td></tr>`;
    }
    return;
  }

  // Si está desbloqueado, precarga fechas si vacías
  const today = new Date().toISOString().slice(0,10);
  if (el.accFrom && !el.accFrom.value) el.accFrom.value = today.slice(0,8) + "01";
  if (el.accTo && !el.accTo.value) el.accTo.value = today;

  // Render tabla inicial (vacía hasta calcular)
  if (el.accTable){
    const tb = el.accTable.querySelector("tbody");
    if (tb && !tb.dataset.init){
      tb.dataset.init = "1";
      tb.innerHTML = `<tr><td colspan="5" class="muted">Pulsa “Calcular” para ver el resumen.</td></tr>`;
    }
  }
}

function runContabilidad(){
  if (!isAccUnlocked()){
    renderContabilidadGate();
    return;
  }

  const from = el.accFrom?.value || "0000-01-01";
  const to = el.accTo?.value || "9999-12-31";
  const cli = el.accClient?.value || "";
  const tag = normalizeName(el.accTag?.value || "");

  const invs = (state.db.invoices || []).filter(inv=>{
    const d = inv.dateISO || "";
    if (d < from || d > to) return false;
    if (cli && inv.clientId !== cli) return false;
    if (tag){
      const t = normalizeName(inv.tags || "");
      if (!t.includes(tag)) return false;
    }
    return true;
  });

  let sales = 0;
  let iva = 0;
  let margin = 0;

  for (const inv of invs){
    const tot = calcInvoiceTotals(inv);
    sales += tot.total;
    iva += tot.hideTax ? 0 : tot.iva;

    // margen estimado por costes de catálogo
    const lines = inv.lines || [];
    for (const l of lines){
      const p = findProductByName(l.product || "");
      const cost = p ? Number(p.cost || 0) : 0;
      if (!cost) continue;

      let baseQty = 0;
      if (l.mode === "unidad"){
        baseQty = Number(l.qty || 0);
      } else if (l.mode === "caja"){
        baseQty = (Number(l.neto || 0) > 0) ? Number(l.neto || 0) : Number(l.qty || 0);
      } else {
        baseQty = (Number(l.neto || 0) > 0) ? Number(l.neto || 0) : Number(l.qty || 0);
      }

      const costAmount = baseQty * cost;
      margin += (Number(l.amount || 0) - costAmount);
    }
  }

  if (el.accSales) el.accSales.textContent = euro(sales);
  if (el.accIva) el.accIva.textContent = euro(iva);
  if (el.accN) el.accN.textContent = String(invs.length);
  if (el.accMargin) el.accMargin.textContent = euro(margin);

  // Tabla detalle
  if (el.accTable){
    const tb = el.accTable.querySelector("tbody");
    if (tb){
      if (invs.length === 0){
        tb.innerHTML = `<tr><td colspan="5" class="muted">Sin resultados en el rango.</td></tr>`;
      } else {
        tb.innerHTML = invs.map(inv=>{
          const t = calcInvoiceTotals(inv);
          const cliName = inv.clientNameCache || (getClientById(inv.clientId)?.name || "");
          return `
            <tr>
              <td>${escapeHtml(inv.dateISO||"")}</td>
              <td>${escapeHtml(inv.number||"")}</td>
              <td>${escapeHtml(cliName||"—")}</td>
              <td><strong>${escapeHtml(euro(t.total))}</strong></td>
              <td>${escapeHtml(inv.tags||"")}</td>
            </tr>
          `;
        }).join("");
      }
    }
  }
}

function handleUnlock(){
  showPinModal(true);
}

function handleLock(){
  setAccUnlocked(false);
  renderContabilidadGate();
}

function checkPinAndUnlock(){
  const pin = (el.pinInput?.value || "").trim();
  const real = (state.db.settings?.pin || "7392").trim();
  if (pin && pin === real){
    setAccUnlocked(true);
    if (el.pinMsg) el.pinMsg.textContent = "✅ Desbloqueado";
    setTimeout(()=> showPinModal(false), 150);
    renderContabilidadGate();
    return;
  }
  if (el.pinMsg) el.pinMsg.textContent = "❌ PIN incorrecto";
}

/* -----------------------------
   PDF PRO + QR AEAT (opcional)
----------------------------- */
const localPdfCache = new Map(); // invId -> objectURL

function buildAeatQrText(inv, total){
  const prov = state.db.provider || defaultProvider();
  const base = (state.db.settings?.qrBase || "").trim() ||
    "AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}";

  return base
    .replaceAll("{NIF}", prov.nif || "")
    .replaceAll("{NUM}", inv.number || "")
    .replaceAll("{FECHA}", inv.dateISO || "")
    .replaceAll("{TOTAL}", (Number(total||0)).toFixed(2));
}

function tryMakeQRDataUrl(text){
  try{
    if (!window.QRCode) return null;
    const tmp = document.createElement("div");
    tmp.style.position = "fixed";
    tmp.style.left = "-9999px";
    tmp.style.top = "-9999px";
    document.body.appendChild(tmp);

    // qrcodejs genera canvas dentro
    // eslint-disable-next-line no-new
    new window.QRCode(tmp, { text, width: 120, height: 120, correctLevel: window.QRCode.CorrectLevel?.M || 0 });

    const canvas = tmp.querySelector("canvas");
    const img = tmp.querySelector("img");
    let dataUrl = null;
    if (canvas) dataUrl = canvas.toDataURL("image/png");
    else if (img && img.src) dataUrl = img.src;

    tmp.remove();
    return dataUrl;
  } catch {
    return null;
  }
}

function ensureJsPDF(){
  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) return null;
  return jspdf.jsPDF;
}

function buildInvoicePdf(inv){
  const jsPDF = ensureJsPDF();
  if (!jsPDF){
    if (el.pdfState) el.pdfState.textContent = "❌ No cargó jsPDF. Revisa conexión/CDN.";
    return null;
  }

  const prov = state.db.provider || defaultProvider();
  const c = inv.clientId ? getClientById(inv.clientId) : null;

  const totals = calcInvoiceTotals(inv);
  const taxRate = Number(state.db.settings?.taxRate || 0.04);

  const doc = new jsPDF({ unit:"mm", format:"a4" });

  // Layout constants
  const margin = 12;
  let y = 12;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURA", margin, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text(`Nº: ${inv.number || ""}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${inv.dateISO || ""}`, margin + 90, y);
  y += 6;

  // Provider / Client blocks
  doc.setDrawColor(232,232,232);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, 90, 32, 2, 2);
  doc.roundedRect(margin + 94, y, 90, 32, 2, 2);

  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text("Proveedor", margin + 3, y + 6);
  doc.text("Cliente", margin + 97, y + 6);

  doc.setFont("helvetica","normal");
  doc.setFontSize(9);

  const provLines = [
    prov.name || "",
    prov.nif ? `NIF: ${prov.nif}` : "",
    prov.addr || "",
    prov.city || "",
    prov.phone ? `Tel: ${prov.phone}` : "",
    prov.email ? `Email: ${prov.email}` : "",
  ].filter(Boolean);

  const cliTitle = (c?.fiscalName || c?.name || inv.clientNameCache || "");
  const cliLines = [
    cliTitle,
    c?.nif ? `NIF/CIF: ${c.nif}` : "",
    c?.addr || "",
    c?.phone ? `Tel: ${c.phone}` : "",
    c?.email ? `Email: ${c.email}` : "",
  ].filter(Boolean);

  let py = y + 11;
  for (const line of provLines){
    doc.text(line, margin + 3, py);
    py += 4.2;
  }

  let cy = y + 11;
  for (const line of cliLines){
    doc.text(line, margin + 97, cy);
    cy += 4.2;
  }

  y += 40;

  // Tags / Notes (si hay)
  const tags = (inv.tags || "").trim();
  const notes = (inv.notes || "").trim();
  if (tags || notes){
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.text("Tags:", margin, y);
    doc.setFont("helvetica","normal");
    doc.text(tags || "—", margin + 12, y);
    y += 5;

    doc.setFont("helvetica","bold");
    doc.text("Notas:", margin, y);
    doc.setFont("helvetica","normal");
    doc.text(notes || "—", margin + 12, y);
    y += 7;
  }

  // Table data
  const head = [[
    "#","Producto","Modo","Cant","Bruto","Tara","Neto","Precio","Importe","Origen"
  ]];

  const body = (inv.lines || []).map((l, i)=>{
    const mode = l.mode || "kg";
    let qtyLabel = "";
    if (mode === "unidad") qtyLabel = `${Number(l.qty||0)} ud`;
    else if (mode === "caja") qtyLabel = `${Number(l.qty||0)} caja`;
    else qtyLabel = `${(Number(l.neto||0)>0 ? Number(l.neto||0) : Number(l.qty||0))} kg`;

    return [
      String(i+1),
      l.product || "",
      mode === "unidad" ? "ud" : (mode === "caja" ? "caja" : "kg"),
      qtyLabel,
      (Number(l.bruto||0) ? String(Number(l.bruto||0)) : ""),
      (Number(l.tara||0) ? String(Number(l.tara||0)) : ""),
      (Number(l.neto||0) ? String(Number(l.neto||0)) : ""),
      euro(Number(l.price||0)),
      euro(Number(l.amount||0)),
      l.origin || ""
    ];
  });

  const qrText = buildAeatQrText(inv, totals.total);
  const qrDataUrl = tryMakeQRDataUrl(qrText);

  const pageFooter = (data)=>{
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(9);
    doc.setFont("helvetica","normal");
    const str = `Página ${data.pageNumber} / ${pageCount}`;
    doc.text(str, 200 - margin, 292, { align:"right" });

    // nota impuestos
    doc.setFontSize(8);
    const taxNote = totals.hideTax
      ? "IVA incluido en los precios (sin desglose)."
      : `IVA aplicado: ${(taxRate*100).toFixed(0)}% (desglosado).`;
    doc.text(taxNote, margin, 292);
  };

  // AutoTable
  doc.autoTable({
    head,
    body,
    startY: y,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      lineWidth: 0.1
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [245,245,245],
      textColor: [17,17,17],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 6 },
      1: { cellWidth: 44 },
      2: { cellWidth: 10 },
      3: { cellWidth: 18 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 18 },
      8: { cellWidth: 18 },
      9: { cellWidth: 20 }
    },
    didDrawPage: pageFooter
  });

  // Totals box after table
  let y2 = doc.lastAutoTable.finalY + 6;
  if (y2 > 250){
    doc.addPage();
    y2 = 20;
  }

  doc.setDrawColor(232,232,232);
  doc.roundedRect(120, y2, 78, totals.hideTax ? 20 : 28, 2, 2);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  doc.text("Subtotal:", 123, y2 + 7);
  doc.setFont("helvetica","bold");
  doc.text(euro(totals.subtotal), 196, y2 + 7, {align:"right"});

  if (!totals.hideTax){
    doc.setFont("helvetica","normal");
    doc.text("IVA:", 123, y2 + 13);
    doc.setFont("helvetica","bold");
    doc.text(euro(totals.iva), 196, y2 + 13, {align:"right"});
  }

  doc.setFont("helvetica","normal");
  doc.text("TOTAL:", 123, y2 + (totals.hideTax ? 13 : 19));
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text(euro(totals.total), 196, y2 + (totals.hideTax ? 13 : 19), {align:"right"});

  // QR AEAT
  if (qrDataUrl){
    const qrX = margin;
    const qrY = y2;
    doc.setFontSize(9);
    doc.setFont("helvetica","bold");
    doc.text("QR AEAT", qrX, qrY - 2);
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, 28, 28);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    const qrMini = qrText.length > 90 ? qrText.slice(0,90) + "…" : qrText;
    doc.text(qrMini, qrX + 32, qrY + 6);
  }

  return doc;
}

function openBlobPdf(blob){
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // no revocamos inmediato para que cargue; se limpia en cache
  return url;
}

function updatePdfUi(inv){
  if (!inv) return;
  if (el.pdfState) el.pdfState.textContent = inv.pdfUrl ? "PDF guardado ✔ (nube)" : "PDF —";
  if (el.btnOpenPdf) el.btnOpenPdf.disabled = !(inv.pdfUrl || localPdfCache.has(inv.id));
  if (el.btnCopyPdf) el.btnCopyPdf.disabled = !inv.pdfUrl;
}

function generatePdfLocal({open=true} = {}){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;

  // guardar primero datos del editor
  saveInvoiceFromEditor();

  const doc = buildInvoicePdf(inv);
  if (!doc) return;

  const blob = doc.output("blob");

  // cache local URL
  if (localPdfCache.has(inv.id)){
    try { URL.revokeObjectURL(localPdfCache.get(inv.id)); } catch {}
    localPdfCache.delete(inv.id);
  }
  const url = URL.createObjectURL(blob);
  localPdfCache.set(inv.id, url);

  if (el.pdfState) el.pdfState.textContent = "PDF generado (local) ✔";
  if (el.btnOpenPdf) el.btnOpenPdf.disabled = false;

  if (open){
    window.open(url, "_blank");
  }
}

function openPdfAction(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;

  if (inv.pdfUrl){
    window.open(inv.pdfUrl, "_blank");
    return;
  }

  const local = localPdfCache.get(inv.id);
  if (local){
    window.open(local, "_blank");
    return;
  }

  // si no hay nada, generar
  generatePdfLocal({open:true});
}

async function copyPdfLink(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv || !inv.pdfUrl) return;
  try{
    await navigator.clipboard.writeText(inv.pdfUrl);
    if (el.pdfState) el.pdfState.textContent = "✅ Link copiado";
  } catch {
    if (el.pdfState) el.pdfState.textContent = "❌ No se pudo copiar (permiso)";
  }
}

/* -----------------------------
   Firebase (opcional) + Sync + PDF Storage
----------------------------- */
let FB = null;

function firebaseConfigOk(cfg){
  if (!cfg) return false;
  const need = ["apiKey","authDomain","databaseURL","projectId","appId"];
  return need.every(k => String(cfg[k]||"").trim().length > 0);
}

async function loadFirebase(){
  const cfg = state.db.settings?.firebase || {};
  if (!firebaseConfigOk(cfg)){
    state.cloud.enabled = false;
    state.cloud.ready = false;
    renderCloudPill();
    return null;
  }

  try{
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const {
      getAuth, onAuthStateChanged,
      signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
    } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

    const { getDatabase, ref, get, set } =
      await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");

    const { getStorage, ref: sRef, uploadBytes, getDownloadURL } =
      await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js");

    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getDatabase(app);
    const storage = getStorage(app);

    FB = { app, auth, db, storage, ref, get, set, sRef, uploadBytes, getDownloadURL,
           onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };

    state.cloud.enabled = true;
    state.cloud.ready = true;

    FB.onAuthStateChanged(FB.auth, (user)=>{
      state.cloud.user = user || null;
      renderCloudPill();
      // si entra, activamos acciones de nube
      if (user){
        if (el.loginMsg) el.loginMsg.textContent = "✅ Sesión iniciada";
      }
      // actualiza UI pdf
      const inv = getInvoiceById(state.currentInvoiceId);
      if (inv) updatePdfUi(inv);
    });

    renderCloudPill();
    return FB;
  } catch (e){
    console.error("Firebase load error:", e);
    state.cloud.enabled = false;
    state.cloud.ready = false;
    if (el.loginMsg) el.loginMsg.textContent = "❌ No se pudo cargar Firebase (CDN/bloqueo)";
    renderCloudPill();
    return null;
  }
}

function cloudDataPath(uid){
  return `${APP_NS}/users/${uid}/data`;
}

function sanitizeSettingsForCloud(settings){
  const s = deepClone(settings || defaultSettings());
  // guardamos todo menos config firebase (opcional, puedes cambiarlo si quieres)
  delete s.firebase;
  return s;
}

function buildCloudPayloadFromLocal(){
  const db = state.db || defaultDB();
  return {
    version: db.version || VERSION,
    updatedAt: nowMs(),
    provider: db.provider || defaultProvider(),
    settings: sanitizeSettingsForCloud(db.settings || defaultSettings()),
    clients: db.clients || [],
    products: db.products || {},
    invoices: db.invoices || []
  };
}

async function cloudPull(){
  if (!FB || !state.cloud.user) return null;
  const uid = state.cloud.user.uid;
  const path = cloudDataPath(uid);
  const snap = await FB.get(FB.ref(FB.db, path));
  if (!snap.exists()) return null;
  return snap.val();
}

async function cloudPush(payload){
  if (!FB || !state.cloud.user) return;
  const uid = state.cloud.user.uid;
  const path = cloudDataPath(uid);
  await FB.set(FB.ref(FB.db, path), payload);
}

async function syncNow(){
  if (!FB || !state.cloud.user){
    if (el.pdfState) el.pdfState.textContent = "❌ No estás logueado en nube";
    return;
  }

  try{
    if (el.pdfState) el.pdfState.textContent = "⏳ Sincronizando...";
    const cloud = await cloudPull();

    if (!cloud){
      // nube vacía => subir local
      await cloudPush(buildCloudPayloadFromLocal());
      if (el.pdfState) el.pdfState.textContent = "✅ Nube inicializada con datos locales";
      return;
    }

    // merge bidireccional
    const merged = mergeDB(state.db, cloud);
    state.db = merged;
    saveLocal();

    // push merged
    await cloudPush(buildCloudPayloadFromLocal());

    // refresh UI
    state.vocab = buildVocab();
    renderClientSelects();
    renderFacturas();
    renderClientes();
    renderProductos();
    renderAjustes();

    if (el.pdfState) el.pdfState.textContent = "✅ Sincronizado (merge inteligente)";
  } catch (e){
    console.error("sync error:", e);
    if (el.pdfState) el.pdfState.textContent = "❌ Error en sync (ver consola)";
  }
}

async function uploadPdfToCloud(inv, blob){
  if (!FB || !state.cloud.user){
    throw new Error("NO_AUTH");
  }
  const cfg = state.db.settings?.firebase || {};
  if (!String(cfg.storageBucket||"").trim()){
    // Storage opcional, pero si no hay bucket no se puede subir
    throw new Error("NO_STORAGE_BUCKET");
  }

  const uid = state.cloud.user.uid;
  const path = `${APP_NS}/users/${uid}/pdfs/${inv.id}.pdf`;
  const refPdf = FB.sRef(FB.storage, path);

  await FB.uploadBytes(refPdf, blob, { contentType:"application/pdf" });
  const url = await FB.getDownloadURL(refPdf);
  return url;
}

async function generatePdfAndUpload(){
  const inv = getInvoiceById(state.currentInvoiceId);
  if (!inv) return;

  // guarda estado
  saveInvoiceFromEditor();

  const doc = buildInvoicePdf(inv);
  if (!doc) return;

  const blob = doc.output("blob");

  if (!FB || !state.cloud.user){
    if (el.pdfState) el.pdfState.textContent = "❌ Entra en nube para guardar PDF";
    // aun así lo generamos local
    generatePdfLocal({open:true});
    return;
  }

  try{
    if (el.pdfState) el.pdfState.textContent = "⏳ Subiendo PDF a nube...";
    const url = await uploadPdfToCloud(inv, blob);

    // guardar url en invoice local
    inv.pdfUrl = url;
    inv.pdfUpdatedAt = nowMs();
    inv.updatedAt = nowMs();
    saveLocal();

    // push data (sincroniza rápido el link)
    await cloudPush(buildCloudPayloadFromLocal());

    // cache local url (por si)
    if (localPdfCache.has(inv.id)){
      try { URL.revokeObjectURL(localPdfCache.get(inv.id)); } catch {}
      localPdfCache.delete(inv.id);
    }
    localPdfCache.set(inv.id, URL.createObjectURL(blob));

    updatePdfUi(inv);
    if (el.pdfState) el.pdfState.textContent = "✅ PDF guardado en nube ✔";
  } catch (e){
    console.error("PDF upload error:", e);
    const msg = (String(e?.message||"") === "NO_STORAGE_BUCKET")
      ? "❌ Falta storageBucket en Firebase (Ajustes)"
      : "❌ Error subiendo PDF (ver consola)";
    if (el.pdfState) el.pdfState.textContent = msg;
    // fallback local
    generatePdfLocal({open:true});
  }
}

/* -----------------------------
   Login modal (Firebase)
----------------------------- */
function showLoginModal(show){
  if (!el.loginModal) return;
  el.loginModal.style.display = show ? "flex" : "none";
  if (show){
    if (el.loginMsg) el.loginMsg.textContent = state.cloud.enabled ? "—" : "⚠️ Firebase no configurado (Ajustes)";
    setTimeout(()=> el.loginEmail?.focus(), 50);
  }
}

async function doLogin(){
  if (!FB){
    if (el.loginMsg) el.loginMsg.textContent = "❌ Firebase no disponible (config/CDN)";
    return;
  }
  const email = (el.loginEmail?.value || "").trim();
  const pass  = (el.loginPass?.value || "").trim();
  if (!email || !pass){
    if (el.loginMsg) el.loginMsg.textContent = "❌ Falta email o password";
    return;
  }
  try{
    if (el.loginMsg) el.loginMsg.textContent = "⏳ Entrando...";
    await FB.signInWithEmailAndPassword(FB.auth, email, pass);
    if (el.loginMsg) el.loginMsg.textContent = "✅ OK";
    showLoginModal(false);
  } catch (e){
    console.error(e);
    if (el.loginMsg) el.loginMsg.textContent = "❌ Login incorrecto / permiso";
  }
}

async function doSignup(){
  if (!FB){
    if (el.loginMsg) el.loginMsg.textContent = "❌ Firebase no disponible (config/CDN)";
    return;
  }
  const email = (el.loginEmail?.value || "").trim();
  const pass  = (el.loginPass?.value || "").trim();
  if (!email || !pass){
    if (el.loginMsg) el.loginMsg.textContent = "❌ Falta email o password";
    return;
  }
  try{
    if (el.loginMsg) el.loginMsg.textContent = "⏳ Creando cuenta...";
    await FB.createUserWithEmailAndPassword(FB.auth, email, pass);
    if (el.loginMsg) el.loginMsg.textContent = "✅ Cuenta creada";
    showLoginModal(false);
  } catch (e){
    console.error(e);
    if (el.loginMsg) el.loginMsg.textContent = "❌ No se pudo crear (password débil / email existe)";
  }
}

async function doLogout(){
  if (!FB || !state.cloud.user) return;
  try{
    await FB.signOut(FB.auth);
    state.cloud.user = null;
    renderCloudPill();
    if (el.pdfState) el.pdfState.textContent = "Modo local";
  } catch (e){
    console.error(e);
  }
}

/* -----------------------------
   Wire events (PARTE 2)
----------------------------- */
function wireEventsPart2(){
  // Cloud buttons
  el.btnLogin?.addEventListener("click", ()=> showLoginModal(true));
  el.btnLoginClose?.addEventListener("click", ()=> showLoginModal(false));
  el.btnLoginDo?.addEventListener("click", doLogin);
  el.btnSignupDo?.addEventListener("click", doSignup);
  el.btnLogout?.addEventListener("click", doLogout);
  el.btnSync?.addEventListener("click", syncNow);

  // PDF
  el.btnPDF?.addEventListener("click", ()=> generatePdfLocal({open:true}));
  el.btnPDFUpload?.addEventListener("click", generatePdfAndUpload);
  el.btnOpenPdf?.addEventListener("click", openPdfAction);
  el.btnCopyPdf?.addEventListener("click", copyPdfLink);

  // PIN
  el.btnUnlock?.addEventListener("click", handleUnlock);
  el.btnLock?.addEventListener("click", handleLock);
  el.btnPinCancel?.addEventListener("click", ()=> showPinModal(false));
  el.btnPinOk?.addEventListener("click", checkPinAndUnlock);

  // Calcular contabilidad
  el.btnAccRun?.addEventListener("click", runContabilidad);

  // Cerrar modales click fuera
  el.loginModal?.addEventListener("click", (e)=>{
    if (e.target === el.loginModal) showLoginModal(false);
  });
  el.pinModal?.addEventListener("click", (e)=>{
    if (e.target === el.pinModal) showPinModal(false);
  });

  // Enter en PIN/login
  el.pinInput?.addEventListener("keydown", (e)=>{ if (e.key==="Enter") checkPinAndUnlock(); });
  el.loginPass?.addEventListener("keydown", (e)=>{ if (e.key==="Enter") doLogin(); });
}

/* -----------------------------
   Patch UI updates on invoice change
----------------------------- */
const _oldLoadInvoiceToEditor = loadInvoiceToEditor;
loadInvoiceToEditor = function(id, opts={}){
  _oldLoadInvoiceToEditor(id, opts);
  const inv = getInvoiceById(id);
  if (inv) updatePdfUi(inv);
};

/* -----------------------------
   Final init
----------------------------- */
async function initPart2(){
  // 1) inicia todo lo offline/UI base
  initPart1();

  // 2) wire extra listeners
  wireEventsPart2();

  // 3) contabilidad gate initial
  renderContabilidadGate();

  // 4) intenta cargar firebase (si config existe)
  await loadFirebase();

  // 5) refresca estado PDF
  const inv = getInvoiceById(state.currentInvoiceId);
  if (inv) updatePdfUi(inv);
}

initPart2();
