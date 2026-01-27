/* =========================================================
   ARSLAN • FACTURAS — KIWI Edition (B/W PRO)
   app.js (1/3) — BASE + ESTADO + LOCAL + UI GENERAL
   - Offline first (localStorage)
   - Cloud opcional (Firebase compat, lazy-load) -> parte 3/3
   - Factura PRO + Grid + Productos + Clientes + PDF + QR -> partes 2/3 y 3/3
========================================================= */
'use strict';

/* =========================
   0) Helpers DOM
========================= */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function on(el, ev, fn){
  if(!el) return;
  el.addEventListener(ev, fn);
}
function escHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}
function clampNum(n, min=0, max=Number.POSITIVE_INFINITY){
  n = Number(n);
  if(Number.isNaN(n)) n = 0;
  return Math.min(max, Math.max(min, n));
}
function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

/* =========================
   1) Formatos
========================= */
function toISODate(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const da = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function pad2(n){ return String(n).padStart(2,'0'); }
function invoiceNumberFromDate(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth()+1);
  const da = pad2(dt.getDate());
  const hh = pad2(dt.getHours());
  const mm = pad2(dt.getMinutes());
  return `FA-${y}${m}${da}${hh}${mm}`;
}
function fmtEUR(n){
  n = Number(n);
  if(Number.isNaN(n)) n = 0;
  return n.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
}
function fmt2(n){
  n = Number(n);
  if(Number.isNaN(n)) n = 0;
  return n.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2});
}
function parseNum(v){
  if(v === '' || v == null) return 0;
  const s = String(v).replace(/\./g,'').replace(',','.');
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

/* =========================
   2) LocalStorage Keys
========================= */
const LS_KEY = 'ARSLAN_FACTURAS_KIWI_BW_V3';
const LS_ACC_UNLOCK = 'ARSLAN_FACTURAS_KIWI_ACC_UNLOCK';

/* =========================
   3) Defaults (Proveedor/Clientes/Ajustes)
========================= */
function defaultProvider(){
  return {
    name: 'Mohammad Arslan Waris',
    nif: 'X6389988J',
    addr: 'Calle San Pablo 17, 09003 Burgos',
    phone: '631 667 893',
    email: 'shaniwaris80@gmail.com',
  };
}

function defaultClients(){
  // Clientes principales de tu negocio (puedes editar/añadir)
  return [
    {
      id: 'cli_riviera',
      name: 'RIVIERA (CONOR ESY SLU)',
      fiscalName: 'CONOR ESY SLU',
      nif: 'B16794893',
      addr: 'Paseo del Espolón, 09003 Burgos',
      phone: '',
      email: '',
      alias: 'RIVIERA',
      notes: '',
    },
    {
      id: 'cli_golden_garden',
      name: 'GOLDEN GARDEN',
      fiscalName: 'David Herrera Estalayo',
      nif: '71281665L',
      addr: 'Trinidad, 12, 09003, Burgos',
      phone: '',
      email: '',
      alias: 'GOLDEN GARDEN',
      notes: 'IVA incluido en precios (sin desglose).',
      ivaIncluidoDefault: true
    },
    {
      id: 'cli_consentidos',
      name: 'CON/SENTIDOS',
      fiscalName: 'Cuevas Palacios Restauración S.L.',
      nif: 'B10694792',
      addr: 'C/ San Lesmes, 1 - 09004 Burgos',
      phone: '947 20 35 51',
      email: '',
      alias: 'CON/SENTIDOS',
      notes: '',
    },
    {
      id: 'cli_al_pan_pan',
      name: 'AL PAN PAN (BERTIZ)',
      fiscalName: 'Al Pan Pan Burgos, S.L.',
      nif: 'B09569344',
      addr: 'C/ Miranda, 17 Bajo, 09002 Burgos',
      phone: '947277977',
      email: 'bertiz.miranda@gmail.com',
      alias: 'AL PAN PAN',
      notes: '',
    },
    {
      id: 'cli_alesal_pan',
      name: 'ALESAL PAN / CAFÉ DE CALLE SAN LESMES',
      fiscalName: 'Alesal Pan y Café S.L',
      nif: 'B09582420',
      addr: 'Calle San Lesmes 1',
      phone: '',
      email: '',
      alias: 'ALESAL PAN',
      notes: 'Alias equivalente: CAFÉ DE CALLE SAN LESMES',
    },
    {
      id: 'cli_nuovo',
      name: 'CAFE BAR NUOVO',
      fiscalName: 'EINY MERCEDES OLIVO JIMENEZ',
      nif: '120221393',
      addr: 'C/ San Juan de Ortega 14, 09007 Burgos',
      phone: '',
      email: '',
      alias: 'NUOVO',
      notes: '',
    }
  ];
}

function defaultSettings(){
  return {
    version: '3.0',
    pin: '7392',
    taxRate: 4,            // IVA 4%
    transportPct: 10,      // Transporte 10%
    qrTemplate: 'AEAT|NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}',
    firebase: {
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      appId: '',
      storageBucket: ''
    }
  };
}

/* =========================
   4) Estado principal
========================= */
const state = {
  provider: defaultProvider(),
  clients: defaultClients(),
  products: {},          // se llena en Parte 2/3 (vocabulario + estructura)
  invoices: [],
  settings: defaultSettings(),

  currentInvoiceId: null,
  tempPdfUrl: null,      // última url pdf en memoria (blob o cloud)
  unlockedAccounting: false,

  cloud: {
    enabled: false,
    ready: false,
    user: null,
    firebase: null
  }
};

/* =========================
   5) Persistencia Local
========================= */
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);

    // Merge seguro (no rompe si faltan campos)
    if(data.provider) state.provider = { ...defaultProvider(), ...data.provider };
    if(Array.isArray(data.clients)) state.clients = data.clients;
    if(data.products && typeof data.products === 'object') state.products = data.products;
    if(Array.isArray(data.invoices)) state.invoices = data.invoices;
    if(data.settings) state.settings = { ...defaultSettings(), ...data.settings };

    // desbloqueo contabilidad (por sesión) opcional
    state.unlockedAccounting = (sessionStorage.getItem(LS_ACC_UNLOCK) === '1');

    return true;
  }catch(e){
    console.warn('Error loadLocal:', e);
    return false;
  }
}

function saveLocal(){
  try{
    const payload = {
      ts: Date.now(),
      provider: state.provider,
      clients: state.clients,
      products: state.products,
      invoices: state.invoices,
      settings: state.settings
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return true;
  }catch(e){
    console.warn('Error saveLocal:', e);
    return false;
  }
}

function exportJSON(){
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'ARSLAN_FACTURAS_KIWI_BW',
    version: state.settings?.version || '3.0',
    provider: state.provider,
    clients: state.clients,
    products: state.products,
    invoices: state.invoices,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ARSLAN_FACTURAS_BACKUP_${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function importJSONFile(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const data = JSON.parse(fr.result);

        // Merge defensivo (no borramos si no viene)
        if(data.provider) state.provider = { ...state.provider, ...data.provider };
        if(Array.isArray(data.clients)) state.clients = data.clients;
        if(data.products && typeof data.products === 'object') state.products = data.products;
        if(Array.isArray(data.invoices)) state.invoices = data.invoices;
        if(data.settings) state.settings = { ...state.settings, ...data.settings };

        saveLocal();
        resolve(true);
      }catch(e){ reject(e); }
    };
    fr.onerror = reject;
    fr.readAsText(file);
  });
}

/* =========================
   6) UI: Tabs
========================= */
function showTab(name){
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tabpage').forEach(s => s.classList.remove('show'));
  const el = $(`#tab-${name}`);
  if(el) el.classList.add('show');
}

function bindTabs(){
  $$('.tab').forEach(btn=>{
    on(btn,'click', ()=>{
      showTab(btn.dataset.tab);
      if(btn.dataset.tab === 'facturas') renderInvoiceList();
      if(btn.dataset.tab === 'clientes') renderClientList();
      if(btn.dataset.tab === 'productos') renderProductList();
      if(btn.dataset.tab === 'contabilidad') renderAccountingLockedState();
      if(btn.dataset.tab === 'ajustes') renderSettingsUI();
    });
  });
}

/* =========================
   7) UI: Proveedor / Ajustes UI
========================= */
function renderProviderUI(){
  $('#provName').value = state.provider?.name || '';
  $('#provNif').value = state.provider?.nif || '';
  $('#provAddr').value = state.provider?.addr || '';
  $('#provPhone').value = state.provider?.phone || '';
  $('#provEmail').value = state.provider?.email || '';
}

function saveProviderFromUI(){
  state.provider = {
    name: ($('#provName').value || '').trim(),
    nif: ($('#provNif').value || '').trim(),
    addr: ($('#provAddr').value || '').trim(),
    phone: ($('#provPhone').value || '').trim(),
    email: ($('#provEmail').value || '').trim(),
  };
  saveLocal();
  toast('Proveedor guardado');
  regenQRBoth();
  renderInvoicePreview();
}

function renderSettingsUI(){
  $('#setPin').value = state.settings.pin || '';
  $('#setTax').value = String(state.settings.taxRate ?? 4);
  $('#setTransport').value = String(state.settings.transportPct ?? 10);
  $('#setQrBase').value = state.settings.qrTemplate || '';

  // Firebase config
  const fb = state.settings.firebase || {};
  $('#fbApiKey').value = fb.apiKey || '';
  $('#fbAuthDomain').value = fb.authDomain || '';
  $('#fbDbURL').value = fb.databaseURL || '';
  $('#fbProjectId').value = fb.projectId || '';
  $('#fbAppId').value = fb.appId || '';
  $('#fbBucket').value = fb.storageBucket || '';

  // mensaje cloud
  const cloudMsg = $('#cloudMsg');
  if(cloudMsg){
    const ok = isFirebaseConfigured();
    cloudMsg.textContent = ok ? 'Firebase configurado (opcional). Puedes usar Cloud.' : 'Firebase NO configurado. Todo funciona en local.';
  }
}

function saveSettingsFromUI(){
  state.settings.pin = ($('#setPin').value || '').trim() || '7392';
  state.settings.taxRate = clampNum(parseNum($('#setTax').value), 0, 100);
  state.settings.transportPct = clampNum(parseNum($('#setTransport').value), 0, 100);
  state.settings.qrTemplate = ($('#setQrBase').value || '').trim() || defaultSettings().qrTemplate;
  saveLocal();
  toast('Ajustes guardados');
  regenQRBoth();
  renderInvoicePreview();
}

function saveFirebaseFromUI(){
  state.settings.firebase = {
    apiKey: ($('#fbApiKey').value || '').trim(),
    authDomain: ($('#fbAuthDomain').value || '').trim(),
    databaseURL: ($('#fbDbURL').value || '').trim(),
    projectId: ($('#fbProjectId').value || '').trim(),
    appId: ($('#fbAppId').value || '').trim(),
    storageBucket: ($('#fbBucket').value || '').trim()
  };
  saveLocal();
  renderSettingsUI();
  toast('Firebase guardado');
}

/* =========================
   8) UI: Toast simple
========================= */
let __toastTimer = null;
function toast(msg){
  // Toast minimal sin CSS extra: usamos pillMode temporal
  const pill = $('#pillMode');
  if(!pill) return;
  const old = pill.textContent;
  pill.textContent = msg;
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(()=>{ pill.textContent = old; }, 1400);
}

/* =========================
   9) Factura: Esqueleto (render real en Parte 2/3)
========================= */
function ensureCurrentInvoice(){
  if(state.currentInvoiceId && state.invoices.find(x=>x.id===state.currentInvoiceId)) return;
  // si no hay, crear nueva
  const inv = createEmptyInvoice();
  state.invoices.unshift(inv);
  state.currentInvoiceId = inv.id;
  saveLocal();
}

function createEmptyInvoice(){
  const now = new Date();
  const id = uid('inv');
  const num = invoiceNumberFromDate(now);
  const dISO = toISODate(now);

  // cliente por defecto (primero)
  const cli0 = state.clients?.[0] || null;

  return {
    id,
    number: num,
    dateISO: dISO,
    clientId: cli0 ? cli0.id : '',
    clientNameCache: cli0 ? cli0.name : '',
    tags: '',
    notes: '',
    obs: '',
    lines: [],          // se inicializa a 5 líneas en Parte 2/3
    transportEnabled: false,
    ivaIncluido: !!(cli0 && cli0.ivaIncluidoDefault),

    payments: [],
    payManual: 0,
    payStatus: 'impagada',
    payMethod: 'efectivo',

    pdfUrl: ''          // si se sube a nube
  };
}

function getCurrentInvoice(){
  return state.invoices.find(x=>x.id===state.currentInvoiceId) || null;
}

/* =========================
   10) UI: Modales (Login / PIN)
========================= */
function openModal(id){
  const m = $(id);
  if(m) m.style.display = 'flex';
}
function closeModal(id){
  const m = $(id);
  if(m) m.style.display = 'none';
}

/* =========================
   11) UI: Bind botones generales
========================= */
function bindGeneralButtons(){
  on($('#btnExport'),'click', exportJSON);

  on($('#btnImport'),'click', ()=> $('#fileImport').click());
  on($('#fileImport'),'change', async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{
      await importJSONFile(f);
      toast('Import OK');
      // refrescar UI
      renderProviderUI();
      renderAllClientSelects();
      ensureCurrentInvoice();
      renderInvoiceUI();
      renderInvoiceList();
      renderClientList();
      renderProductList();
      renderSettingsUI();
    }catch(err){
      alert('Error import: ' + err.message);
    }finally{
      e.target.value = '';
    }
  });

  on($('#btnSaveProvider'),'click', saveProviderFromUI);
  on($('#btnSaveSettings'),'click', saveSettingsFromUI);
  on($('#btnSaveFirebase'),'click', saveFirebaseFromUI);

  // Login modal
  on($('#btnLogin'),'click', ()=> openModal('#loginModal'));
  on($('#btnLoginClose'),'click', ()=> closeModal('#loginModal'));

  // PIN modal
  on($('#btnUnlock'),'click', ()=> openPinModal());
  on($('#btnLock'),'click', ()=> lockAccounting());

  on($('#btnPinCancel'),'click', ()=> closeModal('#pinModal'));
  on($('#btnPinOk'),'click', ()=> confirmPin());
}

/* =========================
   12) Contabilidad PIN (lógica completa en Parte 3/3)
========================= */
function openPinModal(){
  $('#pinInput').value = '';
  $('#pinMsg').textContent = 'Introduce PIN';
  openModal('#pinModal');
  setTimeout(()=>$('#pinInput')?.focus(), 50);
}
function confirmPin(){
  const pin = ($('#pinInput').value || '').trim();
  if(pin && pin === String(state.settings.pin || '7392')){
    state.unlockedAccounting = true;
    sessionStorage.setItem(LS_ACC_UNLOCK,'1');
    $('#pinMsg').textContent = 'OK';
    closeModal('#pinModal');
    renderAccountingLockedState();
    toast('Contabilidad desbloqueada');
  }else{
    $('#pinMsg').textContent = 'PIN incorrecto';
  }
}
function lockAccounting(){
  state.unlockedAccounting = false;
  sessionStorage.removeItem(LS_ACC_UNLOCK);
  renderAccountingLockedState();
  toast('Contabilidad bloqueada');
}
function renderAccountingLockedState(){
  const st = $('#accStatus');
  if(st) st.textContent = state.unlockedAccounting ? 'Desbloqueado' : 'Bloqueado';

  const tbody = $('#accTable tbody');
  if(!tbody) return;

  if(!state.unlockedAccounting){
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Contabilidad bloqueada. Pulsa “Desbloquear”.</td></tr>`;
    $('#accSales').textContent = fmtEUR(0);
    $('#accIva').textContent = fmtEUR(0);
    $('#accN').textContent = '0';
    $('#accMargin').textContent = fmtEUR(0);
    return;
  }

  // si desbloqueado, cálculo real se hace en Parte 3/3
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Listo. Pulsa “Calcular”.</td></tr>`;
}

/* =========================
   13) Clientes/Productos/Facturas render placeholders
   (Render completo en Partes 2/3 y 3/3)
========================= */
function renderAllClientSelects(){
  const sel1 = $('#invClient');
  const sel2 = $('#accClient');

  const opts = (state.clients||[]).map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name || c.fiscalName || 'Cliente')}</option>`).join('');
  if(sel1) sel1.innerHTML = `<option value="">— Seleccionar cliente —</option>` + opts;
  if(sel2) sel2.innerHTML = `<option value="">(Todos)</option>` + opts;
}

function renderInvoiceUI(){
  // render real (grid + autocomplete + totales + preview) en Parte 2/3
  const inv = getCurrentInvoice();
  if(!inv) return;

  // meta básica ya aquí (sin líneas)
  $('#invNumber').value = inv.number || '';
  $('#invDate').value = inv.dateISO || toISODate(new Date());
  $('#invTags').value = inv.tags || '';
  $('#invNotes').value = inv.notes || '';
  $('#invObs').value = inv.obs || '';

  $('#chkTransport').checked = !!inv.transportEnabled;
  $('#chkIvaIncluido').checked = !!inv.ivaIncluido;

  // cliente seleccionado
  renderAllClientSelects();
  $('#invClient').value = inv.clientId || '';

  // placeholder preview mínimo
  renderInvoicePreview();
}

function renderInvoicePreview(){
  // preview completo en Parte 3/3 (incluye tabla + QR + logo)
  const wrap = $('#invoicePreview');
  if(!wrap) return;
  const inv = getCurrentInvoice();
  if(!inv){
    wrap.innerHTML = `<div class="muted">Sin factura.</div>`;
    return;
  }
  const cli = state.clients.find(c=>c.id===inv.clientId);
  wrap.innerHTML = `
    <div class="muted">
      Vista previa cargando… (tabla + QR + logo se activa en Partes 2/3 y 3/3)
      <br/>Factura: <strong>${escHtml(inv.number||'')}</strong> · Fecha: <strong>${escHtml(inv.dateISO||'')}</strong>
      <br/>Cliente: <strong>${escHtml(cli?.name || '')}</strong>
    </div>
  `;
}

function renderInvoiceList(){
  // listado completo en Parte 3/3
  const box = $('#invoiceList');
  if(!box) return;
  box.innerHTML = `<div class="muted">Listado se renderiza en Parte 3/3.</div>`;
}

function renderClientList(){
  // lista completa en Parte 3/3
  const box = $('#clientList');
  if(!box) return;
  box.innerHTML = `<div class="muted">Clientes se renderizan en Parte 3/3.</div>`;
}

function renderProductList(){
  // lista completa en Parte 2/3
  const box = $('#productList');
  if(!box) return;
  box.innerHTML = `<div class="muted">Productos se renderizan en Parte 2/3.</div>`;
}

/* =========================
   14) QR base (texto) — render real en Parte 3/3
========================= */
function buildQrText(inv){
  const tpl = state.settings.qrTemplate || defaultSettings().qrTemplate;
  const nif = state.provider?.nif || '';
  const num = inv?.number || '';
  const fecha = inv?.dateISO || toISODate(new Date());
  const total = fmt2(0); // se actualiza en Parte 2/3 con totales reales
  return tpl
    .replaceAll('{NIF}', nif)
    .replaceAll('{NUM}', num)
    .replaceAll('{FECHA}', fecha)
    .replaceAll('{TOTAL}', total);
}
function regenQRBoth(){
  // se implementa completo en Parte 3/3 (main + preview)
  const hint = $('#qrHint');
  const inv = getCurrentInvoice();
  if(hint) hint.textContent = inv ? buildQrText(inv) : '—';
}

/* =========================
   15) Firebase opcional: flags (init real en Parte 3/3)
========================= */
function isFirebaseConfigured(){
  const fb = state.settings?.firebase || {};
  return !!(fb.apiKey && fb.authDomain && fb.databaseURL && fb.projectId && fb.appId);
}

/* =========================
   16) Boot (se ejecuta al final de Parte 3/3)
========================= */
document.addEventListener('DOMContentLoaded', ()=>{
  // arrancamos en Parte 3/3 cuando todo esté definido
  if(typeof window.__ARSLAN_BOOT === 'function'){
    window.__ARSLAN_BOOT();
  }
});
/* =========================================================
   app.js (2/3)
   - Vocabulario productos + catálogo (precio + kg/caja + historial 5)
   - Clientes (listado + editor + inline en factura)
   - GRID PRO (5 líneas por defecto) + Autocomplete (NO sustituye solo)
   - Cálculos: kg / caja / ud + bruto/tara/neto + importe
   - Totales: transporte + IVA 4% (incluido o desglosado)
   - QR UI (main + preview) + copy text
========================================================= */

/* =========================
   17) Vocabulario Productos (raw → Set)
========================= */
const DEFAULT_VOCAB_RAW = `
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

function normalizeProdName(s){
  return String(s||'').trim().replace(/\s+/g,' ').toUpperCase();
}
function prodKeyFromName(name){
  return normalizeProdName(name);
}
function buildDefaultProductsFromVocab(){
  const set = new Set();
  DEFAULT_VOCAB_RAW.split('\n').map(x=>normalizeProdName(x)).filter(Boolean).forEach(x=>set.add(x));

  const out = {};
  for(const name of set){
    const key = prodKeyFromName(name);
    out[key] = {
      key,
      name,
      modeDefault: 'kg',     // kg/caja/ud
      kgPerBox: 0,
      prices: { kg: 0, caja: 0, ud: 0 },
      cost: 0,
      originDefault: '',
      history: []            // [{ts, kg, caja, ud}]
    };
  }
  return out;
}

function initProductsIfEmpty(){
  if(state.products && Object.keys(state.products).length > 0) return;
  state.products = buildDefaultProductsFromVocab();
  saveLocal();
}

/* =========================
   18) Clientes: util
========================= */
function getClientById(id){
  return (state.clients||[]).find(c=>c.id===id) || null;
}
function ensureClientId(cli){
  if(cli.id) return cli.id;
  cli.id = uid('cli');
  return cli.id;
}

/* =========================
   19) Factura: líneas (estructura + defaults)
========================= */
function createEmptyLine(){
  return {
    id: uid('ln'),
    productKey: '',
    productName: '',
    mode: 'kg',       // kg/caja/ud
    cant: 0,          // si caja/ud
    bruto: 0,
    tara: 0,
    neto: 0,
    price: 0,
    origin: '',
    amount: 0
  };
}

function ensureInvoiceLines(inv, n=5){
  if(!inv.lines) inv.lines = [];
  while(inv.lines.length < n){
    inv.lines.push(createEmptyLine());
  }
}

/* =========================
   20) Autocomplete (NO sustituye solo)
========================= */
function getProductSuggestions(query, limit=12){
  const q = normalizeProdName(query);
  if(!q) return [];
  const keys = Object.keys(state.products||{});
  const hits = [];
  for(const k of keys){
    const p = state.products[k];
    if(!p) continue;
    if(p.name.includes(q)){
      hits.push(p);
      if(hits.length >= limit) break;
    }
  }
  return hits;
}

function getProductLastPriceForMode(p, mode){
  if(!p) return 0;
  // si hay precio actual, úsalo; si no, intenta último historial
  const cur = Number(p.prices?.[mode] || 0);
  if(cur > 0) return cur;
  const h = p.history || [];
  if(h.length){
    const last = h[0];
    return Number(last?.[mode] || 0);
  }
  return 0;
}

/* =========================
   21) GRID PRO render
========================= */
function renderLines(){
  const inv = getCurrentInvoice();
  if(!inv) return;
  ensureInvoiceLines(inv, 5);

  const body = $('#linesBody');
  if(!body) return;
  body.innerHTML = '';

  inv.lines.forEach((ln, idx)=>{
    const row = document.createElement('div');
    row.className = 'gridRow';
    row.dataset.lineId = ln.id;

    // Producto (acWrap)
    const prodCell = document.createElement('div');
    prodCell.className = 'acWrap cell-prod';
    prodCell.innerHTML = `
      <input type="text" class="inpProd" placeholder="Producto" value="${escHtml(ln.productName||'')}" autocomplete="off" />
      <div class="priceHint inpHint"></div>
      <div class="acList" style="display:none;"></div>
    `;

    // Modo
    const modeCell = document.createElement('div');
    modeCell.className = 'cell-mode';
    modeCell.innerHTML = `
      <select class="inpMode">
        <option value="kg">kg</option>
        <option value="caja">caja</option>
        <option value="ud">ud</option>
      </select>
    `;

    // Cant
    const cantCell = document.createElement('div');
    cantCell.className = 'cell-cant';
    cantCell.innerHTML = `<input class="inpCant" type="number" inputmode="decimal" placeholder="Cant." value="${ln.cant||0}" />`;

    // Bruto
    const brutoCell = document.createElement('div');
    brutoCell.className = 'cell-bruto';
    brutoCell.innerHTML = `<input class="inpBruto" type="number" inputmode="decimal" placeholder="Bruto" value="${ln.bruto||0}" />`;

    // Tara
    const taraCell = document.createElement('div');
    taraCell.className = 'cell-tara';
    taraCell.innerHTML = `<input class="inpTara" type="number" inputmode="decimal" placeholder="Tara" value="${ln.tara||0}" />`;

    // Neto (readonly)
    const netoCell = document.createElement('div');
    netoCell.className = 'cell-neto';
    netoCell.innerHTML = `<input class="inpNeto" type="number" inputmode="decimal" placeholder="Neto" value="${ln.neto||0}" readonly />`;

    // Precio
    const priceCell = document.createElement('div');
    priceCell.className = 'cell-precio';
    priceCell.innerHTML = `<input class="inpPrice" type="number" inputmode="decimal" placeholder="Precio" value="${ln.price||0}" />`;

    // Origen
    const originCell = document.createElement('div');
    originCell.className = 'cell-origen';
    originCell.innerHTML = `<input class="inpOrigin" type="text" placeholder="Origen" value="${escHtml(ln.origin||'')}" />`;

    // Importe
    const amountCell = document.createElement('div');
    amountCell.className = 'cell-importe';
    amountCell.innerHTML = `<div class="amountBox">${fmtEUR(ln.amount||0)}</div>`;

    // Delete
    const delCell = document.createElement('div');
    delCell.className = 'cell-del';
    delCell.innerHTML = `<button class="btnX" title="Borrar línea">×</button>`;

    row.appendChild(prodCell);
    row.appendChild(modeCell);
    row.appendChild(cantCell);
    row.appendChild(brutoCell);
    row.appendChild(taraCell);
    row.appendChild(netoCell);
    row.appendChild(priceCell);
    row.appendChild(originCell);
    row.appendChild(amountCell);
    row.appendChild(delCell);

    body.appendChild(row);

    // aplicar modo seleccionado
    row.querySelector('.inpMode').value = ln.mode || 'kg';

    // binds
    bindLineRow(row);
    updateLineUIHints(row); // último precio UI
  });

  recalcInvoiceTotalsAndUI();
  regenQRBoth();
  renderInvoicePreview();
}

function findLineById(inv, lineId){
  return inv.lines.find(x=>x.id === lineId) || null;
}

/* =========================
   22) Línea: cálculos
========================= */
function calcLine(ln){
  const mode = ln.mode || 'kg';
  const bruto = clampNum(ln.bruto, 0);
  const tara = clampNum(ln.tara, 0);
  let neto = clampNum(bruto - tara, 0);
  let amount = 0;

  // modo caja: si hay cant y kg/caja, neto puede venir de ahí si bruto=0
  if(mode === 'caja'){
    const p = state.products?.[ln.productKey] || null;
    const kgBox = clampNum(p?.kgPerBox || 0, 0);
    const cant = clampNum(ln.cant, 0);
    if(bruto === 0 && tara === 0 && kgBox > 0 && cant > 0){
      neto = cant * kgBox;
    }
    amount = clampNum(ln.price, 0) * (cant > 0 ? cant : 0);
    // si precio está pensado €/kg, usuario puede ponerlo, y entonces quiere neto*precio
    // regla: si cant==0 y neto>0, usamos neto*precio
    if(cant === 0 && neto > 0){
      amount = clampNum(ln.price, 0) * neto;
    }
  }else if(mode === 'ud'){
    const cant = clampNum(ln.cant, 0);
    amount = clampNum(ln.price, 0) * cant;
  }else{
    // kg
    amount = clampNum(ln.price, 0) * neto;
  }

  ln.neto = Number.isFinite(neto) ? neto : 0;
  ln.amount = Number.isFinite(amount) ? amount : 0;
  return ln;
}

/* =========================
   23) Bind fila (inputs + autocomplete + borrar + enter next)
========================= */
function bindLineRow(row){
  const inv = getCurrentInvoice();
  if(!inv) return;

  const lineId = row.dataset.lineId;
  const ln = findLineById(inv, lineId);
  if(!ln) return;

  const inpProd = row.querySelector('.inpProd');
  const acList = row.querySelector('.acList');
  const hint = row.querySelector('.inpHint');

  const inpMode = row.querySelector('.inpMode');
  const inpCant = row.querySelector('.inpCant');
  const inpBruto = row.querySelector('.inpBruto');
  const inpTara = row.querySelector('.inpTara');
  const inpPrice = row.querySelector('.inpPrice');
  const inpOrigin = row.querySelector('.inpOrigin');

  const btnX = row.querySelector('.btnX');

  // --- Autocomplete helpers
  function closeAC(){
    acList.style.display = 'none';
    acList.innerHTML = '';
    acList.dataset.active = '';
  }
  function openAC(items){
    if(!items.length){ closeAC(); return; }
    acList.innerHTML = items.map((p,i)=>{
      const lp = getProductLastPriceForMode(p, p.modeDefault || 'kg');
      const sub = lp ? `Último: ${fmt2(lp)} (${p.modeDefault||'kg'})` : 'Sin precio';
      return `<div class="acItem" data-idx="${i}" data-key="${escHtml(p.key)}">
                ${escHtml(p.name)}
                <span class="acSub">${escHtml(sub)}</span>
              </div>`;
    }).join('');
    acList.style.display = 'block';
    acList.dataset.active = '0';
    setActive(0);
  }
  function setActive(i){
    const items = $$('.acItem', acList);
    if(!items.length) return;
    i = Math.max(0, Math.min(items.length-1, i));
    items.forEach(el=>el.classList.remove('active'));
    items[i].classList.add('active');
    acList.dataset.active = String(i);
    // ensure visible
    items[i].scrollIntoView({block:'nearest'});
  }
  function pickActive(){
    const items = $$('.acItem', acList);
    if(!items.length) return false;
    const i = parseInt(acList.dataset.active||'0',10);
    const el = items[i];
    if(!el) return false;
    const key = el.dataset.key;
    const p = state.products?.[key];
    if(!p) return false;

    // ✅ NO sustituye solo: solo al seleccionar/enter sobre sugerencia
    ln.productKey = p.key;
    ln.productName = p.name;

    // defaults
    ln.mode = p.modeDefault || ln.mode || 'kg';
    ln.origin = ln.origin || p.originDefault || '';
    // precio automático por modo
    const autoPrice = getProductLastPriceForMode(p, ln.mode);
    if(!ln.price || Number(ln.price) === 0){
      ln.price = autoPrice || 0;
    }

    // actualiza UI
    inpProd.value = ln.productName;
    inpMode.value = ln.mode;
    inpOrigin.value = ln.origin;
    inpPrice.value = ln.price || 0;

    closeAC();
    updateLineUIHints(row);
    calcLine(ln);
    updateRowAmounts(row, ln);
    recalcInvoiceTotalsAndUI(true);
    saveLocal();
    regenQRBoth();
    renderInvoicePreview();
    return true;
  }

  // input producto: mostrar lista
  on(inpProd,'input', ()=>{
    ln.productName = (inpProd.value||'').trim();
    // NO tocamos productKey hasta que seleccione
    const items = getProductSuggestions(inpProd.value, 12);
    openAC(items);
  });

  on(inpProd,'keydown', (e)=>{
    if(acList.style.display === 'block'){
      if(e.key === 'ArrowDown'){ e.preventDefault(); setActive(parseInt(acList.dataset.active||'0',10)+1); return; }
      if(e.key === 'ArrowUp'){ e.preventDefault(); setActive(parseInt(acList.dataset.active||'0',10)-1); return; }
      if(e.key === 'Enter'){
        // si hay sugerencias, Enter selecciona la activa
        e.preventDefault();
        if(pickActive()){
          // pasar al siguiente input
          setTimeout(()=>inpMode.focus(), 0);
        }
        return;
      }
      if(e.key === 'Escape'){ closeAC(); return; }
    }
    // Enter normal si no hay ac abierto: pasar a siguiente
    if(e.key === 'Enter'){
      e.preventDefault();
      inpMode.focus();
    }
  });

  on(inpProd,'blur', ()=>{
    // cerrar con delay por click en item
    setTimeout(()=>closeAC(), 180);
  });

  on(acList,'mousedown', (e)=>{
    const item = e.target.closest('.acItem');
    if(!item) return;
    acList.dataset.active = item.dataset.idx;
    pickActive();
  });

  // cambios normales
  on(inpMode,'change', ()=>{
    ln.mode = inpMode.value;
    // si hay producto seleccionado, sugerir precio
    const p = state.products?.[ln.productKey];
    if(p){
      const autoPrice = getProductLastPriceForMode(p, ln.mode);
      if(!ln.price || Number(ln.price) === 0){
        ln.price = autoPrice || 0;
        inpPrice.value = ln.price || 0;
      }
    }
    calcLine(ln);
    updateLineUIHints(row);
    updateRowAmounts(row, ln);
    recalcInvoiceTotalsAndUI(true);
    saveLocal();
    regenQRBoth();
    renderInvoicePreview();
  });

  const numRecalc = ()=>{
    ln.cant = parseNum(inpCant.value);
    ln.bruto = parseNum(inpBruto.value);
    ln.tara = parseNum(inpTara.value);
    ln.price = parseNum(inpPrice.value);
    ln.origin = (inpOrigin.value||'').trim();

    calcLine(ln);
    updateRowAmounts(row, ln);
    recalcInvoiceTotalsAndUI(true);
    saveLocal();
    regenQRBoth();
    renderInvoicePreview();
  };

  on(inpCant,'input', numRecalc);
  on(inpBruto,'input', numRecalc);
  on(inpTara,'input', numRecalc);
  on(inpPrice,'input', numRecalc);
  on(inpOrigin,'input', ()=>{
    ln.origin = (inpOrigin.value||'').trim();
    saveLocal();
    renderInvoicePreview();
  });

  // enter next field
  const chain = [inpProd, inpMode, inpCant, inpBruto, inpTara, inpPrice, inpOrigin];
  chain.forEach((el, i)=>{
    on(el,'keydown', (e)=>{
      if(e.key === 'Enter'){
        // autocomplete ya lo gestiona en prod
        if(el === inpProd) return;
        e.preventDefault();
        const next = chain[i+1];
        if(next) next.focus();
        else {
          // última columna: si es última fila, añade una nueva
          const allRows = $$('.gridRow', $('#linesBody'));
          const idxRow = allRows.indexOf(row);
          if(idxRow === allRows.length-1){
            addLine();
            setTimeout(()=>{
              const newRows = $$('.gridRow', $('#linesBody'));
              const r2 = newRows[newRows.length-1];
              r2?.querySelector('.inpProd')?.focus();
            }, 0);
          }else{
            const rNext = allRows[idxRow+1];
            rNext?.querySelector('.inpProd')?.focus();
          }
        }
      }
    });
  });

  // borrar línea
  on(btnX,'click', ()=>{
    const idx = inv.lines.findIndex(x=>x.id===ln.id);
    if(idx >= 0){
      inv.lines.splice(idx,1);
      // mantener mínimo 5
      ensureInvoiceLines(inv, 5);
      saveLocal();
      renderLines();
      toast('Línea borrada');
    }
  });
}

function updateRowAmounts(row, ln){
  row.querySelector('.inpNeto').value = ln.neto || 0;
  row.querySelector('.amountBox').textContent = fmtEUR(ln.amount || 0);
}

function updateLineUIHints(row){
  const inv = getCurrentInvoice();
  if(!inv) return;
  const ln = findLineById(inv, row.dataset.lineId);
  if(!ln) return;

  const hint = row.querySelector('.inpHint');
  if(!hint) return;

  const p = state.products?.[ln.productKey];
  if(!p){
    hint.textContent = '';
    return;
  }

  const last = getProductLastPriceForMode(p, ln.mode || p.modeDefault || 'kg');
  const mode = (ln.mode || 'kg');
  const kgBox = Number(p.kgPerBox || 0);

  const extras = [];
  if(mode === 'caja' && kgBox > 0) extras.push(`${fmt2(kgBox)} kg/caja`);
  if(last > 0) extras.push(`Último: ${fmt2(last)} (${mode})`);

  hint.textContent = extras.join(' · ');
}

/* =========================
   24) Totales factura + pagos + UI
========================= */
function computeInvoiceTotals(inv){
  const taxRate = Number(state.settings.taxRate ?? 4) / 100;
  const transportPct = Number(state.settings.transportPct ?? 10) / 100;

  const subtotal = (inv.lines||[]).reduce((s,ln)=>{
    // recalcula por seguridad
    calcLine(ln);
    return s + (Number(ln.amount)||0);
  }, 0);

  const transport = inv.transportEnabled ? subtotal * transportPct : 0;

  const base = subtotal + transport;

  let iva = 0;
  let total = base;

  if(!inv.ivaIncluido){
    iva = base * taxRate;
    total = base + iva;
  }else{
    // IVA incluido: no se añade (solo texto en PDF más adelante)
    iva = 0;
    total = base;
  }

  // pagos
  const paidParts = (inv.payments||[]).reduce((s,p)=> s + (Number(p.amount)||0), 0);
  const paidManual = Number(inv.payManual||0);
  const paid = paidParts + paidManual;
  const pending = total - paid;

  return { subtotal, transport, iva, total, paid, pending };
}

function recalcInvoiceTotalsAndUI(soft=false){
  const inv = getCurrentInvoice();
  if(!inv) return;

  const t = computeInvoiceTotals(inv);

  $('#tSubtotal').textContent = fmtEUR(t.subtotal);
  $('#tTransport').textContent = fmtEUR(t.transport);
  $('#tIva').textContent = fmtEUR(t.iva);
  $('#tTotal').textContent = fmtEUR(t.total);
  $('#tPending').textContent = fmtEUR(Math.max(0, t.pending));

  // estado sugerido (no forzamos si usuario quiere manual)
  if(t.pending <= 0 && t.total > 0){
    // si no hay pendiente, recomendación pagada
  }else if(t.paid > 0){
    // recomendación parcial
  }

  // PDF state pill
  const pdfState = $('#pdfState');
  if(pdfState){
    pdfState.textContent = inv.pdfUrl ? 'PDF en nube ✅' : (state.tempPdfUrl ? 'PDF local ✅' : '—');
  }

  if(!soft) saveLocal();
}

/* =========================
   25) Factura: cliente inline (derecha)
========================= */
function renderInvoiceClientUI(inv){
  const cli = getClientById(inv.clientId);

  $('#cliName').value = cli?.fiscalName || cli?.name || '';
  $('#cliNif').value = cli?.nif || '';
  $('#cliAddr').value = cli?.addr || '';
  $('#cliPhone').value = cli?.phone || '';
  $('#cliEmail').value = cli?.email || '';
}

function setInvoiceClientFromSelect(){
  const inv = getCurrentInvoice();
  if(!inv) return;
  const id = $('#invClient').value || '';
  inv.clientId = id;

  const cli = getClientById(id);
  inv.clientNameCache = cli?.name || cli?.fiscalName || '';

  // IVA incluido default por cliente (si lo tiene)
  if(cli && typeof cli.ivaIncluidoDefault === 'boolean'){
    inv.ivaIncluido = !!cli.ivaIncluidoDefault;
    $('#chkIvaIncluido').checked = inv.ivaIncluido;
  }

  renderInvoiceClientUI(inv);
  saveLocal();
  recalcInvoiceTotalsAndUI(true);
  regenQRBoth();
  renderInvoicePreview();
}

function newClientInline(){
  $('#invClient').value = '';
  $('#cliName').value = '';
  $('#cliNif').value = '';
  $('#cliAddr').value = '';
  $('#cliPhone').value = '';
  $('#cliEmail').value = '';
  toast('Nuevo cliente (rellena y guarda)');
}

function saveClientInline(){
  const inv = getCurrentInvoice();
  if(!inv) return;

  const selId = $('#invClient').value || '';

  const fiscalName = ($('#cliName').value || '').trim();
  const nif = ($('#cliNif').value || '').trim();
  const addr = ($('#cliAddr').value || '').trim();
  const phone = ($('#cliPhone').value || '').trim();
  const email = ($('#cliEmail').value || '').trim();

  if(!fiscalName){
    alert('Pon nombre del cliente');
    return;
  }

  let cli = selId ? getClientById(selId) : null;
  if(!cli){
    cli = { id: uid('cli'), name: fiscalName, fiscalName, nif, addr, phone, email, alias:'', notes:'' };
    state.clients.push(cli);
  }else{
    cli.fiscalName = fiscalName;
    cli.name = cli.name || fiscalName;
    cli.nif = nif;
    cli.addr = addr;
    cli.phone = phone;
    cli.email = email;
  }

  inv.clientId = cli.id;
  inv.clientNameCache = cli.name || cli.fiscalName;

  renderAllClientSelects();
  $('#invClient').value = cli.id;

  saveLocal();
  toast('Cliente guardado');
  renderInvoiceClientUI(inv);
  renderClientList();
  renderInvoiceList();
}

/* =========================
   26) Factura: meta + botones
========================= */
function bindInvoiceMetaAndButtons(){
  on($('#invClient'),'change', setInvoiceClientFromSelect);

  on($('#invNumber'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.number = ($('#invNumber').value || '').trim();
    saveLocal(); regenQRBoth(); renderInvoicePreview(); renderInvoiceList();
  });
  on($('#invDate'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.dateISO = $('#invDate').value || toISODate(new Date());
    saveLocal(); regenQRBoth(); renderInvoicePreview(); renderInvoiceList();
  });
  on($('#invTags'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.tags = ($('#invTags').value || '').trim();
    saveLocal(); renderInvoicePreview(); renderInvoiceList();
  });
  on($('#invNotes'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.notes = ($('#invNotes').value || '').trim();
    saveLocal(); renderInvoicePreview();
  });
  on($('#invObs'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.obs = ($('#invObs').value || '').trim();
    saveLocal(); renderInvoicePreview();
  });

  on($('#chkTransport'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.transportEnabled = $('#chkTransport').checked;
    saveLocal(); recalcInvoiceTotalsAndUI(true); regenQRBoth(); renderInvoicePreview(); renderInvoiceList();
  });
  on($('#chkIvaIncluido'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.ivaIncluido = $('#chkIvaIncluido').checked;
    saveLocal(); recalcInvoiceTotalsAndUI(true); regenQRBoth(); renderInvoicePreview(); renderInvoiceList();
  });

  on($('#btnAddIvaToTotal'),'click', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.ivaIncluido = false;
    $('#chkIvaIncluido').checked = false;
    saveLocal();
    recalcInvoiceTotalsAndUI(true);
    toast('IVA añadido al total');
  });

  // pagos
  on($('#btnAddPay'),'click', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    const amt = parseNum($('#payAmount').value);
    if(amt <= 0) return;
    inv.payments = inv.payments || [];
    inv.payments.unshift({ id: uid('pay'), ts: Date.now(), amount: amt });
    $('#payAmount').value = '';
    saveLocal();
    renderPayList();
    recalcInvoiceTotalsAndUI(true);
    renderInvoicePreview();
    renderInvoiceList();
  });

  on($('#payManual'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.payManual = parseNum($('#payManual').value);
    saveLocal(); recalcInvoiceTotalsAndUI(true); renderInvoicePreview(); renderInvoiceList();
  });

  on($('#payStatus'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.payStatus = $('#payStatus').value;
    saveLocal(); renderInvoicePreview(); renderInvoiceList();
  });

  on($('#payMethod'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.payMethod = $('#payMethod').value;
    saveLocal(); renderInvoicePreview(); renderInvoiceList();
  });

  // clientes inline
  on($('#btnNewClientInline'),'click', newClientInline);
  on($('#btnSaveClientInline'),'click', saveClientInline);

  // líneas
  on($('#btnAddLine'),'click', ()=> addLine());
  on($('#btnClearLines'),'click', ()=> clearLines());

  // facturas: nueva / duplicar / eliminar
  on($('#btnNewInvoice'),'click', ()=>{
    const inv = createEmptyInvoice();
    ensureInvoiceLines(inv, 5);
    state.invoices.unshift(inv);
    state.currentInvoiceId = inv.id;
    saveLocal();
    renderInvoiceUI();
    toast('Nueva factura');
  });

  on($('#btnDupInvoice'),'click', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    const copy = JSON.parse(JSON.stringify(inv));
    copy.id = uid('inv');
    copy.number = invoiceNumberFromDate(new Date());
    copy.dateISO = toISODate(new Date());
    copy.pdfUrl = '';
    copy.payments = [];
    copy.payManual = 0;
    copy.payStatus = 'impagada';
    copy.payMethod = 'efectivo';
    // duplicar líneas con ids nuevos
    copy.lines = (copy.lines||[]).map(l=>{
      const nl = { ...l };
      nl.id = uid('ln');
      return nl;
    });
    state.invoices.unshift(copy);
    state.currentInvoiceId = copy.id;
    saveLocal();
    renderInvoiceUI();
    toast('Duplicada');
  });

  on($('#btnDelInvoice'),'click', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    if(!confirm('¿Eliminar factura?')) return;
    const idx = state.invoices.findIndex(x=>x.id===inv.id);
    if(idx>=0) state.invoices.splice(idx,1);
    state.currentInvoiceId = null;
    ensureCurrentInvoice();
    saveLocal();
    renderInvoiceUI();
    toast('Eliminada');
  });

  on($('#btnSaveInvoice'),'click', ()=>{
    saveLocal();
    toast('Guardado');
    renderInvoiceList();
  });

  // QR
  on($('#btnRegenQR'),'click', ()=>{ regenQRBoth(); toast('QR actualizado'); });
  on($('#btnCopyQR'),'click', ()=>{
    const inv = getCurrentInvoice();
    const txt = inv ? buildQrText(inv) : '';
    if(!txt) return;
    navigator.clipboard?.writeText(txt);
    toast('QR copiado');
  });

  // listado/ búsquedas (se renderiza aquí ya)
  on($('#invSearch'),'input', renderInvoiceList);
  on($('#btnClearInvSearch'),'click', ()=>{
    $('#invSearch').value = '';
    renderInvoiceList();
  });

  // placeholders PDF/Whats (se completan en Parte 3/3)
  on($('#btnPDF'),'click', ()=> alert('PDF PRO se activa en PARTE 3/3'));
  on($('#btnPDFCloud'),'click', ()=> alert('PDF + Nube se activa en PARTE 3/3'));
  on($('#btnWhats'),'click', ()=> alert('WhatsApp PRO se activa en PARTE 3/3'));
  on($('#btnOpenPDF'),'click', ()=>{
    if(state.tempPdfUrl) window.open(state.tempPdfUrl, '_blank');
    else if(getCurrentInvoice()?.pdfUrl) window.open(getCurrentInvoice().pdfUrl, '_blank');
    else alert('Aún no hay PDF.');
  });
  on($('#btnCopyPDF'),'click', ()=>{
    const u = getCurrentInvoice()?.pdfUrl || '';
    if(!u) return toast('Sin link PDF');
    navigator.clipboard?.writeText(u);
    toast('Link PDF copiado');
  });

  // Sync placeholder
  on($('#btnSync'),'click', ()=> alert('Sync Cloud se activa en PARTE 3/3'));
}

/* =========================
   27) Líneas: add/clear
========================= */
function addLine(){
  const inv = getCurrentInvoice(); if(!inv) return;
  inv.lines.push(createEmptyLine());
  saveLocal();
  renderLines();
}
function clearLines(){
  const inv = getCurrentInvoice(); if(!inv) return;
  if(!confirm('¿Vaciar líneas?')) return;
  inv.lines = [];
  ensureInvoiceLines(inv, 5);
  saveLocal();
  renderLines();
}

/* =========================
   28) Pagos: render lista
========================= */
function renderPayList(){
  const inv = getCurrentInvoice(); if(!inv) return;
  const box = $('#payList');
  const hint = $('#payListHint');
  if(!box || !hint) return;

  const arr = inv.payments || [];
  if(!arr.length){
    hint.textContent = 'Sin pagos parciales.';
    box.innerHTML = '';
  }else{
    hint.textContent = '';
    box.innerHTML = arr.map(p=>{
      const d = new Date(p.ts||Date.now());
      return `
        <div class="payItem">
          <div>
            <strong>${fmtEUR(p.amount||0)}</strong>
            <div class="muted" style="font-size:12px;">${escHtml(toISODate(d))}</div>
          </div>
          <button class="btn danger" data-payid="${escHtml(p.id)}">Quitar</button>
        </div>
      `;
    }).join('');

    $$('.payItem button', box).forEach(btn=>{
      on(btn,'click', ()=>{
        const id = btn.dataset.payid;
        inv.payments = (inv.payments||[]).filter(x=>x.id!==id);
        saveLocal();
        renderPayList();
        recalcInvoiceTotalsAndUI(true);
        renderInvoicePreview();
        renderInvoiceList();
      });
    });
  }

  $('#payManual').value = inv.payManual || 0;
  $('#payStatus').value = inv.payStatus || 'impagada';
  $('#payMethod').value = inv.payMethod || 'efectivo';
}

/* =========================
   29) Facturas: listado (ya funcional)
========================= */
function invoiceQuickTotal(inv){
  const t = computeInvoiceTotals(inv);
  return t.total;
}
function invoiceMatchesSearch(inv, q){
  q = (q||'').trim().toUpperCase();
  if(!q) return true;
  const cli = getClientById(inv.clientId);
  const hay = [
    inv.number||'',
    inv.dateISO||'',
    inv.tags||'',
    cli?.name||inv.clientNameCache||'',
    cli?.fiscalName||'',
    cli?.nif||''
  ].join(' ').toUpperCase();
  return hay.includes(q);
}

function renderInvoiceList(){
  const box = $('#invoiceList');
  if(!box) return;
  const q = ($('#invSearch')?.value || '').trim();
  const list = (state.invoices||[]).filter(inv => invoiceMatchesSearch(inv, q));

  if(!list.length){
    box.innerHTML = `<div class="muted">Sin facturas.</div>`;
    return;
  }

  box.innerHTML = list.map(inv=>{
    const cli = getClientById(inv.clientId);
    const tot = invoiceQuickTotal(inv);
    return `
      <div class="listItem" data-invid="${escHtml(inv.id)}">
        <div class="top">
          <div><strong>${escHtml(inv.number||'')}</strong></div>
          <div class="badge">${escHtml(fmtEUR(tot))}</div>
        </div>
        <div class="meta">
          <span>${escHtml(inv.dateISO||'')}</span>
          <span>•</span>
          <span>${escHtml(cli?.name || inv.clientNameCache || '')}</span>
          ${inv.tags ? `<span>•</span><span>${escHtml(inv.tags)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  $$('.listItem', box).forEach(it=>{
    on(it,'click', ()=>{
      const id = it.dataset.invid;
      state.currentInvoiceId = id;
      saveLocal();
      renderInvoiceUI();
      showTab('factura');
      toast('Factura abierta');
    });
  });
}

/* =========================
   30) Clientes: listado + editor (tab Clientes) — funcional
========================= */
function renderClientList(){
  const box = $('#clientList');
  if(!box) return;

  const q = ($('#cliSearch')?.value || '').trim().toUpperCase();
  const list = (state.clients||[]).filter(c=>{
    if(!q) return true;
    const hay = [c.name,c.fiscalName,c.nif,c.addr,c.alias].join(' ').toUpperCase();
    return hay.includes(q);
  });

  box.innerHTML = list.map(c=>{
    return `
      <div class="listItem" data-cliid="${escHtml(c.id)}">
        <div class="top">
          <div><strong>${escHtml(c.name || c.fiscalName || '')}</strong></div>
          <div class="badge">${escHtml(c.nif || '')}</div>
        </div>
        <div class="meta">
          <span>${escHtml(c.addr || '')}</span>
        </div>
      </div>
    `;
  }).join('') || `<div class="muted">Sin clientes.</div>`;

  $$('.listItem', box).forEach(it=>{
    on(it,'click', ()=>{
      const id = it.dataset.cliid;
      const c = getClientById(id);
      if(!c) return;
      $('#cliId').value = c.id;
      $('#cliEditName').value = c.fiscalName || c.name || '';
      $('#cliEditAlias').value = c.alias || '';
      $('#cliEditNif').value = c.nif || '';
      $('#cliEditAddr').value = c.addr || '';
      $('#cliEditPhone').value = c.phone || '';
      $('#cliEditEmail').value = c.email || '';
      $('#cliEditNotes').value = c.notes || '';
    });
  });
}

function bindClientsTab(){
  on($('#cliSearch'),'input', renderClientList);
  on($('#btnNewClient'),'click', ()=>{
    $('#cliId').value = '';
    $('#cliEditName').value = '';
    $('#cliEditAlias').value = '';
    $('#cliEditNif').value = '';
    $('#cliEditAddr').value = '';
    $('#cliEditPhone').value = '';
    $('#cliEditEmail').value = '';
    $('#cliEditNotes').value = '';
    toast('Nuevo cliente');
  });

  on($('#btnSaveClient'),'click', ()=>{
    const id = ($('#cliId').value || '').trim();
    const fiscalName = ($('#cliEditName').value || '').trim();
    if(!fiscalName) return alert('Nombre requerido');

    const alias = ($('#cliEditAlias').value || '').trim();
    const nif = ($('#cliEditNif').value || '').trim();
    const addr = ($('#cliEditAddr').value || '').trim();
    const phone = ($('#cliEditPhone').value || '').trim();
    const email = ($('#cliEditEmail').value || '').trim();
    const notes = ($('#cliEditNotes').value || '').trim();

    let cli = id ? getClientById(id) : null;
    if(!cli){
      cli = { id: uid('cli'), name: alias ? `${alias}` : fiscalName, fiscalName, alias, nif, addr, phone, email, notes };
      state.clients.push(cli);
    }else{
      cli.fiscalName = fiscalName;
      cli.alias = alias;
      cli.name = alias ? `${alias}` : (cli.name || fiscalName);
      cli.nif = nif;
      cli.addr = addr;
      cli.phone = phone;
      cli.email = email;
      cli.notes = notes;
    }

    saveLocal();
    renderAllClientSelects();
    renderClientList();
    renderInvoiceList();

    // si el cliente editado es el de la factura abierta, refrescar
    const inv = getCurrentInvoice();
    if(inv && inv.clientId === cli.id){
      inv.clientNameCache = cli.name || cli.fiscalName;
      renderInvoiceClientUI(inv);
      saveLocal();
      renderInvoicePreview();
    }
    toast('Cliente guardado');
  });

  on($('#btnDelClient'),'click', ()=>{
    const id = ($('#cliId').value || '').trim();
    if(!id) return;
    if(!confirm('¿Eliminar cliente?')) return;

    // No borrar si hay facturas vinculadas (seguridad)
    const used = (state.invoices||[]).some(inv => inv.clientId === id);
    if(used){
      alert('Este cliente está usado en facturas. No se elimina.');
      return;
    }

    state.clients = (state.clients||[]).filter(c=>c.id!==id);
    $('#cliId').value = '';
    saveLocal();
    renderAllClientSelects();
    renderClientList();
    toast('Cliente eliminado');
  });
}

/* =========================
   31) Productos: listado + editor (tab Productos) — funcional
========================= */
function renderProductList(){
  const box = $('#productList');
  if(!box) return;

  const q = ($('#prodSearch')?.value || '').trim().toUpperCase();
  const keys = Object.keys(state.products||{});
  const list = keys
    .map(k=>state.products[k])
    .filter(p=>p && (!q || p.name.includes(q)))
    .slice(0, 600); // UI rápido

  box.innerHTML = list.map(p=>{
    const b1 = p.prices?.kg ? `kg ${fmt2(p.prices.kg)}` : '';
    const b2 = p.prices?.caja ? `caja ${fmt2(p.prices.caja)}` : '';
    const b3 = p.prices?.ud ? `ud ${fmt2(p.prices.ud)}` : '';
    const badges = [b1,b2,b3].filter(Boolean).map(x=>`<span class="badge">${escHtml(x)}</span>`).join('');
    return `
      <div class="listItem" data-prodkey="${escHtml(p.key)}">
        <div class="top">
          <div><strong>${escHtml(p.name)}</strong></div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">${badges}</div>
        </div>
        <div class="meta">
          <span>Modo: ${escHtml(p.modeDefault||'kg')}</span>
          ${p.kgPerBox ? `<span>•</span><span>${escHtml(fmt2(p.kgPerBox))} kg/caja</span>` : ``}
          ${p.originDefault ? `<span>•</span><span>${escHtml(p.originDefault)}</span>` : ``}
        </div>
      </div>
    `;
  }).join('') || `<div class="muted">Sin productos.</div>`;

  $$('.listItem', box).forEach(it=>{
    on(it,'click', ()=>{
      const k = it.dataset.prodkey;
      loadProductEditor(k);
    });
  });
}

function loadProductEditor(key){
  const p = state.products?.[key];
  if(!p) return;

  $('#prodKey').value = p.key;
  $('#prodName').value = p.name;
  $('#prodMode').value = p.modeDefault || 'kg';
  $('#prodKgBox').value = p.kgPerBox || 0;
  $('#prodPriceKg').value = p.prices?.kg || 0;
  $('#prodPriceBox').value = p.prices?.caja || 0;
  $('#prodPriceUd').value = p.prices?.ud || 0;
  $('#prodCost').value = p.cost || 0;
  $('#prodOrigin').value = p.originDefault || '';

  renderProductHistory(p);
}

function renderProductHistory(p){
  const box = $('#prodHistory');
  if(!box) return;
  const h = p.history || [];
  if(!h.length){
    box.innerHTML = `<div class="muted">Sin historial.</div>`;
    return;
  }
  box.innerHTML = h.slice(0,5).map(r=>{
    const d = new Date(r.ts||Date.now());
    const a = [];
    if(r.kg) a.push(`kg ${fmt2(r.kg)}`);
    if(r.caja) a.push(`caja ${fmt2(r.caja)}`);
    if(r.ud) a.push(`ud ${fmt2(r.ud)}`);
    return `<div class="histRow"><span>${escHtml(toISODate(d))}</span><strong>${escHtml(a.join(' · ') || '—')}</strong></div>`;
  }).join('');
}

function bindProductsTab(){
  on($('#prodSearch'),'input', renderProductList);

  on($('#btnNewProd'),'click', ()=>{
    $('#prodKey').value = '';
    $('#prodName').value = '';
    $('#prodMode').value = 'kg';
    $('#prodKgBox').value = 0;
    $('#prodPriceKg').value = 0;
    $('#prodPriceBox').value = 0;
    $('#prodPriceUd').value = 0;
    $('#prodCost').value = 0;
    $('#prodOrigin').value = '';
    $('#prodHistory').innerHTML = `<div class="muted">Sin historial.</div>`;
    toast('Nuevo producto');
  });

  on($('#btnSaveProd'),'click', ()=>{
    const oldKey = ($('#prodKey').value || '').trim();
    const name = normalizeProdName($('#prodName').value || '');
    if(!name) return alert('Nombre requerido');

    const key = prodKeyFromName(name);
    const modeDefault = $('#prodMode').value || 'kg';
    const kgPerBox = parseNum($('#prodKgBox').value);
    const priceKg = parseNum($('#prodPriceKg').value);
    const priceBox = parseNum($('#prodPriceBox').value);
    const priceUd = parseNum($('#prodPriceUd').value);
    const cost = parseNum($('#prodCost').value);
    const originDefault = ($('#prodOrigin').value || '').trim();

    const old = oldKey ? state.products?.[oldKey] : null;
    const prevPrices = old ? { ...(old.prices||{}) } : { kg:0, caja:0, ud:0 };

    // si renombre (key cambia), migrar
    if(oldKey && oldKey !== key){
      // mover producto
      delete state.products[oldKey];
    }

    const p = state.products[key] || {
      key, name,
      modeDefault: 'kg',
      kgPerBox: 0,
      prices: {kg:0,caja:0,ud:0},
      cost: 0,
      originDefault: '',
      history: []
    };

    p.key = key;
    p.name = name;
    p.modeDefault = modeDefault;
    p.kgPerBox = clampNum(kgPerBox, 0);
    p.prices = { kg: clampNum(priceKg,0), caja: clampNum(priceBox,0), ud: clampNum(priceUd,0) };
    p.cost = clampNum(cost,0);
    p.originDefault = originDefault;
    p.history = p.history || [];

    // historial si cambian precios
    const changed =
      Number(prevPrices.kg||0) !== Number(p.prices.kg||0) ||
      Number(prevPrices.caja||0) !== Number(p.prices.caja||0) ||
      Number(prevPrices.ud||0) !== Number(p.prices.ud||0);

    if(changed){
      p.history.unshift({ ts: Date.now(), kg: p.prices.kg, caja: p.prices.caja, ud: p.prices.ud });
      p.history = p.history.slice(0,5);
    }

    state.products[key] = p;

    // si renombre, actualizar líneas en facturas que apunten al oldKey
    if(oldKey && oldKey !== key){
      (state.invoices||[]).forEach(inv=>{
        (inv.lines||[]).forEach(ln=>{
          if(ln.productKey === oldKey){
            ln.productKey = key;
            ln.productName = name;
          }
        });
      });
    }

    saveLocal();
    $('#prodKey').value = key;
    renderProductHistory(p);
    renderProductList();
    renderLines();
    toast('Producto guardado');
  });

  on($('#btnDelProd'),'click', ()=>{
    const key = ($('#prodKey').value || '').trim();
    if(!key) return;
    if(!confirm('¿Eliminar producto?')) return;

    // Seguridad: si usado en facturas, no eliminar
    const used = (state.invoices||[]).some(inv => (inv.lines||[]).some(ln => ln.productKey === key));
    if(used){
      alert('Este producto está usado en facturas. No se elimina.');
      return;
    }

    delete state.products[key];
    saveLocal();
    $('#prodKey').value = '';
    renderProductList();
    toast('Producto eliminado');
  });
}

/* =========================
   32) QR: ahora sí usa TOTAL real
========================= */
function buildQrText(inv){
  const tpl = state.settings.qrTemplate || defaultSettings().qrTemplate;
  const nif = state.provider?.nif || '';
  const num = inv?.number || '';
  const fecha = inv?.dateISO || toISODate(new Date());
  const total = fmt2(computeInvoiceTotals(inv).total);
  return tpl
    .replaceAll('{NIF}', nif)
    .replaceAll('{NUM}', num)
    .replaceAll('{FECHA}', fecha)
    .replaceAll('{TOTAL}', total);
}

function renderQrInto(el, text){
  if(!el) return;
  el.innerHTML = '';
  try{
    // QRCode lib global
    // eslint-disable-next-line no-undef
    new QRCode(el, {
      text,
      width: 160,
      height: 160,
      correctLevel: QRCode.CorrectLevel.M
    });
  }catch(e){
    el.textContent = 'QR error';
  }
}

function regenQRBoth(){
  const inv = getCurrentInvoice();
  const txt = inv ? buildQrText(inv) : '';
  const hint = $('#qrHint');
  if(hint) hint.textContent = txt || '—';

  // main
  const box = $('#qrBox');
  if(box && txt) renderQrInto(box, txt);

  // preview (si existe)
  const pv = $('#invoicePreview');
  if(pv){
    const pvBox = pv.querySelector('.invQr .qrBox');
    if(pvBox && txt) renderQrInto(pvBox, txt);
  }
}

/* =========================
   33) Vista previa Factura (UI) — con tabla + QR + totales
========================= */
function renderInvoicePreview(){
  const wrap = $('#invoicePreview');
  if(!wrap) return;
  const inv = getCurrentInvoice();
  if(!inv){
    wrap.innerHTML = `<div class="muted">Sin factura.</div>`;
    return;
  }

  const cli = getClientById(inv.clientId);
  const t = computeInvoiceTotals(inv);

  // tabla preview
  const rows = (inv.lines||[])
    .filter(ln => (ln.productName || ln.productKey) && (Number(ln.amount)||0) > 0)
    .map(ln=>{
      return `
        <tr>
          <td><strong>${escHtml(ln.productName || '')}</strong></td>
          <td>${escHtml(ln.mode||'')}</td>
          <td>${escHtml(fmt2(ln.cant||0))}</td>
          <td>${escHtml(fmt2(ln.bruto||0))}</td>
          <td>${escHtml(fmt2(ln.tara||0))}</td>
          <td>${escHtml(fmt2(ln.neto||0))}</td>
          <td>${escHtml(fmt2(ln.price||0))}</td>
          <td>${escHtml(ln.origin||'')}</td>
          <td><strong>${escHtml(fmtEUR(ln.amount||0))}</strong></td>
        </tr>
      `;
    }).join('');

  wrap.innerHTML = `
    <div class="invP-top">
      <div class="invBlock">
        <div class="h">PROVEEDOR</div>
        <div class="l"><strong>${escHtml(state.provider.name||'')}</strong></div>
        <div class="l">${escHtml(state.provider.nif||'')}</div>
        <div class="l">${escHtml(state.provider.addr||'')}</div>
        <div class="l">${escHtml(state.provider.phone||'')} · ${escHtml(state.provider.email||'')}</div>
      </div>

      <div class="invQr">
        <div class="qrBox"></div>
      </div>

      <div class="invBlock">
        <div class="h">CLIENTE</div>
        <div class="l"><strong>${escHtml(cli?.fiscalName || cli?.name || '')}</strong></div>
        <div class="l">${escHtml(cli?.nif || '')}</div>
        <div class="l">${escHtml(cli?.addr || '')}</div>
        <div class="l">${escHtml(cli?.phone || '')} ${cli?.email ? ('· '+escHtml(cli.email)) : ''}</div>
      </div>
    </div>

    <div class="invMeta">
      <div class="m">Nº: <strong>${escHtml(inv.number||'')}</strong></div>
      <div class="m">Fecha: <strong>${escHtml(inv.dateISO||'')}</strong></div>
      <div class="m">Tags: <strong>${escHtml(inv.tags||'—')}</strong></div>
    </div>

    <table class="invTable">
      <thead>
        <tr>
          <th>Producto</th><th>Modo</th><th>Cant.</th><th>Bruto</th><th>Tara</th><th>Neto</th><th>Precio</th><th>Origen</th><th>Importe</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9" class="muted">Sin líneas con importe.</td></tr>`}
      </tbody>
    </table>

    <div class="invFoot">
      <div class="invTotals">
        <div class="row"><span>Subtotal</span><strong>${escHtml(fmtEUR(t.subtotal))}</strong></div>
        <div class="row"><span>Transporte</span><strong>${escHtml(fmtEUR(t.transport))}</strong></div>
        <div class="row"><span>IVA (4%)</span><strong>${escHtml(fmtEUR(t.iva))}</strong></div>
        <div class="row big"><span>TOTAL</span><strong>${escHtml(fmtEUR(t.total))}</strong></div>
        <div class="hint" style="margin-top:6px;">
          ${inv.ivaIncluido ? 'IVA incluido en los precios (sin desglose).' : 'IVA 4% desglosado.'}
        </div>
      </div>

      <div class="invSide">
        <div class="row">Estado: <strong>${escHtml(inv.payStatus||'impagada')}</strong></div>
        <div class="row">Método: <strong>${escHtml(inv.payMethod||'efectivo')}</strong></div>
        <div class="row">Pendiente: <strong>${escHtml(fmtEUR(Math.max(0,t.pending)))}</strong></div>
        <div class="row">Obs: <strong>${escHtml(inv.obs||'—')}</strong></div>
      </div>
    </div>
  `;

  // QR preview
  regenQRBoth();
}

/* =========================
   34) Render factura UI (override placeholder)
========================= */
function renderInvoiceUI(){
  ensureCurrentInvoice();
  const inv = getCurrentInvoice();
  if(!inv) return;

  // defaults 5 líneas
  ensureInvoiceLines(inv, 5);

  // provider
  renderProviderUI();

  // cliente selects
  renderAllClientSelects();
  $('#invClient').value = inv.clientId || '';

  // cliente fields
  renderInvoiceClientUI(inv);

  // meta
  $('#invNumber').value = inv.number || invoiceNumberFromDate(new Date());
  $('#invDate').value = inv.dateISO || toISODate(new Date());
  $('#invTags').value = inv.tags || '';
  $('#invNotes').value = inv.notes || '';
  $('#invObs').value = inv.obs || '';

  // toggles
  $('#chkTransport').checked = !!inv.transportEnabled;
  $('#chkIvaIncluido').checked = !!inv.ivaIncluido;

  // pagos
  renderPayList();

  // grid
  renderLines();

  // lista facturas
  renderInvoiceList();
}

/* =========================
   35) Boot parcial (la app ya funciona offline)
   (Cloud + PDF PRO final se completan en Parte 3/3)
========================= */
window.__ARSLAN_BOOT = function(){
  // 1) load local
  loadLocal();

  // 2) init products vocab if empty
  initProductsIfEmpty();

  // 3) ensure invoice + 5 lines
  ensureCurrentInvoice();
  const inv = getCurrentInvoice();
  ensureInvoiceLines(inv, 5);

  // 4) tabs & binds
  bindTabs();
  bindGeneralButtons();
  bindInvoiceMetaAndButtons();
  bindClientsTab();
  bindProductsTab();

  // 5) UI renders
  renderSettingsUI();
  renderAllClientSelects();
  renderProviderUI();
  renderInvoiceUI();
  renderClientList();
  renderProductList();
  renderAccountingLockedState();

  // 6) inline quick buttons in tabs
  toast('Listo');
};
/* =========================================================
   app.js (3/3)
   - PDF PRO (jsPDF + AutoTable): Proveedor izq / QR centro / Cliente der + logo
   - WhatsApp PRO: resumen limpio + totales + link PDF si existe
   - Cloud opcional Firebase: login + sync + guardar pdfUrl (Storage)
   - Contabilidad real (PIN): ventas + IVA + margen (coste producto)
========================================================= */

/* =========================
   36) PDF PRO — helpers
========================= */
function ensureLibsPDF(){
  const okJsPDF = !!(window.jspdf && window.jspdf.jsPDF);
  const okAT = !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
  if(!okJsPDF){
    alert('Falta jsPDF. Revisa el index.html (CDN jsPDF).');
    return false;
  }
  if(!okAT){
    alert('Falta AutoTable. Revisa el index.html (plugin jspdf-autotable).');
    return false;
  }
  return true;
}

function getLogoDataURL_BW(){
  // Logo B/W simple (sin depender de archivos): círculo + “A”
  // Genera un PNG en canvas y devuelve dataURL
  const c = document.createElement('canvas');
  c.width = 220; c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0,0,c.width,c.height);
  g.strokeStyle = '#111111';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(110,110,90,0,Math.PI*2);
  g.stroke();

  g.fillStyle = '#111111';
  g.font = 'bold 110px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('A',110,118);

  g.font = 'bold 26px Arial';
  g.fillText('ARSLAN',110,185);

  return c.toDataURL('image/png');
}

function getQrDataURL(text){
  try{
    const tmp = document.createElement('div');
    tmp.style.position = 'fixed';
    tmp.style.left = '-9999px';
    tmp.style.top = '-9999px';
    document.body.appendChild(tmp);

    // eslint-disable-next-line no-undef
    new QRCode(tmp, { text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });

    const canvas = tmp.querySelector('canvas');
    const img = tmp.querySelector('img');
    let url = '';
    if(canvas) url = canvas.toDataURL('image/png');
    else if(img) url = img.src;

    tmp.remove();
    return url;
  }catch(e){
    console.warn('QR dataURL error', e);
    return '';
  }
}

function pdfFilename(inv){
  const safeNum = (inv.number||'FACTURA').replace(/[^\w\-]+/g,'_');
  return `${safeNum}.pdf`;
}

/* =========================
   37) PDF PRO — generar (local) y (cloud opcional)
========================= */
async function generatePDF({ upload=false } = {}){
  const inv = getCurrentInvoice();
  if(!inv) return;

  if(!ensureLibsPDF()) return;

  // Totales y QR
  const totals = computeInvoiceTotals(inv);
  const qrText = buildQrText(inv);
  const qrImg = getQrDataURL(qrText);
  const logoImg = getLogoDataURL_BW();

  const cli = getClientById(inv.clientId);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header baseline
  const topY = 14;

  // Logo
  try{
    doc.addImage(logoImg, 'PNG', margin, topY, 18, 18);
  }catch(e){}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FACTURA', margin+22, topY+8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nº: ${inv.number || ''}`, pageW - margin, topY+3, { align:'right' });
  doc.text(`Fecha: ${inv.dateISO || ''}`, pageW - margin, topY+9, { align:'right' });

  // 3 bloques: proveedor | QR | cliente
  const boxY = topY + 22;
  const boxH = 32;
  const gap = 6;
  const boxW = (pageW - 2*margin - 2*gap) / 3;

  function drawBox(x,y,w,h,title,lines){
    doc.setDrawColor(30);
    doc.setLineWidth(0.3);
    doc.roundedRect(x,y,w,h,2,2);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(title, x+3, y+5);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    let yy = y+10;
    (lines||[]).forEach(s=>{
      if(!s) return;
      doc.text(String(s), x+3, yy);
      yy += 4.2;
    });
  }

  const provLines = [
    state.provider.name || '',
    state.provider.nif || '',
    state.provider.addr || '',
    `${state.provider.phone || ''}${state.provider.email ? ' · '+state.provider.email : ''}`.trim()
  ];

  const cliLines = [
    cli?.fiscalName || cli?.name || '',
    cli?.nif || '',
    cli?.addr || '',
    `${cli?.phone || ''}${cli?.email ? ' · '+cli.email : ''}`.trim()
  ];

  drawBox(margin, boxY, boxW, boxH, 'PROVEEDOR', provLines);
  drawBox(margin + boxW + gap + boxW + gap, boxY, boxW, boxH, 'CLIENTE', cliLines);

  // QR box centro
  const qrX = margin + boxW + gap;
  doc.setDrawColor(30);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrX, boxY, boxW, boxH, 2, 2);
  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.text('QR AEAT', qrX+3, boxY+5);
  if(qrImg){
    try{
      // centrado
      const s = 22;
      doc.addImage(qrImg, 'PNG', qrX + (boxW - s)/2, boxY + 7, s, s);
    }catch(e){}
  }else{
    doc.setFont('helvetica','normal');
    doc.text('QR no disponible', qrX+3, boxY+14);
  }

  // Tabla
  const tableY = boxY + boxH + 10;

  const head = [[
    'Producto','Modo','Cant.','Bruto','Tara','Neto','Precio','Origen','Importe'
  ]];

  const body = (inv.lines||[]).map(ln=>{
    // IMPORTANTE: “últimos precios” NO se imprimen — solo el precio de la línea.
    const prod = (ln.productName || '').trim();
    const hasAny = prod || ln.productKey;
    if(!hasAny) return null;
    // recalcular por seguridad
    calcLine(ln);
    const amount = Number(ln.amount||0);
    // dejamos pasar incluso 0 si el usuario lo quiere en PDF (pero normalmente no)
    return [
      prod,
      ln.mode || '',
      fmt2(ln.cant||0),
      fmt2(ln.bruto||0),
      fmt2(ln.tara||0),
      fmt2(ln.neto||0),
      fmt2(ln.price||0),
      (ln.origin||''),
      fmt2(amount)
    ];
  }).filter(Boolean);

  doc.autoTable({
    startY: tableY,
    head,
    body: body.length ? body : [['(sin líneas)','','','','','','','','']],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      lineWidth: 0.1,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [245,245,245],
      textColor: [0,0,0],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [252,252,252] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 12 },
      2: { cellWidth: 13, halign:'right' },
      3: { cellWidth: 13, halign:'right' },
      4: { cellWidth: 12, halign:'right' },
      5: { cellWidth: 13, halign:'right' },
      6: { cellWidth: 14, halign:'right' },
      7: { cellWidth: 25 },
      8: { cellWidth: 16, halign:'right' }
    },
    didDrawPage: (data)=>{
      // Footer: página
      const p = doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Página ${p}`, pageW - margin, pageH - 8, { align:'right' });
    }
  });

  // Totales bajo tabla
  const endY = doc.lastAutoTable.finalY + 8;

  const totalsX = pageW - margin - 70;
  doc.setDrawColor(30);
  doc.setLineWidth(0.2);
  doc.roundedRect(totalsX, endY, 70, 30, 2, 2);

  doc.setFont('helvetica','normal');
  doc.setTextColor(0);
  doc.text('Subtotal', totalsX+4, endY+8);
  doc.text(fmtEUR(totals.subtotal), totalsX+66, endY+8, {align:'right'});

  doc.text('Transporte', totalsX+4, endY+14);
  doc.text(fmtEUR(totals.transport), totalsX+66, endY+14, {align:'right'});

  doc.text('IVA (4%)', totalsX+4, endY+20);
  doc.text(fmtEUR(totals.iva), totalsX+66, endY+20, {align:'right'});

  doc.setFont('helvetica','bold');
  doc.text('TOTAL', totalsX+4, endY+27);
  doc.text(fmtEUR(totals.total), totalsX+66, endY+27, {align:'right'});

  // Notas / IVA incluido
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(70);
  const note = inv.ivaIncluido ? 'IVA incluido en los precios (sin desglose).' : 'IVA 4% desglosado.';
  doc.text(note, margin, pageH - 10);

  // Blob + URL local
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  state.tempPdfUrl = url;

  // Guardar en la factura (marcar que hay PDF local)
  // (si subimos a nube, guardamos pdfUrl también)
  saveLocal();
  recalcInvoiceTotalsAndUI(true);

  // Descargar local (si no es upload-only)
  if(!upload){
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfFilename(inv);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('PDF generado');
    return { blob, url, downloadUrl: '' };
  }

  // Upload Cloud
  const res = await uploadPdfToCloud(inv, blob);
  if(res?.downloadUrl){
    inv.pdfUrl = res.downloadUrl;
    // marca en DB
    await cloudSaveAll(); // guarda factura con pdfUrl
    saveLocal();
    recalcInvoiceTotalsAndUI(true);
    toast('PDF subido a nube ✅');
  }else{
    toast('PDF listo (sin nube)');
  }
  return { blob, url, downloadUrl: res?.downloadUrl || '' };
}

/* =========================
   38) WhatsApp PRO
========================= */
function buildWhatsText(inv){
  const cli = getClientById(inv.clientId);
  const t = computeInvoiceTotals(inv);

  const lines = (inv.lines||[])
    .filter(ln => (ln.productName || ln.productKey))
    .map(ln=>{
      calcLine(ln);
      const prod = ln.productName || '';
      const mode = ln.mode || 'kg';
      const cant = fmt2(ln.cant||0);
      const neto = fmt2(ln.neto||0);
      const price = fmt2(ln.price||0);
      const amount = fmt2(ln.amount||0);

      // formato corto según modo
      if(mode === 'kg'){
        return `- ${prod} · neto ${neto}kg · ${price}€/kg = ${amount}€`;
      }
      if(mode === 'caja'){
        return `- ${prod} · ${cant} caja · ${price}€ = ${amount}€`;
      }
      return `- ${prod} · ${cant} ud · ${price}€ = ${amount}€`;
    });

  const header = [
    `FACTURA ${inv.number || ''}`,
    `Fecha: ${inv.dateISO || ''}`,
    `Cliente: ${cli?.name || inv.clientNameCache || ''}`,
    inv.tags ? `Tags: ${inv.tags}` : ''
  ].filter(Boolean).join('\n');

  const totals = [
    '',
    `Subtotal: ${fmtEUR(t.subtotal)}`,
    `Transporte: ${fmtEUR(t.transport)}`,
    inv.ivaIncluido ? `IVA: (incluido)` : `IVA (4%): ${fmtEUR(t.iva)}`,
    `TOTAL: ${fmtEUR(t.total)}`,
    `Pendiente: ${fmtEUR(Math.max(0,t.pending))}`
  ].join('\n');

  const pdfLine = inv.pdfUrl ? `\n\nPDF: ${inv.pdfUrl}` : (state.tempPdfUrl ? `\n\nPDF (local): generado` : '');

  return `${header}\n\n${lines.join('\n')}${totals}${pdfLine}`.trim();
}

function sendWhatsApp(){
  const inv = getCurrentInvoice();
  if(!inv) return;
  const text = buildWhatsText(inv);
  const url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

/* =========================
   39) CLOUD Firebase (lazy-load, sin romper offline)
   - Auth + RTDB + Storage opcional
========================= */
let __fb = null;

async function loadFirebase(){
  if(__fb) return __fb;

  if(!isFirebaseConfigured()){
    throw new Error('Firebase no configurado (Ajustes).');
  }

  const base = 'https://www.gstatic.com/firebasejs/12.7.0/';
  const [
    appMod,
    authMod,
    dbMod,
    storageMod
  ] = await Promise.all([
    import(base+'firebase-app.js'),
    import(base+'firebase-auth.js'),
    import(base+'firebase-database.js'),
    import(base+'firebase-storage.js')
  ]);

  __fb = { appMod, authMod, dbMod, storageMod };
  return __fb;
}

function fbConfig(){
  const fb = state.settings.firebase || {};
  return {
    apiKey: fb.apiKey,
    authDomain: fb.authDomain,
    databaseURL: fb.databaseURL,
    projectId: fb.projectId,
    appId: fb.appId,
    storageBucket: fb.storageBucket || undefined
  };
}

async function cloudInit(){
  try{
    const { appMod, authMod, dbMod, storageMod } = await loadFirebase();

    if(state.cloud.ready) return true;

    const app = appMod.initializeApp(fbConfig());
    const auth = authMod.getAuth(app);
    const db = dbMod.getDatabase(app);

    let storage = null;
    try{
      storage = storageMod.getStorage(app);
    }catch(e){
      storage = null;
    }

    state.cloud.firebase = { app, auth, db, storage };
    state.cloud.ready = true;
    state.cloud.enabled = true;

    // Listener sesión
    authMod.onAuthStateChanged(auth, (user)=>{
      state.cloud.user = user || null;
      updateCloudUIStatus();
    });

    updateCloudUIStatus();
    return true;
  }catch(e){
    console.warn('cloudInit error:', e);
    state.cloud.enabled = false;
    state.cloud.ready = false;
    updateCloudUIStatus();
    return false;
  }
}

function cloudPath(){
  const u = state.cloud.user;
  if(!u) return '';
  return `arslan_facturas_kiwi_bw/users/${u.uid}/data`;
}

function updateCloudUIStatus(){
  const el = $('#pillMode');
  const u = state.cloud.user;
  const ok = state.cloud.ready && state.cloud.enabled;

  const cloudInfo = $('#cloudInfo');
  if(cloudInfo){
    cloudInfo.textContent = ok
      ? (u ? `Cloud: conectado (${u.email || 'user'})` : 'Cloud: listo (sin login)')
      : 'Cloud: OFF (local)';
  }

  if(el){
    // no pisar toast: solo si está en modo normal
    // (mantiene el estilo simple)
  }

  // botones
  const bSync = $('#btnSync');
  const bPdfCloud = $('#btnPDFCloud');
  const bLoginDo = $('#btnLoginDo');
  const bLogout = $('#btnLogout');
  if(bSync) bSync.disabled = !(ok && u);
  if(bPdfCloud) bPdfCloud.disabled = !(ok && u);
  if(bLoginDo) bLoginDo.disabled = !ok;
  if(bLogout) bLogout.disabled = !(ok && u);
}

/* =========================
   40) Login UI (modal)
========================= */
function bindLoginUI(){
  // intenta encontrar inputs típicos
  const email = $('#loginEmail');
  const pass = $('#loginPass');
  const btnDo = $('#btnLoginDo');
  const btnOut = $('#btnLogout');

  if(btnDo){
    on(btnDo,'click', async ()=>{
      try{
        await cloudInit();
        const { authMod } = await loadFirebase();
        const auth = state.cloud.firebase.auth;
        const em = (email?.value || '').trim();
        const pw = (pass?.value || '').trim();
        if(!em || !pw) return alert('Email y contraseña');
        await authMod.signInWithEmailAndPassword(auth, em, pw);
        closeModal('#loginModal');
        toast('Login OK');
      }catch(e){
        alert('Login error: ' + (e?.message || e));
      }
    });
  }

  if(btnOut){
    on(btnOut,'click', async ()=>{
      try{
        await cloudInit();
        const { authMod } = await loadFirebase();
        await authMod.signOut(state.cloud.firebase.auth);
        toast('Logout');
      }catch(e){
        alert('Logout error: ' + (e?.message || e));
      }
    });
  }
}

/* =========================
   41) Cloud Save/Load + Merge inteligente
========================= */
function isLocalDefaultEmpty(){
  // consideramos “vacío” si no hay facturas reales (solo 1 vacía sin líneas)
  const invs = state.invoices || [];
  if(!invs.length) return true;
  if(invs.length === 1){
    const inv = invs[0];
    const hasLine = (inv.lines||[]).some(l => (l.productName||l.productKey) && (Number(l.amount)||0) > 0);
    const hasClient = !!inv.clientId;
    const hasMeta = !!inv.number;
    return !(hasLine || hasClient || hasMeta);
  }
  return false;
}

function invDedupeKey(inv){
  const cli = inv.clientId || '';
  return `${inv.dateISO||''}__${inv.number||''}__${cli}`.toUpperCase();
}

function mergeData(local, cloud){
  const out = JSON.parse(JSON.stringify(local));

  // --- Clients merge (id -> name)
  const lc = Array.isArray(local.clients) ? local.clients : [];
  const cc = Array.isArray(cloud.clients) ? cloud.clients : [];
  const mapC = new Map();

  const normName = (c)=> normalizeProdName(c?.name || c?.fiscalName || '');

  // primero cloud (preferimos cloud como fuente “compartida”)
  cc.forEach(c=>{
    if(!c) return;
    const id = c.id || uid('cli');
    mapC.set(id, c);
  });
  // luego local: si id existe, merge; si no, intenta por nombre
  lc.forEach(c=>{
    if(!c) return;
    const id = c.id || uid('cli');
    if(mapC.has(id)){
      mapC.set(id, { ...mapC.get(id), ...c });
      return;
    }
    // match por nombre
    const nm = normName(c);
    const found = Array.from(mapC.values()).find(x => normName(x) === nm);
    if(found){
      const merged = { ...found, ...c, id: found.id };
      mapC.set(found.id, merged);
    }else{
      mapC.set(id, c);
    }
  });
  out.clients = Array.from(mapC.values());

  // --- Products merge por key
  const lp = local.products || {};
  const cp = cloud.products || {};
  const mapP = new Map();

  Object.keys(cp).forEach(k=> mapP.set(k, cp[k]));
  Object.keys(lp).forEach(k=>{
    if(mapP.has(k)) mapP.set(k, { ...mapP.get(k), ...lp[k] });
    else mapP.set(k, lp[k]);
  });
  out.products = {};
  for(const [k,v] of mapP.entries()) out.products[k] = v;

  // --- Invoices merge: por id o key compuesto
  const li = Array.isArray(local.invoices) ? local.invoices : [];
  const ci = Array.isArray(cloud.invoices) ? cloud.invoices : [];
  const mapI = new Map();
  const mapKey = new Map();

  // cloud first
  ci.forEach(inv=>{
    if(!inv) return;
    if(inv.id) mapI.set(inv.id, inv);
    mapKey.set(invDedupeKey(inv), inv);
  });

  // local merge
  li.forEach(inv=>{
    if(!inv) return;
    if(inv.id && mapI.has(inv.id)){
      // merge por id (preferimos campos locales para edición reciente)
      mapI.set(inv.id, { ...mapI.get(inv.id), ...inv });
      return;
    }
    const k = invDedupeKey(inv);
    const hit = mapKey.get(k);
    if(hit){
      const merged = { ...hit, ...inv, id: hit.id || inv.id || uid('inv') };
      mapI.set(merged.id, merged);
      mapKey.set(k, merged);
    }else{
      const id = inv.id || uid('inv');
      const nu = { ...inv, id };
      mapI.set(id, nu);
      mapKey.set(k, nu);
    }
  });

  // ordenar por fecha desc
  const mergedList = Array.from(mapI.values()).sort((a,b)=>{
    const ta = (a.dateISO||'') + (a.number||'');
    const tb = (b.dateISO||'') + (b.number||'');
    return tb.localeCompare(ta);
  });

  out.invoices = mergedList;

  // provider + settings (preferimos local, pero completamos cloud si falta)
  out.provider = { ...(cloud.provider||{}), ...(local.provider||{}) };
  out.settings = { ...(cloud.settings||{}), ...(local.settings||{}) };

  return out;
}

async function cloudLoad(){
  await cloudInit();
  if(!state.cloud.user) throw new Error('No hay login');

  const { dbMod } = await loadFirebase();
  const db = state.cloud.firebase.db;

  const path = cloudPath();
  const snap = await dbMod.get(dbMod.ref(db, path));
  const data = snap.exists() ? snap.val() : null;

  return data || null;
}

async function cloudSaveAll(){
  await cloudInit();
  if(!state.cloud.user) throw new Error('No hay login');

  const { dbMod } = await loadFirebase();
  const db = state.cloud.firebase.db;
  const path = cloudPath();

  const payload = {
    ts: Date.now(),
    provider: state.provider,
    clients: state.clients,
    products: state.products,
    invoices: state.invoices,
    settings: state.settings
  };
  await dbMod.set(dbMod.ref(db, path), payload);
  return true;
}

async function cloudSync(){
  try{
    await cloudInit();
    if(!state.cloud.user) return alert('Haz login primero');

    const cloudData = await cloudLoad();
    if(!cloudData){
      // nube vacía -> sube local
      await cloudSaveAll();
      toast('Cloud: subido');
      updateCloudUIStatus();
      return;
    }

    // estrategia: si local “vacío” -> pull cloud
    if(isLocalDefaultEmpty()){
      state.provider = { ...defaultProvider(), ...(cloudData.provider||{}) };
      state.clients = Array.isArray(cloudData.clients) ? cloudData.clients : defaultClients();
      state.products = cloudData.products || buildDefaultProductsFromVocab();
      state.invoices = Array.isArray(cloudData.invoices) ? cloudData.invoices : [];
      state.settings = { ...defaultSettings(), ...(cloudData.settings||{}) };

      saveLocal();
      renderSettingsUI();
      renderAllClientSelects();
      ensureCurrentInvoice();
      renderInvoiceUI();
      renderClientList();
      renderProductList();
      renderInvoiceList();
      toast('Cloud: descargado');
      return;
    }

    // merge
    const localData = {
      provider: state.provider,
      clients: state.clients,
      products: state.products,
      invoices: state.invoices,
      settings: state.settings
    };

    const merged = mergeData(localData, cloudData);

    state.provider = merged.provider;
    state.clients = merged.clients;
    state.products = merged.products;
    state.invoices = merged.invoices;
    state.settings = merged.settings;

    saveLocal();
    await cloudSaveAll();

    renderSettingsUI();
    renderAllClientSelects();
    ensureCurrentInvoice();
    renderInvoiceUI();
    renderClientList();
    renderProductList();
    renderInvoiceList();

    toast('Cloud: sincronizado ✅');
  }catch(e){
    alert('Sync error: ' + (e?.message || e));
  }
}

/* =========================
   42) Upload PDF a Storage (si existe bucket)
========================= */
async function uploadPdfToCloud(inv, blob){
  await cloudInit();
  if(!state.cloud.user) throw new Error('No hay login');

  const { storageMod } = await loadFirebase();
  const storage = state.cloud.firebase.storage;
  if(!storage){
    // sin storage -> no se puede link permanente
    return { downloadUrl: '' };
  }

  const uidUser = state.cloud.user.uid;
  const fname = pdfFilename(inv);
  const path = `arslan_facturas_kiwi_bw/${uidUser}/pdf/${fname}`;

  const r = storageMod.ref(storage, path);
  await storageMod.uploadBytes(r, blob, { contentType:'application/pdf' });
  const url = await storageMod.getDownloadURL(r);
  return { downloadUrl: url };
}

/* =========================
   43) Contabilidad real (PIN)
========================= */
function getInvoiceCost(inv){
  // coste usando product.cost:
  // - kg: neto * cost
  // - caja: si kgPerBox y cant -> cant*kgPerBox*cost, si no neto*cost
  // - ud: cant*cost
  let cost = 0;
  (inv.lines||[]).forEach(ln=>{
    if(!(ln.productKey||ln.productName)) return;
    calcLine(ln);
    const p = state.products?.[ln.productKey] || null;
    const c = Number(p?.cost || 0);
    if(!c) return;

    const mode = ln.mode || 'kg';
    const cant = Number(ln.cant||0);
    const neto = Number(ln.neto||0);
    const kgBox = Number(p?.kgPerBox||0);

    if(mode === 'kg'){
      cost += neto * c;
    }else if(mode === 'caja'){
      if(cant > 0 && kgBox > 0) cost += cant * kgBox * c;
      else cost += neto * c;
    }else{
      // ud
      cost += cant * c;
    }
  });
  return cost;
}

function renderAccounting(){
  const tbody = $('#accTable tbody');
  if(!tbody) return;

  if(!state.unlockedAccounting){
    renderAccountingLockedState();
    return;
  }

  const from = $('#accFrom')?.value || '';
  const to = $('#accTo')?.value || '';
  const cliId = $('#accClient')?.value || '';

  const inRange = (dISO)=>{
    if(from && dISO < from) return false;
    if(to && dISO > to) return false;
    return true;
  };

  const invs = (state.invoices||[]).filter(inv=>{
    if(!inRange(inv.dateISO||'')) return false;
    if(cliId && inv.clientId !== cliId) return false;
    return true;
  });

  let sumSales = 0;
  let sumIva = 0;
  let sumCost = 0;

  const rows = invs.map(inv=>{
    const t = computeInvoiceTotals(inv);
    // IVA real solo si no incluido; si incluido lo dejamos 0 para contabilidad simple
    const iva = inv.ivaIncluido ? 0 : t.iva;
    const cost = getInvoiceCost(inv);

    sumSales += t.total;
    sumIva += iva;
    sumCost += cost;

    const cli = getClientById(inv.clientId);
    return `
      <tr>
        <td>${escHtml(inv.dateISO||'')}</td>
        <td>${escHtml(inv.number||'')}</td>
        <td>${escHtml(cli?.name || inv.clientNameCache || '')}</td>
        <td style="text-align:right;">${escHtml(fmt2(t.total))}</td>
        <td style="text-align:right;">${escHtml(fmt2(cost))}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="5" class="muted">Sin resultados.</td></tr>`;

  const margin = sumSales - sumCost;

  $('#accSales').textContent = fmtEUR(sumSales);
  $('#accIva').textContent = fmtEUR(sumIva);
  $('#accN').textContent = String(invs.length);
  $('#accMargin').textContent = fmtEUR(margin);
}

function bindAccounting(){
  on($('#btnAccCalc'),'click', renderAccounting);
  on($('#accFrom'),'change', renderAccounting);
  on($('#accTo'),'change', renderAccounting);
  on($('#accClient'),'change', renderAccounting);
}

/* =========================
   44) Re-binds: reemplazar handlers placeholder de Parte 2 (captura)
========================= */
function overrideButtonsReal(){
  const hook = (id, fn)=>{
    const el = $(id);
    if(!el) return;
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      fn();
    }, true);
  };

  hook('#btnPDF', async ()=>{ await generatePDF({ upload:false }); });
  hook('#btnPDFCloud', async ()=>{ await generatePDF({ upload:true }); });
  hook('#btnWhats', ()=>{ sendWhatsApp(); });
  hook('#btnSync', async ()=>{ await cloudSync(); });
}

/* =========================
   45) Boot final: añade cloud init (opcional) sin romper offline
========================= */
const __BOOT_OLD = window.__ARSLAN_BOOT;
window.__ARSLAN_BOOT = function(){
  // boot de Parte 2
  if(typeof __BOOT_OLD === 'function') __BOOT_OLD();

  // rebind real
  overrideButtonsReal();
  bindLoginUI();
  bindAccounting();

  // intenta preparar cloud (no obliga internet)
  cloudInit().catch(()=>{});

  // pinta estado cloud
  updateCloudUIStatus();

  // contabilidad si desbloqueada
  if(state.unlockedAccounting) renderAccounting();
};
