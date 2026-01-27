/* =========================================================
   ARSLAN • FACTURAS PRO — KIWI Edition (B/W)
   ✅ Offline FIRST (sin nube funciona)
   ✅ Nube Firebase opcional (login + sync + guardar PDFs)
   ✅ Clientes / Proveedor SIEMPRE cargan (defaults)
   ✅ Facturas GRID PRO sin scroll horizontal
   ✅ Autocomplete NO sustituye: flechas + Enter
   ✅ Productos: precio/coste/kg-caja + historial últimas 5 (solo pantalla)
   ✅ Contabilidad (PIN) + tags + márgenes estimados
========================================================= */

const APP = {
  name: "ARSLAN • FACTURAS",
  ver: "KIWI-BW-1.0",
  storageKey: "arslan_facturas_kiwi_bw_v1",
  cloudRootDefault: "arslan_facturas_kiwi_bw",
};

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const now = () => Date.now();
const uid = (p = "id") => `${p}_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
const pad2 = (n) => String(n).padStart(2, "0");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toInput(n) {
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return String(x).replace(".", ",");
}

function parseNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function euro(n) {
  const x = Number(n);
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function invoiceNumber(prefix = "FA-") {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${prefix}${y}${m}${da}${h}${mi}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* =========================
   VOCABULARIO (AUTOCOMPLETE)
   - NO sustituye automático
   - Solo sugerencias
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

function normalizeName(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

const VOCAB = Array.from(
  new Set(
    VOCAB_RAW.split("\n")
      .map((x) => normalizeName(x))
      .filter(Boolean)
  )
);

/* =========================
   DEFAULTS: PROVEEDOR / CLIENTES
========================= */
function defaultSettings() {
  return {
    taxRate: 0.04,
    prefix: "FA-",
    pin: "7392",
    qrBase: "AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}",
    provider: {
      name: "Mohammad Arslan Waris",
      nif: "X6389988J",
      addr: "Calle San Pablo 17, 09002, Burgos",
      phone: "631667893",
      email: "shaniwaris80@gmail.com",
      iban: "",
      bic: "",
      city: "Burgos",
    },
    firebase: {
      enabled: false,
      apiKey: "",
      authDomain: "",
      databaseURL: "",
      projectId: "",
      storageBucket: "",
      appId: "",
      cloudRoot: APP.cloudRootDefault,
    },
  };
}

function defaultClients() {
  return [
    {
      id: "cli_general",
      name: "CLIENTE GENERAL",
      nif: "",
      addr: "",
      phone: "",
      email: "",
      tags: "",
      vatIncluded: false,
    },
    {
      id: "cli_goldengarden",
      name: "Golden Garden",
      nif: "71281665L",
      addr: "Trinidad, 12, 09003, Burgos",
      phone: "",
      email: "",
      tags: "GoldenGarden",
      vatIncluded: true, // (tu formato guardado: IVA incluido, sin desglose)
    },
    {
      id: "cli_consentidos",
      name: "Con/sentidos",
      nif: "B10694792",
      addr: "C/ San Lesmes, 1 - 09004 Burgos",
      phone: "947 20 35 51",
      email: "",
      tags: "Con/sentidos",
      vatIncluded: false,
    },
    {
      id: "cli_alesalpan",
      name: "ALESAL PAN / CAFÉ DE CALLE SAN LESMES",
      nif: "B09582420",
      addr: "Calle San Lesmes 1, Burgos",
      phone: "",
      email: "",
      tags: "Alesal",
      vatIncluded: false,
    },
    {
      id: "cli_nuovo",
      name: "CAFE BAR NUOVO",
      nif: "120221393",
      addr: "C/ San Juan de Ortega 14, 09007 Burgos",
      phone: "",
      email: "",
      tags: "NUOVO",
      vatIncluded: false,
    },
    {
      id: "cli_riviera",
      name: "RIVIERA (CONOR ESY SLU)",
      nif: "B16794893",
      addr: "Paseo del Espolón, 09003 Burgos",
      phone: "",
      email: "",
      tags: "RIVIERA",
      vatIncluded: false,
    },
    {
      id: "cli_alpanpan",
      name: "Al Pan Pan Burgos, S.L.",
      nif: "B09569344",
      addr: "C/ Miranda, 17 Bajo, 09002 Burgos",
      phone: "947277977",
      email: "bertiz.miranda@gmail.com",
      tags: "AlPanPan",
      vatIncluded: false,
    },
  ];
}

function defaultProducts() {
  return []; // se autollenan cuando guardas productos. El vocabulario es separado.
}

function emptyDb() {
  return {
    meta: { app: APP.name, ver: APP.ver, createdAt: now(), updatedAt: now() },
    settings: defaultSettings(),
    clients: defaultClients(),
    products: defaultProducts(),
    invoices: [],
  };
}

/* =========================
   LOCAL STORAGE
========================= */
function loadLocal() {
  try {
    const raw = localStorage.getItem(APP.storageKey);
    if (!raw) return emptyDb();
    const obj = JSON.parse(raw);

    // harden: si faltan cosas, reponer
    const base = emptyDb();
    const merged = {
      ...base,
      ...obj,
      meta: { ...base.meta, ...(obj.meta || {}), updatedAt: now() },
      settings: { ...base.settings, ...(obj.settings || {}) },
      clients: Array.isArray(obj.clients) ? obj.clients : base.clients,
      products: Array.isArray(obj.products) ? obj.products : base.products,
      invoices: Array.isArray(obj.invoices) ? obj.invoices : base.invoices,
    };

    // provider defaults
    merged.settings.provider = { ...base.settings.provider, ...(merged.settings.provider || {}) };
    merged.settings.firebase = { ...base.settings.firebase, ...(merged.settings.firebase || {}) };

    // normalize clients
    merged.clients = merged.clients.map((c) => ({
      id: c.id || uid("cli"),
      name: c.name || "CLIENTE",
      nif: c.nif || "",
      addr: c.addr || "",
      phone: c.phone || "",
      email: c.email || "",
      tags: c.tags || "",
      vatIncluded: !!c.vatIncluded,
    }));

    // normalize products
    merged.products = merged.products.map((p) => ({
      key: p.key || uid("prd"),
      name: p.name || "",
      unit: p.unit || "kg",
      kgPerBox: parseNum(p.kgPerBox),
      cost: parseNum(p.cost),
      price: parseNum(p.price),
      history: Array.isArray(p.history) ? p.history.slice(0, 20) : [],
    }));

    // normalize invoices
    merged.invoices = merged.invoices.map((inv) => normalizeInvoice(inv, merged));

    return merged;
  } catch (e) {
    console.error("loadLocal error", e);
    return emptyDb();
  }
}

let saveTimer = null;
function saveLocal() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      db.meta.updatedAt = now();
      localStorage.setItem(APP.storageKey, JSON.stringify(db));
      // console.log("saved");
    } catch (e) {
      console.error("saveLocal error", e);
      alert("Error guardando en localStorage. Puede estar lleno.");
    }
  }, 150);
}

/* =========================
   STATE
========================= */
let db = loadLocal();

let ui = {};
let state = {
  view: "facturas",
  invId: null,
  clientId: null,
  prodKey: null,

  accUnlocked: false,

  // cloud runtime (se rellena solo si el user usa nube)
  cloud: {
    ready: false,
    sdkLoaded: false,
    user: null,
    app: null,
    auth: null,
    rtdb: null,
    storage: null,
    lastPdfUrl: null,
  },
};

/* =========================
   NORMALIZE INVOICE
========================= */
function normalizeInvoice(inv, dbRef) {
  const settings = dbRef?.settings || defaultSettings();
  const base = {
    id: inv.id || uid("inv"),
    createdAt: inv.createdAt || now(),
    updatedAt: now(),
    dateISO: inv.dateISO || isoToday(),
    number: inv.number || invoiceNumber(settings.prefix || "FA-"),
    clientId: inv.clientId || "cli_general",
    clientNameCache: inv.clientNameCache || "",
    tags: inv.tags || "",
    notes: inv.notes || "",
    lines: Array.isArray(inv.lines) ? inv.lines : [],
    pdfUrl: inv.pdfUrl || "",
    pdfUpdatedAt: inv.pdfUpdatedAt || 0,
  };

  base.lines = base.lines.map((ln) => ({
    id: ln.id || uid("ln"),
    product: ln.product || "",
    mode: ln.mode || "kg", // kg | unidad | caja
    qty: parseNum(ln.qty),
    price: parseNum(ln.price),
    amount: parseNum(ln.amount),
    bruto: parseNum(ln.bruto),
    tara: parseNum(ln.tara),
    neto: parseNum(ln.neto),
    origin: ln.origin || "",
  }));

  // cache client name
  const cli = (dbRef?.clients || []).find((c) => c.id === base.clientId);
  base.clientNameCache = cli?.name || base.clientNameCache || "CLIENTE";

  return base;
}

/* =========================
   COMPUTE TOTALS
========================= */
function computeInvoice(inv) {
  const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];
  const taxRate = parseNum(db.settings.taxRate);

  let subtotal = 0;

  inv.lines.forEach((ln) => {
    const qty = parseNum(ln.qty);
    const price = parseNum(ln.price);
    const amount = qty * price;
    ln.amount = amount;
    subtotal += amount;
  });

  let iva = 0;
  let total = subtotal;

  if (cli?.vatIncluded) {
    // IVA incluido => solo calculamos IVA estimado interno
    iva = taxRate > 0 ? (total - total / (1 + taxRate)) : 0;
  } else {
    iva = subtotal * taxRate;
    total = subtotal + iva;
  }

  return { subtotal, iva, total };
}

/* =========================
   VIEW SWITCH
========================= */
function setView(view) {
  state.view = view;

  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));

  const sections = ["facturas", "clientes", "productos", "contabilidad", "ajustes"];
  sections.forEach((v) => {
    const el = $(`#view-${v}`);
    if (el) el.style.display = v === view ? "" : "none";
  });

  // gate accounting
  if (view === "contabilidad") {
    refreshAccountingStatus();
  }
}

function refreshAccountingStatus() {
  const pill = $("#accStatus");
  if (!pill) return;
  pill.textContent = state.accUnlocked ? "Desbloqueado" : "Bloqueado";
}

/* =========================
   UI INIT + BINDINGS
========================= */
function cacheUi() {
  ui = {
    cloudPill: $("#cloudPill"),
    btnLogin: $("#btnLogin"),
    btnLogout: $("#btnLogout"),
    btnSync: $("#btnSync"),

    btnExport: $("#btnExport"),
    fileImport: $("#fileImport"),

    nav: $("#nav"),

    // modals
    loginModal: $("#loginModal"),
    loginEmail: $("#loginEmail"),
    loginPass: $("#loginPass"),
    loginMsg: $("#loginMsg"),
    btnLoginDo: $("#btnLoginDo"),
    btnSignupDo: $("#btnSignupDo"),
    btnLoginClose: $("#btnLoginClose"),

    pinModal: $("#pinModal"),
    pinInput: $("#pinInput"),
    pinMsg: $("#pinMsg"),
    btnPinOk: $("#btnPinOk"),
    btnPinCancel: $("#btnPinCancel"),

    // facturas
    invSearch: $("#invSearch"),
    btnClearSearch: $("#btnClearSearch"),
    invList: $("#invList"),
    invCount: $("#invCount"),
    invDraftCount: $("#invDraftCount"),

    btnNewInvoice: $("#btnNewInvoice"),
    btnDuplicateInvoice: $("#btnDuplicateInvoice"),
    btnDeleteInvoice: $("#btnDeleteInvoice"),

    invTitle: $("#invTitle"),
    invMeta: $("#invMeta"),
    invClient: $("#invClient"),
    invDate: $("#invDate"),
    invNumber: $("#invNumber"),
    invTags: $("#invTags"),
    invNotes: $("#invNotes"),
    clientInfo: $("#clientInfo"),

    btnSaveInvoice: $("#btnSaveInvoice"),
    btnAddLine: $("#btnAddLine"),
    lines: $("#lines"),

    tSubtotal: $("#tSubtotal"),
    tIVA: $("#tIVA"),
    tTotal: $("#tTotal"),

    btnPDF: $("#btnPDF"),
    btnPDFUpload: $("#btnPDFUpload"),
    btnWhatsApp: $("#btnWhatsApp"),
    pdfState: $("#pdfState"),
    btnOpenPdf: $("#btnOpenPdf"),
    btnCopyPdf: $("#btnCopyPdf"),

    // clientes
    btnNewClient: $("#btnNewClient"),
    clientSearch: $("#clientSearch"),
    clientList: $("#clientList"),
    clientTitle: $("#clientTitle"),
    clientId: $("#clientId"),
    btnSaveClient: $("#btnSaveClient"),
    btnDeleteClient: $("#btnDeleteClient"),
    cName: $("#cName"),
    cNif: $("#cNif"),
    cAddr: $("#cAddr"),
    cPhone: $("#cPhone"),
    cEmail: $("#cEmail"),
    cTags: $("#cTags"),

    // productos
    btnNewProduct: $("#btnNewProduct"),
    prodSearch: $("#prodSearch"),
    prodList: $("#prodList"),
    prodTitle: $("#prodTitle"),
    prodKey: $("#prodKey"),
    btnSaveProduct: $("#btnSaveProduct"),
    btnDeleteProduct: $("#btnDeleteProduct"),
    pName: $("#pName"),
    pUnit: $("#pUnit"),
    pKgBox: $("#pKgBox"),
    pCost: $("#pCost"),
    pPrice: $("#pPrice"),
    pHist: $("#pHist"),

    // contabilidad
    btnUnlock: $("#btnUnlock"),
    btnLock: $("#btnLock"),
    accFrom: $("#accFrom"),
    accTo: $("#accTo"),
    accClient: $("#accClient"),
    accTag: $("#accTag"),
    btnAccRun: $("#btnAccRun"),
    accSales: $("#accSales"),
    accIva: $("#accIva"),
    accN: $("#accN"),
    accMargin: $("#accMargin"),
    accTable: $("#accTable"),

    // ajustes
    btnSaveSettings: $("#btnSaveSettings"),
    sProvName: $("#sProvName"),
    sProvNif: $("#sProvNif"),
    sProvAddr: $("#sProvAddr"),
    sProvPhone: $("#sProvPhone"),
    sProvEmail: $("#sProvEmail"),
    sProvIban: $("#sProvIban"),
    sProvBic: $("#sProvBic"),
    sProvCity: $("#sProvCity"),
    sTaxRate: $("#sTaxRate"),
    sPrefix: $("#sPrefix"),
    sPin: $("#sPin"),
    sQrBase: $("#sQrBase"),

    fbApiKey: $("#fbApiKey"),
    fbAuthDomain: $("#fbAuthDomain"),
    fbDbUrl: $("#fbDbUrl"),
    fbProjectId: $("#fbProjectId"),
    fbStorage: $("#fbStorage"),
    fbAppId: $("#fbAppId"),
  };
}

function bindNav() {
  $$(".nav-btn").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.view));
  });
}

function safeShow(el, yes) {
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

/* =========================
   RENDER: SELECTS (CLIENTS)
========================= */
function renderClientSelects() {
  // invoice select
  if (ui.invClient) {
    ui.invClient.innerHTML = db.clients
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join("");
  }

  // accounting select
  if (ui.accClient) {
    ui.accClient.innerHTML =
      `<option value="">(Todos)</option>` +
      db.clients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
        .join("");
  }
}

/* =========================
   FACTURAS CRUD
========================= */
function newInvoice() {
  const inv = normalizeInvoice(
    {
      id: uid("inv"),
      createdAt: now(),
      dateISO: isoToday(),
      number: invoiceNumber(db.settings.prefix || "FA-"),
      clientId: "cli_general",
      tags: "",
      notes: "",
      lines: [
        {
          id: uid("ln"),
          product: "",
          mode: "kg",
          qty: 0,
          price: 0,
          bruto: 0,
          tara: 0,
          neto: 0,
          origin: "",
        },
      ],
    },
    db
  );

  db.invoices.unshift(inv);
  state.invId = inv.id;
  saveLocal();
  renderInvoices();
  openInvoice(inv.id);
}

function duplicateInvoice() {
  const inv = getCurrentInvoice();
  if (!inv) return alert("No hay factura seleccionada.");
  const copy = deepClone(inv);
  copy.id = uid("inv");
  copy.createdAt = now();
  copy.updatedAt = now();
  copy.number = invoiceNumber(db.settings.prefix || "FA-");
  copy.pdfUrl = "";
  copy.pdfUpdatedAt = 0;
  copy.lines = copy.lines.map((ln) => ({ ...ln, id: uid("ln") }));
  db.invoices.unshift(copy);
  state.invId = copy.id;
  saveLocal();
  renderInvoices();
  openInvoice(copy.id);
}

function deleteInvoice() {
  const inv = getCurrentInvoice();
  if (!inv) return;
  const ok = confirm(`Eliminar factura ${inv.number}?`);
  if (!ok) return;

  db.invoices = db.invoices.filter((x) => x.id !== inv.id);
  state.invId = db.invoices[0]?.id || null;
  saveLocal();
  renderInvoices();
  if (state.invId) openInvoice(state.invId);
  else clearInvoiceEditor();
}

function getCurrentInvoice() {
  return db.invoices.find((x) => x.id === state.invId) || null;
}

function clearInvoiceEditor() {
  if (ui.invTitle) ui.invTitle.textContent = "Factura";
  if (ui.invMeta) ui.invMeta.textContent = "—";
  if (ui.lines) ui.lines.innerHTML = "";
  if (ui.tSubtotal) ui.tSubtotal.textContent = euro(0);
  if (ui.tIVA) ui.tIVA.textContent = euro(0);
  if (ui.tTotal) ui.tTotal.textContent = euro(0);
  if (ui.pdfState) ui.pdfState.textContent = "—";
  if (ui.btnOpenPdf) ui.btnOpenPdf.disabled = true;
  if (ui.btnCopyPdf) ui.btnCopyPdf.disabled = true;
}

function renderInvoices() {
  // counts
  if (ui.invCount) ui.invCount.textContent = `${db.invoices.length} facturas`;

  // draft count (sin cliente o sin líneas)
  const drafts = db.invoices.filter((inv) => !inv.clientId || (inv.lines || []).length === 0);
  if (ui.invDraftCount) ui.invDraftCount.textContent = `${drafts.length} borradores`;

  const q = (ui.invSearch?.value || "").trim().toUpperCase();
  const list = db.invoices.filter((inv) => {
    if (!q) return true;
    const s = `${inv.number} ${inv.dateISO} ${inv.clientNameCache} ${inv.tags}`.toUpperCase();
    return s.includes(q);
  });

  if (!ui.invList) return;
  ui.invList.innerHTML = list
    .map((inv) => {
      const sel = inv.id === state.invId;
      const cli = db.clients.find((c) => c.id === inv.clientId);
      const { total } = computeInvoice(inv);
      return `
        <div class="item" data-id="${escapeHtml(inv.id)}" style="${sel ? "border-color:#111;" : ""}">
          <div class="t">${escapeHtml(inv.number)}</div>
          <div class="s">
            <span class="badge">${escapeHtml(inv.dateISO)}</span>
            <span class="badge">${escapeHtml(cli?.name || inv.clientNameCache || "CLIENTE")}</span>
            <span class="badge">${escapeHtml((inv.tags||"").slice(0,40))}</span>
            <span class="badge">${escapeHtml(euro(total))}</span>
            ${inv.pdfUrl ? `<span class="badge">PDF</span>` : ``}
          </div>
        </div>
      `;
    })
    .join("");

  $$(".item", ui.invList).forEach((it) => {
    it.addEventListener("click", () => openInvoice(it.dataset.id));
  });
}

function openInvoice(id) {
  const inv = db.invoices.find((x) => x.id === id);
  if (!inv) return;

  state.invId = inv.id;

  // normalize again (seguro)
  const norm = normalizeInvoice(inv, db);
  Object.assign(inv, norm);

  const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];

  if (ui.invTitle) ui.invTitle.textContent = `Factura`;
  if (ui.invMeta) ui.invMeta.textContent = `${inv.number} · ${cli.name} · ${inv.dateISO}`;

  if (ui.invClient) ui.invClient.value = inv.clientId;
  if (ui.invDate) ui.invDate.value = inv.dateISO;
  if (ui.invNumber) ui.invNumber.value = inv.number;
  if (ui.invTags) ui.invTags.value = inv.tags || "";
  if (ui.invNotes) ui.invNotes.value = inv.notes || "";

  if (ui.clientInfo) ui.clientInfo.textContent = `${cli.nif || ""} ${cli.addr || ""}`.trim() || "—";

  renderLines(inv);
  renderTotals(inv);
  renderPdfState(inv);

  renderInvoices();
}

function renderTotals(inv) {
  const { subtotal, iva, total } = computeInvoice(inv);
  if (ui.tSubtotal) ui.tSubtotal.textContent = euro(subtotal);
  if (ui.tIVA) ui.tIVA.textContent = euro(iva);
  if (ui.tTotal) ui.tTotal.textContent = euro(total);
}

function renderPdfState(inv) {
  if (!ui.pdfState) return;
  if (inv.pdfUrl) {
    ui.pdfState.innerHTML = `✅ PDF guardado<br><span class="muted">${escapeHtml(inv.pdfUrl)}</span>`;
    if (ui.btnOpenPdf) ui.btnOpenPdf.disabled = false;
    if (ui.btnCopyPdf) ui.btnCopyPdf.disabled = false;
  } else {
    ui.pdfState.textContent = "—";
    if (ui.btnOpenPdf) ui.btnOpenPdf.disabled = true;
    if (ui.btnCopyPdf) ui.btnCopyPdf.disabled = true;
  }
}

/* =========================
   AUTOCOMPLETE (NO sustituye)
========================= */
function getSuggestions(query) {
  const q = normalizeName(query);
  if (!q) return [];

  // pool: vocab + productos guardados
  const prodNames = db.products.map((p) => normalizeName(p.name)).filter(Boolean);
  const pool = Array.from(new Set([...VOCAB, ...prodNames]));

  // match: startsWith first, then includes
  const starts = [];
  const includes = [];

  for (const item of pool) {
    if (item.startsWith(q)) starts.push(item);
    else if (item.includes(q)) includes.push(item);
    if (starts.length >= 18 && includes.length >= 18) break;
  }

  return [...starts.slice(0, 18), ...includes.slice(0, 12)];
}

function attachAutocomplete(inputEl, onPick) {
  if (!inputEl) return;

  const wrap = inputEl.closest(".ac-wrap");
  if (!wrap) return;

  const box = $(".ac", wrap);
  if (!box) return;

  let active = -1;
  let current = [];

  function hide() {
    box.style.display = "none";
    box.innerHTML = "";
    active = -1;
    current = [];
  }

  function show(list) {
    current = list.slice(0, 30);
    active = -1;

    if (current.length === 0) return hide();

    box.innerHTML = current
      .map((x, i) => `<div class="ac-item" data-i="${i}">${escapeHtml(x)}</div>`)
      .join("");
    box.style.display = "block";

    $$(".ac-item", box).forEach((it) => {
      it.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const i = Number(it.dataset.i);
        const val = current[i];
        if (val) {
          inputEl.value = val;
          hide();
          onPick?.(val);
        }
      });
    });
  }

  function updateActive() {
    const items = $$(".ac-item", box);
    items.forEach((it, i) => it.classList.toggle("active", i === active));
    if (active >= 0 && items[active]) {
      items[active].scrollIntoView({ block: "nearest" });
    }
  }

  inputEl.addEventListener("input", () => {
    const list = getSuggestions(inputEl.value);
    show(list);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (box.style.display !== "block") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = clamp(active + 1, 0, current.length - 1);
      updateActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = clamp(active - 1, 0, current.length - 1);
      updateActive();
    } else if (e.key === "Enter") {
      if (active >= 0 && current[active]) {
        e.preventDefault();
        inputEl.value = current[active];
        const val = current[active];
        hide();
        onPick?.(val);
      }
    } else if (e.key === "Escape") {
      hide();
    }
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });
}

/* =========================
   FACTURAS: LÍNEAS GRID PRO
========================= */
function renderLines(inv) {
  if (!ui.lines) return;

  ui.lines.innerHTML = "";
  inv.lines.forEach((ln) => {
    const row = document.createElement("div");
    row.className = "line";
    row.dataset.id = ln.id;

    row.innerHTML = `
      <div class="cell-prod ac-wrap">
        <input class="prod" data-k="product" placeholder="Producto" value="${escapeHtml(ln.product||"")}" autocomplete="off"/>
        <div class="ac"></div>
      </div>

      <div class="cell-mode">
        <select data-k="mode" title="Modo">
          <option value="kg" ${ln.mode==="kg"?"selected":""}>kg</option>
          <option value="unidad" ${ln.mode==="unidad"?"selected":""}>ud</option>
          <option value="caja" ${ln.mode==="caja"?"selected":""}>caja</option>
        </select>
      </div>

      <div class="cell-qty">
        <input data-k="qty" inputmode="decimal" placeholder="Cant" value="${toInput(ln.qty)}"/>
      </div>

      <div class="cell-price">
        <input data-k="price" inputmode="decimal" placeholder="Precio" value="${toInput(ln.price)}"/>
      </div>

      <div class="cell-amount money">${euro(ln.amount||0)}</div>

      <div class="cell-del">
        <button class="icon-btn danger" title="Eliminar">✖</button>
      </div>

      <div class="cell-bruto">
        <input data-k="bruto" inputmode="decimal" placeholder="Bruto" value="${toInput(ln.bruto)}"/>
      </div>

      <div class="cell-tara">
        <input data-k="tara" inputmode="decimal" placeholder="Tara" value="${toInput(ln.tara)}"/>
      </div>

      <div class="cell-neto">
        <input data-k="neto" inputmode="decimal" placeholder="Neto" value="${toInput(ln.neto)}"/>
      </div>

      <div class="cell-origin">
        <input data-k="origin" placeholder="Origen" value="${escapeHtml(ln.origin||"")}"/>
      </div>
    `;

    // delete line
    $(".icon-btn", row).addEventListener("click", () => {
      inv.lines = inv.lines.filter((x) => x.id !== ln.id);
      if (inv.lines.length === 0) inv.lines.push(makeEmptyLine());
      inv.updatedAt = now();
      saveLocal();
      renderLines(inv);
      renderTotals(inv);
    });

    // autocomplete product
    const prodInput = $('input[data-k="product"]', row);
    attachAutocomplete(prodInput, (picked) => {
      ln.product = normalizeName(picked);

      // productos inteligentes: aplica precio/ud/kgCaja si existe
      const p = findProductByName(ln.product);
      if (p) {
        if (p.unit === "ud") ln.mode = "unidad";
        else if (p.unit === "caja") ln.mode = "caja";
        else ln.mode = "kg";

        // usa precio sugerido solo en pantalla (el usuario puede cambiar)
        if (!ln.price || ln.price === 0) ln.price = parseNum(p.price);
      }

      inv.updatedAt = now();
      saveLocal();
      // re-render para que el select mode se actualice
      renderLines(inv);
      renderTotals(inv);
    });

    // inputs binding
    $$("input[data-k], select[data-k]", row).forEach((field) => {
      field.addEventListener("input", () => {
        const k = field.dataset.k;

        if (k === "product") ln.product = normalizeName(field.value);
        else if (k === "mode") ln.mode = field.value;
        else if (k === "origin") ln.origin = field.value;
        else ln[k] = parseNum(field.value);

        inv.updatedAt = now();
        const { subtotal, iva, total } = computeInvoice(inv);

        // update amount cell only
        $(".cell-amount", row).textContent = euro(ln.amount || 0);
        if (ui.tSubtotal) ui.tSubtotal.textContent = euro(subtotal);
        if (ui.tIVA) ui.tIVA.textContent = euro(iva);
        if (ui.tTotal) ui.tTotal.textContent = euro(total);

        saveLocal();
      });

      field.addEventListener("change", () => {
        // para selects
        const k = field.dataset.k;
        if (k === "mode") {
          ln.mode = field.value;
          inv.updatedAt = now();
          saveLocal();
        }
      });
    });

    ui.lines.appendChild(row);
  });
}

function makeEmptyLine() {
  return {
    id: uid("ln"),
    product: "",
    mode: "kg",
    qty: 0,
    price: 0,
    amount: 0,
    bruto: 0,
    tara: 0,
    neto: 0,
    origin: "",
  };
}

function addLine() {
  const inv = getCurrentInvoice();
  if (!inv) return;
  inv.lines.push(makeEmptyLine());
  inv.updatedAt = now();
  saveLocal();
  renderLines(inv);
}

/* =========================
   PRODUCTS: find by name
========================= */
function findProductByName(nameUpper) {
  const n = normalizeName(nameUpper);
  if (!n) return null;
  // exact match on normalized name
  return db.products.find((p) => normalizeName(p.name) === n) || null;
}

/* =========================
   CLIENTES VIEW
========================= */
function renderClients() {
  const q = (ui.clientSearch?.value || "").trim().toUpperCase();
  const list = db.clients
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .filter((c) => {
      if (!q) return true;
      return `${c.name} ${c.nif} ${c.addr}`.toUpperCase().includes(q);
    });

  if (!ui.clientList) return;
  ui.clientList.innerHTML = list
    .map((c) => {
      const sel = c.id === state.clientId;
      return `
        <div class="item" data-id="${escapeHtml(c.id)}" style="${sel ? "border-color:#111;" : ""}">
          <div class="t">${escapeHtml(c.name)}</div>
          <div class="s">
            <span class="badge">${escapeHtml(c.nif || "")}</span>
            <span class="badge">${escapeHtml((c.tags||"").slice(0,40))}</span>
          </div>
        </div>
      `;
    })
    .join("");

  $$(".item", ui.clientList).forEach((it) => {
    it.addEventListener("click", () => openClient(it.dataset.id));
  });
}

function newClient() {
  const c = {
    id: uid("cli"),
    name: "NUEVO CLIENTE",
    nif: "",
    addr: "",
    phone: "",
    email: "",
    tags: "",
    vatIncluded: false,
  };
  db.clients.push(c);
  state.clientId = c.id;
  saveLocal();
  renderClientSelects();
  renderClients();
  openClient(c.id);
}

function openClient(id) {
  const c = db.clients.find((x) => x.id === id);
  if (!c) return;
  state.clientId = c.id;
  if (ui.clientTitle) ui.clientTitle.textContent = c.name;
  if (ui.clientId) ui.clientId.textContent = c.id;

  if (ui.cName) ui.cName.value = c.name || "";
  if (ui.cNif) ui.cNif.value = c.nif || "";
  if (ui.cAddr) ui.cAddr.value = c.addr || "";
  if (ui.cPhone) ui.cPhone.value = c.phone || "";
  if (ui.cEmail) ui.cEmail.value = c.email || "";
  if (ui.cTags) ui.cTags.value = c.tags || "";

  renderClients();
}

function saveClient() {
  const c = db.clients.find((x) => x.id === state.clientId);
  if (!c) return;

  c.name = (ui.cName?.value || "").trim() || "CLIENTE";
  c.nif = (ui.cNif?.value || "").trim();
  c.addr = (ui.cAddr?.value || "").trim();
  c.phone = (ui.cPhone?.value || "").trim();
  c.email = (ui.cEmail?.value || "").trim();
  c.tags = (ui.cTags?.value || "").trim();

  saveLocal();
  renderClientSelects();
  renderClients();

  // refresh invoice cache names
  db.invoices.forEach((inv) => {
    if (inv.clientId === c.id) inv.clientNameCache = c.name;
  });
  saveLocal();

  alert("Cliente guardado.");
}

function deleteClient() {
  const c = db.clients.find((x) => x.id === state.clientId);
  if (!c) return;
  if (c.id === "cli_general") return alert("No se puede borrar CLIENTE GENERAL.");

  const ok = confirm(`Eliminar cliente ${c.name}?`);
  if (!ok) return;

  db.clients = db.clients.filter((x) => x.id !== c.id);

  // reasignar facturas que usaban ese clientId
  db.invoices.forEach((inv) => {
    if (inv.clientId === c.id) {
      inv.clientId = "cli_general";
      inv.clientNameCache = "CLIENTE GENERAL";
    }
  });

  state.clientId = db.clients[0]?.id || null;
  saveLocal();
  renderClientSelects();
  renderClients();
  if (state.clientId) openClient(state.clientId);
}

/* =========================
   PRODUCTOS VIEW (CATÁLOGO)
========================= */
function renderProducts() {
  const q = normalizeName(ui.prodSearch?.value || "");
  const list = db.products
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"))
    .filter((p) => {
      if (!q) return true;
      return normalizeName(p.name).includes(q);
    });

  if (!ui.prodList) return;
  ui.prodList.innerHTML = list
    .map((p) => {
      const sel = p.key === state.prodKey;
      return `
        <div class="item" data-key="${escapeHtml(p.key)}" style="${sel ? "border-color:#111;" : ""}">
          <div class="t">${escapeHtml(p.name || "(sin nombre)")}</div>
          <div class="s">
            <span class="badge">${escapeHtml(p.unit || "kg")}</span>
            <span class="badge">kg/caja: ${escapeHtml(String(p.kgPerBox||0))}</span>
            <span class="badge">coste: ${escapeHtml(euro(p.cost||0))}</span>
            <span class="badge">precio: ${escapeHtml(euro(p.price||0))}</span>
          </div>
        </div>
      `;
    })
    .join("");

  $$(".item", ui.prodList).forEach((it) => {
    it.addEventListener("click", () => openProduct(it.dataset.key));
  });
}

function newProduct() {
  const p = {
    key: uid("prd"),
    name: "NUEVO PRODUCTO",
    unit: "kg",
    kgPerBox: 0,
    cost: 0,
    price: 0,
    history: [],
  };
  db.products.push(p);
  state.prodKey = p.key;
  saveLocal();
  renderProducts();
  openProduct(p.key);
}

function openProduct(key) {
  const p = db.products.find((x) => x.key === key);
  if (!p) return;
  state.prodKey = p.key;

  if (ui.prodTitle) ui.prodTitle.textContent = p.name || "Producto";
  if (ui.prodKey) ui.prodKey.textContent = p.key;

  if (ui.pName) ui.pName.value = p.name || "";
  if (ui.pUnit) ui.pUnit.value = p.unit || "kg";
  if (ui.pKgBox) ui.pKgBox.value = toInput(p.kgPerBox || 0);
  if (ui.pCost) ui.pCost.value = toInput(p.cost || 0);
  if (ui.pPrice) ui.pPrice.value = toInput(p.price || 0);

  if (ui.pHist) ui.pHist.innerHTML = renderHistory(p.history);

  renderProducts();
}

function renderHistory(hist) {
  if (!hist || hist.length === 0) return "—";
  const last = hist.slice(0, 5);
  return last
    .map((h) => {
      const d = new Date(h.ts || 0);
      const ds = isNaN(d.getTime()) ? "" : d.toLocaleString("es-ES");
      return `• ${escapeHtml(ds)} — precio ${escapeHtml(euro(h.price||0))}, coste ${escapeHtml(euro(h.cost||0))}, kg/caja ${escapeHtml(String(h.kgPerBox||0))}`;
    })
    .join("<br>");
}

function saveProduct() {
  const p = db.products.find((x) => x.key === state.prodKey);
  if (!p) return;

  // push history snapshot
  const snap = { ts: now(), price: p.price, cost: p.cost, kgPerBox: p.kgPerBox };
  p.history = [snap, ...(p.history || [])].slice(0, 20);

  p.name = normalizeName(ui.pName?.value || "") || "PRODUCTO";
  p.unit = ui.pUnit?.value || "kg";
  p.kgPerBox = parseNum(ui.pKgBox?.value);
  p.cost = parseNum(ui.pCost?.value);
  p.price = parseNum(ui.pPrice?.value);

  saveLocal();
  renderProducts();

  // si hay factura abierta, refresca autocomplete pool
  const inv = getCurrentInvoice();
  if (inv) renderLines(inv);

  alert("Producto guardado.");
}

function deleteProduct() {
  const p = db.products.find((x) => x.key === state.prodKey);
  if (!p) return;
  const ok = confirm(`Eliminar producto ${p.name}?`);
  if (!ok) return;

  db.products = db.products.filter((x) => x.key !== p.key);
  state.prodKey = db.products[0]?.key || null;
  saveLocal();
  renderProducts();
  if (state.prodKey) openProduct(state.prodKey);
}

/* =========================
   AJUSTES VIEW
========================= */
function loadSettingsToUI() {
  const s = db.settings;

  if (ui.sProvName) ui.sProvName.value = s.provider.name || "";
  if (ui.sProvNif) ui.sProvNif.value = s.provider.nif || "";
  if (ui.sProvAddr) ui.sProvAddr.value = s.provider.addr || "";
  if (ui.sProvPhone) ui.sProvPhone.value = s.provider.phone || "";
  if (ui.sProvEmail) ui.sProvEmail.value = s.provider.email || "";
  if (ui.sProvIban) ui.sProvIban.value = s.provider.iban || "";
  if (ui.sProvBic) ui.sProvBic.value = s.provider.bic || "";
  if (ui.sProvCity) ui.sProvCity.value = s.provider.city || "";

  if (ui.sTaxRate) ui.sTaxRate.value = toInput(s.taxRate);
  if (ui.sPrefix) ui.sPrefix.value = s.prefix || "FA-";
  if (ui.sPin) ui.sPin.value = s.pin || "7392";
  if (ui.sQrBase) ui.sQrBase.value = s.qrBase || "";

  if (ui.fbApiKey) ui.fbApiKey.value = s.firebase.apiKey || "";
  if (ui.fbAuthDomain) ui.fbAuthDomain.value = s.firebase.authDomain || "";
  if (ui.fbDbUrl) ui.fbDbUrl.value = s.firebase.databaseURL || "";
  if (ui.fbProjectId) ui.fbProjectId.value = s.firebase.projectId || "";
  if (ui.fbStorage) ui.fbStorage.value = s.firebase.storageBucket || "";
  if (ui.fbAppId) ui.fbAppId.value = s.firebase.appId || "";
}

function saveSettingsFromUI() {
  const s = db.settings;

  s.provider.name = (ui.sProvName?.value || "").trim();
  s.provider.nif = (ui.sProvNif?.value || "").trim();
  s.provider.addr = (ui.sProvAddr?.value || "").trim();
  s.provider.phone = (ui.sProvPhone?.value || "").trim();
  s.provider.email = (ui.sProvEmail?.value || "").trim();
  s.provider.iban = (ui.sProvIban?.value || "").trim();
  s.provider.bic = (ui.sProvBic?.value || "").trim();
  s.provider.city = (ui.sProvCity?.value || "").trim();

  s.taxRate = parseNum(ui.sTaxRate?.value);
  s.prefix = (ui.sPrefix?.value || "FA-").trim();
  s.pin = (ui.sPin?.value || "7392").trim();
  s.qrBase = (ui.sQrBase?.value || "").trim();

  s.firebase.apiKey = (ui.fbApiKey?.value || "").trim();
  s.firebase.authDomain = (ui.fbAuthDomain?.value || "").trim();
  s.firebase.databaseURL = (ui.fbDbUrl?.value || "").trim();
  s.firebase.projectId = (ui.fbProjectId?.value || "").trim();
  s.firebase.storageBucket = (ui.fbStorage?.value || "").trim();
  s.firebase.appId = (ui.fbAppId?.value || "").trim();
  s.firebase.cloudRoot = APP.cloudRootDefault;

  // enabled if minimum fields present
  s.firebase.enabled = !!(s.firebase.apiKey && s.firebase.authDomain && s.firebase.databaseURL && s.firebase.projectId && s.firebase.storageBucket && s.firebase.appId);

  saveLocal();
  updateCloudPill();
  alert("Ajustes guardados.");
}

function updateCloudPill() {
  if (!ui.cloudPill) return;

  const enabled = !!db.settings.firebase.enabled;
  if (!enabled) {
    ui.cloudPill.textContent = "Modo local";
    safeShow(ui.btnLogin, false);
    safeShow(ui.btnLogout, false);
    safeShow(ui.btnSync, false);
    return;
  }

  if (state.cloud.user) {
    ui.cloudPill.textContent = `Nube: ${state.cloud.user.email || "OK"}`;
    safeShow(ui.btnLogin, false);
    safeShow(ui.btnLogout, true);
    safeShow(ui.btnSync, true);
  } else {
    ui.cloudPill.textContent = "Nube lista (sin login)";
    safeShow(ui.btnLogin, true);
    safeShow(ui.btnLogout, false);
    safeShow(ui.btnSync, false);
  }
}

/* =========================
   EXPORT / IMPORT (solo local)
========================= */
function exportJson() {
  const data = deepClone(db);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `arslan_facturas_export_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 300);
}

async function importJsonFile(file) {
  if (!file) return;
  const text = await file.text();
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return alert("JSON inválido.");
  }
  if (!obj || typeof obj !== "object") return alert("JSON inválido.");

  // merge básico: conserva settings/provider si faltan
  const base = emptyDb();
  const incoming = {
    ...base,
    ...obj,
    settings: { ...base.settings, ...(obj.settings || {}) },
    clients: Array.isArray(obj.clients) ? obj.clients : base.clients,
    products: Array.isArray(obj.products) ? obj.products : base.products,
    invoices: Array.isArray(obj.invoices) ? obj.invoices : base.invoices,
  };

  incoming.settings.provider = { ...base.settings.provider, ...(incoming.settings.provider || {}) };
  incoming.settings.firebase = { ...base.settings.firebase, ...(incoming.settings.firebase || {}) };

  db = incoming;
  db.clients = db.clients.map((c) => ({
    id: c.id || uid("cli"),
    name: c.name || "CLIENTE",
    nif: c.nif || "",
    addr: c.addr || "",
    phone: c.phone || "",
    email: c.email || "",
    tags: c.tags || "",
    vatIncluded: !!c.vatIncluded,
  }));

  db.products = db.products.length ? db.products.map((p) => ({
    key: p.key || uid("prd"),
    name: p.name || "",
    unit: p.unit || "kg",
    kgPerBox: parseNum(p.kgPerBox),
    cost: parseNum(p.cost),
    price: parseNum(p.price),
    history: Array.isArray(p.history) ? p.history.slice(0, 20) : [],
  })) : [];

  db.invoices = db.invoices.map((inv) => normalizeInvoice(inv, db));

  saveLocal();
  initRenderAll();

  alert("Importado OK.");
}

/* =========================
   BIND EVENTS (OFFLINE)
========================= */
function bindOfflineEvents() {
  // search invoices
  ui.invSearch?.addEventListener("input", renderInvoices);
  ui.btnClearSearch?.addEventListener("click", () => {
    if (ui.invSearch) ui.invSearch.value = "";
    renderInvoices();
  });

  ui.btnNewInvoice?.addEventListener("click", newInvoice);
  ui.btnDuplicateInvoice?.addEventListener("click", duplicateInvoice);
  ui.btnDeleteInvoice?.addEventListener("click", deleteInvoice);

  ui.btnAddLine?.addEventListener("click", addLine);

  // invoice header fields
  ui.invClient?.addEventListener("change", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.clientId = ui.invClient.value;
    const cli = db.clients.find((c) => c.id === inv.clientId);
    inv.clientNameCache = cli?.name || "CLIENTE";
    inv.updatedAt = now();
    saveLocal();
    openInvoice(inv.id);
  });

  ui.invDate?.addEventListener("change", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.dateISO = ui.invDate.value || isoToday();
    inv.updatedAt = now();
    saveLocal();
    openInvoice(inv.id);
  });

  ui.invNumber?.addEventListener("input", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.number = ui.invNumber.value.trim() || invoiceNumber(db.settings.prefix || "FA-");
    inv.updatedAt = now();
    saveLocal();
    renderInvoices();
    openInvoice(inv.id);
  });

  ui.invTags?.addEventListener("input", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.tags = ui.invTags.value;
    inv.updatedAt = now();
    saveLocal();
    renderInvoices();
  });

  ui.invNotes?.addEventListener("input", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.notes = ui.invNotes.value;
    inv.updatedAt = now();
    saveLocal();
  });

  ui.btnSaveInvoice?.addEventListener("click", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    inv.updatedAt = now();
    saveLocal();
    alert("Factura guardada.");
  });

  // clients
  ui.btnNewClient?.addEventListener("click", newClient);
  ui.clientSearch?.addEventListener("input", renderClients);
  ui.btnSaveClient?.addEventListener("click", saveClient);
  ui.btnDeleteClient?.addEventListener("click", deleteClient);

  // products
  ui.btnNewProduct?.addEventListener("click", newProduct);
  ui.prodSearch?.addEventListener("input", renderProducts);
  ui.btnSaveProduct?.addEventListener("click", saveProduct);
  ui.btnDeleteProduct?.addEventListener("click", deleteProduct);

  // settings
  ui.btnSaveSettings?.addEventListener("click", saveSettingsFromUI);

  // export/import
  ui.btnExport?.addEventListener("click", exportJson);
  ui.fileImport?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    await importJsonFile(f);
    e.target.value = "";
  });
}

/* =========================
   INIT RENDER
========================= */
function initRenderAll() {
  renderClientSelects();

  // default selected items
  if (!state.invId && db.invoices[0]) state.invId = db.invoices[0].id;
  if (!state.clientId && db.clients[0]) state.clientId = db.clients[0].id;
  if (!state.prodKey && db.products[0]) state.prodKey = db.products[0].key;

  renderInvoices();
  renderClients();
  renderProducts();
  loadSettingsToUI();
  updateCloudPill();

  // open current invoice or create one
  if (state.invId) openInvoice(state.invId);
  else if (db.invoices.length === 0) newInvoice();

  if (state.clientId) openClient(state.clientId);
  if (state.prodKey) openProduct(state.prodKey);
}

/* =========================
   BOOT
========================= */
function boot() {
  cacheUi();
  bindNav();
  bindOfflineEvents();
  initRenderAll();
  setView("facturas");
}

document.addEventListener("DOMContentLoaded", boot);

/* =========================================================
   PARTE 2/2 incluirá:
   ✅ PDF PRO (jsPDF+AutoTable) + QR AEAT
   ✅ WhatsApp PRO
   ✅ Contabilidad (PIN) + cálculo márgenes
   ✅ Login nube Firebase + Sync inteligente
   ✅ Guardar PDFs en Firebase Storage + link visible
========================================================= */
/* =========================================================
   PARTE 2/2
   - PDF PRO (jsPDF + AutoTable) + QR AEAT (opcional)
   - WhatsApp PRO
   - Contabilidad (PIN) + márgenes estimados
   - Firebase nube opcional (login + sync + guardar PDFs)
========================================================= */

/* =========================
   CONTABILIDAD (PIN)
========================= */
function showPinModal(msg = "—") {
  if (!ui.pinModal) return;
  ui.pinMsg.textContent = msg;
  ui.pinInput.value = "";
  ui.pinModal.style.display = "";
  setTimeout(() => ui.pinInput.focus(), 50);
}

function hidePinModal() {
  if (!ui.pinModal) return;
  ui.pinModal.style.display = "none";
}

function unlockAccounting() {
  showPinModal("Introduce PIN para desbloquear contabilidad.");
}

function lockAccounting() {
  state.accUnlocked = false;
  refreshAccountingStatus();
  alert("Contabilidad bloqueada.");
}

function bindAccountingEvents() {
  ui.btnUnlock?.addEventListener("click", unlockAccounting);
  ui.btnLock?.addEventListener("click", lockAccounting);

  ui.btnPinOk?.addEventListener("click", () => {
    const pin = (ui.pinInput.value || "").trim();
    if (pin && pin === String(db.settings.pin || "7392")) {
      state.accUnlocked = true;
      refreshAccountingStatus();
      hidePinModal();
      alert("Contabilidad desbloqueada.");
    } else {
      ui.pinMsg.textContent = "PIN incorrecto.";
      ui.pinInput.select();
    }
  });

  ui.btnPinCancel?.addEventListener("click", () => {
    hidePinModal();
  });

  ui.btnAccRun?.addEventListener("click", () => {
    if (!state.accUnlocked) return alert("Contabilidad bloqueada. Pulsa Desbloquear.");
    runAccounting();
  });

  // defaults date range
  if (ui.accFrom && !ui.accFrom.value) ui.accFrom.value = isoToday().slice(0, 8) + "01";
  if (ui.accTo && !ui.accTo.value) ui.accTo.value = isoToday();
}

function runAccounting() {
  const from = ui.accFrom?.value || "1900-01-01";
  const to = ui.accTo?.value || "2999-12-31";
  const clientId = ui.accClient?.value || "";
  const tagFilter = (ui.accTag?.value || "").trim().toUpperCase();

  const taxRate = parseNum(db.settings.taxRate);

  const rows = [];
  let sales = 0;
  let iva = 0;
  let margin = 0;

  const list = db.invoices
    .slice()
    .filter((inv) => inv.dateISO >= from && inv.dateISO <= to)
    .filter((inv) => (!clientId ? true : inv.clientId === clientId))
    .filter((inv) => {
      if (!tagFilter) return true;
      return String(inv.tags || "").toUpperCase().includes(tagFilter);
    })
    .sort((a, b) => (a.dateISO || "").localeCompare(b.dateISO || "", "es"));

  list.forEach((inv) => {
    const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];
    const totals = computeInvoice(inv);

    sales += totals.total;

    // IVA mostrado: si cliente tiene IVA incluido -> calculo interno
    iva += cli.vatIncluded ? totals.iva : totals.iva;

    // margen estimado: suma (precio - coste) * qty en líneas si hay coste en catálogo
    let invMargin = 0;
    inv.lines.forEach((ln) => {
      const p = findProductByName(ln.product);
      const cost = p ? parseNum(p.cost) : 0;
      const qty = parseNum(ln.qty);
      const price = parseNum(ln.price);
      if (qty > 0 && (price > 0 || cost > 0)) invMargin += (price - cost) * qty;
    });
    margin += invMargin;

    rows.push({
      date: inv.dateISO,
      number: inv.number,
      client: cli.name || inv.clientNameCache || "CLIENTE",
      total: totals.total,
      tags: inv.tags || "",
    });
  });

  if (ui.accSales) ui.accSales.textContent = euro(sales);
  if (ui.accIva) ui.accIva.textContent = euro(iva);
  if (ui.accN) ui.accN.textContent = String(rows.length);
  if (ui.accMargin) ui.accMargin.textContent = euro(margin);

  // table
  const tbody = $("#accTable tbody");
  if (tbody) {
    tbody.innerHTML = rows
      .map((r) => {
        return `<tr>
          <td>${escapeHtml(r.date)}</td>
          <td>${escapeHtml(r.number)}</td>
          <td>${escapeHtml(r.client)}</td>
          <td>${escapeHtml(euro(r.total))}</td>
          <td>${escapeHtml(r.tags)}</td>
        </tr>`;
      })
      .join("");
  }
}

/* =========================
   WHATSAPP PRO
========================= */
function whatsappInvoice(inv) {
  const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];
  const { subtotal, iva, total } = computeInvoice(inv);

  const lines = inv.lines
    .filter((ln) => (ln.product || "").trim() && (parseNum(ln.qty) || parseNum(ln.price)))
    .map((ln) => {
      const name = normalizeName(ln.product);
      const qty = parseNum(ln.qty);
      const price = parseNum(ln.price);
      const amount = qty * price;
      const unit = ln.mode === "unidad" ? "ud" : ln.mode;
      return `- ${qty} ${unit} ${name} × ${price.toFixed(2)} = ${amount.toFixed(2)}€`;
    })
    .join("\n");

  const taxRate = parseNum(db.settings.taxRate);
  const vatLine = cli.vatIncluded
    ? `IVA incluido en los precios (estimado ${Math.round(taxRate * 100)}%).`
    : `IVA ${Math.round(taxRate * 100)}%: ${iva.toFixed(2)}€`;

  const msg =
    `🧾 *${inv.number}*\n` +
    `📅 ${inv.dateISO}\n` +
    `👤 ${cli.name}\n` +
    (cli.nif ? `🪪 ${cli.nif}\n` : "") +
    `\n` +
    (lines ? `*Líneas:*\n${lines}\n\n` : "") +
    `Subtotal: ${subtotal.toFixed(2)}€\n` +
    `${vatLine}\n` +
    `*TOTAL: ${total.toFixed(2)}€*\n` +
    (inv.tags ? `\n🏷️ ${inv.tags}\n` : "") +
    (inv.notes ? `\n📝 ${inv.notes}\n` : "");

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* =========================
   PDF PRO (jsPDF + AutoTable)
   - Factura estructurada
   - QR AEAT opcional (si QrcodeJS existe)
   - Últimos precios: SOLO pantalla => no se imprime histórico
========================= */
function buildAeatQrText(inv, totals) {
  const s = db.settings;
  const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];

  const base = String(s.qrBase || "").trim();
  if (!base) return "";

  const txt = base
    .replaceAll("{NIF}", s.provider.nif || "")
    .replaceAll("{NUM}", inv.number || "")
    .replaceAll("{FECHA}", inv.dateISO || "")
    .replaceAll("{TOTAL}", String((totals.total || 0).toFixed(2)))
    .replaceAll("{CLIENTE_NIF}", cli.nif || "")
    .replaceAll("{CLIENTE}", cli.name || "");

  return txt;
}

function makePdf(inv, { includeQr = true } = {}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("No se cargó jsPDF. Revisa conexión o CDN.");
    return null;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = db.settings;
  const provider = s.provider || defaultSettings().provider;
  const cli = db.clients.find((c) => c.id === inv.clientId) || db.clients[0];
  const totals = computeInvoice(inv);

  // Styles
  const M = 12;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURA", M, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº: ${inv.number}`, 150, y);
  y += 7;
  doc.text(`Fecha: ${inv.dateISO}`, 150, y);

  // Provider box
  y = 26;
  doc.setDrawColor(17);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, 92, 34, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.text("Proveedor", M + 3, y + 6);
  doc.setFont("helvetica", "normal");
  const provLines = [
    provider.name || "",
    provider.nif ? `NIF: ${provider.nif}` : "",
    provider.addr || "",
    provider.city || "",
    provider.phone ? `Tel: ${provider.phone}` : "",
    provider.email ? `Email: ${provider.email}` : "",
    provider.iban ? `IBAN: ${provider.iban}` : "",
  ].filter(Boolean);
  doc.text(provLines, M + 3, y + 12);

  // Client box
  doc.roundedRect(106, y, 92, 34, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 109, y + 6);
  doc.setFont("helvetica", "normal");
  const cliLines = [
    cli.name || "",
    cli.nif ? `NIF/CIF: ${cli.nif}` : "",
    cli.addr || "",
    cli.phone ? `Tel: ${cli.phone}` : "",
    cli.email ? `Email: ${cli.email}` : "",
  ].filter(Boolean);
  doc.text(cliLines, 109, y + 12);

  // QR (optional)
  let qrDataUrl = null;
  if (includeQr && window.QRCode) {
    try {
      const qrText = buildAeatQrText(inv, totals);
      if (qrText) {
        const tmp = document.createElement("div");
        tmp.style.position = "fixed";
        tmp.style.left = "-9999px";
        tmp.style.top = "-9999px";
        document.body.appendChild(tmp);

        // eslint-disable-next-line no-new
        new window.QRCode(tmp, { text: qrText, width: 90, height: 90, correctLevel: window.QRCode.CorrectLevel.M });
        const img = tmp.querySelector("img");
        if (img && img.src) qrDataUrl = img.src;

        tmp.remove();
      }
    } catch (e) {
      console.warn("QR error", e);
    }
  }

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 170, 6, 28, 28);
    doc.setFontSize(7);
    doc.text("QR AEAT", 176, 36);
  }

  // Lines table
  const body = inv.lines
    .filter((ln) => (ln.product || "").trim())
    .map((ln) => {
      const qty = parseNum(ln.qty);
      const price = parseNum(ln.price);
      const amount = qty * price;
      const unit = ln.mode === "unidad" ? "ud" : ln.mode;
      return [
        normalizeName(ln.product),
        `${qty} ${unit}`,
        price ? price.toFixed(2) : "0.00",
        amount ? amount.toFixed(2) : "0.00",
        ln.bruto ? String(ln.bruto) : "",
        ln.tara ? String(ln.tara) : "",
        ln.neto ? String(ln.neto) : "",
        ln.origin ? String(ln.origin) : "",
      ];
    });

  const head = [["Producto", "Cant", "Precio", "Importe", "Bruto", "Tara", "Neto", "Origen"]];

  const startY = 66;
  doc.autoTable({
    head,
    body,
    startY,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, lineColor: [230,230,230], lineWidth: 0.1 },
    headStyles: { fillColor: [245,245,245], textColor: [17,17,17], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252,252,252] },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 15, halign: "right" },
      5: { cellWidth: 15, halign: "right" },
      6: { cellWidth: 15, halign: "right" },
      7: { cellWidth: 20 },
    },
    margin: { left: M, right: M },
    didDrawPage: (data) => {
      // Footer
      const page = doc.internal.getNumberOfPages();
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.text(`ARSLAN FACTURAS · ${APP.ver}`, M, h - 8);
      doc.text(`Página ${page}`, w - M, h - 8, { align: "right" });
      doc.setTextColor(0);
    },
  });

  // Totals box
  const lastY = doc.lastAutoTable?.finalY || startY + 10;
  let ty = lastY + 8;

  doc.setDrawColor(230);
  doc.roundedRect(120, ty, 78, 28, 2, 2);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 124, ty + 8);
  doc.text(euro(totals.subtotal), 195, ty + 8, { align: "right" });

  if (cli.vatIncluded) {
    doc.text("IVA (incluido):", 124, ty + 15);
    doc.text(euro(totals.iva), 195, ty + 15, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 124, ty + 23);
    doc.text(euro(totals.total), 195, ty + 23, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text("IVA incluido en los precios.", 124, ty + 30);
    doc.setTextColor(0);
  } else {
    doc.text(`IVA ${Math.round(parseNum(s.taxRate) * 100)}%:`, 124, ty + 15);
    doc.text(euro(totals.iva), 195, ty + 15, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 124, ty + 23);
    doc.text(euro(totals.total), 195, ty + 23, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  // Tags/notes small
  doc.setFontSize(9);
  doc.setTextColor(80);
  const extra = [];
  if (inv.tags) extra.push(`Tags: ${inv.tags}`);
  if (inv.notes) extra.push(`Notas: ${inv.notes}`);
  if (extra.length) doc.text(extra, M, ty + 8);
  doc.setTextColor(0);

  return doc;
}

/* =========================
   PDF Actions
========================= */
function pdfDownload(inv) {
  const doc = makePdf(inv, { includeQr: true });
  if (!doc) return;
  doc.save(`${inv.number}.pdf`);
}

async function pdfUploadToCloud(inv) {
  if (!db.settings.firebase.enabled) {
    alert("Firebase no está configurado. Ve a Ajustes y rellénalo.");
    return;
  }
  if (!state.cloud.user || !state.cloud.storage || !state.cloud.rtdb) {
    alert("No estás logueado en nube. Pulsa 'Entrar nube'.");
    return;
  }

  const doc = makePdf(inv, { includeQr: true });
  if (!doc) return;

  // blob
  const blob = doc.output("blob");

  const path = `${db.settings.firebase.cloudRoot}/${state.cloud.user.uid}/pdf/${inv.id}_${inv.number}.pdf`;

  try {
    const { uploadBytes, getDownloadURL, ref: stRef } = state.cloud.storageApi;
    const storageRef = stRef(state.cloud.storage, path);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);

    inv.pdfUrl = url;
    inv.pdfUpdatedAt = now();
    inv.updatedAt = now();
    saveLocal();

    // save invoice meta into RTDB (sin subir pdf binario allí)
    const invMeta = minimalInvoiceMeta(inv);
    await cloudSet(`invoices/${inv.id}`, invMeta);

    renderPdfState(inv);
    renderInvoices();

    alert("PDF guardado en nube ✅");
  } catch (e) {
    console.error(e);
    alert("Error subiendo PDF a nube. Revisa permisos Storage/Reglas.");
  }
}

function minimalInvoiceMeta(inv) {
  const totals = computeInvoice(inv);
  return {
    id: inv.id,
    createdAt: inv.createdAt || now(),
    updatedAt: now(),
    dateISO: inv.dateISO,
    number: inv.number,
    clientId: inv.clientId,
    clientNameCache: inv.clientNameCache || "",
    tags: inv.tags || "",
    notes: inv.notes || "",
    amount: totals.total,
    pdfUrl: inv.pdfUrl || "",
    pdfUpdatedAt: inv.pdfUpdatedAt || 0,
    lines: inv.lines || [],
  };
}

/* =========================
   OPEN/COPY PDF
========================= */
function openPdf() {
  const inv = getCurrentInvoice();
  if (!inv?.pdfUrl) return;
  window.open(inv.pdfUrl, "_blank");
}

async function copyPdfLink() {
  const inv = getCurrentInvoice();
  if (!inv?.pdfUrl) return;
  try {
    await navigator.clipboard.writeText(inv.pdfUrl);
    alert("Link copiado ✅");
  } catch {
    alert("No se pudo copiar (permiso del navegador).");
  }
}

/* =========================
   FIREBASE CLOUD (OPCIONAL)
   - Login email/password
   - Sync inteligente (merge local+cloud)
========================= */
async function ensureFirebaseSdk() {
  if (state.cloud.sdkLoaded) return true;
  if (!db.settings.firebase.enabled) return false;

  try {
    const {
      apiKey, authDomain, databaseURL, projectId, storageBucket, appId,
    } = db.settings.firebase;

    // dynamic import modules
    const appMod = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js");
    const dbMod = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js");
    const stMod = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js");

    const cfg = { apiKey, authDomain, databaseURL, projectId, storageBucket, appId };

    const app = appMod.initializeApp(cfg);
    const auth = authMod.getAuth(app);
    const rtdb = dbMod.getDatabase(app);
    const storage = stMod.getStorage(app);

    state.cloud.app = app;
    state.cloud.auth = auth;
    state.cloud.rtdb = rtdb;
    state.cloud.storage = storage;

    // keep api references
    state.cloud.authApi = authMod;
    state.cloud.dbApi = dbMod;
    state.cloud.storageApi = stMod;

    state.cloud.sdkLoaded = true;

    // auth listener
    authMod.onAuthStateChanged(auth, (user) => {
      state.cloud.user = user || null;
      updateCloudPill();
    });

    return true;
  } catch (e) {
    console.error("Firebase load error", e);
    alert("No se pudo cargar Firebase. Revisa configuración en Ajustes.");
    return false;
  }
}

function cloudBasePath() {
  const root = db.settings.firebase.cloudRoot || APP.cloudRootDefault;
  const uid = state.cloud.user?.uid;
  if (!uid) return null;
  return `${root}/${uid}/data`;
}

async function cloudGet(path) {
  const base = cloudBasePath();
  if (!base) throw new Error("No cloud base path");
  const { ref: dbRef, get } = state.cloud.dbApi;
  const snap = await get(dbRef(state.cloud.rtdb, `${base}/${path}`));
  return snap.exists() ? snap.val() : null;
}

async function cloudSet(path, value) {
  const base = cloudBasePath();
  if (!base) throw new Error("No cloud base path");
  const { ref: dbRef, set } = state.cloud.dbApi;
  await set(dbRef(state.cloud.rtdb, `${base}/${path}`), value);
}

async function cloudSync() {
  const ok = await ensureFirebaseSdk();
  if (!ok) return;
  if (!state.cloud.user) return alert("Inicia sesión primero.");

  // fetch cloud payload
  let cloudPayload = null;
  try {
    cloudPayload = await cloudGet("payload");
  } catch (e) {
    console.error(e);
    alert("Error leyendo nube. Revisa reglas RTDB.");
    return;
  }

  // merge
  const localPayload = deepClone(db);
  const merged = mergeLocalCloud(localPayload, cloudPayload);

  db = merged;
  saveLocal();
  initRenderAll();

  // push back
  try {
    await cloudSet("payload", db);
  } catch (e) {
    console.error(e);
    alert("Error guardando en nube. Revisa reglas RTDB.");
    return;
  }

  alert("Sync completado ✅");
}

/* =========================
   MERGE INTELIGENTE
   - Dedup invoices:
     1) id
     2) (dateISO + number + clientNameCache)
   - Merge clients:
     1) id
     2) name case-insensitive
   - Remap clientId in invoices
========================= */
function mergeLocalCloud(local, cloud) {
  if (!cloud || typeof cloud !== "object") return local;

  const base = emptyDb();
  const L = { ...base, ...local };
  const C = { ...base, ...cloud };

  // SETTINGS: prefer local (porque tú editas en tu dispositivo), pero rellena faltantes desde cloud
  L.settings = { ...C.settings, ...L.settings };
  L.settings.provider = { ...(C.settings?.provider || {}), ...(L.settings?.provider || {}) };
  L.settings.firebase = { ...(C.settings?.firebase || {}), ...(L.settings?.firebase || {}) };

  // CLIENTS merge
  const mapById = new Map();
  const mapByName = new Map(); // normalized name => id
  const mergedClients = [];

  function addClient(c) {
    const cc = {
      id: c.id || uid("cli"),
      name: c.name || "CLIENTE",
      nif: c.nif || "",
      addr: c.addr || "",
      phone: c.phone || "",
      email: c.email || "",
      tags: c.tags || "",
      vatIncluded: !!c.vatIncluded,
    };
    const n = normalizeName(cc.name);
    if (mapById.has(cc.id)) return;
    if (mapByName.has(n)) {
      // unify: keep existing, but fill blanks
      const idExisting = mapByName.get(n);
      const ex = mergedClients.find((x) => x.id === idExisting);
      if (ex) {
        ex.nif = ex.nif || cc.nif;
        ex.addr = ex.addr || cc.addr;
        ex.phone = ex.phone || cc.phone;
        ex.email = ex.email || cc.email;
        ex.tags = ex.tags || cc.tags;
        ex.vatIncluded = ex.vatIncluded || cc.vatIncluded;
      }
      mapById.set(cc.id, idExisting); // remap old id to existing id
      return;
    }
    mergedClients.push(cc);
    mapById.set(cc.id, cc.id);
    mapByName.set(n, cc.id);
  }

  (C.clients || []).forEach(addClient);
  (L.clients || []).forEach(addClient);

  // remap table for client ids
  const clientIdRemap = new Map();
  for (const [oldId, newId] of mapById.entries()) {
    if (oldId !== newId) clientIdRemap.set(oldId, newId);
  }

  // PRODUCTS merge (by key else by name)
  const prodByKey = new Map();
  const prodByName = new Map();
  const mergedProducts = [];

  function addProd(p) {
    const pp = {
      key: p.key || uid("prd"),
      name: normalizeName(p.name || ""),
      unit: p.unit || "kg",
      kgPerBox: parseNum(p.kgPerBox),
      cost: parseNum(p.cost),
      price: parseNum(p.price),
      history: Array.isArray(p.history) ? p.history.slice(0, 20) : [],
    };
    if (!pp.name) return;
    const n = normalizeName(pp.name);

    if (prodByKey.has(pp.key)) return;
    if (prodByName.has(n)) {
      const existingKey = prodByName.get(n);
      const ex = mergedProducts.find((x) => x.key === existingKey);
      if (ex) {
        ex.unit = ex.unit || pp.unit;
        ex.kgPerBox = ex.kgPerBox || pp.kgPerBox;
        ex.cost = ex.cost || pp.cost;
        ex.price = ex.price || pp.price;
        ex.history = [...(pp.history || []), ...(ex.history || [])].slice(0, 20);
      }
      return;
    }

    mergedProducts.push(pp);
    prodByKey.set(pp.key, pp.key);
    prodByName.set(n, pp.key);
  }

  (C.products || []).forEach(addProd);
  (L.products || []).forEach(addProd);

  // INVOICES merge (dedup by id then by composite)
  const invById = new Map();
  const invByComp = new Map();
  const mergedInv = [];

  function compKey(inv) {
    return `${inv.dateISO || ""}__${inv.number || ""}__${normalizeName(inv.clientNameCache || "")}`;
  }

  function addInv(inv) {
    const ii = normalizeInvoice(inv, { settings: L.settings, clients: mergedClients });
    // remap clientId if needed
    if (clientIdRemap.has(ii.clientId)) ii.clientId = clientIdRemap.get(ii.clientId);

    // refresh cache
    const cli = mergedClients.find((c) => c.id === ii.clientId);
    ii.clientNameCache = cli?.name || ii.clientNameCache || "CLIENTE";

    const ckey = compKey(ii);

    if (invById.has(ii.id)) {
      // choose most updated (pdfUrl included)
      const ex = mergedInv.find((x) => x.id === ii.id);
      if (ex) {
        if ((ii.updatedAt || 0) > (ex.updatedAt || 0)) Object.assign(ex, ii);
        if (!ex.pdfUrl && ii.pdfUrl) ex.pdfUrl = ii.pdfUrl;
      }
      return;
    }

    if (invByComp.has(ckey)) {
      const existingId = invByComp.get(ckey);
      const ex = mergedInv.find((x) => x.id === existingId);
      if (ex) {
        // merge lines if one is empty
        if ((ex.lines?.length || 0) === 0 && (ii.lines?.length || 0) > 0) ex.lines = ii.lines;
        // choose newest meta
        if ((ii.updatedAt || 0) > (ex.updatedAt || 0)) {
          ex.dateISO = ii.dateISO;
          ex.number = ii.number;
          ex.tags = ii.tags;
          ex.notes = ii.notes;
          ex.clientId = ii.clientId;
          ex.clientNameCache = ii.clientNameCache;
        }
        if (!ex.pdfUrl && ii.pdfUrl) ex.pdfUrl = ii.pdfUrl;
      }
      return;
    }

    mergedInv.push(ii);
    invById.set(ii.id, ii.id);
    invByComp.set(ckey, ii.id);
  }

  (C.invoices || []).forEach(addInv);
  (L.invoices || []).forEach(addInv);

  // sort desc by date
  mergedInv.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || "", "es"));

  return {
    meta: { ...(L.meta || {}), updatedAt: now() },
    settings: L.settings,
    clients: mergedClients,
    products: mergedProducts,
    invoices: mergedInv,
  };
}

/* =========================
   LOGIN MODAL
========================= */
function showLoginModal(msg = "—") {
  if (!ui.loginModal) return;
  ui.loginMsg.textContent = msg;
  ui.loginModal.style.display = "";
  setTimeout(() => ui.loginEmail.focus(), 50);
}
function hideLoginModal() {
  if (!ui.loginModal) return;
  ui.loginModal.style.display = "none";
}

async function loginCloud(isSignup = false) {
  const ok = await ensureFirebaseSdk();
  if (!ok) return;

  const email = (ui.loginEmail.value || "").trim();
  const pass = (ui.loginPass.value || "").trim();
  if (!email || !pass) return (ui.loginMsg.textContent = "Email y password requeridos.");

  try {
    if (isSignup) {
      await state.cloud.authApi.createUserWithEmailAndPassword(state.cloud.auth, email, pass);
    } else {
      await state.cloud.authApi.signInWithEmailAndPassword(state.cloud.auth, email, pass);
    }
    hideLoginModal();
    updateCloudPill();
    alert("Login OK ✅");
  } catch (e) {
    console.error(e);
    ui.loginMsg.textContent = "Error login. Revisa email/password o reglas.";
  }
}

async function logoutCloud() {
  if (!state.cloud.auth) return;
  try {
    await state.cloud.authApi.signOut(state.cloud.auth);
    state.cloud.user = null;
    updateCloudPill();
    alert("Sesión cerrada.");
  } catch (e) {
    console.error(e);
    alert("Error cerrando sesión.");
  }
}

/* =========================
   BIND CLOUD EVENTS
========================= */
function bindCloudEvents() {
  ui.btnLogin?.addEventListener("click", async () => {
    if (!db.settings.firebase.enabled) return alert("Firebase no configurado. Ajustes → Firebase.");
    showLoginModal("Introduce credenciales para nube.");
  });

  ui.btnLogout?.addEventListener("click", logoutCloud);

  ui.btnSync?.addEventListener("click", cloudSync);

  ui.btnLoginClose?.addEventListener("click", hideLoginModal);
  ui.btnLoginDo?.addEventListener("click", () => loginCloud(false));
  ui.btnSignupDo?.addEventListener("click", () => loginCloud(true));
}

/* =========================
   HOOK PDF + WhatsApp BUTTONS
========================= */
function bindPdfWhatsAppEvents() {
  ui.btnPDF?.addEventListener("click", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    pdfDownload(inv);
  });

  ui.btnPDFUpload?.addEventListener("click", async () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    await pdfUploadToCloud(inv);
  });

  ui.btnWhatsApp?.addEventListener("click", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    whatsappInvoice(inv);
  });

  ui.btnOpenPdf?.addEventListener("click", openPdf);
  ui.btnCopyPdf?.addEventListener("click", copyPdfLink);
}

/* =========================
   OVERRIDE BOOT: add bindings
========================= */
const __bootOriginal = boot;
function boot2() {
  __bootOriginal();
  bindAccountingEvents();
  bindCloudEvents();
  bindPdfWhatsAppEvents();
  updateCloudPill();
}
document.removeEventListener("DOMContentLoaded", boot);
document.addEventListener("DOMContentLoaded", boot2);

/* =========================
   SAFETY: ensure no missing select options
========================= */
(function hardenOnLoad(){
  // if clients empty for some reason, restore defaults
  if (!Array.isArray(db.clients) || db.clients.length === 0) {
    db.clients = defaultClients();
    saveLocal();
  }
  if (!db.settings?.provider?.name) {
    db.settings = defaultSettings();
    saveLocal();
  }
})();
