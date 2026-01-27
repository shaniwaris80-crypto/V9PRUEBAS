/* =========================================================
   ARSLAN • FACTURAS — KIWI Edition (PRO B/W)
   app.js — REHECHO COMPLETO
   PARTE 1/2

   ✅ Offline-first (LocalStorage)
   ✅ Facturas (grid pro 1 línea, 5 filas por defecto, + añadir)
   ✅ Proveedor izq + QR centro + Cliente der
   ✅ Clientes CRUD
   ✅ Productos CRUD + Historial (últimas 5) SOLO pantalla
   ✅ Import/Export JSON
   ✅ Import precios por link (desde prices.html ?prices= / #prices=)
   ✅ Crear pack de precios (abre prices.html con ?pack=)
   ✅ Contabilidad (PIN) - bloque real
   ✅ Ajustes (IVA, QR template, Logo SVG, Firebase config)

   ⏭️ PARTE 2/2 añade:
   - PDF PRO (logo + tabla + QR + totales)
   - Cloud Firebase opcional (login, sync, merge, pdfUrl)
========================================================= */

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

/* =========================
   Storage keys
========================= */
const LS_KEY = "arslan_kiwi_facturas_v3_db";
const LS_ACC_UNLOCK = "arslan_kiwi_facturas_v3_acc_unlocked";

/* =========================
   Defaults (Proveedor + Clientes conocidos)
========================= */
const DEFAULT_PROVIDER = {
  name: "Mohammad Arslan Waris",
  nif: "X6389988J",
  addr: "Calle San Pablo 17, Burgos",
  phone: "631667893",
  email: "shaniwaris80@gmail.com"
};

const DEFAULT_CLIENTS = [
  {
    id: "cli_golden_garden",
    name: "David Herrera Estalayo",
    nif: "71281665L",
    addr: "Trinidad, 12, 09003, Burgos",
    phone: "",
    email: "",
    alias: "GOLDEN GARDEN",
    notes: "IVA incluido en precios (sin desglose)"
  },
  {
    id: "cli_cons_sentidos",
    name: "Cuevas Palacios Restauración S.L.",
    nif: "B10694792",
    addr: "C/ San Lesmes, 1 - 09004 Burgos",
    phone: "947203551",
    email: "",
    alias: "CON/SENTIDOS",
    notes: ""
  },
  {
    id: "cli_alpanpan",
    name: "Al Pan Pan Burgos, S.L.",
    nif: "B09569344",
    addr: "C/ Miranda, 17 Bajo, 09002 Burgos",
    phone: "947277977",
    email: "bertiz.miranda@gmail.com",
    alias: "AL PAN PAN",
    notes: ""
  },
  {
    id: "cli_alesalpan",
    name: "Alesal Pan y Café S.L",
    nif: "B09582420",
    addr: "Calle San Lesmes 1",
    phone: "",
    email: "",
    alias: "ALESAL PAN / CAFÉ DE CALLE SAN LESMES",
    notes: ""
  },
  {
    id: "cli_riviera",
    name: "CONOR ESY SLU",
    nif: "B16794893",
    addr: "Paseo del Espolón, 09003 Burgos",
    phone: "",
    email: "",
    alias: "RIVIERA",
    notes: ""
  },
  {
    id: "cli_nuovo",
    name: "CAFE BAR NUOVO",
    nif: "120221393",
    addr: "C/ San Juan de Ortega 14, 09007 Burgos",
    phone: "",
    email: "",
    alias: "NUOVO",
    notes: ""
  }
];

/* =========================
   Vocabulario (Productos)
   (lista tuya — se normaliza a MAYÚSCULAS)
========================= */
const DEFAULT_VOCAB_TEXT = `
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

/* =========================
   Helpers
========================= */
function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
function norm(s){
  return (s||"").toString().trim().replace(/\s+/g," ").toUpperCase();
}
function safeJSONParse(s){
  try{ return JSON.parse(s); }catch(e){ return null; }
}
function n2(x){
  const t = (x ?? "").toString().replace(",", ".").trim();
  if(t === "") return 0;
  const v = Number(t);
  return Number.isFinite(v) ? v : 0;
}
function moneyEUR(n){
  const x = Number(n);
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}
function clamp2(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function timeStamp(){
  const d = new Date();
  return d.toISOString();
}
function setMini(id, txt){
  const el = $(id);
  if(el) el.textContent = txt;
}
function showModal(el){
  if(!el) return;
  el.classList.add("show");
  el.setAttribute("aria-hidden","false");
}
function hideModal(el){
  if(!el) return;
  el.classList.remove("show");
  el.setAttribute("aria-hidden","true");
}
function lzDecompressParam(param){
  if(!param) return null;
  try{
    const json = window.LZString?.decompressFromEncodedURIComponent(param);
    if(!json) return null;
    return safeJSONParse(json);
  }catch(e){ return null; }
}
function lzCompress(obj){
  const json = JSON.stringify(obj);
  return window.LZString?.compressToEncodedURIComponent(json) || "";
}

/* =========================
   DB model
========================= */
function defaultSettings(){
  return {
    taxRate: 0.04,
    qrTemplate: "AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}",
    logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 240 60">
  <rect x="2" y="2" width="56" height="56" rx="14" fill="#0b0d10"/>
  <text x="80" y="40" font-family="Poppins, Arial" font-size="28" font-weight="800" fill="#0b0d10">ARSLAN</text>
</svg>`,
    adminPin: "7392",
    firebase: {
      apiKey:"",
      authDomain:"",
      databaseURL:"",
      projectId:"",
      appId:"",
      storageBucket:""
    }
  };
}

function defaultDB(){
  return {
    meta: { version: 3, createdAt: timeStamp(), updatedAt: timeStamp() },
    provider: { ...DEFAULT_PROVIDER },
    clients: [...DEFAULT_CLIENTS],
    products: [], // [{id,name,unitDefault,kgBox,priceKg,priceBox,priceUnit,cost,origin,history:[]}]
    invoices: [], // newest first
    settings: defaultSettings()
  };
}

let DB = defaultDB();
let currentInvoiceId = null;
let currentClientId = null;
let currentProdId = null;

/* =========================
   Load/Save local
========================= */
function loadLocal(){
  const raw = localStorage.getItem(LS_KEY);
  const data = safeJSONParse(raw || "null");
  if(data && typeof data === "object"){
    DB = Object.assign(defaultDB(), data);
    // Ensure nested defaults
    DB.settings = Object.assign(defaultSettings(), DB.settings || {});
    DB.settings.firebase = Object.assign(defaultSettings().firebase, (DB.settings.firebase || {}));
    DB.provider = Object.assign({ ...DEFAULT_PROVIDER }, DB.provider || {});
    DB.clients = Array.isArray(DB.clients) ? DB.clients : [];
    DB.products = Array.isArray(DB.products) ? DB.products : [];
    DB.invoices = Array.isArray(DB.invoices) ? DB.invoices : [];
  }else{
    DB = defaultDB();
  }
}

function saveLocal(){
  DB.meta.updatedAt = timeStamp();
  localStorage.setItem(LS_KEY, JSON.stringify(DB));
  setMini("#dbState", `Local OK • ${DB.invoices.length} facturas • ${DB.clients.length} clientes • ${DB.products.length} productos`);
}

/* =========================
   UI refs (Facturas)
========================= */
const elPillMode = $("#pillMode");
const btnSync = $("#btnSync");
const btnLogin = $("#btnLogin");

const btnExportJson = $("#btnExportJson");
const btnImportJson = $("#btnImportJson");
const fileImportJson = $("#fileImportJson");

const tabs = $$(".tab");
const views = $$(".view");

const invList = $("#invList");
const invSearch = $("#invSearch");
const btnNewInvoice = $("#btnNewInvoice");

const invNumber = $("#invNumber");
const invDate = $("#invDate");
const invTags = $("#invTags");
const invNotes = $("#invNotes");
const btnDupInvoice = $("#btnDupInvoice");
const btnDelInvoice = $("#btnDelInvoice");

const provName = $("#provName");
const provNif = $("#provNif");
const provAddr = $("#provAddr");
const provPhone = $("#provPhone");
const provEmail = $("#provEmail");

const clientSelect = $("#clientSelect");
const cliName = $("#cliName");
const cliNif = $("#cliNif");
const cliPhone = $("#cliPhone");
const cliAddr = $("#cliAddr");
const cliEmail = $("#cliEmail");
const cliAlias = $("#cliAlias");
const btnSaveClientFromInvoice = $("#btnSaveClientFromInvoice");
const btnNewClientQuick = $("#btnNewClientQuick");

const qrBox = $("#qrBox");
const qrMini = $("#qrMini");
const btnRegenQR = $("#btnRegenQR");

const btnAddLine = $("#btnAddLine");
const btnClearLines = $("#btnClearLines");
const linesTbody = $("#linesTbody");
const dlProducts = $("#dlProducts");

const swTrans = $("#swTrans");
const transPct = $("#transPct");
const swIvaIncl = $("#swIvaIncl");

const tSubtotal = $("#tSubtotal");
const tTrans = $("#tTrans");
const tIva = $("#tIva");
const tTotal = $("#tTotal");
const taxNote = $("#taxNote");

const payMethod = $("#payMethod");
const payAmount = $("#payAmount");
const btnAddPay = $("#btnAddPay");
const btnClearPays = $("#btnClearPays");
const payList = $("#payList");
const tPaid = $("#tPaid");
const tDue = $("#tDue");
const payState = $("#payState");

const btnSaveInvoice = $("#btnSaveInvoice");
const btnPDF = $("#btnPDF");
const btnPDFCloud = $("#btnPDFCloud");
const btnOpenPDF = $("#btnOpenPDF");
const btnCopyPdfLink = $("#btnCopyPdfLink");
const btnWhats = $("#btnWhats");
const btnImportPricesLink = $("#btnImportPricesLink");
const btnMakePricesLink = $("#btnMakePricesLink");
const pdfState = $("#pdfState");

/* =========================
   UI refs (Clientes)
========================= */
const cliSearch2 = $("#cliSearch2");
const btnNewClient = $("#btnNewClient");
const clientsList = $("#clientsList");

const cName = $("#cName");
const cNif = $("#cNif");
const cAlias = $("#cAlias");
const cAddr = $("#cAddr");
const cPhone = $("#cPhone");
const cEmail = $("#cEmail");
const cNotes = $("#cNotes");
const btnSaveClient = $("#btnSaveClient");
const btnDelClient = $("#btnDelClient");
const clientsMsg = $("#clientsMsg");

/* =========================
   UI refs (Productos)
========================= */
const prodSearch = $("#prodSearch");
const btnSeedVocab = $("#btnSeedVocab");
const btnNewProd = $("#btnNewProd");
const prodList = $("#prodList");

const pName = $("#pName");
const pUnit = $("#pUnit");
const pKgBox = $("#pKgBox");
const pPriceKg = $("#pPriceKg");
const pPriceBox = $("#pPriceBox");
const pPriceUnit = $("#pPriceUnit");
const pCost = $("#pCost");
const pOrigin = $("#pOrigin");
const btnSaveProd = $("#btnSaveProd");
const btnDelProd = $("#btnDelProd");
const pHist = $("#pHist");
const prodMsg = $("#prodMsg");

/* =========================
   UI refs (Contabilidad)
========================= */
const accStatus = $("#accStatus");
const btnUnlockAcc = $("#btnUnlockAcc");
const btnLockAcc = $("#btnLockAcc");

const accFrom = $("#accFrom");
const accTo = $("#accTo");
const accClient = $("#accClient");
const accTag = $("#accTag");
const btnRunAcc = $("#btnRunAcc");
const kSales = $("#kSales");
const kIva = $("#kIva");
const kN = $("#kN");
const kMargin = $("#kMargin");
const accTable = $("#accTable");

/* =========================
   UI refs (Ajustes)
========================= */
const btnResetLocal = $("#btnResetLocal");
const setTax = $("#setTax");
const setQrTpl = $("#setQrTpl");
const setLogoSvg = $("#setLogoSvg");
const btnSaveSettings = $("#btnSaveSettings");
const setMsg = $("#setMsg");

const fbApiKey = $("#fbApiKey");
const fbAuthDomain = $("#fbAuthDomain");
const fbDbUrl = $("#fbDbUrl");
const fbProjectId = $("#fbProjectId");
const fbAppId = $("#fbAppId");
const fbBucket = $("#fbBucket");
const btnSaveFirebase = $("#btnSaveFirebase");
const fbMsg = $("#fbMsg");
const btnOpenPricesPage = $("#btnOpenPricesPage");

/* =========================
   Modals
========================= */
const loginModal = $("#loginModal");
const btnCloseLogin = $("#btnCloseLogin");
const loginEmail = $("#loginEmail");
const loginPass = $("#loginPass");
const btnDoLogin = $("#btnDoLogin");
const btnDoSignup = $("#btnDoSignup");
const btnDoLogout = $("#btnDoLogout");
const loginMsg = $("#loginMsg");

const pinModal = $("#pinModal");
const btnClosePin = $("#btnClosePin");
const pinInput = $("#pinInput");
const btnPinOk = $("#btnPinOk");
const btnPinCancel = $("#btnPinCancel");
const pinMsg = $("#pinMsg");

const pricesModal = $("#pricesModal");
const btnClosePrices = $("#btnClosePrices");
const pricesLinkInput = $("#pricesLinkInput");
const btnDoImportPrices = $("#btnDoImportPrices");
const btnCopyMyPricesEditor = $("#btnCopyMyPricesEditor");
const pricesMsg = $("#pricesMsg");

/* =========================
   Tabs nav
========================= */
function openView(id){
  tabs.forEach(b => b.classList.toggle("active", b.dataset.view === id));
  views.forEach(v => v.classList.toggle("active", v.id === id));
}
tabs.forEach(b => b.addEventListener("click", () => openView(b.dataset.view)));

/* =========================
   Products helpers
========================= */
function getProductByName(name){
  const n = norm(name);
  return DB.products.find(p => norm(p.name) === n) || null;
}
function getProductById(id){
  return DB.products.find(p => p.id === id) || null;
}
function ensureProductHistory(p){
  if(!Array.isArray(p.history)) p.history = [];
  p.history = p.history.slice(0, 5);
}
function pushPriceHistory(p, snapshot){
  ensureProductHistory(p);
  p.history.unshift({ ts: Date.now(), ...snapshot });
  p.history = p.history.slice(0, 5);
}
function productPriceForMode(p, mode){
  if(!p) return 0;
  if(mode === "kg") return n2(p.priceKg);
  if(mode === "caja") return n2(p.priceBox);
  return n2(p.priceUnit);
}

/* =========================
   Invoice helpers
========================= */
function newInvoiceSkeleton(){
  const num = `FA-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,"0")}${String(new Date().getDate()).padStart(2,"0")}${String(new Date().getHours()).padStart(2,"0")}${String(new Date().getMinutes()).padStart(2,"0")}`;
  const firstClient = DB.clients[0]?.id || "";
  const taxRate = Number(DB.settings.taxRate ?? 0.04) || 0.04;

  const inv = {
    id: uid("inv"),
    number: num,
    dateISO: todayISO(),
    tags: "",
    notes: "",
    clientId: firstClient,
    provider: { ...DB.provider },     // snapshot editable in factura (y se puede guardar a provider)
    clientSnap: null,                // se llena al cargar según clientId
    lines: [],
    payments: [],
    transportEnabled: false,
    transportPct: 0.10,
    ivaIncluded: false,
    taxRate,
    totals: { subtotal:0, transport:0, iva:0, total:0 },
    pdf: { localUrl:"", cloudUrl:"" },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 5 líneas por defecto vacías
  for(let i=0;i<5;i++) inv.lines.push(newEmptyLine());
  return inv;
}

function newEmptyLine(){
  return {
    id: uid("ln"),
    productId: "",
    productName: "",
    mode: "kg",
    qty: 0,
    gross: 0,
    tare: 0,
    net: 0,
    price: 0,
    origin: "",
    amount: 0
  };
}

function getInvoiceById(id){
  return DB.invoices.find(x => x.id === id) || null;
}

function upsertInvoice(inv){
  inv.updatedAt = Date.now();
  const idx = DB.invoices.findIndex(x => x.id === inv.id);
  if(idx >= 0) DB.invoices[idx] = inv;
  else DB.invoices.unshift(inv);
}

/* =========================
   Totals compute
========================= */
function computeLine(line){
  const mode = line.mode || "kg";
  const qty = clamp2(n2(line.qty));
  const gross = clamp2(n2(line.gross));
  const tare = clamp2(n2(line.tare));
  let net = clamp2(n2(line.net));

  if(mode === "kg"){
    // net = gross - tare (si el usuario no mete net, lo calculamos)
    const calc = clamp2(gross - tare);
    net = calc;
    line.net = net;
    line.amount = clamp2(net * clamp2(n2(line.price)));
    line.qty = 0; // no aplica en kg (pero lo dejamos en 0)
  }else if(mode === "caja"){
    // si qty y producto con kgBox, net puede ser qty*kgBox (si gross/tare no se usa)
    line.qty = qty;
    const p = line.productId ? getProductById(line.productId) : getProductByName(line.productName);
    const kgBox = p ? n2(p.kgBox) : 0;

    // si el usuario mete gross/tare, usamos net = gross - tare; si no, net = qty*kgBox (si kgBox existe)
    const hasGross = (gross > 0 || tare > 0);
    if(hasGross){
      net = clamp2(gross - tare);
    }else if(kgBox > 0 && qty > 0){
      net = clamp2(qty * kgBox);
    }else{
      net = clamp2(n2(line.net));
    }
    line.net = net;

    // price: por caja (por defecto). Si priceBox no existe y hay priceKg, el user puede usar priceKg manual.
    // Regla: si net>0 y el usuario claramente puso precio kg (p.priceKg) y priceBox está vacío => net*price
    // Pero para no “adivinar” mal, usamos:
    // - si hay kgBox y priceBox existe => qty*price
    // - si no, net*price
    const price = clamp2(n2(line.price));
    if(qty > 0 && (p && n2(p.priceBox) > 0)){
      line.amount = clamp2(qty * price);
    }else{
      line.amount = clamp2(net * price);
    }
  }else{
    // unidad
    line.qty = qty;
    line.net = 0;
    line.gross = 0;
    line.tare = 0;
    line.amount = clamp2(qty * clamp2(n2(line.price)));
  }

  // normalizar
  line.price = clamp2(n2(line.price));
  line.origin = (line.origin || "").toString();
  return line;
}

function computeInvoiceTotals(inv){
  // compute lines
  let subtotal = 0;
  inv.lines.forEach(ln => {
    computeLine(ln);
    subtotal += n2(ln.amount);
  });
  subtotal = clamp2(subtotal);

  // transport
  const transEnabled = !!inv.transportEnabled;
  const pct = clamp2(n2(inv.transportPct));
  const transport = transEnabled ? clamp2(subtotal * pct) : 0;

  // IVA
  const taxRate = clamp2(n2(inv.taxRate ?? DB.settings.taxRate ?? 0.04));
  let iva = 0;
  let total = 0;

  if(inv.ivaIncluded){
    // IVA incluido: no desglosar, iva mostrado = 0 (o informativo)
    iva = 0;
    total = clamp2(subtotal + transport);
  }else{
    iva = clamp2((subtotal + transport) * taxRate);
    total = clamp2(subtotal + transport + iva);
  }

  inv.totals = { subtotal, transport, iva, total };
  return inv.totals;
}

/* =========================
   Payments
========================= */
function sumPayments(inv){
  return clamp2((inv.payments || []).reduce((a,p) => a + n2(p.amount), 0));
}
function payStateText(inv){
  const paid = sumPayments(inv);
  const total = n2(inv.totals?.total);
  const due = clamp2(total - paid);
  if(total <= 0) return "—";
  if(due <= 0.01) return "PAGADA";
  if(paid > 0) return "PARCIAL";
  return "IMPAGADA";
}

/* =========================
   Render Datalist products
========================= */
function renderProductsDatalist(){
  if(!dlProducts) return;
  dlProducts.innerHTML = DB.products
    .slice()
    .sort((a,b) => norm(a.name).localeCompare(norm(b.name)))
    .map(p => `<option value="${p.name}"></option>`)
    .join("");
}

/* =========================
   Render invoice list
========================= */
function renderInvoiceList(){
  const q = norm(invSearch.value || "");
  const list = DB.invoices.filter(inv => {
    if(!q) return true;
    const hay = `${inv.number} ${inv.dateISO} ${inv.tags||""} ${inv.notes||""} ${inv.clientNameCache||""}`.toUpperCase();
    // clientNameCache se rellena al render
    return hay.includes(q);
  });

  invList.innerHTML = "";
  list.forEach(inv => {
    const cli = DB.clients.find(c => c.id === inv.clientId) || null;
    const cliName2 = cli ? (cli.alias || cli.name) : "—";
    inv.clientNameCache = cliName2;

    // totals compute (ligero)
    computeInvoiceTotals(inv);
    const item = document.createElement("div");
    item.className = "inv-item" + (inv.id === currentInvoiceId ? " active" : "");
    item.innerHTML = `
      <div class="top">
        <div class="num">${inv.number || "—"}</div>
        <div class="total">${moneyEUR(inv.totals?.total || 0)}</div>
      </div>
      <div class="sub">
        <span>${inv.dateISO || ""}</span>
        <span>•</span>
        <span>${cliName2}</span>
        ${inv.tags ? `<span>•</span><span>${inv.tags}</span>` : ``}
      </div>
    `;
    item.addEventListener("click", () => {
      openInvoice(inv.id);
    });
    invList.appendChild(item);
  });

  saveLocal();
}

/* =========================
   Render invoice editor
========================= */
function fillProviderUI(p){
  provName.value = p.name || "";
  provNif.value = p.nif || "";
  provAddr.value = p.addr || "";
  provPhone.value = p.phone || "";
  provEmail.value = p.email || "";
}

function fillClientSelect(){
  const cur = currentInvoiceId ? getInvoiceById(currentInvoiceId)?.clientId : "";
  clientSelect.innerHTML = DB.clients
    .slice()
    .sort((a,b)=> norm(a.alias||a.name).localeCompare(norm(b.alias||b.name)))
    .map(c => `<option value="${c.id}">${(c.alias||c.name)} • ${(c.nif||"")}</option>`)
    .join("");
  if(cur) clientSelect.value = cur;
}

function fillClientUI(c){
  cliName.value = c?.name || "";
  cliNif.value = c?.nif || "";
  cliPhone.value = c?.phone || "";
  cliAddr.value = c?.addr || "";
  cliEmail.value = c?.email || "";
  cliAlias.value = c?.alias || "";
}

function renderLines(inv){
  linesTbody.innerHTML = "";

  inv.lines.forEach((ln) => {
    const row = document.createElement("div");
    row.className = "line-row";
    row.dataset.id = ln.id;

    // Hint (solo pantalla)
    const hintId = `hint_${ln.id}`;

    row.innerHTML = `
      <div class="col-prod">
        <input class="col-prod-input" data-k="productName" list="dlProducts" placeholder="Producto" value="${(ln.productName||"").replaceAll('"','&quot;')}" autocomplete="off">
        <div class="hint" id="${hintId}"></div>
      </div>

      <div class="col-modo">
        <select data-k="mode">
          <option value="kg">kg</option>
          <option value="caja">caja</option>
          <option value="unidad">unidad</option>
        </select>
      </div>

      <div class="col-cant">
        <input data-k="qty" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${ln.qty ? ln.qty : ""}">
      </div>

      <div class="col-bruto">
        <input data-k="gross" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${ln.gross ? ln.gross : ""}">
      </div>

      <div class="col-tara">
        <input data-k="tare" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${ln.tare ? ln.tare : ""}">
      </div>

      <div class="col-neto">
        <input data-k="net" type="number" inputmode="decimal" step="0.01) placeholder="0" value="${ln.net ? ln.net : ""}">
      </div>

      <div class="col-precio">
        <input data-k="price" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${ln.price ? ln.price : ""}">
      </div>

      <div class="col-origen">
        <input data-k="origin" placeholder="Origen" value="${(ln.origin||"").replaceAll('"','&quot;')}" autocomplete="off">
      </div>

      <div class="col-importe">
        <div class="amount-pill">${moneyEUR(ln.amount || 0)}</div>
      </div>

      <div class="col-x center">
        <button class="xbtn" type="button" title="Eliminar">✕</button>
      </div>
    `;

    // Fix select value
    row.querySelector(`select[data-k="mode"]`).value = ln.mode || "kg";

    // delete
    row.querySelector(".xbtn").addEventListener("click", () => {
      const inv2 = getInvoiceById(currentInvoiceId);
      if(!inv2) return;
      const idx = inv2.lines.findIndex(x => x.id === ln.id);
      if(idx >= 0){
        inv2.lines.splice(idx, 1);
        if(inv2.lines.length === 0) inv2.lines.push(newEmptyLine());
        upsertInvoice(inv2);
        renderInvoice(inv2);
      }
    });

    // events
    const inputs = Array.from(row.querySelectorAll("input,select"));
    inputs.forEach((el, i) => {
      // Enter -> siguiente input en tabla
      el.addEventListener("keydown", (ev) => {
        if(ev.key === "Enter"){
          ev.preventDefault();
          const flat = Array.from(linesTbody.querySelectorAll("input,select"));
          const pos = flat.indexOf(el);
          if(pos >= 0 && flat[pos+1]){
            flat[pos+1].focus();
            flat[pos+1].select?.();
          }
        }
      });

      el.addEventListener("input", () => onLineEdit(ln.id, el));
      el.addEventListener("change", () => onLineEdit(ln.id, el));
      el.addEventListener("blur", () => {
        if(el.getAttribute("data-k") === "productName"){
          onProductChosen(ln.id);
        }
      });
    });

    linesTbody.appendChild(row);

    // hint
    refreshLineHint(ln.id);
  });
}

function getLine(inv, lineId){
  return inv.lines.find(x => x.id === lineId) || null;
}

function refreshLineAmountUI(lineId){
  const inv = getInvoiceById(currentInvoiceId);
  if(!inv) return;
  const ln = getLine(inv, lineId);
  if(!ln) return;

  const row = linesTbody.querySelector(`.line-row[data-id="${lineId}"]`);
  if(!row) return;
  const amount = row.querySelector(".amount-pill");
  if(amount) amount.textContent = moneyEUR(ln.amount || 0);
}

function refreshLineHint(lineId){
  const inv = getInvoiceById(currentInvoiceId);
  if(!inv) return;
  const ln = getLine(inv, lineId);
  if(!ln) return;

  const row = linesTbody.querySelector(`.line-row[data-id="${lineId}"]`);
  if(!row) return;

  const hint = row.querySelector(".hint");
  if(!hint) return;

  const p = ln.productId ? getProductById(ln.productId) : getProductByName(ln.productName);
  if(!p || !Array.isArray(p.history) || p.history.length === 0){
    hint.textContent = "";
    return;
  }
  const last = p.history[0];
  const parts = [];
  if(last.priceKg) parts.push(`€/kg ${last.priceKg}`);
  if(last.priceBox) parts.push(`€/caja ${last.priceBox}`);
  if(last.priceUnit) parts.push(`€/ud ${last.priceUnit}`);
  hint.textContent = `Últimos: ${parts.join(" • ")} (solo pantalla)`;
}

function onLineEdit(lineId, el){
  const inv = getInvoiceById(currentInvoiceId);
  if(!inv) return;
  const ln = getLine(inv, lineId);
  if(!ln) return;

  const k = el.getAttribute("data-k");
  if(!k) return;

  if(k === "productName"){
    ln.productName = el.value || "";
    // NO sustituimos automático. Solo si coincide exacto, en blur/change aplicamos defaults.
  }else if(k === "mode"){
    ln.mode = el.value || "kg";
    // Al cambiar modo: si hay producto, ponemos precio por defecto del modo
    const p = ln.productId ? getProductById(ln.productId) : getProductByName(ln.productName);
    if(p){
      const pp = productPriceForMode(p, ln.mode);
      if(pp > 0) ln.price = pp;
      if(!ln.origin && p.origin) ln.origin = p.origin;
    }
  }else if(k === "origin"){
    ln.origin = el.value || "";
  }else{
    // numeric
    ln[k] = el.value;
  }

  // compute and update UI
  computeInvoiceTotals(inv);
  upsertInvoice(inv);

  refreshLineAmountUI(lineId);
  refreshLineHint(lineId);
  renderTotals(inv);
  renderPayments(inv);

  saveLocal();
}

function onProductChosen(lineId){
  const inv = getInvoiceById(currentInvoiceId);
  if(!inv) return;
  const ln = getLine(inv, lineId);
  if(!ln) return;

  const name = ln.productName || "";
  const p = getProductByName(name);
  if(!p) {
    // no match exacto: no tocamos
    ln.productId = "";
    refreshLineHint(lineId);
    return;
  }

  // match exacto: aplicamos defaults sin “inventar”
  ln.productId = p.id;
  // modo: si aún está en default kg y el producto tiene otro default, lo cambiamos
  if(!ln.mode) ln.mode = p.unitDefault || "kg";
  if(p.unitDefault && ln.mode === "kg" && p.unitDefault !== "kg"){
    ln.mode = p.unitDefault;
    // reflejar en select
    const row = linesTbody.querySelector(`.line-row[data-id="${lineId}"]`);
    const sel = row?.querySelector(`select[data-k="mode"]`);
    if(sel) sel.value = ln.mode;
  }

  // precio por defecto del modo
  const pp = productPriceForMode(p, ln.mode);
  if(pp > 0) {
    ln.price = pp;
    // reflejar en input precio
    const row = linesTbody.querySelector(`.line-row[data-id="${lineId}"]`);
    const inp = row?.querySelector(`input[data-k="price"]`);
    if(inp) inp.value = String(pp);
  }

  // origen default si vacío
  if(!ln.origin && p.origin){
    ln.origin = p.origin;
    const row = linesTbody.querySelector(`.line-row[data-id="${lineId}"]`);
    const inp = row?.querySelector(`input[data-k="origin"]`);
    if(inp) inp.value = ln.origin;
  }

  computeInvoiceTotals(inv);
  upsertInvoice(inv);
  refreshLineHint(lineId);
  renderTotals(inv);
  saveLocal();
}

/* =========================
   Render totals & payments UI
========================= */
function renderTotals(inv){
  const tot = computeInvoiceTotals(inv);

  tSubtotal.textContent = moneyEUR(tot.subtotal);
  tTrans.textContent = moneyEUR(tot.transport);
  tIva.textContent = moneyEUR(tot.iva);
  tTotal.textContent = moneyEUR(tot.total);

  swTrans.checked = !!inv.transportEnabled;
  transPct.value = (inv.transportPct ?? 0.10);
  swIvaIncl.checked = !!inv.ivaIncluded;

  taxNote.textContent = inv.ivaIncluded ? "IVA incluido en precios (sin desglose)" : "IVA desglosado (4%)";
}

function renderPayments(inv){
  payList.innerHTML = "";
  const pays = Array.isArray(inv.payments) ? inv.payments : [];
  pays.forEach((p) => {
    const item = document.createElement("div");
    item.className = "pay-item";
    item.innerHTML = `
      <div class="l">
        <div style="font-weight:900">${moneyEUR(n2(p.amount))}</div>
        <div class="muted mini">${(p.method||"").toUpperCase()} • ${(p.ts ? new Date(p.ts).toLocaleString("es-ES") : "")}</div>
      </div>
      <div class="r">
        <button class="pay-del" type="button">✕</button>
      </div>
    `;
    item.querySelector(".pay-del").addEventListener("click", () => {
      const inv2 = getInvoiceById(currentInvoiceId);
      if(!inv2) return;
      inv2.payments = inv2.payments.filter(x => x.id !== p.id);
      upsertInvoice(inv2);
      renderPayments(inv2);
      saveLocal();
    });
    payList.appendChild(item);
  });

  const paid = sumPayments(inv);
  const due = clamp2(n2(inv.totals?.total) - paid);
  tPaid.textContent = moneyEUR(paid);
  tDue.textContent = moneyEUR(due);

  const st = payStateText(inv);
  payState.textContent = `Estado: ${st}`;
}

/* =========================
   Render full invoice editor
========================= */
function renderInvoice(inv){
  if(!inv) return;

  // header meta
  invNumber.value = inv.number || "";
  invDate.value = inv.dateISO || todayISO();
  invTags.value = inv.tags || "";
  invNotes.value = inv.notes || "";

  // provider snapshot in invoice
  fillProviderUI(inv.provider || DB.provider);

  // client select
  fillClientSelect();
  if(inv.clientId) clientSelect.value = inv.clientId;

  // load client data
  const cli = DB.clients.find(c => c.id === inv.clientId) || null;
  fillClientUI(cli);

  // switches
  swTrans.checked = !!inv.transportEnabled;
  transPct.value = inv.transportPct ?? 0.10;
  swIvaIncl.checked = !!inv.ivaIncluded;

  // grid
  inv.lines = Array.isArray(inv.lines) ? inv.lines : [];
  if(inv.lines.length === 0){
    for(let i=0;i<5;i++) inv.lines.push(newEmptyLine());
  }
  renderLines(inv);

  // totals + payments
  computeInvoiceTotals(inv);
  renderTotals(inv);
  renderPayments(inv);

  // QR
  renderQR(inv);

  setMini("#pdfState", inv.pdf?.cloudUrl ? "PDF nube: OK" : (inv.pdf?.localUrl ? "PDF local: OK" : "—"));
  saveLocal();
}

function openInvoice(id){
  const inv = getInvoiceById(id);
  if(!inv) return;
  currentInvoiceId = id;
  renderInvoiceList();
  renderInvoice(inv);
}

function createInvoice(){
  const inv = newInvoiceSkeleton();
  upsertInvoice(inv);
  currentInvoiceId = inv.id;
  saveLocal();
  renderInvoiceList();
  renderInvoice(inv);
}

/* =========================
   QR AEAT
========================= */
function buildQrText(inv){
  const tpl = (DB.settings.qrTemplate || "AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}");
  const nif = (DB.provider?.nif || DEFAULT_PROVIDER.nif || "").trim();
  const num = (inv.number || "").trim();
  const fecha = (inv.dateISO || "").trim();
  const total = clamp2(n2(inv.totals?.total)).toFixed(2);
  return tpl
    .replaceAll("{NIF}", nif)
    .replaceAll("{NUM}", num)
    .replaceAll("{FECHA}", fecha)
    .replaceAll("{TOTAL}", total);
}

function renderQR(inv){
  const txt = buildQrText(inv);
  qrMini.textContent = txt;

  // clear previous
  qrBox.innerHTML = "";

  if(!window.QRCode){
    qrBox.innerHTML = `<div class="muted mini" style="padding:12px;text-align:center">QR lib no cargó</div>`;
    return;
  }

  try{
    // eslint-disable-next-line no-new
    new window.QRCode(qrBox, {
      text: txt,
      width: 150,
      height: 150,
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }catch(e){
    qrBox.innerHTML = `<div class="muted mini" style="padding:12px;text-align:center">Error QR</div>`;
  }
}

/* =========================
   Factura: bind UI -> state
========================= */
function bindInvoiceMeta(){
  invNumber.addEventListener("input", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.number = invNumber.value || inv.number;
    upsertInvoice(inv);
    renderInvoiceList();
    renderQR(inv);
    saveLocal();
  });

  invDate.addEventListener("change", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.dateISO = invDate.value || todayISO();
    upsertInvoice(inv);
    renderInvoiceList();
    renderQR(inv);
    saveLocal();
  });

  invTags.addEventListener("input", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.tags = invTags.value || "";
    upsertInvoice(inv);
    renderInvoiceList();
    saveLocal();
  });

  invNotes.addEventListener("input", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.notes = invNotes.value || "";
    upsertInvoice(inv);
    saveLocal();
  });

  // provider fields update invoice snapshot (y opcionalmente DB.provider en ajustes/guardar)
  [provName, provNif, provAddr, provPhone, provEmail].forEach((el) => {
    el.addEventListener("input", () => {
      const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
      inv.provider = {
        name: provName.value || "",
        nif: provNif.value || "",
        addr: provAddr.value || "",
        phone: provPhone.value || "",
        email: provEmail.value || ""
      };
      // también actualizamos DB.provider para que sea el default del sistema
      DB.provider = { ...inv.provider };
      upsertInvoice(inv);
      renderQR(inv);
      saveLocal();
    });
  });

  clientSelect.addEventListener("change", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.clientId = clientSelect.value || "";
    upsertInvoice(inv);

    const cli = DB.clients.find(c => c.id === inv.clientId) || null;
    fillClientUI(cli);
    renderInvoiceList();
    saveLocal();
  });

  // cambios en UI cliente NO alteran automáticamente el cliente, solo cuando se pulsa “Guardar cambios cliente”
  btnSaveClientFromInvoice.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    const c = DB.clients.find(x => x.id === inv.clientId);
    if(!c) { setMini("#clientsMsg", "Selecciona un cliente"); return; }

    c.name = cliName.value || c.name;
    c.nif = cliNif.value || c.nif;
    c.phone = cliPhone.value || c.phone;
    c.addr = cliAddr.value || c.addr;
    c.email = cliEmail.value || c.email;
    c.alias = cliAlias.value || c.alias;

    saveLocal();
    fillClientSelect();
    renderInvoiceList();
    setMini("#clientsMsg", "✅ Cliente actualizado desde factura");
  });

  btnNewClientQuick.addEventListener("click", () => {
    const id = uid("cli");
    const c = {
      id,
      name: cliName.value || "NUEVO CLIENTE",
      nif: cliNif.value || "",
      addr: cliAddr.value || "",
      phone: cliPhone.value || "",
      email: cliEmail.value || "",
      alias: cliAlias.value || "",
      notes: ""
    };
    DB.clients.unshift(c);
    saveLocal();
    fillClientSelect();
    clientSelect.value = id;

    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.clientId = id;
    upsertInvoice(inv);
    renderInvoiceList();
    setMini("#clientsMsg", "✅ Cliente creado");
  });

  // switches totals
  swTrans.addEventListener("change", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.transportEnabled = !!swTrans.checked;
    inv.transportPct = n2(transPct.value || 0.10);
    upsertInvoice(inv);
    renderTotals(inv);
    renderInvoiceList();
    saveLocal();
  });

  transPct.addEventListener("input", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.transportPct = n2(transPct.value || 0.10);
    upsertInvoice(inv);
    renderTotals(inv);
    saveLocal();
  });

  swIvaIncl.addEventListener("change", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.ivaIncluded = !!swIvaIncl.checked;
    upsertInvoice(inv);
    renderTotals(inv);
    saveLocal();
  });

  // actions
  btnNewInvoice.addEventListener("click", createInvoice);

  btnDupInvoice.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId);
    if(!inv) return;
    const copy = JSON.parse(JSON.stringify(inv));
    copy.id = uid("inv");
    copy.number = `FA-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,"0")}${String(new Date().getDate()).padStart(2,"0")}${String(new Date().getHours()).padStart(2,"0")}${String(new Date().getMinutes()).padStart(2,"0")}`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.pdf = { localUrl:"", cloudUrl:"" };
    upsertInvoice(copy);
    currentInvoiceId = copy.id;
    saveLocal();
    renderInvoiceList();
    renderInvoice(copy);
  });

  btnDelInvoice.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId);
    if(!inv) return;
    if(!confirm(`¿Eliminar ${inv.number}?`)) return;
    DB.invoices = DB.invoices.filter(x => x.id !== inv.id);
    currentInvoiceId = DB.invoices[0]?.id || null;
    saveLocal();
    renderInvoiceList();
    if(currentInvoiceId) renderInvoice(getInvoiceById(currentInvoiceId));
    else createInvoice();
  });

  btnAddLine.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.lines.push(newEmptyLine());
    upsertInvoice(inv);
    renderInvoice(inv);
  });

  btnClearLines.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    if(!confirm("¿Vaciar líneas?")) return;
    inv.lines = [];
    for(let i=0;i<5;i++) inv.lines.push(newEmptyLine());
    upsertInvoice(inv);
    renderInvoice(inv);
  });

  btnRegenQR.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    renderQR(inv);
  });

  // payments
  btnAddPay.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    const amt = n2(payAmount.value);
    if(!(amt > 0)){
      setMini("#payState", "Importe inválido");
      return;
    }
    inv.payments = Array.isArray(inv.payments) ? inv.payments : [];
    inv.payments.unshift({
      id: uid("pay"),
      amount: clamp2(amt),
      method: payMethod.value || "efectivo",
      ts: Date.now()
    });
    payAmount.value = "";
    upsertInvoice(inv);
    renderPayments(inv);
    saveLocal();
  });

  btnClearPays.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    if(!confirm("¿Vaciar pagos?")) return;
    inv.payments = [];
    upsertInvoice(inv);
    renderPayments(inv);
    saveLocal();
  });

  // save invoice
  btnSaveInvoice.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    inv.number = invNumber.value || inv.number;
    inv.dateISO = invDate.value || inv.dateISO;
    inv.tags = invTags.value || "";
    inv.notes = invNotes.value || "";
    inv.transportEnabled = !!swTrans.checked;
    inv.transportPct = n2(transPct.value || 0.10);
    inv.ivaIncluded = !!swIvaIncl.checked;

    // provider snapshot already updated, but ensure:
    inv.provider = {
      name: provName.value || "",
      nif: provNif.value || "",
      addr: provAddr.value || "",
      phone: provPhone.value || "",
      email: provEmail.value || ""
    };

    // clientId already set
    computeInvoiceTotals(inv);
    upsertInvoice(inv);

    saveLocal();
    renderInvoiceList();
    renderQR(inv);
    setMini("#pdfState", "✅ Guardado");
  });

  // PDF buttons (Parte 2/2 implementa real)
  btnPDF.addEventListener("click", async () => {
    setMini("#pdfState", "⏳ PDF… (Parte 5/5)");
  });
  btnPDFCloud.addEventListener("click", async () => {
    setMini("#pdfState", "⏳ PDF + Nube… (Parte 5/5)");
  });
  btnOpenPDF.addEventListener("click", () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    const url = inv.pdf?.localUrl || inv.pdf?.cloudUrl;
    if(!url){ setMini("#pdfState", "No hay PDF"); return; }
    window.open(url, "_blank");
  });
  btnCopyPdfLink.addEventListener("click", async () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    const url = inv.pdf?.cloudUrl || inv.pdf?.localUrl;
    if(!url){ setMini("#pdfState", "No hay link"); return; }
    try{
      await navigator.clipboard.writeText(url);
      setMini("#pdfState", "✅ Link copiado");
    }catch(e){
      setMini("#pdfState", "No se pudo copiar");
    }
  });

  // WhatsApp TXT
  btnWhats.addEventListener("click", async () => {
    const inv = getInvoiceById(currentInvoiceId); if(!inv) return;
    computeInvoiceTotals(inv);

    const cli = DB.clients.find(c => c.id === inv.clientId) || {};
    const lines = inv.lines
      .filter(l => norm(l.productName).length > 0 && n2(l.amount) > 0)
      .map(l => {
        const mode = l.mode;
        const qty = (mode === "kg") ? `${clamp2(n2(l.net))}kg` : `${clamp2(n2(l.qty))} ${mode}`;
        return `- ${norm(l.productName)} • ${qty} • ${moneyEUR(l.amount)}`;
      })
      .join("\n");

    const txt =
`${inv.number} • ${inv.dateISO}
Cliente: ${(cli.alias||cli.name||"—")}
Total: ${moneyEUR(inv.totals.total)}

${lines}

${inv.pdf?.cloudUrl ? "PDF: "+inv.pdf.cloudUrl : ""}`.trim();

    try{
      await navigator.clipboard.writeText(txt);
      setMini("#pdfState", "✅ WhatsApp TXT copiado");
    }catch(e){
      alert(txt);
    }
  });

  // Prices link modal
  btnImportPricesLink.addEventListener("click", () => {
    pricesLinkInput.value = "";
    setMini("#pricesMsg", "—");
    showModal(pricesModal);
  });
  btnClosePrices.addEventListener("click", () => hideModal(pricesModal));
  btnDoImportPrices.addEventListener("click", () => {
    const link = pricesLinkInput.value.trim();
    const ok = importPricesFromLink(link);
    setMini("#pricesMsg", ok ? "✅ Precios importados" : "❌ No se pudo importar");
    renderProductsDatalist();
    renderInvoiceList();
    const inv = getInvoiceById(currentInvoiceId);
    if(inv) renderInvoice(inv);
  });
  btnCopyMyPricesEditor.addEventListener("click", async () => {
    const url = buildPricesEditorUrl();
    try{
      await navigator.clipboard.writeText(url);
      setMini("#pricesMsg", "✅ Link editor copiado");
    }catch(e){
      setMini("#pricesMsg", url);
    }
  });

  btnMakePricesLink.addEventListener("click", async () => {
    const url = buildPricesEditorUrl();
    try{
      await navigator.clipboard.writeText(url);
      setMini("#pdfState", "✅ Link editor copiado");
    }catch(e){
      setMini("#pdfState", url);
    }
    window.open(url, "_blank");
  });
}

/* =========================
   Prices editor integration
========================= */
function buildPricesPack(){
  // enviamos catálogo (products) para que el editor liste
  const products = DB.products
    .slice()
    .sort((a,b)=> norm(a.name).localeCompare(norm(b.name)))
    .map(p => ({
      id: p.id,
      name: p.name,
      unitDefault: p.unitDefault || "kg",
      kgBox: p.kgBox ?? "",
      priceKg: p.priceKg ?? "",
      priceBox: p.priceBox ?? "",
      priceUnit: p.priceUnit ?? "",
      history: Array.isArray(p.history) ? p.history.slice(0,5) : []
    }));

  return {
    meta: {
      kind: "arslan_products_pack_v1",
      createdAt: timeStamp(),
      source: "arslan_app",
      mainApp: new URL(location.href).toString()
    },
    products
  };
}

function buildPricesEditorUrl(){
  const pack = buildPricesPack();
  const comp = lzCompress(pack);
  const u = new URL(location.href);
  // ir a prices.html en misma carpeta
  u.pathname = u.pathname.replace(/\/[^/]*$/, "/prices.html");
  u.search = "";
  u.hash = "";
  u.searchParams.set("pack", comp);
  return u.toString();
}

function extractPricesParamFromLink(link){
  if(!link) return null;
  try{
    const u = new URL(link);
    const p = u.searchParams.get("prices");
    if(p) return p;
    if(u.hash && u.hash.includes("prices=")){
      return u.hash.split("prices=")[1] || null;
    }
    return null;
  }catch(e){
    // maybe the user pasted only token
    if(link.startsWith("prices=")) return link.slice(7);
    return null;
  }
}

function importPricesFromPayload(payload){
  // payload esperado: {meta:{kind:"arslan_prices_updates_v1"}, updates:[{id,name,unitDefault,kgBox,priceKg,priceBox,priceUnit,editedAt}]}
  if(!payload || typeof payload !== "object") return false;
  if(!Array.isArray(payload.updates)) return false;

  let changed = 0;

  payload.updates.forEach(up => {
    const id = up.id;
    let p = getProductById(id);
    if(!p && up.name){
      p = getProductByName(up.name);
    }
    if(!p){
      // si no existe, lo creamos para no perder precios
      p = {
        id: id || uid("prd"),
        name: norm(up.name || "PRODUCTO"),
        unitDefault: up.unitDefault || "kg",
        kgBox: up.kgBox || "",
        priceKg: up.priceKg || "",
        priceBox: up.priceBox || "",
        priceUnit: up.priceUnit || "",
        cost: "",
        origin: "",
        history: []
      };
      DB.products.unshift(p);
    }

    // guardar historial (solo si hay cambios reales en precio)
    const prev = { priceKg: p.priceKg, priceBox: p.priceBox, priceUnit: p.priceUnit };
    const next = {
      priceKg: up.priceKg ?? p.priceKg,
      priceBox: up.priceBox ?? p.priceBox,
      priceUnit: up.priceUnit ?? p.priceUnit
    };

    const differs =
      String(prev.priceKg ?? "") !== String(next.priceKg ?? "") ||
      String(prev.priceBox ?? "") !== String(next.priceBox ?? "") ||
      String(prev.priceUnit ?? "") !== String(next.priceUnit ?? "");

    if(differs){
      pushPriceHistory(p, { ...next });
      changed++;
    }

    // aplicar
    if(up.unitDefault) p.unitDefault = up.unitDefault;
    if(up.kgBox !== undefined) p.kgBox = up.kgBox;
    if(up.priceKg !== undefined) p.priceKg = up.priceKg;
    if(up.priceBox !== undefined) p.priceBox = up.priceBox;
    if(up.priceUnit !== undefined) p.priceUnit = up.priceUnit;
  });

  saveLocal();
  setMini("#prodMsg", `✅ Precios importados (${changed} cambios)`);
  return true;
}

function importPricesFromLink(link){
  const token = extractPricesParamFromLink(link);
  if(!token) return false;
  const payload = lzDecompressParam(token);
  if(!payload) return false;
  const ok = importPricesFromPayload(payload);
  return ok;
}

/* =========================
   Export/Import JSON
========================= */
function exportJSON(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `arslan_kiwi_facturas_db_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importJSONFile(file){
  const fr = new FileReader();
  fr.onload = () => {
    const data = safeJSONParse(fr.result);
    if(!data){
      setMini("#dbState", "❌ JSON inválido");
      return;
    }
    DB = Object.assign(defaultDB(), data);
    DB.settings = Object.assign(defaultSettings(), DB.settings || {});
    DB.settings.firebase = Object.assign(defaultSettings().firebase, (DB.settings.firebase || {}));
    DB.provider = Object.assign({ ...DEFAULT_PROVIDER }, DB.provider || {});
    DB.clients = Array.isArray(DB.clients) ? DB.clients : [];
    DB.products = Array.isArray(DB.products) ? DB.products : [];
    DB.invoices = Array.isArray(DB.invoices) ? DB.invoices : [];

    saveLocal();
    renderAll();
    setMini("#dbState", "✅ Import OK");
  };
  fr.readAsText(file);
}

/* =========================
   Clients view
========================= */
function renderClientsList(){
  const q = norm(cliSearch2.value || "");
  const list = DB.clients
    .slice()
    .sort((a,b)=> norm(a.alias||a.name).localeCompare(norm(b.alias||b.name)))
    .filter(c => {
      if(!q) return true;
      const hay = `${c.name} ${c.alias||""} ${c.nif||""} ${c.addr||""}`.toUpperCase();
      return hay.includes(q);
    });

  clientsList.innerHTML = "";
  list.forEach(c => {
    const item = document.createElement("div");
    item.className = "list-item" + (c.id === currentClientId ? " active" : "");
    item.innerHTML = `
      <div class="t">
        <div class="name">${c.alias || c.name}</div>
        <div class="badge">${c.nif || "—"}</div>
      </div>
      <div class="meta">
        ${c.name ? `<span>${c.name}</span>` : ``}
        ${c.addr ? `<span>•</span><span>${c.addr}</span>` : ``}
      </div>
    `;
    item.addEventListener("click", () => {
      currentClientId = c.id;
      renderClientsList();
      fillClientEditor(c);
    });
    clientsList.appendChild(item);
  });
}

function fillClientEditor(c){
  cName.value = c?.name || "";
  cNif.value = c?.nif || "";
  cAlias.value = c?.alias || "";
  cAddr.value = c?.addr || "";
  cPhone.value = c?.phone || "";
  cEmail.value = c?.email || "";
  cNotes.value = c?.notes || "";
}

function saveClientEditor(){
  if(!currentClientId){
    setMini("#clientsMsg", "Selecciona un cliente");
    return;
  }
  const c = DB.clients.find(x => x.id === currentClientId);
  if(!c){
    setMini("#clientsMsg", "Cliente no encontrado");
    return;
  }
  c.name = cName.value || "";
  c.nif = cNif.value || "";
  c.alias = cAlias.value || "";
  c.addr = cAddr.value || "";
  c.phone = cPhone.value || "";
  c.email = cEmail.value || "";
  c.notes = cNotes.value || "";

  saveLocal();
  renderClientsList();
  fillClientSelect();
  setMini("#clientsMsg", "✅ Guardado");
}

function deleteClientEditor(){
  if(!currentClientId) return;
  const c = DB.clients.find(x => x.id === currentClientId);
  if(!c) return;
  if(!confirm(`¿Eliminar cliente ${c.alias||c.name}?`)) return;

  // re-map en facturas a vacío
  DB.invoices.forEach(inv => {
    if(inv.clientId === c.id) inv.clientId = "";
  });

  DB.clients = DB.clients.filter(x => x.id !== c.id);
  currentClientId = DB.clients[0]?.id || null;

  saveLocal();
  renderClientsList();
  fillClientSelect();
  setMini("#clientsMsg", "✅ Eliminado");
}

/* =========================
   Products view
========================= */
function renderProdList(){
  const q = norm(prodSearch.value || "");
  const list = DB.products
    .slice()
    .sort((a,b)=> norm(a.name).localeCompare(norm(b.name)))
    .filter(p => !q || norm(p.name).includes(q));

  prodList.innerHTML = "";
  list.forEach(p => {
    const item = document.createElement("div");
    item.className = "list-item" + (p.id === currentProdId ? " active" : "");
    const priceMain = (p.unitDefault === "caja") ? p.priceBox : (p.unitDefault === "unidad" ? p.priceUnit : p.priceKg);
    item.innerHTML = `
      <div class="t">
        <div class="name">${p.name}</div>
        <div class="badge">${priceMain ? `${priceMain}€` : "—"}</div>
      </div>
      <div class="meta">
        <span>Def: ${p.unitDefault || "kg"}</span>
        ${p.kgBox ? `<span>•</span><span>Kg/caja ${p.kgBox}</span>` : ``}
        ${(p.origin||"") ? `<span>•</span><span>${p.origin}</span>` : ``}
      </div>
    `;
    item.addEventListener("click", () => {
      currentProdId = p.id;
      renderProdList();
      fillProdEditor(p);
    });
    prodList.appendChild(item);
  });
}

function fillProdEditor(p){
  pName.value = p?.name || "";
  pUnit.value = p?.unitDefault || "kg";
  pKgBox.value = p?.kgBox ?? "";
  pPriceKg.value = p?.priceKg ?? "";
  pPriceBox.value = p?.priceBox ?? "";
  pPriceUnit.value = p?.priceUnit ?? "";
  pCost.value = p?.cost ?? "";
  pOrigin.value = p?.origin ?? "";
  renderProdHist(p);
}

function renderProdHist(p){
  pHist.innerHTML = "";
  const hist = Array.isArray(p?.history) ? p.history : [];
  if(hist.length === 0){
    pHist.innerHTML = `<div class="hist-item"><span class="muted">Sin historial</span></div>`;
    return;
  }
  hist.slice(0,5).forEach(h => {
    const when = h.ts ? new Date(h.ts).toLocaleString("es-ES") : "";
    const parts = [];
    if(h.priceKg) parts.push(`€/kg ${h.priceKg}`);
    if(h.priceBox) parts.push(`€/caja ${h.priceBox}`);
    if(h.priceUnit) parts.push(`€/ud ${h.priceUnit}`);
    const item = document.createElement("div");
    item.className = "hist-item";
    item.innerHTML = `<span>${parts.join(" • ")}</span><span class="muted mini">${when}</span>`;
    pHist.appendChild(item);
  });
}

function saveProdEditor(){
  // si no hay seleccionado, crear
  let p = currentProdId ? DB.products.find(x => x.id === currentProdId) : null;
  const name = norm(pName.value || "");
  if(!name){
    setMini("#prodMsg", "Nombre inválido");
    return;
  }

  // no duplicar por nombre
  const existing = DB.products.find(x => norm(x.name) === name && (!p || x.id !== p.id));
  if(existing){
    setMini("#prodMsg", "Ya existe ese producto (mismo nombre)");
    return;
  }

  const patch = {
    name,
    unitDefault: pUnit.value || "kg",
    kgBox: pKgBox.value ?? "",
    priceKg: pPriceKg.value ?? "",
    priceBox: pPriceBox.value ?? "",
    priceUnit: pPriceUnit.value ?? "",
    cost: pCost.value ?? "",
    origin: pOrigin.value ?? ""
  };

  if(!p){
    p = {
      id: uid("prd"),
      history: []
    };
    DB.products.unshift(p);
    currentProdId = p.id;
  }

  // historial: si cambian precios, push snapshot
  const prev = { priceKg: p.priceKg ?? "", priceBox: p.priceBox ?? "", priceUnit: p.priceUnit ?? "" };
  const next = { priceKg: patch.priceKg ?? "", priceBox: patch.priceBox ?? "", priceUnit: patch.priceUnit ?? "" };
  const differs =
    String(prev.priceKg) !== String(next.priceKg) ||
    String(prev.priceBox) !== String(next.priceBox) ||
    String(prev.priceUnit) !== String(next.priceUnit);

  Object.assign(p, patch);
  ensureProductHistory(p);
  if(differs){
    pushPriceHistory(p, next);
  }

  saveLocal();
  renderProdList();
  renderProductsDatalist();
  // refrescar factura para aplicar cambios en hints/precios futuros
  const inv = getInvoiceById(currentInvoiceId);
  if(inv) renderInvoice(inv);

  setMini("#prodMsg", "✅ Guardado");
}

function deleteProdEditor(){
  if(!currentProdId) return;
  const p = DB.products.find(x => x.id === currentProdId);
  if(!p) return;
  if(!confirm(`¿Eliminar producto ${p.name}?`)) return;

  // no romper facturas: dejamos nombre en líneas, y quitamos productId si coincide
  DB.invoices.forEach(inv => {
    inv.lines.forEach(ln => {
      if(ln.productId === p.id) ln.productId = "";
    });
  });

  DB.products = DB.products.filter(x => x.id !== p.id);
  currentProdId = DB.products[0]?.id || null;

  saveLocal();
  renderProdList();
  renderProductsDatalist();
  setMini("#prodMsg", "✅ Eliminado");
}

function seedVocab(){
  const vocab = DEFAULT_VOCAB_TEXT
    .split("\n")
    .map(s => norm(s))
    .filter(Boolean);

  let added = 0;
  vocab.forEach(name => {
    if(!DB.products.find(p => norm(p.name) === name)){
      DB.products.push({
        id: uid("prd"),
        name,
        unitDefault: "kg",
        kgBox: "",
        priceKg: "",
        priceBox: "",
        priceUnit: "",
        cost: "",
        origin: "",
        history: []
      });
      added++;
    }
  });

  saveLocal();
  renderProdList();
  renderProductsDatalist();
  setMini("#prodMsg", `✅ Vocab cargado (+${added})`);
}

/* =========================
   Contabilidad (PIN)
========================= */
function isAccUnlocked(){
  return localStorage.getItem(LS_ACC_UNLOCK) === "1";
}
function setAccUnlocked(v){
  localStorage.setItem(LS_ACC_UNLOCK, v ? "1" : "0");
  accStatus.textContent = v ? "Desbloqueado" : "Bloqueado";
  accStatus.style.borderColor = v ? "#0b0d10" : "#d7dbe2";
}

function renderAccClientSelect(){
  accClient.innerHTML = `<option value="">(Todos)</option>` + DB.clients
    .slice()
    .sort((a,b)=> norm(a.alias||a.name).localeCompare(norm(b.alias||b.name)))
    .map(c => `<option value="${c.id}">${c.alias||c.name}</option>`)
    .join("");
}

function clearAccUI(){
  kSales.textContent = "0,00 €";
  kIva.textContent = "0,00 €";
  kN.textContent = "0";
  kMargin.textContent = "0,00 €";
  accTable.innerHTML = "";
}

function runAccounting(){
  if(!isAccUnlocked()){
    clearAccUI();
    return;
  }

  const from = accFrom.value || "0000-01-01";
  const to = accTo.value || "9999-12-31";
  const cliId = accClient.value || "";
  const tagQ = norm(accTag.value || "");

  const invs = DB.invoices.filter(inv => {
    const d = inv.dateISO || "";
    if(d < from || d > to) return false;
    if(cliId && inv.clientId !== cliId) return false;
    if(tagQ && !norm(inv.tags||"").includes(tagQ)) return false;
    return true;
  });

  let sales = 0;
  let iva = 0;
  let margin = 0;

  accTable.innerHTML = "";
  invs.forEach(inv => {
    computeInvoiceTotals(inv);
    sales += n2(inv.totals.total);
    iva += n2(inv.totals.iva);

    // margen estimado: (precio - coste)*neto en kg, y qty*(precio-coste) en unidad/caja si coste se usa
    let invMargin = 0;
    inv.lines.forEach(ln => {
      const p = ln.productId ? getProductById(ln.productId) : getProductByName(ln.productName);
      if(!p) return;
      const cost = n2(p.cost);
      const price = n2(ln.price);

      if(ln.mode === "kg"){
        invMargin += (price - cost) * n2(ln.net);
      }else{
        invMargin += (price - cost) * n2(ln.qty);
      }
    });
    margin += invMargin;

    const cli = DB.clients.find(c => c.id === inv.clientId) || {};
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `
      <div>${inv.dateISO || ""}</div>
      <div>${inv.number || ""}</div>
      <div>${(cli.alias||cli.name||"—")}</div>
      <div class="right">${moneyEUR(inv.totals.total)}</div>
      <div>${inv.tags || ""}</div>
    `;
    accTable.appendChild(row);
  });

  kSales.textContent = moneyEUR(sales);
  kIva.textContent = moneyEUR(iva);
  kN.textContent = String(invs.length);
  kMargin.textContent = moneyEUR(margin);
}

/* =========================
   Ajustes
========================= */
function renderSettings(){
  setTax.value = String(DB.settings.taxRate ?? 0.04);
  setQrTpl.value = DB.settings.qrTemplate || "";
  setLogoSvg.value = DB.settings.logoSvg || "";

  fbApiKey.value = DB.settings.firebase.apiKey || "";
  fbAuthDomain.value = DB.settings.firebase.authDomain || "";
  fbDbUrl.value = DB.settings.firebase.databaseURL || "";
  fbProjectId.value = DB.settings.firebase.projectId || "";
  fbAppId.value = DB.settings.firebase.appId || "";
  fbBucket.value = DB.settings.firebase.storageBucket || "";
}

function saveSettings(){
  DB.settings.taxRate = n2(setTax.value || 0.04) || 0.04;
  DB.settings.qrTemplate = setQrTpl.value || DB.settings.qrTemplate;
  DB.settings.logoSvg = setLogoSvg.value || DB.settings.logoSvg;
  saveLocal();

  const inv = getInvoiceById(currentInvoiceId);
  if(inv) { inv.taxRate = DB.settings.taxRate; upsertInvoice(inv); renderInvoice(inv); }

  setMini("#setMsg", "✅ Ajustes guardados");
}

function saveFirebaseSettings(){
  DB.settings.firebase = {
    apiKey: fbApiKey.value || "",
    authDomain: fbAuthDomain.value || "",
    databaseURL: fbDbUrl.value || "",
    projectId: fbProjectId.value || "",
    appId: fbAppId.value || "",
    storageBucket: fbBucket.value || ""
  };
  saveLocal();
  setMini("#fbMsg", "✅ Firebase guardado (Cloud en Parte 5/5)");
}

/* =========================
   Login modal (Cloud Parte 2/2)
========================= */
function bindCloudUI(){
  btnLogin.addEventListener("click", () => showModal(loginModal));
  btnCloseLogin.addEventListener("click", () => hideModal(loginModal));

  btnDoLogin.addEventListener("click", () => {
    setMini("#loginMsg", "Cloud se completa en PARTE 5/5 (sync + merge + storage)");
  });
  btnDoSignup.addEventListener("click", () => {
    setMini("#loginMsg", "Cloud se completa en PARTE 5/5 (signup/login)");
  });
  btnDoLogout.addEventListener("click", () => {
    setMini("#loginMsg", "Cloud se completa en PARTE 5/5 (logout)");
  });

  btnSync.addEventListener("click", () => {
    setMini("#dbState", "Sync nube en PARTE 5/5");
  });
}

/* =========================
   Prices page open (Ajustes)
========================= */
function bindPricesPageButton(){
  btnOpenPricesPage.addEventListener("click", () => {
    const url = buildPricesEditorUrl();
    window.open(url, "_blank");
  });
}

/* =========================
   Bind other UI
========================= */
function bindClientsUI(){
  cliSearch2.addEventListener("input", renderClientsList);

  btnNewClient.addEventListener("click", () => {
    const c = {
      id: uid("cli"),
      name: "NUEVO CLIENTE",
      nif: "",
      addr: "",
      phone: "",
      email: "",
      alias: "",
      notes: ""
    };
    DB.clients.unshift(c);
    currentClientId = c.id;
    saveLocal();
    renderClientsList();
    fillClientEditor(c);
    fillClientSelect();
    setMini("#clientsMsg", "✅ Cliente creado");
  });

  btnSaveClient.addEventListener("click", saveClientEditor);
  btnDelClient.addEventListener("click", deleteClientEditor);
}

function bindProductsUI(){
  prodSearch.addEventListener("input", renderProdList);
  btnSeedVocab.addEventListener("click", seedVocab);

  btnNewProd.addEventListener("click", () => {
    const p = {
      id: uid("prd"),
      name: "NUEVO PRODUCTO",
      unitDefault: "kg",
      kgBox: "",
      priceKg: "",
      priceBox: "",
      priceUnit: "",
      cost: "",
      origin: "",
      history: []
    };
    DB.products.unshift(p);
    currentProdId = p.id;
    saveLocal();
    renderProdList();
    fillProdEditor(p);
    renderProductsDatalist();
    setMini("#prodMsg", "✅ Producto creado");
  });

  btnSaveProd.addEventListener("click", saveProdEditor);
  btnDelProd.addEventListener("click", deleteProdEditor);
}

function bindAccountingUI(){
  setAccUnlocked(isAccUnlocked());

  btnUnlockAcc.addEventListener("click", () => {
    pinInput.value = "";
    pinMsg.textContent = "—";
    showModal(pinModal);
    setTimeout(() => pinInput.focus(), 50);
  });
  btnLockAcc.addEventListener("click", () => {
    setAccUnlocked(false);
    clearAccUI();
  });

  btnClosePin.addEventListener("click", () => hideModal(pinModal));
  btnPinCancel.addEventListener("click", () => hideModal(pinModal));

  btnPinOk.addEventListener("click", () => {
    const pin = (pinInput.value || "").trim();
    if(pin === (DB.settings.adminPin || "7392")){
      setAccUnlocked(true);
      hideModal(pinModal);
      pinMsg.textContent = "✅ OK";
    }else{
      pinMsg.textContent = "❌ PIN incorrecto";
    }
  });

  btnRunAcc.addEventListener("click", runAccounting);
}

function bindSettingsUI(){
  btnSaveSettings.addEventListener("click", saveSettings);
  btnSaveFirebase.addEventListener("click", saveFirebaseSettings);

  btnResetLocal.addEventListener("click", () => {
    if(!confirm("¿Reset local? (borra base local)")) return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_ACC_UNLOCK);
    loadLocal();
    saveLocal();
    renderAll();
  });
}

function bindJsonUI(){
  btnExportJson.addEventListener("click", exportJSON);
  btnImportJson.addEventListener("click", () => fileImportJson.click());
  fileImportJson.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if(f) importJSONFile(f);
    e.target.value = "";
  });
}

/* =========================
   URL Auto-import: prices param
========================= */
function autoImportPricesFromUrl(){
  const u = new URL(location.href);
  let token = u.searchParams.get("prices");
  if(!token && u.hash && u.hash.includes("prices=")){
    token = u.hash.split("prices=")[1] || "";
  }
  if(token){
    const payload = lzDecompressParam(token);
    if(payload){
      const ok = importPricesFromPayload(payload);
      setMini("#pricesMsg", ok ? "✅ Precios aplicados desde link" : "❌ Precios link inválido");
      // limpiar hash para que no reimporte
      try{
        u.searchParams.delete("prices");
        history.replaceState(null, "", u.pathname + u.search);
      }catch(e){}
    }
  }
}

/* =========================
   Render all
========================= */
function renderAll(){
  renderProductsDatalist();

  // clientes
  currentClientId = DB.clients[0]?.id || null;
  renderClientsList();
  if(currentClientId){
    fillClientEditor(DB.clients.find(c => c.id === currentClientId));
  }

  // productos
  currentProdId = DB.products[0]?.id || null;
  renderProdList();
  if(currentProdId){
    fillProdEditor(DB.products.find(p => p.id === currentProdId));
  }

  // contabilidad
  renderAccClientSelect();
  clearAccUI();

  // ajustes
  renderSettings();

  // facturas
  if(DB.invoices.length === 0){
    const inv = newInvoiceSkeleton();
    upsertInvoice(inv);
  }
  currentInvoiceId = DB.invoices[0]?.id || null;
  renderInvoiceList();
  if(currentInvoiceId){
    renderInvoice(getInvoiceById(currentInvoiceId));
  }

  // Mode pill
  elPillMode.textContent = "Modo local";
  setMini("#dbState", `Local OK • ${DB.invoices.length} facturas • ${DB.clients.length} clientes • ${DB.products.length} productos`);
}

/* =========================
   INIT
========================= */
(function init(){
  loadLocal();
  // si no hay productos, dejamos vacío; el usuario puede “Cargar vocabulario”
  saveLocal();

  bindInvoiceMeta();
  bindClientsUI();
  bindProductsUI();
  bindAccountingUI();
  bindSettingsUI();
  bindCloudUI();
  bindJsonUI();
  bindPricesPageButton();

  invSearch.addEventListener("input", renderInvoiceList);

  autoImportPricesFromUrl();
  renderAll();
})();
