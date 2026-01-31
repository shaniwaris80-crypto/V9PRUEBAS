/* =========================================================
PARTE 3A/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3A: base app + storage + helpers + modelos + defaults (proveedor/clientes/productos)
- Importante: 3A NO ejecuta init para que no dé errores sin 3B/3C.
========================================================= */

(() => {
  'use strict';

  /* =========================================================
     NAMESPACE GLOBAL
  ========================================================== */
  const FM = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  FM.VERSION = 'FACTU MIRAL v1.0 (B/W PRO)';
  FM.BUILD = 'app.js 3A';

  /* =========================================================
     STORAGE KEYS (LOCAL)
  ========================================================== */
  const K = {
    AJUSTES:   'factu_miral_ajustes_v1',
    PROVEEDOR: 'factu_miral_proveedor_v1',
    CLIENTES:  'factu_miral_clientes_v1',
    PRODUCTOS: 'factu_miral_productos_v1',
    TARAS:     'factu_miral_taras_v1',
    FACTURAS:  'factu_miral_facturas_v1',
    VENTAS:    'factu_miral_ventas_v1',
    CLOUDCFG:  'factu_miral_firebase_cfg_v1',
    SESSION:   'factu_miral_session_v1'
  };
  FM.K = K;

  /* =========================================================
     HELPERS DOM
  ========================================================== */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const setText = (el, t) => { if (el) el.textContent = (t ?? ''); };

  FM.$ = $; FM.$$ = $$;

  /* =========================================================
     HELPERS FORMAT / DATE / NUM
  ========================================================== */
  const pad2 = (n) => String(n).padStart(2, '0');

  function nowStampForId(d = new Date()){
    // FA-YYYYMMDDHHMM
    const y = d.getFullYear();
    const m = pad2(d.getMonth()+1);
    const da = pad2(d.getDate());
    const h = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${y}${m}${da}${h}${mi}`;
  }

  function makeInvoiceNumber(){
    return `FA-${nowStampForId(new Date())}`;
  }

  function isoDate(d = new Date()){
    const y = d.getFullYear();
    const m = pad2(d.getMonth()+1);
    const da = pad2(d.getDate());
    return `${y}-${m}-${da}`;
  }

  function fmtESDate(iso){ // "YYYY-MM-DD" -> "dd/mm/aaaa"
    if(!iso) return '';
    const [y,m,d] = String(iso).slice(0,10).split('-');
    if(!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  }

  function parseNum(v){
    if(v === null || v === undefined) return 0;
    if(typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).trim().replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function round2(n){
    n = parseNum(n);
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function moneyES(n){
    n = round2(n);
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function clamp(n, a, b){
    n = parseNum(n);
    return Math.min(b, Math.max(a, n));
  }

  function dayNameES(d = new Date()){
    const names = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return names[d.getDay()];
  }

  FM.util = {
    pad2, nowStampForId, makeInvoiceNumber, isoDate, fmtESDate,
    parseNum, round2, moneyES, clamp, dayNameES
  };

  /* =========================================================
     UID
  ========================================================== */
  function uid(){
    // corto y robusto
    return 'id_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }
  FM.uid = uid;

  /* =========================================================
     SAFE STORAGE
  ========================================================== */
  function load(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw === null || raw === undefined || raw === '') return fallback;
      const v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    }catch(e){
      return fallback;
    }
  }

  function save(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function del(key){
    localStorage.removeItem(key);
  }

  FM.store = { load, save, del };

  /* =========================================================
     TOAST (no error si falta #toast)
  ========================================================== */
  let toastTimer = null;
  function toast(msg, ms = 1800){
    const el = $('#toast');
    if(!el) return;
    el.textContent = String(msg ?? '');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, ms);
  }
  FM.toast = toast;

  /* =========================================================
     MODALS (PIN / PDF)
  ========================================================== */
  function openModal(id){
    const m = $(id);
    if(!m) return;
    m.setAttribute('aria-hidden','false');
  }
  function closeModal(id){
    const m = $(id);
    if(!m) return;
    m.setAttribute('aria-hidden','true');
  }
  FM.modal = { openModal, closeModal };

  /* =========================================================
     AJUSTES DEFAULTS
  ========================================================== */
  function defaultAjustes(){
    return {
      ivaPct: 4,            // IVA por defecto 4%
      transportePct: 10,    // Transporte por defecto 10%
      pin: '8410',          // PIN Contabilidad/Ventas
      qrTemplate: 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}',
      seriesMode: 'timestamp', // futuro: 'FA-2026-000123'
      build: FM.VERSION
    };
  }

  /* =========================================================
     PROVEEDOR DEFAULT (tus datos)
  ========================================================== */
  function defaultProveedor(){
    return {
      nombre: 'Mohammad Arslan Waris',
      nif: 'X6389988J',
      dir: 'Calle San Pablo 17, 09003 Burgos',
      tel: '631 667 893',
      email: 'shaniwaris80@gmail.com'
    };
  }

  /* =========================================================
     CLIENTES DEFAULT (precargados)
  ========================================================== */
  function defaultClientes(){
    return [
      {id: uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo'},
      {id: uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
      {id: uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
      {id: uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
      {id: uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
      {id: uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
      {id: uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
      {id: uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', email:'info@restaurantelosbraseros.com'},
      {id: uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', email:'info@hotelcordon.com'}
    ].map(c => ({
      id: c.id,
      nombre: c.nombre ?? '',
      alias: c.alias ?? '',
      nif: c.nif ?? '',
      dir: c.dir ?? '',
      tel: c.tel ?? '',
      email: c.email ?? '',
      notas: c.notas ?? '',
      tpl: {
        ivaIncluido: !!c.ivaIncluido,
        transporte: !!c.transporte,
        pago: (c.pago ?? ''),
        tagsAuto: c.tagsAuto ?? '',
        notasStd: c.notasStd ?? ''
      }
    }));
  }

  /* =========================================================
     PRODUCTOS DEFAULT (VOCABULARIO SIEMPRE CARGADO)
     Nota: se cargan como productos base (modo/precios vacíos),
     y luego podrás editar precios, kg/caja, origen, tara default, etc.
  ========================================================== */
  const DEFAULT_PRODUCT_NAMES = [
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

  function defaultProductos(){
    // base: un producto por nombre, sin precios ni datos
    // (luego el usuario completa: modo, kg/caja, precios, coste, origen, tara default)
    const seen = new Set();
    const list = [];
    for(const name of DEFAULT_PRODUCT_NAMES){
      const n = String(name ?? '').trim();
      if(!n) continue;
      const key = n.toUpperCase();
      if(seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: uid(),
        nombre: n,
        modo: 'kg',            // por defecto, editable
        kgCaja: 0,
        precioKg: 0,
        precioCaja: 0,
        precioUd: 0,
        coste: 0,
        origen: '',
        taraDefaultId: '',
        hist: []               // últimas 5, solo pantalla
      });
    }
    return list;
  }

  /* =========================================================
     MODELOS (FACTURA / LÍNEA / PAGO / VENTAS)
     Nota: las funciones de cálculo y render completo vienen en 3B/3C.
  ========================================================== */
  function makeLinea(){
    return {
      id: uid(),
      producto: '',
      modo: 'kg',        // kg/caja/ud
      cantidad: 0,       // nº unidades/cajas o nº envases (según modo)
      bruto: 0,          // kg bruto (modo kg)
      taraId: '',        // selector de tara
      envases: 0,        // nº envases (para calcular tara total)
      taraKg: 0,         // tara total (kg) (auto o manual)
      neto: 0,           // neto (kg) (auto o manual)
      netoManual: false, // si el usuario tocó neto
      precio: 0,         // según modo
      origen: '',
      importe: 0         // calculado
    };
  }

  function makeFactura(){
    const d = new Date();
    return {
      id: uid(),
      numero: makeInvoiceNumber(),
      fecha: isoDate(d),
      tags: '',
      notasInternas: '',
      observaciones: '',
      clienteId: '',
      cliente: { nombre:'', nif:'', dir:'', tel:'', email:'' },

      transporteOn: false,
      ivaIncluido: false,

      metodoPago: 'efectivo',
      estado: 'impagada',
      pagos: [],

      lineas: [makeLinea(), makeLinea(), makeLinea(), makeLinea(), makeLinea()], // ✅ 5 líneas por defecto

      subtotal: 0,
      transporte: 0,
      iva: 0,
      total: 0,
      pendiente: 0,

      qrText: '',
      pdfUrl: '' // si cloud
    };
  }

  function makePago(){
    return { id: uid(), importe: 0, fecha: isoDate(new Date()) };
  }

  function makeVenta(){
    const d = new Date();
    return {
      id: uid(),
      tienda: 'san_pablo',
      fecha: isoDate(d),
      diaSemana: dayNameES(d),
      efectivo: 0,
      tarjeta: 0,
      gastos: 0,
      notas: ''
    };
  }

  FM.model = { makeLinea, makeFactura, makePago, makeVenta };

  /* =========================================================
     SESSION / LOCKS
  ========================================================== */
  function defaultSession(){
    return {
      unlocked: {
        contabilidad: false,
        ventas: false
      }
    };
  }

  /* =========================================================
     STATE (en memoria)
  ========================================================== */
  const state = {
    ajustes: defaultAjustes(),
    proveedor: defaultProveedor(),
    clientes: [],
    productos: [],
    taras: [],
    facturas: [],
    facturaActualId: '',
    ventas: [],
    session: defaultSession(),
    cloud: {
      enabled: false,
      ready: false,
      user: null,
      cfg: null
    }
  };
  FM.state = state;

  /* =========================================================
     SEED / BOOTSTRAP DATA (sin ejecutar UI todavía)
  ========================================================== */
  function ensureDataSeed(){
    // Ajustes
    const aj = load(K.AJUSTES, null);
    if(!aj){
      state.ajustes = defaultAjustes();
      save(K.AJUSTES, state.ajustes);
    }else{
      state.ajustes = Object.assign(defaultAjustes(), aj);
    }

    // Proveedor
    const pr = load(K.PROVEEDOR, null);
    if(!pr){
      state.proveedor = defaultProveedor();
      save(K.PROVEEDOR, state.proveedor);
    }else{
      state.proveedor = Object.assign(defaultProveedor(), pr);
    }

    // Clientes
    const cl = load(K.CLIENTES, null);
    if(!cl || !Array.isArray(cl) || cl.length === 0){
      state.clientes = defaultClientes();
      save(K.CLIENTES, state.clientes);
    }else{
      state.clientes = cl;
    }

    // Productos
    const prd = load(K.PRODUCTOS, null);
    if(!prd || !Array.isArray(prd) || prd.length === 0){
      state.productos = defaultProductos();
      save(K.PRODUCTOS, state.productos);
    }else{
      state.productos = prd;
    }

    // Taras
    const tr = load(K.TARAS, []);
    state.taras = Array.isArray(tr) ? tr : [];
    save(K.TARAS, state.taras);

    // Facturas
    const fa = load(K.FACTURAS, []);
    state.facturas = Array.isArray(fa) ? fa : [];
    save(K.FACTURAS, state.facturas);

    // Ventas
    const ve = load(K.VENTAS, []);
    state.ventas = Array.isArray(ve) ? ve : [];
    save(K.VENTAS, state.ventas);

    // Session
    const se = load(K.SESSION, null);
    state.session = se ? Object.assign(defaultSession(), se) : defaultSession();
    save(K.SESSION, state.session);

    // Cloud config (no habilita cloud)
    const cc = load(K.CLOUDCFG, null);
    state.cloud.cfg = cc || null;
  }

  /* =========================================================
     PROVEEDOR: set defaults si inputs vacíos (según tu snippet)
  ========================================================== */
  function setProviderDefaultsIfEmpty(){
    const p = state.proveedor || defaultProveedor();
    // Si los inputs no existen aún, no hace nada (sin error).
    if($('#provNombre') && !$('#provNombre').value) $('#provNombre').value = p.nombre || 'Mohammad Arslan Waris';
    if($('#provNif')    && !$('#provNif').value)    $('#provNif').value    = p.nif    || 'X6389988J';
    if($('#provDir')    && !$('#provDir').value)    $('#provDir').value    = p.dir    || 'Calle San Pablo 17, 09003 Burgos';
    if($('#provTel')    && !$('#provTel').value)    $('#provTel').value    = p.tel    || '631 667 893';
    if($('#provEmail')  && !$('#provEmail').value)  $('#provEmail').value  = p.email  || 'shaniwaris80@gmail.com';
  }
  FM.setProviderDefaultsIfEmpty = setProviderDefaultsIfEmpty;

  /* =========================================================
     HOOKS (para que 3B/3C añadan lógica sin romper cierres)
  ========================================================== */
  const hooks = {
    onInit: [],
    afterInit: [],
    onTabChange: [],
    onFacturaLoaded: [],
    onFacturaChanged: []
  };
  FM.hooks = hooks;

  function runHooks(name, ...args){
    const list = hooks[name];
    if(!Array.isArray(list)) return;
    for(const fn of list){
      try{ fn(...args); }catch(e){ /* silencioso */ }
    }
  }
  FM.runHooks = runHooks;

  /* =========================================================
     NAV TABS (base, sin lógica de contabilidad/ventas todavía)
  ========================================================== */
  function showTab(tabId){
    const pages = $$('.tabPage');
    const tabs  = $$('.tab');

    for(const p of pages){
      p.classList.toggle('isActive', p.id === tabId);
    }
    for(const t of tabs){
      t.classList.toggle('isActive', t.dataset.tab === tabId);
      t.setAttribute('aria-selected', t.dataset.tab === tabId ? 'true' : 'false');
    }
    runHooks('onTabChange', tabId);
  }
  FM.showTab = showTab;

  /* =========================================================
     DIAGNÓSTICO BOX
  ========================================================== */
  function renderDiag(){
    const el = $('#diagBox');
    if(!el) return;
    const lines = [];
    lines.push(`${FM.VERSION}`);
    lines.push(`Build: ${FM.BUILD}`);
    lines.push(`LocalStorage: ${safeLocalStorage() ? 'OK' : 'NO'}`);
    lines.push(`Clientes: ${state.clientes.length}`);
    lines.push(`Productos: ${state.productos.length}`);
    lines.push(`Taras: ${state.taras.length}`);
    lines.push(`Facturas: ${state.facturas.length}`);
    lines.push(`Ventas: ${state.ventas.length}`);
    lines.push(`Cloud cfg: ${state.cloud.cfg ? 'CARGADA' : 'VACIA'}`);
    lines.push(`PIN: ${String(state.ajustes.pin ?? '8410')}`);
    el.textContent = lines.join('\n');
  }

  function safeLocalStorage(){
    try{
      const k = '__fm_test__';
      localStorage.setItem(k,'1');
      localStorage.removeItem(k);
      return true;
    }catch(e){
      return false;
    }
  }
  FM.renderDiag = renderDiag;

  /* =========================================================
     API: CREAR/OBTENER FACTURA ACTUAL (sin render todavía)
  ========================================================== */
  function getFacturaById(id){
    return state.facturas.find(f => f.id === id) || null;
  }

  function setFacturaActual(id){
    state.facturaActualId = id || '';
    save(K.SESSION, state.session); // mantiene sesión (por si se usa después)
  }

  function getFacturaActual(){
    if(state.facturaActualId){
      const f = getFacturaById(state.facturaActualId);
      if(f) return f;
    }
    // si no hay, crear una y seleccionarla
    const f = makeFactura();
    state.facturas.unshift(f);
    state.facturaActualId = f.id;
    save(K.FACTURAS, state.facturas);
    return f;
  }

  FM.facturas = {
    getFacturaById,
    setFacturaActual,
    getFacturaActual
  };

  /* =========================================================
     INIT (NO se ejecuta aquí; se ejecutará al final de 3C)
  ========================================================== */
  function initBase(){
    ensureDataSeed();

    // Indicadores (si existen)
    const dotLocal = $('#dotLocal');
    const pillLocal = $('#pillLocal');
    if(dotLocal) dotLocal.className = 'dot ok';
    if(pillLocal) pillLocal.title = 'LocalStorage OK';

    // Rellenar ajustes UI si existen
    if($('#ajIva')) $('#ajIva').value = String(state.ajustes.ivaPct ?? 4);
    if($('#ajTransporte')) $('#ajTransporte').value = String(state.ajustes.transportePct ?? 10);
    if($('#ajPin')) $('#ajPin').value = String(state.ajustes.pin ?? '8410');
    if($('#ajQrPlantilla')) $('#ajQrPlantilla').value = String(state.ajustes.qrTemplate ?? defaultAjustes().qrTemplate);

    // Cargar proveedor en inputs (si existen)
    if($('#provNombre')) $('#provNombre').value = state.proveedor.nombre || '';
    if($('#provNif')) $('#provNif').value = state.proveedor.nif || '';
    if($('#provDir')) $('#provDir').value = state.proveedor.dir || '';
    if($('#provTel')) $('#provTel').value = state.proveedor.tel || '';
    if($('#provEmail')) $('#provEmail').value = state.proveedor.email || '';
    setProviderDefaultsIfEmpty();

    // Factura actual asegurada (5 líneas por defecto)
    const f = getFacturaActual();
    // Pintar cabecera nº/fecha (si existen; sin cálculos ni grid aún)
    if($('#factNumero')) setText($('#factNumero'), f.numero || '');
    if($('#inpNumeroFactura')) $('#inpNumeroFactura').value = f.numero || '';
    if($('#inpFechaFactura')) $('#inpFechaFactura').value = f.fecha || isoDate(new Date());
    if($('#inpTags')) $('#inpTags').value = f.tags || '';
    if($('#inpNotasInternas')) $('#inpNotasInternas').value = f.notasInternas || '';
    if($('#inpObservaciones')) $('#inpObservaciones').value = f.observaciones || '';
    if($('#selMetodoPago')) $('#selMetodoPago').value = f.metodoPago || 'efectivo';
    if($('#selEstadoFactura')) $('#selEstadoFactura').value = f.estado || 'impagada';
    if($('#chkTransporte')) $('#chkTransporte').checked = !!f.transporteOn;
    if($('#chkIvaIncluido')) $('#chkIvaIncluido').checked = !!f.ivaIncluido;

    // Ventas: fecha y día semana
    if($('#vFecha')) $('#vFecha').value = isoDate(new Date());
    if($('#vDiaSemana')) $('#vDiaSemana').value = dayNameES(new Date());

    // Tabs base
    on(document, 'click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('.tab') : null;
      if(!btn) return;
      const tabId = btn.dataset.tab;
      if(!tabId) return;
      showTab(tabId);
    });

    // Cerrar modales por backdrop
    on(document, 'click', (ev) => {
      const t = ev.target;
      if(!(t instanceof Element)) return;
      const closePin = t.getAttribute('data-close') === 'pin';
      const closePdf = t.getAttribute('data-close') === 'pdf';
      if(closePin) closeModal('#pinModal');
      if(closePdf) closeModal('#pdfModal');
    });

    // Botón PIN abre modal (validación real en 3C)
    on($('#btnLockPanel'), 'click', () => openModal('#pinModal'));
    on($('#btnPinCancel'), 'click', () => closeModal('#pinModal'));

    // Botón buscar (Ctrl+F en listados) — lógica final en 3C
    on($('#btnQuickSearch'), 'click', () => {
      const active = $('.tab.isActive');
      const tabId = active ? active.dataset.tab : '';
      if(tabId === 'tabFacturas' && $('#buscarFacturas')) $('#buscarFacturas').focus();
      else if(tabId === 'tabClientes' && $('#buscarClientes')) $('#buscarClientes').focus();
      else if(tabId === 'tabProductos' && $('#buscarProductos')) $('#buscarProductos').focus();
      else if(tabId === 'tabTaras' && $('#buscarTaras')) $('#buscarTaras').focus();
      else toast('Buscar: abre Facturas/Clientes/Productos/Taras');
    });

    renderDiag();

    runHooks('onInit');
  }

  FM.initBase = initBase;

})();
/* =========================================================
PARTE 3B/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3B: Factura + GRID PRO + Autocomplete manual + Taras aplicadas + Cálculos correctos + WhatsApp
- Importante: NO ejecuta init final (eso va en 3C)
========================================================= */

(() => {
  'use strict';

  const FM = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  FM.BUILD = 'app.js 3B';

  const $ = FM.$;
  const $$ = FM.$$;
  const { load, save } = FM.store;
  const { parseNum, round2, moneyES, fmtESDate, isoDate } = FM.util;

  /* =========================================================
     HELPERS
  ========================================================== */
  function deepClone(o){
    return JSON.parse(JSON.stringify(o));
  }

  function esc(s){
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'","&#039;");
  }

  function normalizeUpper(s){
    return (s ?? '').toString().trim().toUpperCase();
  }

  function isEmptyStr(s){
    return !String(s ?? '').trim();
  }

  function todayISO(){
    return isoDate(new Date());
  }

  function byNameContains(list, q){
    q = normalizeUpper(q);
    if(!q) return list.slice(0, 30);
    const out = [];
    for(const it of list){
      const n = normalizeUpper(it.nombre || it);
      if(n.includes(q)) out.push(it);
      if(out.length >= 30) break;
    }
    return out;
  }

  function findProductoByName(name){
    const n = normalizeUpper(name);
    if(!n) return null;
    return FM.state.productos.find(p => normalizeUpper(p.nombre) === n) || null;
  }

  function findTaraById(id){
    if(!id) return null;
    return FM.state.taras.find(t => t.id === id) || null;
  }

  function computeIvaInternoSiIncluido(totalConIva, ivaPct){
    const t = parseNum(totalConIva);
    const p = parseNum(ivaPct) / 100;
    if(t <= 0 || p <= 0) return 0;
    const base = t / (1 + p);
    return round2(t - base);
  }

  function safeFocus(el){
    try{ el && el.focus && el.focus(); }catch(e){}
  }

  /* =========================================================
     STATE SHORTCUTS
  ========================================================== */
  const S = FM.state;
  const K = FM.K;

  /* =========================================================
     AUTOCOMPLETE (manual, NO sustituye texto automáticamente)
  ========================================================== */
  const AC = {
    open: false,
    anchorRect: null,
    items: [],
    activeIndex: 0,
    forInput: null,
    forLineId: null
  };

  function acClose(){
    const pop = $('#acPopup');
    if(pop){
      pop.setAttribute('aria-hidden','true');
      pop.style.display = 'none';
    }
    AC.open = false;
    AC.items = [];
    AC.activeIndex = 0;
    AC.forInput = null;
    AC.forLineId = null;
  }

  function acOpenFor(inputEl, lineId, query){
    const pop = $('#acPopup');
    if(!pop || !inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    AC.anchorRect = rect;
    AC.forInput = inputEl;
    AC.forLineId = lineId;

    const list = S.productos.map(p => p);
    const hits = byNameContains(list, query);
    AC.items = hits;
    AC.activeIndex = 0;

    if(hits.length === 0){
      acClose();
      return;
    }

    // Render
    const html = hits.map((p, i) => {
      const prod = (typeof p === 'string') ? { nombre: p } : p;
      const right = hintPriceForProduct(prod);
      return `<div class="acItem ${i===0?'isActive':''}" data-i="${i}">
        <div class="acLeft">${esc(prod.nombre)}</div>
        <div class="acRight">${esc(right)}</div>
      </div>`;
    }).join('');
    pop.innerHTML = html;

    // Position (below input)
    const top = Math.min(window.innerHeight - 20, rect.bottom + 8);
    let left = rect.left;
    const maxW = Math.min(520, window.innerWidth - 24);
    // keep within viewport
    if(left + maxW > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - maxW);

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.display = 'block';
    pop.setAttribute('aria-hidden','false');
    AC.open = true;
  }

  function acMove(dir){
    if(!AC.open) return;
    const pop = $('#acPopup');
    if(!pop) return;
    AC.activeIndex = clampIndex(AC.activeIndex + dir, 0, AC.items.length - 1);
    $$('.acItem', pop).forEach((it, idx) => it.classList.toggle('isActive', idx === AC.activeIndex));
    const active = $(`.acItem[data-i="${AC.activeIndex}"]`, pop);
    if(active) active.scrollIntoView({ block:'nearest' });
  }

  function clampIndex(n, a, b){
    if(n < a) return a;
    if(n > b) return b;
    return n;
  }

  function acPick(index){
    if(!AC.open) return;
    const p = AC.items[index];
    if(!p) return;
    const prod = (typeof p === 'string') ? { nombre: p } : p;

    // No sustituye automáticamente el texto salvo que el usuario elija explícitamente (enter/click)
    const lineId = AC.forLineId;
    if(!lineId) { acClose(); return; }

    const f = FM.facturas.getFacturaActual();
    const line = f.lineas.find(l => l.id === lineId);
    if(!line){ acClose(); return; }

    line.producto = prod.nombre || '';
    applyProductDefaultsToLine(line, prod);

    // Refrescar grid y recalcular
    renderGridPro(f);
    recalcFactura(f, true);
    saveFacturaToState(f);

    acClose();
  }

  function hintPriceForProduct(prod){
    const p = prod || {};
    const modo = (p.modo || 'kg');
    // Hint: últimos 1-2 precios o precio por modo
    if(Array.isArray(p.hist) && p.hist.length){
      const last = p.hist[0];
      const v = (last && last.precio !== undefined) ? parseNum(last.precio) : 0;
      if(v > 0) return `último: ${v}`;
    }
    if(modo === 'kg' && parseNum(p.precioKg) > 0) return `kg: ${parseNum(p.precioKg)}`;
    if(modo === 'caja' && parseNum(p.precioCaja) > 0) return `caja: ${parseNum(p.precioCaja)}`;
    if(modo === 'ud' && parseNum(p.precioUd) > 0) return `ud: ${parseNum(p.precioUd)}`;
    return 'sin precio';
  }

  /* =========================================================
     PRODUCT DEFAULTS -> LINE
  ========================================================== */
  function applyProductDefaultsToLine(line, prod){
    if(!line || !prod) return;

    // Modo por defecto
    if(isEmptyStr(line.modo)) line.modo = prod.modo || 'kg';

    // Origen (solo si vacío)
    if(isEmptyStr(line.origen) && prod.origen) line.origen = prod.origen;

    // Tara default (si existe y línea sin tara)
    if(isEmptyStr(line.taraId) && prod.taraDefaultId) line.taraId = prod.taraDefaultId;

    // Precio según modo (si precio actual 0)
    const modo = line.modo || 'kg';
    if(parseNum(line.precio) <= 0){
      if(modo === 'kg'  && parseNum(prod.precioKg)  > 0) line.precio = parseNum(prod.precioKg);
      if(modo === 'caja'&& parseNum(prod.precioCaja)> 0) line.precio = parseNum(prod.precioCaja);
      if(modo === 'ud'  && parseNum(prod.precioUd)  > 0) line.precio = parseNum(prod.precioUd);
    }

    // Si modo=caja y kgCaja existe -> neto informativo (si no manual)
    if(modo === 'caja' && parseNum(prod.kgCaja) > 0 && !line.netoManual){
      line.neto = round2(parseNum(line.cantidad) * parseNum(prod.kgCaja));
    }

    // Autorelleno envases recomendado:
    // - si modo=caja -> envases=cantidad
    // - si modo=kg -> envases=cantidad (si envases vacíos)
    if(parseNum(line.envases) <= 0){
      if(modo === 'caja' || modo === 'kg'){
        const c = parseNum(line.cantidad);
        if(c > 0) line.envases = c;
      }
    }

    // Aplicar tara automática si hay taraId
    applyTaraAutoToLine(line);
  }

  function applyTaraAutoToLine(line){
    if(!line) return;
    const tara = findTaraById(line.taraId);
    if(!tara) return;

    const u = parseNum(tara.peso ?? tara.pesoKg ?? tara.kg ?? tara.tara ?? 0);
    const env = parseNum(line.envases);
    const totalTara = round2(u * env);

    // Si el usuario NO ha escrito tara manualmente, aplicamos
    if(!line.taraManual){
      line.taraKg = totalTara;
    }
  }

  /* =========================================================
     GRID PRO RENDER
  ========================================================== */
  function renderTarasOptions(selectedId){
    const opts = [];
    opts.push(`<option value="">—</option>`);
    for(const t of S.taras){
      const name = `${t.nombre ?? ''}`.trim();
      const w = parseNum(t.peso ?? t.pesoKg ?? t.kg ?? 0);
      const lab = name ? `${name} (${w.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2})} kg)` : `(tara ${w})`;
      const sel = (t.id === selectedId) ? 'selected' : '';
      opts.push(`<option value="${esc(t.id)}" ${sel}>${esc(lab)}</option>`);
    }
    return opts.join('');
  }

  function renderClientesSelect(f){
    const sel = $('#selCliente');
    if(!sel) return;
    const cur = f.clienteId || '';
    const items = ['<option value="">— Selecciona —</option>'];
    for(const c of S.clientes){
      const t = `${c.nombre ?? ''}`.trim();
      const extra = c.nif ? ` · ${c.nif}` : '';
      const selAttr = (c.id === cur) ? 'selected' : '';
      items.push(`<option value="${esc(c.id)}" ${selAttr}>${esc(t + extra)}</option>`);
    }
    sel.innerHTML = items.join('');
  }

  function renderProductoTaraDefaultSelect(prod){
    const sel = $('#pTaraDefault');
    if(!sel) return;
    const cur = prod ? (prod.taraDefaultId || '') : '';
    const items = ['<option value="">— Sin envase —</option>'];
    for(const t of S.taras){
      const name = `${t.nombre ?? ''}`.trim();
      const w = parseNum(t.peso ?? t.pesoKg ?? t.kg ?? 0);
      const lab = name ? `${name} (${w.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2})} kg)` : `(tara ${w})`;
      const selAttr = (t.id === cur) ? 'selected' : '';
      items.push(`<option value="${esc(t.id)}" ${selAttr}>${esc(lab)}</option>`);
    }
    sel.innerHTML = items.join('');
  }

  function renderGridPro(f){
    const body = $('#gridProBody');
    if(!body) return;

    // Asegurar 5 líneas mínimo
    if(!Array.isArray(f.lineas)) f.lineas = [];
    while(f.lineas.length < 5){
      f.lineas.push(FM.model.makeLinea());
    }

    const rows = f.lineas.map((l, idx) => {
      const prodName = l.producto ?? '';
      const modo = l.modo || 'kg';
      const cant = (l.cantidad ?? 0);
      const bruto = (l.bruto ?? 0);
      const env = (l.envases ?? 0);
      const taraKg = (l.taraKg ?? 0);
      const neto = (l.neto ?? 0);
      const precio = (l.precio ?? 0);
      const origen = l.origen ?? '';
      const importe = (l.importe ?? 0);

      // Hint (último precio / modo) — SOLO pantalla
      const pObj = findProductoByName(prodName);
      const hint = pObj ? hintPriceForProduct(pObj) : '';

      return `
      <div class="gridRow" data-line-id="${esc(l.id)}" data-idx="${idx}">
        <div class="cell">
          <div style="width:100%">
            <input class="inProducto" type="text" placeholder="Producto..." value="${esc(prodName)}" autocomplete="off" spellcheck="false" />
            <div class="small muted" style="margin-top:6px; display:flex; justify-content:space-between; gap:10px;">
              <span>${esc(hint ? `Último: ${hint}` : '')}</span>
              <span class="mono">${esc(modo.toUpperCase())}</span>
            </div>
          </div>
        </div>

        <div class="cell">
          <select class="inModo">
            <option value="kg" ${modo==='kg'?'selected':''}>kg</option>
            <option value="caja" ${modo==='caja'?'selected':''}>caja</option>
            <option value="ud" ${modo==='ud'?'selected':''}>ud</option>
          </select>
        </div>

        <div class="cell">
          <input class="inCant monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(cant)}" />
        </div>

        <div class="cell">
          <input class="inBruto monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(bruto)}" />
        </div>

        <div class="cell">
          <select class="inTaraSel">
            ${renderTarasOptions(l.taraId || '')}
          </select>
        </div>

        <div class="cell">
          <input class="inEnv monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(env)}" />
        </div>

        <div class="cell">
          <input class="inTaraKg monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(taraKg)}" />
        </div>

        <div class="cell">
          <input class="inNeto monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(neto)}" />
        </div>

        <div class="cell">
          <input class="inPrecio monoIn" type="number" inputmode="decimal" step="0.01" value="${esc(precio)}" />
        </div>

        <div class="cell">
          <input class="inOrigen" type="text" value="${esc(origen)}" placeholder="Origen" />
        </div>

        <div class="cell">
          <div class="importeBox">${moneyES(importe)}</div>
        </div>

        <div class="cell center">
          <button class="btnDel" type="button" title="Eliminar línea">×</button>
        </div>
      </div>`;
    }).join('');

    body.innerHTML = rows;
  }

  /* =========================================================
     CALCULOS CORRECTOS (KG/CAJA/UD) + VALIDACIONES
  ========================================================== */
  function recalcLinea(line){
    // Devuelve warnings
    const warn = {
      taraGtBruto: false,
      netoGtBruto: false,
      precioVacio: false
    };

    const modo = (line.modo || 'kg');
    const cantidad = parseNum(line.cantidad);
    const bruto = parseNum(line.bruto);
    const precio = parseNum(line.precio);

    // Autorelleno envases recomendado:
    // Si envases vacíos y modo=caja o kg, ponemos envases=cantidad (pero sin pisar si ya hay)
    if(parseNum(line.envases) <= 0 && (modo === 'caja' || modo === 'kg') && cantidad > 0){
      line.envases = cantidad;
    }

    // Tara auto (si hay selector y no manual)
    if(line.taraId){
      applyTaraAutoToLine(line);
    }

    // MODO KG:
    if(modo === 'kg'){
      const tara = parseNum(line.taraKg);
      if(!line.netoManual){
        line.neto = round2(bruto - tara);
      }
      // Validaciones
      if(tara > bruto && bruto > 0) warn.taraGtBruto = true;
      if(parseNum(line.neto) > bruto && bruto > 0) warn.netoGtBruto = true;

      // Importe: neto * precio/kg
      line.importe = round2(parseNum(line.neto) * precio);
      if(precio <= 0) warn.precioVacio = true;
    }

    // MODO CAJA:
    if(modo === 'caja'){
      // Importe: cantidad * precio/caja
      line.importe = round2(cantidad * precio);
      if(precio <= 0) warn.precioVacio = true;

      // Neto informativo si producto tiene kg/caja y no manual
      const p = findProductoByName(line.producto);
      const kgCaja = p ? parseNum(p.kgCaja) : 0;
      if(kgCaja > 0 && !line.netoManual){
        line.neto = round2(cantidad * kgCaja);
      }
    }

    // MODO UD:
    if(modo === 'ud'){
      line.importe = round2(cantidad * precio);
      if(precio <= 0) warn.precioVacio = true;
    }

    // Normalizar valores negativos raros
    if(parseNum(line.neto) < 0 && modo === 'kg' && parseNum(line.bruto) >= 0){
      // no forzamos a 0; solo dejamos el número (usuario puede corregir)
    }

    return warn;
  }

  function recalcFactura(f, updateUI){
    // Recalcular todas líneas + subtotal + transporte + iva + total + pendiente
    let subtotal = 0;

    const warnings = [];
    for(const l of f.lineas){
      const w = recalcLinea(l);
      subtotal += parseNum(l.importe);
      warnings.push({ id: l.id, w });
    }
    subtotal = round2(subtotal);

    // Transporte
    const aj = S.ajustes;
    const transportePct = parseNum(aj.transportePct);
    const ivaPct = parseNum(aj.ivaPct);

    const transporte = f.transporteOn ? round2(subtotal * (transportePct/100)) : 0;
    const base = round2(subtotal + transporte);

    let iva = 0;
    let total = 0;

    if(f.ivaIncluido){
      // IVA incluido: no sumamos IVA en total
      total = base;
      iva = computeIvaInternoSiIncluido(total, ivaPct); // interno para contabilidad
    }else{
      iva = round2(base * (ivaPct/100));
      total = round2(base + iva);
    }

    // Pagos
    let pagado = 0;
    if(Array.isArray(f.pagos)){
      for(const p of f.pagos) pagado += parseNum(p.importe);
    }
    pagado = round2(pagado);
    const pendiente = round2(total - pagado);

    f.subtotal = subtotal;
    f.transporte = transporte;
    f.iva = iva;
    f.total = total;
    f.pendiente = pendiente;

    // Auto-estado
    if(pendiente <= 0.009 && total > 0){
      f.estado = 'pagada';
    }else if(pagado > 0 && pendiente > 0.009){
      f.estado = 'parcial';
    }else{
      f.estado = 'impagada';
    }

    if(updateUI){
      renderTotalsUI(f);
      // actualizar importe por fila (sin re-render completo, si posible)
      refreshImportesUI(f);
      renderPagosUI(f);
      // update selects estado
      if($('#selEstadoFactura')) $('#selEstadoFactura').value = f.estado;
    }

    FM.runHooks('onFacturaChanged', f, warnings);
    return warnings;
  }

  function refreshImportesUI(f){
    const body = $('#gridProBody');
    if(!body) return;
    for(const l of f.lineas){
      const row = body.querySelector(`.gridRow[data-line-id="${CSS.escape(l.id)}"]`);
      if(!row) continue;
      const box = row.querySelector('.importeBox');
      if(box) box.textContent = moneyES(l.importe || 0);
    }
  }

  function renderTotalsUI(f){
    if($('#totSubtotal')) $('#totSubtotal').textContent = moneyES(f.subtotal || 0);
    if($('#totTransporte')) $('#totTransporte').textContent = moneyES(f.transporte || 0);
    if($('#totIva')) $('#totIva').textContent = f.ivaIncluido ? 'IVA incluido' : moneyES(f.iva || 0);
    if($('#totTotal')) $('#totTotal').textContent = moneyES(f.total || 0);
    if($('#totPendiente')) $('#totPendiente').textContent = moneyES(f.pendiente || 0);

    const rowTrans = $('#rowTransporte');
    if(rowTrans) rowTrans.style.display = f.transporteOn ? 'flex' : 'none';

    const rowIva = $('#rowIva');
    if(rowIva) rowIva.style.display = f.ivaIncluido ? 'none' : 'flex';
  }

  /* =========================================================
     PAGOS UI
  ========================================================== */
  function renderPagosUI(f){
    const box = $('#listaPagos');
    if(!box) return;
    const pagos = Array.isArray(f.pagos) ? f.pagos : [];
    if(pagos.length === 0){
      box.innerHTML = `<div class="item"><div class="itemTitle">Sin pagos</div><div class="itemSub">Añade pagos parciales si aplica.</div></div>`;
      return;
    }
    box.innerHTML = pagos.map(p => {
      const imp = moneyES(parseNum(p.importe));
      const fec = fmtESDate(p.fecha);
      return `<div class="item" data-pago-id="${esc(p.id)}">
        <div class="itemTop">
          <div class="itemTitle">${esc(imp)}</div>
          <div class="itemBtns">
            <button class="btn btnTiny btnDangerGhost btnDelPago" type="button">Eliminar</button>
          </div>
        </div>
        <div class="itemSub">${esc(fec)}</div>
      </div>`;
    }).join('');
  }

  /* =========================================================
     FACTURA SAVE / HISTORY PRECIOS (solo pantalla)
  ========================================================== */
  function saveFacturaToState(f){
    // Sustituye/guarda en state.facturas y localStorage
    const list = S.facturas;
    const idx = list.findIndex(x => x.id === f.id);
    if(idx >= 0) list[idx] = f;
    else list.unshift(f);
    save(K.FACTURAS, list);
    FM.toast && FM.toast('Factura guardada');
  }

  function updatePriceHistoryFromFactura(f){
    // Al guardar factura, actualizamos historial del producto por modo y precio usado
    for(const l of f.lineas){
      const name = normalizeUpper(l.producto);
      if(!name) continue;
      const prod = findProductoByName(name);
      if(!prod) continue;

      const precio = parseNum(l.precio);
      if(precio <= 0) continue;

      const item = {
        ts: Date.now(),
        modo: l.modo || 'kg',
        precio: precio
      };
      if(!Array.isArray(prod.hist)) prod.hist = [];
      prod.hist.unshift(item);
      prod.hist = prod.hist.slice(0, 5);

      // Opcional: actualizar precio por modo si está vacío
      const modo = l.modo || 'kg';
      if(modo === 'kg' && parseNum(prod.precioKg) <= 0) prod.precioKg = precio;
      if(modo === 'caja' && parseNum(prod.precioCaja) <= 0) prod.precioCaja = precio;
      if(modo === 'ud' && parseNum(prod.precioUd) <= 0) prod.precioUd = precio;
    }
    save(K.PRODUCTOS, S.productos);
  }

  /* =========================================================
     WHATSAPP PRO
  ========================================================== */
  function buildWhatsText(f){
    const lines = [];
    lines.push(`FACTURA ${f.numero} (${fmtESDate(f.fecha)})`);
    const cli = (f.cliente && f.cliente.nombre) ? f.cliente.nombre : '';
    if(cli) lines.push(`Cliente: ${cli}`);
    if(f.tags) lines.push(`Tags: ${f.tags}`);
    lines.push('------------------------------');

    for(const l of f.lineas){
      const n = (l.producto || '').trim();
      if(!n) continue;

      const modo = l.modo || 'kg';
      const cant = parseNum(l.cantidad);
      const bruto = parseNum(l.bruto);
      const tara = parseNum(l.taraKg);
      const neto = parseNum(l.neto);
      const precio = parseNum(l.precio);
      const imp = parseNum(l.importe);

      if(modo === 'kg'){
        lines.push(`${n} | ${cant} env | Bruto ${bruto}kg - Tara ${tara}kg = Neto ${neto}kg | ${precio}/kg | ${moneyES(imp)}`);
      }else if(modo === 'caja'){
        lines.push(`${n} | ${cant} caja | ${precio}/caja | ${moneyES(imp)}`);
      }else{
        lines.push(`${n} | ${cant} ud | ${precio}/ud | ${moneyES(imp)}`);
      }
    }

    lines.push('------------------------------');
    if(f.transporteOn) lines.push(`Transporte: ${moneyES(f.transporte)}`);
    if(f.ivaIncluido){
      lines.push(`IVA: incluido`);
    }else{
      lines.push(`IVA: ${moneyES(f.iva)}`);
    }
    lines.push(`TOTAL: ${moneyES(f.total)}`);
    lines.push(`Pendiente: ${moneyES(f.pendiente)}`);
    return lines.join('\n');
  }

  function sendWhatsAppText(txt){
    const t = encodeURIComponent(txt);
    const url = `https://wa.me/?text=${t}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /* =========================================================
     EVENT BINDINGS (FACTURA + GRID)
  ========================================================== */
  function bindFacturaUI(){
    const f = FM.facturas.getFacturaActual();

    // Select clientes
    renderClientesSelect(f);

    // Load cliente data into inputs
    if($('#cliNombre')) $('#cliNombre').value = f.cliente?.nombre || '';
    if($('#cliNif')) $('#cliNif').value = f.cliente?.nif || '';
    if($('#cliDir')) $('#cliDir').value = f.cliente?.dir || '';
    if($('#cliTel')) $('#cliTel').value = f.cliente?.tel || '';
    if($('#cliEmail')) $('#cliEmail').value = f.cliente?.email || '';

    // Render grid + totals + pagos
    renderGridPro(f);
    recalcFactura(f, true);

    // Metadatos
    if($('#factNumero')) $('#factNumero').textContent = f.numero || '';
    if($('#inpNumeroFactura')) $('#inpNumeroFactura').value = f.numero || '';
    if($('#inpFechaFactura')) $('#inpFechaFactura').value = f.fecha || todayISO();
    if($('#inpTags')) $('#inpTags').value = f.tags || '';
    if($('#inpNotasInternas')) $('#inpNotasInternas').value = f.notasInternas || '';
    if($('#inpObservaciones')) $('#inpObservaciones').value = f.observaciones || '';
    if($('#selMetodoPago')) $('#selMetodoPago').value = f.metodoPago || 'efectivo';
    if($('#selEstadoFactura')) $('#selEstadoFactura').value = f.estado || 'impagada';
    if($('#chkTransporte')) $('#chkTransporte').checked = !!f.transporteOn;
    if($('#chkIvaIncluido')) $('#chkIvaIncluido').checked = !!f.ivaIncluido;

    // ======= Header actions
    FM.$ && FM.$('#btnNuevaFactura') && FM.$('#btnNuevaFactura'); // keep reference if needed

    // Nueva factura
    FM.$ && on($('#btnNuevaFactura'),'click', () => {
      const nf = FM.model.makeFactura(); // ✅ 5 líneas por defecto
      // guardarla y hacerla actual
      S.facturas.unshift(nf);
      save(K.FACTURAS, S.facturas);
      // set actual
      FM.facturas.setFacturaActual(nf.id);
      // refrescar UI
      loadFacturaToUI(nf);
      FM.toast('Nueva factura');
    });

    // Duplicar factura
    on($('#btnDuplicarFactura'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      const cp = deepClone(cur);
      cp.id = FM.uid();
      cp.numero = FM.util.makeInvoiceNumber();
      cp.fecha = todayISO();
      cp.pagos = [];
      cp.estado = 'impagada';
      cp.pdfUrl = '';
      // ids de líneas nuevos
      cp.lineas = (cp.lineas || []).map(l => {
        const nl = Object.assign({}, l);
        nl.id = FM.uid();
        return nl;
      });
      // asegurar 5 mínimo
      while((cp.lineas||[]).length < 5) cp.lineas.push(FM.model.makeLinea());

      S.facturas.unshift(cp);
      save(K.FACTURAS, S.facturas);
      FM.facturas.setFacturaActual(cp.id);
      loadFacturaToUI(cp);
      FM.toast('Factura duplicada');
    });

    // Eliminar
    on($('#btnEliminarFactura'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      const ok = confirm(`¿Eliminar ${cur.numero}?`);
      if(!ok) return;
      const idx = S.facturas.findIndex(x => x.id === cur.id);
      if(idx >= 0) S.facturas.splice(idx,1);
      save(K.FACTURAS, S.facturas);
      // cargar otra
      const next = S.facturas[0] || FM.model.makeFactura();
      if(!S.facturas.length){
        S.facturas.unshift(next);
        save(K.FACTURAS, S.facturas);
      }
      FM.facturas.setFacturaActual(next.id);
      loadFacturaToUI(next);
      FM.toast('Factura eliminada');
    });

    // Guardar
    on($('#btnGuardarFactura'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      // actualizar desde UI antes de guardar
      pullFacturaMetaFromUI(cur);
      pullClienteFromUI(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
      updatePriceHistoryFromFactura(cur);
      // (en 3C) se regenerará QR y se podrá generar PDF
    });

    // Generar PDF (3C añade FM.pdf.generate)
    on($('#btnGenerarPDF'),'click', async () => {
      const cur = FM.facturas.getFacturaActual();
      pullFacturaMetaFromUI(cur);
      pullClienteFromUI(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
      updatePriceHistoryFromFactura(cur);

      if(FM.pdf && typeof FM.pdf.generate === 'function'){
        await FM.pdf.generate(cur, { openViewer:false });
      }else{
        FM.toast('PDF: se activa en PARTE 3C');
      }
    });

    // Ver PDF (visor interno)
    on($('#btnVerPDF'),'click', async () => {
      const cur = FM.facturas.getFacturaActual();
      pullFacturaMetaFromUI(cur);
      pullClienteFromUI(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);

      if(FM.pdf && typeof FM.pdf.generate === 'function'){
        await FM.pdf.generate(cur, { openViewer:true });
      }else{
        FM.toast('Visor PDF: se activa en PARTE 3C');
      }
    });

    // PDF + nube (3C)
    on($('#btnPdfNube'),'click', async () => {
      const cur = FM.facturas.getFacturaActual();
      pullFacturaMetaFromUI(cur);
      pullClienteFromUI(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);

      if(FM.cloud && typeof FM.cloud.uploadPdfForFactura === 'function'){
        await FM.cloud.uploadPdfForFactura(cur);
      }else{
        FM.toast('Cloud PDF: se activa en PARTE 3C');
      }
    });

    // WhatsApp
    on($('#btnWhatsapp'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      pullFacturaMetaFromUI(cur);
      pullClienteFromUI(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);

      const txt = buildWhatsText(cur);
      sendWhatsAppText(txt);
    });

    // ======= Meta fields change events
    on($('#inpNumeroFactura'),'input', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.numero = $('#inpNumeroFactura').value.trim();
      if($('#factNumero')) $('#factNumero').textContent = cur.numero;
    });

    on($('#inpFechaFactura'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.fecha = $('#inpFechaFactura').value || todayISO();
      saveFacturaToState(cur);
    });

    on($('#inpTags'),'input', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.tags = $('#inpTags').value;
    });

    on($('#inpNotasInternas'),'input', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.notasInternas = $('#inpNotasInternas').value;
    });

    on($('#inpObservaciones'),'input', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.observaciones = $('#inpObservaciones').value;
    });

    on($('#chkTransporte'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.transporteOn = !!$('#chkTransporte').checked;
      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    on($('#chkIvaIncluido'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.ivaIncluido = !!$('#chkIvaIncluido').checked;
      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    on($('#btnAddIva4'),'click', () => {
      S.ajustes.ivaPct = 4;
      save(K.AJUSTES, S.ajustes);
      if($('#ajIva')) $('#ajIva').value = '4';
      const cur = FM.facturas.getFacturaActual();
      cur.ivaIncluido = false;
      if($('#chkIvaIncluido')) $('#chkIvaIncluido').checked = false;
      recalcFactura(cur, true);
      saveFacturaToState(cur);
      FM.toast('IVA fijado a 4%');
    });

    // Pagos
    on($('#btnAddPago'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      const imp = parseNum($('#pagoImporte') ? $('#pagoImporte').value : 0);
      const fec = ($('#pagoFecha') ? $('#pagoFecha').value : '') || todayISO();
      if(imp <= 0){
        FM.toast('Pago: importe inválido');
        return;
      }
      cur.pagos = Array.isArray(cur.pagos) ? cur.pagos : [];
      cur.pagos.unshift({ id: FM.uid(), importe: round2(imp), fecha: fec });
      if($('#pagoImporte')) $('#pagoImporte').value = '';
      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    // eliminar pago (delegado)
    on($('#listaPagos'),'click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.btnDelPago');
      if(!btn) return;
      const item = ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-pago-id');
      const cur = FM.facturas.getFacturaActual();
      cur.pagos = (cur.pagos || []).filter(p => p.id !== id);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    // Metodo/Estado (estado auto se recalcula, pero respetamos selección manual si quiere)
    on($('#selMetodoPago'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.metodoPago = $('#selMetodoPago').value || 'efectivo';
      saveFacturaToState(cur);
    });

    on($('#selEstadoFactura'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.estado = $('#selEstadoFactura').value || 'impagada';
      saveFacturaToState(cur);
    });

    // Cliente selector
    on($('#selCliente'),'change', () => {
      const cur = FM.facturas.getFacturaActual();
      const id = $('#selCliente').value || '';
      cur.clienteId = id;

      if(!id){
        // no borra lo escrito
        saveFacturaToState(cur);
        return;
      }

      const c = S.clientes.find(x => x.id === id);
      if(c){
        cur.cliente = {
          nombre: c.nombre || '',
          nif: c.nif || '',
          dir: c.dir || '',
          tel: c.tel || '',
          email: c.email || ''
        };
        // aplicar plantillas por cliente
        if(c.tpl){
          if(c.tpl.tagsAuto){
            // añade tags automáticos (sin duplicar)
            const base = (cur.tags || '').split(',').map(x=>x.trim()).filter(Boolean);
            const add  = String(c.tpl.tagsAuto).split(',').map(x=>x.trim()).filter(Boolean);
            const set = new Set(base.map(x=>x.toLowerCase()));
            for(const t of add) if(!set.has(t.toLowerCase())) base.push(t);
            cur.tags = base.join(', ');
            if($('#inpTags')) $('#inpTags').value = cur.tags;
          }
          if(c.tpl.notasStd && isEmptyStr(cur.observaciones)){
            cur.observaciones = c.tpl.notasStd;
            if($('#inpObservaciones')) $('#inpObservaciones').value = cur.observaciones;
          }
          if(c.tpl.ivaIncluido){
            cur.ivaIncluido = true;
            if($('#chkIvaIncluido')) $('#chkIvaIncluido').checked = true;
          }
          if(c.tpl.transporte){
            cur.transporteOn = true;
            if($('#chkTransporte')) $('#chkTransporte').checked = true;
          }
          if(c.tpl.pago){
            cur.metodoPago = (c.tpl.pago || '').toLowerCase() || cur.metodoPago;
            if($('#selMetodoPago')) $('#selMetodoPago').value = cur.metodoPago;
          }
        }

        // Volcar a inputs cliente
        if($('#cliNombre')) $('#cliNombre').value = cur.cliente.nombre;
        if($('#cliNif')) $('#cliNif').value = cur.cliente.nif;
        if($('#cliDir')) $('#cliDir').value = cur.cliente.dir;
        if($('#cliTel')) $('#cliTel').value = cur.cliente.tel;
        if($('#cliEmail')) $('#cliEmail').value = cur.cliente.email;
      }

      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    // Cliente inline edit
    const cliInputs = ['#cliNombre','#cliNif','#cliDir','#cliTel','#cliEmail'];
    for(const sel of cliInputs){
      on($(sel), 'input', () => {
        const cur = FM.facturas.getFacturaActual();
        pullClienteFromUI(cur);
        saveFacturaToState(cur);
      });
    }

    // Nuevo cliente desde factura
    on($('#btnNuevoClienteDesdeFactura'),'click', () => {
      const name = ($('#cliNombre') ? $('#cliNombre').value : '').trim();
      const c = {
        id: FM.uid(),
        nombre: name || 'Nuevo cliente',
        alias: '',
        nif: ($('#cliNif') ? $('#cliNif').value : '').trim(),
        dir: ($('#cliDir') ? $('#cliDir').value : '').trim(),
        tel: ($('#cliTel') ? $('#cliTel').value : '').trim(),
        email: ($('#cliEmail') ? $('#cliEmail').value : '').trim(),
        notas: '',
        tpl: { ivaIncluido:false, transporte:false, pago:'', tagsAuto:'', notasStd:'' }
      };
      S.clientes.unshift(c);
      save(K.CLIENTES, S.clientes);
      // seleccionar
      const cur = FM.facturas.getFacturaActual();
      cur.clienteId = c.id;
      cur.cliente = { nombre:c.nombre, nif:c.nif, dir:c.dir, tel:c.tel, email:c.email };
      renderClientesSelect(cur);
      if($('#selCliente')) $('#selCliente').value = c.id;
      saveFacturaToState(cur);
      FM.toast('Cliente creado');
    });

    // Guardar cliente desde factura (si está seleccionado)
    on($('#btnGuardarClienteDesdeFactura'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      pullClienteFromUI(cur);

      if(!cur.clienteId){
        FM.toast('Selecciona cliente o crea uno nuevo');
        return;
      }
      const c = S.clientes.find(x => x.id === cur.clienteId);
      if(!c){
        FM.toast('Cliente no encontrado');
        return;
      }
      c.nombre = cur.cliente.nombre || c.nombre;
      c.nif = cur.cliente.nif || c.nif;
      c.dir = cur.cliente.dir || c.dir;
      c.tel = cur.cliente.tel || c.tel;
      c.email = cur.cliente.email || c.email;
      save(K.CLIENTES, S.clientes);
      renderClientesSelect(cur);
      if($('#selCliente')) $('#selCliente').value = cur.clienteId;
      FM.toast('Cliente guardado');
    });

    // Guardar proveedor (a ajustes)
    on($('#btnGuardarProveedor'),'click', () => {
      const p = {
        nombre: ($('#provNombre') ? $('#provNombre').value : '').trim(),
        nif: ($('#provNif') ? $('#provNif').value : '').trim(),
        dir: ($('#provDir') ? $('#provDir').value : '').trim(),
        tel: ($('#provTel') ? $('#provTel').value : '').trim(),
        email: ($('#provEmail') ? $('#provEmail').value : '').trim()
      };
      S.proveedor = p;
      save(K.PROVEEDOR, p);
      FM.toast('Proveedor guardado');
      // QR se actualizará en 3C
    });

    // Grid buttons
    on($('#btnAddLinea'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.lineas.push(FM.model.makeLinea());
      renderGridPro(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
      // focus al producto de la última línea
      const body = $('#gridProBody');
      const last = body ? body.querySelector('.gridRow:last-child .inProducto') : null;
      safeFocus(last);
    });

    on($('#btnVaciarLineas'),'click', () => {
      const cur = FM.facturas.getFacturaActual();
      cur.lineas = [FM.model.makeLinea(), FM.model.makeLinea(), FM.model.makeLinea(), FM.model.makeLinea(), FM.model.makeLinea()]; // ✅ 5 líneas
      renderGridPro(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
      FM.toast('Líneas reiniciadas a 5');
    });

    // Delegación de eventos GRID
    bindGridDelegation();

    // Cierre autocomplete al hacer click fuera
    on(document, 'click', (ev) => {
      const pop = $('#acPopup');
      if(!pop || !AC.open) return;
      const t = ev.target;
      if(!(t instanceof Element)) return;
      if(pop.contains(t)) return;
      if(AC.forInput && AC.forInput.contains && AC.forInput.contains(t)) return;
      acClose();
    });

    // Click en item autocomplete
    on($('#acPopup'),'click', (ev) => {
      const it = ev.target.closest && ev.target.closest('.acItem');
      if(!it) return;
      const i = parseInt(it.getAttribute('data-i') || '0', 10);
      acPick(i);
    });
  }

  function pullFacturaMetaFromUI(f){
    if(!f) return;
    if($('#inpNumeroFactura')) f.numero = ($('#inpNumeroFactura').value || '').trim();
    if($('#inpFechaFactura')) f.fecha = $('#inpFechaFactura').value || todayISO();
    if($('#inpTags')) f.tags = $('#inpTags').value || '';
    if($('#inpNotasInternas')) f.notasInternas = $('#inpNotasInternas').value || '';
    if($('#inpObservaciones')) f.observaciones = $('#inpObservaciones').value || '';
    if($('#chkTransporte')) f.transporteOn = !!$('#chkTransporte').checked;
    if($('#chkIvaIncluido')) f.ivaIncluido = !!$('#chkIvaIncluido').checked;
    if($('#selMetodoPago')) f.metodoPago = $('#selMetodoPago').value || 'efectivo';
    if($('#selEstadoFactura')) f.estado = $('#selEstadoFactura').value || f.estado || 'impagada';
    if($('#factNumero')) $('#factNumero').textContent = f.numero || '';
  }

  function pullClienteFromUI(f){
    if(!f) return;
    f.cliente = f.cliente || { nombre:'', nif:'', dir:'', tel:'', email:'' };
    if($('#cliNombre')) f.cliente.nombre = $('#cliNombre').value || '';
    if($('#cliNif')) f.cliente.nif = $('#cliNif').value || '';
    if($('#cliDir')) f.cliente.dir = $('#cliDir').value || '';
    if($('#cliTel')) f.cliente.tel = $('#cliTel').value || '';
    if($('#cliEmail')) f.cliente.email = $('#cliEmail').value || '';
  }

  function loadFacturaToUI(f){
    // Metadatos
    if($('#factNumero')) $('#factNumero').textContent = f.numero || '';
    if($('#inpNumeroFactura')) $('#inpNumeroFactura').value = f.numero || '';
    if($('#inpFechaFactura')) $('#inpFechaFactura').value = f.fecha || todayISO();
    if($('#inpTags')) $('#inpTags').value = f.tags || '';
    if($('#inpNotasInternas')) $('#inpNotasInternas').value = f.notasInternas || '';
    if($('#inpObservaciones')) $('#inpObservaciones').value = f.observaciones || '';
    if($('#chkTransporte')) $('#chkTransporte').checked = !!f.transporteOn;
    if($('#chkIvaIncluido')) $('#chkIvaIncluido').checked = !!f.ivaIncluido;
    if($('#selMetodoPago')) $('#selMetodoPago').value = f.metodoPago || 'efectivo';
    if($('#selEstadoFactura')) $('#selEstadoFactura').value = f.estado || 'impagada';

    // Cliente
    renderClientesSelect(f);
    if($('#selCliente')) $('#selCliente').value = f.clienteId || '';
    if($('#cliNombre')) $('#cliNombre').value = f.cliente?.nombre || '';
    if($('#cliNif')) $('#cliNif').value = f.cliente?.nif || '';
    if($('#cliDir')) $('#cliDir').value = f.cliente?.dir || '';
    if($('#cliTel')) $('#cliTel').value = f.cliente?.tel || '';
    if($('#cliEmail')) $('#cliEmail').value = f.cliente?.email || '';

    // Grid
    renderGridPro(f);
    recalcFactura(f, true);

    // Hook
    FM.runHooks('onFacturaLoaded', f);
  }

  function bindGridDelegation(){
    const body = $('#gridProBody');
    if(!body) return;

    // INPUT HANDLER
    on(body, 'input', (ev) => {
      const row = ev.target.closest && ev.target.closest('.gridRow');
      if(!row) return;
      const id = row.getAttribute('data-line-id');
      const cur = FM.facturas.getFacturaActual();
      const line = cur.lineas.find(l => l.id === id);
      if(!line) return;

      const t = ev.target;

      // Producto (abrir autocomplete)
      if(t.classList.contains('inProducto')){
        const v = t.value || '';
        line.producto = v;
        // mostrar sugerencias (manual)
        if(v.trim().length >= 1){
          acOpenFor(t, id, v);
        }else{
          acClose();
        }
        // NO recalculamos aquí fuerte; solo guardamos
        saveFacturaToState(cur);
        return;
      }

      if(t.classList.contains('inCant')){
        line.cantidad = parseNum(t.value);
        // autorelleno envases si está vacío y modo kg/caja
        if(parseNum(line.envases) <= 0 && (line.modo === 'kg' || line.modo === 'caja') && parseNum(line.cantidad) > 0){
          line.envases = parseNum(line.cantidad);
          // actualizar input envases en UI
          const envIn = row.querySelector('.inEnv');
          if(envIn) envIn.value = String(line.envases);
        }
      }

      if(t.classList.contains('inBruto')){
        line.bruto = parseNum(t.value);
      }

      if(t.classList.contains('inEnv')){
        line.envases = parseNum(t.value);
        // si cambia envases y hay taraId, recalcular tara auto (si no manual)
        if(line.taraId){
          applyTaraAutoToLine(line);
          const taraIn = row.querySelector('.inTaraKg');
          if(taraIn && !line.taraManual) taraIn.value = String(line.taraKg ?? 0);
        }
      }

      if(t.classList.contains('inTaraKg')){
        // si escribe tara manual -> marcar manual
        line.taraKg = parseNum(t.value);
        line.taraManual = true;
      }

      if(t.classList.contains('inNeto')){
        line.neto = parseNum(t.value);
        line.netoManual = true; // ✅ respeta neto manual
      }

      if(t.classList.contains('inPrecio')){
        line.precio = parseNum(t.value);
      }

      if(t.classList.contains('inOrigen')){
        line.origen = t.value || '';
      }

      // Recalc en tiempo real
      const warnings = recalcFactura(cur, true);
      // Marcar validaciones visuales por fila
      applyLineWarningsUI(row, line, warnings);
      saveFacturaToState(cur);
    });

    // CHANGE HANDLER
    on(body, 'change', (ev) => {
      const row = ev.target.closest && ev.target.closest('.gridRow');
      if(!row) return;
      const id = row.getAttribute('data-line-id');
      const cur = FM.facturas.getFacturaActual();
      const line = cur.lineas.find(l => l.id === id);
      if(!line) return;

      const t = ev.target;

      if(t.classList.contains('inModo')){
        line.modo = t.value || 'kg';

        // Ajuste: al cambiar modo, si producto existe -> cargar precio por modo (si precio actual 0)
        const prod = findProductoByName(line.producto);
        if(prod && parseNum(line.precio) <= 0){
          if(line.modo === 'kg' && parseNum(prod.precioKg) > 0) line.precio = parseNum(prod.precioKg);
          if(line.modo === 'caja' && parseNum(prod.precioCaja) > 0) line.precio = parseNum(prod.precioCaja);
          if(line.modo === 'ud' && parseNum(prod.precioUd) > 0) line.precio = parseNum(prod.precioUd);
        }

        // Autorelleno envases recomendado
        if(parseNum(line.envases) <= 0 && (line.modo === 'kg' || line.modo === 'caja') && parseNum(line.cantidad) > 0){
          line.envases = parseNum(line.cantidad);
        }

        // En modo caja: neto informativo si kgCaja y no manual
        if(line.modo === 'caja'){
          const kgCaja = prod ? parseNum(prod.kgCaja) : 0;
          if(kgCaja > 0 && !line.netoManual){
            line.neto = round2(parseNum(line.cantidad) * kgCaja);
          }
        }

        // Tara auto si selector
        if(line.taraId){
          // si ya había tara manual, NO la sobreescribimos salvo que usuario quite manual (botón no existe)
          applyTaraAutoToLine(line);
        }

        // Re-render row to update hint modo
        renderGridPro(cur);
        recalcFactura(cur, true);
        saveFacturaToState(cur);
        return;
      }

      if(t.classList.contains('inTaraSel')){
        line.taraId = t.value || '';
        // al seleccionar tara, aplicar automáticamente (si no manual)
        line.taraManual = false; // cuando cambia selector, volvemos a auto por defecto
        applyTaraAutoToLine(line);

        // si modo=caja o kg y envases vacío => envases=cantidad
        if(parseNum(line.envases) <= 0 && (line.modo === 'kg' || line.modo === 'caja') && parseNum(line.cantidad) > 0){
          line.envases = parseNum(line.cantidad);
        }

        // Re-render para actualizar input taraKg mostrado
        renderGridPro(cur);
        recalcFactura(cur, true);
        saveFacturaToState(cur);
        return;
      }

      // si el usuario cambia el producto y coincide EXACTO con un producto, aplicar defaults
      if(t.classList.contains('inProducto')){
        const prod = findProductoByName(t.value);
        if(prod){
          const row2 = t.closest('.gridRow');
          if(row2){
            const id2 = row2.getAttribute('data-line-id');
            const line2 = cur.lineas.find(l => l.id === id2);
            if(line2){
              applyProductDefaultsToLine(line2, prod);
              renderGridPro(cur);
              recalcFactura(cur, true);
              saveFacturaToState(cur);
            }
          }
        }
      }
    });

    // DELETE LINE
    on(body, 'click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.btnDel');
      if(!btn) return;
      const row = ev.target.closest('.gridRow');
      if(!row) return;
      const id = row.getAttribute('data-line-id');
      const cur = FM.facturas.getFacturaActual();
      const idx = cur.lineas.findIndex(l => l.id === id);
      if(idx < 0) return;

      cur.lineas.splice(idx,1);
      // asegurar 5 mínimas
      while(cur.lineas.length < 5) cur.lineas.push(FM.model.makeLinea());

      renderGridPro(cur);
      recalcFactura(cur, true);
      saveFacturaToState(cur);
    });

    // KEYBOARD FLOW PRO (Enter avanza; al final crea nueva línea)
    on(body, 'keydown', (ev) => {
      const t = ev.target;
      if(!(t instanceof Element)) return;
      const row = t.closest('.gridRow');
      if(!row) return;

      // Autocomplete navigation
      if(AC.open && (t.classList.contains('inProducto'))){
        if(ev.key === 'ArrowDown'){ ev.preventDefault(); acMove(+1); return; }
        if(ev.key === 'ArrowUp'){ ev.preventDefault(); acMove(-1); return; }
        if(ev.key === 'Enter'){
          ev.preventDefault();
          acPick(AC.activeIndex);
          return;
        }
        if(ev.key === 'Escape'){ ev.preventDefault(); acClose(); return; }
      }

      if(ev.key !== 'Enter') return;
      ev.preventDefault();

      const focusables = Array.from(row.querySelectorAll('input,select,button'))
        .filter(el => !el.classList.contains('btnDel'));

      const idx = focusables.indexOf(t);
      if(idx < 0) return;

      const next = focusables[idx + 1];
      if(next){
        safeFocus(next);
      }else{
        // final de fila -> ir a primera celda de la siguiente fila o crear nueva
        const nextRow = row.nextElementSibling;
        if(nextRow){
          const inp = nextRow.querySelector('.inProducto');
          safeFocus(inp);
        }else{
          // crear nueva línea
          const cur = FM.facturas.getFacturaActual();
          cur.lineas.push(FM.model.makeLinea());
          renderGridPro(cur);
          recalcFactura(cur, true);
          saveFacturaToState(cur);
          // focus en nuevo producto
          const body2 = $('#gridProBody');
          const last = body2 ? body2.querySelector('.gridRow:last-child .inProducto') : null;
          safeFocus(last);
        }
      }
    });
  }

  function applyLineWarningsUI(row, line, warnings){
    // Simple: cambia borde de inputs si alertas
    if(!row) return;
    const modo = line.modo || 'kg';
    const w = warnings && warnings.find(x => x.id === line.id);
    const flags = w ? w.w : { taraGtBruto:false, netoGtBruto:false, precioVacio:false };

    const brutoIn = row.querySelector('.inBruto');
    const taraIn = row.querySelector('.inTaraKg');
    const netoIn = row.querySelector('.inNeto');
    const precioIn = row.querySelector('.inPrecio');

    function setWarn(el, on){
      if(!el) return;
      el.style.borderColor = on ? '#b91c1c' : '';
      el.style.boxShadow = on ? '0 0 0 3px rgba(185,28,28,.10)' : '';
    }

    if(modo === 'kg'){
      setWarn(taraIn, !!flags.taraGtBruto);
      setWarn(netoIn, !!flags.netoGtBruto);
    }else{
      setWarn(taraIn, false);
      setWarn(netoIn, false);
    }
    setWarn(precioIn, !!flags.precioVacio);
    setWarn(brutoIn, false);
  }

  /* =========================================================
     PUBLIC HELPERS FOR 3C (QR/PDF/Lists)
  ========================================================== */
  FM.facturaUI = {
    loadFacturaToUI,
    recalcFactura,
    renderGridPro,
    renderClientesSelect,
    saveFacturaToState,
    updatePriceHistoryFromFactura,
    buildWhatsText
  };

  /* =========================================================
     HOOK: afterInit -> bind UI once base init runs in 3C
  ========================================================== */
  FM.hooks.afterInit = FM.hooks.afterInit || [];
  FM.hooks.afterInit.push(() => {
    // Cargar factura actual a UI
    const f = FM.facturas.getFacturaActual();
    loadFacturaToUI(f);
    // Bind UI listeners (una vez)
    bindFacturaUI();
  });

})();
/* =========================================================
PARTE 3C/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3C: Init final + QR (AEAT / normal) + PDF PRO (multipágina) + Visor PDF
      + Listados (Facturas/Clientes/Productos/Taras) + Contabilidad PIN + Ventas diarias PIN
      + Ajustes + Atajos teclado + Cloud Firebase opcional (sin crash si no está)
========================================================= */

(() => {
  'use strict';

  const FM = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  FM.BUILD = 'app.js 3C';

  const $ = FM.$;
  const $$ = FM.$$;
  const { load, save } = FM.store;
  const { parseNum, round2, moneyES, fmtESDate, isoDate, dayNameES, makeInvoiceNumber } = FM.util;

  const S = FM.state;
  const K = FM.K;

  /* =========================================================
     HELPERS DOM
  ========================================================== */
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  function esc(s){
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'","&#039;");
  }
  function normalizeUpper(s){ return (s ?? '').toString().trim().toUpperCase(); }
  function toast(msg){ FM.toast && FM.toast(msg); }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch{ return fallback; }
  }

  function setVal(id, v){
    const el = $(id);
    if(el) el.value = (v ?? '');
  }

  function setChk(id, v){
    const el = $(id);
    if(el) el.checked = !!v;
  }

  function getVal(id){
    const el = $(id);
    return el ? el.value : '';
  }

  function getChk(id){
    const el = $(id);
    return el ? !!el.checked : false;
  }

  function ensureArray(x){ return Array.isArray(x) ? x : []; }

  function isFacturaUsedCliente(clienteId){
    if(!clienteId) return false;
    for(const f of S.facturas){
      if(f && f.clienteId === clienteId) return true;
    }
    return false;
  }

  function isProductoUsed(nombreUpper){
    if(!nombreUpper) return false;
    const n = normalizeUpper(nombreUpper);
    for(const f of S.facturas){
      for(const l of ensureArray(f.lineas)){
        if(normalizeUpper(l.producto) === n) return true;
      }
    }
    return false;
  }

  function clamp(n,a,b){
    n = parseNum(n);
    return Math.min(b, Math.max(a, n));
  }

  function firstDayOfMonthISO(iso){
    if(!iso) return isoDate(new Date());
    const [y,m] = String(iso).slice(0,10).split('-');
    return `${y}-${m}-01`;
  }

  function addDaysISO(iso, days){
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return isoDate(d);
  }

  /* =========================================================
     SESSION LOCKS (PIN)
  ========================================================== */
  function isUnlocked(which){
    return !!(S.session && S.session.unlocked && S.session.unlocked[which]);
  }
  function setUnlocked(which, v){
    if(!S.session) S.session = { unlocked:{ contabilidad:false, ventas:false } };
    if(!S.session.unlocked) S.session.unlocked = { contabilidad:false, ventas:false };
    S.session.unlocked[which] = !!v;
    save(K.SESSION, S.session);
    renderLockIndicators();
  }

  function renderLockIndicators(){
    // Tabs visual
    const tabCont = $$(`.tab[data-tab="tabContabilidad"]`)[0];
    const tabVent = $$(`.tab[data-tab="tabVentas"]`)[0];

    if(tabCont) tabCont.classList.toggle('tabLocked', !isUnlocked('contabilidad'));
    if(tabVent) tabVent.classList.toggle('tabLocked', !isUnlocked('ventas'));

    // Botón lock panel
    const btn = $('#btnLockPanel');
    if(btn){
      const a = [];
      a.push(isUnlocked('contabilidad') ? 'Contabilidad: ON' : 'Contabilidad: OFF');
      a.push(isUnlocked('ventas') ? 'Ventas: ON' : 'Ventas: OFF');
      btn.textContent = `🔒 PIN (${a.join(' · ')})`;
    }

    // overlays dentro de páginas protegidas
    const ovC = $('#lockedOverlayCont');
    const ovV = $('#lockedOverlayVentas');
    if(ovC) ovC.classList.toggle('hidden', isUnlocked('contabilidad'));
    if(ovV) ovV.classList.toggle('hidden', isUnlocked('ventas'));
  }

  function requireUnlockOrOpenPin(which, msg){
    if(isUnlocked(which)) return true;
    toast(msg || 'Necesitas PIN');
    FM.modal && FM.modal.openModal('#pinModal');
    if($('#pinTarget')) $('#pinTarget').value = which;
    if($('#pinInput')) { $('#pinInput').value=''; $('#pinInput').focus(); }
    return false;
  }

  /* =========================================================
     QR (AEAT / normal) — Embedded QR generator (offline)
     Basado en una implementación clásica de QR (qrcode-generator)
     para asegurar escaneable sin depender de internet.
  ========================================================== */

  /* ---- QR Library (qrcode-generator style) ---- */
  // NOTE: Biblioteca completa incluida para no depender de CDN.
  // Fuente conceptual: implementación clásica pública "qrcode-generator"
  // (adaptada/embebida en un solo bloque).

  const QR = (() => {
    // Minimal but complete QR generator supporting Byte mode, error correction M by default.
    // This is intentionally verbose to be reliable offline.

    const PAD0 = 0xEC;
    const PAD1 = 0x11;

    const QRMode = { MODE_8BIT_BYTE: 2 };

    const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

    function QR8bitByte(data){
      this.mode = QRMode.MODE_8BIT_BYTE;
      this.data = data;
      this.parsed = [];

      for(let i=0;i<this.data.length;i++){
        this.parsed.push(this.data.charCodeAt(i));
      }

      this.getLength = function(){ return this.parsed.length; };
      this.write = function(buffer){
        for(let i=0;i<this.parsed.length;i++){
          buffer.put(this.parsed[i], 8);
        }
      };
    }

    function QRBitBuffer(){
      this.buffer = [];
      this.length = 0;

      this.get = function(index){
        const bufIndex = Math.floor(index / 8);
        return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
      };

      this.put = function(num, length){
        for(let i=0;i<length;i++){
          this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        }
      };

      this.getLengthInBits = function(){ return this.length; };

      this.putBit = function(bit){
        const bufIndex = Math.floor(this.length / 8);
        if(this.buffer.length <= bufIndex){
          this.buffer.push(0);
        }
        if(bit){
          this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
        }
        this.length++;
      };
    }

    const QRMath = (() => {
      const EXP_TABLE = new Array(256);
      const LOG_TABLE = new Array(256);
      for(let i=0;i<8;i++) EXP_TABLE[i] = 1 << i;
      for(let i=8;i<256;i++) EXP_TABLE[i] = EXP_TABLE[i-4] ^ EXP_TABLE[i-5] ^ EXP_TABLE[i-6] ^ EXP_TABLE[i-8];
      for(let i=0;i<255;i++) LOG_TABLE[EXP_TABLE[i]] = i;

      return {
        glog(n){
          if(n < 1) throw new Error('glog');
          return LOG_TABLE[n];
        },
        gexp(n){
          while(n < 0) n += 255;
          while(n >= 256) n -= 255;
          return EXP_TABLE[n];
        }
      };
    })();

    function QRPolynomial(num, shift){
      if(num.length === undefined) throw new Error('QRPolynomial');
      let offset = 0;
      while(offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + (shift || 0));
      for(let i=0;i<num.length - offset;i++) this.num[i] = num[i + offset];

      this.get = function(index){ return this.num[index]; };
      this.getLength = function(){ return this.num.length; };

      this.multiply = function(e){
        const num = new Array(this.getLength() + e.getLength() - 1);
        for(let i=0;i<num.length;i++) num[i] = 0;

        for(let i=0;i<this.getLength();i++){
          for(let j=0;j<e.getLength();j++){
            num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
          }
        }
        return new QRPolynomial(num, 0);
      };

      this.mod = function(e){
        if(this.getLength() - e.getLength() < 0) return this;

        const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));

        const num = new Array(this.getLength());
        for(let i=0;i<this.getLength();i++) num[i] = this.get(i);

        for(let i=0;i<e.getLength();i++){
          num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
        }

        return new QRPolynomial(num, 0).mod(e);
      };
    }

    const QRRSBlock = (() => {
      // RS Block Table for version 1..10, EC level L/M/Q/H (subset used, but included for reliability)
      // Format: [count, totalCount, dataCount] * n
      const RS_BLOCK_TABLE = [
        // 1
        [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
        // 2
        [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
        // 3
        [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
        // 4
        [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
        // 5
        [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
        // 6
        [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
        // 7
        [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
        // 8
        [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
        // 9
        [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
        // 10
        [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
      ];

      function getRsBlockTable(version, ecLevel){
        const offset = (version - 1) * 4;
        if(offset < 0 || offset + 3 >= RS_BLOCK_TABLE.length) return null;
        if(ecLevel === QRErrorCorrectLevel.L) return RS_BLOCK_TABLE[offset + 0];
        if(ecLevel === QRErrorCorrectLevel.M) return RS_BLOCK_TABLE[offset + 1];
        if(ecLevel === QRErrorCorrectLevel.Q) return RS_BLOCK_TABLE[offset + 2];
        if(ecLevel === QRErrorCorrectLevel.H) return RS_BLOCK_TABLE[offset + 3];
        return null;
      }

      function getRSBlocks(version, ecLevel){
        const rsBlock = getRsBlockTable(version, ecLevel);
        if(!rsBlock) throw new Error('RS_BLOCK');

        const list = [];
        for(let i=0;i<rsBlock.length;i+=3){
          const count = rsBlock[i+0];
          const totalCount = rsBlock[i+1];
          const dataCount = rsBlock[i+2];
          for(let j=0;j<count;j++){
            list.push({ totalCount, dataCount });
          }
        }
        return list;
      }

      return { getRSBlocks };
    })();

    const QRUtil = (() => {
      const PATTERN_POSITION_TABLE = [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54]
      ];

      const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
      const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
      const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

      function getBCHDigit(data){
        let digit = 0;
        while(data !== 0){
          digit++;
          data >>>= 1;
        }
        return digit;
      }

      return {
        getPatternPosition(version){
          return PATTERN_POSITION_TABLE[version] || [];
        },
        getBCHTypeInfo(data){
          let d = data << 10;
          while(getBCHDigit(d) - getBCHDigit(G15) >= 0){
            d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)));
          }
          return ((data << 10) | d) ^ G15_MASK;
        },
        getBCHTypeNumber(data){
          let d = data << 12;
          while(getBCHDigit(d) - getBCHDigit(G18) >= 0){
            d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)));
          }
          return (data << 12) | d;
        },
        getMask(maskPattern, i, j){
          switch(maskPattern){
            case 0: return (i + j) % 2 === 0;
            case 1: return i % 2 === 0;
            case 2: return j % 3 === 0;
            case 3: return (i + j) % 3 === 0;
            case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
            case 5: return ((i * j) % 2 + (i * j) % 3) === 0;
            case 6: return (((i * j) % 2 + (i * j) % 3) % 2) === 0;
            case 7: return (((i + j) % 2 + (i * j) % 3) % 2) === 0;
            default: return false;
          }
        },
        getErrorCorrectPolynomial(errorCorrectLength){
          let a = new QRPolynomial([1], 0);
          for(let i=0;i<errorCorrectLength;i++){
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
          }
          return a;
        },
        getLengthInBits(mode, version){
          if(mode === 2){
            if(version >= 1 && version < 10) return 8;
            if(version < 27) return 16;
            return 16;
          }
          return 8;
        }
      };
    })();

    function QRCodeModel(typeNumber, errorCorrectLevel){
      this.typeNumber = typeNumber;
      this.errorCorrectLevel = errorCorrectLevel;
      this.modules = null;
      this.moduleCount = 0;
      this.dataCache = null;
      this.dataList = [];

      this.addData = function(data){
        this.dataList.push(new QR8bitByte(data));
        this.dataCache = null;
      };

      this.isDark = function(row, col){
        if(this.modules[row][col] !== null){
          return this.modules[row][col];
        }
        return false;
      };

      this.getModuleCount = function(){ return this.moduleCount; };

      this.make = function(){
        if(this.typeNumber < 1) this.typeNumber = 1;
        this.makeImpl(false, this.getBestMaskPattern());
      };

      this.makeImpl = function(test, maskPattern){
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount);
        for(let row=0; row<this.moduleCount; row++){
          this.modules[row] = new Array(this.moduleCount);
          for(let col=0; col<this.moduleCount; col++){
            this.modules[row][col] = null;
          }
        }

        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);
        if(this.typeNumber >= 7) this.setupTypeNumber(test);

        if(this.dataCache === null){
          this.dataCache = this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
        }
        this.mapData(this.dataCache, maskPattern);
      };

      this.setupPositionProbePattern = function(row, col){
        for(let r=-1; r<=7; r++){
          if(row + r <= -1 || this.moduleCount <= row + r) continue;
          for(let c=-1; c<=7; c++){
            if(col + c <= -1 || this.moduleCount <= col + c) continue;
            if((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
               (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
               (2 <= r && r <= 4 && 2 <= c && c <= 4)){
              this.modules[row + r][col + c] = true;
            }else{
              this.modules[row + r][col + c] = false;
            }
          }
        }
      };

      this.getBestMaskPattern = function(){
        let minLostPoint = 0;
        let pattern = 0;
        for(let i=0; i<8; i++){
          this.makeImpl(true, i);
          const lostPoint = this.getLostPoint(this.modules);
          if(i === 0 || minLostPoint > lostPoint){
            minLostPoint = lostPoint;
            pattern = i;
          }
        }
        return pattern;
      };

      this.setupTimingPattern = function(){
        for(let i=8; i<this.moduleCount - 8; i++){
          if(this.modules[i][6] === null) this.modules[i][6] = (i % 2 === 0);
          if(this.modules[6][i] === null) this.modules[6][i] = (i % 2 === 0);
        }
      };

      this.setupPositionAdjustPattern = function(){
        const pos = QRUtil.getPatternPosition(this.typeNumber);
        for(let i=0; i<pos.length; i++){
          for(let j=0; j<pos.length; j++){
            const row = pos[i];
            const col = pos[j];
            if(this.modules[row][col] !== null) continue;
            for(let r=-2; r<=2; r++){
              for(let c=-2; c<=2; c++){
                if(r === -2 || r === 2 || c === -2 || c === 2 ||
                   (r === 0 && c === 0)){
                  this.modules[row + r][col + c] = true;
                }else{
                  this.modules[row + r][col + c] = false;
                }
              }
            }
          }
        }
      };

      this.setupTypeNumber = function(test){
        const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        for(let i=0; i<18; i++){
          const mod = (!test && ((bits >> i) & 1) === 1);
          this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        }
        for(let i=0; i<18; i++){
          const mod = (!test && ((bits >> i) & 1) === 1);
          this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      };

      this.setupTypeInfo = function(test, maskPattern){
        const data = (this.errorCorrectLevel << 3) | maskPattern;
        const bits = QRUtil.getBCHTypeInfo(data);

        // vertical
        for(let i=0; i<15; i++){
          const mod = (!test && ((bits >> i) & 1) === 1);
          if(i < 6){
            this.modules[i][8] = mod;
          }else if(i < 8){
            this.modules[i + 1][8] = mod;
          }else{
            this.modules[this.moduleCount - 15 + i][8] = mod;
          }
        }

        // horizontal
        for(let i=0; i<15; i++){
          const mod = (!test && ((bits >> i) & 1) === 1);
          if(i < 8){
            this.modules[8][this.moduleCount - i - 1] = mod;
          }else if(i < 9){
            this.modules[8][15 - i - 1 + 1] = mod;
          }else{
            this.modules[8][15 - i - 1] = mod;
          }
        }

        // fixed module
        this.modules[this.moduleCount - 8][8] = (!test);
      };

      this.mapData = function(data, maskPattern){
        let inc = -1;
        let row = this.moduleCount - 1;
        let bitIndex = 7;
        let byteIndex = 0;

        for(let col=this.moduleCount - 1; col>0; col-=2){
          if(col === 6) col--;
          while(true){
            for(let c=0; c<2; c++){
              if(this.modules[row][col - c] === null){
                let dark = false;
                if(byteIndex < data.length){
                  dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                }
                const mask = QRUtil.getMask(maskPattern, row, col - c);
                if(mask) dark = !dark;
                this.modules[row][col - c] = dark;
                bitIndex--;
                if(bitIndex === -1){
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if(row < 0 || this.moduleCount <= row){
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      };

      this.createData = function(typeNumber, errorCorrectLevel, dataList){
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);

        const buffer = new QRBitBuffer();
        for(let i=0; i<dataList.length; i++){
          const data = dataList[i];
          buffer.put(data.mode, 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
          data.write(buffer);
        }

        // calc max data count
        let totalDataCount = 0;
        for(let i=0; i<rsBlocks.length; i++){
          totalDataCount += rsBlocks[i].dataCount;
        }

        // end code
        if(buffer.getLengthInBits() > totalDataCount * 8){
          throw new Error('code length overflow');
        }
        if(buffer.getLengthInBits() + 4 <= totalDataCount * 8){
          buffer.put(0, 4);
        }
        while(buffer.getLengthInBits() % 8 !== 0){
          buffer.putBit(false);
        }

        // padding
        while(true){
          if(buffer.getLengthInBits() >= totalDataCount * 8) break;
          buffer.put(PAD0, 8);
          if(buffer.getLengthInBits() >= totalDataCount * 8) break;
          buffer.put(PAD1, 8);
        }

        return this.createBytes(buffer, rsBlocks);
      };

      this.createBytes = function(buffer, rsBlocks){
        let offset = 0;

        let maxDcCount = 0;
        let maxEcCount = 0;

        const dcdata = new Array(rsBlocks.length);
        const ecdata = new Array(rsBlocks.length);

        for(let r=0; r<rsBlocks.length; r++){
          const dcCount = rsBlocks[r].dataCount;
          const ecCount = rsBlocks[r].totalCount - dcCount;

          maxDcCount = Math.max(maxDcCount, dcCount);
          maxEcCount = Math.max(maxEcCount, ecCount);

          dcdata[r] = new Array(dcCount);
          for(let i=0; i<dcdata[r].length; i++){
            dcdata[r][i] = 0xff & buffer.buffer[i + offset];
          }
          offset += dcCount;

          const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
          const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
          const modPoly = rawPoly.mod(rsPoly);

          ecdata[r] = new Array(rsPoly.getLength() - 1);
          for(let i=0; i<ecdata[r].length; i++){
            const modIndex = i + modPoly.getLength() - ecdata[r].length;
            ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
          }
        }

        let totalCodeCount = 0;
        for(let i=0; i<rsBlocks.length; i++){
          totalCodeCount += rsBlocks[i].totalCount;
        }

        const data = new Array(totalCodeCount);
        let index = 0;

        for(let i=0; i<maxDcCount; i++){
          for(let r=0; r<rsBlocks.length; r++){
            if(i < dcdata[r].length){
              data[index++] = dcdata[r][i];
            }
          }
        }

        for(let i=0; i<maxEcCount; i++){
          for(let r=0; r<rsBlocks.length; r++){
            if(i < ecdata[r].length){
              data[index++] = ecdata[r][i];
            }
          }
        }

        return data;
      };

      this.getLostPoint = function(modules){
        const moduleCount = this.moduleCount;
        let lostPoint = 0;

        // Level 1
        for(let row=0; row<moduleCount; row++){
          for(let col=0; col<moduleCount; col++){
            const dark = modules[row][col];
            let sameCount = 0;
            for(let r=-1; r<=1; r++){
              if(row + r < 0 || moduleCount <= row + r) continue;
              for(let c=-1; c<=1; c++){
                if(col + c < 0 || moduleCount <= col + c) continue;
                if(r === 0 && c === 0) continue;
                if(dark === modules[row + r][col + c]) sameCount++;
              }
            }
            if(sameCount > 5) lostPoint += (3 + sameCount - 5);
          }
        }

        // Level 2
        for(let row=0; row<moduleCount - 1; row++){
          for(let col=0; col<moduleCount - 1; col++){
            let count = 0;
            if(modules[row][col]) count++;
            if(modules[row + 1][col]) count++;
            if(modules[row][col + 1]) count++;
            if(modules[row + 1][col + 1]) count++;
            if(count === 0 || count === 4) lostPoint += 3;
          }
        }

        // Level 3
        for(let row=0; row<moduleCount; row++){
          for(let col=0; col<moduleCount - 6; col++){
            if(modules[row][col] && !modules[row][col+1] && modules[row][col+2] && modules[row][col+3] && modules[row][col+4] && !modules[row][col+5] && modules[row][col+6]){
              lostPoint += 40;
            }
          }
        }
        for(let col=0; col<moduleCount; col++){
          for(let row=0; row<moduleCount - 6; row++){
            if(modules[row][col] && !modules[row+1][col] && modules[row+2][col] && modules[row+3][col] && modules[row+4][col] && !modules[row+5][col] && modules[row+6][col]){
              lostPoint += 40;
            }
          }
        }

        // Level 4
        let darkCount = 0;
        for(let col=0; col<moduleCount; col++){
          for(let row=0; row<moduleCount; row++){
            if(modules[row][col]) darkCount++;
          }
        }
        const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;
      };
    }

    function makeQrData(text, opts){
      opts = opts || {};
      const level = (opts.level ?? 'M');
      const ec = (level === 'L') ? QRErrorCorrectLevel.L
              : (level === 'Q') ? QRErrorCorrectLevel.Q
              : (level === 'H') ? QRErrorCorrectLevel.H
              : QRErrorCorrectLevel.M;

      // Elegimos versión automática (1..10) buscando que quepa
      // (suficiente para textos típicos de AEAT simple)
      for(let v=1; v<=10; v++){
        try{
          const qr = new QRCodeModel(v, ec);
          qr.addData(text);
          qr.make();
          return qr;
        }catch(e){
          // try next version
        }
      }
      // fallback: fuerza v10
      const qr = new QRCodeModel(10, ec);
      qr.addData(text);
      qr.make();
      return qr;
    }

    function drawToCanvas(qr, canvas, scale){
      scale = scale || 4;
      const count = qr.getModuleCount();
      const size = count * scale;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,size,size);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,size,size);
      ctx.fillStyle = '#000';
      for(let r=0;r<count;r++){
        for(let c=0;c<count;c++){
          if(qr.isDark(r,c)){
            ctx.fillRect(c*scale, r*scale, scale, scale);
          }
        }
      }
    }

    return { makeQrData, drawToCanvas };
  })();

  /* =========================================================
     QR TEXT (AEAT template)
  ========================================================== */
  function buildQrTextForFactura(f){
    const aj = S.ajustes || {};
    const tpl = String(aj.qrTemplate || 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}');
    const nif = String((S.proveedor && S.proveedor.nif) || '').trim();
    const num = String(f.numero || '').trim();
    const fecha = String(f.fecha || '').trim();
    const total = round2(parseNum(f.total || 0)).toFixed(2);

    // Validación: si falta, devolvemos vacío (para NO poner QR en PDF si falla)
    if(!nif || !num || !fecha || !(parseNum(f.total) > 0)) return '';

    return tpl
      .replaceAll('{NIF}', encodeURIComponent(nif))
      .replaceAll('{NUM}', encodeURIComponent(num))
      .replaceAll('{FECHA}', encodeURIComponent(fecha))
      .replaceAll('{TOTAL}', encodeURIComponent(total));
  }

  function renderQrForFactura(f){
    const canvas = $('#qrCanvas');
    const fallback = $('#qrFallback');
    const txtArea = $('#qrText');
    const txtSmall = $('#qrTextSmall');
    if(!canvas) return;

    const qrText = buildQrTextForFactura(f);
    f.qrText = qrText;

    if(txtArea) txtArea.value = qrText || '';
    if(txtSmall) txtSmall.textContent = qrText ? decodeURIComponent(qrText) : '';

    if(!qrText){
      if(fallback){ fallback.style.display = 'flex'; fallback.textContent = 'QR no disponible (faltan datos)'; }
      const ctx = canvas.getContext('2d');
      canvas.width = 220; canvas.height = 220;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      return;
    }

    try{
      const qr = QR.makeQrData(qrText, { level:'M' });
      QR.drawToCanvas(qr, canvas, 4);
      if(fallback) fallback.style.display = 'none';
    }catch(e){
      if(fallback){ fallback.style.display = 'flex'; fallback.textContent = 'Error QR: no se insertará en PDF'; }
      const ctx = canvas.getContext('2d');
      canvas.width = 220; canvas.height = 220;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // Importante: si falla, dejamos qrText vacío para PDF
      f.qrText = '';
      if(txtArea) txtArea.value = '';
      if(txtSmall) txtSmall.textContent = '';
    }
  }

  function copyQrText(){
    const el = $('#qrText');
    const v = el ? el.value : '';
    if(!v){ toast('QR vacío'); return; }
    navigator.clipboard && navigator.clipboard.writeText(v).then(() => toast('Texto QR copiado')).catch(() => toast('No se pudo copiar'));
  }

  /* =========================================================
     PDF PRO (jsPDF + AutoTable si existe)
  ========================================================== */
  function getJsPdf(){
    return (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF ? window.jsPDF : null);
  }

  function canAutoTable(doc){
    return !!(doc && typeof doc.autoTable === 'function');
  }

  function cherryDataUrlFallback(){
    // Pequeño logo "cereza" en SVG B/W embebido, convertido a data URL
    const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="28" fill="#fff"/>
  <path d="M72 46c10-16 28-26 48-26" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M70 50c-4 30-8 40-20 56" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M102 48c-2 26 0 36 10 58" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="54" cy="118" r="22" fill="#111"/>
  <circle cx="108" cy="120" r="22" fill="#111"/>
  <path d="M120 20c-14 2-24 10-30 22" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`;
    const enc = encodeURIComponent(svg)
      .replaceAll('%0A','')
      .replaceAll('%20',' ')
      .replaceAll('%3D','=')
      .replaceAll('%3A',':')
      .replaceAll('%2F','/')
      .replaceAll('%22','"')
      .replaceAll('%2C',',');
    return `data:image/svg+xml;charset=utf-8,${enc}`;
  }

  function buildPdfLinesTable(f){
    // Columnas: producto, modo, cant, bruto, tara, neto, precio, origen, importe
    const rows = [];
    for(const l of ensureArray(f.lineas)){
      const prod = String(l.producto || '').trim();
      if(!prod) continue;

      const modo = (l.modo || 'kg');
      const cant = parseNum(l.cantidad);
      const bruto = parseNum(l.bruto);
      const tara = parseNum(l.taraKg);
      const neto = parseNum(l.neto);
      const precio = parseNum(l.precio);
      const origen = String(l.origen || '').trim();
      const imp = parseNum(l.importe);

      rows.push([
        prod,
        modo,
        cant ? String(round2(cant)) : '',
        (modo==='kg') ? String(round2(bruto)) : '',
        (modo==='kg') ? String(round2(tara)) : '',
        (modo==='kg' || modo==='caja') ? String(round2(neto || 0)) : '',
        precio ? String(round2(precio)) : '',
        origen,
        moneyES(imp)
      ]);
    }
    return rows;
  }

  function openPdfViewer(blobUrl){
    const modal = $('#pdfModal');
    const body = $('#pdfModalBody');
    const obj = $('#pdfObj');
    const frame = $('#pdfFrame');
    if(!modal || !body) return;

    body.classList.remove('isEmpty');
    if(obj){
      obj.data = blobUrl;
      obj.type = 'application/pdf';
      obj.classList.remove('hidden');
    }
    if(frame){
      frame.src = blobUrl;
      frame.classList.remove('hidden');
    }

    FM.modal && FM.modal.openModal('#pdfModal');
  }

  function closePdfViewer(){
    const obj = $('#pdfObj');
    const frame = $('#pdfFrame');
    if(obj) obj.data = '';
    if(frame) frame.src = '';
    FM.modal && FM.modal.closeModal('#pdfModal');
  }

  function buildPdf(doc, f, opts){
    opts = opts || {};
    const openViewer = !!opts.openViewer;

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Margins
    const M = 14;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FACTURA', M, 16);

    // Logo (B/W) a la derecha
    try{
      const img = cherryDataUrlFallback();
      doc.addImage(img, 'SVG', pageW - 40, 6, 30, 30);
    }catch(e){
      // ignore
    }

    // Provider / QR / Client blocks
    const prov = S.proveedor || {};
    const cli = f.cliente || {};
    const boxTop = 40;
    const boxH = 44;

    const leftX = M;
    const midX = pageW/2 - 24;
    const rightX = pageW - M - (pageW/2 - 24);

    // Provider box
    doc.setDrawColor(20);
    doc.setLineWidth(0.2);
    doc.rect(leftX, boxTop, (pageW/2 - 24) - M, boxH, 'S');

    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('PROVEEDOR', leftX + 3, boxTop + 6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(String(prov.nombre || ''), leftX + 3, boxTop + 12);
    doc.text(`NIF: ${String(prov.nif || '')}`, leftX + 3, boxTop + 17);
    doc.text(String(prov.dir || ''), leftX + 3, boxTop + 22);
    doc.text(`Tel: ${String(prov.tel || '')}`, leftX + 3, boxTop + 27);
    doc.text(String(prov.email || ''), leftX + 3, boxTop + 32);

    // QR box
    doc.rect(midX, boxTop, 48, boxH, 'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('QR', midX + 3, boxTop + 6);

    // Client box
    doc.rect(rightX, boxTop, (pageW - M) - rightX, boxH, 'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('CLIENTE', rightX + 3, boxTop + 6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(String(cli.nombre || ''), rightX + 3, boxTop + 12);
    doc.text(`NIF/CIF: ${String(cli.nif || '')}`, rightX + 3, boxTop + 17);
    doc.text(String(cli.dir || ''), rightX + 3, boxTop + 22);
    if(cli.tel) doc.text(`Tel: ${String(cli.tel || '')}`, rightX + 3, boxTop + 27);
    if(cli.email) doc.text(String(cli.email || ''), rightX + 3, boxTop + 32);

    // Meta row (num, fecha, tags)
    const metaY = boxTop + boxH + 10;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(`Nº: ${String(f.numero || '')}`, M, metaY);
    doc.setFont('helvetica','normal');
    doc.text(`Fecha: ${fmtESDate(f.fecha)}`, M + 70, metaY);
    if(f.tags){
      doc.text(`Tags: ${String(f.tags)}`, M + 125, metaY);
    }

    // QR embed (ONLY if QR rendered ok)
    let qrOk = false;
    try{
      const c = $('#qrCanvas');
      if(c && f.qrText){
        const png = c.toDataURL('image/png');
        doc.addImage(png, 'PNG', midX + 6, boxTop + 10, 36, 36);
        qrOk = true;
      }
    }catch(e){
      qrOk = false;
    }
    if(!qrOk){
      // If fails, we DO NOT insert QR in PDF (per requirement)
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text('QR no disponible', midX + 6, boxTop + 22);
    }

    // Lines table
    const head = [[
      'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe'
    ]];
    const body = buildPdfLinesTable(f);

    const startY = metaY + 8;

    if(canAutoTable(doc)){
      doc.autoTable({
        startY,
        head,
        body,
        theme: 'grid',
        styles: { font:'helvetica', fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [60,60,60] },
        headStyles: { fillColor: [17,17,17], textColor: 255, fontStyle:'bold' },
        alternateRowStyles: { fillColor: [245,245,245] },
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 12 },
          2: { cellWidth: 14, halign:'right' },
          3: { cellWidth: 16, halign:'right' },
          4: { cellWidth: 16, halign:'right' },
          5: { cellWidth: 16, halign:'right' },
          6: { cellWidth: 16, halign:'right' },
          7: { cellWidth: 34 },
          8: { cellWidth: 24, halign:'right' }
        },
        didDrawPage: (data) => {
          // Footer with page numbering
          const pageCount = doc.getNumberOfPages();
          const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;

          doc.setFont('helvetica','normal');
          doc.setFontSize(8);
          doc.text(`Página ${pageCurrent}/${pageCount}`, pageW - M - 30, pageH - 8);

          doc.setFontSize(7);
          const note = f.ivaIncluido ? 'IVA incluido en los precios (sin desglose).' : 'IVA desglosado según ajustes.';
          doc.text(note, M, pageH - 8);
        }
      });

      // Totals block under table
      const after = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : (startY + 60);
      const y = Math.min(after, pageH - 55);

      doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text('TOTALES', M, y);

      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.text(`Subtotal: ${moneyES(f.subtotal || 0)}`, M, y + 6);
      if(f.transporteOn) doc.text(`Transporte: ${moneyES(f.transporte || 0)}`, M, y + 11);

      if(f.ivaIncluido){
        doc.text(`IVA: incluido`, M, y + (f.transporteOn ? 16 : 11));
        doc.setFont('helvetica','bold');
        doc.text(`TOTAL: ${moneyES(f.total || 0)}`, M, y + (f.transporteOn ? 22 : 17));
      }else{
        doc.text(`IVA: ${moneyES(f.iva || 0)}`, M, y + (f.transporteOn ? 16 : 11));
        doc.setFont('helvetica','bold');
        doc.text(`TOTAL: ${moneyES(f.total || 0)}`, M, y + (f.transporteOn ? 22 : 17));
      }

      doc.setFont('helvetica','normal');
      doc.text(`Pendiente: ${moneyES(f.pendiente || 0)}`, M, y + (f.transporteOn ? 28 : 23));

      // Observaciones
      const obsY = y + (f.transporteOn ? 36 : 31);
      const obs = String(f.observaciones || '').trim();
      if(obs){
        doc.setFont('helvetica','bold'); doc.setFontSize(10);
        doc.text('OBSERVACIONES', M, obsY);
        doc.setFont('helvetica','normal'); doc.setFontSize(9);
        const lines = doc.splitTextToSize(obs, pageW - 2*M);
        doc.text(lines, M, obsY + 6);
      }
    }else{
      // Fallback sin autoTable
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text('⚠️ AutoTable no está disponible. Añade jsPDF AutoTable en index.html.', M, startY);
    }

    // Return Blob URL
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    return url;
  }

  async function generatePdfForFactura(f, opts){
    opts = opts || {};
    const JsPDF = getJsPdf();
    if(!JsPDF){
      toast('PDF: falta jsPDF en index.html');
      return null;
    }

    // Asegurar QR actualizado (si falla, f.qrText se vacía y no se añade en PDF)
    renderQrForFactura(f);

    const doc = new JsPDF({ unit:'mm', format:'a4' });
    const url = buildPdf(doc, f, opts);

    if(opts.openViewer){
      openPdfViewer(url);
    }
    return { url, blobUrl: url };
  }

  FM.pdf = {
    generate: generatePdfForFactura
  };

  /* =========================================================
     LISTADO FACTURAS (búsqueda + abrir para editar + ver PDF)
  ========================================================== */
  function renderFacturasList(){
    const box = $('#listaFacturas');
    if(!box) return;

    const q = normalizeUpper(getVal('#buscarFacturas'));
    const from = getVal('#fDesde');
    const to = getVal('#fHasta');
    const tag = normalizeUpper(getVal('#fTag'));
    const cli = normalizeUpper(getVal('#fCliente'));

    const list = ensureArray(S.facturas).slice();

    // ordenar por fecha desc, luego id
    list.sort((a,b) => {
      const fa = String(a.fecha || '');
      const fb = String(b.fecha || '');
      if(fa !== fb) return fb.localeCompare(fa);
      return String(b.numero||'').localeCompare(String(a.numero||''));
    });

    const out = [];
    for(const f of list){
      const num = normalizeUpper(f.numero || '');
      const cName = normalizeUpper((f.cliente && f.cliente.nombre) || '');
      const tags = normalizeUpper(f.tags || '');
      const okQ = !q || num.includes(q) || cName.includes(q) || tags.includes(q);
      if(!okQ) continue;

      if(from && String(f.fecha||'') < from) continue;
      if(to && String(f.fecha||'') > to) continue;

      if(tag && !tags.includes(tag)) continue;
      if(cli && !cName.includes(cli)) continue;

      const estado = f.estado || 'impagada';
      const est = (estado === 'pagada') ? '✅ pagada' : (estado === 'parcial') ? '🟨 parcial' : '⬜ impagada';
      out.push(`
        <div class="item" data-fact-id="${esc(f.id)}">
          <div class="itemTop">
            <div class="itemTitle">${esc(f.numero || '')}</div>
            <div class="itemBtns">
              <button class="btn btnTiny btnGhost btnOpenFact" type="button">Editar</button>
              <button class="btn btnTiny btnGhost btnViewPdf" type="button">Ver PDF</button>
            </div>
          </div>
          <div class="itemSub">
            ${esc(fmtESDate(f.fecha))} · ${esc((f.cliente && f.cliente.nombre) || '')} · ${esc(est)} · Total: ${esc(moneyES(f.total||0))}
            ${f.tags ? ` · Tags: ${esc(f.tags)}` : ``}
          </div>
        </div>
      `);
    }

    box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin resultados</div><div class="itemSub">Prueba a cambiar filtros.</div></div>`;
  }

  function bindFacturasListUI(){
    on($('#buscarFacturas'),'input', renderFacturasList);
    on($('#fDesde'),'change', renderFacturasList);
    on($('#fHasta'),'change', renderFacturasList);
    on($('#fTag'),'input', renderFacturasList);
    on($('#fCliente'),'input', renderFacturasList);

    on($('#listaFacturas'),'click', async (ev) => {
      const btnEdit = ev.target.closest && ev.target.closest('.btnOpenFact');
      const btnPdf = ev.target.closest && ev.target.closest('.btnViewPdf');
      const item = ev.target.closest && ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-fact-id');
      if(!id) return;
      const f = S.facturas.find(x => x.id === id);
      if(!f) return;

      if(btnEdit){
        FM.facturas.setFacturaActual(f.id);
        FM.showTab('tabFactura');
        if(FM.facturaUI && FM.facturaUI.loadFacturaToUI) FM.facturaUI.loadFacturaToUI(f);
        renderQrForFactura(f);
        return;
      }

      if(btnPdf){
        if(FM.pdf && FM.pdf.generate){
          await FM.pdf.generate(f, { openViewer:true });
        }else{
          toast('PDF no disponible');
        }
      }
    });
  }

  /* =========================================================
     CLIENTES CRUD
  ========================================================== */
  let editingClienteId = '';

  function renderClientesList(){
    const box = $('#listaClientes');
    if(!box) return;

    const q = normalizeUpper(getVal('#buscarClientes'));
    const out = [];
    for(const c of ensureArray(S.clientes)){
      const name = normalizeUpper(c.nombre || '');
      const nif = normalizeUpper(c.nif || '');
      const ok = !q || name.includes(q) || nif.includes(q);
      if(!ok) continue;

      out.push(`
        <div class="item ${editingClienteId===c.id?'isActive':''}" data-cli-id="${esc(c.id)}">
          <div class="itemTop">
            <div class="itemTitle">${esc(c.nombre || '')}</div>
            <div class="itemBtns">
              <button class="btn btnTiny btnGhost btnEditCli" type="button">Editar</button>
            </div>
          </div>
          <div class="itemSub">${esc(c.nif || '')}${c.dir ? ` · ${esc(c.dir)}`:''}</div>
        </div>
      `);
    }
    box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin resultados</div><div class="itemSub">Escribe para buscar.</div></div>`;
  }

  function clearClienteEditor(){
    editingClienteId = '';
    setVal('#cNombre','');
    setVal('#cAlias','');
    setVal('#cNif','');
    setVal('#cDir','');
    setVal('#cTel','');
    setVal('#cEmail','');
    setVal('#cNotas','');

    setChk('#cTplIvaIncluido', false);
    setChk('#cTplTransporte', false);
    setVal('#cTplPago','');
    setVal('#cTplTagsAuto','');
    setVal('#cTplNotasStd','');

    renderClientesList();
  }

  function loadClienteToEditor(c){
    editingClienteId = c.id;
    setVal('#cNombre', c.nombre || '');
    setVal('#cAlias', c.alias || '');
    setVal('#cNif', c.nif || '');
    setVal('#cDir', c.dir || '');
    setVal('#cTel', c.tel || '');
    setVal('#cEmail', c.email || '');
    setVal('#cNotas', c.notas || '');

    const tpl = c.tpl || {};
    setChk('#cTplIvaIncluido', !!tpl.ivaIncluido);
    setChk('#cTplTransporte', !!tpl.transporte);
    setVal('#cTplPago', tpl.pago || '');
    setVal('#cTplTagsAuto', tpl.tagsAuto || '');
    setVal('#cTplNotasStd', tpl.notasStd || '');

    renderClientesList();
  }

  function saveClienteFromEditor(){
    const c = {
      id: editingClienteId || FM.uid(),
      nombre: getVal('#cNombre').trim(),
      alias: getVal('#cAlias').trim(),
      nif: getVal('#cNif').trim(),
      dir: getVal('#cDir').trim(),
      tel: getVal('#cTel').trim(),
      email: getVal('#cEmail').trim(),
      notas: getVal('#cNotas').trim(),
      tpl: {
        ivaIncluido: getChk('#cTplIvaIncluido'),
        transporte: getChk('#cTplTransporte'),
        pago: getVal('#cTplPago').trim(),
        tagsAuto: getVal('#cTplTagsAuto').trim(),
        notasStd: getVal('#cTplNotasStd').trim()
      }
    };

    if(!c.nombre){
      toast('Cliente: nombre obligatorio');
      return;
    }

    const idx = S.clientes.findIndex(x => x.id === c.id);
    if(idx >= 0) S.clientes[idx] = c;
    else S.clientes.unshift(c);

    save(K.CLIENTES, S.clientes);
    editingClienteId = c.id;
    renderClientesList();
    toast('Cliente guardado');
  }

  function deleteCliente(){
    if(!editingClienteId){
      toast('Selecciona un cliente');
      return;
    }
    if(isFacturaUsedCliente(editingClienteId)){
      toast('No se puede eliminar: usado en facturas');
      return;
    }
    const c = S.clientes.find(x => x.id === editingClienteId);
    const ok = confirm(`¿Eliminar cliente "${(c && c.nombre) || ''}"?`);
    if(!ok) return;
    S.clientes = S.clientes.filter(x => x.id !== editingClienteId);
    save(K.CLIENTES, S.clientes);
    clearClienteEditor();
    toast('Cliente eliminado');
  }

  function bindClientesUI(){
    on($('#buscarClientes'),'input', renderClientesList);

    on($('#btnNuevoCliente'),'click', () => {
      clearClienteEditor();
      setVal('#cNombre','Nuevo cliente');
      safeFocus($('#cNombre'));
    });

    on($('#btnGuardarCliente'),'click', saveClienteFromEditor);
    on($('#btnEliminarCliente'),'click', deleteCliente);
    on($('#btnLimpiarCliente'),'click', clearClienteEditor);

    on($('#listaClientes'),'click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.btnEditCli');
      const item = ev.target.closest && ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-cli-id');
      if(!id) return;
      if(btn || item){
        const c = S.clientes.find(x => x.id === id);
        if(c) loadClienteToEditor(c);
      }
    });
  }

  /* =========================================================
     TARAS CRUD
  ========================================================== */
  let editingTaraId = '';

  function renderTarasList(){
    const box = $('#listaTaras');
    if(!box) return;
    const q = normalizeUpper(getVal('#buscarTaras'));
    const out = [];
    for(const t of ensureArray(S.taras)){
      const name = normalizeUpper(t.nombre || '');
      const ok = !q || name.includes(q);
      if(!ok) continue;
      const w = parseNum(t.peso ?? t.pesoKg ?? t.kg ?? 0);
      out.push(`
        <div class="item ${editingTaraId===t.id?'isActive':''}" data-tara-id="${esc(t.id)}">
          <div class="itemTop">
            <div class="itemTitle">${esc(t.nombre || '')}</div>
            <div class="itemBtns">
              <button class="btn btnTiny btnGhost btnEditTara" type="button">Editar</button>
            </div>
          </div>
          <div class="itemSub">Tara: ${esc(w.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2}))} kg${t.notas?` · ${esc(t.notas)}`:''}</div>
        </div>
      `);
    }
    box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin taras</div><div class="itemSub">Crea una tara nueva.</div></div>`;
  }

  function clearTaraEditor(){
    editingTaraId = '';
    setVal('#tNombre','');
    setVal('#tPeso','');
    setVal('#tNotas','');
    renderTarasList();
  }

  function loadTaraToEditor(t){
    editingTaraId = t.id;
    setVal('#tNombre', t.nombre || '');
    setVal('#tPeso', String(parseNum(t.peso ?? t.pesoKg ?? t.kg ?? 0)));
    setVal('#tNotas', t.notas || '');
    renderTarasList();
  }

  function saveTaraFromEditor(){
    const t = {
      id: editingTaraId || FM.uid(),
      nombre: getVal('#tNombre').trim(),
      peso: round2(parseNum(getVal('#tPeso'))),
      notas: getVal('#tNotas').trim()
    };
    if(!t.nombre){
      toast('Tara: nombre obligatorio');
      return;
    }
    const idx = S.taras.findIndex(x => x.id === t.id);
    if(idx >= 0) S.taras[idx] = t;
    else S.taras.unshift(t);

    save(K.TARAS, S.taras);
    editingTaraId = t.id;
    renderTarasList();
    toast('Tara guardada');

    // refrescar selects de taras en grid si existe
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.renderGridPro){
      FM.facturaUI.renderGridPro(f);
      FM.facturaUI.recalcFactura(f, true);
      FM.facturaUI.saveFacturaToState(f);
    }
  }

  function deleteTara(){
    if(!editingTaraId){
      toast('Selecciona una tara');
      return;
    }
    // Si está usada como default en productos o en líneas -> permitir borrar? Mejor proteger.
    const usedInProducts = ensureArray(S.productos).some(p => p.taraDefaultId === editingTaraId);
    const usedInLines = ensureArray(S.facturas).some(f => ensureArray(f.lineas).some(l => l.taraId === editingTaraId));
    if(usedInProducts || usedInLines){
      toast('No se puede eliminar: usada en productos/facturas');
      return;
    }

    const t = S.taras.find(x => x.id === editingTaraId);
    const ok = confirm(`¿Eliminar tara "${(t && t.nombre) || ''}"?`);
    if(!ok) return;
    S.taras = S.taras.filter(x => x.id !== editingTaraId);
    save(K.TARAS, S.taras);
    clearTaraEditor();
    toast('Tara eliminada');

    // refrescar grid
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.renderGridPro){
      FM.facturaUI.renderGridPro(f);
      FM.facturaUI.recalcFactura(f, true);
      FM.facturaUI.saveFacturaToState(f);
    }
  }

  function bindTarasUI(){
    on($('#buscarTaras'),'input', renderTarasList);
    on($('#btnNuevaTara'),'click', () => { clearTaraEditor(); setVal('#tNombre','Caja plástico'); safeFocus($('#tNombre')); });
    on($('#btnGuardarTara'),'click', saveTaraFromEditor);
    on($('#btnEliminarTara'),'click', deleteTara);
    on($('#btnLimpiarTara'),'click', clearTaraEditor);

    on($('#listaTaras'),'click', (ev) => {
      const item = ev.target.closest && ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-tara-id');
      if(!id) return;
      const t = S.taras.find(x => x.id === id);
      if(t) loadTaraToEditor(t);
    });
  }

  /* =========================================================
     PRODUCTOS CRUD + HIST + TARA DEFAULT
  ========================================================== */
  let editingProdId = '';

  function renderProductosList(){
    const box = $('#listaProductos');
    if(!box) return;
    const q = normalizeUpper(getVal('#buscarProductos'));
    const out = [];
    for(const p of ensureArray(S.productos)){
      const name = normalizeUpper(p.nombre || '');
      const ok = !q || name.includes(q);
      if(!ok) continue;

      const modo = p.modo || 'kg';
      const hint = (Array.isArray(p.hist) && p.hist.length) ? `último ${p.hist[0].modo}:${p.hist[0].precio}` : '';
      out.push(`
        <div class="item ${editingProdId===p.id?'isActive':''}" data-prod-id="${esc(p.id)}">
          <div class="itemTop">
            <div class="itemTitle">${esc(p.nombre || '')}</div>
            <div class="itemBtns">
              <button class="btn btnTiny btnGhost btnEditProd" type="button">Editar</button>
            </div>
          </div>
          <div class="itemSub">
            Modo: ${esc(modo)}${parseNum(p.kgCaja)>0?` · Kg/caja: ${esc(String(round2(p.kgCaja)))}`:''}
            ${parseNum(p.precioKg)>0?` · €/kg: ${esc(String(round2(p.precioKg)))}`:''}
            ${parseNum(p.precioCaja)>0?` · €/caja: ${esc(String(round2(p.precioCaja)))}`:''}
            ${parseNum(p.precioUd)>0?` · €/ud: ${esc(String(round2(p.precioUd)))}`:''}
            ${hint?` · ${esc(hint)}`:''}
          </div>
        </div>
      `);
    }
    box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin resultados</div><div class="itemSub">Busca por nombre.</div></div>`;
  }

  function clearProductoEditor(){
    editingProdId = '';
    setVal('#pNombre','');
    setVal('#pModo','kg');
    setVal('#pKgCaja','');
    setVal('#pPrecioKg','');
    setVal('#pPrecioCaja','');
    setVal('#pPrecioUd','');
    setVal('#pCoste','');
    setVal('#pOrigen','');
    setVal('#pHist','');
    renderProductosList();

    // refrescar select tara default
    if($('#pTaraDefault')){
      // vacío
      $('#pTaraDefault').innerHTML = '<option value="">— Sin envase —</option>';
    }
  }

  function loadProductoToEditor(p){
    editingProdId = p.id;
    setVal('#pNombre', p.nombre || '');
    setVal('#pModo', p.modo || 'kg');
    setVal('#pKgCaja', String(parseNum(p.kgCaja || 0)));
    setVal('#pPrecioKg', String(parseNum(p.precioKg || 0)));
    setVal('#pPrecioCaja', String(parseNum(p.precioCaja || 0)));
    setVal('#pPrecioUd', String(parseNum(p.precioUd || 0)));
    setVal('#pCoste', String(parseNum(p.coste || 0)));
    setVal('#pOrigen', p.origen || '');

    // Tara default options (con taras actuales)
    if(FM.facturaUI && FM.facturaUI.renderGridPro){
      // usamos función de 3B para render, pero aquí generamos el select simple
      const sel = $('#pTaraDefault');
      if(sel){
        const items = ['<option value="">— Sin envase —</option>'];
        for(const t of ensureArray(S.taras)){
          const name = `${t.nombre ?? ''}`.trim();
          const w = parseNum(t.peso ?? t.pesoKg ?? t.kg ?? 0);
          const lab = name ? `${name} (${w.toLocaleString('es-ES',{minimumFractionDigits:2, maximumFractionDigits:2})} kg)` : `(tara ${w})`;
          const selAttr = (t.id === (p.taraDefaultId||'')) ? 'selected' : '';
          items.push(`<option value="${esc(t.id)}" ${selAttr}>${esc(lab)}</option>`);
        }
        sel.innerHTML = items.join('');
      }
    }

    // Historial (solo pantalla)
    const h = [];
    for(const it of ensureArray(p.hist)){
      const d = new Date(it.ts || Date.now());
      const when = `${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`;
      h.push(`${when} · ${it.modo}:${it.precio}`);
    }
    setVal('#pHist', h.join('\n'));

    renderProductosList();
  }

  function saveProductoFromEditor(){
    const p = {
      id: editingProdId || FM.uid(),
      nombre: getVal('#pNombre').trim().toUpperCase(),
      modo: getVal('#pModo') || 'kg',
      kgCaja: round2(parseNum(getVal('#pKgCaja'))),
      precioKg: round2(parseNum(getVal('#pPrecioKg'))),
      precioCaja: round2(parseNum(getVal('#pPrecioCaja'))),
      precioUd: round2(parseNum(getVal('#pPrecioUd'))),
      coste: round2(parseNum(getVal('#pCoste'))),
      origen: getVal('#pOrigen').trim(),
      taraDefaultId: getVal('#pTaraDefault') || '',
      hist: []
    };

    if(!p.nombre){
      toast('Producto: nombre obligatorio');
      return;
    }

    // mantener historial si existe
    const old = S.productos.find(x => x.id === p.id);
    if(old && Array.isArray(old.hist)) p.hist = old.hist;

    const idx = S.productos.findIndex(x => x.id === p.id);
    if(idx >= 0) S.productos[idx] = p;
    else S.productos.unshift(p);

    // normalizar duplicados por nombre: no borramos, pero evitamos líos
    // (si hay duplicados, el sistema sigue funcionando; el usuario puede limpiar)
    save(K.PRODUCTOS, S.productos);
    editingProdId = p.id;
    renderProductosList();
    toast('Producto guardado');

    // refrescar grid (hints + precios)
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.renderGridPro){
      FM.facturaUI.renderGridPro(f);
      FM.facturaUI.recalcFactura(f, true);
      FM.facturaUI.saveFacturaToState(f);
    }
  }

  function deleteProducto(){
    if(!editingProdId){
      toast('Selecciona un producto');
      return;
    }
    const p = S.productos.find(x => x.id === editingProdId);
    if(!p) return;
    if(isProductoUsed(p.nombre)){
      toast('No se puede eliminar: usado en facturas');
      return;
    }
    const ok = confirm(`¿Eliminar producto "${p.nombre}"?`);
    if(!ok) return;
    S.productos = S.productos.filter(x => x.id !== editingProdId);
    save(K.PRODUCTOS, S.productos);
    clearProductoEditor();
    toast('Producto eliminado');

    // refrescar grid
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.renderGridPro){
      FM.facturaUI.renderGridPro(f);
      FM.facturaUI.recalcFactura(f, true);
      FM.facturaUI.saveFacturaToState(f);
    }
  }

  function bindProductosUI(){
    on($('#buscarProductos'),'input', renderProductosList);
    on($('#btnNuevoProducto'),'click', () => { clearProductoEditor(); setVal('#pNombre','NUEVO PRODUCTO'); safeFocus($('#pNombre')); });
    on($('#btnGuardarProducto'),'click', saveProductoFromEditor);
    on($('#btnEliminarProducto'),'click', deleteProducto);
    on($('#btnLimpiarProducto'),'click', clearProductoEditor);

    on($('#listaProductos'),'click', (ev) => {
      const item = ev.target.closest && ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-prod-id');
      if(!id) return;
      const p = S.productos.find(x => x.id === id);
      if(p) loadProductoToEditor(p);
    });
  }

  /* =========================================================
     AJUSTES
  ========================================================== */
  function loadAjustesToUI(){
    setVal('#ajIva', String(S.ajustes.ivaPct ?? 4));
    setVal('#ajTransporte', String(S.ajustes.transportePct ?? 10));
    setVal('#ajPin', String(S.ajustes.pin ?? '8410'));
    setVal('#ajQrPlantilla', String(S.ajustes.qrTemplate ?? 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}'));

    // Firebase cfg
    const cfg = load(K.CLOUDCFG, null);
    setVal('#fbCfg', cfg ? JSON.stringify(cfg, null, 2) : '');
  }

  function saveAjustesFromUI(){
    S.ajustes.ivaPct = clamp(parseNum(getVal('#ajIva') || 4), 0, 99);
    S.ajustes.transportePct = clamp(parseNum(getVal('#ajTransporte') || 10), 0, 99);
    S.ajustes.pin = String(getVal('#ajPin') || '8410').trim() || '8410';
    S.ajustes.qrTemplate = String(getVal('#ajQrPlantilla') || '').trim() || 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}';
    save(K.AJUSTES, S.ajustes);

    // Cloud cfg
    const raw = String(getVal('#fbCfg') || '').trim();
    if(raw){
      const cfg = safeJsonParse(raw, null);
      if(cfg && typeof cfg === 'object'){
        save(K.CLOUDCFG, cfg);
        S.cloud.cfg = cfg;
        toast('Ajustes guardados (Cloud cfg OK)');
      }else{
        toast('Cloud cfg inválida (JSON)');
      }
    }else{
      save(K.CLOUDCFG, null);
      S.cloud.cfg = null;
      toast('Ajustes guardados');
    }

    // Recalcular factura actual (IVA/transport)
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.recalcFactura){
      FM.facturaUI.recalcFactura(f, true);
      FM.facturaUI.saveFacturaToState(f);
      renderQrForFactura(f);
    }

    renderDiagAndCloudIndicator();
  }

  function bindAjustesUI(){
    on($('#btnGuardarAjustes'),'click', saveAjustesFromUI);
    on($('#btnReloadAjustes'),'click', () => { S.ajustes = load(K.AJUSTES, S.ajustes); loadAjustesToUI(); toast('Ajustes recargados'); });
    on($('#btnCopyQrText'),'click', copyQrText);
  }

  /* =========================================================
     CONTABILIDAD (PIN) + KPIs + FILTROS + CSV
  ========================================================== */
  function computeContabilidadFiltered(){
    const desde = getVal('#cDesde');
    const hasta = getVal('#cHasta');
    const qCli = normalizeUpper(getVal('#cCliente'));
    const qTag = normalizeUpper(getVal('#cTag'));

    const rows = [];
    for(const f of ensureArray(S.facturas)){
      if(desde && String(f.fecha||'') < desde) continue;
      if(hasta && String(f.fecha||'') > hasta) continue;

      const cli = normalizeUpper((f.cliente && f.cliente.nombre) || '');
      const tags = normalizeUpper(f.tags || '');
      if(qCli && !cli.includes(qCli)) continue;
      if(qTag && !tags.includes(qTag)) continue;

      rows.push(f);
    }

    // KPIs
    let ventas = 0;
    let iva = 0;
    let n = 0;
    let margen = 0;

    for(const f of rows){
      n++;
      ventas += parseNum(f.total || 0);
      // IVA interno calculado ya (si incluido lo guardamos como f.iva)
      iva += parseNum(f.iva || 0);

      // margen: si coste existe por producto
      for(const l of ensureArray(f.lineas)){
        const prod = normalizeUpper(l.producto);
        if(!prod) continue;
        const pObj = ensureArray(S.productos).find(p => normalizeUpper(p.nombre) === prod);
        if(!pObj) continue;
        const coste = parseNum(pObj.coste || 0);
        if(coste <= 0) continue;

        const modo = l.modo || 'kg';
        const precio = parseNum(l.precio || 0);
        let qtyCost = 0;

        if(modo === 'kg'){
          qtyCost = parseNum(l.neto || 0);
        }else if(modo === 'caja' || modo === 'ud'){
          qtyCost = parseNum(l.cantidad || 0);
        }
        // margen aprox = (precio - coste) * qty
        margen += (precio - coste) * qtyCost;
      }
    }

    return {
      rows,
      kpi: {
        ventas: round2(ventas),
        iva: round2(iva),
        num: n,
        margen: round2(margen)
      }
    };
  }

  function renderContabilidad(){
    if(!isUnlocked('contabilidad')){
      renderLockIndicators();
      return;
    }

    const res = computeContabilidadFiltered();
    if($('#kpiVentas')) $('#kpiVentas').textContent = moneyES(res.kpi.ventas);
    if($('#kpiIva')) $('#kpiIva').textContent = moneyES(res.kpi.iva);
    if($('#kpiNumFact')) $('#kpiNumFact').textContent = String(res.kpi.num);
    if($('#kpiMargen')) $('#kpiMargen').textContent = moneyES(res.kpi.margen);
    if($('#kpiPendientes')) {
      const pend = res.rows.reduce((a,f)=>a + parseNum(f.pendiente||0), 0);
      $('#kpiPendientes').textContent = moneyES(round2(pend));
    }

    const box = $('#tablaContabilidad');
    if(box){
      const out = [];
      for(const f of res.rows){
        out.push(`
          <div class="item" data-fact-id="${esc(f.id)}">
            <div class="itemTop">
              <div class="itemTitle">${esc(fmtESDate(f.fecha))} · ${esc(f.numero||'')}</div>
              <div class="itemBtns">
                <button class="btn btnTiny btnGhost btnEditFromCont" type="button">Abrir</button>
              </div>
            </div>
            <div class="itemSub">
              ${esc((f.cliente && f.cliente.nombre) || '')} · Total: ${esc(moneyES(f.total||0))} · Pend: ${esc(moneyES(f.pendiente||0))}
              ${f.tags ? ` · ${esc(f.tags)}`:''}
            </div>
          </div>
        `);
      }
      box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin resultados</div><div class="itemSub">Ajusta filtros.</div></div>`;
    }
  }

  function exportContabilidadCSV(){
    if(!requireUnlockOrOpenPin('contabilidad','PIN: contabilidad')) return;

    const res = computeContabilidadFiltered();
    const header = ['Fecha','Numero','Cliente','Tags','Total','IVA(interno)','Pendiente','Estado','Metodo'];
    const lines = [header.join(';')];

    for(const f of res.rows){
      const row = [
        fmtESDate(f.fecha),
        String(f.numero||''),
        String((f.cliente && f.cliente.nombre) || ''),
        String(f.tags||''),
        String(round2(parseNum(f.total||0))).replace('.',','),
        String(round2(parseNum(f.iva||0))).replace('.',','),
        String(round2(parseNum(f.pendiente||0))).replace('.',','),
        String(f.estado||''),
        String(f.metodoPago||'')
      ].map(v => `"${String(v).replaceAll('"','""')}"`);
      lines.push(row.join(';'));
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contabilidad_${isoDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('CSV exportado');
  }

  function bindContabilidadUI(){
    on($('#btnContUnlock'), 'click', () => requireUnlockOrOpenPin('contabilidad','PIN: contabilidad'));
    on($('#btnContLock'), 'click', () => { setUnlocked('contabilidad', false); toast('Contabilidad bloqueada'); });

    on($('#cDesde'),'change', renderContabilidad);
    on($('#cHasta'),'change', renderContabilidad);
    on($('#cCliente'),'input', renderContabilidad);
    on($('#cTag'),'input', renderContabilidad);
    on($('#btnContCSV'),'click', exportContabilidadCSV);

    on($('#tablaContabilidad'), 'click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.btnEditFromCont');
      if(!btn) return;
      const item = ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-fact-id');
      const f = S.facturas.find(x => x.id === id);
      if(!f) return;
      FM.facturas.setFacturaActual(f.id);
      FM.showTab('tabFactura');
      if(FM.facturaUI && FM.facturaUI.loadFacturaToUI) FM.facturaUI.loadFacturaToUI(f);
      renderQrForFactura(f);
    });
  }

  /* =========================================================
     VENTAS DIARIAS (PIN) — San Pablo / San Lesmes / Santiago
  ========================================================== */
  function normalizeTienda(v){
    v = String(v||'').toLowerCase();
    if(v.includes('lesmes')) return 'san_lesmes';
    if(v.includes('santiago')) return 'santiago';
    return 'san_pablo';
  }

  function tiendaLabel(t){
    if(t === 'san_lesmes') return 'San Lesmes';
    if(t === 'santiago') return 'Santiago';
    return 'San Pablo';
  }

  function renderVentasList(){
    const box = $('#listaVentas');
    if(!box) return;

    if(!isUnlocked('ventas')){
      renderLockIndicators();
      box.innerHTML = `<div class="lockedOverlay">🔒 Ventas protegidas. Introduce PIN 8410.</div>`;
      return;
    }

    const qTienda = normalizeTienda(getVal('#vTienda'));
    const desde = getVal('#vDesde');
    const hasta = getVal('#vHasta');

    const list = ensureArray(S.ventas).slice();
    list.sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||'')));

    const out = [];
    for(const v of list){
      if(qTienda && normalizeTienda(v.tienda) !== qTienda) continue;
      if(desde && String(v.fecha||'') < desde) continue;
      if(hasta && String(v.fecha||'') > hasta) continue;

      const total = round2(parseNum(v.efectivo) + parseNum(v.tarjeta));
      out.push(`
        <div class="item" data-venta-id="${esc(v.id)}">
          <div class="itemTop">
            <div class="itemTitle">${esc(fmtESDate(v.fecha))} · ${esc(v.diaSemana || '')}</div>
            <div class="itemBtns">
              <button class="btn btnTiny btnDangerGhost btnDelVenta" type="button">Eliminar</button>
            </div>
          </div>
          <div class="itemSub">
            ${esc(tiendaLabel(v.tienda))} · Efectivo: ${esc(moneyES(v.efectivo||0))} · Tarjeta: ${esc(moneyES(v.tarjeta||0))}
            · Total: ${esc(moneyES(total))} · Gastos: ${esc(moneyES(v.gastos||0))}
            ${v.notas ? ` · ${esc(v.notas)}` : ''}
          </div>
        </div>
      `);
    }
    box.innerHTML = out.length ? out.join('') : `<div class="item"><div class="itemTitle">Sin ventas</div><div class="itemSub">Añade una venta.</div></div>`;

    renderVentasReport();
  }

  function renderVentasReport(){
    if(!isUnlocked('ventas')) return;

    const rep = $('#ventasReport');
    if(!rep) return;

    const qTienda = normalizeTienda(getVal('#vTienda'));
    const desde = getVal('#vDesde');
    const hasta = getVal('#vHasta');

    const rows = [];
    for(const v of ensureArray(S.ventas)){
      if(qTienda && normalizeTienda(v.tienda) !== qTienda) continue;
      if(desde && String(v.fecha||'') < desde) continue;
      if(hasta && String(v.fecha||'') > hasta) continue;
      rows.push(v);
    }

    let ef = 0, ta = 0, ga = 0;
    for(const v of rows){
      ef += parseNum(v.efectivo);
      ta += parseNum(v.tarjeta);
      ga += parseNum(v.gastos);
    }
    ef = round2(ef); ta = round2(ta); ga = round2(ga);
    const total = round2(ef + ta);
    const neto = round2(total - ga);

    rep.textContent =
      `REPORTE (${tiendaLabel(qTienda)})\n` +
      `Rango: ${desde ? fmtESDate(desde) : '—'} → ${hasta ? fmtESDate(hasta) : '—'}\n` +
      `Ventas efectivo: ${moneyES(ef)}\n` +
      `Ventas tarjeta: ${moneyES(ta)}\n` +
      `Ventas total: ${moneyES(total)}\n` +
      `Gastos: ${moneyES(ga)}\n` +
      `Neto (ventas - gastos): ${moneyES(neto)}\n` +
      `Entradas: ${rows.length}`;
  }

  function addVentaFromUI(){
    if(!requireUnlockOrOpenPin('ventas','PIN: ventas')) return;

    const fecha = getVal('#vFecha') || isoDate(new Date());
    const tienda = normalizeTienda(getVal('#vTienda') || 'san_pablo');

    const d = new Date(fecha);
    const venta = {
      id: FM.uid(),
      tienda,
      fecha,
      diaSemana: dayNameES(d),
      efectivo: round2(parseNum(getVal('#vEfectivo'))),
      tarjeta: round2(parseNum(getVal('#vTarjeta'))),
      gastos: round2(parseNum(getVal('#vGastos'))),
      notas: getVal('#vNotas').trim()
    };

    S.ventas.unshift(venta);
    save(K.VENTAS, S.ventas);

    // limpiar inputs
    setVal('#vEfectivo','');
    setVal('#vTarjeta','');
    setVal('#vGastos','');
    setVal('#vNotas','');

    renderVentasList();
    toast('Venta guardada');
  }

  function deleteVentaById(id){
    if(!requireUnlockOrOpenPin('ventas','PIN: ventas')) return;
    const v = S.ventas.find(x => x.id === id);
    const ok = confirm(`¿Eliminar venta ${v ? fmtESDate(v.fecha) : ''}?`);
    if(!ok) return;
    S.ventas = S.ventas.filter(x => x.id !== id);
    save(K.VENTAS, S.ventas);
    renderVentasList();
    toast('Venta eliminada');
  }

  function bindVentasUI(){
    on($('#btnVentasUnlock'), 'click', () => requireUnlockOrOpenPin('ventas','PIN: ventas'));
    on($('#btnVentasLock'), 'click', () => { setUnlocked('ventas', false); toast('Ventas bloqueadas'); renderVentasList(); });

    on($('#btnAddVenta'),'click', addVentaFromUI);
    on($('#vDesde'),'change', renderVentasList);
    on($('#vHasta'),'change', renderVentasList);
    on($('#vTienda'),'change', renderVentasList);

    on($('#listaVentas'),'click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('.btnDelVenta');
      if(!btn) return;
      const item = ev.target.closest('.item');
      if(!item) return;
      const id = item.getAttribute('data-venta-id');
      if(id) deleteVentaById(id);
    });

    // defaults rango: mes actual
    if($('#vDesde') && !$('#vDesde').value) $('#vDesde').value = firstDayOfMonthISO(isoDate(new Date()));
    if($('#vHasta') && !$('#vHasta').value) $('#vHasta').value = isoDate(new Date());
  }

  /* =========================================================
     PIN MODAL HANDLER
  ========================================================== */
  function bindPinModal(){
    on($('#btnPinOk'),'click', () => {
      const target = getVal('#pinTarget') || 'contabilidad';
      const pin = String(getVal('#pinInput') || '').trim();
      const ok = (pin === String(S.ajustes.pin || '8410'));

      if(!ok){
        toast('PIN incorrecto');
        return;
      }

      // desbloquear
      if(target === 'contabilidad') setUnlocked('contabilidad', true);
      if(target === 'ventas') setUnlocked('ventas', true);
      if(target === 'both'){
        setUnlocked('contabilidad', true);
        setUnlocked('ventas', true);
      }

      FM.modal && FM.modal.closeModal('#pinModal');
      toast('Acceso concedido');

      // refrescar páginas
      renderLockIndicators();
      renderContabilidad();
      renderVentasList();
    });

    on($('#pinInput'),'keydown', (ev) => {
      if(ev.key === 'Enter'){
        ev.preventDefault();
        $('#btnPinOk') && $('#btnPinOk').click();
      }
      if(ev.key === 'Escape'){
        ev.preventDefault();
        FM.modal && FM.modal.closeModal('#pinModal');
      }
    });

    on($('#btnPinBoth'),'click', () => {
      if($('#pinTarget')) $('#pinTarget').value = 'both';
      $('#btnPinOk') && $('#btnPinOk').click();
    });

    on($('#btnPinCancel'),'click', () => FM.modal && FM.modal.closeModal('#pinModal'));
  }

  /* =========================================================
     CLOUD (Firebase) — OPCIONAL (sin crash si no hay)
  ========================================================== */
  const Cloud = {
    enabled:false,
    ready:false,
    user:null,
    cfg:null
  };
  FM.cloud = FM.cloud || {};
  FM.cloud.state = Cloud;

  function firebaseAvailable(){
    // admite firebase v8 compat o v9 modular (si lo incluyes)
    return !!(window.firebase && window.firebase.initializeApp);
  }

  function initCloudIfConfigured(){
    const cfg = load(K.CLOUDCFG, null);
    Cloud.cfg = cfg || null;
    Cloud.enabled = !!cfg;

    if(!Cloud.enabled){
      Cloud.ready = false;
      Cloud.user = null;
      return;
    }
    if(!firebaseAvailable()){
      Cloud.ready = false;
      Cloud.user = null;
      return;
    }

    try{
      // Evitar doble init
      if(window.firebase.apps && window.firebase.apps.length === 0){
        window.firebase.initializeApp(cfg);
      }else if(window.firebase.apps && window.firebase.apps.length > 0){
        // already
      }else{
        window.firebase.initializeApp(cfg);
      }
      Cloud.ready = true;
      toast('Cloud preparada (Firebase)');
    }catch(e){
      Cloud.ready = false;
      toast('Cloud error: config Firebase');
    }
  }

  async function cloudLogin(email, pass){
    if(!Cloud.enabled || !Cloud.ready || !window.firebase || !window.firebase.auth){
      toast('Cloud no disponible');
      return;
    }
    try{
      const res = await window.firebase.auth().signInWithEmailAndPassword(email, pass);
      Cloud.user = res.user || null;
      toast('Cloud: sesión iniciada');
    }catch(e){
      toast('Cloud: login error');
    }
  }

  async function cloudLogout(){
    if(!Cloud.ready || !window.firebase || !window.firebase.auth) return;
    try{
      await window.firebase.auth().signOut();
      Cloud.user = null;
      toast('Cloud: sesión cerrada');
    }catch(e){
      toast('Cloud: logout error');
    }
  }

  // Sync simple RTDB (si existe) — opcional, sin crash
  async function cloudSyncAll(){
    if(!Cloud.enabled || !Cloud.ready || !window.firebase || !window.firebase.database){
      toast('Cloud: no disponible');
      return;
    }
    if(!Cloud.user){
      toast('Cloud: inicia sesión');
      return;
    }
    try{
      const uid = Cloud.user.uid;
      const ref = window.firebase.database().ref(`factu_miral/${uid}`);

      const payload = {
        ajustes: S.ajustes,
        proveedor: S.proveedor,
        clientes: S.clientes,
        productos: S.productos,
        taras: S.taras,
        facturas: S.facturas,
        ventas: S.ventas,
        updatedAt: Date.now()
      };

      await ref.set(payload);
      toast('Cloud: sincronizado');
    }catch(e){
      toast('Cloud: error sync');
    }
  }

  async function cloudPullAll(){
    if(!Cloud.enabled || !Cloud.ready || !window.firebase || !window.firebase.database){
      toast('Cloud: no disponible');
      return;
    }
    if(!Cloud.user){
      toast('Cloud: inicia sesión');
      return;
    }
    try{
      const uid = Cloud.user.uid;
      const snap = await window.firebase.database().ref(`factu_miral/${uid}`).get();
      const data = snap.val();
      if(!data){
        toast('Cloud: sin datos');
        return;
      }

      // Cargar a memoria y local
      if(data.ajustes) { S.ajustes = data.ajustes; save(K.AJUSTES, S.ajustes); }
      if(data.proveedor) { S.proveedor = data.proveedor; save(K.PROVEEDOR, S.proveedor); }
      if(Array.isArray(data.clientes)) { S.clientes = data.clientes; save(K.CLIENTES, S.clientes); }
      if(Array.isArray(data.productos)) { S.productos = data.productos; save(K.PRODUCTOS, S.productos); }
      if(Array.isArray(data.taras)) { S.taras = data.taras; save(K.TARAS, S.taras); }
      if(Array.isArray(data.facturas)) { S.facturas = data.facturas; save(K.FACTURAS, S.facturas); }
      if(Array.isArray(data.ventas)) { S.ventas = data.ventas; save(K.VENTAS, S.ventas); }

      // refresh UI
      loadAjustesToUI();
      renderClientesList();
      renderProductosList();
      renderTarasList();
      renderFacturasList();
      renderVentasList();
      renderContabilidad();

      // factura actual
      const f = FM.facturas.getFacturaActual();
      if(FM.facturaUI && FM.facturaUI.loadFacturaToUI) FM.facturaUI.loadFacturaToUI(f);
      renderQrForFactura(f);

      toast('Cloud: datos cargados');
    }catch(e){
      toast('Cloud: pull error');
    }
  }

  // PDF upload placeholder (Storage) — opcional
  async function uploadPdfForFactura(f){
    toast('Cloud PDF: requiere Firebase Storage (implementar si lo añades en index).');
  }

  FM.cloud.login = cloudLogin;
  FM.cloud.logout = cloudLogout;
  FM.cloud.syncAll = cloudSyncAll;
  FM.cloud.pullAll = cloudPullAll;
  FM.cloud.uploadPdfForFactura = uploadPdfForFactura;

  /* =========================================================
     UI: Cloud controls (opcional)
  ========================================================== */
  function bindCloudUI(){
    on($('#btnCloudInit'),'click', () => { initCloudIfConfigured(); renderDiagAndCloudIndicator(); });
    on($('#btnCloudLogin'),'click', () => {
      const email = getVal('#cloudEmail').trim();
      const pass = getVal('#cloudPass').trim();
      if(!email || !pass){ toast('Cloud: email/pass'); return; }
      cloudLogin(email, pass);
    });
    on($('#btnCloudLogout'),'click', cloudLogout);
    on($('#btnCloudSync'),'click', cloudSyncAll);
    on($('#btnCloudPull'),'click', cloudPullAll);
  }

  function renderDiagAndCloudIndicator(){
    // top pill cloud
    const dot = $('#dotCloud');
    const txt = $('#pillCloudTxt');
    if(dot){
      dot.className = 'dot ' + (Cloud.enabled ? (Cloud.ready ? 'ok' : 'warn') : 'off');
    }
    if(txt){
      txt.textContent = Cloud.enabled ? (Cloud.ready ? 'Cloud lista' : 'Cloud cfg') : 'Cloud off';
    }
    FM.renderDiag && FM.renderDiag();
  }

  /* =========================================================
     FACTURA: QR hooks
  ========================================================== */
  function bindQrLive(){
    // Cada cambio relevante, refrescamos QR (sin bloquear)
    const ids = ['#inpNumeroFactura','#inpFechaFactura','#chkTransporte','#chkIvaIncluido'];
    for(const id of ids){
      on($(id), 'change', () => {
        const f = FM.facturas.getFacturaActual();
        if(FM.facturaUI) FM.facturaUI.recalcFactura(f, true);
        if(FM.facturaUI) FM.facturaUI.saveFacturaToState(f);
        renderQrForFactura(f);
      });
      on($(id), 'input', () => {
        const f = FM.facturas.getFacturaActual();
        if(FM.facturaUI) FM.facturaUI.recalcFactura(f, true);
        if(FM.facturaUI) FM.facturaUI.saveFacturaToState(f);
        renderQrForFactura(f);
      });
    }

    // Total cambia por grid (hook)
    FM.hooks.onFacturaChanged = FM.hooks.onFacturaChanged || [];
    FM.hooks.onFacturaChanged.push((f) => {
      // Actualiza QR si ya hay datos
      renderQrForFactura(f);
    });
  }

  /* =========================================================
     SHORTCUTS (Ctrl+S, Ctrl+P, Ctrl+F)
  ========================================================== */
  function bindShortcuts(){
    on(document, 'keydown', async (ev) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? ev.metaKey : ev.ctrlKey;

      // ESC: cerrar PDF modal
      if(ev.key === 'Escape'){
        // cerrar modales si están abiertos
        const pinM = $('#pinModal');
        const pdfM = $('#pdfModal');
        if(pinM && pinM.getAttribute('aria-hidden') === 'false') FM.modal && FM.modal.closeModal('#pinModal');
        if(pdfM && pdfM.getAttribute('aria-hidden') === 'false') closePdfViewer();
        return;
      }

      if(!mod) return;

      // Ctrl+S -> guardar factura
      if(ev.key.toLowerCase() === 's'){
        ev.preventDefault();
        const tab = $('.tab.isActive');
        const tabId = tab ? tab.dataset.tab : '';
        if(tabId === 'tabFactura'){
          $('#btnGuardarFactura') && $('#btnGuardarFactura').click();
        }else{
          toast('Ctrl+S: ve a Factura');
        }
        return;
      }

      // Ctrl+P -> PDF
      if(ev.key.toLowerCase() === 'p'){
        ev.preventDefault();
        const tab = $('.tab.isActive');
        const tabId = tab ? tab.dataset.tab : '';
        if(tabId === 'tabFactura'){
          const f = FM.facturas.getFacturaActual();
          if(FM.facturaUI){
            // asegurar meta/cliente del UI
            // (usa botones existentes)
            if($('#btnVerPDF')) $('#btnVerPDF').click();
            else if(FM.pdf) await FM.pdf.generate(f, { openViewer:true });
          }
        }else{
          toast('Ctrl+P: ve a Factura');
        }
        return;
      }

      // Ctrl+F -> buscar (según tab)
      if(ev.key.toLowerCase() === 'f'){
        ev.preventDefault();
        const tab = $('.tab.isActive');
        const tabId = tab ? tab.dataset.tab : '';
        if(tabId === 'tabFacturas' && $('#buscarFacturas')) $('#buscarFacturas').focus();
        else if(tabId === 'tabClientes' && $('#buscarClientes')) $('#buscarClientes').focus();
        else if(tabId === 'tabProductos' && $('#buscarProductos')) $('#buscarProductos').focus();
        else if(tabId === 'tabTaras' && $('#buscarTaras')) $('#buscarTaras').focus();
        else if(tabId === 'tabContabilidad' && $('#cCliente')) $('#cCliente').focus();
        else if(tabId === 'tabVentas' && $('#vNotas')) $('#vNotas').focus();
        else toast('Buscar: abre una pestaña con buscador');
        return;
      }
    });
  }

  /* =========================================================
     PAGE LOAD / INIT FINAL
  ========================================================== */
  function ensureDateDefaults(){
    // Facturas list filter defaults
    if($('#fDesde') && !$('#fDesde').value) $('#fDesde').value = '';
    if($('#fHasta') && !$('#fHasta').value) $('#fHasta').value = '';
    // Contabilidad defaults (mes actual)
    const now = isoDate(new Date());
    if($('#cDesde') && !$('#cDesde').value) $('#cDesde').value = firstDayOfMonthISO(now);
    if($('#cHasta') && !$('#cHasta').value) $('#cHasta').value = now;

    // Ventas defaults ya en bindVentasUI
  }

  function bindPdfModal(){
    on($('#btnPdfClose'),'click', closePdfViewer);
    on($('#btnPdfPrint'),'click', () => {
      const frame = $('#pdfFrame');
      if(frame && frame.contentWindow){
        try{ frame.contentWindow.print(); }catch(e){ toast('No se pudo imprimir'); }
      }else{
        toast('Imprimir: no disponible');
      }
    });
    on($('#btnPdfOpenTab'),'click', () => {
      const frame = $('#pdfFrame');
      const url = frame ? frame.src : '';
      if(url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  function initFinal(){
    // 1) Base seed + basic bindings de tabs (3A)
    FM.initBase && FM.initBase();

    // 2) Asegurar estados (por si local tenía algo raro)
    S.facturas = ensureArray(load(K.FACTURAS, S.facturas));
    S.clientes = ensureArray(load(K.CLIENTES, S.clientes));
    S.productos = ensureArray(load(K.PRODUCTOS, S.productos));
    S.taras = ensureArray(load(K.TARAS, S.taras));
    S.ventas = ensureArray(load(K.VENTAS, S.ventas));
    S.ajustes = load(K.AJUSTES, S.ajustes) || S.ajustes;
    S.proveedor = load(K.PROVEEDOR, S.proveedor) || S.proveedor;
    S.session = load(K.SESSION, S.session) || S.session;

    // 3) Cloud init safe (no crash)
    initCloudIfConfigured();

    // 4) Load ajustes UI
    loadAjustesToUI();
    ensureDateDefaults();

    // 5) Render lists
    renderFacturasList();
    renderClientesList();
    renderProductosList();
    renderTarasList();
    renderLockIndicators();
    renderDiagAndCloudIndicator();

    // 6) Bind modules
    bindPinModal();
    bindPdfModal();

    bindFacturasListUI();
    bindClientesUI();
    bindProductosUI();
    bindTarasUI();
    bindAjustesUI();
    bindContabilidadUI();
    bindVentasUI();
    bindCloudUI();

    bindQrLive();
    bindShortcuts();

    // 7) After init hooks (3B binds factura UI)
    FM.runHooks && FM.runHooks('afterInit');

    // 8) QR inicial en factura actual
    const f = FM.facturas.getFacturaActual();
    if(FM.facturaUI && FM.facturaUI.recalcFactura) FM.facturaUI.recalcFactura(f, true);
    if(FM.facturaUI && FM.facturaUI.saveFacturaToState) FM.facturaUI.saveFacturaToState(f);
    renderQrForFactura(f);

    // 9) Contabilidad/Ventas render si están unlocked
    renderContabilidad();
    renderVentasList();

    // 10) Default tab
    FM.showTab && FM.showTab('tabFactura');

    toast('FACTU MIRAL listo');
  }

  /* =========================================================
     Bind: Lock button picks target + open pin modal
  ========================================================== */
  function bindLockPanelBtn(){
    on($('#btnLockPanel'), 'click', () => {
      // Si ambos bloqueados -> default both
      const bothLocked = (!isUnlocked('contabilidad') && !isUnlocked('ventas'));
      if($('#pinTarget')) $('#pinTarget').value = bothLocked ? 'both' : (!isUnlocked('contabilidad') ? 'contabilidad' : (!isUnlocked('ventas') ? 'ventas' : 'both'));
      FM.modal && FM.modal.openModal('#pinModal');
      if($('#pinInput')) { $('#pinInput').value=''; $('#pinInput').focus(); }
    });
  }

  bindLockPanelBtn();

  // Run
  on(window, 'DOMContentLoaded', initFinal);

})();
