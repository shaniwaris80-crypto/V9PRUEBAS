/* =========================================================
PARTE 3A/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3A: base app + storage + helpers + defaults + tabs + modales + PIN + import/export + backup/restore
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
     HELPERS DATA / FORMAT
  ========================= */
  const uid = () => {
    // UID corto pero estable para uso local
    return 'id_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  };

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const toNum = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v).trim().replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const fmtEuro = (n) => {
    const x = round2(toNum(n));
    try {
      return x.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    } catch {
      return `${x.toFixed(2).replace('.', ',')} €`;
    }
  };

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const ddmmyyyy = (iso) => {
    if (!iso) return '';
    const [y,m,d] = String(iso).split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  };
  const dayNameES = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    const names = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    return names[d.getDay()] || '';
  };

  const downloadText = (filename, text, mime = 'application/json') => {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 50);
  };

  /* =========================
     STORAGE KEYS (LOCAL)
  ========================= */
  const K = {
    AJUSTES:   'factu_miral_ajustes_v1',
    CLIENTES:  'factu_miral_clientes_v1',
    PRODUCTOS: 'factu_miral_productos_v1',
    TARAS:     'factu_miral_taras_v1',
    FACTURAS:  'factu_miral_facturas_v1',
    VENTAS:    'factu_miral_ventas_v1',
    LOCK:      'factu_miral_lock_v1',
  };

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return (v ?? fallback);
    } catch {
      return fallback;
    }
  };

  const save = (key, v) => {
    localStorage.setItem(key, JSON.stringify(v));
  };

  /* =========================
     DEFAULTS (PROVEEDOR / CLIENTES / PRODUCTOS)
  ========================= */
  const DEFAULT_PROVIDER = {
    nombre: 'Mohammad Arslan Waris',
    nif: 'X6389988J',
    dir: 'Calle San Pablo 17, 09003 Burgos',
    tel: '631 667 893',
    email: 'shaniwaris80@gmail.com'
  };

  // Clientes precargados (los que pediste)
  const DEFAULT_CLIENTES = [
    {id: uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'efectivo', tel:'', email:'', alias:'', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos', pago:'', tel:'', email:'', alias:'Golden Garden', notas:'IVA incluido en los precios (sin desglose)', tpl:{ivaIncluido:true, transporte:false, tagsAuto:'', notasStd:'IVA incluido en los precios.'}},
    {id: uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', pago:'', tel:'947 20 35 51', email:'', alias:'Con/sentidos', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', pago:'', tel:'947 277 977', email:'bertiz.miranda@gmail.com', alias:'', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos', pago:'', tel:'', email:'', alias:'ALESAL PAN', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos', pago:'', tel:'', email:'', alias:'RIVIERA', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos', pago:'', tel:'', email:'', alias:'CAFE BAR NUOVO', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', pago:'', tel:'', email:'info@restaurantelosbraseros.com', alias:'Los Braseros', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
    {id: uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', pago:'', tel:'', email:'info@hotelcordon.com', alias:'Hotel Cordón', notas:'', tpl:{ivaIncluido:false, transporte:false, tagsAuto:'', notasStd:''}},
  ];

  // Productos que SIEMPRE deben estar cargados (tu lista completa)
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

  const makeDefaultProductos = () => {
    // Producto completo: modos/precios/kgCaja/origen/coste/taraDefault/historial
    // (precios en blanco por defecto)
    const unique = [];
    const seen = new Set();
    for (const name of DEFAULT_PRODUCT_NAMES) {
      const k = String(name || '').trim();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push({
        id: uid(),
        nombre: k,
        modo: 'kg',
        kgCaja: 0,
        precioKg: 0,
        precioCaja: 0,
        precioUd: 0,
        coste: 0,
        origen: '',
        taraDefault: '',
        historial: [] // últimos 5 (solo pantalla)
      });
    }
    return unique;
  };

  /* =========================
     AJUSTES DEFAULT
  ========================= */
  const DEFAULT_AJUSTES = {
    ivaPct: 4,
    transportePct: 10,
    pin: '8410',
    qrPlantilla: 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}',
    proveedor: { ...DEFAULT_PROVIDER },
    firebase: {
      apiKey: '', authDomain: '', databaseURL: '',
      projectId: '', appId: '', storageBucket: ''
    }
  };

  /* =========================
     STATE (APP)
  ========================= */
  const S = {
    ajustes: load(K.AJUSTES, { ...DEFAULT_AJUSTES }),
    clientes: load(K.CLIENTES, []),
    productos: load(K.PRODUCTOS, []),
    taras: load(K.TARAS, []),
    facturas: load(K.FACTURAS, []),
    ventas: load(K.VENTAS, []),

    // Locks
    lock: load(K.LOCK, {
      contabilidadUnlocked: false,
      ventasUnlocked: false,
      lastUnlockAt: 0
    }),

    // UI selections
    activeTab: 'tabFactura',
    selClienteId: '',
    selProductoId: '',
    selTaraId: '',
    selFacturaId: '',

    // PDF runtime (se rellena luego)
    lastPdfBlobUrl: '',

    // Cloud runtime
    cloud: {
      configured: false,
      ready: false,
      user: null,
      status: 'OFF'
    }
  };

  /* =========================
     ENSURE DEFAULTS (SIN BORRAR DATOS)
  ========================= */
  function ensureDefaults(){
    // Ajustes
    if (!S.ajustes || typeof S.ajustes !== 'object') S.ajustes = { ...DEFAULT_AJUSTES };
    if (!S.ajustes.proveedor) S.ajustes.proveedor = { ...DEFAULT_PROVIDER };
    if (!S.ajustes.firebase) S.ajustes.firebase = { ...DEFAULT_AJUSTES.firebase };

    // Clientes
    if (!Array.isArray(S.clientes)) S.clientes = [];
    if (S.clientes.length === 0) {
      S.clientes = JSON.parse(JSON.stringify(DEFAULT_CLIENTES));
    }

    // Productos
    if (!Array.isArray(S.productos)) S.productos = [];
    // SIEMPRE cargar estos productos si faltan
    const must = new Set(DEFAULT_PRODUCT_NAMES.map(x => String(x).trim()).filter(Boolean));
    const have = new Set(S.productos.map(p => String(p?.nombre || '').trim()).filter(Boolean));

    if (S.productos.length === 0) {
      S.productos = makeDefaultProductos();
    } else {
      // añadir los que falten, sin duplicar
      for (const n of must) {
        if (!have.has(n)) {
          S.productos.push({
            id: uid(),
            nombre: n,
            modo: 'kg',
            kgCaja: 0,
            precioKg: 0,
            precioCaja: 0,
            precioUd: 0,
            coste: 0,
            origen: '',
            taraDefault: '',
            historial: []
          });
        }
      }
    }

    // Taras
    if (!Array.isArray(S.taras)) S.taras = [];

    // Facturas
    if (!Array.isArray(S.facturas)) S.facturas = [];

    // Ventas
    if (!Array.isArray(S.ventas)) S.ventas = [];

    // Lock
    if (!S.lock || typeof S.lock !== 'object') {
      S.lock = { contabilidadUnlocked:false, ventasUnlocked:false, lastUnlockAt:0 };
    }
  }

  function persistAll(){
    save(K.AJUSTES, S.ajustes);
    save(K.CLIENTES, S.clientes);
    save(K.PRODUCTOS, S.productos);
    save(K.TARAS, S.taras);
    save(K.FACTURAS, S.facturas);
    save(K.VENTAS, S.ventas);
    save(K.LOCK, S.lock);
  }

  /* =========================
     TOAST
  ========================= */
  let toastTimer = null;
  function toast(msg, ms=1600){
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg ?? '';
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* =========================
     MODALS
  ========================= */
  function openModal(id){
    const m = $('#' + id);
    if (!m) return;
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id){
    const m = $('#' + id);
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function wireModalClosers(){
    $$('[data-close="pin"]').forEach(el => on(el, 'click', () => closeModal('pinModal')));
    $$('[data-close="pdf"]').forEach(el => on(el, 'click', () => closeModal('pdfModal')));

    on($('#btnPinCancel'), 'click', () => closeModal('pinModal'));
  }

  /* =========================
     TABS
  ========================= */
  function setActiveTab(tabId){
    S.activeTab = tabId;
    // tabs buttons
    $$('.tab').forEach(b => {
      const is = b.getAttribute('data-tab') === tabId;
      b.classList.toggle('isActive', is);
      b.setAttribute('aria-selected', is ? 'true' : 'false');
    });
    // pages
    $$('.tabPage').forEach(p => p.classList.toggle('isActive', p.id === tabId));
  }

  function wireTabs(){
    $$('.tab').forEach(btn => {
      on(btn, 'click', () => {
        const id = btn.getAttribute('data-tab');
        if (!id) return;

        // Si es pestaña protegida, pedir PIN si está bloqueada
        if (id === 'tabContabilidad' && !S.lock.contabilidadUnlocked) {
          openPin('contabilidad');
          return;
        }
        if (id === 'tabVentas' && !S.lock.ventasUnlocked) {
          openPin('ventas');
          return;
        }
        setActiveTab(id);
        afterTabChanged();
      });
    });
  }

  function afterTabChanged(){
    // Llamadas a funciones de render específicas (definidas en 3B/3C)
    if (S.activeTab === 'tabFacturas' && typeof window.FACTU_renderFacturas === 'function') {
      window.FACTU_renderFacturas();
    }
    if (S.activeTab === 'tabClientes' && typeof window.FACTU_renderClientes === 'function') {
      window.FACTU_renderClientes();
    }
    if (S.activeTab === 'tabProductos' && typeof window.FACTU_renderProductos === 'function') {
      window.FACTU_renderProductos();
    }
    if (S.activeTab === 'tabTaras' && typeof window.FACTU_renderTaras === 'function') {
      window.FACTU_renderTaras();
    }
    if (S.activeTab === 'tabContabilidad' && typeof window.FACTU_renderContabilidad === 'function') {
      window.FACTU_renderContabilidad();
    }
    if (S.activeTab === 'tabVentas' && typeof window.FACTU_renderVentas === 'function') {
      window.FACTU_renderVentas();
    }
  }

  /* =========================
     PIN / LOCKS
  ========================= */
  let pinTarget = 'contabilidad';

  function openPin(target){
    pinTarget = target || 'contabilidad';
    setText($('#pinMsg'), '');
    const inp = $('#pinInput');
    if (inp) inp.value = '';
    openModal('pinModal');
    setTimeout(() => inp && inp.focus(), 50);
  }

  function wirePin(){
    on($('#btnLockPanel'), 'click', () => {
      openPin('contabilidad');
    });

    on($('#btnPinOk'), 'click', () => {
      const v = String($('#pinInput')?.value ?? '').trim();
      if (!v) {
        setText($('#pinMsg'), 'Introduce el PIN.');
        return;
      }
      if (v !== String(S.ajustes.pin || '8410')) {
        setText($('#pinMsg'), 'PIN incorrecto.');
        return;
      }
      // OK
      S.lock.lastUnlockAt = Date.now();
      if (pinTarget === 'contabilidad') S.lock.contabilidadUnlocked = true;
      if (pinTarget === 'ventas') S.lock.ventasUnlocked = true;

      save(K.LOCK, S.lock);
      closeModal('pinModal');

      // Ir a la pestaña solicitada
      if (pinTarget === 'contabilidad') setActiveTab('tabContabilidad');
      if (pinTarget === 'ventas') setActiveTab('tabVentas');
      toast('Acceso desbloqueado');
      afterTabChanged();
    });

    // Enter en el input
    on($('#pinInput'), 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#btnPinOk')?.click();
      }
    });

    on($('#btnBloquearContabilidad'), 'click', () => {
      S.lock.contabilidadUnlocked = false;
      save(K.LOCK, S.lock);
      toast('Contabilidad bloqueada');
      setActiveTab('tabFactura');
    });

    on($('#btnBloquearVentas'), 'click', () => {
      S.lock.ventasUnlocked = false;
      save(K.LOCK, S.lock);
      toast('Ventas bloqueadas');
      setActiveTab('tabFactura');
    });
  }

  /* =========================
     QUICK SEARCH / SHORTCUTS
  ========================= */
  function wireShortcuts(){
    on(document, 'keydown', (e) => {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+S: guardar factura
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (typeof window.FACTU_guardarFactura === 'function') {
          window.FACTU_guardarFactura();
          toast('Guardado');
        } else {
          toast('Función guardar pendiente (pega 3B/3C)');
        }
      }

      // Ctrl/Cmd+P: PDF
      if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (typeof window.FACTU_generarPDF === 'function') {
          window.FACTU_generarPDF();
        } else {
          toast('PDF pendiente (pega 3B/3C)');
        }
      }

      // Ctrl/Cmd+F: buscar en listados
      if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        focusSearchForActiveTab();
      }
    });

    on($('#btnQuickSearch'), 'click', () => focusSearchForActiveTab());
  }

  function focusSearchForActiveTab(){
    const map = {
      tabFacturas: '#buscarFacturas',
      tabClientes: '#buscarClientes',
      tabProductos: '#buscarProductos',
      tabTaras: '#buscarTaras'
    };
    const sel = map[S.activeTab];
    const el = sel ? $(sel) : null;
    if (el) {
      el.focus();
      el.select?.();
    } else {
      toast('Búsqueda disponible en Facturas/Clientes/Productos/Taras');
    }
  }

  /* =========================
     AJUSTES UI (bind inputs)
  ========================= */
  function bindAjustesUI(){
    // Inputs Ajustes
    const iva = $('#ajIva');
    const tr  = $('#ajTransporte');
    const pin = $('#ajPin');
    const qr  = $('#ajQrPlantilla');

    if (iva) iva.value = String(S.ajustes.ivaPct ?? 4);
    if (tr)  tr.value  = String(S.ajustes.transportePct ?? 10);
    if (pin) pin.value = String(S.ajustes.pin ?? '8410');
    if (qr)  qr.value  = String(S.ajustes.qrPlantilla ?? DEFAULT_AJUSTES.qrPlantilla);

    on(iva, 'input', () => {
      S.ajustes.ivaPct = clamp(toNum(iva.value), 0, 40);
      save(K.AJUSTES, S.ajustes);
    });
    on(tr, 'input', () => {
      S.ajustes.transportePct = clamp(toNum(tr.value), 0, 40);
      save(K.AJUSTES, S.ajustes);
    });
    on(pin, 'input', () => {
      S.ajustes.pin = String(pin.value || '').trim() || '8410';
      save(K.AJUSTES, S.ajustes);
    });
    on(qr, 'input', () => {
      S.ajustes.qrPlantilla = String(qr.value || '').trim() || DEFAULT_AJUSTES.qrPlantilla;
      save(K.AJUSTES, S.ajustes);
    });

    // Firebase fields
    const f = S.ajustes.firebase || (S.ajustes.firebase = { ...DEFAULT_AJUSTES.firebase });
    const fbApiKey = $('#fbApiKey');
    const fbAuthDomain = $('#fbAuthDomain');
    const fbDatabaseURL = $('#fbDatabaseURL');
    const fbProjectId = $('#fbProjectId');
    const fbAppId = $('#fbAppId');
    const fbStorageBucket = $('#fbStorageBucket');

    if (fbApiKey) fbApiKey.value = f.apiKey || '';
    if (fbAuthDomain) fbAuthDomain.value = f.authDomain || '';
    if (fbDatabaseURL) fbDatabaseURL.value = f.databaseURL || '';
    if (fbProjectId) fbProjectId.value = f.projectId || '';
    if (fbAppId) fbAppId.value = f.appId || '';
    if (fbStorageBucket) fbStorageBucket.value = f.storageBucket || '';

    const bindFb = (el, k) => on(el, 'input', () => {
      S.ajustes.firebase[k] = String(el.value || '').trim();
      save(K.AJUSTES, S.ajustes);
      updateCloudStatus();
    });

    bindFb(fbApiKey, 'apiKey');
    bindFb(fbAuthDomain, 'authDomain');
    bindFb(fbDatabaseURL, 'databaseURL');
    bindFb(fbProjectId, 'projectId');
    bindFb(fbAppId, 'appId');
    bindFb(fbStorageBucket, 'storageBucket');

    // Botón Probar Cloud (la implementación real en 3C, aquí no rompe)
    on($('#btnProbarCloud'), 'click', () => {
      if (typeof window.FACTU_cloudTest === 'function') {
        window.FACTU_cloudTest();
      } else {
        toast('Cloud se activa en 3C (Firebase opcional)');
      }
    });
    on($('#btnLoginCloud'), 'click', () => {
      if (typeof window.FACTU_cloudLogin === 'function') {
        window.FACTU_cloudLogin();
      } else {
        toast('Login Cloud en 3C');
      }
    });
    on($('#btnLogoutCloud'), 'click', () => {
      if (typeof window.FACTU_cloudLogout === 'function') {
        window.FACTU_cloudLogout();
      } else {
        toast('Logout Cloud en 3C');
      }
    });

    // Backups
    on($('#btnBackupAll'), 'click', () => backupAll());
    on($('#btnRestoreAll'), 'click', () => $('#fileRestoreAll')?.click());
    on($('#fileRestoreAll'), 'change', (e) => restoreAllFromFile(e));

    // Reset demo defaults / Hard reset
    on($('#btnResetDemo'), 'click', () => {
      // Recargar defaults SIN tocar facturas/ventas (solo repone faltantes)
      ensureDefaults();
      persistAll();
      toast('Defaults recargados');
      refreshAllUI();
    });

    on($('#btnHardReset'), 'click', () => {
      if (!confirm('Reset TOTAL: borra clientes/productos/taras/facturas/ventas/ajustes. ¿Seguro?')) return;
      localStorage.removeItem(K.AJUSTES);
      localStorage.removeItem(K.CLIENTES);
      localStorage.removeItem(K.PRODUCTOS);
      localStorage.removeItem(K.TARAS);
      localStorage.removeItem(K.FACTURAS);
      localStorage.removeItem(K.VENTAS);
      localStorage.removeItem(K.LOCK);

      S.ajustes = { ...DEFAULT_AJUSTES, proveedor: { ...DEFAULT_PROVIDER }, firebase: { ...DEFAULT_AJUSTES.firebase } };
      S.clientes = JSON.parse(JSON.stringify(DEFAULT_CLIENTES));
      S.productos = makeDefaultProductos();
      S.taras = [];
      S.facturas = [];
      S.ventas = [];
      S.lock = { contabilidadUnlocked:false, ventasUnlocked:false, lastUnlockAt:0 };
      persistAll();
      toast('Reset total realizado');
      refreshAllUI();
      setActiveTab('tabFactura');
    });
  }

  function backupAll(){
    const pack = {
      meta: { app:'FACTU MIRAL', ver:'1.0', ts: new Date().toISOString() },
      ajustes: S.ajustes,
      clientes: S.clientes,
      productos: S.productos,
      taras: S.taras,
      facturas: S.facturas,
      ventas: S.ventas
    };
    downloadText(`factu_miral_backup_${Date.now()}.json`, JSON.stringify(pack, null, 2));
    toast('Backup descargado');
  }

  async function restoreAllFromFile(e){
    const f = e?.target?.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const pack = JSON.parse(txt);
      if (!pack || typeof pack !== 'object') throw new Error('Formato inválido');

      // Restaurar con validaciones mínimas
      if (pack.ajustes) S.ajustes = pack.ajustes;
      if (Array.isArray(pack.clientes)) S.clientes = pack.clientes;
      if (Array.isArray(pack.productos)) S.productos = pack.productos;
      if (Array.isArray(pack.taras)) S.taras = pack.taras;
      if (Array.isArray(pack.facturas)) S.facturas = pack.facturas;
      if (Array.isArray(pack.ventas)) S.ventas = pack.ventas;

      ensureDefaults(); // asegura que SIEMPRE estén los productos/cliente mínimos
      persistAll();
      toast('Restore OK');
      refreshAllUI();
    } catch (err) {
      console.error(err);
      toast('Error restaurando backup');
    } finally {
      e.target.value = '';
    }
  }

  /* =========================
     EXPORT / IMPORT (CLIENTES / PRODUCTOS / TARAS)
  ========================= */
  function wireImportExport(){
    // CLIENTES
    on($('#btnExportClientes'), 'click', () => {
      downloadText(`factu_miral_clientes_${Date.now()}.json`, JSON.stringify(S.clientes, null, 2));
      toast('Clientes exportados');
    });
    on($('#btnImportClientes'), 'click', () => $('#fileImportClientes')?.click());
    on($('#fileImportClientes'), 'change', async (e) => {
      const f = e?.target?.files?.[0]; if (!f) return;
      try{
        const txt = await f.text();
        const arr = JSON.parse(txt);
        if (!Array.isArray(arr)) throw new Error('No es array');
        // merge por NIF+nombre si existe; si no, agrega
        const key = (c) => `${String(c?.nif||'').trim()}|${String(c?.nombre||'').trim()}`.toLowerCase();
        const map = new Map(S.clientes.map(c => [key(c), c]));
        for (const c of arr){
          const k = key(c);
          if (!k || k === '|') continue;
          if (!map.has(k)){
            map.set(k, { id: uid(), ...c });
          } else {
            // si existe, actualiza (sin perder id)
            const old = map.get(k);
            map.set(k, { ...old, ...c, id: old.id });
          }
        }
        S.clientes = Array.from(map.values());
        save(K.CLIENTES, S.clientes);
        toast('Clientes importados');
        if (typeof window.FACTU_renderClientes === 'function') window.FACTU_renderClientes();
        fillClienteSelector();
      } catch(err){
        console.error(err);
        toast('Error importando clientes');
      } finally {
        e.target.value = '';
      }
    });

    // PRODUCTOS
    on($('#btnExportProductos'), 'click', () => {
      downloadText(`factu_miral_productos_${Date.now()}.json`, JSON.stringify(S.productos, null, 2));
      toast('Productos exportados');
    });
    on($('#btnImportProductos'), 'click', () => $('#fileImportProductos')?.click());
    on($('#fileImportProductos'), 'change', async (e) => {
      const f = e?.target?.files?.[0]; if (!f) return;
      try{
        const txt = await f.text();
        const arr = JSON.parse(txt);
        if (!Array.isArray(arr)) throw new Error('No es array');
        const key = (p) => String(p?.nombre||'').trim().toLowerCase();
        const map = new Map(S.productos.map(p => [key(p), p]));
        for (const p of arr){
          const k = key(p);
          if (!k) continue;
          if (!map.has(k)){
            map.set(k, {
              id: uid(),
              nombre: String(p.nombre||'').trim(),
              modo: p.modo || 'kg',
              kgCaja: toNum(p.kgCaja),
              precioKg: toNum(p.precioKg),
              precioCaja: toNum(p.precioCaja),
              precioUd: toNum(p.precioUd),
              coste: toNum(p.coste),
              origen: p.origen || '',
              taraDefault: p.taraDefault || '',
              historial: Array.isArray(p.historial) ? p.historial.slice(0,5) : []
            });
          } else {
            const old = map.get(k);
            map.set(k, {
              ...old,
              ...p,
              id: old.id,
              nombre: old.nombre,
              kgCaja: toNum(p.kgCaja ?? old.kgCaja),
              precioKg: toNum(p.precioKg ?? old.precioKg),
              precioCaja: toNum(p.precioCaja ?? old.precioCaja),
              precioUd: toNum(p.precioUd ?? old.precioUd),
              coste: toNum(p.coste ?? old.coste),
              historial: Array.isArray(p.historial) ? p.historial.slice(0,5) : (old.historial || [])
            });
          }
        }
        S.productos = Array.from(map.values());
        ensureDefaults(); // vuelve a asegurar los obligatorios
        save(K.PRODUCTOS, S.productos);
        toast('Productos importados');
        if (typeof window.FACTU_renderProductos === 'function') window.FACTU_renderProductos();
        fillProductoDatalistCache();
        fillTaraDefaultSelect();
      } catch(err){
        console.error(err);
        toast('Error importando productos');
      } finally {
        e.target.value = '';
      }
    });

    // TARAS
    on($('#btnExportTaras'), 'click', () => {
      downloadText(`factu_miral_taras_${Date.now()}.json`, JSON.stringify(S.taras, null, 2));
      toast('Taras exportadas');
    });
    on($('#btnImportTaras'), 'click', () => $('#fileImportTaras')?.click());
    on($('#fileImportTaras'), 'change', async (e) => {
      const f = e?.target?.files?.[0]; if (!f) return;
      try{
        const txt = await f.text();
        const arr = JSON.parse(txt);
        if (!Array.isArray(arr)) throw new Error('No es array');
        const key = (t) => String(t?.nombre||'').trim().toLowerCase();
        const map = new Map(S.taras.map(t => [key(t), t]));
        for (const t of arr){
          const k = key(t);
          if (!k) continue;
          if (!map.has(k)){
            map.set(k, { id: uid(), nombre:String(t.nombre||'').trim(), peso: toNum(t.peso), notas: t.notas || '' });
          } else {
            const old = map.get(k);
            map.set(k, { ...old, ...t, id: old.id, nombre: old.nombre, peso: toNum(t.peso ?? old.peso) });
          }
        }
        S.taras = Array.from(map.values());
        save(K.TARAS, S.taras);
        toast('Taras importadas');
        if (typeof window.FACTU_renderTaras === 'function') window.FACTU_renderTaras();
        fillTaraDefaultSelect();
      } catch(err){
        console.error(err);
        toast('Error importando taras');
      } finally {
        e.target.value = '';
      }
    });
  }

  /* =========================
     SELECTORES (cliente / tara default)
  ========================= */
  function fillClienteSelector(){
    const sel = $('#selCliente');
    if (!sel) return;
    const old = sel.value;
    sel.innerHTML = `<option value="">— Selecciona —</option>` + S.clientes
      .slice()
      .sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es'))
      .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)} — ${escapeHtml(c.nif||'')}</option>`)
      .join('');
    if (old) sel.value = old;
  }

  function fillTaraDefaultSelect(){
    const sel = $('#pTaraDefault');
    if (!sel) return;
    const old = sel.value;
    sel.innerHTML = `<option value="">— Sin envase —</option>` + S.taras
      .slice()
      .sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es'))
      .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${toNum(t.peso).toFixed(2).replace('.',',')} kg)</option>`)
      .join('');
    if (old) sel.value = old;
  }

  // cache simple para autocomplete (lo usa 3B)
  const CACHE = {
    productNames: [],
    productById: new Map(),
    taraById: new Map(),
    clienteById: new Map()
  };

  function fillProductoDatalistCache(){
    CACHE.productNames = S.productos.map(p => String(p?.nombre||'').trim()).filter(Boolean);
    CACHE.productById = new Map(S.productos.map(p => [p.id, p]));
    CACHE.taraById = new Map(S.taras.map(t => [t.id, t]));
    CACHE.clienteById = new Map(S.clientes.map(c => [c.id, c]));
  }

  /* =========================
     PROVIDER DEFAULTS (inputs factura)
  ========================= */
  function setProviderDefaultsIfEmpty(){
    if(!$('#provNombre')?.value) $('#provNombre').value = DEFAULT_PROVIDER.nombre;
    if(!$('#provNif')?.value)    $('#provNif').value    = DEFAULT_PROVIDER.nif;
    if(!$('#provDir')?.value)    $('#provDir').value    = DEFAULT_PROVIDER.dir;
    if(!$('#provTel')?.value)    $('#provTel').value    = DEFAULT_PROVIDER.tel;
    if(!$('#provEmail')?.value)  $('#provEmail').value  = DEFAULT_PROVIDER.email;
  }

  function loadProviderToUI(){
    const p = S.ajustes.proveedor || DEFAULT_PROVIDER;
    if ($('#provNombre')) $('#provNombre').value = p.nombre || '';
    if ($('#provNif')) $('#provNif').value = p.nif || '';
    if ($('#provDir')) $('#provDir').value = p.dir || '';
    if ($('#provTel')) $('#provTel').value = p.tel || '';
    if ($('#provEmail')) $('#provEmail').value = p.email || '';
    setProviderDefaultsIfEmpty();
  }

  function wireProviderSave(){
    on($('#btnGuardarProveedor'), 'click', () => {
      S.ajustes.proveedor = {
        nombre: String($('#provNombre')?.value || '').trim(),
        nif: String($('#provNif')?.value || '').trim(),
        dir: String($('#provDir')?.value || '').trim(),
        tel: String($('#provTel')?.value || '').trim(),
        email: String($('#provEmail')?.value || '').trim()
      };
      save(K.AJUSTES, S.ajustes);
      toast('Proveedor guardado');
      updateDiag();
    });
  }

  /* =========================
     CLOUD STATUS PILL (solo UI en 3A)
  ========================= */
  function updateCloudStatus(){
    const f = S.ajustes.firebase || {};
    const configured = !!(f.apiKey && f.authDomain && f.projectId && f.appId);
    S.cloud.configured = configured;

    const dot = $('#dotCloud');
    const txt = $('#cloudText');
    if (configured) {
      if (dot) dot.className = 'dot warn';
      if (txt) txt.textContent = 'Cloud CONFIG';
    } else {
      if (dot) dot.className = 'dot off';
      if (txt) txt.textContent = 'Cloud OFF';
    }
  }

  /* =========================
     DIAGNOSTIC BOX
  ========================= */
  function updateDiag(){
    const el = $('#diagBox');
    if (!el) return;
    const f = S.ajustes.firebase || {};
    const configured = !!(f.apiKey && f.authDomain && f.projectId && f.appId);
    const lines = [
      `FACTU MIRAL · v1.0`,
      `Fecha: ${new Date().toLocaleString('es-ES')}`,
      `LocalStorage: OK`,
      `Clientes: ${S.clientes.length}`,
      `Productos: ${S.productos.length}`,
      `Taras: ${S.taras.length}`,
      `Facturas: ${S.facturas.length}`,
      `Ventas: ${S.ventas.length}`,
      `PIN: ${String(S.ajustes.pin || '8410') ? 'configurado' : '—'}`,
      `IVA: ${toNum(S.ajustes.ivaPct)}%`,
      `Transporte: ${toNum(S.ajustes.transportePct)}%`,
      `Cloud: ${configured ? 'CONFIGURADA (opcional)' : 'OFF (modo local)'}`,
    ];
    el.textContent = lines.join('\n');
  }

  /* =========================
     REFRESH UI BASICO
  ========================= */
  function refreshAllUI(){
    fillClienteSelector();
    fillProductoDatalistCache();
    fillTaraDefaultSelect();
    bindAjustesUI();
    loadProviderToUI();
    updateCloudStatus();
    updateDiag();

    // Fechas base
    if ($('#inpFechaFactura') && !$('#inpFechaFactura').value) $('#inpFechaFactura').value = isoToday();
    if ($('#pagoFecha') && !$('#pagoFecha').value) $('#pagoFecha').value = isoToday();
    if ($('#vFecha') && !$('#vFecha').value) $('#vFecha').value = isoToday();
    if ($('#vRepDesde') && !$('#vRepDesde').value) $('#vRepDesde').value = isoToday();
    if ($('#vRepHasta') && !$('#vRepHasta').value) $('#vRepHasta').value = isoToday();
    if ($('#contDesde') && !$('#contDesde').value) $('#contDesde').value = isoToday();
    if ($('#contHasta') && !$('#contHasta').value) $('#contHasta').value = isoToday();
    if ($('#factDesde') && !$('#factDesde').value) $('#factDesde').value = '';
    if ($('#factHasta') && !$('#factHasta').value) $('#factHasta').value = '';

    // Ventas: día semana
    updateVentaDiaSemana();
  }

  function updateVentaDiaSemana(){
    const iso = $('#vFecha')?.value;
    if ($('#vDiaSemana')) $('#vDiaSemana').value = iso ? dayNameES(iso) : '';
  }

  /* =========================
     WIRES VARIOS (botones principales)
  ========================= */
  function wireMainButtons(){
    // Factura acciones (implementación en 3B)
    on($('#btnNuevaFactura'), 'click', () => {
      if (typeof window.FACTU_nuevaFactura === 'function') window.FACTU_nuevaFactura();
      else toast('Nueva factura en 3B');
    });
    on($('#btnDuplicarFactura'), 'click', () => {
      if (typeof window.FACTU_duplicarFactura === 'function') window.FACTU_duplicarFactura();
      else toast('Duplicar factura en 3B');
    });
    on($('#btnEliminarFactura'), 'click', () => {
      if (typeof window.FACTU_eliminarFactura === 'function') window.FACTU_eliminarFactura();
      else toast('Eliminar factura en 3B');
    });
    on($('#btnGuardarFactura'), 'click', () => {
      if (typeof window.FACTU_guardarFactura === 'function') window.FACTU_guardarFactura();
      else toast('Guardar factura en 3B');
    });
    on($('#btnGenerarPDF'), 'click', () => {
      if (typeof window.FACTU_generarPDF === 'function') window.FACTU_generarPDF();
      else toast('PDF en 3C');
    });
    on($('#btnVerPDF'), 'click', () => {
      if (typeof window.FACTU_verPDF === 'function') window.FACTU_verPDF();
      else toast('Visor PDF en 3C');
    });
    on($('#btnPdfNube'), 'click', () => {
      if (typeof window.FACTU_pdfNube === 'function') window.FACTU_pdfNube();
      else toast('PDF + nube en 3C');
    });
    on($('#btnWhatsapp'), 'click', () => {
      if (typeof window.FACTU_whatsapp === 'function') window.FACTU_whatsapp();
      else toast('WhatsApp en 3B');
    });

    // Ventas (implementación en 3C)
    on($('#btnGuardarVenta'), 'click', () => {
      if (typeof window.FACTU_guardarVenta === 'function') window.FACTU_guardarVenta();
      else toast('Ventas en 3C');
    });
    on($('#btnBorrarVenta'), 'click', () => {
      if (typeof window.FACTU_borrarVenta === 'function') window.FACTU_borrarVenta();
      else toast('Ventas en 3C');
    });
    on($('#btnGenerarReporteVentas'), 'click', () => {
      if (typeof window.FACTU_reporteVentas === 'function') window.FACTU_reporteVentas();
      else toast('Reporte en 3C');
    });
    on($('#btnReporteSemanal'), 'click', () => {
      if (typeof window.FACTU_reporteVentasSemanal === 'function') window.FACTU_reporteVentasSemanal();
      else toast('Semanal en 3C');
    });
    on($('#btnReporteMensual'), 'click', () => {
      if (typeof window.FACTU_reporteVentasMensual === 'function') window.FACTU_reporteVentasMensual();
      else toast('Mensual en 3C');
    });
    on($('#btnExportVentasCsv'), 'click', () => {
      if (typeof window.FACTU_exportVentasCsv === 'function') window.FACTU_exportVentasCsv();
      else toast('Export en 3C');
    });

    // Cuando cambia fecha ventas -> día semana
    on($('#vFecha'), 'change', () => updateVentaDiaSemana());

    // PDF modal buttons (implementación en 3C)
    on($('#btnPdfImprimir'), 'click', () => {
      if (typeof window.FACTU_pdfImprimir === 'function') window.FACTU_pdfImprimir();
      else toast('Imprimir en 3C');
    });
    on($('#btnPdfPestana'), 'click', () => {
      if (typeof window.FACTU_pdfPestana === 'function') window.FACTU_pdfPestana();
      else toast('Abrir pestaña en 3C');
    });
    on($('#btnPdfCompartir'), 'click', () => {
      if (typeof window.FACTU_pdfCompartir === 'function') window.FACTU_pdfCompartir();
      else toast('Compartir en 3C');
    });

    // QR copy (texto)
    on($('#btnCopiarTextoQR'), 'click', async () => {
      const t = $('#qrText')?.value || '';
      try{
        await navigator.clipboard.writeText(t);
        toast('Texto QR copiado');
      } catch {
        toast('No se pudo copiar');
      }
    });
  }

  /* =========================
     LOCAL PILL
  ========================= */
  function updateLocalPill(){
    const dot = $('#dotLocal');
    if (dot) dot.className = 'dot ok';
  }

  /* =========================
     BOOTSTRAP
  ========================= */
  function init(){
    ensureDefaults();
    persistAll(); // asegura que los defaults se guarden una vez

    wireModalClosers();
    wireTabs();
    wirePin();
    wireShortcuts();
    wireProviderSave();
    wireImportExport();
    wireMainButtons();

    refreshAllUI();
    updateLocalPill();

    // Tab inicial
    setActiveTab('tabFactura');

    // Exponer estado y helpers para 3B/3C (sin contaminar global)
    window.FACTU_STATE = S;
    window.FACTU_UTILS = {
      $, $$, on,
      uid,
      toNum, round2, fmtEuro,
      isoToday, ddmmyyyy, dayNameES,
      save, load,
      persistAll,
      toast,
      openModal, closeModal,
      setActiveTab,
      fillClienteSelector,
      fillProductoDatalistCache,
      fillTaraDefaultSelect
    };

    // Aviso si faltan libs PDF
    setTimeout(() => {
      const okJsPDF = !!(window.jspdf && window.jspdf.jsPDF);
      if (!okJsPDF) {
        // no rompe: solo avisamos
        toast('Nota: jsPDF no cargó (PDF se activará si hay internet)');
      }
      updateDiag();
    }, 300);

    // Render inicial de listados si ya existen funciones (cuando pegues 3B/3C)
    setTimeout(() => afterTabChanged(), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(); // end IIFE
/* =========================================================
PARTE 3B/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3B: FACTURA (grid pro + cálculos correctos + taras) + clientes + productos + taras + listado facturas + WhatsApp + QR pantalla
========================================================= */

(() => {
  'use strict';

  const S = window.FACTU_STATE;
  const U = window.FACTU_UTILS;
  if (!S || !U) return;

  const { $, $$, on, uid, toNum, round2, fmtEuro, isoToday, ddmmyyyy, dayNameES, save, toast, openModal, closeModal, setActiveTab } = U;

  /* =========================
     SAFE GETTERS
  ========================= */
  const val = (id) => String($(id)?.value ?? '');
  const setVal = (id, v) => { const el = $(id); if (el) el.value = (v ?? ''); };
  const setHtml = (id, html) => { const el = $(id); if (el) el.innerHTML = html ?? ''; };

  /* =========================
     MODEL: FACTURA
  ========================= */
  function makeFacturaEmpty(){
    const now = new Date();
    const num = `FA-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    return {
      id: uid(),
      num,
      fecha: isoToday(),            // ISO
      tags: '',
      notasInt: '',
      obs: '',
      clienteId: '',
      clienteSnap: { nombre:'', nif:'', dir:'', tel:'', email:'', pago:'' },
      proveedorSnap: { ...(S.ajustes?.proveedor || {}) },

      ivaPct: toNum(S.ajustes?.ivaPct ?? 4),
      transportePct: toNum(S.ajustes?.transportePct ?? 10),
      transporteOn: false,
      ivaIncluido: false,

      lineas: makeDefaultLineas(5),
      pagos: [],
      metodoPago: 'efectivo',       // efectivo/transferencia/tarjeta
      estado: 'impagada',           // impagada/parcial/pagada

      totals: { subtotal:0, transporte:0, iva:0, total:0, pagado:0, pendiente:0 }
    };
  }

  function makeDefaultLineas(n=5){
    const arr = [];
    for (let i=0;i<n;i++){
      arr.push(makeLineaEmpty());
    }
    return arr;
  }

  function makeLineaEmpty(){
    return {
      id: uid(),
      producto: '',
      productoId: '',
      modo: 'kg',         // kg/caja/ud
      cantidad: 0,        // nº envases/uds/cajas (según modo)
      bruto: 0,           // kg (solo si modo kg)
      taraId: '',
      envases: 0,         // nº envases para tara (por defecto = cantidad)
      taraKg: 0,          // tara total (kg)
      neto: 0,            // kg neto
      netoManual: false,  // si el usuario edita neto se respeta
      precio: 0,          // según modo
      origen: '',
      kgCaja: 0,          // solo informativo (productos)
      importe: 0,         // calculado
      warn: ''            // avisos (tara>bruto etc)
    };
  }

  /* =========================
     ACTIVE INVOICE STATE
  ========================= */
  if (!S._activeFactura) {
    S._activeFactura = makeFacturaEmpty();
  }
  let F = S._activeFactura;

  /* =========================
     INDEX DOM IDS (FACTURA)
  ========================= */
  const IDS = {
    // header invoice
    numFactura: '#numFactura',
    inpFecha: '#inpFechaFactura',
    inpTags: '#inpTags',
    inpNotasInt: '#inpNotasInt',
    inpObs: '#inpObs',
    chkTransporte: '#chkTransporte',
    chkIvaIncluido: '#chkIvaIncluido',
    btnAddIva4: '#btnAddIva4',

    // cliente
    selCliente: '#selCliente',
    cliNombre: '#cliNombre',
    cliNif: '#cliNif',
    cliDir: '#cliDir',
    cliTel: '#cliTel',
    cliEmail: '#cliEmail',
    cliPago: '#cliPago',
    btnNuevoClienteFactura: '#btnNuevoClienteFactura',
    btnGuardarClienteFactura: '#btnGuardarClienteFactura',

    // grid
    gridBody: '#gridBody',
    btnAddLinea: '#btnAddLinea',
    btnVaciarLineas: '#btnVaciarLineas',

    // totals
    outSubtotal: '#outSubtotal',
    outTransporte: '#outTransporte',
    outIva: '#outIva',
    outTotal: '#outTotal',
    outPendiente: '#outPendiente',

    // payments
    pagoImporte: '#pagoImporte',
    pagoFecha: '#pagoFecha',
    pagoMetodo: '#pagoMetodo',
    btnAddPago: '#btnAddPago',
    pagosList: '#pagosList',

    // qr
    qrText: '#qrText',
    qrSmall: '#qrSmall',
    qrCanvas: '#qrCanvas',
    qrFallback: '#qrFallback',

    // whatsapp
    btnWhatsappCopy: '#btnWhatsappCopy', // opcional
    waOut: '#waOut', // opcional textarea
  };

  /* =========================
     AUTOCOMPLETE POPUP (manual, NO sustituye)
  ========================= */
  const AC = {
    el: $('#acPopup'),
    open: false,
    items: [],
    idx: -1,
    anchor: null,
    type: 'producto'
  };

  function acClose(){
    if (!AC.el) return;
    AC.open = false;
    AC.items = [];
    AC.idx = -1;
    AC.anchor = null;
    AC.el.setAttribute('aria-hidden','true');
    AC.el.style.display = 'none';
    AC.el.innerHTML = '';
  }

  function acOpen(anchorEl, items, type='producto'){
    if (!AC.el || !anchorEl) return;
    AC.open = true;
    AC.items = items || [];
    AC.idx = 0;
    AC.anchor = anchorEl;
    AC.type = type;

    const r = anchorEl.getBoundingClientRect();
    const top = Math.round(r.bottom + 6);
    const left = Math.round(r.left);
    AC.el.style.top = `${top}px`;
    AC.el.style.left = `${left}px`;
    AC.el.style.display = 'block';
    AC.el.setAttribute('aria-hidden','false');

    renderAC();
  }

  function renderAC(){
    if (!AC.el) return;
    const items = AC.items.slice(0, 30);
    if (!items.length){
      acClose();
      return;
    }
    AC.idx = Math.max(0, Math.min(AC.idx, items.length-1));

    AC.el.innerHTML = items.map((it, i) => {
      const active = i === AC.idx ? 'acItem isActive' : 'acItem';
      const right = it.right ? `<div class="acRight">${it.right}</div>` : `<div class="acRight"></div>`;
      return `<div class="${active}" data-i="${i}">
        <div class="acLeft">${escapeHtml(it.left)}</div>${right}
      </div>`;
    }).join('');

    // click
    $$('.acItem', AC.el).forEach(row => {
      on(row, 'mousedown', (e) => e.preventDefault()); // no blur
      on(row, 'click', () => {
        const i = parseInt(row.getAttribute('data-i') || '0', 10);
        AC.idx = i;
        acPick();
      });
    });
  }

  function escapeHtml(s){
    return (s ?? '').toString()
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'","&#039;");
  }

  function acPick(){
    if (!AC.open || !AC.anchor) return;
    const item = AC.items[AC.idx];
    if (!item) return;

    // Guardamos el texto tal cual el usuario lo ve
    if (AC.type === 'producto'){
      // En producto input de línea: NO sustituye el texto automáticamente salvo al elegir
      AC.anchor.value = item.left;
      AC.anchor.dispatchEvent(new Event('input', { bubbles:true }));
      AC.anchor.dispatchEvent(new Event('change', { bubbles:true }));
      acClose();
      // mover a siguiente campo (modo)
      const next = AC.anchor.closest('.gridRow')?.querySelector('[data-col="modo"]');
      next?.focus();
    } else {
      acClose();
    }
  }

  function acHandleKey(e){
    if (!AC.open) return false;
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      AC.idx = Math.min(AC.idx + 1, Math.min(AC.items.length-1, 29));
      renderAC();
      return true;
    }
    if (e.key === 'ArrowUp'){
      e.preventDefault();
      AC.idx = Math.max(AC.idx - 1, 0);
      renderAC();
      return true;
    }
    if (e.key === 'Enter'){
      e.preventDefault();
      acPick();
      return true;
    }
    if (e.key === 'Escape'){
      e.preventDefault();
      acClose();
      return true;
    }
    return false;
  }

  on(document, 'keydown', (e) => {
    if (AC.open) acHandleKey(e);
  });
  on(document, 'click', (e) => {
    if (!AC.open) return;
    if (AC.el && (e.target === AC.el || AC.el.contains(e.target))) return;
    if (AC.anchor && (e.target === AC.anchor)) return;
    acClose();
  });

  /* =========================
     PRODUCTS HELPERS
  ========================= */
  function findProductoByName(name){
    const n = String(name||'').trim().toLowerCase();
    if (!n) return null;
    const exact = S.productos.find(p => String(p.nombre||'').trim().toLowerCase() === n);
    if (exact) return exact;
    // fallback contains
    const cand = S.productos.find(p => String(p.nombre||'').trim().toLowerCase().includes(n));
    return cand || null;
  }
  function findProductoById(id){
    return S.productos.find(p => p.id === id) || null;
  }
  function findTaraById(id){
    return S.taras.find(t => t.id === id) || null;
  }
  function findClienteById(id){
    return S.clientes.find(c => c.id === id) || null;
  }

  function productPriceForMode(p, modo){
    if (!p) return 0;
    if (modo === 'kg') return toNum(p.precioKg);
    if (modo === 'caja') return toNum(p.precioCaja);
    return toNum(p.precioUd);
  }

  function updateProductoHistorial(p, modo, precio, fechaIso){
    if (!p) return;
    const entry = {
      ts: Date.now(),
      fecha: fechaIso || isoToday(),
      modo: modo || 'kg',
      precio: round2(toNum(precio))
    };
    const hist = Array.isArray(p.historial) ? p.historial.slice() : [];
    hist.unshift(entry);
    // dedupe simple por modo+precio+fecha (primeras 5)
    const out = [];
    const seen = new Set();
    for (const h of hist){
      const k = `${h.modo}|${h.precio}|${h.fecha}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(h);
      if (out.length >= 5) break;
    }
    p.historial = out;
  }

  function getHistorialTextByProductoId(prodId){
    const p = findProductoById(prodId);
    if (!p || !Array.isArray(p.historial) || !p.historial.length) return '';
    const lines = p.historial.slice(0,5).map(h => {
      const f = ddmmyyyy(h.fecha);
      const modo = (h.modo || '').toUpperCase();
      return `${f} · ${modo} · ${fmtEuro(h.precio)}`;
    });
    return lines.join('\n');
  }

  /* =========================
     TARAS LOGIC (correcto)
  ========================= */
  function computeTaraKg(line){
    const tara = line.taraId ? findTaraById(line.taraId) : null;
    const peso = tara ? toNum(tara.peso) : 0;
    const env = toNum(line.envases);

    // Si el usuario eligió envase y no puso envases, usar por defecto = cantidad
    let envases = env;
    if (tara && (!envases || envases <= 0)) {
      const c = toNum(line.cantidad);
      if (c > 0) envases = c;
    }

    // Guardar envases auto (solo si estaba vacío)
    if (tara && (!toNum(line.envases) || toNum(line.envases) <= 0) && envases > 0) {
      line.envases = envases;
    }

    const taraKg = round2(envases * peso);
    return taraKg;
  }

  function computeNetoKg(line){
    const bruto = toNum(line.bruto);
    const taraKg = toNum(line.taraKg);
    const neto = round2(bruto - taraKg);
    return neto < 0 ? 0 : neto;
  }

  /* =========================
     LINE CALCULATIONS
  ========================= */
  function recalcLinea(line){
    line.warn = '';

    // tara total
    line.taraKg = round2(computeTaraKg(line));

    if (line.modo === 'kg') {
      // neto (si no manual)
      if (!line.netoManual) {
        line.neto = computeNetoKg(line);
      } else {
        line.neto = round2(toNum(line.neto));
      }

      const bruto = toNum(line.bruto);
      const neto = toNum(line.neto);
      if (line.taraKg > bruto && bruto > 0) line.warn = 'Tara > Bruto';
      if (neto > bruto && bruto > 0) line.warn = 'Neto > Bruto';

      line.importe = round2(toNum(line.neto) * toNum(line.precio));
      return;
    }

    if (line.modo === 'caja') {
      // neto informativo si kg/caja
      const c = toNum(line.cantidad);
      const kgCaja = toNum(line.kgCaja);
      // si neto no manual, mostrar neto = c * kgCaja
      if (!line.netoManual) {
        line.neto = kgCaja > 0 ? round2(c * kgCaja) : 0;
      } else {
        line.neto = round2(toNum(line.neto));
      }
      line.importe = round2(c * toNum(line.precio));
      // tara no aplica en modo caja (pero si hay seleccionada, la dejamos informativa)
      return;
    }

    // UD
    {
      const c = toNum(line.cantidad);
      if (!line.netoManual) line.neto = 0;
      line.importe = round2(c * toNum(line.precio));
    }
  }

  function recalcFacturaTotals(){
    let subtotal = 0;
    for (const l of F.lineas) subtotal += toNum(l.importe);
    subtotal = round2(subtotal);

    const transporteOn = !!F.transporteOn;
    const tpct = toNum(F.transportePct ?? S.ajustes?.transportePct ?? 10);
    const tval = transporteOn ? round2(subtotal * (tpct/100)) : 0;

    const base = round2(subtotal + tval);

    const ivaIncl = !!F.ivaIncluido;
    const ipct = toNum(F.ivaPct ?? S.ajustes?.ivaPct ?? 4);
    const iva = ivaIncl ? 0 : round2(base * (ipct/100));
    const total = round2(base + iva);

    let pagado = 0;
    for (const p of (F.pagos || [])) pagado += toNum(p.importe);
    pagado = round2(pagado);

    const pendiente = round2(total - pagado);

    F.totals = { subtotal, transporte:tval, iva, total, pagado, pendiente };

    // estado automático
    if (total <= 0.0001) {
      F.estado = 'impagada';
    } else if (pendiente <= 0.0001) {
      F.estado = 'pagada';
    } else if (pagado > 0.0001) {
      F.estado = 'parcial';
    } else {
      F.estado = 'impagada';
    }

    // UI
    setTextSafe(IDS.outSubtotal, fmtEuro(subtotal));
    setTextSafe(IDS.outTransporte, fmtEuro(tval));
    setTextSafe(IDS.outIva, ivaIncl ? 'IVA incluido' : fmtEuro(iva));
    setTextSafe(IDS.outTotal, fmtEuro(total));
    setTextSafe(IDS.outPendiente, fmtEuro(pendiente));
  }

  function setTextSafe(sel, txt){
    const el = $(sel);
    if (el) el.textContent = txt ?? '';
  }

  /* =========================
     GRID PRO RENDER
  ========================= */
  function renderGrid(){
    const wrap = $(IDS.gridBody);
    if (!wrap) return;

    // Asegurar min líneas
    if (!Array.isArray(F.lineas)) F.lineas = [];
    if (F.lineas.length === 0) F.lineas = makeDefaultLineas(5);

    // render rows
    wrap.innerHTML = F.lineas.map((l, idx) => rowHTML(l, idx)).join('');

    // wire each row inputs
    $$('.gridRow', wrap).forEach(row => {
      const i = parseInt(row.getAttribute('data-i') || '0', 10);
      const line = F.lineas[i];
      if (!line) return;

      // helpers
      const q = (s) => row.querySelector(s);

      // producto
      const inpProd = q('[data-col="producto"]');
      on(inpProd, 'input', () => {
        line.producto = String(inpProd.value || '');
        // sugerencias (manual)
        const qv = String(line.producto || '').trim().toLowerCase();
        if (!qv) { acClose(); return; }
        const items = S.productos
          .filter(p => String(p.nombre||'').toLowerCase().includes(qv))
          .slice(0, 40)
          .map(p => {
            const pr = productPriceForMode(p, line.modo);
            const right = pr > 0 ? fmtEuro(pr) : '';
            return { left: p.nombre, right };
          });
        if (items.length) acOpen(inpProd, items, 'producto');
        else acClose();
      });

      on(inpProd, 'change', () => {
        // al seleccionar o confirmar texto -> aplicar defaults si existe producto exacto
        const p = findProductoByName(line.producto);
        if (p) {
          line.productoId = p.id;
          // modo default del producto SOLO si la línea está vacía en modo (se respeta elección)
          if (!line.modo) line.modo = p.modo || 'kg';
          line.kgCaja = toNum(p.kgCaja);
          // origen default si vacío
          if (!String(line.origen||'').trim()) line.origen = p.origen || '';

          // tara default del producto: si aún no hay tara elegida
          if (!line.taraId && p.taraDefault) line.taraId = p.taraDefault;

          // precio por modo si está vacío o 0
          if (toNum(line.precio) <= 0) {
            line.precio = productPriceForMode(p, line.modo);
          }
          // refrescar select de tara
          const selTara = q('[data-col="taraSel"]');
          if (selTara) selTara.value = line.taraId || '';

          // historial en UI
          const hist = q('[data-col="hist"]');
          if (hist) hist.textContent = getHistorialTextByProductoId(p.id);

          // recalcular
          recalcLinea(line);
          updateRowUI(i);
          recalcFacturaTotals();
        } else {
          line.productoId = '';
          // historial limpia
          const hist = q('[data-col="hist"]');
          if (hist) hist.textContent = '';
          recalcLinea(line);
          updateRowUI(i);
          recalcFacturaTotals();
        }
      });

      // modo
      const selModo = q('[data-col="modo"]');
      on(selModo, 'change', () => {
        line.modo = String(selModo.value || 'kg');

        // si tiene productoId, cargar precio por modo si el usuario no ha fijado precio (o precio 0)
        const p = line.productoId ? findProductoById(line.productoId) : findProductoByName(line.producto);
        if (p) {
          line.kgCaja = toNum(p.kgCaja);
          if (toNum(line.precio) <= 0) line.precio = productPriceForMode(p, line.modo);
        }

        // defaults: en modo caja -> bruto no obligatorio, tara no aplica
        if (line.modo !== 'kg') {
          line.bruto = 0;
          line.taraKg = 0;
        }

        // si modo caja y hay tara seleccionada, envases por defecto = cantidad
        if (line.modo === 'caja' && line.taraId && (!toNum(line.envases) || toNum(line.envases) <= 0)) {
          const c = toNum(line.cantidad);
          if (c > 0) line.envases = c;
        }

        // si modo kg y hay tara y envases vacío -> envases = cantidad (nº cajas)
        if (line.modo === 'kg' && line.taraId && (!toNum(line.envases) || toNum(line.envases) <= 0)) {
          const c = toNum(line.cantidad);
          if (c > 0) line.envases = c;
        }

        line.netoManual = false; // al cambiar modo, mejor recalcular neto
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // cantidad
      const inpCant = q('[data-col="cantidad"]');
      on(inpCant, 'input', () => {
        line.cantidad = toNum(inpCant.value);

        // autocompletar envases: si hay tara y envases vacío/0 -> envases=cantidad
        if (line.taraId && (!toNum(line.envases) || toNum(line.envases) <= 0)) {
          line.envases = toNum(line.cantidad);
          const envInp = q('[data-col="envases"]');
          if (envInp) envInp.value = line.envases ? String(line.envases) : '';
        }

        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // bruto (kg)
      const inpBruto = q('[data-col="bruto"]');
      on(inpBruto, 'input', () => {
        line.bruto = toNum(inpBruto.value);
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // tara selector
      const selTara = q('[data-col="taraSel"]');
      on(selTara, 'change', () => {
        line.taraId = String(selTara.value || '');
        // si selecciona tara, aplicar auto envases si vacío
        if (line.taraId && (!toNum(line.envases) || toNum(line.envases) <= 0)) {
          const c = toNum(line.cantidad);
          if (c > 0) {
            line.envases = c;
            const envInp = q('[data-col="envases"]');
            if (envInp) envInp.value = String(line.envases);
          }
        }
        line.netoManual = false; // si cambias tara, recalcula neto
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // envases
      const inpEnv = q('[data-col="envases"]');
      on(inpEnv, 'input', () => {
        line.envases = toNum(inpEnv.value);
        line.netoManual = false;
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // tara kg (solo lectura por defecto; si editan, lo aceptamos como manual pero no recomendado)
      const inpTaraKg = q('[data-col="taraKg"]');
      on(inpTaraKg, 'input', () => {
        // si el usuario toca taraKg manual, lo permitimos:
        line.taraKg = toNum(inpTaraKg.value);
        line.netoManual = false;
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // neto
      const inpNeto = q('[data-col="neto"]');
      on(inpNeto, 'input', () => {
        line.netoManual = true;
        line.neto = toNum(inpNeto.value);
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // precio
      const inpPrecio = q('[data-col="precio"]');
      on(inpPrecio, 'input', () => {
        line.precio = toNum(inpPrecio.value);
        recalcLinea(line);
        updateRowUI(i);
        recalcFacturaTotals();
      });

      // origen
      const inpOrigen = q('[data-col="origen"]');
      on(inpOrigen, 'input', () => {
        line.origen = String(inpOrigen.value || '');
      });

      // delete
      const del = q('[data-col="del"]');
      on(del, 'click', () => {
        F.lineas.splice(i, 1);
        if (F.lineas.length === 0) F.lineas = makeDefaultLineas(5);
        renderGrid();
        recalcFacturaTotals();
      });

      // ENTER PRO: avanza campo y al final crea línea
      const flowInputs = [
        inpProd, selModo, inpCant, inpBruto, selTara, inpEnv, inpTaraKg, inpNeto, inpPrecio, inpOrigen
      ].filter(Boolean);

      flowInputs.forEach((el, pos) => {
        on(el, 'keydown', (e) => {
          // si autocomplete abierto y el focus está en producto, dejamos que lo gestione AC
          if (AC.open && el === inpProd && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            const next = flowInputs[pos + 1];
            if (next) {
              next.focus();
              next.select?.();
            } else {
              // última columna -> nueva línea
              FACTU_addLinea();
              // enfocar producto de la nueva línea
              setTimeout(() => {
                const rows = $$('.gridRow', $(IDS.gridBody));
                const last = rows[rows.length - 1];
                last?.querySelector('[data-col="producto"]')?.focus();
              }, 0);
            }
          }
        });
      });

      // pintar historial si ya hay productoId
      const hist = q('[data-col="hist"]');
      if (hist) hist.textContent = line.productoId ? getHistorialTextByProductoId(line.productoId) : '';
    });

    // recalcular totales
    F.lineas.forEach(recalcLinea);
    recalcFacturaTotals();
  }

  function rowHTML(l, idx){
    const taraOptions = `<option value="">—</option>` + S.taras
      .slice()
      .sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'))
      .map(t => `<option value="${escapeHtml(t.id)}"${t.id===l.taraId?' selected':''}>${escapeHtml(t.nombre)} (${toNum(t.peso).toFixed(2).replace('.',',')}kg)</option>`)
      .join('');

    const warn = l.warn ? `<div class="small" style="color:#b91c1c;font-weight:900;margin-top:4px">${escapeHtml(l.warn)}</div>` : '';

    return `
    <div class="gridRow" data-i="${idx}">
      <div class="cell">
        <div style="width:100%">
          <input data-col="producto" value="${escapeHtml(l.producto)}" placeholder="Producto..." autocomplete="off" />
          ${warn}
          <div class="historyBox" data-col="hist" style="margin-top:6px;display:${l.productoId?'block':'none'}"></div>
        </div>
      </div>

      <div class="cell">
        <select data-col="modo">
          <option value="kg"${l.modo==='kg'?' selected':''}>kg</option>
          <option value="caja"${l.modo==='caja'?' selected':''}>caja</option>
          <option value="ud"${l.modo==='ud'?' selected':''}>ud</option>
        </select>
      </div>

      <div class="cell">
        <input data-col="cantidad" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.cantidad)}" placeholder="0" />
      </div>

      <div class="cell">
        <input data-col="bruto" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.bruto)}" placeholder="kg" ${l.modo==='kg'?'':'disabled'} />
      </div>

      <div class="cell">
        <select data-col="taraSel">${taraOptions}</select>
      </div>

      <div class="cell">
        <input data-col="envases" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.envases)}" placeholder="env" />
      </div>

      <div class="cell">
        <input data-col="taraKg" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.taraKg)}" placeholder="kg" />
      </div>

      <div class="cell">
        <input data-col="neto" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.neto)}" placeholder="kg" ${l.modo==='kg' || l.modo==='caja' ? '' : 'disabled'} />
      </div>

      <div class="cell">
        <input data-col="precio" inputmode="decimal" class="monoIn" value="${numOrEmpty(l.precio)}" placeholder="€" />
      </div>

      <div class="cell">
        <input data-col="origen" value="${escapeHtml(l.origen||'')}" placeholder="Origen" />
      </div>

      <div class="cell">
        <div class="importeBox">${fmtEuro(l.importe)}</div>
      </div>

      <div class="cell" style="justify-content:center">
        <button class="btnDel" data-col="del" title="Eliminar">×</button>
      </div>
    </div>`;
  }

  function numOrEmpty(n){
    const x = toNum(n);
    return x ? String(x).replace('.', ',') : '';
  }

  function updateRowUI(i){
    const wrap = $(IDS.gridBody);
    if (!wrap) return;
    const row = wrap.querySelector(`.gridRow[data-i="${i}"]`);
    if (!row) return;

    // importe
    const imp = row.querySelector('.importeBox');
    if (imp) imp.textContent = fmtEuro(F.lineas[i].importe);

    // taraKg + neto (por si se recalculan)
    const l = F.lineas[i];
    const taraKg = row.querySelector('[data-col="taraKg"]');
    if (taraKg && document.activeElement !== taraKg) taraKg.value = numOrEmpty(l.taraKg);

    const neto = row.querySelector('[data-col="neto"]');
    if (neto && document.activeElement !== neto) neto.value = numOrEmpty(l.neto);

    const env = row.querySelector('[data-col="envases"]');
    if (env && document.activeElement !== env) env.value = numOrEmpty(l.envases);

    // warn
    const prodWrap = row.querySelector('[data-col="producto"]')?.parentElement;
    if (prodWrap) {
      // eliminar warn existente y recrear
      const existing = prodWrap.querySelector('.small');
      if (existing && existing.style?.color) existing.remove();
      if (l.warn) {
        const d = document.createElement('div');
        d.className = 'small';
        d.style.color = '#b91c1c';
        d.style.fontWeight = '900';
        d.style.marginTop = '4px';
        d.textContent = l.warn;
        prodWrap.appendChild(d);
      }
    }

    // historial visible solo si hay productoId
    const hist = row.querySelector('[data-col="hist"]');
    if (hist) {
      hist.style.display = l.productoId ? 'block' : 'none';
      hist.textContent = l.productoId ? getHistorialTextByProductoId(l.productoId) : '';
    }
  }

  /* =========================
     QR (pantalla) — usa librería si existe, si no fallback
  ========================= */
  function buildQrText(){
    const nif = String(S.ajustes?.proveedor?.nif || '').trim();
    const num = String(F.num || '').trim();
    const fecha = ddmmyyyy(F.fecha || '');
    const total = fmtEuro(F.totals?.total || 0);

    // plantilla desde ajustes:
    const tpl = String(S.ajustes?.qrPlantilla || 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}');
    const txt = tpl
      .replaceAll('{NIF}', nif)
      .replaceAll('{NUM}', num)
      .replaceAll('{FECHA}', fecha)
      .replaceAll('{TOTAL}', total);

    return txt;
  }

  function renderQrOnScreen(){
    const txt = buildQrText();
    const area = $(IDS.qrText);
    if (area) area.value = txt;

    const small = $(IDS.qrSmall);
    if (small) small.textContent = txt ? `Texto QR: ${txt}` : '';

    const canvas = $(IDS.qrCanvas);
    const fb = $(IDS.qrFallback);

    // validación previa
    const nif = String(S.ajustes?.proveedor?.nif || '').trim();
    if (!nif || !F.num || !F.fecha || !(toNum(F.totals?.total) > 0)) {
      if (fb) {
        fb.style.display = 'flex';
        fb.textContent = 'QR: faltan datos (NIF/NUM/FECHA/TOTAL).';
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }

    // Intentar render con librerías comunes
    try{
      if (!canvas) throw new Error('no canvas');
      canvas.style.display = 'block';
      if (fb) fb.style.display = 'none';

      const size = 220;
      canvas.width = size;
      canvas.height = size;

      // 1) QRCode (davidshimjs)
      if (window.QRCode) {
        // si existe QRCode con target div, creamos temporal
        // fallback: dibujamos un patrón simple si no podemos
        // NOTA: muchas libs QR no dibujan sobre canvas directo.
        throw new Error('QRCode lib no-canvas');
      }

      // 2) qrcode-generator
      if (window.qrcode) {
        const qr = window.qrcode(0, 'M');
        qr.addData(txt);
        qr.make();
        const ctx = canvas.getContext('2d');
        const count = qr.getModuleCount();
        const cell = Math.floor(size / count);
        ctx.clearRect(0,0,size,size);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,size,size);
        for (let r=0;r<count;r++){
          for (let c=0;c<count;c++){
            ctx.fillStyle = qr.isDark(r,c) ? '#111' : '#fff';
            ctx.fillRect(c*cell, r*cell, cell, cell);
          }
        }
        return;
      }

      // 3) Si no hay lib: fallback (no QR real)
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,size,size);
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 12px ui-monospace, Menlo, Consolas';
      ctx.fillText('QR NO DISPONIBLE', 40, 108);

      if (fb) {
        fb.style.display = 'flex';
        fb.textContent = 'QR no disponible (lib QR no cargada). Texto listo para copiar.';
      }
    } catch(err){
      if (fb) {
        fb.style.display = 'flex';
        fb.textContent = 'QR no disponible (lib QR no cargada). Texto listo para copiar.';
      }
      if (canvas) canvas.style.display = 'none';
    }
  }

  /* =========================
     FACTURA UI BINDINGS
  ========================= */
  function bindFacturaUI(){
    // set values
    setTextSafe(IDS.numFactura, F.num || '');
    if ($(IDS.inpFecha)) setVal(IDS.inpFecha, F.fecha || isoToday());
    if ($(IDS.inpTags)) setVal(IDS.inpTags, F.tags || '');
    if ($(IDS.inpNotasInt)) setVal(IDS.inpNotasInt, F.notasInt || '');
    if ($(IDS.inpObs)) setVal(IDS.inpObs, F.obs || '');

    const chkT = $(IDS.chkTransporte);
    if (chkT) chkT.checked = !!F.transporteOn;

    const chkI = $(IDS.chkIvaIncluido);
    if (chkI) chkI.checked = !!F.ivaIncluido;

    // cliente selector
    const sel = $(IDS.selCliente);
    if (sel) sel.value = F.clienteId || '';

    // cliente snap
    setVal(IDS.cliNombre, F.clienteSnap?.nombre || '');
    setVal(IDS.cliNif, F.clienteSnap?.nif || '');
    setVal(IDS.cliDir, F.clienteSnap?.dir || '');
    setVal(IDS.cliTel, F.clienteSnap?.tel || '');
    setVal(IDS.cliEmail, F.clienteSnap?.email || '');
    setVal(IDS.cliPago, F.clienteSnap?.pago || '');

    // wire changes (una vez)
    if (!bindFacturaUI._wired) {
      bindFacturaUI._wired = true;

      on($(IDS.inpFecha), 'change', () => {
        F.fecha = val(IDS.inpFecha) || isoToday();
        recalcFacturaTotals();
        renderQrOnScreen();
      });

      on($(IDS.inpTags), 'input', () => F.tags = val(IDS.inpTags));
      on($(IDS.inpNotasInt), 'input', () => F.notasInt = val(IDS.inpNotasInt));
      on($(IDS.inpObs), 'input', () => F.obs = val(IDS.inpObs));

      on($(IDS.chkTransporte), 'change', () => {
        F.transporteOn = !!$(IDS.chkTransporte).checked;
        recalcFacturaTotals();
        renderQrOnScreen();
      });

      on($(IDS.chkIvaIncluido), 'change', () => {
        F.ivaIncluido = !!$(IDS.chkIvaIncluido).checked;
        recalcFacturaTotals();
        renderQrOnScreen();
      });

      // botón añadir 4% IVA al total (atajo)
      on($(IDS.btnAddIva4), 'click', () => {
        // Fuerza IVA no incluido, y usa el % actual (por defecto 4)
        F.ivaIncluido = false;
        const chk = $(IDS.chkIvaIncluido);
        if (chk) chk.checked = false;
        recalcFacturaTotals();
        renderQrOnScreen();
        toast('IVA aplicado');
      });

      // selector cliente
      on($(IDS.selCliente), 'change', () => {
        const id = val(IDS.selCliente);
        F.clienteId = id;
        const c = findClienteById(id);
        if (c) {
          // aplicar plantilla cliente (si existe)
          F.clienteSnap = {
            nombre: c.nombre || '',
            nif: c.nif || '',
            dir: c.dir || '',
            tel: c.tel || '',
            email: c.email || '',
            pago: c.pago || ''
          };

          if (c.tpl && typeof c.tpl === 'object') {
            if (typeof c.tpl.ivaIncluido === 'boolean') F.ivaIncluido = c.tpl.ivaIncluido;
            if (typeof c.tpl.transporte === 'boolean') F.transporteOn = c.tpl.transporte;
            if (typeof c.tpl.tagsAuto === 'string' && c.tpl.tagsAuto.trim()) {
              if (!String(F.tags||'').trim()) F.tags = c.tpl.tagsAuto;
            }
            if (typeof c.tpl.notasStd === 'string' && c.tpl.notasStd.trim()) {
              if (!String(F.obs||'').trim()) F.obs = c.tpl.notasStd;
            }
          }

          // reflejar UI
          bindFacturaUI();
          recalcFacturaTotals();
          renderQrOnScreen();
        } else {
          F.clienteSnap = { nombre:'', nif:'', dir:'', tel:'', email:'', pago:'' };
          bindFacturaUI();
          renderQrOnScreen();
        }
      });

      // botones cliente en factura
      on($(IDS.btnNuevoClienteFactura), 'click', () => {
        F.clienteId = '';
        F.clienteSnap = { nombre:'', nif:'', dir:'', tel:'', email:'', pago:'' };
        if ($(IDS.selCliente)) $(IDS.selCliente).value = '';
        bindFacturaUI();
        toast('Cliente (nuevo) listo para editar');
      });

      on($(IDS.btnGuardarClienteFactura), 'click', () => {
        const nombre = val(IDS.cliNombre).trim();
        if (!nombre) { toast('Cliente: falta nombre'); return; }

        const obj = {
          id: F.clienteId || uid(),
          nombre,
          nif: val(IDS.cliNif).trim(),
          dir: val(IDS.cliDir).trim(),
          tel: val(IDS.cliTel).trim(),
          email: val(IDS.cliEmail).trim(),
          pago: val(IDS.cliPago).trim(),
          alias: '',
          notas: '',
          tpl: {}
        };

        // actualizar / insertar
        const idx = S.clientes.findIndex(c => c.id === obj.id);
        if (idx >= 0) S.clientes[idx] = { ...S.clientes[idx], ...obj };
        else S.clientes.push(obj);

        save('factu_miral_clientes_v1', S.clientes);
        // refrescar selector (3A helpers)
        U.fillClienteSelector();
        // set selected
        F.clienteId = obj.id;
        if ($(IDS.selCliente)) $(IDS.selCliente).value = obj.id;
        // snap
        F.clienteSnap = { nombre: obj.nombre, nif: obj.nif, dir: obj.dir, tel: obj.tel, email: obj.email, pago: obj.pago };
        toast('Cliente guardado');
      });

      // payments
      on($(IDS.btnAddPago), 'click', () => addPagoFromUI());
      on($(IDS.pagoImporte), 'keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addPagoFromUI(); }
      });

      // grid buttons
      on($(IDS.btnAddLinea), 'click', () => { FACTU_addLinea(); });
      on($(IDS.btnVaciarLineas), 'click', () => {
        F.lineas = makeDefaultLineas(5);
        renderGrid();
        toast('Líneas reiniciadas');
      });
    }

    renderGrid();
    renderPagos();
    recalcFacturaTotals();
    renderQrOnScreen();
  }

  function addPagoFromUI(){
    const imp = toNum(val(IDS.pagoImporte));
    if (!(imp > 0)) { toast('Pago: importe inválido'); return; }
    const fecha = val(IDS.pagoFecha) || isoToday();
    const metodo = val(IDS.pagoMetodo) || F.metodoPago || 'efectivo';
    if (!Array.isArray(F.pagos)) F.pagos = [];
    F.pagos.push({ id: uid(), importe: round2(imp), fecha, metodo });
    setVal(IDS.pagoImporte, '');
    renderPagos();
    recalcFacturaTotals();
    renderQrOnScreen();
    toast('Pago añadido');
  }

  function renderPagos(){
    const wrap = $(IDS.pagosList);
    if (!wrap) return;
    const pagos = Array.isArray(F.pagos) ? F.pagos : [];
    if (!pagos.length){
      wrap.innerHTML = `<div class="muted small">Sin pagos.</div>`;
      return;
    }
    wrap.innerHTML = pagos
      .slice()
      .sort((a,b) => String(a.fecha||'').localeCompare(String(b.fecha||'')))
      .map(p => `
        <div class="totRow">
          <div>
            <div style="font-weight:900">${fmtEuro(p.importe)} <span class="muted small">(${escapeHtml((p.metodo||'').toUpperCase())})</span></div>
            <div class="muted small">${ddmmyyyy(p.fecha)} · ${escapeHtml(dayNameES(p.fecha))}</div>
          </div>
          <button class="btn btnTiny btnDangerGhost" data-delp="${escapeHtml(p.id)}">Eliminar</button>
        </div>
      `).join('');

    $$('[data-delp]', wrap).forEach(btn => {
      on(btn, 'click', () => {
        const id = btn.getAttribute('data-delp');
        F.pagos = (F.pagos || []).filter(x => x.id !== id);
        renderPagos();
        recalcFacturaTotals();
        renderQrOnScreen();
      });
    });
  }

  /* =========================
     FACTURAS: SAVE / LOAD / LIST
  ========================= */
  function validateFacturaBeforeSave(){
    // básicos
    if (!String(F.num||'').trim()) return 'Falta número';
    if (!String(F.fecha||'').trim()) return 'Falta fecha';
    if (!String(F.clienteSnap?.nombre||'').trim()) return 'Falta cliente (nombre)';
    // líneas: permitir vacías pero al menos 1 con producto y precio
    const used = (F.lineas || []).filter(l => String(l.producto||'').trim() && (toNum(l.precio) > 0) && ((l.modo==='kg' && toNum(l.bruto) > 0) || (l.modo!=='kg' && toNum(l.cantidad) > 0)));
    if (!used.length) return 'Añade al menos 1 línea completa';
    // warnings críticos opcional: tara > bruto
    const bad = (F.lineas || []).some(l => l.modo==='kg' && toNum(l.bruto) > 0 && toNum(l.taraKg) > toNum(l.bruto) + 1e-9);
    if (bad) return 'Hay líneas con Tara > Bruto';
    return '';
  }

  function snapshotProveedor(){
    // siempre desde ajustes (editable y guardable)
    return { ...(S.ajustes?.proveedor || {}) };
  }

  function snapshotCliente(){
    return {
      nombre: val(IDS.cliNombre).trim(),
      nif: val(IDS.cliNif).trim(),
      dir: val(IDS.cliDir).trim(),
      tel: val(IDS.cliTel).trim(),
      email: val(IDS.cliEmail).trim(),
      pago: val(IDS.cliPago).trim()
    };
  }

  function cleanLineForSave(l){
    const out = { ...l };
    // normalizar números
    out.cantidad = round2(toNum(out.cantidad));
    out.bruto = round2(toNum(out.bruto));
    out.envases = round2(toNum(out.envases));
    out.taraKg = round2(toNum(out.taraKg));
    out.neto = round2(toNum(out.neto));
    out.precio = round2(toNum(out.precio));
    out.kgCaja = round2(toNum(out.kgCaja));
    out.importe = round2(toNum(out.importe));
    return out;
  }

  function FACTU_guardarFactura(){
    // sincronizar UI -> modelo
    F.fecha = val(IDS.inpFecha) || isoToday();
    F.tags = val(IDS.inpTags);
    F.notasInt = val(IDS.inpNotasInt);
    F.obs = val(IDS.inpObs);
    F.transporteOn = !!$(IDS.chkTransporte)?.checked;
    F.ivaIncluido = !!$(IDS.chkIvaIncluido)?.checked;
    F.clienteSnap = snapshotCliente();
    F.proveedorSnap = snapshotProveedor();
    F.ivaPct = toNum(S.ajustes?.ivaPct ?? 4);
    F.transportePct = toNum(S.ajustes?.transportePct ?? 10);

    // recalcular total final
    F.lineas.forEach(recalcLinea);
    recalcFacturaTotals();

    // validación
    const err = validateFacturaBeforeSave();
    if (err) { toast('No se puede guardar: ' + err); return; }

    // actualizar historial precios por producto (solo si línea válida)
    for (const l of (F.lineas || [])) {
      if (!String(l.producto||'').trim()) continue;
      const p = l.productoId ? findProductoById(l.productoId) : findProductoByName(l.producto);
      if (!p) continue;

      // si no había id, fijarlo
      l.productoId = p.id;

      if (toNum(l.precio) > 0) {
        updateProductoHistorial(p, l.modo, l.precio, F.fecha);
        // si producto no tiene precio guardado, lo dejamos (no pisamos si ya hay)
        // pero sí puedes actualizar precios desde Productos explícitamente.
      }

      // origin: si producto no tiene origen y la línea sí, guardamos como default
      if (!String(p.origen||'').trim() && String(l.origen||'').trim()) {
        p.origen = String(l.origen||'').trim();
      }

      // tara default: si producto no tiene taraDefault y la línea sí, guardamos
      if (!p.taraDefault && l.taraId) p.taraDefault = l.taraId;
    }

    // persist productos (historial)
    save('factu_miral_productos_v1', S.productos);

    // guardar factura (upsert)
    const fact = {
      ...F,
      lineas: (F.lineas || []).map(cleanLineForSave),
      pagos: Array.isArray(F.pagos) ? F.pagos.map(p => ({...p, importe: round2(toNum(p.importe))})) : [],
      totals: { ...F.totals }
    };

    const idx = S.facturas.findIndex(x => x.id === fact.id);
    if (idx >= 0) S.facturas[idx] = fact;
    else S.facturas.unshift(fact); // nuevas arriba

    save('factu_miral_facturas_v1', S.facturas);
    toast('Factura guardada');

    // refrescar listados si están visibles
    if (typeof window.FACTU_renderFacturas === 'function') window.FACTU_renderFacturas();
    if (typeof window.FACTU_renderContabilidad === 'function') window.FACTU_renderContabilidad();

    // QR actualizado
    renderQrOnScreen();
  }

  function FACTU_nuevaFactura(){
    F = makeFacturaEmpty();
    // aplica provider desde ajustes y cliente vacío
    F.proveedorSnap = snapshotProveedor();
    S._activeFactura = F;

    // UI
    bindFacturaUI();
    toast('Nueva factura');
  }

  function FACTU_duplicarFactura(){
    const old = F;
    const nf = JSON.parse(JSON.stringify(old));
    nf.id = uid();
    // nuevo número
    const now = new Date();
    nf.num = `FA-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    nf.fecha = isoToday();
    // pagos vacíos
    nf.pagos = [];
    nf.estado = 'impagada';
    // reset pdf
    nf.pdfUrl = '';
    nf.totals = { subtotal:0, transporte:0, iva:0, total:0, pagado:0, pendiente:0 };
    // neto manual off
    (nf.lineas||[]).forEach(l => { l.id = uid(); l.netoManual = false; });

    F = nf;
    S._activeFactura = F;
    bindFacturaUI();
    toast('Factura duplicada');
  }

  function FACTU_eliminarFactura(){
    if (!F?.id) { toast('No hay factura activa'); return; }
    const isSaved = S.facturas.some(x => x.id === F.id);
    if (isSaved) {
      if (!confirm(`Eliminar factura ${F.num}?`)) return;
      S.facturas = S.facturas.filter(x => x.id !== F.id);
      save('factu_miral_facturas_v1', S.facturas);
      toast('Factura eliminada');
      // nueva
      FACTU_nuevaFactura();
      if (typeof window.FACTU_renderFacturas === 'function') window.FACTU_renderFacturas();
      if (typeof window.FACTU_renderContabilidad === 'function') window.FACTU_renderContabilidad();
    } else {
      // no guardada
      FACTU_nuevaFactura();
    }
  }

  function FACTU_addLinea(){
    if (!Array.isArray(F.lineas)) F.lineas = [];
    F.lineas.push(makeLineaEmpty());
    renderGrid();
  }

  function FACTU_loadFacturaById(id){
    const f = S.facturas.find(x => x.id === id);
    if (!f) { toast('Factura no encontrada'); return; }
    F = JSON.parse(JSON.stringify(f));
    S._activeFactura = F;
    setActiveTab('tabFactura');
    bindFacturaUI();
    toast('Factura cargada');
  }

  /* =========================
     LISTADO FACTURAS TAB
  ========================= */
  function FACTU_renderFacturas(){
    const list = $('#facturasList');
    if (!list) return;

    const q = String($('#buscarFacturas')?.value || '').trim().toLowerCase();
    const d1 = String($('#factDesde')?.value || '').trim();
    const d2 = String($('#factHasta')?.value || '').trim();

    let arr = (S.facturas || []).slice();

    // rango fecha
    if (d1) arr = arr.filter(x => String(x.fecha||'') >= d1);
    if (d2) arr = arr.filter(x => String(x.fecha||'') <= d2);

    // búsqueda
    if (q) {
      arr = arr.filter(x => {
        const num = String(x.num||'').toLowerCase();
        const cli = String(x.clienteSnap?.nombre||'').toLowerCase();
        const tags = String(x.tags||'').toLowerCase();
        const obs = String(x.obs||'').toLowerCase();
        return num.includes(q) || cli.includes(q) || tags.includes(q) || obs.includes(q);
      });
    }

    // sort desc fecha+num
    arr.sort((a,b) => (String(b.fecha||'').localeCompare(String(a.fecha||''))) || (String(b.num||'').localeCompare(String(a.num||''))));

    if (!arr.length){
      list.innerHTML = `<div class="muted small" style="padding:10px">No hay facturas.</div>`;
      return;
    }

    list.innerHTML = arr.map(f => {
      const total = fmtEuro(toNum(f?.totals?.total));
      const pend = fmtEuro(toNum(f?.totals?.pendiente));
      const st = String(f.estado||'impagada');
      const stTxt = st === 'pagada' ? 'PAGADA' : (st === 'parcial' ? 'PARCIAL' : 'IMPAGADA');
      const stBadge = st === 'pagada'
        ? `<span class="badge" style="border-color:#111;background:#111;color:#fff">${stTxt}</span>`
        : `<span class="badge">${stTxt}</span>`;

      return `
      <div class="item" data-fid="${escapeHtml(f.id)}">
        <div class="itemTop">
          <div class="itemTitle">${escapeHtml(f.num)} · ${ddmmyyyy(f.fecha)} <span class="muted small">(${escapeHtml(dayNameES(f.fecha))})</span></div>
          ${stBadge}
        </div>
        <div class="itemSub">
          <b>${escapeHtml(f.clienteSnap?.nombre||'')}</b> · Total: <b>${total}</b> · Pendiente: <b>${pend}</b>
          ${String(f.tags||'').trim() ? ` · Tags: ${escapeHtml(f.tags)}` : ''}
        </div>
        <div class="itemBtns" style="margin-top:8px">
          <button class="btn btnTiny" data-edit="${escapeHtml(f.id)}">Editar</button>
          <button class="btn btnTiny btnGhost" data-view="${escapeHtml(f.id)}">Ver PDF</button>
        </div>
      </div>`;
    }).join('');

    $$('[data-edit]', list).forEach(b => on(b, 'click', (e) => {
      e.stopPropagation();
      FACTU_loadFacturaById(b.getAttribute('data-edit'));
    }));
    $$('[data-view]', list).forEach(b => on(b, 'click', (e) => {
      e.stopPropagation();
      const id = b.getAttribute('data-view');
      FACTU_loadFacturaById(id);
      // visor PDF en 3C
      if (typeof window.FACTU_verPDF === 'function') window.FACTU_verPDF();
      else toast('Visor PDF en 3C');
    }));
    $$('.item', list).forEach(card => on(card, 'click', () => {
      const id = card.getAttribute('data-fid');
      FACTU_loadFacturaById(id);
    }));
  }

  function wireFacturasSearch(){
    on($('#buscarFacturas'), 'input', () => FACTU_renderFacturas());
    on($('#factDesde'), 'change', () => FACTU_renderFacturas());
    on($('#factHasta'), 'change', () => FACTU_renderFacturas());
  }

  /* =========================
     CLIENTES TAB (gestión completa)
  ========================= */
  function FACTU_renderClientes(){
    const list = $('#clientesList');
    if (!list) return;

    const q = String($('#buscarClientes')?.value || '').trim().toLowerCase();
    let arr = (S.clientes || []).slice();
    if (q) {
      arr = arr.filter(c => {
        const a = String(c.nombre||'').toLowerCase();
        const b = String(c.nif||'').toLowerCase();
        const d = String(c.alias||'').toLowerCase();
        return a.includes(q) || b.includes(q) || d.includes(q);
      });
    }
    arr.sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es'));

    list.innerHTML = arr.map(c => `
      <div class="item" data-cid="${escapeHtml(c.id)}">
        <div class="itemTop">
          <div class="itemTitle">${escapeHtml(c.nombre)}</div>
          <span class="badge">${escapeHtml(c.nif||'')}</span>
        </div>
        <div class="itemSub">${escapeHtml(c.dir||'')}</div>
      </div>
    `).join('') || `<div class="muted small" style="padding:10px">No hay clientes.</div>`;

    $$('.item', list).forEach(it => on(it, 'click', () => {
      const id = it.getAttribute('data-cid');
      openClienteEditor(id);
    }));
  }

  function openClienteEditor(id){
    const c = id ? findClienteById(id) : null;
    S._cliEditId = c ? c.id : '';
    setVal('#cNombre', c?.nombre || '');
    setVal('#cAlias', c?.alias || '');
    setVal('#cNif', c?.nif || '');
    setVal('#cDir', c?.dir || '');
    setVal('#cTel', c?.tel || '');
    setVal('#cEmail', c?.email || '');
    setVal('#cPago', c?.pago || '');
    setVal('#cNotas', c?.notas || '');

    // plantillas
    const tpl = c?.tpl || {};
    const chkI = $('#cTplIvaIncluido');
    const chkT = $('#cTplTransporte');
    if (chkI) chkI.checked = !!tpl.ivaIncluido;
    if (chkT) chkT.checked = !!tpl.transporte;
    setVal('#cTplTags', tpl.tagsAuto || '');
    setVal('#cTplObs', tpl.notasStd || '');

    setTextSafe('#cEditorTitle', c ? 'Editar cliente' : 'Nuevo cliente');
  }

  function saveClienteFromEditor(){
    const nombre = String($('#cNombre')?.value || '').trim();
    if (!nombre) { toast('Cliente: falta nombre'); return; }
    const id = S._cliEditId || uid();
    const obj = {
      id,
      nombre,
      alias: String($('#cAlias')?.value || '').trim(),
      nif: String($('#cNif')?.value || '').trim(),
      dir: String($('#cDir')?.value || '').trim(),
      tel: String($('#cTel')?.value || '').trim(),
      email: String($('#cEmail')?.value || '').trim(),
      pago: String($('#cPago')?.value || '').trim(),
      notas: String($('#cNotas')?.value || '').trim(),
      tpl: {
        ivaIncluido: !!$('#cTplIvaIncluido')?.checked,
        transporte: !!$('#cTplTransporte')?.checked,
        tagsAuto: String($('#cTplTags')?.value || ''),
        notasStd: String($('#cTplObs')?.value || '')
      }
    };

    const idx = S.clientes.findIndex(x => x.id === id);
    if (idx >= 0) S.clientes[idx] = { ...S.clientes[idx], ...obj };
    else S.clientes.push(obj);

    save('factu_miral_clientes_v1', S.clientes);
    U.fillClienteSelector();
    FACTU_renderClientes();
    toast('Cliente guardado');

    // si coincide con cliente seleccionado en factura, refrescar
    if (F.clienteId === id) {
      F.clienteSnap = { nombre: obj.nombre, nif: obj.nif, dir: obj.dir, tel: obj.tel, email: obj.email, pago: obj.pago };
      bindFacturaUI();
    }
  }

  function canDeleteCliente(id){
    if (!id) return false;
    // si está usado en facturas (clienteId), bloquear
    return !S.facturas.some(f => f.clienteId === id);
  }

  function deleteClienteFromEditor(){
    const id = S._cliEditId;
    if (!id) { toast('No hay cliente seleccionado'); return; }
    if (!canDeleteCliente(id)) { toast('No se puede eliminar: usado en facturas'); return; }
    if (!confirm('Eliminar cliente?')) return;
    S.clientes = S.clientes.filter(c => c.id !== id);
    save('factu_miral_clientes_v1', S.clientes);
    U.fillClienteSelector();
    FACTU_renderClientes();
    openClienteEditor('');
    toast('Cliente eliminado');
  }

  function wireClientesTab(){
    on($('#buscarClientes'), 'input', () => FACTU_renderClientes());
    on($('#btnClienteNuevo'), 'click', () => openClienteEditor(''));
    on($('#btnClienteGuardar'), 'click', () => saveClienteFromEditor());
    on($('#btnClienteEliminar'), 'click', () => deleteClienteFromEditor());
  }

  /* =========================
     PRODUCTOS TAB (vocab + precios + kg/caja + historial)
  ========================= */
  function FACTU_renderProductos(){
    const list = $('#productosList');
    if (!list) return;

    const q = String($('#buscarProductos')?.value || '').trim().toLowerCase();
    let arr = (S.productos || []).slice();
    if (q) {
      arr = arr.filter(p => String(p.nombre||'').toLowerCase().includes(q));
    }
    arr.sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es'));

    list.innerHTML = arr.map(p => {
      const prKg = toNum(p.precioKg) > 0 ? fmtEuro(p.precioKg) : '—';
      const prCaja = toNum(p.precioCaja) > 0 ? fmtEuro(p.precioCaja) : '—';
      const prUd = toNum(p.precioUd) > 0 ? fmtEuro(p.precioUd) : '—';
      return `
        <div class="item" data-pid="${escapeHtml(p.id)}">
          <div class="itemTop">
            <div class="itemTitle">${escapeHtml(p.nombre)}</div>
            <span class="badge">${escapeHtml((p.modo||'kg').toUpperCase())}</span>
          </div>
          <div class="itemSub">€/kg: <b>${prKg}</b> · €/caja: <b>${prCaja}</b> · €/ud: <b>${prUd}</b> · Kg/caja: <b>${toNum(p.kgCaja) ? String(toNum(p.kgCaja)).replace('.',',') : '—'}</b></div>
        </div>
      `;
    }).join('') || `<div class="muted small" style="padding:10px">No hay productos.</div>`;

    $$('.item', list).forEach(it => on(it, 'click', () => {
      const id = it.getAttribute('data-pid');
      openProductoEditor(id);
    }));
  }

  function openProductoEditor(id){
    const p = id ? findProductoById(id) : null;
    S._prodEditId = p ? p.id : '';
    setVal('#pNombre', p?.nombre || '');
    setVal('#pModo', p?.modo || 'kg');
    setVal('#pKgCaja', numOrEmpty(p?.kgCaja || 0));
    setVal('#pPrecioKg', numOrEmpty(p?.precioKg || 0));
    setVal('#pPrecioCaja', numOrEmpty(p?.precioCaja || 0));
    setVal('#pPrecioUd', numOrEmpty(p?.precioUd || 0));
    setVal('#pCoste', numOrEmpty(p?.coste || 0));
    setVal('#pOrigen', p?.origen || '');

    // tara default select (ya la rellena 3A en opciones, pero refrescamos por si acaso)
    U.fillTaraDefaultSelect();
    setVal('#pTaraDefault', p?.taraDefault || '');

    // historial (solo pantalla)
    setTextSafe('#pHistorial', p?.historial && p.historial.length ? p.historial.map(h => `${ddmmyyyy(h.fecha)} · ${(h.modo||'').toUpperCase()} · ${fmtEuro(h.precio)}`).join('\n') : '—');

    setTextSafe('#pEditorTitle', p ? 'Editar producto' : 'Nuevo producto');
  }

  function isProductoUsed(prodId){
    if (!prodId) return false;
    return S.facturas.some(f => (f.lineas||[]).some(l => l.productoId === prodId));
  }

  function saveProductoFromEditor(){
    const nombre = String($('#pNombre')?.value || '').trim();
    if (!nombre) { toast('Producto: falta nombre'); return; }
    const id = S._prodEditId || uid();

    const obj = {
      id,
      nombre,
      modo: String($('#pModo')?.value || 'kg'),
      kgCaja: round2(toNum($('#pKgCaja')?.value)),
      precioKg: round2(toNum($('#pPrecioKg')?.value)),
      precioCaja: round2(toNum($('#pPrecioCaja')?.value)),
      precioUd: round2(toNum($('#pPrecioUd')?.value)),
      coste: round2(toNum($('#pCoste')?.value)),
      origen: String($('#pOrigen')?.value || ''),
      taraDefault: String($('#pTaraDefault')?.value || ''),
      historial: (findProductoById(id)?.historial) || []
    };

    // evitar duplicados por nombre (si cambia nombre, respeta id)
    const dup = S.productos.find(p => p.id !== id && String(p.nombre||'').trim().toLowerCase() === nombre.toLowerCase());
    if (dup) { toast('Ya existe un producto con ese nombre'); return; }

    const idx = S.productos.findIndex(x => x.id === id);
    if (idx >= 0) S.productos[idx] = { ...S.productos[idx], ...obj };
    else S.productos.push(obj);

    save('factu_miral_productos_v1', S.productos);
    U.fillProductoDatalistCache();
    FACTU_renderProductos();
    toast('Producto guardado');
  }

  function deleteProductoFromEditor(){
    const id = S._prodEditId;
    if (!id) { toast('No hay producto seleccionado'); return; }
    if (isProductoUsed(id)) { toast('No se puede eliminar: usado en facturas'); return; }
    if (!confirm('Eliminar producto?')) return;
    S.productos = S.productos.filter(p => p.id !== id);
    save('factu_miral_productos_v1', S.productos);
    U.fillProductoDatalistCache();
    FACTU_renderProductos();
    openProductoEditor('');
    toast('Producto eliminado');
  }

  function wireProductosTab(){
    on($('#buscarProductos'), 'input', () => FACTU_renderProductos());
    on($('#btnProductoNuevo'), 'click', () => openProductoEditor(''));
    on($('#btnProductoGuardar'), 'click', () => saveProductoFromEditor());
    on($('#btnProductoEliminar'), 'click', () => deleteProductoFromEditor());
  }

  /* =========================
     TARAS TAB (gestión envases)
  ========================= */
  function FACTU_renderTaras(){
    const list = $('#tarasList');
    if (!list) return;

    const q = String($('#buscarTaras')?.value || '').trim().toLowerCase();
    let arr = (S.taras || []).slice();
    if (q) arr = arr.filter(t => String(t.nombre||'').toLowerCase().includes(q));
    arr.sort((a,b) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es'));

    list.innerHTML = arr.map(t => `
      <div class="item" data-tid="${escapeHtml(t.id)}">
        <div class="itemTop">
          <div class="itemTitle">${escapeHtml(t.nombre)}</div>
          <span class="badge">${toNum(t.peso).toFixed(2).replace('.',',')} kg</span>
        </div>
        <div class="itemSub">${escapeHtml(t.notas||'')}</div>
      </div>
    `).join('') || `<div class="muted small" style="padding:10px">No hay taras.</div>`;

    $$('.item', list).forEach(it => on(it, 'click', () => {
      const id = it.getAttribute('data-tid');
      openTaraEditor(id);
    }));
  }

  function isTaraUsed(taraId){
    if (!taraId) return false;
    return S.facturas.some(f => (f.lineas||[]).some(l => l.taraId === taraId));
  }

  function openTaraEditor(id){
    const t = id ? findTaraById(id) : null;
    S._taraEditId = t ? t.id : '';
    setVal('#tNombre', t?.nombre || '');
    setVal('#tPeso', numOrEmpty(t?.peso || 0));
    setVal('#tNotas', t?.notas || '');
    setTextSafe('#tEditorTitle', t ? 'Editar tara' : 'Nueva tara');
  }

  function saveTaraFromEditor(){
    const nombre = String($('#tNombre')?.value || '').trim();
    if (!nombre) { toast('Tara: falta nombre'); return; }
    const id = S._taraEditId || uid();
    const obj = { id, nombre, peso: round2(toNum($('#tPeso')?.value)), notas: String($('#tNotas')?.value || '') };

    const dup = S.taras.find(t => t.id !== id && String(t.nombre||'').trim().toLowerCase() === nombre.toLowerCase());
    if (dup) { toast('Ya existe una tara con ese nombre'); return; }

    const idx = S.taras.findIndex(x => x.id === id);
    if (idx >= 0) S.taras[idx] = { ...S.taras[idx], ...obj };
    else S.taras.push(obj);

    save('factu_miral_taras_v1', S.taras);
    U.fillTaraDefaultSelect();
    FACTU_renderTaras();
    // refrescar grid (selects)
    renderGrid();
    toast('Tara guardada');
  }

  function deleteTaraFromEditor(){
    const id = S._taraEditId;
    if (!id) { toast('No hay tara seleccionada'); return; }
    if (isTaraUsed(id)) { toast('No se puede eliminar: usada en facturas'); return; }
    if (!confirm('Eliminar tara?')) return;
    S.taras = S.taras.filter(t => t.id !== id);
    save('factu_miral_taras_v1', S.taras);
    U.fillTaraDefaultSelect();
    FACTU_renderTaras();
    renderGrid();
    openTaraEditor('');
    toast('Tara eliminada');
  }

  function wireTarasTab(){
    on($('#buscarTaras'), 'input', () => FACTU_renderTaras());
    on($('#btnTaraNueva'), 'click', () => openTaraEditor(''));
    on($('#btnTaraGuardar'), 'click', () => saveTaraFromEditor());
    on($('#btnTaraEliminar'), 'click', () => deleteTaraFromEditor());
  }

  /* =========================
     WHATSAPP PRO (texto)
  ========================= */
  function buildWhatsAppText(){
    const linesOk = (F.lineas || []).filter(l => String(l.producto||'').trim() && toNum(l.importe) > 0);
    const head = [
      `*FACTURA ${F.num}*`,
      `Fecha: ${ddmmyyyy(F.fecha)} (${dayNameES(F.fecha)})`,
      `Cliente: ${F.clienteSnap?.nombre || ''}`,
      F.tags ? `Tags: ${F.tags}` : ''
    ].filter(Boolean).join('\n');

    const body = linesOk.map(l => {
      const modo = (l.modo || '').toUpperCase();
      if (l.modo === 'kg') {
        return `• ${l.producto} · ${modo} · Bruto ${toNum(l.bruto)}kg · Tara ${toNum(l.taraKg)}kg · Neto ${toNum(l.neto)}kg · ${fmtEuro(l.precio)} · Importe ${fmtEuro(l.importe)}`;
      }
      return `• ${l.producto} · ${modo} · Cant ${toNum(l.cantidad)} · ${fmtEuro(l.precio)} · Importe ${fmtEuro(l.importe)}`;
    }).join('\n');

    const tot = [
      `Subtotal: ${fmtEuro(F.totals.subtotal)}`,
      F.transporteOn ? `Transporte (${toNum(F.transportePct)}%): ${fmtEuro(F.totals.transporte)}` : '',
      F.ivaIncluido ? `IVA: incluido` : `IVA (${toNum(F.ivaPct)}%): ${fmtEuro(F.totals.iva)}`,
      `TOTAL: *${fmtEuro(F.totals.total)}*`,
      `Pagado: ${fmtEuro(F.totals.pagado)} · Pendiente: *${fmtEuro(F.totals.pendiente)}*`
    ].filter(Boolean).join('\n');

    return `${head}\n\n${body}\n\n${tot}`.trim();
  }

  function FACTU_whatsapp(){
    // asegura totales
    recalcFacturaTotals();
    const txt = buildWhatsAppText();

    const out = $(IDS.waOut);
    if (out) out.value = txt;

    // copiar + abrir enlace
    navigator.clipboard.writeText(txt).then(() => {
      toast('WhatsApp: texto copiado');
      const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
      window.open(url, '_blank');
    }).catch(() => {
      toast('No se pudo copiar. Abriendo WhatsApp…');
      const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
      window.open(url, '_blank');
    });
  }

  /* =========================
     EXPOSE FUNCTIONS (para 3A botones)
  ========================= */
  window.FACTU_nuevaFactura = FACTU_nuevaFactura;
  window.FACTU_duplicarFactura = FACTU_duplicarFactura;
  window.FACTU_eliminarFactura = FACTU_eliminarFactura;
  window.FACTU_guardarFactura = FACTU_guardarFactura;
  window.FACTU_addLinea = FACTU_addLinea;
  window.FACTU_loadFacturaById = FACTU_loadFacturaById;

  window.FACTU_renderFacturas = FACTU_renderFacturas;
  window.FACTU_renderClientes = FACTU_renderClientes;
  window.FACTU_renderProductos = FACTU_renderProductos;
  window.FACTU_renderTaras = FACTU_renderTaras;

  window.FACTU_whatsapp = FACTU_whatsapp;

  /* =========================
     WIRE TABS RENDERS (safe)
  ========================= */
  // Entra aquí cuando cambias tab (3A lo llama)
  // Solo aseguramos que existan inputs/handlers y render
  function init3B(){
    // factura UI
    bindFacturaUI();

    // listados
    wireFacturasSearch();
    wireClientesTab();
    wireProductosTab();
    wireTarasTab();

    // render inicial de listados si tab cambia
    if ($('#tabFacturas')) FACTU_renderFacturas();
    if ($('#tabClientes')) FACTU_renderClientes();
    if ($('#tabProductos')) FACTU_renderProductos();
    if ($('#tabTaras')) FACTU_renderTaras();

    // Botón opcional de copiar whatsapp si existe
    on($(IDS.btnWhatsappCopy), 'click', () => {
      const txt = buildWhatsAppText();
      navigator.clipboard.writeText(txt).then(() => toast('Texto copiado')).catch(() => toast('No se pudo copiar'));
    });

    // Si hay datos previos en selector cliente, aplicarlos
    const sel = $(IDS.selCliente);
    if (sel && sel.value && !F.clienteId) {
      F.clienteId = sel.value;
      const c = findClienteById(F.clienteId);
      if (c) F.clienteSnap = { nombre:c.nombre||'', nif:c.nif||'', dir:c.dir||'', tel:c.tel||'', email:c.email||'', pago:c.pago||'' };
    }

    // Recalcular y QR
    F.lineas.forEach(recalcLinea);
    recalcFacturaTotals();
    renderQrOnScreen();
  }

  // run
  try { init3B(); } catch(e){ console.error(e); }

})(); // end 3B
/* =========================================================
PARTE 3C/5 — FACTU MIRAL (B/W PRO)
Archivo: app.js  (PEGAR 3A + 3B + 3C EN ORDEN, SIN CAMBIAR)
- 3C: PDF PRO (multipágina + visor interno) + QR en PDF (si OK) + Contabilidad PIN + Ventas Diarias PIN
      + Ajustes (IVA/Transporte/PIN/QR/Cloud) + Cloud Firebase opcional (no crash) + Atajos teclado PRO
========================================================= */

(() => {
  'use strict';

  const S = window.FACTU_STATE;
  const U = window.FACTU_UTILS;
  if (!S || !U) return;

  const {
    $, $$, on, uid, toNum, round2, fmtEuro, isoToday, ddmmyyyy, dayNameES,
    save, toast, openModal, closeModal, setActiveTab
  } = U;

  // Active invoice reference (shared with 3B)
  const getF = () => (S._activeFactura || null);

  /* =========================
     SAFE DOM HELPERS
  ========================= */
  const val = (sel) => String($(sel)?.value ?? '');
  const setVal = (sel, v) => { const el = $(sel); if (el) el.value = (v ?? ''); };
  const setText = (sel, t) => { const el = $(sel); if (el) el.textContent = (t ?? ''); };
  const setHtml = (sel, h) => { const el = $(sel); if (el) el.innerHTML = (h ?? ''); };
  const show = (sel) => { const el = $(sel); if (el) el.style.display = ''; };
  const hide = (sel) => { const el = $(sel); if (el) el.style.display = 'none'; };

  const esc = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  /* =========================
     PERSIST KEYS
  ========================= */
  const K = {
    AJUSTES: 'factu_miral_ajustes_v1',
    FACTURAS: 'factu_miral_facturas_v1',
    CLIENTES: 'factu_miral_clientes_v1',
    PRODUCTOS: 'factu_miral_productos_v1',
    TARAS: 'factu_miral_taras_v1',
    VENTAS: 'factu_miral_ventas_v1'
  };

  /* =========================
     AJUSTES — load/save wrappers
  ========================= */
  function getPin(){
    return String(S.ajustes?.pin || '8410');
  }
  function isPinOk(pin){
    return String(pin || '') === getPin();
  }

  function ensureVentasLoaded(){
    if (!Array.isArray(S.ventas)) {
      try {
        S.ventas = JSON.parse(localStorage.getItem(K.VENTAS) || '[]') || [];
      } catch {
        S.ventas = [];
      }
    }
  }

  /* =========================
     QR — dataURL generator (for PDF) (safe)
     RULE: if fails, DO NOT include QR in PDF.
  ========================= */
  function buildQrTextForFactura(F){
    const nif = String(S.ajustes?.proveedor?.nif || '').trim();
    const num = String(F?.num || '').trim();
    const fecha = ddmmyyyy(F?.fecha || '');
    const total = fmtEuro(toNum(F?.totals?.total || 0));

    const tpl = String(S.ajustes?.qrPlantilla || 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}');
    const txt = tpl
      .replaceAll('{NIF}', nif)
      .replaceAll('{NUM}', num)
      .replaceAll('{FECHA}', fecha)
      .replaceAll('{TOTAL}', total);

    return txt;
  }

  function canMakeQr(F){
    const nif = String(S.ajustes?.proveedor?.nif || '').trim();
    return !!(nif && F?.num && F?.fecha && (toNum(F?.totals?.total) > 0));
  }

  function qrDataUrlFromText(txt){
    // Try qrcode-generator (window.qrcode) -> canvas -> dataURL
    try {
      if (!txt) return null;
      if (typeof window.qrcode !== 'function') return null;

      const qr = window.qrcode(0, 'M');
      qr.addData(txt);
      qr.make();

      const count = qr.getModuleCount();
      const size = 180; // px
      const cell = Math.floor(size / count) || 3;
      const canvas = document.createElement('canvas');
      canvas.width = cell * count;
      canvas.height = cell * count;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);

      for (let r=0;r<count;r++){
        for (let c=0;c<count;c++){
          ctx.fillStyle = qr.isDark(r,c) ? '#111' : '#fff';
          ctx.fillRect(c*cell, r*cell, cell, cell);
        }
      }
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /* =========================
     PDF PRO — jsPDF + autoTable if available
     - multi-page, "Suma y sigue"
     - page numbering "Página X/Y"
     - QR in PDF only if QR creation succeeds (rule)
  ========================= */
  function lineasValidas(F){
    const arr = Array.isArray(F?.lineas) ? F.lineas : [];
    return arr.filter(l => String(l.producto||'').trim() && (toNum(l.importe) > 0 || toNum(l.cantidad)>0 || toNum(l.bruto)>0));
  }

  function makePdfFilename(F){
    const n = String(F?.num || 'FACTURA').replaceAll('/','-').replaceAll('\\','-');
    return `${n}.pdf`;
  }

  function getProveedorSnap(F){
    return F?.proveedorSnap || S.ajustes?.proveedor || {};
  }

  function getClienteSnap(F){
    return F?.clienteSnap || {};
  }

  function ensureTotals(F){
    // 3B recalcula siempre, pero por seguridad:
    if (!F.totals) F.totals = { subtotal:0, transporte:0, iva:0, total:0, pagado:0, pendiente:0 };
  }

  function generatePdfBlob(F){
    ensureTotals(F);

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
      toast('PDF: falta jsPDF en index');
      return null;
    }

    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // theme: B/W PRO
    const M = 12;        // margin
    const headerH = 34;
    const y0 = M;

    // QR
    const qrTxt = buildQrTextForFactura(F);
    let qrDataUrl = null;
    if (canMakeQr(F)) {
      qrDataUrl = qrDataUrlFromText(qrTxt); // may be null
    }

    // header blocks
    const prov = getProveedorSnap(F);
    const cli = getClienteSnap(F);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FACTURA', M, y0 + 7);

    // logo (simple cherry icon placeholder in B/W) - vector-ish
    // (No external image needed; simple circle pair + stem)
    try{
      const cx = W - M - 18;
      const cy = y0 + 7;
      doc.setDrawColor(20);
      doc.setFillColor(240);
      doc.circle(cx, cy, 4, 'F');
      doc.circle(cx+7, cy+1.5, 4, 'F');
      doc.setDrawColor(20);
      doc.line(cx+1.5, cy-4, cx+4, cy-10);
      doc.line(cx+8.5, cy-2.5, cx+4, cy-10);
    }catch{}

    // Invoice meta (right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(F.num||''), W - M, y0 + 7, { align:'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${ddmmyyyy(F.fecha)} (${dayNameES(F.fecha)})`, W - M, y0 + 12, { align:'right' });

    // Big header panel background
    doc.setDrawColor(30);
    doc.setFillColor(245);
    doc.roundedRect(M, y0 + 14, W - 2*M, headerH, 3, 3, 'F');

    // Provider (left)
    const px = M + 4;
    const py = y0 + 19;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Proveedor', px, py);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const provLines = [
      String(prov.nombre||''),
      String(prov.nif||''),
      String(prov.dir||''),
      String(prov.tel||''),
      String(prov.email||'')
    ].filter(Boolean);
    doc.text(provLines, px, py + 5);

    // Client (right)
    const cx = W - M - 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Cliente', cx, py, { align:'right' });
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const cliLines = [
      String(cli.nombre||''),
      String(cli.nif||''),
      String(cli.dir||''),
      String(cli.tel||''),
      String(cli.email||'')
    ].filter(Boolean);
    doc.text(cliLines, cx, py + 5, { align:'right' });

    // QR center
    const qBoxW = 30;
    const qBoxX = (W/2) - (qBoxW/2);
    const qBoxY = y0 + 19;
    doc.setDrawColor(30);
    doc.setFillColor(255);
    doc.roundedRect(qBoxX, qBoxY, qBoxW, qBoxW, 2, 2, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text('QR', W/2, qBoxY - 2, { align:'center' });

    // Include QR ONLY if we have a valid dataURL (rule)
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, 'PNG', qBoxX+2, qBoxY+2, qBoxW-4, qBoxW-4);
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
        // small text line under QR for fallback
        const small = (qrTxt || '').toString();
        const clipped = small.length > 44 ? (small.slice(0,44) + '…') : small;
        doc.text(clipped, W/2, qBoxY + qBoxW + 3, { align:'center' });
      } catch {
        // if addImage fails, we keep QR empty (rule)
      }
    } else {
      // QR not available => nothing printed (rule)
    }

    // After header
    let y = y0 + 14 + headerH + 8;

    // Tags / Observaciones brief
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    if (String(F.tags||'').trim()) {
      doc.text(`Tags: ${String(F.tags||'').trim()}`, M, y);
      y += 5;
    }
    if (String(F.obs||'').trim()) {
      const obs = String(F.obs||'').trim();
      const lines = doc.splitTextToSize(`Observaciones: ${obs}`, W - 2*M);
      doc.text(lines, M, y);
      y += (lines.length * 4) + 2;
    }

    // Table rows
    const rows = lineasValidas(F).map(l => ([
      String(l.producto||''),
      String((l.modo||'').toUpperCase()),
      num2(l.cantidad),
      num2(l.bruto),
      num2(l.taraKg),
      num2(l.neto),
      fmtEuro(toNum(l.precio)),
      String(l.origen||''),
      fmtEuro(toNum(l.importe))
    ]));

    const head = [[
      'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe'
    ]];

    const hasAutoTable = !!doc.autoTable;

    if (hasAutoTable) {
      doc.autoTable({
        startY: y,
        head,
        body: rows.length ? rows : [['—','—','—','—','—','—','—','—','—']],
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          textColor: 20,
          lineColor: 40,
          lineWidth: 0.1,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [15,15,15],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [245,245,245] },
        columnStyles: {
          0: { cellWidth: 44 },
          1: { cellWidth: 12 },
          2: { cellWidth: 12, halign:'right' },
          3: { cellWidth: 14, halign:'right' },
          4: { cellWidth: 14, halign:'right' },
          5: { cellWidth: 14, halign:'right' },
          6: { cellWidth: 18, halign:'right' },
          7: { cellWidth: 25 },
          8: { cellWidth: 18, halign:'right' }
        },
        didDrawPage: (data) => {
          // Footer per page (page numbering later)
          const page = doc.internal.getNumberOfPages();
          doc.setFont('helvetica','normal');
          doc.setFontSize(8);
          doc.setTextColor(60);
          doc.text('Factu Miral — B/W PRO', M, H - 8);
          doc.text(`Página ${page}`, W - M, H - 8, { align:'right' });
          doc.setTextColor(20);

          // "Suma y sigue" if not last page will be added after table by checking later (simple)
        }
      });

      y = doc.lastAutoTable.finalY + 8;
    } else {
      // Fallback simple table (no autotable)
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text('Líneas', M, y); y += 4;
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      const maxRowsPerPage = 28;
      let r = 0;
      while (r < rows.length) {
        if (y > H - 30) { doc.addPage(); y = M; }
        const chunk = rows.slice(r, r + maxRowsPerPage);
        chunk.forEach(rr => {
          const line = `${rr[0]} | ${rr[1]} | Cant ${rr[2]} | Br ${rr[3]} | Ta ${rr[4]} | Ne ${rr[5]} | ${rr[6]} | ${rr[7]} | ${rr[8]}`;
          const lines = doc.splitTextToSize(line, W - 2*M);
          doc.text(lines, M, y);
          y += lines.length * 3.6;
        });
        r += maxRowsPerPage;
        if (r < rows.length) {
          doc.setFont('helvetica','bold');
          doc.text('SUMA Y SIGUE…', M, H - 12);
          doc.setFont('helvetica','normal');
          doc.addPage();
          y = M;
        }
      }
      y += 6;
    }

    // Totals box
    if (y > H - 55) { doc.addPage(); y = M; }
    doc.setDrawColor(30);
    doc.setFillColor(245);
    doc.roundedRect(M, y, W - 2*M, 34, 3, 3, 'F');

    const txL = M + 4;
    const txR = W - M - 4;
    let ty = y + 7;

    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Totales', txL, ty);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);

    ty += 6;
    doc.text('Subtotal', txL, ty);
    doc.text(fmtEuro(F.totals.subtotal), txR, ty, { align:'right' });

    ty += 5;
    if (F.transporteOn) {
      doc.text(`Transporte (${toNum(F.transportePct)}%)`, txL, ty);
      doc.text(fmtEuro(F.totals.transporte), txR, ty, { align:'right' });
      ty += 5;
    }

    if (F.ivaIncluido) {
      doc.text('IVA', txL, ty);
      doc.text('Incluido', txR, ty, { align:'right' });
      ty += 5;
    } else {
      doc.text(`IVA (${toNum(F.ivaPct)}%)`, txL, ty);
      doc.text(fmtEuro(F.totals.iva), txR, ty, { align:'right' });
      ty += 5;
    }

    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('TOTAL', txL, ty);
    doc.text(fmtEuro(F.totals.total), txR, ty, { align:'right' });

    // Pagos / Pendiente
    ty += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(`Pagado: ${fmtEuro(F.totals.pagado)} · Pendiente: ${fmtEuro(F.totals.pendiente)}`, txL, ty);

    // Footer message
    const footer = F.ivaIncluido
      ? 'IVA incluido en los precios.'
      : 'IVA desglosado según configuración.';
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(footer, M, H - 14);
    doc.setTextColor(20);

    // Final page numbering "Página X/Y"
    const totalPages = doc.internal.getNumberOfPages();
    for (let p=1; p<=totalPages; p++){
      doc.setPage(p);
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.setTextColor(60);
      doc.text(`Página ${p}/${totalPages}`, W - M, H - 8, { align:'right' });
      doc.setTextColor(20);
    }

    // Blob
    const blob = doc.output('blob');
    return blob;

    function num2(n){
      const x = toNum(n);
      return x ? String(x).replace('.',',') : '';
    }
  }

  /* =========================
     PDF VIEWER (internal, no download)
     - modal with iframe/object
     - close / print / open tab / share
  ========================= */
  let _lastPdfUrl = '';

  function revokeLastPdfUrl(){
    try { if (_lastPdfUrl) URL.revokeObjectURL(_lastPdfUrl); } catch {}
    _lastPdfUrl = '';
  }

  function FACTU_generarPDF(){
    const F = getF();
    if (!F) { toast('No hay factura'); return; }

    const blob = generatePdfBlob(F);
    if (!blob) return;

    revokeLastPdfUrl();
    const url = URL.createObjectURL(blob);
    _lastPdfUrl = url;

    // Save last URL on invoice model (local only). Cloud uses 3C cloud functions.
    F.pdfLocalUrl = url;

    // Also provide download fallback if button exists
    const a = $('#pdfDownloadLink');
    if (a) {
      a.href = url;
      a.download = makePdfFilename(F);
    }

    toast('PDF generado');
    return { blob, url };
  }

  function FACTU_verPDF(){
    const F = getF();
    if (!F) { toast('No hay factura'); return; }

    // Ensure we have a fresh PDF
    const out = FACTU_generarPDF();
    if (!out?.url) return;

    const frame = $('#pdfFrame');
    const obj = $('#pdfObject');
    const area = $('#pdfViewerArea');

    if (frame) frame.src = out.url;
    if (obj) obj.data = out.url;

    // prefer iframe if exists else object
    if (area) {
      // do nothing; area is container
    }

    openModal('#modalPdf');

    // wire buttons once
    if (!FACTU_verPDF._wired) {
      FACTU_verPDF._wired = true;

      on($('#btnPdfClose'), 'click', () => { closeModal('#modalPdf'); });
      on($('#btnPdfPrint'), 'click', () => {
        const fr = $('#pdfFrame');
        try { fr?.contentWindow?.print?.(); } catch { window.open(_lastPdfUrl || '', '_blank'); }
      });
      on($('#btnPdfOpenTab'), 'click', () => {
        if (_lastPdfUrl) window.open(_lastPdfUrl, '_blank');
      });
      on($('#btnPdfShare'), 'click', async () => {
        if (!_lastPdfUrl) return;
        try {
          if (navigator.share) {
            const F2 = getF();
            const fn = makePdfFilename(F2);
            const res = await fetch(_lastPdfUrl);
            const b = await res.blob();
            const file = new File([b], fn, { type:'application/pdf' });
            await navigator.share({ title: fn, text: `Factura ${F2?.num || ''}`, files: [file] });
          } else {
            toast('Compartir no disponible en este dispositivo');
          }
        } catch {
          toast('No se pudo compartir');
        }
      });
    }
  }

  /* =========================
     CLOUD (Firebase) — OPTIONAL, NO CRASH
     - Only runs if firebase SDK is present + config filled.
  ========================= */
  function isFirebaseSdkPresent(){
    return !!window.firebase;
  }

  function isFirebaseConfigured(){
    const c = S.ajustes?.cloud || {};
    const keys = ['apiKey','authDomain','databaseURL','projectId','appId'];
    return keys.every(k => String(c[k]||'').trim());
  }

  function firebaseInitSafe(){
    try{
      if (!isFirebaseSdkPresent()) return null;
      if (!isFirebaseConfigured()) return null;

      if (!S._fbApp) {
        const c = S.ajustes.cloud;
        // compat API support
        if (window.firebase.initializeApp) {
          S._fbApp = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(c);
        }
      }
      return S._fbApp || null;
    } catch {
      return null;
    }
  }

  async function cloudUploadPdfSafe(blob, F){
    try{
      const app = firebaseInitSafe();
      if (!app) return null;

      // Storage optional
      const fb = window.firebase;
      const storage = fb.storage?.();
      if (!storage) return null;

      const fn = makePdfFilename(F);
      const path = `factu_miral/pdfs/${String(S._cloudUserId||'public')}/${fn}`;
      const ref = storage.ref().child(path);
      const snap = await ref.put(blob);
      const url = await snap.ref.getDownloadURL();
      return url;
    } catch {
      return null;
    }
  }

  async function FACTU_pdfToCloud(){
    const F = getF();
    if (!F) { toast('No hay factura'); return; }
    if (!isFirebaseSdkPresent()) { toast('Cloud: Firebase no cargado'); return; }
    if (!isFirebaseConfigured()) { toast('Cloud: falta configurar ajustes'); return; }

    const out = FACTU_generarPDF();
    if (!out?.blob) return;

    toast('Subiendo a nube…');
    const url = await cloudUploadPdfSafe(out.blob, F);
    if (url) {
      F.pdfUrl = url;
      // persist invoice
      const idx = (S.facturas||[]).findIndex(x => x.id === F.id);
      if (idx >= 0) {
        S.facturas[idx] = { ...S.facturas[idx], pdfUrl: url };
        save(K.FACTURAS, S.facturas);
      }
      toast('PDF subido a nube');
      if (typeof window.FACTU_renderFacturas === 'function') window.FACTU_renderFacturas();
    } else {
      toast('No se pudo subir (Storage no disponible o error)');
    }
  }

  /* =========================
     CONTABILIDAD (PIN) — KPIs + filtros + export CSV
  ========================= */
  function contabilidadLocked(){
    return !S._contaUnlocked;
  }

  function lockContabilidad(){
    S._contaUnlocked = false;
    renderContabilidad();
  }

  function unlockContabilidad(pin){
    if (!isPinOk(pin)) { toast('PIN incorrecto'); return; }
    S._contaUnlocked = true;
    toast('Contabilidad desbloqueada');
    renderContabilidad();
  }

  function facturaMatchesFilters(f, fDesde, fHasta, clienteId, tagTxt){
    const fecha = String(f.fecha||'');
    if (fDesde && fecha < fDesde) return false;
    if (fHasta && fecha > fHasta) return false;
    if (clienteId && String(f.clienteId||'') !== String(clienteId)) return false;
    if (tagTxt) {
      const tags = String(f.tags||'').toLowerCase();
      if (!tags.includes(String(tagTxt||'').toLowerCase().trim())) return false;
    }
    return true;
  }

  function computeKPIs(facts){
    let ventas = 0, iva = 0, margen = 0, n = 0;
    for (const f of facts) {
      n++;
      ventas += toNum(f?.totals?.total);
      iva += (f.ivaIncluido ? 0 : toNum(f?.totals?.iva));
      // margen: si hay coste en producto
      let m = 0;
      for (const l of (f.lineas||[])) {
        const prod = (S.productos||[]).find(p => p.id === l.productoId) || null;
        const coste = toNum(prod?.coste);
        if (!(coste > 0)) continue;

        if (l.modo === 'kg') m += (toNum(l.neto) * (toNum(l.precio) - coste));
        else m += (toNum(l.cantidad) * (toNum(l.precio) - coste));
      }
      margen += m;
    }
    return {
      ventas: round2(ventas),
      iva: round2(iva),
      margen: round2(margen),
      nFacturas: n
    };
  }

  function groupByMonth(facts){
    const map = new Map();
    for (const f of facts) {
      const d = String(f.fecha||'');
      const key = d.slice(0,7); // YYYY-MM
      map.set(key, (map.get(key)||0) + toNum(f?.totals?.total));
    }
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }

  function topByCliente(facts, topN=8){
    const map = new Map();
    for (const f of facts) {
      const key = String(f.clienteSnap?.nombre||'—');
      map.set(key, (map.get(key)||0) + toNum(f?.totals?.total));
    }
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,topN);
  }

  function topByProducto(facts, topN=10){
    const map = new Map();
    for (const f of facts) {
      for (const l of (f.lineas||[])) {
        const name = String(l.producto||'—');
        if (!name.trim()) continue;
        map.set(name, (map.get(name)||0) + toNum(l.importe));
      }
    }
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,topN);
  }

  function pendientesDeCobro(facts){
    const arr = facts
      .filter(f => toNum(f?.totals?.pendiente) > 0.01)
      .map(f => ({
        num: f.num,
        fecha: f.fecha,
        cliente: f.clienteSnap?.nombre||'',
        pendiente: toNum(f?.totals?.pendiente),
        total: toNum(f?.totals?.total),
        tags: f.tags||'',
        id: f.id
      }))
      .sort((a,b)=>b.pendiente-a.pendiente);
    return arr;
  }

  function exportCsvContabilidad(facts){
    const rows = [];
    rows.push(['fecha','num','cliente','total','iva','pendiente','tags'].join(';'));
    for (const f of facts) {
      const fecha = ddmmyyyy(f.fecha);
      const total = round2(toNum(f?.totals?.total));
      const iva = f.ivaIncluido ? 0 : round2(toNum(f?.totals?.iva));
      const pend = round2(toNum(f?.totals?.pendiente));
      const tags = String(f.tags||'').replaceAll(';',',');
      rows.push([fecha, f.num, String(f.clienteSnap?.nombre||'').replaceAll(';',','), total, iva, pend, tags].join(';'));
    }
    return rows.join('\n');
  }

  function downloadTextFile(filename, text){
    const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function renderContabilidad(){
    const box = $('#contaBox');
    if (!box) return;

    if (contabilidadLocked()) {
      setHtml('#contaBox', `
        <div class="panel">
          <div class="hTitle">Contabilidad 🔒</div>
          <div class="muted small">Introduce PIN para desbloquear.</div>
          <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <input id="contaPinInput" type="password" inputmode="numeric" placeholder="PIN" style="max-width:160px"/>
            <button class="btn" id="btnContaUnlock">Desbloquear</button>
          </div>
        </div>
      `);
      on($('#btnContaUnlock'), 'click', () => unlockContabilidad(val('#contaPinInput')));
      on($('#contaPinInput'), 'keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); unlockContabilidad(val('#contaPinInput')); }
      });
      return;
    }

    const desde = val('#contaDesde');
    const hasta = val('#contaHasta');
    const clienteId = val('#contaCliente');
    const tag = val('#contaTag').trim();

    const factsAll = (S.facturas || []).slice();
    const facts = factsAll.filter(f => facturaMatchesFilters(f, desde, hasta, clienteId, tag));

    const kpi = computeKPIs(facts);
    const byMonth = groupByMonth(facts);
    const topCli = topByCliente(facts, 8);
    const topProd = topByProducto(facts, 10);
    const pend = pendientesDeCobro(factsAll); // pendientes global (más útil)

    // table results
    const rows = facts
      .slice()
      .sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')) || String(b.num||'').localeCompare(String(a.num||'')))
      .map(f => `
        <tr>
          <td>${esc(ddmmyyyy(f.fecha))}</td>
          <td><a href="#" data-openfact="${esc(f.id)}">${esc(f.num)}</a></td>
          <td>${esc(f.clienteSnap?.nombre||'')}</td>
          <td style="text-align:right"><b>${fmtEuro(toNum(f?.totals?.total))}</b></td>
          <td style="text-align:right">${f.ivaIncluido ? 'incl.' : fmtEuro(toNum(f?.totals?.iva))}</td>
          <td style="text-align:right">${fmtEuro(toNum(f?.totals?.pendiente))}</td>
          <td>${esc(f.tags||'')}</td>
        </tr>
      `).join('');

    setHtml('#contaBox', `
      <div class="panel">
        <div class="row" style="justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <div class="hTitle">Contabilidad</div>
            <div class="muted small">Filtros + KPIs + dashboard mensual + export.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btnGhost" id="btnContaLock">Bloquear 🔒</button>
            <button class="btn" id="btnContaExport">Exportar CSV</button>
          </div>
        </div>

        <div class="grid2" style="margin-top:12px;">
          <div class="card">
            <div class="cardTitle">KPIs</div>
            <div class="totRow"><span>Ventas</span><b>${fmtEuro(kpi.ventas)}</b></div>
            <div class="totRow"><span>IVA</span><b>${fmtEuro(kpi.iva)}</b></div>
            <div class="totRow"><span>Nº facturas</span><b>${kpi.nFacturas}</b></div>
            <div class="totRow"><span>Margen (si coste)</span><b>${fmtEuro(kpi.margen)}</b></div>
          </div>

          <div class="card">
            <div class="cardTitle">Dashboard mensual</div>
            <div class="muted small">Ventas por mes (según filtros)</div>
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
              ${byMonth.length ? byMonth.map(([m,v]) => `
                <div class="totRow"><span>${esc(m)}</span><b>${fmtEuro(v)}</b></div>
              `).join('') : `<div class="muted small">Sin datos.</div>`}
            </div>
          </div>
        </div>

        <div class="grid2" style="margin-top:12px;">
          <div class="card">
            <div class="cardTitle">Top clientes</div>
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
              ${topCli.length ? topCli.map(([n,v]) => `
                <div class="totRow"><span>${esc(n)}</span><b>${fmtEuro(v)}</b></div>
              `).join('') : `<div class="muted small">Sin datos.</div>`}
            </div>
          </div>

          <div class="card">
            <div class="cardTitle">Top productos</div>
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
              ${topProd.length ? topProd.map(([n,v]) => `
                <div class="totRow"><span>${esc(n)}</span><b>${fmtEuro(v)}</b></div>
              `).join('') : `<div class="muted small">Sin datos.</div>`}
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div class="cardTitle">Pendientes de cobro (global)</div>
          ${pend.length ? `
            <div class="tableWrap" style="margin-top:8px; overflow:auto;">
              <table class="tbl">
                <thead>
                  <tr><th>Fecha</th><th>Nº</th><th>Cliente</th><th style="text-align:right">Pendiente</th><th style="text-align:right">Total</th><th>Tags</th></tr>
                </thead>
                <tbody>
                  ${pend.slice(0,25).map(p => `
                    <tr>
                      <td>${esc(ddmmyyyy(p.fecha))}</td>
                      <td><a href="#" data-openfact="${esc(p.id)}">${esc(p.num)}</a></td>
                      <td>${esc(p.cliente)}</td>
                      <td style="text-align:right"><b>${fmtEuro(p.pendiente)}</b></td>
                      <td style="text-align:right">${fmtEuro(p.total)}</td>
                      <td>${esc(p.tags)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="muted small" style="margin-top:8px">Mostrando 25 mayores pendientes.</div>
            </div>
          ` : `<div class="muted small">Sin pendientes.</div>`}
        </div>

        <div class="card" style="margin-top:12px;">
          <div class="cardTitle">Resultados</div>
          <div class="tableWrap" style="margin-top:8px; overflow:auto;">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Nº</th><th>Cliente</th>
                  <th style="text-align:right">Total</th>
                  <th style="text-align:right">IVA</th>
                  <th style="text-align:right">Pendiente</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="7" class="muted small">Sin facturas.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>
    `);

    on($('#btnContaLock'), 'click', () => lockContabilidad());
    on($('#btnContaExport'), 'click', () => {
      const csv = exportCsvContabilidad(facts);
      const name = `contabilidad_${(desde||'all')}_${(hasta||'all')}.csv`.replaceAll('/','-');
      downloadTextFile(name, csv);
      toast('CSV exportado');
    });

    $$('[data-openfact]').forEach(a => {
      on(a, 'click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('data-openfact');
        if (typeof window.FACTU_loadFacturaById === 'function') {
          window.FACTU_loadFacturaById(id);
          setActiveTab('tabFactura');
        }
      });
    });
  }

  function wireContabilidadFilters(){
    // if these inputs exist, render on changes
    ['#contaDesde','#contaHasta','#contaCliente','#contaTag'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      on(el, 'input', () => renderContabilidad());
      on(el, 'change', () => renderContabilidad());
    });
    on($('#btnContaUnlockInline'), 'click', () => unlockContabilidad(val('#contaPinInline')));
  }

  /* =========================
     VENTAS DIARIAS (PIN) — San Pablo / San Lesmes / Santiago
     - efectivo + tarjeta + total + gastos
     - reportes diario / semanal / mensual / rango
  ========================= */
  function ventasLocked(){
    return !S._ventasUnlocked;
  }

  function unlockVentas(pin){
    if (!isPinOk(pin)) { toast('PIN incorrecto'); return; }
    S._ventasUnlocked = true;
    toast('Ventas desbloqueadas');
    renderVentas();
  }

  function lockVentas(){
    S._ventasUnlocked = false;
    renderVentas();
  }

  function weekKeyISO(dateIso){
    // ISO week key: YYYY-Www
    // minimal ISO week calc
    const d = new Date(dateIso + 'T00:00:00');
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day + 3); // Thursday
    const firstThu = new Date(Date.UTC(d.getUTCFullYear(),0,4));
    const firstDay = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
    const week = 1 + Math.round((d - firstThu) / (7*24*3600*1000));
    const y = d.getUTCFullYear();
    return `${y}-W${String(week).padStart(2,'0')}`;
  }

  function ventasInRange(desde, hasta, tienda){
    ensureVentasLoaded();
    let arr = S.ventas.slice();
    if (desde) arr = arr.filter(v => String(v.fecha||'') >= desde);
    if (hasta) arr = arr.filter(v => String(v.fecha||'') <= hasta);
    if (tienda && tienda !== 'ALL') arr = arr.filter(v => String(v.tienda||'') === tienda);
    arr.sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));
    return arr;
  }

  function ventasKPIs(arr){
    let ef=0, ta=0, ga=0, n=0;
    for (const v of arr){
      n++;
      ef += toNum(v.efectivo);
      ta += toNum(v.tarjeta);
      ga += toNum(v.gastos);
    }
    const tot = ef + ta;
    return {
      n,
      efectivo: round2(ef),
      tarjeta: round2(ta),
      total: round2(tot),
      gastos: round2(ga),
      neto: round2(tot - ga)
    };
  }

  function groupVentas(arr, mode){
    const map = new Map();
    for (const v of arr){
      const key = mode === 'week'
        ? weekKeyISO(v.fecha)
        : (mode === 'month' ? String(v.fecha||'').slice(0,7) : String(v.fecha||''));
      const prev = map.get(key) || { efectivo:0, tarjeta:0, gastos:0, n:0 };
      prev.efectivo += toNum(v.efectivo);
      prev.tarjeta += toNum(v.tarjeta);
      prev.gastos += toNum(v.gastos);
      prev.n += 1;
      map.set(key, prev);
    }
    const out = Array.from(map.entries()).map(([k,o]) => ({
      key:k,
      n:o.n,
      efectivo: round2(o.efectivo),
      tarjeta: round2(o.tarjeta),
      total: round2(o.efectivo + o.tarjeta),
      gastos: round2(o.gastos),
      neto: round2((o.efectivo + o.tarjeta) - o.gastos)
    }));
    out.sort((a,b)=>b.key.localeCompare(a.key));
    return out;
  }

  function renderVentas(){
    const box = $('#ventasBox');
    if (!box) return;

    ensureVentasLoaded();

    if (ventasLocked()){
      setHtml('#ventasBox', `
        <div class="panel">
          <div class="hTitle">Ventas diarias 🔒</div>
          <div class="muted small">SAN PABLO · SAN LESMES · SANTIAGO</div>
          <div class="muted small" style="margin-top:6px">Introduce PIN para desbloquear.</div>
          <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
            <input id="ventasPinInput" type="password" inputmode="numeric" placeholder="PIN" style="max-width:160px"/>
            <button class="btn" id="btnVentasUnlock">Desbloquear</button>
          </div>
        </div>
      `);
      on($('#btnVentasUnlock'), 'click', () => unlockVentas(val('#ventasPinInput')));
      on($('#ventasPinInput'), 'keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); unlockVentas(val('#ventasPinInput')); }
      });
      return;
    }

    const desde = val('#ventasDesde');
    const hasta = val('#ventasHasta');
    const tienda = val('#ventasTienda') || 'ALL';

    const arr = ventasInRange(desde, hasta, tienda);
    const kpi = ventasKPIs(arr);

    const byDay = groupVentas(arr, 'day');
    const byWeek = groupVentas(arr, 'week');
    const byMonth = groupVentas(arr, 'month');

    setHtml('#ventasBox', `
      <div class="panel">
        <div class="row" style="justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <div class="hTitle">Ventas diarias</div>
            <div class="muted small">Reporte por fecha, semanal, mensual y rango.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btnGhost" id="btnVentasLock">Bloquear 🔒</button>
            <button class="btn" id="btnVentaNueva">+ Nueva venta</button>
          </div>
        </div>

        <div class="grid2" style="margin-top:12px;">
          <div class="card">
            <div class="cardTitle">KPIs (según filtros)</div>
            <div class="totRow"><span>Registros</span><b>${kpi.n}</b></div>
            <div class="totRow"><span>Efectivo</span><b>${fmtEuro(kpi.efectivo)}</b></div>
            <div class="totRow"><span>Tarjeta</span><b>${fmtEuro(kpi.tarjeta)}</b></div>
            <div class="totRow"><span>Total</span><b>${fmtEuro(kpi.total)}</b></div>
            <div class="totRow"><span>Gastos</span><b>${fmtEuro(kpi.gastos)}</b></div>
            <div class="totRow"><span>Neto</span><b>${fmtEuro(kpi.neto)}</b></div>
          </div>

          <div class="card">
            <div class="cardTitle">Resumen rápido</div>
            <div class="muted small">Últimos 7 días (según tienda/filtros)</div>
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
              ${(byDay.slice(0,7)).map(r => `
                <div class="totRow">
                  <span>${esc(ddmmyyyy(r.key))} (${esc(dayNameES(r.key))})</span>
                  <b>${fmtEuro(r.total)}</b>
                </div>
              `).join('') || `<div class="muted small">Sin datos.</div>`}
            </div>
          </div>
        </div>

        <div class="grid3" style="margin-top:12px;">
          <div class="card">
            <div class="cardTitle">Diario</div>
            <div class="tableWrap" style="margin-top:8px; overflow:auto;">
              <table class="tbl">
                <thead><tr><th>Fecha</th><th style="text-align:right">Efectivo</th><th style="text-align:right">Tarjeta</th><th style="text-align:right">Total</th><th style="text-align:right">Gastos</th><th style="text-align:right">Neto</th></tr></thead>
                <tbody>
                  ${byDay.map(r => `
                    <tr>
                      <td>${esc(ddmmyyyy(r.key))}</td>
                      <td style="text-align:right">${fmtEuro(r.efectivo)}</td>
                      <td style="text-align:right">${fmtEuro(r.tarjeta)}</td>
                      <td style="text-align:right"><b>${fmtEuro(r.total)}</b></td>
                      <td style="text-align:right">${fmtEuro(r.gastos)}</td>
                      <td style="text-align:right"><b>${fmtEuro(r.neto)}</b></td>
                    </tr>
                  `).join('') || `<tr><td colspan="6" class="muted small">Sin datos.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="cardTitle">Semanal</div>
            <div class="tableWrap" style="margin-top:8px; overflow:auto;">
              <table class="tbl">
                <thead><tr><th>Semana</th><th style="text-align:right">Total</th><th style="text-align:right">Gastos</th><th style="text-align:right">Neto</th></tr></thead>
                <tbody>
                  ${byWeek.map(r => `
                    <tr>
                      <td>${esc(r.key)} <span class="muted small">(${r.n} días)</span></td>
                      <td style="text-align:right"><b>${fmtEuro(r.total)}</b></td>
                      <td style="text-align:right">${fmtEuro(r.gastos)}</td>
                      <td style="text-align:right"><b>${fmtEuro(r.neto)}</b></td>
                    </tr>
                  `).join('') || `<tr><td colspan="4" class="muted small">Sin datos.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="cardTitle">Mensual</div>
            <div class="tableWrap" style="margin-top:8px; overflow:auto;">
              <table class="tbl">
                <thead><tr><th>Mes</th><th style="text-align:right">Total</th><th style="text-align:right">Gastos</th><th style="text-align:right">Neto</th></tr></thead>
                <tbody>
                  ${byMonth.map(r => `
                    <tr>
                      <td>${esc(r.key)} <span class="muted small">(${r.n} días)</span></td>
                      <td style="text-align:right"><b>${fmtEuro(r.total)}</b></td>
                      <td style="text-align:right">${fmtEuro(r.gastos)}</td>
                      <td style="text-align:right"><b>${fmtEuro(r.neto)}</b></td>
                    </tr>
                  `).join('') || `<tr><td colspan="4" class="muted small">Sin datos.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div class="cardTitle">Registros</div>
          <div class="tableWrap" style="margin-top:8px; overflow:auto;">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Tienda</th>
                  <th style="text-align:right">Efectivo</th>
                  <th style="text-align:right">Tarjeta</th>
                  <th style="text-align:right">Gastos</th>
                  <th style="text-align:right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${arr.map(v => `
                  <tr>
                    <td>${esc(ddmmyyyy(v.fecha))} <span class="muted small">(${esc(dayNameES(v.fecha))})</span></td>
                    <td>${esc(v.tienda||'')}</td>
                    <td style="text-align:right">${fmtEuro(toNum(v.efectivo))}</td>
                    <td style="text-align:right">${fmtEuro(toNum(v.tarjeta))}</td>
                    <td style="text-align:right">${fmtEuro(toNum(v.gastos))}</td>
                    <td style="text-align:right"><b>${fmtEuro(toNum(v.efectivo)+toNum(v.tarjeta))}</b></td>
                    <td style="text-align:right">
                      <button class="btn btnTiny btnGhost" data-editventa="${esc(v.id)}">Editar</button>
                      <button class="btn btnTiny btnDangerGhost" data-delventa="${esc(v.id)}">Eliminar</button>
                    </td>
                  </tr>
                `).join('') || `<tr><td colspan="7" class="muted small">Sin registros.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div class="cardTitle">Export</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
            <button class="btn btnGhost" id="btnVentasExportCSV">Exportar CSV</button>
          </div>
        </div>
      </div>
    `);

    on($('#btnVentasLock'), 'click', () => lockVentas());
    on($('#btnVentaNueva'), 'click', () => openVentaEditor(''));
    on($('#btnVentasExportCSV'), 'click', () => {
      const csv = exportVentasCsv(ventasInRange(desde, hasta, tienda));
      downloadTextFile(`ventas_${(desde||'all')}_${(hasta||'all')}_${tienda}.csv`.replaceAll('/','-'), csv);
      toast('CSV exportado');
    });

    $$('[data-editventa]').forEach(b => on(b, 'click', () => openVentaEditor(b.getAttribute('data-editventa'))));
    $$('[data-delventa]').forEach(b => on(b, 'click', () => deleteVenta(b.getAttribute('data-delventa'))));
  }

  function exportVentasCsv(arr){
    const rows = [];
    rows.push(['fecha','dia','tienda','efectivo','tarjeta','gastos','total','notas'].join(';'));
    for (const v of arr.slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')))) {
      const fecha = ddmmyyyy(v.fecha);
      const dia = dayNameES(v.fecha);
      const ef = round2(toNum(v.efectivo));
      const ta = round2(toNum(v.tarjeta));
      const ga = round2(toNum(v.gastos));
      const tot = round2(ef+ta);
      const notas = String(v.notas||'').replaceAll(';',',');
      rows.push([fecha, dia, v.tienda, ef, ta, ga, tot, notas].join(';'));
    }
    return rows.join('\n');
  }

  function openVentaEditor(id){
    ensureVentasLoaded();
    const v = id ? (S.ventas.find(x => x.id === id) || null) : null;
    S._ventaEditId = v?.id || '';

    setVal('#vFecha', v?.fecha || isoToday());
    setVal('#vTienda', v?.tienda || 'SAN PABLO');
    setVal('#vEfectivo', v ? String(toNum(v.efectivo)).replace('.',',') : '');
    setVal('#vTarjeta', v ? String(toNum(v.tarjeta)).replace('.',',') : '');
    setVal('#vGastos', v ? String(toNum(v.gastos)).replace('.',',') : '');
    setVal('#vNotas', v?.notas || '');

    setText('#ventaEditorTitle', v ? 'Editar venta' : 'Nueva venta');
    openModal('#modalVenta');
  }

  function saveVenta(){
    ensureVentasLoaded();
    const id = S._ventaEditId || uid();
    const obj = {
      id,
      fecha: val('#vFecha') || isoToday(),
      tienda: val('#vTienda') || 'SAN PABLO',
      efectivo: round2(toNum(val('#vEfectivo'))),
      tarjeta: round2(toNum(val('#vTarjeta'))),
      gastos: round2(toNum(val('#vGastos'))),
      notas: val('#vNotas')
    };

    const idx = S.ventas.findIndex(x => x.id === id);
    if (idx >= 0) S.ventas[idx] = { ...S.ventas[idx], ...obj };
    else S.ventas.unshift(obj);

    save(K.VENTAS, S.ventas);
    closeModal('#modalVenta');
    toast('Venta guardada');
    renderVentas();
  }

  function deleteVenta(id){
    ensureVentasLoaded();
    if (!id) return;
    if (!confirm('Eliminar venta?')) return;
    S.ventas = S.ventas.filter(v => v.id !== id);
    save(K.VENTAS, S.ventas);
    toast('Venta eliminada');
    renderVentas();
  }

  function wireVentasFilters(){
    ['#ventasDesde','#ventasHasta','#ventasTienda'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      on(el, 'change', () => renderVentas());
      on(el, 'input', () => renderVentas());
    });

    // venta modal buttons
    on($('#btnVentaGuardar'), 'click', () => saveVenta());
    on($('#btnVentaCancelar'), 'click', () => closeModal('#modalVenta'));
    on($('#btnVentaCerrarX'), 'click', () => closeModal('#modalVenta'));
  }

  /* =========================
     AJUSTES TAB — IVA / Transporte / PIN / QR / Cloud
  ========================= */
  function renderAjustes(){
    // Inputs exist? If not, skip
    setVal('#ajIvaPct', S.ajustes?.ivaPct ?? 4);
    setVal('#ajTransportePct', S.ajustes?.transportePct ?? 10);
    setVal('#ajPin', S.ajustes?.pin ?? '8410');
    setVal('#ajQrPlantilla', S.ajustes?.qrPlantilla ?? 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}');

    // provider fields
    const p = S.ajustes?.proveedor || {};
    setVal('#ajProvNombre', p.nombre || '');
    setVal('#ajProvNif', p.nif || '');
    setVal('#ajProvDir', p.dir || '');
    setVal('#ajProvTel', p.tel || '');
    setVal('#ajProvEmail', p.email || '');

    // cloud config
    const c = S.ajustes?.cloud || {};
    setVal('#ajFbApiKey', c.apiKey || '');
    setVal('#ajFbAuthDomain', c.authDomain || '');
    setVal('#ajFbDbUrl', c.databaseURL || '');
    setVal('#ajFbProjectId', c.projectId || '');
    setVal('#ajFbAppId', c.appId || '');
    setVal('#ajFbStorageBucket', c.storageBucket || '');
  }

  function saveAjustesFromUI(){
    const ivaPct = round2(toNum(val('#ajIvaPct') || 4));
    const transportePct = round2(toNum(val('#ajTransportePct') || 10));
    const pin = (val('#ajPin') || '8410').trim() || '8410';
    const qrPlantilla = val('#ajQrPlantilla') || 'NIF={NIF}&NUM={NUM}&FECHA={FECHA}&TOTAL={TOTAL}';

    const proveedor = {
      nombre: val('#ajProvNombre'),
      nif: val('#ajProvNif'),
      dir: val('#ajProvDir'),
      tel: val('#ajProvTel'),
      email: val('#ajProvEmail')
    };

    const cloud = {
      apiKey: val('#ajFbApiKey'),
      authDomain: val('#ajFbAuthDomain'),
      databaseURL: val('#ajFbDbUrl'),
      projectId: val('#ajFbProjectId'),
      appId: val('#ajFbAppId'),
      storageBucket: val('#ajFbStorageBucket')
    };

    S.ajustes = { ...(S.ajustes||{}), ivaPct, transportePct, pin, qrPlantilla, proveedor, cloud };
    save(K.AJUSTES, S.ajustes);

    toast('Ajustes guardados');

    // Update current invoice defaults (without forcing)
    const F = getF();
    if (F) {
      F.ivaPct = ivaPct;
      F.transportePct = transportePct;
      // providerSnap used for PDF; keep invoice provider snap aligned
      F.proveedorSnap = { ...proveedor };
      if (typeof window.FACTU_renderContabilidad === 'function') window.FACTU_renderContabilidad();
    }

    // if QR exists on screen, refresh (3B)
    try { if (typeof window.FACTU_refreshQr === 'function') window.FACTU_refreshQr(); } catch {}
  }

  function wireAjustes(){
    on($('#btnAjustesGuardar'), 'click', () => saveAjustesFromUI());
  }

  /* =========================
     SHORTCUTS PRO
     - Ctrl+S guardar factura
     - Ctrl+P PDF
     - Ctrl+F buscar (focus search of current tab)
  ========================= */
  function focusSearchForActiveTab(){
    // detect visible tab by aria or class
    const tabs = [
      { tab:'#tabFacturas', search:'#buscarFacturas' },
      { tab:'#tabClientes', search:'#buscarClientes' },
      { tab:'#tabProductos', search:'#buscarProductos' },
      { tab:'#tabTaras', search:'#buscarTaras' },
      { tab:'#tabContabilidad', search:'#contaTag' },
      { tab:'#tabVentas', search:'#ventasDesde' } // first filter
    ];
    for (const t of tabs) {
      const el = $(t.tab);
      if (!el) continue;
      const visible = el.classList.contains('isActive') || el.style.display !== 'none';
      if (visible) {
        const s = $(t.search);
        s?.focus();
        s?.select?.();
        return true;
      }
    }
    // fallback to any search input
    const any = $('#buscarFacturas') || $('#buscarClientes') || $('#buscarProductos');
    any?.focus();
    any?.select?.();
    return !!any;
  }

  function wireShortcuts(){
    if (wireShortcuts._wired) return;
    wireShortcuts._wired = true;

    on(document, 'keydown', (e) => {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      // Ctrl+S
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (typeof window.FACTU_guardarFactura === 'function') window.FACTU_guardarFactura();
        return;
      }

      // Ctrl+P
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        FACTU_verPDF();
        return;
      }

      // Ctrl+F
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        focusSearchForActiveTab();
        return;
      }
    });
  }

  /* =========================
     WIRING MAIN BUTTONS (if exist)
  ========================= */
  function wirePdfButtons(){
    on($('#btnGenerarPDF'), 'click', () => FACTU_generarPDF());
    on($('#btnVerPDF'), 'click', () => FACTU_verPDF());
    on($('#btnPdfCloud'), 'click', () => FACTU_pdfToCloud());
  }

  /* =========================
     PUBLIC API (for 3A/3B)
  ========================= */
  window.FACTU_generarPDF = FACTU_generarPDF;
  window.FACTU_verPDF = FACTU_verPDF;
  window.FACTU_pdfToCloud = FACTU_pdfToCloud;

  window.FACTU_renderContabilidad = renderContabilidad;
  window.FACTU_renderVentas = renderVentas;

  window.FACTU_lockContabilidad = lockContabilidad;
  window.FACTU_lockVentas = lockVentas;

  /* =========================
     INIT 3C
  ========================= */
  function init3C(){
    // Wire
    wirePdfButtons();
    wireContabilidadFilters();
    wireVentasFilters();
    wireAjustes();
    wireShortcuts();

    // Render initial screens if tabs exist
    try { renderAjustes(); } catch {}
    try { renderContabilidad(); } catch {}
    try { renderVentas(); } catch {}

    // Venta modal extra wires if modal exists
    on($('#btnVentaGuardar'), 'click', () => saveVenta());
    on($('#btnVentaCancelar'), 'click', () => closeModal('#modalVenta'));
    on($('#btnVentaClose'), 'click', () => closeModal('#modalVenta'));
  }

  try { init3C(); } catch (e) { console.error(e); }

})();
