/* =========================================================
   ARSLAN • FACTURAS — KIWI EDITION (B/W + Offline + Cloud)
   app.js (1/3) — Core: state, storage, ui skeleton, helpers
   ========================================================= */

"use strict";

/* =========================
   0) KEYS / DEFAULTS
========================= */
const K = {
  provider:  "af_kiwi_provider",
  clients:   "af_kiwi_clients",
  products:  "af_kiwi_products",
  invoices:  "af_kiwi_invoices",
  settings:  "af_kiwi_settings",
  pdfIndex:  "af_kiwi_pdf_index" // lightweight index (actual blobs in IndexedDB)
};

const DEFAULT_PROVIDER = {
  name: "Mohammad Arslan Waris",
  nif:  "",
  addr: "",
  tel:  "",
  email:""
};

const DEFAULT_SETTINGS = {
  vatRate: 4,
  shipRate: 10,
  vatIncludedDefault: false,

  qrTpl: "AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}",

  // Accounting PIN
  pin: "7392",

  // Cloud
  cloud: {
    enabled: false,         // becomes true when config saved + initialized
    autoSync: false,
    config: {               // Firebase config
      apiKey: "",
      authDomain: "",
      databaseURL: "",
      projectId: "",
      appId: "",
      storageBucket: ""
    },
    user: null,             // { uid, email }
    lastSyncAt: 0
  },

  // Behavior
  preventOverwriteClosedInvoices: true
};

// Basic schema
// client: { id, name, alias, nif, addr, tel, email, tags[], vatIncluded, shipOn, createdAt, updatedAt }
// product:{ id, name, unitDefault:'kg'|'caja'|'ud', kgBox:number, price:number, cost:number, origin, priceHist:[{ts, price}] }
// invoice:{ id, number, dateISO, clientId, clientSnap:{...}, providerSnap:{...}, tags[], notes,
//           lines:[{id, prodId, prodName, mode, qty, bruto, tara, neto, price, origin, amt}],
//           shipOn, vatIncluded, closed,
//           payments:[{id, ts, method, amount}],
//           pdf:{ localIdbKey, cloudUrl },
//           createdAt, updatedAt }

/* =========================
   1) SAFE STORAGE
========================= */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return (v === null || v === undefined) ? fallback : v;
  } catch (e) {
    console.warn("loadJSON fail", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("saveJSON fail", key, e);
    return false;
  }
}

/* =========================
   2) UTILS
========================= */
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function nowISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

// FA-YYYYMMDDHHMM
function makeInvoiceNumber(dt = new Date()) {
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth()+1);
  const d = pad2(dt.getDate());
  const hh = pad2(dt.getHours());
  const mm = pad2(dt.getMinutes());
  return `FA-${y}${m}${d}${hh}${mm}`;
}

function toNum(x) {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return isFinite(x) ? x : 0;
  const s = String(x).replace(",", ".").trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function clampNonNeg(n) {
  n = toNum(n);
  return n < 0 ? 0 : n;
}

function round2(n) {
  n = toNum(n);
  return Math.round(n * 100) / 100;
}

function money(n) {
  n = round2(n);
  // Spanish formatting without Intl (fast + stable)
  const parts = n.toFixed(2).split(".");
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${int},${parts[1]}`;
}

function normStr(s) {
  return String(s || "").trim();
}

function normKey(s) {
  return normStr(s).toLowerCase();
}

function splitTags(s) {
  return normStr(s)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function hasTag(inv, q) {
  const t = (inv.tags || []).map(normKey);
  return t.includes(normKey(q));
}

function includesAny(hay, needle) {
  return normKey(hay).includes(normKey(needle));
}

/* =========================
   3) TOAST
========================= */
let toastTimer = null;
function showToast(msg, ms = 1800) {
  const t = EL.toast;
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, ms);
}

/* =========================
   4) DOM HELPERS
========================= */
function $(id) { return document.getElementById(id); }

function setPill(el, text, variant = "normal") {
  if (!el) return;
  el.textContent = text;
  el.style.background = (variant === "ok") ? "#000" : "";
  el.style.color = (variant === "ok") ? "#fff" : "";
  el.style.borderColor = (variant === "ok") ? "#000" : "";
}

function safeSetValue(el, v) {
  if (!el) return;
  el.value = (v === null || v === undefined) ? "" : String(v);
}

function safeSetText(el, v) {
  if (!el) return;
  el.textContent = (v === null || v === undefined) ? "" : String(v);
}

/* =========================
   5) STATE
========================= */
const STATE = {
  provider: structuredClone(DEFAULT_PROVIDER),
  clients: [],
  products: [],
  invoices: [],
  settings: structuredClone(DEFAULT_SETTINGS),

  // UI state
  currentView: "invoicesView",
  activeInvoiceId: null,
  activeClientId: null,
  activeProductId: null,

  // Accounting lock
  accountingUnlocked: false,

  // caches
  productById: new Map(),
  clientById: new Map()
};

const EL = {
  // top
  modePill: null,
  btnSync: null,
  btnAuth: null,

  // tabs/views
  tabs: [],
  views: [],

  // invoice list
  invoiceSearch: null,
  invoiceList: null,
  invoiceListMeta: null,
  btnNewInvoice: null,
  btnDuplicate: null,
  btnDelete: null,
  btnSave: null,
  btnExportJSON: null,
  btnImportJSON: null,
  fileImport: null,

  // invoice header
  prov_name: null, prov_nif: null, prov_addr: null, prov_tel: null, prov_email: null,
  client_select: null, btnOpenClient: null,
  cli_name: null, cli_nif: null, cli_addr: null, cli_tel: null, cli_email: null,
  qrMount: null, qrHint: null,

  // invoice meta
  inv_number: null,
  inv_date: null,
  inv_tags: null,
  inv_notes: null,

  // lines
  linesBody: null,
  rowTpl: null,
  btnAddLine: null,
  btnClearLines: null,
  btnWhats: null,
  btnPDF: null,

  // totals
  tot_sub: null,
  tot_ship: null,
  tot_vat: null,
  tot_all: null,
  shipPctLabel: null,
  vatModeLabel: null,
  chkShip: null,
  chkVatIncluded: null,
  chkAutoSync: null,

  // payments/status
  pay_method: null,
  pay_amount: null,
  btnAddPay: null,
  payList: null,
  paid_total: null,
  due_total: null,
  invStatusPill: null,
  chkClosed: null,

  // pdf area
  btnOpenPDF: null,
  btnCopyPDF: null,
  pdfMeta: null,

  // clients
  clientSearch: null,
  btnNewClient: null,
  btnClientsExport: null,
  clientsList: null,

  c_name: null, c_alias: null, c_nif: null, c_addr: null, c_tel: null, c_email: null, c_tags: null,
  c_vatIncluded: null, c_shipOn: null,
  btnClientSave: null, btnClientDelete: null,

  // products
  productSearch: null,
  btnNewProduct: null,
  btnProductsExport: null,
  productsList: null,

  p_name: null, p_unit: null, p_kgBox: null, p_price: null, p_cost: null, p_origin: null, p_hist: null,
  btnProductSave: null, btnProductDelete: null,

  // accounting
  btnUnlock: null,
  lockBox: null,
  accountingBody: null,
  acc_from: null, acc_to: null, acc_client: null, acc_tag: null, btnAccApply: null,
  kpi_sales: null, kpi_vat: null, kpi_count: null, kpi_margin: null,
  accTable: null,

  // settings
  set_vat: null, set_ship: null, set_vatIncludedDefault: null, set_qrTpl: null,
  btnSettingsSave: null,
  fb_apiKey: null, fb_authDomain: null, fb_databaseURL: null, fb_projectId: null, fb_appId: null, fb_storageBucket: null,
  btnTestCloud: null, btnSaveCloud: null, cloudHint: null,
  pricesLinkInfo: null,
  btnResetLocal: null, btnHardReset: null,

  // modals
  authModal: null,
  auth_email: null,
  auth_pass: null,
  btnLogin: null,
  btnSignup: null,
  btnLogout: null,
  authMsg: null,

  pinModal: null,
  pinInput: null,
  btnPinOk: null,
  pinMsg: null,

  // editor labels
  editorTitle: null,
  editorSubtitle: null,

  // toast
  toast: null
};

/* =========================
   6) BOOTSTRAP DOM REFS
========================= */
function bindElements() {
  // top
  EL.modePill = $("modePill");
  EL.btnSync = $("btnSync");
  EL.btnAuth = $("btnAuth");

  // tabs/views
  EL.tabs = Array.from(document.querySelectorAll(".tab"));
  EL.views = Array.from(document.querySelectorAll(".view"));

  // invoice list
  EL.invoiceSearch = $("invoiceSearch");
  EL.invoiceList = $("invoiceList");
  EL.invoiceListMeta = $("invoiceListMeta");
  EL.btnNewInvoice = $("btnNewInvoice");
  EL.btnDuplicate = $("btnDuplicate");
  EL.btnDelete = $("btnDelete");
  EL.btnSave = $("btnSave");
  EL.btnExportJSON = $("btnExportJSON");
  EL.btnImportJSON = $("btnImportJSON");
  EL.fileImport = $("fileImport");

  // header
  EL.prov_name = $("prov_name");
  EL.prov_nif  = $("prov_nif");
  EL.prov_addr = $("prov_addr");
  EL.prov_tel  = $("prov_tel");
  EL.prov_email= $("prov_email");

  EL.client_select = $("client_select");
  EL.btnOpenClient = $("btnOpenClient");

  EL.cli_name = $("cli_name");
  EL.cli_nif  = $("cli_nif");
  EL.cli_addr = $("cli_addr");
  EL.cli_tel  = $("cli_tel");
  EL.cli_email= $("cli_email");

  EL.qrMount = $("qrMount");
  EL.qrHint  = $("qrHint");

  // meta
  EL.inv_number = $("inv_number");
  EL.inv_date   = $("inv_date");
  EL.inv_tags   = $("inv_tags");
  EL.inv_notes  = $("inv_notes");

  // lines
  EL.linesBody = $("linesBody");
  EL.rowTpl    = $("rowTpl");
  EL.btnAddLine = $("btnAddLine");
  EL.btnClearLines = $("btnClearLines");
  EL.btnWhats = $("btnWhats");
  EL.btnPDF = $("btnPDF");

  // totals
  EL.tot_sub = $("tot_sub");
  EL.tot_ship = $("tot_ship");
  EL.tot_vat = $("tot_vat");
  EL.tot_all = $("tot_all");
  EL.shipPctLabel = $("shipPctLabel");
  EL.vatModeLabel = $("vatModeLabel");
  EL.chkShip = $("chkShip");
  EL.chkVatIncluded = $("chkVatIncluded");
  EL.chkAutoSync = $("chkAutoSync");

  // payments
  EL.pay_method = $("pay_method");
  EL.pay_amount = $("pay_amount");
  EL.btnAddPay = $("btnAddPay");
  EL.payList = $("payList");
  EL.paid_total = $("paid_total");
  EL.due_total = $("due_total");
  EL.invStatusPill = $("invStatusPill");
  EL.chkClosed = $("chkClosed");

  // pdf
  EL.btnOpenPDF = $("btnOpenPDF");
  EL.btnCopyPDF = $("btnCopyPDF");
  EL.pdfMeta = $("pdfMeta");

  // clients
  EL.clientSearch = $("clientSearch");
  EL.btnNewClient = $("btnNewClient");
  EL.btnClientsExport = $("btnClientsExport");
  EL.clientsList = $("clientsList");
  EL.c_name = $("c_name");
  EL.c_alias = $("c_alias");
  EL.c_nif = $("c_nif");
  EL.c_tags = $("c_tags");
  EL.c_addr = $("c_addr");
  EL.c_tel = $("c_tel");
  EL.c_email = $("c_email");
  EL.c_vatIncluded = $("c_vatIncluded");
  EL.c_shipOn = $("c_shipOn");
  EL.btnClientSave = $("btnClientSave");
  EL.btnClientDelete = $("btnClientDelete");

  // products
  EL.productSearch = $("productSearch");
  EL.btnNewProduct = $("btnNewProduct");
  EL.btnProductsExport = $("btnProductsExport");
  EL.productsList = $("productsList");
  EL.p_name = $("p_name");
  EL.p_unit = $("p_unit");
  EL.p_kgBox = $("p_kgBox");
  EL.p_price = $("p_price");
  EL.p_cost = $("p_cost");
  EL.p_origin = $("p_origin");
  EL.p_hist = $("p_hist");
  EL.btnProductSave = $("btnProductSave");
  EL.btnProductDelete = $("btnProductDelete");

  // accounting
  EL.btnUnlock = $("btnUnlock");
  EL.lockBox = $("lockBox");
  EL.accountingBody = $("accountingBody");
  EL.acc_from = $("acc_from");
  EL.acc_to = $("acc_to");
  EL.acc_client = $("acc_client");
  EL.acc_tag = $("acc_tag");
  EL.btnAccApply = $("btnAccApply");
  EL.kpi_sales = $("kpi_sales");
  EL.kpi_vat = $("kpi_vat");
  EL.kpi_count = $("kpi_count");
  EL.kpi_margin = $("kpi_margin");
  EL.accTable = $("accTable");

  // settings
  EL.set_vat = $("set_vat");
  EL.set_ship = $("set_ship");
  EL.set_vatIncludedDefault = $("set_vatIncludedDefault");
  EL.set_qrTpl = $("set_qrTpl");
  EL.btnSettingsSave = $("btnSettingsSave");

  EL.fb_apiKey = $("fb_apiKey");
  EL.fb_authDomain = $("fb_authDomain");
  EL.fb_databaseURL = $("fb_databaseURL");
  EL.fb_projectId = $("fb_projectId");
  EL.fb_appId = $("fb_appId");
  EL.fb_storageBucket = $("fb_storageBucket");
  EL.btnTestCloud = $("btnTestCloud");
  EL.btnSaveCloud = $("btnSaveCloud");
  EL.cloudHint = $("cloudHint");
  EL.pricesLinkInfo = $("pricesLinkInfo");
  EL.btnResetLocal = $("btnResetLocal");
  EL.btnHardReset = $("btnHardReset");

  // modals
  EL.authModal = $("authModal");
  EL.auth_email = $("auth_email");
  EL.auth_pass = $("auth_pass");
  EL.btnLogin = $("btnLogin");
  EL.btnSignup = $("btnSignup");
  EL.btnLogout = $("btnLogout");
  EL.authMsg = $("authMsg");

  EL.pinModal = $("pinModal");
  EL.pinInput = $("pinInput");
  EL.btnPinOk = $("btnPinOk");
  EL.pinMsg = $("pinMsg");

  // editor labels
  EL.editorTitle = $("editorTitle");
  EL.editorSubtitle = $("editorSubtitle");

  // toast
  EL.toast = $("toast");
}

/* =========================
   7) LOCAL LOAD / SAVE
========================= */
function rebuildIndexes() {
  STATE.productById = new Map(STATE.products.map(p => [p.id, p]));
  STATE.clientById = new Map(STATE.clients.map(c => [c.id, c]));
}

function ensureDefaults() {
  // provider
  STATE.provider = Object.assign(structuredClone(DEFAULT_PROVIDER), STATE.provider || {});
  // settings
  STATE.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), STATE.settings || {});
  if (!STATE.settings.cloud) STATE.settings.cloud = structuredClone(DEFAULT_SETTINGS.cloud);
  if (!STATE.settings.cloud.config) STATE.settings.cloud.config = structuredClone(DEFAULT_SETTINGS.cloud.config);

  // arrays
  if (!Array.isArray(STATE.clients)) STATE.clients = [];
  if (!Array.isArray(STATE.products)) STATE.products = [];
  if (!Array.isArray(STATE.invoices)) STATE.invoices = [];

  // sanitize
  STATE.clients = STATE.clients.filter(Boolean);
  STATE.products = STATE.products.filter(Boolean);
  STATE.invoices = STATE.invoices.filter(Boolean);

  rebuildIndexes();
}

function deepMerge(target, src) {
  if (!src || typeof src !== "object") return target;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function loadAllLocal() {
  STATE.provider = loadJSON(K.provider, structuredClone(DEFAULT_PROVIDER));
  STATE.clients  = loadJSON(K.clients, []);
  STATE.products = loadJSON(K.products, []);
  STATE.invoices = loadJSON(K.invoices, []);
  STATE.settings = loadJSON(K.settings, structuredClone(DEFAULT_SETTINGS));
  ensureDefaults();
}

function saveAllLocal() {
  saveJSON(K.provider, STATE.provider);
  saveJSON(K.clients, STATE.clients);
  saveJSON(K.products, STATE.products);
  saveJSON(K.invoices, STATE.invoices);
  saveJSON(K.settings, STATE.settings);
}

function touchEntity(ent) {
  const ts = Date.now();
  if (!ent.createdAt) ent.createdAt = ts;
  ent.updatedAt = ts;
}

/* =========================
   8) NAVIGATION
========================= */
function setView(viewId) {
  STATE.currentView = viewId;
  for (const v of EL.views) {
    v.classList.toggle("active", v.id === viewId);
  }
  for (const t of EL.tabs) {
    t.classList.toggle("active", t.dataset.view === viewId);
  }

  // render-on-enter views
  if (viewId === "clientsView") renderClients();
  if (viewId === "productsView") renderProducts();
  if (viewId === "accountingView") renderAccounting();
  if (viewId === "settingsView") renderSettings();
}

/* =========================
   9) SERVICE WORKER REGISTER
========================= */
async function registerSW() {
  try {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.register("./sw.js");
  } catch (e) {
    console.warn("SW register fail", e);
  }
}

/* =========================
   10) SCRIPT LOADER (CDN libs)
========================= */
function loadScriptOnce(src, globalCheckFn, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    try {
      if (globalCheckFn && globalCheckFn()) return resolve(true);

      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) {
        const t0 = Date.now();
        const tick = () => {
          if (globalCheckFn && globalCheckFn()) return resolve(true);
          if (Date.now() - t0 > timeoutMs) return reject(new Error("timeout"));
          setTimeout(tick, 150);
        };
        tick();
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.defer = true;
      s.dataset.src = src;

      const timer = setTimeout(() => {
        s.remove();
        reject(new Error("timeout"));
      }, timeoutMs);

      s.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      s.onerror = () => {
        clearTimeout(timer);
        reject(new Error("load_error"));
      };

      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

/* =========================
   11) EVENT WIRING (skeleton)
========================= */
function wireBaseEvents() {
  // tabs
  EL.tabs.forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  // global shortcuts
  window.addEventListener("keydown", (e) => {
    // "/" focus search
    if (e.key === "/" && !isTypingInInput(e.target)) {
      e.preventDefault();
      if (EL.invoiceSearch) EL.invoiceSearch.focus();
    }
    // Ctrl+S save invoice
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveActiveInvoiceFromUI();
    }
    // Ctrl+P PDF
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      if (STATE.currentView === "invoicesView") {
        e.preventDefault();
        generatePDFForActiveInvoice();
      }
    }
  });

  // invoice list search
  EL.invoiceSearch?.addEventListener("input", () => renderInvoiceList());

  // new invoice
  EL.btnNewInvoice?.addEventListener("click", () => {
    const inv = createNewInvoice();
    STATE.invoices.unshift(inv);
    saveAllLocal();
    renderInvoiceList();
    openInvoice(inv.id);
    showToast("Factura creada");
    maybeAutoSync();
  });

  // duplicate / delete / save
  EL.btnDuplicate?.addEventListener("click", () => duplicateActiveInvoice());
  EL.btnDelete?.addEventListener("click", () => deleteActiveInvoice());
  EL.btnSave?.addEventListener("click", () => saveActiveInvoiceFromUI());

  // export/import JSON
  EL.btnExportJSON?.addEventListener("click", () => exportBackupJSON());
  EL.btnImportJSON?.addEventListener("click", () => EL.fileImport?.click());
  EL.fileImport?.addEventListener("change", (e) => importBackupJSONFromFile(e));

  // header provider edits (saved in settings/provider snapshot)
  const provFields = [EL.prov_name, EL.prov_nif, EL.prov_addr, EL.prov_tel, EL.prov_email];
  provFields.forEach(inp => inp?.addEventListener("input", () => {
    // live update active invoice snapshots + provider defaults
    if (!STATE.activeInvoiceId) return;
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.providerSnap = readProviderFromUI();
    touchEntity(inv);
    saveAllLocal();
    renderQRForActive();
    maybeAutoSync();
  }));

  // client select + open client page
  EL.client_select?.addEventListener("change", () => {
    if (!STATE.activeInvoiceId) return;
    const id = EL.client_select.value;
    applyClientToActiveInvoice(id);
  });
  EL.btnOpenClient?.addEventListener("click", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    if (inv.clientId) {
      STATE.activeClientId = inv.clientId;
      setView("clientsView");
      renderClients();
      showToast("Cliente abierto");
    } else {
      setView("clientsView");
    }
  });

  // invoice meta
  EL.inv_date?.addEventListener("change", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.dateISO = EL.inv_date.value || nowISODate();
    touchEntity(inv);
    saveAllLocal();
    renderInvoiceList();
    renderQRForActive();
    maybeAutoSync();
  });
  EL.inv_tags?.addEventListener("input", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.tags = splitTags(EL.inv_tags.value);
    touchEntity(inv);
    saveAllLocal();
    renderInvoiceList();
    maybeAutoSync();
  });
  EL.inv_notes?.addEventListener("input", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.notes = normStr(EL.inv_notes.value);
    touchEntity(inv);
    saveAllLocal();
    maybeAutoSync();
  });

  // totals toggles
  EL.chkShip?.addEventListener("change", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.shipOn = !!EL.chkShip.checked;
    touchEntity(inv);
    saveAllLocal();
    recalcAndRenderTotals();
    maybeAutoSync();
  });
  EL.chkVatIncluded?.addEventListener("change", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.vatIncluded = !!EL.chkVatIncluded.checked;
    touchEntity(inv);
    saveAllLocal();
    recalcAndRenderTotals();
    renderQRForActive();
    maybeAutoSync();
  });
  EL.chkAutoSync?.addEventListener("change", () => {
    STATE.settings.cloud.autoSync = !!EL.chkAutoSync.checked;
    saveAllLocal();
    showToast(STATE.settings.cloud.autoSync ? "Auto-sync ON" : "Auto-sync OFF");
  });

  // lines
  EL.btnAddLine?.addEventListener("click", () => addLineToActiveInvoice());
  EL.btnClearLines?.addEventListener("click", () => clearLinesActiveInvoice());

  EL.btnWhats?.addEventListener("click", () => exportWhatsAppTXT());
  EL.btnPDF?.addEventListener("click", () => generatePDFForActiveInvoice());

  // payments
  EL.btnAddPay?.addEventListener("click", () => addPaymentToActiveInvoice());
  EL.chkClosed?.addEventListener("change", () => {
    const inv = getActiveInvoice();
    if (!inv) return;
    inv.closed = !!EL.chkClosed.checked;
    touchEntity(inv);
    saveAllLocal();
    showToast(inv.closed ? "Factura cerrada" : "Factura abierta");
    maybeAutoSync();
  });

  // open/copy pdf
  EL.btnOpenPDF?.addEventListener("click", () => openLocalOrCloudPDF());
  EL.btnCopyPDF?.addEventListener("click", () => copyCloudPDFLink());

  // clients
  EL.clientSearch?.addEventListener("input", () => renderClients());
  EL.btnNewClient?.addEventListener("click", () => newClient());
  EL.btnClientSave?.addEventListener("click", () => saveClientFromUI());
  EL.btnClientDelete?.addEventListener("click", () => deleteActiveClient());
  EL.btnClientsExport?.addEventListener("click", () => exportClientsJSON());

  // products
  EL.productSearch?.addEventListener("input", () => renderProducts());
  EL.btnNewProduct?.addEventListener("click", () => newProduct());
  EL.btnProductSave?.addEventListener("click", () => saveProductFromUI());
  EL.btnProductDelete?.addEventListener("click", () => deleteActiveProduct());
  EL.btnProductsExport?.addEventListener("click", () => exportProductsJSON());

  // accounting
  EL.btnUnlock?.addEventListener("click", () => openPINModal());
  EL.btnAccApply?.addEventListener("click", () => renderAccounting());

  // settings
  EL.btnSettingsSave?.addEventListener("click", () => saveSettingsFromUI());
  EL.btnResetLocal?.addEventListener("click", () => resetLocal(false));
  EL.btnHardReset?.addEventListener("click", () => resetLocal(true));

  // cloud auth modal
  EL.btnAuth?.addEventListener("click", () => {
    EL.authModal?.showModal();
    updateAuthUI();
  });
  EL.btnSync?.addEventListener("click", () => syncNow());

  EL.btnLogin?.addEventListener("click", (e) => { e.preventDefault(); cloudLogin(); });
  EL.btnSignup?.addEventListener("click", (e) => { e.preventDefault(); cloudSignup(); });
  EL.btnLogout?.addEventListener("click", (e) => { e.preventDefault(); cloudLogout(); });

  EL.btnSaveCloud?.addEventListener("click", (e) => { e.preventDefault(); saveCloudConfigFromUI(); });
  EL.btnTestCloud?.addEventListener("click", (e) => { e.preventDefault(); testCloud(); });
}

/* =========================
   12) INPUT FOCUS DETECTOR
========================= */
function isTypingInInput(target) {
  if (!target) return false;
  const tag = (target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

/* =========================
   13) PLACEHOLDERS (implemented in 3B/3C)
   (No tocar: se completan abajo)
========================= */
function renderInvoiceList() {}
function openInvoice(id) {}
function getActiveInvoice() { return null; }
function createNewInvoice() { return null; }
function duplicateActiveInvoice() {}
function deleteActiveInvoice() {}
function saveActiveInvoiceFromUI() {}
function readProviderFromUI() { return structuredClone(DEFAULT_PROVIDER); }
function applyClientToActiveInvoice(clientId) {}

function addLineToActiveInvoice() {}
function clearLinesActiveInvoice() {}
function recalcAndRenderTotals() {}

function addPaymentToActiveInvoice() {}

function exportWhatsAppTXT() {}
function generatePDFForActiveInvoice() {}

function openLocalOrCloudPDF() {}
function copyCloudPDFLink() {}

function renderClients() {}
function newClient() {}
function saveClientFromUI() {}
function deleteActiveClient() {}
function exportClientsJSON() {}

function renderProducts() {}
function newProduct() {}
function saveProductFromUI() {}
function deleteActiveProduct() {}
function exportProductsJSON() {}

function openPINModal() {}
function renderAccounting() {}

function renderSettings() {}
function saveSettingsFromUI() {}
function resetLocal(hard) {}

function exportBackupJSON() {}
function importBackupJSONFromFile(e) {}

function maybeAutoSync() {}
function syncNow() {}

function updateAuthUI() {}
function cloudLogin() {}
function cloudSignup() {}
function cloudLogout() {}
function saveCloudConfigFromUI() {}
function testCloud() {}

function renderQRForActive() {}

/* =========================
   14) STARTUP (init in 3C)
========================= */
// init() se llama al final de 3C (para que todo exista)
/* =========================================================
   app.js (2/3) — Invoices, Grid PRO, totals, payments, WhatsApp
   ========================================================= */

/* =========================
   20) INVOICE HELPERS
========================= */
function getActiveInvoice() {
  const id = STATE.activeInvoiceId;
  if (!id) return null;
  return STATE.invoices.find(x => x.id === id) || null;
}

function getClientById(id) {
  return STATE.clientById.get(id) || null;
}

function getProductById(id) {
  return STATE.productById.get(id) || null;
}

function sanitizeInvoice(inv) {
  if (!inv) return null;
  if (!inv.id) inv.id = uid("inv");
  if (!inv.number) inv.number = makeInvoiceNumber(new Date());
  if (!inv.dateISO) inv.dateISO = nowISODate();
  if (!Array.isArray(inv.tags)) inv.tags = [];
  if (!Array.isArray(inv.lines)) inv.lines = [];
  if (!Array.isArray(inv.payments)) inv.payments = [];
  if (typeof inv.shipOn !== "boolean") inv.shipOn = false;
  if (typeof inv.vatIncluded !== "boolean") inv.vatIncluded = !!STATE.settings.vatIncludedDefault;
  if (typeof inv.closed !== "boolean") inv.closed = false;
  if (!inv.providerSnap) inv.providerSnap = structuredClone(STATE.provider);
  if (!inv.clientSnap) inv.clientSnap = null;
  if (!inv.pdf) inv.pdf = { localIdbKey: "", cloudUrl: "" };
  touchEntity(inv);
  return inv;
}

function createNewInvoice() {
  const dt = new Date();
  const inv = sanitizeInvoice({
    id: uid("inv"),
    number: makeInvoiceNumber(dt),
    dateISO: nowISODate(),
    clientId: "",
    clientSnap: null,
    providerSnap: structuredClone(STATE.provider),
    tags: [],
    notes: "",
    lines: [],
    shipOn: false,
    vatIncluded: !!STATE.settings.vatIncludedDefault,
    closed: false,
    payments: [],
    pdf: { localIdbKey: "", cloudUrl: "" },
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  // 5 lines default
  for (let i = 0; i < 5; i++) inv.lines.push(makeEmptyLine());
  return inv;
}

function makeEmptyLine() {
  return {
    id: uid("ln"),
    prodId: "",
    prodName: "",
    mode: "kg",      // kg | caja | ud
    qty: 0,
    bruto: 0,
    tara: 0,
    neto: 0,
    price: 0,
    origin: "",
    amt: 0
  };
}

function duplicateActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("No hay factura");
  const copy = structuredClone(inv);
  copy.id = uid("inv");
  copy.number = makeInvoiceNumber(new Date());
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  // duplicate: keep lines/payments but typically reset payments
  copy.payments = [];
  copy.pdf = { localIdbKey: "", cloudUrl: "" };
  copy.closed = false;

  STATE.invoices.unshift(copy);
  saveAllLocal();
  renderInvoiceList();
  openInvoice(copy.id);
  showToast("Factura duplicada");
  maybeAutoSync();
}

function deleteActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("No hay factura");
  if (!confirm(`Eliminar factura ${inv.number}?`)) return;
  const idx = STATE.invoices.findIndex(x => x.id === inv.id);
  if (idx >= 0) STATE.invoices.splice(idx, 1);
  STATE.activeInvoiceId = null;
  saveAllLocal();
  renderInvoiceList();
  clearInvoiceEditor();
  showToast("Factura eliminada");
  maybeAutoSync();
}

/* =========================
   21) INVOICE LIST RENDER
========================= */
function invoiceMatches(inv, q) {
  q = normStr(q);
  if (!q) return true;
  const cn = (inv.clientSnap?.name || inv.clientSnap?.alias || "");
  const tags = (inv.tags || []).join(", ");
  return (
    includesAny(inv.number, q) ||
    includesAny(cn, q) ||
    includesAny(tags, q)
  );
}

function computeInvoiceTotal(inv) {
  const sub = inv.lines.reduce((acc, ln) => acc + round2(ln.amt), 0);
  const ship = inv.shipOn ? (sub * (toNum(STATE.settings.shipRate) / 100)) : 0;
  const base = sub + ship;
  const vat = inv.vatIncluded ? 0 : (base * (toNum(STATE.settings.vatRate) / 100));
  const total = base + vat;
  return { sub: round2(sub), ship: round2(ship), vat: round2(vat), total: round2(total) };
}

function computePaid(inv) {
  const paid = (inv.payments || []).reduce((a,p)=>a + round2(p.amount), 0);
  return round2(paid);
}

function computeStatus(inv) {
  const { total } = computeInvoiceTotal(inv);
  const paid = computePaid(inv);
  if (paid <= 0.00001) return { label:"Impagada", variant:"normal" };
  if (paid + 0.01 < total) return { label:"Parcial", variant:"normal" };
  return { label:"Pagada", variant:"ok" };
}

function renderInvoiceList() {
  const q = EL.invoiceSearch?.value || "";
  const items = STATE.invoices.filter(inv => invoiceMatches(inv, q));

  safeSetText(EL.invoiceListMeta, `${items.length} facturas`);

  if (!EL.invoiceList) return;
  EL.invoiceList.innerHTML = "";

  for (const inv of items) {
    const totals = computeInvoiceTotal(inv);
    const cn = inv.clientSnap?.alias || inv.clientSnap?.name || "— Sin cliente —";
    const status = computeStatus(inv);

    const div = document.createElement("div");
    div.className = "listItem" + (inv.id === STATE.activeInvoiceId ? " active" : "");
    div.dataset.id = inv.id;

    div.innerHTML = `
      <div class="liTop">
        <div class="liNum">${escapeHTML(inv.number)}</div>
        <div class="liTotal mono">${money(totals.total)}</div>
      </div>
      <div class="liSub">
        <span>${escapeHTML(inv.dateISO || "")}</span>
        <span>•</span>
        <span>${escapeHTML(cn)}</span>
        <span>•</span>
        <span>${escapeHTML(status.label)}</span>
        ${inv.closed ? `<span>•</span><span class="mono">CERRADA</span>` : ``}
      </div>
    `;
    div.addEventListener("click", () => openInvoice(inv.id));
    EL.invoiceList.appendChild(div);
  }
}

function clearInvoiceEditor() {
  safeSetText(EL.editorTitle, "Editor de factura");
  safeSetText(EL.editorSubtitle, "Selecciona una factura o crea una nueva.");
  // provider
  safeSetValue(EL.prov_name, "");
  safeSetValue(EL.prov_nif, "");
  safeSetValue(EL.prov_addr, "");
  safeSetValue(EL.prov_tel, "");
  safeSetValue(EL.prov_email, "");
  // client
  safeSetValue(EL.client_select, "");
  safeSetValue(EL.cli_name, "");
  safeSetValue(EL.cli_nif, "");
  safeSetValue(EL.cli_addr, "");
  safeSetValue(EL.cli_tel, "");
  safeSetValue(EL.cli_email, "");
  // meta
  safeSetValue(EL.inv_number, "");
  safeSetValue(EL.inv_date, "");
  safeSetValue(EL.inv_tags, "");
  safeSetValue(EL.inv_notes, "");
  // lines
  if (EL.linesBody) EL.linesBody.innerHTML = "";
  // totals
  safeSetText(EL.tot_sub, "0,00");
  safeSetText(EL.tot_ship, "0,00");
  safeSetText(EL.tot_vat, "0,00");
  safeSetText(EL.tot_all, "0,00");
  // payments
  if (EL.payList) EL.payList.innerHTML = "";
  safeSetText(EL.paid_total, "0,00");
  safeSetText(EL.due_total, "0,00");
  setPill(EL.invStatusPill, "Impagada");
  if (EL.chkClosed) EL.chkClosed.checked = false;
  // pdf buttons
  if (EL.btnOpenPDF) EL.btnOpenPDF.disabled = true;
  if (EL.btnCopyPDF) EL.btnCopyPDF.disabled = true;
  safeSetText(EL.pdfMeta, "");
  // QR
  if (EL.qrMount) EL.qrMount.innerHTML = "";
}

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   22) INVOICE OPEN / EDITOR POPULATE
========================= */
function renderClientSelector(selectedId = "") {
  if (!EL.client_select) return;
  const prev = selectedId || EL.client_select.value || "";
  EL.client_select.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  for (const c of STATE.clients) {
    const name = c.alias ? `${c.alias} — ${c.name}` : c.name;
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = name || "(sin nombre)";
    EL.client_select.appendChild(opt);
  }
  EL.client_select.value = prev;
}

function openInvoice(id) {
  const inv = STATE.invoices.find(x => x.id === id);
  if (!inv) return;
  sanitizeInvoice(inv);
  STATE.activeInvoiceId = inv.id;

  safeSetText(EL.editorTitle, "Editor de factura");
  safeSetText(EL.editorSubtitle, `${inv.number} · ${inv.dateISO}`);

  // provider snap
  const p = inv.providerSnap || STATE.provider;
  safeSetValue(EL.prov_name, p.name || "");
  safeSetValue(EL.prov_nif, p.nif || "");
  safeSetValue(EL.prov_addr, p.addr || "");
  safeSetValue(EL.prov_tel, p.tel || "");
  safeSetValue(EL.prov_email, p.email || "");

  // client selector
  renderClientSelector(inv.clientId || "");
  safeSetValue(EL.client_select, inv.clientId || "");

  // client snap fields
  const cs = inv.clientSnap;
  safeSetValue(EL.cli_name, cs?.alias || cs?.name || "");
  safeSetValue(EL.cli_nif, cs?.nif || "");
  safeSetValue(EL.cli_addr, cs?.addr || "");
  safeSetValue(EL.cli_tel, cs?.tel || "");
  safeSetValue(EL.cli_email, cs?.email || "");

  // meta
  safeSetValue(EL.inv_number, inv.number);
  safeSetValue(EL.inv_date, inv.dateISO);
  safeSetValue(EL.inv_tags, (inv.tags || []).join(", "));
  safeSetValue(EL.inv_notes, inv.notes || "");

  // toggles
  if (EL.chkShip) EL.chkShip.checked = !!inv.shipOn;
  if (EL.chkVatIncluded) EL.chkVatIncluded.checked = !!inv.vatIncluded;
  if (EL.chkAutoSync) EL.chkAutoSync.checked = !!STATE.settings.cloud.autoSync;
  if (EL.chkClosed) EL.chkClosed.checked = !!inv.closed;

  // labels
  safeSetText(EL.shipPctLabel, `${toNum(STATE.settings.shipRate)}%`);
  safeSetText(EL.vatModeLabel, inv.vatIncluded ? "IVA incluido" : `${toNum(STATE.settings.vatRate)}%`);

  // lines
  renderLines(inv);

  // totals + payments
  recalcAndRenderTotals();
  renderPayments(inv);

  // pdf buttons state
  updatePDFButtons(inv);

  // list highlight
  renderInvoiceList();

  // QR
  renderQRForActive();
}

/* =========================
   23) APPLY CLIENT SNAP
========================= */
function applyClientToActiveInvoice(clientId) {
  const inv = getActiveInvoice();
  if (!inv) return;

  inv.clientId = clientId || "";
  const c = clientId ? getClientById(clientId) : null;

  if (c) {
    inv.clientSnap = {
      id: c.id,
      name: c.name || "",
      alias: c.alias || "",
      nif: c.nif || "",
      addr: c.addr || "",
      tel: c.tel || "",
      email: c.email || "",
      tags: Array.isArray(c.tags) ? c.tags.slice() : [],
      vatIncluded: !!c.vatIncluded,
      shipOn: !!c.shipOn
    };

    // apply per-client defaults (only if invoice is "fresh-ish" or user chooses)
    inv.vatIncluded = (typeof c.vatIncluded === "boolean") ? !!c.vatIncluded : inv.vatIncluded;
    inv.shipOn = (typeof c.shipOn === "boolean") ? !!c.shipOn : inv.shipOn;

    // update UI
    safeSetValue(EL.cli_name, c.alias || c.name || "");
    safeSetValue(EL.cli_nif, c.nif || "");
    safeSetValue(EL.cli_addr, c.addr || "");
    safeSetValue(EL.cli_tel, c.tel || "");
    safeSetValue(EL.cli_email, c.email || "");

    if (EL.chkVatIncluded) EL.chkVatIncluded.checked = !!inv.vatIncluded;
    if (EL.chkShip) EL.chkShip.checked = !!inv.shipOn;
  } else {
    inv.clientSnap = null;
    safeSetValue(EL.cli_name, "");
    safeSetValue(EL.cli_nif, "");
    safeSetValue(EL.cli_addr, "");
    safeSetValue(EL.cli_tel, "");
    safeSetValue(EL.cli_email, "");
  }

  touchEntity(inv);
  saveAllLocal();
  recalcAndRenderTotals();
  renderInvoiceList();
  renderQRForActive();
  showToast("Cliente aplicado");
  maybeAutoSync();
}

/* =========================
   24) LINES RENDER + GRID PRO
========================= */
function renderLines(inv) {
  if (!EL.linesBody || !EL.rowTpl) return;
  EL.linesBody.innerHTML = "";

  // ensure at least 1
  if (!Array.isArray(inv.lines)) inv.lines = [];
  if (inv.lines.length === 0) inv.lines.push(makeEmptyLine());

  inv.lines.forEach((ln, idx) => {
    const row = EL.rowTpl.content.firstElementChild.cloneNode(true);

    const prodInput = row.querySelector(".prodInput");
    const hintPrice = row.querySelector(".hintPrice");
    const modeSel = row.querySelector(".modeSel");
    const qty = row.querySelector(".qty");
    const bruto = row.querySelector(".bruto");
    const tara = row.querySelector(".tara");
    const neto = row.querySelector(".neto");
    const price = row.querySelector(".price");
    const origin = row.querySelector(".origin");
    const amt = row.querySelector(".amt");
    const btnX = row.querySelector(".btnX");

    // initial values
    prodInput.value = ln.prodName || "";
    modeSel.value = ln.mode || "kg";
    qty.value = ln.qty ? String(ln.qty).replace(".", ",") : "";
    bruto.value = ln.bruto ? String(ln.bruto).replace(".", ",") : "";
    tara.value = ln.tara ? String(ln.tara).replace(".", ",") : "";
    neto.value = ln.neto ? String(ln.neto).replace(".", ",") : "";
    price.value = ln.price ? String(ln.price).replace(".", ",") : "";
    origin.value = ln.origin || "";
    amt.textContent = money(ln.amt || 0);

    // hint price from product hist/current (ONLY screen)
    updateLineHint(ln, hintPrice);

    // Autocomplete (lightweight native datalist-like overlay)
    attachProductAutocomplete(prodInput, (chosen) => {
      applyProductToLine(ln, chosen);
      // update UI fields (price origin mode defaults)
      prodInput.value = ln.prodName || "";
      modeSel.value = ln.mode || "kg";
      price.value = ln.price ? String(ln.price).replace(".", ",") : "";
      origin.value = ln.origin || "";
      updateLineHint(ln, hintPrice);
      recalcLine(ln);
      amt.textContent = money(ln.amt || 0);
      recalcAndRenderTotals();
      touchEntity(inv);
      saveAllLocal();
      maybeAutoSync();
    });

    // mode change
    modeSel.addEventListener("change", () => {
      ln.mode = modeSel.value;
      // adapt auto fields
      recalcLine(ln);
      neto.value = ln.neto ? String(ln.neto).replace(".", ",") : "";
      amt.textContent = money(ln.amt || 0);
      recalcAndRenderTotals();
      touchEntity(inv);
      saveAllLocal();
      maybeAutoSync();
    });

    // qty/bruto/tara/price/origin inputs
    const onChange = () => {
      ln.qty = clampNonNeg(toNum(qty.value));
      ln.bruto = clampNonNeg(toNum(bruto.value));
      ln.tara = clampNonNeg(toNum(tara.value));
      ln.price = toNum(price.value); // allow 0
      ln.origin = normStr(origin.value);

      recalcLine(ln);

      neto.value = (ln.neto ? String(ln.neto).replace(".", ",") : "");
      amt.textContent = money(ln.amt || 0);

      updateLineHint(ln, hintPrice);

      recalcAndRenderTotals();
      touchEntity(inv);
      saveAllLocal();
      maybeAutoSync();
    };

    [qty, bruto, tara, price, origin].forEach(inp => {
      inp.addEventListener("input", onChange);
    });

    // delete row
    btnX.addEventListener("click", () => {
      const inv2 = getActiveInvoice();
      if (!inv2) return;
      inv2.lines = inv2.lines.filter(x => x.id !== ln.id);
      if (inv2.lines.length === 0) inv2.lines.push(makeEmptyLine());
      touchEntity(inv2);
      saveAllLocal();
      renderLines(inv2);
      recalcAndRenderTotals();
      maybeAutoSync();
    });

    // Keyboard: Enter -> next field, and if last -> next row
    attachEnterNav(row);

    EL.linesBody.appendChild(row);
  });
}

function attachEnterNav(row) {
  const inputs = Array.from(row.querySelectorAll("input, select"));
  inputs.forEach((inp, i) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      // allow Enter on select too
      e.preventDefault();
      const next = inputs[i + 1];
      if (next) {
        next.focus();
        if (next.select) next.select();
        return;
      }
      // last field -> next row first input
      const allRows = Array.from(EL.linesBody.querySelectorAll(".tr"));
      const idx = allRows.indexOf(row);
      const nextRow = allRows[idx + 1];
      if (nextRow) {
        const first = nextRow.querySelector("input, select");
        if (first) {
          first.focus();
          if (first.select) first.select();
          return;
        }
      } else {
        // if last row, create new row
        addLineToActiveInvoice();
        setTimeout(() => {
          const rows = Array.from(EL.linesBody.querySelectorAll(".tr"));
          const last = rows[rows.length - 1];
          const first = last?.querySelector("input, select");
          first?.focus();
        }, 0);
      }
    });
  });
}

function updateLineHint(ln, hintEl) {
  if (!hintEl) return;
  const p = ln.prodId ? getProductById(ln.prodId) : findProductByName(ln.prodName);
  if (!p) { hintEl.textContent = ""; return; }
  const hist = Array.isArray(p.priceHist) ? p.priceHist : [];
  const last = hist[0]?.price;
  const txt = [];
  if (p.price) txt.push(`Actual: ${money(p.price)}`);
  if (last && last !== p.price) txt.push(`Últ: ${money(last)}`);
  hintEl.textContent = txt.join(" · ");
}

function findProductByName(name) {
  const nk = normKey(name);
  if (!nk) return null;
  return STATE.products.find(p => normKey(p.name) === nk) || null;
}

function applyProductToLine(ln, product) {
  if (!product) return;
  ln.prodId = product.id;
  ln.prodName = product.name;

  // default mode
  ln.mode = product.unitDefault || ln.mode || "kg";

  // set default origin if empty
  if (!ln.origin) ln.origin = product.origin || "";

  // set price if invoice not closed or line price empty
  const inv = getActiveInvoice();
  const canOverwrite = !(STATE.settings.preventOverwriteClosedInvoices && inv?.closed);
  if (canOverwrite) {
    // only set if user hasn't typed a price or 0
    // if it's a brand new selection, overwrite
    ln.price = toNum(product.price);
  }

  // optional: if mode caja and kgBox exists, set qty to 1 if empty
  if (ln.mode === "caja" && !ln.qty) ln.qty = 1;
}

function recalcLine(ln) {
  // sanitize
  ln.qty = clampNonNeg(ln.qty);
  ln.bruto = clampNonNeg(ln.bruto);
  ln.tara = clampNonNeg(ln.tara);
  ln.price = toNum(ln.price);

  // neto base from bruto-tara
  let neto = clampNonNeg(ln.bruto - ln.tara);

  const p = ln.prodId ? getProductById(ln.prodId) : findProductByName(ln.prodName);
  const kgBox = p ? toNum(p.kgBox) : 0;

  if (ln.mode === "kg") {
    ln.neto = round2(neto);
    ln.amt = round2(ln.neto * ln.price);
    return;
  }

  if (ln.mode === "ud") {
    ln.neto = round2(neto); // keep for info if user typed bruto/tara
    ln.amt = round2(ln.qty * ln.price);
    return;
  }

  // caja
  // if user didn't fill bruto/tara but product has kgBox -> neto = qty * kgBox
  if (kgBox > 0 && (ln.bruto <= 0 && ln.tara <= 0)) {
    ln.neto = round2(ln.qty * kgBox);
  } else {
    ln.neto = round2(neto);
  }

  // pricing interpretation:
  // default: price is per caja when mode=caja (simpler & controllable)
  // If user wants per kg, just set product unitDefault=kg or switch mode to kg.
  ln.amt = round2(ln.qty * ln.price);
}

/* =========================
   25) LINE ACTIONS
========================= */
function addLineToActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("Selecciona una factura");
  inv.lines.push(makeEmptyLine());
  touchEntity(inv);
  saveAllLocal();
  renderLines(inv);
  recalcAndRenderTotals();
  maybeAutoSync();
}

function clearLinesActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return;
  if (!confirm("Vaciar líneas de la factura?")) return;
  inv.lines = [];
  for (let i = 0; i < 5; i++) inv.lines.push(makeEmptyLine());
  touchEntity(inv);
  saveAllLocal();
  renderLines(inv);
  recalcAndRenderTotals();
  maybeAutoSync();
}

/* =========================
   26) TOTALS + PAYMENTS
========================= */
function recalcAndRenderTotals() {
  const inv = getActiveInvoice();
  if (!inv) return;

  // recalc all lines
  inv.lines.forEach(recalcLine);

  const totals = computeInvoiceTotal(inv);

  safeSetText(EL.tot_sub, money(totals.sub));
  safeSetText(EL.tot_ship, money(totals.ship));
  safeSetText(EL.tot_vat, money(totals.vat));
  safeSetText(EL.tot_all, money(totals.total));

  safeSetText(EL.shipPctLabel, `${toNum(STATE.settings.shipRate)}%`);
  safeSetText(EL.vatModeLabel, inv.vatIncluded ? "IVA incluido" : `${toNum(STATE.settings.vatRate)}%`);

  // payments
  const paid = computePaid(inv);
  const due = round2(totals.total - paid);
  safeSetText(EL.paid_total, money(paid));
  safeSetText(EL.due_total, money(due < 0 ? 0 : due));

  const st = computeStatus(inv);
  setPill(EL.invStatusPill, st.label, st.variant);

  // persist line totals into invoice updated
  touchEntity(inv);
  saveAllLocal();
  renderInvoiceList();
}

function renderPayments(inv) {
  if (!EL.payList) return;
  EL.payList.innerHTML = "";

  if (!inv.payments || inv.payments.length === 0) {
    EL.payList.innerHTML = `<div class="muted tiny">Sin pagos</div>`;
    const st = computeStatus(inv);
    setPill(EL.invStatusPill, st.label, st.variant);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "8px";

  inv.payments
    .slice()
    .sort((a,b)=>b.ts-a.ts)
    .forEach((p) => {
      const row = document.createElement("div");
      row.className = "listItem";
      row.style.margin = "0";
      row.style.cursor = "default";
      row.innerHTML = `
        <div class="liTop">
          <div class="liNum">${escapeHTML(p.method || "")}</div>
          <div class="liTotal mono">${money(p.amount || 0)}</div>
        </div>
        <div class="liSub">
          <span class="mono">${new Date(p.ts).toLocaleString()}</span>
          <span>•</span>
          <button class="btn btn-ghost" style="padding:6px 10px;border-radius:999px;" data-pay-id="${p.id}">Eliminar</button>
        </div>
      `;
      wrap.appendChild(row);
    });

  EL.payList.appendChild(wrap);

  // delete payment
  EL.payList.querySelectorAll("button[data-pay-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const inv2 = getActiveInvoice();
      if (!inv2) return;
      const pid = btn.getAttribute("data-pay-id");
      inv2.payments = inv2.payments.filter(x => x.id !== pid);
      touchEntity(inv2);
      saveAllLocal();
      renderPayments(inv2);
      recalcAndRenderTotals();
      maybeAutoSync();
    });
  });
}

function addPaymentToActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("Selecciona una factura");
  const method = EL.pay_method?.value || "efectivo";
  const amount = round2(clampNonNeg(toNum(EL.pay_amount?.value || 0)));
  if (amount <= 0) return showToast("Importe inválido");

  inv.payments = inv.payments || [];
  inv.payments.push({
    id: uid("pay"),
    ts: Date.now(),
    method,
    amount
  });

  if (EL.pay_amount) EL.pay_amount.value = "";
  touchEntity(inv);
  saveAllLocal();
  renderPayments(inv);
  recalcAndRenderTotals();
  showToast("Pago añadido");
  maybeAutoSync();
}

/* =========================
   27) SAVE ACTIVE INVOICE FROM UI
========================= */
function readProviderFromUI() {
  return {
    name: normStr(EL.prov_name?.value),
    nif:  normStr(EL.prov_nif?.value),
    addr: normStr(EL.prov_addr?.value),
    tel:  normStr(EL.prov_tel?.value),
    email:normStr(EL.prov_email?.value)
  };
}

function saveActiveInvoiceFromUI() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("No hay factura abierta");

  // provider default also updated in settings/provider storage
  const p = readProviderFromUI();
  STATE.provider = structuredClone(p);
  inv.providerSnap = structuredClone(p);

  // client snap live editable fields
  const cs = inv.clientSnap || {};
  inv.clientSnap = {
    id: inv.clientId || "",
    name: cs.name || "",
    alias: normStr(EL.cli_name?.value) || cs.alias || "",
    nif: normStr(EL.cli_nif?.value) || "",
    addr: normStr(EL.cli_addr?.value) || "",
    tel: normStr(EL.cli_tel?.value) || "",
    email: normStr(EL.cli_email?.value) || "",
    tags: Array.isArray(cs.tags) ? cs.tags.slice() : [],
    vatIncluded: !!inv.vatIncluded,
    shipOn: !!inv.shipOn
  };

  inv.dateISO = EL.inv_date?.value || inv.dateISO || nowISODate();
  inv.tags = splitTags(EL.inv_tags?.value || "");
  inv.notes = normStr(EL.inv_notes?.value || "");

  // ensure calculations
  inv.lines.forEach(recalcLine);

  touchEntity(inv);
  saveAllLocal();
  renderInvoiceList();
  renderQRForActive();
  showToast("Guardado");
  maybeAutoSync();
}

/* =========================
   28) WHATSAPP TXT
========================= */
function buildWhatsAppTXT(inv) {
  const totals = computeInvoiceTotal(inv);
  const cName = inv.clientSnap?.alias || inv.clientSnap?.name || "—";

  const header = [
    `*FACTURA* ${inv.number}`,
    `Fecha: ${inv.dateISO}`,
    `Cliente: ${cName}`,
    `Total: ${money(totals.total)} €`,
    inv.pdf?.cloudUrl ? `PDF: ${inv.pdf.cloudUrl}` : ""
  ].filter(Boolean).join("\n");

  const lines = (inv.lines || [])
    .filter(ln => normStr(ln.prodName))
    .map(ln => {
      const mode = ln.mode || "kg";
      const qty = round2(ln.qty);
      const neto = round2(ln.neto);
      const pr = round2(ln.price);
      const amt = round2(ln.amt);
      if (mode === "kg") {
        return `- ${ln.prodName}: Neto ${neto} kg × ${money(pr)} = ${money(amt)}`;
      }
      if (mode === "caja") {
        return `- ${ln.prodName}: ${qty} caja × ${money(pr)} = ${money(amt)}${(neto>0?` (Neto ${neto} kg)`:``)}`;
      }
      return `- ${ln.prodName}: ${qty} ud × ${money(pr)} = ${money(amt)}${(neto>0?` (Neto ${neto} kg)`:``)}`;
    })
    .join("\n");

  const footer = [
    "",
    `Subtotal: ${money(totals.sub)} €`,
    inv.shipOn ? `Transporte (${toNum(STATE.settings.shipRate)}%): ${money(totals.ship)} €` : `Transporte: 0,00 €`,
    inv.vatIncluded ? `IVA: incluido en precios` : `IVA (${toNum(STATE.settings.vatRate)}%): ${money(totals.vat)} €`,
    `TOTAL: ${money(totals.total)} €`
  ].join("\n");

  return `${header}\n\n${lines}${footer}`;
}

async function exportWhatsAppTXT() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("Selecciona una factura");
  const txt = buildWhatsAppTXT(inv);

  try {
    await navigator.clipboard.writeText(txt);
    showToast("Copiado para WhatsApp");
  } catch {
    // fallback prompt
    prompt("Copia el texto:", txt);
  }
}

/* =========================
   29) PDF BUTTON STATE (idb/cloud done in 3C)
========================= */
function updatePDFButtons(inv) {
  const hasLocal = !!inv.pdf?.localIdbKey;
  const hasCloud = !!inv.pdf?.cloudUrl;

  if (EL.btnOpenPDF) EL.btnOpenPDF.disabled = !(hasLocal || hasCloud);
  if (EL.btnCopyPDF) EL.btnCopyPDF.disabled = !hasCloud;

  const meta = [];
  if (hasLocal) meta.push("PDF local ✔");
  if (hasCloud) meta.push("Cloud ✔");
  safeSetText(EL.pdfMeta, meta.join(" · "));
}

/* =========================
   30) PRODUCT AUTOCOMPLETE (overlay)
========================= */
let AC = { mount: null, open: false, items: [], idx: -1, onPick: null, anchor: null };

function ensureACMount() {
  if (AC.mount) return;
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.zIndex = "9999";
  div.style.background = "#fff";
  div.style.border = "1px solid var(--border)";
  div.style.borderRadius = "12px";
  div.style.boxShadow = "0 12px 30px rgba(0,0,0,.10)";
  div.style.padding = "6px";
  div.style.minWidth = "260px";
  div.style.maxWidth = "520px";
  div.style.maxHeight = "260px";
  div.style.overflow = "auto";
  div.hidden = true;
  document.body.appendChild(div);
  AC.mount = div;

  window.addEventListener("scroll", () => { if (AC.open) positionAC(); }, true);
  window.addEventListener("resize", () => { if (AC.open) positionAC(); });
  document.addEventListener("click", (e) => {
    if (!AC.open) return;
    if (e.target === AC.anchor || AC.mount.contains(e.target)) return;
    closeAC();
  });
}

function attachProductAutocomplete(input, onPick) {
  ensureACMount();
  input.addEventListener("input", () => {
    const q = normStr(input.value);
    if (!q) return closeAC();
    const list = suggestProducts(q).slice(0, 10);
    if (list.length === 0) return closeAC();
    openAC(input, list, onPick);
  });

  input.addEventListener("focus", () => {
    const q = normStr(input.value);
    if (!q) return;
    const list = suggestProducts(q).slice(0, 10);
    if (list.length === 0) return;
    openAC(input, list, onPick);
  });

  input.addEventListener("keydown", (e) => {
    if (!AC.open || AC.anchor !== input) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      AC.idx = Math.min(AC.items.length - 1, AC.idx + 1);
      paintAC();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      AC.idx = Math.max(0, AC.idx - 1);
      paintAC();
    } else if (e.key === "Enter") {
      if (AC.idx >= 0 && AC.items[AC.idx]) {
        e.preventDefault();
        pickAC(AC.items[AC.idx]);
      }
    } else if (e.key === "Escape") {
      closeAC();
    }
  });
}

function suggestProducts(q) {
  const nq = normKey(q);
  const scored = [];
  for (const p of STATE.products) {
    const name = normKey(p.name);
    if (!name) continue;
    let score = 0;
    if (name.startsWith(nq)) score = 3;
    else if (name.includes(nq)) score = 2;
    else continue;
    scored.push({ p, score });
  }
  scored.sort((a,b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return scored.map(x => x.p);
}

function openAC(anchor, items, onPick) {
  AC.open = true;
  AC.anchor = anchor;
  AC.items = items;
  AC.idx = 0;
  AC.onPick = onPick;
  paintAC();
  positionAC();
  AC.mount.hidden = false;
}

function paintAC() {
  const div = AC.mount;
  if (!div) return;
  div.innerHTML = "";
  AC.items.forEach((p, i) => {
    const row = document.createElement("div");
    row.style.padding = "10px 10px";
    row.style.borderRadius = "10px";
    row.style.cursor = "pointer";
    row.style.fontWeight = "800";
    row.style.fontSize = "13px";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.background = (i === AC.idx) ? "#000" : "transparent";
    row.style.color = (i === AC.idx) ? "#fff" : "#000";

    const right = [];
    if (toNum(p.price)) right.push(money(p.price));
    if (p.unitDefault) right.push(p.unitDefault);
    row.innerHTML = `<span>${escapeHTML(p.name)}</span><span class="mono" style="font-weight:900">${escapeHTML(right.join(" · "))}</span>`;

    row.addEventListener("mouseenter", () => { AC.idx = i; paintAC(); });
    row.addEventListener("mousedown", (e) => {
      e.preventDefault(); // avoid blur
      pickAC(p);
    });

    div.appendChild(row);
  });
}

function positionAC() {
  if (!AC.open || !AC.anchor || !AC.mount) return;
  const r = AC.anchor.getBoundingClientRect();
  const div = AC.mount;

  const top = Math.min(window.innerHeight - 20, r.bottom + 6);
  const left = Math.min(window.innerWidth - 20, r.left);
  div.style.top = `${top}px`;
  div.style.left = `${left}px`;
  div.style.width = `${Math.max(280, r.width)}px`;
}

function pickAC(p) {
  const cb = AC.onPick;
  closeAC();
  if (cb) cb(p);
}

function closeAC() {
  if (!AC.mount) return;
  AC.open = false;
  AC.items = [];
  AC.idx = -1;
  AC.anchor = null;
  AC.onPick = null;
  AC.mount.hidden = true;
  AC.mount.innerHTML = "";
}
/* =========================================================
   app.js (3/3) — Clients/Products/Accounting/Settings/Backup
                 QR + PDF + IndexedDB + Firebase Cloud + Merge + init()
   ========================================================= */

/* =========================
   40) INDEXEDDB (PDF CACHE)
========================= */
const IDB = {
  name: "af_kiwi_db",
  version: 1,
  store: "pdfs"
};

let _dbp = null;

function idbOpen() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB.name, IDB.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB.store)) {
        db.createObjectStore(IDB.store, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

async function idbPutPDF(key, blob, meta = {}) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB.store, "readwrite");
    const st = tx.objectStore(IDB.store);
    st.put({ key, blob, ts: Date.now(), meta });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetPDF(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB.store, "readonly");
    const st = tx.objectStore(IDB.store);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeletePDF(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB.store, "readwrite");
    const st = tx.objectStore(IDB.store);
    st.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClearAllPDFs() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB.store, "readwrite");
    const st = tx.objectStore(IDB.store);
    st.clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================
   41) QR (SCREEN + PDF)
========================= */
async function ensureQRLib() {
  try {
    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
      () => !!window.QRCode
    );
    return true;
  } catch (e) {
    console.warn("QR lib fail", e);
    return false;
  }
}

function buildQRText(inv) {
  const tpl = normStr(STATE.settings.qrTpl || DEFAULT_SETTINGS.qrTpl);
  const nif = normStr(inv.providerSnap?.nif || STATE.provider?.nif || "");
  const num = normStr(inv.number || "");
  const fecha = normStr(inv.dateISO || "");
  const total = money(computeInvoiceTotal(inv).total);
  return tpl
    .replaceAll("{NIF}", nif)
    .replaceAll("{NUM}", num)
    .replaceAll("{FECHA}", fecha)
    .replaceAll("{TOTAL}", total);
}

async function renderQRForActive() {
  const inv = getActiveInvoice();
  if (!inv || !EL.qrMount) return;
  EL.qrMount.innerHTML = "";

  const ok = await ensureQRLib();
  if (!ok || !window.QRCode) {
    EL.qrMount.innerHTML = `<div class="muted tiny" style="text-align:center;padding:18px">QR no disponible (sin librería)</div>`;
    return;
  }

  const text = buildQRText(inv);
  try {
    new window.QRCode(EL.qrMount, {
      text,
      width: 180,
      height: 180,
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } catch (e) {
    console.warn("QR render fail", e);
    EL.qrMount.innerHTML = `<div class="muted tiny" style="text-align:center;padding:18px">QR error</div>`;
  }
}

async function qrDataURL(text, size = 180) {
  const ok = await ensureQRLib();
  if (!ok || !window.QRCode) return null;

  const tmp = document.createElement("div");
  tmp.style.position = "fixed";
  tmp.style.left = "-9999px";
  tmp.style.top = "-9999px";
  document.body.appendChild(tmp);

  try {
    tmp.innerHTML = "";
    new window.QRCode(tmp, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });

    // qrcodejs renders sync but image/canvas might appear slightly later; poll quickly
    const t0 = Date.now();
    while (Date.now() - t0 < 1000) {
      const canvas = tmp.querySelector("canvas");
      if (canvas) {
        const url = canvas.toDataURL("image/png");
        document.body.removeChild(tmp);
        return url;
      }
      const img = tmp.querySelector("img");
      if (img && img.src) {
        document.body.removeChild(tmp);
        return img.src;
      }
      await new Promise(r => setTimeout(r, 50));
    }
  } catch (e) {
    console.warn("qrDataURL fail", e);
  }

  document.body.removeChild(tmp);
  return null;
}

/* =========================
   42) PDF (jsPDF + AutoTable) + CACHE LOCAL + (optional) CLOUD UPLOAD
========================= */
async function ensurePDFLibs() {
  try {
    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      () => !!(window.jspdf && window.jspdf.jsPDF)
    );
    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
      () => {
        // plugin attaches to jsPDF prototype; check existence via doc.autoTable after creating
        return true;
      }
    );
    return true;
  } catch (e) {
    console.warn("PDF libs fail", e);
    return false;
  }
}

function simpleLogoDataURL() {
  // Minimal inline “logo” fallback: we will draw text if no image.
  // Return null to force text-only.
  return null;
}

async function generatePDFForActiveInvoice() {
  const inv = getActiveInvoice();
  if (!inv) return showToast("Selecciona una factura");

  // Ensure calculations are correct
  inv.lines.forEach(recalcLine);
  const totals = computeInvoiceTotal(inv);

  const ok = await ensurePDFLibs();
  if (!ok) {
    showToast("No se pudo cargar PDF (offline/CDN).");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FACTURA", margin, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nº: ${inv.number}`, margin, 72);
  doc.text(`Fecha: ${inv.dateISO}`, margin, 86);

  // Provider / Client blocks
  const p = inv.providerSnap || STATE.provider;
  const c = inv.clientSnap || {};

  const boxY = 102;
  const boxH = 92;
  const boxGap = 12;
  const leftW = (pageW - margin*2 - boxGap) * 0.52;
  const rightW = (pageW - margin*2 - boxGap) * 0.48;

  // Provider box
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, boxY, leftW, boxH, 8, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Proveedor", margin + 10, boxY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const provLines = [
    normStr(p.name),
    normStr(p.nif) ? `NIF: ${normStr(p.nif)}` : "",
    normStr(p.addr),
    normStr(p.tel) ? `Tel: ${normStr(p.tel)}` : "",
    normStr(p.email) ? `Email: ${normStr(p.email)}` : ""
  ].filter(Boolean);
  provLines.forEach((t, i) => doc.text(t, margin + 10, boxY + 34 + i*12));

  // Client box
  const cx = margin + leftW + boxGap;
  doc.roundedRect(cx, boxY, rightW, boxH, 8, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Cliente", cx + 10, boxY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clientName = normStr(c.alias || c.name);
  const cliLines = [
    clientName || "—",
    normStr(c.nif) ? `NIF/CIF: ${normStr(c.nif)}` : "",
    normStr(c.addr),
    normStr(c.tel) ? `Tel: ${normStr(c.tel)}` : "",
    normStr(c.email) ? `Email: ${normStr(c.email)}` : ""
  ].filter(Boolean);
  cliLines.forEach((t, i) => doc.text(t, cx + 10, boxY + 34 + i*12));

  // QR (top right, inside client box area)
  const qrText = buildQRText(inv);
  const qrUrl = await qrDataURL(qrText, 120);
  if (qrUrl) {
    try {
      doc.addImage(qrUrl, "PNG", cx + rightW - 10 - 86, boxY + 10, 86, 86);
    } catch (e) {
      console.warn("addImage QR fail", e);
    }
  } else {
    // small placeholder
    doc.setFontSize(8);
    doc.text("QR", cx + rightW - 24, boxY + 20);
  }

  // Notes / tags (optional)
  const afterBoxY = boxY + boxH + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const tags = (inv.tags || []).join(", ");
  if (tags) doc.text(`Tags: ${tags}`, margin, afterBoxY);
  if (inv.notes) doc.text(`Notas: ${inv.notes}`, margin, afterBoxY + 14);

  // Table data
  const head = [[
    "Producto", "Modo", "Cant.", "Bruto", "Tara", "Neto", "Precio", "Origen", "Importe"
  ]];

  const body = (inv.lines || [])
    .filter(ln => normStr(ln.prodName))
    .map(ln => {
      const mode = ln.mode || "kg";
      return [
        ln.prodName,
        mode,
        (mode === "kg") ? "" : String(round2(ln.qty)).replace(".", ","),
        String(round2(ln.bruto)).replace(".", ","),
        String(round2(ln.tara)).replace(".", ","),
        String(round2(ln.neto)).replace(".", ","),
        String(round2(ln.price)).replace(".", ","),
        ln.origin || "",
        money(ln.amt || 0)
      ];
    });

  // AutoTable
  const startY = afterBoxY + (tags || inv.notes ? 28 : 10);

  doc.autoTable({
    startY,
    head,
    body,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, lineWidth: 0.2, lineColor: 0 },
    headStyles: { fillColor: [240,240,240], textColor: [0,0,0], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250,250,250] },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 34 },
      2: { halign: "right", cellWidth: 42 },
      3: { halign: "right", cellWidth: 44 },
      4: { halign: "right", cellWidth: 36 },
      5: { halign: "right", cellWidth: 40 },
      6: { halign: "right", cellWidth: 46 },
      7: { cellWidth: 62 },
      8: { halign: "right", cellWidth: 54 }
    },
    didDrawPage: (data) => {
      // Footer (page numbers + tax note)
      const page = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const taxText = inv.vatIncluded
        ? "IVA incluido en los precios."
        : `IVA ${toNum(STATE.settings.vatRate)}% desglosado en la factura.`;

      doc.text(taxText, margin, pageH - 28);
      doc.text(`Página ${page}`, pageW - margin, pageH - 28, { align: "right" });
    }
  });

  // Totals block
  const endY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : startY + 200;
  const tX = pageW - margin - 220;
  const tW = 220;
  const tH = 78;

  doc.roundedRect(tX, endY, tW, tH, 8, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Totales", tX + 10, endY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const rows = [
    ["Subtotal", money(totals.sub)],
    ["Transporte", money(totals.ship)],
    [inv.vatIncluded ? "IVA" : `IVA (${toNum(STATE.settings.vatRate)}%)`, inv.vatIncluded ? "Incluido" : money(totals.vat)],
    ["TOTAL", money(totals.total)]
  ];

  rows.forEach((r, i) => {
    const y = endY + 34 + i*12;
    doc.text(r[0], tX + 10, y);
    doc.text(r[1], tX + tW - 10, y, { align: "right" });
  });

  // Output blob
  const blob = doc.output("blob");
  const localKey = `pdf_${inv.id}_${Date.now()}`;

  try {
    await idbPutPDF(localKey, blob, { number: inv.number, dateISO: inv.dateISO, total: totals.total });
    inv.pdf = inv.pdf || {};
    // remove older local pdf if exists
    if (inv.pdf.localIdbKey && inv.pdf.localIdbKey !== localKey) {
      try { await idbDeletePDF(inv.pdf.localIdbKey); } catch {}
    }
    inv.pdf.localIdbKey = localKey;
    touchEntity(inv);
    saveAllLocal();
    updatePDFButtons(inv);
  } catch (e) {
    console.warn("IDB save pdf fail", e);
  }

  // Open PDF locally
  try {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {}

  // Upload to cloud if possible
  if (cloudReadyAndAuthed()) {
    try {
      const cloudUrl = await cloudUploadPDF(inv, blob);
      if (cloudUrl) {
        inv.pdf.cloudUrl = cloudUrl;
        touchEntity(inv);
        saveAllLocal();
        updatePDFButtons(inv);
        showToast("PDF subido a Cloud");
      }
    } catch (e) {
      console.warn("cloud upload pdf fail", e);
      showToast("PDF local OK (Cloud falló)");
    }
  } else {
    showToast("PDF generado (local)");
  }

  renderQRForActive();
  maybeAutoSync();
}

async function openLocalOrCloudPDF() {
  const inv = getActiveInvoice();
  if (!inv) return;

  // Local IDB
  if (inv.pdf?.localIdbKey) {
    try {
      const rec = await idbGetPDF(inv.pdf.localIdbKey);
      if (rec?.blob) {
        const url = URL.createObjectURL(rec.blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
    } catch (e) {
      console.warn("open local pdf fail", e);
    }
  }

  // Cloud URL fallback
  if (inv.pdf?.cloudUrl) {
    window.open(inv.pdf.cloudUrl, "_blank");
    return;
  }

  showToast("No hay PDF guardado");
}

async function copyCloudPDFLink() {
  const inv = getActiveInvoice();
  if (!inv?.pdf?.cloudUrl) return showToast("No hay link Cloud");
  try {
    await navigator.clipboard.writeText(inv.pdf.cloudUrl);
    showToast("Link copiado");
  } catch {
    prompt("Copia el link:", inv.pdf.cloudUrl);
  }
}

/* =========================
   43) CLIENTS CRUD
========================= */
function clientMatches(c, q) {
  q = normStr(q);
  if (!q) return true;
  return (
    includesAny(c.name, q) ||
    includesAny(c.alias, q) ||
    includesAny(c.nif, q) ||
    includesAny((c.tags || []).join(","), q)
  );
}

function renderClients() {
  if (!EL.clientsList) return;

  const q = EL.clientSearch?.value || "";
  const list = STATE.clients.filter(c => clientMatches(c, q))
    .sort((a,b) => (a.alias||a.name||"").localeCompare(b.alias||b.name||""));

  EL.clientsList.innerHTML = "";
  for (const c of list) {
    const div = document.createElement("div");
    div.className = "listItem" + (c.id === STATE.activeClientId ? " active" : "");
    div.innerHTML = `
      <div class="liTop">
        <div class="liNum">${escapeHTML(c.alias || c.name || "—")}</div>
        <div class="liTotal mono">${escapeHTML(c.nif || "")}</div>
      </div>
      <div class="liSub">
        <span>${escapeHTML(c.name || "")}</span>
        ${c.vatIncluded ? `<span>•</span><span>IVA incluido</span>` : ``}
        ${c.shipOn ? `<span>•</span><span>Transporte</span>` : ``}
      </div>
    `;
    div.addEventListener("click", () => {
      STATE.activeClientId = c.id;
      fillClientEditor(c);
      renderClients();
    });
    EL.clientsList.appendChild(div);
  }

  // if none selected, keep editor clean
  if (STATE.activeClientId) {
    const cur = STATE.clients.find(x => x.id === STATE.activeClientId);
    if (cur) fillClientEditor(cur);
  }
}

function fillClientEditor(c) {
  if (!c) return;
  safeSetValue(EL.c_name, c.name || "");
  safeSetValue(EL.c_alias, c.alias || "");
  safeSetValue(EL.c_nif, c.nif || "");
  safeSetValue(EL.c_tags, (c.tags || []).join(", "));
  safeSetValue(EL.c_addr, c.addr || "");
  safeSetValue(EL.c_tel, c.tel || "");
  safeSetValue(EL.c_email, c.email || "");
  if (EL.c_vatIncluded) EL.c_vatIncluded.checked = !!c.vatIncluded;
  if (EL.c_shipOn) EL.c_shipOn.checked = !!c.shipOn;
}

function newClient() {
  const c = {
    id: uid("cli"),
    name: "",
    alias: "",
    nif: "",
    addr: "",
    tel: "",
    email: "",
    tags: [],
    vatIncluded: false,
    shipOn: false
  };
  touchEntity(c);
  STATE.clients.unshift(c);
  rebuildIndexes();
  STATE.activeClientId = c.id;
  saveAllLocal();
  renderClients();
  fillClientEditor(c);
  renderClientSelector(); // update invoice selector
  showToast("Cliente nuevo");
  maybeAutoSync();
}

function saveClientFromUI() {
  const id = STATE.activeClientId;
  if (!id) return showToast("Selecciona un cliente");
  const c = STATE.clients.find(x => x.id === id);
  if (!c) return;

  c.name = normStr(EL.c_name?.value);
  c.alias = normStr(EL.c_alias?.value);
  c.nif = normStr(EL.c_nif?.value);
  c.addr = normStr(EL.c_addr?.value);
  c.tel = normStr(EL.c_tel?.value);
  c.email = normStr(EL.c_email?.value);
  c.tags = splitTags(EL.c_tags?.value || "");
  c.vatIncluded = !!EL.c_vatIncluded?.checked;
  c.shipOn = !!EL.c_shipOn?.checked;

  touchEntity(c);
  rebuildIndexes();
  saveAllLocal();

  // Update invoice selector + if active invoice matches this client, refresh snap
  renderClientSelector();
  const inv = getActiveInvoice();
  if (inv && inv.clientId === c.id) applyClientToActiveInvoice(c.id);

  renderClients();
  showToast("Cliente guardado");
  maybeAutoSync();
}

function deleteActiveClient() {
  const id = STATE.activeClientId;
  if (!id) return showToast("Selecciona un cliente");
  const c = STATE.clients.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Eliminar cliente "${c.alias || c.name}"?`)) return;

  STATE.clients = STATE.clients.filter(x => x.id !== id);
  STATE.activeClientId = null;
  rebuildIndexes();
  saveAllLocal();
  renderClients();
  renderClientSelector();

  // Remove client link from invoices (keep clientSnap for historical invoices)
  STATE.invoices.forEach(inv => {
    if (inv.clientId === id) inv.clientId = "";
  });
  saveAllLocal();

  showToast("Cliente eliminado");
  maybeAutoSync();
}

function exportClientsJSON() {
  downloadJSON(`clientes_${Date.now()}.json`, STATE.clients);
}

/* =========================
   44) PRODUCTS CRUD + PRICE HIST (last 5)
========================= */
function productMatches(p, q) {
  q = normStr(q);
  if (!q) return true;
  return includesAny(p.name, q);
}

function renderProducts() {
  if (!EL.productsList) return;

  const q = EL.productSearch?.value || "";
  const list = STATE.products.filter(p => productMatches(p, q))
    .sort((a,b) => (a.name||"").localeCompare(b.name||""));

  EL.productsList.innerHTML = "";
  for (const p of list) {
    const div = document.createElement("div");
    div.className = "listItem" + (p.id === STATE.activeProductId ? " active" : "");
    const right = [];
    if (toNum(p.price)) right.push(money(p.price));
    if (p.unitDefault) right.push(p.unitDefault);
    div.innerHTML = `
      <div class="liTop">
        <div class="liNum">${escapeHTML(p.name || "—")}</div>
        <div class="liTotal mono">${escapeHTML(right.join(" · "))}</div>
      </div>
      <div class="liSub">
        ${toNum(p.kgBox) ? `<span>Kg/caja: ${String(round2(p.kgBox)).replace(".", ",")}</span>` : `<span>—</span>`}
        ${toNum(p.cost) ? `<span>•</span><span>Coste: ${money(p.cost)}</span>` : ``}
      </div>
    `;
    div.addEventListener("click", () => {
      STATE.activeProductId = p.id;
      fillProductEditor(p);
      renderProducts();
    });
    EL.productsList.appendChild(div);
  }

  if (STATE.activeProductId) {
    const cur = STATE.products.find(x => x.id === STATE.activeProductId);
    if (cur) fillProductEditor(cur);
  }
}

function fillProductEditor(p) {
  if (!p) return;
  safeSetValue(EL.p_name, p.name || "");
  safeSetValue(EL.p_unit, p.unitDefault || "kg");
  safeSetValue(EL.p_kgBox, p.kgBox ? String(p.kgBox).replace(".", ",") : "");
  safeSetValue(EL.p_price, p.price ? String(p.price).replace(".", ",") : "");
  safeSetValue(EL.p_cost, p.cost ? String(p.cost).replace(".", ",") : "");
  safeSetValue(EL.p_origin, p.origin || "");

  const hist = Array.isArray(p.priceHist) ? p.priceHist : [];
  const txt = hist.slice(0,5).map(h => `${new Date(h.ts).toLocaleDateString()} → ${money(h.price)}`).join(" · ");
  safeSetText(EL.p_hist, txt || "—");
}

function newProduct() {
  const p = {
    id: uid("prd"),
    name: "",
    unitDefault: "kg",
    kgBox: 0,
    price: 0,
    cost: 0,
    origin: "",
    priceHist: []
  };
  touchEntity(p);
  STATE.products.unshift(p);
  rebuildIndexes();
  STATE.activeProductId = p.id;
  saveAllLocal();
  renderProducts();
  fillProductEditor(p);
  showToast("Producto nuevo");
  maybeAutoSync();
}

function pushPriceHist(p, price) {
  price = round2(toNum(price));
  if (!isFinite(price)) return;
  p.priceHist = Array.isArray(p.priceHist) ? p.priceHist : [];
  p.priceHist.unshift({ ts: Date.now(), price });
  // dedupe by ts/price lightly and keep 5
  p.priceHist = p.priceHist
    .filter((h,i,arr)=> i===arr.findIndex(x=>x.ts===h.ts && x.price===h.price))
    .slice(0,5);
}

function saveProductFromUI() {
  const id = STATE.activeProductId;
  if (!id) return showToast("Selecciona un producto");
  const p = STATE.products.find(x => x.id === id);
  if (!p) return;

  const oldPrice = round2(toNum(p.price));

  p.name = normStr(EL.p_name?.value);
  p.unitDefault = EL.p_unit?.value || "kg";
  p.kgBox = round2(toNum(EL.p_kgBox?.value));
  p.cost = round2(toNum(EL.p_cost?.value));
  p.origin = normStr(EL.p_origin?.value);

  const newPrice = round2(toNum(EL.p_price?.value));
  p.price = newPrice;

  if (newPrice !== oldPrice) {
    pushPriceHist(p, oldPrice || newPrice);
    pushPriceHist(p, newPrice);
  }

  touchEntity(p);
  rebuildIndexes();
  saveAllLocal();

  // refresh hints in invoice editor if open
  const inv = getActiveInvoice();
  if (inv) renderLines(inv);

  renderProducts();
  showToast("Producto guardado");
  maybeAutoSync();
}

function deleteActiveProduct() {
  const id = STATE.activeProductId;
  if (!id) return showToast("Selecciona un producto");
  const p = STATE.products.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Eliminar producto "${p.name}"?`)) return;

  STATE.products = STATE.products.filter(x => x.id !== id);
  STATE.activeProductId = null;
  rebuildIndexes();
  saveAllLocal();
  renderProducts();

  showToast("Producto eliminado");
  maybeAutoSync();
}

function exportProductsJSON() {
  downloadJSON(`productos_${Date.now()}.json`, STATE.products);
}

/* =========================
   45) ACCOUNTING (PIN LOCK)
========================= */
function openPINModal() {
  if (!EL.pinModal) return;
  EL.pinMsg.textContent = "—";
  EL.pinInput.value = "";
  EL.pinModal.showModal();
  setTimeout(()=>EL.pinInput.focus(), 50);

  EL.btnPinOk?.addEventListener("click", onPinOkOnce, { once:true });
}

function onPinOkOnce(e) {
  e.preventDefault();
  const pin = normStr(EL.pinInput?.value);
  if (pin && pin === normStr(STATE.settings.pin || DEFAULT_SETTINGS.pin)) {
    STATE.accountingUnlocked = true;
    EL.pinModal.close();
    showToast("Contabilidad desbloqueada");
    renderAccounting();
  } else {
    safeSetText(EL.pinMsg, "PIN incorrecto");
    showToast("PIN incorrecto");
    // keep modal open
    EL.pinModal.showModal();
  }
}

function invoiceInRange(inv, fromISO, toISO) {
  const d = inv.dateISO || "";
  if (fromISO && d < fromISO) return false;
  if (toISO && d > toISO) return false;
  return true;
}

function computeMarginForInvoice(inv) {
  let margin = 0;
  for (const ln of (inv.lines || [])) {
    if (!normStr(ln.prodName)) continue;
    const p = ln.prodId ? getProductById(ln.prodId) : findProductByName(ln.prodName);
    const cost = p ? toNum(p.cost) : 0;
    if (!cost) continue;

    if (ln.mode === "kg") {
      margin += (toNum(ln.price) - cost) * toNum(ln.neto);
    } else if (ln.mode === "caja") {
      margin += (toNum(ln.price) - cost) * toNum(ln.qty);
    } else {
      margin += (toNum(ln.price) - cost) * toNum(ln.qty);
    }
  }
  return round2(margin);
}

function renderAccounting() {
  // locked mode
  if (!STATE.accountingUnlocked) {
    if (EL.accountingBody) EL.accountingBody.hidden = true;
    if (EL.lockBox) EL.lockBox.hidden = false;

    safeSetText(EL.kpi_sales, "0,00");
    safeSetText(EL.kpi_vat, "0,00");
    safeSetText(EL.kpi_count, "0");
    safeSetText(EL.kpi_margin, "0,00");
    if (EL.accTable) EL.accTable.innerHTML = "";
    return;
  }

  if (EL.accountingBody) EL.accountingBody.hidden = false;
  if (EL.lockBox) EL.lockBox.hidden = true;

  // populate client filter
  if (EL.acc_client) {
    const prev = EL.acc_client.value;
    EL.acc_client.innerHTML = `<option value="">— Cliente —</option>`;
    STATE.clients.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.alias ? `${c.alias} — ${c.name}` : (c.name || c.alias || "—");
      EL.acc_client.appendChild(opt);
    });
    EL.acc_client.value = prev || "";
  }

  const fromISO = EL.acc_from?.value || "";
  const toISO = EL.acc_to?.value || "";
  const cid = EL.acc_client?.value || "";
  const tag = normStr(EL.acc_tag?.value || "");

  const filtered = STATE.invoices.filter(inv => {
    if (!invoiceInRange(inv, fromISO, toISO)) return false;
    if (cid) {
      const id2 = inv.clientId || inv.clientSnap?.id || "";
      if (id2 !== cid) return false;
    }
    if (tag) {
      if (!hasTag(inv, tag)) return false;
    }
    return true;
  });

  let sumSales = 0;
  let sumVAT = 0;
  let sumMargin = 0;

  filtered.forEach(inv => {
    const t = computeInvoiceTotal(inv);
    sumSales += t.total;
    sumVAT += t.vat; // 0 if IVA incluido
    sumMargin += computeMarginForInvoice(inv);
  });

  safeSetText(EL.kpi_sales, money(sumSales));
  safeSetText(EL.kpi_vat, money(sumVAT));
  safeSetText(EL.kpi_count, String(filtered.length));
  safeSetText(EL.kpi_margin, money(sumMargin));

  // table
  if (!EL.accTable) return;
  EL.accTable.innerHTML = "";
  filtered
    .slice()
    .sort((a,b) => (b.dateISO||"").localeCompare(a.dateISO||""))
    .forEach(inv => {
      const t = computeInvoiceTotal(inv);
      const cn = inv.clientSnap?.alias || inv.clientSnap?.name || "—";
      const div = document.createElement("div");
      div.className = "listItem";
      div.innerHTML = `
        <div class="liTop">
          <div class="liNum">${escapeHTML(inv.number || "")}</div>
          <div class="liTotal mono">${money(t.total)}</div>
        </div>
        <div class="liSub">
          <span>${escapeHTML(inv.dateISO || "")}</span>
          <span>•</span>
          <span>${escapeHTML(cn)}</span>
          ${inv.vatIncluded ? `<span>•</span><span>IVA incluido</span>` : `<span>•</span><span>IVA ${money(t.vat)}</span>`}
        </div>
      `;
      div.addEventListener("click", () => {
        setView("invoicesView");
        openInvoice(inv.id);
      });
      EL.accTable.appendChild(div);
    });
}

/* =========================
   46) SETTINGS (UI)
========================= */
function renderSettings() {
  safeSetValue(EL.set_vat, String(toNum(STATE.settings.vatRate)).replace(".", ","));
  safeSetValue(EL.set_ship, String(toNum(STATE.settings.shipRate)).replace(".", ","));
  if (EL.set_vatIncludedDefault) EL.set_vatIncludedDefault.checked = !!STATE.settings.vatIncludedDefault;
  safeSetValue(EL.set_qrTpl, STATE.settings.qrTpl || DEFAULT_SETTINGS.qrTpl);

  // cloud config
  const cfg = STATE.settings.cloud?.config || {};
  safeSetValue(EL.fb_apiKey, cfg.apiKey || "");
  safeSetValue(EL.fb_authDomain, cfg.authDomain || "");
  safeSetValue(EL.fb_databaseURL, cfg.databaseURL || "");
  safeSetValue(EL.fb_projectId, cfg.projectId || "");
  safeSetValue(EL.fb_appId, cfg.appId || "");
  safeSetValue(EL.fb_storageBucket, cfg.storageBucket || "");

  // prices link placeholder (you will host external app later)
  safeSetText(EL.pricesLinkInfo, "Link externo: crea carpeta /ponerprecios/ (te lo entrego en PARTE 4/4).");

  updateModePill();
}

function saveSettingsFromUI() {
  STATE.settings.vatRate = round2(toNum(EL.set_vat?.value));
  STATE.settings.shipRate = round2(toNum(EL.set_ship?.value));
  STATE.settings.vatIncludedDefault = !!EL.set_vatIncludedDefault?.checked;
  STATE.settings.qrTpl = normStr(EL.set_qrTpl?.value) || DEFAULT_SETTINGS.qrTpl;

  saveAllLocal();
  showToast("Ajustes guardados");

  // Refresh invoice totals
  const inv = getActiveInvoice();
  if (inv) {
    safeSetText(EL.shipPctLabel, `${toNum(STATE.settings.shipRate)}%`);
    safeSetText(EL.vatModeLabel, inv.vatIncluded ? "IVA incluido" : `${toNum(STATE.settings.vatRate)}%`);
    recalcAndRenderTotals();
    renderQRForActive();
  }
  maybeAutoSync();
}

function resetLocal(hard) {
  const msg = hard
    ? "RESET TOTAL: borra datos locales + PDFs en cache. Seguro?"
    : "RESET local: borra datos locales (no nube). Seguro?";
  if (!confirm(msg)) return;

  localStorage.removeItem(K.provider);
  localStorage.removeItem(K.clients);
  localStorage.removeItem(K.products);
  localStorage.removeItem(K.invoices);
  localStorage.removeItem(K.settings);
  localStorage.removeItem(K.pdfIndex);

  if (hard) {
    idbClearAllPDFs().catch(()=>{});
  }

  // reload defaults
  STATE.provider = structuredClone(DEFAULT_PROVIDER);
  STATE.clients = [];
  STATE.products = [];
  STATE.invoices = [];
  STATE.settings = structuredClone(DEFAULT_SETTINGS);
  STATE.activeInvoiceId = null;

  ensureDefaults();
  saveAllLocal();

  renderInvoiceList();
  clearInvoiceEditor();
  renderSettings();
  showToast("Reset OK");
}

/* =========================
   47) BACKUP JSON (EXPORT/IMPORT)
========================= */
function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function exportBackupJSON() {
  const payload = {
    exportedAt: Date.now(),
    provider: STATE.provider,
    clients: STATE.clients,
    products: STATE.products,
    invoices: STATE.invoices,
    settings: STATE.settings
  };
  downloadJSON(`backup_arslan_facturas_${Date.now()}.json`, payload);
  showToast("Backup exportado");
}

function importBackupJSONFromFile(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result || "{}"));
      // auto backup current before import
      const backup = {
        exportedAt: Date.now(),
        provider: STATE.provider,
        clients: STATE.clients,
        products: STATE.products,
        invoices: STATE.invoices,
        settings: STATE.settings
      };
      saveJSON(`af_kiwi_autobackup_${Date.now()}`, backup);

      const replace = confirm("Importar REEMPLAZANDO TODO? (Cancelar = MERGE inteligente)");
      if (replace) {
        STATE.provider = incoming.provider || structuredClone(DEFAULT_PROVIDER);
        STATE.clients  = Array.isArray(incoming.clients) ? incoming.clients : [];
        STATE.products = Array.isArray(incoming.products) ? incoming.products : [];
        STATE.invoices = Array.isArray(incoming.invoices) ? incoming.invoices : [];
        STATE.settings = incoming.settings || structuredClone(DEFAULT_SETTINGS);
        ensureDefaults();
      } else {
        // MERGE
        const merged = mergeDataset(
          {
            provider: STATE.provider,
            clients: STATE.clients,
            products: STATE.products,
            invoices: STATE.invoices,
            settings: STATE.settings
          },
          {
            provider: incoming.provider,
            clients: incoming.clients,
            products: incoming.products,
            invoices: incoming.invoices,
            settings: incoming.settings
          }
        );
        STATE.provider = merged.provider;
        STATE.clients = merged.clients;
        STATE.products = merged.products;
        STATE.invoices = merged.invoices;
        STATE.settings = merged.settings;
        ensureDefaults();
      }

      saveAllLocal();
      rebuildIndexes();

      renderClientSelector();
      renderInvoiceList();
      renderClients();
      renderProducts();
      renderSettings();

      // open latest invoice if exists
      if (STATE.invoices[0]) openInvoice(STATE.invoices[0].id);
      showToast("Import OK");
      maybeAutoSync();
    } catch (err) {
      console.error(err);
      showToast("Import error");
      alert("JSON inválido o incompatible.");
    } finally {
      // reset input
      if (EL.fileImport) EL.fileImport.value = "";
    }
  };
  reader.readAsText(file);
}

/* =========================
   48) MERGE INTELIGENTE (LOCAL + CLOUD + IMPORT)
========================= */
function clientKey(c) {
  return normKey(c?.name || c?.alias || "");
}
function productKey(p) {
  return normKey(p?.name || "");
}
function invoiceSig(inv) {
  const cn = normKey(inv?.clientSnap?.alias || inv?.clientSnap?.name || "");
  return `${inv?.dateISO || ""}|${inv?.number || ""}|${cn}`;
}

function pickBetter(a, b) {
  // choose record with higher updatedAt, else keep a
  const ua = toNum(a?.updatedAt);
  const ub = toNum(b?.updatedAt);
  return (ub > ua) ? b : a;
}

function mergeDataset(local, incoming) {
  const out = {
    provider: structuredClone(local.provider || DEFAULT_PROVIDER),
    clients:  Array.isArray(local.clients) ? structuredClone(local.clients) : [],
    products: Array.isArray(local.products) ? structuredClone(local.products) : [],
    invoices: Array.isArray(local.invoices) ? structuredClone(local.invoices) : [],
    settings: deepMerge(structuredClone(local.settings || DEFAULT_SETTINGS), incoming.settings || {})
  };

  // Provider: prefer incoming if has name/nif/etc and local empty
  if (incoming.provider && (normStr(incoming.provider.name) || normStr(incoming.provider.nif))) {
    out.provider = deepMerge(out.provider, incoming.provider);
  }

  // Clients merge (id + name)
  const incClients = Array.isArray(incoming.clients) ? incoming.clients : [];
  const byId = new Map();
  const byName = new Map();
  const remap = new Map(); // oldId -> newId

  // seed local
  out.clients.forEach(c => {
    if (!c.id) c.id = uid("cli");
    byId.set(c.id, c);
    const k = clientKey(c);
    if (k) byName.set(k, c.id);
  });

  // merge incoming
  incClients.forEach(c0 => {
    if (!c0) return;
    const c = structuredClone(c0);
    if (!c.id) c.id = uid("cli");
    const k = clientKey(c);

    if (byId.has(c.id)) {
      const cur = byId.get(c.id);
      const better = pickBetter(cur, c);
      byId.set(c.id, better);
      return;
    }

    if (k && byName.has(k)) {
      const keepId = byName.get(k);
      const cur = byId.get(keepId);
      const better = pickBetter(cur, c);
      // keep keepId as canonical id
      better.id = keepId;
      byId.set(keepId, better);
      remap.set(c.id, keepId);
      return;
    }

    // new client
    byId.set(c.id, c);
    if (k) byName.set(k, c.id);
  });

  out.clients = Array.from(byId.values());

  // Products merge (id + name)
  const incProducts = Array.isArray(incoming.products) ? incoming.products : [];
  const pById = new Map();
  const pByName = new Map();

  out.products.forEach(p => {
    if (!p.id) p.id = uid("prd");
    if (!Array.isArray(p.priceHist)) p.priceHist = [];
    pById.set(p.id, p);
    const k = productKey(p);
    if (k) pByName.set(k, p.id);
  });

  incProducts.forEach(p0 => {
    if (!p0) return;
    const p = structuredClone(p0);
    if (!p.id) p.id = uid("prd");
    if (!Array.isArray(p.priceHist)) p.priceHist = [];
    const k = productKey(p);

    if (pById.has(p.id)) {
      const cur = pById.get(p.id);
      const better = pickBetter(cur, p);
      // merge priceHist
      const hist = [...(cur.priceHist||[]), ...(p.priceHist||[])];
      better.priceHist = hist
        .filter(Boolean)
        .sort((a,b)=>toNum(b.ts)-toNum(a.ts))
        .filter((h,i,arr)=> i===arr.findIndex(x=>x.ts===h.ts && x.price===h.price))
        .slice(0,5);
      pById.set(p.id, better);
      return;
    }

    if (k && pByName.has(k)) {
      const keepId = pByName.get(k);
      const cur = pById.get(keepId);
      const better = pickBetter(cur, p);
      better.id = keepId;
      const hist = [...(cur.priceHist||[]), ...(p.priceHist||[])];
      better.priceHist = hist
        .filter(Boolean)
        .sort((a,b)=>toNum(b.ts)-toNum(a.ts))
        .filter((h,i,arr)=> i===arr.findIndex(x=>x.ts===h.ts && x.price===h.price))
        .slice(0,5);
      pById.set(keepId, better);
      return;
    }

    pById.set(p.id, p);
    if (k) pByName.set(k, p.id);
  });

  out.products = Array.from(pById.values());

  // Invoices merge (id + signature)
  const incInvoices = Array.isArray(incoming.invoices) ? incoming.invoices : [];
  const invById = new Map();
  const invBySig = new Map();

  out.invoices.forEach(inv => {
    sanitizeInvoice(inv);
    invById.set(inv.id, inv);
    invBySig.set(invoiceSig(inv), inv.id);
  });

  incInvoices.forEach(inv0 => {
    if (!inv0) return;
    const inv = structuredClone(inv0);
    sanitizeInvoice(inv);

    // remap clientId if needed
    if (inv.clientId && remap.has(inv.clientId)) {
      inv.clientId = remap.get(inv.clientId);
      if (inv.clientSnap) inv.clientSnap.id = inv.clientId;
    }

    if (invById.has(inv.id)) {
      const cur = invById.get(inv.id);
      const better = pickBetter(cur, inv);
      // keep pdf best
      better.pdf = better.pdf || { localIdbKey:"", cloudUrl:"" };
      if (!better.pdf.cloudUrl && (cur.pdf?.cloudUrl || inv.pdf?.cloudUrl)) {
        better.pdf.cloudUrl = cur.pdf?.cloudUrl || inv.pdf?.cloudUrl || "";
      }
      if (!better.pdf.localIdbKey && (cur.pdf?.localIdbKey || inv.pdf?.localIdbKey)) {
        better.pdf.localIdbKey = cur.pdf?.localIdbKey || inv.pdf?.localIdbKey || "";
      }
      invById.set(inv.id, better);
      invBySig.set(invoiceSig(better), better.id);
      return;
    }

    const sig = invoiceSig(inv);
    if (invBySig.has(sig)) {
      const keepId = invBySig.get(sig);
      const cur = invById.get(keepId);
      const better = pickBetter(cur, inv);
      better.id = keepId;
      // keep best pdf url
      better.pdf = better.pdf || { localIdbKey:"", cloudUrl:"" };
      better.pdf.cloudUrl = better.pdf.cloudUrl || cur.pdf?.cloudUrl || inv.pdf?.cloudUrl || "";
      better.pdf.localIdbKey = better.pdf.localIdbKey || cur.pdf?.localIdbKey || inv.pdf?.localIdbKey || "";
      invById.set(keepId, better);
      return;
    }

    invById.set(inv.id, inv);
    invBySig.set(sig, inv.id);
  });

  out.invoices = Array.from(invById.values())
    .sort((a,b)=> (b.dateISO||"").localeCompare(a.dateISO||"") || (toNum(b.updatedAt)-toNum(a.updatedAt)));

  return out;
}

/* =========================
   49) CLOUD (FIREBASE OPTIONAL)
========================= */
const CLOUD = {
  ready: false,
  app: null,
  auth: null,
  db: null,
  storage: null,

  // modules
  mApp: null,
  mAuth: null,
  mDB: null,
  mStore: null
};

function cloudConfigLooksValid(cfg) {
  if (!cfg) return false;
  const must = ["apiKey","authDomain","databaseURL","projectId","appId","storageBucket"];
  return must.every(k => normStr(cfg[k]));
}

function cloudReadyAndAuthed() {
  return CLOUD.ready && !!STATE.settings.cloud?.user?.uid;
}

function updateModePill() {
  const user = STATE.settings.cloud?.user;
  if (CLOUD.ready && user?.uid) {
    setPill(EL.modePill, "Cloud", "ok");
  } else if (CLOUD.ready) {
    setPill(EL.modePill, "Cloud (sin login)", "normal");
  } else {
    setPill(EL.modePill, "Modo local", "normal");
  }
}

async function loadFirebaseModules() {
  // modular SDK ES modules
  const v = "12.7.0";
  const base = `https://www.gstatic.com/firebasejs/${v}/`;
  const [mApp, mAuth, mDB, mStore] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-database.js"),
    import(base + "firebase-storage.js")
  ]);
  CLOUD.mApp = mApp;
  CLOUD.mAuth = mAuth;
  CLOUD.mDB = mDB;
  CLOUD.mStore = mStore;
}

async function initCloudIfPossible() {
  try {
    const cfg = STATE.settings.cloud?.config;
    if (!cloudConfigLooksValid(cfg)) {
      CLOUD.ready = false;
      updateModePill();
      return false;
    }

    if (!CLOUD.mApp) await loadFirebaseModules();

    CLOUD.app = CLOUD.mApp.initializeApp(cfg);
    CLOUD.auth = CLOUD.mAuth.getAuth(CLOUD.app);
    CLOUD.db = CLOUD.mDB.getDatabase(CLOUD.app);
    CLOUD.storage = CLOUD.mStore.getStorage(CLOUD.app);

    CLOUD.ready = true;
    STATE.settings.cloud.enabled = true;
    saveAllLocal();

    CLOUD.mAuth.onAuthStateChanged(CLOUD.auth, (user) => {
      if (user) {
        STATE.settings.cloud.user = { uid: user.uid, email: user.email || "" };
      } else {
        STATE.settings.cloud.user = null;
      }
      saveAllLocal();
      updateAuthUI();
      updateModePill();
      if (user) syncNow(); // pull+merge+push
    });

    updateModePill();
    return true;
  } catch (e) {
    console.warn("initCloud fail", e);
    CLOUD.ready = false;
    STATE.settings.cloud.enabled = false;
    saveAllLocal();
    updateModePill();
    safeSetText(EL.cloudHint, "Cloud falló: se mantiene modo local.");
    return false;
  }
}

function cloudBasePath() {
  const uid = STATE.settings.cloud?.user?.uid;
  return uid ? `users/${uid}` : "";
}

async function cloudGet(path) {
  const r = CLOUD.mDB.ref(CLOUD.db, path);
  const snap = await CLOUD.mDB.get(r);
  return snap.exists() ? snap.val() : null;
}

async function cloudSet(path, value) {
  const r = CLOUD.mDB.ref(CLOUD.db, path);
  await CLOUD.mDB.set(r, value);
}

async function cloudUploadPDF(inv, blob) {
  const uid = STATE.settings.cloud?.user?.uid;
  if (!uid) return null;
  const safeName = `${inv.number || inv.id}`.replaceAll("/", "-");
  const fullPath = `pdfs/${uid}/${safeName}.pdf`;
  const ref = CLOUD.mStore.ref(CLOUD.storage, fullPath);
  await CLOUD.mStore.uploadBytes(ref, blob, { contentType: "application/pdf" });
  const url = await CLOUD.mStore.getDownloadURL(ref);
  return url;
}

async function syncNow() {
  if (!CLOUD.ready) {
    showToast("Cloud no inicializado");
    return;
  }
  if (!STATE.settings.cloud?.user?.uid) {
    showToast("Cloud: haz login");
    return;
  }

  const base = cloudBasePath();
  const dataPath = `${base}/data`;

  try {
    showToast("Sync…");
    const cloudData = await cloudGet(dataPath);

    const localData = {
      provider: STATE.provider,
      clients: STATE.clients,
      products: STATE.products,
      invoices: STATE.invoices,
      settings: STATE.settings
    };

    let merged;
    if (!cloudData) {
      merged = localData; // push local as first seed
    } else {
      merged = mergeDataset(localData, cloudData);
    }

    // Update local from merged
    STATE.provider = merged.provider;
    STATE.clients = merged.clients;
    STATE.products = merged.products;
    STATE.invoices = merged.invoices;
    STATE.settings = merged.settings;
    ensureDefaults();
    saveAllLocal();
    rebuildIndexes();

    // Push merged back to cloud
    await cloudSet(dataPath, {
      provider: STATE.provider,
      clients: STATE.clients,
      products: STATE.products,
      invoices: STATE.invoices,
      settings: STATE.settings,
      updatedAt: Date.now()
    });

    STATE.settings.cloud.lastSyncAt = Date.now();
    saveAllLocal();

    // refresh UI
    renderClientSelector();
    renderInvoiceList();
    renderClients();
    renderProducts();
    renderSettings();
    const inv = getActiveInvoice();
    if (inv) {
      renderLines(inv);
      recalcAndRenderTotals();
      updatePDFButtons(inv);
      renderQRForActive();
    }

    showToast("Sync OK");
  } catch (e) {
    console.warn("syncNow error", e);
    // permission denied -> keep local
    showToast("Sync falló (modo local)");
  }
}

let _autoSyncTimer = null;
function maybeAutoSync() {
  if (!STATE.settings.cloud?.autoSync) return;
  if (!cloudReadyAndAuthed()) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(() => syncNow(), 1500);
}

/* =========================
   50) AUTH UI / ACTIONS
========================= */
function updateAuthUI() {
  const u = STATE.settings.cloud?.user;
  if (EL.authMsg) {
    EL.authMsg.textContent = u?.uid ? `Conectado: ${u.email || u.uid}` : "No conectado";
  }
  if (EL.btnLogout) EL.btnLogout.disabled = !u?.uid;
}

async function cloudLogin() {
  if (!CLOUD.ready) {
    await initCloudIfPossible();
    if (!CLOUD.ready) return showToast("Cloud no disponible");
  }
  const email = normStr(EL.auth_email?.value);
  const pass = normStr(EL.auth_pass?.value);
  if (!email || !pass) return showToast("Email/Password");

  try {
    await CLOUD.mAuth.signInWithEmailAndPassword(CLOUD.auth, email, pass);
    showToast("Login OK");
  } catch (e) {
    console.warn(e);
    showToast("Login fallo");
    safeSetText(EL.authMsg, `Error: ${e.code || e.message}`);
  }
}

async function cloudSignup() {
  if (!CLOUD.ready) {
    await initCloudIfPossible();
    if (!CLOUD.ready) return showToast("Cloud no disponible");
  }
  const email = normStr(EL.auth_email?.value);
  const pass = normStr(EL.auth_pass?.value);
  if (!email || !pass) return showToast("Email/Password");

  try {
    await CLOUD.mAuth.createUserWithEmailAndPassword(CLOUD.auth, email, pass);
    showToast("Signup OK");
  } catch (e) {
    console.warn(e);
    showToast("Signup fallo");
    safeSetText(EL.authMsg, `Error: ${e.code || e.message}`);
  }
}

async function cloudLogout() {
  if (!CLOUD.ready) return;
  try {
    await CLOUD.mAuth.signOut(CLOUD.auth);
    showToast("Logout OK");
  } catch (e) {
    console.warn(e);
    showToast("Logout fallo");
  }
}

function saveCloudConfigFromUI() {
  STATE.settings.cloud = STATE.settings.cloud || structuredClone(DEFAULT_SETTINGS.cloud);
  STATE.settings.cloud.config = {
    apiKey: normStr(EL.fb_apiKey?.value),
    authDomain: normStr(EL.fb_authDomain?.value),
    databaseURL: normStr(EL.fb_databaseURL?.value),
    projectId: normStr(EL.fb_projectId?.value),
    appId: normStr(EL.fb_appId?.value),
    storageBucket: normStr(EL.fb_storageBucket?.value)
  };
  saveAllLocal();
  showToast("Config Cloud guardada");
  initCloudIfPossible();
}

async function testCloud() {
  const ok = await initCloudIfPossible();
  if (!ok) return showToast("Cloud no inicializa");
  showToast("Cloud OK (config)");
  safeSetText(EL.cloudHint, "Cloud inicializado. Haz login para sincronizar.");
}

/* =========================
   51) OPEN FIRST INVOICE OR EMPTY
========================= */
function openFirstOrEmpty() {
  renderInvoiceList();
  renderClientSelector();
  if (STATE.invoices.length > 0) {
    openInvoice(STATE.invoices[0].id);
  } else {
    clearInvoiceEditor();
  }
}

/* =========================
   52) INIT
========================= */
async function init() {
  bindElements();
  loadAllLocal();
  ensureDefaults();

  await registerSW();
  wireBaseEvents();

  // First render
  setView("invoicesView");
  openFirstOrEmpty();
  renderSettings();

  // Try cloud if config exists
  await initCloudIfPossible();

  // If cloud is ready, keep pill updated
  updateModePill();

  // Minor: if active invoice exists, ensure QR
  if (getActiveInvoice()) renderQRForActive();

  showToast("Listo (offline)");
}

// GO
init().catch(e => console.error("init crash", e));
