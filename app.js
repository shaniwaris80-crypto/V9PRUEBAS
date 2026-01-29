/* =========================================================
   FACTU MIRAL — B/W PRO
   app.js (PARTE 3A/3) — Estado + Datos + Storage + Init base
   ========================================================= */

(function(){
'use strict';

/* ===========================
   HELPERS
=========================== */
const $  = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const pad2 = n => (n<10?'0':'')+n;
const euro = n => {
  const x = Number(n||0);
  return x.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
};
const num = v => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).replace(',', '.').trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};
const clamp0 = v => Math.max(0, num(v));
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};
const nowFacturaId = () => {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = pad2(d.getMonth()+1);
  const DD = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `FA-${YYYY}${MM}${DD}${hh}${mm}`;
};
const fmtES = iso => {
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
};
const dayNameES = iso => {
  try{
    const d = new Date(iso+'T00:00:00');
    const names = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return names[d.getDay()];
  }catch{ return '—'; }
};

function toast(msg){
  const el = $('#toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.add('hidden'), 2200);
}

function confirmBW(msg){
  // confirm normal pero centralizado por si quieres cambiarlo
  return window.confirm(msg);
}

/* ===========================
   STORAGE KEYS
=========================== */
const K = {
  provider: 'factumiral_provider_v1',
  clientes: 'factumiral_clientes_v1',
  productos: 'factumiral_productos_v1',
  taras:    'factumiral_taras_v1',
  facturas: 'factumiral_facturas_v1',
  settings: 'factumiral_settings_v1',
  ventas:   'factumiral_ventas_v1',
  session:  'factumiral_session_v1', // locks
};

function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}
function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

/* ===========================
   DEFAULTS (Proveedor / Ajustes / Datos iniciales)
=========================== */
function providerDefaults(){
  return {
    nombre: 'Mohammad Arslan Waris',
    nif: 'X6389988J',
    dir: 'Calle San Pablo 17, 09003 Burgos',
    tel: '631 667 893',
    email: 'shaniwaris80@gmail.com'
  };
}

function settingsDefaults(){
  return {
    pinCont: '0000',
    ivaPct: 4,
    transpPct: 10,
    qrBase: 'NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}',

    // Cloud Firebase opcional
    fb: {
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      appId: ''
    }
  };
}

// CLIENTES iniciales (los que pediste cargar)
function initialClientes(){
  return ([
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo', tel:'', email:'', alias:'', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos', pago:'', tel:'', email:'', alias:'', notas:'IVA incluido en los precios', tags:'', ivaIncluido:true, transp:false},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', pago:'', tel:'947 20 35 51', email:'', alias:'Con/sentidos', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', pago:'', tel:'947 277 977', email:'bertiz.miranda@gmail.com', alias:'', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos', pago:'', tel:'', email:'', alias:'ALESAL PAN', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos', pago:'', tel:'', email:'', alias:'RIVIERA', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos', pago:'', tel:'', email:'', alias:'NUOVO', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', pago:'', tel:'', email:'info@restaurantelosbraseros.com', alias:'Los Braseros', notas:'', tags:'', ivaIncluido:false, transp:false},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', pago:'', tel:'', email:'info@hotelcordon.com', alias:'Hotel Cordon', notas:'', tags:'', ivaIncluido:false, transp:false},
  ]);
}

// TARAS iniciales mínimas (puedes editar en Taras)
function initialTaras(){
  return ([
    {id:uid(), nombre:'Caja plástico ESMO', peso:0.30, notas:''},
    {id:uid(), nombre:'Caja plástico Montenegro', peso:0.30, notas:''},
    {id:uid(), nombre:'Baúl Hnos viejo', peso:1.80, notas:''},
  ]);
}

// PRODUCTOS a cargar (tu lista)
const PRODUCT_NAMES = [
  "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA","AGUACATE GRANEL","MARACUYÁ",
  "MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA","MANDARINA HOJA","MANZANA GOLDEN 20","NARANJA TOMASIN","NECTARINA","NUECES","SANDIA","LIMON SEGUNDA","MANZANA FUJI",
  "NARANJA MESA SONRISA","JENGIBRE","BATATA","AJO PRIMERA","CEBOLLA NORMAL","CALABAZA GRANDE","PATATA LAVADA","TOMATE CHERRY RAMA","TOMATE CHERRY PERA","TOMATE DANIELA","TOMATE ROSA PRIMERA",
  "CEBOLLINO","TOMATE ASURCADO MARRON","TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","CEBOLLETA","PUERROS","BROCOLI","JUDIA VERDE","BERENJENA","PIMIENTO ITALIANO VERDE",
  "PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA","ALCACHOFA","CALABACIN","COLIFLOR","BATAVIA","ICEBERG","MANDARINA SEGUNDA","MANZANA GOLDEN 28","NARANJA ZUMO","KIWI SEGUNDA",
  "MANZANA ROYAL GALA 24","PLATANO CANARIO SUELTO","CEREZA","FRESAS","ARANDANOS","ESPINACA","PEREJIL","CILANTRO","ACELGAS","PIMIENTO VERDE","PIMIENTO ROJO","MACHO VERDE","MACHO MADURO",
  "YUCA","AVOCADO","CEBOLLA ROJA","MENTA","HABANERO","RABANITOS","POMELO","PAPAYA","REINETA 28","NISPERO","ALBARICOQUE","TOMATE PERA","TOMATE BOLA","TOMATE PINK","VALVENOSTA GOLDEN",
  "MELOCOTON ROJO","MELON GALIA","APIO","NARANJA SANHUJA","LIMON PRIMERA","MANGO","MELOCOTON AMARILLO","VALVENOSTA ROJA","PIÑA","NARANJA HOJA","PERA CONFERENCIA SEGUNDA","CEBOLLA DULCE",
  "TOMATE ASURCADO AZUL","ESPARRAGOS BLANCOS","ESPARRAGOS TRIGUEROS","REINETA PRIMERA","AGUACATE PRIMERA","COCO","NECTARINA SEGUNDA","REINETA 24","NECTARINA CARNE BLANCA","GUINDILLA",
  "REINETA VERDE","PATATA 25KG","PATATA 5 KG","TOMATE RAFF","REPOLLO","KIWI ZESPRI","PARAGUAYO SEGUNDA","MELON","REINETA 26","TOMATE ROSA","MANZANA CRIPS",
  "ALOE VERA PIEZAS","TOMATE ENSALADA","PATATA 10KG","MELON BOLLO","CIRUELA ROJA","LIMA","GUINEO VERDE","SETAS","BANANA","BONIATO","FRAMBUESA","BREVAS","PERA AGUA","YAUTIA","YAME",
  "OKRA","MANZANA MELASSI","CACAHUETE","SANDIA NEGRA","SANDIA RAYADA","HIGOS","KUMATO","KIWI CHILE","MELOCOTON AMARILLO SEGUNDA","HIERBABUENA","REMOLACHA","LECHUGA ROMANA","CEREZA",
  "KAKI","CIRUELA CLAUDIA","PERA LIMONERA","CIRUELA AMARILLA","HIGOS BLANCOS","UVA ALVILLO","LIMON EXTRA","PITAHAYA ROJA","HIGO CHUMBO","CLEMENTINA","GRANADA","NECTARINA PRIMERA BIS",
  "CHIRIMOYA","UVA CHELVA","PIMIENTO CALIFORNIA VERDE","KIWI TOMASIN","PIMIENTO CALIFORNIA ROJO","MANDARINA SATSUMA","CASTAÑA","CAKI","MANZANA KANZI","PERA ERCOLINA","NABO",
  "UVA ALVILLO NEGRA","CHAYOTE","ROYAL GALA 28","MANDARINA PRIMERA","PIMIENTO PINTON","MELOCOTON AMARILLO DE CALANDA","HINOJOS","MANDARINA DE HOJA","UVA ROJA PRIMERA","UVA BLANCA PRIMERA"
];

function initialProductos(){
  // Producto base: precios/historial vacíos (se actualizan al usar/guardar facturas)
  return PRODUCT_NAMES.map(name => ({
    id: uid(),
    nombre: name,
    modo: 'kg',         // default
    kgCaja: 0,          // si aplica
    pKg: 0,
    pCaja: 0,
    pUd: 0,
    coste: 0,
    origen: '',
    taraId: '',         // envase por defecto
    hist: []            // últimas 5 {fecha, modo, precio}
  }));
}

/* ===========================
   STATE
=========================== */
const State = {
  provider: load(K.provider, null),
  settings: load(K.settings, null),
  clientes: load(K.clientes, null),
  productos: load(K.productos, null),
  taras: load(K.taras, null),
  facturas: load(K.facturas, []),
  ventas: load(K.ventas, []),

  // locks (PIN)
  session: load(K.session, { contUnlocked:false, ventasUnlocked:false }),

  // UI selections
  currentInvoiceId: null,
  currentClienteId: null,
  currentProductoId: null,
  currentTaraId: null,

  // cloud runtime
  cloud: {
    enabled:false,
    user:null,
    app:null,
    db:null,
    storage:null,
  }
};

function ensureBase(){
  if(!State.provider) State.provider = providerDefaults();
  if(!State.settings) State.settings = settingsDefaults();
  if(!Array.isArray(State.clientes) || State.clientes.length===0) State.clientes = initialClientes();
  if(!Array.isArray(State.taras) || State.taras.length===0) State.taras = initialTaras();
  if(!Array.isArray(State.productos) || State.productos.length===0) State.productos = initialProductos();

  save(K.provider, State.provider);
  save(K.settings, State.settings);
  save(K.clientes, State.clientes);
  save(K.taras, State.taras);
  save(K.productos, State.productos);
  save(K.facturas, State.facturas);
  save(K.ventas, State.ventas);
  save(K.session, State.session);
}

/* ===========================
   INVOICE MODEL
=========================== */
function newInvoice(){
  const id = uid();
  const numero = nowFacturaId();
  const fecha = todayISO();
  const inv = {
    id,
    numero,
    fecha,
    tags: '',
    notas: '',
    obs: '',
    clienteId: '',
    clienteSnapshot: null, // copia editable en factura
    ivaIncluido: false,
    transporteOn: false,

    pagoMetodo: 'Efectivo',
    estado: 'Impagada',
    pagos: [], // {id, fecha, importe}

    lines: [], // ver createDefaultLine()
    pdfUrl: '', // cloud url si existe
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 5 líneas por defecto
  for(let i=0;i<5;i++) inv.lines.push(createDefaultLine());
  return inv;
}

function createDefaultLine(){
  return {
    id: uid(),
    producto: '',     // texto libre + autocomplete manual
    productoId: '',   // si coincide con vocabulario
    modo: 'kg',       // kg/caja/ud
    cantidad: 0,      // para caja/ud
    bruto: 0,         // kg (si modo kg)
    tara: 0,          // kg (manual o auto)
    neto: 0,          // kg
    netoManual: false,
    taraManual: false,

    taraId: '',       // envase seleccionado
    envases: 0,       // nº envases

    precio: 0,        // depende modo
    origen: '',
    importe: 0,       // calculado

    // hints solo UI
    _hint: ''         // últimos precios/historial
  };
}

function getInvoice(id){
  return State.facturas.find(f => f.id === id) || null;
}

function setCurrentInvoice(id){
  State.currentInvoiceId = id;
}

/* ===========================
   DOM CACHE (se asigna en init)
=========================== */
const UI = {};

/* ===========================
   INIT (base + eventos tabs + rellenar selects base)
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  ensureBase();
  cacheUI();
  initTabs();
  initTopButtons();
  initModalsBase();
  renderAllBase();

  // si no hay facturas, crear primera
  if(!State.facturas.length){
    const inv = newInvoice();
    State.facturas.unshift(inv);
    save(K.facturas, State.facturas);
  }
  setCurrentInvoice(State.facturas[0].id);

  // Preparar pantalla
  openInvoice(State.currentInvoiceId);
  refreshLists();
  refreshLocksUI();

  // defaults provider en inputs si vacío
  setProviderInputs(State.provider);

  // Ajustes en inputs
  setSettingsInputs(State.settings);

  // Inicializar fecha pago por defecto
  if(UI.pagoFecha) UI.pagoFecha.value = todayISO();
  if(UI.venFecha) UI.venFecha.value = todayISO();

  // refrescar QR inicial
  updateQrFromInvoice();

  // atajos teclado (Ctrl+S / Ctrl+P / Ctrl+F)
  bindKeyboardShortcuts();
});

/* ===========================
   CACHE UI
=========================== */
function cacheUI(){
  UI.tabs = $$('.tab');
  UI.panels = $$('.panel');

  // Provider
  UI.provNombre = $('#provNombre');
  UI.provNif = $('#provNif');
  UI.provDir = $('#provDir');
  UI.provTel = $('#provTel');
  UI.provEmail = $('#provEmail');
  UI.btnSaveProvider = $('#btnSaveProvider');

  // Cliente factura
  UI.facClienteSelect = $('#facClienteSelect');
  UI.cliNombre = $('#cliNombre');
  UI.cliNif = $('#cliNif');
  UI.cliDir = $('#cliDir');
  UI.cliTel = $('#cliTel');
  UI.cliEmail = $('#cliEmail');
  UI.cliNotas = $('#cliNotas');
  UI.cliIvaIncluido = $('#cliIvaIncluido');
  UI.cliTransportePorDefecto = $('#cliTransportePorDefecto');
  UI.btnNewClientInline = $('#btnNewClientInline');
  UI.btnSaveClientInline = $('#btnSaveClientInline');

  // Meta factura
  UI.facNumero = $('#facNumero');
  UI.facFecha = $('#facFecha');
  UI.facTags = $('#facTags');
  UI.facNotas = $('#facNotas');
  UI.facObs = $('#facObs');

  // Acciones factura
  UI.btnNewInvoiceTop = $('#btnNewInvoiceTop');
  UI.btnNewInvoice = $('#btnNewInvoice');
  UI.btnDuplicateInvoice = $('#btnDuplicateInvoice');
  UI.btnDeleteInvoice = $('#btnDeleteInvoice');
  UI.btnSaveInvoice = $('#btnSaveInvoice');
  UI.btnMakePdf = $('#btnMakePdf');
  UI.btnViewPdf = $('#btnViewPdf');
  UI.btnPdfCloud = $('#btnPdfCloud');
  UI.btnWhatsApp = $('#btnWhatsApp');

  // Lines
  UI.linesWrap = $('#linesWrap');
  UI.btnAddLine = $('#btnAddLine');
  UI.btnClearLines = $('#btnClearLines');

  // Totals / iva / transporte
  UI.tSubtotal = $('#tSubtotal');
  UI.chkTransporte = $('#chkTransporte');
  UI.tTransportePct = $('#tTransportePct');
  UI.tTransporte = $('#tTransporte');
  UI.rowIva = $('#rowIva');
  UI.tIva = $('#tIva');
  UI.tTotal = $('#tTotal');
  UI.tPendiente = $('#tPendiente');
  UI.ivaHint = $('#ivaHint');
  UI.btnAddIva4 = $('#btnAddIva4');

  // Pagos
  UI.facPagoMetodo = $('#facPagoMetodo');
  UI.facEstado = $('#facEstado');
  UI.pagoImporte = $('#pagoImporte');
  UI.pagoFecha = $('#pagoFecha');
  UI.btnAddPago = $('#btnAddPago');
  UI.pagosList = $('#pagosList');

  // QR
  UI.qrCanvas = $('#qrCanvas');
  UI.qrSmallText = $('#qrSmallText');
  UI.btnCopyQrText = $('#btnCopyQrText');
  UI.btnRefreshQr = $('#btnRefreshQr');

  // Facturas list
  UI.invSearch = $('#invSearch');
  UI.invList = $('#invList');
  UI.btnInvExportCsv = $('#btnInvExportCsv');

  // Clientes tab
  UI.cliSearch = $('#cliSearch');
  UI.cliList = $('#cliList');
  UI.btnCliNew = $('#btnCliNew');
  UI.btnCliSave = $('#btnCliSave');
  UI.btnCliDelete = $('#btnCliDelete');

  UI.cliE_nombre = $('#cliE_nombre');
  UI.cliE_alias = $('#cliE_alias');
  UI.cliE_nif = $('#cliE_nif');
  UI.cliE_dir = $('#cliE_dir');
  UI.cliE_tel = $('#cliE_tel');
  UI.cliE_email = $('#cliE_email');
  UI.cliE_tags = $('#cliE_tags');
  UI.cliE_pago = $('#cliE_pago');
  UI.cliE_ivaIncl = $('#cliE_ivaIncl');
  UI.cliE_transp = $('#cliE_transp');
  UI.cliE_notas = $('#cliE_notas');

  // Productos tab
  UI.prdSearch = $('#prdSearch');
  UI.prdList = $('#prdList');
  UI.btnPrdNew = $('#btnPrdNew');
  UI.btnPrdSave = $('#btnPrdSave');
  UI.btnPrdDelete = $('#btnPrdDelete');

  UI.prdE_nombre = $('#prdE_nombre');
  UI.prdE_modo = $('#prdE_modo');
  UI.prdE_kgcaja = $('#prdE_kgcaja');
  UI.prdE_pkg = $('#prdE_pkg');
  UI.prdE_pcaja = $('#prdE_pcaja');
  UI.prdE_pud = $('#prdE_pud');
  UI.prdE_coste = $('#prdE_coste');
  UI.prdE_origen = $('#prdE_origen');
  UI.prdE_tara = $('#prdE_tara');
  UI.prdHist = $('#prdHist');

  // Taras tab
  UI.taraSearch = $('#taraSearch');
  UI.taraList = $('#taraList');
  UI.btnTaraNew = $('#btnTaraNew');
  UI.btnTaraSave = $('#btnTaraSave');
  UI.btnTaraDelete = $('#btnTaraDelete');

  UI.taraE_nombre = $('#taraE_nombre');
  UI.taraE_peso = $('#taraE_peso');
  UI.taraE_notas = $('#taraE_notas');

  // Contabilidad
  UI.btnUnlockCont = $('#btnUnlockCont');
  UI.btnLockCont = $('#btnLockCont');
  UI.contLockedBox = $('#contLockedBox');
  UI.contContent = $('#contContent');
  UI.contDesde = $('#contDesde');
  UI.contHasta = $('#contHasta');
  UI.contCliente = $('#contCliente');
  UI.contTag = $('#contTag');
  UI.btnContApply = $('#btnContApply');
  UI.kpiVentas = $('#kpiVentas');
  UI.kpiIva = $('#kpiIva');
  UI.kpiCount = $('#kpiCount');
  UI.kpiMargen = $('#kpiMargen');
  UI.contTable = $('#contTable');
  UI.btnContExportCsv = $('#btnContExportCsv');

  // Ajustes
  UI.setPinCont = $('#setPinCont');
  UI.setIvaPct = $('#setIvaPct');
  UI.setTranspPct = $('#setTranspPct');
  UI.setQrBase = $('#setQrBase');
  UI.btnSaveSettings = $('#btnSaveSettings');
  UI.btnResetLocal = $('#btnResetLocal');

  UI.fb_apiKey = $('#fb_apiKey');
  UI.fb_authDomain = $('#fb_authDomain');
  UI.fb_databaseURL = $('#fb_databaseURL');
  UI.fb_projectId = $('#fb_projectId');
  UI.fb_storageBucket = $('#fb_storageBucket');
  UI.fb_appId = $('#fb_appId');

  UI.btnCloudInit = $('#btnCloudInit');
  UI.btnCloudLogin = $('#btnCloudLogin');
  UI.btnCloudLogout = $('#btnCloudLogout');
  UI.btnCloudSync = $('#btnCloudSync');
  UI.btnCloudStatus = $('#btnCloudStatus');
  UI.cloudBadge = $('#cloudBadge');

  // Ventas
  UI.btnUnlockVentas = $('#btnUnlockVentas');
  UI.btnLockVentas = $('#btnLockVentas');
  UI.ventasLockedBox = $('#ventasLockedBox');
  UI.ventasContent = $('#ventasContent');
  UI.venFecha = $('#venFecha');
  UI.venTienda = $('#venTienda');
  UI.venEfectivo = $('#venEfectivo');
  UI.venTarjeta = $('#venTarjeta');
  UI.venGastos = $('#venGastos');
  UI.btnVenSave = $('#btnVenSave');
  UI.venDiaSemana = $('#venDiaSemana');
  UI.venTotal = $('#venTotal');
  UI.venNeto = $('#venNeto');
  UI.venSearch = $('#venSearch');
  UI.btnVenClear = $('#btnVenClear');
  UI.ventasList = $('#ventasList');
  UI.btnVentasExportCsv = $('#btnVentasExportCsv');

  // Modals
  UI.pinModal = $('#pinModal');
  UI.pinTitle = $('#pinTitle');
  UI.pinText = $('#pinText');
  UI.pinInput = $('#pinInput');
  UI.pinOk = $('#pinOk');
  UI.pinCancel = $('#pinCancel');
  UI.pinClose = $('#pinClose');
  UI.pinError = $('#pinError');

  UI.pdfModal = $('#pdfModal');
  UI.pdfFrame = $('#pdfFrame');
  UI.pdfClose = $('#pdfClose');
  UI.pdfPrint = $('#pdfPrint');
  UI.pdfOpenTab = $('#pdfOpenTab');

  UI.searchModal = $('#searchModal');
  UI.btnQuickSearch = $('#btnQuickSearch');
  UI.searchClose = $('#searchClose');
  UI.globalSearch = $('#globalSearch');
  UI.globalResults = $('#globalResults');
}

/* ===========================
   BASE RENDER (selects)
=========================== */
function renderAllBase(){
  renderClientesSelectFactura();
  renderSelectTarasEnProductos();
  renderSelectClientesCont();
}

function renderClientesSelectFactura(){
  if(!UI.facClienteSelect) return;
  UI.facClienteSelect.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '— Selecciona cliente —';
  UI.facClienteSelect.appendChild(opt0);

  State.clientes
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .forEach(c=>{
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nombre;
      UI.facClienteSelect.appendChild(o);
    });
}

function renderSelectTarasEnProductos(){
  if(!UI.prdE_tara) return;
  UI.prdE_tara.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = '— Sin envase —';
  UI.prdE_tara.appendChild(o0);

  State.taras
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .forEach(t=>{
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.nombre} (${num(t.peso).toFixed(3)} kg)`;
      UI.prdE_tara.appendChild(o);
    });
}

function renderSelectClientesCont(){
  if(!UI.contCliente) return;
  UI.contCliente.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = '— Todos —';
  UI.contCliente.appendChild(o0);

  State.clientes
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .forEach(c=>{
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nombre;
      UI.contCliente.appendChild(o);
    });
}

/* ===========================
   TABS
=========================== */
function initTabs(){
  UI.tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.tab;
      openTab(id);
    });
  });
}

function openTab(id){
  UI.tabs.forEach(t=> t.classList.toggle('active', t.dataset.tab===id));
  UI.panels.forEach(p=> p.classList.toggle('active', p.id===id));

  // refrescos específicos
  if(id === 'tabFacturas') refreshInvoiceList();
  if(id === 'tabClientes') refreshClientesTab();
  if(id === 'tabProductos') refreshProductosTab();
  if(id === 'tabTaras') refreshTarasTab();
  if(id === 'tabContabilidad') refreshLocksUI();
  if(id === 'tabVentas') refreshLocksUI();
}

/* ===========================
   TOP / MODALS BASE / SETTINGS INPUTS
=========================== */
function initTopButtons(){
  if(UI.btnNewInvoiceTop) UI.btnNewInvoiceTop.addEventListener('click', ()=> onNewInvoice());
  if(UI.btnQuickSearch) UI.btnQuickSearch.addEventListener('click', ()=> openSearchModal());
  if(UI.btnCloudStatus) UI.btnCloudStatus.addEventListener('click', ()=> openTab('tabAjustes'));
}

function initModalsBase(){
  // PIN modal events
  if(UI.pinClose) UI.pinClose.addEventListener('click', closePinModal);
  if(UI.pinCancel) UI.pinCancel.addEventListener('click', closePinModal);
  if(UI.pinOk) UI.pinOk.addEventListener('click', ()=> pinModalResolve(true));
  if(UI.pinInput){
    UI.pinInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') pinModalResolve(true);
      if(e.key === 'Escape') closePinModal();
    });
  }

  // PDF modal
  if(UI.pdfClose) UI.pdfClose.addEventListener('click', closePdfModal);
  if(UI.pdfPrint) UI.pdfPrint.addEventListener('click', ()=> {
    if(UI.pdfFrame?.contentWindow) UI.pdfFrame.contentWindow.print();
  });
  if(UI.pdfOpenTab) UI.pdfOpenTab.addEventListener('click', ()=> {
    const src = UI.pdfFrame?.getAttribute('src') || '';
    if(src) window.open(src, '_blank');
  });

  // Search modal
  if(UI.searchClose) UI.searchClose.addEventListener('click', closeSearchModal);
  if(UI.globalSearch){
    UI.globalSearch.addEventListener('input', ()=> renderGlobalSearch(UI.globalSearch.value));
    UI.globalSearch.addEventListener('keydown', (e)=>{
      if(e.key==='Escape') closeSearchModal();
    });
  }
}

function setProviderInputs(p){
  if(!p) return;
  if(UI.provNombre) UI.provNombre.value = p.nombre || '';
  if(UI.provNif) UI.provNif.value = p.nif || '';
  if(UI.provDir) UI.provDir.value = p.dir || '';
  if(UI.provTel) UI.provTel.value = p.tel || '';
  if(UI.provEmail) UI.provEmail.value = p.email || '';
}

function setSettingsInputs(s){
  if(!s) return;
  if(UI.setPinCont) UI.setPinCont.value = s.pinCont || '';
  if(UI.setIvaPct) UI.setIvaPct.value = num(s.ivaPct||4);
  if(UI.setTranspPct) UI.setTranspPct.value = num(s.transpPct||10);
  if(UI.setQrBase) UI.setQrBase.value = s.qrBase || '';

  if(UI.fb_apiKey) UI.fb_apiKey.value = s.fb?.apiKey || '';
  if(UI.fb_authDomain) UI.fb_authDomain.value = s.fb?.authDomain || '';
  if(UI.fb_databaseURL) UI.fb_databaseURL.value = s.fb?.databaseURL || '';
  if(UI.fb_projectId) UI.fb_projectId.value = s.fb?.projectId || '';
  if(UI.fb_storageBucket) UI.fb_storageBucket.value = s.fb?.storageBucket || '';
  if(UI.fb_appId) UI.fb_appId.value = s.fb?.appId || '';

  if(UI.tTransportePct) UI.tTransportePct.textContent = `${num(s.transpPct||10).toFixed(0)}%`;
}

/* ===========================
   PLACEHOLDERS (se completan en 3B/3C)
   - openInvoice()
   - refreshLists()
   - refreshInvoiceList()
   - refreshClientesTab()
   - refreshProductosTab()
   - refreshTarasTab()
   - updateQrFromInvoice()
   - bindKeyboardShortcuts()
   - renderGlobalSearch()
   - onNewInvoice()
   - pin modal helpers
   - locks UI (contabilidad/ventas)
=========================== */

/* ===== PIN MODAL CORE ===== */
let _pinResolve = null;
function openPinModal({title='PIN', text='Introduce el PIN', clear=true}={}){
  if(!UI.pinModal) return Promise.resolve(null);
  UI.pinTitle.textContent = title;
  UI.pinText.textContent = text;
  UI.pinError.classList.add('hidden');
  if(clear) UI.pinInput.value = '';
  UI.pinModal.classList.remove('hidden');
  setTimeout(()=> UI.pinInput?.focus(), 30);

  return new Promise(resolve => {
    _pinResolve = resolve;
  });
}
function closePinModal(){
  if(UI.pinModal) UI.pinModal.classList.add('hidden');
  if(_pinResolve){ _pinResolve(null); _pinResolve=null; }
}
function pinModalResolve(ok){
  if(!_pinResolve) return;
  if(!ok){ closePinModal(); return; }
  const v = (UI.pinInput?.value || '').trim();
  _pinResolve(v);
  _pinResolve = null;
  UI.pinModal.classList.add('hidden');
}

/* ===== PDF MODAL CORE ===== */
function openPdfModal(blobUrl){
  if(!UI.pdfModal || !UI.pdfFrame) return;
  UI.pdfFrame.setAttribute('src', blobUrl);
  UI.pdfModal.classList.remove('hidden');
}
function closePdfModal(){
  if(!UI.pdfModal || !UI.pdfFrame) return;
  UI.pdfModal.classList.add('hidden');
  // limpiar src para liberar
  const src = UI.pdfFrame.getAttribute('src');
  UI.pdfFrame.setAttribute('src','');
  if(src && src.startsWith('blob:')){
    try{ URL.revokeObjectURL(src); }catch{}
  }
}

/* ===== SEARCH MODAL ===== */
function openSearchModal(){
  if(!UI.searchModal) return;
  UI.searchModal.classList.remove('hidden');
  if(UI.globalSearch){
    UI.globalSearch.value = '';
    renderGlobalSearch('');
    setTimeout(()=> UI.globalSearch.focus(), 20);
  }
}
function closeSearchModal(){
  if(!UI.searchModal) return;
  UI.searchModal.classList.add('hidden');
}

/* ===== LOCKS UI (contabilidad / ventas) ===== */
function refreshLocksUI(){
  // Contabilidad
  if(UI.contLockedBox && UI.contContent){
    const unlocked = !!State.session?.contUnlocked;
    UI.contLockedBox.classList.toggle('hidden', unlocked);
    UI.contContent.classList.toggle('hidden', !unlocked);
  }
  // Ventas
  if(UI.ventasLockedBox && UI.ventasContent){
    const unlocked = !!State.session?.ventasUnlocked;
    UI.ventasLockedBox.classList.toggle('hidden', unlocked);
    UI.ventasContent.classList.toggle('hidden', !unlocked);
  }
  save(K.session, State.session);
}

/* ===== CLOUD BADGE ===== */
function setCloudBadge(txt){
  if(!UI.cloudBadge) return;
  UI.cloudBadge.textContent = txt;
}

/* =========================================================
   (Fin Parte 3A) — Continua en 3B
   ========================================================= */
/* =========================================================
   FACTU MIRAL — B/W PRO
   app.js (PARTE 3B/3) — Factura UI + Grid PRO + Autocomplete + Taras + Cálculos
   ========================================================= */

/* ===========================
   INVOICE OPEN / RENDER
=========================== */
function openInvoice(invoiceId){
  const inv = getInvoice(invoiceId);
  if(!inv){
    toast('Factura no encontrada');
    return;
  }
  setCurrentInvoice(inv.id);

  // número / fecha / tags / notas / obs
  if(UI.facNumero) UI.facNumero.textContent = inv.numero || 'FA-—';
  if(UI.facFecha) UI.facFecha.value = inv.fecha || todayISO();
  if(UI.facTags) UI.facTags.value = inv.tags || '';
  if(UI.facNotas) UI.facNotas.value = inv.notas || '';
  if(UI.facObs) UI.facObs.value = inv.obs || '';

  // cliente snapshot (si no existe, copiar del cliente base)
  if(!inv.clienteSnapshot && inv.clienteId){
    const c = State.clientes.find(x=>x.id===inv.clienteId);
    if(c) inv.clienteSnapshot = snapshotCliente(c);
  }

  // select cliente
  if(UI.facClienteSelect){
    UI.facClienteSelect.value = inv.clienteId || '';
  }

  // pintar inputs cliente (desde snapshot o desde base seleccionado)
  applyClienteToFacturaUI(inv);

  // transporte / iva incluido
  if(UI.chkTransporte) UI.chkTransporte.checked = !!inv.transporteOn;
  // ivaIncluido viene de snapshot cliente o de inv
  setFacturaIvaIncluidoUI(inv);

  // pago/estado
  if(UI.facPagoMetodo) UI.facPagoMetodo.value = inv.pagoMetodo || 'Efectivo';
  if(UI.facEstado) UI.facEstado.value = inv.estado || 'Impagada';

  // líneas
  renderLines(inv);

  // pagos
  renderPagos(inv);

  // totales
  recalcInvoice(inv);

  // QR
  updateQrFromInvoice();
}

function snapshotCliente(c){
  return {
    nombre: c.nombre || '',
    alias: c.alias || '',
    nif: c.nif || '',
    dir: c.dir || '',
    tel: c.tel || '',
    email: c.email || '',
    notas: c.notas || '',
    pago: c.pago || '',
    tags: c.tags || '',
    ivaIncluido: !!c.ivaIncluido,
    transp: !!c.transp
  };
}

function applyClienteToFacturaUI(inv){
  // fuente: snapshot si existe, si no, cliente base seleccionado
  let src = inv.clienteSnapshot;
  if(!src && inv.clienteId){
    const c = State.clientes.find(x=>x.id===inv.clienteId);
    if(c) src = snapshotCliente(c);
  }
  src = src || {nombre:'',nif:'',dir:'',tel:'',email:'',notas:'',ivaIncluido:false,transp:false};

  if(UI.cliNombre) UI.cliNombre.value = src.nombre || '';
  if(UI.cliNif) UI.cliNif.value = src.nif || '';
  if(UI.cliDir) UI.cliDir.value = src.dir || '';
  if(UI.cliTel) UI.cliTel.value = src.tel || '';
  if(UI.cliEmail) UI.cliEmail.value = src.email || '';
  if(UI.cliNotas) UI.cliNotas.value = src.notas || '';

  if(UI.cliIvaIncluido) UI.cliIvaIncluido.checked = !!src.ivaIncluido;
  if(UI.cliTransportePorDefecto) UI.cliTransportePorDefecto.checked = !!src.transp;
}

function setFacturaIvaIncluidoUI(inv){
  // IVA incluido se define por checkbox cliente (en factura), guardado en inv.ivaIncluido
  if(UI.cliIvaIncluido){
    inv.ivaIncluido = !!UI.cliIvaIncluido.checked;
  }
  if(UI.rowIva) UI.rowIva.classList.toggle('hidden', !!inv.ivaIncluido);
  if(UI.ivaHint){
    UI.ivaHint.textContent = inv.ivaIncluido
      ? 'Modo IVA: IVA incluido (sin desglose en PDF).'
      : 'Modo IVA: desglosado (IVA separado en PDF y contabilidad interna).';
  }
}

/* ===========================
   FACTURA EVENTS
=========================== */
function refreshLists(){
  // se usa al final de init (3A)
  bindFacturaEvents();
  bindClientesTabEvents();
  bindProductosTabEvents();
  bindTarasTabEvents();
  bindFacturasListEvents();
  bindContabilidadEvents();
  bindAjustesEvents();
  bindVentasEvents();
  refreshInvoiceList();
  refreshClientesTab();
  refreshProductosTab();
  refreshTarasTab();
  refreshVentasList();
}

function bindFacturaEvents(){
  if(UI.btnSaveProvider){
    UI.btnSaveProvider.addEventListener('click', ()=>{
      State.provider = {
        nombre: (UI.provNombre?.value||'').trim(),
        nif: (UI.provNif?.value||'').trim(),
        dir: (UI.provDir?.value||'').trim(),
        tel: (UI.provTel?.value||'').trim(),
        email: (UI.provEmail?.value||'').trim(),
      };
      save(K.provider, State.provider);
      toast('Proveedor guardado');
      updateQrFromInvoice();
    });
  }

  if(UI.facClienteSelect){
    UI.facClienteSelect.addEventListener('change', ()=>{
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      inv.clienteId = UI.facClienteSelect.value || '';
      inv.clienteSnapshot = null; // regenerar
      if(inv.clienteId){
        const c = State.clientes.find(x=>x.id===inv.clienteId);
        if(c) inv.clienteSnapshot = snapshotCliente(c);
      }
      applyClienteToFacturaUI(inv);

      // aplicar defaults de cliente
      if(inv.clienteSnapshot){
        if(UI.cliIvaIncluido) UI.cliIvaIncluido.checked = !!inv.clienteSnapshot.ivaIncluido;
        if(UI.cliTransportePorDefecto) UI.cliTransportePorDefecto.checked = !!inv.clienteSnapshot.transp;
        inv.transporteOn = !!inv.clienteSnapshot.transp;
        if(UI.chkTransporte) UI.chkTransporte.checked = inv.transporteOn;
      }

      setFacturaIvaIncluidoUI(inv);
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      recalcInvoice(inv);
      updateQrFromInvoice();
    });
  }

  // edición inline cliente (snapshot)
  const onClienteEdit = ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;

    if(!inv.clienteSnapshot) inv.clienteSnapshot = snapshotCliente({});

    inv.clienteSnapshot.nombre = UI.cliNombre?.value || '';
    inv.clienteSnapshot.nif = UI.cliNif?.value || '';
    inv.clienteSnapshot.dir = UI.cliDir?.value || '';
    inv.clienteSnapshot.tel = UI.cliTel?.value || '';
    inv.clienteSnapshot.email = UI.cliEmail?.value || '';
    inv.clienteSnapshot.notas = UI.cliNotas?.value || '';
    inv.clienteSnapshot.ivaIncluido = !!UI.cliIvaIncluido?.checked;
    inv.clienteSnapshot.transp = !!UI.cliTransportePorDefecto?.checked;

    inv.ivaIncluido = !!UI.cliIvaIncluido?.checked;
    inv.updatedAt = Date.now();
    setFacturaIvaIncluidoUI(inv);
    updateQrFromInvoice();
    save(K.facturas, State.facturas);
  };

  [UI.cliNombre, UI.cliNif, UI.cliDir, UI.cliTel, UI.cliEmail, UI.cliNotas].forEach(el=>{
    if(el) el.addEventListener('input', onClienteEdit);
  });
  if(UI.cliIvaIncluido) UI.cliIvaIncluido.addEventListener('change', ()=>{
    onClienteEdit();
    const inv = getInvoice(State.currentInvoiceId);
    if(inv) recalcInvoice(inv);
  });
  if(UI.cliTransportePorDefecto) UI.cliTransportePorDefecto.addEventListener('change', onClienteEdit);

  // nuevo cliente (inline)
  if(UI.btnNewClientInline){
    UI.btnNewClientInline.addEventListener('click', ()=>{
      UI.facClienteSelect.value = '';
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      inv.clienteId = '';
      inv.clienteSnapshot = snapshotCliente({nombre:'', nif:'', dir:'', tel:'', email:'', notas:''});
      applyClienteToFacturaUI(inv);
      toast('Nuevo cliente (en factura)');
    });
  }

  // guardar cliente (inline) -> crea o actualiza cliente base
  if(UI.btnSaveClientInline){
    UI.btnSaveClientInline.addEventListener('click', ()=>{
      const name = (UI.cliNombre?.value||'').trim();
      if(!name){
        toast('Falta nombre cliente');
        UI.cliNombre?.classList.add('isMissing');
        setTimeout(()=>UI.cliNombre?.classList.remove('isMissing'), 900);
        return;
      }
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;

      const data = {
        nombre: name,
        nif: (UI.cliNif?.value||'').trim(),
        dir: (UI.cliDir?.value||'').trim(),
        tel: (UI.cliTel?.value||'').trim(),
        email: (UI.cliEmail?.value||'').trim(),
        notas: (UI.cliNotas?.value||'').trim(),
        ivaIncluido: !!UI.cliIvaIncluido?.checked,
        transp: !!UI.cliTransportePorDefecto?.checked,
      };

      let c = null;
      if(inv.clienteId){
        c = State.clientes.find(x=>x.id===inv.clienteId);
      }
      if(c){
        Object.assign(c, data);
        toast('Cliente actualizado');
      }else{
        c = {id:uid(), alias:'', pago:'', tags:'', ...data};
        State.clientes.push(c);
        inv.clienteId = c.id;
        toast('Cliente guardado');
      }
      inv.clienteSnapshot = snapshotCliente(c);

      save(K.clientes, State.clientes);
      save(K.facturas, State.facturas);
      renderClientesSelectFactura();
      renderSelectClientesCont();
      UI.facClienteSelect.value = inv.clienteId || '';
      refreshClientesTab();
    });
  }

  // metadatos factura
  if(UI.facFecha) UI.facFecha.addEventListener('change', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.fecha = UI.facFecha.value || todayISO();
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
    recalcInvoice(inv);
    updateQrFromInvoice();
  });
  if(UI.facTags) UI.facTags.addEventListener('input', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.tags = UI.facTags.value || '';
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });
  if(UI.facNotas) UI.facNotas.addEventListener('input', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.notas = UI.facNotas.value || '';
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });
  if(UI.facObs) UI.facObs.addEventListener('input', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.obs = UI.facObs.value || '';
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });

  // transporte
  if(UI.chkTransporte){
    UI.chkTransporte.addEventListener('change', ()=>{
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      inv.transporteOn = !!UI.chkTransporte.checked;
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      recalcInvoice(inv);
      updateQrFromInvoice();
    });
  }

  // pagos / estado / método
  if(UI.facPagoMetodo) UI.facPagoMetodo.addEventListener('change', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.pagoMetodo = UI.facPagoMetodo.value || 'Efectivo';
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });
  if(UI.facEstado) UI.facEstado.addEventListener('change', ()=>{
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.estado = UI.facEstado.value || 'Impagada';
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });

  if(UI.btnAddPago){
    UI.btnAddPago.addEventListener('click', ()=>{
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      const imp = num(UI.pagoImporte?.value);
      const f = UI.pagoFecha?.value || todayISO();
      if(imp<=0){
        toast('Importe pago inválido');
        UI.pagoImporte?.classList.add('isMissing');
        setTimeout(()=>UI.pagoImporte?.classList.remove('isMissing'), 900);
        return;
      }
      inv.pagos.push({id:uid(), fecha:f, importe: imp});
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      UI.pagoImporte.value = '';
      renderPagos(inv);
      recalcInvoice(inv);
      toast('Pago añadido');
    });
  }

  // acciones
  if(UI.btnNewInvoice) UI.btnNewInvoice.addEventListener('click', ()=> onNewInvoice());
  if(UI.btnDuplicateInvoice) UI.btnDuplicateInvoice.addEventListener('click', ()=> onDuplicateInvoice());
  if(UI.btnDeleteInvoice) UI.btnDeleteInvoice.addEventListener('click', ()=> onDeleteInvoice());
  if(UI.btnSaveInvoice) UI.btnSaveInvoice.addEventListener('click', ()=> onSaveInvoice());
  if(UI.btnMakePdf) UI.btnMakePdf.addEventListener('click', ()=> onMakePdf(false));
  if(UI.btnViewPdf) UI.btnViewPdf.addEventListener('click', ()=> onViewPdf());
  if(UI.btnPdfCloud) UI.btnPdfCloud.addEventListener('click', ()=> onMakePdf(true));
  if(UI.btnWhatsApp) UI.btnWhatsApp.addEventListener('click', ()=> onWhatsApp());

  // QR
  if(UI.btnCopyQrText) UI.btnCopyQrText.addEventListener('click', ()=> copyQrText());
  if(UI.btnRefreshQr) UI.btnRefreshQr.addEventListener('click', ()=> updateQrFromInvoice());

  // lines buttons
  if(UI.btnAddLine){
    UI.btnAddLine.addEventListener('click', ()=>{
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      inv.lines.push(createDefaultLine());
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      renderLines(inv);
      recalcInvoice(inv);
    });
  }
  if(UI.btnClearLines){
    UI.btnClearLines.addEventListener('click', ()=>{
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      inv.lines = [];
      for(let i=0;i<5;i++) inv.lines.push(createDefaultLine());
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      renderLines(inv);
      recalcInvoice(inv);
      toast('Líneas reiniciadas');
    });
  }

  if(UI.btnAddIva4){
    UI.btnAddIva4.addEventListener('click', ()=>{
      // según tu lista: botón "Añadir 4% IVA al total"
      // aquí: si IVA incluido, no aplica
      const inv = getInvoice(State.currentInvoiceId);
      if(!inv) return;
      if(inv.ivaIncluido){
        toast('IVA incluido activo: no se añade');
        return;
      }
      // si el usuario quiere “meter” el IVA dentro del total, podemos subir precios globalmente NO.
      // aquí solo recalcula (ya incluye IVA separado). Por utilidad: forzar ivaPct=4 (si distinto)
      State.settings.ivaPct = 4;
      if(UI.setIvaPct) UI.setIvaPct.value = 4;
      save(K.settings, State.settings);
      recalcInvoice(inv);
      toast('IVA configurado a 4%');
    });
  }
}

/* ===========================
   INVOICE ACTIONS
=========================== */
function onNewInvoice(){
  const inv = newInvoice();
  State.facturas.unshift(inv);
  save(K.facturas, State.facturas);
  setCurrentInvoice(inv.id);
  openInvoice(inv.id);
  refreshInvoiceList();
  toast('Nueva factura');
}

function onDuplicateInvoice(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;
  const copy = JSON.parse(JSON.stringify(inv));
  copy.id = uid();
  copy.numero = nowFacturaId();
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.pdfUrl = '';
  copy.lines.forEach(l=> l.id = uid());
  copy.pagos.forEach(p=> p.id = uid());
  State.facturas.unshift(copy);
  save(K.facturas, State.facturas);
  setCurrentInvoice(copy.id);
  openInvoice(copy.id);
  refreshInvoiceList();
  toast('Factura duplicada');
}

function onDeleteInvoice(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;
  if(!confirmBW(`¿Eliminar factura ${inv.numero}?`)) return;
  State.facturas = State.facturas.filter(f=> f.id !== inv.id);
  save(K.facturas, State.facturas);

  if(!State.facturas.length){
    const n = newInvoice();
    State.facturas.unshift(n);
    save(K.facturas, State.facturas);
  }
  setCurrentInvoice(State.facturas[0].id);
  openInvoice(State.currentInvoiceId);
  refreshInvoiceList();
  toast('Factura eliminada');
}

function onSaveInvoice(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;

  // validación básica
  const problems = validateInvoice(inv);
  if(problems.length){
    toast('Faltan campos: ' + problems[0]);
    return;
  }

  // guardar metadatos desde UI (por si acaso)
  inv.fecha = UI.facFecha?.value || inv.fecha || todayISO();
  inv.tags = UI.facTags?.value || inv.tags || '';
  inv.notas = UI.facNotas?.value || inv.notas || '';
  inv.obs = UI.facObs?.value || inv.obs || '';
  inv.pagoMetodo = UI.facPagoMetodo?.value || inv.pagoMetodo || 'Efectivo';
  inv.estado = UI.facEstado?.value || inv.estado || 'Impagada';
  inv.transporteOn = !!UI.chkTransporte?.checked;
  inv.ivaIncluido = !!UI.cliIvaIncluido?.checked;

  // actualizar snapshot cliente
  inv.clienteSnapshot = inv.clienteSnapshot || snapshotCliente({});
  inv.clienteSnapshot.nombre = UI.cliNombre?.value || '';
  inv.clienteSnapshot.nif = UI.cliNif?.value || '';
  inv.clienteSnapshot.dir = UI.cliDir?.value || '';
  inv.clienteSnapshot.tel = UI.cliTel?.value || '';
  inv.clienteSnapshot.email = UI.cliEmail?.value || '';
  inv.clienteSnapshot.notas = UI.cliNotas?.value || '';
  inv.clienteSnapshot.ivaIncluido = !!UI.cliIvaIncluido?.checked;
  inv.clienteSnapshot.transp = !!UI.cliTransportePorDefecto?.checked;

  inv.updatedAt = Date.now();

  // actualizar historial de precios por producto según líneas usadas
  updateProductsPriceHistoryFromInvoice(inv);

  save(K.facturas, State.facturas);
  save(K.productos, State.productos);
  refreshInvoiceList();
  refreshProductosTab();
  toast('Factura guardada');
  updateQrFromInvoice();
}

function validateInvoice(inv){
  const probs = [];

  // proveedor NIF
  const nifProv = (UI.provNif?.value || State.provider?.nif || '').trim();
  if(!nifProv) probs.push('NIF proveedor');

  // cliente nombre
  const cName = (UI.cliNombre?.value || inv.clienteSnapshot?.nombre || '').trim();
  if(!cName) probs.push('Cliente');

  // al menos 1 línea con producto y precio y cantidad/valor
  const hasAny = inv.lines.some(l => (l.producto||'').trim());
  if(!hasAny) probs.push('Al menos 1 línea');

  // precio vacío en líneas usadas
  inv.lines.forEach((l, idx)=>{
    if(!(l.producto||'').trim()) return;
    if(num(l.precio) <= 0) probs.push(`Precio (línea ${idx+1})`);
    // modo kg: neto o bruto
    if(l.modo === 'kg'){
      if(num(l.bruto) <= 0 && num(l.neto) <= 0) probs.push(`Bruto/Neto (línea ${idx+1})`);
    }else{
      if(num(l.cantidad) <= 0) probs.push(`Cantidad (línea ${idx+1})`);
    }
  });

  return probs;
}

/* ===========================
   LINES RENDER (GRID PRO)
=========================== */
function renderLines(inv){
  if(!UI.linesWrap) return;
  UI.linesWrap.innerHTML = '';

  inv.lines.forEach((line, idx)=>{
    const row = document.createElement('div');
    row.className = 'lineRow';
    row.dataset.lineId = line.id;

    // PRODUCTO + AUTOCOMPLETE (manual)
    row.appendChild(cellProducto(inv, line, idx));

    // MODO
    row.appendChild(cellModo(inv, line, idx));

    // CANTIDAD
    row.appendChild(cellCantidad(inv, line, idx));

    // BRUTO
    row.appendChild(cellBruto(inv, line, idx));

    // TARA (kg) + envase selector + envases
    row.appendChild(cellTara(inv, line, idx));

    // NETO (kg)
    row.appendChild(cellNeto(inv, line, idx));

    // PRECIO
    row.appendChild(cellPrecio(inv, line, idx));

    // ORIGEN
    row.appendChild(cellOrigen(inv, line, idx));

    // IMPORTE
    row.appendChild(cellImporte(inv, line, idx));

    // DELETE
    row.appendChild(cellDelete(inv, line, idx));

    UI.linesWrap.appendChild(row);
  });
}

function cellWrap(labelText, inputEl, extraEl){
  const cell = document.createElement('div');
  cell.className = 'cell';
  if(window.matchMedia && window.matchMedia('(max-width: 980px)').matches){
    // móvil: etiqueta visible arriba
    const lab = document.createElement('div');
    lab.className = 'muted';
    lab.style.fontSize = '12px';
    lab.style.marginBottom = '6px';
    lab.textContent = labelText;
    cell.appendChild(lab);
  }
  cell.appendChild(inputEl);
  if(extraEl) cell.appendChild(extraEl);
  return cell;
}

/* ===== Producto + AC manual ===== */
function cellProducto(inv, line, idx){
  const wrap = document.createElement('div');
  wrap.className = 'cell acWrap';

  if(window.matchMedia && window.matchMedia('(max-width: 980px)').matches){
    const lab = document.createElement('div');
    lab.className = 'muted';
    lab.style.fontSize = '12px';
    lab.style.marginBottom = '6px';
    lab.textContent = 'Producto';
    wrap.appendChild(lab);
  }

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Producto…';
  inp.value = line.producto || '';
  inp.autocomplete = 'off';

  const ac = document.createElement('div');
  ac.className = 'acList hidden';

  const hint = document.createElement('div');
  hint.className = 'subBox';
  hint.textContent = line._hint || 'Últimos precios: —';

  // Render suggestions
  let acIndex = -1;
  let acItems = [];

  const closeAC = ()=> {
    ac.classList.add('hidden');
    ac.innerHTML = '';
    acIndex = -1;
    acItems = [];
  };

  const openAC = (items)=>{
    ac.innerHTML = '';
    acItems = items;
    acIndex = -1;
    items.slice(0, 12).forEach((p, i)=>{
      const it = document.createElement('div');
      it.className = 'acItem';
      it.innerHTML = `<div>${escapeHtml(p.nombre)}</div>
        <div class="acSmall">${acSmallPrice(p)}</div>`;
      it.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        chooseProduct(p);
      });
      ac.appendChild(it);
    });
    ac.classList.remove('hidden');
  };

  const chooseProduct = (p)=>{
    // NO sustituye automático mientras escribes, solo al elegir
    line.producto = p.nombre;
    line.productoId = p.id;

    // aplicar defaults del producto
    line.modo = p.modo || line.modo || 'kg';
    line.origen = p.origen || line.origen || '';
    if(line.modo === 'kg'){
  // modo kg
  if(!line.taraManual && line.taraId && num(line.envases)>0){
    line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
  }

  if(!line.netoManual){
    line.neto = clamp0(num(line.bruto) - num(line.tara));
  }

  // precio kg
  const p = findProductByLine(line);
  if(p && num(p.pKg)>0) line.precio = num(p.pKg);

}
else if(line.modo === 'caja'){
  // modo caja
  if(!line.envases || line.envases<=0){
    line.envases = clamp0(line.cantidad);
  }

  // tara auto
  if(line.taraId && !line.taraManual){
    line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
  }

  // neto informativo si hay kgCaja
  const p = findProductByLine(line);
  if(p && num(p.kgCaja)>0 && !line.netoManual){
    line.neto = clamp0(num(line.cantidad) * num(p.kgCaja));
  }

  // precio caja
  if(p && num(p.pCaja)>0) line.precio = num(p.pCaja);

}
else{
  // modo unidad
  const p = findProductByLine(line);
  if(p && num(p.pUd)>0) line.precio = num(p.pUd);
}
lineChanged(inv, line);
renderLines(inv);
recalcInvoice(inv);
focusNextInRow(line.id, 'cantidad');

    // hint precios
    line._hint = buildLineHintFromProduct(p);

    inp.value = line.producto;
    closeAC();
    lineChanged(inv, line);
    // refrescar fila completa para rehidratar modo y hints si quieres
    renderLines(inv);
    recalcInvoice(inv);
    // foco al siguiente campo (modo)
    focusNextInRow(line.id, 'modo');
  };

  const onInput = ()=>{
    line.producto = inp.value;
    line.productoId = ''; // si escribe manual, se “desvincula” hasta elegir
    // sugerencias
    const q = inp.value.trim().toLowerCase();
    if(!q){
      closeAC();
      return;
    }
    const items = State.productos
      .filter(p => (p.nombre||'').toLowerCase().includes(q))
      .slice(0, 12);
    if(items.length) openAC(items);
    else closeAC();
  };

  inp.addEventListener('input', ()=>{
    onInput();
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
  });

  // Teclado: flechas / enter / esc
  inp.addEventListener('keydown', (e)=>{
    if(ac.classList.contains('hidden')){
      if(e.key === 'Enter'){
        // Enter -> siguiente campo
        e.preventDefault();
        focusNextInRow(line.id, 'modo');
      }
      return;
    }
    const itemsEls = $$('.acItem', ac);
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      acIndex = Math.min(acIndex + 1, itemsEls.length - 1);
      itemsEls.forEach((el,i)=> el.classList.toggle('active', i===acIndex));
      itemsEls[acIndex]?.scrollIntoView({block:'nearest'});
    }else if(e.key === 'ArrowUp'){
      e.preventDefault();
      acIndex = Math.max(acIndex - 1, 0);
      itemsEls.forEach((el,i)=> el.classList.toggle('active', i===acIndex));
      itemsEls[acIndex]?.scrollIntoView({block:'nearest'});
    }else if(e.key === 'Enter'){
      e.preventDefault();
      const p = acItems[acIndex] || acItems[0];
      if(p) chooseProduct(p);
      else focusNextInRow(line.id, 'modo');
    }else if(e.key === 'Escape'){
      closeAC();
    }
  });

  // click fuera cierra
  document.addEventListener('click', (e)=>{
    if(!wrap.contains(e.target)) closeAC();
  });

  wrap.appendChild(inp);
  wrap.appendChild(ac);
  wrap.appendChild(hint);

  // asignar dataset para focus chain
  inp.dataset.role = 'producto';
  inp.dataset.line = line.id;

  return wrap;
}

function escapeHtml(s){
  return String(s||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

function acSmallPrice(p){
  const h = [];
  if(num(p.pKg)>0) h.push(`kg: ${num(p.pKg).toFixed(2)}€`);
  if(num(p.pCaja)>0) h.push(`caja: ${num(p.pCaja).toFixed(2)}€`);
  if(num(p.pUd)>0) h.push(`ud: ${num(p.pUd).toFixed(2)}€`);
  return h.join(' · ') || 'Sin precio';
}

function buildLineHintFromProduct(p){
  const hist = Array.isArray(p.hist) ? p.hist.slice(0,5) : [];
  if(!hist.length) return 'Últimos precios: —';
  const txt = hist.map(h=> `${fmtES(h.fecha)} ${h.modo}: ${num(h.precio).toFixed(2)}€`).join(' | ');
  return `Últimos precios: ${txt}`;
}

/* ===== Modo ===== */
function cellModo(inv, line){
  const sel = document.createElement('select');
  sel.innerHTML = `
    <option value="kg">kg</option>
    <option value="caja">caja</option>
    <option value="ud">ud</option>
  `;
  sel.value = line.modo || 'kg';

  sel.dataset.role = 'modo';
  sel.dataset.line = line.id;

  sel.addEventListener('change', ()=>{
    line.modo = sel.value;
    // comportamiento por modo
    if(line.modo === 'kg'){
      // cantidad no relevante
      // neto recalcula si no manual
      if(!line.taraManual && line.taraId && num(line.envases)>0){
        line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
        line.taraManual = false;
      }
      if(!line.netoManual){
        line.neto = clamp0(num(line.bruto) - num(line.tara));
      }
    }else if(line.modo === 'caja'){
      // por defecto envases=cantidad
      if(!line.envases || line.envases<=0) line.envases = num(line.cantidad)||0;
      // neto informativo si kgCaja del producto existe
      const p = findProductByLine(line);
      if(p && num(p.kgCaja)>0 && !line.netoManual){
        line.neto = clamp0(num(line.cantidad) * num(p.kgCaja));
      }
      // precio caja si existe
      if(p && num(p.pCaja)>0) line.precio = num(p.pCaja);
    }else{
      const p = findProductByLine(line);
      if(p && num(p.pUd)>0) line.precio = num(p.pUd);
    }

    lineChanged(inv, line);
    renderLines(inv);
    recalcInvoice(inv);
    focusNextInRow(line.id, 'cantidad');
  });

  return cellWrap('Modo', sel);
}

/* ===== Cantidad ===== */
function cellCantidad(inv, line){
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.step = '0.01';
  inp.placeholder = '0';
  inp.value = (line.cantidad||'') === 0 ? '' : String(line.cantidad ?? '');

  inp.dataset.role = 'cantidad';
  inp.dataset.line = line.id;

inp.addEventListener('input', ()=>{
  line.cantidad = clamp0(inp.value);

  if(line.modo === 'caja'){
    // modo caja: envases = cantidad
    line.envases = clamp0(line.cantidad);

    const p = findProductByLine(line);
    if(p && num(p.kgCaja) > 0 && !line.netoManual){
      line.neto = clamp0(num(line.cantidad) * num(p.kgCaja));
    }
  }
  else if(line.modo === 'kg'){
    // 🔥 FIX: en modo kg, si hay tara seleccionada, cantidad se interpreta como nº envases
    if(line.taraId && !line.taraManual){
      line.envases = clamp0(line.cantidad);
      line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));

      if(!line.netoManual){
        line.neto = clamp0(num(line.bruto) - num(line.tara));
      }
    }
  }

  lineChanged(inv, line);
  recalcInvoice(inv);
});


  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'cantidad'));

  return cellWrap('Cantidad', inp);
}

/* ===== Bruto (kg) ===== */
function cellBruto(inv, line){
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.step = '0.001';
  inp.placeholder = '0.000';
  inp.value = (line.bruto||'') === 0 ? '' : String(line.bruto ?? '');

  inp.dataset.role = 'bruto';
  inp.dataset.line = line.id;

  inp.addEventListener('input', ()=>{
    line.bruto = clamp0(inp.value);

    // autocalcular tara si no manual y tiene taraId+envases
    if(!line.taraManual && line.taraId && num(line.envases)>0){
      line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
    }

    // neto auto si no manual
    if(!line.netoManual){
      line.neto = clamp0(num(line.bruto) - num(line.tara));
    }

    lineChanged(inv, line);
    recalcInvoice(inv);
  });

  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'bruto'));

  return cellWrap('Bruto (kg)', inp);
}

/* ===== Tara (kg) + Envase + Envases ===== */
function cellTara(inv, line){
  const box = document.createElement('div');
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '8px';

  // tara kg
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.step = '0.001';
  inp.placeholder = '0.000';
  inp.value = (line.tara||'') === 0 ? '' : String(line.tara ?? '');

  inp.dataset.role = 'tara';
  inp.dataset.line = line.id;

  inp.addEventListener('input', ()=>{
    line.tara = clamp0(inp.value);
    line.taraManual = true;
    // neto auto si no manual
    if(!line.netoManual){
      line.neto = clamp0(num(line.bruto) - num(line.tara));
    }
    lineChanged(inv, line);
    recalcInvoice(inv);
  });
  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'tara'));

  // selector envase/tara
  const sel = document.createElement('select');
  sel.dataset.role = 'taraId';
  sel.dataset.line = line.id;

  sel.innerHTML = `<option value="">— Envase —</option>` + State.taras
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .map(t => `<option value="${t.id}">${escapeHtml(t.nombre)} (${num(t.peso).toFixed(3)} kg)</option>`)
    .join('');
  sel.value = line.taraId || '';

  sel.addEventListener('change', ()=>{
    line.taraId = sel.value || '';
    // si elige envase y tara NO manual -> recalcular tara desde envases
    if(line.taraId && !line.taraManual){
      if(num(line.envases)<=0){
        // autorelleno recomendado: si modo=caja -> envases=cantidad
        if(line.modo==='caja') line.envases = clamp0(line.cantidad);
      }
      if(num(line.envases)>0){
        line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
        // neto auto si no manual
        if(!line.netoManual){
          line.neto = clamp0(num(line.bruto) - num(line.tara));
        }
      }
    }
    lineChanged(inv, line);
    renderLines(inv);
    recalcInvoice(inv);
  });

  // envases
  const env = document.createElement('input');
  env.type = 'number';
  env.inputMode = 'decimal';
  env.step = '1';
  env.placeholder = '0';
  env.value = (line.envases||'') === 0 ? '' : String(line.envases ?? '');

  env.dataset.role = 'envases';
  env.dataset.line = line.id;

  env.addEventListener('input', ()=>{
    line.envases = clamp0(env.value);
    // tara auto si hay taraId y NO taraManual
    if(line.taraId && !line.taraManual){
      line.tara = clamp0(num(line.envases) * getTaraPeso(line.taraId));
      if(!line.netoManual){
        line.neto = clamp0(num(line.bruto) - num(line.tara));
      }
    }
    lineChanged(inv, line);
    recalcInvoice(inv);
  });

  env.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'envases'));

  // pequeño helper
  const sub = document.createElement('div');
  sub.className = 'subBox';
  sub.textContent = line.taraId
    ? `Tara total = envases (${num(line.envases)||0}) × ${getTaraPeso(line.taraId).toFixed(3)} kg`
    : 'Tara auto: selecciona envase + nº envases (o escribe tara manual).';

  // orden dentro de la celda (1 línea por producto + cajas abajo en móvil)
  box.appendChild(inp);

  const mini = document.createElement('div');
  mini.className = 'miniRow';
  mini.appendChild(sel);
  mini.appendChild(env);
  box.appendChild(mini);

  box.appendChild(sub);

  // etiqueta móvil se maneja en cellWrap
  const cell = cellWrap('Tara (kg) + Envase', box);
  return cell;
}

/* ===== Neto (kg) ===== */
function cellNeto(inv, line){
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.step = '0.001';
  inp.placeholder = '0.000';
  inp.value = (line.neto||'') === 0 ? '' : String(line.neto ?? '');

  inp.dataset.role = 'neto';
  inp.dataset.line = line.id;

  inp.addEventListener('input', ()=>{
    line.neto = clamp0(inp.value);
    line.netoManual = true; // respeta neto manual
    lineChanged(inv, line);
    recalcInvoice(inv);
  });

  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'neto'));

  // validaciones visuales (se aplican en recalcLine)
  return cellWrap('Neto (kg)', inp);
}

/* ===== Precio ===== */
function cellPrecio(inv, line){
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.step = '0.01';
  inp.placeholder = '0.00';
  inp.value = (line.precio||'') === 0 ? '' : String(line.precio ?? '');

  inp.dataset.role = 'precio';
  inp.dataset.line = line.id;

  inp.addEventListener('input', ()=>{
    line.precio = clamp0(inp.value);
    lineChanged(inv, line);
    recalcInvoice(inv);
  });
  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'precio'));

  // hint debajo (ya está en producto, aquí no imprimimos nada)
  return cellWrap('Precio', inp);
}

/* ===== Origen ===== */
function cellOrigen(inv, line){
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Origen';
  inp.value = line.origen || '';

  inp.dataset.role = 'origen';
  inp.dataset.line = line.id;

  inp.addEventListener('input', ()=>{
    line.origen = inp.value;
    lineChanged(inv, line);
  });
  inp.addEventListener('keydown', (e)=> handleEnterFlow(e, line.id, 'origen'));

  // auto rellenar desde producto (si existe)
  return cellWrap('Origen', inp);
}

/* ===== Importe ===== */
function cellImporte(inv, line){
  const box = document.createElement('div');
  box.style.display='flex';
  box.style.flexDirection='column';
  box.style.gap='8px';

  const out = document.createElement('input');
  out.type = 'text';
  out.readOnly = true;
  out.value = euro(line.importe || 0);
  out.classList.add('money');
  out.dataset.role = 'importe';
  out.dataset.line = line.id;

  const sub = document.createElement('div');
  sub.className = 'subBox';
  sub.textContent = line.modo==='kg'
    ? 'Importe = Neto × Precio/kg'
    : (line.modo==='caja' ? 'Importe = Cantidad × Precio/caja' : 'Importe = Cantidad × Precio/ud');

  box.appendChild(out);
  box.appendChild(sub);

  return cellWrap('Importe', box);
}

/* ===== Delete ===== */
function cellDelete(inv, line){
  const btn = document.createElement('button');
  btn.className = 'delBtn';
  btn.type = 'button';
  btn.textContent = '✕';
  btn.title = 'Eliminar línea';

  btn.addEventListener('click', ()=>{
    inv.lines = inv.lines.filter(l=> l.id !== line.id);
    if(inv.lines.length===0){
      for(let i=0;i<5;i++) inv.lines.push(createDefaultLine());
    }
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
    renderLines(inv);
    recalcInvoice(inv);
  });

  return cellWrap('', btn);
}

/* ===========================
   LINE CALCS + VALIDATIONS
=========================== */
function lineChanged(inv, line){
  inv.updatedAt = Date.now();
  save(K.facturas, State.facturas);
}

function recalcInvoice(inv){
  // recalcular cada línea
  inv.lines.forEach(l => recalcLine(inv, l));

  const subtotal = inv.lines.reduce((sum,l)=> sum + num(l.importe), 0);

  const transpPct = num(State.settings?.transpPct ?? 10);
  const transporte = inv.transporteOn ? subtotal * (transpPct/100) : 0;

  const ivaPct = num(State.settings?.ivaPct ?? 4);
  const base = subtotal + transporte;

  let iva = 0;
  let total = 0;

  if(inv.ivaIncluido){
    // IVA incluido: no desglosar ni sumar; total = base
    iva = 0;
    total = base;
  }else{
    iva = base * (ivaPct/100);
    total = base + iva;
  }

  // pagos
  const pagado = (inv.pagos||[]).reduce((s,p)=> s + num(p.importe), 0);
  const pendiente = Math.max(0, total - pagado);

  // UI
  if(UI.tSubtotal) UI.tSubtotal.textContent = euro(subtotal);
  if(UI.tTransporte) UI.tTransporte.textContent = euro(transporte);
  if(UI.tIva) UI.tIva.textContent = euro(iva);
  if(UI.tTotal) UI.tTotal.textContent = euro(total);
  if(UI.tPendiente) UI.tPendiente.textContent = euro(pendiente);

  // guardar totales en factura (para contabilidad/QR)
  inv._calc = { subtotal, transporte, iva, total, pendiente, pagado };
  save(K.facturas, State.facturas);

  // actualizar QR
  updateQrFromInvoice();
}

function recalcLine(inv, l){
  // reset warnings
  // (marcado visual se hace buscando el input correspondiente)
  // Calcular según modo
  const modo = l.modo || 'kg';


// ---------- AUTO ENVASES ----------
if(l.taraId && !l.taraManual){
  // en CAJA: envases = cantidad siempre (si no hay)
  if(modo === 'caja'){
    if(num(l.envases) <= 0 && num(l.cantidad) > 0) l.envases = clamp0(l.cantidad);
  }
  // en KG: si envases vacío y el usuario metió cantidad, úsalo como nº envases
  if(modo === 'kg'){
    if(num(l.envases) <= 0 && num(l.cantidad) > 0) l.envases = clamp0(l.cantidad);
  }
}

// ---------- TARA AUTO ----------
if(l.taraId && !l.taraManual){
  const nEnv = num(l.envases);
  if(nEnv > 0){
    l.tara = clamp0(nEnv * getTaraPeso(l.taraId));
  }else{
    // si no hay envases, tara 0 (evita quedarse con valores viejos)
    l.tara = 0;
  }
}

// ---------- NETO ----------
if(modo === 'kg'){
  // neto = bruto - tara (si no manual)
  if(!l.netoManual){
    l.neto = clamp0(num(l.bruto) - num(l.tara));
  }
  // importe = neto * precio
  l.importe = clamp0(num(l.neto) * num(l.precio));
}
else if(modo === 'caja'){
  // neto informativo si kg/caja del producto (si no manual)
  const p = findProductByLine(l);
  if(p && num(p.kgCaja) > 0 && !l.netoManual){
    l.neto = clamp0(num(l.cantidad) * num(p.kgCaja));
  }
  // importe = cantidad * precio/caja
  l.importe = clamp0(num(l.cantidad) * num(l.precio));
}
else {
  // modo ud
  l.importe = clamp0(num(l.cantidad) * num(l.precio));
}
  // Validaciones recomendadas (B/W)
  const bruto = num(l.bruto);
  const tara = num(l.tara);
  const neto = num(l.neto);

  markWarn(l.id, 'tara', (modo==='kg' && tara > bruto && bruto>0));
  markWarn(l.id, 'neto', (modo==='kg' && neto > bruto && bruto>0));
  markMissing(l.id, 'precio', ((l.producto||'').trim() && num(l.precio)<=0));

  // actualizar importe UI (si está renderizado)
  const row = document.querySelector(`.lineRow[data-line-id="${l.id}"]`);
  if(row){
    const imp = row.querySelector(`[data-role="importe"][data-line="${l.id}"]`);
    if(imp) imp.value = euro(l.importe||0);

    // actualizar subBox de tara si existe
    const tcell = row.querySelector(`[data-role="tara"][data-line="${l.id}"]`);
    // no necesario: se recalcula al render; pero mantenemos
  }
}

function markWarn(lineId, role, on){
  const el = document.querySelector(`[data-role="${role}"][data-line="${lineId}"]`);
  if(el) el.classList.toggle('isWarn', !!on);
}
function markMissing(lineId, role, on){
  const el = document.querySelector(`[data-role="${role}"][data-line="${lineId}"]`);
  if(el) el.classList.toggle('isMissing', !!on);
}

/* ===========================
   HELPERS: Product/Tara lookup
=========================== */
function findProductByLine(line){
  if(line.productoId){
    return State.productos.find(p=>p.id===line.productoId) || null;
  }
  const name = (line.producto||'').trim();
  if(!name) return null;
  // match exact por nombre
  return State.productos.find(p => (p.nombre||'') === name) || null;
}

function getTaraPeso(taraId){
  const t = State.taras.find(x=>x.id===taraId);
  return t ? num(t.peso) : 0;
}

/* ===========================
   ENTER FLOW / Focus chain
=========================== */
function bindKeyboardShortcuts(){
  document.addEventListener('keydown', (e)=>{
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if(mod && e.key.toLowerCase()==='s'){
      e.preventDefault();
      onSaveInvoice();
    }
    if(mod && e.key.toLowerCase()==='p'){
      e.preventDefault();
      onMakePdf(false);
    }
    if(mod && e.key.toLowerCase()==='f'){
      e.preventDefault();
      openSearchModal();
    }
  });
}

function handleEnterFlow(e, lineId, role){
  if(e.key !== 'Enter') return;
  e.preventDefault();

  // orden de campos:
  // producto -> modo -> cantidad -> bruto -> tara -> envases -> neto -> precio -> origen
  const order = ['producto','modo','cantidad','bruto','taraId','envases','neto','precio','origen'];
  const i = order.indexOf(role);
  if(i === -1){
    focusNextInRow(lineId, 'modo');
    return;
  }
  const nextRole = order[i+1];

  if(nextRole){
    focusNextInRow(lineId, nextRole);
  }else{
    // al final crea nueva línea
    const inv = getInvoice(State.currentInvoiceId);
    if(!inv) return;
    inv.lines.push(createDefaultLine());
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);
    renderLines(inv);
    recalcInvoice(inv);
    // foco a producto de la nueva línea
    const last = inv.lines[inv.lines.length-1];
    focusNextInRow(last.id, 'producto');
  }
}

function focusNextInRow(lineId, role){
  // buscar elemento con data-role y data-line
  const el = document.querySelector(`[data-role="${role}"][data-line="${lineId}"]`);
  if(el){
    el.focus();
    if(el.select) el.select();
    return;
  }
  // si el rol es taraId, está dentro de mini row (select)
  const el2 = document.querySelector(`[data-role="${role}"][data-line="${lineId}"]`);
  if(el2){
    el2.focus();
    return;
  }
}

/* ===========================
   PAGOS RENDER
=========================== */
function renderPagos(inv){
  if(!UI.pagosList) return;
  UI.pagosList.innerHTML = '';
  const pagos = inv.pagos || [];
  if(!pagos.length){
    const div = document.createElement('div');
    div.className = 'smallHint';
    div.textContent = 'Sin pagos';
    UI.pagosList.appendChild(div);
    return;
  }

  pagos.slice().sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||'')).forEach(p=>{
    const item = document.createElement('div');
    item.className = 'listItem';
    item.innerHTML = `
      <div>
        <div class="title">${euro(p.importe)}</div>
        <div class="sub">${fmtES(p.fecha||'')}</div>
      </div>
      <button class="btn ghost sm">Eliminar</button>
    `;
    const btn = item.querySelector('button');
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      inv.pagos = inv.pagos.filter(x=>x.id !== p.id);
      inv.updatedAt = Date.now();
      save(K.facturas, State.facturas);
      renderPagos(inv);
      recalcInvoice(inv);
      toast('Pago eliminado');
    });
    UI.pagosList.appendChild(item);
  });
}

/* ===========================
   PRICE HISTORY update
=========================== */
function updateProductsPriceHistoryFromInvoice(inv){
  const fecha = inv.fecha || todayISO();
  inv.lines.forEach(l=>{
    if(!(l.producto||'').trim()) return;
    const p = findProductByLine(l);
    if(!p) return;

    // guarda 5 últimas
    const entry = { fecha, modo: l.modo || 'kg', precio: num(l.precio)||0 };
    if(!entry.precio) return;

    p.hist = Array.isArray(p.hist) ? p.hist : [];
    // quitar duplicado exacto fecha+modo+precio
    p.hist = p.hist.filter(h=> !(h.fecha===entry.fecha && h.modo===entry.modo && num(h.precio)===entry.precio));
    p.hist.unshift(entry);
    p.hist = p.hist.slice(0,5);
  });
}

/* ===========================
   FACTURAS LIST (TAB)
=========================== */
function bindFacturasListEvents(){
  if(UI.invSearch){
    UI.invSearch.addEventListener('input', ()=> refreshInvoiceList());
  }
  if(UI.btnInvExportCsv){
    UI.btnInvExportCsv.addEventListener('click', ()=> exportFacturasCsv());
  }
}

function refreshInvoiceList(){
  if(!UI.invList) return;
  const q = (UI.invSearch?.value||'').trim().toLowerCase();

  const list = State.facturas
    .slice()
    .sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || (b.createdAt||0)-(a.createdAt||0))
    .filter(f=>{
      if(!q) return true;
      const c = f.clienteSnapshot?.nombre || '';
      return (
        (f.numero||'').toLowerCase().includes(q) ||
        (c||'').toLowerCase().includes(q) ||
        (f.tags||'').toLowerCase().includes(q) ||
        (f.fecha||'').toLowerCase().includes(q)
      );
    });

  UI.invList.innerHTML = '';

  list.forEach(f=>{
    const row = document.createElement('div');
    row.className = 'tableRow';
    const total = f._calc?.total ?? calcInvoiceTotalFallback(f);
    row.innerHTML = `
      <div><strong>${escapeHtml(f.numero||'')}</strong><div class="smallHint">${fmtES(f.fecha||'')}</div></div>
      <div>
        <div style="font-weight:700">${escapeHtml(f.clienteSnapshot?.nombre || '—')}</div>
        <div class="smallHint">${escapeHtml(f.tags||'')}</div>
      </div>
      <div><strong>${euro(total)}</strong><div class="smallHint">${escapeHtml(f.estado||'')}</div></div>
      <div class="btns">
        <button class="btn ghost sm" data-act="edit">Editar</button>
        <button class="btn ghost sm" data-act="viewpdf">Ver PDF</button>
      </div>
    `;
    row.querySelector('[data-act="edit"]').addEventListener('click', ()=>{
      setCurrentInvoice(f.id);
      openTab('tabFactura');
      openInvoice(f.id);
    });
    row.querySelector('[data-act="viewpdf"]').addEventListener('click', ()=>{
      setCurrentInvoice(f.id);
      openInvoice(f.id);
      onViewPdf();
    });

    UI.invList.appendChild(row);
  });
}

function calcInvoiceTotalFallback(f){
  // por si no tiene _calc
  const subtotal = (f.lines||[]).reduce((s,l)=> s + num(l.importe), 0);
  const transp = f.transporteOn ? subtotal * (num(State.settings?.transpPct??10)/100) : 0;
  const base = subtotal + transp;
  if(f.ivaIncluido) return base;
  return base + base*(num(State.settings?.ivaPct??4)/100);
}

/* ===========================
   GLOBAL SEARCH (modal)
=========================== */
function renderGlobalSearch(query){
  if(!UI.globalResults) return;
  const q = (query||'').trim().toLowerCase();
  UI.globalResults.innerHTML = '';
  if(!q){
    const hint = document.createElement('div');
    hint.className = 'smallHint';
    hint.textContent = 'Escribe para buscar facturas, clientes o productos…';
    UI.globalResults.appendChild(hint);
    return;
  }

  // Facturas top 6
  const invs = State.facturas
    .filter(f=>{
      const c = f.clienteSnapshot?.nombre || '';
      return (f.numero||'').toLowerCase().includes(q) ||
             (c||'').toLowerCase().includes(q) ||
             (f.tags||'').toLowerCase().includes(q);
    })
    .slice(0,6);

  if(invs.length){
    const t = document.createElement('div');
    t.className = 'smallHint';
    t.textContent = 'Facturas';
    UI.globalResults.appendChild(t);

    invs.forEach(f=>{
      const it = document.createElement('div');
      it.className = 'listItem';
      it.innerHTML = `
        <div>
          <div class="title">${escapeHtml(f.numero||'')}</div>
          <div class="sub">${fmtES(f.fecha||'')} · ${escapeHtml(f.clienteSnapshot?.nombre||'')}</div>
        </div>
        <div class="sub">${euro(f._calc?.total ?? calcInvoiceTotalFallback(f))}</div>
      `;
      it.addEventListener('click', ()=>{
        closeSearchModal();
        setCurrentInvoice(f.id);
        openTab('tabFactura');
        openInvoice(f.id);
      });
      UI.globalResults.appendChild(it);
    });
  }

  // Clientes top 6
  const cls = State.clientes
    .filter(c=> (c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q))
    .slice(0,6);

  if(cls.length){
    const t = document.createElement('div');
    t.className = 'smallHint';
    t.style.marginTop = '8px';
    t.textContent = 'Clientes';
    UI.globalResults.appendChild(t);

    cls.forEach(c=>{
      const it = document.createElement('div');
      it.className = 'listItem';
      it.innerHTML = `
        <div>
          <div class="title">${escapeHtml(c.nombre||'')}</div>
          <div class="sub">${escapeHtml(c.nif||'')}</div>
        </div>
        <div class="sub">Abrir</div>
      `;
      it.addEventListener('click', ()=>{
        closeSearchModal();
        openTab('tabClientes');
        // seleccionar en clientes tab
        State.currentClienteId = c.id;
        refreshClientesTab();
      });
      UI.globalResults.appendChild(it);
    });
  }

  // Productos top 8
  const ps = State.productos
    .filter(p=> (p.nombre||'').toLowerCase().includes(q))
    .slice(0,8);

  if(ps.length){
    const t = document.createElement('div');
    t.className = 'smallHint';
    t.style.marginTop = '8px';
    t.textContent = 'Productos';
    UI.globalResults.appendChild(t);

    ps.forEach(p=>{
      const it = document.createElement('div');
      it.className = 'listItem';
      it.innerHTML = `
        <div>
          <div class="title">${escapeHtml(p.nombre||'')}</div>
          <div class="sub">${acSmallPrice(p)}</div>
        </div>
        <div class="sub">Abrir</div>
      `;
      it.addEventListener('click', ()=>{
        closeSearchModal();
        openTab('tabProductos');
        State.currentProductoId = p.id;
        refreshProductosTab();
      });
      UI.globalResults.appendChild(it);
    });
  }
}

/* =========================================================
   (Fin Parte 3B) — Continua en 3C
   ========================================================= */
/* =========================================================
   FACTU MIRAL — B/W PRO
   app.js (PARTE 3C/3) — CRUD + QR + PDF PRO + WhatsApp + PINs + Ventas + Ajustes + Cloud opcional
   ========================================================= */

/* ===========================
   QR AEAT
=========================== */
function buildQrText(inv){
  const provNif = (UI.provNif?.value || State.provider?.nif || '').trim();
  const numFac = (inv.numero || '').trim();
  const fecha  = (inv.fecha || todayISO()).trim();
  const total  = num(inv._calc?.total ?? calcInvoiceTotalFallback(inv)).toFixed(2);

  const base = State.settings?.qrBase || 'NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}';
  return base
    .replaceAll('{NIF}', provNif)
    .replaceAll('{NUM}', numFac)
    .replaceAll('{FECHA}', fmtES(fecha))
    .replaceAll('{TOTAL}', total);
}

function updateQrFromInvoice(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;

  const provNif = (UI.provNif?.value || State.provider?.nif || '').trim();
  const numFac = (inv.numero || '').trim();
  const fecha  = (inv.fecha || '').trim();
  const total  = num(inv._calc?.total ?? calcInvoiceTotalFallback(inv));

  // Validación previa: si falta NIF, nº, fecha o total -> aviso
  let ok = true;
  if(!provNif || !numFac || !fecha || !(total>0)) ok = false;

  const txt = buildQrText(inv);
  if(UI.qrSmallText){
    UI.qrSmallText.textContent = ok ? txt : '⚠️ Falta NIF/Factura/Fecha/Total para QR.';
  }

  // Render QR (usando QRious si está cargado en index)
// ✅ Render QR con qrcode.min.js (QRCode)
if(UI.qrCanvas && window.QRCode){
  try{
    // limpia canvas
    const ctx = UI.qrCanvas.getContext('2d');
    ctx && ctx.clearRect(0,0,UI.qrCanvas.width, UI.qrCanvas.height);

    window.QRCode.toCanvas(UI.qrCanvas, txt, {
      width: 210,
      margin: 1,
      errorCorrectionLevel: 'M'
    }, (err)=>{
      if(err) console.warn('QR canvas error', err);
    });
  }catch(e){
    console.warn('QR error', e);
  }
}


function copyQrText(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;
  const txt = buildQrText(inv);
  navigator.clipboard?.writeText(txt)
    .then(()=> toast('Texto QR copiado'))
    .catch(()=> toast('No se pudo copiar'));
}

/* ===========================
   WHATSAPP PRO (texto)
=========================== */
function onWhatsApp(){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;

  const total = num(inv._calc?.total ?? calcInvoiceTotalFallback(inv));
  const cliente = (inv.clienteSnapshot?.nombre || UI.cliNombre?.value || '—').trim();

  const lines = inv.lines
    .filter(l => (l.producto||'').trim())
    .map(l=>{
      const prod = (l.producto||'').trim();
      const modo = l.modo || 'kg';
      if(modo==='kg'){
        return `- ${prod}: Neto ${num(l.neto).toFixed(3)} kg × ${num(l.precio).toFixed(2)} = ${euro(l.importe)}`;
      }
      if(modo==='caja'){
        return `- ${prod}: ${num(l.cantidad)} caja × ${num(l.precio).toFixed(2)} = ${euro(l.importe)}`;
      }
      return `- ${prod}: ${num(l.cantidad)} ud × ${num(l.precio).toFixed(2)} = ${euro(l.importe)}`;
    })
    .join('\n');

  const msg =
`FACTURA ${inv.numero}
Fecha: ${fmtES(inv.fecha)}
Cliente: ${cliente}

${lines}

Subtotal: ${euro(inv._calc?.subtotal ?? 0)}
Transporte: ${euro(inv._calc?.transporte ?? 0)}
${inv.ivaIncluido ? 'IVA: incluido' : 'IVA: ' + euro(inv._calc?.iva ?? 0)}
TOTAL: ${euro(total)}
Pendiente: ${euro(inv._calc?.pendiente ?? 0)}
`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

/* ===========================
   PDF PRO (multipágina + suma y sigue + visor)
   - Usa jsPDF + autoTable (deben estar en index)
=========================== */
async function onMakePdf(uploadToCloud){
  const inv = getInvoice(State.currentInvoiceId);
  if(!inv) return;

  // validar antes de PDF
  const probs = validateInvoice(inv);
  if(probs.length){
    toast('Faltan campos: ' + probs[0]);
    return;
  }

  // siempre recalcular
  recalcInvoice(inv);

  if(!window.jspdf?.jsPDF){
    toast('jsPDF no cargado en index');
    return;
  }

  const doc = new window.jspdf.jsPDF({ unit:'pt', format:'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Header: proveedor izq / QR centro / cliente der
  const prov = {
    nombre: (UI.provNombre?.value || State.provider?.nombre || '').trim(),
    nif: (UI.provNif?.value || State.provider?.nif || '').trim(),
    dir: (UI.provDir?.value || State.provider?.dir || '').trim(),
    tel: (UI.provTel?.value || State.provider?.tel || '').trim(),
    email: (UI.provEmail?.value || State.provider?.email || '').trim()
  };

  const cli = {
    nombre: (inv.clienteSnapshot?.nombre || UI.cliNombre?.value || '').trim(),
    nif: (inv.clienteSnapshot?.nif || UI.cliNif?.value || '').trim(),
    dir: (inv.clienteSnapshot?.dir || UI.cliDir?.value || '').trim(),
    tel: (inv.clienteSnapshot?.tel || UI.cliTel?.value || '').trim(),
    email: (inv.clienteSnapshot?.email || UI.cliEmail?.value || '').trim()
  };

  const numero = inv.numero || nowFacturaId();
  const fechaES = fmtES(inv.fecha || todayISO());

  // Logo (cereza B/W): dibujo simple vector (sin imagen externa)
  // (Si quieres logo real, lo ponemos en index como SVG; esto evita errores.)
  function drawCherryLogo(x,y){
    doc.setDrawColor(0);
    doc.setLineWidth(1.2);
    // dos círculos
    doc.circle(x+10, y+10, 7, 'S');
    doc.circle(x+28, y+12, 7, 'S');
    // tallos
    doc.line(x+10, y+3, x+20, y-8);
    doc.line(x+28, y+5, x+22, y-8);
    // hoja
    doc.line(x+20, y-8, x+34, y-16);
    doc.line(x+20, y-8, x+32, y-6);
  }

  drawCherryLogo(margin, margin+6);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text('FACTU MIRAL', margin+46, margin+20);

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.text(`Factura: ${numero}`, margin, margin+48);
  doc.text(`Fecha: ${fechaES}`, margin, margin+64);

  // cajas proveedor/cliente
  const boxY = margin+86;
  const boxH = 96;
  const colW = (pageW - margin*2);
  const leftW = colW*0.36;
  const midW  = colW*0.28;
  const rightW= colW*0.36;

  // proveedor
  doc.setDrawColor(0);
  doc.roundedRect(margin, boxY, leftW-8, boxH, 10, 10, 'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('Proveedor', margin+10, boxY+18);
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(trimLines([
    prov.nombre,
    prov.nif ? `NIF: ${prov.nif}` : '',
    prov.dir,
    prov.tel ? `Tel: ${prov.tel}` : '',
    prov.email ? `Email: ${prov.email}` : ''
  ]), margin+10, boxY+34, {maxWidth:leftW-28});

  // QR centro
  const midX = margin + leftW;
  doc.roundedRect(midX, boxY, midW-8, boxH, 10, 10, 'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('QR AEAT', midX+10, boxY+18);

  // generar QR en dataURL (si QRious disponible); si no, texto
  const qrText = buildQrText(inv);
  const qrSize = 72;
let qrOk = false;
try{
  if(window.QRCode && window.QRCode.toDataURL){
    const data = await window.QRCode.toDataURL(qrText, {
      margin: 1,
      width: 260,
      errorCorrectionLevel: 'M'
    });
    doc.addImage(data, 'PNG', midX+18, boxY+26, qrSize, qrSize);
    qrOk = true;
  }
}catch(e){
  console.warn('QR PDF error', e);
  qrOk = false;
}


  doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
  const qrTxt = qrOk ? qrText : ('QR no disponible. Texto:\n'+qrText);
  doc.text(qrTxt, midX+18+qrSize+10, boxY+36, {maxWidth: midW-8-(18+qrSize+18)});

  // cliente
  const rightX = margin + leftW + midW;
  doc.roundedRect(rightX, boxY, rightW, boxH, 10, 10, 'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('Cliente', rightX+10, boxY+18);
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(trimLines([
    cli.nombre,
    cli.nif ? `NIF/CIF: ${cli.nif}` : '',
    cli.dir,
    cli.tel ? `Tel: ${cli.tel}` : '',
    cli.email ? `Email: ${cli.email}` : ''
  ]), rightX+10, boxY+34, {maxWidth:rightW-20});

  // tabla líneas
  const startY = boxY + boxH + 16;

  // preparar filas
  const rows = inv.lines
    .filter(l => (l.producto||'').trim())
    .map(l=>{
      const modo = l.modo || 'kg';
      return [
        l.producto || '',
        modo,
        modo==='kg' ? '' : num(l.cantidad).toString(),
        modo==='kg' ? num(l.bruto).toFixed(3) : '',
        modo==='kg' ? num(l.tara).toFixed(3) : '',
        modo==='kg' ? num(l.neto).toFixed(3) : (num(l.neto)>0 ? num(l.neto).toFixed(3) : ''),
        num(l.precio).toFixed(2),
        l.origen || '',
        num(l.importe).toFixed(2)
      ];
    });

  // AutoTable multipágina + suma y sigue
  if(window.jspdf?.jsPDF && doc.autoTable){
    doc.autoTable({
      startY,
      head: [[ 'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe' ]],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
        lineColor: [0,0,0],
        textColor: [0,0,0]
      },
      headStyles: {
        fillColor: [245,245,245],
        textColor: [0,0,0],
        lineWidth: 0.8
      },
      didDrawPage: (data)=>{
        // footer page x/y
        const page = doc.internal.getCurrentPageInfo().pageNumber;
        const pages = doc.internal.getNumberOfPages();

        doc.setFontSize(9);
        doc.setFont('helvetica','normal');
        doc.text(`Página ${page}/${pages}`, pageW - margin, pageH - 18, {align:'right'});

        // “Suma y sigue” si no es la última (lo ajustamos después de conocer páginas)
        // (Se reimprime al final de generación usando totalPages)
      }
    });

    // después de autoTable ya sabemos páginas
    const totalPages = doc.internal.getNumberOfPages();
    for(let p=1; p<=totalPages; p++){
      doc.setPage(p);
      if(p < totalPages){
        doc.setFontSize(9);
        doc.setFont('helvetica','italic');
        doc.text('Suma y sigue…', margin, pageH - 18);
      }
      // página x/y ya está
    }

    // Totales en la última página debajo de la tabla
    doc.setPage(totalPages);
    const lastY = doc.lastAutoTable.finalY + 14;

    const subtotal = num(inv._calc?.subtotal ?? 0);
    const transp = num(inv._calc?.transporte ?? 0);
    const iva = num(inv._calc?.iva ?? 0);
    const total = num(inv._calc?.total ?? 0);

    const boxW = 260;
    const x = pageW - margin - boxW;
    let y = Math.min(lastY, pageH - 180);

    doc.roundedRect(x, y, boxW, 110, 10, 10, 'S');
    doc.setFont('helvetica','normal'); doc.setFontSize(9);

    const lineY = (t)=> { y += 18; doc.text(t, x+12, y); };
    y += 16;
    doc.setFont('helvetica','bold'); doc.text('Totales', x+12, y);
    doc.setFont('helvetica','normal');

    lineY(`Subtotal: ${euro(subtotal)}`);
    if(inv.transporteOn) lineY(`Transporte: ${euro(transp)}`);
    if(inv.ivaIncluido){
      lineY('IVA: incluido');
    }else{
      lineY(`IVA (${num(State.settings?.ivaPct??4).toFixed(0)}%): ${euro(iva)}`);
    }
    doc.setFont('helvetica','bold');
    lineY(`TOTAL: ${euro(total)}`);
    doc.setFont('helvetica','normal');

    // Observaciones + nota IVA incluido
    const obsY = Math.min(doc.lastAutoTable.finalY + 130, pageH - 70);
    doc.setFontSize(9);
    const obsTxt = (inv.obs||'').trim();
    if(obsTxt){
      doc.text('Observaciones:', margin, obsY);
      doc.setFontSize(8);
      doc.text(obsTxt, margin, obsY+14, {maxWidth: pageW - margin*2});
    }
    if(inv.ivaIncluido){
      doc.setFontSize(8);
      doc.text('IVA incluido en los precios.', margin, pageH - 36);
    }
  }else{
    // fallback simple si autoTable no está
    doc.setFontSize(10);
    doc.text('⚠️ Falta autoTable en index. No se pudo generar tabla multipágina.', margin, startY);
  }

  // generar blob
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  // guardar local: (no guardamos pdf en localStorage, solo se visualiza; factura queda guardada)
  inv.updatedAt = Date.now();
  save(K.facturas, State.facturas);

  // visor
  openPdfModal(blobUrl);

  // Cloud (opcional)
  if(uploadToCloud){
    await cloudUploadPdf(inv, blob, `${inv.numero}.pdf`);
  }

  toast(uploadToCloud ? 'PDF generado (y cloud si configurado)' : 'PDF generado');
}

function trimLines(arr){
  return arr.filter(Boolean).join('\n');
}

function onViewPdf(){
  // genera PDF y abre visor (sin descargar)
  onMakePdf(false);
}

/* ===========================
   CSV EXPORT (Facturas / Contab / Ventas)
=========================== */
function exportFacturasCsv(){
  const rows = [];
  rows.push(['numero','fecha','cliente','tags','estado','metodo','subtotal','transporte','iva','total','pendiente'].join(';'));

  State.facturas.forEach(f=>{
    const c = f.clienteSnapshot?.nombre || '';
    const calc = f._calc || {subtotal:0,transporte:0,iva:0,total:calcInvoiceTotalFallback(f),pendiente:0};
    rows.push([
      safeCsv(f.numero),
      safeCsv(f.fecha),
      safeCsv(c),
      safeCsv(f.tags||''),
      safeCsv(f.estado||''),
      safeCsv(f.pagoMetodo||''),
      num(calc.subtotal).toFixed(2),
      num(calc.transporte).toFixed(2),
      num(calc.iva).toFixed(2),
      num(calc.total).toFixed(2),
      num(calc.pendiente).toFixed(2),
    ].join(';'));
  });

  downloadText('facturas.csv', rows.join('\n'));
}

function safeCsv(v){
  return String(v||'').replaceAll(';',',').replaceAll('\n',' ');
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 500);
}

/* ===========================
   CLIENTES TAB (CRUD + protección)
=========================== */
function bindClientesTabEvents(){
  if(UI.cliSearch) UI.cliSearch.addEventListener('input', refreshClientesTab);

  if(UI.btnCliNew){
    UI.btnCliNew.addEventListener('click', ()=>{
      const c = {id:uid(), nombre:'', alias:'', nif:'', dir:'', tel:'', email:'', notas:'', tags:'', pago:'', ivaIncluido:false, transp:false};
      State.clientes.push(c);
      State.currentClienteId = c.id;
      save(K.clientes, State.clientes);
      renderClientesSelectFactura();
      renderSelectClientesCont();
      refreshClientesTab();
      toast('Nuevo cliente');
    });
  }
  if(UI.btnCliSave){
    UI.btnCliSave.addEventListener('click', ()=>{
      const c = getCurrentCliente();
      if(!c) return;
      const name = (UI.cliE_nombre?.value||'').trim();
      if(!name){
        toast('Falta nombre cliente');
        UI.cliE_nombre?.classList.add('isMissing');
        setTimeout(()=>UI.cliE_nombre?.classList.remove('isMissing'), 900);
        return;
      }
      c.nombre = name;
      c.alias = (UI.cliE_alias?.value||'').trim();
      c.nif = (UI.cliE_nif?.value||'').trim();
      c.dir = (UI.cliE_dir?.value||'').trim();
      c.tel = (UI.cliE_tel?.value||'').trim();
      c.email = (UI.cliE_email?.value||'').trim();
      c.tags = (UI.cliE_tags?.value||'').trim();
      c.pago = (UI.cliE_pago?.value||'').trim();
      c.ivaIncluido = !!UI.cliE_ivaIncl?.checked;
      c.transp = !!UI.cliE_transp?.checked;
      c.notas = (UI.cliE_notas?.value||'').trim();

      save(K.clientes, State.clientes);
      renderClientesSelectFactura();
      renderSelectClientesCont();
      refreshClientesTab();
      toast('Cliente guardado');
    });
  }
  if(UI.btnCliDelete){
    UI.btnCliDelete.addEventListener('click', ()=>{
      const c = getCurrentCliente();
      if(!c) return;

      // protección: no borrar si usado en facturas
      const used = State.facturas.some(f => f.clienteId === c.id);
      if(used){
        toast('No se puede borrar: cliente usado en facturas');
        return;
      }
      if(!confirmBW('¿Eliminar cliente?')) return;

      State.clientes = State.clientes.filter(x=>x.id!==c.id);
      State.currentClienteId = State.clientes[0]?.id || null;
      save(K.clientes, State.clientes);
      renderClientesSelectFactura();
      renderSelectClientesCont();
      refreshClientesTab();
      toast('Cliente eliminado');
    });
  }
}

function refreshClientesTab(){
  if(!UI.cliList) return;
  const q = (UI.cliSearch?.value||'').trim().toLowerCase();

  const list = State.clientes
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .filter(c=>{
      if(!q) return true;
      return (c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q);
    });

  UI.cliList.innerHTML = '';

  list.forEach(c=>{
    const item = document.createElement('div');
    item.className = 'listItem';
    item.innerHTML = `
      <div>
        <div class="title">${escapeHtml(c.nombre||'(Sin nombre)')}</div>
        <div class="sub">${escapeHtml(c.nif||'')}</div>
      </div>
      <div class="sub">Abrir</div>
    `;
    item.addEventListener('click', ()=>{
      State.currentClienteId = c.id;
      fillClienteEditor(c);
    });
    UI.cliList.appendChild(item);
  });

  // seleccionar por defecto
  if(!State.currentClienteId && State.clientes.length){
    State.currentClienteId = State.clientes[0].id;
  }
  const cur = getCurrentCliente();
  if(cur) fillClienteEditor(cur);
}

function getCurrentCliente(){
  if(!State.currentClienteId) return null;
  return State.clientes.find(x=>x.id===State.currentClienteId) || null;
}

function fillClienteEditor(c){
  if(!c) return;
  if(UI.cliE_nombre) UI.cliE_nombre.value = c.nombre||'';
  if(UI.cliE_alias) UI.cliE_alias.value = c.alias||'';
  if(UI.cliE_nif) UI.cliE_nif.value = c.nif||'';
  if(UI.cliE_dir) UI.cliE_dir.value = c.dir||'';
  if(UI.cliE_tel) UI.cliE_tel.value = c.tel||'';
  if(UI.cliE_email) UI.cliE_email.value = c.email||'';
  if(UI.cliE_tags) UI.cliE_tags.value = c.tags||'';
  if(UI.cliE_pago) UI.cliE_pago.value = c.pago||'';
  if(UI.cliE_ivaIncl) UI.cliE_ivaIncl.checked = !!c.ivaIncluido;
  if(UI.cliE_transp) UI.cliE_transp.checked = !!c.transp;
  if(UI.cliE_notas) UI.cliE_notas.value = c.notas||'';
}

/* ===========================
   PRODUCTOS TAB (CRUD + historial + envase defecto)
=========================== */
function bindProductosTabEvents(){
  if(UI.prdSearch) UI.prdSearch.addEventListener('input', refreshProductosTab);

  if(UI.btnPrdNew){
    UI.btnPrdNew.addEventListener('click', ()=>{
      const p = {id:uid(), nombre:'', modo:'kg', kgCaja:0, pKg:0, pCaja:0, pUd:0, coste:0, origen:'', taraId:'', hist:[]};
      State.productos.push(p);
      State.currentProductoId = p.id;
      save(K.productos, State.productos);
      refreshProductosTab();
      toast('Nuevo producto');
    });
  }

  if(UI.btnPrdSave){
    UI.btnPrdSave.addEventListener('click', ()=>{
      const p = getCurrentProducto();
      if(!p) return;
      const name = (UI.prdE_nombre?.value||'').trim();
      if(!name){
        toast('Falta nombre producto');
        UI.prdE_nombre?.classList.add('isMissing');
        setTimeout(()=>UI.prdE_nombre?.classList.remove('isMissing'), 900);
        return;
      }
      p.nombre = name;
      p.modo = UI.prdE_modo?.value || 'kg';
      p.kgCaja = clamp0(UI.prdE_kgcaja?.value);
      p.pKg = clamp0(UI.prdE_pkg?.value);
      p.pCaja = clamp0(UI.prdE_pcaja?.value);
      p.pUd = clamp0(UI.prdE_pud?.value);
      p.coste = clamp0(UI.prdE_coste?.value);
      p.origen = (UI.prdE_origen?.value||'').trim();
      p.taraId = UI.prdE_tara?.value || '';

      save(K.productos, State.productos);
      refreshProductosTab();
      toast('Producto guardado');
    });
  }

  if(UI.btnPrdDelete){
    UI.btnPrdDelete.addEventListener('click', ()=>{
      const p = getCurrentProducto();
      if(!p) return;

      // protección: no borrar si aparece en líneas de facturas
      const used = State.facturas.some(f => (f.lines||[]).some(l => l.productoId === p.id || (l.producto||'')===p.nombre));
      if(used){
        toast('No se puede borrar: producto usado en facturas');
        return;
      }
      if(!confirmBW('¿Eliminar producto?')) return;

      State.productos = State.productos.filter(x=>x.id!==p.id);
      State.currentProductoId = State.productos[0]?.id || null;
      save(K.productos, State.productos);
      refreshProductosTab();
      toast('Producto eliminado');
    });
  }
}

function refreshProductosTab(){
  if(!UI.prdList) return;
  const q = (UI.prdSearch?.value||'').trim().toLowerCase();

  const list = State.productos
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .filter(p=>{
      if(!q) return true;
      return (p.nombre||'').toLowerCase().includes(q);
    });

  UI.prdList.innerHTML = '';
  list.forEach(p=>{
    const item = document.createElement('div');
    item.className = 'listItem';
    item.innerHTML = `
      <div>
        <div class="title">${escapeHtml(p.nombre||'(Sin nombre)')}</div>
        <div class="sub">${acSmallPrice(p)}</div>
      </div>
      <div class="sub">Abrir</div>
    `;
    item.addEventListener('click', ()=>{
      State.currentProductoId = p.id;
      fillProductoEditor(p);
    });
    UI.prdList.appendChild(item);
  });

  renderSelectTarasEnProductos();
  // selección por defecto
  if(!State.currentProductoId && State.productos.length){
    State.currentProductoId = State.productos[0].id;
  }
  const cur = getCurrentProducto();
  if(cur) fillProductoEditor(cur);
}

function getCurrentProducto(){
  if(!State.currentProductoId) return null;
  return State.productos.find(x=>x.id===State.currentProductoId) || null;
}

function fillProductoEditor(p){
  if(!p) return;
  if(UI.prdE_nombre) UI.prdE_nombre.value = p.nombre||'';
  if(UI.prdE_modo) UI.prdE_modo.value = p.modo||'kg';
  if(UI.prdE_kgcaja) UI.prdE_kgcaja.value = num(p.kgCaja||0) || '';
  if(UI.prdE_pkg) UI.prdE_pkg.value = num(p.pKg||0) || '';
  if(UI.prdE_pcaja) UI.prdE_pcaja.value = num(p.pCaja||0) || '';
  if(UI.prdE_pud) UI.prdE_pud.value = num(p.pUd||0) || '';
  if(UI.prdE_coste) UI.prdE_coste.value = num(p.coste||0) || '';
  if(UI.prdE_origen) UI.prdE_origen.value = p.origen||'';
  if(UI.prdE_tara) UI.prdE_tara.value = p.taraId || '';

  if(UI.prdHist){
    const hist = Array.isArray(p.hist) ? p.hist : [];
    UI.prdHist.textContent = hist.length
      ? hist.map(h=> `${fmtES(h.fecha)} ${h.modo}: ${num(h.precio).toFixed(2)}€`).join(' | ')
      : '—';
  }
}

/* ===========================
   TARAS TAB (CRUD)
=========================== */
function bindTarasTabEvents(){
  if(UI.taraSearch) UI.taraSearch.addEventListener('input', refreshTarasTab);

  if(UI.btnTaraNew){
    UI.btnTaraNew.addEventListener('click', ()=>{
      const t = {id:uid(), nombre:'', peso:0, notas:''};
      State.taras.push(t);
      State.currentTaraId = t.id;
      save(K.taras, State.taras);
      refreshTarasTab();
      toast('Nueva tara');
    });
  }

  if(UI.btnTaraSave){
    UI.btnTaraSave.addEventListener('click', ()=>{
      const t = getCurrentTara();
      if(!t) return;
      const name = (UI.taraE_nombre?.value||'').trim();
      if(!name){
        toast('Falta nombre tara');
        UI.taraE_nombre?.classList.add('isMissing');
        setTimeout(()=>UI.taraE_nombre?.classList.remove('isMissing'), 900);
        return;
      }
      t.nombre = name;
      t.peso = clamp0(UI.taraE_peso?.value);
      t.notas = (UI.taraE_notas?.value||'').trim();
      save(K.taras, State.taras);

      // refrescar selects dependientes
      renderSelectTarasEnProductos();

      // refrescar líneas factura (por si usa esta tara)
      const inv = getInvoice(State.currentInvoiceId);
      if(inv){
        renderLines(inv);
        recalcInvoice(inv);
      }

      refreshTarasTab();
      toast('Tara guardada');
    });
  }

  if(UI.btnTaraDelete){
    UI.btnTaraDelete.addEventListener('click', ()=>{
      const t = getCurrentTara();
      if(!t) return;

      // protección: si está asignada a productos o usada en facturas -> no borrar
      const usedInProducts = State.productos.some(p=> p.taraId === t.id);
      const usedInLines = State.facturas.some(f=> (f.lines||[]).some(l=> l.taraId === t.id));
      if(usedInProducts || usedInLines){
        toast('No se puede borrar: tara usada');
        return;
      }
      if(!confirmBW('¿Eliminar tara?')) return;

      State.taras = State.taras.filter(x=>x.id!==t.id);
      State.currentTaraId = State.taras[0]?.id || null;
      save(K.taras, State.taras);
      renderSelectTarasEnProductos();
      refreshTarasTab();
      toast('Tara eliminada');
    });
  }
}

function refreshTarasTab(){
  if(!UI.taraList) return;
  const q = (UI.taraSearch?.value||'').trim().toLowerCase();

  const list = State.taras
    .slice()
    .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
    .filter(t=>{
      if(!q) return true;
      return (t.nombre||'').toLowerCase().includes(q);
    });

  UI.taraList.innerHTML = '';
  list.forEach(t=>{
    const item = document.createElement('div');
    item.className = 'listItem';
    item.innerHTML = `
      <div>
        <div class="title">${escapeHtml(t.nombre||'(Sin nombre)')}</div>
        <div class="sub">${num(t.peso||0).toFixed(3)} kg</div>
      </div>
      <div class="sub">Abrir</div>
    `;
    item.addEventListener('click', ()=>{
      State.currentTaraId = t.id;
      fillTaraEditor(t);
    });
    UI.taraList.appendChild(item);
  });

  if(!State.currentTaraId && State.taras.length){
    State.currentTaraId = State.taras[0].id;
  }
  const cur = getCurrentTara();
  if(cur) fillTaraEditor(cur);
}

function getCurrentTara(){
  if(!State.currentTaraId) return null;
  return State.taras.find(x=>x.id===State.currentTaraId) || null;
}

function fillTaraEditor(t){
  if(!t) return;
  if(UI.taraE_nombre) UI.taraE_nombre.value = t.nombre||'';
  if(UI.taraE_peso) UI.taraE_peso.value = num(t.peso||0) || '';
  if(UI.taraE_notas) UI.taraE_notas.value = t.notas||'';
}

/* ===========================
   CONTABILIDAD 🔒 (PIN)
=========================== */
function bindContabilidadEvents(){
  if(UI.btnUnlockCont){
    UI.btnUnlockCont.addEventListener('click', async ()=>{
      const pin = await openPinModal({title:'Contabilidad 🔒', text:'Introduce el PIN de contabilidad'});
      if(pin === null) return;
      const correct = (State.settings?.pinCont || '0000').trim();
      if(pin.trim() === correct){
        State.session.contUnlocked = true;
        save(K.session, State.session);
        refreshLocksUI();
        toast('Contabilidad desbloqueada');
        // defaults filtros
        if(UI.contDesde) UI.contDesde.value = todayISO().slice(0,7)+'-01';
        if(UI.contHasta) UI.contHasta.value = todayISO();
        applyContabilidad();
      }else{
        toast('PIN incorrecto');
      }
    });
  }
  if(UI.btnLockCont){
    UI.btnLockCont.addEventListener('click', ()=>{
      State.session.contUnlocked = false;
      save(K.session, State.session);
      refreshLocksUI();
      toast('Contabilidad bloqueada');
    });
  }
  if(UI.btnContApply){
    UI.btnContApply.addEventListener('click', applyContabilidad);
  }
  if(UI.btnContExportCsv){
    UI.btnContExportCsv.addEventListener('click', exportContabilidadCsv);
  }
}

function applyContabilidad(){
  if(!State.session.contUnlocked) return;
  const desde = UI.contDesde?.value || '';
  const hasta = UI.contHasta?.value || '';
  const cid = UI.contCliente?.value || '';
  const tag = (UI.contTag?.value||'').trim().toLowerCase();

  const filtered = State.facturas.filter(f=>{
    const fe = f.fecha || '';
    if(desde && fe < desde) return false;
    if(hasta && fe > hasta) return false;
    if(cid && f.clienteId !== cid) return false;
    if(tag){
      const t = (f.tags||'').toLowerCase();
      if(!t.includes(tag)) return false;
    }
    return true;
  });

  // KPIs
  let ventas = 0, iva = 0, margen = 0;
  filtered.forEach(f=>{
    const calc = f._calc || {total: calcInvoiceTotalFallback(f), iva:0, subtotal:0, transporte:0};
    ventas += num(calc.total);
    iva += num(calc.iva);
    // margen (si coste)
    (f.lines||[]).forEach(l=>{
      if(!(l.producto||'').trim()) return;
      const p = findProductByLine(l);
      if(!p) return;
      const coste = num(p.coste);
      if(coste<=0) return;

      if((l.modo||'kg')==='kg'){
        margen += (num(l.precio)-coste) * num(l.neto);
      }else{
        // para caja/ud: coste como unitario (si lo usas así); si no, queda como estimación
        margen += (num(l.precio)-coste) * num(l.cantidad);
      }
    });
  });

  if(UI.kpiVentas) UI.kpiVentas.textContent = euro(ventas);
  if(UI.kpiIva) UI.kpiIva.textContent = euro(iva);
  if(UI.kpiCount) UI.kpiCount.textContent = String(filtered.length);
  if(UI.kpiMargen) UI.kpiMargen.textContent = euro(margen);

  // tabla
  if(!UI.contTable) return;
  UI.contTable.innerHTML = '';
  filtered
    .slice()
    .sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''))
    .forEach(f=>{
      const row = document.createElement('div');
      row.className = 'tableRow';
      const total = f._calc?.total ?? calcInvoiceTotalFallback(f);
      row.innerHTML = `
        <div><strong>${escapeHtml(f.fecha||'')}</strong><div class="smallHint">${escapeHtml(dayNameES(f.fecha||''))}</div></div>
        <div>
          <div style="font-weight:700">${escapeHtml(f.numero||'')}</div>
          <div class="smallHint">${escapeHtml(f.clienteSnapshot?.nombre||'')}</div>
        </div>
        <div><strong>${euro(total)}</strong><div class="smallHint">${escapeHtml(f.tags||'')}</div></div>
        <div class="btns">
          <button class="btn ghost sm">Abrir</button>
        </div>
      `;
      row.querySelector('button').addEventListener('click', ()=>{
        setCurrentInvoice(f.id);
        openTab('tabFactura');
        openInvoice(f.id);
      });
      UI.contTable.appendChild(row);
    });
}

function exportContabilidadCsv(){
  if(!State.session.contUnlocked) return;
  const desde = UI.contDesde?.value || '';
  const hasta = UI.contHasta?.value || '';
  const cid = UI.contCliente?.value || '';
  const tag = (UI.contTag?.value||'').trim().toLowerCase();

  const filtered = State.facturas.filter(f=>{
    const fe = f.fecha || '';
    if(desde && fe < desde) return false;
    if(hasta && fe > hasta) return false;
    if(cid && f.clienteId !== cid) return false;
    if(tag){
      const t = (f.tags||'').toLowerCase();
      if(!t.includes(tag)) return false;
    }
    return true;
  });

  const rows = [];
  rows.push(['fecha','numero','cliente','tags','subtotal','transporte','iva','total','pendiente'].join(';'));
  filtered.forEach(f=>{
    const c = f.clienteSnapshot?.nombre || '';
    const calc = f._calc || {subtotal:0,transporte:0,iva:0,total:calcInvoiceTotalFallback(f),pendiente:0};
    rows.push([
      safeCsv(f.fecha),
      safeCsv(f.numero),
      safeCsv(c),
      safeCsv(f.tags||''),
      num(calc.subtotal).toFixed(2),
      num(calc.transporte).toFixed(2),
      num(calc.iva).toFixed(2),
      num(calc.total).toFixed(2),
      num(calc.pendiente).toFixed(2),
    ].join(';'));
  });

  downloadText('contabilidad.csv', rows.join('\n'));
}

/* ===========================
   VENTAS DIARIAS 🔒 (PIN 8410)
=========================== */
function bindVentasEvents(){
  if(UI.btnUnlockVentas){
    UI.btnUnlockVentas.addEventListener('click', async ()=>{
      const pin = await openPinModal({title:'Ventas diarias 🔒', text:'Introduce PIN (8410)'});
      if(pin === null) return;
      if(pin.trim() === '8410'){
        State.session.ventasUnlocked = true;
        save(K.session, State.session);
        refreshLocksUI();
        toast('Ventas desbloqueadas');
        // refresh
        refreshVentasCalcUI();
        refreshVentasList();
      }else{
        toast('PIN incorrecto');
      }
    });
  }
  if(UI.btnLockVentas){
    UI.btnLockVentas.addEventListener('click', ()=>{
      State.session.ventasUnlocked = false;
      save(K.session, State.session);
      refreshLocksUI();
      toast('Ventas bloqueadas');
    });
  }

  if(UI.venFecha) UI.venFecha.addEventListener('change', refreshVentasCalcUI);
  if(UI.venEfectivo) UI.venEfectivo.addEventListener('input', refreshVentasCalcUI);
  if(UI.venTarjeta) UI.venTarjeta.addEventListener('input', refreshVentasCalcUI);
  if(UI.venGastos) UI.venGastos.addEventListener('input', refreshVentasCalcUI);

  if(UI.btnVenSave){
    UI.btnVenSave.addEventListener('click', ()=>{
      if(!State.session.ventasUnlocked) return;
      const fecha = UI.venFecha?.value || todayISO();
      const tienda = UI.venTienda?.value || 'San Pablo';
      const efectivo = clamp0(UI.venEfectivo?.value);
      const tarjeta = clamp0(UI.venTarjeta?.value);
      const gastos = clamp0(UI.venGastos?.value);
      const total = efectivo + tarjeta;
      const neto = Math.max(0, total - gastos);

      // upsert por fecha+tienda
      const idx = State.ventas.findIndex(v=> v.fecha===fecha && v.tienda===tienda);
      const row = {id: idx>=0 ? State.ventas[idx].id : uid(), fecha, tienda, efectivo, tarjeta, total, gastos, neto, dia: dayNameES(fecha)};
      if(idx>=0) State.ventas[idx] = row;
      else State.ventas.unshift(row);

      save(K.ventas, State.ventas);
      refreshVentasList();
      toast('Venta guardada');
    });
  }

  if(UI.btnVenClear){
    UI.btnVenClear.addEventListener('click', ()=>{
      if(!State.session.ventasUnlocked) return;
      UI.venEfectivo.value = '';
      UI.venTarjeta.value = '';
      UI.venGastos.value = '';
      refreshVentasCalcUI();
    });
  }

  if(UI.venSearch){
    UI.venSearch.addEventListener('input', refreshVentasList);
  }

  if(UI.btnVentasExportCsv){
    UI.btnVentasExportCsv.addEventListener('click', exportVentasCsv);
  }
}

function refreshVentasCalcUI(){
  if(!UI.venFecha) return;
  const fecha = UI.venFecha.value || todayISO();
  if(UI.venDiaSemana) UI.venDiaSemana.textContent = dayNameES(fecha);

  const efectivo = clamp0(UI.venEfectivo?.value);
  const tarjeta = clamp0(UI.venTarjeta?.value);
  const gastos = clamp0(UI.venGastos?.value);
  const total = efectivo + tarjeta;
  const neto = Math.max(0, total - gastos);

  if(UI.venTotal) UI.venTotal.textContent = euro(total);
  if(UI.venNeto) UI.venNeto.textContent = euro(neto);
}

function refreshVentasList(){
  if(!UI.ventasList) return;
  const q = (UI.venSearch?.value||'').trim().toLowerCase();

  const list = State.ventas
    .slice()
    .sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||''))
    .filter(v=>{
      if(!q) return true;
      return (v.fecha||'').toLowerCase().includes(q) ||
             (v.tienda||'').toLowerCase().includes(q);
    });

  UI.ventasList.innerHTML = '';
  if(!list.length){
    const h = document.createElement('div');
    h.className = 'smallHint';
    h.textContent = 'Sin ventas registradas.';
    UI.ventasList.appendChild(h);
    return;
  }

  list.forEach(v=>{
    const item = document.createElement('div');
    item.className = 'tableRow';
    item.innerHTML = `
      <div><strong>${escapeHtml(v.fecha||'')}</strong><div class="smallHint">${escapeHtml(v.dia||'')}</div></div>
      <div>
        <div style="font-weight:700">${escapeHtml(v.tienda||'')}</div>
        <div class="smallHint">Efectivo ${euro(v.efectivo)} · Tarjeta ${euro(v.tarjeta)}</div>
      </div>
      <div><strong>${euro(v.total)}</strong><div class="smallHint">Gastos ${euro(v.gastos)} · Neto ${euro(v.neto)}</div></div>
      <div class="btns">
        <button class="btn ghost sm" data-act="edit">Editar</button>
        <button class="btn ghost sm" data-act="del">Eliminar</button>
      </div>
    `;

    item.querySelector('[data-act="edit"]').addEventListener('click', ()=>{
      if(!State.session.ventasUnlocked) return;
      UI.venFecha.value = v.fecha;
      UI.venTienda.value = v.tienda;
      UI.venEfectivo.value = v.efectivo || '';
      UI.venTarjeta.value = v.tarjeta || '';
      UI.venGastos.value = v.gastos || '';
      refreshVentasCalcUI();
      toast('Editar venta (arriba)');
    });

    item.querySelector('[data-act="del"]').addEventListener('click', ()=>{
      if(!State.session.ventasUnlocked) return;
      if(!confirmBW('¿Eliminar venta?')) return;
      State.ventas = State.ventas.filter(x=> x.id !== v.id);
      save(K.ventas, State.ventas);
      refreshVentasList();
      toast('Venta eliminada');
    });

    UI.ventasList.appendChild(item);
  });
}

function exportVentasCsv(){
  if(!State.session.ventasUnlocked) return;
  const rows = [];
  rows.push(['fecha','dia','tienda','efectivo','tarjeta','total','gastos','neto'].join(';'));
  State.ventas
    .slice()
    .sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''))
    .forEach(v=>{
      rows.push([
        safeCsv(v.fecha),
        safeCsv(v.dia),
        safeCsv(v.tienda),
        num(v.efectivo).toFixed(2),
        num(v.tarjeta).toFixed(2),
        num(v.total).toFixed(2),
        num(v.gastos).toFixed(2),
        num(v.neto).toFixed(2),
      ].join(';'));
    });
  downloadText('ventas_diarias.csv', rows.join('\n'));
}

/* ===========================
   AJUSTES
=========================== */
function bindAjustesEvents(){
  if(UI.btnSaveSettings){
    UI.btnSaveSettings.addEventListener('click', ()=>{
      State.settings.pinCont = (UI.setPinCont?.value||'0000').trim();
      State.settings.ivaPct = clamp0(UI.setIvaPct?.value || 4);
      State.settings.transpPct = clamp0(UI.setTranspPct?.value || 10);
      State.settings.qrBase = (UI.setQrBase?.value||'').trim() || 'NIF={NIF}|NUM={NUM}|FECHA={FECHA}|TOTAL={TOTAL}';

      State.settings.fb.apiKey = (UI.fb_apiKey?.value||'').trim();
      State.settings.fb.authDomain = (UI.fb_authDomain?.value||'').trim();
      State.settings.fb.databaseURL = (UI.fb_databaseURL?.value||'').trim();
      State.settings.fb.projectId = (UI.fb_projectId?.value||'').trim();
      State.settings.fb.storageBucket = (UI.fb_storageBucket?.value||'').trim();
      State.settings.fb.appId = (UI.fb_appId?.value||'').trim();

      save(K.settings, State.settings);
      setSettingsInputs(State.settings);
      const inv = getInvoice(State.currentInvoiceId);
      if(inv){
        recalcInvoice(inv);
        updateQrFromInvoice();
      }
      toast('Ajustes guardados');
    });
  }

  if(UI.btnResetLocal){
    UI.btnResetLocal.addEventListener('click', ()=>{
      // reset seguro: NO borrar vocabulario completo si el usuario no quiere.
      if(!confirmBW('¿Reset local? (Clientes/Facturas/Ventas/Ajustes). Productos se conservan.')) return;

      localStorage.removeItem(K.provider);
      localStorage.removeItem(K.settings);
      localStorage.removeItem(K.clientes);
      localStorage.removeItem(K.facturas);
      localStorage.removeItem(K.ventas);
      localStorage.removeItem(K.session);
      // NO borramos productos ni taras para mantener vocabulario
      // localStorage.removeItem(K.productos);
      // localStorage.removeItem(K.taras);

      // recargar estado base
      State.provider = providerDefaults();
      State.settings = settingsDefaults();
      State.clientes = initialClientes();
      State.facturas = [];
      State.ventas = [];
      State.session = {contUnlocked:false, ventasUnlocked:false};

      save(K.provider, State.provider);
      save(K.settings, State.settings);
      save(K.clientes, State.clientes);
      save(K.facturas, State.facturas);
      save(K.ventas, State.ventas);
      save(K.session, State.session);

      // si no hay productos/taras, crear
      if(!Array.isArray(State.productos) || !State.productos.length){
        State.productos = initialProductos();
        save(K.productos, State.productos);
      }
      if(!Array.isArray(State.taras) || !State.taras.length){
        State.taras = initialTaras();
        save(K.taras, State.taras);
      }

      renderAllBase();
      if(!State.facturas.length){
        const inv = newInvoice();
        State.facturas.unshift(inv);
        save(K.facturas, State.facturas);
      }
      setCurrentInvoice(State.facturas[0].id);
      openInvoice(State.currentInvoiceId);
      refreshInvoiceList();
      refreshClientesTab();
      refreshProductosTab();
      refreshTarasTab();
      refreshVentasList();
      refreshLocksUI();
      toast('Reset completado');
    });
  }

  // CLOUD
  if(UI.btnCloudInit) UI.btnCloudInit.addEventListener('click', cloudInit);
  if(UI.btnCloudLogin) UI.btnCloudLogin.addEventListener('click', cloudLogin);
  if(UI.btnCloudLogout) UI.btnCloudLogout.addEventListener('click', cloudLogout);
  if(UI.btnCloudSync) UI.btnCloudSync.addEventListener('click', cloudSyncAll);
}

/* ===========================
   CLOUD (FIREBASE) OPCIONAL — sin crashear si vacío
   Nota: requiere scripts firebase-app-compat, firebase-auth-compat,
         firebase-database-compat, firebase-storage-compat en index.
=========================== */
function cloudIsConfigured(){
  const fb = State.settings?.fb || {};
  return !!(fb.apiKey && fb.authDomain && fb.databaseURL && fb.projectId && fb.appId);
}

async function cloudInit(){
  try{
    if(!cloudIsConfigured()){
      setCloudBadge('Cloud: OFF (sin config)');
      toast('Cloud no configurado');
      return;
    }
    if(!window.firebase){
      setCloudBadge('Cloud: OFF (firebase no cargado)');
      toast('Falta firebase scripts');
      return;
    }
    // init solo una vez
    if(State.cloud.app){
      setCloudBadge('Cloud: OK');
      toast('Cloud ya inicializado');
      return;
    }

    const fb = State.settings.fb;
    State.cloud.app = window.firebase.initializeApp({
      apiKey: fb.apiKey,
      authDomain: fb.authDomain,
      databaseURL: fb.databaseURL,
      projectId: fb.projectId,
      storageBucket: fb.storageBucket,
      appId: fb.appId
    });

    State.cloud.db = window.firebase.database();
    State.cloud.storage = window.firebase.storage();
    State.cloud.enabled = true;

    setCloudBadge('Cloud: READY');
    toast('Cloud inicializado');
  }catch(e){
    console.error(e);
    setCloudBadge('Cloud: ERROR');
    toast('Error cloud');
  }
}

async function cloudLogin(){
  try{
    await cloudInit();
    if(!State.cloud.enabled){
      toast('Cloud no listo');
      return;
    }
    const email = prompt('Email cloud:');
    if(!email) return;
    const pass = prompt('Password:');
    if(!pass) return;

    const auth = window.firebase.auth();
    const res = await auth.signInWithEmailAndPassword(email, pass).catch(async ()=>{
      // si no existe, crear
      return await auth.createUserWithEmailAndPassword(email, pass);
    });
    State.cloud.user = res.user;
    setCloudBadge('Cloud: ON');
    toast('Cloud login OK');
  }catch(e){
    console.error(e);
    toast('Login cloud error');
  }
}

async function cloudLogout(){
  try{
    if(window.firebase?.auth){
      await window.firebase.auth().signOut();
    }
    State.cloud.user = null;
    setCloudBadge(State.cloud.enabled ? 'Cloud: READY' : 'Cloud: OFF');
    toast('Cloud logout');
  }catch{
    toast('Logout error');
  }
}

function cloudPath(){
  const uidv = State.cloud.user?.uid;
  return uidv ? `factumiral/${uidv}` : null;
}

async function cloudSyncAll(){
  try{
    await cloudInit();
    if(!State.cloud.enabled || !State.cloud.user){
      toast('Cloud: inicia sesión');
      return;
    }
    const base = cloudPath();
    if(!base) return;

    // sube datos locales a nube (simple)
    await State.cloud.db.ref(`${base}/clientes`).set(State.clientes);
    await State.cloud.db.ref(`${base}/productos`).set(State.productos);
    await State.cloud.db.ref(`${base}/taras`).set(State.taras);
    await State.cloud.db.ref(`${base}/facturas`).set(State.facturas);
    await State.cloud.db.ref(`${base}/settings`).set(State.settings);

    toast('Sync cloud OK');
  }catch(e){
    console.error(e);
    toast('Sync cloud error');
  }
}

async function cloudUploadPdf(inv, blob, filename){
  try{
    await cloudInit();
    if(!State.cloud.enabled || !State.cloud.user){
      toast('Cloud: inicia sesión');
      return;
    }
    const base = cloudPath();
    const storagePath = `${base}/pdfs/${filename}`;
    if(!State.cloud.storage){
      toast('Storage no disponible');
      return;
    }
    const ref = State.cloud.storage.ref(storagePath);
    await ref.put(blob, {contentType:'application/pdf'});
    const url = await ref.getDownloadURL();

    inv.pdfUrl = url;
    inv.updatedAt = Date.now();
    save(K.facturas, State.facturas);

    // guardar solo metadatos (opcional)
    await State.cloud.db.ref(`${base}/pdfIndex/${inv.id}`).set({
      id: inv.id,
      numero: inv.numero,
      fecha: inv.fecha,
      cliente: inv.clienteSnapshot?.nombre || '',
      tags: inv.tags || '',
      total: num(inv._calc?.total ?? 0),
      url
    });

    toast('PDF subido a cloud');
  }catch(e){
    console.error(e);
    toast('Error subiendo PDF');
  }
}

/* ===========================
   OPEN PDF desde cloud (si existe)
=========================== */
function tryOpenCloudPdf(inv){
  if(inv?.pdfUrl){
    openPdfModal(inv.pdfUrl);
    return true;
  }
  return false;
}

/* ===========================
   FACTURAS LIST: botón Ver PDF usa cloud si existe
   (mejora: ya enlazado en 3B, aquí extendemos)
=========================== */
(function patchViewPdfPreferCloud(){
  const old = onViewPdf;
  onViewPdf = function(){
    const inv = getInvoice(State.currentInvoiceId);
    if(inv && inv.pdfUrl){
      openPdfModal(inv.pdfUrl);
      toast('PDF (cloud)');
      return;
    }
    old();
  };
})();

// ====== FIN PATCHES ======

})(); // ✅ cierre IIFE principal (porque tu app.js empieza con (function(){ )
