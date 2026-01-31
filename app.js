/* =========================================================
PARTE 3A/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3A: base app + storage + helpers + seeds + tabs + modales + atajos + locks PIN
- NO ACORTAR / NO QUITAR FUNCIONES
========================================================= */

(() => {
  'use strict';

  /* =========================
     NAMESPACE (para que cada parte sea segura)
  ========================= */
  const APP = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  APP.VERSION = 'B/W PRO 1.0 (3A)';

  /* =========================
     HELPERS DOM
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const setText = (el, t) => { if (el) el.textContent = (t ?? ''); };
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  /* =========================
     UID / TIME
  ========================= */
  function uid(){
    return 'id_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }
  function pad2(n){ n = Number(n)||0; return (n<10?'0':'') + n; }
  function yyyymmddhhmm(d){
    const dt = d instanceof Date ? d : new Date(d);
    return String(dt.getFullYear())
      + pad2(dt.getMonth()+1)
      + pad2(dt.getDate())
      + pad2(dt.getHours())
      + pad2(dt.getMinutes());
  }
  function ddmmyyyy(d){
    const dt = d instanceof Date ? d : new Date(d);
    return pad2(dt.getDate()) + '/' + pad2(dt.getMonth()+1) + '/' + dt.getFullYear();
  }
  function isoDate(d){
    const dt = d instanceof Date ? d : new Date(d);
    return dt.getFullYear() + '-' + pad2(dt.getMonth()+1) + '-' + pad2(dt.getDate());
  }
  function dayNameEs(d){
    const dt = d instanceof Date ? d : new Date(d);
    const names = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return names[dt.getDay()];
  }

  /* =========================
     FORMAT NUMBERS (es-ES)
  ========================= */
  const fmtMoney = new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' });
  const fmtNum = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
  function n2(x){
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  }
  function money(x){ return fmtMoney.format(n2(x)); }
  function num(x){ return fmtNum.format(n2(x)); }

  /* =========================
     STORAGE KEYS
  ========================= */
  const K = {
    PROV:   'fm_proveedor_v1',
    CLIENT: 'fm_clientes_v1',
    PROD:   'fm_productos_v1',
    TARAS:  'fm_taras_v1',
    FACT:   'fm_facturas_v1',
    SET:    'fm_ajustes_v1',
    VENTAS: 'fm_ventas_v1'
  };

  function load(k, fallback){
    try{
      const raw = localStorage.getItem(k);
      if(!raw) return fallback;
      const v = JSON.parse(raw);
      return (v ?? fallback);
    }catch{
      return fallback;
    }
  }
  function save(k, v){
    localStorage.setItem(k, JSON.stringify(v));
  }

  /* =========================
     DEFAULTS (Proveedor / Clientes / Productos)
  ========================= */

  // ✅ Productos a cargar SIEMPRE (tu lista)
  const SEED_PRODUCTS = [
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

  // ✅ Clientes a cargar SIEMPRE (tu lista)
  const SEED_CLIENTES = [
    { id: uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo' },
    { id: uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos' },
    { id: uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51' },
    { id: uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com' },
    { id: uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos' },
    { id: uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos' },
    { id: uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos' },
    { id: uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', email:'info@restaurantelosbraseros.com' },
    { id: uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', email:'info@hotelcordon.com' }
  ];

  // ✅ Proveedor por defecto (tu función solicitada)
  function setProviderDefaultsIfEmpty(){
    if(!$('#provNombre')?.value) $('#provNombre').value = 'Mohammad Arslan Waris';
    if(!$('#provNif')?.value)    $('#provNif').value    = 'X6389988J';
    if(!$('#provDir')?.value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
    if(!$('#provTel')?.value)    $('#provTel').value    = '631 667 893';
    if(!$('#provEmail')?.value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
  }
  APP.setProviderDefaultsIfEmpty = setProviderDefaultsIfEmpty;

  /* =========================
     MODELOS DE DATOS
  ========================= */
  function defaultSettings(){
    return {
      ivaPct: 4,
      transPct: 10,
      pin: '8410',
      qrBase: 'NIF={NIF};F={NUM};FECHA={FECHA};TOTAL={TOTAL}',
      cloud: {
        apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'', storageBucket:''
      }
    };
  }

  function defaultProvider(){
    return {
      nombre:'Mohammad Arslan Waris',
      nif:'X6389988J',
      dir:'Calle San Pablo 17, 09003 Burgos',
      tel:'631 667 893',
      email:'shaniwaris80@gmail.com'
    };
  }

  function productToObj(name){
    return {
      id: uid(),
      nombre: name,
      modo: 'kg',
      kgCaja: '',
      pKg: '',
      pCaja: '',
      pUd: '',
      coste: '',
      origen: '',
      envaseDefaultId: '',
      hist: [] // últimas 5 veces (solo pantalla)
    };
  }

  function seedProducts(){
    // Evita duplicados por nombre
    const seen = new Set();
    const out = [];
    for(const n of SEED_PRODUCTS){
      const name = (n ?? '').toString().trim();
      if(!name) continue;
      const key = name.toUpperCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(productToObj(key));
    }
    return out;
  }

  function seedClientes(){
    // Normaliza mínimo
    return SEED_CLIENTES.map(c => ({
      id: c.id || uid(),
      nombre: (c.nombre||'').trim(),
      alias: c.alias || '',
      nif: c.nif || '',
      dir: c.dir || '',
      tel: c.tel || '',
      email: c.email || '',
      notas: c.notas || '',
      tpl: {
        ivaIncl: !!c.ivaIncl,
        trans: !!c.trans,
        pago: c.pago || '',
        tags: c.tags || '',
        notasStd: c.notasStd || ''
      }
    }));
  }

  function defaultTaras(){
    // Puedes editar/añadir en tab Taras
    return [
      { id: uid(), nombre: 'Caja plástico ESMO', peso: 0.30, notas:'' },
      { id: uid(), nombre: 'Caja plástico Montenegro', peso: 0.30, notas:'' },
      { id: uid(), nombre: 'Baúl hnos viejo', peso: 1.80, notas:'' }
    ];
  }

  /* =========================
     STATE (LocalStorage)
  ========================= */
  const DB = {
    prov:   load(K.PROV, defaultProvider()),
    clientes: load(K.CLIENT, null),
    productos: load(K.PROD, null),
    taras:  load(K.TARAS, null),
    facturas: load(K.FACT, []),
    ajustes: load(K.SET, defaultSettings()),
    ventas: load(K.VENTAS, []) // {id,fecha,tienda,efectivo,tarjeta,gastos}
  };

  // Inicializa seeds si no hay datos
  if(!Array.isArray(DB.clientes) || DB.clientes.length === 0){
    DB.clientes = seedClientes();
    save(K.CLIENT, DB.clientes);
  }
  if(!Array.isArray(DB.productos) || DB.productos.length === 0){
    DB.productos = seedProducts();
    save(K.PROD, DB.productos);
  }
  if(!Array.isArray(DB.taras) || DB.taras.length === 0){
    DB.taras = defaultTaras();
    save(K.TARAS, DB.taras);
  }

  // Locks en memoria (no persistente)
  const LOCK = {
    contabilidad: true,
    ventas: true
  };
  let PIN_CONTEXT = null; // 'contabilidad' | 'ventas'

  /* =========================
     TOASTS / MODALS
  ========================= */
  function toast(title, text){
    const wrap = $('#toasts');
    if(!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toastTitle">${escapeHtml(title||'')}</div><div class="toastText">${escapeHtml(text||'')}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      try{ el.remove(); }catch{}
    }, 3200);
  }
  APP.toast = toast;

  function openModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.setAttribute('aria-hidden','false');
  }
  function closeModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.setAttribute('aria-hidden','true');
  }

  function confirmBox(title, text, yesLabel='Sí', noLabel='Cancelar'){
    return new Promise((resolve) => {
      const m = $('#confirmModal');
      if(!m){ resolve(false); return; }
      setText($('#confirmTitle'), title || 'Confirmar');
      setText($('#confirmText'), text || '¿Seguro?');

      const btnYes = $('#confirmYes');
      const btnNo = $('#confirmNo');

      if(btnYes) btnYes.textContent = yesLabel;
      if(btnNo) btnNo.textContent = noLabel;

      const cleanup = () => {
        on(btnYes,'click', ()=>{}, { once:true });
        on(btnNo,'click', ()=>{}, { once:true });
      };

      openModal('confirmModal');
      on(btnYes,'click', () => { closeModal('confirmModal'); cleanup(); resolve(true); }, { once:true });
      on(btnNo,'click', () => { closeModal('confirmModal'); cleanup(); resolve(false); }, { once:true });
    });
  }
  APP.confirmBox = confirmBox;

  function openPinModal(context){
    PIN_CONTEXT = context;
    setText($('#pinHint'), '');
    hide($('#pinHint'));
    const pin = $('#pinInput');
    if(pin) pin.value = '';
    openModal('pinModal');
    setTimeout(()=>{ pin && pin.focus(); }, 60);
  }
  function pinOk(){
    const pin = ($('#pinInput')?.value || '').trim();
    const ok = pin && pin === String(DB.ajustes?.pin ?? '8410');
    if(!ok){
      const hint = $('#pinHint');
      if(hint){
        hint.textContent = 'PIN incorrecto';
        hint.style.display = '';
      }
      return;
    }
    if(PIN_CONTEXT === 'contabilidad') LOCK.contabilidad = false;
    if(PIN_CONTEXT === 'ventas') LOCK.ventas = false;

    closeModal('pinModal');
    toast('Desbloqueado', (PIN_CONTEXT === 'contabilidad' ? 'Contabilidad desbloqueada' : 'Ventas desbloqueadas'));
    PIN_CONTEXT = null;

    // Refrescos según sección
    if(!LOCK.contabilidad) APP.refreshContabilidad?.();
    if(!LOCK.ventas) APP.refreshVentas?.();
  }

  /* =========================
     NAV / TABS
  ========================= */
  function activateTab(tabId){
    // Protecciones
    if(tabId === 'tabContabilidad' && LOCK.contabilidad){
      openPinModal('contabilidad');
      // Mantiene en factura (o el que esté) hasta desbloquear
      return;
    }
    if(tabId === 'tabVentas' && LOCK.ventas){
      openPinModal('ventas');
      return;
    }

    $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabId));
    $$('.tabpage').forEach(p => p.classList.toggle('is-active', p.id === tabId));

    // On-show hooks
    if(tabId === 'tabFacturas') APP.refreshFacturas?.();
    if(tabId === 'tabClientes') APP.refreshClientesUI?.();
    if(tabId === 'tabProductos') APP.refreshProductosUI?.();
    if(tabId === 'tabTaras') APP.refreshTarasUI?.();
    if(tabId === 'tabContabilidad') APP.refreshContabilidad?.();
    if(tabId === 'tabVentas') APP.refreshVentas?.();
    if(tabId === 'tabAjustes') APP.refreshAjustesUI?.();
  }

  function bindTabs(){
    $$('.tab').forEach(btn => {
      on(btn, 'click', () => activateTab(btn.dataset.tab));
    });
  }

  /* =========================
     AJUSTES UI (base)
  ========================= */
  function refreshAjustesUI(){
    const s = DB.ajustes || defaultSettings();
    if($('#setIvaPct')) $('#setIvaPct').value = n2(s.ivaPct);
    if($('#setTransPct')) $('#setTransPct').value = n2(s.transPct);
    if($('#setPin')) $('#setPin').value = String(s.pin ?? '8410');
    if($('#setQrBase')) $('#setQrBase').value = String(s.qrBase ?? 'NIF={NIF};F={NUM};FECHA={FECHA};TOTAL={TOTAL}');

    if($('#fbApiKey')) $('#fbApiKey').value = s.cloud?.apiKey || '';
    if($('#fbAuthDomain')) $('#fbAuthDomain').value = s.cloud?.authDomain || '';
    if($('#fbDatabaseURL')) $('#fbDatabaseURL').value = s.cloud?.databaseURL || '';
    if($('#fbProjectId')) $('#fbProjectId').value = s.cloud?.projectId || '';
    if($('#fbAppId')) $('#fbAppId').value = s.cloud?.appId || '';
    if($('#fbStorageBucket')) $('#fbStorageBucket').value = s.cloud?.storageBucket || '';

    // Pills
    setText($('#ivaPctPill'), (n2(s.ivaPct) || 0) + '%');
    setText($('#transPctPill'), (n2(s.transPct) || 0) + '%');
  }
  APP.refreshAjustesUI = refreshAjustesUI;

  function saveAjustes(){
    const s = DB.ajustes || defaultSettings();
    s.ivaPct = n2($('#setIvaPct')?.value);
    s.transPct = n2($('#setTransPct')?.value);
    s.pin = String($('#setPin')?.value || '8410').trim() || '8410';
    s.qrBase = String($('#setQrBase')?.value || '').trim() || 'NIF={NIF};F={NUM};FECHA={FECHA};TOTAL={TOTAL}';

    s.cloud = s.cloud || {};
    s.cloud.apiKey = String($('#fbApiKey')?.value || '').trim();
    s.cloud.authDomain = String($('#fbAuthDomain')?.value || '').trim();
    s.cloud.databaseURL = String($('#fbDatabaseURL')?.value || '').trim();
    s.cloud.projectId = String($('#fbProjectId')?.value || '').trim();
    s.cloud.appId = String($('#fbAppId')?.value || '').trim();
    s.cloud.storageBucket = String($('#fbStorageBucket')?.value || '').trim();

    DB.ajustes = s;
    save(K.SET, DB.ajustes);

    refreshAjustesUI();
    APP.refreshInvoiceTotals?.();
    APP.renderQR?.();
    toast('Ajustes', 'Guardados correctamente');
  }

  /* =========================
     PROVEEDOR UI
  ========================= */
  function loadProviderToUI(){
    const p = DB.prov || defaultProvider();
    if($('#provNombre')) $('#provNombre').value = p.nombre || '';
    if($('#provNif')) $('#provNif').value = p.nif || '';
    if($('#provDir')) $('#provDir').value = p.dir || '';
    if($('#provTel')) $('#provTel').value = p.tel || '';
    if($('#provEmail')) $('#provEmail').value = p.email || '';
  }

  function saveProviderFromUI(){
    const p = DB.prov || defaultProvider();
    p.nombre = String($('#provNombre')?.value || '').trim();
    p.nif = String($('#provNif')?.value || '').trim();
    p.dir = String($('#provDir')?.value || '').trim();
    p.tel = String($('#provTel')?.value || '').trim();
    p.email = String($('#provEmail')?.value || '').trim();
    DB.prov = p;
    save(K.PROV, DB.prov);
    toast('Proveedor', 'Datos guardados');
  }

  /* =========================
     CLIENT SELECT (factura)
  ========================= */
  function fillClienteSelect(){
    const sel = $('#clienteSelect');
    if(!sel) return;
    const arr = DB.clientes || [];
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '(Seleccionar cliente)';
    sel.appendChild(opt0);

    for(const c of arr){
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nombre || '(sin nombre)';
      sel.appendChild(o);
    }
  }
  APP.fillClienteSelect = fillClienteSelect;

  /* =========================
     TARAS SELECT (productos editor)
  ========================= */
  function fillTarasSelects(){
    const selProdEnv = $('#prodEnvaseDefault');
    if(selProdEnv){
      selProdEnv.innerHTML = '';
      const o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = '(sin envase)';
      selProdEnv.appendChild(o0);

      for(const t of (DB.taras||[])){
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = `${t.nombre} (${num(t.peso)} kg)`;
        selProdEnv.appendChild(o);
      }
    }
  }
  APP.fillTarasSelects = fillTarasSelects;

  /* =========================
     FACTURA BASE (número / fecha)
  ========================= */
  function buildInvoiceNumber(d=new Date()){
    return 'FA-' + yyyymmddhhmm(d);
  }
  APP.buildInvoiceNumber = buildInvoiceNumber;

  // Estado actual de factura en memoria (se guarda en DB.facturas desde 3B)
  const CUR = {
    id: null,
    num: null,
    fechaISO: isoDate(new Date()),
    tags: '',
    notas: '',
    obs: '',
    clienteId: '',
    clienteSnap: null,
    estado: 'impagada',
    metodoPago: '',
    ivaIncl: false,
    transporte: false,
    pagos: [],
    lines: [] // se construye en 3B
  };
  APP.CUR = CUR;

  function setFacturaHeaderUI(){
    if(!CUR.num) CUR.num = buildInvoiceNumber(new Date());
    setText($('#factNumText'), CUR.num);

    const f = $('#factFecha');
    if(f){
      f.value = CUR.fechaISO || isoDate(new Date());
    }

    if($('#factTags')) $('#factTags').value = CUR.tags || '';
    if($('#factNotas')) $('#factNotas').value = CUR.notas || '';
    if($('#factObs')) $('#factObs').value = CUR.obs || '';

    // Estado/metodo
    if($('#factEstado')) $('#factEstado').value = CUR.estado || 'impagada';
    if($('#factMetodoPago')) $('#factMetodoPago').value = CUR.metodoPago || '';
  }
  APP.setFacturaHeaderUI = setFacturaHeaderUI;

  /* =========================
     QUICK SEARCH / HELP / ATajos
  ========================= */
  function openHelp(){
    const tpl = $('#tplHelp');
    if(!tpl) return;
    const html = tpl.innerHTML;
    toast('Atajos', 'Ctrl+S Guardar · Ctrl+P PDF · Ctrl+F Buscar · Enter avanzar');
    // Mantengo toast rápido; modal ayuda completa opcional (en 3B/3C)
    // Si quieres modal, lo añadimos luego sin quitar nada.
  }

  function focusSearch(){
    const currentTab = $('.tab.is-active')?.dataset?.tab || 'tabFactura';
    if(currentTab === 'tabFacturas'){
      $('#factSearch')?.focus();
      return;
    }
    if(currentTab === 'tabClientes'){
      $('#cliSearch')?.focus();
      return;
    }
    if(currentTab === 'tabProductos'){
      $('#prodSearch')?.focus();
      return;
    }
    if(currentTab === 'tabTaras'){
      $('#taraSearch')?.focus();
      return;
    }
    // En Factura: enfoca producto primera línea (lo crea 3B)
    APP.focusFirstProduct?.();
  }

  /* =========================
     MODAL CLOSE (data-close)
  ========================= */
  function bindModalClosers(){
    $$('[data-close]').forEach(el => {
      on(el, 'click', () => closeModal(el.getAttribute('data-close')));
    });
  }

  /* =========================
     CLOUD BADGE (solo indicador por ahora)
  ========================= */
  function refreshCloudBadge(){
    const s = DB.ajustes?.cloud || {};
    const hasCfg = !!(s.apiKey && s.authDomain && s.projectId);
    setText($('#cloudState'), hasCfg ? 'CFG' : 'OFF');
  }
  APP.refreshCloudBadge = refreshCloudBadge;

  /* =========================
     VENTAS UI (BASE) — cálculos y UI
  ========================= */
  function refreshVentasUIInputs(){
    const d = $('#ventasFecha');
    if(d && !d.value) d.value = isoDate(new Date());
    updateVentasDayAndTotals();
  }

  function updateVentasDayAndTotals(){
    const f = $('#ventasFecha')?.value || isoDate(new Date());
    const dt = new Date(f + 'T00:00:00');
    setText($('#ventasDiaSemana'), dayNameEs(dt));

    const efe = n2($('#ventasEfectivo')?.value);
    const tar = n2($('#ventasTarjeta')?.value);
    const gas = n2($('#ventasGastos')?.value);
    const total = efe + tar;
    const neto = total - gas;

    setText($('#ventasTotal'), money(total));
    setText($('#ventasNeto'), money(neto));
  }

  function ventasGuardar(){
    const f = ($('#ventasFecha')?.value || '').trim();
    const tienda = ($('#ventasTienda')?.value || '').trim();
    if(!f || !tienda){
      toast('Ventas', 'Falta fecha o tienda');
      return;
    }
    const efe = n2($('#ventasEfectivo')?.value);
    const tar = n2($('#ventasTarjeta')?.value);
    const gas = n2($('#ventasGastos')?.value);

    // Si existe registro mismo día+tienda, se actualiza
    const idKey = `${f}__${tienda}`;
    let row = (DB.ventas||[]).find(x => x.key === idKey);
    if(!row){
      row = { id: uid(), key: idKey, fecha: f, tienda, efectivo:0, tarjeta:0, gastos:0, ts: Date.now() };
      DB.ventas.unshift(row);
    }
    row.efectivo = efe;
    row.tarjeta = tar;
    row.gastos = gas;
    row.ts = Date.now();

    save(K.VENTAS, DB.ventas);
    toast('Ventas', 'Guardado');
    APP.refreshVentas?.();
  }

  function ventasDelete(id){
    const idx = (DB.ventas||[]).findIndex(x => x.id === id);
    if(idx >= 0){
      DB.ventas.splice(idx,1);
      save(K.VENTAS, DB.ventas);
      toast('Ventas', 'Eliminado');
      APP.refreshVentas?.();
    }
  }

  function ventasRange(fromISO, toISO){
    const arr = DB.ventas || [];
    const from = fromISO ? new Date(fromISO+'T00:00:00').getTime() : null;
    const to = toISO ? new Date(toISO+'T23:59:59').getTime() : null;

    return arr.filter(v => {
      const t = new Date((v.fecha||'')+'T12:00:00').getTime();
      if(from && t < from) return false;
      if(to && t > to) return false;
      return true;
    });
  }

  function ventasWeekRange(){
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay(); // 0 dom
    const diffToMon = (day === 0) ? -6 : (1 - day);
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun) };
  }

  function ventasMonthRange(){
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
    return { from: isoDate(first), to: isoDate(last) };
  }

  function renderVentasTable(rows){
    const body = $('#ventasBody');
    if(!body) return;
    body.innerHTML = '';

    // KPIs
    let kTotal=0, kEfe=0, kTar=0, kGas=0;

    for(const r of rows){
      const efe = n2(r.efectivo);
      const tar = n2(r.tarjeta);
      const gas = n2(r.gastos);
      const total = efe + tar;

      kEfe += efe; kTar += tar; kGas += gas; kTotal += total;

      const dt = new Date((r.fecha||'')+'T00:00:00');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(ddmmyyyy(dt))}</td>
        <td>${escapeHtml(dayNameEs(dt))}</td>
        <td><b>${escapeHtml(r.tienda||'')}</b></td>
        <td>${escapeHtml(money(efe))}</td>
        <td>${escapeHtml(money(tar))}</td>
        <td><b>${escapeHtml(money(total))}</b></td>
        <td>${escapeHtml(money(gas))}</td>
        <td>
          <div class="tableBtns">
            <button class="linkBtn danger" data-ventadel="${escapeHtml(r.id)}" type="button">Eliminar</button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    }

    setText($('#vkTotal'), money(kTotal));
    setText($('#vkEfe'), money(kEfe));
    setText($('#vkTar'), money(kTar));
    setText($('#vkGas'), money(kGas));

    $$('[data-ventadel]').forEach(btn => {
      on(btn,'click', async () => {
        const ok = await confirmBox('Eliminar venta', '¿Eliminar este registro?');
        if(ok) ventasDelete(btn.getAttribute('data-ventadel'));
      });
    });
  }

  function refreshVentas(){
    // Si está bloqueado, limpia y muestra 0
    if(LOCK.ventas){
      setText($('#vkTotal'), money(0));
      setText($('#vkEfe'), money(0));
      setText($('#vkTar'), money(0));
      setText($('#vkGas'), money(0));
      const body = $('#ventasBody'); if(body) body.innerHTML = '';
      return;
    }

    const from = $('#ventasDesde')?.value || '';
    const to = $('#ventasHasta')?.value || '';
    const tienda = ($('#ventasFiltroTienda')?.value || '').trim();

    let rows = ventasRange(from, to);
    if(tienda) rows = rows.filter(r => r.tienda === tienda);

    // Orden: fecha desc, tienda
    rows.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'') || (a.tienda||'').localeCompare(b.tienda||''));

    renderVentasTable(rows);
  }
  APP.refreshVentas = refreshVentas;

  /* =========================
     STUBS (se implementan en 3B/3C)
  ========================= */
  APP.refreshInvoiceTotals = APP.refreshInvoiceTotals || function(){ /* 3B */ };
  APP.renderQR = APP.renderQR || function(){ /* 3B */ };
  APP.refreshFacturas = APP.refreshFacturas || function(){ /* 3C */ };
  APP.refreshClientesUI = APP.refreshClientesUI || function(){ /* 3C */ };
  APP.refreshProductosUI = APP.refreshProductosUI || function(){ /* 3C */ };
  APP.refreshTarasUI = APP.refreshTarasUI || function(){ /* 3C */ };
  APP.refreshContabilidad = APP.refreshContabilidad || function(){ /* 3C */ };
  APP.focusFirstProduct = APP.focusFirstProduct || function(){ /* 3B */ };

  /* =========================
     INIT + BINDINGS
  ========================= */
  function bindEvents(){
    // Tabs
    bindTabs();

    // Modales
    bindModalClosers();
    on($('#btnPinOk'), 'click', pinOk);
    on($('#pinInput'), 'keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); pinOk(); }});

    // Proveedor
    on($('#btnProvGuardar'), 'click', saveProviderFromUI);

    // Ayuda / buscar
    on($('#btnHelp'), 'click', openHelp);
    on($('#btnQuickSearch'), 'click', focusSearch);

    // Ajustes
    on($('#btnGuardarAjustes'), 'click', saveAjustes);

    // Locks
    on($('#btnUnlockCont'), 'click', () => openPinModal('contabilidad'));
    on($('#btnLockCont'), 'click', () => { LOCK.contabilidad = true; toast('Contabilidad', 'Bloqueada'); APP.refreshContabilidad?.(); });

    on($('#btnUnlockVentas'), 'click', () => openPinModal('ventas'));
    on($('#btnLockVentas'), 'click', () => { LOCK.ventas = true; toast('Ventas', 'Bloqueadas'); APP.refreshVentas?.(); });

    // Ventas inputs live
    on($('#ventasFecha'), 'change', updateVentasDayAndTotals);
    on($('#ventasEfectivo'), 'input', updateVentasDayAndTotals);
    on($('#ventasTarjeta'), 'input', updateVentasDayAndTotals);
    on($('#ventasGastos'), 'input', updateVentasDayAndTotals);

    on($('#btnVentasGuardar'), 'click', () => {
      if(LOCK.ventas){ openPinModal('ventas'); return; }
      ventasGuardar();
    });

    // Reportes ventas
    on($('#btnVentasHoy'), 'click', () => {
      if(LOCK.ventas){ openPinModal('ventas'); return; }
      const today = isoDate(new Date());
      if($('#ventasDesde')) $('#ventasDesde').value = today;
      if($('#ventasHasta')) $('#ventasHasta').value = today;
      APP.refreshVentas?.();
    });
    on($('#btnVentasSemana'), 'click', () => {
      if(LOCK.ventas){ openPinModal('ventas'); return; }
      const r = ventasWeekRange();
      if($('#ventasDesde')) $('#ventasDesde').value = r.from;
      if($('#ventasHasta')) $('#ventasHasta').value = r.to;
      APP.refreshVentas?.();
    });
    on($('#btnVentasMes'), 'click', () => {
      if(LOCK.ventas){ openPinModal('ventas'); return; }
      const r = ventasMonthRange();
      if($('#ventasDesde')) $('#ventasDesde').value = r.from;
      if($('#ventasHasta')) $('#ventasHasta').value = r.to;
      APP.refreshVentas?.();
    });
    on($('#btnVentasRango'), 'click', () => {
      if(LOCK.ventas){ openPinModal('ventas'); return; }
      APP.refreshVentas?.();
    });

    // Cloud badge
    on($('#btnCloudBadge'), 'click', () => activateTab('tabAjustes'));

    // Atajos teclado PRO
    on(document, 'keydown', (e) => {
      const key = (e.key||'').toLowerCase();
      if(e.ctrlKey && key === 'f'){
        e.preventDefault();
        focusSearch();
        return;
      }
      if(e.ctrlKey && key === 's'){
        e.preventDefault();
        APP.saveCurrentInvoice?.(); // 3B
        return;
      }
      if(e.ctrlKey && key === 'p'){
        e.preventDefault();
        APP.generatePDF?.(); // 3C
        return;
      }
      if(key === 'escape'){
        // Cierra modales visibles
        ['pdfModal','pinModal','confirmModal'].forEach(id => {
          const m = document.getElementById(id);
          if(m && m.getAttribute('aria-hidden') === 'false') closeModal(id);
        });
      }
    });

    // Cierre modal por click fuera ya via data-close
    // (iframe pdfModal no se cierra sin botón)
  }

  function init(){
    // Provider
    loadProviderToUI();
    setProviderDefaultsIfEmpty();

    // Ajustes
    refreshAjustesUI();
    refreshCloudBadge();

    // Factura header base
    CUR.num = CUR.num || buildInvoiceNumber(new Date());
    CUR.fechaISO = CUR.fechaISO || isoDate(new Date());
    setFacturaHeaderUI();

    // Clientes / Taras selects
    fillClienteSelect();
    fillTarasSelects();

    // Ventas base
    refreshVentasUIInputs();
    refreshVentas();

    bindEvents();

    // Primera render QR / totales (se completan en 3B)
    APP.renderQR?.();
    APP.refreshInvoiceTotals?.();

    toast('FACTU MIRAL', 'Listo (Offline). Cloud opcional.');
  }

  // Exponer DB al namespace (sin romper offline)
  APP.DB = DB;
  APP.LOCK = LOCK;

  // Start
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();
/* =========================================================
PARTE 3B/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3B: factura + grid pro + autocomplete + cálculos correctos + totales + pagos + QR
- NO ACORTAR / NO QUITAR FUNCIONES
========================================================= */

(() => {
  'use strict';

  const APP = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  APP.VERSION = (APP.VERSION || '') + ' + 3B';

  /* =========================
     HELPERS (reutiliza estilo 3A)
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const setText = (el, t) => { if (el) el.textContent = (t ?? ''); };
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  const DB = APP.DB;
  const CUR = APP.CUR;

  function n2(x){
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  }
  const fmtMoney = new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' });
  const fmtNum = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
  function money(x){ return fmtMoney.format(n2(x)); }
  function num(x){ return fmtNum.format(n2(x)); }

  function pad2(n){ n = Number(n)||0; return (n<10?'0':'') + n; }
  function isoDate(d){
    const dt = d instanceof Date ? d : new Date(d);
    return dt.getFullYear() + '-' + pad2(dt.getMonth()+1) + '-' + pad2(dt.getDate());
  }
  function ddmmyyyy(d){
    const dt = d instanceof Date ? d : new Date(d);
    return pad2(dt.getDate()) + '/' + pad2(dt.getMonth()+1) + '/' + dt.getFullYear();
  }

  function uid(){
    return 'id_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  /* =========================
     GRID MODEL
  ========================= */
  function blankLine(){
    return {
      id: uid(),
      producto: '',
      modo: 'kg',          // kg | caja | ud
      cantidad: '',        // nº unidades/envases (si aplica)
      bruto: '',           // kg
      envaseId: '',        // tara id
      nEnvases: '',        // nº envases
      tara: '',            // tara total (kg) -> auto o manual
      taraManual: false,   // si usuario escribe tara
      neto: '',            // neto kg -> auto o manual
      netoManual: false,
      precio: '',
      origen: '',
      importe: 0,
      _prodId: '',
      _warnings: []
    };
  }

  function ensureLines(n=5){
    if(!Array.isArray(CUR.lines)) CUR.lines = [];
    while(CUR.lines.length < n) CUR.lines.push(blankLine());
  }

  /* =========================
     PRODUCT LOOKUPS
  ========================= */
  function normName(s){
    return (s ?? '').toString().trim();
  }
  function findProductByName(name){
    const key = normName(name).toUpperCase();
    if(!key) return null;
    return (DB.productos || []).find(p => (p.nombre||'').toUpperCase() === key) || null;
  }
  function findTaraById(id){
    return (DB.taras || []).find(t => t.id === id) || null;
  }
  function getDefaultPriceForMode(prod, modo){
    if(!prod) return '';
    if(modo === 'kg') return (prod.pKg ?? '');
    if(modo === 'caja') return (prod.pCaja ?? '');
    if(modo === 'ud') return (prod.pUd ?? '');
    return '';
  }
  function getDefaultOrigin(prod){
    return prod ? (prod.origen ?? '') : '';
  }
  function getDefaultMode(prod){
    return prod ? (prod.modo ?? 'kg') : 'kg';
  }
  function getDefaultEnvaseId(prod){
    return prod ? (prod.envaseDefaultId ?? '') : '';
  }
  function getKgCaja(prod){
    const v = prod ? prod.kgCaja : '';
    const n = n2(v);
    return n > 0 ? n : 0;
  }

  /* =========================
     AUTOCOMPLETE (manual)
     - NO sustituye automático
     - solo al seleccionar (click/enter) se aplica
  ========================= */
  const SUG = {
    open: false,
    lineId: null,
    anchor: null,   // input
    items: [],
    index: 0
  };

  function buildSuggestions(query){
    const q = normName(query).toUpperCase();
    if(!q) return [];
    const arr = DB.productos || [];
    // Contiene o empieza por
    const starts = [];
    const contains = [];
    for(const p of arr){
      const name = (p.nombre||'').toUpperCase();
      if(!name) continue;
      if(name.startsWith(q)) starts.push(p);
      else if(name.includes(q)) contains.push(p);
    }
    const out = starts.concat(contains).slice(0, 12);
    return out.map(p => ({
      id: p.id,
      nombre: p.nombre,
      modo: p.modo || 'kg',
      pKg: p.pKg, pCaja: p.pCaja, pUd: p.pUd
    }));
  }

  function positionSuggestBox(input){
    const box = $('#suggestBox');
    if(!box || !input) return;
    const gridWrap = $('#gridWrap');
    const r = input.getBoundingClientRect();
    const gw = gridWrap.getBoundingClientRect();

    // Posición relativa al gridWrap
    const top = (r.bottom - gw.top) + (gridWrap.scrollTop || 0) + 6;
    const left = (r.left - gw.left) + (gridWrap.scrollLeft || 0);

    box.style.top = `${Math.max(6, top)}px`;
    box.style.left = `${Math.max(6, left)}px`;
  }

  function renderSuggest(){
    const box = $('#suggestBox');
    const inner = $('#suggestInner');
    if(!box || !inner) return;

    inner.innerHTML = '';
    const items = SUG.items || [];
    if(!items.length){
      hide(box);
      SUG.open = false;
      return;
    }

    items.forEach((it, idx) => {
      const d = document.createElement('div');
      d.className = 'sugItem' + (idx === SUG.index ? ' is-active' : '');
      d.innerHTML = `
        <div>
          <div class="sugName">${escapeHtml(it.nombre)}</div>
          <div class="sugMeta">modo: ${escapeHtml(it.modo || 'kg')}</div>
        </div>
        <div class="sugMeta">
          ${escapeHtml(it.pKg ? `€/${'kg'} ${it.pKg}` : '')}
          ${escapeHtml(it.pCaja ? `  · caja ${it.pCaja}` : '')}
          ${escapeHtml(it.pUd ? `  · ud ${it.pUd}` : '')}
        </div>
      `;
      on(d, 'mousedown', (e) => {
        // mousedown para no perder foco por blur
        e.preventDefault();
        selectSuggestion(idx);
      });
      inner.appendChild(d);
    });

    show(box);
    SUG.open = true;
  }

  function openSuggest(input, lineId){
    const q = input.value;
    const items = buildSuggestions(q);
    SUG.items = items;
    SUG.index = 0;
    SUG.anchor = input;
    SUG.lineId = lineId;

    if(!items.length){
      closeSuggest();
      return;
    }

    positionSuggestBox(input);
    renderSuggest();
  }

  function closeSuggest(){
    SUG.open = false;
    SUG.lineId = null;
    SUG.anchor = null;
    SUG.items = [];
    SUG.index = 0;
    const box = $('#suggestBox');
    if(box) hide(box);
  }

  function moveSuggest(dir){
    if(!SUG.open) return;
    const n = (SUG.items || []).length;
    if(!n) return;
    SUG.index = (SUG.index + dir + n) % n;
    renderSuggest();
  }

  function selectSuggestion(idx){
    if(!SUG.open) return;
    const item = (SUG.items || [])[idx];
    if(!item) return;

    const line = CUR.lines.find(l => l.id === SUG.lineId);
    if(!line) return;

    // ✅ Solo al seleccionar, se rellena
    line.producto = item.nombre;

    // Si el modo está vacío o es default, se puede ajustar al modo por defecto del producto
    const prod = findProductByName(item.nombre);
    if(prod){
      // Si el usuario no había tocado modo, lo llevamos a default del producto
      // (pero si ya lo cambió, lo respetamos)
      if(!line._modoTouched){
        line.modo = getDefaultMode(prod);
      }

      // Envase por defecto si existe y aún no hay
      if(!line.envaseId){
        line.envaseId = getDefaultEnvaseId(prod);
      }

      // Origen por defecto si vacío
      if(!line.origen){
        line.origen = getDefaultOrigin(prod);
      }

      // Precio por defecto si vacío
      if(!line.precio){
        const pr = getDefaultPriceForMode(prod, line.modo);
        if(pr !== '' && pr !== null && pr !== undefined) line.precio = pr;
      }
    }

    closeSuggest();
    renderLines();
    refreshInvoiceTotals();
    renderQR();
    // vuelve al input producto de esa línea y pasa al siguiente campo
    setTimeout(() => {
      const inp = $(`tr[data-lineid="${line.id}"] input[data-field="producto"]`);
      inp && inp.focus();
    }, 0);
  }

  /* =========================
     RENDER LINES (GRID)
  ========================= */
  const FIELD_ORDER = ['producto','modo','cantidad','bruto','envase','nenv','tara','neto','precio','origen'];

  function cellHintForLine(line){
    const prod = findProductByName(line.producto);
    if(!prod) return '';
    const hist = Array.isArray(prod.hist) ? prod.hist.slice(0,5) : [];
    if(!hist.length) return '';
    // mostrar últimas 3 como hint en pantalla
    const items = hist.slice(0,3).map(h => {
      const m = h.modo || 'kg';
      const v = h.valor;
      const dt = h.fecha ? ddmmyyyy(new Date(h.fecha)) : '';
      return `${m}:${v}${dt?` (${dt})`:''}`;
    });
    return `Últimos: ${items.join(' · ')}`;
  }

  function buildTaraOptions(selectedId){
    const arr = DB.taras || [];
    let html = `<option value="">(sin envase)</option>`;
    for(const t of arr){
      const sel = t.id === selectedId ? 'selected' : '';
      html += `<option value="${escapeHtml(t.id)}" ${sel}>${escapeHtml(t.nombre)} (${num(t.peso)} kg)</option>`;
    }
    return html;
  }

  function buildModeOptions(val){
    const v = val || 'kg';
    return `
      <option value="kg" ${v==='kg'?'selected':''}>kg</option>
      <option value="caja" ${v==='caja'?'selected':''}>caja</option>
      <option value="ud" ${v==='ud'?'selected':''}>ud</option>
    `;
  }

  function renderLineRow(line, idx){
    const tr = document.createElement('tr');
    tr.setAttribute('data-lineid', line.id);

    const warn = (line._warnings||[]);
    const hasWarn = warn.length > 0;

    const hint = cellHintForLine(line);
    const hintHtml = hint ? `<div class="cellHint"><strong>${escapeHtml(hint)}</strong></div>` : '';

    tr.innerHTML = `
      <td>
        <input data-field="producto" type="text" value="${escapeHtml(line.producto)}" placeholder="Producto..." autocomplete="off" />
        ${hintHtml}
      </td>
      <td>
        <select data-field="modo">
          ${buildModeOptions(line.modo)}
        </select>
      </td>
      <td>
        <input data-field="cantidad" type="number" inputmode="decimal" step="0.01" value="${escapeHtml(line.cantidad)}" placeholder="0" />
      </td>
      <td>
        <input data-field="bruto" type="number" inputmode="decimal" step="0.001" value="${escapeHtml(line.bruto)}" placeholder="kg" />
      </td>
      <td>
        <select data-field="envase">
          ${buildTaraOptions(line.envaseId)}
        </select>
      </td>
      <td>
        <input data-field="nenv" type="number" inputmode="decimal" step="0.01" value="${escapeHtml(line.nEnvases)}" placeholder="nº" />
      </td>
      <td>
        <input data-field="tara" type="number" inputmode="decimal" step="0.001" value="${escapeHtml(line.tara)}" placeholder="kg" />
      </td>
      <td>
        <input data-field="neto" type="number" inputmode="decimal" step="0.001" value="${escapeHtml(line.neto)}" placeholder="kg" />
      </td>
      <td>
        <input data-field="precio" type="number" inputmode="decimal" step="0.01" value="${escapeHtml(line.precio)}" placeholder="€" />
      </td>
      <td>
        <input data-field="origen" type="text" value="${escapeHtml(line.origen)}" placeholder="Origen..." />
      </td>
      <td>
        <div class="mono"><b>${escapeHtml(money(line.importe || 0))}</b></div>
        ${hasWarn ? `<div class="cellHint" style="color:#dc2626"><strong>${escapeHtml(warn[0])}</strong></div>` : ''}
      </td>
      <td>
        <button class="delBtn" type="button" data-del="${escapeHtml(line.id)}">✕</button>
      </td>
    `;

    return tr;
  }

  function renderLines(){
    const body = $('#linesBody');
    if(!body) return;
    ensureLines(5);

    // recalcular antes de pintar (para que importe se vea)
    CUR.lines.forEach(recalcLine);

    body.innerHTML = '';
    CUR.lines.forEach((line, idx) => {
      body.appendChild(renderLineRow(line, idx));
    });

    // Bind inputs
    bindLineEvents();

    // Bind delete
    $$('button[data-del]').forEach(btn => {
      on(btn, 'click', () => {
        const id = btn.getAttribute('data-del');
        deleteLine(id);
      });
    });
  }

  APP.renderLines = renderLines;

  function deleteLine(id){
    const idx = CUR.lines.findIndex(l => l.id === id);
    if(idx < 0) return;
    CUR.lines.splice(idx, 1);
    if(CUR.lines.length === 0) ensureLines(5);
    renderLines();
    refreshInvoiceTotals();
    renderQR();
  }

  function addLine(){
    CUR.lines.push(blankLine());
    renderLines();
    refreshInvoiceTotals();
    renderQR();
    // enfoca producto de la nueva línea
    setTimeout(() => {
      const last = CUR.lines[CUR.lines.length-1];
      const inp = $(`tr[data-lineid="${last.id}"] input[data-field="producto"]`);
      inp && inp.focus();
    }, 0);
  }
  APP.addLine = addLine;

  function resetLines(){
    CUR.lines = [];
    ensureLines(5);
    renderLines();
    refreshInvoiceTotals();
    renderQR();
  }

  function focusFirstProduct(){
    ensureLines(5);
    setTimeout(() => {
      const first = CUR.lines[0];
      const inp = $(`tr[data-lineid="${first.id}"] input[data-field="producto"]`);
      inp && inp.focus();
    }, 0);
  }
  APP.focusFirstProduct = focusFirstProduct;

  /* =========================
     CÁLCULOS (CORRECTOS)
  ========================= */
  function getAutoNEnvases(line){
    // Recomendación: si modo=caja -> n envases = cantidad (por defecto)
    // En modo kg: normalmente cantidad representa nº envases/cajas para tara por unidad
    const cant = n2(line.cantidad);
    if(cant > 0) return cant;
    return 0;
  }

  function recalcLine(line){
    line._warnings = [];

    const modo = (line.modo || 'kg');
    const cant = n2(line.cantidad);
    const bruto = n2(line.bruto);
    const precio = n2(line.precio);

    // producto -> defaults (no forzamos, solo si vacío)
    const prod = findProductByName(line.producto);
    line._prodId = prod ? prod.id : '';

    // Si origen vacío y hay producto con origen, sugerir (sin machacar si ya hay)
    if(prod && !line.origen) line.origen = (prod.origen || '');

    // Si envase vacío y producto tiene envase por defecto, sugerir (sin machacar si ya hay)
    if(prod && !line.envaseId) line.envaseId = (prod.envaseDefaultId || '');

    // Si precio vacío y producto tiene precio default del modo, sugerir (sin machacar si ya hay)
    if(prod && (line.precio === '' || line.precio === null || line.precio === undefined)){
      const pr = getDefaultPriceForMode(prod, modo);
      if(pr !== '' && pr !== null && pr !== undefined) line.precio = pr;
    }

    // Envases
    let nEnv = n2(line.nEnvases);
    // Autorelleno recomendado: si modo=caja -> n envases = cantidad
    // y también en modo kg si el usuario no puso nEnvases
    if((modo === 'caja' || modo === 'kg') && (!line.nEnvases || nEnv === 0)){
      const auto = getAutoNEnvases(line);
      if(auto > 0){
        nEnv = auto;
        line.nEnvases = String(auto);
      }
    }

    // Tara auto por envase
    const taraObj = line.envaseId ? findTaraById(line.envaseId) : null;
    const taraUnit = taraObj ? n2(taraObj.peso) : 0;
    const taraAuto = nEnv * taraUnit;

    // Tara final
    let taraTotal = 0;
    if(line.taraManual){
      taraTotal = n2(line.tara);
    }else{
      // si hay envase, aplica auto; si no hay envase, respeta lo escrito (si existe) pero no marca manual
      taraTotal = taraObj ? taraAuto : n2(line.tara);
      // reflejar en input si envase seleccionado
      if(taraObj){
        line.tara = taraTotal ? String(+taraTotal.toFixed(3)) : '';
      }
    }

    // Neto
    let neto = 0;

    if(modo === 'kg'){
      if(line.netoManual){
        neto = n2(line.neto);
      }else{
        neto = bruto - taraTotal;
        line.neto = neto ? String(+neto.toFixed(3)) : (bruto || taraTotal ? String(+neto.toFixed(3)) : '');
      }
      // Importe = Neto × Precio/kg
      line.importe = neto * precio;
    }
    else if(modo === 'caja'){
      // Importe = Cantidad × Precio/caja
      line.importe = cant * precio;

      // Neto informativo si hay kg/caja y no neto manual
      const kgCaja = getKgCaja(prod);
      if(!line.netoManual){
        const netInf = kgCaja > 0 ? (cant * kgCaja) : 0;
        line.neto = netInf ? String(+netInf.toFixed(3)) : '';
      }
      // Tara en caja normalmente no afecta importe, pero se mantiene por si quiere (no recalculamos neto con tara en caja)
      neto = n2(line.neto);
    }
    else if(modo === 'ud'){
      // Importe = Cantidad × Precio/ud
      line.importe = cant * precio;
      // Neto no aplica
      if(!line.netoManual) line.neto = '';
      neto = n2(line.neto);
    }

    // Validaciones recomendadas
    if(modo === 'kg'){
      if(taraTotal > bruto && bruto > 0) line._warnings.push('Tara > Bruto');
      if(neto > bruto && bruto > 0) line._warnings.push('Neto > Bruto');
      if(line.producto && (!line.precio && line.precio !== 0)) line._warnings.push('Falta precio');
    }else{
      if(line.producto && (!line.precio && line.precio !== 0)) line._warnings.push('Falta precio');
    }

    return line;
  }

  /* =========================
     BIND LINE EVENTS + ENTER FLOW
  ========================= */
  function nextField(currentField){
    const idx = FIELD_ORDER.indexOf(currentField);
    if(idx < 0) return null;
    return FIELD_ORDER[idx+1] || null;
  }
  function focusNextInRow(row, field){
    const next = nextField(field);
    if(next){
      const el = row.querySelector(`[data-field="${next}"]`);
      if(el){ el.focus(); el.select && el.select(); return true; }
      return false;
    }
    // si no hay siguiente => crea línea y enfoca producto
    addLine();
    return true;
  }

  function bindLineEvents(){
    const rows = $$('#linesBody tr[data-lineid]');
    rows.forEach(row => {
      const lineId = row.getAttribute('data-lineid');
      const line = CUR.lines.find(l => l.id === lineId);
      if(!line) return;

      const prodInp = row.querySelector('input[data-field="producto"]');
      const modoSel = row.querySelector('select[data-field="modo"]');
      const cantInp = row.querySelector('input[data-field="cantidad"]');
      const brutoInp = row.querySelector('input[data-field="bruto"]');
      const envSel = row.querySelector('select[data-field="envase"]');
      const nenvInp = row.querySelector('input[data-field="nenv"]');
      const taraInp = row.querySelector('input[data-field="tara"]');
      const netoInp = row.querySelector('input[data-field="neto"]');
      const precioInp = row.querySelector('input[data-field="precio"]');
      const origenInp = row.querySelector('input[data-field="origen"]');

      // Producto typing -> autocomplete manual
      on(prodInp, 'input', () => {
        line.producto = prodInp.value;
        // no sustituimos automático
        openSuggest(prodInp, lineId);
        recalcLine(line);
        refreshInvoiceTotals();
        renderQR();
      });

      on(prodInp, 'focus', () => {
        if(prodInp.value) openSuggest(prodInp, lineId);
      });

      on(prodInp, 'blur', () => {
        // cerrar con delay por mousedown selection
        setTimeout(() => {
          if(document.activeElement && $('#suggestBox')?.contains(document.activeElement)) return;
          closeSuggest();
        }, 120);
      });

      on(prodInp, 'keydown', (e) => {
        if(SUG.open && SUG.lineId === lineId){
          if(e.key === 'ArrowDown'){ e.preventDefault(); moveSuggest(+1); return; }
          if(e.key === 'ArrowUp'){ e.preventDefault(); moveSuggest(-1); return; }
          if(e.key === 'Enter'){
            e.preventDefault();
            selectSuggestion(SUG.index);
            // después avanzamos
            setTimeout(() => focusNextInRow(row, 'producto'), 0);
            return;
          }
          if(e.key === 'Escape'){
            e.preventDefault();
            closeSuggest();
            return;
          }
        }
        if(e.key === 'Enter'){
          e.preventDefault();
          focusNextInRow(row, 'producto');
        }
      });

      // Modo
      on(modoSel, 'change', () => {
        line.modo = modoSel.value;
        line._modoTouched = true;

        // al cambiar modo, si precio vacío, poner default del producto (si existe)
        const prod = findProductByName(line.producto);
        if(prod && (!line.precio || line.precio === '')){
          const pr = getDefaultPriceForMode(prod, line.modo);
          if(pr !== '' && pr !== null && pr !== undefined){
            line.precio = pr;
            precioInp.value = pr;
          }
        }

        // Ajustes de campos manuales
        // si cambia a kg y neto estaba vacío, quitamos netoManual
        if(line.modo === 'kg' && (!line.neto || line.neto === '')) line.netoManual = false;

        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(modoSel, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'modo'); }
      });

      // Cantidad
      on(cantInp, 'input', () => {
        line.cantidad = cantInp.value;
        // si modo kg/caja y nEnvases vacío, auto
        if((line.modo === 'kg' || line.modo === 'caja') && (!line.nEnvases || n2(line.nEnvases)===0)){
          const auto = getAutoNEnvases(line);
          if(auto > 0){
            line.nEnvases = String(auto);
            nenvInp.value = String(auto);
          }
        }
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(cantInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'cantidad'); }
      });

      // Bruto
      on(brutoInp, 'input', () => {
        line.bruto = brutoInp.value;
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(brutoInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'bruto'); }
      });

      // Envase
      on(envSel, 'change', () => {
        line.envaseId = envSel.value;
        // si selecciona envase, tara vuelve a auto
        line.taraManual = false;

        // autorelleno recomendado
        if((line.modo === 'kg' || line.modo === 'caja') && (!line.nEnvases || n2(line.nEnvases)===0)){
          const auto = getAutoNEnvases(line);
          if(auto > 0){
            line.nEnvases = String(auto);
            nenvInp.value = String(auto);
          }
        }

        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(envSel, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'envase'); }
      });

      // Nº envases
      on(nenvInp, 'input', () => {
        line.nEnvases = nenvInp.value;
        line.taraManual = false; // si hay envase, recalcula tara
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(nenvInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'nenv'); }
      });

      // Tara (manual)
      on(taraInp, 'input', () => {
        line.tara = taraInp.value;
        // si usuario escribe, pasa a manual
        line.taraManual = true;
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(taraInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'tara'); }
      });

      // Neto (manual si usuario edita)
      on(netoInp, 'input', () => {
        line.neto = netoInp.value;
        line.netoManual = true;
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(netoInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'neto'); }
      });

      // Precio
      on(precioInp, 'input', () => {
        line.precio = precioInp.value;
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(precioInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'precio'); }
      });

      // Origen
      on(origenInp, 'input', () => {
        line.origen = origenInp.value;
        recalcLine(line);
        renderLines();
        refreshInvoiceTotals();
        renderQR();
      });
      on(origenInp, 'keydown', (e) => {
        if(e.key === 'Enter'){ e.preventDefault(); focusNextInRow(row, 'origen'); }
      });

      // Reposicionar suggest al scroll/resize
      const gridWrap = $('#gridWrap');
      if(gridWrap){
        on(gridWrap, 'scroll', () => {
          if(SUG.open && SUG.anchor) positionSuggestBox(SUG.anchor);
        }, { passive:true });
      }
      on(window, 'resize', () => {
        if(SUG.open && SUG.anchor) positionSuggestBox(SUG.anchor);
      }, { passive:true });
    });
  }

  /* =========================
     CLIENTE EN FACTURA (selector + edición inline)
  ========================= */
  function loadClienteToInvoice(clienteId){
    CUR.clienteId = clienteId || '';
    const c = (DB.clientes || []).find(x => x.id === clienteId) || null;

    if(!c){
      // limpiar
      if($('#cliNombre')) $('#cliNombre').value = '';
      if($('#cliNif')) $('#cliNif').value = '';
      if($('#cliDir')) $('#cliDir').value = '';
      if($('#cliTel')) $('#cliTel').value = '';
      if($('#cliEmail')) $('#cliEmail').value = '';
      if($('#cliPago')) $('#cliPago').value = '';
      if($('#cliNotas')) $('#cliNotas').value = '';
      if($('#cliIvaIncl')) $('#cliIvaIncl').checked = false;
      if($('#cliTransDefault')) $('#cliTransDefault').checked = false;
      return;
    }

    if($('#cliNombre')) $('#cliNombre').value = c.nombre || '';
    if($('#cliNif')) $('#cliNif').value = c.nif || '';
    if($('#cliDir')) $('#cliDir').value = c.dir || '';
    if($('#cliTel')) $('#cliTel').value = c.tel || '';
    if($('#cliEmail')) $('#cliEmail').value = c.email || '';
    if($('#cliPago')) $('#cliPago').value = c.tpl?.pago || c.pago || '';
    if($('#cliNotas')) $('#cliNotas').value = c.notas || c.tpl?.notasStd || '';

    // Plantillas
    if($('#cliIvaIncl')) $('#cliIvaIncl').checked = !!c.tpl?.ivaIncl;
    if($('#cliTransDefault')) $('#cliTransDefault').checked = !!c.tpl?.trans;

    // Aplicar plantillas a factura (sin forzar si usuario ya eligió)
    if(!CUR.tags && c.tpl?.tags){
      CUR.tags = c.tpl.tags;
      if($('#factTags')) $('#factTags').value = CUR.tags;
    }
    if(!CUR.obs && c.tpl?.notasStd){
      // notasStd aquí puede ser texto estándar; lo ponemos en obs si estaba vacío
      CUR.obs = c.tpl.notasStd;
      if($('#factObs')) $('#factObs').value = CUR.obs;
    }

    // IVA incluido y transporte por defecto
    if($('#chkIvaIncl')){
      const curChecked = !!$('#chkIvaIncl').checked;
      if(!curChecked && c.tpl?.ivaIncl){
        $('#chkIvaIncl').checked = true;
        CUR.ivaIncl = true;
      }
    }
    if($('#chkTransporte')){
      const curChecked = !!$('#chkTransporte').checked;
      if(!curChecked && c.tpl?.trans){
        $('#chkTransporte').checked = true;
        CUR.transporte = true;
      }
    }

    refreshInvoiceTotals();
    renderQR();
  }

  function snapshotClienteFromUI(){
    return {
      nombre: String($('#cliNombre')?.value || '').trim(),
      nif: String($('#cliNif')?.value || '').trim(),
      dir: String($('#cliDir')?.value || '').trim(),
      tel: String($('#cliTel')?.value || '').trim(),
      email: String($('#cliEmail')?.value || '').trim(),
      pago: String($('#cliPago')?.value || '').trim()
    };
  }

  function newClienteInline(){
    CUR.clienteId = '';
    if($('#clienteSelect')) $('#clienteSelect').value = '';
    if($('#cliNombre')) $('#cliNombre').value = '';
    if($('#cliNif')) $('#cliNif').value = '';
    if($('#cliDir')) $('#cliDir').value = '';
    if($('#cliTel')) $('#cliTel').value = '';
    if($('#cliEmail')) $('#cliEmail').value = '';
    if($('#cliPago')) $('#cliPago').value = '';
    if($('#cliNotas')) $('#cliNotas').value = '';
    if($('#cliIvaIncl')) $('#cliIvaIncl').checked = false;
    if($('#cliTransDefault')) $('#cliTransDefault').checked = false;
    APP.toast('Cliente', 'Nuevo (rellena y guarda)');
  }

  function saveClienteInline(){
    const nombre = String($('#cliNombre')?.value || '').trim();
    if(!nombre){
      APP.toast('Cliente', 'Falta nombre');
      return;
    }

    const isNew = !CUR.clienteId;
    let c = null;

    if(isNew){
      c = {
        id: uid(),
        nombre,
        alias: '',
        nif: String($('#cliNif')?.value || '').trim(),
        dir: String($('#cliDir')?.value || '').trim(),
        tel: String($('#cliTel')?.value || '').trim(),
        email: String($('#cliEmail')?.value || '').trim(),
        notas: String($('#cliNotas')?.value || '').trim(),
        tpl: {
          ivaIncl: !!$('#cliIvaIncl')?.checked,
          trans: !!$('#cliTransDefault')?.checked,
          pago: String($('#cliPago')?.value || '').trim(),
          tags: '',
          notasStd: ''
        }
      };
      DB.clientes.unshift(c);
      CUR.clienteId = c.id;
    }else{
      c = (DB.clientes || []).find(x => x.id === CUR.clienteId) || null;
      if(!c){
        APP.toast('Cliente', 'No encontrado');
        return;
      }
      c.nombre = nombre;
      c.nif = String($('#cliNif')?.value || '').trim();
      c.dir = String($('#cliDir')?.value || '').trim();
      c.tel = String($('#cliTel')?.value || '').trim();
      c.email = String($('#cliEmail')?.value || '').trim();
      c.notas = String($('#cliNotas')?.value || '').trim();
      c.tpl = c.tpl || {};
      c.tpl.ivaIncl = !!$('#cliIvaIncl')?.checked;
      c.tpl.trans = !!$('#cliTransDefault')?.checked;
      c.tpl.pago = String($('#cliPago')?.value || '').trim();
    }

    localStorage.setItem('fm_clientes_v1', JSON.stringify(DB.clientes));
    APP.fillClienteSelect?.();
    if($('#clienteSelect')) $('#clienteSelect').value = CUR.clienteId;

    APP.toast('Cliente', isNew ? 'Creado' : 'Actualizado');
    refreshInvoiceTotals();
    renderQR();
  }

  /* =========================
     FACTURA: HEADER INPUTS
  ========================= */
  function bindInvoiceHeader(){
    on($('#factFecha'), 'change', () => {
      CUR.fechaISO = $('#factFecha')?.value || isoDate(new Date());
      renderQR();
    });

    on($('#factTags'), 'input', () => {
      CUR.tags = $('#factTags')?.value || '';
    });

    on($('#factNotas'), 'input', () => {
      CUR.notas = $('#factNotas')?.value || '';
    });

    on($('#factObs'), 'input', () => {
      CUR.obs = $('#factObs')?.value || '';
    });

    on($('#factEstado'), 'change', () => {
      CUR.estado = $('#factEstado')?.value || 'impagada';
    });

    on($('#factMetodoPago'), 'change', () => {
      CUR.metodoPago = $('#factMetodoPago')?.value || '';
    });

    // Cliente selector
    on($('#clienteSelect'), 'change', () => {
      const id = $('#clienteSelect')?.value || '';
      loadClienteToInvoice(id);
    });

    on($('#btnClienteNuevo'), 'click', newClienteInline);
    on($('#btnClienteGuardar'), 'click', saveClienteInline);

    // IVA incluido checkbox (factura)
    on($('#chkIvaIncl'), 'change', () => {
      CUR.ivaIncl = !!$('#chkIvaIncl')?.checked;
      refreshInvoiceTotals();
      renderQR();
    });

    // Transporte checkbox
    on($('#chkTransporte'), 'change', () => {
      CUR.transporte = !!$('#chkTransporte')?.checked;
      refreshInvoiceTotals();
      renderQR();
    });

    // Botón añadir 4% IVA al total
    on($('#btnAddIva4'), 'click', () => {
      // fuerza IVA normal (no incluido) y % = 4
      const s = DB.ajustes || {};
      s.ivaPct = 4;
      DB.ajustes = s;
      localStorage.setItem('fm_ajustes_v1', JSON.stringify(DB.ajustes));

      if($('#setIvaPct')) $('#setIvaPct').value = 4;
      if($('#ivaPctPill')) setText($('#ivaPctPill'), '4%');

      if($('#chkIvaIncl')) $('#chkIvaIncl').checked = false;
      CUR.ivaIncl = false;

      refreshInvoiceTotals();
      renderQR();
      APP.toast('IVA', 'Aplicado 4% (no incluido)');
    });

    // Grid buttons
    on($('#btnAddLinea'), 'click', addLine);
    on($('#btnVaciarLineas'), 'click', resetLines);

    // Acciones factura
    on($('#btnNuevaFactura'), 'click', () => {
      newInvoice();
    });
    on($('#btnDuplicarFactura'), 'click', () => {
      duplicateInvoice();
    });
    on($('#btnEliminarFactura'), 'click', async () => {
      const ok = await APP.confirmBox('Eliminar factura', '¿Eliminar esta factura?');
      if(ok) deleteCurrentInvoice();
    });
    on($('#btnGuardarFactura'), 'click', () => {
      saveCurrentInvoice();
    });

    // PDF / WhatsApp (3C implementa)
    on($('#btnGenPDF'), 'click', () => APP.generatePDF?.());
    on($('#btnVerPDF'), 'click', () => APP.openPdfViewer?.());
    on($('#btnPdfCloud'), 'click', () => APP.pdfToCloud?.());
    on($('#btnWhats'), 'click', () => APP.shareWhatsApp?.());

    // Copiar QR
    on($('#btnCopyQR'), 'click', async () => {
      try{
        const txt = APP.qrText || '';
        await navigator.clipboard.writeText(txt);
        APP.toast('QR', 'Texto QR copiado');
      }catch{
        APP.toast('QR', 'No se pudo copiar');
      }
    });
  }

  /* =========================
     PAGOS
  ========================= */
  function renderPagos(){
    const wrap = $('#payList');
    if(!wrap) return;
    wrap.innerHTML = '';

    const pagos = Array.isArray(CUR.pagos) ? CUR.pagos : [];
    if(!pagos.length){
      wrap.innerHTML = `<div class="payItem"><div class="payMeta"><div class="payMain">Sin pagos</div><div class="paySub">Añade pagos parciales si aplica</div></div></div>`;
      return;
    }

    pagos.forEach(p => {
      const tr = document.createElement('div');
      tr.className = 'payItem';
      const dt = p.fecha ? ddmmyyyy(new Date(p.fecha)) : '';
      tr.innerHTML = `
        <div class="payMeta">
          <div class="payMain">${escapeHtml(money(p.importe))}</div>
          <div class="paySub">${escapeHtml(dt)}</div>
        </div>
        <div class="payActions">
          <button class="payDel" type="button" data-paydel="${escapeHtml(p.id)}">Eliminar</button>
        </div>
      `;
      wrap.appendChild(tr);
    });

    $$('[data-paydel]').forEach(btn => {
      on(btn,'click', () => {
        const id = btn.getAttribute('data-paydel');
        const idx = CUR.pagos.findIndex(x => x.id === id);
        if(idx >= 0){
          CUR.pagos.splice(idx,1);
          renderPagos();
          refreshInvoiceTotals();
          renderQR();
        }
      });
    });
  }

  function addPagoFromForm(){
    const imp = n2($('#pagoImporte')?.value);
    const fecha = ($('#pagoFecha')?.value || '').trim() || isoDate(new Date());

    if(!(imp > 0)){
      APP.toast('Pagos', 'Importe inválido');
      return;
    }
    if(!Array.isArray(CUR.pagos)) CUR.pagos = [];
    CUR.pagos.unshift({ id: uid(), importe: imp, fecha });

    // reset form
    if($('#pagoImporte')) $('#pagoImporte').value = '';
    if($('#pagoFecha')) $('#pagoFecha').value = isoDate(new Date());

    renderPagos();
    refreshInvoiceTotals();
    renderQR();
  }

  /* =========================
     TOTALES + PENDIENTE
  ========================= */
  function calcSubtotal(){
    let s = 0;
    for(const l of (CUR.lines||[])){
      const hasAny = normName(l.producto) || n2(l.cantidad) || n2(l.bruto) || n2(l.precio);
      if(!hasAny) continue;
      s += n2(l.importe);
    }
    return s;
  }

  function calcTransporte(subtotal){
    if(!CUR.transporte) return 0;
    const pct = n2(DB.ajustes?.transPct);
    return subtotal * (pct/100);
  }

  function calcIVA(base){
    if(CUR.ivaIncl) return 0;
    const pct = n2(DB.ajustes?.ivaPct);
    return base * (pct/100);
  }

  function calcPagado(){
    return (CUR.pagos||[]).reduce((a,p)=>a+n2(p.importe), 0);
  }

  function refreshInvoiceTotals(){
    // recalcula líneas primero
    (CUR.lines||[]).forEach(recalcLine);

    const subtotal = calcSubtotal();
    const trans = calcTransporte(subtotal);
    const base = subtotal + trans;
    const iva = calcIVA(base);
    const total = base + iva;
    const pagado = calcPagado();
    const pendiente = total - pagado;

    setText($('#tSubtotal'), money(subtotal));
    setText($('#tTransporte'), money(trans));
    setText($('#tIva'), money(iva));
    setText($('#tTotal'), money(total));
    setText($('#tPendiente'), money(pendiente));

    // warning general
    const warns = (CUR.lines||[]).some(l => (l._warnings||[]).length);
    const missingCritical = (CUR.lines||[]).some(l => {
      const hasAny = normName(l.producto) || n2(l.cantidad) || n2(l.bruto) || n2(l.precio);
      if(!hasAny) return false;
      // si hay producto, precio recomendado
      if(normName(l.producto) && (l.precio === '' || l.precio === null || l.precio === undefined)) return true;
      return false;
    });
    if(warns || missingCritical) show($('#gridWarn')); else hide($('#gridWarn'));

    APP.subtotal = subtotal;
    APP.transporte = trans;
    APP.iva = iva;
    APP.total = total;
    APP.pendiente = pendiente;
  }
  APP.refreshInvoiceTotals = refreshInvoiceTotals;

  /* =========================
     QR (AEAT / fallback texto)
     - si falla => no se muestra + se marca APP.qrOk=false
  ========================= */
  function buildQRText(){
    const nif = String($('#provNif')?.value || DB.prov?.nif || '').trim();
    const num = String(CUR.num || '').trim();
    const fecha = String(CUR.fechaISO || '').trim();
    const total = n2(APP.total);

    const hasAll = !!(nif && num && fecha && total > 0);
    if(!hasAll) return { ok:false, text:'' };

    const tpl = String(DB.ajustes?.qrBase || 'NIF={NIF};F={NUM};FECHA={FECHA};TOTAL={TOTAL}');
    const txt = tpl
      .replaceAll('{NIF}', nif)
      .replaceAll('{NUM}', num)
      .replaceAll('{FECHA}', fecha)
      .replaceAll('{TOTAL}', total.toFixed(2));

    return { ok:true, text: txt };
  }

  function clearQR(){
    const wrap = $('#qrWrap');
    if(wrap) wrap.innerHTML = '';
  }

  function renderQR(){
    const qrWarn = $('#qrWarn');
    const small = $('#qrTextSmall');
    const wrap = $('#qrWrap');

    const { ok, text } = buildQRText();
    APP.qrOk = ok;
    APP.qrText = text;

    if(!ok){
      if(qrWarn) show(qrWarn);
      if(small) setText(small, '');
      clearQR();
      return;
    }

    if(qrWarn) hide(qrWarn);
    if(small) setText(small, text);

    // Render QR (fallback)
    try{
      if(!wrap) return;
      wrap.innerHTML = '';
      // QRCode lib (qrcodejs)
      // eslint-disable-next-line no-undef
      new QRCode(wrap, {
        text,
        width: 170,
        height: 170,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }catch{
      // Si falla creación QR, NO mostrar (y 3C lo omitirá en PDF)
      APP.qrOk = false;
      APP.qrText = '';
      clearQR();
      if(qrWarn) show(qrWarn);
      if(small) setText(small, '');
    }
  }
  APP.renderQR = renderQR;

  /* =========================
     FACTURA: NUEVA / DUPLICAR / GUARDAR / ELIMINAR
  ========================= */
  function syncHeaderFromUI(){
    CUR.fechaISO = $('#factFecha')?.value || CUR.fechaISO || isoDate(new Date());
    CUR.tags = $('#factTags')?.value || CUR.tags || '';
    CUR.notas = $('#factNotas')?.value || CUR.notas || '';
    CUR.obs = $('#factObs')?.value || CUR.obs || '';
    CUR.estado = $('#factEstado')?.value || CUR.estado || 'impagada';
    CUR.metodoPago = $('#factMetodoPago')?.value || CUR.metodoPago || '';
    CUR.ivaIncl = !!$('#chkIvaIncl')?.checked;
    CUR.transporte = !!$('#chkTransporte')?.checked;
  }

  function snapshotProvider(){
    return {
      nombre: String($('#provNombre')?.value || DB.prov?.nombre || '').trim(),
      nif: String($('#provNif')?.value || DB.prov?.nif || '').trim(),
      dir: String($('#provDir')?.value || DB.prov?.dir || '').trim(),
      tel: String($('#provTel')?.value || DB.prov?.tel || '').trim(),
      email: String($('#provEmail')?.value || DB.prov?.email || '').trim()
    };
  }

  function sanitizeLinesForSave(){
    const out = [];
    for(const l of (CUR.lines||[])){
      const hasAny = normName(l.producto) || n2(l.cantidad) || n2(l.bruto) || n2(l.precio) || n2(l.importe);
      if(!hasAny) continue;
      out.push({
        id: l.id,
        producto: normName(l.producto).toUpperCase(),
        modo: l.modo || 'kg',
        cantidad: l.cantidad,
        bruto: l.bruto,
        envaseId: l.envaseId || '',
        nEnvases: l.nEnvases,
        tara: l.tara,
        taraManual: !!l.taraManual,
        neto: l.neto,
        netoManual: !!l.netoManual,
        precio: l.precio,
        origen: l.origen,
        importe: n2(l.importe)
      });
    }
    return out;
  }

  function updateProductHistoryFromInvoice(lines){
    // Guarda historial últimas 5 veces, SOLO pantalla
    const now = new Date().toISOString();
    for(const l of lines){
      const prod = findProductByName(l.producto);
      if(!prod) continue;
      const modo = l.modo || 'kg';
      const valor = String(l.precio ?? '').trim();
      if(!valor) continue;

      if(!Array.isArray(prod.hist)) prod.hist = [];
      // evita repetidos consecutivos iguales
      const top = prod.hist[0];
      if(top && top.modo === modo && String(top.valor) === valor){
        top.fecha = now;
      }else{
        prod.hist.unshift({ modo, valor, fecha: now });
      }
      prod.hist = prod.hist.slice(0, 5);
    }
    localStorage.setItem('fm_productos_v1', JSON.stringify(DB.productos));
  }

  function saveCurrentInvoice(){
    syncHeaderFromUI();
    refreshInvoiceTotals();
    renderQR();

    // snapshot cliente
    CUR.clienteSnap = snapshotClienteFromUI();

    // proveedor snapshot
    const provSnap = snapshotProvider();

    // líneas
    const lines = sanitizeLinesForSave();

    // validación mínima opcional (sin bloquear totalmente, pero avisar)
    if(!lines.length){
      APP.toast('Factura', 'No hay líneas');
      return;
    }

    // Estado pagos
    const total = n2(APP.total);
    const pagado = calcPagado();
    if(pagado <= 0) CUR.estado = 'impagada';
    else if(pagado >= total) CUR.estado = 'pagada';
    else CUR.estado = 'parcial';
    if($('#factEstado')) $('#factEstado').value = CUR.estado;

    const now = Date.now();
    const facturaObj = {
      id: CUR.id || uid(),
      num: CUR.num,
      fechaISO: CUR.fechaISO,
      tags: CUR.tags || '',
      notas: CUR.notas || '',
      obs: CUR.obs || '',
      clienteId: CUR.clienteId || '',
      clienteSnap: CUR.clienteSnap || null,
      provSnap,
      estado: CUR.estado || 'impagada',
      metodoPago: CUR.metodoPago || '',
      ivaIncl: !!CUR.ivaIncl,
      transporte: !!CUR.transporte,
      ajustes: {
        ivaPct: n2(DB.ajustes?.ivaPct),
        transPct: n2(DB.ajustes?.transPct)
      },
      totales: {
        subtotal: n2(APP.subtotal),
        transporte: n2(APP.transporte),
        iva: n2(APP.iva),
        total: n2(APP.total),
        pagado: n2(pagado),
        pendiente: n2(APP.pendiente)
      },
      pagos: Array.isArray(CUR.pagos) ? CUR.pagos.map(p => ({ id:p.id, importe:n2(p.importe), fecha:p.fecha })) : [],
      lines,
      qr: {
        ok: !!APP.qrOk,
        text: APP.qrText || ''
      },
      updatedAt: now,
      createdAt: now
    };

    // update o insert
    const arr = DB.facturas || [];
    const idx = arr.findIndex(f => f.id === facturaObj.id);
    if(idx >= 0){
      facturaObj.createdAt = arr[idx].createdAt || now;
      arr[idx] = facturaObj;
    }else{
      arr.unshift(facturaObj);
    }
    DB.facturas = arr;
    localStorage.setItem('fm_facturas_v1', JSON.stringify(DB.facturas));

    // price history
    updateProductHistoryFromInvoice(lines);

    // confirma guardado
    CUR.id = facturaObj.id;
    APP.toast('Factura', 'Guardada');

    // refrescos listados
    APP.refreshFacturas?.();
    APP.refreshContabilidad?.();
  }
  APP.saveCurrentInvoice = saveCurrentInvoice;

  function newInvoice(){
    // Mantiene proveedor y ajustes, reinicia factura
    CUR.id = null;
    CUR.num = APP.buildInvoiceNumber ? APP.buildInvoiceNumber(new Date()) : ('FA-' + Date.now());
    CUR.fechaISO = isoDate(new Date());
    CUR.tags = '';
    CUR.notas = '';
    CUR.obs = '';
    CUR.clienteId = '';
    CUR.clienteSnap = null;
    CUR.estado = 'impagada';
    CUR.metodoPago = '';
    CUR.ivaIncl = false;
    CUR.transporte = false;
    CUR.pagos = [];
    CUR.lines = [];

    // UI
    if($('#clienteSelect')) $('#clienteSelect').value = '';
    if($('#factFecha')) $('#factFecha').value = CUR.fechaISO;
    if($('#factTags')) $('#factTags').value = '';
    if($('#factNotas')) $('#factNotas').value = '';
    if($('#factObs')) $('#factObs').value = '';
    if($('#factEstado')) $('#factEstado').value = 'impagada';
    if($('#factMetodoPago')) $('#factMetodoPago').value = '';
    if($('#chkIvaIncl')) $('#chkIvaIncl').checked = false;
    if($('#chkTransporte')) $('#chkTransporte').checked = false;

    // limpiar cliente UI
    loadClienteToInvoice('');

    ensureLines(5);
    renderLines();
    renderPagos();
    APP.setFacturaHeaderUI?.();
    refreshInvoiceTotals();
    renderQR();
    focusFirstProduct();

    APP.toast('Factura', 'Nueva');
  }
  APP.newInvoice = newInvoice;

  function duplicateInvoice(){
    // duplica contenido, cambia id/num/fecha
    syncHeaderFromUI();
    refreshInvoiceTotals();
    renderQR();

    const old = {
      tags: CUR.tags, notas: CUR.notas, obs: CUR.obs,
      clienteId: CUR.clienteId, clienteSnap: snapshotClienteFromUI(),
      estado: CUR.estado, metodoPago: CUR.metodoPago,
      ivaIncl: CUR.ivaIncl, transporte: CUR.transporte,
      pagos: Array.isArray(CUR.pagos) ? CUR.pagos.map(p => ({...p})) : [],
      lines: Array.isArray(CUR.lines) ? CUR.lines.map(l => ({...l, id: uid()})) : []
    };

    CUR.id = null;
    CUR.num = APP.buildInvoiceNumber ? APP.buildInvoiceNumber(new Date()) : ('FA-' + Date.now());
    CUR.fechaISO = isoDate(new Date());
    CUR.tags = old.tags || '';
    CUR.notas = old.notas || '';
    CUR.obs = old.obs || '';
    CUR.clienteId = old.clienteId || '';
    CUR.clienteSnap = old.clienteSnap || null;
    CUR.estado = 'impagada'; // duplicado empieza impagada por defecto
    CUR.metodoPago = old.metodoPago || '';
    CUR.ivaIncl = !!old.ivaIncl;
    CUR.transporte = !!old.transporte;
    CUR.pagos = []; // duplicar sin pagos (recomendado)
    CUR.lines = old.lines || [];

    // UI header
    APP.setFacturaHeaderUI?.();
    if($('#factFecha')) $('#factFecha').value = CUR.fechaISO;
    if($('#factTags')) $('#factTags').value = CUR.tags;
    if($('#factNotas')) $('#factNotas').value = CUR.notas;
    if($('#factObs')) $('#factObs').value = CUR.obs;
    if($('#chkIvaIncl')) $('#chkIvaIncl').checked = CUR.ivaIncl;
    if($('#chkTransporte')) $('#chkTransporte').checked = CUR.transporte;

    // cliente
    if($('#clienteSelect')) $('#clienteSelect').value = CUR.clienteId || '';
    if(CUR.clienteId) loadClienteToInvoice(CUR.clienteId);

    renderLines();
    renderPagos();
    refreshInvoiceTotals();
    renderQR();

    APP.toast('Factura', 'Duplicada (sin pagos)');
  }

  function deleteCurrentInvoice(){
    if(!CUR.id){
      // si no estaba guardada, solo limpia
      newInvoice();
      return;
    }
    const idx = (DB.facturas||[]).findIndex(f => f.id === CUR.id);
    if(idx >= 0){
      DB.facturas.splice(idx,1);
      localStorage.setItem('fm_facturas_v1', JSON.stringify(DB.facturas));
    }
    newInvoice();
    APP.refreshFacturas?.();
    APP.refreshContabilidad?.();
    APP.toast('Factura', 'Eliminada');
  }

  function loadInvoiceById(id){
    const f = (DB.facturas||[]).find(x => x.id === id) || null;
    if(!f){
      APP.toast('Factura', 'No encontrada');
      return;
    }

    CUR.id = f.id;
    CUR.num = f.num;
    CUR.fechaISO = f.fechaISO || isoDate(new Date());
    CUR.tags = f.tags || '';
    CUR.notas = f.notas || '';
    CUR.obs = f.obs || '';
    CUR.clienteId = f.clienteId || '';
    CUR.clienteSnap = f.clienteSnap || null;
    CUR.estado = f.estado || 'impagada';
    CUR.metodoPago = f.metodoPago || '';
    CUR.ivaIncl = !!f.ivaIncl;
    CUR.transporte = !!f.transporte;
    CUR.pagos = Array.isArray(f.pagos) ? f.pagos.map(p => ({ id:p.id||uid(), importe:n2(p.importe), fecha:p.fecha||isoDate(new Date()) })) : [];
    CUR.lines = Array.isArray(f.lines) ? f.lines.map(l => ({
      id: l.id || uid(),
      producto: l.producto || '',
      modo: l.modo || 'kg',
      cantidad: l.cantidad ?? '',
      bruto: l.bruto ?? '',
      envaseId: l.envaseId || '',
      nEnvases: l.nEnvases ?? '',
      tara: l.tara ?? '',
      taraManual: !!l.taraManual,
      neto: l.neto ?? '',
      netoManual: !!l.netoManual,
      precio: l.precio ?? '',
      origen: l.origen ?? '',
      importe: n2(l.importe)
    })) : [];

    // UI header
    APP.setFacturaHeaderUI?.();
    if($('#factFecha')) $('#factFecha').value = CUR.fechaISO;
    if($('#factTags')) $('#factTags').value = CUR.tags;
    if($('#factNotas')) $('#factNotas').value = CUR.notas;
    if($('#factObs')) $('#factObs').value = CUR.obs;
    if($('#factEstado')) $('#factEstado').value = CUR.estado;
    if($('#factMetodoPago')) $('#factMetodoPago').value = CUR.metodoPago;
    if($('#chkIvaIncl')) $('#chkIvaIncl').checked = CUR.ivaIncl;
    if($('#chkTransporte')) $('#chkTransporte').checked = CUR.transporte;

    // Cliente UI
    APP.fillClienteSelect?.();
    if($('#clienteSelect')) $('#clienteSelect').value = CUR.clienteId || '';
    if(CUR.clienteId) loadClienteToInvoice(CUR.clienteId);
    else if(CUR.clienteSnap){
      // si no existe clienteId, pintar snapshot
      if($('#cliNombre')) $('#cliNombre').value = CUR.clienteSnap.nombre || '';
      if($('#cliNif')) $('#cliNif').value = CUR.clienteSnap.nif || '';
      if($('#cliDir')) $('#cliDir').value = CUR.clienteSnap.dir || '';
      if($('#cliTel')) $('#cliTel').value = CUR.clienteSnap.tel || '';
      if($('#cliEmail')) $('#cliEmail').value = CUR.clienteSnap.email || '';
      if($('#cliPago')) $('#cliPago').value = CUR.clienteSnap.pago || '';
    }

    renderLines();
    renderPagos();
    refreshInvoiceTotals();
    renderQR();

    // ir a pestaña factura
    const btnFactura = $('#tabBtnFactura');
    btnFactura && btnFactura.click();

    APP.toast('Factura', 'Cargada para editar');
  }
  APP.loadInvoiceById = loadInvoiceById;

  /* =========================
     WHATSAPP PRO (texto) — 3C puede abrir link
  ========================= */
  function buildWhatsText(){
    syncHeaderFromUI();
    refreshInvoiceTotals();

    const lines = sanitizeLinesForSave();
    const cliente = snapshotClienteFromUI();
    const fecha = CUR.fechaISO ? ddmmyyyy(new Date(CUR.fechaISO+'T00:00:00')) : '';
    const header = [
      `Factura: ${CUR.num || ''}`,
      `Fecha: ${fecha}`,
      `Cliente: ${cliente.nombre || ''}`,
      (CUR.tags ? `Tags: ${CUR.tags}` : ''),
      ''
    ].filter(Boolean).join('\n');

    const body = lines.map(l => {
      const modo = l.modo;
      const cant = l.cantidad;
      const bruto = l.bruto;
      const tara = l.tara;
      const neto = l.neto;
      const precio = l.precio;
      const imp = money(l.importe);

      if(modo === 'kg'){
        return `• ${l.producto} | kg | cant:${cant||''} | bruto:${bruto||''} | tara:${tara||''} | neto:${neto||''} | €/kg:${precio||''} | ${imp}`;
      }
      if(modo === 'caja'){
        return `• ${l.producto} | caja | cant:${cant||''} | €/caja:${precio||''} | ${imp}`;
      }
      return `• ${l.producto} | ud | cant:${cant||''} | €/ud:${precio||''} | ${imp}`;
    }).join('\n');

    const totals = [
      '',
      `Subtotal: ${money(APP.subtotal)}`,
      (CUR.transporte ? `Transporte: ${money(APP.transporte)}` : ''),
      (CUR.ivaIncl ? `IVA: incluido` : `IVA: ${money(APP.iva)}`),
      `TOTAL: ${money(APP.total)}`,
      `Pendiente: ${money(APP.pendiente)}`
    ].filter(Boolean).join('\n');

    return header + body + totals;
  }
  APP.buildWhatsText = buildWhatsText;

  /* =========================
     INIT 3B
  ========================= */
  function init3B(){
    // Estado inicial IVA/transporte
    if($('#chkIvaIncl')) $('#chkIvaIncl').checked = !!CUR.ivaIncl;
    if($('#chkTransporte')) $('#chkTransporte').checked = !!CUR.transporte;

    // fecha pago default
    if($('#pagoFecha') && !$('#pagoFecha').value) $('#pagoFecha').value = isoDate(new Date());

    // bind pago
    on($('#btnGuardarPago'), 'click', addPagoFromForm);
    on($('#pagoImporte'), 'keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addPagoFromForm(); }});

    // binds header/invoice
    bindInvoiceHeader();

    // cliente initial fill
    APP.fillClienteSelect?.();
    if($('#clienteSelect')) $('#clienteSelect').value = CUR.clienteId || '';
    if(CUR.clienteId) loadClienteToInvoice(CUR.clienteId);

    // grid
    ensureLines(5);
    renderLines();

    // pagos
    renderPagos();

    // totals & QR
    refreshInvoiceTotals();
    renderQR();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init3B);
  }else{
    init3B();
  }

})();
/* =========================================================
PARTE 3C/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3C: listado facturas + CRUD clientes/productos/taras + contabilidad + PDF PRO multipágina + visor PDF + WhatsApp + Cloud opcional Firebase
- NO ACORTAR / NO QUITAR FUNCIONES
========================================================= */

(() => {
  'use strict';

  const APP = (window.FACTU_MIRAL = window.FACTU_MIRAL || {});
  APP.VERSION = (APP.VERSION || '') + ' + 3C';

  /* =========================
     HELPERS
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const setText = (el, t) => { if (el) el.textContent = (t ?? ''); };
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  function n2(x){
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  }

  const fmtMoney = new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' });
  const fmtNum = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
  function money(x){ return fmtMoney.format(n2(x)); }
  function num(x){ return fmtNum.format(n2(x)); }

  function pad2(n){ n = Number(n)||0; return (n<10?'0':'') + n; }
  function isoDate(d){
    const dt = d instanceof Date ? d : new Date(d);
    return dt.getFullYear() + '-' + pad2(dt.getMonth()+1) + '-' + pad2(dt.getDate());
  }
  function ddmmyyyy(d){
    const dt = d instanceof Date ? d : new Date(d);
    return pad2(dt.getDate()) + '/' + pad2(dt.getMonth()+1) + '/' + dt.getFullYear();
  }
  function uid(){
    return 'id_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }
  function norm(s){ return (s ?? '').toString().trim(); }

  const DB = APP.DB;
  const CUR = APP.CUR;

  /* =========================
     KEYS (mismos de 3A)
  ========================= */
  const K = {
    PROV:   'fm_proveedor_v1',
    CLIENT: 'fm_clientes_v1',
    PROD:   'fm_productos_v1',
    TARAS:  'fm_taras_v1',
    FACT:   'fm_facturas_v1',
    SET:    'fm_ajustes_v1',
    VENTAS: 'fm_ventas_v1'
  };

  function saveKey(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
  }
  function loadKey(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      const v = JSON.parse(raw);
      return (v ?? fallback);
    }catch{
      return fallback;
    }
  }

  /* =========================
     FINDERS
  ========================= */
  function findClienteById(id){
    return (DB.clientes || []).find(c => c.id === id) || null;
  }
  function findProductoById(id){
    return (DB.productos || []).find(p => p.id === id) || null;
  }
  function findProductoByName(name){
    const key = norm(name).toUpperCase();
    if(!key) return null;
    return (DB.productos || []).find(p => (p.nombre||'').toUpperCase() === key) || null;
  }
  function findTaraById(id){
    return (DB.taras || []).find(t => t.id === id) || null;
  }
  function safeTabClick(tabId){
    const btn = $(`.tab[data-tab="${tabId}"]`);
    btn && btn.click();
  }

  /* =========================
     PDF STATE / VIEWER
  ========================= */
  APP._pdf = APP._pdf || {
    blob: null,
    url: '',
    facturaId: '',
    createdAt: 0
  };

  function openModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.setAttribute('aria-hidden','false');
  }
  function closeModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.setAttribute('aria-hidden','true');
  }

  function setPdfViewerSrc(url){
    const frame = $('#pdfFrame');
    if(frame) frame.src = url || 'about:blank';
  }

  function revokePdfUrl(){
    try{
      if(APP._pdf.url) URL.revokeObjectURL(APP._pdf.url);
    }catch{}
    APP._pdf.url = '';
    APP._pdf.blob = null;
    APP._pdf.facturaId = '';
    APP._pdf.createdAt = 0;
  }

  function openPdfViewer(){
    if(!APP._pdf.url){
      APP.toast('PDF', 'Genera el PDF primero');
      return;
    }
    setPdfViewerSrc(APP._pdf.url);
    openModal('pdfModal');
  }
  APP.openPdfViewer = openPdfViewer;

  function closePdfViewer(){
    setPdfViewerSrc('about:blank');
    closeModal('pdfModal');
  }

  /* =========================
     WhatsApp
  ========================= */
  function shareWhatsApp(){
    const txt = APP.buildWhatsText ? APP.buildWhatsText() : '';
    if(!txt){
      APP.toast('WhatsApp', 'No hay contenido');
      return;
    }
    const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url, '_blank', 'noopener');
  }
  APP.shareWhatsApp = shareWhatsApp;

  /* =========================
     FACTURAS LISTADO + BÚSQUEDA
  ========================= */
  function facturaMatchesSearch(f, q){
    const s = (q||'').toLowerCase().trim();
    if(!s) return true;
    const num = (f.num||'').toLowerCase();
    const cli = (f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '').toLowerCase();
    const tags = (f.tags||'').toLowerCase();
    const fecha = (f.fechaISO||'').toLowerCase();
    return num.includes(s) || cli.includes(s) || tags.includes(s) || fecha.includes(s);
  }

  function renderFacturasTable(rows){
    const body = $('#factListBody');
    if(!body) return;
    body.innerHTML = '';

    if(!rows.length){
      body.innerHTML = `<tr><td colspan="8"><div class="emptyState">Sin facturas</div></td></tr>`;
      return;
    }

    rows.forEach(f => {
      const dt = f.fechaISO ? ddmmyyyy(new Date(f.fechaISO+'T00:00:00')) : '';
      const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '(sin cliente)';
      const total = f.totales?.total ?? 0;
      const pend = f.totales?.pendiente ?? (f.totales?.total ?? 0);
      const st = f.estado || 'impagada';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>${escapeHtml(f.num||'')}</b><div class="mini">${escapeHtml(dt)}</div></td>
        <td>${escapeHtml(cli)}</td>
        <td>${escapeHtml(f.tags||'')}</td>
        <td><b>${escapeHtml(money(total))}</b><div class="mini">Pend: ${escapeHtml(money(pend))}</div></td>
        <td><span class="pill pill-${escapeHtml(st)}">${escapeHtml(st)}</span></td>
        <td class="mono">${escapeHtml(f.metodoPago||'')}</td>
        <td>
          <div class="tableBtns">
            <button class="linkBtn" type="button" data-fedit="${escapeHtml(f.id)}">Editar</button>
            <button class="linkBtn" type="button" data-fpdf="${escapeHtml(f.id)}">Ver PDF</button>
          </div>
        </td>
        <td>
          <div class="tableBtns">
            <button class="linkBtn danger" type="button" data-fdel="${escapeHtml(f.id)}">Eliminar</button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });

    // bind
    $$('[data-fedit]').forEach(btn => {
      on(btn,'click', () => {
        const id = btn.getAttribute('data-fedit');
        APP.loadInvoiceById && APP.loadInvoiceById(id);
        safeTabClick('tabFactura');
      });
    });
    $$('[data-fpdf]').forEach(btn => {
      on(btn,'click', async () => {
        const id = btn.getAttribute('data-fpdf');
        // si hay url en nube, abre en visor
        const f = (DB.facturas||[]).find(x => x.id === id) || null;
        if(f && f.pdfUrl){
          revokePdfUrl();
          APP._pdf.url = f.pdfUrl;
          APP._pdf.facturaId = id;
          openPdfViewer();
          return;
        }
        // si no, genera desde esa factura (sin cambiar edición actual: hacemos snapshot y restauramos)
        const bak = JSON.stringify(CUR);
        try{
          APP.loadInvoiceById && APP.loadInvoiceById(id);
          await generatePDF(true); // silent no modal? -> se abre modal
          openPdfViewer();
        }finally{
          // restaurar CUR del backup (mantiene la factura que estabas editando)
          try{
            const restored = JSON.parse(bak);
            Object.assign(CUR, restored);
            APP.setFacturaHeaderUI?.();
            // refrescar UI (mínimo)
            if($('#factFecha')) $('#factFecha').value = CUR.fechaISO || isoDate(new Date());
            if($('#factTags')) $('#factTags').value = CUR.tags || '';
            if($('#factNotas')) $('#factNotas').value = CUR.notas || '';
            if($('#factObs')) $('#factObs').value = CUR.obs || '';
            if($('#chkIvaIncl')) $('#chkIvaIncl').checked = !!CUR.ivaIncl;
            if($('#chkTransporte')) $('#chkTransporte').checked = !!CUR.transporte;
            if($('#clienteSelect')) $('#clienteSelect').value = CUR.clienteId || '';
            APP.renderLines?.();
            APP.refreshInvoiceTotals?.();
            APP.renderQR?.();
          }catch{}
        }
      });
    });
    $$('[data-fdel]').forEach(btn => {
      on(btn,'click', async () => {
        const id = btn.getAttribute('data-fdel');
        const ok = await APP.confirmBox('Eliminar factura', '¿Eliminar esta factura del historial?');
        if(!ok) return;
        const idx = (DB.facturas||[]).findIndex(x => x.id === id);
        if(idx >= 0){
          DB.facturas.splice(idx,1);
          saveKey(K.FACT, DB.facturas);
          APP.toast('Facturas', 'Eliminada');
          refreshFacturas();
          APP.refreshContabilidad?.();
        }
      });
    });
  }

  function refreshFacturas(){
    DB.facturas = loadKey(K.FACT, DB.facturas || []);
    const q = $('#factSearch')?.value || '';
    let rows = (DB.facturas||[]).filter(f => facturaMatchesSearch(f, q));

    // Orden: fecha desc, luego num desc
    rows.sort((a,b) => (b.fechaISO||'').localeCompare(a.fechaISO||'') || (b.num||'').localeCompare(a.num||''));

    renderFacturasTable(rows);

    // KPIs simples
    let total = 0;
    let pend = 0;
    rows.forEach(f => { total += n2(f.totales?.total); pend += n2(f.totales?.pendiente); });
    setText($('#factKTotal'), money(total));
    setText($('#factKPend'), money(pend));
    setText($('#factKCount'), String(rows.length));
  }
  APP.refreshFacturas = refreshFacturas;

  /* =========================
     CLIENTES CRUD
  ========================= */
  function clienteRow(c){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${escapeHtml(c.nombre||'')}</b><div class="mini">${escapeHtml(c.alias||'')}</div></td>
      <td class="mono">${escapeHtml(c.nif||'')}</td>
      <td>${escapeHtml(c.dir||'')}</td>
      <td class="mono">${escapeHtml(c.tel||'')}</td>
      <td class="mono">${escapeHtml(c.email||'')}</td>
      <td>
        <div class="tableBtns">
          <button class="linkBtn" type="button" data-cedit="${escapeHtml(c.id)}">Editar</button>
          <button class="linkBtn danger" type="button" data-cdel="${escapeHtml(c.id)}">Eliminar</button>
        </div>
      </td>
    `;
    return tr;
  }

  function renderClientes(rows){
    const body = $('#cliBody');
    if(!body) return;
    body.innerHTML = '';
    if(!rows.length){
      body.innerHTML = `<tr><td colspan="6"><div class="emptyState">Sin clientes</div></td></tr>`;
      return;
    }
    rows.forEach(c => body.appendChild(clienteRow(c)));

    $$('[data-cedit]').forEach(btn => on(btn,'click', () => openClienteEditor(btn.getAttribute('data-cedit'))));
    $$('[data-cdel]').forEach(btn => on(btn,'click', async () => {
      const id = btn.getAttribute('data-cdel');
      const used = (DB.facturas||[]).some(f => f.clienteId === id);
      if(used){
        APP.toast('Clientes', 'No se puede eliminar: usado en facturas');
        return;
      }
      const ok = await APP.confirmBox('Eliminar cliente', '¿Eliminar este cliente?');
      if(!ok) return;
      const idx = (DB.clientes||[]).findIndex(c => c.id === id);
      if(idx >= 0){
        DB.clientes.splice(idx,1);
        saveKey(K.CLIENT, DB.clientes);
        APP.fillClienteSelect?.();
        APP.toast('Clientes', 'Eliminado');
        refreshClientesUI();
      }
    }));
  }

  function refreshClientesUI(){
    DB.clientes = loadKey(K.CLIENT, DB.clientes || []);
    const q = ($('#cliSearch')?.value || '').toLowerCase().trim();
    let rows = DB.clientes || [];
    if(q){
      rows = rows.filter(c => {
        return (c.nombre||'').toLowerCase().includes(q)
          || (c.alias||'').toLowerCase().includes(q)
          || (c.nif||'').toLowerCase().includes(q)
          || (c.dir||'').toLowerCase().includes(q)
          || (c.tel||'').toLowerCase().includes(q)
          || (c.email||'').toLowerCase().includes(q);
      });
    }
    rows.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
    renderClientes(rows);

    setText($('#cliCount'), String((DB.clientes||[]).length));
  }
  APP.refreshClientesUI = refreshClientesUI;

  function openClienteEditor(id){
    const c = id ? findClienteById(id) : null;
    $('#cliEdId') && ($('#cliEdId').value = c?.id || '');
    $('#cliEdNombre') && ($('#cliEdNombre').value = c?.nombre || '');
    $('#cliEdAlias') && ($('#cliEdAlias').value = c?.alias || '');
    $('#cliEdNif') && ($('#cliEdNif').value = c?.nif || '');
    $('#cliEdDir') && ($('#cliEdDir').value = c?.dir || '');
    $('#cliEdTel') && ($('#cliEdTel').value = c?.tel || '');
    $('#cliEdEmail') && ($('#cliEdEmail').value = c?.email || '');
    $('#cliEdNotas') && ($('#cliEdNotas').value = c?.notas || '');

    // Plantillas
    $('#cliEdIvaIncl') && ($('#cliEdIvaIncl').checked = !!c?.tpl?.ivaIncl);
    $('#cliEdTrans') && ($('#cliEdTrans').checked = !!c?.tpl?.trans);
    $('#cliEdPago') && ($('#cliEdPago').value = c?.tpl?.pago || '');
    $('#cliEdTags') && ($('#cliEdTags').value = c?.tpl?.tags || '');
    $('#cliEdNotasStd') && ($('#cliEdNotasStd').value = c?.tpl?.notasStd || '');

    openModal('cliEditModal');
  }

  function saveClienteEditor(){
    const id = norm($('#cliEdId')?.value);
    const nombre = norm($('#cliEdNombre')?.value);
    if(!nombre){
      APP.toast('Cliente', 'Falta nombre');
      return;
    }
    const obj = {
      id: id || uid(),
      nombre,
      alias: norm($('#cliEdAlias')?.value),
      nif: norm($('#cliEdNif')?.value),
      dir: norm($('#cliEdDir')?.value),
      tel: norm($('#cliEdTel')?.value),
      email: norm($('#cliEdEmail')?.value),
      notas: norm($('#cliEdNotas')?.value),
      tpl: {
        ivaIncl: !!$('#cliEdIvaIncl')?.checked,
        trans: !!$('#cliEdTrans')?.checked,
        pago: norm($('#cliEdPago')?.value),
        tags: norm($('#cliEdTags')?.value),
        notasStd: norm($('#cliEdNotasStd')?.value)
      }
    };

    DB.clientes = DB.clientes || [];
    const idx = DB.clientes.findIndex(c => c.id === obj.id);
    if(idx >= 0) DB.clientes[idx] = obj;
    else DB.clientes.unshift(obj);

    saveKey(K.CLIENT, DB.clientes);
    APP.fillClienteSelect?.();
    closeModal('cliEditModal');
    APP.toast('Clientes', idx >= 0 ? 'Actualizado' : 'Creado');
    refreshClientesUI();
  }

  /* =========================
     PRODUCTOS CRUD (vocabulario + precios + kg/caja + coste + origen + envase default + historial)
  ========================= */
  function productRow(p){
    const tr = document.createElement('tr');
    const h = Array.isArray(p.hist) ? p.hist.slice(0,3) : [];
    const histTxt = h.map(x => `${x.modo}:${x.valor}`).join(' · ');
    tr.innerHTML = `
      <td><b>${escapeHtml(p.nombre||'')}</b><div class="mini">${escapeHtml(histTxt ? `Últimos: ${histTxt}` : '')}</div></td>
      <td class="mono">${escapeHtml(p.modo||'kg')}</td>
      <td class="mono">${escapeHtml(p.kgCaja||'')}</td>
      <td class="mono">${escapeHtml(p.pKg||'')}</td>
      <td class="mono">${escapeHtml(p.pCaja||'')}</td>
      <td class="mono">${escapeHtml(p.pUd||'')}</td>
      <td class="mono">${escapeHtml(p.coste||'')}</td>
      <td>${escapeHtml(p.origen||'')}</td>
      <td>
        <div class="tableBtns">
          <button class="linkBtn" type="button" data-pedit="${escapeHtml(p.id)}">Editar</button>
          <button class="linkBtn danger" type="button" data-pdel="${escapeHtml(p.id)}">Eliminar</button>
        </div>
      </td>
    `;
    return tr;
  }

  function renderProductos(rows){
    const body = $('#prodBody');
    if(!body) return;
    body.innerHTML = '';
    if(!rows.length){
      body.innerHTML = `<tr><td colspan="9"><div class="emptyState">Sin productos</div></td></tr>`;
      return;
    }
    rows.forEach(p => body.appendChild(productRow(p)));

    $$('[data-pedit]').forEach(btn => on(btn,'click', () => openProductoEditor(btn.getAttribute('data-pedit'))));
    $$('[data-pdel]').forEach(btn => on(btn,'click', async () => {
      const id = btn.getAttribute('data-pdel');
      const used = (DB.facturas||[]).some(f => (f.lines||[]).some(l => (l.producto||'').toUpperCase() === (findProductoById(id)?.nombre||'').toUpperCase()));
      if(used){
        APP.toast('Productos', 'No se puede eliminar: usado en facturas');
        return;
      }
      const ok = await APP.confirmBox('Eliminar producto', '¿Eliminar este producto?');
      if(!ok) return;
      const idx = (DB.productos||[]).findIndex(p => p.id === id);
      if(idx >= 0){
        DB.productos.splice(idx,1);
        saveKey(K.PROD, DB.productos);
        APP.toast('Productos', 'Eliminado');
        refreshProductosUI();
      }
    }));
  }

  function refreshProductosUI(){
    DB.productos = loadKey(K.PROD, DB.productos || []);
    const q = ($('#prodSearch')?.value || '').toLowerCase().trim();
    let rows = DB.productos || [];
    if(q){
      rows = rows.filter(p => {
        return (p.nombre||'').toLowerCase().includes(q)
          || (p.origen||'').toLowerCase().includes(q)
          || (p.modo||'').toLowerCase().includes(q);
      });
    }
    rows.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
    renderProductos(rows);

    setText($('#prodCount'), String((DB.productos||[]).length));
    APP.fillTarasSelects?.();
  }
  APP.refreshProductosUI = refreshProductosUI;

  function fillEnvaseDefaultSelect(selectedId){
    const sel = $('#prodEdEnvase');
    if(!sel) return;
    sel.innerHTML = `<option value="">(sin envase)</option>`;
    for(const t of (DB.taras||[])){
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.nombre} (${num(t.peso)} kg)`;
      if(selectedId && selectedId === t.id) o.selected = true;
      sel.appendChild(o);
    }
  }

  function openProductoEditor(id){
    const p = id ? findProductoById(id) : null;
    $('#prodEdId') && ($('#prodEdId').value = p?.id || '');
    $('#prodEdNombre') && ($('#prodEdNombre').value = p?.nombre || '');
    $('#prodEdModo') && ($('#prodEdModo').value = p?.modo || 'kg');
    $('#prodEdKgCaja') && ($('#prodEdKgCaja').value = p?.kgCaja || '');
    $('#prodEdPKg') && ($('#prodEdPKg').value = p?.pKg || '');
    $('#prodEdPCaja') && ($('#prodEdPCaja').value = p?.pCaja || '');
    $('#prodEdPUd') && ($('#prodEdPUd').value = p?.pUd || '');
    $('#prodEdCoste') && ($('#prodEdCoste').value = p?.coste || '');
    $('#prodEdOrigen') && ($('#prodEdOrigen').value = p?.origen || '');
    fillEnvaseDefaultSelect(p?.envaseDefaultId || '');

    // historial solo vista
    const hist = Array.isArray(p?.hist) ? p.hist : [];
    setText($('#prodEdHist'), hist.length ? hist.map(h => `${h.modo}:${h.valor} (${h.fecha?ddmmyyyy(new Date(h.fecha)):'-'})`).join(' · ') : '');

    openModal('prodEditModal');
  }

  function saveProductoEditor(){
    const id = norm($('#prodEdId')?.value);
    const nombre = norm($('#prodEdNombre')?.value).toUpperCase();
    if(!nombre){
      APP.toast('Producto', 'Falta nombre');
      return;
    }
    const obj = {
      id: id || uid(),
      nombre,
      modo: norm($('#prodEdModo')?.value) || 'kg',
      kgCaja: norm($('#prodEdKgCaja')?.value),
      pKg: norm($('#prodEdPKg')?.value),
      pCaja: norm($('#prodEdPCaja')?.value),
      pUd: norm($('#prodEdPUd')?.value),
      coste: norm($('#prodEdCoste')?.value),
      origen: norm($('#prodEdOrigen')?.value),
      envaseDefaultId: norm($('#prodEdEnvase')?.value),
      hist: (id ? (findProductoById(id)?.hist || []) : [])
    };

    // evitar duplicados por nombre
    const dup = (DB.productos||[]).find(p => p.id !== obj.id && (p.nombre||'').toUpperCase() === obj.nombre);
    if(dup){
      APP.toast('Producto', 'Ya existe un producto con ese nombre');
      return;
    }

    DB.productos = DB.productos || [];
    const idx = DB.productos.findIndex(p => p.id === obj.id);
    if(idx >= 0) DB.productos[idx] = obj;
    else DB.productos.unshift(obj);

    saveKey(K.PROD, DB.productos);
    closeModal('prodEditModal');
    APP.toast('Productos', idx >= 0 ? 'Actualizado' : 'Creado');
    refreshProductosUI();

    // refrescar grid hints
    APP.renderLines?.();
    APP.refreshInvoiceTotals?.();
  }

  /* =========================
     TARAS CRUD
  ========================= */
  function taraRow(t){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${escapeHtml(t.nombre||'')}</b><div class="mini">${escapeHtml(t.notas||'')}</div></td>
      <td class="mono">${escapeHtml(num(t.peso))}</td>
      <td>
        <div class="tableBtns">
          <button class="linkBtn" type="button" data-tedit="${escapeHtml(t.id)}">Editar</button>
          <button class="linkBtn danger" type="button" data-tdel="${escapeHtml(t.id)}">Eliminar</button>
        </div>
      </td>
    `;
    return tr;
  }

  function renderTaras(rows){
    const body = $('#taraBody');
    if(!body) return;
    body.innerHTML = '';
    if(!rows.length){
      body.innerHTML = `<tr><td colspan="3"><div class="emptyState">Sin taras</div></td></tr>`;
      return;
    }
    rows.forEach(t => body.appendChild(taraRow(t)));

    $$('[data-tedit]').forEach(btn => on(btn,'click', () => openTaraEditor(btn.getAttribute('data-tedit'))));
    $$('[data-tdel]').forEach(btn => on(btn,'click', async () => {
      const id = btn.getAttribute('data-tdel');
      const used = (DB.facturas||[]).some(f => (f.lines||[]).some(l => l.envaseId === id));
      if(used){
        APP.toast('Taras', 'No se puede eliminar: usada en facturas');
        return;
      }
      const ok = await APP.confirmBox('Eliminar tara', '¿Eliminar esta tara/envase?');
      if(!ok) return;
      const idx = (DB.taras||[]).findIndex(t => t.id === id);
      if(idx >= 0){
        DB.taras.splice(idx,1);
        saveKey(K.TARAS, DB.taras);
        APP.toast('Taras', 'Eliminada');
        refreshTarasUI();
        APP.fillTarasSelects?.();
        APP.renderLines?.();
        APP.refreshInvoiceTotals?.();
      }
    }));
  }

  function refreshTarasUI(){
    DB.taras = loadKey(K.TARAS, DB.taras || []);
    const q = ($('#taraSearch')?.value || '').toLowerCase().trim();
    let rows = DB.taras || [];
    if(q){
      rows = rows.filter(t => (t.nombre||'').toLowerCase().includes(q) || (t.notas||'').toLowerCase().includes(q));
    }
    rows.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
    renderTaras(rows);
    setText($('#taraCount'), String((DB.taras||[]).length));
  }
  APP.refreshTarasUI = refreshTarasUI;

  function openTaraEditor(id){
    const t = id ? findTaraById(id) : null;
    $('#taraEdId') && ($('#taraEdId').value = t?.id || '');
    $('#taraEdNombre') && ($('#taraEdNombre').value = t?.nombre || '');
    $('#taraEdPeso') && ($('#taraEdPeso').value = (t?.peso ?? '') === 0 ? '0' : (t?.peso ?? ''));
    $('#taraEdNotas') && ($('#taraEdNotas').value = t?.notas || '');
    openModal('taraEditModal');
  }

  function saveTaraEditor(){
    const id = norm($('#taraEdId')?.value);
    const nombre = norm($('#taraEdNombre')?.value);
    const peso = n2($('#taraEdPeso')?.value);
    if(!nombre){
      APP.toast('Tara', 'Falta nombre');
      return;
    }
    if(!(peso >= 0)){
      APP.toast('Tara', 'Peso inválido');
      return;
    }
    const obj = { id: id || uid(), nombre, peso, notas: norm($('#taraEdNotas')?.value) };

    // evitar duplicados por nombre
    const dup = (DB.taras||[]).find(t => t.id !== obj.id && (t.nombre||'').toLowerCase() === obj.nombre.toLowerCase());
    if(dup){
      APP.toast('Tara', 'Ya existe una tara con ese nombre');
      return;
    }

    DB.taras = DB.taras || [];
    const idx = DB.taras.findIndex(t => t.id === obj.id);
    if(idx >= 0) DB.taras[idx] = obj;
    else DB.taras.unshift(obj);

    saveKey(K.TARAS, DB.taras);
    closeModal('taraEditModal');
    APP.toast('Taras', idx >= 0 ? 'Actualizada' : 'Creada');
    refreshTarasUI();
    APP.fillTarasSelects?.();
    APP.renderLines?.();
    APP.refreshInvoiceTotals?.();
  }

  /* =========================
     CONTABILIDAD 🔒 (PIN ya gestionado en 3A)
     - KPIs + tabla + export CSV
  ========================= */
  function facturasInRange(fromISO, toISO, clienteId, tag){
    const arr = DB.facturas || [];
    const from = fromISO ? new Date(fromISO+'T00:00:00').getTime() : null;
    const to = toISO ? new Date(toISO+'T23:59:59').getTime() : null;
    const ttag = (tag||'').toLowerCase().trim();

    return arr.filter(f => {
      const t = f.fechaISO ? new Date(f.fechaISO+'T12:00:00').getTime() : 0;
      if(from && t < from) return false;
      if(to && t > to) return false;
      if(clienteId && f.clienteId !== clienteId) return false;
      if(ttag){
        const tags = (f.tags||'').toLowerCase();
        if(!tags.includes(ttag)) return false;
      }
      return true;
    });
  }

  function sumMargenFromFacturas(rows){
    // margen si existe coste en producto (solo aproximado)
    // margen = ventas - costeEstimado
    let ventas = 0;
    let coste = 0;

    for(const f of rows){
      ventas += n2(f.totales?.total);

      const lines = f.lines || [];
      for(const l of lines){
        const prod = findProductoByName(l.producto);
        const costeUnit = prod ? n2(prod.coste) : 0;
        if(!(costeUnit > 0)) continue;

        const modo = l.modo || 'kg';
        const cant = n2(l.cantidad);
        const neto = n2(l.neto);
        if(modo === 'kg'){
          // coste por kg * neto
          coste += costeUnit * (neto || 0);
        }else if(modo === 'caja'){
          // si coste se interpreta como coste por caja (si usuario lo usa así)
          coste += costeUnit * cant;
        }else if(modo === 'ud'){
          coste += costeUnit * cant;
        }
      }
    }
    return { ventas, coste, margen: ventas - coste };
  }

  function renderContTable(rows){
    const body = $('#contBody');
    if(!body) return;
    body.innerHTML = '';
    if(!rows.length){
      body.innerHTML = `<tr><td colspan="6"><div class="emptyState">Sin resultados</div></td></tr>`;
      return;
    }

    rows.sort((a,b) => (a.fechaISO||'').localeCompare(b.fechaISO||'') || (a.num||'').localeCompare(b.num||''));

    rows.forEach(f => {
      const dt = f.fechaISO ? ddmmyyyy(new Date(f.fechaISO+'T00:00:00')) : '';
      const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '(sin cliente)';
      const total = n2(f.totales?.total);
      const tags = f.tags || '';
      const iva = n2(f.totales?.iva);
      const estado = f.estado || '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${escapeHtml(dt)}</td>
        <td><b>${escapeHtml(f.num||'')}</b></td>
        <td>${escapeHtml(cli)}</td>
        <td>${escapeHtml(tags)}</td>
        <td class="mono">${escapeHtml(money(iva))}</td>
        <td><b>${escapeHtml(money(total))}</b><div class="mini">${escapeHtml(estado)}</div></td>
      `;
      body.appendChild(tr);
    });
  }

  function refreshContabilidad(){
    // si bloqueado, la 3A ya lo controla al entrar, pero por seguridad:
    if(APP.LOCK?.contabilidad){
      setText($('#ckVentas'), money(0));
      setText($('#ckIva'), money(0));
      setText($('#ckCount'), '0');
      setText($('#ckMargen'), money(0));
      const body = $('#contBody'); if(body) body.innerHTML = '';
      return;
    }

    DB.facturas = loadKey(K.FACT, DB.facturas || []);

    const from = $('#contDesde')?.value || '';
    const to = $('#contHasta')?.value || '';
    const clienteId = $('#contCliente')?.value || '';
    const tag = $('#contTag')?.value || '';

    const rows = facturasInRange(from, to, clienteId, tag);

    let ventas = 0;
    let iva = 0;
    rows.forEach(f => { ventas += n2(f.totales?.total); iva += n2(f.totales?.iva); });

    const m = sumMargenFromFacturas(rows);

    setText($('#ckVentas'), money(ventas));
    setText($('#ckIva'), money(iva));
    setText($('#ckCount'), String(rows.length));
    setText($('#ckMargen'), money(m.margen));

    renderContTable(rows);
    APP._contLastRows = rows;
  }
  APP.refreshContabilidad = refreshContabilidad;

  function exportContCSV(){
    const rows = APP._contLastRows || [];
    if(!rows.length){
      APP.toast('Export', 'No hay datos para exportar');
      return;
    }
    const header = ['fecha','num','cliente','tags','subtotal','transporte','iva','total','estado','metodoPago','pendiente'];
    const lines = [header.join(';')];

    rows.forEach(f => {
      const cli = (f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '').replaceAll(';',',');
      const tags = (f.tags||'').replaceAll(';',',');
      const row = [
        f.fechaISO || '',
        f.num || '',
        cli,
        tags,
        String(n2(f.totales?.subtotal).toFixed(2)),
        String(n2(f.totales?.transporte).toFixed(2)),
        String(n2(f.totales?.iva).toFixed(2)),
        String(n2(f.totales?.total).toFixed(2)),
        f.estado || '',
        f.metodoPago || '',
        String(n2(f.totales?.pendiente).toFixed(2))
      ];
      lines.push(row.join(';'));
    });

    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factu-miral-contabilidad-${isoDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try{ URL.revokeObjectURL(url); }catch{} }, 1500);
    APP.toast('Export', 'CSV generado');
  }

  /* =========================
     CLOUD (Firebase) — OPCIONAL (sin errores si no hay config)
  ========================= */
  APP.cloud = APP.cloud || { ready:false, user:null, app:null, auth:null, db:null, storage:null };

  function hasCloudConfig(){
    const c = DB.ajustes?.cloud || {};
    return !!(c.apiKey && c.authDomain && c.projectId);
  }

  function firebaseLoaded(){
    // firebase v8 global firebase, o modular v9 no se asume aquí
    return typeof window.firebase !== 'undefined';
  }

  function ensureCloud(){
    // Si no está configurado o no hay librerías, no hace nada
    if(!hasCloudConfig()) return null;
    if(!firebaseLoaded()) return null;

    try{
      if(APP.cloud.ready && APP.cloud.app) return APP.cloud;

      const cfg = DB.ajustes.cloud;
      // evitar re-init (v8)
      if(window.firebase.apps && window.firebase.apps.length){
        APP.cloud.app = window.firebase.app();
      }else{
        APP.cloud.app = window.firebase.initializeApp(cfg);
      }
      APP.cloud.auth = window.firebase.auth ? window.firebase.auth() : null;
      APP.cloud.db = window.firebase.database ? window.firebase.database() : null;
      APP.cloud.storage = window.firebase.storage ? window.firebase.storage() : null;
      APP.cloud.ready = true;

      return APP.cloud;
    }catch{
      // Nunca romper la app
      APP.cloud.ready = false;
      return null;
    }
  }

  async function cloudLoginEmailPass(email, pass){
    const c = ensureCloud();
    if(!c || !c.auth){
      APP.toast('Cloud', 'Cloud no disponible (config/librería)');
      return;
    }
    try{
      const res = await c.auth.signInWithEmailAndPassword(email, pass);
      APP.cloud.user = res.user;
      APP.toast('Cloud', 'Login OK');
      refreshCloudUI();
    }catch(e){
      APP.toast('Cloud', 'Error login');
    }
  }

  async function cloudRegisterEmailPass(email, pass){
    const c = ensureCloud();
    if(!c || !c.auth){
      APP.toast('Cloud', 'Cloud no disponible (config/librería)');
      return;
    }
    try{
      const res = await c.auth.createUserWithEmailAndPassword(email, pass);
      APP.cloud.user = res.user;
      APP.toast('Cloud', 'Cuenta creada');
      refreshCloudUI();
    }catch{
      APP.toast('Cloud', 'Error registro');
    }
  }

  async function cloudLogout(){
    const c = ensureCloud();
    if(!c || !c.auth) return;
    try{
      await c.auth.signOut();
      APP.cloud.user = null;
      APP.toast('Cloud', 'Sesión cerrada');
      refreshCloudUI();
    }catch{
      APP.toast('Cloud', 'Error logout');
    }
  }

  function refreshCloudUI(){
    const st = $('#cloudUser');
    const btnIn = $('#btnCloudLogin');
    const btnUp = $('#btnCloudRegister');
    const btnOut = $('#btnCloudLogout');

    const user = APP.cloud.user;
    if(st) st.textContent = user ? (user.email || 'user') : 'sin sesión';
    if(btnIn) btnIn.disabled = !!user;
    if(btnUp) btnUp.disabled = !!user;
    if(btnOut) btnOut.disabled = !user;

    // badge
    APP.refreshCloudBadge?.();
  }

  async function cloudSyncPushAll(){
    const c = ensureCloud();
    if(!c || !c.db || !APP.cloud.user){
      APP.toast('Cloud', 'Necesitas login cloud');
      return;
    }
    try{
      const uid = APP.cloud.user.uid;
      const base = `factumiral/${uid}`;

      await c.db.ref(base + '/clientes').set(DB.clientes || []);
      await c.db.ref(base + '/productos').set(DB.productos || []);
      await c.db.ref(base + '/taras').set(DB.taras || []);
      await c.db.ref(base + '/facturas').set(DB.facturas || []);
      await c.db.ref(base + '/ajustes').set(DB.ajustes || {});

      APP.toast('Cloud', 'Sync subida OK');
    }catch{
      APP.toast('Cloud', 'Error sync subida');
    }
  }

  async function cloudSyncPullAll(){
    const c = ensureCloud();
    if(!c || !c.db || !APP.cloud.user){
      APP.toast('Cloud', 'Necesitas login cloud');
      return;
    }
    try{
      const uid = APP.cloud.user.uid;
      const base = `factumiral/${uid}`;

      const snap = await c.db.ref(base).once('value');
      const v = snap.val() || {};

      if(Array.isArray(v.clientes)){ DB.clientes = v.clientes; saveKey(K.CLIENT, DB.clientes); }
      if(Array.isArray(v.productos)){ DB.productos = v.productos; saveKey(K.PROD, DB.productos); }
      if(Array.isArray(v.taras)){ DB.taras = v.taras; saveKey(K.TARAS, DB.taras); }
      if(Array.isArray(v.facturas)){ DB.facturas = v.facturas; saveKey(K.FACT, DB.facturas); }
      if(v.ajustes){ DB.ajustes = v.ajustes; saveKey(K.SET, DB.ajustes); }

      APP.fillClienteSelect?.();
      APP.fillTarasSelects?.();
      APP.refreshAjustesUI?.();
      APP.renderLines?.();
      APP.refreshInvoiceTotals?.();
      APP.renderQR?.();

      refreshFacturas();
      refreshClientesUI();
      refreshProductosUI();
      refreshTarasUI();
      refreshContabilidad();

      APP.toast('Cloud', 'Sync bajada OK');
    }catch{
      APP.toast('Cloud', 'Error sync bajada');
    }
  }

  /* =========================
     PDF PRO (jsPDF + autoTable)
     - multipágina + "Suma y sigue" + numeración páginas
     - QR sólo si APP.qrOk (si falla QR => NO sale en PDF)
     - visor interno (blob URL)
  ========================= */
  function buildInvoiceSnapshot(){
    // Asegurar totales actualizados
    APP.refreshInvoiceTotals?.();
    APP.renderQR?.();

    // provider
    const prov = {
      nombre: norm($('#provNombre')?.value || DB.prov?.nombre),
      nif: norm($('#provNif')?.value || DB.prov?.nif),
      dir: norm($('#provDir')?.value || DB.prov?.dir),
      tel: norm($('#provTel')?.value || DB.prov?.tel),
      email: norm($('#provEmail')?.value || DB.prov?.email)
    };

    // cliente snapshot
    const cli = {
      nombre: norm($('#cliNombre')?.value),
      nif: norm($('#cliNif')?.value),
      dir: norm($('#cliDir')?.value),
      tel: norm($('#cliTel')?.value),
      email: norm($('#cliEmail')?.value),
      pago: norm($('#cliPago')?.value)
    };

    // header
    const header = {
      num: CUR.num || '',
      fechaISO: CUR.fechaISO || isoDate(new Date()),
      fechaES: CUR.fechaISO ? ddmmyyyy(new Date(CUR.fechaISO+'T00:00:00')) : '',
      tags: norm($('#factTags')?.value || CUR.tags),
      notas: norm($('#factNotas')?.value || CUR.notas),
      obs: norm($('#factObs')?.value || CUR.obs),
      estado: norm($('#factEstado')?.value || CUR.estado),
      metodoPago: norm($('#factMetodoPago')?.value || CUR.metodoPago),
      ivaIncl: !!$('#chkIvaIncl')?.checked,
      transporte: !!$('#chkTransporte')?.checked
    };

    // líneas
    const lines = (CUR.lines || []).map(l => ({
      producto: norm(l.producto).toUpperCase(),
      modo: l.modo || 'kg',
      cantidad: l.cantidad ?? '',
      bruto: l.bruto ?? '',
      envaseId: l.envaseId || '',
      envaseName: l.envaseId ? (findTaraById(l.envaseId)?.nombre || '') : '',
      nEnvases: l.nEnvases ?? '',
      tara: l.tara ?? '',
      neto: l.neto ?? '',
      precio: l.precio ?? '',
      origen: l.origen ?? '',
      importe: n2(l.importe)
    })).filter(l => l.producto || n2(l.cantidad) || n2(l.bruto) || n2(l.precio) || n2(l.importe));

    // pagos
    const pagos = Array.isArray(CUR.pagos) ? CUR.pagos.map(p => ({
      importe: n2(p.importe),
      fecha: p.fecha ? ddmmyyyy(new Date(p.fecha+'T00:00:00')) : ''
    })) : [];

    // totales
    const tot = {
      subtotal: n2(APP.subtotal),
      transporte: n2(APP.transporte),
      iva: n2(APP.iva),
      total: n2(APP.total),
      pendiente: n2(APP.pendiente),
      pagado: (Array.isArray(CUR.pagos)? CUR.pagos.reduce((a,p)=>a+n2(p.importe),0):0),
      ivaPct: n2(DB.ajustes?.ivaPct),
      transPct: n2(DB.ajustes?.transPct)
    };

    // QR
    const qr = {
      ok: !!APP.qrOk,
      text: APP.qrText || ''
    };

    return { prov, cli, header, lines, pagos, tot, qr };
  }

  function ensureJsPdf(){
    const ok = (typeof window.jspdf !== 'undefined') && window.jspdf.jsPDF;
    return ok ? window.jspdf.jsPDF : null;
  }

  function hasAutoTable(doc){
    return !!(doc && typeof doc.autoTable === 'function');
  }

  function buildPdfHeader(doc, snap, pageW){
    // Title + logo cereza (B/W) -> usamos SVG inline simple si no hay imagen
    // (El logo real se pondrá en index con <svg> y aquí no dependemos de assets)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FACTURA', 14, 16);

    // Logo (cereza simple en B/W)
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.circle(pageW - 22, 12, 4);
    doc.circle(pageW - 14, 12, 4);
    doc.line(pageW - 18, 8, pageW - 18, 3);
    doc.line(pageW - 18, 3, pageW - 15, 1.5);

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text(`Nº: ${snap.header.num}`, 14, 22);
    doc.text(`Fecha: ${snap.header.fechaES}`, 14, 26);

    // Provider left
    doc.setFont('helvetica','bold'); doc.text('Proveedor', 14, 34);
    doc.setFont('helvetica','normal');
    const p = snap.prov;
    const provLines = [
      p.nombre, `NIF: ${p.nif}`, p.dir, `Tel: ${p.tel}`, p.email
    ].filter(Boolean);
    doc.text(provLines, 14, 38);

    // Client right
    doc.setFont('helvetica','bold'); doc.text('Cliente', pageW - 90, 34);
    doc.setFont('helvetica','normal');
    const c = snap.cli;
    const cliLines = [
      c.nombre, `NIF/CIF: ${c.nif}`, c.dir, (c.tel?`Tel: ${c.tel}`:''), (c.email?c.email:''), (c.pago?`Pago: ${c.pago}`:'')
    ].filter(Boolean);
    doc.text(cliLines, pageW - 90, 38);

    // QR center (solo si ok)
    if(snap.qr.ok && snap.qr.text){
      try{
        // QR -> usamos lib global "QRCode" en DOM, pero en PDF lo convertimos con "qrcode" lib no disponible.
        // Solución: usar QRCode.js para generar canvas offscreen y extraer dataURL (si existe).
        const canvas = document.createElement('canvas');
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-99999px';
        wrap.style.top = '-99999px';
        document.body.appendChild(wrap);

        // eslint-disable-next-line no-undef
        const qr = new QRCode(wrap, { text: snap.qr.text, width: 180, height: 180, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.M });
        // QRCode.js crea un <img> o <canvas> dentro de wrap, esperamos microtask
        const node = wrap.querySelector('img') || wrap.querySelector('canvas');
        let dataUrl = '';
        if(node && node.tagName === 'IMG'){
          dataUrl = node.src;
        }else if(node && node.tagName === 'CANVAS'){
          dataUrl = node.toDataURL('image/png');
        }
        wrap.remove();

        if(dataUrl){
          const x = (pageW/2) - 17;
          const y = 34;
          doc.addImage(dataUrl, 'PNG', x, y, 34, 34);
          doc.setFontSize(7);
          doc.setFont('helvetica','normal');
          doc.text(snap.qr.text.slice(0, 80) + (snap.qr.text.length>80?'…':''), (pageW/2)-40, 70, { maxWidth: 80 });
        }else{
          // no data => omit
        }
      }catch{
        // si falla, omitimos QR (regla: si hay fallos no sale)
      }
    }else{
      // sin QR
    }

    // Separador
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(14, 78, pageW - 14, 78);
  }

  function buildPdfFooter(doc, pageW, pageH, pageNum, pageCount){
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    const txt = `Página ${pageNum}/${pageCount}`;
    doc.text(txt, pageW - 14, pageH - 10, { align:'right' });
    doc.text('FACTU MIRAL — B/W PRO (IVA gestionado según configuración)', 14, pageH - 10);
  }

  function buildAutoTableBody(lines){
    return lines.map(l => ([
      l.producto || '',
      l.modo || '',
      String(l.cantidad ?? ''),
      String(l.bruto ?? ''),
      (l.envaseName || ''),
      String(l.nEnvases ?? ''),
      String(l.tara ?? ''),
      String(l.neto ?? ''),
      String(l.precio ?? ''),
      l.origen || '',
      money(l.importe || 0)
    ]));
  }

  function addTotalsBlock(doc, snap, startY, pageW){
    let y = startY;
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(14, y, pageW - 14, y);
    y += 6;

    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text('Totales', 14, y);
    y += 6;

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);

    const t = snap.tot;
    const rows = [
      ['Subtotal', money(t.subtotal)],
      snap.header.transporte ? [`Transporte (${t.transPct}%)`, money(t.transporte)] : null,
      snap.header.ivaIncl ? ['IVA', 'incluido en los precios'] : [`IVA (${t.ivaPct}%)`, money(t.iva)],
      ['TOTAL', money(t.total)],
      ['Pagado', money(t.pagado)],
      ['Pendiente', money(t.pendiente)]
    ].filter(Boolean);

    const xL = pageW - 90;
    rows.forEach((r, i) => {
      const yy = y + (i * 5);
      doc.text(String(r[0]), xL, yy);
      doc.text(String(r[1]), pageW - 14, yy, { align:'right' });
    });

    return y + (rows.length * 5) + 2;
  }

  function addObsBlock(doc, snap, startY, pageW, pageH){
    let y = startY;
    const maxY = pageH - 22;
    const text = norm(snap.header.obs);
    if(!text) return y;

    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Observaciones', 14, y);
    y += 5;

    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const split = doc.splitTextToSize(text, pageW - 28);
    const needed = split.length * 4.2;

    if(y + needed > maxY){
      // Si no cabe, recortamos visualmente (no rompemos)
      const fitCount = Math.floor((maxY - y) / 4.2);
      const clipped = split.slice(0, Math.max(0, fitCount));
      doc.text(clipped, 14, y);
      y = maxY;
      return y;
    }else{
      doc.text(split, 14, y);
      y += needed;
      return y;
    }
  }

  async function generatePDF(fromList = false){
    const JsPDF = ensureJsPdf();
    if(!JsPDF){
      APP.toast('PDF', 'Falta jsPDF en index.html');
      return;
    }

    const snap = buildInvoiceSnapshot();
    if(!snap.lines.length){
      APP.toast('PDF', 'No hay líneas');
      return;
    }

    // crear doc A4
    const doc = new JsPDF({ unit:'mm', format:'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Header 1
    buildPdfHeader(doc, snap, pageW);

    // Tabla
    const head = [[
      'Producto','Modo','Cant','Bruto','Envase','Nº env','Tara','Neto','Precio','Origen','Importe'
    ]];
    const body = buildAutoTableBody(snap.lines);

    if(!hasAutoTable(doc)){
      APP.toast('PDF', 'Falta autoTable en index.html');
      return;
    }

    // Estilo B/W con grises alternos
    // "Suma y sigue": lo gestionamos detectando páginas y escribiendo en el footer de cada página menos la última.
    const pageMark = { pages: 1 };

    doc.autoTable({
      head,
      body,
      startY: 82,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.2,
        cellPadding: 1.6
      },
      headStyles: {
        fillColor: [235,235,235],
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.2,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248,248,248]
      },
      columnStyles: {
        0: { cellWidth: 34 }, // producto
        1: { cellWidth: 10 }, // modo
        2: { cellWidth: 10 }, // cant
        3: { cellWidth: 12 }, // bruto
        4: { cellWidth: 18 }, // envase
        5: { cellWidth: 10 }, // n env
        6: { cellWidth: 10 }, // tara
        7: { cellWidth: 10 }, // neto
        8: { cellWidth: 12 }, // precio
        9: { cellWidth: 18 }, // origen
        10:{ cellWidth: 16 }  // importe
      },
      didDrawPage: (data) => {
        // Header en páginas siguientes
        if(data.pageNumber > 1){
          buildPdfHeader(doc, snap, pageW);
        }
        pageMark.pages = data.pageNumber;

        // en todas las páginas, ponemos un placeholder del footer (se corregirá luego con total pages)
        doc.setFont('helvetica','normal');
        doc.setFontSize(8);
        doc.text(`Página ${data.pageNumber}/__`, pageW - 14, pageH - 10, { align:'right' });
        doc.text('FACTU MIRAL — B/W PRO (IVA gestionado según configuración)', 14, pageH - 10);
      }
    });

    // Después de tabla, añadir totales + observaciones (si cabe, si no, nueva página)
    let y = doc.lastAutoTable.finalY + 6;
    const minSpace = 40;

    if(y + minSpace > pageH - 18){
      doc.addPage();
      buildPdfHeader(doc, snap, pageW);
      y = 82;
    }

    y = addTotalsBlock(doc, snap, y, pageW);
    y += 4;

    // Pagos (si hay)
    if((snap.pagos||[]).length){
      if(y + 18 > pageH - 18){
        doc.addPage();
        buildPdfHeader(doc, snap, pageW);
        y = 82;
      }
      doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text('Pagos', 14, y); y += 5;
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      const ptxt = snap.pagos.map(p => `• ${money(p.importe)} — ${p.fecha}`).join('\n');
      const split = doc.splitTextToSize(ptxt, pageW - 28);
      doc.text(split, 14, y);
      y += (split.length * 4.2) + 2;
    }

    // Observaciones
    if(y + 18 > pageH - 18){
      doc.addPage();
      buildPdfHeader(doc, snap, pageW);
      y = 82;
    }
    y = addObsBlock(doc, snap, y, pageW, pageH);

    // Corregir footers con total pages + “Suma y sigue”
    const totalPages = pageMark.pages || doc.getNumberOfPages();
    for(let p=1; p<=totalPages; p++){
      doc.setPage(p);
      // borrar el placeholder no es posible; re-escribimos encima (blanco) y luego negro (simple)
      // (en B/W, dejamos solo el correcto)
      doc.setFillColor(255,255,255);
      doc.rect(pageW - 55, pageH - 16, 44, 10, 'F');
      buildPdfFooter(doc, pageW, pageH, p, totalPages);

      if(p < totalPages){
        doc.setFont('helvetica','italic');
        doc.setFontSize(8);
        doc.text('Suma y sigue…', 14, pageH - 16);
      }
    }

    // Guardar blob + url (visor interno)
    const blob = doc.output('blob');
    revokePdfUrl();
    APP._pdf.blob = blob;
    APP._pdf.url = URL.createObjectURL(blob);
    APP._pdf.facturaId = CUR.id || '';
    APP._pdf.createdAt = Date.now();

    // Opcional: abrir visor automáticamente si se llamó desde botón
    if(!fromList){
      openPdfViewer();
    }

    APP.toast('PDF', 'Generado');
    return blob;
  }
  APP.generatePDF = generatePDF;

  /* =========================
     PDF + NUBE (si cloud)
  ========================= */
  async function pdfToCloud(){
    const c = ensureCloud();
    if(!c || !c.storage || !APP.cloud.user){
      APP.toast('Cloud', 'Necesitas login cloud (y storage)');
      return;
    }
    // Si no hay PDF generado, generarlo
    let blob = APP._pdf.blob;
    if(!blob){
      blob = await generatePDF(true);
    }
    if(!blob){
      APP.toast('Cloud', 'No se pudo generar PDF');
      return;
    }
    try{
      const uidU = APP.cloud.user.uid;
      const name = (CUR.num || ('FA-'+Date.now())) + '.pdf';
      const path = `factumiral/${uidU}/pdf/${name}`;
      const ref = c.storage.ref().child(path);
      await ref.put(blob, { contentType:'application/pdf' });
      const url = await ref.getDownloadURL();

      // Guardar url en factura actual (si existe)
      // Si la factura no está guardada, la guardamos primero
      if(!CUR.id){
        APP.saveCurrentInvoice?.();
      }
      if(CUR.id){
        const f = (DB.facturas||[]).find(x => x.id === CUR.id) || null;
        if(f){
          f.pdfUrl = url;
          saveKey(K.FACT, DB.facturas);
          APP.toast('Cloud', 'PDF subido y enlazado');
          refreshFacturas();
        }else{
          APP.toast('Cloud', 'PDF subido (sin enlazar)');
        }
      }else{
        APP.toast('Cloud', 'PDF subido');
      }
    }catch{
      APP.toast('Cloud', 'Error subiendo PDF');
    }
  }
  APP.pdfToCloud = pdfToCloud;

  /* =========================
     INIT / BINDS 3C
  ========================= */
  function bind3C(){
    // Facturas list search
    on($('#factSearch'), 'input', refreshFacturas);

    // Clientes
    on($('#cliSearch'), 'input', refreshClientesUI);
    on($('#btnCliNuevo'), 'click', () => openClienteEditor(''));
    on($('#btnCliSave'), 'click', saveClienteEditor);

    // Productos
    on($('#prodSearch'), 'input', refreshProductosUI);
    on($('#btnProdNuevo'), 'click', () => openProductoEditor(''));
    on($('#btnProdSave'), 'click', saveProductoEditor);

    // Taras
    on($('#taraSearch'), 'input', refreshTarasUI);
    on($('#btnTaraNuevo'), 'click', () => openTaraEditor(''));
    on($('#btnTaraSave'), 'click', saveTaraEditor);

    // Contabilidad
    on($('#btnContRefrescar'), 'click', refreshContabilidad);
    on($('#btnContCSV'), 'click', exportContCSV);

    // Cloud
    on($('#btnCloudInit'), 'click', () => {
      const c = ensureCloud();
      if(c) APP.toast('Cloud', 'Cloud listo');
      else APP.toast('Cloud', 'Cloud OFF (config o librería)');
      refreshCloudUI();
    });

    on($('#btnCloudLogin'), 'click', () => {
      const email = norm($('#cloudEmail')?.value);
      const pass = norm($('#cloudPass')?.value);
      if(!email || !pass){ APP.toast('Cloud', 'Email/Pass requeridos'); return; }
      cloudLoginEmailPass(email, pass);
    });

    on($('#btnCloudRegister'), 'click', () => {
      const email = norm($('#cloudEmail')?.value);
      const pass = norm($('#cloudPass')?.value);
      if(!email || !pass){ APP.toast('Cloud', 'Email/Pass requeridos'); return; }
      cloudRegisterEmailPass(email, pass);
    });

    on($('#btnCloudLogout'), 'click', cloudLogout);
    on($('#btnCloudPush'), 'click', cloudSyncPushAll);
    on($('#btnCloudPull'), 'click', cloudSyncPullAll);

    // PDF viewer controls
    on($('#btnPdfClose'), 'click', closePdfViewer);
    on($('#btnPdfPrint'), 'click', () => {
      const frame = $('#pdfFrame');
      try{ frame?.contentWindow?.print(); }catch{ APP.toast('PDF', 'No se pudo imprimir'); }
    });
    on($('#btnPdfOpenTab'), 'click', () => {
      if(!APP._pdf.url){ APP.toast('PDF','No hay PDF'); return; }
      window.open(APP._pdf.url, '_blank', 'noopener');
    });

    // Ajustar selects contabilidad: llenar clientes
    fillContClienteSelect();
  }

  function fillContClienteSelect(){
    const sel = $('#contCliente');
    if(!sel) return;
    sel.innerHTML = `<option value="">(Todos los clientes)</option>`;
    (DB.clientes||[]).slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nombre || '(sin nombre)';
      sel.appendChild(o);
    });
  }

  function init3C(){
    // Refrescos iniciales
    refreshFacturas();
    refreshClientesUI();
    refreshProductosUI();
    refreshTarasUI();
    refreshCloudUI();
    fillContClienteSelect();

    // defaults contabilidad: mes actual
    if($('#contDesde') && !$('#contDesde').value){
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      $('#contDesde').value = isoDate(first);
    }
    if($('#contHasta') && !$('#contHasta').value){
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
      $('#contHasta').value = isoDate(last);
    }

    bind3C();

    // Si cloud config + firebase loaded, enganchar auth state
    const c = ensureCloud();
    if(c && c.auth){
      try{
        c.auth.onAuthStateChanged((user) => {
          APP.cloud.user = user || null;
          refreshCloudUI();
        });
      }catch{}
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init3C);
  }else{
    init3C();
  }

})();
