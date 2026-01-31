/* =========================================================
PARTE 3/4 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (A)
- Offline primero (LocalStorage)
- Base unificada: Proveedor + Clientes + Productos + Taras + Facturas + Ajustes + Contabilidad + Ventas
- GRID PRO: taras automáticas, cálculos correctos, autocomplete manual
- WhatsApp, atajos, locks PIN (conta/ventas)
- PDF/Cloud quedan listos como stubs para completar en PARTE 4
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

  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : ('id_' + Math.random().toString(16).slice(2) + Date.now()));

  /* =========================
     STORAGE
  ========================= */
  const APP_KEY = 'factu_miral_bwpro_v1';
  const K = {
    prov:   `${APP_KEY}_prov`,
    clientes:`${APP_KEY}_clientes`,
    productos:`${APP_KEY}_productos`,
    taras:  `${APP_KEY}_taras`,
    facturas:`${APP_KEY}_facturas`,
    ajustes:`${APP_KEY}_ajustes`,
    ventas:`${APP_KEY}_ventas`,
    pricehist:`${APP_KEY}_pricehist`,
    ui: `${APP_KEY}_ui`
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

  /* =========================
     NUM / MONEY / DATE
  ========================= */
  const toNum = (v) => {
    if (v === null || v === undefined) return NaN;
    const s = ('' + v).trim().replace(/\s+/g,'').replace(',', '.');
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const fmt2 = (n) => {
    const x = Number.isFinite(n) ? n : 0;
    // es-ES formatting (no dependemos de locale del dispositivo para evitar “.”/“,” raros)
    const s = x.toFixed(2);
    const [a,b] = s.split('.');
    const a2 = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${a2},${b}`;
  };

  const fmtKg = (n) => {
    const x = Number.isFinite(n) ? n : 0;
    const s = x.toFixed(2);
    return s.replace('.', ',');
  };

  const parseDMY = (txt) => {
    const t = (txt ?? '').trim();
    const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (!m) return null;
    let d = +m[1], mo = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // validar fecha real:
    if (dt.getUTCFullYear() !== y || (dt.getUTCMonth()+1) !== mo || dt.getUTCDate() !== d) return null;
    return dt;
  };

  const isoFromDMY = (txt) => {
    const dt = parseDMY(txt);
    if (!dt) return null;
    return dt.toISOString().slice(0,10);
  };

  const dmyFromISO = (iso) => {
    if (!iso) return '';
    const m = (''+iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  const todayISO = () => new Date().toISOString().slice(0,10);

  const nowStamp = () => {
    const d = new Date();
    const pad = (x) => String(x).padStart(2,'0');
    const y = d.getFullYear();
    const mo = pad(d.getMonth()+1);
    const da = pad(d.getDate());
    const h = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${y}${mo}${da}${h}${mi}`;
  };

  const buildFacturaNumero = () => `FA-${nowStamp()}`;

  const dayNameES = (iso) => {
    const d = iso ? new Date(iso+'T00:00:00') : new Date();
    const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return days[d.getDay()];
  };

  const clamp0 = (n) => (Number.isFinite(n) ? Math.max(0,n) : 0);

  /* =========================
     SEEDS (Proveedor, Clientes, Productos, Taras)
  ========================= */

  function setProviderDefaultsIfEmpty(){
    if(!$('#provNombre').value) $('#provNombre').value = 'Mohammad Arslan Waris';
    if(!$('#provNif').value)    $('#provNif').value    = 'X6389988J';
    if(!$('#provDir').value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
    if(!$('#provTel').value)    $('#provTel').value    = '631 667 893';
    if(!$('#provEmail').value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
  }

  const SEED_CLIENTES = [
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', tel:'', email:'', alias:'', notas:'', pago:'Efectivo',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'efectivo', tags:'', notas:'' }},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos', tel:'', email:'', alias:'', notas:'',
     tpl:{ ivaIncl:'si', trans:'auto', pago:'auto', tags:'golden', notas:'IVA incluido en los precios' }},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51', email:'', alias:'Con/sentidos', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'consentidos', notas:'' }},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com', alias:'', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'', notas:'' }},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos', tel:'', email:'', alias:'ALESAL PAN', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'alesal', notas:'' }},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos', tel:'', email:'', alias:'RIVIERA', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'riviera', notas:'' }},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos', tel:'', email:'', alias:'NUOVO', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'nuovo', notas:'' }},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', tel:'', email:'info@restaurantelosbraseros.com', alias:'LOS BRASEROS', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'braseros', notas:'' }},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B. (Hotel Cordon)', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', tel:'', email:'info@hotelcordon.com', alias:'HOTEL CORDON', notas:'',
     tpl:{ ivaIncl:'auto', trans:'auto', pago:'auto', tags:'cordon', notas:'' }},
  ];

  const SEED_TARAS = [
    {id:uid(), nombre:'Caja plástico ESMO', peso:0.30, notas:''},
    {id:uid(), nombre:'Caja plástico Montenegro', peso:0.30, notas:''},
    {id:uid(), nombre:'Baúl Hnos viejo', peso:1.80, notas:''},
    {id:uid(), nombre:'Caja cartón estándar', peso:0.20, notas:''},
  ];

  // ✅ Productos a cargar SIEMPRE (tu lista)
  const SEED_PRODUCT_NAMES = [
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

  const seedProductos = () => {
    // normalizar, quitar duplicados
    const seen = new Set();
    const out = [];
    for (const n of SEED_PRODUCT_NAMES) {
      const name = (n ?? '').toString().trim();
      if (!name) continue;
      const k = name.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        id: uid(),
        nombre: k,
        modo: 'kg',           // default
        kgCaja: 0,
        precioKg: 0,
        precioCaja: 0,
        precioUd: 0,
        coste: 0,
        origen: '',
        envaseId: '',         // envase por defecto
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    return out;
  };

  /* =========================
     STATE
  ========================= */
  let PROV = load(K.prov, { nombre:'', nif:'', dir:'', tel:'', email:'' });
  let CLIENTES = load(K.clientes, []);
  let PRODUCTOS = load(K.productos, []);
  let TARAS = load(K.taras, []);
  let FACTURAS = load(K.facturas, []);
  let AJUSTES = load(K.ajustes, {
    ivaPct: 4,
    transPct: 10,
    pin: '8410',
    qrPlantilla: 'NIF={NIF}|FAC={FAC}|FECHA={FECHA}|TOTAL={TOTAL}',
    firebase: { apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'', storageBucket:'' }
  });
  let VENTAS = load(K.ventas, []);
  let PRICEHIST = load(K.pricehist, {}); // { "PRODUCTO": [{ts, modo, precio}, ...] }

  // Forzar seeds si están vacíos
  if (!Array.isArray(CLIENTES) || CLIENTES.length === 0) { CLIENTES = SEED_CLIENTES; save(K.clientes, CLIENTES); }
  if (!Array.isArray(TARAS) || TARAS.length === 0) { TARAS = SEED_TARAS; save(K.taras, TARAS); }
  if (!Array.isArray(PRODUCTOS) || PRODUCTOS.length === 0) { PRODUCTOS = seedProductos(); save(K.productos, PRODUCTOS); }
  if (!Array.isArray(FACTURAS)) FACTURAS = [];
  if (!Array.isArray(VENTAS)) VENTAS = [];
  if (typeof PRICEHIST !== 'object' || !PRICEHIST) PRICEHIST = {};

  let currentFacturaId = null;
  let currentPdfUrl = null;

  let contaUnlocked = false;
  let ventasUnlocked = false;

  /* =========================
     UI STATUS
  ========================= */
  const status = (msg) => {
    setText($('#appStatus'), msg);
    // auto reset
    clearTimeout(status._t);
    status._t = setTimeout(() => setText($('#appStatus'), 'Listo'), 1800);
  };

  /* =========================
     NORMALIZE SEARCH
  ========================= */
  const norm = (s) => (s ?? '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase()
    .trim();

  /* =========================
     TABS
  ========================= */
  const setActiveTab = (tab) => {
    $$('.tabBtn').forEach(b => b.classList.toggle('isActive', b.dataset.tab === tab));
    $$('.tabPanel').forEach(p => p.classList.toggle('isActive', p.dataset.tabpanel === tab));
    save(K.ui, { ...(load(K.ui, {})), lastTab: tab });
  };

  /* =========================
     MODALS
  ========================= */
  const openModal = (id) => {
    const m = $('#'+id);
    if (!m) return;
    m.classList.remove('isHidden');
  };
  const closeModal = (id) => {
    const m = $('#'+id);
    if (!m) return;
    m.classList.add('isHidden');
  };

  const confirmBox = (title, msg) => new Promise((resolve) => {
    setText($('#confirmTitle'), title);
    $('#confirmMsg').innerHTML = escapeHtml(msg).replace(/\n/g,'<br/>');
    openModal('modalConfirm');

    const yes = $('#confirmYes');
    const no = $('#confirmNo');

    const cleanup = () => {
      yes.onclick = null;
      no.onclick = null;
      closeModal('modalConfirm');
    };

    yes.onclick = () => { cleanup(); resolve(true); };
    no.onclick = () => { cleanup(); resolve(false); };
  });

  /* =========================
     DATA ACCESS
  ========================= */
  const getClienteById = (id) => CLIENTES.find(c => c.id === id) || null;
  const getProductoByName = (name) => {
    const key = norm(name);
    return PRODUCTOS.find(p => norm(p.nombre) === key) || null;
  };
  const getTaraById = (id) => TARAS.find(t => t.id === id) || null;
  const getTaraPeso = (id) => {
    const t = getTaraById(id);
    return t ? (Number.isFinite(+t.peso) ? +t.peso : toNum(t.peso)) : 0;
  };

  /* =========================
     FACTURA MODEL
  ========================= */
  const makeLine = () => ({
    id: uid(),
    producto: '',
    modo: 'kg',
    cantidad: '',
    bruto: '',
    envaseId: '',
    tara: '',
    neto: '',
    precio: '',
    origen: '',
    importe: 0,
    flags: { netoManual:false, taraManual:false }
  });

  const makeFactura = () => ({
    id: uid(),
    numero: buildFacturaNumero(),
    fechaISO: todayISO(),
    tags: '',
    notas: '',
    obs: '',
    metodoPago: 'efectivo',

    proveedor: { ...PROV },
    clienteId: '',
    clienteSnapshot: { nombre:'', nif:'', dir:'', tel:'', email:'' },

    lineas: [makeLine(), makeLine(), makeLine(), makeLine(), makeLine()],
    transporte: false,
    ivaIncluido: false,

    pagos: [],
    estado: 'impagada',

    totals: { subtotal:0, transporte:0, iva:0, total:0, pendiente:0, ivaInterno:0 },

    pdf: { localUrl:'', cloudUrl:'' },
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const cloneFactura = (f) => {
    const copy = JSON.parse(JSON.stringify(f));
    copy.id = uid();
    copy.numero = buildFacturaNumero();
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    // pagos se reinician en duplicado (recomendado)
    copy.pagos = [];
    copy.estado = 'impagada';
    copy.pdf = { localUrl:'', cloudUrl:'' };
    // ids de lineas nuevas
    copy.lineas = (copy.lineas || []).map(l => ({ ...l, id: uid(), flags: { netoManual:false, taraManual:false } }));
    return copy;
  };

  const upsertFactura = (f) => {
    const i = FACTURAS.findIndex(x => x.id === f.id);
    if (i >= 0) FACTURAS[i] = f;
    else FACTURAS.unshift(f);
    // ordenar por fecha desc + updatedAt
    FACTURAS.sort((a,b) => (b.fechaISO||'').localeCompare(a.fechaISO||'') || (b.updatedAt||0)-(a.updatedAt||0));
    save(K.facturas, FACTURAS);
  };

  const removeFactura = (id) => {
    FACTURAS = FACTURAS.filter(f => f.id !== id);
    save(K.facturas, FACTURAS);
  };

  /* =========================
     APPLY UI -> FACTURA
  ========================= */
  const getCurrentFactura = () => {
    const f = FACTURAS.find(x => x.id === currentFacturaId) || null;
    return f;
  };

  const setCurrentFactura = (f) => {
    if (!f) return;
    currentFacturaId = f.id;
    // aseguramos que exista en lista
    const exist = FACTURAS.find(x => x.id === f.id);
    if (!exist) upsertFactura(f);
    renderFacturaToUI(f);
    renderFacturasTable();
    status('Factura cargada');
  };

  /* =========================
     QR
  ========================= */
  let qrObj = null;

  const buildQRText = (f) => {
    const tpl = (AJUSTES.qrPlantilla || 'NIF={NIF}|FAC={FAC}|FECHA={FECHA}|TOTAL={TOTAL}');
    const nif = (f?.proveedor?.nif || '').trim();
    const fac = (f?.numero || '').trim();
    const fecha = dmyFromISO(f?.fechaISO);
    const total = fmt2(f?.totals?.total ?? 0);
    return tpl
      .replaceAll('{NIF}', nif)
      .replaceAll('{FAC}', fac)
      .replaceAll('{FECHA}', fecha)
      .replaceAll('{TOTAL}', total);
  };

  const canQR = (f) => {
    const nif = (f?.proveedor?.nif || '').trim();
    const fac = (f?.numero || '').trim();
    const fecha = (f?.fechaISO || '').trim();
    const total = (f?.totals?.total ?? 0);
    if (!nif || !fac || !fecha || !(Number.isFinite(+total) || Number.isFinite(total))) return false;
    return true;
  };

  const updateQR = () => {
    const f = getCurrentFactura();
    if (!f) return;

    const wrap = $('#qrWrap');
    const small = $('#qrTextSmall');
    if (!wrap || !small) return;

    wrap.innerHTML = '';
    const ok = canQR(f);
    const txt = ok ? buildQRText(f) : 'Faltan datos para QR (NIF / Nº / Fecha / Total)';
    setText(small, txt);

    if (!ok) {
      // no crear QR
      qrObj = null;
      return;
    }

    try {
      if (typeof QRCode === 'undefined') {
        qrObj = null;
        setText(small, txt + ' (QR lib no cargada)');
        return;
      }
      qrObj = new QRCode(wrap, {
        text: txt,
        width: 160,
        height: 160,
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      qrObj = null;
      setText(small, 'Error QR: ' + (e?.message || ''));
    }
  };

  /* =========================
     GRID RENDER
  ========================= */
  const buildEnvaseOptions = (sel, includeEmpty = true) => {
    if (!sel) return;
    const v = sel.value;
    sel.innerHTML = '';
    if (includeEmpty) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '— Tara / Envase —';
      sel.appendChild(o);
    }
    for (const t of TARAS) {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.nombre} (${String(t.peso).replace('.', ',')} kg)`;
      sel.appendChild(o);
    }
    sel.value = v || '';
  };

  const focusablesForLine = (row) => {
    // orden PRO de navegación con Enter
    return [
      $('.inProd', row),
      $('.inModo', row),
      $('.inCant', row),
      $('.inBruto', row),
      $('.inEnvase', row),
      $('.inTara', row),
      $('.inNeto', row),
      $('.inPrecio', row),
      $('.inOrigen', row),
    ].filter(Boolean);
  };

  const moveNext = (row, currentEl) => {
    const arr = focusablesForLine(row);
    const idx = arr.indexOf(currentEl);
    if (idx < 0) return;
    const next = arr[idx+1];
    if (next) {
      next.focus();
      if (next.select) next.select();
    } else {
      // al final, crea nueva línea
      addLinea();
      // focus producto nueva
      const rows = $$('#lineas .gridLine');
      const last = rows[rows.length - 1];
      const ip = last ? $('.inProd', last) : null;
      if (ip) { ip.focus(); ip.select?.(); }
    }
  };

  const wireEnterFlow = (row, input) => {
    on(input, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        moveNext(row, input);
      }
    });
  };

  const setInvalid = (el, isBad) => {
    if (!el) return;
    el.style.borderColor = isBad ? '#111' : '';
    el.style.boxShadow = isBad ? '0 0 0 2px rgba(0,0,0,.12)' : '';
  };

  const lineWarning = (row, msg) => {
    const hint = $('.lineHint', row);
    if (!hint) return;
    if (!msg) {
      hint.classList.add('isHidden');
      hint.textContent = '';
      return;
    }
    hint.classList.remove('isHidden');
    hint.textContent = msg;
  };

  const showLineLastPrices = (row, productName) => {
    const lp = $('.lastPrice', row);
    if (!lp) return;
    const key = norm(productName);
    if (!key || !PRICEHIST[key] || PRICEHIST[key].length === 0) {
      lp.classList.add('isHidden');
      lp.textContent = '';
      return;
    }
    const items = PRICEHIST[key].slice(0,5);
    lp.classList.remove('isHidden');
    lp.textContent = 'Últimos: ' + items.map(it => `${it.modo}:${fmt2(it.precio)}`).join(' · ');
  };

  const calcLine = (line, row) => {
    const modo = line.modo || 'kg';
    const cant = toNum(line.cantidad);
    const bruto = toNum(line.bruto);
    const precio = toNum(line.precio);

    // Tara auto (por defecto) — EN KG y UD se aplica envases=cantidad
    if (!line.flags.taraManual) {
      const taraUnit = line.envaseId ? getTaraPeso(line.envaseId) : 0;
      if ((modo === 'kg' || modo === 'ud') && Number.isFinite(cant) && cant > 0 && taraUnit > 0) {
        const taraTotal = taraUnit * cant;
        line.tara = fmtKg(taraTotal);
      } else if (modo === 'kg' && (!Number.isFinite(cant) || cant <= 0 || taraUnit <= 0)) {
        // si no hay envase o cantidad, tara queda vacía
        line.tara = line.tara || '';
      } else if (modo === 'ud' && (!Number.isFinite(cant) || cant <= 0 || taraUnit <= 0)) {
        line.tara = line.tara || '';
      }
      // en caja lo dejamos tal cual
    }

    const tara = toNum(line.tara);
    let neto = toNum(line.neto);

    // Neto auto (si no es manual)
    if (!line.flags.netoManual) {
      if ((modo === 'kg' || modo === 'ud') && Number.isFinite(bruto)) {
        const n = bruto - (Number.isFinite(tara) ? tara : 0);
        line.neto = fmtKg(clamp0(n));
        neto = toNum(line.neto);
      } else if (modo === 'caja') {
        // neto informativo si kg/caja
        const p = getProductoByName(line.producto);
        const kgCaja = p ? toNum(p.kgCaja) : NaN;
        if (Number.isFinite(cant) && cant > 0 && Number.isFinite(kgCaja) && kgCaja > 0) {
          line.neto = fmtKg(cant * kgCaja);
          neto = toNum(line.neto);
        } else {
          // si no hay kg/caja, mantener lo que esté
          line.neto = line.neto || '';
        }
      }
    }

    // Importe
    let importe = 0;
    if (modo === 'kg') {
      importe = (Number.isFinite(neto) ? neto : 0) * (Number.isFinite(precio) ? precio : 0);
    } else if (modo === 'caja') {
      importe = (Number.isFinite(cant) ? cant : 0) * (Number.isFinite(precio) ? precio : 0);
    } else { // ud
      importe = (Number.isFinite(cant) ? cant : 0) * (Number.isFinite(precio) ? precio : 0);
    }
    line.importe = importe;

    // Validaciones recomendadas (sin bloquear aún)
    let warn = '';
    if (modo === 'kg' && Number.isFinite(bruto) && Number.isFinite(tara) && tara > bruto) warn = 'Aviso: Tara > Bruto';
    if (modo === 'kg' && Number.isFinite(bruto) && Number.isFinite(neto) && neto > bruto) warn = 'Aviso: Neto > Bruto';
    if ((modo === 'kg' || modo === 'caja' || modo === 'ud') && (!Number.isFinite(precio) || precio <= 0) && (line.producto || line.cantidad || line.bruto)) {
      warn = warn ? (warn + ' · Precio vacío') : 'Aviso: Precio vacío';
    }
    if (row) lineWarning(row, warn);

    // Pintar UI
    if (row) {
      const imp = $('.importeVal', row);
      if (imp) imp.textContent = fmt2(importe);

      const inPrecio = $('.inPrecio', row);
      setInvalid(inPrecio, (!Number.isFinite(precio) || precio <= 0) && (line.producto || line.cantidad || line.bruto));

      // refrescar inputs auto si tocó
      const inTara = $('.inTara', row);
      const inNeto = $('.inNeto', row);
      if (inTara && !line.flags.taraManual) inTara.value = line.tara || '';
      if (inNeto && !line.flags.netoManual) inNeto.value = line.neto || '';
    }
  };

  const recalcAll = () => {
    const f = getCurrentFactura();
    if (!f) return;

    // recalcular líneas según DOM
    const rows = $$('#lineas .gridLine');
    rows.forEach((row, idx) => {
      const line = f.lineas[idx];
      if (!line) return;
      calcLine(line, row);
      // último precio visible por línea
      showLineLastPrices(row, line.producto);
    });

    // totales
    const subtotal = f.lineas.reduce((acc,l) => acc + (Number.isFinite(+l.importe) ? +l.importe : 0), 0);
    const transPct = toNum(AJUSTES.transPct);
    const ivaPct = toNum(AJUSTES.ivaPct);

    const transporte = f.transporte ? (subtotal * (Number.isFinite(transPct) ? transPct : 0) / 100) : 0;
    const base = subtotal + transporte;

    let iva = 0;
    let total = 0;
    let ivaInterno = 0;

    if (f.ivaIncluido) {
      // Precios ya incluyen IVA => total=base. IVA interno calculado para contabilidad/ventas.
      total = base;
      if (Number.isFinite(ivaPct) && ivaPct > 0) {
        ivaInterno = base - (base / (1 + (ivaPct/100)));
      } else {
        ivaInterno = 0;
      }
      iva = ivaInterno; // visible en UI como info (en PDF no se desglosa)
    } else {
      iva = base * ((Number.isFinite(ivaPct) ? ivaPct : 0) / 100);
      total = base + iva;
      ivaInterno = iva;
    }

    const pagosSum = (f.pagos || []).reduce((acc,p) => acc + (Number.isFinite(toNum(p.importe)) ? toNum(p.importe) : 0), 0);
    const pendiente = total - pagosSum;

    f.totals = { subtotal, transporte, iva, total, pendiente, ivaInterno };

    // estado
    const pen = Number.isFinite(pendiente) ? pendiente : 0;
    const tot = Number.isFinite(total) ? total : 0;
    if (tot <= 0) f.estado = 'impagada';
    else if (pen <= 0.009) f.estado = 'pagada';
    else if (pen < tot) f.estado = 'parcial';
    else f.estado = 'impagada';

    // UI
    setText($('#tSubtotal'), fmt2(subtotal));
    setText($('#tTransporte'), fmt2(transporte));
    setText($('#tIva'), fmt2(iva));
    setText($('#tTotal'), fmt2(total));
    setText($('#tPendiente'), fmt2(pendiente));

    setText($('#pillEstado'), f.estado);

    updateQR();
    renderPagosList();
  };

  const applyProductDefaultsToLine = (line, product, row) => {
    if (!product) return;

    // modo por defecto del producto
    line.modo = product.modo || line.modo || 'kg';

    // origen
    if (!line.origen && product.origen) line.origen = product.origen;

    // envase default
    if (product.envaseId) line.envaseId = product.envaseId;

    // precio según modo
    if (!line.precio || !Number.isFinite(toNum(line.precio)) || toNum(line.precio) <= 0) {
      if (line.modo === 'kg' && toNum(product.precioKg) > 0) line.precio = fmt2(toNum(product.precioKg));
      if (line.modo === 'caja' && toNum(product.precioCaja) > 0) line.precio = fmt2(toNum(product.precioCaja));
      if (line.modo === 'ud' && toNum(product.precioUd) > 0) line.precio = fmt2(toNum(product.precioUd));
    }

    // si es caja y hay kg/caja, neto informativo se calculará
    if (row) {
      $('.inModo', row).value = line.modo;
      $('.inEnvase', row).value = line.envaseId || '';
      $('.inPrecio', row).value = line.precio || '';
      $('.inOrigen', row).value = line.origen || '';
    }
  };

  const renderLineRow = (line, idx) => {
    const tpl = $('#tplLinea');
    const node = tpl.content.firstElementChild.cloneNode(true);

    // zebra de CSS ya aplica por nth-child
    const inProd = $('.inProd', node);
    const inModo = $('.inModo', node);
    const inCant = $('.inCant', node);
    const inBruto = $('.inBruto', node);
    const inEnv = $('.inEnvase', node);
    const inTara = $('.inTara', node);
    const inNeto = $('.inNeto', node);
    const inPrecio = $('.inPrecio', node);
    const inOrigen = $('.inOrigen', node);
    const btnDel = $('.btnDel', node);

    const sugg = $('.suggestBox', node);

    // initial values
    inProd.value = line.producto || '';
    inModo.value = line.modo || 'kg';
    inCant.value = line.cantidad ?? '';
    inBruto.value = line.bruto ?? '';
    inTara.value = line.tara ?? '';
    inNeto.value = line.neto ?? '';
    inPrecio.value = line.precio ?? '';
    inOrigen.value = line.origen ?? '';

    // envase options
    buildEnvaseOptions(inEnv, true);
    inEnv.value = line.envaseId || '';

    // Enter flow (NO autoselect al escribir, solo Enter)
    [inProd, inModo, inCant, inBruto, inEnv, inTara, inNeto, inPrecio, inOrigen].forEach(el => wireEnterFlow(node, el));

    // autocomplete manual (NO sustituye solo)
    let activeIdx = -1;
    let items = [];

    const renderSuggest = (q) => {
      const qq = norm(q);
      if (!qq) {
        sugg.classList.add('isHidden');
        sugg.innerHTML = '';
        activeIdx = -1;
        items = [];
        return;
      }
      const match = PRODUCTOS
        .filter(p => norm(p.nombre).includes(qq))
        .slice(0, 12);

      items = match;
      if (match.length === 0) {
        sugg.classList.add('isHidden');
        sugg.innerHTML = '';
        activeIdx = -1;
        return;
      }

      sugg.innerHTML = match.map((p, i) => {
        const a = escapeHtml(p.nombre);
        const cls = (i === activeIdx) ? 'suggestItem isActive' : 'suggestItem';
        return `<button type="button" class="${cls}" data-i="${i}">${a}</button>`;
      }).join('');

      sugg.classList.remove('isHidden');

      // click
      $$('.suggestItem', sugg).forEach(btn => {
        btn.onclick = () => {
          const i = +btn.dataset.i;
          pickSuggestion(i);
        };
      });
    };

    const pickSuggestion = (i) => {
      const p = items[i];
      if (!p) return;

      // aquí SÍ ponemos el texto (selección explícita)
      inProd.value = p.nombre;
      line.producto = p.nombre;

      // aplicar defaults
      applyProductDefaultsToLine(line, p, node);

      // cerrar
      sugg.classList.add('isHidden');
      sugg.innerHTML = '';
      activeIdx = -1;
      items = [];

      // reset flags: tara auto + neto auto (se recalculan)
      line.flags.taraManual = false;
      line.flags.netoManual = false;

      // recalcular y avanzar (si quieres, con Enter lo hará)
      calcLine(line, node);
      recalcAll();
    };

    on(inProd, 'input', () => {
      // NO sustituir texto. Solo mostrar sugerencias.
      line.producto = inProd.value;
      activeIdx = -1;
      renderSuggest(inProd.value);
      showLineLastPrices(node, line.producto);
    });

    on(inProd, 'focus', () => {
      renderSuggest(inProd.value);
    });

    on(inProd, 'blur', () => {
      // pequeño delay para permitir click
      setTimeout(() => {
        sugg.classList.add('isHidden');
      }, 140);
    });

    on(inProd, 'keydown', (e) => {
      if (sugg.classList.contains('isHidden')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        renderSuggest(inProd.value);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        renderSuggest(inProd.value);
      }
      if (e.key === 'Escape') {
        sugg.classList.add('isHidden');
        sugg.innerHTML = '';
        activeIdx = -1;
      }
      if (e.key === 'Enter') {
        // Enter ya mueve campo, pero si hay sugerencia activa, priorizamos selección
        if (items.length > 0) {
          e.preventDefault();
          pickSuggestion(activeIdx >= 0 ? activeIdx : 0);
          // luego mover al siguiente (modo)
          setTimeout(() => moveNext(node, inProd), 0);
        }
      }
    });

    // modo
    on(inModo, 'change', () => {
      line.modo = inModo.value;
      // al cambiar modo, si precio del producto existe y precio vacío, sugerirlo
      const p = getProductoByName(line.producto);
      if (p) {
        if (!line.precio || !Number.isFinite(toNum(line.precio)) || toNum(line.precio) <= 0) {
          if (line.modo === 'kg' && toNum(p.precioKg) > 0) line.precio = fmt2(toNum(p.precioKg));
          if (line.modo === 'caja' && toNum(p.precioCaja) > 0) line.precio = fmt2(toNum(p.precioCaja));
          if (line.modo === 'ud' && toNum(p.precioUd) > 0) line.precio = fmt2(toNum(p.precioUd));
          inPrecio.value = line.precio || '';
        }
      }
      // neto auto vuelve a permitir recalcular (recomendado)
      line.flags.netoManual = false;
      calcLine(line, node);
      recalcAll();
    });

    // cantidad
    on(inCant, 'input', () => {
      line.cantidad = inCant.value;
      // tara auto se recalcula si no manual
      calcLine(line, node);
      recalcAll();
    });

    // bruto
    on(inBruto, 'input', () => {
      line.bruto = inBruto.value;
      calcLine(line, node);
      recalcAll();
    });

    // envase
    on(inEnv, 'change', () => {
      line.envaseId = inEnv.value;
      // al seleccionar envase: tara AUTO
      line.flags.taraManual = false;
      calcLine(line, node);
      recalcAll();
    });

    // tara manual
    on(inTara, 'input', () => {
      line.tara = inTara.value;
      line.flags.taraManual = true;
      // neto auto si no manual
      calcLine(line, node);
      recalcAll();
    });

    // neto manual
    on(inNeto, 'input', () => {
      line.neto = inNeto.value;
      line.flags.netoManual = true; // se respeta
      calcLine(line, node);
      recalcAll();
    });

    // precio
    on(inPrecio, 'input', () => {
      line.precio = inPrecio.value;
      calcLine(line, node);
      recalcAll();
    });

    // origen
    on(inOrigen, 'input', () => {
      line.origen = inOrigen.value;
    });

    // delete line
    on(btnDel, 'click', async () => {
      const ok = await confirmBox('Eliminar línea', '¿Eliminar esta línea?');
      if (!ok) return;
      const f = getCurrentFactura();
      if (!f) return;
      f.lineas.splice(idx, 1);
      if (f.lineas.length < 5) {
        while (f.lineas.length < 5) f.lineas.push(makeLine());
      }
      renderFacturaToUI(f);
      recalcAll();
      status('Línea eliminada');
    });

    // calcular inicial
    calcLine(line, node);
    showLineLastPrices(node, line.producto);

    return node;
  };

  const renderGrid = (f) => {
    const wrap = $('#lineas');
    if (!wrap) return;
    wrap.innerHTML = '';

    // mínimo 5
    if (!Array.isArray(f.lineas)) f.lineas = [];
    while (f.lineas.length < 5) f.lineas.push(makeLine());

    f.lineas.forEach((line, idx) => {
      const row = renderLineRow(line, idx);
      wrap.appendChild(row);
    });
  };

  const addLinea = () => {
    const f = getCurrentFactura();
    if (!f) return;
    f.lineas.push(makeLine());
    renderGrid(f);
    recalcAll();
  };

  const vaciarLineas = async () => {
    const ok = await confirmBox('Vaciar líneas', '¿Reiniciar líneas a 5 filas vacías?');
    if (!ok) return;
    const f = getCurrentFactura();
    if (!f) return;
    f.lineas = [makeLine(), makeLine(), makeLine(), makeLine(), makeLine()];
    renderGrid(f);
    recalcAll();
    status('Líneas reiniciadas');
  };

  /* =========================
     FACTURA UI RENDER
  ========================= */
  const fillClienteSelects = () => {
    const sel = $('#selCliente');
    const selConta = $('#contaCliente');

    const makeOpts = (s) => {
      if (!s) return;
      const keep = s.value;
      s.innerHTML = '';
      const o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = '— Seleccionar —';
      s.appendChild(o0);
      for (const c of CLIENTES) {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nombre} · ${c.nif || ''}`;
        s.appendChild(o);
      }
      s.value = keep || '';
    };

    makeOpts(sel);
    makeOpts(selConta);
  };

  const fillEnvaseSelectProducto = () => {
    const sel = $('#prdEnvaseDefault');
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = '— (sin envase por defecto) —';
    sel.appendChild(o0);

    for (const t of TARAS) {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.nombre} (${String(t.peso).replace('.',',')} kg)`;
      sel.appendChild(o);
    }
    sel.value = keep || '';
  };

  const renderProveedorToUI = (f) => {
    $('#provNombre').value = f?.proveedor?.nombre || '';
    $('#provNif').value = f?.proveedor?.nif || '';
    $('#provDir').value = f?.proveedor?.dir || '';
    $('#provTel').value = f?.proveedor?.tel || '';
    $('#provEmail').value = f?.proveedor?.email || '';
  };

  const renderClienteToUI = (f) => {
    $('#selCliente').value = f.clienteId || '';

    const snap = f.clienteSnapshot || { nombre:'', nif:'', dir:'', tel:'', email:'' };
    $('#cliNombre').value = snap.nombre || '';
    $('#cliNif').value = snap.nif || '';
    $('#cliDir').value = snap.dir || '';
    $('#cliTel').value = snap.tel || '';
    $('#cliEmail').value = snap.email || '';
  };

  const renderFacturaToUI = (f) => {
    if (!f) return;

    $('#facNumero').value = f.numero || '';
    $('#facFecha').value = dmyFromISO(f.fechaISO);
    $('#facMetodoPago').value = f.metodoPago || 'efectivo';
    $('#facTags').value = f.tags || '';
    $('#facNotas').value = f.notas || '';
    $('#facObs').value = f.obs || '';

    $('#chkTransporte').checked = !!f.transporte;
    $('#chkIvaIncluido').checked = !!f.ivaIncluido;

    renderProveedorToUI(f);
    fillClienteSelects();
    renderClienteToUI(f);

    renderGrid(f);
    renderPagosList();
    recalcAll();
  };

  /* =========================
     PAGOS
  ========================= */
  const renderPagosList = () => {
    const box = $('#listaPagos');
    const f = getCurrentFactura();
    if (!box || !f) return;

    const pagos = Array.isArray(f.pagos) ? f.pagos : [];
    if (pagos.length === 0) {
      box.innerHTML = `<div class="row"><div class="left"><div class="title">Sin pagos</div><div class="sub">Añade pagos parciales si corresponde</div></div></div>`;
      return;
    }

    box.innerHTML = '';
    pagos.forEach(p => {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.className = 'left';
      left.innerHTML = `
        <div class="title">${fmt2(toNum(p.importe))} €</div>
        <div class="sub">${dmyFromISO(p.fechaISO)}</div>
      `;

      const right = document.createElement('div');
      right.className = 'right';
      const b = document.createElement('button');
      b.className = 'btn danger';
      b.type = 'button';
      b.textContent = 'Eliminar';
      b.onclick = async () => {
        const ok = await confirmBox('Eliminar pago', '¿Eliminar este pago?');
        if (!ok) return;
        f.pagos = f.pagos.filter(x => x.id !== p.id);
        recalcAll();
        status('Pago eliminado');
      };

      right.appendChild(b);

      row.appendChild(left);
      row.appendChild(right);
      box.appendChild(row);
    });
  };

  /* =========================
     FACTURAS TABLE (TAB)
  ========================= */
  const renderFacturasTable = (filtered = null) => {
    const tb = $('#tbodyFacturas');
    if (!tb) return;

    const arr = Array.isArray(filtered) ? filtered : FACTURAS;
    tb.innerHTML = '';

    if (!arr || arr.length === 0) {
      tb.innerHTML = `<tr><td colspan="7" class="muted">Sin facturas</td></tr>`;
      return;
    }

    for (const f of arr) {
      const tr = document.createElement('tr');
      const cli = (f?.clienteSnapshot?.nombre || getClienteById(f?.clienteId)?.nombre || '');
      const tags = (f?.tags || '');

      tr.innerHTML = `
        <td>${escapeHtml(dmyFromISO(f.fechaISO))}</td>
        <td>${escapeHtml(f.numero || '')}</td>
        <td>${escapeHtml(cli)}</td>
        <td>${escapeHtml(tags)}</td>
        <td>${escapeHtml(fmt2(f?.totals?.total ?? 0))}</td>
        <td>${escapeHtml(f.estado || '')}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn" data-act="edit">Editar</button>
          <button class="btn" data-act="pdf">Ver PDF</button>
        </td>
      `;

      const btnEdit = $('button[data-act="edit"]', tr);
      const btnPdf = $('button[data-act="pdf"]', tr);

      btnEdit.onclick = () => {
        setCurrentFactura(f);
        setActiveTab('factura');
      };

      btnPdf.onclick = () => {
        // PDF real se completa en PARTE 4
        status('PDF: se completa en Parte 4');
        openPdfViewerPlaceholder(f);
      };

      tb.appendChild(tr);
    }
  };

  const filterFacturas = () => {
    const q = norm($('#qFactura').value);
    const desdeISO = isoFromDMY($('#qDesde').value);
    const hastaISO = isoFromDMY($('#qHasta').value);

    let arr = [...FACTURAS];

    if (desdeISO) arr = arr.filter(f => (f.fechaISO || '') >= desdeISO);
    if (hastaISO) arr = arr.filter(f => (f.fechaISO || '') <= hastaISO);

    if (q) {
      arr = arr.filter(f => {
        const cli = norm(f?.clienteSnapshot?.nombre || '');
        const num = norm(f?.numero || '');
        const tags = norm(f?.tags || '');
        const fecha = norm(dmyFromISO(f?.fechaISO || ''));
        return (cli.includes(q) || num.includes(q) || tags.includes(q) || fecha.includes(q));
      });
    }

    renderFacturasTable(arr);
  };

  /* =========================
     PDF VIEWER (placeholder)
  ========================= */
  const openPdfViewerPlaceholder = (f) => {
    // Mientras no exista PARTE 4, mostramos un texto simple
    const frame = $('#pdfFrame');
    if (!frame) return;
    const html = `
      <html><head><meta charset="utf-8"><title>PDF pendiente</title></head>
      <body style="font-family:Arial;padding:20px">
        <h2>PDF PRO pendiente</h2>
        <p>Esta función se completa en <b>PARTE 4/4</b> (PDF multipágina + suma y sigue + QR + visor real).</p>
        <p><b>Factura:</b> ${escapeHtml(f?.numero || '')}</p>
        <p><b>Cliente:</b> ${escapeHtml(f?.clienteSnapshot?.nombre || '')}</p>
        <p><b>Total:</b> ${escapeHtml(fmt2(f?.totals?.total ?? 0))} €</p>
      </body></html>
    `;
    const blob = new Blob([html], { type:'text/html' });
    const url = URL.createObjectURL(blob);
    currentPdfUrl && URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = url;
    frame.src = url;
    openModal('modalPdf');
  };

  /* =========================
     WHATSAPP
  ========================= */
  const buildWhatsappText = (f) => {
    const cli = (f?.clienteSnapshot?.nombre || '');
    const fecha = dmyFromISO(f?.fechaISO);
    const lines = (f?.lineas || [])
      .filter(l => (l.producto || '').trim())
      .map(l => {
        const modo = l.modo || 'kg';
        const cant = l.cantidad || '';
        const bruto = l.bruto || '';
        const tara = l.tara || '';
        const neto = l.neto || '';
        const precio = l.precio || '';
        const imp = fmt2(l.importe || 0);

        if (modo === 'kg') return `• ${l.producto} | kg | env:${cant} | bruto:${bruto} | tara:${tara} | neto:${neto} | p:${precio} | ${imp}€`;
        if (modo === 'caja') return `• ${l.producto} | caja | cant:${cant} | p:${precio} | ${imp}€`;
        return `• ${l.producto} | ud | cant:${cant} | p:${precio} | ${imp}€`;
      });

    const t = f?.totals || {};
    const parts = [
      `FACTURA ${f?.numero || ''}`,
      `Fecha: ${fecha}`,
      `Cliente: ${cli}`,
      '',
      ...lines,
      '',
      `Subtotal: ${fmt2(t.subtotal||0)}€`,
      f.transporte ? `Transporte: ${fmt2(t.transporte||0)}€` : '',
      f.ivaIncluido ? `IVA: incluido` : `IVA: ${fmt2(t.iva||0)}€`,
      `TOTAL: ${fmt2(t.total||0)}€`,
      `Pendiente: ${fmt2(t.pendiente||0)}€`
    ].filter(Boolean);

    return parts.join('\n');
  };

  const sendWhatsapp = () => {
    const f = getCurrentFactura();
    if (!f) return;
    const txt = buildWhatsappText(f);
    const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* =========================
     PRICE HISTORY
  ========================= */
  const pushPriceHist = (productName, modo, precio) => {
    const key = norm(productName);
    if (!key) return;
    const p = Number.isFinite(precio) ? precio : toNum(precio);
    if (!Number.isFinite(p) || p <= 0) return;
    if (!PRICEHIST[key]) PRICEHIST[key] = [];
    PRICEHIST[key].unshift({ ts: Date.now(), modo, precio: p });
    // mantener 5
    PRICEHIST[key] = PRICEHIST[key].slice(0,5);
  };

  /* =========================
     SAVE FACTURA FROM UI
  ========================= */
  const readProveedorFromUI = () => ({
    nombre: $('#provNombre').value.trim(),
    nif: $('#provNif').value.trim(),
    dir: $('#provDir').value.trim(),
    tel: $('#provTel').value.trim(),
    email: $('#provEmail').value.trim()
  });

  const readClienteSnapshotFromUI = () => ({
    nombre: $('#cliNombre').value.trim(),
    nif: $('#cliNif').value.trim(),
    dir: $('#cliDir').value.trim(),
    tel: $('#cliTel').value.trim(),
    email: $('#cliEmail').value.trim()
  });

  const readFacturaFromUI = () => {
    const f = getCurrentFactura();
    if (!f) return null;

    f.numero = $('#facNumero').value.trim() || f.numero || buildFacturaNumero();

    const iso = isoFromDMY($('#facFecha').value);
    if (iso) f.fechaISO = iso;

    f.metodoPago = $('#facMetodoPago').value || 'efectivo';
    f.tags = $('#facTags').value.trim();
    f.notas = $('#facNotas').value.trim();
    f.obs = $('#facObs').value.trim();

    f.transporte = $('#chkTransporte').checked;
    f.ivaIncluido = $('#chkIvaIncluido').checked;

    f.proveedor = readProveedorFromUI();

    f.clienteId = $('#selCliente').value || '';
    f.clienteSnapshot = readClienteSnapshotFromUI();

    // líneas ya están en f.lineas por eventos; pero sincronizamos por seguridad con DOM:
    const rows = $$('#lineas .gridLine');
    rows.forEach((row, idx) => {
      const l = f.lineas[idx];
      if (!l) return;
      l.producto = $('.inProd', row).value;
      l.modo = $('.inModo', row).value;
      l.cantidad = $('.inCant', row).value;
      l.bruto = $('.inBruto', row).value;
      l.envaseId = $('.inEnvase', row).value;
      l.tara = $('.inTara', row).value;
      l.neto = $('.inNeto', row).value;
      l.precio = $('.inPrecio', row).value;
      l.origen = $('.inOrigen', row).value;
      // importe recalculado
    });

    recalcAll();

    f.updatedAt = Date.now();
    return f;
  };

  const saveFacturaNow = async () => {
    const f = readFacturaFromUI();
    if (!f) return;

    // validación ligera
    const hasClient = !!(f.clienteSnapshot?.nombre || '').trim();
    const hasAnyLine = (f.lineas || []).some(l => (l.producto || '').trim());
    if (!hasClient || !hasAnyLine) {
      const ok = await confirmBox('Guardar con avisos', `Falta cliente o no hay líneas.\n¿Guardar igualmente?`);
      if (!ok) return;
    }

    // guardar proveedor global
    PROV = { ...f.proveedor };
    save(K.prov, PROV);

    // guardar factura
    upsertFactura(f);

    // actualizar historial precios usando líneas con producto+precio
    (f.lineas || []).forEach(l => {
      const prod = (l.producto || '').trim();
      if (!prod) return;
      pushPriceHist(prod, l.modo || 'kg', toNum(l.precio));
    });
    save(K.pricehist, PRICEHIST);

    renderFacturasTable();
    if (contaUnlocked) renderContabilidad();
    status('Factura guardada');
  };

  /* =========================
     CLIENTE EN FACTURA: selector + guardar
  ========================= */
  const applyClienteToFactura = (clienteId) => {
    const f = getCurrentFactura();
    if (!f) return;
    const c = getClienteById(clienteId);
    if (!c) return;

    f.clienteId = c.id;
    f.clienteSnapshot = {
      nombre: c.nombre || '',
      nif: c.nif || '',
      dir: c.dir || '',
      tel: c.tel || '',
      email: c.email || ''
    };

    // aplicar plantillas recomendadas por cliente
    if (c.tpl) {
      if (c.tpl.pago && c.tpl.pago !== 'auto') {
        f.metodoPago = c.tpl.pago;
        $('#facMetodoPago').value = f.metodoPago;
      }
      if (c.tpl.tags) {
        const existing = ($('#facTags').value || '').trim();
        const add = (c.tpl.tags || '').trim();
        if (add && !norm(existing).includes(norm(add))) {
          $('#facTags').value = existing ? (existing + ', ' + add) : add;
          f.tags = $('#facTags').value.trim();
        }
      }
      if (c.tpl.notas) {
        const n = ($('#facNotas').value || '').trim();
        if (!n) {
          $('#facNotas').value = c.tpl.notas;
          f.notas = c.tpl.notas;
        }
      }
      if (c.tpl.ivaIncl && c.tpl.ivaIncl !== 'auto') {
        f.ivaIncluido = (c.tpl.ivaIncl === 'si');
        $('#chkIvaIncluido').checked = f.ivaIncluido;
      }
      if (c.tpl.trans && c.tpl.trans !== 'auto') {
        f.transporte = (c.tpl.trans === 'si');
        $('#chkTransporte').checked = f.transporte;
      }
    }

    renderClienteToUI(f);
    recalcAll();
  };

  const guardarClienteDesdeFactura = () => {
    const f = getCurrentFactura();
    if (!f) return;

    const snap = readClienteSnapshotFromUI();
    if (!snap.nombre) {
      status('Cliente: falta nombre');
      return;
    }

    const selId = $('#selCliente').value;
    if (selId) {
      // actualizar existente
      const c = getClienteById(selId);
      if (c) {
        c.nombre = snap.nombre;
        c.nif = snap.nif;
        c.dir = snap.dir;
        c.tel = snap.tel;
        c.email = snap.email;
        c.updatedAt = Date.now();
      }
      save(K.clientes, CLIENTES);
      fillClienteSelects();
      status('Cliente actualizado');
      return;
    }

    // crear nuevo
    const c = {
      id: uid(),
      nombre: snap.nombre,
      nif: snap.nif,
      dir: snap.dir,
      tel: snap.tel,
      email: snap.email,
      alias: '',
      notas: '',
      tpl: { ivaIncl:'auto', trans:'auto', pago:'auto', tags:'', notas:'' }
    };
    CLIENTES.unshift(c);
    save(K.clientes, CLIENTES);
    fillClienteSelects();
    $('#selCliente').value = c.id;
    applyClienteToFactura(c.id);
    status('Cliente creado');
  };

  /* =========================
     PRODUCTOS TAB (CRUD)
  ========================= */
  const renderProductosList = (query = '') => {
    const box = $('#listaProductos');
    if (!box) return;
    const q = norm(query);

    const arr = PRODUCTOS
      .filter(p => !q || norm(p.nombre).includes(q))
      .slice(0, 500);

    box.innerHTML = '';
    if (arr.length === 0) {
      box.innerHTML = `<div class="row"><div class="left"><div class="title">Sin resultados</div></div></div>`;
      return;
    }

    const tpl = $('#tplItem');

    arr.forEach(p => {
      const item = tpl.content.firstElementChild.cloneNode(true);
      $('.liTitle', item).textContent = p.nombre;
      const sub = [];
      sub.push(`modo:${p.modo || 'kg'}`);
      if (toNum(p.precioKg) > 0) sub.push(`€/kg:${fmt2(toNum(p.precioKg))}`);
      if (toNum(p.precioCaja) > 0) sub.push(`€/caja:${fmt2(toNum(p.precioCaja))}`);
      if (toNum(p.precioUd) > 0) sub.push(`€/ud:${fmt2(toNum(p.precioUd))}`);
      $('.liSub', item).textContent = sub.join(' · ');

      item.onclick = () => loadProductoToForm(p.id);
      box.appendChild(item);
    });
  };

  const loadProductoToForm = (id) => {
    const p = PRODUCTOS.find(x => x.id === id);
    if (!p) return;
    $('#prdEditId').value = p.id;
    $('#prdNombre').value = p.nombre || '';
    $('#prdModo').value = p.modo || 'kg';
    $('#prdKgCaja').value = (p.kgCaja ?? '').toString().replace('.', ',');
    $('#prdPrecioKg').value = (p.precioKg ?? '').toString().replace('.', ',');
    $('#prdPrecioCaja').value = (p.precioCaja ?? '').toString().replace('.', ',');
    $('#prdPrecioUd').value = (p.precioUd ?? '').toString().replace('.', ',');
    $('#prdCoste').value = (p.coste ?? '').toString().replace('.', ',');
    $('#prdOrigen').value = p.origen || '';
    $('#prdEnvaseDefault').value = p.envaseId || '';

    // historial
    const key = norm(p.nombre);
    const hist = (PRICEHIST[key] || []);
    $('#prdHistorial').innerHTML = hist.length
      ? hist.map(it => `<div>• ${escapeHtml(it.modo)} · ${fmt2(it.precio)} · ${new Date(it.ts).toLocaleString()}</div>`).join('')
      : `<div class="muted">Sin historial todavía</div>`;
  };

  const clearProductoForm = () => {
    $('#prdEditId').value = '';
    $('#prdNombre').value = '';
    $('#prdModo').value = 'kg';
    $('#prdKgCaja').value = '';
    $('#prdPrecioKg').value = '';
    $('#prdPrecioCaja').value = '';
    $('#prdPrecioUd').value = '';
    $('#prdCoste').value = '';
    $('#prdOrigen').value = '';
    $('#prdEnvaseDefault').value = '';
    $('#prdHistorial').innerHTML = `<div class="muted">—</div>`;
  };

  const saveProductoFromForm = async () => {
    const id = $('#prdEditId').value;
    let nombre = $('#prdNombre').value.trim().toUpperCase();
    if (!nombre) { status('Producto: falta nombre'); return; }

    const modo = $('#prdModo').value || 'kg';
    const kgCaja = clamp0(toNum($('#prdKgCaja').value));
    const precioKg = clamp0(toNum($('#prdPrecioKg').value));
    const precioCaja = clamp0(toNum($('#prdPrecioCaja').value));
    const precioUd = clamp0(toNum($('#prdPrecioUd').value));
    const coste = clamp0(toNum($('#prdCoste').value));
    const origen = $('#prdOrigen').value.trim();
    const envaseId = $('#prdEnvaseDefault').value || '';

    // evitar duplicados por nombre
    const exists = PRODUCTOS.find(p => norm(p.nombre) === norm(nombre) && p.id !== id);
    if (exists) {
      const ok = await confirmBox('Producto duplicado', `Ya existe "${nombre}".\n¿Guardar igualmente?`);
      if (!ok) return;
    }

    if (id) {
      const p = PRODUCTOS.find(x => x.id === id);
      if (!p) return;
      p.nombre = nombre;
      p.modo = modo;
      p.kgCaja = kgCaja;
      p.precioKg = precioKg;
      p.precioCaja = precioCaja;
      p.precioUd = precioUd;
      p.coste = coste;
      p.origen = origen;
      p.envaseId = envaseId;
      p.updatedAt = Date.now();
    } else {
      PRODUCTOS.unshift({
        id: uid(),
        nombre,
        modo,
        kgCaja,
        precioKg,
        precioCaja,
        precioUd,
        coste,
        origen,
        envaseId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      $('#prdEditId').value = PRODUCTOS[0].id;
    }

    save(K.productos, PRODUCTOS);
    renderProductosList($('#qProducto').value);
    status('Producto guardado');

    // refrescar selects envases en grid y producto form
    fillEnvaseSelectProducto();
    const f = getCurrentFactura();
    if (f) renderGrid(f);
  };

  const deleteProducto = async () => {
    const id = $('#prdEditId').value;
    if (!id) return;

    const p = PRODUCTOS.find(x => x.id === id);
    if (!p) return;

    // protección: si se ha usado en facturas
    const used = FACTURAS.some(f => (f.lineas || []).some(l => norm(l.producto) === norm(p.nombre)));
    if (used) {
      status('No se puede eliminar: usado en facturas');
      return;
    }

    const ok = await confirmBox('Eliminar producto', `¿Eliminar "${p.nombre}"?`);
    if (!ok) return;

    PRODUCTOS = PRODUCTOS.filter(x => x.id !== id);
    save(K.productos, PRODUCTOS);
    clearProductoForm();
    renderProductosList($('#qProducto').value);
    status('Producto eliminado');
  };

  /* =========================
     CLIENTES TAB (CRUD)
  ========================= */
  const renderClientesList = (query = '') => {
    const box = $('#listaClientes');
    if (!box) return;
    const q = norm(query);

    const arr = CLIENTES
      .filter(c => !q || norm(c.nombre).includes(q) || norm(c.nif).includes(q) || norm(c.alias).includes(q))
      .slice(0, 500);

    box.innerHTML = '';
    if (arr.length === 0) {
      box.innerHTML = `<div class="row"><div class="left"><div class="title">Sin resultados</div></div></div>`;
      return;
    }

    const tpl = $('#tplItem');
    arr.forEach(c => {
      const item = tpl.content.firstElementChild.cloneNode(true);
      $('.liTitle', item).textContent = c.nombre;
      $('.liSub', item).textContent = `${c.nif || ''} · ${c.dir || ''}`.trim();
      item.onclick = () => loadClienteToForm(c.id);
      box.appendChild(item);
    });
  };

  const loadClienteToForm = (id) => {
    const c = getClienteById(id);
    if (!c) return;
    $('#cliEditId').value = c.id;
    $('#cliEditNombre').value = c.nombre || '';
    $('#cliEditAlias').value = c.alias || '';
    $('#cliEditNif').value = c.nif || '';
    $('#cliEditDir').value = c.dir || '';
    $('#cliEditTel').value = c.tel || '';
    $('#cliEditEmail').value = c.email || '';
    $('#cliEditNotas').value = c.notas || '';

    $('#cliTplIvaIncl').value = c.tpl?.ivaIncl || 'auto';
    $('#cliTplTrans').value = c.tpl?.trans || 'auto';
    $('#cliTplPago').value = c.tpl?.pago || 'auto';
    $('#cliTplTags').value = c.tpl?.tags || '';
    $('#cliTplNotas').value = c.tpl?.notas || '';
  };

  const clearClienteForm = () => {
    $('#cliEditId').value = '';
    $('#cliEditNombre').value = '';
    $('#cliEditAlias').value = '';
    $('#cliEditNif').value = '';
    $('#cliEditDir').value = '';
    $('#cliEditTel').value = '';
    $('#cliEditEmail').value = '';
    $('#cliEditNotas').value = '';
    $('#cliTplIvaIncl').value = 'auto';
    $('#cliTplTrans').value = 'auto';
    $('#cliTplPago').value = 'auto';
    $('#cliTplTags').value = '';
    $('#cliTplNotas').value = '';
  };

  const saveClienteFromForm = () => {
    const id = $('#cliEditId').value;
    const nombre = $('#cliEditNombre').value.trim();
    if (!nombre) { status('Cliente: falta nombre'); return; }

    const payload = {
      nombre,
      alias: $('#cliEditAlias').value.trim(),
      nif: $('#cliEditNif').value.trim(),
      dir: $('#cliEditDir').value.trim(),
      tel: $('#cliEditTel').value.trim(),
      email: $('#cliEditEmail').value.trim(),
      notas: $('#cliEditNotas').value.trim(),
      tpl: {
        ivaIncl: $('#cliTplIvaIncl').value,
        trans: $('#cliTplTrans').value,
        pago: $('#cliTplPago').value,
        tags: $('#cliTplTags').value.trim(),
        notas: $('#cliTplNotas').value.trim(),
      },
      updatedAt: Date.now()
    };

    if (id) {
      const c = getClienteById(id);
      if (!c) return;
      Object.assign(c, payload);
    } else {
      CLIENTES.unshift({ id: uid(), ...payload, createdAt: Date.now() });
      $('#cliEditId').value = CLIENTES[0].id;
    }

    save(K.clientes, CLIENTES);
    fillClienteSelects();
    renderClientesList($('#qCliente').value);
    status('Cliente guardado');
  };

  const deleteCliente = async () => {
    const id = $('#cliEditId').value;
    if (!id) return;
    const c = getClienteById(id);
    if (!c) return;

    // protección: si se ha usado en facturas
    const used = FACTURAS.some(f => f.clienteId === id);
    if (used) {
      status('No se puede eliminar: usado en facturas');
      return;
    }

    const ok = await confirmBox('Eliminar cliente', `¿Eliminar "${c.nombre}"?`);
    if (!ok) return;

    CLIENTES = CLIENTES.filter(x => x.id !== id);
    save(K.clientes, CLIENTES);
    clearClienteForm();
    fillClienteSelects();
    renderClientesList($('#qCliente').value);
    status('Cliente eliminado');
  };

  /* =========================
     TARAS TAB (CRUD)
  ========================= */
  const renderTarasList = (query = '') => {
    const box = $('#listaTaras');
    if (!box) return;
    const q = norm(query);

    const arr = TARAS
      .filter(t => !q || norm(t.nombre).includes(q))
      .slice(0, 500);

    box.innerHTML = '';
    if (arr.length === 0) {
      box.innerHTML = `<div class="row"><div class="left"><div class="title">Sin resultados</div></div></div>`;
      return;
    }

    const tpl = $('#tplItem');
    arr.forEach(t => {
      const item = tpl.content.firstElementChild.cloneNode(true);
      $('.liTitle', item).textContent = t.nombre;
      $('.liSub', item).textContent = `${String(t.peso).replace('.',',')} kg · ${t.notas || ''}`;
      item.onclick = () => loadTaraToForm(t.id);
      box.appendChild(item);
    });
  };

  const loadTaraToForm = (id) => {
    const t = getTaraById(id);
    if (!t) return;
    $('#taraEditId').value = t.id;
    $('#taraNombre').value = t.nombre || '';
    $('#taraPeso').value = String(t.peso ?? '').replace('.', ',');
    $('#taraNotas').value = t.notas || '';
  };

  const clearTaraForm = () => {
    $('#taraEditId').value = '';
    $('#taraNombre').value = '';
    $('#taraPeso').value = '';
    $('#taraNotas').value = '';
  };

  const saveTaraFromForm = () => {
    const id = $('#taraEditId').value;
    const nombre = $('#taraNombre').value.trim();
    if (!nombre) { status('Tara: falta nombre'); return; }
    const peso = clamp0(toNum($('#taraPeso').value));
    const notas = $('#taraNotas').value.trim();

    if (id) {
      const t = getTaraById(id);
      if (!t) return;
      t.nombre = nombre;
      t.peso = peso;
      t.notas = notas;
      t.updatedAt = Date.now();
    } else {
      TARAS.unshift({ id: uid(), nombre, peso, notas, createdAt: Date.now(), updatedAt: Date.now() });
      $('#taraEditId').value = TARAS[0].id;
    }

    save(K.taras, TARAS);
    renderTarasList($('#qTara').value);
    status('Tara guardada');

    // refrescar envases en grid y en productos
    fillEnvaseSelectProducto();
    const f = getCurrentFactura();
    if (f) renderGrid(f);
  };

  const deleteTara = async () => {
    const id = $('#taraEditId').value;
    if (!id) return;
    const t = getTaraById(id);
    if (!t) return;

    // protección: si se usa como envase por defecto en productos o en facturas
    const usedProd = PRODUCTOS.some(p => p.envaseId === id);
    const usedFac = FACTURAS.some(f => (f.lineas || []).some(l => l.envaseId === id));
    if (usedProd || usedFac) {
      status('No se puede eliminar: usada en productos o facturas');
      return;
    }

    const ok = await confirmBox('Eliminar tara', `¿Eliminar "${t.nombre}"?`);
    if (!ok) return;

    TARAS = TARAS.filter(x => x.id !== id);
    save(K.taras, TARAS);
    clearTaraForm();
    renderTarasList($('#qTara').value);

    fillEnvaseSelectProducto();
    const f = getCurrentFactura();
    if (f) renderGrid(f);

    status('Tara eliminada');
  };

  /* =========================
     AJUSTES
  ========================= */
  const renderAjustes = () => {
    $('#setIvaPct').value = String(AJUSTES.ivaPct ?? 4).replace('.', ',');
    $('#setTransPct').value = String(AJUSTES.transPct ?? 10).replace('.', ',');
    $('#setPin').value = String(AJUSTES.pin ?? '8410');
    $('#setQrPlantilla').value = AJUSTES.qrPlantilla || 'NIF={NIF}|FAC={FAC}|FECHA={FECHA}|TOTAL={TOTAL}';

    $('#fbApiKey').value = AJUSTES.firebase?.apiKey || '';
    $('#fbAuthDomain').value = AJUSTES.firebase?.authDomain || '';
    $('#fbDbUrl').value = AJUSTES.firebase?.databaseURL || '';
    $('#fbProjectId').value = AJUSTES.firebase?.projectId || '';
    $('#fbAppId').value = AJUSTES.firebase?.appId || '';
    $('#fbStorageBucket').value = AJUSTES.firebase?.storageBucket || '';
  };

  const saveAjustes = () => {
    AJUSTES.ivaPct = clamp0(toNum($('#setIvaPct').value) || 0) || 4;
    AJUSTES.transPct = clamp0(toNum($('#setTransPct').value) || 0) || 10;
    AJUSTES.pin = ($('#setPin').value || '8410').trim() || '8410';
    AJUSTES.qrPlantilla = ($('#setQrPlantilla').value || '').trim() || 'NIF={NIF}|FAC={FAC}|FECHA={FECHA}|TOTAL={TOTAL}';
    AJUSTES.firebase = {
      apiKey: $('#fbApiKey').value.trim(),
      authDomain: $('#fbAuthDomain').value.trim(),
      databaseURL: $('#fbDbUrl').value.trim(),
      projectId: $('#fbProjectId').value.trim(),
      appId: $('#fbAppId').value.trim(),
      storageBucket: $('#fbStorageBucket').value.trim(),
    };

    save(K.ajustes, AJUSTES);
    recalcAll();
    if (contaUnlocked) renderContabilidad();
    if (ventasUnlocked) renderVentasReport();
    status('Ajustes guardados');
  };

  /* =========================
     CONTABILIDAD (PIN) — básico ya aquí
  ========================= */
  const unlockByPin = (pin) => (String(pin || '') === String(AJUSTES.pin || '8410'));

  const renderContabilidad = () => {
    const tbody = $('#tbodyConta');
    if (!tbody) return;

    const desde = isoFromDMY($('#contaDesde').value);
    const hasta = isoFromDMY($('#contaHasta').value);
    const cid = $('#contaCliente').value || '';
    const tag = norm($('#contaTag').value || '');

    let arr = [...FACTURAS];
    if (desde) arr = arr.filter(f => (f.fechaISO||'') >= desde);
    if (hasta) arr = arr.filter(f => (f.fechaISO||'') <= hasta);
    if (cid) arr = arr.filter(f => f.clienteId === cid);
    if (tag) arr = arr.filter(f => norm(f.tags||'').includes(tag));

    // KPIs
    const ventas = arr.reduce((a,f) => a + (f?.totals?.total ?? 0), 0);
    const iva = arr.reduce((a,f) => a + (f?.totals?.ivaInterno ?? 0), 0);
    const num = arr.length;

    // margen si hay coste por producto
    let margen = 0;
    for (const f of arr) {
      for (const l of (f.lineas || [])) {
        const prod = getProductoByName(l.producto);
        const coste = prod ? toNum(prod.coste) : 0;
        const modo = l.modo || 'kg';
        let cantidad = 0;
        if (modo === 'kg') {
          cantidad = toNum(l.neto);
        } else {
          cantidad = toNum(l.cantidad);
        }
        if (Number.isFinite(coste) && coste > 0 && Number.isFinite(cantidad) && cantidad > 0) {
          margen += (toNum(l.precio) - coste) * cantidad;
        }
      }
    }

    setText($('#kpiVentas'), fmt2(ventas));
    setText($('#kpiIva'), fmt2(iva));
    setText($('#kpiNum'), String(num));
    setText($('#kpiMargen'), fmt2(margen));

    tbody.innerHTML = '';
    if (arr.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin resultados</td></tr>`;
      return;
    }

    for (const f of arr) {
      const tr = document.createElement('tr');
      const cli = (f?.clienteSnapshot?.nombre || '');
      tr.innerHTML = `
        <td>${escapeHtml(dmyFromISO(f.fechaISO))}</td>
        <td>${escapeHtml(f.numero || '')}</td>
        <td>${escapeHtml(cli)}</td>
        <td>${escapeHtml(f.tags || '')}</td>
        <td>${escapeHtml(fmt2(f?.totals?.total ?? 0))}</td>
        <td>${escapeHtml(fmt2(f?.totals?.pendiente ?? 0))}</td>
      `;
      tbody.appendChild(tr);
    }
  };

  /* =========================
     VENTAS (PIN) — completo aquí
  ========================= */
  const upsertVenta = (v) => {
    const i = VENTAS.findIndex(x => x.id === v.id);
    if (i >= 0) VENTAS[i] = v;
    else VENTAS.unshift(v);
    // ordenar por fecha desc
    VENTAS.sort((a,b) => (b.fechaISO||'').localeCompare(a.fechaISO||'') || (b.updatedAt||0)-(a.updatedAt||0));
    save(K.ventas, VENTAS);
  };

  const findVentaByDayStore = (fechaISO, tienda) => {
    return VENTAS.find(v => v.fechaISO === fechaISO && v.tienda === tienda) || null;
  };

  const saveVentaDia = () => {
    const fechaISO = isoFromDMY($('#vFecha').value);
    const tienda = $('#vTienda').value;
    if (!fechaISO || !tienda) { status('Ventas: falta fecha/tienda'); return; }

    const efe = clamp0(toNum($('#vEfectivo').value));
    const tar = clamp0(toNum($('#vTarjeta').value));
    const gas = clamp0(toNum($('#vGastos').value));
    const notas = $('#vNotas').value.trim();

    const total = efe + tar;
    const ivaPct = toNum(AJUSTES.ivaPct);
    const iva = (Number.isFinite(ivaPct) && ivaPct > 0)
      ? (total - (total / (1 + ivaPct/100)))
      : 0;

    let v = findVentaByDayStore(fechaISO, tienda);
    if (!v) {
      v = { id: uid(), fechaISO, tienda, createdAt: Date.now() };
    }
    v.efectivo = efe;
    v.tarjeta = tar;
    v.gastos = gas;
    v.notas = notas;
    v.total = total;
    v.neto = total - gas;
    v.iva = iva;
    v.updatedAt = Date.now();

    upsertVenta(v);
    renderVentasReport();
    status('Ventas: día guardado');
  };

  const getRangeISO = () => {
    const desde = isoFromDMY($('#vDesde').value);
    const hasta = isoFromDMY($('#vHasta').value);
    return { desde, hasta };
  };

  const setRangeISOToUI = (desdeISO, hastaISO) => {
    $('#vDesde').value = dmyFromISO(desdeISO);
    $('#vHasta').value = dmyFromISO(hastaISO);
  };

  const weekRangeISO = (iso) => {
    const d = new Date((iso || todayISO()) + 'T00:00:00');
    // semana lunes->domingo
    const day = d.getDay(); // 0 dom .. 6 sab
    const diffToMon = (day === 0 ? -6 : (1 - day));
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const toISO = (dt) => dt.toISOString().slice(0,10);
    return { desdeISO: toISO(mon), hastaISO: toISO(sun) };
  };

  const monthRangeISO = (iso) => {
    const d = new Date((iso || todayISO()) + 'T00:00:00');
    const y = d.getFullYear();
    const m = d.getMonth();
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m+1, 0));
    const toISO = (dt) => dt.toISOString().slice(0,10);
    return { desdeISO: toISO(from), hastaISO: toISO(to) };
  };

  const renderVentasReport = () => {
    const tbody = $('#tbodyVentas');
    if (!tbody) return;

    const { desde, hasta } = getRangeISO();
    const tienda = $('#vFiltroTienda').value || 'ALL';

    let arr = [...VENTAS];
    if (desde) arr = arr.filter(v => (v.fechaISO||'') >= desde);
    if (hasta) arr = arr.filter(v => (v.fechaISO||'') <= hasta);
    if (tienda !== 'ALL') arr = arr.filter(v => v.tienda === tienda);

    // KPIs
    const total = arr.reduce((a,v) => a + (v.total||0), 0);
    const efe = arr.reduce((a,v) => a + (v.efectivo||0), 0);
    const tar = arr.reduce((a,v) => a + (v.tarjeta||0), 0);
    const gas = arr.reduce((a,v) => a + (v.gastos||0), 0);
    const neto = arr.reduce((a,v) => a + (v.neto||0), 0);
    const iva = arr.reduce((a,v) => a + (v.iva||0), 0);

    setText($('#vkTotal'), fmt2(total));
    setText($('#vkEfe'), fmt2(efe));
    setText($('#vkTar'), fmt2(tar));
    setText($('#vkGas'), fmt2(gas));
    setText($('#vkNeto'), fmt2(neto));
    setText($('#vkIva'), fmt2(iva));

    tbody.innerHTML = '';
    if (arr.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Sin datos</td></tr>`;
      return;
    }

    for (const v of arr) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(dmyFromISO(v.fechaISO))}</td>
        <td>${escapeHtml(dayNameES(v.fechaISO))}</td>
        <td>${escapeHtml(v.tienda)}</td>
        <td>${escapeHtml(fmt2(v.efectivo||0))}</td>
        <td>${escapeHtml(fmt2(v.tarjeta||0))}</td>
        <td>${escapeHtml(fmt2(v.total||0))}</td>
        <td>${escapeHtml(fmt2(v.gastos||0))}</td>
        <td>${escapeHtml(fmt2(v.neto||0))}</td>
        <td>${escapeHtml(fmt2(v.iva||0))}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn" data-act="edit">Editar</button>
          <button class="btn danger" data-act="del">Eliminar</button>
        </td>
      `;
      const bEdit = $('button[data-act="edit"]', tr);
      const bDel = $('button[data-act="del"]', tr);

      bEdit.onclick = () => {
        $('#vFecha').value = dmyFromISO(v.fechaISO);
        $('#vTienda').value = v.tienda;
        $('#vEfectivo').value = fmt2(v.efectivo||0);
        $('#vTarjeta').value = fmt2(v.tarjeta||0);
        $('#vGastos').value = fmt2(v.gastos||0);
        $('#vNotas').value = v.notas || '';
        status('Ventas: cargado para editar');
      };

      bDel.onclick = async () => {
        const ok = await confirmBox('Eliminar venta', `¿Eliminar ${dmyFromISO(v.fechaISO)} · ${v.tienda}?`);
        if (!ok) return;
        VENTAS = VENTAS.filter(x => x.id !== v.id);
        save(K.ventas, VENTAS);
        renderVentasReport();
        status('Venta eliminada');
      };

      tbody.appendChild(tr);
    }
  };

  /* =========================
     EXPORTS (CSV/EXCEL) — básicos
  ========================= */
  const exportTableToCSV = (rows, filename) => {
    const esc = (s) => `"${String(s ?? '').replaceAll('"','""')}"`;
    const csv = rows.map(r => r.map(esc).join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : (filename + '.csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportToExcelIfPossible = (rows, sheetName, filename) => {
    try {
      if (typeof XLSX === 'undefined') throw new Error('XLSX no disponible');
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Datos');
      XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : (filename + '.xlsx'));
      return true;
    } catch {
      return false;
    }
  };

  const exportConta = () => {
    const tbody = $('#tbodyConta');
    if (!tbody) return;
    const rows = [['Fecha','Nº','Cliente','Tags','Total','Pendiente']];
    $$('#tbodyConta tr').forEach(tr => {
      const tds = $$('td', tr).map(td => td.textContent.trim());
      if (tds.length === 6) rows.push(tds);
    });
    const ok = exportToExcelIfPossible(rows, 'Contabilidad', 'contabilidad.xlsx');
    if (!ok) exportTableToCSV(rows, 'contabilidad.csv');
  };

  const exportVentas = () => {
    const rows = [['Fecha','Día','Tienda','Efectivo','Tarjeta','Total','Gastos','Neto','IVA','Notas']];
    const { desde, hasta } = getRangeISO();
    const tienda = $('#vFiltroTienda').value || 'ALL';
    let arr = [...VENTAS];
    if (desde) arr = arr.filter(v => (v.fechaISO||'') >= desde);
    if (hasta) arr = arr.filter(v => (v.fechaISO||'') <= hasta);
    if (tienda !== 'ALL') arr = arr.filter(v => v.tienda === tienda);
    arr.forEach(v => rows.push([
      dmyFromISO(v.fechaISO),
      dayNameES(v.fechaISO),
      v.tienda,
      fmt2(v.efectivo||0),
      fmt2(v.tarjeta||0),
      fmt2(v.total||0),
      fmt2(v.gastos||0),
      fmt2(v.neto||0),
      fmt2(v.iva||0),
      v.notas||''
    ]));
    const ok = exportToExcelIfPossible(rows, 'Ventas', 'ventas.xlsx');
    if (!ok) exportTableToCSV(rows, 'ventas.csv');
  };

  /* =========================
     SHORTCUTS
  ========================= */
  const shortcutSearch = () => {
    const active = $('.tabPanel.isActive')?.dataset?.tabpanel || 'factura';
    if (active === 'facturas') $('#qFactura')?.focus();
    else if (active === 'clientes') $('#qCliente')?.focus();
    else if (active === 'productos') $('#qProducto')?.focus();
    else if (active === 'taras') $('#qTara')?.focus();
    else {
      // en factura: foco al primer producto
      const first = $('#lineas .gridLine .inProd');
      first?.focus();
    }
  };

  /* =========================
     BUTTONS WIRE
  ========================= */
  const wire = () => {
    // Tabs
    $$('.tabBtn').forEach(btn => {
      on(btn, 'click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'contabilidad') {
          if (!contaUnlocked) {
            setActiveTab('contabilidad');
            return;
          }
        }
        if (tab === 'ventas') {
          if (!ventasUnlocked) {
            setActiveTab('ventas');
            return;
          }
        }
        setActiveTab(tab);
      });
    });

    // Global modal close
    $$('[data-close]').forEach(x => on(x, 'click', () => closeModal(x.getAttribute('data-close'))));

    // Quick Search
    on($('#btnQuickSearch'), 'click', shortcutSearch);

    // FACTURA actions
    on($('#btnFacturaNueva'), 'click', async () => {
      const ok = await confirmBox('Nueva factura', '¿Crear una factura nueva?');
      if (!ok) return;
      const f = makeFactura();
      // proveedor defaults
      f.proveedor = { ...PROV };
      setCurrentFactura(f);
      status('Factura nueva');
    });

    on($('#btnFacturaDuplicar'), 'click', async () => {
      const cur = getCurrentFactura();
      if (!cur) return;
      const ok = await confirmBox('Duplicar factura', '¿Duplicar esta factura (sin pagos)?');
      if (!ok) return;
      const f = cloneFactura(cur);
      setCurrentFactura(f);
      status('Factura duplicada');
    });

    on($('#btnFacturaEliminar'), 'click', async () => {
      const cur = getCurrentFactura();
      if (!cur) return;
      const ok = await confirmBox('Eliminar factura', `¿Eliminar ${cur.numero}?`);
      if (!ok) return;
      removeFactura(cur.id);
      // cargar otra
      const next = FACTURAS[0] || makeFactura();
      setCurrentFactura(next);
      status('Factura eliminada');
    });

    on($('#btnFacturaGuardar'), 'click', saveFacturaNow);

    // Proveedor defaults + guardar proveedor
    on($('#btnAplicarDefaultsProv'), 'click', () => {
      setProviderDefaultsIfEmpty();
      status('Proveedor por defecto aplicado');
      // reflejar en factura actual
      const f = getCurrentFactura();
      if (f) {
        f.proveedor = readProveedorFromUI();
        PROV = { ...f.proveedor };
        save(K.prov, PROV);
        updateQR();
      }
    });

    on($('#btnGuardarProveedor'), 'click', () => {
      const f = getCurrentFactura();
      if (!f) return;
      f.proveedor = readProveedorFromUI();
      PROV = { ...f.proveedor };
      save(K.prov, PROV);
      updateQR();
      status('Proveedor guardado');
    });

    // Cliente selector + botones
    on($('#selCliente'), 'change', () => {
      const id = $('#selCliente').value;
      if (id) applyClienteToFactura(id);
    });

    on($('#btnClienteNuevo'), 'click', () => {
      $('#selCliente').value = '';
      $('#cliNombre').value = '';
      $('#cliNif').value = '';
      $('#cliDir').value = '';
      $('#cliTel').value = '';
      $('#cliEmail').value = '';
      status('Cliente nuevo (edita y guarda)');
    });

    on($('#btnClienteGuardar'), 'click', guardarClienteDesdeFactura);

    // Meta changes
    on($('#facFecha'), 'input', () => {
      const f = getCurrentFactura();
      if (!f) return;
      const iso = isoFromDMY($('#facFecha').value);
      if (iso) f.fechaISO = iso;
      updateQR();
    });

    on($('#facMetodoPago'), 'change', () => {
      const f = getCurrentFactura(); if (!f) return;
      f.metodoPago = $('#facMetodoPago').value;
    });

    on($('#facTags'), 'input', () => { const f = getCurrentFactura(); if (f) f.tags = $('#facTags').value.trim(); });
    on($('#facNotas'), 'input', () => { const f = getCurrentFactura(); if (f) f.notas = $('#facNotas').value.trim(); });
    on($('#facObs'), 'input', () => { const f = getCurrentFactura(); if (f) f.obs = $('#facObs').value.trim(); });

    // Grid buttons
    on($('#btnAddLinea'), 'click', addLinea);
    on($('#btnVaciarLineas'), 'click', vaciarLineas);

    // Totales toggles
    on($('#chkTransporte'), 'change', () => { const f = getCurrentFactura(); if (f){ f.transporte = $('#chkTransporte').checked; recalcAll(); } });
    on($('#chkIvaIncluido'), 'change', () => { const f = getCurrentFactura(); if (f){ f.ivaIncluido = $('#chkIvaIncluido').checked; recalcAll(); } });

    on($('#btnAddIva4'), 'click', () => {
      // “Añadir 4% IVA al total” -> pone ivaPct a 4 y desactiva iva incluido
      AJUSTES.ivaPct = 4;
      save(K.ajustes, AJUSTES);
      const f = getCurrentFactura();
      if (f) {
        f.ivaIncluido = false;
        $('#chkIvaIncluido').checked = false;
      }
      renderAjustes();
      recalcAll();
      status('IVA 4% aplicado');
    });

    // Pagos
    on($('#btnAddPago'), 'click', () => {
      const f = getCurrentFactura();
      if (!f) return;
      const imp = toNum($('#pagoImporte').value);
      const iso = isoFromDMY($('#pagoFecha').value) || todayISO();
      if (!Number.isFinite(imp) || imp <= 0) { status('Pago: importe inválido'); return; }
      f.pagos = Array.isArray(f.pagos) ? f.pagos : [];
      f.pagos.unshift({ id: uid(), importe: imp, fechaISO: iso });
      $('#pagoImporte').value = '';
      $('#pagoFecha').value = '';
      recalcAll();
      status('Pago añadido');
    });

    // QR buttons
    on($('#btnActualizarQR'), 'click', updateQR);
    on($('#btnCopiarQR'), 'click', async () => {
      const f = getCurrentFactura();
      if (!f) return;
      const ok = canQR(f);
      const txt = ok ? buildQRText(f) : 'Faltan datos para QR';
      try {
        await navigator.clipboard.writeText(txt);
        status('Texto QR copiado');
      } catch {
        status('No se pudo copiar (permiso)');
      }
    });

    // PDF & WhatsApp
    on($('#btnGenPDF'), 'click', () => {
      // Parte 4 define window.FM.generatePDF
      if (window.FM?.generatePDF) window.FM.generatePDF();
      else { status('PDF PRO se completa en Parte 4'); openPdfViewerPlaceholder(getCurrentFactura()); }
    });

    on($('#btnVerPDF'), 'click', () => {
      const f = getCurrentFactura();
      if (!f) return;
      // Si hay PDF localUrl/cached en Parte 4, se usará. Por ahora placeholder.
      status('Visor PDF real en Parte 4');
      openPdfViewerPlaceholder(f);
    });

    on($('#btnPdfCloud'), 'click', () => {
      status('Cloud PDF en Parte 4');
    });

    on($('#btnWhatsApp'), 'click', sendWhatsapp);

    // PDF modal actions
    on($('#btnPdfImprimir'), 'click', () => {
      const frame = $('#pdfFrame');
      if (!frame?.contentWindow) return;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    });

    on($('#btnPdfAbrirPestana'), 'click', () => {
      const frame = $('#pdfFrame');
      if (!frame?.src) return;
      window.open(frame.src, '_blank', 'noopener,noreferrer');
    });

    // Facturas tab search
    on($('#btnBuscarFacturas'), 'click', filterFacturas);
    on($('#btnRefrescarFacturas'), 'click', () => renderFacturasTable());
    on($('#qFactura'), 'input', () => filterFacturas());

    // Clientes tab
    on($('#btnClienteCrear'), 'click', () => { clearClienteForm(); status('Cliente nuevo'); });
    on($('#btnBuscarClientes'), 'click', () => renderClientesList($('#qCliente').value));
    on($('#qCliente'), 'input', () => renderClientesList($('#qCliente').value));
    on($('#btnClienteGuardarFicha'), 'click', saveClienteFromForm);
    on($('#btnClienteEliminarFicha'), 'click', deleteCliente);

    // Productos tab
    on($('#btnProductoCrear'), 'click', () => { clearProductoForm(); status('Producto nuevo'); });
    on($('#btnBuscarProductos'), 'click', () => renderProductosList($('#qProducto').value));
    on($('#qProducto'), 'input', () => renderProductosList($('#qProducto').value));
    on($('#btnProductoGuardar'), 'click', saveProductoFromForm);
    on($('#btnProductoEliminar'), 'click', deleteProducto);

    // Taras tab
    on($('#btnTaraCrear'), 'click', () => { clearTaraForm(); status('Tara nueva'); });
    on($('#btnBuscarTaras'), 'click', () => renderTarasList($('#qTara').value));
    on($('#qTara'), 'input', () => renderTarasList($('#qTara').value));
    on($('#btnTaraGuardar'), 'click', saveTaraFromForm);
    on($('#btnTaraEliminar'), 'click', deleteTara);

    // Ajustes
    on($('#btnGuardarAjustes'), 'click', saveAjustes);

    // Cloud stubs
    on($('#btnCloudTest'), 'click', () => status('Cloud: se completa en Parte 4 (sin crashear)'));
    on($('#btnCloudLogin'), 'click', () => status('Cloud login: Parte 4'));
    on($('#btnCloudLogout'), 'click', () => status('Cloud logout: Parte 4'));
    on($('#btnCloudSync'), 'click', () => status('Cloud sync: Parte 4'));

    // Contabilidad PIN
    on($('#btnUnlockConta'), 'click', () => {
      const pin = $('#pinConta').value;
      if (!unlockByPin(pin)) { status('PIN incorrecto'); return; }
      contaUnlocked = true;
      $('#contaLocked').classList.add('isHidden');
      $('#contaContent').classList.remove('isHidden');
      $('#pinConta').value = '';
      renderContabilidad();
      status('Contabilidad desbloqueada');
    });

    on($('#btnLockConta'), 'click', () => {
      contaUnlocked = false;
      $('#contaContent').classList.add('isHidden');
      $('#contaLocked').classList.remove('isHidden');
      status('Contabilidad bloqueada');
    });

    on($('#btnContaBuscar'), 'click', renderContabilidad);
    on($('#btnContaExport'), 'click', exportConta);

    // Ventas PIN
    on($('#btnUnlockVentas'), 'click', () => {
      const pin = $('#pinVentas').value;
      if (!unlockByPin(pin)) { status('PIN incorrecto'); return; }
      ventasUnlocked = true;
      $('#ventasLocked').classList.add('isHidden');
      $('#ventasContent').classList.remove('isHidden');
      $('#pinVentas').value = '';
      // rango por defecto: semana actual
      const r = weekRangeISO(todayISO());
      setRangeISOToUI(r.desdeISO, r.hastaISO);
      renderVentasReport();
      status('Ventas desbloqueadas');
    });

    on($('#btnLockVentas'), 'click', () => {
      ventasUnlocked = false;
      $('#ventasContent').classList.add('isHidden');
      $('#ventasLocked').classList.remove('isHidden');
      status('Ventas bloqueadas');
    });

    // Ventas acciones
    on($('#btnVentasGuardarDia'), 'click', saveVentaDia);
    on($('#btnVentasAplicarRango'), 'click', renderVentasReport);
    on($('#btnVentasExport'), 'click', exportVentas);

    on($('#btnVentasHoy'), 'click', () => {
      const iso = todayISO();
      setRangeISOToUI(iso, iso);
      renderVentasReport();
    });

    on($('#btnVentasSemana'), 'click', () => {
      const r = weekRangeISO(todayISO());
      setRangeISOToUI(r.desdeISO, r.hastaISO);
      renderVentasReport();
    });

    on($('#btnVentasMes'), 'click', () => {
      const r = monthRangeISO(todayISO());
      setRangeISOToUI(r.desdeISO, r.hastaISO);
      renderVentasReport();
    });

    // Shortcuts teclado
    on(document, 'keydown', (e) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveFacturaNow();
      }
      if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (window.FM?.generatePDF) window.FM.generatePDF();
        else status('PDF PRO en Parte 4');
      }
      if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        shortcutSearch();
      }
      if (e.key === 'Escape') {
        // cerrar modales
        closeModal('modalPdf');
        closeModal('modalConfirm');
      }
    });
  };

  /* =========================
     INIT
  ========================= */
  const init = () => {
    // Ajustes UI
    renderAjustes();

    // Envases en productos
    fillEnvaseSelectProducto();

    // Render listas
    renderClientesList('');
    renderProductosList('');
    renderTarasList('');

    // Factura inicial
    if (FACTURAS.length === 0) {
      const f = makeFactura();
      // proveedor global
      f.proveedor = { ...PROV };
      FACTURAS.unshift(f);
      save(K.facturas, FACTURAS);
    }

    // cargar última
    const lastUI = load(K.ui, {});
    const lastTab = lastUI.lastTab || 'factura';
    const f0 = FACTURAS[0];
    setCurrentFactura(f0);

    setActiveTab(lastTab);

    // wire handlers
    wire();

    // pintar facturas
    renderFacturasTable();

    // Pre-set fecha ventas hoy
    $('#vFecha').value = dmyFromISO(todayISO());

    status('Listo');
  };

  /* =========================
     PUBLIC API for PART 4
  ========================= */
  window.FM = window.FM || {};
  window.FM.getState = () => ({ PROV, CLIENTES, PRODUCTOS, TARAS, FACTURAS, AJUSTES, VENTAS, PRICEHIST });
  window.FM.getCurrentFactura = () => getCurrentFactura();
  window.FM.saveFacturaNow = () => saveFacturaNow();
  window.FM.setPdfUrl = (url) => { currentPdfUrl = url; };
  // window.FM.generatePDF = ... (se define en PARTE 4)
  // window.FM.cloud = ... (se define en PARTE 4)

  // arrancar
  init();

})();
/* =========================================================
PARTE 4/4 — FACTU MIRAL (B/W PRO)
Añadir AL FINAL de app.js (después de la Parte 3)

✅ PDF PRO real (jsPDF + AutoTable):
- Proveedor izquierda · QR centro · Cliente derecha
- Tabla tonos blanco/gris (zebra)
- Multipágina + "Suma y sigue" + "Página X/Y"
- Texto "FACTURA" sobre logo kiwi (arriba derecha)
- Si falla QR → NO se inserta en PDF

✅ Visor PDF real (iframe blob) + imprimir/abrir pestaña

✅ Cloud Firebase OPCIONAL:
- Si no hay config o no hay librería → NO crashea (solo avisa)
- Login/Logout (prompt simple)
- Sync Up / Sync Down (merge por updatedAt)
- Subir PDF a Storage y guardar URL en la factura

Requisitos de librerías (si no están, no crashea):
- jsPDF (UMD) + AutoTable (UMD)
- QRCode.js (ya lo usas en pantalla)
========================================================= */

(() => {
  'use strict';

  if (!window.FM) return;

  /* =========================
     Helpers rápidos
  ========================= */
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const APP_KEY = 'factu_miral_bwpro_v1';
  const K = {
    facturas:`${APP_KEY}_facturas`,
    clientes:`${APP_KEY}_clientes`,
    productos:`${APP_KEY}_productos`,
    taras:`${APP_KEY}_taras`,
    ajustes:`${APP_KEY}_ajustes`,
    ventas:`${APP_KEY}_ventas`,
    pricehist:`${APP_KEY}_pricehist`,
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
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  const toNum = (v) => {
    if (v === null || v === undefined) return NaN;
    const s = ('' + v).trim().replace(/\s+/g,'').replace(',', '.');
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const fmt2 = (n) => {
    const x = Number.isFinite(n) ? n : 0;
    const s = x.toFixed(2);
    const [a,b] = s.split('.');
    const a2 = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${a2},${b}`;
  };

  const fmtKg = (n) => {
    const x = Number.isFinite(n) ? n : 0;
    return x.toFixed(2).replace('.', ',');
  };

  const dmyFromISO = (iso) => {
    if (!iso) return '';
    const m = (''+iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  const status = (msg) => {
    const el = $('#appStatus');
    if (el) el.textContent = msg;
    try { console.log('[FACTU MIRAL]', msg); } catch {}
  };

  const openModal = (id) => {
    const m = $('#'+id);
    if (m) m.classList.remove('isHidden');
  };
  const closeModal = (id) => {
    const m = $('#'+id);
    if (m) m.classList.add('isHidden');
  };

  const setPdfViewer = (url) => {
    const frame = $('#pdfFrame');
    if (frame) frame.src = url;
    openModal('modalPdf');
  };

  const revokePdfUrl = () => {
    const old = window.FM._pdfUrl;
    if (old) {
      try { URL.revokeObjectURL(old); } catch {}
      window.FM._pdfUrl = '';
    }
  };

  /* =========================
     QR helpers (para PDF)
     - si falla => NO se mete en PDF
  ========================= */
  const canQR = (f) => {
    const nif = (f?.proveedor?.nif || '').trim();
    const fac = (f?.numero || '').trim();
    const fecha = (f?.fechaISO || '').trim();
    const total = (f?.totals?.total ?? 0);
    if (!nif || !fac || !fecha) return false;
    return Number.isFinite(+total) || Number.isFinite(total);
  };

  const buildQRText = (f, ajustes) => {
    const tpl = (ajustes?.qrPlantilla || 'NIF={NIF}|FAC={FAC}|FECHA={FECHA}|TOTAL={TOTAL}');
    const nif = (f?.proveedor?.nif || '').trim();
    const fac = (f?.numero || '').trim();
    const fecha = dmyFromISO(f?.fechaISO);
    const total = fmt2(f?.totals?.total ?? 0);
    return tpl
      .replaceAll('{NIF}', nif)
      .replaceAll('{FAC}', fac)
      .replaceAll('{FECHA}', fecha)
      .replaceAll('{TOTAL}', total);
  };

  // Genera dataURL QR usando la misma librería QRCode si existe
  const makeQRDataURL = (text) => {
    try {
      if (typeof QRCode === 'undefined') return null;
      const holder = document.createElement('div');
      holder.style.position = 'fixed';
      holder.style.left = '-9999px';
      holder.style.top = '-9999px';
      holder.style.width = '160px';
      holder.style.height = '160px';
      document.body.appendChild(holder);

      // QRCode.js suele crear canvas o img dentro
      // Si falla => devolvemos null (no QR en PDF)
      // eslint-disable-next-line no-new
      new QRCode(holder, { text, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });

      const canvas = holder.querySelector('canvas');
      const img = holder.querySelector('img');

      let url = null;
      if (canvas && canvas.toDataURL) url = canvas.toDataURL('image/png');
      else if (img && img.src) url = img.src;

      holder.remove();
      return url;
    } catch {
      return null;
    }
  };

  /* =========================
     jsPDF + AutoTable detectors
  ========================= */
  const getJsPDF = () => {
    // UMD clásico: window.jspdf.jsPDF
    // Otros: window.jsPDF
    return (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  };

  const attachAutoTable = (doc) => {
    if (doc && typeof doc.autoTable === 'function') return (opts) => doc.autoTable(opts);

    // UMD de autotable a veces expone window.jspdf_autotable
    const at = window.jspdf_autotable;
    if (!at) return null;

    // Según build: at.default(doc, opts) o at(doc, opts)
    if (typeof at === 'function') return (opts) => at(doc, opts);
    if (typeof at.default === 'function') return (opts) => at.default(doc, opts);

    return null;
  };

  /* =========================
     DRAW: Logo KIWI simple (B/W) en PDF
  ========================= */
  const drawKiwiLogo = (doc, x, y) => {
    // logo minimalista: círculo (kiwi) + semillas en blanco
    // B/W PRO: muy sobrio
    doc.setDrawColor(0);
    doc.setFillColor(0);
    doc.circle(x, y, 7, 'S'); // borde
    doc.setFillColor(245,245,245);
    doc.circle(x, y, 6.4, 'F'); // relleno claro (gris muy suave)

    // semillas
    doc.setFillColor(0);
    const pts = [
      [x-2.6,y-1.2],[x-1.2,y-2.2],[x+1.2,y-2.2],[x+2.6,y-1.2],
      [x-2.8,y+1.4],[x-1.2,y+2.4],[x+1.2,y+2.4],[x+2.8,y+1.4]
    ];
    pts.forEach(p => doc.circle(p[0], p[1], 0.35, 'F'));
  };

  /* =========================
     PDF PRO generator
  ========================= */
  const computeTotals = (f, ajustes) => {
    // Recalculado defensivo (por si abren una factura vieja sin recalcular)
    const ivaPct = toNum(ajustes?.ivaPct);
    const transPct = toNum(ajustes?.transPct);

    const lineas = Array.isArray(f.lineas) ? f.lineas : [];
    const subtotal = lineas.reduce((a,l) => a + (Number.isFinite(+l.importe) ? +l.importe : 0), 0);
    const transporte = f.transporte ? subtotal * ((Number.isFinite(transPct) ? transPct : 0)/100) : 0;
    const base = subtotal + transporte;

    let iva = 0, total = 0, ivaInterno = 0;

    if (f.ivaIncluido) {
      total = base;
      if (Number.isFinite(ivaPct) && ivaPct > 0) ivaInterno = base - (base / (1 + ivaPct/100));
      iva = ivaInterno;
    } else {
      iva = base * ((Number.isFinite(ivaPct) ? ivaPct : 0)/100);
      total = base + iva;
      ivaInterno = iva;
    }

    const pagosSum = (Array.isArray(f.pagos) ? f.pagos : [])
      .reduce((a,p) => a + (Number.isFinite(toNum(p.importe)) ? toNum(p.importe) : 0), 0);

    const pendiente = total - pagosSum;

    f.totals = { subtotal, transporte, iva, total, pendiente, ivaInterno };
  };

  const buildPdfTableBody = (f) => {
    const rows = [];
    const lineas = Array.isArray(f.lineas) ? f.lineas : [];
    for (const l of lineas) {
      if (!((l.producto || '').trim())) continue;

      const modo = l.modo || 'kg';
      const cant = (l.cantidad ?? '').toString().trim();
      const bruto = (l.bruto ?? '').toString().trim();
      const tara = (l.tara ?? '').toString().trim();
      const neto = (l.neto ?? '').toString().trim();
      const precio = (l.precio ?? '').toString().trim();
      const origen = (l.origen ?? '').toString().trim();
      const imp = fmt2(Number.isFinite(+l.importe) ? +l.importe : 0);

      // mostramos bruto/tara/neto incluso en caja/ud si existen (si no, queda vacío)
      rows.push([
        (l.producto || '').toString(),
        modo,
        cant,
        bruto,
        tara,
        neto,
        precio,
        origen,
        imp
      ]);
    }
    return rows;
  };

  const generatePDF = async (facturaInput = null, { openViewer=true } = {}) => {
    const jsPDF = getJsPDF();
    if (!jsPDF) {
      status('PDF: falta jsPDF (no crashea). Añade jsPDF UMD en index para PDF real.');
      return null;
    }

    const state = window.FM.getState();
    const ajustes = state.AJUSTES || load(K.ajustes, {});
    const f = facturaInput ? JSON.parse(JSON.stringify(facturaInput)) : JSON.parse(JSON.stringify(window.FM.getCurrentFactura()));

    if (!f) { status('PDF: no hay factura'); return null; }

    // Recalcular totales por seguridad
    computeTotals(f, ajustes);

    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const autoTable = attachAutoTable(doc);
    if (!autoTable) {
      status('PDF: falta AutoTable (no crashea). Añade jspdf-autotable UMD en index.');
      return null;
    }

    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Frame grande (moderno) - B/W
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);

    // Encabezado alto
    const headerTop = 10;
    const headerH = 46;
    const headerBottom = headerTop + headerH;

    // Título + logo kiwi (arriba derecha)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FACTURA', w - margin, headerTop + 8, { align:'right' });
    drawKiwiLogo(doc, w - margin - 8, headerTop + 18);

    // Caja header
    doc.roundedRect(margin, headerTop, w - 2*margin, headerH, 2, 2);

    // Subcajas: proveedor / QR / cliente
    const boxY = headerTop + 12;
    const boxH = 30;
    const boxW = (w - 2*margin);
    const leftW = boxW * 0.40;
    const midW  = boxW * 0.20;
    const rightW= boxW * 0.40;

    // líneas internas
    doc.setLineWidth(0.25);
    doc.line(margin + leftW, boxY, margin + leftW, boxY + boxH);
    doc.line(margin + leftW + midW, boxY, margin + leftW + midW, boxY + boxH);

    // Proveedor (izq)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROVEEDOR', margin + 2, boxY + 4);

    doc.setFont('helvetica', 'normal');
    const prov = f.proveedor || {};
    const provLines = [
      (prov.nombre || '').trim(),
      `NIF: ${(prov.nif || '').trim()}`,
      (prov.dir || '').trim(),
      (prov.tel || '').trim() ? `Tel: ${prov.tel}` : '',
      (prov.email || '').trim() ? `Email: ${prov.email}` : '',
    ].filter(Boolean);

    let py = boxY + 9;
    provLines.slice(0,5).forEach(line => {
      doc.text(line, margin + 2, py);
      py += 4.0;
    });

    // Cliente (der)
    doc.setFont('helvetica','bold');
    doc.text('CLIENTE', margin + leftW + midW + 2, boxY + 4);

    doc.setFont('helvetica','normal');
    const cli = f.clienteSnapshot || {};
    const cliLines = [
      (cli.nombre || '').trim(),
      (cli.nif || '').trim() ? `NIF/CIF: ${cli.nif}` : '',
      (cli.dir || '').trim(),
      (cli.tel || '').trim() ? `Tel: ${cli.tel}` : '',
      (cli.email || '').trim() ? `Email: ${cli.email}` : '',
    ].filter(Boolean);

    let cy = boxY + 9;
    cliLines.slice(0,5).forEach(line => {
      doc.text(line, margin + leftW + midW + 2, cy);
      cy += 4.0;
    });

    // QR (centro)
    const qrX = margin + leftW + 2;
    const qrY = boxY + 3;
    const qrSize = 24;

    let qrOk = false;
    if (canQR(f)) {
      const txt = buildQRText(f, ajustes);
      const dataUrl = makeQRDataURL(txt);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', qrX + 4, qrY + 1, qrSize, qrSize);
          doc.setFontSize(7);
          doc.setTextColor(0);
          // texto pequeño por si falla escaneo (recomendado)
          const small = txt.length > 60 ? (txt.slice(0,60) + '…') : txt;
          doc.text(small, qrX + 1, qrY + 28);
          qrOk = true;
        } catch {
          // Si falla -> NO QR en PDF
          qrOk = false;
        }
      }
    }
    // si no hay QR, dejamos la caja limpia (sin error)

    // Metadatos (debajo del header en una línea)
    const metaY = headerBottom + 6;
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(`Nº: ${f.numero || ''}`, margin, metaY);
    doc.text(`Fecha: ${dmyFromISO(f.fechaISO)}`, margin + 60, metaY);
    doc.text(`Pago: ${(f.metodoPago || 'efectivo')}`, margin + 120, metaY);

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const tags = (f.tags || '').trim();
    if (tags) doc.text(`Tags: ${tags}`, margin, metaY + 5);

    // Tabla líneas
    const head = [['Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe']];
    const body = buildPdfTableBody(f);

    const startY = metaY + (tags ? 10 : 6);

    autoTable({
      head,
      body,
      startY,
      margin: { left: margin, right: margin, top: margin, bottom: 18 },
      styles: {
        font: 'helvetica',
        fontSize: 8.3,
        textColor: [0,0,0],
        lineColor: [0,0,0],
        lineWidth: 0.1,
        cellPadding: 1.6,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [240,240,240],
        textColor: [0,0,0],
        fontStyle: 'bold',
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [250,250,250]
      },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 12 },
        2: { cellWidth: 14, halign:'right' },
        3: { cellWidth: 14, halign:'right' },
        4: { cellWidth: 14, halign:'right' },
        5: { cellWidth: 14, halign:'right' },
        6: { cellWidth: 16, halign:'right' },
        7: { cellWidth: 32 },
        8: { cellWidth: 18, halign:'right' }
      },
      didDrawPage: (data) => {
        // marco exterior (moderno)
        doc.setDrawColor(0);
        doc.setLineWidth(0.35);
        doc.roundedRect(margin, 8, w - 2*margin, h - 16, 2, 2);
      }
    });

    const last = doc.lastAutoTable;
    let y = (last && last.finalY) ? last.finalY + 6 : startY + 10;

    // Totales + Observaciones: si no hay espacio, nueva página
    const needSpace = 40;
    if (y + needSpace > h - 18) {
      doc.addPage();
      y = 16;
      doc.setDrawColor(0);
      doc.setLineWidth(0.35);
      doc.roundedRect(margin, 8, w - 2*margin, h - 16, 2, 2);
    }

    // Totales block
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text('TOTALES', margin, y);

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);

    const t = f.totals || { subtotal:0, transporte:0, iva:0, total:0, pendiente:0 };

    const linesTot = [];
    linesTot.push(['Subtotal', `${fmt2(t.subtotal)} €`]);
    if (f.transporte) linesTot.push(['Transporte', `${fmt2(t.transporte)} €`]);
    if (f.ivaIncluido) {
      linesTot.push(['IVA', 'IVA incluido']);
    } else {
      linesTot.push(['IVA', `${fmt2(t.iva)} €`]);
    }
    linesTot.push(['TOTAL', `${fmt2(t.total)} €`]);
    linesTot.push(['Pendiente', `${fmt2(t.pendiente)} €`]);

    const boxX = w - margin - 70;
    const boxY2 = y - 2;
    const boxW2 = 70;
    const boxH2 = 6 + linesTot.length * 5;

    doc.setLineWidth(0.2);
    doc.roundedRect(boxX, boxY2, boxW2, boxH2, 2, 2);

    let ty = boxY2 + 6;
    linesTot.forEach((it, idx) => {
      const [k,v] = it;
      if (k === 'TOTAL') doc.setFont('helvetica','bold');
      else doc.setFont('helvetica','normal');

      doc.text(k, boxX + 3, ty);
      doc.text(v, boxX + boxW2 - 3, ty, { align:'right' });
      ty += 5;
    });

    // Observaciones + Notas
    const obs = (f.obs || '').trim();
    const notas = (f.notas || '').trim();

    let ox = margin;
    let oy = y + 8;

    doc.setFont('helvetica','bold');
    doc.text('OBSERVACIONES', ox, oy);
    doc.setFont('helvetica','normal');

    const obsText = obs || '—';
    const splitObs = doc.splitTextToSize(obsText, w - 2*margin);
    oy += 5;
    doc.text(splitObs, ox, oy);
    oy += splitObs.length * 4.0 + 2;

    if (notas) {
      doc.setFont('helvetica','bold');
      doc.text('NOTAS', ox, oy);
      doc.setFont('helvetica','normal');
      const splitNotas = doc.splitTextToSize(notas, w - 2*margin);
      oy += 5;
      doc.text(splitNotas, ox, oy);
    }

    // Footer: Página X/Y + “Suma y sigue” (si no es última)
    const totalPagesExp = '{total_pages_count_string}';
    const pageCount = doc.getNumberOfPages();

    for (let p=1; p<=pageCount; p++) {
      doc.setPage(p);

      doc.setFont('helvetica','normal');
      doc.setFontSize(9);

      // mensaje impuestos / IVA incluido (muy corto)
      const footerLeft = f.ivaIncluido ? 'IVA incluido en los precios.' : 'IVA según normativa vigente.';
      doc.text(footerLeft, margin, h - 8);

      // suma y sigue en páginas intermedias
      if (p < pageCount) {
        doc.setFont('helvetica','bold');
        doc.text('SUMA Y SIGUE', w/2, h - 8, { align:'center' });
      }

      doc.setFont('helvetica','normal');
      doc.text(`Página ${p}/${totalPagesExp}`, w - margin, h - 8, { align:'right' });
    }

    // Completar total de páginas si plugin existe
    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    // Generar blob + visor interno
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    // Guardar “marca” en factura local (sin guardar el blob)
    try {
      // si es la factura actual, guardamos usando tu método
      if (!facturaInput && window.FM.saveFacturaNow) {
        // actualiza totals y guarda (sin bloquear)
        // (ya guardará con localStorage normal)
      } else {
        // si es factura del listado, guardamos mínimo: pdf.lastGeneratedAt
        const all = load(K.facturas, []);
        const i = all.findIndex(x => x.id === f.id || x.numero === f.numero);
        if (i >= 0) {
          all[i].pdf = all[i].pdf || {};
          all[i].pdf.lastGeneratedAt = Date.now();
          all[i].pdf.lastTotal = (f.totals?.total ?? 0);
          save(K.facturas, all);
        }
      }
    } catch {}

    // visor
    revokePdfUrl();
    window.FM._pdfUrl = url;
    if (openViewer) setPdfViewer(url);

    status(qrOk ? 'PDF generado (QR OK)' : 'PDF generado (sin QR)');
    return { doc, blob, url, factura: f };
  };

  /* =========================
     Hook: “Ver PDF” en listado (captura) — reemplaza placeholder
  ========================= */
  const hookPdfButtonsCapture = () => {
    document.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button[data-act="pdf"]');
      if (!btn) return;

      // Capturamos antes que el onclick interno
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const tr = btn.closest('tr');
      if (!tr) return;

      const tds = $$('td', tr);
      const numero = (tds[1]?.textContent || '').trim();
      if (!numero) { status('PDF: no se detecta número'); return; }

      const state = window.FM.getState();
      const f = (state.FACTURAS || []).find(x => (x.numero || '').trim() === numero) || null;
      if (!f) { status('PDF: factura no encontrada'); return; }

      await generatePDF(f, { openViewer:true });
    }, true); // capture
  };

  /* =========================
     CLOUD (Firebase) — opcional, no crashea
  ========================= */
  const cloud = (() => {
    const isConfigured = () => {
      const st = window.FM.getState();
      const fb = st.AJUSTES?.firebase || {};
      return !!(fb.apiKey && fb.authDomain && fb.databaseURL && fb.projectId && fb.appId);
    };

    const getConfig = () => (window.FM.getState().AJUSTES?.firebase || {});

    const ensureFirebaseLoaded = async () => {
      if (window.firebase && window.firebase.apps) return true;

      // Si no está cargado, intentamos cargar compat desde CDN (si hay internet).
      // Si falla -> no crashea, solo avisa.
      const v = '10.12.2'; // si cambias, no rompe nada (solo afecta a carga)
      const urls = [
        `https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`,
        `https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`,
        `https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`,
        `https://www.gstatic.com/firebasejs/${v}/firebase-storage-compat.js`,
      ];

      const loadScript = (src) => new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });

      for (const u of urls) {
        const ok = await loadScript(u);
        if (!ok) {
          status('Cloud: no se pudo cargar Firebase (opcional).');
          return false;
        }
      }
      return !!(window.firebase && window.firebase.apps);
    };

    const init = async () => {
      if (!isConfigured()) { status('Cloud: no configurado (Ajustes)'); return false; }
      const ok = await ensureFirebaseLoaded();
      if (!ok) return false;

      const cfg = getConfig();
      try {
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(cfg);
        }
        return true;
      } catch (e) {
        status('Cloud: error init (opcional)');
        return false;
      }
    };

    const auth = () => window.firebase.auth();
    const db = () => window.firebase.database();
    const st = () => window.firebase.storage();

    const user = () => {
      try { return window.firebase.auth().currentUser; } catch { return null; }
    };

    const requireUser = () => {
      const u = user();
      if (!u) { status('Cloud: inicia sesión'); return null; }
      return u;
    };

    const pathRoot = (uid) => `factu_miral_bwpro/${uid}`;

    const mergeById = (localArr, cloudArr) => {
      const L = Array.isArray(localArr) ? localArr : [];
      const C = Array.isArray(cloudArr) ? cloudArr : [];
      const map = new Map();
      const put = (x) => {
        if (!x || !x.id) return;
        const prev = map.get(x.id);
        const a = prev?.updatedAt || prev?.createdAt || 0;
        const b = x.updatedAt || x.createdAt || 0;
        if (!prev || b >= a) map.set(x.id, x);
      };
      L.forEach(put);
      C.forEach(put);
      return Array.from(map.values());
    };

    const syncUp = async () => {
      const ok = await init();
      if (!ok) return false;
      const u = requireUser();
      if (!u) return false;

      const stt = window.FM.getState();
      const payload = {
        prov: stt.PROV || {},
        clientes: stt.CLIENTES || [],
        productos: stt.PRODUCTOS || [],
        taras: stt.TARAS || [],
        facturas: stt.FACTURAS || [],
        ventas: stt.VENTAS || [],
        pricehist: stt.PRICEHIST || {},
        ajustes: stt.AJUSTES || {},
        ts: Date.now()
      };

      try {
        await db().ref(pathRoot(u.uid)).set(payload);
        status('Cloud: Sync UP OK');
        return true;
      } catch {
        status('Cloud: Sync UP falló (opcional)');
        return false;
      }
    };

    const syncDown = async () => {
      const ok = await init();
      if (!ok) return false;
      const u = requireUser();
      if (!u) return false;

      try {
        const snap = await db().ref(pathRoot(u.uid)).get();
        const data = snap.val();
        if (!data) { status('Cloud: no hay datos'); return false; }

        // merge por updatedAt
        const localClientes = load(K.clientes, []);
        const localProductos = load(K.productos, []);
        const localTaras = load(K.taras, []);
        const localFacturas = load(K.facturas, []);
        const localVentas = load(K.ventas, []);
        const localAjustes = load(K.ajustes, {});

        const clientes = mergeById(localClientes, data.clientes);
        const productos = mergeById(localProductos, data.productos);
        const taras = mergeById(localTaras, data.taras);
        const facturas = mergeById(localFacturas, data.facturas);
        const ventas = mergeById(localVentas, data.ventas);

        // Ajustes: si cloud es más nuevo, pisa
        const aLocalTs = localAjustes?.ts || 0;
        const aCloudTs = data.ajustes?.ts || data.ts || 0;
        const ajustes = (aCloudTs >= aLocalTs) ? data.ajustes : localAjustes;

        save(K.prov, data.prov || {});
        save(K.clientes, clientes);
        save(K.productos, productos);
        save(K.taras, taras);
        save(K.facturas, facturas);
        save(K.ventas, ventas);
        save(K.pricehist, data.pricehist || {});
        save(K.ajustes, ajustes || {});

        status('Cloud: Sync DOWN OK (se recarga la app)');
        setTimeout(() => location.reload(), 450);
        return true;
      } catch {
        status('Cloud: Sync DOWN falló (opcional)');
        return false;
      }
    };

    const login = async () => {
      const ok = await init();
      if (!ok) return false;

      const email = prompt('Cloud login - Email:');
      if (!email) return false;
      const pass = prompt('Cloud login - Password:');
      if (!pass) return false;

      try {
        await auth().signInWithEmailAndPassword(email, pass);
        status('Cloud: login OK');
        return true;
      } catch (e) {
        // si no existe, crear
        try {
          await auth().createUserWithEmailAndPassword(email, pass);
          status('Cloud: cuenta creada y login OK');
          return true;
        } catch {
          status('Cloud: login falló');
          return false;
        }
      }
    };

    const logout = async () => {
      const ok = await init();
      if (!ok) return false;
      try {
        await auth().signOut();
        status('Cloud: logout OK');
        return true;
      } catch {
        status('Cloud: logout falló');
        return false;
      }
    };

    const uploadPDF = async (factura, blob) => {
      const ok = await init();
      if (!ok) return null;

      const u = requireUser();
      if (!u) return null;

      try {
        const numero = (factura.numero || 'FACTURA').replace(/[^\w\-]/g,'_');
        const ref = st().ref().child(`${pathRoot(u.uid)}/pdf/${numero}.pdf`);
        const snap = await ref.put(blob, { contentType:'application/pdf' });
        const url = await snap.ref.getDownloadURL();
        status('Cloud: PDF subido');
        return url;
      } catch {
        status('Cloud: subir PDF falló');
        return null;
      }
    };

    return { isConfigured, init, login, logout, syncUp, syncDown, uploadPDF, user };
  })();

  window.FM.cloud = cloud;

  /* =========================
     PDF + Cloud button (captura) — reemplaza placeholder
  ========================= */
  const hookButtonsCapture = () => {
    const btnPdfCloud = $('#btnPdfCloud');
    if (btnPdfCloud) {
      btnPdfCloud.addEventListener('click', async (e) => {
        // captura antes del handler anterior
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const current = window.FM.getCurrentFactura();
        if (!current) { status('PDF+Cloud: no hay factura'); return; }

        const out = await generatePDF(current, { openViewer:true });
        if (!out) return;

        // subir si cloud disponible
        const url = await cloud.uploadPDF(out.factura, out.blob);
        if (!url) return;

        // guardar URL en factura local (por numero o id)
        try {
          const all = load(K.facturas, []);
          const i = all.findIndex(x => x.id === out.factura.id || x.numero === out.factura.numero);
          if (i >= 0) {
            all[i].pdf = all[i].pdf || {};
            all[i].pdf.cloudUrl = url;
            all[i].updatedAt = Date.now();
            save(K.facturas, all);
          }
        } catch {}

        // también sincroniza metadatos a cloud (recomendado)
        await cloud.syncUp();
        status('PDF+Cloud: listo');
      }, true);
    }

    // Cloud botones
    const bLogin = $('#btnCloudLogin');
    if (bLogin) bLogin.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      await cloud.login();
    }, true);

    const bLogout = $('#btnCloudLogout');
    if (bLogout) bLogout.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      await cloud.logout();
    }, true);

    const bSync = $('#btnCloudSync');
    if (bSync) bSync.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      // Por defecto: UP (y puedes hacer DOWN desde “Test”)
      await cloud.syncUp();
    }, true);

    const bTest = $('#btnCloudTest');
    if (bTest) bTest.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      // Test: DOWN (merge + reload)
      await cloud.syncDown();
    }, true);
  };

  /* =========================
     Exponer PDF en window.FM
  ========================= */
  window.FM.generatePDF = async () => {
    const cur = window.FM.getCurrentFactura();
    if (!cur) { status('PDF: no hay factura'); return; }
    await generatePDF(cur, { openViewer:true });
  };

  // Al abrir modal PDF: aseguramos botones imprimir/abrir funcionan siempre
  const ensurePdfModalButtons = () => {
    const bPrint = $('#btnPdfImprimir');
    if (bPrint) bPrint.onclick = () => {
      const frame = $('#pdfFrame');
      if (!frame?.contentWindow) return;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    const bOpen = $('#btnPdfAbrirPestana');
    if (bOpen) bOpen.onclick = () => {
      const frame = $('#pdfFrame');
      if (frame?.src) window.open(frame.src, '_blank', 'noopener,noreferrer');
    };
  };

  /* =========================
     START
  ========================= */
  hookPdfButtonsCapture();
  hookButtonsCapture();
  ensurePdfModalButtons();

  status('PARTE 4 lista: PDF PRO + Cloud opcional activados');
  /* ===========================
PATCH SEGURO: PROVEEDOR POR DEFECTO (NO SOBREESCRIBE)
Pegar AL FINAL del app.js
=========================== */
(() => {
  'use strict';

  const fillProviderIfEmpty = () => {
    const provNombre = document.querySelector('#provNombre');
    // si aún no existe el DOM del formulario factura, salimos
    if (!provNombre) return;

    // Si existe tu función original, úsala (sin tocar nada)
    if (typeof window.setProviderDefaultsIfEmpty === 'function') {
      try { window.setProviderDefaultsIfEmpty(); } catch {}
    } else {
      // Fallback ultra-seguro: solo rellena si está vacío
      const setIfEmpty = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return;
        if ((el.value || '').trim()) return; // NO sobreescribe
        el.value = val;
        // disparamos input por si tu app guarda en estado al escribir
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
      };

      setIfEmpty('#provNombre', 'Mohammad Arslan Waris');
      setIfEmpty('#provNif',    'X6389988J');
      setIfEmpty('#provDir',    'Calle San Pablo 17, 09003 Burgos');
      setIfEmpty('#provTel',    '631 667 893');
      setIfEmpty('#provEmail',  'shaniwaris80@gmail.com');
    }
  };

  // Ejecuta al cargar (con pequeño delay para no interferir con tu init)
  const boot = () => setTimeout(fillProviderIfEmpty, 80);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Ejecuta cuando vuelves a la pestaña factura (sin depender de tu código interno)
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-tab],button,a') : null;
    if (!t) return;

    // detecta cosas típicas: data-tab="factura" / texto del botón "Factura" etc.
    const dt = (t.getAttribute('data-tab') || '').toLowerCase();
    const tx = (t.textContent || '').toLowerCase();

    if (dt.includes('factura') || tx.includes('factura')) {
      setTimeout(fillProviderIfEmpty, 80);
    }
  }, true);


})();
