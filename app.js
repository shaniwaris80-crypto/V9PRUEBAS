/* =========================================================
PARTE 3A/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3A: base app + storage + helpers + precarga + tabs + estado inicial + grid base
========================================================= */

(() => {
  'use strict';

  /* =========================
     HELPERS DOM
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const setText = (el, t) => { if (el) el.textContent = (t ?? ''); };
  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  /* =========================
     FORMATOS
  ========================= */
  const pad2 = (n) => String(n).padStart(2,'0');
  const now = () => new Date();
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const isoToES = (iso) => {
    if(!iso) return '—';
    const [y,m,d] = iso.split('-');
    if(!y||!m||!d) return '—';
    return `${d}/${m}/${y}`;
  };
  const num = (v) => {
    const x = (v === '' || v == null) ? 0 : Number(String(v).replace(',','.'));
    return Number.isFinite(x) ? x : 0;
  };
  const money = (v) => {
    const x = num(v);
    return x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const round2 = (v) => Math.round(num(v) * 100) / 100;

  /* =========================
     UID / IDs
  ========================= */
  const uid = () => (
    'id_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16)
  );

  const makeInvoiceNumber = (d = new Date()) => {
    const y = d.getFullYear();
    const mo = pad2(d.getMonth()+1);
    const da = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `FA-${y}${mo}${da}${hh}${mm}`;
  };

  /* =========================
     LOCAL STORAGE (OFFLINE FIRST)
  ========================= */
  const K = {
    PROV:    'factumiral_proveedor_v1',
    CLIENTE: 'factumiral_clientes_v1',
    PROD:    'factumiral_productos_v1',
    TARAS:   'factumiral_taras_v1',
    FACT:    'factumiral_facturas_v1',
    AJUST:   'factumiral_ajustes_v1',
    VENTAS:  'factumiral_ventas_v1'
  };

  const load = (key, fallback) => {
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch{
      return fallback;
    }
  };

  const save = (key, val) => {
    try{
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    }catch{
      return false;
    }
  };

  /* =========================
     TOASTS
  ========================= */
  function toast(title, msg, type='ok', ms=2400){
    const wrap = $('#toasts');
    if(!wrap) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<div class="toast__title">${escapeHtml(title)}</div><div class="toast__msg">${escapeHtml(msg)}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(()=> el.remove(), 220);
    }, ms);
  }

  /* =========================
     MODALS (PDF / PIN)
  ========================= */
  function openModal(id){
    const m = $(id);
    if(!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden','false');
  }
  function closeModal(id){
    const m = $(id);
    if(!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden','true');
  }
  function bindModalBasics(){
    $$('.modal').forEach(m=>{
      on(m, 'click', (e)=>{
        const t = e.target;
        if(t && t.dataset && t.dataset.close === '1'){
          closeModal('#'+m.id);
        }
      });
    });
    on($('#btnPdfCerrar'), 'click', ()=> closeModal('#pdfModal'));
    on($('#btnPinCerrar'), 'click', ()=> closeModal('#pinModal'));
  }

  /* =========================
     ESTADO APP (GLOBAL)
  ========================= */
  const FM = {
    version: '1.0',
    unlocked: { cont: false, ventas: false }, // session only
    db: {
      proveedor: null,
      clientes: [],
      productos: [],
      taras: [],
      facturas: [],
      ajustes: null,
      ventas: []
    },
    ui: {
      activeTab: 'tabFactura',
      editing: {
        clienteId: null,
        productoId: null,
        taraId: null,
        facturaId: null,
        ventaId: null
      }
    },

    // ---- stubs (se completan en 3B/3C) ----
    recalcInvoice: () => {},
    renderInvoice: () => {},
    renderLists: () => {},
    renderQR: () => {},
    renderPDF: async () => { throw new Error('PDF no inicializado'); },
    whatsappText: () => '',
    cloud: {
      configured: false,
      loggedIn: false,
      initIfConfigured: async () => {},
      syncAll: async () => {},
      uploadPDF: async () => null
    }
  };

  window.FM = FM; // para que 3B/3C amplíen sin romper cierres

  /* =========================
     DATOS DEFAULT (PROVEEDOR/CLIENTES/PRODUCTOS)
  ========================= */
  const DEFAULT_PROVEEDOR = {
    nombre: 'Mohammad Arslan Waris',
    nif: 'X6389988J',
    dir: 'Calle San Pablo 17, 09003 Burgos',
    tel: '631 667 893',
    email: 'shaniwaris80@gmail.com'
  };

  const DEFAULT_CLIENTES = [
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo'},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', email:'info@restaurantelosbraseros.com'},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', email:'info@hotelcordon.com'}
  ].map(c => ({
    id: c.id,
    nombre: c.nombre || '',
    alias: c.alias || '',
    nif: c.nif || '',
    dir: c.dir || '',
    tel: c.tel || '',
    email: c.email || '',
    notas: c.notas || '',
    tpl: {
      ivaIncluido: false,
      transporte: false,
      pago: (c.pago || ''),
      tags: '',
      notaStd: ''
    }
  }));

  const DEFAULT_PRODUCT_NAMES = [
    "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA",
    "PERA RINCON DEL SOTO","MELOCOTON PRIMERA","AGUACATE GRANEL","MARACUYÁ","MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA",
    "MANDARINA HOJA","MANZANA GOLDEN 20","NARANJA TOMASIN","NECTARINA","NUECES","SANDIA","LIMON SEGUNDA","MANZANA FUJI",
    "NARANJA MESA SONRISA","JENGIBRE","BATATA","AJO PRIMERA","CEBOLLA NORMAL","CALABAZA GRANDE","PATATA LAVADA",
    "TOMATE CHERRY RAMA","TOMATE CHERRY PERA","TOMATE DANIELA","TOMATE ROSA PRIMERA","CEBOLLINO","TOMATE ASURCADO MARRON",
    "TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","CEBOLLETA","PUERROS","BROCOLI","JUDIA VERDE","BERENJENA",
    "PIMIENTO ITALIANO VERDE","PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA","ALCACHOFA","CALABACIN","COLIFLOR",
    "BATAVIA","ICEBERG","MANDARINA SEGUNDA","MANZANA GOLDEN 28","NARANJA ZUMO","KIWI SEGUNDA","MANZANA ROYAL GALA 24",
    "PLATANO CANARIO SUELTO","CEREZA","FRESAS","ARANDANOS","ESPINACA","PEREJIL","CILANTRO","ACELGAS","PIMIENTO VERDE",
    "PIMIENTO ROJO","MACHO VERDE","MACHO MADURO","YUCA","AVOCADO","CEBOLLA ROJA","MENTA","HABANERO","RABANITOS","POMELO",
    "PAPAYA","REINETA 28","NISPERO","ALBARICOQUE","TOMATE PERA","TOMATE BOLA","TOMATE PINK","VALVENOSTA GOLDEN",
    "MELOCOTON ROJO","MELON GALIA","APIO","NARANJA SANHUJA","LIMON PRIMERA","MANGO","MELOCOTON AMARILLO","VALVENOSTA ROJA",
    "PIÑA","NARANJA HOJA","PERA CONFERENCIA SEGUNDA","CEBOLLA DULCE","TOMATE ASURCADO AZUL","ESPARRAGOS BLANCOS",
    "ESPARRAGOS TRIGUEROS","REINETA PRIMERA","AGUACATE PRIMERA","COCO","NECTARINA SEGUNDA","REINETA 24",
    "NECTARINA CARNE BLANCA","GUINDILLA","REINETA VERDE","PATATA 25KG","PATATA 5 KG","TOMATE RAFF","REPOLLO","KIWI ZESPRI",
    "PARAGUAYO SEGUNDA","MELON","REINETA 26","TOMATE ROSA","MANZANA CRIPS","ALOE VERA PIEZAS","TOMATE ENSALADA",
    "PATATA 10KG","MELON BOLLO","CIRUELA ROJA","LIMA","GUINEO VERDE","SETAS","BANANA","BONIATO","FRAMBUESA","BREVAS",
    "PERA AGUA","YAUTIA","YAME","OKRA","MANZANA MELASSI","CACAHUETE","SANDIA NEGRA","SANDIA RAYADA","HIGOS","KUMATO",
    "KIWI CHILE","MELOCOTON AMARILLO SEGUNDA","HIERBABUENA","REMOLACHA","LECHUGA ROMANA","CEREZA","KAKI","CIRUELA CLAUDIA",
    "PERA LIMONERA","CIRUELA AMARILLA","HIGOS BLANCOS","UVA ALVILLO","LIMON EXTRA","PITAHAYA ROJA","HIGO CHUMBO",
    "CLEMENTINA","GRANADA","NECTARINA PRIMERA BIS","CHIRIMOYA","UVA CHELVA","PIMIENTO CALIFORNIA VERDE","KIWI TOMASIN",
    "PIMIENTO CALIFORNIA ROJO","MANDARINA SATSUMA","CASTAÑA","CAKI","MANZANA KANZI","PERA ERCOLINA","NABO",
    "UVA ALVILLO NEGRA","CHAYOTE","ROYAL GALA 28","MANDARINA PRIMERA","PIMIENTO PINTON","MELOCOTON AMARILLO DE CALANDA",
    "HINOJOS","MANDARINA DE HOJA","UVA ROJA PRIMERA","UVA BLANCA PRIMERA"
  ];

  const DEFAULT_PRODUCTOS = DEFAULT_PRODUCT_NAMES.map(n => ({
    id: uid(),
    nombre: n,
    modo: 'kg',
    kgCaja: 0,
    pKg: 0,
    pCaja: 0,
    pUd: 0,
    coste: 0,
    origen: '',
    envaseId: '',
    hist: [] // últimas 5 (solo pantalla)
  }));

  const DEFAULT_TARAS = [
    { id: uid(), nombre: 'Caja plástico ESMO', peso: 0.30, notas: '' },
    { id: uid(), nombre: 'Caja plástico Montenegro', peso: 0.30, notas: '' },
    { id: uid(), nombre: 'Baúl Hnos viejo', peso: 1.80, notas: '' }
  ];

  const DEFAULT_AJUSTES = {
    ivaPct: 4,
    transportePct: 10,
    pinCont: '',               // configurable en Ajustes
    qrBase: 'NIF={NIF};NUM={NUM};FECHA={FECHA};TOTAL={TOTAL}',
    firebase: {
      apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'', storageBucket:''
    }
  };

  /* =========================
     SEED / LOAD DB
  ========================= */
  function seedIfEmpty(){
    const prov = load(K.PROV, null);
    const cli  = load(K.CLIENTE, null);
    const prod = load(K.PROD, null);
    const tar  = load(K.TARAS, null);
    const fac  = load(K.FACT, null);
    const aj   = load(K.AJUST, null);
    const ven  = load(K.VENTAS, null);

    if(!prov){ save(K.PROV, DEFAULT_PROVEEDOR); }
    if(!Array.isArray(cli) || cli.length===0){ save(K.CLIENTE, DEFAULT_CLIENTES); }
    if(!Array.isArray(prod) || prod.length===0){ save(K.PROD, DEFAULT_PRODUCTOS); }
    if(!Array.isArray(tar) || tar.length===0){ save(K.TARAS, DEFAULT_TARAS); }
    if(!Array.isArray(fac)){ save(K.FACT, []); }
    if(!aj){ save(K.AJUST, DEFAULT_AJUSTES); }
    if(!Array.isArray(ven)){ save(K.VENTAS, []); }
  }

  function loadDB(){
    FM.db.proveedor = load(K.PROV, structuredClone(DEFAULT_PROVEEDOR));
    FM.db.clientes  = load(K.CLIENTE, structuredClone(DEFAULT_CLIENTES));
    FM.db.productos = load(K.PROD, structuredClone(DEFAULT_PRODUCTOS));
    FM.db.taras     = load(K.TARAS, structuredClone(DEFAULT_TARAS));
    FM.db.facturas  = load(K.FACT, []);
    FM.db.ajustes   = load(K.AJUST, structuredClone(DEFAULT_AJUSTES));
    FM.db.ventas    = load(K.VENTAS, []);
  }

  function persistAll(){
    save(K.PROV, FM.db.proveedor);
    save(K.CLIENTE, FM.db.clientes);
    save(K.PROD, FM.db.productos);
    save(K.TARAS, FM.db.taras);
    save(K.FACT, FM.db.facturas);
    save(K.AJUST, FM.db.ajustes);
    save(K.VENTAS, FM.db.ventas);
  }

  /* =========================
     UI: TABS
  ========================= */
  function setActiveTab(id){
    FM.ui.activeTab = id;
    $$('.pane').forEach(p => p.classList.toggle('is-active', p.id === id));
    $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));
  }

  function bindTabs(){
    $$('.tab').forEach(btn=>{
      on(btn,'click', ()=>{
        const tabId = btn.dataset.tab;
        if(tabId === 'tabContabilidad'){
          if(!FM.unlocked.cont){ return requestPIN('cont'); }
        }
        if(tabId === 'tabVentas'){
          if(!FM.unlocked.ventas){ return requestPIN('ventas'); }
        }
        setActiveTab(tabId);
        // render listados al entrar (se completará en 3B/3C)
        FM.renderLists();
      });
    });
  }

  /* =========================
     PIN MODAL
  ========================= */
  let pinMode = null; // 'cont' | 'ventas'
  function requestPIN(mode){
    pinMode = mode;
    setText($('#pinTitle'), mode === 'ventas' ? 'Ventas diarias 🔒' : 'Contabilidad 🔒');
    setText($('#pinHint'), mode === 'ventas'
      ? 'Introduce el PIN 8410 para acceder a Ventas.'
      : 'Introduce el PIN configurado para acceder a Contabilidad.'
    );
    setText($('#pinWarn'), '');
    $('#pinInput').value = '';
    openModal('#pinModal');
    setTimeout(()=> $('#pinInput')?.focus(), 50);
  }

  function bindPIN(){
    on($('#btnPinOk'),'click', ()=> checkPIN());
    on($('#pinInput'),'keydown',(e)=>{
      if(e.key === 'Enter') checkPIN();
    });

    on($('#btnLockContabilidad'),'click', ()=>{
      FM.unlocked.cont = false;
      toast('Bloqueado','Contabilidad bloqueada.','warn');
      setActiveTab('tabFactura');
    });

    on($('#btnLockVentas'),'click', ()=>{
      FM.unlocked.ventas = false;
      toast('Bloqueado','Ventas bloqueadas.','warn');
      setActiveTab('tabFactura');
    });
  }

  function checkPIN(){
    const pin = ($('#pinInput')?.value || '').trim();
    if(pinMode === 'ventas'){
      if(pin === '8410'){
        FM.unlocked.ventas = true;
        closeModal('#pinModal');
        toast('Acceso','Ventas desbloqueadas.','ok');
        setActiveTab('tabVentas');
        FM.renderLists();
      }else{
        setText($('#pinWarn'), 'PIN incorrecto.');
        toast('Error','PIN incorrecto.','danger');
      }
      return;
    }

    // contabilidad: pin configurable
    const target = (FM.db.ajustes?.pinCont || '').trim();
    if(!target){
      setText($('#pinWarn'), 'No hay PIN configurado en Ajustes.');
      toast('Aviso','Configura el PIN en Ajustes primero.','warn');
      return;
    }
    if(pin === target){
      FM.unlocked.cont = true;
      closeModal('#pinModal');
      toast('Acceso','Contabilidad desbloqueada.','ok');
      setActiveTab('tabContabilidad');
      FM.renderLists();
    }else{
      setText($('#pinWarn'), 'PIN incorrecto.');
      toast('Error','PIN incorrecto.','danger');
    }
  }

  /* =========================
     FACTURA: ESTADO BASE
  ========================= */
  function blankFactura(){
    const d = now();
    const fechaISO = toISODate(d);
    return {
      id: uid(),
      numero: makeInvoiceNumber(d),
      fechaISO,
      tags: '',
      notas: '',
      obs: '',
      clienteId: '',
      clienteSnap: null,
      provSnap: null,
      chkTransporte: false,
      chkIvaIncluido: false,
      pagos: [],
      metodoPago: 'efectivo',
      estado: 'impagada',
      lineas: makeDefaultLineas(5),
      totals: {
        subtotal: 0, transporte: 0, iva: 0, total: 0, pendiente: 0
      },
      pdf: { lastBlobUrl: '' },
      cloud: { pdfUrl: '' }
    };
  }

  function makeDefaultLineas(n=5){
    const arr = [];
    for(let i=0;i<n;i++){
      arr.push({
        id: uid(),
        producto: '',
        modo: 'kg',          // kg/caja/ud
        cantidad: 0,
        bruto: 0,
        envaseId: '',
        envases: 0,
        taraTotal: 0,
        neto: 0,
        netoManual: false,
        precio: 0,
        origen: '',
        importe: 0,
        hints: { lastPrices: [] } // solo pantalla
      });
    }
    return arr;
  }

  FM.current = blankFactura();

  /* =========================
     UI: CARGA PROVEEDOR EN CAMPOS
  ========================= */
  function setProviderDefaultsIfEmpty(){
    const p = FM.db.proveedor || structuredClone(DEFAULT_PROVEEDOR);
    if(!$('#provNombre').value) $('#provNombre').value = p.nombre || DEFAULT_PROVEEDOR.nombre;
    if(!$('#provNif').value)    $('#provNif').value    = p.nif || DEFAULT_PROVEEDOR.nif;
    if(!$('#provDir').value)    $('#provDir').value    = p.dir || DEFAULT_PROVEEDOR.dir;
    if(!$('#provTel').value)    $('#provTel').value    = p.tel || DEFAULT_PROVEEDOR.tel;
    if(!$('#provEmail').value)  $('#provEmail').value  = p.email || DEFAULT_PROVEEDOR.email;
  }

  function loadProviderToUI(){
    const p = FM.db.proveedor || structuredClone(DEFAULT_PROVEEDOR);
    $('#provNombre').value = p.nombre || '';
    $('#provNif').value    = p.nif || '';
    $('#provDir').value    = p.dir || '';
    $('#provTel').value    = p.tel || '';
    $('#provEmail').value  = p.email || '';
  }

  function saveProviderFromUI(){
    FM.db.proveedor = {
      nombre: ($('#provNombre')?.value || '').trim(),
      nif:    ($('#provNif')?.value || '').trim(),
      dir:    ($('#provDir')?.value || '').trim(),
      tel:    ($('#provTel')?.value || '').trim(),
      email:  ($('#provEmail')?.value || '').trim()
    };
    save(K.PROV, FM.db.proveedor);
    toast('Proveedor','Guardado en local.','ok');
    FM.renderQR();
  }

  /* =========================
     UI: FACTURA METADATOS
  ========================= */
  function setFacturaMetaUI(){
    setText($('#facturaNumero'), FM.current.numero || 'FA-—');
    $('#facturaFecha').value = FM.current.fechaISO || toISODate(now());
    setText($('#facturaFechaES'), isoToES($('#facturaFecha').value));
    $('#facturaTags').value  = FM.current.tags || '';
    $('#facturaNotas').value = FM.current.notas || '';
    $('#facturaObs').value   = FM.current.obs || '';
    $('#chkTransporte').checked = !!FM.current.chkTransporte;
    $('#chkIvaIncluido').checked = !!FM.current.chkIvaIncluido;

    // pagos
    $('#pagoMetodo').value = FM.current.metodoPago || 'efectivo';
    $('#pagoFecha').value = FM.current.fechaISO || toISODate(now());
    $('#pagoImporte').value = '';
  }

  /* =========================
     UI: SELECTS (CLIENTES / TARAS / PRODUCTOS)
  ========================= */
  function fillClienteSelect(){
    const sel = $('#clienteSelect');
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">— Seleccionar —</option>` +
      FM.db.clientes
        .slice()
        .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
        .map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} · ${escapeHtml(c.nif||'')}</option>`)
        .join('');
    sel.value = prev || FM.current.clienteId || '';
  }

  function fillContClienteSelect(){
    const sel = $('#contCliente');
    if(!sel) return;
    sel.innerHTML = `<option value="">— Todos —</option>` +
      FM.db.clientes
        .slice()
        .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
        .map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
        .join('');
  }

  function fillTarasForEditors(){
    // para Producto editor (envase por defecto)
    const s1 = $('#proEdEnvase');
    if(s1){
      const prev = s1.value;
      s1.innerHTML = `<option value="">— (sin envase) —</option>` +
        FM.db.taras
          .slice()
          .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))
          .map(t => `<option value="${t.id}">${escapeHtml(t.nombre)} · ${money(t.peso)} kg</option>`)
          .join('');
      s1.value = prev || '';
    }
  }

  /* =========================
     GRID: RENDER BASE (celdas)  (lógica completa en 3B)
  ========================= */
  function renderLineasBase(){
    const tbody = $('#lineasBody');
    if(!tbody) return;

    const rows = FM.current.lineas || [];
    tbody.innerHTML = rows.map((ln, idx) => {
      return `
      <tr data-id="${ln.id}" data-idx="${idx}">
        <td>
          <input class="cellInput jsProd" type="text" placeholder="Producto..." value="${escapeHtml(ln.producto||'')}" />
          <div class="hint jsHint"></div>
        </td>
        <td>
          <select class="cellSelect jsModo">
            <option value="kg" ${ln.modo==='kg'?'selected':''}>kg</option>
            <option value="caja" ${ln.modo==='caja'?'selected':''}>caja</option>
            <option value="ud" ${ln.modo==='ud'?'selected':''}>ud</option>
          </select>
        </td>
        <td><input class="cellInput jsCant cellInput--mono" type="number" inputmode="decimal" step="0.01" value="${ln.cantidad||''}" /></td>
        <td><input class="cellInput jsBruto cellInput--mono" type="number" inputmode="decimal" step="0.01" value="${ln.bruto||''}" /></td>
        <td>
          <select class="cellSelect jsEnvase">
            <option value="">—</option>
            ${FM.db.taras.map(t=>`<option value="${t.id}" ${ln.envaseId===t.id?'selected':''}>${escapeHtml(t.nombre)}</option>`).join('')}
          </select>
        </td>
        <td><input class="cellInput jsEnvases cellInput--mono" type="number" inputmode="decimal" step="0.01" value="${ln.envases||''}" /></td>
        <td class="cellRight jsTara">${money(ln.taraTotal||0)}</td>
        <td><input class="cellInput jsNeto cellInput--mono" type="number" inputmode="decimal" step="0.01" value="${ln.neto||''}" /></td>
        <td><input class="cellInput jsPrecio cellInput--mono" type="number" inputmode="decimal" step="0.01" value="${ln.precio||''}" /></td>
        <td><input class="cellInput jsOrigen" type="text" value="${escapeHtml(ln.origen||'')}" /></td>
        <td class="cellRight jsImporte">${money(ln.importe||0)}</td>
        <td class="cellRight"><button class="cellDel jsDel" type="button" title="Eliminar">✕</button></td>
      </tr>`;
    }).join('');

    // alternancia de filas la hace CSS; aquí actualizamos hint general
    setText($('#gridHintRight'), `Líneas: ${rows.length}`);
  }

  /* =========================
     EVENTOS PRINCIPALES (base)
  ========================= */
  function bindFacturaBase(){
    on($('#btnProvGuardar'), 'click', saveProviderFromUI);

    on($('#btnRegenNumero'), 'click', ()=>{
      FM.current.numero = makeInvoiceNumber(now());
      setText($('#facturaNumero'), FM.current.numero);
      FM.renderQR();
      toast('Factura','Número regenerado.','ok');
    });

    on($('#facturaFecha'), 'change', ()=>{
      FM.current.fechaISO = $('#facturaFecha').value || toISODate(now());
      setText($('#facturaFechaES'), isoToES(FM.current.fechaISO));
      FM.renderQR();
      FM.recalcInvoice();
    });

    on($('#facturaTags'), 'input', ()=>{
      FM.current.tags = $('#facturaTags').value || '';
    });
    on($('#facturaNotas'), 'input', ()=>{
      FM.current.notas = $('#facturaNotas').value || '';
    });
    on($('#facturaObs'), 'input', ()=>{
      FM.current.obs = $('#facturaObs').value || '';
    });

    on($('#chkTransporte'), 'change', ()=>{
      FM.current.chkTransporte = $('#chkTransporte').checked;
      FM.recalcInvoice();
    });

    on($('#chkIvaIncluido'), 'change', ()=>{
      FM.current.chkIvaIncluido = $('#chkIvaIncluido').checked;
      FM.recalcInvoice();
    });

    on($('#btnAddIva4'), 'click', ()=>{
      // acción rápida: fuerza 4% en ajustes y recalcula (si luego quieres, lo cambias en Ajustes)
      FM.db.ajustes.ivaPct = 4;
      $('#setIva').value = '4';
      save(K.AJUST, FM.db.ajustes);
      toast('IVA','IVA ajustado a 4%.','ok');
      FM.recalcInvoice();
    });

    on($('#btnNuevaFactura'), 'click', ()=>{
      FM.current = blankFactura();
      setFacturaMetaUI();
      fillClienteSelect();
      renderLineasBase();
      FM.recalcInvoice();
      FM.renderQR();
      toast('Factura','Nueva factura creada.','ok');
    });

    on($('#btnVaciarLineas'), 'click', ()=>{
      FM.current.lineas = makeDefaultLineas(5);
      renderLineasBase();
      FM.recalcInvoice();
      toast('Líneas','Reiniciado a 5 líneas.','ok');
    });

    on($('#btnAddLinea'), 'click', ()=>{
      FM.current.lineas.push({
        id: uid(), producto:'', modo:'kg', cantidad:0, bruto:0, envaseId:'', envases:0,
        taraTotal:0, neto:0, netoManual:false, precio:0, origen:'', importe:0, hints:{lastPrices:[]}
      });
      renderLineasBase();
      FM.recalcInvoice();
    });

    on($('#btnGuardarFactura'), 'click', ()=>{
      // se completa en 3B/3C (validaciones, guardar/actualizar en listado)
      toast('Guardar','(pendiente) Se completa en 3B/3C.', 'warn');
    });

    on($('#btnDuplicarFactura'), 'click', ()=>{
      toast('Duplicar','(pendiente) Se completa en 3B/3C.', 'warn');
    });

    on($('#btnEliminarFactura'), 'click', ()=>{
      toast('Eliminar','(pendiente) Se completa en 3B/3C.', 'warn');
    });

    on($('#btnGenerarPDF'), 'click', async ()=>{
      toast('PDF','(pendiente) Motor PDF en 3C.', 'warn');
    });

    on($('#btnVerPDF'), 'click', ()=>{
      openModal('#pdfModal');
    });

    on($('#btnPdfImprimir'), 'click', ()=>{
      const fr = $('#pdfFrame');
      try{ fr?.contentWindow?.print(); }catch{}
    });

    on($('#btnPdfAbrir'), 'click', ()=>{
      const fr = $('#pdfFrame');
      const src = fr?.getAttribute('src') || '';
      if(src) window.open(src, '_blank');
      else toast('PDF','No hay PDF cargado.', 'warn');
    });

    on($('#btnPdfNube'), 'click', ()=>{
      toast('Nube','(pendiente) Upload PDF a Firebase en 3C.', 'warn');
    });

    on($('#btnWhatsApp'), 'click', ()=>{
      toast('WhatsApp','(pendiente) Texto WhatsApp en 3C.', 'warn');
    });

    // cliente selector
    on($('#clienteSelect'), 'change', ()=>{
      FM.current.clienteId = $('#clienteSelect').value || '';
      // en 3B se aplicará plantilla cliente (ivaIncluido/transporte/tags/pago)
      toast('Cliente','Cliente seleccionado.', 'ok', 1200);
      FM.recalcInvoice();
    });

    on($('#btnClienteNuevo'), 'click', ()=>{
      $('#clienteSelect').value = '';
      $('#cliNombre').value = '';
      $('#cliNif').value = '';
      $('#cliDir').value = '';
      $('#cliTel').value = '';
      $('#cliEmail').value = '';
      toast('Cliente','Nuevo cliente (rellena y guarda).','ok');
    });

    on($('#btnClienteGuardar'), 'click', ()=>{
      toast('Cliente','(pendiente) Guardado inline en 3B.', 'warn');
    });

    on($('#btnClienteEditarToggle'), 'click', ()=>{
      $('#clienteForm')?.classList.toggle('hidden');
    });

    // Grid eventos base (delegación)
    on($('#lineasBody'), 'input', (e)=>{
      // En 3B se hace cálculo completo, aquí solo “marca cambios”
      const tr = e.target.closest('tr');
      if(!tr) return;
      const id = tr.dataset.id;
      const ln = (FM.current.lineas||[]).find(x=>x.id===id);
      if(!ln) return;

      if(e.target.classList.contains('jsProd')) ln.producto = e.target.value;
      if(e.target.classList.contains('jsModo')) ln.modo = e.target.value;
      if(e.target.classList.contains('jsCant')) ln.cantidad = num(e.target.value);
      if(e.target.classList.contains('jsBruto')) ln.bruto = num(e.target.value);
      if(e.target.classList.contains('jsEnvase')) ln.envaseId = e.target.value;
      if(e.target.classList.contains('jsEnvases')) ln.envases = num(e.target.value);
      if(e.target.classList.contains('jsNeto')) { ln.neto = num(e.target.value); ln.netoManual = true; }
      if(e.target.classList.contains('jsPrecio')) ln.precio = num(e.target.value);
      if(e.target.classList.contains('jsOrigen')) ln.origen = e.target.value;

      FM.recalcInvoice();
    });

    on($('#lineasBody'), 'change', (e)=>{
      // para select modo/envase (mismo flujo que input)
      if(e.target.classList.contains('jsModo') || e.target.classList.contains('jsEnvase')){
        FM.recalcInvoice();
      }
    });

    on($('#lineasBody'), 'click', (e)=>{
      if(!e.target.classList.contains('jsDel')) return;
      const tr = e.target.closest('tr');
      if(!tr) return;
      const id = tr.dataset.id;
      FM.current.lineas = (FM.current.lineas||[]).filter(x=>x.id !== id);
      if(FM.current.lineas.length === 0) FM.current.lineas = makeDefaultLineas(5);
      renderLineasBase();
      FM.recalcInvoice();
    });
  }

  /* =========================
     AJUSTES: UI BASE
  ========================= */
  function loadAjustesToUI(){
    const a = FM.db.ajustes || structuredClone(DEFAULT_AJUSTES);
    $('#setIva').value = (a.ivaPct ?? 4);
    $('#setTransporte').value = (a.transportePct ?? 10);
    $('#setPinCont').value = (a.pinCont ?? '');
    $('#setQrBase').value = (a.qrBase ?? DEFAULT_AJUSTES.qrBase);

    $('#fbApiKey').value = a.firebase?.apiKey || '';
    $('#fbAuthDomain').value = a.firebase?.authDomain || '';
    $('#fbDbUrl').value = a.firebase?.databaseURL || '';
    $('#fbProjectId').value = a.firebase?.projectId || '';
    $('#fbAppId').value = a.firebase?.appId || '';
    $('#fbStorageBucket').value = a.firebase?.storageBucket || '';
  }

  function bindAjustesBase(){
    const persist = () => {
      const a = FM.db.ajustes;
      a.ivaPct = num($('#setIva').value) || 0;
      a.transportePct = num($('#setTransporte').value) || 0;
      a.pinCont = ($('#setPinCont').value || '').trim();
      a.qrBase = ($('#setQrBase').value || '').trim() || DEFAULT_AJUSTES.qrBase;

      a.firebase = {
        apiKey: ($('#fbApiKey').value||'').trim(),
        authDomain: ($('#fbAuthDomain').value||'').trim(),
        databaseURL: ($('#fbDbUrl').value||'').trim(),
        projectId: ($('#fbProjectId').value||'').trim(),
        appId: ($('#fbAppId').value||'').trim(),
        storageBucket: ($('#fbStorageBucket').value||'').trim()
      };

      save(K.AJUST, a);
      FM.renderQR();
      FM.recalcInvoice();
    };

    on($('#setIva'),'input', persist);
    on($('#setTransporte'),'input', persist);
    on($('#setPinCont'),'input', persist);
    on($('#setQrBase'),'input', persist);

    on($('#fbApiKey'),'input', persist);
    on($('#fbAuthDomain'),'input', persist);
    on($('#fbDbUrl'),'input', persist);
    on($('#fbProjectId'),'input', persist);
    on($('#fbAppId'),'input', persist);
    on($('#fbStorageBucket'),'input', persist);

    on($('#btnFbGuardar'),'click', ()=>{
      persist();
      toast('Cloud','Configuración guardada (si está completa, 3C activa Firebase).','ok');
    });
    on($('#btnFbTest'),'click', ()=>{
      toast('Cloud','Test se activa en 3C (Firebase).','warn');
    });
    on($('#btnFbLogout'),'click', ()=>{
      toast('Cloud','Logout se activa en 3C (Firebase).','warn');
    });
  }

  /* =========================
     SHORTCUTS (Ctrl+S / Ctrl+P / Ctrl+F)
  ========================= */
  function bindShortcuts(){
    on(document, 'keydown', (e)=>{
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      if(ctrl && e.key.toLowerCase() === 's'){
        e.preventDefault();
        $('#btnGuardarFactura')?.click();
      }
      if(ctrl && e.key.toLowerCase() === 'p'){
        e.preventDefault();
        $('#btnGenerarPDF')?.click();
      }
      if(ctrl && e.key.toLowerCase() === 'f'){
        e.preventDefault();
        $('#btnQuickSearch')?.click();
      }
    });

    on($('#btnQuickSearch'),'click', ()=>{
      // en 3C se abre buscador del tab actual; aquí foco rápido
      const t = FM.ui.activeTab;
      if(t === 'tabFacturas') $('#facturasBuscar')?.focus();
      else if(t === 'tabClientes') $('#clientesBuscar')?.focus();
      else if(t === 'tabProductos') $('#productosBuscar')?.focus();
      else if(t === 'tabTaras') $('#tarasBuscar')?.focus();
      else toast('Buscar','Ve a Facturas/Clientes/Productos/Taras para buscar.', 'warn');
    });
  }

  /* =========================
     STATUS PILL
  ========================= */
  function setStatus(localText='Local'){
    setText($('#statusText'), localText);
    // dot: negro por defecto; en 3C cambiará a “Cloud” si login ok
  }

  /* =========================
     INIT
  ========================= */
  function init(){
    bindModalBasics();
    bindTabs();
    bindPIN();
    bindShortcuts();

    seedIfEmpty();
    loadDB();

    // UI base
    setStatus('Local');
    setText($('#appVersion'), FM.version);

    loadProviderToUI();
    setProviderDefaultsIfEmpty();

    fillClienteSelect();
    fillContClienteSelect();
    fillTarasForEditors();

    loadAjustesToUI();
    bindAjustesBase();

    // factura base
    setFacturaMetaUI();
    renderLineasBase();

    // Totales iniciales (se calcula real en 3B)
    setText($('#totSubtotal'), '0,00');
    setText($('#totTransporte'), '0,00');
    setText($('#totIva'), '0,00');
    setText($('#totTotal'), '0,00');
    setText($('#totPendiente'), '0,00');

    // bind factura base (después de render grid)
    bindFacturaBase();

    // QR base (texto fallback, render real en 3C)
    FM.renderQR();

    // 3C: cloud init opcional
    // FM.cloud.initIfConfigured();

    toast('Listo','Factu Miral cargado (Offline).', 'ok');
  }

  // Render QR fallback simple (texto). En 3C se sustituye por QR real.
  FM.renderQR = function(){
    try{
      const provNif = ($('#provNif')?.value || FM.db.proveedor?.nif || '').trim();
      const numFac = (FM.current?.numero || '').trim();
      const fecha = (FM.current?.fechaISO || '').trim();
      const total = money(FM.current?.totals?.total || 0);

      const base = (FM.db.ajustes?.qrBase || DEFAULT_AJUSTES.qrBase);
      const txt = base
        .replaceAll('{NIF}', provNif || '')
        .replaceAll('{NUM}', numFac || '')
        .replaceAll('{FECHA}', fecha || '')
        .replaceAll('{TOTAL}', total || '');

      setText($('#qrText'), txt || '—');

      const wrap = $('#qrCanvasWrap');
      if(wrap){
        wrap.innerHTML = `<div class="center" style="text-align:center">
          <div style="font-family:var(--mono);font-weight:900;font-size:12px;">QR (pendiente)</div>
          <div style="margin-top:6px;font-family:var(--mono);font-size:11px;color:#5b6474;">Se genera en 3C</div>
        </div>`;
      }
    }catch{
      // no crash
    }
  };

  // Start
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

/* =========================================================
PARTE 3B/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (CONTINÚA DESPUÉS DE 3A)

⚠️ CORRECCIÓN IMPORTANTE (para cierres perfectos):
En la PARTE 3A que te di antes, al final aparece:
})(); // FIN PARTE 3A
👉 BORRA ESA ÚLTIMA LÍNEA (solo esa), porque si no, 3B/3C quedarían fuera del cierre.
Luego pega 3B y 3C justo después. (No borres nada más.)
========================================================= */

/* =========================
   BUSCADORES / MATCH
========================= */
function normName(s){
  return (s ?? '').toString().trim().toUpperCase();
}
function findProductoByName(name){
  const n = normName(name);
  if(!n) return null;
  return (FM.db.productos || []).find(p => normName(p.nombre) === n) || null;
}
function findClienteById(id){
  return (FM.db.clientes || []).find(c => c.id === id) || null;
}
function findTaraById(id){
  return (FM.db.taras || []).find(t => t.id === id) || null;
}
function sumPagos(pagos){
  return (pagos || []).reduce((a,p)=> a + num(p.importe), 0);
}

/* =========================
   VALIDACIONES (soft)
========================= */
function pushWarn(list, msg){
  if(!msg) return;
  list.push(msg);
}
function renderWarnings(warns){
  const box = $('#warnings');
  if(!box) return;
  box.innerHTML = '';
  if(!warns || warns.length===0) return;
  warns.slice(0,6).forEach(w=>{
    const d = document.createElement('div');
    d.className = 'warnItem';
    d.textContent = w;
    box.appendChild(d);
  });
}

/* =========================
   HINTS (últimos precios SOLO pantalla)
========================= */
function updateLineHints(tr, ln){
  const hint = $('.jsHint', tr);
  if(!hint) return;
  const prod = findProductoByName(ln.producto);
  if(!prod || !Array.isArray(prod.hist) || prod.hist.length === 0){
    hint.textContent = '';
    return;
  }
  const items = prod.hist.slice(0,5).map(h => {
    const f = isoToES(h.fechaISO || '');
    const px = money(h.precio || 0);
    const m = (h.modo || '').toUpperCase();
    return `${f} · ${px}€ · ${m}`;
  });
  hint.textContent = `Últimos: ${items.join(' | ')}`;
}

/* =========================
   AUTORELLENO ENVASES
   - Si hay envase y envases=0, por defecto envases=cantidad
   - Especialmente útil en KG: "10 cajas" => envases=10 => tara=0,3*10
========================= */
function autoEnvases(ln){
  const hasEnv = !!ln.envaseId;
  if(!hasEnv) return;
  const env = num(ln.envases);
  const cant = num(ln.cantidad);
  if(env > 0) return;

  // Autorelleno recomendado
  if(cant > 0){
    ln.envases = cant;
  }
}

/* =========================
   CÁLCULOS POR LÍNEA (CORRECTOS)
   KG:
     taraTotal = envases * taraUnidad
     netoAuto  = bruto - taraTotal
     importe   = neto * precio
   CAJA:
     importe   = cantidad * precioCaja
     neto info = cantidad * kgCaja (si existe)
   UD:
     importe   = cantidad * precioUd
========================= */
function calcLinea(ln){
  const warns = [];
  const modo = (ln.modo || 'kg');
  const prod = findProductoByName(ln.producto);

  // Defaults de producto (solo ayuda, NO sobrescribe texto producto)
  if(prod){
    // origen por defecto si vacío
    if(!ln.origen && prod.origen) ln.origen = prod.origen;

    // modo por defecto si vacío
    if(!ln.modo) ln.modo = prod.modo || 'kg';

    // precio sugerido si el usuario no puso precio (0)
    if(num(ln.precio) === 0){
      if(modo === 'kg'  && num(prod.pKg)   > 0) ln.precio = num(prod.pKg);
      if(modo === 'caja'&& num(prod.pCaja) > 0) ln.precio = num(prod.pCaja);
      if(modo === 'ud'  && num(prod.pUd)   > 0) ln.precio = num(prod.pUd);
    }

    // envase por defecto si vacío
    if(!ln.envaseId && prod.envaseId) ln.envaseId = prod.envaseId;
  }

  // Tara
  autoEnvases(ln);
  const taraObj = findTaraById(ln.envaseId);
  const taraUnit = taraObj ? num(taraObj.peso) : 0;
  const envases = num(ln.envases);
  ln.taraTotal = round2(envases * taraUnit);

  // Validación precio
  if(num(ln.precio) <= 0 && (ln.producto || num(ln.cantidad) || num(ln.bruto))) {
    pushWarn(warns, `Precio vacío/0 en "${ln.producto || 'línea'}"`);
  }

  // Cálculo por modo
  if(modo === 'kg'){
    const bruto = num(ln.bruto);
    if(bruto > 0 && ln.taraTotal > bruto){
      pushWarn(warns, `Tara > bruto en "${ln.producto || 'línea'}"`);
    }

    // Neto auto si no está en manual
    if(!ln.netoManual){
      ln.neto = round2(bruto - ln.taraTotal);
    }

    if(num(ln.neto) > bruto && bruto > 0){
      pushWarn(warns, `Neto > bruto en "${ln.producto || 'línea'}"`);
    }

    ln.importe = round2(num(ln.neto) * num(ln.precio));
  }

  if(modo === 'caja'){
    const cant = num(ln.cantidad);
    ln.importe = round2(cant * num(ln.precio));

    // Neto informativo si existe kg/caja
    if(!ln.netoManual){
      const kgCaja = prod ? num(prod.kgCaja) : 0;
      if(kgCaja > 0){
        ln.neto = round2(cant * kgCaja);
      }else{
        // si no hay kgCaja, dejamos neto como está (0 por defecto)
        ln.neto = num(ln.neto) || 0;
      }
    }
  }

  if(modo === 'ud'){
    const cant = num(ln.cantidad);
    ln.importe = round2(cant * num(ln.precio));
    if(!ln.netoManual){
      // neto no aplica, mantenemos 0
      ln.neto = num(ln.neto) || 0;
    }
  }

  // limpieza: si la línea está vacía, no “ensuciar” warnings
  const isEmpty =
    !ln.producto && num(ln.cantidad)===0 && num(ln.bruto)===0 && num(ln.precio)===0 && !ln.origen;
  if(isEmpty){
    ln.taraTotal = 0;
    ln.importe = 0;
    if(!ln.netoManual) ln.neto = 0;
  }

  return warns;
}

/* =========================
   REFRESCAR UNA FILA EN UI
========================= */
function syncLineaToRow(tr, ln){
  if(!tr) return;
  const tTara = $('.jsTara', tr);
  const tImp  = $('.jsImporte', tr);
  if(tTara) tTara.textContent = money(ln.taraTotal || 0);
  if(tImp)  tImp.textContent  = money(ln.importe || 0);

  // neto auto: actualizar input neto solo si NO manual
  const inNeto = $('.jsNeto', tr);
  if(inNeto && !ln.netoManual){
    inNeto.value = (num(ln.neto) ? String(ln.neto).replace('.', '.') : '');
  }

  // envases auto: si se autollenó, reflejar
  const inEnv = $('.jsEnvases', tr);
  if(inEnv && num(inEnv.value)===0 && num(ln.envases)>0){
    inEnv.value = ln.envases;
  }

  updateLineHints(tr, ln);
}

/* =========================
   RECALC FACTURA (tiempo real)
========================= */
FM.recalcInvoice = function(){
  try{
    const warns = [];

    const lines = FM.current.lineas || [];
    const tbody = $('#lineasBody');

    lines.forEach((ln, idx)=>{
      const w = calcLinea(ln);
      w.forEach(x=>pushWarn(warns, x));

      // sync UI row if exists
      if(tbody){
        const tr = tbody.querySelector(`tr[data-id="${ln.id}"]`);
        if(tr) syncLineaToRow(tr, ln);
      }
    });

    // Totales
    const subtotal = round2(lines.reduce((a,l)=> a + num(l.importe), 0));
    const tPct = num(FM.db.ajustes?.transportePct ?? 10);
    const ivaPct = num(FM.db.ajustes?.ivaPct ?? 4);

    const transporte = FM.current.chkTransporte ? round2(subtotal * tPct / 100) : 0;
    const base = round2(subtotal + transporte);

    // IVA: si IVA incluido, NO se imprime desglose (aquí lo dejamos en 0 para totals visuales)
    const ivaCalc = round2(base * ivaPct / 100);
    const iva = FM.current.chkIvaIncluido ? 0 : ivaCalc;

    const total = FM.current.chkIvaIncluido ? base : round2(base + iva);
    const pagado = round2(sumPagos(FM.current.pagos));
    const pendiente = round2(total - pagado);

    FM.current.totals = {
      subtotal, transporte, iva,
      ivaInterno: ivaCalc, // para contabilidad interna (aunque “IVA incluido” no lo muestre)
      total, pendiente
    };

    // Estado automático
    if(pendiente <= 0 && total > 0){
      FM.current.estado = 'pagada';
    }else if(pagado > 0 && pendiente > 0){
      FM.current.estado = 'parcial';
    }else{
      FM.current.estado = 'impagada';
    }

    // Pintar totales
    setText($('#totSubtotal'), money(subtotal));
    setText($('#totTransporte'), money(transporte));
    setText($('#totIva'), money(iva));
    setText($('#totTotal'), money(total));
    setText($('#totPendiente'), money(Math.max(0,pendiente)));

    // warnings
    renderWarnings(warns);

    // QR
    FM.renderQR();
  }catch(err){
    // no crash
    console.warn(err);
  }
};

/* =========================
   GUARDAR / DUPLICAR / ELIMINAR FACTURA
========================= */
function snapshotProveedor(){
  return {
    nombre: ($('#provNombre')?.value || '').trim(),
    nif:    ($('#provNif')?.value || '').trim(),
    dir:    ($('#provDir')?.value || '').trim(),
    tel:    ($('#provTel')?.value || '').trim(),
    email:  ($('#provEmail')?.value || '').trim()
  };
}
function snapshotCliente(){
  const cid = FM.current.clienteId;
  const c = findClienteById(cid);
  if(!c) return null;
  return structuredClone({
    nombre: c.nombre, alias: c.alias, nif: c.nif, dir: c.dir, tel: c.tel, email: c.email
  });
}
function isFacturaValid(){
  // “críticos”: proveedor nif + numero + fecha + cliente + al menos 1 línea con producto
  const provNif = ($('#provNif')?.value || '').trim();
  if(!provNif) return {ok:false, msg:'Falta NIF del proveedor.'};

  if(!FM.current.numero) return {ok:false, msg:'Falta número de factura.'};
  if(!FM.current.fechaISO) return {ok:false, msg:'Falta fecha de factura.'};
  if(!FM.current.clienteId) return {ok:false, msg:'Selecciona un cliente.'};

  const hasLine = (FM.current.lineas||[]).some(l => normName(l.producto));
  if(!hasLine) return {ok:false, msg:'Añade al menos 1 producto.'};

  return {ok:true, msg:''};
}

function updatePriceHistoryFromInvoice(){
  const fechaISO = FM.current.fechaISO;
  (FM.current.lineas||[]).forEach(ln=>{
    const p = findProductoByName(ln.producto);
    if(!p) return;
    const precio = num(ln.precio);
    if(precio <= 0) return;

    const entry = { fechaISO, precio, modo: ln.modo || 'kg' };
    p.hist = Array.isArray(p.hist) ? p.hist : [];
    p.hist.unshift(entry);

    // dedupe simple (misma fecha+precio+modo)
    const seen = new Set();
    p.hist = p.hist.filter(h=>{
      const k = `${h.fechaISO}|${h.precio}|${h.modo}`;
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0,5);

    // también guardamos precios base por modo si quieres (opcional y útil):
    if(ln.modo === 'kg') p.pKg = precio;
    if(ln.modo === 'caja') p.pCaja = precio;
    if(ln.modo === 'ud') p.pUd = precio;
  });

  save(K.PROD, FM.db.productos);
}

function saveFactura(){
  FM.recalcInvoice();

  const v = isFacturaValid();
  if(!v.ok){
    toast('Falta', v.msg, 'warn');
    return;
  }

  FM.current.provSnap = snapshotProveedor();
  FM.current.clienteSnap = snapshotCliente();

  const idx = (FM.db.facturas||[]).findIndex(f => f.id === FM.current.id);
  if(idx >= 0){
    FM.db.facturas[idx] = structuredClone(FM.current);
  }else{
    FM.db.facturas.unshift(structuredClone(FM.current));
  }
  save(K.FACT, FM.db.facturas);

  updatePriceHistoryFromInvoice();

  toast('Guardado', `Factura ${FM.current.numero} guardada.`, 'ok');
  FM.renderLists();
}

function duplicateFactura(){
  FM.recalcInvoice();
  const src = structuredClone(FM.current);

  const d = now();
  src.id = uid();
  src.numero = makeInvoiceNumber(d);
  src.fechaISO = toISODate(d);

  // reset pagos/estado/pdf/cloud
  src.pagos = [];
  src.estado = 'impagada';
  src.pdf = { lastBlobUrl: '' };
  src.cloud = { pdfUrl: '' };

  // netoManual se respeta; si quieres reiniciar, quítalo aquí
  FM.current = src;

  setFacturaMetaUI();
  fillClienteSelect();
  renderLineasBase();
  FM.recalcInvoice();
  toast('Duplicada', `Nueva ${FM.current.numero}`, 'ok');
}

function deleteFactura(){
  const numFac = FM.current.numero;
  FM.db.facturas = (FM.db.facturas||[]).filter(f => f.id !== FM.current.id);
  save(K.FACT, FM.db.facturas);

  FM.current = blankFactura();
  setFacturaMetaUI();
  fillClienteSelect();
  renderLineasBase();
  FM.recalcInvoice();

  toast('Eliminada', `${numFac} eliminada.`, 'ok');
  FM.renderLists();
}

/* enganchar botones reales (si existen en tu index) */
(function bindFacturaButtons_3B(){
  on($('#btnGuardarFactura'), 'click', saveFactura);
  on($('#btnDuplicarFactura'), 'click', duplicateFactura);
  on($('#btnEliminarFactura'), 'click', deleteFactura);
})();

/* =========================
   CLIENTE INLINE (en FACTURA)
========================= */
function clientInlineToUI(c){
  $('#cliNombre').value = c?.nombre || '';
  $('#cliNif').value    = c?.nif || '';
  $('#cliDir').value    = c?.dir || '';
  $('#cliTel').value    = c?.tel || '';
  $('#cliEmail').value  = c?.email || '';
}
function applyClienteTemplateToFactura(c){
  if(!c || !c.tpl) return;

  // IVA incluido
  if(typeof c.tpl.ivaIncluido === 'boolean'){
    FM.current.chkIvaIncluido = !!c.tpl.ivaIncluido;
    $('#chkIvaIncluido').checked = FM.current.chkIvaIncluido;
  }
  // transporte
  if(typeof c.tpl.transporte === 'boolean'){
    FM.current.chkTransporte = !!c.tpl.transporte;
    $('#chkTransporte').checked = FM.current.chkTransporte;
  }
  // tags automáticos (no pisa si ya hay)
  if(c.tpl.tags && !(FM.current.tags||'').trim()){
    FM.current.tags = c.tpl.tags;
    $('#facturaTags').value = FM.current.tags;
  }
  // método pago
  if(c.tpl.pago){
    FM.current.metodoPago = c.tpl.pago.toLowerCase();
    $('#pagoMetodo').value = FM.current.metodoPago;
  }
  FM.recalcInvoice();
}

(function bindClienteInline_3B(){
  // cuando cambias selector: rellena inline
  on($('#clienteSelect'), 'change', ()=>{
    const cid = $('#clienteSelect').value || '';
    FM.current.clienteId = cid;
    const c = findClienteById(cid);
    if(c){
      clientInlineToUI(c);
      applyClienteTemplateToFactura(c);
    }
    FM.recalcInvoice();
  });

  on($('#btnClienteGuardar'), 'click', ()=>{
    const cid = $('#clienteSelect')?.value || '';
    const data = {
      nombre: ($('#cliNombre').value||'').trim(),
      nif:    ($('#cliNif').value||'').trim(),
      dir:    ($('#cliDir').value||'').trim(),
      tel:    ($('#cliTel').value||'').trim(),
      email:  ($('#cliEmail').value||'').trim()
    };
    if(!data.nombre){
      toast('Cliente','Falta nombre.', 'warn'); return;
    }

    if(cid){
      const c = findClienteById(cid);
      if(c){
        c.nombre = data.nombre; c.nif=data.nif; c.dir=data.dir; c.tel=data.tel; c.email=data.email;
        save(K.CLIENTE, FM.db.clientes);
        toast('Cliente','Actualizado.', 'ok');
      }
    }else{
      const c = {
        id: uid(),
        nombre: data.nombre,
        alias: '',
        nif: data.nif,
        dir: data.dir,
        tel: data.tel,
        email: data.email,
        notas: '',
        tpl: { ivaIncluido:false, transporte:false, pago:'', tags:'', notaStd:'' }
      };
      FM.db.clientes.unshift(c);
      save(K.CLIENTE, FM.db.clientes);
      fillClienteSelect();
      $('#clienteSelect').value = c.id;
      FM.current.clienteId = c.id;
      toast('Cliente','Creado.', 'ok');
    }
    fillContClienteSelect();
    FM.renderLists();
  });
})();

/* =========================
   PAGOS (parciales)
========================= */
function renderPagos(){
  const box = $('#payList');
  if(!box) return;
  const pagos = FM.current.pagos || [];
  if(pagos.length===0){
    box.innerHTML = `<div style="padding:12px;color:#5b6474;font-weight:800">Sin pagos</div>`;
    return;
  }
  box.innerHTML = pagos.map(p=>`
    <div class="totRow" style="margin:10px">
      <div>
        <div class="totKey">${escapeHtml(isoToES(p.fechaISO||''))}</div>
        <div class="hint">${escapeHtml((p.metodo||FM.current.metodoPago||'').toString())}</div>
      </div>
      <div class="totVal">${money(p.importe)}€</div>
      <button class="btn btn--danger btn--xs jsPayDel" data-id="${p.id}" type="button">Eliminar</button>
    </div>
  `).join('');

  $$('.jsPayDel', box).forEach(b=>{
    on(b,'click', ()=>{
      const id = b.dataset.id;
      FM.current.pagos = (FM.current.pagos||[]).filter(x=>x.id!==id);
      renderPagos();
      FM.recalcInvoice();
    });
  });
}

(function bindPagos_3B(){
  const btn = $('#btnPagoAdd');
  if(btn){
    on(btn,'click', ()=>{
      const imp = num($('#pagoImporte')?.value);
      const fechaISO = ($('#pagoFecha')?.value || FM.current.fechaISO || toISODate(now()));
      const metodo = ($('#pagoMetodo')?.value || FM.current.metodoPago || 'efectivo');

      if(imp <= 0){
        toast('Pago','Importe inválido.', 'warn'); return;
      }
      FM.current.metodoPago = metodo;
      FM.current.pagos = FM.current.pagos || [];
      FM.current.pagos.unshift({ id: uid(), fechaISO, importe: round2(imp), metodo });

      $('#pagoImporte').value = '';
      renderPagos();
      FM.recalcInvoice();
      toast('Pago','Añadido.', 'ok');
    });
  }

  // render inicial
  renderPagos();

  on($('#pagoMetodo'),'change', ()=>{
    FM.current.metodoPago = $('#pagoMetodo').value || 'efectivo';
  });
})();

/* =========================
   LISTADOS (Facturas/Clientes/Productos/Taras)
========================= */
function renderFacturasList(){
  const wrap = $('#facturasList');
  if(!wrap) return;

  const q = ($('#facturasBuscar')?.value || '').trim().toUpperCase();
  const rows = (FM.db.facturas||[]).filter(f=>{
    if(!q) return true;
    const numf = (f.numero||'').toUpperCase();
    const cli  = (f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '').toUpperCase();
    const tags = (f.tags||'').toUpperCase();
    const fecha = (f.fechaISO||'').toUpperCase();
    return numf.includes(q) || cli.includes(q) || tags.includes(q) || fecha.includes(q);
  });

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead>
          <tr><th>Fecha</th><th>Nº</th><th>Cliente</th><th>Tags</th><th>Total</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${rows.map(f=>{
            const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';
            return `
              <tr>
                <td class="mono">${escapeHtml(isoToES(f.fechaISO))}</td>
                <td class="mono"><b>${escapeHtml(f.numero||'')}</b></td>
                <td>${escapeHtml(cli)}</td>
                <td class="mono">${escapeHtml(f.tags||'')}</td>
                <td class="mono">${money(f.totals?.total||0)}€</td>
                <td class="mono">${escapeHtml(f.estado||'')}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn--xs jsFacEdit" data-id="${f.id}" type="button">Editar</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  $$('.jsFacEdit', wrap).forEach(b=>{
    on(b,'click', ()=>{
      const id = b.dataset.id;
      const f = (FM.db.facturas||[]).find(x=>x.id===id);
      if(!f) return;
      FM.current = structuredClone(f);

      // UI
      setFacturaMetaUI();
      fillClienteSelect();
      renderLineasBase();
      renderPagos();
      FM.recalcInvoice();

      setActiveTab('tabFactura');
      toast('Factura','Abierta para edición.', 'ok');
    });
  });
}

function renderClientesList(){
  const wrap = $('#clientesList');
  if(!wrap) return;

  const q = ($('#clientesBuscar')?.value || '').trim().toUpperCase();
  const rows = (FM.db.clientes||[]).filter(c=>{
    if(!q) return true;
    return (c.nombre||'').toUpperCase().includes(q) ||
           (c.nif||'').toUpperCase().includes(q) ||
           (c.dir||'').toUpperCase().includes(q);
  });

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead>
          <tr><th>Nombre</th><th>NIF/CIF</th><th>Dirección</th><th>Tel</th><th>Email</th></tr>
        </thead>
        <tbody>
          ${rows.map(c=>`
            <tr>
              <td><b>${escapeHtml(c.nombre||'')}</b></td>
              <td class="mono">${escapeHtml(c.nif||'')}</td>
              <td>${escapeHtml(c.dir||'')}</td>
              <td class="mono">${escapeHtml(c.tel||'')}</td>
              <td class="mono">${escapeHtml(c.email||'')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderProductosList(){
  const wrap = $('#productosList');
  if(!wrap) return;

  const q = ($('#productosBuscar')?.value || '').trim().toUpperCase();
  const rows = (FM.db.productos||[]).filter(p=>{
    if(!q) return true;
    return (p.nombre||'').toUpperCase().includes(q);
  }).slice(0,800); // seguridad UI

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead>
          <tr><th>Producto</th><th>Modo</th><th>€/kg</th><th>€/caja</th><th>€/ud</th><th>Kg/caja</th><th>Envase</th></tr>
        </thead>
        <tbody>
          ${rows.map(p=>{
            const env = p.envaseId ? (findTaraById(p.envaseId)?.nombre || '') : '';
            return `
              <tr>
                <td><b>${escapeHtml(p.nombre||'')}</b></td>
                <td class="mono">${escapeHtml((p.modo||'kg').toUpperCase())}</td>
                <td class="mono">${money(p.pKg||0)}</td>
                <td class="mono">${money(p.pCaja||0)}</td>
                <td class="mono">${money(p.pUd||0)}</td>
                <td class="mono">${money(p.kgCaja||0)}</td>
                <td>${escapeHtml(env)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTarasList(){
  const wrap = $('#tarasList');
  if(!wrap) return;

  const q = ($('#tarasBuscar')?.value || '').trim().toUpperCase();
  const rows = (FM.db.taras||[]).filter(t=>{
    if(!q) return true;
    return (t.nombre||'').toUpperCase().includes(q);
  });

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead>
          <tr><th>Envase/Tara</th><th>Peso (kg)</th><th>Notas</th></tr>
        </thead>
        <tbody>
          ${rows.map(t=>`
            <tr>
              <td><b>${escapeHtml(t.nombre||'')}</b></td>
              <td class="mono">${money(t.peso||0)}</td>
              <td>${escapeHtml(t.notas||'')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* Hook renderLists global */
FM.renderLists = function(){
  try{
    renderFacturasList();
    renderClientesList();
    renderProductosList();
    renderTarasList();
  }catch(e){
    console.warn(e);
  }
};

/* binds de búsqueda */
(function bindSearch_3B(){
  on($('#facturasBuscar'),'input', ()=> renderFacturasList());
  on($('#clientesBuscar'),'input', ()=> renderClientesList());
  on($('#productosBuscar'),'input', ()=> renderProductosList());
  on($('#tarasBuscar'),'input', ()=> renderTarasList());
})();

/* =========================
   ENTRADA PRO: ENTER AVANZA + CREA NUEVA LÍNEA
========================= */
(function bindEnterFlow_3B(){
  const body = $('#lineasBody');
  if(!body) return;

  on(body, 'keydown', (e)=>{
    if(e.key !== 'Enter') return;

    const tr = e.target.closest('tr');
    if(!tr) return;

    const focusables = [
      '.jsProd', '.jsModo', '.jsCant', '.jsBruto', '.jsEnvase', '.jsEnvases',
      '.jsNeto', '.jsPrecio', '.jsOrigen'
    ];
    const list = focusables.map(sel => $(sel, tr)).filter(Boolean);

    const idx = list.indexOf(e.target);
    if(idx < 0) return;

    e.preventDefault();

    // si último campo => crear línea y foco producto nueva
    if(idx === list.length - 1){
      $('#btnAddLinea')?.click();
      setTimeout(()=>{
        const lastTr = body.querySelector('tr:last-child');
        const inp = lastTr ? $('.jsProd', lastTr) : null;
        inp?.focus();
      }, 30);
      return;
    }

    // avanzar foco
    const next = list[idx+1];
    next?.focus();
    next?.select?.();
  });
})();

/* =========================
   FIN PARTE 3B (NO CIERRES AQUÍ)
========================= */
/* =========================================================
PARTE 3C/3 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR DESPUÉS DE 3B)

✅ Esta parte añade:
- QR AEAT REAL (canvas) + copiar texto
- WhatsApp PRO
- PDF PRO (jsPDF si existe; si no, vista imprimible sin crash) + visor interno
- “Suma y sigue” + numeración páginas si hay jsPDF
- Contabilidad 🔒 (PIN) KPIs + filtros + export CSV
- Ventas diarias 🔒 (PIN 8410) San Pablo/San Lesmes/Santiago + reportes
- CRUD Clientes/Productos/Taras (si existen los elementos en el HTML)
- Cloud Firebase opcional (0 crash si no hay config o sin internet)
========================================================= */

/* =========================
   COMPAT: si falta algún elemento, NO CRASHEA
========================= */
function elExists(id){ return !!document.getElementById(id.replace('#','')); }
function safeSetVal(id, v){ const e=$(id); if(e) e.value = v; }
function safeGetVal(id){ const e=$(id); return e ? e.value : ''; }

/* =========================
   QR REAL (canvas) — mini QR generator (ligero)
   - No depende de internet
========================= */
/* eslint-disable */
function _qr_make(text, ecc){
  // Basado en qrcode-generator (K. Arase) — versión compacta
  // ecc: 'L','M','Q','H'
  const QRMode = { MODE_8BIT_BYTE: 1 };
  const QRErrorCorrectLevel = { L:1, M:0, Q:3, H:2 };
  const PAD0 = 0xEC, PAD1 = 0x11;

  function _b2(i){ return i<10?'0'+i:''+i; }
  function _utf8(s){
    const out=[]; for(let i=0;i<s.length;i++){
      const c=s.charCodeAt(i);
      if(c<0x80) out.push(c);
      else if(c<0x800){ out.push(0xC0|(c>>6), 0x80|(c&0x3F)); }
      else { out.push(0xE0|(c>>12), 0x80|((c>>6)&0x3F), 0x80|(c&0x3F)); }
    } return out;
  }

  function QRBitBuffer(){ this.buffer=[]; this.length=0; }
  QRBitBuffer.prototype = {
    get(i){ const b=Math.floor(i/8); return ((this.buffer[b] >>> (7 - i%8)) & 1) === 1; },
    put(num, len){
      for(let i=0;i<len;i++) this.putBit(((num >>> (len - i - 1)) & 1) === 1);
    },
    putBit(bit){
      const b=Math.floor(this.length/8);
      if(this.buffer.length<=b) this.buffer.push(0);
      if(bit) this.buffer[b] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QRPolynomial(num, shift){
    let offset=0;
    while(offset<num.length && num[offset]===0) offset++;
    this.num = new Array(num.length-offset+shift);
    for(let i=0;i<num.length-offset;i++) this.num[i]=num[i+offset];
    for(let i=0;i<shift;i++) this.num[num.length-offset+i]=0;
  }
  QRPolynomial.prototype = {
    get(i){ return this.num[i]; },
    getLength(){ return this.num.length; },
    multiply(e){
      const num = new Array(this.getLength()+e.getLength()-1).fill(0);
      for(let i=0;i<this.getLength();i++){
        for(let j=0;j<e.getLength();j++){
          num[i+j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod(e){
      if(this.getLength()-e.getLength()<0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = this.num.slice();
      for(let i=0;i<e.getLength();i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  const QRMath = {
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256),
    glog(n){
      if(n<1) throw new Error("glog");
      return this.LOG_TABLE[n];
    },
    gexp(n){
      while(n<0) n += 255;
      while(n>=256) n -= 255;
      return this.EXP_TABLE[n];
    }
  };
  for(let i=0;i<8;i++) QRMath.EXP_TABLE[i]=1<<i;
  for(let i=8;i<256;i++) QRMath.EXP_TABLE[i]=QRMath.EXP_TABLE[i-4]^QRMath.EXP_TABLE[i-5]^QRMath.EXP_TABLE[i-6]^QRMath.EXP_TABLE[i-8];
  for(let i=0;i<255;i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]]=i;

  const RS_BLOCK_TABLE = [
    // type 2 (version 1..10 only; suficiente para facturas normales). Si necesitas más, lo ampliamos.
    [], // 0
    [1, 26, 19], // 1
    [1, 44, 34], // 2
    [1, 70, 55], // 3
    [1, 100, 80], // 4
    [1, 134, 108], // 5
    [2, 86, 68], // 6
    [2, 98, 78], // 7
    [2, 121, 97], // 8
    [2, 146, 116], // 9
    [2, 86, 68, 2, 87, 69] // 10 (aprox)
  ];

  function QRRSBlock(totalCount, dataCount){ this.totalCount=totalCount; this.dataCount=dataCount; }
  function getRSBlocks(typeNumber){
    const t = RS_BLOCK_TABLE[typeNumber];
    if(!t || t.length===0) throw new Error('RS table missing');
    const blocks=[];
    for(let i=0;i<t.length;i+=3){
      const count=t[i], total=t[i+1], data=t[i+2];
      for(let j=0;j<count;j++) blocks.push(new QRRSBlock(total, data));
    }
    return blocks;
  }

  function createData(typeNumber, data){
    const buffer = new QRBitBuffer();
    buffer.put(0x4, 4); // 8bit
    buffer.put(data.length, typeNumber < 10 ? 8 : 16);
    for(let i=0;i<data.length;i++) buffer.put(data[i], 8);

    const rsBlocks = getRSBlocks(typeNumber);
    let totalDataCount=0;
    for(const b of rsBlocks) totalDataCount += b.dataCount;

    // terminator
    if(buffer.length + 4 <= totalDataCount*8) buffer.put(0, 4);
    while(buffer.length % 8 !== 0) buffer.putBit(false);

    // padding
    while(buffer.buffer.length < totalDataCount){
      buffer.put(PAD0, 8);
      if(buffer.buffer.length >= totalDataCount) break;
      buffer.put(PAD1, 8);
    }
    return createBytes(buffer, rsBlocks);
  }

  function createBytes(buffer, rsBlocks){
    let offset=0;
    const dcdata=[], ecdata=[];
    let maxDcCount=0, maxEcCount=0;

    for(const rs of rsBlocks){
      const dcCount = rs.dataCount;
      const ecCount = rs.totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);

      const dc = new Array(dcCount);
      for(let i=0;i<dc.length;i++) dc[i] = 0xff & buffer.buffer[i+offset];
      offset += dcCount;

      const rsPoly = getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dc, rsPoly.getLength()-1);
      const modPoly = rawPoly.mod(rsPoly);
      const ec = new Array(rsPoly.getLength()-1);
      for(let i=0;i<ec.length;i++){
        const modIndex = i + modPoly.getLength() - ec.length;
        ec[i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
      dcdata.push(dc); ecdata.push(ec);
    }

    const data = [];
    for(let i=0;i<maxDcCount;i++){
      for(let r=0;r<dcdata.length;r++){
        if(i < dcdata[r].length) data.push(dcdata[r][i]);
      }
    }
    for(let i=0;i<maxEcCount;i++){
      for(let r=0;r<ecdata.length;r++){
        if(i < ecdata[r].length) data.push(ecdata[r][i]);
      }
    }
    return data;
  }

  function getErrorCorrectPolynomial(ecLen){
    let a = new QRPolynomial([1],0);
    for(let i=0;i<ecLen;i++){
      a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)],0));
    }
    return a;
  }

  // QR core (version 1..10)
  function QRCode(typeNumber, errorCorrectLevel){
    this.typeNumber=typeNumber;
    this.errorCorrectLevel=errorCorrectLevel;
    this.modules=null;
    this.moduleCount=0;
    this.dataCache=null;
    this.dataList=[];
  }
  QRCode.prototype = {
    addData(data){
      this.dataList.push({mode:QRMode.MODE_8BIT_BYTE, data:_utf8(data)});
      this.dataCache=null;
    },
    isDark(r,c){
      if(this.modules[r][c] == null) return false;
      return this.modules[r][c];
    },
    getModuleCount(){ return this.moduleCount; },
    make(){
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl(test, maskPattern){
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for(let r=0;r<this.moduleCount;r++){
        this.modules[r] = new Array(this.moduleCount);
        for(let c=0;c<this.moduleCount;c++) this.modules[r][c] = null;
      }
      this.setupPositionProbePattern(0,0);
      this.setupPositionProbePattern(this.moduleCount-7,0);
      this.setupPositionProbePattern(0,this.moduleCount-7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if(this.typeNumber >= 7) this.setupTypeNumber(test);
      if(this.dataCache == null) this.dataCache = this.createData();
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern(row,col){
      for(let r=-1;r<=7;r++){
        if(row+r<=-1||this.moduleCount<=row+r) continue;
        for(let c=-1;c<=7;c++){
          if(col+c<=-1||this.moduleCount<=col+c) continue;
          if((0<=r&&r<=6&&(c===0||c===6)) || (0<=c&&c<=6&&(r===0||r===6)) || (2<=r&&r<=4&&2<=c&&c<=4)){
            this.modules[row+r][col+c]=true;
          }else{
            this.modules[row+r][col+c]=false;
          }
        }
      }
    },
    setupTimingPattern(){
      for(let i=8;i<this.moduleCount-8;i++){
        if(this.modules[i][6] == null) this.modules[i][6] = (i%2===0);
        if(this.modules[6][i] == null) this.modules[6][i] = (i%2===0);
      }
    },
    setupPositionAdjustPattern(){
      const pos = this.getPatternPosition();
      for(let i=0;i<pos.length;i++){
        for(let j=0;j<pos.length;j++){
          const row=pos[i], col=pos[j];
          if(this.modules[row][col] != null) continue;
          for(let r=-2;r<=2;r++){
            for(let c=-2;c<=2;c++){
              if(r===-2||r===2||c===-2||c===2 || (r===0&&c===0)){
                this.modules[row+r][col+c]=true;
              }else{
                this.modules[row+r][col+c]=false;
              }
            }
          }
        }
      }
    },
    getPatternPosition(){
      // version 1..10
      const table = {
        1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],
        6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]
      };
      return table[this.typeNumber] || [];
    },
    setupTypeNumber(test){
      // omitido (no necesitamos si version < 7; pero lo dejamos seguro)
    },
    setupTypeInfo(test, maskPattern){
      const data = (QRErrorCorrectLevel[ecc||'M'] << 3) | maskPattern;
      const bits = this.getBCHTypeInfo(data);
      // vertical
      for(let i=0;i<15;i++){
        const mod = (!test && ((bits >> i) & 1) === 1);
        if(i<6) this.modules[i][8]=mod;
        else if(i<8) this.modules[i+1][8]=mod;
        else this.modules[this.moduleCount-15+i][8]=mod;
      }
      // horizontal
      for(let i=0;i<15;i++){
        const mod = (!test && ((bits >> i) & 1) === 1);
        if(i<8) this.modules[8][this.moduleCount-i-1]=mod;
        else if(i<9) this.modules[8][15-i-1+1]=mod;
        else this.modules[8][15-i-1]=mod;
      }
      this.modules[this.moduleCount-8][8] = (!test);
    },
    getBCHTypeInfo(data){
      let d = data << 10;
      while(this.getBCHDigit(d) - this.getBCHDigit(0x537) >= 0){
        d ^= (0x537 << (this.getBCHDigit(d)-this.getBCHDigit(0x537)));
      }
      return ((data << 10) | d) ^ 0x5412;
    },
    getBCHDigit(data){
      let digit=0;
      while(data !== 0){ digit++; data >>>= 1; }
      return digit;
    },
    createData(){
      // elegimos typeNumber por longitud (simple)
      let type = this.typeNumber;
      const bytes = this.dataList[0]?.data || [];
      // Ajuste: si se pasa, subimos hasta 10
      const cap = {1:19,2:34,3:55,4:80,5:108,6:136,7:156,8:194,9:232,10:274};
      while(type < 10 && bytes.length > (cap[type]||19)) type++;
      this.typeNumber = type;
      return createData(this.typeNumber, bytes);
    },
    mapData(data, maskPattern){
      let inc=-1, row=this.moduleCount-1, bitIndex=7, byteIndex=0;
      const mask = (r,c) => {
        switch(maskPattern){
          case 0: return (r+c)%2===0;
          case 1: return r%2===0;
          case 2: return c%3===0;
          case 3: return (r+c)%3===0;
          default: return (r+c)%2===0;
        }
      };
      for(let col=this.moduleCount-1; col>0; col-=2){
        if(col===6) col--;
        while(true){
          for(let c=0;c<2;c++){
            if(this.modules[row][col-c] == null){
              let dark=false;
              if(byteIndex < data.length){
                dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              }
              const m = mask(row, col-c);
              this.modules[row][col-c] = m ? !dark : dark;
              bitIndex--;
              if(bitIndex===-1){ byteIndex++; bitIndex=7; }
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
    },
    getBestMaskPattern(){
      return 0; // simple
    }
  };

  const qr = new QRCode(4, QRErrorCorrectLevel[ecc||'M']); // versión inicial, se ajusta dentro
  qr.addData(text || '');
  qr.make();
  return qr;
}

function qrToCanvas(text, canvas, sizePx=220){
  const qr = _qr_make(text || '', 'M');
  const count = qr.getModuleCount();
  const margin = 2;
  const cells = count + margin*2;

  const scale = Math.floor(sizePx / cells);
  const actual = scale * cells;

  canvas.width = actual;
  canvas.height = actual;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0,0,actual,actual);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,actual,actual);
  ctx.fillStyle = '#000';

  for(let r=0;r<count;r++){
    for(let c=0;c<count;c++){
      if(qr.isDark(r,c)){
        ctx.fillRect((c+margin)*scale, (r+margin)*scale, scale, scale);
      }
    }
  }
  return canvas;
}
/* eslint-enable */

/* =========================
   QR AEAT TEXT + COPIAR + RENDER
========================= */
function buildQrText(){
  const provNif = ($('#provNif')?.value || FM.db.proveedor?.nif || '').trim();
  const numFac  = (FM.current?.numero || '').trim();
  const fecha   = (FM.current?.fechaISO || '').trim();
  const total   = money(FM.current?.totals?.total || 0);

  const base = (FM.db.ajustes?.qrBase || 'NIF={NIF};NUM={NUM};FECHA={FECHA};TOTAL={TOTAL}');
  return (base || '')
    .replaceAll('{NIF}', provNif || '')
    .replaceAll('{NUM}', numFac || '')
    .replaceAll('{FECHA}', fecha || '')
    .replaceAll('{TOTAL}', total || '');
}

FM.renderQR = function(){
  try{
    const txt = buildQrText();
    setText($('#qrText'), txt || '—');

    const wrap = $('#qrCanvasWrap');
    if(!wrap) return;

    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'qrCanvas';
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    wrap.appendChild(canvas);

    // validación mínima
    const provNif = ($('#provNif')?.value || '').trim();
    if(!provNif || !FM.current?.numero || !FM.current?.fechaISO){
      const d = document.createElement('div');
      d.className = 'warnItem';
      d.style.marginTop = '10px';
      d.textContent = 'Faltan datos para QR (NIF / Nº / Fecha).';
      wrap.appendChild(d);
      return;
    }

    qrToCanvas(txt, canvas, 240);
  }catch(e){
    // fallback
    const wrap = $('#qrCanvasWrap');
    if(wrap) wrap.innerHTML = `<div class="center"><div class="mono">QR no disponible</div></div>`;
  }
};

(function bindQrCopy(){
  on($('#btnQrCopy'),'click', async ()=>{
    const txt = buildQrText();
    try{
      await navigator.clipboard.writeText(txt);
      toast('QR','Texto copiado.', 'ok');
    }catch{
      // fallback
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('QR','Texto copiado.', 'ok');
    }
  });
})();

/* =========================
   WHATSAPP PRO
========================= */
FM.whatsappText = function(){
  FM.recalcInvoice();
  const f = FM.current;
  const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';

  const lines = (f.lineas||[])
    .filter(l=> normName(l.producto))
    .map(l=>{
      const prod = l.producto;
      const modo = (l.modo||'kg').toUpperCase();
      const cant = (l.modo==='kg') ? `${money(l.neto)} kg` : `${money(l.cantidad)} ${l.modo==='caja'?'caja':'ud'}`;
      const pr   = `${money(l.precio)}€`;
      const imp  = `${money(l.importe)}€`;
      return `- ${prod} (${modo}) · ${cant} · ${pr} = ${imp}`;
    });

  const head = `FACTURA ${f.numero} · ${isoToES(f.fechaISO)}\nCliente: ${cli}\n`;
  const body = lines.join('\n');
  const tots = `\n\nSubtotal: ${money(f.totals.subtotal)}€` +
    (f.chkTransporte ? `\nTransporte: ${money(f.totals.transporte)}€` : '') +
    (f.chkIvaIncluido ? `\nIVA: incluido` : `\nIVA: ${money(f.totals.iva)}€`) +
    `\nTOTAL: ${money(f.totals.total)}€` +
    `\nPendiente: ${money(Math.max(0,f.totals.pendiente))}€`;

  return head + body + tots;
};

(function bindWhatsApp(){
  on($('#btnWhatsApp'),'click', ()=>{
    const txt = FM.whatsappText();
    const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank');
  });
})();

/* =========================
   PDF PRO
   - Si existe jsPDF: PDF real + multipágina + suma y sigue + páginas
   - Si NO existe: vista HTML imprimible en visor (sin crash)
========================= */
function hasJsPDF(){
  return !!(window.jspdf && window.jspdf.jsPDF);
}

function invoiceHtmlPreview(){
  const f = FM.current;
  const prov = snapshotProveedor();
  const cli = f.clienteSnap || snapshotCliente() || {};
  const logo = '🍒 FACTU MIRAL';
  const qrTxt = buildQrText();

  const rows = (f.lineas||[]).filter(l=> normName(l.producto)).map(l=>`
    <tr>
      <td>${escapeHtml(l.producto)}</td>
      <td>${escapeHtml((l.modo||'').toUpperCase())}</td>
      <td style="text-align:right">${money(l.cantidad)}</td>
      <td style="text-align:right">${money(l.bruto)}</td>
      <td style="text-align:right">${money(l.taraTotal)}</td>
      <td style="text-align:right">${money(l.neto)}</td>
      <td style="text-align:right">${money(l.precio)}</td>
      <td>${escapeHtml(l.origen||'')}</td>
      <td style="text-align:right">${money(l.importe)}€</td>
    </tr>
  `).join('');

  const ivaLine = f.chkIvaIncluido ? `<div>IVA incluido en los precios</div>` : `<div>IVA: ${money(f.totals.iva)}€</div>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(f.numero)}</title>
<style>
  body{font-family:Arial, sans-serif; margin:18px; color:#111;}
  .top{display:grid; grid-template-columns:1fr 220px 1fr; gap:14px; align-items:start;}
  .box{border:1px solid #ddd; padding:12px; border-radius:10px;}
  h1{margin:0 0 6px 0; font-size:16px; letter-spacing:.08em;}
  .muted{color:#555; font-size:12px;}
  table{width:100%; border-collapse:collapse; margin-top:14px;}
  th,td{border-bottom:1px solid #eee; padding:8px; font-size:12px; vertical-align:top;}
  th{text-transform:uppercase; letter-spacing:.08em; color:#555; font-size:11px; text-align:left;}
  .tot{margin-top:12px; display:flex; justify-content:flex-end;}
  .tot .box{width:320px;}
  .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
  @media print{ .noprint{display:none;} }
</style></head>
<body>
  <div class="noprint" style="margin-bottom:10px">
    <button onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>
  <div class="top">
    <div class="box">
      <h1>${logo}</h1>
      <div class="muted"><b>Proveedor</b></div>
      <div>${escapeHtml(prov.nombre||'')}</div>
      <div class="mono">${escapeHtml(prov.nif||'')}</div>
      <div>${escapeHtml(prov.dir||'')}</div>
      <div class="muted">${escapeHtml(prov.tel||'')} · ${escapeHtml(prov.email||'')}</div>
    </div>
    <div class="box" style="text-align:center">
      <div class="muted"><b>QR AEAT</b></div>
      <div class="mono" style="word-break:break-word; margin-top:8px; font-size:10px">${escapeHtml(qrTxt)}</div>
    </div>
    <div class="box">
      <div class="muted"><b>Cliente</b></div>
      <div><b>${escapeHtml(cli.nombre||'')}</b></div>
      <div class="mono">${escapeHtml(cli.nif||'')}</div>
      <div>${escapeHtml(cli.dir||'')}</div>
      <div class="muted">${escapeHtml(cli.tel||'')} · ${escapeHtml(cli.email||'')}</div>
      <div style="margin-top:10px" class="muted"><b>Factura</b></div>
      <div class="mono">${escapeHtml(f.numero||'')}</div>
      <div class="mono">${escapeHtml(isoToES(f.fechaISO))}</div>
      <div class="muted">${escapeHtml(f.tags||'')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th><th>Modo</th><th style="text-align:right">Cant</th><th style="text-align:right">Bruto</th>
        <th style="text-align:right">Tara</th><th style="text-align:right">Neto</th>
        <th style="text-align:right">Precio</th><th>Origen</th><th style="text-align:right">Importe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="tot">
    <div class="box">
      <div>Subtotal: <span class="mono">${money(f.totals.subtotal)}€</span></div>
      ${f.chkTransporte ? `<div>Transporte: <span class="mono">${money(f.totals.transporte)}€</span></div>` : ``}
      ${ivaLine}
      <div style="margin-top:8px"><b>TOTAL: <span class="mono">${money(f.totals.total)}€</span></b></div>
      <div class="muted">Pendiente: <span class="mono">${money(Math.max(0,f.totals.pendiente))}€</span></div>
    </div>
  </div>

  ${f.obs ? `<div class="box" style="margin-top:12px"><div class="muted"><b>Observaciones</b></div>${escapeHtml(f.obs)}</div>`:''}
</body></html>`;
}

async function generatePDF_Real(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });

  const f = FM.current;
  FM.recalcInvoice();

  const margin = 12;
  const W = 210, H = 297;

  const prov = snapshotProveedor();
  const cli = f.clienteSnap || snapshotCliente() || {};
  const qrTxt = buildQrText();

  // QR image
  const c = document.createElement('canvas');
  qrToCanvas(qrTxt, c, 220);
  const qrData = c.toDataURL('image/png');

  const pageCountPlaceholder = '{totalPages}';

  function header(){
    doc.setFont('helvetica','bold');
    doc.setFontSize(12);
    doc.text('FACTU MIRAL', margin, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text(`Factura: ${f.numero}`, margin, 20);
    doc.text(`Fecha: ${isoToES(f.fechaISO)}`, margin, 25);

    // three columns
    const y0 = 32;

    // proveedor
    doc.setFont('helvetica','bold'); doc.text('Proveedor', margin, y0);
    doc.setFont('helvetica','normal');
    doc.text((prov.nombre||''), margin, y0+5);
    doc.text((prov.nif||''), margin, y0+10);
    doc.text((prov.dir||''), margin, y0+15);
    doc.text(`${prov.tel||''} ${prov.email?('· '+prov.email):''}`, margin, y0+20);

    // QR center
    doc.addImage(qrData, 'PNG', (W/2)-16, y0, 32, 32);
    doc.setFontSize(7);
    doc.text(qrTxt, (W/2)-40, y0+36, { maxWidth: 80 });

    // cliente
    const xr = W - margin - 70;
    doc.setFontSize(10);
    doc.setFont('helvetica','bold'); doc.text('Cliente', xr, y0);
    doc.setFont('helvetica','normal');
    doc.text((cli.nombre||''), xr, y0+5, { maxWidth: 70 });
    doc.text((cli.nif||''), xr, y0+10, { maxWidth: 70 });
    doc.text((cli.dir||''), xr, y0+15, { maxWidth: 70 });
    doc.text(`${cli.tel||''} ${cli.email?('· '+cli.email):''}`, xr, y0+20, { maxWidth: 70 });

    // tags
    if(f.tags){
      doc.setFontSize(9);
      doc.setFont('helvetica','bold'); doc.text('Tags:', margin, y0+28);
      doc.setFont('helvetica','normal'); doc.text(String(f.tags), margin+12, y0+28, { maxWidth: 160 });
    }
  }

  function footer(pageNum){
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    const txt = `Página ${pageNum}/${pageCountPlaceholder}`;
    doc.text(txt, W - margin, H - 10, { align:'right' });
    doc.text('IVA y tributos según normativa. (B/W PRO)', margin, H - 10);
  }

  // table layout manual (sin autoTable)
  const cols = [
    {k:'producto',  w:55, align:'left',  title:'Producto'},
    {k:'modo',      w:12, align:'left',  title:'Modo'},
    {k:'cantidad',  w:14, align:'right', title:'Cant'},
    {k:'bruto',     w:14, align:'right', title:'Bruto'},
    {k:'taraTotal', w:14, align:'right', title:'Tara'},
    {k:'neto',      w:14, align:'right', title:'Neto'},
    {k:'precio',    w:14, align:'right', title:'Precio'},
    {k:'origen',    w:25, align:'left',  title:'Origen'},
    {k:'importe',   w:18, align:'right', title:'Importe'}
  ];

  const lines = (f.lineas||[])
    .filter(l=> normName(l.producto))
    .map(l=>({
      producto: String(l.producto||''),
      modo: String((l.modo||'').toUpperCase()),
      cantidad: money(l.modo==='kg' ? l.neto : l.cantidad),
      bruto: money(l.bruto),
      taraTotal: money(l.taraTotal),
      neto: money(l.neto),
      precio: money(l.precio),
      origen: String(l.origen||''),
      importe: money(l.importe)+'€'
    }));

  let pageNum = 1;
  header();

  let y = 75;
  const rowH = 7;
  const headH = 7;
  const bottomLimit = H - 52;

  function drawTableHeader(){
    let x = margin;
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    for(const c of cols){
      doc.text(c.title, x + (c.align==='right'?c.w:0), y, { align: c.align==='right'?'right':'left' });
      x += c.w;
    }
    doc.setDrawColor(220); doc.line(margin, y+1, W-margin, y+1);
    y += headH;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
  }

  function drawRow(r){
    let x=margin;
    for(const c of cols){
      const v = (r[c.k] ?? '').toString();
      if(c.align==='right'){
        doc.text(v, x + c.w, y, { align:'right', maxWidth:c.w });
      }else{
        doc.text(v, x, y, { align:'left', maxWidth:c.w });
      }
      x += c.w;
    }
    y += rowH;
    doc.setDrawColor(235); doc.line(margin, y-5, W-margin, y-5);
  }

  drawTableHeader();

  for(let i=0;i<lines.length;i++){
    if(y > bottomLimit){
      // “Suma y sigue”
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text('Suma y sigue…', W-margin, H-28, { align:'right' });

      footer(pageNum);
      doc.addPage();
      pageNum++;
      header();
      y = 75;
      drawTableHeader();
    }
    drawRow(lines[i]);
  }

  // Totales (última página)
  const yTot = Math.max(y + 6, H - 48);
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text(`Subtotal: ${money(f.totals.subtotal)}€`, W-margin, yTot, { align:'right' });

  let y2 = yTot + 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  if(f.chkTransporte){
    doc.text(`Transporte: ${money(f.totals.transporte)}€`, W-margin, y2, { align:'right' });
    y2 += 6;
  }
  if(f.chkIvaIncluido){
    doc.text(`IVA: incluido`, W-margin, y2, { align:'right' });
    y2 += 6;
  }else{
    doc.text(`IVA: ${money(f.totals.iva)}€`, W-margin, y2, { align:'right' });
    y2 += 6;
  }
  doc.setFont('helvetica','bold');
  doc.text(`TOTAL: ${money(f.totals.total)}€`, W-margin, y2, { align:'right' });

  // Observaciones
  if(f.obs){
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('Observaciones:', margin, y2+10);
    doc.setFontSize(9);
    doc.text(String(f.obs), margin, y2+15, { maxWidth: 180 });
  }

  // Footer last page
  footer(pageNum);

  // total pages substitute
  const totalPages = doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){
    doc.setPage(p);
    doc.setFontSize(8);
    const str = `Página ${p}/${totalPages}`;
    doc.text(str, W - 12, H - 10, { align:'right' });
  }

  return doc.output('blob');
}

FM.renderPDF = async function(){
  FM.recalcInvoice();

  // Validación QR mínima
  const provNif = ($('#provNif')?.value || '').trim();
  if(!provNif || !FM.current.numero || !FM.current.fechaISO){
    toast('PDF','Faltan datos (NIF / Nº / Fecha).', 'warn');
    return null;
  }

  try{
    let blob = null;

    if(hasJsPDF()){
      blob = await generatePDF_Real();
    }else{
      // Fallback: HTML imprimible (se verá en visor como "vista", no PDF real)
      const html = invoiceHtmlPreview();
      const fr = $('#pdfFrame');
      if(fr){
        fr.removeAttribute('src');
        fr.srcdoc = html;
        openModal('#pdfModal');
        toast('Vista','Modo vista imprimible (sin jsPDF).', 'warn', 2600);
        return null;
      }
      toast('Vista','No hay visor disponible.', 'warn');
      return null;
    }

    const url = URL.createObjectURL(blob);
    FM.current.pdf = FM.current.pdf || {};
    FM.current.pdf.lastBlobUrl = url;

    const fr = $('#pdfFrame');
    if(fr){
      fr.removeAttribute('srcdoc');
      fr.src = url;
    }
    openModal('#pdfModal');
    toast('PDF','Generado.', 'ok');
    return { blob, url };
  }catch(e){
    console.warn(e);
    toast('PDF','Error generando PDF.', 'danger');
    return null;
  }
};

(function bindPDF(){
  on($('#btnGenerarPDF'),'click', async ()=>{ await FM.renderPDF(); });
  on($('#btnVerPDF'),'click', ()=>{
    const fr = $('#pdfFrame');
    if(fr && (fr.getAttribute('src') || fr.getAttribute('srcdoc'))){
      openModal('#pdfModal');
    }else{
      toast('PDF','Primero genera el PDF.', 'warn');
    }
  });
})();

/* =========================
   FACTURAS: botón “Ver PDF” en listado (si existe)
========================= */
function renderFacturasList_plusPDF(){
  const wrap = $('#facturasList');
  if(!wrap) return;

  const q = ($('#facturasBuscar')?.value || '').trim().toUpperCase();
  const rows = (FM.db.facturas||[]).filter(f=>{
    if(!q) return true;
    const numf = (f.numero||'').toUpperCase();
    const cli  = (f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '').toUpperCase();
    const tags = (f.tags||'').toUpperCase();
    const fecha = (f.fechaISO||'').toUpperCase();
    return numf.includes(q) || cli.includes(q) || tags.includes(q) || fecha.includes(q);
  });

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead>
          <tr><th>Fecha</th><th>Nº</th><th>Cliente</th><th>Tags</th><th>Total</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${rows.map(f=>{
            const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';
            const pdfOk = (f.pdf?.lastBlobUrl) || (f.cloud?.pdfUrl);
            return `
              <tr>
                <td class="mono">${escapeHtml(isoToES(f.fechaISO))}</td>
                <td class="mono"><b>${escapeHtml(f.numero||'')}</b></td>
                <td>${escapeHtml(cli)}</td>
                <td class="mono">${escapeHtml(f.tags||'')}</td>
                <td class="mono">${money(f.totals?.total||0)}€</td>
                <td class="mono">${escapeHtml(f.estado||'')}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn--xs jsFacEdit" data-id="${f.id}" type="button">Editar</button>
                  <button class="btn btn--xs jsFacPdf" data-id="${f.id}" type="button" ${pdfOk?'':'disabled'}>Ver PDF</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  $$('.jsFacEdit', wrap).forEach(b=>{
    on(b,'click', ()=>{
      const id = b.dataset.id;
      const f = (FM.db.facturas||[]).find(x=>x.id===id);
      if(!f) return;
      FM.current = structuredClone(f);
      setFacturaMetaUI();
      fillClienteSelect();
      renderLineasBase();
      renderPagos();
      FM.recalcInvoice();
      setActiveTab('tabFactura');
      toast('Factura','Abierta para edición.', 'ok');
    });
  });

  $$('.jsFacPdf', wrap).forEach(b=>{
    on(b,'click', ()=>{
      const id = b.dataset.id;
      const f = (FM.db.facturas||[]).find(x=>x.id===id);
      if(!f) return;
      const fr = $('#pdfFrame');
      if(!fr) return;

      const src = f.cloud?.pdfUrl || f.pdf?.lastBlobUrl;
      if(!src){ toast('PDF','No hay PDF guardado.', 'warn'); return; }
      fr.removeAttribute('srcdoc');
      fr.src = src;
      openModal('#pdfModal');
    });
  });
}
// sustituimos el render de facturas por versión con PDF
FM.renderLists = function(){
  try{
    renderFacturasList_plusPDF();
    renderClientesList();
    renderProductosList();
    renderTarasList();
  }catch(e){ console.warn(e); }
};
on($('#facturasBuscar'),'input', ()=> renderFacturasList_plusPDF());

/* =========================
   CONTABILIDAD 🔒 (PIN) — KPIs + filtros + CSV
========================= */
function contFilteredFacturas(){
  const desde = safeGetVal('#contDesde');
  const hasta = safeGetVal('#contHasta');
  const clienteId = safeGetVal('#contCliente');
  const tag = (safeGetVal('#contTag') || '').trim().toUpperCase();

  return (FM.db.facturas||[]).filter(f=>{
    if(desde && (f.fechaISO||'') < desde) return false;
    if(hasta && (f.fechaISO||'') > hasta) return false;
    if(clienteId && f.clienteId !== clienteId) return false;
    if(tag && !((f.tags||'').toUpperCase().includes(tag))) return false;
    return true;
  });
}

function calcMargin(f){
  // margen si hay coste en productos: suma(importe - (neto*coste)) solo modo kg; caja/ud usa cantidad*coste si se define
  let m = 0;
  (f.lineas||[]).forEach(l=>{
    const p = findProductoByName(l.producto);
    const coste = p ? num(p.coste) : 0;
    if(coste<=0) return;
    if(l.modo==='kg') m += (num(l.importe) - (num(l.neto)*coste));
    else m += (num(l.importe) - (num(l.cantidad)*coste));
  });
  return round2(m);
}

function renderContabilidad(){
  const list = contFilteredFacturas();
  const ventas = round2(list.reduce((a,f)=> a + num(f.totals?.total), 0));
  const iva = round2(list.reduce((a,f)=> a + num(f.chkIvaIncluido ? (f.totals?.ivaInterno||0) : (f.totals?.iva||0)), 0));
  const n = list.length;
  const margen = round2(list.reduce((a,f)=> a + calcMargin(f), 0));

  setText($('#kpiVentas'), money(ventas)+'€');
  setText($('#kpiIVA'), money(iva)+'€');
  setText($('#kpiNum'), String(n));
  setText($('#kpiMargen'), money(margen)+'€');

  const wrap = $('#contTable');
  if(!wrap) return;

  wrap.innerHTML = `
    <div class="tableWrap">
      <table class="simpleTable">
        <thead><tr><th>Fecha</th><th>Nº</th><th>Cliente</th><th>Tags</th><th>Total</th><th>IVA</th><th>Pendiente</th></tr></thead>
        <tbody>
          ${list.map(f=>{
            const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';
            const ivaF = f.chkIvaIncluido ? (f.totals?.ivaInterno||0) : (f.totals?.iva||0);
            return `
              <tr>
                <td class="mono">${escapeHtml(isoToES(f.fechaISO))}</td>
                <td class="mono"><b>${escapeHtml(f.numero||'')}</b></td>
                <td>${escapeHtml(cli)}</td>
                <td class="mono">${escapeHtml(f.tags||'')}</td>
                <td class="mono">${money(f.totals?.total||0)}€</td>
                <td class="mono">${money(ivaF)}€</td>
                <td class="mono">${money(Math.max(0,f.totals?.pendiente||0))}€</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // dashboards simples: top clientes / pendientes
  const topCli = {};
  list.forEach(f=>{
    const name = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';
    topCli[name] = (topCli[name]||0) + num(f.totals?.total);
  });
  const topArr = Object.entries(topCli).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const topBox = $('#contTopClientes');
  if(topBox){
    topBox.innerHTML = topArr.map(([k,v])=>`<div class="totRow"><div>${escapeHtml(k)}</div><div class="totVal">${money(v)}€</div></div>`).join('')
      || `<div class="muted">Sin datos</div>`;
  }

  const pend = list
    .filter(f => num(f.totals?.pendiente) > 0.01)
    .sort((a,b)=> num(b.totals?.pendiente)-num(a.totals?.pendiente))
    .slice(0,10);

  const pendBox = $('#contPendientes');
  if(pendBox){
    pendBox.innerHTML = pend.map(f=>{
      const cli = f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—';
      return `<div class="totRow"><div><div><b>${escapeHtml(cli)}</b></div><div class="hint mono">${escapeHtml(f.numero||'')}</div></div><div class="totVal">${money(f.totals?.pendiente||0)}€</div></div>`;
    }).join('') || `<div class="muted">Sin pendientes</div>`;
  }
}

function exportContCSV(){
  const list = contFilteredFacturas();
  const lines = [
    ['Fecha','Numero','Cliente','Tags','Total','IVA','Pendiente'].join(';')
  ];
  list.forEach(f=>{
    const cli = (f.clienteSnap?.nombre || findClienteById(f.clienteId)?.nombre || '—').replaceAll(';',',');
    const ivaF = f.chkIvaIncluido ? (f.totals?.ivaInterno||0) : (f.totals?.iva||0);
    lines.push([
      isoToES(f.fechaISO),
      f.numero||'',
      cli,
      (f.tags||'').replaceAll(';',','),
      money(f.totals?.total||0),
      money(ivaF),
      money(Math.max(0,f.totals?.pendiente||0))
    ].join(';'));
  });
  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contabilidad_factumiral.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

(function bindContabilidad(){
  const ids = ['#contDesde','#contHasta','#contCliente','#contTag'];
  ids.forEach(id => on($(id),'input', renderContabilidad));
  on($('#btnContExport'),'click', exportContCSV);
  // render al entrar tab (ya se llama FM.renderLists), pero también:
  on($('#tabBtnContRefresh'),'click', renderContabilidad);
})();

/* =========================
   VENTAS DIARIAS 🔒 PIN 8410
   - San Pablo / San Lesmes / Santiago
   - efectivo + tarjeta + gastos
   - reportes diario/semanal/mensual/rango
========================= */
function ventasAdd(){
  const fechaISO = safeGetVal('#venFecha') || toISODate(now());
  const tienda = safeGetVal('#venTienda') || 'San Pablo';
  const efectivo = num(safeGetVal('#venEfectivo'));
  const tarjeta = num(safeGetVal('#venTarjeta'));
  const gastos = num(safeGetVal('#venGastos'));
  const nota = safeGetVal('#venNota') || '';

  const d = new Date(fechaISO+'T00:00:00');
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dia = dias[d.getDay()];

  FM.db.ventas = FM.db.ventas || [];
  FM.db.ventas.unshift({
    id: uid(),
    fechaISO, dia, tienda,
    efectivo: round2(efectivo),
    tarjeta: round2(tarjeta),
    total: round2(efectivo + tarjeta),
    gastos: round2(gastos),
    neto: round2((efectivo + tarjeta) - gastos),
    nota
  });

  save(K.VENTAS, FM.db.ventas);
  toast('Ventas','Guardado.', 'ok');
  ventasRender();
}

function ventasFiltered(){
  const desde = safeGetVal('#venDesde');
  const hasta = safeGetVal('#venHasta');
  const tienda = safeGetVal('#venFiltroTienda');

  return (FM.db.ventas||[]).filter(v=>{
    if(desde && v.fechaISO < desde) return false;
    if(hasta && v.fechaISO > hasta) return false;
    if(tienda && tienda !== 'todas' && v.tienda !== tienda) return false;
    return true;
  }).sort((a,b)=> (b.fechaISO||'').localeCompare(a.fechaISO||''));
}

function ventasRender(){
  const list = ventasFiltered();
  const wrap = $('#ventasList');
  if(wrap){
    wrap.innerHTML = `
      <div class="tableWrap">
        <table class="simpleTable">
          <thead><tr><th>Fecha</th><th>Día</th><th>Tienda</th><th>Efectivo</th><th>Tarjeta</th><th>Total</th><th>Gastos</th><th>Neto</th><th></th></tr></thead>
          <tbody>
            ${list.map(v=>`
              <tr>
                <td class="mono">${escapeHtml(isoToES(v.fechaISO))}</td>
                <td>${escapeHtml(v.dia||'')}</td>
                <td><b>${escapeHtml(v.tienda||'')}</b></td>
                <td class="mono">${money(v.efectivo)}€</td>
                <td class="mono">${money(v.tarjeta)}€</td>
                <td class="mono"><b>${money(v.total)}€</b></td>
                <td class="mono">${money(v.gastos)}€</td>
                <td class="mono"><b>${money(v.neto)}€</b></td>
                <td><button class="btn btn--danger btn--xs jsVenDel" data-id="${v.id}" type="button">Eliminar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    $$('.jsVenDel', wrap).forEach(b=>{
      on(b,'click', ()=>{
        const id = b.dataset.id;
        FM.db.ventas = (FM.db.ventas||[]).filter(x=>x.id!==id);
        save(K.VENTAS, FM.db.ventas);
        ventasRender();
      });
    });
  }

  const sum = (k)=> round2(list.reduce((a,x)=>a+num(x[k]),0));
  setText($('#venSumEfectivo'), money(sum('efectivo'))+'€');
  setText($('#venSumTarjeta'), money(sum('tarjeta'))+'€');
  setText($('#venSumTotal'), money(sum('total'))+'€');
  setText($('#venSumGastos'), money(sum('gastos'))+'€');
  setText($('#venSumNeto'), money(sum('neto'))+'€');
}

(function bindVentas(){
  on($('#venAdd'),'click', ventasAdd);
  ['#venFecha','#venTienda','#venEfectivo','#venTarjeta','#venGastos','#venNota','#venDesde','#venHasta','#venFiltroTienda']
    .forEach(id => on($(id),'input', ventasRender));

  // defaults
  if($('#venFecha')) $('#venFecha').value = toISODate(now());
  ventasRender();
})();

/* =========================
   CRUD — PRODUCTOS / TARAS / CLIENTES (si hay panel editor)
========================= */
function bindCRUD(){
  // PRODUCTOS
  on($('#btnProNuevo'),'click', ()=>{
    safeSetVal('#proEdId','');
    safeSetVal('#proEdNombre','');
    safeSetVal('#proEdModo','kg');
    safeSetVal('#proEdKgCaja','0');
    safeSetVal('#proEdPKg','0');
    safeSetVal('#proEdPCaja','0');
    safeSetVal('#proEdPUd','0');
    safeSetVal('#proEdCoste','0');
    safeSetVal('#proEdOrigen','');
    safeSetVal('#proEdEnvase','');
    toast('Producto','Nuevo.', 'ok');
  });

  on($('#btnProGuardar'),'click', ()=>{
    const id = safeGetVal('#proEdId') || uid();
    const nombre = normName(safeGetVal('#proEdNombre'));
    if(!nombre){ toast('Producto','Falta nombre.', 'warn'); return; }

    const p = {
      id,
      nombre,
      modo: safeGetVal('#proEdModo') || 'kg',
      kgCaja: num(safeGetVal('#proEdKgCaja')),
      pKg: num(safeGetVal('#proEdPKg')),
      pCaja: num(safeGetVal('#proEdPCaja')),
      pUd: num(safeGetVal('#proEdPUd')),
      coste: num(safeGetVal('#proEdCoste')),
      origen: safeGetVal('#proEdOrigen') || '',
      envaseId: safeGetVal('#proEdEnvase') || '',
      hist: (findProductoByName(nombre)?.hist || [])
    };

    const idx = (FM.db.productos||[]).findIndex(x=>x.id===id);
    if(idx>=0) FM.db.productos[idx] = p;
    else FM.db.productos.unshift(p);

    save(K.PROD, FM.db.productos);
    toast('Producto','Guardado.', 'ok');
    FM.renderLists();
  });

  on($('#btnProEliminar'),'click', ()=>{
    const id = safeGetVal('#proEdId');
    if(!id) return;
    // protección: si usado en facturas
    const used = (FM.db.facturas||[]).some(f => (f.lineas||[]).some(l => {
      const pr = findProductoByName(l.producto);
      return pr && pr.id === id;
    }));
    if(used){ toast('Producto','No se puede eliminar: usado en facturas.', 'warn'); return; }

    FM.db.productos = (FM.db.productos||[]).filter(p=>p.id!==id);
    save(K.PROD, FM.db.productos);
    toast('Producto','Eliminado.', 'ok');
    FM.renderLists();
  });

  // TARAS
  on($('#btnTaraNuevo'),'click', ()=>{
    safeSetVal('#taraEdId','');
    safeSetVal('#taraEdNombre','');
    safeSetVal('#taraEdPeso','0.30');
    safeSetVal('#taraEdNotas','');
  });
  on($('#btnTaraGuardar'),'click', ()=>{
    const id = safeGetVal('#taraEdId') || uid();
    const nombre = (safeGetVal('#taraEdNombre')||'').trim();
    const peso = num(safeGetVal('#taraEdPeso'));
    if(!nombre){ toast('Tara','Falta nombre.', 'warn'); return; }
    if(peso<=0){ toast('Tara','Peso inválido.', 'warn'); return; }

    const t = { id, nombre, peso: round2(peso), notas: safeGetVal('#taraEdNotas')||'' };
    const idx = (FM.db.taras||[]).findIndex(x=>x.id===id);
    if(idx>=0) FM.db.taras[idx]=t; else FM.db.taras.unshift(t);
    save(K.TARAS, FM.db.taras);

    fillTarasForEditors();
    renderLineasBase();
    FM.recalcInvoice();

    toast('Tara','Guardada.', 'ok');
    FM.renderLists();
  });
  on($('#btnTaraEliminar'),'click', ()=>{
    const id = safeGetVal('#taraEdId');
    if(!id) return;

    // protección: si usada
    const used = (FM.db.facturas||[]).some(f => (f.lineas||[]).some(l => l.envaseId===id));
    const usedProd = (FM.db.productos||[]).some(p => p.envaseId===id);
    if(used || usedProd){
      toast('Tara','No se puede eliminar: usada en productos/facturas.', 'warn'); return;
    }

    FM.db.taras = (FM.db.taras||[]).filter(t=>t.id!==id);
    save(K.TARAS, FM.db.taras);
    fillTarasForEditors();
    renderLineasBase();
    FM.recalcInvoice();
    toast('Tara','Eliminada.', 'ok');
    FM.renderLists();
  });

  // CLIENTES (en tab Clientes, si hay editor)
  on($('#btnCliNuevo'),'click', ()=>{
    safeSetVal('#cliEdId','');
    safeSetVal('#cliEdNombre','');
    safeSetVal('#cliEdAlias','');
    safeSetVal('#cliEdNif','');
    safeSetVal('#cliEdDir','');
    safeSetVal('#cliEdTel','');
    safeSetVal('#cliEdEmail','');
    safeSetVal('#cliEdNotas','');

    safeSetVal('#cliTplIvaIncl','');
    safeSetVal('#cliTplTrans','');
    safeSetVal('#cliTplPago','');
    safeSetVal('#cliTplTags','');
    safeSetVal('#cliTplNota','');
  });

  on($('#btnCliGuardar'),'click', ()=>{
    const id = safeGetVal('#cliEdId') || uid();
    const nombre = (safeGetVal('#cliEdNombre')||'').trim();
    if(!nombre){ toast('Cliente','Falta nombre.', 'warn'); return; }

    const c = {
      id,
      nombre,
      alias: safeGetVal('#cliEdAlias')||'',
      nif: safeGetVal('#cliEdNif')||'',
      dir: safeGetVal('#cliEdDir')||'',
      tel: safeGetVal('#cliEdTel')||'',
      email: safeGetVal('#cliEdEmail')||'',
      notas: safeGetVal('#cliEdNotas')||'',
      tpl: {
        ivaIncluido: ($('#cliTplIvaIncl')?.checked) || false,
        transporte: ($('#cliTplTrans')?.checked) || false,
        pago: safeGetVal('#cliTplPago')||'',
        tags: safeGetVal('#cliTplTags')||'',
        notaStd: safeGetVal('#cliTplNota')||''
      }
    };

    const idx = (FM.db.clientes||[]).findIndex(x=>x.id===id);
    if(idx>=0) FM.db.clientes[idx]=c; else FM.db.clientes.unshift(c);

    save(K.CLIENTE, FM.db.clientes);
    fillClienteSelect();
    fillContClienteSelect();
    toast('Cliente','Guardado.', 'ok');
    FM.renderLists();
  });

  on($('#btnCliEliminar'),'click', ()=>{
    const id = safeGetVal('#cliEdId');
    if(!id) return;
    const used = (FM.db.facturas||[]).some(f => f.clienteId === id);
    if(used){ toast('Cliente','No se puede eliminar: usado en facturas.', 'warn'); return; }
    FM.db.clientes = (FM.db.clientes||[]).filter(c=>c.id!==id);
    save(K.CLIENTE, FM.db.clientes);
    fillClienteSelect();
    fillContClienteSelect();
    toast('Cliente','Eliminado.', 'ok');
    FM.renderLists();
  });
}
bindCRUD();

/* =========================
   CLOUD (Firebase) — opcional, 0 crash
   - Sólo se intenta si hay config completa
========================= */
FM.cloud.initIfConfigured = async function(){
  try{
    const fb = FM.db.ajustes?.firebase || {};
    const has = fb.apiKey && fb.authDomain && fb.databaseURL && fb.projectId && fb.appId;
    if(!has){ FM.cloud.configured = false; return; }
    FM.cloud.configured = true;

    // carga dinámica (solo si hay internet; si no, no crashea)
    if(!navigator.onLine){
      toast('Cloud','Sin internet: Cloud desactivado.', 'warn', 2600);
      return;
    }

    // si ya existe firebase, no cargar
    if(!window.firebase){
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
      const s2 = document.createElement('script');
      s2.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js';
      const s3 = document.createElement('script');
      s3.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js';
      const s4 = document.createElement('script');
      s4.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js';

      await new Promise((res,rej)=>{ s1.onload=res; s1.onerror=rej; document.head.appendChild(s1); });
      await new Promise((res,rej)=>{ s2.onload=res; s2.onerror=rej; document.head.appendChild(s2); });
      await new Promise((res,rej)=>{ s3.onload=res; s3.onerror=rej; document.head.appendChild(s3); });
      await new Promise((res,rej)=>{ s4.onload=res; s4.onerror=rej; document.head.appendChild(s4); });
    }

    firebase.initializeApp({
      apiKey: fb.apiKey, authDomain: fb.authDomain, databaseURL: fb.databaseURL,
      projectId: fb.projectId, appId: fb.appId, storageBucket: fb.storageBucket || undefined
    });

    FM.cloud.loggedIn = !!firebase.auth().currentUser;
    toast('Cloud','Firebase listo (login opcional).', 'ok', 1800);
  }catch(e){
    console.warn(e);
    toast('Cloud','No se pudo iniciar (opcional).', 'warn', 2600);
  }
};

FM.cloud.syncAll = async function(){
  try{
    if(!FM.cloud.configured || !window.firebase) return;
    const u = firebase.auth().currentUser;
    if(!u){ toast('Cloud','Inicia sesión primero.', 'warn'); return; }

    const base = `factumiral/${u.uid}`;
    const db = firebase.database();
    await db.ref(`${base}/proveedor`).set(FM.db.proveedor);
    await db.ref(`${base}/clientes`).set(FM.db.clientes);
    await db.ref(`${base}/productos`).set(FM.db.productos);
    await db.ref(`${base}/taras`).set(FM.db.taras);
    await db.ref(`${base}/facturas`).set(FM.db.facturas);
    await db.ref(`${base}/ajustes`).set(FM.db.ajustes);
    await db.ref(`${base}/ventas`).set(FM.db.ventas);

    toast('Cloud','Sync completo.', 'ok');
  }catch(e){
    console.warn(e);
    toast('Cloud','Error sincronizando.', 'warn');
  }
};

FM.cloud.uploadPDF = async function(blob){
  try{
    if(!FM.cloud.configured || !window.firebase) return null;
    const u = firebase.auth().currentUser;
    if(!u) return null;
    const fb = FM.db.ajustes?.firebase || {};
    if(!fb.storageBucket) return null;

    const storage = firebase.storage();
    const path = `factumiral/${u.uid}/pdf/${FM.current.numero}.pdf`;
    const ref = storage.ref().child(path);
    await ref.put(blob, { contentType:'application/pdf' });
    return await ref.getDownloadURL();
  }catch(e){
    console.warn(e);
    return null;
  }
};

(function bindCloudButtons(){
  on($('#btnFbTest'),'click', async ()=>{
    await FM.cloud.initIfConfigured();
    if(FM.cloud.configured) toast('Cloud','Config detectada.', 'ok');
    else toast('Cloud','Falta configuración.', 'warn');
  });

  on($('#btnFbLogout'),'click', async ()=>{
    try{
      if(window.firebase){
        await firebase.auth().signOut();
        FM.cloud.loggedIn = false;
        toast('Cloud','Sesión cerrada.', 'ok');
      }
    }catch{
      toast('Cloud','No disponible.', 'warn');
    }
  });

  on($('#btnPdfNube'),'click', async ()=>{
    const res = await FM.renderPDF();
    if(!res || !res.blob){
      toast('Cloud','Genera PDF real (jsPDF) para subir.', 'warn');
      return;
    }
    await FM.cloud.initIfConfigured();
    if(!FM.cloud.configured){ toast('Cloud','No configurado.', 'warn'); return; }
    const url = await FM.cloud.uploadPDF(res.blob);
    if(url){
      FM.current.cloud = FM.current.cloud || {};
      FM.current.cloud.pdfUrl = url;
      // guarda factura para persistir url
      const idx = (FM.db.facturas||[]).findIndex(f=>f.id===FM.current.id);
      if(idx>=0) FM.db.facturas[idx] = structuredClone(FM.current);
      save(K.FACT, FM.db.facturas);
      toast('Cloud','PDF subido.', 'ok');
      FM.renderLists();
    }else{
      toast('Cloud','No se pudo subir PDF.', 'warn');
    }
  });

  on($('#btnCloudSync'),'click', async ()=>{
    await FM.cloud.initIfConfigured();
    await FM.cloud.syncAll();
  });
})();

/* =========================
   ARRANQUE FINAL: QR + Recalc + Listados
========================= */
(function finalBoot_3C(){
  // recalcula + QR real
  FM.recalcInvoice();
  FM.renderQR();
  FM.renderLists();

  // Contabilidad render si está desbloqueada y existe UI
  if(FM.unlocked?.cont) renderContabilidad();

  // init cloud opcional sin crashear
  FM.cloud.initIfConfigured();
})();

/* =========================================================
CIERRE FINAL DEL APP.JS (SI ESTÁS PEGANDO 3A+3B+3C EN ORDEN)
========================================================= */
})(); // FIN APP.JS (cierre IIFE)

