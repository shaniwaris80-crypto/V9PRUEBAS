/* =========================================================
PARTE 3A/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3A: Base app + storage + datos iniciales + UI tabs + GRID PRO + Autocomplete MANUAL + cálculos core
========================================================= */

(() => {
  'use strict';

  /* =========================================================
    0) HELPERS (DOM / FORMAT / STORAGE)
  ========================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const pad2 = (n) => String(n).padStart(2, '0');

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  const uid = () => 'id_' + Math.random().toString(16).slice(2) + Date.now().toString(16);

  const clamp0 = (n) => (isFinite(n) && n > 0) ? n : 0;

  const num = (v) => {
    if (v === '' || v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).trim().replace(',', '.');
    const x = parseFloat(s);
    return isFinite(x) ? x : 0;
  };

  const fmt2 = (n) => {
    const x = (isFinite(n) ? n : 0);
    return x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const money = (n) => `${fmt2(n)} €`;

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };

  const ddmmyyyy = (iso) => {
    if (!iso) return '';
    const [y,m,d] = String(iso).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  // FA-YYYYMMDDHHMM
  const autoInvoiceNumber = (d = new Date()) => {
    const y = d.getFullYear();
    const mo = pad2(d.getMonth()+1);
    const da = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `FA-${y}${mo}${da}${hh}${mi}`;
  };

  const toast = (msg, ms = 1600) => {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove('show'), ms);
  };

  const load = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return (v ?? fallback);
    } catch {
      return fallback;
    }
  };

  const save = (k, v) => {
    localStorage.setItem(k, JSON.stringify(v));
  };

  /* =========================================================
    1) STORAGE KEYS
  ========================================================== */
  const K = {
    proveedor:  'factumiral_proveedor_v1',
    clientes:   'factumiral_clientes_v1',
    productos:  'factumiral_productos_v1',
    taras:      'factumiral_taras_v1',
    facturas:   'factumiral_facturas_v1',
    ajustes:    'factumiral_ajustes_v1',
    ventas:     'factumiral_ventas_v1',
    locks:      'factumiral_locks_v1',
    cloud:      'factumiral_cloud_v1',
  };

  /* =========================================================
    2) DEFAULTS (PROVEEDOR / CLIENTES / PRODUCTOS / AJUSTES)
  ========================================================== */

  // ---------- PROVIDER DEFAULTS (tus datos) ----------
  function setProviderDefaultsIfEmpty(){
    if(!$('#provNombre').value) $('#provNombre').value = 'Mohammad Arslan Waris';
    if(!$('#provNif').value)    $('#provNif').value    = 'X6389988J';
    if(!$('#provDir').value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
    if(!$('#provTel').value)    $('#provTel').value    = '631 667 893';
    if(!$('#provEmail').value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
  }

  const DEFAULT_AJUSTES = {
    ivaPct: 4,
    transportePct: 10,
    pin: '8410',
    qrPlantilla: 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}',
    // Cloud placeholders
    firebaseCfg: null,
  };

  // ✅ Productos a precargar SIEMPRE (tu lista)
  const PRELOAD_PRODUCTOS = [
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

  // ✅ Clientes a precargar SIEMPRE (tu lista)
  const PRELOAD_CLIENTES = [
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo'},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', email:'info@restaurantelosbraseros.com'},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', email:'info@hotelcordon.com'}
  ];

  // Taras iniciales (vacío, pero puedes añadir aquí si quieres)
  const PRELOAD_TARAS = [
    // {id:uid(), nombre:'Caja plástico ESMO', peso:0.30, notas:''}
  ];

  /* =========================================================
    3) STATE
  ========================================================== */
  const S = {
    proveedor: null,
    ajustes: null,
    clientes: [],
    productos: [],
    taras: [],
    facturas: [],
    ventas: [],
    locks: { contabilidad:false, ventas:false },

    // Factura actual (editable)
    currentFacturaId: null,
    factura: null, // objeto factura en edición
    // cache UI
    acOpenForLineId: null, // para autocomplete
    qrOk: false,
    qrLastText: '',
    pdfBlobUrl: null,
  };

  /* =========================================================
    4) DATA MODELS
  ========================================================== */
  const newProducto = (nombre='') => ({
    id: uid(),
    nombre: (nombre||'').toString().trim(),
    modo: 'kg',         // kg | caja | ud
    kgCaja: 0,
    precioKg: 0,
    precioCaja: 0,
    precioUd: 0,
    coste: 0,
    origen: '',
    taraDefaultId: '',  // ✅ envase/tara por defecto
    hist: [],           // solo pantalla
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const newTara = () => ({
    id: uid(),
    nombre: '',
    peso: 0,
    notas: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const newCliente = () => ({
    id: uid(),
    nombre: '',
    alias: '',
    nif: '',
    dir: '',
    tel: '',
    email: '',
    notas: '',
    tpl: {
      ivaIncluido: false,
      transporte: false,
      pago: '',
      tagsAuto: '',
      notasStd: '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const newLine = () => ({
    id: uid(),
    producto: '',        // texto libre (manual)
    productoId: '',      // id si coincide
    modo: 'kg',          // kg/caja/ud
    cantidad: 0,         // ✅ en kg: nº de cajas/envases. en ud: unidades. en caja: cajas.
    bruto: 0,            // kg
    taraId: '',          // selector envase/tara (opcional)
    taraUnit: 0,         // kg por unidad (derivado de tara o manual)
    neto: 0,             // kg
    netoManual: false,   // si el usuario edita neto, no recalcular
    precio: 0,           // €/kg o €/caja o €/ud según modo
    origen: '',
    importe: 0,
    warn: '',            // aviso
    lastHints: [],       // historial (pantalla)
  });

  const newFactura = () => ({
    id: uid(),
    numero: autoInvoiceNumber(new Date()),
    fecha: todayISO(),
    tags: '',
    notas: '',
    observaciones: '',
    clienteId: '',
    clienteSnapshot: null, // nombre/nif/dir/tel/email congelados al guardar
    provSnapshot: null,
    lines: Array.from({length:5}, () => newLine()), // ✅ 5 líneas por defecto
    transporteOn: false,
    ivaIncluido: false,
    ivaPct: 4,
    transportePct: 10,
    subtotal: 0,
    transporte: 0,
    iva: 0,
    total: 0,
    pagos: [], // {id, importe, fecha}
    metodoPago: 'efectivo',
    estado: 'impagada',
    pagado: 0,
    pendiente: 0,
    qrText: '',
    pdfUrl: '', // cloud url si existe
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  /* =========================================================
    5) LOAD / INIT
  ========================================================== */
  function loadAll(){
    S.ajustes = load(K.ajustes, null) || {...DEFAULT_AJUSTES};
    S.locks = load(K.locks, { contabilidad:false, ventas:false });

    S.proveedor = load(K.proveedor, null) || {
      nombre: 'Mohammad Arslan Waris',
      nif: 'X6389988J',
      dir: 'Calle San Pablo 17, 09003 Burgos',
      tel: '631 667 893',
      email: 'shaniwaris80@gmail.com',
      updatedAt: Date.now(),
    };

    // Clientes
    const savedClientes = load(K.clientes, null);
    if (Array.isArray(savedClientes) && savedClientes.length){
      S.clientes = savedClientes;
    } else {
      S.clientes = PRELOAD_CLIENTES.map(c => ({
        ...newCliente(),
        id: c.id,
        nombre: c.nombre || '',
        nif: c.nif || '',
        dir: c.dir || '',
        tel: c.tel || '',
        email: c.email || '',
        updatedAt: Date.now(),
      }));
      save(K.clientes, S.clientes);
    }

    // Productos
    const savedProductos = load(K.productos, null);
    if (Array.isArray(savedProductos) && savedProductos.length){
      S.productos = savedProductos;
    } else {
      S.productos = PRELOAD_PRODUCTOS.map(n => {
        const p = newProducto(n);
        p.modo = 'kg';
        return p;
      });
      save(K.productos, S.productos);
    }

    // Taras
    const savedTaras = load(K.taras, null);
    if (Array.isArray(savedTaras) && savedTaras.length){
      S.taras = savedTaras;
    } else {
      S.taras = PRELOAD_TARAS.map(t => ({...newTara(), ...t}));
      save(K.taras, S.taras);
    }

    // Facturas
    const savedFacturas = load(K.facturas, []);
    S.facturas = Array.isArray(savedFacturas) ? savedFacturas : [];

    // Ventas
    const savedVentas = load(K.ventas, []);
    S.ventas = Array.isArray(savedVentas) ? savedVentas : [];
  }

  function persistAll(){
    save(K.ajustes, S.ajustes);
    save(K.locks, S.locks);
    save(K.proveedor, S.proveedor);
    save(K.clientes, S.clientes);
    save(K.productos, S.productos);
    save(K.taras, S.taras);
    save(K.facturas, S.facturas);
    save(K.ventas, S.ventas);
  }

  /* =========================================================
    6) TABS
  ========================================================== */
  function setTab(tabId){
    $$('.tab').forEach(b => b.classList.toggle('isActive', b.dataset.tab === tabId));
    $$('.page').forEach(p => p.classList.toggle('isActive', p.id === tabId));

    // overlays locks
    syncLocksUI();
  }

  function bindTabs(){
    $$('.tab').forEach(btn => {
      on(btn, 'click', () => setTab(btn.dataset.tab));
    });
  }

  /* =========================================================
    7) LOCKS (PIN)
  ========================================================== */
  function syncLocksUI(){
    const pinModal = $('#pinModal');

    // Contabilidad overlay
    const contOverlay = $('#lockedOverlayCont');
    const ventasOverlay = $('#lockedOverlayVentas');

    const contLocked = !!S.locks.contabilidad;
    const ventasLocked = !!S.locks.ventas;

    if (contOverlay){
      contOverlay.classList.toggle('isOn', contLocked);
      // si tab contabilidad y locked => overlay visible
      const isContTab = $('#tabContabilidad')?.classList.contains('isActive');
      contOverlay.style.display = (isContTab && contLocked) ? '' : (isContTab ? '' : 'none');
      contOverlay.classList.toggle('isOn', isContTab && contLocked);
      if (!isContTab) contOverlay.style.display = 'none';
      if (isContTab && contLocked) contOverlay.style.display = '';
    }
    if (ventasOverlay){
      const isVentasTab = $('#tabVentas')?.classList.contains('isActive');
      ventasOverlay.classList.toggle('isOn', isVentasTab && ventasLocked);
      if (!isVentasTab) ventasOverlay.style.display = 'none';
      if (isVentasTab && ventasLocked) ventasOverlay.style.display = '';
    }

    // cloud pill
    const dot = $('#dotCloud');
    const txt = $('#pillCloudTxt');
    const cloudOn = !!(S.ajustes?.firebaseCfg);
    if (dot) dot.classList.toggle('on', cloudOn), dot.classList.toggle('off', !cloudOn);
    if (txt) txt.textContent = cloudOn ? 'Cloud ready' : 'Cloud off';

    // pin modal hidden by default
    if (pinModal && !pinModal.classList.contains('isOpen')) pinModal.setAttribute('aria-hidden','true');
  }

  function openPinModal(target='contabilidad'){
    const m = $('#pinModal');
    if (!m) return;
    $('#pinTarget').value = target;
    $('#pinInput').value = '';
    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
    setTimeout(() => $('#pinInput')?.focus(), 50);
  }

  function closePinModal(){
    const m = $('#pinModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function checkPin(pin){
    return String(pin || '') === String(S.ajustes?.pin || '8410');
  }

  function unlockTarget(target){
    if (target === 'contabilidad') S.locks.contabilidad = false;
    if (target === 'ventas') S.locks.ventas = false;
    if (target === 'both') { S.locks.contabilidad = false; S.locks.ventas = false; }
    save(K.locks, S.locks);
    syncLocksUI();
    toast('Desbloqueado');
  }

  function lockTarget(target){
    if (target === 'contabilidad') S.locks.contabilidad = true;
    if (target === 'ventas') S.locks.ventas = true;
    if (target === 'both') { S.locks.contabilidad = true; S.locks.ventas = true; }
    save(K.locks, S.locks);
    syncLocksUI();
    toast('Bloqueado');
  }

  function bindLocks(){
    on($('#btnLockPanel'), 'click', () => openPinModal('both'));
    on($('#btnContUnlock'), 'click', () => openPinModal('contabilidad'));
    on($('#btnVentasUnlock'), 'click', () => openPinModal('ventas'));
    on($('#btnContLock'), 'click', () => lockTarget('contabilidad'));
    on($('#btnVentasLock'), 'click', () => lockTarget('ventas'));

    // modal close
    on($('#btnPinCancel'), 'click', closePinModal);
    on($('.modalBackdrop', $('#pinModal')), 'click', (e) => {
      if (e.target?.dataset?.close) closePinModal();
    });

    on($('#btnPinOk'), 'click', () => {
      const pin = $('#pinInput').value;
      const target = $('#pinTarget').value;
      if (!checkPin(pin)) return toast('PIN incorrecto');
      unlockTarget(target);
      closePinModal();
    });

    on($('#btnPinBoth'), 'click', () => {
      const pin = $('#pinInput').value;
      if (!checkPin(pin)) return toast('PIN incorrecto');
      unlockTarget('both');
      closePinModal();
    });

    on($('#pinInput'), 'keydown', (e) => {
      if (e.key === 'Enter') $('#btnPinOk')?.click();
      if (e.key === 'Escape') closePinModal();
    });
  }

  /* =========================================================
    8) INVOICE: UI BIND (CABECERA)
  ========================================================== */
  function applyProveedorToUI(){
    $('#provNombre').value = S.proveedor?.nombre || '';
    $('#provNif').value = S.proveedor?.nif || '';
    $('#provDir').value = S.proveedor?.dir || '';
    $('#provTel').value = S.proveedor?.tel || '';
    $('#provEmail').value = S.proveedor?.email || '';
    setProviderDefaultsIfEmpty();
  }

  function readProveedorFromUI(){
    S.proveedor = {
      nombre: $('#provNombre').value.trim(),
      nif: $('#provNif').value.trim(),
      dir: $('#provDir').value.trim(),
      tel: $('#provTel').value.trim(),
      email: $('#provEmail').value.trim(),
      updatedAt: Date.now(),
    };
    save(K.proveedor, S.proveedor);
  }

  function bindProveedorUI(){
    on($('#btnGuardarProveedor'), 'click', () => {
      readProveedorFromUI();
      toast('Proveedor guardado');
      rebuildQR();
    });
  }

  function fillClienteSelect(){
    const sel = $('#selCliente');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Seleccionar —';
    sel.appendChild(opt0);

    S.clientes
      .slice()
      .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''))
      .forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.nombre || '(sin nombre)';
        sel.appendChild(o);
      });

    if (current) sel.value = current;
  }

  function applyClienteToFacturaUI(clienteId){
    const c = S.clientes.find(x => x.id === clienteId);
    if (!c) return;

    $('#cliNombre').value = c.nombre || '';
    $('#cliNif').value = c.nif || '';
    $('#cliDir').value = c.dir || '';
    $('#cliTel').value = c.tel || '';
    $('#cliEmail').value = c.email || '';

    // aplicar plantilla del cliente a factura
    if (S.factura){
      const tpl = c.tpl || {};
      if (typeof tpl.ivaIncluido === 'boolean') S.factura.ivaIncluido = tpl.ivaIncluido;
      if (typeof tpl.transporte === 'boolean') S.factura.transporteOn = tpl.transporte;
      if (tpl.pago) S.factura.metodoPago = tpl.pago.toLowerCase().includes('tarj') ? 'tarjeta' :
                                           tpl.pago.toLowerCase().includes('transf') ? 'transferencia' : 'efectivo';
      if (tpl.tagsAuto && !S.factura.tags) S.factura.tags = tpl.tagsAuto;
      if (tpl.notasStd && !S.factura.notas) S.factura.notas = tpl.notasStd;
    }

    syncFacturaMetaToUI();
    recalcAll();
    rebuildQR();
  }

  function readClienteInlineFromUI(){
    // snapshot en factura (editable inline)
    return {
      nombre: $('#cliNombre').value.trim(),
      nif: $('#cliNif').value.trim(),
      dir: $('#cliDir').value.trim(),
      tel: $('#cliTel').value.trim(),
      email: $('#cliEmail').value.trim(),
    };
  }

  function bindClienteUI(){
    on($('#selCliente'), 'change', () => {
      const id = $('#selCliente').value;
      if (S.factura) S.factura.clienteId = id;
      applyClienteToFacturaUI(id);
    });

    on($('#btnNuevoClienteFactura'), 'click', () => {
      // limpia para crear nuevo
      $('#selCliente').value = '';
      $('#cliNombre').value = '';
      $('#cliNif').value = '';
      $('#cliDir').value = '';
      $('#cliTel').value = '';
      $('#cliEmail').value = '';
      if (S.factura) S.factura.clienteId = '';
      toast('Cliente nuevo (rellena y guarda)');
      rebuildQR();
    });

    on($('#btnGuardarClienteFactura'), 'click', () => {
      // guarda/actualiza en clientes
      const inline = readClienteInlineFromUI();
      if (!inline.nombre) return toast('Falta nombre cliente');

      let id = $('#selCliente').value;
      if (id){
        const c = S.clientes.find(x => x.id === id);
        if (c){
          c.nombre = inline.nombre;
          c.nif = inline.nif;
          c.dir = inline.dir;
          c.tel = inline.tel;
          c.email = inline.email;
          c.updatedAt = Date.now();
        }
      } else {
        const c = newCliente();
        c.nombre = inline.nombre;
        c.nif = inline.nif;
        c.dir = inline.dir;
        c.tel = inline.tel;
        c.email = inline.email;
        c.updatedAt = Date.now();
        S.clientes.push(c);
        id = c.id;
      }
      save(K.clientes, S.clientes);
      fillClienteSelect();
      $('#selCliente').value = id;
      if (S.factura) S.factura.clienteId = id;
      toast('Cliente guardado');
      rebuildQR();
    });
  }

  function syncFacturaMetaToUI(){
    if (!S.factura) return;
    $('#inpNumeroFactura').value = S.factura.numero || '';
    $('#inpFechaFactura').value = S.factura.fecha || todayISO();
    $('#inpTags').value = S.factura.tags || '';
    $('#inpNotas').value = S.factura.notas || '';
    $('#inpObservaciones').value = S.factura.observaciones || '';
    $('#chkTransporte').checked = !!S.factura.transporteOn;
    $('#chkIvaIncluido').checked = !!S.factura.ivaIncluido;
    $('#metodoPago').value = S.factura.metodoPago || 'efectivo';
    $('#estadoFactura').value = S.factura.estado || 'impagada';
  }

  function readFacturaMetaFromUI(){
    if (!S.factura) return;
    S.factura.numero = $('#inpNumeroFactura').value.trim() || autoInvoiceNumber(new Date());
    S.factura.fecha = $('#inpFechaFactura').value || todayISO();
    S.factura.tags = $('#inpTags').value.trim();
    S.factura.notas = $('#inpNotas').value.trim();
    S.factura.observaciones = $('#inpObservaciones').value.trim();
    S.factura.transporteOn = $('#chkTransporte').checked;
    S.factura.ivaIncluido = $('#chkIvaIncluido').checked;
    S.factura.metodoPago = $('#metodoPago').value;
    S.factura.estado = $('#estadoFactura').value;
    S.factura.updatedAt = Date.now();
  }

  function bindFacturaMetaUI(){
    const inputs = ['#inpNumeroFactura','#inpFechaFactura','#inpTags','#inpNotas','#inpObservaciones'];
    inputs.forEach(sel => on($(sel), 'input', () => { readFacturaMetaFromUI(); rebuildQR(); }));

    on($('#chkTransporte'), 'change', () => { readFacturaMetaFromUI(); recalcAll(); rebuildQR(); });
    on($('#chkIvaIncluido'), 'change', () => { readFacturaMetaFromUI(); recalcAll(); rebuildQR(); });

    on($('#metodoPago'), 'change', () => { readFacturaMetaFromUI(); });
    on($('#estadoFactura'), 'change', () => { readFacturaMetaFromUI(); });

    on($('#btnAddIva4'), 'click', () => {
      // Aplica IVA al total (cuando IVA incluido está OFF)
      if (!S.factura) return;
      if (S.factura.ivaIncluido) return toast('IVA incluido activo');
      const ivaPct = num(S.factura.ivaPct || S.ajustes.ivaPct || 4);
      S.factura.ivaPct = ivaPct;
      recalcAll();
      toast(`IVA ${ivaPct}% aplicado`);
    });
  }

  /* =========================================================
    9) GRID PRO — RENDER + AUTOCOMPLETE MANUAL
  ========================================================== */

  function getTaraById(id){
    return S.taras.find(t => t.id === id) || null;
  }

  function getProductoById(id){
    return S.productos.find(p => p.id === id) || null;
  }

  function findProductoByNameExact(name){
    const n = (name||'').trim().toUpperCase();
    return S.productos.find(p => (p.nombre||'').toUpperCase() === n) || null;
  }

  function updateProductosSelectTaraDefault(){
    // para editor productos
    const sel = $('#pTaraDefault');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">— Sin envase —</option>` + S.taras
      .slice().sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''))
      .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${fmt2(num(t.peso))} kg)</option>`)
      .join('');
    if (current) sel.value = current;
  }

  function buildTaraSelectHtml(currentId){
    const opts = [`<option value="">—</option>`].concat(
      S.taras
        .slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''))
        .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${fmt2(num(t.peso))})</option>`)
    ).join('');
    return `<select class="inp taraSel" data-k="taraId">${opts}</select>`;
  }

  function ensureFacturaLoaded(){
    // Si hay facturas, abre la última; si no, crea una nueva
    if (S.facturas.length){
      // usar última actualizada
      const last = S.facturas.slice().sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0))[0];
      S.factura = deepCloneFactura(last);
      S.currentFacturaId = S.factura.id;
    } else {
      S.factura = newFactura();
      S.currentFacturaId = S.factura.id;
    }

    // defaults IVA/Transporte desde ajustes
    S.factura.ivaPct = num(S.ajustes.ivaPct || 4);
    S.factura.transportePct = num(S.ajustes.transportePct || 10);

    // cargar cliente a UI
    fillClienteSelect();
    if (S.factura.clienteId) $('#selCliente').value = S.factura.clienteId;
  }

  function deepCloneFactura(f){
    // clon seguro (mantener estructura)
    const x = JSON.parse(JSON.stringify(f || {}));
    // asegurar líneas
    if (!Array.isArray(x.lines)) x.lines = [];
    // asegurar 5 por defecto mínimo
    while (x.lines.length < 5) x.lines.push(newLine());
    // normalizar campos
    x.lines = x.lines.map(l => ({
      ...newLine(),
      ...l,
      netoManual: !!l.netoManual,
      warn: l.warn || '',
      lastHints: Array.isArray(l.lastHints) ? l.lastHints : [],
    }));
    x.pagos = Array.isArray(x.pagos) ? x.pagos : [];
    x.ivaPct = num(x.ivaPct || DEFAULT_AJUSTES.ivaPct);
    x.transportePct = num(x.transportePct || DEFAULT_AJUSTES.transportePct);
    return x;
  }

  function renderGrid(){
    const wrap = $('#gridLines');
    if (!wrap || !S.factura) return;
    wrap.innerHTML = S.factura.lines.map((l, idx) => renderLineHtml(l, idx)).join('');
    bindGridEvents();
  }

  function renderLineHtml(l, idx){
    const modo = l.modo || 'kg';
    const cantidad = (l.cantidad ?? '');
    const bruto = (l.bruto ?? '');
    const taraUnit = (l.taraUnit ?? '');
    const neto = (l.neto ?? '');
    const precio = (l.precio ?? '');
    const origen = (l.origen ?? '');
    const importe = money(num(l.importe || 0));

    const hints = (l.lastHints && l.lastHints.length)
      ? `<div class="hint">${escapeHtml(l.lastHints.slice(0,3).join(' · '))}</div>`
      : '';

    // Campo producto con autocomplete manual
    const acId = `ac_${l.id}`;
    const inputId = `prod_${l.id}`;

    return `
      <div class="line" data-line="${escapeHtml(l.id)}" data-idx="${idx}">
        <!-- Producto -->
        <div class="cell">
          <div class="cellCol acBox" id="${escapeHtml(acId)}">
            <input class="inp prodInp" id="${escapeHtml(inputId)}" data-k="producto" type="text" autocomplete="off"
              placeholder="Producto (manual)" value="${escapeHtml(l.producto||'')}" />
            <div class="acList" style="display:none"></div>
            ${hints}
          </div>
        </div>

        <!-- Modo -->
        <div class="cell">
          <select class="inp" data-k="modo">
            <option value="kg" ${modo==='kg'?'selected':''}>kg</option>
            <option value="caja" ${modo==='caja'?'selected':''}>caja</option>
            <option value="ud" ${modo==='ud'?'selected':''}>ud</option>
          </select>
        </div>

        <!-- Cantidad -->
        <div class="cell">
          <input class="inp" data-k="cantidad" inputmode="decimal" type="number" step="0.01"
            value="${escapeHtml(cantidad)}" />
        </div>

        <!-- Bruto -->
        <div class="cell">
          <input class="inp" data-k="bruto" inputmode="decimal" type="number" step="0.01"
            value="${escapeHtml(bruto)}" />
        </div>

        <!-- Tara (kg/ud) + selector -->
        <div class="cell">
          <div class="cellCol">
            ${buildTaraSelectHtml(l.taraId || '')}
            <input class="inp" data-k="taraUnit" inputmode="decimal" type="number" step="0.01"
              placeholder="kg/ud" value="${escapeHtml(taraUnit)}" />
          </div>
        </div>

        <!-- Neto -->
        <div class="cell">
          <input class="inp" data-k="neto" inputmode="decimal" type="number" step="0.01"
            value="${escapeHtml(neto)}" />
        </div>

        <!-- Precio -->
        <div class="cell">
          <input class="inp" data-k="precio" inputmode="decimal" type="number" step="0.01"
            value="${escapeHtml(precio)}" />
        </div>

        <!-- Origen -->
        <div class="cell">
          <input class="inp" data-k="origen" type="text" value="${escapeHtml(origen)}" />
        </div>

        <!-- Importe -->
        <div class="cell">
          <div class="money" data-k="importe">${escapeHtml(importe)}</div>
        </div>

        <!-- Delete -->
        <div class="cell">
          <button class="btnX" type="button" data-act="del" title="Eliminar">×</button>
        </div>
      </div>
    `;
  }

  function bindGridEvents(){
    const wrap = $('#gridLines');
    if (!wrap) return;

    // change handlers (delegación)
    on(wrap, 'input', (e) => {
      const lineEl = e.target.closest('.line');
      if (!lineEl) return;
      const lineId = lineEl.dataset.line;
      const k = e.target.dataset.k;
      if (!k) return;

      const line = S.factura.lines.find(x => x.id === lineId);
      if (!line) return;

      if (k === 'producto'){
        line.producto = e.target.value; // manual
        // NO autocambiar texto
        // pero si coincide exacto, enlazar productoId (sin tocar texto)
        const p = findProductoByNameExact(line.producto);
        line.productoId = p ? p.id : '';
        // hints (últimos precios) si existe
        if (p && p.hist && p.hist.length){
          line.lastHints = p.hist.slice(-5).map(h => h);
        } else {
          line.lastHints = [];
        }
        // mostrar sugerencias manuales
        acUpdateForLine(lineId, e.target.value);
      }

      if (k === 'cantidad') line.cantidad = num(e.target.value);
      if (k === 'bruto') line.bruto = num(e.target.value);

      if (k === 'taraUnit') {
        line.taraUnit = num(e.target.value);
      }

      if (k === 'neto') {
        line.neto = num(e.target.value);
        line.netoManual = true; // ✅ si el usuario toca neto, respetar
      }

      if (k === 'precio') line.precio = num(e.target.value);
      if (k === 'origen') line.origen = e.target.value;

      recalcLine(line);
      recalcAll();
      rebuildQR();
      // refrescar solo importe en UI
      updateLineUI(lineId);
    });

    on(wrap, 'change', (e) => {
      const lineEl = e.target.closest('.line');
      if (!lineEl) return;
      const lineId = lineEl.dataset.line;
      const k = e.target.dataset.k;

      const line = S.factura.lines.find(x => x.id === lineId);
      if (!line) return;

      if (k === 'modo') {
        line.modo = e.target.value;
        // al cambiar modo, netoManual puede mantenerse, pero recalculamos
        recalcLine(line);
        recalcAll();
        rebuildQR();
        updateLineUI(lineId);
      }

      if (e.target.classList.contains('taraSel')) {
        // selector tara -> rellena taraUnit automático
        const taraId = e.target.value;
        line.taraId = taraId;
        const t = getTaraById(taraId);
        if (t){
          line.taraUnit = num(t.peso);
        }
        // en modo kg, tara depende de cantidad
        recalcLine(line);
        recalcAll();
        rebuildQR();
        updateLineUI(lineId);
      }
    });

    on(wrap, 'click', (e) => {
      const btn = e.target.closest('button[data-act="del"]');
      if (!btn) return;
      const lineEl = btn.closest('.line');
      const lineId = lineEl?.dataset?.line;
      if (!lineId) return;

      // eliminar línea
      S.factura.lines = S.factura.lines.filter(x => x.id !== lineId);
      // si se quedan menos de 5, rellenar (para mantener experiencia)
      while (S.factura.lines.length < 5) S.factura.lines.push(newLine());
      renderGrid();
      recalcAll();
      rebuildQR();
    });

    // Autocomplete: clicks en lista
    on(wrap, 'mousedown', (e) => {
      const item = e.target.closest('.acItem');
      if (!item) return;
      const lineEl = e.target.closest('.line');
      if (!lineEl) return;
      const lineId = lineEl.dataset.line;
      const value = item.dataset.value || '';
      acChoose(lineId, value);
      e.preventDefault();
    });

    // Autocomplete keyboard
    on(wrap, 'keydown', (e) => {
      const inp = e.target.closest('.prodInp');
      if (!inp) return;

      const lineEl = inp.closest('.line');
      const lineId = lineEl?.dataset?.line;
      if (!lineId) return;

      const key = e.key;

      if (key === 'ArrowDown' || key === 'ArrowUp'){
        e.preventDefault();
        acMove(lineId, key === 'ArrowDown' ? 1 : -1);
      }

      if (key === 'Enter'){
        // ✅ flujo pro: si autocomplete abierto y hay activo, elegir.
        const chosen = acChooseActive(lineId);
        if (chosen){
          e.preventDefault();
          // mover al siguiente campo: modo
          focusNextField(lineEl, 'modo');
          return;
        }
        // si no hay ac, Enter avanza
        e.preventDefault();
        focusNextEditable(lineEl, inp);
      }

      if (key === 'Escape'){
        acClose(lineId);
      }
    });

    // click fuera para cerrar autocomplete
    on(document, 'mousedown', (e) => {
      const inside = e.target.closest('.acBox');
      if (!inside && S.acOpenForLineId){
        acClose(S.acOpenForLineId);
      }
    }, { passive:true });
  }

  function focusNextField(lineEl, key){
    const order = ['producto','modo','cantidad','bruto','taraUnit','neto','precio','origen'];
    const idx = order.indexOf(key);
    const nextKey = order[Math.min(order.length-1, idx+1)];
    const next = lineEl.querySelector(`[data-k="${nextKey}"]`);
    next?.focus();
    next?.select?.();
  }

  function focusNextEditable(lineEl, current){
    // avanza al siguiente input/select en la fila; si está al final, crea nueva línea
    const focusables = $$('input,select,textarea,button', lineEl)
      .filter(el => !el.disabled && el.offsetParent !== null)
      .filter(el => !el.classList.contains('btnX'));
    const i = focusables.indexOf(current);
    if (i >= 0 && i < focusables.length - 1){
      const n = focusables[i+1];
      n?.focus();
      n?.select?.();
    } else {
      // final: crear línea nueva
      addLine();
      // focus en producto de la última
      const last = $('#gridLines')?.lastElementChild;
      const p = last?.querySelector('.prodInp');
      p?.focus();
    }
  }

  function addLine(){
    if (!S.factura) return;
    S.factura.lines.push(newLine());
    renderGrid();
  }

  function clearLines(){
    if (!S.factura) return;
    S.factura.lines = Array.from({length:5}, () => newLine());
    renderGrid();
    recalcAll();
    rebuildQR();
  }

  function bindGridButtons(){
    on($('#btnAddLine'), 'click', () => { addLine(); });
    on($('#btnClearLines'), 'click', () => { clearLines(); toast('Líneas reiniciadas'); });
  }

  /* =========================================================
    10) AUTOCOMPLETE MANUAL (NO cambia el texto solo)
  ========================================================== */
  function acGetBox(lineId){
    const lineEl = document.querySelector(`.line[data-line="${CSS.escape(lineId)}"]`);
    if (!lineEl) return null;
    const box = lineEl.querySelector('.acBox');
    const list = lineEl.querySelector('.acList');
    const inp = lineEl.querySelector('.prodInp');
    return { lineEl, box, list, inp };
  }

  function acUpdateForLine(lineId, query){
    const a = acGetBox(lineId);
    if (!a) return;
    const q = (query||'').trim().toUpperCase();
    if (!q){
      a.list.style.display = 'none';
      a.list.innerHTML = '';
      S.acOpenForLineId = null;
      return;
    }

    const results = S.productos
      .map(p => p.nombre || '')
      .filter(n => n.toUpperCase().includes(q))
      .slice(0, 10);

    if (!results.length){
      a.list.style.display = 'none';
      a.list.innerHTML = '';
      S.acOpenForLineId = null;
      return;
    }

    a.list.innerHTML = results.map((n, i) => (
      `<div class="acItem ${i===0?'isActive':''}" data-value="${escapeHtml(n)}">${escapeHtml(n)}</div>`
    )).join('');
    a.list.style.display = '';
    S.acOpenForLineId = lineId;
  }

  function acClose(lineId){
    const a = acGetBox(lineId);
    if (!a) return;
    a.list.style.display = 'none';
    a.list.innerHTML = '';
    if (S.acOpenForLineId === lineId) S.acOpenForLineId = null;
  }

  function acMove(lineId, dir){
    const a = acGetBox(lineId);
    if (!a) return;
    const items = $$('.acItem', a.list);
    if (!items.length) return;

    let idx = items.findIndex(x => x.classList.contains('isActive'));
    if (idx < 0) idx = 0;
    let next = idx + dir;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;

    items.forEach(x => x.classList.remove('isActive'));
    items[next].classList.add('isActive');
    items[next].scrollIntoView({ block:'nearest' });
  }

  function acChooseActive(lineId){
    const a = acGetBox(lineId);
    if (!a) return false;
    const active = $('.acItem.isActive', a.list);
    if (!active) return false;
    const value = active.dataset.value || '';
    acChoose(lineId, value);
    return true;
  }

  function acChoose(lineId, value){
    const a = acGetBox(lineId);
    if (!a) return;

    // ✅ importante: el texto SOLO cambia porque el usuario eligió
    a.inp.value = value;

    // set line
    const line = S.factura.lines.find(x => x.id === lineId);
    if (!line) return;

    line.producto = value;
    const p = findProductoByNameExact(value);
    line.productoId = p ? p.id : '';

    // ✅ aplicar defaults del producto (pero sin romper manualidad)
    if (p){
      // modo/ origen
      line.modo = p.modo || line.modo || 'kg';
      if (!line.origen) line.origen = p.origen || '';

      // ✅ tara por defecto: autoseleccionar envase/tara
      if (p.taraDefaultId){
        line.taraId = p.taraDefaultId;
        const t = getTaraById(p.taraDefaultId);
        if (t) line.taraUnit = num(t.peso);
      } else {
        // si no hay tara default y la línea no tiene tara, no tocar
      }

      // ✅ precios por modo
      if (line.modo === 'kg'){
        if (!line.precio) line.precio = num(p.precioKg);
      }
      if (line.modo === 'caja'){
        if (!line.precio) line.precio = num(p.precioCaja);
      }
      if (line.modo === 'ud'){
        if (!line.precio) line.precio = num(p.precioUd);
      }

      // hints (últimos precios)
      if (p.hist && p.hist.length){
        line.lastHints = p.hist.slice(-5).map(h => h);
      } else {
        line.lastHints = [];
      }
    }

    // neto manual: si viene de antes, respetar; si no, recalculamos neto auto
    recalcLine(line);
    recalcAll();
    rebuildQR();

    // cerrar dropdown + rerender fila para reflejar modo, tara, hints
    renderGrid();
    // focus siguiente campo (modo)
    const lineEl = document.querySelector(`.line[data-line="${CSS.escape(lineId)}"]`);
    lineEl?.querySelector(`[data-k="modo"]`)?.focus();
  }

  /* =========================================================
    11) CÁLCULOS CORE (CORRECTOS)
  ========================================================== */

  function recalcLine(line){
    line.warn = '';
    const modo = line.modo || 'kg';
    const cantidad = num(line.cantidad);
    const bruto = num(line.bruto);
    const taraUnit = num(line.taraUnit);
    const precio = num(line.precio);

    // taraTotal SOLO aplica a modo kg (por envase) -> taraUnit * cantidad
    const taraTotal = (modo === 'kg') ? (taraUnit * cantidad) : 0;

    if (modo === 'kg'){
      // neto auto si no manual
      if (!line.netoManual){
        line.neto = Math.max(0, bruto - taraTotal);
      }
      // validaciones
      if (taraTotal > bruto && bruto > 0){
        line.warn = 'tara>bruto';
      }
      if (line.neto > bruto && bruto > 0){
        line.warn = 'neto>bruto';
      }
      // importe
      line.importe = clamp0(num(line.neto) * precio);
    }

    if (modo === 'caja'){
      // neto informativo si existe kgCaja del producto (o si el usuario mete bruto)
      // Aquí bruto puede ser usado como informativo, pero el importe es cajas * precio
      line.importe = clamp0(cantidad * precio);
      // si hay producto con kgCaja, sugerir neto (sin marcar manual)
      const p = line.productoId ? getProductoById(line.productoId) : findProductoByNameExact(line.producto);
      const kgCaja = p ? num(p.kgCaja) : 0;
      if (!line.netoManual && kgCaja > 0){
        line.neto = clamp0(cantidad * kgCaja);
      }
    }

    if (modo === 'ud'){
      line.importe = clamp0(cantidad * precio);
      // neto sin sentido en ud, mantener si el usuario puso algo, si no, dejar 0
      if (!line.netoManual) line.neto = num(line.neto || 0);
    }

    // Anti-errores visuales: precio vacío
    if (!precio && (cantidad || bruto || line.producto)){
      // no bloquear, pero avisar por CSS luego
    }
  }

  function recalcAll(){
    if (!S.factura) return;

    // recalcular todas las líneas (manteniendo netoManual)
    S.factura.lines.forEach(recalcLine);

    const subtotal = S.factura.lines.reduce((acc,l) => acc + num(l.importe), 0);
    const transportePct = num(S.factura.transportePct || S.ajustes.transportePct || 10);
    const ivaPct = num(S.factura.ivaPct || S.ajustes.ivaPct || 4);

    const transporte = S.factura.transporteOn ? (subtotal * (transportePct/100)) : 0;
    const base = subtotal + transporte;

    let iva = 0;
    let total = 0;

    if (S.factura.ivaIncluido){
      // IVA incluido: no desglosar, total = base
      iva = 0;
      total = base;
    } else {
      iva = base * (ivaPct/100);
      total = base + iva;
    }

    S.factura.subtotal = subtotal;
    S.factura.transporte = transporte;
    S.factura.iva = iva;
    S.factura.total = total;

    // pagos
    const pagado = (S.factura.pagos || []).reduce((a,p)=> a + num(p.importe), 0);
    S.factura.pagado = pagado;
    S.factura.pendiente = Math.max(0, total - pagado);

    // pintar totales
    $('#tSubtotal').textContent = money(subtotal);
    $('#tTransporte').textContent = money(transporte);
    $('#tIva').textContent = S.factura.ivaIncluido ? '—' : money(iva);
    $('#tTotal').textContent = money(total);
    $('#tPagado').textContent = money(pagado);
    $('#tPendiente').textContent = money(S.factura.pendiente);

    // pintar warnings por línea
    paintLineWarnings();
  }

  function paintLineWarnings(){
    const wrap = $('#gridLines');
    if (!wrap) return;
    $$('.line', wrap).forEach(lineEl => {
      const id = lineEl.dataset.line;
      const l = S.factura.lines.find(x=>x.id===id);
      if (!l) return;
      lineEl.classList.toggle('lineWarn', !!l.warn);
    });
  }

  function updateLineUI(lineId){
    const lineEl = document.querySelector(`.line[data-line="${CSS.escape(lineId)}"]`);
    if (!lineEl) return;
    const l = S.factura.lines.find(x => x.id === lineId);
    if (!l) return;
    const moneyEl = lineEl.querySelector('[data-k="importe"]');
    if (moneyEl) moneyEl.textContent = money(num(l.importe));
    lineEl.classList.toggle('lineWarn', !!l.warn);
  }

  /* =========================================================
    12) QR (screen) — placeholder (PDF en 3B/3C)
  ========================================================== */
  function makeQrText(){
    const nif = ($('#provNif').value || '').trim();
    const numF = ($('#inpNumeroFactura').value || '').trim();
    const fecha = ($('#inpFechaFactura').value || '').trim();
    const total = fmt2(num(S.factura?.total || 0));

    const tpl = ($('#ajQrPlantilla')?.value || S.ajustes.qrPlantilla || DEFAULT_AJUSTES.qrPlantilla);

    return String(tpl)
      .replaceAll('{NIF}', nif)
      .replaceAll('{NUM}', numF)
      .replaceAll('{FECHA}', ddmmyyyy(fecha))
      .replaceAll('{TOTAL}', total);
  }

  // QR sencillo: lo dibujamos como "pseudo QR" si no metemos librería (no fallará jamás).
  // En 3B/3C si quieres QR real, lo mantenemos pero con fallback seguro.
  function drawPseudoQR(canvas, text){
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,w,h);

    // patrón determinístico por hash
    const hash = simpleHash(text);
    const cells = 29;
    const m = 2;
    const size = Math.floor((w - m*2) / cells);
    ctx.fillStyle = '#111';
    for (let y=0; y<cells; y++){
      for (let x=0; x<cells; x++){
        const v = ((hash + x*131 + y*977) ^ (x*y*17)) & 1;
        // dejar "quiet zones" en esquinas
        const inFinder = (x<7 && y<7) || (x>cells-8 && y<7) || (x<7 && y>cells-8);
        if (inFinder){
          // dibuja marcadores
          const fx = (x<7) ? 0 : (x>cells-8 ? 1 : 0);
          const fy = (y<7) ? 0 : (y>cells-8 ? 1 : 0);
          const ox = fx ? (cells-7) : 0;
          const oy = fy ? (cells-7) : 0;
          // marcador 7x7
          if (x>=ox && x<ox+7 && y>=oy && y<oy+7){
            const rx = x-ox, ry = y-oy;
            const border = (rx===0||ry===0||rx===6||ry===6);
            const inner = (rx>=2&&rx<=4&&ry>=2&&ry<=4);
            if (border || inner){
              ctx.fillRect(m + x*size, m + y*size, size, size);
            }
          }
          continue;
        }
        if (v) ctx.fillRect(m + x*size, m + y*size, size, size);
      }
    }
    // texto mini (debug) NO en PDF, solo pantalla si quieres
  }

  function simpleHash(s){
    let h = 0;
    for (let i=0; i<s.length; i++){
      h = ((h<<5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function rebuildQR(){
    if (!S.factura) return;

    const txt = makeQrText();
    $('#qrText').value = txt;
    $('#qrTextSmall').textContent = txt || '—';

    S.qrLastText = txt;

    const canvas = $('#qrCanvas');
    const fallback = $('#qrFallback');
    try{
      if (!canvas) throw new Error('no canvas');
      drawPseudoQR(canvas, txt || ' ');
      if (fallback) fallback.style.display = 'none';
      S.qrOk = true;
    } catch {
      if (fallback) fallback.style.display = '';
      S.qrOk = false;
    }
  }

  function bindQrUI(){
    on($('#btnCopyQrText'), 'click', async () => {
      const txt = $('#qrText').value || '';
      try{
        await navigator.clipboard.writeText(txt);
        toast('Texto QR copiado');
      } catch {
        toast('No se pudo copiar');
      }
    });
  }

  /* =========================================================
    13) QUICK TOP ACTIONS (hooks)
  ========================================================== */
  function bindTopActions(){
    on($('#btnQuickNew'), 'click', () => {
      // en 3B: nueva factura completa (guardar borrador, etc.)
      // aquí: crear y renderizar (sin persistencia todavía)
      S.factura = newFactura();
      S.currentFacturaId = S.factura.id;
      $('#selCliente').value = '';
      $('#cliNombre').value = '';
      $('#cliNif').value = '';
      $('#cliDir').value = '';
      $('#cliTel').value = '';
      $('#cliEmail').value = '';
      syncFacturaMetaToUI();
      renderGrid();
      recalcAll();
      rebuildQR();
      toast('Nueva factura');
    });

    on($('#btnQuickSave'), 'click', () => {
      // guardado real en 3B
      toast('Guardar: (se completa en 3B)');
    });

    on($('#btnQuickPdf'), 'click', () => {
      // pdf real en 3B/3C
      toast('PDF: (se completa en 3B/3C)');
    });
  }

  /* =========================================================
    14) BOOT UI
  ========================================================== */
  function bootFacturaUI(){
    applyProveedorToUI();
    fillClienteSelect();

    // Ajustes a UI
    $('#ajIva').value = String(num(S.ajustes.ivaPct || 4));
    $('#ajTransporte').value = String(num(S.ajustes.transportePct || 10));
    $('#ajPin').value = String(S.ajustes.pin || '8410');
    $('#ajQrPlantilla').value = String(S.ajustes.qrPlantilla || DEFAULT_AJUSTES.qrPlantilla);
    $('#fbCfg').value = S.ajustes.firebaseCfg ? JSON.stringify(S.ajustes.firebaseCfg, null, 2) : '';

    ensureFacturaLoaded();

    // cliente snapshot a UI si existe
    if (S.factura.clienteId){
      $('#selCliente').value = S.factura.clienteId;
      applyClienteToFacturaUI(S.factura.clienteId);
    }

    // meta
    syncFacturaMetaToUI();

    // líneas
    renderGrid();

    // pagos UI se completa en 3B
    recalcAll();
    rebuildQR();
  }

  /* =========================================================
    15) GLOBAL SHORTCUTS
  ========================================================== */
  function bindShortcuts(){
    on(document, 'keydown', (e) => {
      const key = e.key.toLowerCase();

      // Ctrl+S guardar
      if ((e.ctrlKey || e.metaKey) && key === 's'){
        e.preventDefault();
        $('#btnGuardarFactura')?.click();
      }

      // Ctrl+P PDF
      if ((e.ctrlKey || e.metaKey) && key === 'p'){
        e.preventDefault();
        $('#btnGenerarPDF')?.click();
      }

      // Ctrl+F buscar (si estamos en listados)
      if ((e.ctrlKey || e.metaKey) && key === 'f'){
        // dejar el comportamiento normal si foco está en input
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        // prioridad: buscador de tab activo
        if ($('#tabFacturas')?.classList.contains('isActive')) $('#buscarFacturas')?.focus();
        else if ($('#tabClientes')?.classList.contains('isActive')) $('#buscarClientes')?.focus();
        else if ($('#tabProductos')?.classList.contains('isActive')) $('#buscarProductos')?.focus();
        else if ($('#tabTaras')?.classList.contains('isActive')) $('#buscarTaras')?.focus();
        else $('#buscarFacturas')?.focus();
      }
    });
  }

  /* =========================================================
    16) BIND BASIC BUTTONS (Factura) — lógica completa en 3B
  ========================================================== */
  function bindFacturaButtonsScaffold(){
    on($('#btnNuevaFactura'), 'click', () => $('#btnQuickNew')?.click());

    on($('#btnDuplicarFactura'), 'click', () => {
      // en 3B: duplicar real con persistencia
      toast('Duplicar: (se completa en 3B)');
    });

    on($('#btnEliminarFactura'), 'click', () => {
      // en 3B: eliminar real
      toast('Eliminar: (se completa en 3B)');
    });

    on($('#btnGuardarFactura'), 'click', () => {
      // en 3B: guardar real (local + historial precios)
      toast('Guardar: (se completa en 3B)');
    });

    on($('#btnGenerarPDF'), 'click', () => {
      // en 3B/3C: generar pdf real
      toast('PDF: (se completa en 3B/3C)');
    });

    on($('#btnVerPDF'), 'click', () => {
      // visor en 3B/3C
      toast('Ver PDF: (se completa en 3B/3C)');
    });

    on($('#btnPdfCloud'), 'click', () => {
      toast('PDF + Nube: (se completa en 3C)');
    });

    on($('#btnWhatsApp'), 'click', () => {
      toast('WhatsApp: (se completa en 3B)');
    });
  }

  /* =========================================================
    17) START
  ========================================================== */
  function init(){
    loadAll();
    bindTabs();
    bindLocks();
    bindShortcuts();

    bindProveedorUI();
    bindClienteUI();
    bindFacturaMetaUI();
    bindGridButtons();
    bindQrUI();
    bindTopActions();
    bindFacturaButtonsScaffold();

    // Ajustes + editores + facturas list + contabilidad + ventas -> 3B/3C
    // Aquí dejamos preparado lo esencial.

    // defaults locks: por defecto PROTEGIDO
    if (typeof S.locks.contabilidad !== 'boolean') S.locks.contabilidad = true;
    if (typeof S.locks.ventas !== 'boolean') S.locks.ventas = true;
    save(K.locks, S.locks);

    // boot UI
    setTab('tabFactura');
    bootFacturaUI();
    updateProductosSelectTaraDefault();
    syncLocksUI();

    // fecha pago default hoy
    if ($('#pagoFecha')) $('#pagoFecha').value = todayISO();

    // ventas defaults
    if ($('#vFecha')) $('#vFecha').value = todayISO();
    if ($('#vDesde')) $('#vDesde').value = todayISO();
    if ($('#vHasta')) $('#vHasta').value = todayISO();

    toast('FACTU MIRAL listo (Base + Grid PRO)');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* =========================================================
    (3B continúa aquí: guardar/duplicar/eliminar, listados,
     editores completos (clientes/productos/taras),
     pagos, WhatsApp, Ajustes, Contabilidad, Ventas)
  ========================================================== */

/* =========================================================
PARTE 3B/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (CONTINUACIÓN)
- 3B: Guardar/duplicar/eliminar facturas + Historial precios (solo pantalla)
      Listado facturas + Visor PDF (estructura, blob url)
      WhatsApp PRO
      CRUD Clientes / Productos / Taras (con Tara por defecto en producto)
      Pagos parciales + estado/pendiente
      Ajustes (IVA/Transporte/PIN/QR/Cloud)
========================================================= */

  /* =========================================================
    18) FACTURA: GUARDAR / DUPLICAR / ELIMINAR (LOCAL)
  ========================================================== */

  function makeSnapshots(){
    // proveedor snapshot
    const prov = {
      nombre: $('#provNombre').value.trim(),
      nif: $('#provNif').value.trim(),
      dir: $('#provDir').value.trim(),
      tel: $('#provTel').value.trim(),
      email: $('#provEmail').value.trim(),
    };
    // cliente snapshot
    const cli = readClienteInlineFromUI();
    return { prov, cli };
  }

  function normalizeFacturaBeforeSave(){
    if (!S.factura) return;

    readFacturaMetaFromUI();
    readProveedorFromUI();

    // snapshots
    const { prov, cli } = makeSnapshots();
    S.factura.provSnapshot = prov;
    S.factura.clienteSnapshot = cli;

    // QR text
    S.factura.qrText = $('#qrText').value || '';

    // asegurar 5 líneas mínimas y limpiar campos (sin perder manual)
    if (!Array.isArray(S.factura.lines)) S.factura.lines = [];
    while (S.factura.lines.length < 5) S.factura.lines.push(newLine());

    S.factura.lines = S.factura.lines.map(l => ({
      ...newLine(),
      ...l,
      producto: (l.producto||'').trim(),
      productoId: l.productoId || (findProductoByNameExact(l.producto)?.id || ''),
      modo: (l.modo||'kg'),
      cantidad: num(l.cantidad),
      bruto: num(l.bruto),
      taraId: l.taraId || '',
      taraUnit: num(l.taraUnit),
      neto: num(l.neto),
      netoManual: !!l.netoManual,
      precio: num(l.precio),
      origen: (l.origen||'').trim(),
      importe: num(l.importe),
      warn: (l.warn||''),
      lastHints: Array.isArray(l.lastHints) ? l.lastHints : [],
    }));

    recalcAll();

    // estado por pagos
    applyEstadoAuto();

    S.factura.updatedAt = Date.now();
    if (!S.factura.createdAt) S.factura.createdAt = Date.now();
  }

  function upsertFacturaToStorage(){
    normalizeFacturaBeforeSave();
    if (!S.factura) return;

    const idx = S.facturas.findIndex(f => f.id === S.factura.id);
    if (idx >= 0) S.facturas[idx] = JSON.parse(JSON.stringify(S.factura));
    else S.facturas.push(JSON.parse(JSON.stringify(S.factura)));

    save(K.facturas, S.facturas);

    // actualizar historial precios (solo pantalla)
    updatePriceHistoryFromFactura(S.factura);

    toast('Factura guardada');
    refreshFacturasList();
    refreshContabilidad(); // por si está abierto
  }

  function deleteFacturaById(id){
    S.facturas = S.facturas.filter(f => f.id !== id);
    save(K.facturas, S.facturas);
    toast('Factura eliminada');
    refreshFacturasList();
    refreshContabilidad();
  }

  function duplicateFacturaCurrent(){
    normalizeFacturaBeforeSave();
    if (!S.factura) return;
    const copy = deepCloneFactura(S.factura);
    copy.id = uid();
    copy.numero = autoInvoiceNumber(new Date());
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    // pagos se borran en duplicado (recomendado)
    copy.pagos = [];
    copy.pagado = 0;
    copy.pendiente = copy.total || 0;
    copy.estado = 'impagada';

    S.factura = copy;
    S.currentFacturaId = copy.id;
    syncFacturaMetaToUI();
    renderGrid();
    renderPagos();
    recalcAll();
    rebuildQR();
    toast('Factura duplicada');
  }

  function newFacturaUI(){
    S.factura = newFactura();
    S.currentFacturaId = S.factura.id;
    $('#selCliente').value = '';
    $('#cliNombre').value = '';
    $('#cliNif').value = '';
    $('#cliDir').value = '';
    $('#cliTel').value = '';
    $('#cliEmail').value = '';
    syncFacturaMetaToUI();
    renderGrid();
    renderPagos();
    recalcAll();
    rebuildQR();
  }

  function bindFacturaButtonsReal(){
    on($('#btnGuardarFactura'), 'click', () => upsertFacturaToStorage());
    on($('#btnQuickSave'), 'click', () => upsertFacturaToStorage());

    on($('#btnDuplicarFactura'), 'click', () => duplicateFacturaCurrent());

    on($('#btnNuevaFactura'), 'click', () => {
      // si hay cambios, se puede guardar antes (aquí: no forzamos)
      newFacturaUI();
      toast('Nueva factura');
    });
    on($('#btnQuickNew'), 'click', () => newFacturaUI());

    on($('#btnEliminarFactura'), 'click', () => {
      if (!S.factura) return;
      const ok = confirm('¿Eliminar esta factura? (no se puede deshacer)');
      if (!ok) return;
      deleteFacturaById(S.factura.id);
      newFacturaUI();
    });
  }

  /* =========================================================
    19) HISTORIAL PRECIOS (SOLO PANTALLA)
  ========================================================== */

  function updatePriceHistoryFromFactura(f){
    if (!f || !Array.isArray(f.lines)) return;
    const dateTxt = ddmmyyyy(f.fecha);

    f.lines.forEach(l => {
      const name = (l.producto||'').trim();
      if (!name) return;
      const p = findProductoByNameExact(name);
      if (!p) return;

      // Guardar hint textual: "dd/mm/aaaa · modo · precio"
      const hint = `${dateTxt} · ${l.modo} · ${fmt2(num(l.precio))}`;
      p.hist = Array.isArray(p.hist) ? p.hist : [];
      p.hist.push(hint);
      // mantener últimas 5
      if (p.hist.length > 5) p.hist = p.hist.slice(-5);
      p.updatedAt = Date.now();
    });

    save(K.productos, S.productos);
  }

  /* =========================================================
    20) PAGOS PARCIALES + ESTADO
  ========================================================== */

  function applyEstadoAuto(){
    if (!S.factura) return;
    const tot = num(S.factura.total);
    const pag = num(S.factura.pagado);

    if (pag <= 0) S.factura.estado = 'impagada';
    else if (pag >= tot - 0.009) S.factura.estado = 'pagada';
    else S.factura.estado = 'parcial';
  }

  function addPago(){
    if (!S.factura) return;
    const imp = num($('#pagoImporte').value);
    const fec = $('#pagoFecha').value || todayISO();
    if (!imp) return toast('Importe vacío');
    S.factura.pagos = Array.isArray(S.factura.pagos) ? S.factura.pagos : [];
    S.factura.pagos.push({ id: uid(), importe: imp, fecha: fec });
    $('#pagoImporte').value = '';
    renderPagos();
    recalcAll();
    rebuildQR();
  }

  function removePago(id){
    if (!S.factura) return;
    S.factura.pagos = (S.factura.pagos || []).filter(p => p.id !== id);
    renderPagos();
    recalcAll();
    rebuildQR();
  }

  function renderPagos(){
    const box = $('#listaPagos');
    if (!box || !S.factura) return;
    const pagos = Array.isArray(S.factura.pagos) ? S.factura.pagos : [];
    if (!pagos.length){
      box.innerHTML = `<div class="note">Sin pagos añadidos.</div>`;
      return;
    }
    box.innerHTML = pagos
      .slice().sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''))
      .map(p => `
        <div class="miniRow">
          <div class="miniTxt">${escapeHtml(ddmmyyyy(p.fecha))} · ${escapeHtml(money(num(p.importe)))}</div>
          <button class="btn btnTiny btnDanger" type="button" data-paydel="${escapeHtml(p.id)}">Eliminar</button>
        </div>
      `).join('');

    // bind delete
    $$('[data-paydel]', box).forEach(b => {
      on(b, 'click', () => removePago(b.dataset.paydel));
    });
  }

  function bindPagosUI(){
    on($('#btnAddPago'), 'click', () => addPago());
    on($('#pagoImporte'), 'keydown', (e) => {
      if (e.key === 'Enter') addPago();
    });
  }

  /* =========================================================
    21) LISTADO FACTURAS (BUSCAR + ABRIR + VER PDF)
  ========================================================== */

  function refreshFacturasList(){
    const list = $('#listaFacturas');
    if (!list) return;

    const q = ($('#buscarFacturas')?.value || '').trim().toLowerCase();
    const from = $('#fDesde')?.value || '';
    const to = $('#fHasta')?.value || '';
    const tag = ($('#fTag')?.value || '').trim().toLowerCase();

    let rows = S.facturas.slice();

    // filtros fecha
    if (from) rows = rows.filter(f => (f.fecha || '') >= from);
    if (to) rows = rows.filter(f => (f.fecha || '') <= to);

    // filtro texto
    if (q){
      rows = rows.filter(f => {
        const cli = (f.clienteSnapshot?.nombre || '').toLowerCase();
        const numF = (f.numero || '').toLowerCase();
        const tags = (f.tags || '').toLowerCase();
        return numF.includes(q) || cli.includes(q) || tags.includes(q);
      });
    }

    // filtro tag
    if (tag){
      rows = rows.filter(f => (f.tags || '').toLowerCase().includes(tag));
    }

    rows.sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || (b.updatedAt||0)-(a.updatedAt||0));

    if (!rows.length){
      list.innerHTML = `<div class="note">No hay facturas con esos filtros.</div>`;
      return;
    }

    list.innerHTML = rows.map(f => {
      const cli = f.clienteSnapshot?.nombre || '(sin cliente)';
      const total = money(num(f.total));
      const estado = f.estado || 'impagada';
      const tags = (f.tags || '').trim();

      return `
        <div class="cardRow">
          <div class="cardMain">
            <div class="cardTitle">${escapeHtml(f.numero || '')} · ${escapeHtml(ddmmyyyy(f.fecha || ''))}</div>
            <div class="cardSub">${escapeHtml(cli)} · ${escapeHtml(total)} · ${escapeHtml(estado)}${tags ? ' · ' + escapeHtml(tags) : ''}</div>
          </div>
          <div class="cardBtns">
            <button class="btn btnTiny" type="button" data-open="${escapeHtml(f.id)}">Editar</button>
            <button class="btn btnTiny btnGhost" type="button" data-viewpdf="${escapeHtml(f.id)}">Ver PDF</button>
          </div>
        </div>
      `;
    }).join('');

    $$('[data-open]', list).forEach(b => on(b, 'click', () => openFacturaById(b.dataset.open)));
    $$('[data-viewpdf]', list).forEach(b => on(b, 'click', () => openPdfFromFacturaId(b.dataset.viewpdf)));
  }

  function openFacturaById(id){
    const f = S.facturas.find(x => x.id === id);
    if (!f) return;
    S.factura = deepCloneFactura(f);
    S.currentFacturaId = S.factura.id;

    // aplicar proveedor snapshot al UI (sin pisar proveedor global si quieres)
    const prov = f.provSnapshot;
    if (prov){
      $('#provNombre').value = prov.nombre || $('#provNombre').value;
      $('#provNif').value = prov.nif || $('#provNif').value;
      $('#provDir').value = prov.dir || $('#provDir').value;
      $('#provTel').value = prov.tel || $('#provTel').value;
      $('#provEmail').value = prov.email || $('#provEmail').value;
    }

    // cliente snapshot al UI (no obliga a que exista en listado)
    const cli = f.clienteSnapshot;
    if (cli){
      $('#cliNombre').value = cli.nombre || '';
      $('#cliNif').value = cli.nif || '';
      $('#cliDir').value = cli.dir || '';
      $('#cliTel').value = cli.tel || '';
      $('#cliEmail').value = cli.email || '';
    }
    // selector
    fillClienteSelect();
    $('#selCliente').value = f.clienteId || '';

    syncFacturaMetaToUI();
    renderGrid();
    renderPagos();
    recalcAll();
    rebuildQR();

    setTab('tabFactura');
    toast('Factura cargada');
  }

  function bindFacturasTab(){
    on($('#buscarFacturas'), 'input', refreshFacturasList);
    on($('#fDesde'), 'change', refreshFacturasList);
    on($('#fHasta'), 'change', refreshFacturasList);
    on($('#fTag'), 'input', refreshFacturasList);
  }

  /* =========================================================
    22) WHATSAPP PRO
  ========================================================== */

  function makeWhatsText(f){
    const fecha = ddmmyyyy(f.fecha);
    const cli = f.clienteSnapshot?.nombre || '';
    const numF = f.numero || '';
    const lines = (f.lines || [])
      .filter(l => (l.producto||'').trim())
      .map(l => {
        const prod = (l.producto||'').trim();
        const modo = l.modo || 'kg';
        const cant = fmt2(num(l.cantidad));
        const bruto = fmt2(num(l.bruto));
        const taraTotal = (modo==='kg') ? (num(l.taraUnit) * num(l.cantidad)) : 0;
        const neto = fmt2(num(l.neto));
        const precio = fmt2(num(l.precio));
        const imp = fmt2(num(l.importe));
        if (modo === 'kg'){
          return `- ${prod}: ${cant} env · bruto ${bruto} kg · tara ${fmt2(taraTotal)} kg · neto ${neto} kg · ${precio}€/kg = ${imp}€`;
        }
        if (modo === 'caja'){
          return `- ${prod}: ${cant} caja · ${precio}€/caja = ${imp}€`;
        }
        return `- ${prod}: ${cant} ud · ${precio}€/ud = ${imp}€`;
      }).join('\n');

    const sub = fmt2(num(f.subtotal));
    const tr = fmt2(num(f.transporte));
    const iva = f.ivaIncluido ? 'IVA incluido' : `IVA (${fmt2(num(f.ivaPct))}%): ${fmt2(num(f.iva))}€`;
    const tot = fmt2(num(f.total));
    const pend = fmt2(num(f.pendiente));

    return `FACTURA ${numF}\nFecha: ${fecha}\nCliente: ${cli}\n\nLíneas:\n${lines || '(sin líneas)'}\n\nSubtotal: ${sub}€\nTransporte: ${tr}€\n${iva}\nTOTAL: ${tot}€\nPendiente: ${pend}€`;
  }

  function sendWhatsAppCurrent(){
    normalizeFacturaBeforeSave();
    if (!S.factura) return;
    const txt = makeWhatsText(S.factura);
    const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank');
  }

  /* =========================================================
    23) PDF VISOR (SIN DESCARGAR) — ESTRUCTURA
    - Generamos PDF en 3C (jsPDF + autotable) con multi página.
    - Aquí montamos visor con blob url.
  ========================================================== */

  function openPdfModal(){
    const m = $('#pdfModal');
    if (!m) return;
    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
  }
  function closePdfModal(){
    const m = $('#pdfModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function setPdfBlobUrl(url){
    // liberar anterior
    if (S.pdfBlobUrl){
      try{ URL.revokeObjectURL(S.pdfBlobUrl); }catch{}
    }
    S.pdfBlobUrl = url;

    const obj = $('#pdfObject');
    const frm = $('#pdfFrame');

    // algunos iOS renderizan mejor iframe
    if (frm){
      frm.src = url;
    }
    if (obj){
      obj.data = url;
    }
  }

  function openPdfFromFacturaId(id){
    const f = S.facturas.find(x => x.id === id);
    if (!f) return;
    // Generar PDF on-the-fly desde la factura guardada (3C)
    S.factura = deepCloneFactura(f);
    S.currentFacturaId = S.factura.id;
    setTab('tabFactura');
    syncFacturaMetaToUI();
    renderGrid();
    renderPagos();
    recalcAll();
    rebuildQR();
    // 3C generará PDF y lo abrirá
    $('#btnGenerarPDF')?.click();
  }

  function bindPdfModal(){
    on($('#btnPdfClose'), 'click', closePdfModal);
    on($('#btnPdfPrint'), 'click', () => {
      const frm = $('#pdfFrame');
      if (frm && frm.contentWindow){
        frm.contentWindow.focus();
        frm.contentWindow.print();
      } else {
        window.print();
      }
    });
    on($('#btnPdfOpenTab'), 'click', () => {
      if (S.pdfBlobUrl) window.open(S.pdfBlobUrl, '_blank');
    });

    on($('.modalBackdrop', $('#pdfModal')), 'click', (e) => {
      if (e.target?.dataset?.close) closePdfModal();
    });
  }

  /* =========================================================
    24) CRUD CLIENTES (TAB)
  ========================================================== */

  function renderClientes(){
    const list = $('#listaClientes');
    if (!list) return;
    const q = ($('#buscarClientes')?.value || '').trim().toLowerCase();

    let rows = S.clientes.slice();
    if (q){
      rows = rows.filter(c => {
        const s = `${c.nombre||''} ${c.nif||''} ${c.dir||''}`.toLowerCase();
        return s.includes(q);
      });
    }
    rows.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    if (!rows.length){
      list.innerHTML = `<div class="note">No hay clientes.</div>`;
      return;
    }

    list.innerHTML = rows.map(c => `
      <div class="cardRow">
        <div class="cardMain">
          <div class="cardTitle">${escapeHtml(c.nombre||'(sin nombre)')}</div>
          <div class="cardSub">${escapeHtml(c.nif||'')} · ${escapeHtml(c.dir||'')}</div>
        </div>
        <div class="cardBtns">
          <button class="btn btnTiny" type="button" data-cedit="${escapeHtml(c.id)}">Editar</button>
          <button class="btn btnTiny btnDanger" type="button" data-cdel="${escapeHtml(c.id)}">Eliminar</button>
        </div>
      </div>
    `).join('');

    $$('[data-cedit]', list).forEach(b => on(b,'click',()=> openClienteEditor(b.dataset.cedit)));
    $$('[data-cdel]', list).forEach(b => on(b,'click',()=> deleteCliente(b.dataset.cdel)));
  }

  function openClienteEditor(id){
    const c = S.clientes.find(x => x.id === id) || null;
    const m = $('#cliModal');
    if (!m) return;

    $('#cId').value = c ? c.id : '';
    $('#cNombre').value = c?.nombre || '';
    $('#cAlias').value = c?.alias || '';
    $('#cNif').value = c?.nif || '';
    $('#cDir').value = c?.dir || '';
    $('#cTel').value = c?.tel || '';
    $('#cEmail').value = c?.email || '';
    $('#cNotas').value = c?.notas || '';

    $('#cTplIvaIncl').checked = !!c?.tpl?.ivaIncluido;
    $('#cTplTransp').checked = !!c?.tpl?.transporte;
    $('#cTplPago').value = c?.tpl?.pago || '';
    $('#cTplTags').value = c?.tpl?.tagsAuto || '';
    $('#cTplNotas').value = c?.tpl?.notasStd || '';

    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
  }

  function closeClienteEditor(){
    const m = $('#cliModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function saveClienteEditor(){
    const id = $('#cId').value;
    const nombre = $('#cNombre').value.trim();
    if (!nombre) return toast('Falta nombre');

    let c = S.clientes.find(x => x.id === id);
    if (!c){
      c = newCliente();
      S.clientes.push(c);
    }

    c.nombre = nombre;
    c.alias = $('#cAlias').value.trim();
    c.nif = $('#cNif').value.trim();
    c.dir = $('#cDir').value.trim();
    c.tel = $('#cTel').value.trim();
    c.email = $('#cEmail').value.trim();
    c.notas = $('#cNotas').value.trim();

    c.tpl = c.tpl || {};
    c.tpl.ivaIncluido = $('#cTplIvaIncl').checked;
    c.tpl.transporte = $('#cTplTransp').checked;
    c.tpl.pago = $('#cTplPago').value.trim();
    c.tpl.tagsAuto = $('#cTplTags').value.trim();
    c.tpl.notasStd = $('#cTplNotas').value.trim();

    c.updatedAt = Date.now();

    save(K.clientes, S.clientes);
    fillClienteSelect();
    renderClientes();
    toast('Cliente guardado');
    closeClienteEditor();
  }

  function deleteCliente(id){
    // proteger si usado en facturas
    const used = S.facturas.some(f => f.clienteId === id);
    if (used) return toast('No se puede: cliente usado en facturas');

    const ok = confirm('¿Eliminar cliente?');
    if (!ok) return;

    S.clientes = S.clientes.filter(c => c.id !== id);
    save(K.clientes, S.clientes);
    fillClienteSelect();
    renderClientes();
    toast('Cliente eliminado');
  }

  function bindClientesTab(){
    on($('#buscarClientes'), 'input', renderClientes);
    on($('#btnNuevoCliente'), 'click', () => openClienteEditor(''));
    on($('#btnCliSave'), 'click', saveClienteEditor);
    on($('#btnCliCancel'), 'click', closeClienteEditor);
    on($('.modalBackdrop', $('#cliModal')), 'click', (e)=>{ if(e.target?.dataset?.close) closeClienteEditor(); });
  }

  /* =========================================================
    25) CRUD TARAS (TAB) + SELECTS
  ========================================================== */

  function renderTaras(){
    const list = $('#listaTaras');
    if (!list) return;
    const q = ($('#buscarTaras')?.value || '').trim().toLowerCase();

    let rows = S.taras.slice();
    if (q){
      rows = rows.filter(t => (`${t.nombre||''} ${t.peso||''}`).toLowerCase().includes(q));
    }
    rows.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    if (!rows.length){
      list.innerHTML = `<div class="note">No hay taras.</div>`;
      return;
    }

    list.innerHTML = rows.map(t => `
      <div class="cardRow">
        <div class="cardMain">
          <div class="cardTitle">${escapeHtml(t.nombre||'(sin nombre)')}</div>
          <div class="cardSub">${escapeHtml(fmt2(num(t.peso)))} kg/ud${t.notas? ' · '+escapeHtml(t.notas):''}</div>
        </div>
        <div class="cardBtns">
          <button class="btn btnTiny" type="button" data-tedit="${escapeHtml(t.id)}">Editar</button>
          <button class="btn btnTiny btnDanger" type="button" data-tdel="${escapeHtml(t.id)}">Eliminar</button>
        </div>
      </div>
    `).join('');

    $$('[data-tedit]', list).forEach(b => on(b,'click',()=> openTaraEditor(b.dataset.tedit)));
    $$('[data-tdel]', list).forEach(b => on(b,'click',()=> deleteTara(b.dataset.tdel)));
  }

  function openTaraEditor(id){
    const t = S.taras.find(x => x.id === id) || null;
    const m = $('#taraModal');
    if (!m) return;

    $('#tId').value = t ? t.id : '';
    $('#tNombre').value = t?.nombre || '';
    $('#tPeso').value = t ? String(num(t.peso)) : '';
    $('#tNotas').value = t?.notas || '';

    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
  }

  function closeTaraEditor(){
    const m = $('#taraModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function saveTaraEditor(){
    const id = $('#tId').value;
    const nombre = $('#tNombre').value.trim();
    if (!nombre) return toast('Falta nombre');
    const peso = num($('#tPeso').value);

    let t = S.taras.find(x => x.id === id);
    if (!t){
      t = newTara();
      S.taras.push(t);
    }
    t.nombre = nombre;
    t.peso = peso;
    t.notas = $('#tNotas').value.trim();
    t.updatedAt = Date.now();

    save(K.taras, S.taras);

    renderTaras();
    updateProductosSelectTaraDefault();
    // re-render grid para actualizar selects
    renderGrid();
    toast('Tara guardada');
    closeTaraEditor();
  }

  function deleteTara(id){
    // proteger si usada en productos o facturas
    const usedInProducts = S.productos.some(p => p.taraDefaultId === id);
    const usedInFacturas = S.facturas.some(f => (f.lines||[]).some(l => l.taraId === id));
    if (usedInProducts || usedInFacturas) return toast('No se puede: tara usada');

    const ok = confirm('¿Eliminar tara?');
    if (!ok) return;

    S.taras = S.taras.filter(t => t.id !== id);
    save(K.taras, S.taras);
    renderTaras();
    updateProductosSelectTaraDefault();
    renderGrid();
    toast('Tara eliminada');
  }

  function bindTarasTab(){
    on($('#buscarTaras'), 'input', renderTaras);
    on($('#btnNuevaTara'), 'click', () => openTaraEditor(''));
    on($('#btnTaraSave'), 'click', saveTaraEditor);
    on($('#btnTaraCancel'), 'click', closeTaraEditor);
    on($('.modalBackdrop', $('#taraModal')), 'click', (e)=>{ if(e.target?.dataset?.close) closeTaraEditor(); });
  }

  /* =========================================================
    26) CRUD PRODUCTOS (TAB) + TARA DEFAULT
  ========================================================== */

  function renderProductos(){
    const list = $('#listaProductos');
    if (!list) return;
    const q = ($('#buscarProductos')?.value || '').trim().toLowerCase();

    let rows = S.productos.slice();
    if (q){
      rows = rows.filter(p => (`${p.nombre||''}`).toLowerCase().includes(q));
    }
    rows.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    if (!rows.length){
      list.innerHTML = `<div class="note">No hay productos.</div>`;
      return;
    }

    list.innerHTML = rows.map(p => {
      const t = p.taraDefaultId ? getTaraById(p.taraDefaultId) : null;
      const taraTxt = t ? ` · Envase: ${t.nombre} (${fmt2(num(t.peso))}kg)` : '';
      const histTxt = (p.hist && p.hist.length) ? ` · Últimos: ${p.hist.slice(-2).join(' | ')}` : '';
      return `
        <div class="cardRow">
          <div class="cardMain">
            <div class="cardTitle">${escapeHtml(p.nombre||'(sin nombre)')}</div>
            <div class="cardSub">Modo: ${escapeHtml(p.modo||'kg')}
              ${p.modo==='kg' ? ` · ${escapeHtml(fmt2(num(p.precioKg)))}€/kg` : ''}
              ${p.modo==='caja' ? ` · ${escapeHtml(fmt2(num(p.precioCaja)))}€/caja` : ''}
              ${p.modo==='ud' ? ` · ${escapeHtml(fmt2(num(p.precioUd)))}€/ud` : ''}
              ${taraTxt}
              ${histTxt}
            </div>
          </div>
          <div class="cardBtns">
            <button class="btn btnTiny" type="button" data-pedit="${escapeHtml(p.id)}">Editar</button>
            <button class="btn btnTiny btnDanger" type="button" data-pdel="${escapeHtml(p.id)}">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');

    $$('[data-pedit]', list).forEach(b => on(b,'click',()=> openProductoEditor(b.dataset.pedit)));
    $$('[data-pdel]', list).forEach(b => on(b,'click',()=> deleteProducto(b.dataset.pdel)));
  }

  function openProductoEditor(id){
    const p = S.productos.find(x => x.id === id) || null;
    const m = $('#prodModal');
    if (!m) return;

    updateProductosSelectTaraDefault();

    $('#pId').value = p ? p.id : '';
    $('#pNombre').value = p?.nombre || '';
    $('#pModo').value = p?.modo || 'kg';
    $('#pKgCaja').value = p ? String(num(p.kgCaja)) : '';
    $('#pPrecioKg').value = p ? String(num(p.precioKg)) : '';
    $('#pPrecioCaja').value = p ? String(num(p.precioCaja)) : '';
    $('#pPrecioUd').value = p ? String(num(p.precioUd)) : '';
    $('#pCoste').value = p ? String(num(p.coste)) : '';
    $('#pOrigen').value = p?.origen || '';
    $('#pTaraDefault').value = p?.taraDefaultId || '';

    // mostrar/ocultar precios según modo (pero guardar todos)
    toggleProductoFields();

    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
  }

  function closeProductoEditor(){
    const m = $('#prodModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function toggleProductoFields(){
    const modo = $('#pModo')?.value || 'kg';
    const g = $('#pPrecioKg')?.closest('.field');
    const c = $('#pPrecioCaja')?.closest('.field');
    const u = $('#pPrecioUd')?.closest('.field');
    if (g) g.style.display = (modo==='kg') ? '' : 'none';
    if (c) c.style.display = (modo==='caja') ? '' : 'none';
    if (u) u.style.display = (modo==='ud') ? '' : 'none';
    // kgCaja solo útil en caja
    const kgc = $('#pKgCaja')?.closest('.field');
    if (kgc) kgc.style.display = (modo==='caja') ? '' : 'none';
  }

  function saveProductoEditor(){
    const id = $('#pId').value;
    const nombre = $('#pNombre').value.trim();
    if (!nombre) return toast('Falta nombre');

    let p = S.productos.find(x => x.id === id);
    if (!p){
      p = newProducto();
      S.productos.push(p);
    }

    p.nombre = nombre;
    p.modo = $('#pModo').value;
    p.kgCaja = num($('#pKgCaja').value);
    p.precioKg = num($('#pPrecioKg').value);
    p.precioCaja = num($('#pPrecioCaja').value);
    p.precioUd = num($('#pPrecioUd').value);
    p.coste = num($('#pCoste').value);
    p.origen = $('#pOrigen').value.trim();
    p.taraDefaultId = $('#pTaraDefault').value || '';
    p.updatedAt = Date.now();

    save(K.productos, S.productos);

    renderProductos();
    // para autocomplete y grid: re-render
    renderGrid();
    toast('Producto guardado');
    closeProductoEditor();
  }

  function deleteProducto(id){
    // proteger si usado en facturas
    const used = S.facturas.some(f => (f.lines||[]).some(l => l.productoId === id || findProductoByNameExact(l.producto)?.id === id));
    if (used) return toast('No se puede: producto usado en facturas');

    const ok = confirm('¿Eliminar producto?');
    if (!ok) return;

    S.productos = S.productos.filter(p => p.id !== id);
    save(K.productos, S.productos);
    renderProductos();
    renderGrid();
    toast('Producto eliminado');
  }

  function bindProductosTab(){
    on($('#buscarProductos'), 'input', renderProductos);
    on($('#btnNuevoProducto'), 'click', () => openProductoEditor(''));
    on($('#btnProdSave'), 'click', saveProductoEditor);
    on($('#btnProdCancel'), 'click', closeProductoEditor);
    on($('#pModo'), 'change', toggleProductoFields);
    on($('.modalBackdrop', $('#prodModal')), 'click', (e)=>{ if(e.target?.dataset?.close) closeProductoEditor(); });
  }

  /* =========================================================
    27) AJUSTES (TAB)
  ========================================================== */

  function saveAjustesFromUI(){
    S.ajustes.ivaPct = num($('#ajIva').value) || 4;
    S.ajustes.transportePct = num($('#ajTransporte').value) || 10;
    S.ajustes.pin = ($('#ajPin').value || '8410').trim() || '8410';
    S.ajustes.qrPlantilla = ($('#ajQrPlantilla').value || DEFAULT_AJUSTES.qrPlantilla).trim();

    // cloud
    const raw = ($('#fbCfg').value || '').trim();
    if (!raw){
      S.ajustes.firebaseCfg = null;
    } else {
      try{
        S.ajustes.firebaseCfg = JSON.parse(raw);
      } catch {
        toast('Cloud JSON inválido');
        return;
      }
    }

    save(K.ajustes, S.ajustes);

    // aplicar a factura actual
    if (S.factura){
      S.factura.ivaPct = num(S.ajustes.ivaPct);
      S.factura.transportePct = num(S.ajustes.transportePct);
    }

    syncLocksUI();
    recalcAll();
    rebuildQR();
    toast('Ajustes guardados');
  }

  function bindAjustesTab(){
    on($('#btnGuardarAjustes'), 'click', saveAjustesFromUI);
  }

  /* =========================================================
    28) BIND REAL: PDF / WHATSAPP / FACTURAS TAB
  ========================================================== */

  function bindFacturaActionsExtra(){
    on($('#btnWhatsApp'), 'click', () => {
      // guardar primero opcional
      normalizeFacturaBeforeSave();
      sendWhatsAppCurrent();
    });

    // PDF real en 3C (aquí solo abre modal si ya hay blob)
    on($('#btnVerPDF'), 'click', () => {
      if (S.pdfBlobUrl) openPdfModal();
      else toast('Genera PDF primero');
    });

    on($('#btnQuickPdf'), 'click', () => $('#btnGenerarPDF')?.click());
  }

  /* =========================================================
    29) RE-INIT HOOKS (inject into init)
  ========================================================== */
  const _init3B = init;
  init = function(){
    _init3B();

    // sustituir scaffolds por reales
    bindFacturaButtonsReal();
    bindPagosUI();
    bindFacturasTab();
    bindPdfModal();
    bindClientesTab();
    bindTarasTab();
    bindProductosTab();
    bindAjustesTab();
    bindFacturaActionsExtra();

    // primeros renders de tabs
    refreshFacturasList();
    renderClientes();
    renderTaras();
    renderProductos();
    renderPagos();

    // aplicar locks ON por defecto (pero ya creado en 3A)
    syncLocksUI();
  };

  /* =========================================================
    (3C continúa aquí: PDF PRO real (jsPDF + autotable),
     suma y sigue multi página + numeración, QR en PDF (fallback),
     Contabilidad avanzada + Ventas diarias PIN + Export CSV,
     Cloud opcional (Firebase) con 0-crash)
  ========================================================== */
/* =========================================================
PARTE 3C/5 — FACTU MIRAL (B/W PRO) — FINAL
Archivo: app.js  (CONTINUACIÓN)
- 3C: PDF PRO REAL (multipágina + suma y sigue + numeración)
      QR en PDF con fallback seguro (si falla, NO imprime QR)
      Contabilidad avanzada 🔒 (PIN)
      Ventas diarias 🔒 (PIN) San Pablo / San Lesmes / Santiago
      Reportes diarios/semanal/mensual/rangos + efectivo/tarjeta/gastos
      Export CSV (contabilidad + ventas)
      Cloud opcional Firebase (stub seguro, 0-crash si no config)
========================================================= */

/* =========================================================
   30) DEPENDENCIAS PDF (jsPDF + autoTable)
   - IMPORTANTE: en index.html ya deben estar:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
     <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
========================================================= */

  function canPDF(){
    return !!(window.jspdf && window.jspdf.jsPDF);
  }

  function safeGetJsPDF(){
    try{
      return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
    }catch{
      return null;
    }
  }

  function safeAutoTable(doc){
    try{
      return (doc && typeof doc.autoTable === 'function') ? doc.autoTable.bind(doc) : null;
    }catch{
      return null;
    }
  }

  /* =========================================================
    31) PDF PRO — GENERAR (multipágina + suma y sigue + páginas)
  ========================================================== */

  function pdfColors(){
    // B/W PRO: grises
    return {
      ink: [15,15,15],
      muted: [90,90,90],
      line: [220,220,220],
      zebra1: [255,255,255],
      zebra2: [245,245,245],
      panel: [250,250,250],
    };
  }

  function pdfDrawHeader(doc, meta){
    const c = pdfColors();
    const { pageW, margin, y0 } = meta;

    // Título + logo cereza (simple: círculo + hoja)
    doc.setTextColor(...c.ink);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('FACTURA', margin, y0);

    // "logo cereza" (vector simple B/W)
    const xLogo = pageW - margin - 22;
    const yLogo = y0 - 6;
    doc.setDrawColor(...c.ink);
    doc.setFillColor(255,255,255);
    doc.circle(xLogo+6, yLogo+8, 4, 'S');
    doc.circle(xLogo+14, yLogo+9, 4, 'S');
    // tallos
    doc.line(xLogo+6, yLogo+4, xLogo+10, yLogo+1);
    doc.line(xLogo+14, yLogo+5, xLogo+10, yLogo+1);
    // hoja
    doc.setFillColor(255,255,255);
    doc.ellipse(xLogo+11, yLogo+1, 4, 2, 'S');

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(...c.muted);
    doc.text('FACTU MIRAL — B/W PRO', margin, y0+6);
  }

  function pdfDrawTop3Cols(doc, f, meta){
    const c = pdfColors();
    const { margin, pageW } = meta;

    const topY = meta.yTop;
    const colW = (pageW - margin*2);
    const leftW = Math.floor(colW*0.38);
    const midW  = Math.floor(colW*0.24);
    const rightW= colW - leftW - midW;

    // boxes
    doc.setDrawColor(...c.line);
    doc.setLineWidth(0.3);
    doc.setFillColor(...c.panel);

    // left proveedor
    doc.rect(margin, topY, leftW, 36, 'FD');
    // mid QR
    doc.rect(margin+leftW, topY, midW, 36, 'FD');
    // right cliente
    doc.rect(margin+leftW+midW, topY, rightW, 36, 'FD');

    // proveedor text
    const prov = f.provSnapshot || readProveedorFromUI() || {};
    doc.setTextColor(...c.ink);
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Proveedor', margin+3, topY+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text((prov.nombre||'').slice(0,60), margin+3, topY+12);
    doc.text(`NIF: ${(prov.nif||'').slice(0,30)}`, margin+3, topY+17);
    doc.text((prov.dir||'').slice(0,70), margin+3, topY+22);
    const p2 = `${prov.tel ? ('Tel: '+prov.tel) : ''}${prov.email ? (' · '+prov.email) : ''}`.trim();
    doc.text(p2.slice(0,70), margin+3, topY+27);

    // cliente text
    const cli = f.clienteSnapshot || readClienteInlineFromUI() || {};
    const xR = margin+leftW+midW;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Cliente', xR+3, topY+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text((cli.nombre||'').slice(0,60), xR+3, topY+12);
    doc.text(`NIF/CIF: ${(cli.nif||'').slice(0,30)}`, xR+3, topY+17);
    doc.text((cli.dir||'').slice(0,70), xR+3, topY+22);
    const c2 = `${cli.tel ? ('Tel: '+cli.tel) : ''}${cli.email ? (' · '+cli.email) : ''}`.trim();
    doc.text(c2.slice(0,70), xR+3, topY+27);

    // meta factura mini en cliente box
    doc.setTextColor(...c.muted);
    doc.setFontSize(8);
    doc.text(`Nº: ${f.numero}`, xR+3, topY+33);
    doc.text(`Fecha: ${ddmmyyyy(f.fecha)}`, xR+40, topY+33);

    // QR (solo si qrOk y texto válido; si falla, NO se imprime)
    const midX = margin + leftW;
    try{
      const qrTxt = (f.qrText || '').trim();
      if (S.qrOk && qrTxt){
        // Renderizamos QR "pseudo" como imagen desde canvas existente
        const canvas = $('#qrCanvas');
        if (!canvas) throw new Error('no canvas');
        const dataUrl = canvas.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', midX+ (midW-28)/2, topY+4, 28, 28);
        doc.setTextColor(...c.muted);
        doc.setFontSize(7);
        // texto pequeño por si falla escaneo
        doc.text(qrTxt.slice(0, 40), midX+3, topY+34);
      } else {
        // nada
      }
    } catch {
      // ✅ si hay fallos NO ponemos QR en PDF
    }
  }

  function pdfFooter(doc, pageNum, pageCount){
    const c = pdfColors();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;

    doc.setDrawColor(...c.line);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH-14, pageW-margin, pageH-14);

    doc.setTextColor(...c.muted);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    const msg = 'Impuestos según normativa aplicable. (IVA incluido solo si se indica en la factura).';
    doc.text(msg, margin, pageH-9);

    doc.setTextColor(...c.muted);
    doc.text(`Página ${pageNum}/${pageCount}`, pageW-margin-22, pageH-9);
  }

  function buildPdfTableRows(f){
    return (f.lines || [])
      .filter(l => (l.producto||'').trim())
      .map(l => {
        const modo = l.modo || 'kg';
        const cantidad = fmt2(num(l.cantidad));
        const bruto = fmt2(num(l.bruto));
        const taraTotal = (modo==='kg') ? (num(l.taraUnit) * num(l.cantidad)) : 0;
        const tara = fmt2(taraTotal);
        const neto = fmt2(num(l.neto));
        const precio = fmt2(num(l.precio));
        const origen = (l.origen||'').trim();
        const importe = fmt2(num(l.importe));
        return [
          (l.producto||'').trim(),
          modo,
          cantidad,
          bruto,
          tara,
          neto,
          precio,
          origen,
          importe
        ];
      });
  }

  function pdfTotalsBlock(doc, f, startY){
    const c = pdfColors();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;

    const boxW = 70;
    const x = pageW - margin - boxW;
    const y = startY;

    doc.setDrawColor(...c.line);
    doc.setFillColor(...c.panel);
    doc.rect(x, y, boxW, 30, 'FD');

    doc.setTextColor(...c.ink);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text('Totales', x+3, y+6);

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text(`Subtotal: ${fmt2(num(f.subtotal))}€`, x+3, y+12);
    doc.text(`Transporte: ${fmt2(num(f.transporte))}€`, x+3, y+17);

    if (f.ivaIncluido){
      doc.setTextColor(...c.muted);
      doc.text('IVA incluido', x+3, y+22);
      doc.setTextColor(...c.ink);
    } else {
      doc.text(`IVA (${fmt2(num(f.ivaPct))}%): ${fmt2(num(f.iva))}€`, x+3, y+22);
    }

    doc.setFont('helvetica','bold');
    doc.text(`TOTAL: ${fmt2(num(f.total))}€`, x+3, y+28);

    return y + 34;
  }

  function generatePDFCurrent(openAfter=true){
    if (!S.factura) return toast('No hay factura');
    if (!canPDF()) return toast('Falta jsPDF en index.html');

    normalizeFacturaBeforeSave();

    const JsPDF = safeGetJsPDF();
    if (!JsPDF) return toast('jsPDF no disponible');
    const doc = new JsPDF({ unit:'mm', format:'a4' });
    const autoTable = safeAutoTable(doc);

    // meta
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;

    // Header
    pdfDrawHeader(doc, { pageW, margin, y0: 14 });
    // 3 columnas (prov / qr / cli)
    pdfDrawTop3Cols(doc, S.factura, { margin, pageW, yTop: 24 });

    let y = 24 + 36 + 8;

    // Tabla
    const head = [[
      'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe'
    ]];
    const body = buildPdfTableRows(S.factura);

    if (!autoTable){
      // fallback minimal sin autotable (sin multipágina)
      doc.setFontSize(10);
      doc.text('Tabla no disponible (falta autoTable).', margin, y);
      y += 6;
    } else {
      autoTable({
        head,
        body,
        startY: y,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          textColor: 15,
          lineColor: [220,220,220],
          lineWidth: 0.1,
          cellPadding: 1.8,
        },
        headStyles: {
          fillColor: [245,245,245],
          textColor: 15,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [255,255,255],
        },
        didParseCell: (data) => {
          // zebra manual: alternar gris/blanco
          if (data.section === 'body'){
            const r = data.row.index;
            if (r % 2 === 1) data.cell.styles.fillColor = [245,245,245];
            else data.cell.styles.fillColor = [255,255,255];
          }
        },
        didDrawPage: (data) => {
          // “Suma y sigue” si no es primera página
          const pageNumber = doc.internal.getNumberOfPages();
          if (pageNumber > 1){
            doc.setFontSize(8);
            doc.setTextColor(90);
            doc.text('Suma y sigue…', margin, 10);
          }
          // cabecera ligera en páginas siguientes
          if (pageNumber > 1){
            doc.setFont('helvetica','bold');
            doc.setFontSize(11);
            doc.setTextColor(15);
            doc.text('FACTURA', margin, 14);
            doc.setFont('helvetica','normal');
            doc.setFontSize(8);
            doc.setTextColor(90);
            doc.text(`${S.factura.numero} · ${ddmmyyyy(S.factura.fecha)}`, margin, 18);
          }
        }
      });

      y = doc.lastAutoTable.finalY + 6;
    }

    // Totales
    y = pdfTotalsBlock(doc, S.factura, y);

    // Observaciones
    const obs = (S.factura.observaciones || '').trim();
    if (obs){
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.setTextColor(15);
      doc.text('Observaciones', margin, y);
      y += 5;
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.setTextColor(50);
      const lines = doc.splitTextToSize(obs, pageW - margin*2);
      doc.text(lines, margin, y);
      y += lines.length * 4;
    }

    // Numeración páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let p=1; p<=pageCount; p++){
      doc.setPage(p);
      pdfFooter(doc, p, pageCount);
    }

    // Blob URL + visor
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfBlobUrl(url);

    // abrir visor
    if (openAfter){
      openPdfModal();
    }

    toast('PDF generado');
  }

  /* =========================================================
    32) CONTABILIDAD AVANZADA 🔒 (PIN)
  ========================================================== */

  function contIsLocked(){
    return !!S.locks.contabilidad;
  }

  function contFilterFacturas(){
    const from = $('#cDesde')?.value || '';
    const to = $('#cHasta')?.value || '';
    const cli = $('#cCliente')?.value || '';
    const tag = ($('#cTag')?.value || '').trim().toLowerCase();

    let rows = S.facturas.slice();

    if (from) rows = rows.filter(f => (f.fecha||'') >= from);
    if (to) rows = rows.filter(f => (f.fecha||'') <= to);
    if (cli) rows = rows.filter(f => (f.clienteId||'') === cli);
    if (tag) rows = rows.filter(f => (f.tags||'').toLowerCase().includes(tag));

    rows.sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || (b.updatedAt||0)-(a.updatedAt||0));
    return rows;
  }

  function contComputeKPIs(rows){
    const ventas = rows.reduce((a,f)=> a + num(f.total), 0);
    const iva = rows.reduce((a,f)=> a + (f.ivaIncluido ? 0 : num(f.iva)), 0);
    const nFact = rows.length;

    // margen si hay coste (por línea)
    let margen = 0;
    rows.forEach(f => {
      (f.lines||[]).forEach(l => {
        const p = l.productoId ? getProductoById(l.productoId) : findProductoByNameExact(l.producto);
        const coste = p ? num(p.coste) : 0;
        if (!coste) return;
        // margen aproximado: (precio - coste) * neto (solo modo kg) o cantidad (caja/ud)
        if ((l.modo||'kg') === 'kg'){
          margen += (num(l.precio) - coste) * num(l.neto);
        } else {
          margen += (num(l.precio) - coste) * num(l.cantidad);
        }
      });
    });

    // pendientes
    const pendiente = rows.reduce((a,f)=> a + num(f.pendiente), 0);

    return { ventas, iva, nFact, margen, pendiente };
  }

  function refreshContabilidad(){
    const box = $('#contBody');
    if (!box) return;

    // si locked, no mostrar datos
    if (contIsLocked()){
      $('#kVentas').textContent = '—';
      $('#kIva').textContent = '—';
      $('#kNfact').textContent = '—';
      $('#kMargen').textContent = '—';
      $('#kPendiente').textContent = '—';
      box.innerHTML = '';
      return;
    }

    // rellenar selector clientes
    const sel = $('#cCliente');
    if (sel){
      const cur = sel.value;
      sel.innerHTML = `<option value="">— Todos —</option>` + S.clientes
        .slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''))
        .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}</option>`).join('');
      sel.value = cur;
    }

    const rows = contFilterFacturas();
    const k = contComputeKPIs(rows);

    $('#kVentas').textContent = money(k.ventas);
    $('#kIva').textContent = money(k.iva);
    $('#kNfact').textContent = String(k.nFact);
    $('#kMargen').textContent = money(k.margen);
    $('#kPendiente').textContent = money(k.pendiente);

    if (!rows.length){
      box.innerHTML = `<div class="note">Sin resultados.</div>`;
      return;
    }

    box.innerHTML = `
      <div class="tableMini">
        <div class="tHead">
          <div>Fecha</div><div>Nº</div><div>Cliente</div><div>Total</div><div>Tags</div>
        </div>
        ${rows.map(f => `
          <div class="tRow">
            <div>${escapeHtml(ddmmyyyy(f.fecha))}</div>
            <div>${escapeHtml(f.numero||'')}</div>
            <div>${escapeHtml(f.clienteSnapshot?.nombre||'')}</div>
            <div>${escapeHtml(fmt2(num(f.total)))}€</div>
            <div>${escapeHtml(f.tags||'')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindContabilidad(){
    const refresh = () => refreshContabilidad();
    ['#cDesde','#cHasta','#cCliente'].forEach(sel => on($(sel),'change',refresh));
    on($('#cTag'),'input',refresh);

    on($('#btnExportCont'), 'click', () => exportContabilidadCSV());
  }

  function exportContabilidadCSV(){
    if (contIsLocked()) return toast('Contabilidad bloqueada');
    const rows = contFilterFacturas();
    const lines = [
      ['fecha','numero','cliente','total','iva','tags','estado','pendiente'].join(';')
    ];
    rows.forEach(f => {
      lines.push([
        ddmmyyyy(f.fecha),
        (f.numero||''),
        (f.clienteSnapshot?.nombre||''),
        fmt2(num(f.total)),
        f.ivaIncluido ? 'IVA incluido' : fmt2(num(f.iva)),
        (f.tags||''),
        (f.estado||''),
        fmt2(num(f.pendiente)),
      ].map(x => `"${String(x).replaceAll('"','""')}"`).join(';'));
    });

    downloadTextFile(lines.join('\n'), `contabilidad_${todayISO()}.csv`);
  }

  function downloadTextFile(text, filename){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  /* =========================================================
    33) VENTAS DIARIAS 🔒 (PIN) — San Pablo / San Lesmes / Santiago
  ========================================================== */

  const TIENDAS = ['San Pablo','San Lesmes','Santiago'];

  function ventasIsLocked(){
    return !!S.locks.ventas;
  }

  function vDayNameES(iso){
    const d = new Date(iso+'T00:00:00');
    const names = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return names[d.getDay()];
  }

  function ventasUpsert(entry){
    // entry: {id, fecha, tienda, efectivo, tarjeta, gastos, notas}
    const idx = S.ventas.findIndex(x => x.id === entry.id);
    if (idx >= 0) S.ventas[idx] = entry;
    else S.ventas.push(entry);
    save(K.ventas, S.ventas);
  }

  function ventasDelete(id){
    S.ventas = S.ventas.filter(x => x.id !== id);
    save(K.ventas, S.ventas);
  }

  function ventasRender(){
    const box = $('#ventasBody');
    if (!box) return;

    if (ventasIsLocked()){
      box.innerHTML = '';
      return;
    }

    // filtros
    const from = $('#vDesde')?.value || '';
    const to = $('#vHasta')?.value || '';
    const tienda = $('#vTiendaFiltro')?.value || '';

    let rows = S.ventas.slice();
    if (from) rows = rows.filter(r => (r.fecha||'') >= from);
    if (to) rows = rows.filter(r => (r.fecha||'') <= to);
    if (tienda) rows = rows.filter(r => (r.tienda||'') === tienda);

    rows.sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||'') || (a.tienda||'').localeCompare(b.tienda||''));

    // KPIs globales
    const totalEfe = rows.reduce((a,r)=> a + num(r.efectivo), 0);
    const totalTar = rows.reduce((a,r)=> a + num(r.tarjeta), 0);
    const totalGas = rows.reduce((a,r)=> a + num(r.gastos), 0);
    const totalTot = totalEfe + totalTar;
    const neto = totalTot - totalGas;

    $('#vKTotal').textContent = money(totalTot);
    $('#vKEfe').textContent = money(totalEfe);
    $('#vKTar').textContent = money(totalTar);
    $('#vKGas').textContent = money(totalGas);
    $('#vKNeto').textContent = money(neto);

    if (!rows.length){
      box.innerHTML = `<div class="note">Sin ventas en ese rango.</div>`;
      return;
    }

    // tabla
    box.innerHTML = `
      <div class="tableMini">
        <div class="tHead">
          <div>Fecha</div><div>Día</div><div>Tienda</div><div>Efectivo</div><div>Tarjeta</div><div>Gastos</div><div>Total</div><div></div>
        </div>
        ${rows.map(r => `
          <div class="tRow">
            <div>${escapeHtml(ddmmyyyy(r.fecha))}</div>
            <div>${escapeHtml(vDayNameES(r.fecha))}</div>
            <div>${escapeHtml(r.tienda)}</div>
            <div>${escapeHtml(fmt2(num(r.efectivo)))}€</div>
            <div>${escapeHtml(fmt2(num(r.tarjeta)))}€</div>
            <div>${escapeHtml(fmt2(num(r.gastos)))}€</div>
            <div><b>${escapeHtml(fmt2(num(r.efectivo)+num(r.tarjeta)))}€</b></div>
            <div>
              <button class="btn btnTiny" type="button" data-vedit="${escapeHtml(r.id)}">Editar</button>
              <button class="btn btnTiny btnDanger" type="button" data-vdel="${escapeHtml(r.id)}">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    $$('[data-vedit]', box).forEach(b => on(b,'click',()=> ventasOpenEditor(b.dataset.vedit)));
    $$('[data-vdel]', box).forEach(b => on(b,'click',()=> {
      const ok = confirm('¿Eliminar este registro de ventas?');
      if(!ok) return;
      ventasDelete(b.dataset.vdel);
      ventasRender();
    }));
  }

  function ventasOpenEditor(id){
    const m = $('#vModal');
    if (!m) return;
    const r = S.ventas.find(x => x.id === id) || null;

    $('#vId').value = r ? r.id : '';
    $('#vFecha').value = r?.fecha || todayISO();
    $('#vTienda').value = r?.tienda || 'San Pablo';
    $('#vEfectivo').value = r ? String(num(r.efectivo)) : '';
    $('#vTarjeta').value = r ? String(num(r.tarjeta)) : '';
    $('#vGastos').value = r ? String(num(r.gastos)) : '';
    $('#vNotas').value = r?.notas || '';

    m.classList.add('isOpen');
    m.setAttribute('aria-hidden','false');
  }

  function ventasCloseEditor(){
    const m = $('#vModal');
    if (!m) return;
    m.classList.remove('isOpen');
    m.setAttribute('aria-hidden','true');
  }

  function ventasSaveEditor(){
    if (ventasIsLocked()) return toast('Ventas bloqueadas');

    const fecha = $('#vFecha').value || todayISO();
    const tienda = $('#vTienda').value || 'San Pablo';
    const efectivo = num($('#vEfectivo').value);
    const tarjeta = num($('#vTarjeta').value);
    const gastos = num($('#vGastos').value);
    const notas = $('#vNotas').value.trim();

    const id = $('#vId').value || uid();

    const entry = { id, fecha, tienda, efectivo, tarjeta, gastos, notas, updatedAt: Date.now() };
    ventasUpsert(entry);

    ventasCloseEditor();
    ventasRender();
    toast('Venta guardada');
  }

  function bindVentas(){
    // filtro tiendas
    const sel = $('#vTiendaFiltro');
    if (sel){
      sel.innerHTML = `<option value="">— Todas —</option>` + TIENDAS.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }
    const sel2 = $('#vTienda');
    if (sel2){
      sel2.innerHTML = TIENDAS.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }

    on($('#btnNuevaVenta'), 'click', () => ventasOpenEditor(''));
    on($('#btnVSave'), 'click', ventasSaveEditor);
    on($('#btnVCancel'), 'click', ventasCloseEditor);
    on($('.modalBackdrop', $('#vModal')), 'click', (e)=>{ if(e.target?.dataset?.close) ventasCloseEditor(); });

    ['#vDesde','#vHasta','#vTiendaFiltro'].forEach(s => on($(s),'change',ventasRender));
    on($('#btnExportVentas'),'click', exportVentasCSV);
  }

  function exportVentasCSV(){
    if (ventasIsLocked()) return toast('Ventas bloqueadas');

    const from = $('#vDesde')?.value || '';
    const to = $('#vHasta')?.value || '';
    const tienda = $('#vTiendaFiltro')?.value || '';

    let rows = S.ventas.slice();
    if (from) rows = rows.filter(r => (r.fecha||'') >= from);
    if (to) rows = rows.filter(r => (r.fecha||'') <= to);
    if (tienda) rows = rows.filter(r => (r.tienda||'') === tienda);

    rows.sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||'') || (a.tienda||'').localeCompare(b.tienda||''));

    const lines = [
      ['fecha','dia','tienda','efectivo','tarjeta','gastos','total','neto','notas'].join(';')
    ];

    rows.forEach(r => {
      const total = num(r.efectivo)+num(r.tarjeta);
      const neto = total - num(r.gastos);
      lines.push([
        ddmmyyyy(r.fecha),
        vDayNameES(r.fecha),
        r.tienda,
        fmt2(num(r.efectivo)),
        fmt2(num(r.tarjeta)),
        fmt2(num(r.gastos)),
        fmt2(total),
        fmt2(neto),
        r.notas||'',
      ].map(x => `"${String(x).replaceAll('"','""')}"`).join(';'));
    });

    downloadTextFile(lines.join('\n'), `ventas_${todayISO()}.csv`);
  }

  /* =========================================================
    34) CLOUD (FIREBASE) — OPCIONAL, 0-CRASH (STUB SEGURO)
    - Si no config: todo sigue.
    - Si config: se intentará inicializar en try/catch.
========================================================= */

  const Cloud = {
    ready: false,
    err: '',
    init(){
      try{
        const cfg = S.ajustes?.firebaseCfg;
        if (!cfg) { this.ready=false; this.err=''; return; }

        // Si no existe firebase global, no crashea:
        if (!window.firebase) { this.ready=false; this.err='firebase sdk missing'; return; }

        // Inicialización (compat)
        if (!Cloud._app){
          Cloud._app = firebase.initializeApp(cfg);
        }
        this.ready = true;
        this.err = '';
      } catch (e){
        this.ready = false;
        this.err = String(e?.message || e);
      }
    },
    // hooks (no obligatorios ahora)
    async syncAll(){
      // ✅ No implementamos full sync aquí para evitar dependencias extras.
      // Se deja preparado sin crashear. Puedes ampliar cuando quieras.
      if (!this.ready) return false;
      return true;
    }
  };

  /* =========================================================
    35) BIND PDF BUTTONS REAL + FINAL INIT HOOK
  ========================================================== */

  function bindPdfButtonsReal(){
    on($('#btnGenerarPDF'), 'click', () => generatePDFCurrent(true));
    on($('#btnPdfCloud'), 'click', async () => {
      // generar pdf primero
      generatePDFCurrent(false);
      if (!S.pdfBlobUrl) return;

      // cloud stub (sin crash)
      Cloud.init();
      if (!Cloud.ready) return toast('Cloud no configurado');
      // aquí subirías el blob a Storage y guardarías url en factura
      toast('Cloud: listo para integrar subida (stub)');
    });
  }

  function bindFinal(){
    bindPdfButtonsReal();
    bindContabilidad();
    bindVentas();

    // contabilidad / ventas bloqueadas por defecto
    // overlays ya gestionados en 3A
    refreshContabilidad();
    ventasRender();
    Cloud.init();
    syncLocksUI();
  }

  const _init3C = init;
  init = function(){
    _init3C();
    // ya tenemos todo lo de 3B + ahora añadimos final
    bindFinal();

    // actualizar lista facturas y KPIs
    refreshFacturasList();
    refreshContabilidad();
    ventasRender();

    // Acciones en factura: generar PDF y ver
    on($('#btnVerPDF'), 'click', () => {
      if (!S.pdfBlobUrl) return toast('Genera PDF primero');
      openPdfModal();
    });

    toast('FACTU MIRAL completo (PDF+Contabilidad+Ventas)');
  };
