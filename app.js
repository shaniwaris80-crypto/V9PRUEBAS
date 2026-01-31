/* =========================================================
PARTE 3/4 — FACTU MIRAL (B/W PRO) — app.js (A)  ✅
- Pegar ESTE archivo como: app.js
- Esta PARTE deja TODO operativo en local:
  Factura + Grid PRO + Taras + Clientes + Productos + Facturas + QR en pantalla
  + Contabilidad PIN (base) + Ventas diarias PIN (base)
- PDF PRO + Cloud Firebase + visor PDF real + multipágina = PARTE 4/4
========================================================= */
(() => {
  'use strict';

  /* =========================================================
     0) HELPERS
  ========================================================== */
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const pad2 = n => String(n).padStart(2,'0');
  const clamp0 = (n) => (isFinite(n) ? Math.max(0, n) : 0);

  const parseNum = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

  const fmtMoney = (n) => {
    const v = (isFinite(n) ? n : 0);
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };
  const fmtNum2 = (n) => {
    const v = (isFinite(n) ? n : 0);
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDateES = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  };
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const dayNameES = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const names = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return names[d.getDay()];
  };

  const uid = () => {
    try { return crypto.randomUUID(); } catch { return 'id_' + Math.random().toString(16).slice(2) + Date.now(); }
  };

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
  };

  const downloadCSV = (filename, rows) => {
    const esc = (v) => {
      const s = (v ?? '').toString();
      if (/[,"\n;]/.test(s)) return `"${s.replaceAll('"','""')}"`;
      return s;
    };
    const csv = rows.map(r => r.map(esc).join(';')).join('\n');
    downloadText(filename, '\ufeff' + csv);
  };

  const toast = (title, msg='') => {
    const wrap = $('#toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast__title">${escapeHtml(title)}</div>${msg?`<div class="toast__msg">${escapeHtml(msg)}</div>`:''}`;
    wrap.appendChild(el);
    setTimeout(()=> el.style.opacity = '0.0', 3000);
    setTimeout(()=> el.remove(), 3600);
  };

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  /* =========================================================
     1) STORAGE KEYS
  ========================================================== */
  const K = {
    provider : 'factumiral_provider_v1',
    clientes : 'factumiral_clientes_v1',
    productos: 'factumiral_productos_v1',
    taras    : 'factumiral_taras_v1',
    facturas : 'factumiral_facturas_v1',
    settings : 'factumiral_settings_v1',
    ventas   : 'factumiral_ventas_v1',
    pricehist: 'factumiral_pricehist_v1'
  };

  const load = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const save = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  };

  /* =========================================================
     2) DEFAULTS (Proveedor / Ajustes / Clientes / Productos / Taras)
  ========================================================== */
  function setProviderDefaultsIfEmpty(p){
    p = p || {};
    if(!p.nombre) p.nombre = 'Mohammad Arslan Waris';
    if(!p.nif)    p.nif    = 'X6389988J';
    if(!p.dir)    p.dir    = 'Calle San Pablo 17, 09003 Burgos';
    if(!p.tel)    p.tel    = '631 667 893';
    if(!p.email)  p.email  = 'shaniwaris80@gmail.com';
    return p;
  }

  const DEFAULT_SETTINGS = {
    ivaPct: 4,
    transportePct: 10,
    pin: '8410',
    qrBase: 'NIF={NIF};FAC={NUM};FECHA={FECHA};TOTAL={TOTAL}',
    cloud: {
      enabled: false,
      apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'', storageBucket:''
    }
  };

  const DEFAULT_CLIENTES = [
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', tel:'', email:'', pago:'Efectivo', notas:'', alias:'', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'efectivo', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos', tel:'', email:'', pago:'', notas:'', alias:'Golden Garden', plantillas:{ivaIncluido:'si', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:'IVA incluido en los precios'}},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51', email:'', pago:'', notas:'', alias:'Con/sentidos', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com', pago:'', notas:'', alias:'', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos', tel:'', email:'', pago:'', notas:'', alias:'ALESAL PAN', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos', tel:'', email:'', pago:'', notas:'', alias:'RIVIERA', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos', tel:'', email:'', pago:'', notas:'', alias:'NUOVO', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', tel:'', email:'info@restaurantelosbraseros.com', pago:'', notas:'', alias:'Los Braseros', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', tel:'', email:'info@hotelcordon.com', pago:'', notas:'', alias:'Hotel Cordon', plantillas:{ivaIncluido:'auto', transporte:'auto', metodoPago:'', tagsAuto:'', notaStd:''}}
  ];

  // Productos: se cargan SIEMPRE (tu lista)
  // (Se parsea desde RAW para no romper nada y mantener TODO)
  const DEFAULT_PRODUCTS_RAW = `"GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA","AGUACATE GRANEL","MARACUYÁ",
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
"UVA ALVILLO NEGRA","CHAYOTE","ROYAL GALA 28","MANDARINA PRIMERA","PIMIENTO PINTON","MELOCOTON AMARILLO DE CALANDA","HINOJOS","MANDARINA DE HOJA","UVA ROJA PRIMERA","UVA BLANCA PRIMERA"`;

  const DEFAULT_TARAS = [
    {id:uid(), nombre:'Caja plástico ESMO', peso:0.30, notas:''},
    {id:uid(), nombre:'Caja plástico MONTENEGRO', peso:0.30, notas:''},
    {id:uid(), nombre:'Baúl Hnos viejo', peso:1.80, notas:''}
  ];

  function buildDefaultProductsFromRaw(raw){
    const parts = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^[\s"]+|[\s"]+$/g,''))
      .filter(Boolean);

    // Convertir a objetos producto (sin precios por defecto)
    // Nota: precios se guardan y se usan como hints/últimos precios.
    const now = Date.now();
    return parts.map((name, i) => ({
      id: uid(),
      nombre: name,
      modo: 'kg',
      kgCaja: 0,
      precioKg: 0,
      precioCaja: 0,
      precioUd: 0,
      coste: 0,
      origen: '',
      taraDefaultId: '',
      createdAt: now + i
    }));
  }

  /* =========================================================
     3) STATE
  ========================================================== */
  const S = {
    provider: setProviderDefaultsIfEmpty(load(K.provider, {})),
    settings: Object.assign({}, DEFAULT_SETTINGS, load(K.settings, {})),
    clientes: load(K.clientes, []),
    productos: load(K.productos, []),
    taras: load(K.taras, []),
    facturas: load(K.facturas, []),
    pricehist: load(K.pricehist, {}), // { productId: [ {ts, modo, precio} ... ] }
    ventas: load(K.ventas, []) // [{date, sp:{ef,ta,ga}, sl:{...}, sa:{...}}]
  };

  // Session-only
  const SESSION = {
    contabUnlocked: false,
    ventasUnlocked: false,
    currentFacturaId: null,
    lastPdfBlobUrl: null
  };

  /* =========================================================
     4) QR GENERATOR (Nayuki-style, compact)
     - Real QR scannable (si hay datos mínimos)
========================================================== */
  // Minimal QR Code generator (MIT - Nayuki reference implementation style)
  // Adapted/embedded to avoid external libs.
  const qrcodegen = (() => {
    const QrCode = function(version, ecc, dataCodewords, mask) {
      this.version = version;
      this.errorCorrectionLevel = ecc;
      this.mask = mask;
      this.size = version * 4 + 17;
      this.modules = Array.from({length:this.size}, () => Array(this.size).fill(false));
      this.isFunction = Array.from({length:this.size}, () => Array(this.size).fill(false));
      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);
      this.applyMask(mask);
      this.drawFormatBits(ecc, mask);
      if (version >= 7) this.drawVersion();
    };

    const Ecc = {
      LOW:0, MEDIUM:1, QUARTILE:2, HIGH:3
    };

    QrCode.Ecc = Ecc;

    QrCode.encodeText = function(text, ecl) {
      const seg = QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text));
      return QrCode.encodeSegments([seg], ecl);
    };

    QrCode.encodeSegments = function(segs, ecl) {
      if (!segs || segs.length === 0) throw new Error('No segments');
      let version, dataUsedBits;
      for (version = 1; version <= 40; version++) {
        const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
        dataUsedBits = QrSegment.getTotalBits(segs, version);
        if (dataUsedBits !== null && dataUsedBits <= dataCapacityBits) break;
      }
      if (version > 40) throw new Error('Data too long');

      const bb = [];
      for (const seg of segs) {
        appendBits(bb, seg.mode.modeBits, 4);
        appendBits(bb, seg.numChars, seg.mode.numCharCountBits(version));
        for (const b of seg.data) bb.push(b);
      }

      const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
      // Terminator
      appendBits(bb, 0, Math.min(4, dataCapacityBits - dataUsedBits));
      // Pad to byte
      while (bb.length % 8 !== 0) bb.push(false);
      // Pad bytes
      const padBytes = [0xEC, 0x11];
      let padIndex = 0;
      while (bb.length < dataCapacityBits) {
        appendBits(bb, padBytes[padIndex], 8);
        padIndex ^= 1;
      }

      const dataCodewords = [];
      for (let i = 0; i < bb.length; i += 8) {
        let val = 0;
        for (let j=0;j<8;j++) val = (val<<1) | (bb[i+j] ? 1 : 0);
        dataCodewords.push(val);
      }

      // Choose best mask
      let bestMask = 0;
      let bestPenalty = Infinity;
      let best = null;
      for (let mask = 0; mask < 8; mask++) {
        const qr = new QrCode(version, ecl, dataCodewords, mask);
        const pen = qr.getPenaltyScore();
        if (pen < bestPenalty) {
          bestPenalty = pen;
          bestMask = mask;
          best = qr;
        }
      }
      best.mask = bestMask;
      return best;
    };

    QrCode.getNumDataCodewords = function(ver, ecl) {
      return QrCode._NUM_DATA_CODEWORDS[ecl][ver];
    };

    QrCode._NUM_DATA_CODEWORDS = (() => {
      // Table indexed by [ecl][ver], ver 1..40
      // Precomputed from standard capacities (compact table).
      // Source: Nayuki reference (shortened embedding).
      const L=[0,
        19,34,55,80,108,136,156,194,232,274,324,370,428,461,523,589,647,721,795,861,932,1006,1094,1174,1276,1370,1468,1531,1631,1735,1843,1955,2071,2191,2306,2434,2566,2702,2812,2956
      ];
      const M=[0,
        16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669,714,782,860,914,1000,1062,1128,1193,1267,1373,1455,1541,1631,1725,1812,1914,1992,2102,2216,2334
      ];
      const Q=[0,
        13,22,34,48,62,76,88,110,132,154,180,206,244,261,295,325,367,397,445,485,512,568,614,664,718,754,808,871,911,985,1033,1115,1171,1231,1286,1354,1426,1502,1582,1666
      ];
      const H=[0,
        9,16,26,36,46,60,66,86,100,122,140,158,180,197,223,253,283,313,341,385,406,442,464,514,538,596,628,661,701,745,793,845,901,961,986,1054,1096,1142,1222,1276
      ];
      return [L,M,Q,H].map(arr => {
        const out = new Array(41).fill(0);
        for (let i=1;i<=40;i++) out[i]=arr[i];
        return out;
      });
    })();

    QrCode.prototype.drawFunctionPatterns = function() {
      const size = this.size;
      // Finder patterns
      const drawFinder = (x,y) => {
        for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
          const xx = x+dx, yy = y+dy;
          if (0<=xx && xx<size && 0<=yy && yy<size) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            this.modules[yy][xx] = dist !== 2 && dist !== 4;
            this.isFunction[yy][xx] = true;
          }
        }
      };
      drawFinder(3,3);
      drawFinder(size-4,3);
      drawFinder(3,size-4);

      // Separators + timing patterns
      for (let i=0;i<size;i++){
        this.setFunctionModule(6,i, i%2===0);
        this.setFunctionModule(i,6, i%2===0);
      }

      // Dark module
      this.setFunctionModule(8, size-8, true);

      // Alignment patterns
      const pos = QrCode.getAlignmentPatternPositions(this.version);
      for (let i=0;i<pos.length;i++){
        for (let j=0;j<pos.length;j++){
          if ((i===0 && j===0) || (i===0 && j===pos.length-1) || (i===pos.length-1 && j===0)) continue;
          this.drawAlignmentPattern(pos[i], pos[j]);
        }
      }

      // Reserve format info areas
      for (let i=0;i<9;i++){
        this.isFunction[8][i] = true;
        this.isFunction[i][8] = true;
      }
      for (let i=size-8;i<size;i++){
        this.isFunction[8][i] = true;
        this.isFunction[i][8] = true;
      }
      this.isFunction[8][size-8] = true;
    };

    QrCode.prototype.drawAlignmentPattern = function(x,y){
      for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){
        this.setFunctionModule(x+dx, y+dy, Math.max(Math.abs(dx),Math.abs(dy)) !== 1);
      }
    };

    QrCode.getAlignmentPatternPositions = function(ver){
      if (ver===1) return [];
      const num = Math.floor(ver/7)+2;
      const step = (ver===32) ? 26 : Math.ceil((ver*4+17-13) / (num*2-2))*2;
      const res = [6];
      for (let i=0;i<num-2;i++) res.splice(1,0, (ver*4+17-7) - i*step);
      res.push(ver*4+17-7);
      return res;
    };

    QrCode.prototype.setFunctionModule = function(x,y,isDark){
      this.modules[y][x]=isDark;
      this.isFunction[y][x]=true;
    };

    QrCode.prototype.drawFormatBits = function(ecl, mask){
      const data = (QrCode.getFormatBits(ecl) << 3) | mask;
      let rem = data;
      for (let i=0;i<10;i++) rem = (rem<<1) ^ (((rem>>>9)&1) ? 0x537 : 0);
      const bits = ((data<<10) | rem) ^ 0x5412;
      // Draw
      for (let i=0;i<=5;i++) this.setFunctionModule(8,i, ((bits>>>i)&1)!==0);
      this.setFunctionModule(8,7, ((bits>>>6)&1)!==0);
      this.setFunctionModule(8,8, ((bits>>>7)&1)!==0);
      this.setFunctionModule(7,8, ((bits>>>8)&1)!==0);
      for (let i=9;i<15;i++) this.setFunctionModule(14-i,8, ((bits>>>i)&1)!==0);

      for (let i=0;i<8;i++) this.setFunctionModule(this.size-1-i,8, ((bits>>>i)&1)!==0);
      for (let i=8;i<15;i++) this.setFunctionModule(8,this.size-15+i, ((bits>>>i)&1)!==0);
      this.setFunctionModule(8,this.size-8,true);
    };

    QrCode.getFormatBits = function(ecl){
      switch(ecl){
        case Ecc.LOW: return 1;
        case Ecc.MEDIUM: return 0;
        case Ecc.QUARTILE: return 3;
        case Ecc.HIGH: return 2;
        default: return 0;
      }
    };

    QrCode.prototype.drawVersion = function(){
      let rem = this.version;
      for (let i=0;i<12;i++) rem = (rem<<1) ^ (((rem>>>11)&1) ? 0x1F25 : 0);
      const bits = (this.version<<12) | rem;
      for (let i=0;i<18;i++){
        const bit = ((bits>>>i)&1)!==0;
        const a = this.size-11 + (i%3);
        const b = Math.floor(i/3);
        this.setFunctionModule(a,b,bit);
        this.setFunctionModule(b,a,bit);
      }
    };

    QrCode.prototype.addEccAndInterleave = function(data){
      const ver = this.version;
      const ecl = this.errorCorrectionLevel;
      const numBlocks = QrCode._NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
      const eccPerBlock = QrCode._ECC_CODEWORDS_PER_BLOCK[ecl][ver];
      const rawCodewords = QrCode._RAW_DATA_MODULES[ver] / 8;
      const dataLen = QrCode.getNumDataCodewords(ver, ecl);
      const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);

      const blocks = [];
      let k = 0;
      for (let i=0;i<numBlocks;i++){
        const datSize = shortBlockLen - eccPerBlock + (i < numShortBlocks ? 0 : 1);
        const dat = data.slice(k, k+datSize);
        k += datSize;
        const ecc = reedSolomonComputeRemainder(dat, eccPerBlock);
        blocks.push(dat.concat(ecc));
      }

      const result = [];
      for (let i=0;i<blocks[0].length;i++){
        for (let j=0;j<blocks.length;j++){
          if (i === shortBlockLen - eccPerBlock && j < numShortBlocks) continue;
          if (i < blocks[j].length) result.push(blocks[j][i]);
        }
      }
      return result;
    };

    // Tables (compact)
    QrCode._ECC_CODEWORDS_PER_BLOCK = (() => {
      // indexed [ecl][ver]
      const t = [
        [0,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30], // L
        [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28], // M
        [0,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30], // Q
        [0,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]  // H
      ];
      return t;
    })();

    QrCode._NUM_ERROR_CORRECTION_BLOCKS = (() => {
      const t = [
        [0,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25], // L
        [0,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49], // M
        [0,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68], // Q
        [0,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]  // H
      ];
      return t;
    })();

    QrCode._RAW_DATA_MODULES = (() => {
      const t = new Array(41).fill(0);
      for (let v=1; v<=40; v++){
        let size = v*4+17;
        let result = size*size - 64*3 - 15*2 - 1 - (size-16)*2; // finder + format + dark + timing
        if (v >= 2){
          const numAlign = Math.floor(v/7)+2;
          result -= (numAlign*numAlign - 3) * 25; // alignment patterns, minus overlaps
        }
        if (v >= 7) result -= 36; // version info
        t[v] = result;
      }
      return t;
    })();

    QrCode.prototype.drawCodewords = function(data){
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const y = ((right + 1) & 2) === 0 ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x]) {
              const bit = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
              this.modules[y][x] = bit;
              i++;
            }
          }
        }
      }
    };

    QrCode.prototype.applyMask = function(mask){
      for (let y=0;y<this.size;y++){
        for (let x=0;x<this.size;x++){
          if (this.isFunction[y][x]) continue;
          let invert = false;
          switch(mask){
            case 0: invert = (x+y)%2===0; break;
            case 1: invert = y%2===0; break;
            case 2: invert = x%3===0; break;
            case 3: invert = (x+y)%3===0; break;
            case 4: invert = (Math.floor(y/2)+Math.floor(x/3))%2===0; break;
            case 5: invert = (x*y)%2 + (x*y)%3 === 0; break;
            case 6: invert = ((x*y)%2 + (x*y)%3) % 2 === 0; break;
            case 7: invert = ((x+y)%2 + (x*y)%3) % 2 === 0; break;
          }
          if (invert) this.modules[y][x] = !this.modules[y][x];
        }
      }
    };

    QrCode.prototype.getPenaltyScore = function(){
      let result = 0;
      const size = this.size;
      // Adjacent modules in row/column
      for (let y=0;y<size;y++){
        let runColor = this.modules[y][0];
        let runX = 1;
        for (let x=1;x<size;x++){
          if (this.modules[y][x] === runColor){
            runX++;
            if (runX === 5) result += 3;
            else if (runX > 5) result++;
          } else {
            runColor = this.modules[y][x];
            runX = 1;
          }
        }
      }
      for (let x=0;x<size;x++){
        let runColor = this.modules[0][x];
        let runY = 1;
        for (let y=1;y<size;y++){
          if (this.modules[y][x] === runColor){
            runY++;
            if (runY === 5) result += 3;
            else if (runY > 5) result++;
          } else {
            runColor = this.modules[y][x];
            runY = 1;
          }
        }
      }
      // 2x2 blocks
      for (let y=0;y<size-1;y++){
        for (let x=0;x<size-1;x++){
          const c = this.modules[y][x];
          if (c===this.modules[y][x+1] && c===this.modules[y+1][x] && c===this.modules[y+1][x+1]) result += 3;
        }
      }
      // Finder-like patterns
      const finderPenalty = (get) => {
        let res = 0;
        for (let i=0;i<size;i++){
          for (let j=0;j<size-10;j++){
            if (get(i,j) && !get(i,j+1) && get(i,j+2) && get(i,j+3) && get(i,j+4) && !get(i,j+5) && get(i,j+6) &&
                !get(i,j+7) && !get(i,j+8) && !get(i,j+9) && !get(i,j+10)) res += 40;
            if (!get(i,j) && !get(i,j+1) && !get(i,j+2) && !get(i,j+3) && get(i,j+4) && !get(i,j+5) && get(i,j+6) &&
                get(i,j+7) && get(i,j+8) && !get(i,j+9) && get(i,j+10)) res += 40;
          }
        }
        return res;
      };
      result += finderPenalty((y,x)=>this.modules[y][x]);
      result += finderPenalty((x,y)=>this.modules[y][x]);

      // Balance of dark modules
      let dark = 0;
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (this.modules[y][x]) dark++;
      const total = size*size;
      const k = Math.abs(dark*20 - total*10) / total;
      result += Math.floor(k) * 10;

      return result;
    };

    const QrSegment = function(mode, numChars, data) {
      this.mode = mode;
      this.numChars = numChars;
      this.data = data; // array of booleans
    };

    QrSegment.Mode = function(modeBits, cc0, cc1, cc2) {
      this.modeBits = modeBits;
      this.ccBits = [cc0, cc1, cc2];
    };
    QrSegment.Mode.prototype.numCharCountBits = function(ver) {
      return this.ccBits[ver < 10 ? 0 : ver < 27 ? 1 : 2];
    };

    QrSegment.MODE_BYTE = new QrSegment.Mode(0x4, 8, 16, 16);

    QrSegment.makeBytes = function(data) {
      const bits = [];
      for (const b of data) appendBits(bits, b, 8);
      return new QrSegment(QrSegment.MODE_BYTE, data.length, bits);
    };

    QrSegment.toUtf8ByteArray = function(str){
      const out = [];
      for (const ch of new TextEncoder().encode(str)) out.push(ch);
      return out;
    };

    QrSegment.getTotalBits = function(segs, ver) {
      let sum = 0;
      for (const seg of segs) {
        const ccbits = seg.mode.numCharCountBits(ver);
        if (seg.numChars >= (1<<ccbits)) return null;
        sum += 4 + ccbits + seg.data.length;
      }
      return sum;
    };

    function appendBits(bb, val, len){
      for (let i=len-1;i>=0;i--) bb.push(((val>>>i)&1)!==0);
    }

    function reedSolomonComputeRemainder(data, degree){
      const res = new Array(degree).fill(0);
      for (const b of data){
        const factor = b ^ res[0];
        res.shift();
        res.push(0);
        const gen = reedSolomonGenerator(degree);
        for (let i=0;i<degree;i++){
          res[i] ^= reedSolomonMultiply(gen[i], factor);
        }
      }
      return res;
    }

    const rsGenCache = new Map();
    function reedSolomonGenerator(degree){
      if (rsGenCache.has(degree)) return rsGenCache.get(degree);
      let poly = [1];
      for (let i=0;i<degree;i++){
        poly = reedSolomonPolyMultiply(poly, [1, reedSolomonPow(2, i)]);
      }
      rsGenCache.set(degree, poly.slice(1)); // omit leading 1
      return poly.slice(1);
    }

    function reedSolomonPolyMultiply(p, q){
      const res = new Array(p.length + q.length - 1).fill(0);
      for (let i=0;i<p.length;i++){
        for (let j=0;j<q.length;j++){
          res[i+j] ^= reedSolomonMultiply(p[i], q[j]);
        }
      }
      return res;
    }

    function reedSolomonMultiply(x, y){
      if (x===0 || y===0) return 0;
      return reedSolomonExp[(reedSolomonLog[x] + reedSolomonLog[y]) % 255];
    }

    function reedSolomonPow(x, e){
      let y = 1;
      for (let i=0;i<e;i++) y = reedSolomonMultiply(y, x);
      return y;
    }

    // GF(256) tables
    const reedSolomonExp = new Array(512).fill(0);
    const reedSolomonLog = new Array(256).fill(0);
    (function initGF(){
      let x = 1;
      for (let i=0;i<255;i++){
        reedSolomonExp[i] = x;
        reedSolomonLog[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11D;
      }
      for (let i=255;i<512;i++) reedSolomonExp[i] = reedSolomonExp[i-255];
    })();

    return { QrCode, QrSegment };
  })();

  function drawQrToCanvas(text){
    const canvas = $('#qrCanvas');
    const fb = $('#qrFallback');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha:false });
    const size = canvas.width;

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,size,size);

    try{
      const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
      const border = 2;
      const scale = Math.floor(size / (qr.size + border*2));
      const off = Math.floor((size - (qr.size + border*2)*scale)/2);

      // White background already
      ctx.fillStyle = '#000000';
      for (let y=0;y<qr.size;y++){
        for (let x=0;x<qr.size;x++){
          if (qr.modules[y][x]) {
            const xx = (x + border)*scale + off;
            const yy = (y + border)*scale + off;
            ctx.fillRect(xx, yy, scale, scale);
          }
        }
      }
      fb && fb.classList.add('is-hidden');
    }catch(e){
      // Fallback
      fb && fb.classList.remove('is-hidden');
    }
  }

  /* =========================================================
     5) INIT SEEDING
  ========================================================== */
  function seedIfEmpty(){
    // Clientes
    if (!Array.isArray(S.clientes) || S.clientes.length === 0) {
      S.clientes = DEFAULT_CLIENTES;
      save(K.clientes, S.clientes);
    }

    // Productos
    if (!Array.isArray(S.productos) || S.productos.length === 0) {
      S.productos = buildDefaultProductsFromRaw(DEFAULT_PRODUCTS_RAW);
      save(K.productos, S.productos);
    }

    // Taras
    if (!Array.isArray(S.taras) || S.taras.length === 0) {
      S.taras = DEFAULT_TARAS;
      save(K.taras, S.taras);
    }

    // Settings merge
    S.settings = Object.assign({}, DEFAULT_SETTINGS, S.settings || {});
    S.settings.cloud = Object.assign({}, DEFAULT_SETTINGS.cloud, (S.settings.cloud || {}));
    if (!S.settings.pin) S.settings.pin = '8410';
    save(K.settings, S.settings);

    // Provider defaults
    S.provider = setProviderDefaultsIfEmpty(S.provider || {});
    save(K.provider, S.provider);
  }

  /* =========================================================
     6) INVOICE MODEL
  ========================================================== */
  function genFacturaNumero(){
    const d = new Date();
    const y = d.getFullYear();
    const mo = pad2(d.getMonth()+1);
    const da = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `FA-${y}${mo}${da}${hh}${mi}`;
  }

  function blankLine(){
    return {
      id: uid(),
      producto: '',
      modo: 'kg',
      cantidad: null,
      bruto: null,
      taraId: '',
      taraKg: null,
      neto: null,
      netoManual: false,
      precio: null,
      origen: '',
      importe: 0,
      warnings: []
    };
  }

  function blankFactura(){
    const num = genFacturaNumero();
    const date = isoToday();
    return {
      id: uid(),
      numero: num,
      fecha: date,
      clienteId: '',
      clienteSnapshot: null, // se guarda en save
      tags: '',
      notasInternas: '',
      observaciones: '',
      transporteOn: false,
      transportePct: S.settings.transportePct ?? 10,
      ivaIncluido: false,
      ivaPct: S.settings.ivaPct ?? 4,
      lineas: [blankLine(), blankLine(), blankLine(), blankLine(), blankLine()],
      pagos: [],
      metodoPago: 'efectivo',
      totals: { subtotal:0, transporte:0, iva:0, total:0, pendiente:0 },
      estado: 'impagada',
      pdf: { url:'', createdAt:null }, // PARTE 4
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function getFacturaById(id){
    return S.facturas.find(f => f.id === id) || null;
  }

  /* =========================================================
     7) UI RENDERERS
  ========================================================== */
  function setInputValue(id, v){
    const el = $(id);
    if (!el) return;
    el.value = (v ?? '');
  }

  function fillProviderUI(){
    setInputValue('#provNombre', S.provider.nombre);
    setInputValue('#provNif', S.provider.nif);
    setInputValue('#provDir', S.provider.dir);
    setInputValue('#provTel', S.provider.tel);
    setInputValue('#provEmail', S.provider.email);
  }

  function readProviderUI(){
    S.provider.nombre = $('#provNombre')?.value?.trim() || '';
    S.provider.nif    = $('#provNif')?.value?.trim() || '';
    S.provider.dir    = $('#provDir')?.value?.trim() || '';
    S.provider.tel    = $('#provTel')?.value?.trim() || '';
    S.provider.email  = $('#provEmail')?.value?.trim() || '';
    S.provider = setProviderDefaultsIfEmpty(S.provider);
    save(K.provider, S.provider);
  }

  function renderClienteSelect(){
    const sel = $('#facClienteSelect');
    if (!sel) return;
    const curr = sel.value;
    sel.innerHTML = `<option value="">— Seleccionar cliente —</option>` +
      S.clientes
        .slice()
        .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'))
        .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)}${c.nif?` · ${escapeHtml(c.nif)}`:''}</option>`)
        .join('');
    if (curr) sel.value = curr;
  }

  function renderTaraSelects(){
    // Para grid lineas (se rellenan al crear cada fila)
    // Para ficha producto
    const pSel = $('#pTaraDefault');
    if (pSel){
      const curr = pSel.value;
      pSel.innerHTML = `<option value="">— Ninguna —</option>` +
        S.taras
          .slice()
          .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'))
          .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${fmtNum2(t.peso)} kg)</option>`)
          .join('');
      if (curr) pSel.value = curr;
    }
  }

  function ensureProductDatalist(){
    if ($('#dlProducts')) return;
    const dl = document.createElement('datalist');
    dl.id = 'dlProducts';
    dl.innerHTML = S.productos
      .slice()
      .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'))
      .map(p => `<option value="${escapeHtml(p.nombre)}"></option>`)
      .join('');
    document.body.appendChild(dl);
  }

  function ensureClienteSearchDatalist(){
    // opcional: no necesario. (dejamos búsqueda libre)
  }

  /* =========================================================
     8) FACTURA: LOAD / SAVE / RENDER
  ========================================================== */
  let CUR = blankFactura();

  function setCurrentFactura(f){
    CUR = JSON.parse(JSON.stringify(f));
    SESSION.currentFacturaId = CUR.id;
    renderFactura();
  }

  function renderFactura(){
    // meta
    setInputValue('#facNumero', CUR.numero);
    setInputValue('#facFecha', CUR.fecha);
    setInputValue('#facTags', CUR.tags);
    setInputValue('#facNotasInternas', CUR.notasInternas);
    setInputValue('#facObservaciones', CUR.observaciones);

    $('#facNumeroLabel') && ($('#facNumeroLabel').textContent = CUR.numero || 'FA-—');
    $('#facFechaLabel') && ($('#facFechaLabel').textContent = fmtDateES(CUR.fecha));

    // cliente select
    renderClienteSelect();
    if ($('#facClienteSelect')) $('#facClienteSelect').value = CUR.clienteId || '';

    // cliente snapshot / inline fields
    const cli = CUR.clienteId ? S.clientes.find(c=>c.id===CUR.clienteId) : null;
    const snap = CUR.clienteSnapshot || null;
    const src = cli || snap || { nombre:'', nif:'', dir:'', tel:'', email:'' };

    setInputValue('#cliNombre', src.nombre || '');
    setInputValue('#cliNif', src.nif || '');
    setInputValue('#cliDir', src.dir || '');
    setInputValue('#cliTel', src.tel || '');
    setInputValue('#cliEmail', src.email || '');

    // totals controls
    $('#chkTransporte') && ($('#chkTransporte').checked = !!CUR.transporteOn);
    $('#transportePct') && ($('#transportePct').value = (CUR.transportePct ?? S.settings.transportePct ?? 10));
    $('#chkIvaIncluido') && ($('#chkIvaIncluido').checked = !!CUR.ivaIncluido);
    $('#ivaPct') && ($('#ivaPct').value = (CUR.ivaPct ?? S.settings.ivaPct ?? 4));

    // pagos
    $('#facMetodoPago') && ($('#facMetodoPago').value = CUR.metodoPago || 'efectivo');
    renderPagos();

    // grid
    renderGrid();

    // recalc
    recalcAll();

    // QR
    refreshQr();
  }

  function readFacturaFromUI(){
    CUR.numero = $('#facNumero')?.value || CUR.numero;
    CUR.fecha = $('#facFecha')?.value || CUR.fecha;
    CUR.tags = $('#facTags')?.value?.trim() || '';
    CUR.notasInternas = $('#facNotasInternas')?.value?.trim() || '';
    CUR.observaciones = $('#facObservaciones')?.value?.trim() || '';
    CUR.transporteOn = !!$('#chkTransporte')?.checked;
    CUR.transportePct = parseNum($('#transportePct')?.value) ?? (S.settings.transportePct ?? 10);
    CUR.ivaIncluido = !!$('#chkIvaIncluido')?.checked;
    CUR.ivaPct = parseNum($('#ivaPct')?.value) ?? (S.settings.ivaPct ?? 4);
    CUR.metodoPago = $('#facMetodoPago')?.value || 'efectivo';

    // cliente inline snapshot (para guardar exacto en factura)
    const snap = {
      nombre: $('#cliNombre')?.value?.trim() || '',
      nif: $('#cliNif')?.value?.trim() || '',
      dir: $('#cliDir')?.value?.trim() || '',
      tel: $('#cliTel')?.value?.trim() || '',
      email: $('#cliEmail')?.value?.trim() || ''
    };
    CUR.clienteSnapshot = snap;
    CUR.updatedAt = Date.now();
  }

  function saveCurrentFactura(){
    readFacturaFromUI();
    recalcAll();

    // snapshot proveedor (por seguridad contable / PARTE 4 también)
    CUR.providerSnapshot = Object.assign({}, S.provider);

    const idx = S.facturas.findIndex(f=>f.id === CUR.id);
    if (idx >= 0) S.facturas[idx] = JSON.parse(JSON.stringify(CUR));
    else S.facturas.unshift(JSON.parse(JSON.stringify(CUR)));

    save(K.facturas, S.facturas);

    // Actualizar pricehist (solo pantalla)
    tryUpdatePriceHistoryFromInvoice(CUR);

    renderFacturasList();
    renderContabilidad(); // base
    toast('Guardado', `${CUR.numero} · ${fmtMoney(CUR.totals.total)}`);
    $('#diagSaved') && ($('#diagSaved').textContent = new Date().toLocaleString('es-ES'));
  }

  function deleteCurrentFactura(){
    if (!CUR?.id) return;
    const i = S.facturas.findIndex(f=>f.id === CUR.id);
    if (i >= 0) {
      S.facturas.splice(i,1);
      save(K.facturas, S.facturas);
    }
    setCurrentFactura(blankFactura());
    renderFacturasList();
    renderContabilidad();
    toast('Eliminada', 'Factura eliminada');
  }

  function duplicateCurrentFactura(){
    const copy = JSON.parse(JSON.stringify(CUR));
    copy.id = uid();
    copy.numero = genFacturaNumero();
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    // pagos se duplican? normal: NO
    copy.pagos = [];
    copy.estado = 'impagada';
    copy.pdf = { url:'', createdAt:null };
    setCurrentFactura(copy);
    toast('Duplicada', 'Se creó una copia (sin pagos)');
  }

  /* =========================================================
     9) GRID PRO: RENDER + EVENTS + CALC
  ========================================================== */
  function renderGrid(){
    ensureProductDatalist();
    renderTaraSelects();

    const body = $('#gridBody');
    const tpl = $('#tplLine');
    if (!body || !tpl) return;

    body.innerHTML = '';
    if (!Array.isArray(CUR.lineas)) CUR.lineas = [];
    while (CUR.lineas.length < 5) CUR.lineas.push(blankLine());

    CUR.lineas.forEach((line, idx) => {
      const node = tpl.content.firstElementChild.cloneNode(true);

      const cells = $$('.cell', node);
      // data-label para móvil (CSS)
      const labels = ['Producto','Modo','Cantidad','Bruto (kg)','Tara','Neto (kg)','Precio','Origen','Importe',''];
      cells.forEach((c,i)=> c.setAttribute('data-label', labels[i] || ''));

      // refs
      const inpProd = $('.input--prod', node);
      const selModo = $('.select', node); // primero select
      const inpCant = $$('.input--num', node)[0];
      const inpBruto = $$('.input--num', node)[1];
      const selTara = $('.taraSelect', node);
      const inpTaraKg = $('.taraKg', node);
      const inpNeto = $('.netoKg', node);
      const inpPrecio = $('.precio', node);
      const inpOrigen = $$('.input', node).find(x => x.placeholder === 'Origen');
      const btnDel = $('.iconBtn', node);
      const hintLast = $('[data-hint="lastprice"]', node);
      const hintHist = $('[data-hint="history"]', node);
      const microTara = $('[data-micro="taraauto"]', node);
      const microNeto = $('[data-micro="netomode"]', node);
      const microPrecio = $('[data-micro="preciohint"]', node);
      const impEl = $('[data-importe]', node);
      const warnEl = $('[data-warn]', node);

      // datalist (manual suggestions)
      inpProd.setAttribute('list', 'dlProducts');

      // fill values
      inpProd.value = line.producto || '';
      selModo.value = line.modo || 'kg';
      inpCant.value = (line.cantidad ?? '');
      inpBruto.value = (line.bruto ?? '');
      inpTaraKg.value = (line.taraKg ?? '');
      inpNeto.value = (line.neto ?? '');
      inpPrecio.value = (line.precio ?? '');
      inpOrigen.value = (line.origen ?? '');

      // tara select options
      selTara.innerHTML = `<option value="">— Tara —</option>` + S.taras
        .slice()
        .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'))
        .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${fmtNum2(t.peso)} kg)</option>`)
        .join('');
      selTara.value = line.taraId || '';

      // hints
      const pObj = findProductByName(line.producto);
      const last = getLastPriceHint(pObj?.id);
      hintLast.textContent = `Último: ${last ? fmtNum2(last.precio) : '—'}`;
      hintHist.textContent = `Hist: ${formatHistHint(pObj?.id)}`;
      microPrecio.textContent = pObj ? `Def: ${fmtNum2(getDefaultPriceForMode(pObj, selModo.value) || 0)}` : '—';
      microNeto.textContent = line.netoManual ? 'Manual' : 'Auto';

      // calc display
      const calc = calcLineFromState(line);
      impEl.textContent = fmtMoney(calc.importe);
      warnEl.textContent = calc.warnings.join(' · ') || '';
      microTara.textContent = `Auto: ${fmtNum2(calc.taraAuto)} kg`;

      // store in DOM
      node.dataset.lineId = line.id;

      // --- events
      const recalcThis = () => {
        // read from inputs -> state
        line.producto = inpProd.value.trim();
        line.modo = selModo.value;
        line.cantidad = parseNum(inpCant.value);
        line.bruto = parseNum(inpBruto.value);
        line.taraId = selTara.value || '';
        line.taraKg = parseNum(inpTaraKg.value);
        line.neto = parseNum(inpNeto.value);
        line.precio = parseNum(inpPrecio.value);
        line.origen = inpOrigen.value.trim();

        // if user typed neto => manual flag
        // (solo cuando el campo neto cambia por el usuario)
        // manejado en listener específico

        // autopopulate (solo si coincide exacto o si seleccionó del datalist y sale del campo)
        const p = findProductByName(line.producto);
        if (p) {
          // Modo y defaults SOLO si producto exacto (sin cambiar texto)
          // Si precio vacío, rellenar
          if (!line.origen && p.origen) line.origen = p.origen;
          if (!line.taraId && p.taraDefaultId) line.taraId = p.taraDefaultId;

          // Si el usuario no puso precio, usar default según modo (si existe)
          if (line.precio === null || line.precio === 0) {
            const defP = getDefaultPriceForMode(p, line.modo);
            if (defP) line.precio = defP;
          }

          // si modo = caja y p.kgCaja existe -> neto informativo si no manual
          if (line.modo === 'caja' && !line.netoManual) {
            const kgc = parseNum(p.kgCaja) || 0;
            if (kgc > 0 && line.cantidad !== null) {
              line.neto = round2((line.cantidad || 0) * kgc);
            }
          }
        }

        // Tara auto (si hay taraId y cantidad)
        const t = line.taraId ? S.taras.find(x=>x.id===line.taraId) : null;
        const taraUnit = t ? (parseNum(t.peso) || 0) : 0;
        const envasesAuto = (parseNum(line.cantidad) || 0); // regla: envases = cantidad (kg/caja/ud)
        const taraAuto = round3(envasesAuto * taraUnit);

        // Aplicación: en modo KG, tara total se aplica a neto (si neto no manual)
        if (line.modo === 'kg') {
          if (t) {
            // si el usuario no tocó taraKg manual o si está vacío -> poner tara auto
            if (line.taraKg === null || line.taraKg === 0 || Math.abs((line.taraKg||0) - taraAuto) > 0.0001) {
              // taraKg se mantiene editable, pero por defecto se sincroniza a auto
              line.taraKg = taraAuto;
            }
          }
          if (!line.netoManual) {
            const bruto = parseNum(line.bruto) || 0;
            const taraTot = parseNum(line.taraKg) || 0;
            line.neto = round2(bruto - taraTot);
          }
        } else {
          // En caja/ud: tara es informativa (no afecta importe). Neto informativo se maneja arriba.
          if (t && (line.taraKg === null || line.taraKg === 0)) line.taraKg = taraAuto;
          if (line.modo === 'ud' && !line.netoManual) {
            // neto no aplica -> dejar tal cual si el usuario lo puso; si no, vacío
            if (line.neto === null) line.neto = null;
          }
        }

        // push back to inputs (sin saltos de foco)
        inpTaraKg.value = (line.taraKg ?? '');
        if (!line.netoManual) inpNeto.value = (line.neto ?? '');
        inpPrecio.value = (line.precio ?? '');
        inpOrigen.value = line.origen || '';
        selTara.value = line.taraId || '';

        // hints
        const p2 = findProductByName(line.producto);
        const last2 = getLastPriceHint(p2?.id);
        hintLast.textContent = `Último: ${last2 ? fmtNum2(last2.precio) : '—'}`;
        hintHist.textContent = `Hist: ${formatHistHint(p2?.id)}`;
        microPrecio.textContent = p2 ? `Def: ${fmtNum2(getDefaultPriceForMode(p2, line.modo) || 0)}` : '—';
        microNeto.textContent = line.netoManual ? 'Manual' : 'Auto';

        // update view
        const calc2 = calcLineFromState(line);
        impEl.textContent = fmtMoney(calc2.importe);
        warnEl.textContent = calc2.warnings.join(' · ') || '';
        microTara.textContent = `Auto: ${fmtNum2(calc2.taraAuto)} kg`;

        // recalc totals + QR
        recalcAll(false);
      };

      // Enter flow pro: SOLO con Enter, no al escribir números
      const focusables = [inpProd, selModo, inpCant, inpBruto, selTara, inpTaraKg, inpNeto, inpPrecio, inpOrigen];
      const focusNext = (current) => {
        const i = focusables.indexOf(current);
        if (i < 0) return;
        if (i === focusables.length - 1) {
          // al final: crear nueva línea y focus producto
          addLine();
          // focus en el último
          setTimeout(()=>{
            const rows = $$('#gridBody .gridRow');
            const lastRow = rows[rows.length-1];
            const prod = lastRow ? $('.input--prod', lastRow) : null;
            prod && prod.focus();
          }, 0);
          return;
        }
        const next = focusables[i+1];
        next && next.focus();
      };

      const bindEnterFlow = (el) => {
        on(el, 'keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            focusNext(el);
          }
        });
        // IMPORTANT: escribir números NO cambia campo (no hacemos nada)
      };

      focusables.forEach(bindEnterFlow);

      // Update triggers
      on(inpProd, 'input', () => { /* no auto replace */ });
      on(inpProd, 'blur', () => { recalcThis(); });
      on(selModo, 'change', () => { line.netoManual = false; recalcThis(); });
      on(inpCant, 'input', () => recalcThis());
      on(inpBruto, 'input', () => recalcThis());
      on(selTara, 'change', () => { recalcThis(); });
      on(inpTaraKg, 'input', () => { recalcThis(); });

      on(inpNeto, 'input', () => {
        // neto manual: si el usuario lo edita, se respeta
        line.netoManual = true;
        microNeto.textContent = 'Manual';
        recalcThis();
      });

      on(inpPrecio, 'input', () => recalcThis());
      on(inpOrigen, 'input', () => recalcThis());

      on(btnDel, 'click', () => {
        // eliminar línea
        const idx2 = CUR.lineas.findIndex(x=>x.id===line.id);
        if (idx2 >= 0) CUR.lineas.splice(idx2,1);
        renderGrid();
        recalcAll();
      });

      body.appendChild(node);
    });
  }

  function addLine(){
    CUR.lineas.push(blankLine());
    renderGrid();
  }

  function clearLinesTo5(){
    CUR.lineas = [blankLine(), blankLine(), blankLine(), blankLine(), blankLine()];
    renderGrid();
    recalcAll();
  }

  function findProductByName(name){
    const n = (name||'').trim().toLowerCase();
    if (!n) return null;
    return S.productos.find(p => (p.nombre||'').trim().toLowerCase() === n) || null;
  }

  function getDefaultPriceForMode(p, modo){
    if (!p) return 0;
    if (modo === 'kg') return parseNum(p.precioKg) || 0;
    if (modo === 'caja') return parseNum(p.precioCaja) || 0;
    if (modo === 'ud') return parseNum(p.precioUd) || 0;
    return 0;
  }

  function getLastPriceHint(productId){
    if (!productId) return null;
    const arr = S.pricehist[productId];
    if (!Array.isArray(arr) || arr.length===0) return null;
    return arr[0];
  }

  function formatHistHint(productId){
    if (!productId) return '—';
    const arr = S.pricehist[productId];
    if (!Array.isArray(arr) || arr.length===0) return '—';
    return arr.slice(0,5).map(x => fmtNum2(x.precio)).join(' · ');
  }

  function calcLineFromState(line){
    const warnings = [];
    const modo = line.modo || 'kg';
    const cant = parseNum(line.cantidad) || 0;
    const bruto = parseNum(line.bruto) || 0;
    const precio = parseNum(line.precio);

    const taraObj = line.taraId ? S.taras.find(t=>t.id===line.taraId) : null;
    const taraUnit = taraObj ? (parseNum(taraObj.peso) || 0) : 0;
    const taraAuto = round3(cant * taraUnit);

    let taraTot = parseNum(line.taraKg);
    if (taraTot === null) taraTot = (taraObj ? taraAuto : 0);

    let neto = parseNum(line.neto);
    if (modo === 'kg'){
      if (!line.netoManual) neto = round2(bruto - taraTot);
      if (taraTot > bruto + 0.0001) warnings.push('Tara > Bruto');
      if (neto > bruto + 0.0001) warnings.push('Neto > Bruto');
      if (precio === null) warnings.push('Precio vacío');
      const imp = round2((neto || 0) * (precio || 0));
      return { importe: imp, warnings, taraAuto, taraTot, neto };
    }

    if (modo === 'caja'){
      if (precio === null) warnings.push('Precio vacío');
      const imp = round2(cant * (precio || 0));
      return { importe: imp, warnings, taraAuto, taraTot, neto };
    }

    // ud
    if (precio === null) warnings.push('Precio vacío');
    const imp = round2(cant * (precio || 0));
    return { importe: imp, warnings, taraAuto, taraTot, neto };
  }

  /* =========================================================
     10) TOTALS + ESTADO + QR
  ========================================================== */
  function sumPagos(){
    return (CUR.pagos||[]).reduce((a,p)=> a + (parseNum(p.importe)||0), 0);
  }

  function recalcAll(refreshQrNow=true){
    // recompute lines
    let subtotal = 0;
    (CUR.lineas||[]).forEach(l => {
      const calc = calcLineFromState(l);
      l.importe = calc.importe;
      l.warnings = calc.warnings;
      subtotal += calc.importe;
    });
    subtotal = round2(subtotal);

    const transporteOn = !!CUR.transporteOn;
    const transportePct = parseNum(CUR.transportePct) || 0;
    const transporte = transporteOn ? round2(subtotal * (transportePct/100)) : 0;

    const ivaIncluido = !!CUR.ivaIncluido;
    const ivaPct = parseNum(CUR.ivaPct) || 0;

    let iva = 0;
    let total = 0;

    if (ivaIncluido){
      iva = 0; // sin desglose en factura
      total = round2(subtotal + transporte);
      $('#ivaNotaPdf') && ($('#ivaNotaPdf').textContent = 'IVA incluido en los precios');
    }else{
      iva = round2((subtotal + transporte) * (ivaPct/100));
      total = round2(subtotal + transporte + iva);
      $('#ivaNotaPdf') && ($('#ivaNotaPdf').textContent = `IVA ${fmtNum2(ivaPct)}%`);
    }

    const pagos = sumPagos();
    const pendiente = round2(total - pagos);

    CUR.totals = { subtotal, transporte, iva, total, pendiente };

    // estado
    let estado = 'impagada';
    if (pendiente <= 0.01 && total > 0) estado = 'pagada';
    else if (pagos > 0.01 && pendiente > 0.01) estado = 'parcial';
    CUR.estado = estado;

    // UI totals
    $('#tSubtotal') && ($('#tSubtotal').textContent = fmtMoney(subtotal));
    $('#tTransporte') && ($('#tTransporte').textContent = fmtMoney(transporte));
    $('#tIva') && ($('#tIva').textContent = fmtMoney(iva));
    $('#tTotal') && ($('#tTotal').textContent = fmtMoney(total));
    $('#tPendiente') && ($('#tPendiente').textContent = fmtMoney(pendiente));
    $('#chipEstado') && ($('#chipEstado').textContent = `Estado: ${estado}`);
    $('#chipPendiente') && ($('#chipPendiente').textContent = `Pendiente: ${fmtMoney(pendiente)}`);
    $('#statusPill') && ($('#statusPill').textContent = estado.toUpperCase());

    if (refreshQrNow) refreshQr();

    return CUR.totals;
  }

  function refreshQr(){
    const qrTextArea = $('#qrTexto');
    const fallback = $('#qrFallback');

    // Validación: si falta NIF proveedor, num, fecha o total -> aviso
    const nif = (S.provider.nif || '').trim();
    const num = (CUR.numero || '').trim();
    const fecha = (CUR.fecha || '').trim();
    const total = (CUR.totals?.total ?? 0);

    const missing = [];
    if (!nif) missing.push('NIF');
    if (!num) missing.push('Nº');
    if (!fecha) missing.push('Fecha');
    if (!(isFinite(total) && total > 0)) missing.push('Total');

    // Construir texto QR con plantilla
    const base = (S.settings.qrBase || DEFAULT_SETTINGS.qrBase || '').trim();
    const text = base
      .replaceAll('{NIF}', nif)
      .replaceAll('{NUM}', num)
      .replaceAll('{FECHA}', fmtDateES(fecha))
      .replaceAll('{TOTAL}', fmtNum2(total));

    qrTextArea && (qrTextArea.value = text);

    if (missing.length){
      // No generar QR si faltan datos críticos
      if (fallback) fallback.classList.remove('is-hidden');
      const canvas = $('#qrCanvas');
      if (canvas){
        const ctx = canvas.getContext('2d', {alpha:false});
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      return;
    }

    // Generar QR real
    try{
      drawQrToCanvas(text);
    }catch(e){
      if (fallback) fallback.classList.remove('is-hidden');
    }
  }

  /* =========================================================
     11) PAGOS
  ========================================================== */
  function renderPagos(){
    const list = $('#payList');
    const count = $('#payCount');
    if (!list) return;

    list.innerHTML = '';
    const pagos = Array.isArray(CUR.pagos) ? CUR.pagos : [];
    count && (count.textContent = String(pagos.length));

    pagos.forEach(p => {
      const it = document.createElement('div');
      it.className = 'payItem';
      const d = fmtDateES(p.fecha);
      const imp = fmtMoney(parseNum(p.importe)||0);
      it.innerHTML = `
        <div>
          <strong>${escapeHtml(imp)}</strong>
          <div class="muted">${escapeHtml(d)}</div>
        </div>
        <button class="btn btn--danger" type="button">Quitar</button>
      `;
      const btn = $('button', it);
      on(btn, 'click', () => {
        const i = CUR.pagos.findIndex(x=>x.id===p.id);
        if (i>=0) CUR.pagos.splice(i,1);
        renderPagos();
        recalcAll();
      });
      list.appendChild(it);
    });
  }

  function addPago(){
    const imp = parseNum($('#payImporte')?.value);
    const fecha = $('#payFecha')?.value || isoToday();
    if (!imp || imp <= 0){
      toast('Pago', 'Importe inválido');
      return;
    }
    CUR.pagos = CUR.pagos || [];
    CUR.pagos.unshift({ id: uid(), importe: round2(imp), fecha });
    $('#payImporte').value = '';
    $('#payFecha').value = '';
    renderPagos();
    recalcAll();
  }

  /* =========================================================
     12) FACTURAS LIST + FILTROS
  ========================================================== */
  function renderFacturasList(filtered=null){
    const wrap = $('#facturasList');
    const cnt = $('#facturasCount');
    if (!wrap) return;
    const arr = filtered || S.facturas;
    cnt && (cnt.textContent = String(arr.length));
    wrap.innerHTML = '';

    arr.forEach(f => {
      const it = document.createElement('div');
      it.className = 'item';
      const cliName = (f.clienteSnapshot?.nombre) || (S.clientes.find(c=>c.id===f.clienteId)?.nombre) || '—';
      const tags = (f.tags||'').trim();
      const estado = (f.estado||'impagada');
      it.innerHTML = `
        <div class="item__main">
          <div class="item__title">${escapeHtml(f.numero || '')}</div>
          <div class="item__sub">${escapeHtml(fmtDateES(f.fecha))} · ${escapeHtml(cliName)}</div>
          <div class="item__meta">
            <span class="pill">${escapeHtml(estado)}</span>
            <span class="pill">${escapeHtml(fmtMoney(f.totals?.total ?? 0))}</span>
            ${tags ? `<span class="pill">${escapeHtml(tags)}</span>` : ''}
          </div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary" type="button">Editar</button>
          <button class="btn" type="button">Ver PDF</button>
        </div>
      `;
      const [bEdit, bPdf] = $$('.btn', it);
      on(bEdit, 'click', () => {
        setCurrentFactura(f);
        openTab('tabFactura');
      });
      on(bPdf, 'click', () => {
        // PARTE 4: visor real. Aquí: si hay URL en factura, lo mostramos; si no, aviso.
        if (f.pdf?.url){
          openPdfModal(f.pdf.url);
        } else {
          toast('PDF', 'Genera el PDF (PARTE 4 lo deja PRO multipágina).');
        }
      });
      wrap.appendChild(it);
    });
  }

  function applyFacturaFilters(){
    const num = ($('#filtroNum')?.value||'').trim().toLowerCase();
    const cliente = ($('#filtroCliente')?.value||'').trim().toLowerCase();
    const tags = ($('#filtroTags')?.value||'').trim().toLowerCase();
    const desde = $('#filtroDesde')?.value || '';
    const hasta = $('#filtroHasta')?.value || '';

    const out = S.facturas.filter(f => {
      const okNum = !num || (f.numero||'').toLowerCase().includes(num);
      const cliName = ((f.clienteSnapshot?.nombre)||'').toLowerCase() + ' ' + ((f.clienteSnapshot?.nif)||'').toLowerCase();
      const okCli = !cliente || cliName.includes(cliente);
      const okTags = !tags || ((f.tags||'').toLowerCase().includes(tags));
      const okDesde = !desde || (f.fecha >= desde);
      const okHasta = !hasta || (f.fecha <= hasta);
      return okNum && okCli && okTags && okDesde && okHasta;
    });

    renderFacturasList(out);
  }

  /* =========================================================
     13) CLIENTES CRUD
  ========================================================== */
  function renderClientesList(){
    const wrap = $('#clientesList');
    if (!wrap) return;
    const q = ($('#clientesSearch')?.value||'').trim().toLowerCase();
    const arr = S.clientes
      .slice()
      .filter(c => !q || (c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q) || (c.alias||'').toLowerCase().includes(q))
      .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'));
    wrap.innerHTML = '';
    arr.forEach(c => {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `
        <div class="item__main">
          <div class="item__title">${escapeHtml(c.nombre)}</div>
          <div class="item__sub">${escapeHtml(c.nif||'')} ${c.alias?`· ${escapeHtml(c.alias)}`:''}</div>
          <div class="item__sub">${escapeHtml(c.dir||'')}</div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary" type="button">Abrir</button>
        </div>
      `;
      on($('.btn', it), 'click', () => loadClienteToForm(c));
      wrap.appendChild(it);
    });
  }

  function loadClienteToForm(c){
    $('#cliId') && ($('#cliId').value = c.id);
    $('#cNombre') && ($('#cNombre').value = c.nombre||'');
    $('#cAlias') && ($('#cAlias').value = c.alias||'');
    $('#cNif') && ($('#cNif').value = c.nif||'');
    $('#cDir') && ($('#cDir').value = c.dir||'');
    $('#cTel') && ($('#cTel').value = c.tel||'');
    $('#cEmail') && ($('#cEmail').value = c.email||'');
    $('#cNotas') && ($('#cNotas').value = c.notas||'');

    const pl = c.plantillas || {};
    $('#cIvaIncluido') && ($('#cIvaIncluido').value = pl.ivaIncluido || 'auto');
    $('#cTransporte') && ($('#cTransporte').value = pl.transporte || 'auto');
    $('#cPago') && ($('#cPago').value = pl.metodoPago || '');
    $('#cTagsAuto') && ($('#cTagsAuto').value = pl.tagsAuto || '');
    $('#cNotaStd') && ($('#cNotaStd').value = pl.notaStd || '');
  }

  function newClienteForm(){
    $('#cliId') && ($('#cliId').value = '');
    ['#cNombre','#cAlias','#cNif','#cDir','#cTel','#cEmail','#cNotas','#cTagsAuto','#cNotaStd'].forEach(id => { if($(id)) $(id).value=''; });
    $('#cIvaIncluido') && ($('#cIvaIncluido').value = 'auto');
    $('#cTransporte') && ($('#cTransporte').value = 'auto');
    $('#cPago') && ($('#cPago').value = '');
  }

  function saveClienteFromForm(){
    const id = $('#cliId')?.value || '';
    const c = {
      id: id || uid(),
      nombre: $('#cNombre')?.value?.trim() || '',
      alias: $('#cAlias')?.value?.trim() || '',
      nif: $('#cNif')?.value?.trim() || '',
      dir: $('#cDir')?.value?.trim() || '',
      tel: $('#cTel')?.value?.trim() || '',
      email: $('#cEmail')?.value?.trim() || '',
      notas: $('#cNotas')?.value?.trim() || '',
      pago: '',
      plantillas: {
        ivaIncluido: $('#cIvaIncluido')?.value || 'auto',
        transporte: $('#cTransporte')?.value || 'auto',
        metodoPago: $('#cPago')?.value || '',
        tagsAuto: $('#cTagsAuto')?.value?.trim() || '',
        notaStd: $('#cNotaStd')?.value?.trim() || ''
      }
    };
    if (!c.nombre){
      toast('Cliente', 'Nombre requerido');
      return;
    }
    const idx = S.clientes.findIndex(x=>x.id===c.id);
    if (idx>=0) S.clientes[idx]=c;
    else S.clientes.unshift(c);

    save(K.clientes, S.clientes);
    renderClientesList();
    renderClienteSelect();
    toast('Cliente', 'Guardado');
  }

  function canDeleteCliente(id){
    return !S.facturas.some(f => f.clienteId === id);
  }

  function deleteClienteFromForm(){
    const id = $('#cliId')?.value || '';
    if (!id) return;
    if (!canDeleteCliente(id)){
      toast('Cliente', 'No se puede borrar: usado en facturas');
      return;
    }
    const idx = S.clientes.findIndex(x=>x.id===id);
    if (idx>=0) S.clientes.splice(idx,1);
    save(K.clientes, S.clientes);
    newClienteForm();
    renderClientesList();
    renderClienteSelect();
    toast('Cliente', 'Eliminado');
  }

  /* =========================================================
     14) PRODUCTOS CRUD
  ========================================================== */
  function renderProductosList(){
    const wrap = $('#productosList');
    if (!wrap) return;
    const q = ($('#productosSearch')?.value||'').trim().toLowerCase();
    const arr = S.productos
      .slice()
      .filter(p => !q || (p.nombre||'').toLowerCase().includes(q))
      .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'));

    wrap.innerHTML = '';
    arr.forEach(p => {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `
        <div class="item__main">
          <div class="item__title">${escapeHtml(p.nombre)}</div>
          <div class="item__sub">Modo: ${escapeHtml(p.modo||'kg')} · Kg/caja: ${escapeHtml(fmtNum2(parseNum(p.kgCaja)||0))}</div>
          <div class="item__sub">€kg ${escapeHtml(fmtNum2(parseNum(p.precioKg)||0))} · €caja ${escapeHtml(fmtNum2(parseNum(p.precioCaja)||0))} · €ud ${escapeHtml(fmtNum2(parseNum(p.precioUd)||0))}</div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary" type="button">Abrir</button>
        </div>
      `;
      on($('.btn', it), 'click', () => loadProductoToForm(p));
      wrap.appendChild(it);
    });
  }

  function loadProductoToForm(p){
    $('#pId') && ($('#pId').value = p.id);
    $('#pNombre') && ($('#pNombre').value = p.nombre||'');
    $('#pModo') && ($('#pModo').value = p.modo||'kg');
    $('#pKgCaja') && ($('#pKgCaja').value = (p.kgCaja ?? ''));
    $('#pPrecioKg') && ($('#pPrecioKg').value = (p.precioKg ?? ''));
    $('#pPrecioCaja') && ($('#pPrecioCaja').value = (p.precioCaja ?? ''));
    $('#pPrecioUd') && ($('#pPrecioUd').value = (p.precioUd ?? ''));
    $('#pCoste') && ($('#pCoste').value = (p.coste ?? ''));
    $('#pOrigen') && ($('#pOrigen').value = (p.origen ?? ''));
    $('#pTaraDefault') && ($('#pTaraDefault').value = (p.taraDefaultId ?? ''));
    $('#pHistorial') && ($('#pHistorial').textContent = formatHistHint(p.id));
  }

  function newProductoForm(){
    $('#pId') && ($('#pId').value = '');
    ['#pNombre','#pKgCaja','#pPrecioKg','#pPrecioCaja','#pPrecioUd','#pCoste','#pOrigen'].forEach(id => { if($(id)) $(id).value=''; });
    $('#pModo') && ($('#pModo').value = 'kg');
    $('#pTaraDefault') && ($('#pTaraDefault').value = '');
    $('#pHistorial') && ($('#pHistorial').textContent = '—');
  }

  function saveProductoFromForm(){
    const id = $('#pId')?.value || '';
    const p = {
      id: id || uid(),
      nombre: $('#pNombre')?.value?.trim() || '',
      modo: $('#pModo')?.value || 'kg',
      kgCaja: parseNum($('#pKgCaja')?.value) || 0,
      precioKg: parseNum($('#pPrecioKg')?.value) || 0,
      precioCaja: parseNum($('#pPrecioCaja')?.value) || 0,
      precioUd: parseNum($('#pPrecioUd')?.value) || 0,
      coste: parseNum($('#pCoste')?.value) || 0,
      origen: $('#pOrigen')?.value?.trim() || '',
      taraDefaultId: $('#pTaraDefault')?.value || ''
    };
    if (!p.nombre){
      toast('Producto', 'Nombre requerido');
      return;
    }
    const idx = S.productos.findIndex(x=>x.id===p.id);
    if (idx>=0) S.productos[idx]=p;
    else S.productos.unshift(p);

    save(K.productos, S.productos);
    ensureProductDatalist(); // actualizar datalist
    const dl = $('#dlProducts');
    if (dl) dl.remove();
    ensureProductDatalist();

    renderProductosList();
    toast('Producto', 'Guardado');
  }

  function canDeleteProducto(id){
    const used = S.facturas.some(f => (f.lineas||[]).some(l => {
      const p = findProductByName(l.producto);
      return p && p.id === id;
    }));
    return !used;
  }

  function deleteProductoFromForm(){
    const id = $('#pId')?.value || '';
    if (!id) return;
    if (!canDeleteProducto(id)){
      toast('Producto', 'No se puede borrar: usado en facturas');
      return;
    }
    const idx = S.productos.findIndex(x=>x.id===id);
    if (idx>=0) S.productos.splice(idx,1);
    save(K.productos, S.productos);

    const dl = $('#dlProducts');
    if (dl) dl.remove();
    ensureProductDatalist();

    newProductoForm();
    renderProductosList();
    toast('Producto', 'Eliminado');
  }

  /* =========================================================
     15) TARAS CRUD
  ========================================================== */
  function renderTarasList(){
    const wrap = $('#tarasList');
    if (!wrap) return;
    const q = ($('#tarasSearch')?.value||'').trim().toLowerCase();
    const arr = S.taras
      .slice()
      .filter(t => !q || (t.nombre||'').toLowerCase().includes(q))
      .sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'','es'));
    wrap.innerHTML = '';
    arr.forEach(t => {
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `
        <div class="item__main">
          <div class="item__title">${escapeHtml(t.nombre)}</div>
          <div class="item__sub">${escapeHtml(fmtNum2(parseNum(t.peso)||0))} kg · ${escapeHtml(t.notas||'')}</div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary" type="button">Abrir</button>
        </div>
      `;
      on($('.btn', it), 'click', () => loadTaraToForm(t));
      wrap.appendChild(it);
    });
  }

  function loadTaraToForm(t){
    $('#tId') && ($('#tId').value = t.id);
    $('#tNombre') && ($('#tNombre').value = t.nombre||'');
    $('#tPeso') && ($('#tPeso').value = (t.peso ?? ''));
    $('#tNotas') && ($('#tNotas').value = t.notas||'');
  }

  function newTaraForm(){
    $('#tId') && ($('#tId').value = '');
    ['#tNombre','#tPeso','#tNotas'].forEach(id => { if($(id)) $(id).value=''; });
  }

  function saveTaraFromForm(){
    const id = $('#tId')?.value || '';
    const t = {
      id: id || uid(),
      nombre: $('#tNombre')?.value?.trim() || '',
      peso: parseNum($('#tPeso')?.value) || 0,
      notas: $('#tNotas')?.value?.trim() || ''
    };
    if (!t.nombre){
      toast('Tara', 'Nombre requerido');
      return;
    }
    const idx = S.taras.findIndex(x=>x.id===t.id);
    if (idx>=0) S.taras[idx]=t;
    else S.taras.unshift(t);

    save(K.taras, S.taras);
    renderTarasList();
    renderTaraSelects();
    renderGrid(); // refrescar selects de líneas
    toast('Tara', 'Guardada');
  }

  function deleteTaraFromForm(){
    const id = $('#tId')?.value || '';
    if (!id) return;
    // Si está asignada en productos, la dejamos (no borramos para no romper)
    const used = S.productos.some(p => p.taraDefaultId === id) ||
      S.facturas.some(f => (f.lineas||[]).some(l => l.taraId === id));
    if (used){
      toast('Tara', 'No se puede borrar: usada en productos/facturas');
      return;
    }
    const idx = S.taras.findIndex(x=>x.id===id);
    if (idx>=0) S.taras.splice(idx,1);
    save(K.taras, S.taras);
    newTaraForm();
    renderTarasList();
    renderTaraSelects();
    renderGrid();
    toast('Tara', 'Eliminada');
  }

  /* =========================================================
     16) PRICE HISTORY (solo pantalla)
  ========================================================== */
  function tryUpdatePriceHistoryFromInvoice(inv){
    const lines = inv.lineas || [];
    lines.forEach(l => {
      const p = findProductByName(l.producto);
      const precio = parseNum(l.precio);
      if (!p || !precio || precio <= 0) return;
      const arr = Array.isArray(S.pricehist[p.id]) ? S.pricehist[p.id] : [];
      // evitar duplicado exacto consecutivo
      if (arr[0] && Math.abs((arr[0].precio||0) - precio) < 0.0001 && arr[0].modo === l.modo) return;
      arr.unshift({ ts: Date.now(), modo: l.modo, precio: round2(precio) });
      S.pricehist[p.id] = arr.slice(0, 5);
    });
    save(K.pricehist, S.pricehist);
  }

  /* =========================================================
     17) AJUSTES
  ========================================================== */
  function renderAjustes(){
    $('#ajIvaPct') && ($('#ajIvaPct').value = S.settings.ivaPct ?? 4);
    $('#ajTransportePct') && ($('#ajTransportePct').value = S.settings.transportePct ?? 10);
    $('#ajPin') && ($('#ajPin').value = S.settings.pin ?? '8410');
    $('#ajQrBase') && ($('#ajQrBase').value = S.settings.qrBase ?? DEFAULT_SETTINGS.qrBase);
    $('#ajCloudOn') && ($('#ajCloudOn').checked = !!S.settings.cloud?.enabled);

    $('#fbApiKey') && ($('#fbApiKey').value = S.settings.cloud?.apiKey || '');
    $('#fbAuthDomain') && ($('#fbAuthDomain').value = S.settings.cloud?.authDomain || '');
    $('#fbDbUrl') && ($('#fbDbUrl').value = S.settings.cloud?.databaseURL || '');
    $('#fbProjectId') && ($('#fbProjectId').value = S.settings.cloud?.projectId || '');
    $('#fbAppId') && ($('#fbAppId').value = S.settings.cloud?.appId || '');
    $('#fbStorage') && ($('#fbStorage').value = S.settings.cloud?.storageBucket || '');

    $('#diagMode') && ($('#diagMode').textContent = 'Local');
    $('#diagCloud') && ($('#diagCloud').textContent = S.settings.cloud?.enabled ? 'On' : 'Off');
  }

  function saveAjustes(){
    S.settings.ivaPct = parseNum($('#ajIvaPct')?.value) ?? 4;
    S.settings.transportePct = parseNum($('#ajTransportePct')?.value) ?? 10;
    S.settings.pin = ($('#ajPin')?.value||'').trim() || '8410';
    S.settings.qrBase = ($('#ajQrBase')?.value||'').trim() || DEFAULT_SETTINGS.qrBase;

    S.settings.cloud = S.settings.cloud || {};
    S.settings.cloud.enabled = !!$('#ajCloudOn')?.checked;
    S.settings.cloud.apiKey = ($('#fbApiKey')?.value||'').trim();
    S.settings.cloud.authDomain = ($('#fbAuthDomain')?.value||'').trim();
    S.settings.cloud.databaseURL = ($('#fbDbUrl')?.value||'').trim();
    S.settings.cloud.projectId = ($('#fbProjectId')?.value||'').trim();
    S.settings.cloud.appId = ($('#fbAppId')?.value||'').trim();
    S.settings.cloud.storageBucket = ($('#fbStorage')?.value||'').trim();

    save(K.settings, S.settings);

    // aplicar defaults a factura actual si no tocados
    CUR.ivaPct = parseNum(CUR.ivaPct) ?? S.settings.ivaPct;
    CUR.transportePct = parseNum(CUR.transportePct) ?? S.settings.transportePct;

    renderAjustes();
    recalcAll();
    toast('Ajustes', 'Guardados');
  }

  function resetAjustes(){
    S.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    save(K.settings, S.settings);
    renderAjustes();
    recalcAll();
    toast('Ajustes', 'Reset');
  }

  /* =========================================================
     18) CONTABILIDAD (PIN) — BASE (dashboard PRO en PARTE 4)
  ========================================================== */
  function unlockIfPinOK(pin){
    const p = (pin||'').trim();
    return p && p === String(S.settings.pin || '8410');
  }

  function renderContabilidad(){
    if (!SESSION.contabUnlocked) return;

    const desde = $('#contabDesde')?.value || '';
    const hasta = $('#contabHasta')?.value || '';
    const cliente = ($('#contabCliente')?.value||'').trim().toLowerCase();
    const tag = ($('#contabTag')?.value||'').trim().toLowerCase();

    const arr = S.facturas.filter(f => {
      const okD = !desde || f.fecha >= desde;
      const okH = !hasta || f.fecha <= hasta;
      const cliName = ((f.clienteSnapshot?.nombre)||'').toLowerCase();
      const okC = !cliente || cliName.includes(cliente);
      const okT = !tag || ((f.tags||'').toLowerCase().includes(tag));
      return okD && okH && okC && okT;
    });

    let ventas = 0, iva = 0;
    arr.forEach(f => {
      ventas += (f.totals?.total || 0);
      iva += (f.totals?.iva || 0);
    });

    $('#kpiVentas') && ($('#kpiVentas').textContent = fmtMoney(ventas));
    $('#kpiIva') && ($('#kpiIva').textContent = fmtMoney(iva));
    $('#kpiNum') && ($('#kpiNum').textContent = String(arr.length));

    // tabla simple
    const wrap = $('#contabTable');
    if (wrap){
      const rows = arr
        .slice()
        .sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''))
        .map(f => ({
          fecha: fmtDateES(f.fecha),
          num: f.numero,
          cliente: (f.clienteSnapshot?.nombre) || '—',
          total: fmtMoney(f.totals?.total || 0),
          tags: f.tags || ''
        }));
      const html = `
        <table class="table">
          <thead><tr>
            <th>Fecha</th><th>Nº</th><th>Cliente</th><th>Total</th><th>Tags</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.fecha)}</td>
                <td>${escapeHtml(r.num)}</td>
                <td>${escapeHtml(r.cliente)}</td>
                <td class="num">${escapeHtml(r.total)}</td>
                <td>${escapeHtml(r.tags)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.innerHTML = html;
    }

    // dashboard mensual avanzado = PARTE 4
    $('#contabDashboard') && ($('#contabDashboard').innerHTML = `<div class="muted">Dashboard PRO mensual completo se activa en PARTE 4/4.</div>`);
  }

  /* =========================================================
     19) VENTAS DIARIAS (PIN) — BASE
  ========================================================== */
  function ventasGetByDate(date){
    return S.ventas.find(v => v.date === date) || null;
  }

  function ventasCalcDay(v){
    const spE = parseNum(v.sp?.ef) || 0, spT = parseNum(v.sp?.ta) || 0, spG = parseNum(v.sp?.ga) || 0;
    const slE = parseNum(v.sl?.ef) || 0, slT = parseNum(v.sl?.ta) || 0, slG = parseNum(v.sl?.ga) || 0;
    const saE = parseNum(v.sa?.ef) || 0, saT = parseNum(v.sa?.ta) || 0, saG = parseNum(v.sa?.ga) || 0;

    const spTot = round2(spE + spT - spG);
    const slTot = round2(slE + slT - slG);
    const saTot = round2(saE + saT - saG);

    const gE = round2(spE + slE + saE);
    const gT = round2(spT + slT + saT);
    const gG = round2(spG + slG + saG);
    const gTot = round2(gE + gT - gG);

    const ivaPct = parseNum(S.settings.ivaPct) || 4;
    // IVA cobrado estimado asumiendo ventas con IVA incluido:
    const ivaCob = round2(gTot * (ivaPct / (100 + ivaPct)));

    return { spTot, slTot, saTot, gE, gT, gG, gTot, ivaCob };
  }

  function renderVentasDayUI(){
    if (!SESSION.ventasUnlocked) return;
    const date = $('#vFecha')?.value || isoToday();
    $('#vDiaSemana') && ($('#vDiaSemana').textContent = dayNameES(date));

    const found = ventasGetByDate(date);
    const v = found || {
      date,
      sp:{ef:0,ta:0,ga:0},
      sl:{ef:0,ta:0,ga:0},
      sa:{ef:0,ta:0,ga:0}
    };

    // fill inputs
    $('#vSPef') && ($('#vSPef').value = v.sp?.ef ?? '');
    $('#vSPta') && ($('#vSPta').value = v.sp?.ta ?? '');
    $('#vSPga') && ($('#vSPga').value = v.sp?.ga ?? '');

    $('#vSLef') && ($('#vSLef').value = v.sl?.ef ?? '');
    $('#vSLta') && ($('#vSLta').value = v.sl?.ta ?? '');
    $('#vSLga') && ($('#vSLga').value = v.sl?.ga ?? '');

    $('#vSAef') && ($('#vSAef').value = v.sa?.ef ?? '');
    $('#vSAta') && ($('#vSAta').value = v.sa?.ta ?? '');
    $('#vSAga') && ($('#vSAga').value = v.sa?.ga ?? '');

    // calc summary
    const c = ventasCalcDay(v);
    $('#vSPtot') && ($('#vSPtot').textContent = fmtMoney(c.spTot));
    $('#vSLtot') && ($('#vSLtot').textContent = fmtMoney(c.slTot));
    $('#vSAtot') && ($('#vSAtot').textContent = fmtMoney(c.saTot));

    $('#vGlobalEfe') && ($('#vGlobalEfe').textContent = fmtMoney(c.gE));
    $('#vGlobalTar') && ($('#vGlobalTar').textContent = fmtMoney(c.gT));
    $('#vGlobalGas') && ($('#vGlobalGas').textContent = fmtMoney(c.gG));
    $('#vGlobalTot') && ($('#vGlobalTot').textContent = fmtMoney(c.gTot));
    $('#vIvaCobrado') && ($('#vIvaCobrado').textContent = fmtMoney(c.ivaCob));
  }

  function ventasReadUI(){
    const date = $('#vFecha')?.value || isoToday();
    const v = {
      date,
      sp:{ ef: parseNum($('#vSPef')?.value)||0, ta: parseNum($('#vSPta')?.value)||0, ga: parseNum($('#vSPga')?.value)||0 },
      sl:{ ef: parseNum($('#vSLef')?.value)||0, ta: parseNum($('#vSLta')?.value)||0, ga: parseNum($('#vSLga')?.value)||0 },
      sa:{ ef: parseNum($('#vSAef')?.value)||0, ta: parseNum($('#vSAta')?.value)||0, ga: parseNum($('#vSAga')?.value)||0 }
    };
    return v;
  }

  function ventasSaveDay(){
    const v = ventasReadUI();
    const idx = S.ventas.findIndex(x=>x.date===v.date);
    if (idx>=0) S.ventas[idx]=v;
    else S.ventas.push(v);
    S.ventas.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
    save(K.ventas, S.ventas);
    renderVentasList();
    renderVentasReport();
    toast('Ventas', `Guardado ${fmtDateES(v.date)}`);
  }

  function ventasDeleteDay(){
    const date = $('#vFecha')?.value || '';
    if (!date) return;
    const idx = S.ventas.findIndex(x=>x.date===date);
    if (idx>=0) {
      S.ventas.splice(idx,1);
      save(K.ventas, S.ventas);
      renderVentasList();
      renderVentasReport();
      toast('Ventas', `Eliminado ${fmtDateES(date)}`);
      renderVentasDayUI();
    }
  }

  function renderVentasList(){
    if (!SESSION.ventasUnlocked) return;
    const wrap = $('#ventasList');
    const cnt = $('#ventasCount');
    if (!wrap) return;
    const arr = S.ventas.slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    cnt && (cnt.textContent = String(arr.length));
    wrap.innerHTML = '';

    arr.forEach(v => {
      const c = ventasCalcDay(v);
      const it = document.createElement('div');
      it.className = 'item';
      it.innerHTML = `
        <div class="item__main">
          <div class="item__title">${escapeHtml(fmtDateES(v.date))} · ${escapeHtml(dayNameES(v.date))}</div>
          <div class="item__sub">Efectivo ${escapeHtml(fmtMoney(c.gE))} · Tarjeta ${escapeHtml(fmtMoney(c.gT))} · Gastos ${escapeHtml(fmtMoney(c.gG))}</div>
          <div class="item__meta">
            <span class="pill">Total ${escapeHtml(fmtMoney(c.gTot))}</span>
            <span class="pill">IVA ${escapeHtml(fmtMoney(c.ivaCob))}</span>
          </div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary" type="button">Abrir</button>
        </div>
      `;
      on($('.btn', it), 'click', () => {
        $('#vFecha') && ($('#vFecha').value = v.date);
        renderVentasDayUI();
      });
      wrap.appendChild(it);
    });
  }

  function ventasRange(from,to){
    const arr = S.ventas.filter(v => (!from || v.date>=from) && (!to || v.date<=to));
    arr.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
    return arr;
  }

  function renderVentasReport(from=null,to=null){
    if (!SESSION.ventasUnlocked) return;
    const wrap = $('#ventasReport');
    if (!wrap) return;

    const d1 = from ?? ($('#vDesde')?.value||'');
    const d2 = to ?? ($('#vHasta')?.value||'');

    const arr = ventasRange(d1,d2);
    let gE=0,gT=0,gG=0,gTot=0,gIva=0;
    arr.forEach(v=>{
      const c = ventasCalcDay(v);
      gE += c.gE; gT += c.gT; gG += c.gG; gTot += c.gTot; gIva += c.ivaCob;
    });

    wrap.innerHTML = `
      <div class="item">
        <div class="item__main">
          <div class="item__title">Reporte ${escapeHtml(d1?fmtDateES(d1):'—')} → ${escapeHtml(d2?fmtDateES(d2):'—')}</div>
          <div class="item__sub">Días: ${escapeHtml(String(arr.length))}</div>
          <div class="item__meta">
            <span class="pill">Efectivo ${escapeHtml(fmtMoney(gE))}</span>
            <span class="pill">Tarjeta ${escapeHtml(fmtMoney(gT))}</span>
            <span class="pill">Gastos ${escapeHtml(fmtMoney(gG))}</span>
            <span class="pill">TOTAL ${escapeHtml(fmtMoney(gTot))}</span>
            <span class="pill">IVA ${escapeHtml(fmtMoney(gIva))}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* =========================================================
     20) MODALS (PDF / CONFIRM / HELP)
  ========================================================== */
  function openPdfModal(url){
    const modal = $('#pdfModal');
    const obj = $('#pdfObject');
    const frame = $('#pdfFrame');
    if (!modal) return;
    modal.classList.remove('is-hidden');
    if (obj) obj.data = url || '';
    if (frame) frame.src = url || '';
  }
  function closePdfModal(){
    const modal = $('#pdfModal');
    if (!modal) return;
    modal.classList.add('is-hidden');
  }

  function showHelp(){
    $('#helpModal')?.classList.remove('is-hidden');
  }
  function hideHelp(){
    $('#helpModal')?.classList.add('is-hidden');
  }

  // Confirm modal simple (usado para borrados críticos)
  let CONFIRM_CB = null;
  function confirmBox(title, text, cb){
    CONFIRM_CB = cb;
    $('#confirmTitle') && ($('#confirmTitle').textContent = title || 'Confirmar');
    $('#confirmText') && ($('#confirmText').textContent = text || '¿Seguro?');
    $('#confirmModal')?.classList.remove('is-hidden');
  }
  function closeConfirm(){
    $('#confirmModal')?.classList.add('is-hidden');
    CONFIRM_CB = null;
  }

  /* =========================================================
     21) TABS / GLOBAL SEARCH / SHORTCUTS
  ========================================================== */
  function openTab(id){
    $$('.panel').forEach(p => p.classList.remove('is-active'));
    $$('.tab').forEach(t => t.classList.remove('is-active'));
    $('#'+id)?.classList.add('is-active');
    $(`.tab[data-tab="${id}"]`)?.classList.add('is-active');

    // refresh per tab
    if (id === 'tabFacturas') renderFacturasList();
    if (id === 'tabClientes') renderClientesList();
    if (id === 'tabProductos') renderProductosList();
    if (id === 'tabTaras') renderTarasList();
    if (id === 'tabAjustes') renderAjustes();

    if (id === 'tabContabilidad') {
      if (SESSION.contabUnlocked) renderContabilidad();
    }
    if (id === 'tabVentas') {
      if (SESSION.ventasUnlocked) {
        if (!$('#vFecha')?.value) $('#vFecha').value = isoToday();
        renderVentasDayUI();
        renderVentasList();
        renderVentasReport();
      }
    }
  }

  function bindTabs(){
    $$('.tab').forEach(btn => {
      on(btn, 'click', () => {
        const target = btn.dataset.tab;
        if (!target) return;

        // Lock tabs
        if (target === 'tabContabilidad'){
          openTab('tabContabilidad');
          return;
        }
        if (target === 'tabVentas'){
          openTab('tabVentas');
          return;
        }
        openTab(target);
      });
    });
  }

  function globalSearchRun(){
    const q = ($('#globalSearch')?.value||'').trim();
    if (!q) return;
    // estrategia simple: abre Facturas y lo busca en Nº/cliente/tags
    openTab('tabFacturas');
    $('#filtroNum') && ($('#filtroNum').value = q);
    $('#filtroCliente') && ($('#filtroCliente').value = q);
    $('#filtroTags') && ($('#filtroTags').value = q);
    applyFacturaFilters();
  }

  function bindShortcuts(){
    on(document, 'keydown', (e) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      if (ctrl && e.key.toLowerCase() === 'f'){
        e.preventDefault();
        $('#globalSearch')?.focus();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 's'){
        e.preventDefault();
        saveCurrentFactura();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'p'){
        e.preventDefault();
        // PARTE 4: PDF PRO
        toast('PDF', 'PDF PRO (multipágina + suma y sigue) en PARTE 4/4');
        return;
      }
    });
  }

  /* =========================================================
     22) FACTURA ACTIONS
  ========================================================== */
  function applyClientePlantillasToFactura(cliente){
    if (!cliente || !cliente.plantillas) return;
    const pl = cliente.plantillas;

    if (pl.ivaIncluido === 'si') CUR.ivaIncluido = true;
    if (pl.ivaIncluido === 'no') CUR.ivaIncluido = false;

    if (pl.transporte === 'si') CUR.transporteOn = true;
    if (pl.transporte === 'no') CUR.transporteOn = false;

    if (pl.metodoPago) CUR.metodoPago = pl.metodoPago;

    if (pl.tagsAuto){
      const base = (CUR.tags||'').trim();
      CUR.tags = base ? (base + ', ' + pl.tagsAuto) : pl.tagsAuto;
    }
    if (pl.notaStd){
      const base = (CUR.observaciones||'').trim();
      CUR.observaciones = base ? (base + '\n' + pl.notaStd) : pl.notaStd;
    }
  }

  function facturaToWhatsAppText(){
    readFacturaFromUI();
    recalcAll();

    const cli = CUR.clienteSnapshot?.nombre || '—';
    const lines = (CUR.lineas||[])
      .filter(l => (l.producto||'').trim())
      .map(l => {
        const modo = l.modo || 'kg';
        const cant = parseNum(l.cantidad) || 0;
        const bruto = parseNum(l.bruto) || 0;
        const tara = parseNum(l.taraKg) || 0;
        const neto = parseNum(l.neto) || 0;
        const precio = parseNum(l.precio) || 0;
        const imp = l.importe || 0;
        if (modo==='kg') return `- ${l.producto} | cant ${cant} | bruto ${fmtNum2(bruto)} | tara ${fmtNum2(tara)} | neto ${fmtNum2(neto)} | ${fmtNum2(precio)} = ${fmtMoney(imp)}`;
        if (modo==='caja') return `- ${l.producto} | ${cant} caja | ${fmtNum2(precio)} = ${fmtMoney(imp)}`;
        return `- ${l.producto} | ${cant} ud | ${fmtNum2(precio)} = ${fmtMoney(imp)}`;
      });

    const t = CUR.totals;
    const msg = [
      `FACTURA ${CUR.numero}`,
      `Fecha: ${fmtDateES(CUR.fecha)}`,
      `Cliente: ${cli}`,
      '',
      ...lines,
      '',
      `Subtotal: ${fmtMoney(t.subtotal)}`,
      CUR.transporteOn ? `Transporte (${fmtNum2(CUR.transportePct)}%): ${fmtMoney(t.transporte)}` : '',
      CUR.ivaIncluido ? `IVA: incluido` : `IVA (${fmtNum2(CUR.ivaPct)}%): ${fmtMoney(t.iva)}`,
      `TOTAL: ${fmtMoney(t.total)}`,
      `Pendiente: ${fmtMoney(t.pendiente)}`
    ].filter(Boolean).join('\n');

    return msg;
  }

  function openWhatsApp(){
    const txt = facturaToWhatsAppText();
    const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
  }

  /* =========================================================
     23) PDF STUBS (PARTE 4 REAL)
  ========================================================== */
  function generatePdfStub(){
    toast('PDF', 'PDF PRO (tabla con alternancia + multipágina + suma y sigue) en PARTE 4/4');
  }
  function uploadPdfCloudStub(){
    toast('Cloud', 'PDF + Nube (Firebase Storage) en PARTE 4/4');
  }

  /* =========================================================
     24) CONTAB/Ventas LOCK BINDINGS
  ========================================================== */
  function bindLocks(){
    // Contabilidad unlock
    on($('#btnUnlockContab'), 'click', () => {
      const pin = $('#contabPin')?.value || '';
      if (unlockIfPinOK(pin)){
        SESSION.contabUnlocked = true;
        $('#contabLock')?.classList.add('is-hidden');
        $('#contabContent')?.classList.remove('is-hidden');
        $('#contabPin') && ($('#contabPin').value = '');
        renderContabilidad();
        toast('Contabilidad', 'Desbloqueada');
      } else {
        toast('PIN', 'Incorrecto');
      }
    });
    on($('#btnLockContab'), 'click', () => {
      SESSION.contabUnlocked = false;
      $('#contabContent')?.classList.add('is-hidden');
      $('#contabLock')?.classList.remove('is-hidden');
    });

    on($('#btnContabFiltrar'), 'click', () => renderContabilidad());
    on($('#btnContabLimpiar'), 'click', () => {
      ['#contabDesde','#contabHasta','#contabCliente','#contabTag'].forEach(id => { if($(id)) $(id).value=''; });
      renderContabilidad();
    });
    on($('#btnContabExportCsv'), 'click', () => {
      if (!SESSION.contabUnlocked) return;
      const rows = [['Fecha','Numero','Cliente','Total','Tags']];
      S.facturas.forEach(f => rows.push([fmtDateES(f.fecha), f.numero, f.clienteSnapshot?.nombre||'', fmtNum2(f.totals?.total||0), f.tags||'']));
      downloadCSV('contabilidad_facturas.csv', rows);
    });

    // Ventas unlock
    on($('#btnUnlockVentas'), 'click', () => {
      const pin = $('#ventasPin')?.value || '';
      if (unlockIfPinOK(pin)){
        SESSION.ventasUnlocked = true;
        $('#ventasLock')?.classList.add('is-hidden');
        $('#ventasContent')?.classList.remove('is-hidden');
        $('#ventasPin') && ($('#ventasPin').value = '');
        if (!$('#vFecha')?.value) $('#vFecha').value = isoToday();
        renderVentasDayUI();
        renderVentasList();
        renderVentasReport();
        toast('Ventas', 'Desbloqueadas');
      } else {
        toast('PIN', 'Incorrecto');
      }
    });
    on($('#btnLockVentas'), 'click', () => {
      SESSION.ventasUnlocked = false;
      $('#ventasContent')?.classList.add('is-hidden');
      $('#ventasLock')?.classList.remove('is-hidden');
    });

    // Ventas interactions
    const vInputs = ['#vSPef','#vSPta','#vSPga','#vSLef','#vSLta','#vSLga','#vSAef','#vSAta','#vSAga','#vFecha'];
    vInputs.forEach(id => on($(id), 'input', () => renderVentasDayUI()));
    on($('#vFecha'), 'change', () => renderVentasDayUI());

    on($('#btnVentasGuardar'), 'click', ventasSaveDay);
    on($('#btnVentasBorrarDia'), 'click', () => confirmBox('Eliminar día', '¿Eliminar este día de ventas?', () => ventasDeleteDay()));

    on($('#btnVentasAplicarRango'), 'click', () => renderVentasReport());
    on($('#btnVentasLimpiarRango'), 'click', () => { $('#vDesde').value=''; $('#vHasta').value=''; renderVentasReport(); });

    on($('#btnVentasExportCsv'), 'click', () => {
      if (!SESSION.ventasUnlocked) return;
      const rows = [['Fecha','Dia','SP_Efectivo','SP_Tarjeta','SP_Gastos','SL_Efectivo','SL_Tarjeta','SL_Gastos','SA_Efectivo','SA_Tarjeta','SA_Gastos','Global_Efectivo','Global_Tarjeta','Global_Gastos','Global_Total','IVA_Estimado']];
      S.ventas.slice().sort((a,b)=> (a.date||'').localeCompare(b.date||'')).forEach(v=>{
        const c = ventasCalcDay(v);
        rows.push([
          fmtDateES(v.date), dayNameES(v.date),
          fmtNum2(v.sp?.ef||0), fmtNum2(v.sp?.ta||0), fmtNum2(v.sp?.ga||0),
          fmtNum2(v.sl?.ef||0), fmtNum2(v.sl?.ta||0), fmtNum2(v.sl?.ga||0),
          fmtNum2(v.sa?.ef||0), fmtNum2(v.sa?.ta||0), fmtNum2(v.sa?.ga||0),
          fmtNum2(c.gE), fmtNum2(c.gT), fmtNum2(c.gG), fmtNum2(c.gTot), fmtNum2(c.ivaCob)
        ]);
      });
      downloadCSV('ventas_diarias.csv', rows);
    });
  }

  /* =========================================================
     25) BIND UI EVENTS
  ========================================================== */
  function bindUI(){
    // Tabs
    bindTabs();

    // Provider
    on($('#btnProvGuardar'), 'click', () => { readProviderUI(); toast('Proveedor', 'Guardado'); refreshQr(); });
    on($('#btnProvReset'), 'click', () => { S.provider = setProviderDefaultsIfEmpty({}); save(K.provider, S.provider); fillProviderUI(); refreshQr(); });

    // Cliente in factura
    on($('#facClienteSelect'), 'change', () => {
      const id = $('#facClienteSelect').value;
      CUR.clienteId = id;
      const cli = id ? S.clientes.find(c=>c.id===id) : null;
      if (cli){
        // rellenar inline
        $('#cliNombre').value = cli.nombre||'';
        $('#cliNif').value = cli.nif||'';
        $('#cliDir').value = cli.dir||'';
        $('#cliTel').value = cli.tel||'';
        $('#cliEmail').value = cli.email||'';
        applyClientePlantillasToFactura(cli);
        renderFactura(); // aplica cambios
      }
    });

    on($('#btnClienteNuevo'), 'click', () => {
      // crea cliente desde los campos inline
      const c = {
        id: uid(),
        nombre: ($('#cliNombre')?.value||'').trim(),
        alias: '',
        nif: ($('#cliNif')?.value||'').trim(),
        dir: ($('#cliDir')?.value||'').trim(),
        tel: ($('#cliTel')?.value||'').trim(),
        email: ($('#cliEmail')?.value||'').trim(),
        notas: '',
        pago: ($('#facMetodoPago')?.value || ''),
        plantillas: { ivaIncluido:'auto', transporte:'auto', metodoPago:($('#facMetodoPago')?.value||''), tagsAuto:'', notaStd:'' }
      };
      if (!c.nombre){ toast('Cliente', 'Nombre requerido'); return; }
      S.clientes.unshift(c);
      save(K.clientes, S.clientes);
      CUR.clienteId = c.id;
      renderClienteSelect();
      $('#facClienteSelect').value = c.id;
      toast('Cliente', 'Creado');
    });

    on($('#btnClienteGuardar'), 'click', () => {
      // guarda/actualiza cliente seleccionado usando campos inline
      const id = $('#facClienteSelect')?.value || '';
      if (!id){ toast('Cliente', 'Selecciona un cliente para guardar'); return; }
      const idx = S.clientes.findIndex(x=>x.id===id);
      if (idx<0){ toast('Cliente', 'No encontrado'); return; }
      S.clientes[idx].nombre = ($('#cliNombre')?.value||'').trim();
      S.clientes[idx].nif = ($('#cliNif')?.value||'').trim();
      S.clientes[idx].dir = ($('#cliDir')?.value||'').trim();
      S.clientes[idx].tel = ($('#cliTel')?.value||'').trim();
      S.clientes[idx].email = ($('#cliEmail')?.value||'').trim();
      save(K.clientes, S.clientes);
      renderClienteSelect();
      toast('Cliente', 'Guardado');
    });

    // Factura actions
    on($('#btnNuevaFactura'), 'click', () => setCurrentFactura(blankFactura()));
    on($('#btnDuplicarFactura'), 'click', () => duplicateCurrentFactura());

    on($('#btnGuardarFactura'), 'click', () => saveCurrentFactura());
    on($('#btnEliminarFactura'), 'click', () => confirmBox('Eliminar factura', '¿Eliminar esta factura?', () => deleteCurrentFactura()));
    on($('#btnAutoNumero'), 'click', () => { CUR.numero = genFacturaNumero(); $('#facNumero').value = CUR.numero; $('#facNumeroLabel').textContent = CUR.numero; refreshQr(); });

    on($('#btnAddLine'), 'click', () => addLine());
    on($('#btnClearLines'), 'click', () => clearLinesTo5());

    // Totals controls
    on($('#chkTransporte'), 'change', () => { CUR.transporteOn = !!$('#chkTransporte').checked; recalcAll(); });
    on($('#transportePct'), 'input', () => { CUR.transportePct = parseNum($('#transportePct').value) || 0; recalcAll(); });
    on($('#chkIvaIncluido'), 'change', () => { CUR.ivaIncluido = !!$('#chkIvaIncluido').checked; recalcAll(); });
    on($('#ivaPct'), 'input', () => { CUR.ivaPct = parseNum($('#ivaPct').value) || 0; recalcAll(); });

    on($('#btnAddIva4'), 'click', () => {
      $('#chkIvaIncluido').checked = false;
      $('#ivaPct').value = '4';
      CUR.ivaIncluido = false;
      CUR.ivaPct = 4;
      recalcAll();
      toast('IVA', 'Aplicado 4% (desglosado)');
    });

    // Pagos
    on($('#btnAddPay'), 'click', addPago);
    on($('#facMetodoPago'), 'change', () => { CUR.metodoPago = $('#facMetodoPago').value; });

    // PDF / Cloud / WhatsApp
    on($('#btnPdf'), 'click', generatePdfStub);
    on($('#btnVerPdf'), 'click', () => {
      toast('Visor', 'Visor PDF PRO real en PARTE 4/4 (sin descargar).');
    });
    on($('#btnPdfNube'), 'click', uploadPdfCloudStub);
    on($('#btnWhats'), 'click', openWhatsApp);

    // Meta changes
    ['#facFecha','#facTags','#facNotasInternas','#facObservaciones'].forEach(id => {
      on($(id), 'input', () => { readFacturaFromUI(); recalcAll(); });
      on($(id), 'change', () => { readFacturaFromUI(); recalcAll(); });
    });

    // QR copy
    on($('#btnCopiarQr'), 'click', async () => {
      try{
        await navigator.clipboard.writeText($('#qrTexto')?.value || '');
        toast('QR', 'Texto copiado');
      }catch{
        toast('QR', 'No se pudo copiar');
      }
    });

    // Facturas filtros
    on($('#btnFiltrarFacturas'), 'click', applyFacturaFilters);
    on($('#btnLimpiarFiltroFacturas'), 'click', () => {
      ['#filtroNum','#filtroCliente','#filtroTags','#filtroDesde','#filtroHasta'].forEach(id => { if($(id)) $(id).value=''; });
      renderFacturasList();
    });
    on($('#btnFacturasRefresh'), 'click', () => renderFacturasList());
    on($('#btnFacturasExportCsv'), 'click', () => {
      const rows = [['Fecha','Numero','Cliente','Total','Estado','Tags']];
      S.facturas.forEach(f => rows.push([
        fmtDateES(f.fecha),
        f.numero || '',
        f.clienteSnapshot?.nombre || '',
        fmtNum2(f.totals?.total || 0),
        f.estado || '',
        f.tags || ''
      ]));
      downloadCSV('facturas.csv', rows);
    });

    // Clientes tab
    on($('#clientesSearch'), 'input', renderClientesList);
    on($('#btnClienteNuevo2'), 'click', newClienteForm);
    on($('#btnClienteGuardar2'), 'click', saveClienteFromForm);
    on($('#btnClienteEliminar2'), 'click', () => confirmBox('Eliminar cliente', '¿Eliminar este cliente?', () => deleteClienteFromForm()));
    on($('#btnClientesExport'), 'click', () => {
      const rows = [['Nombre','Alias','NIF','Direccion','Telefono','Email','Notas']];
      S.clientes.forEach(c => rows.push([c.nombre,c.alias||'',c.nif||'',c.dir||'',c.tel||'',c.email||'',c.notas||'']));
      downloadCSV('clientes.csv', rows);
    });

    // Productos tab
    on($('#productosSearch'), 'input', renderProductosList);
    on($('#btnProdNuevo'), 'click', newProductoForm);
    on($('#btnProdGuardar'), 'click', saveProductoFromForm);
    on($('#btnProdEliminar'), 'click', () => confirmBox('Eliminar producto', '¿Eliminar este producto?', () => deleteProductoFromForm()));
    on($('#btnProdExport'), 'click', () => {
      const rows = [['Nombre','Modo','KgCaja','PrecioKg','PrecioCaja','PrecioUd','Coste','Origen','TaraDefault']];
      S.productos.forEach(p => rows.push([p.nombre,p.modo,fmtNum2(p.kgCaja||0),fmtNum2(p.precioKg||0),fmtNum2(p.precioCaja||0),fmtNum2(p.precioUd||0),fmtNum2(p.coste||0),p.origen||'',p.taraDefaultId||'']));
      downloadCSV('productos.csv', rows);
    });

    // Taras tab
    on($('#tarasSearch'), 'input', renderTarasList);
    on($('#btnTaraNueva'), 'click', newTaraForm);
    on($('#btnTaraGuardar'), 'click', saveTaraFromForm);
    on($('#btnTaraEliminar'), 'click', () => confirmBox('Eliminar tara', '¿Eliminar esta tara?', () => deleteTaraFromForm()));
    on($('#btnTarasExport'), 'click', () => {
      const rows = [['Nombre','Peso','Notas']];
      S.taras.forEach(t => rows.push([t.nombre, fmtNum2(t.peso||0), t.notas||'']));
      downloadCSV('taras.csv', rows);
    });

    // Ajustes
    on($('#btnAjustesGuardar'), 'click', saveAjustes);
    on($('#btnAjustesReset'), 'click', () => confirmBox('Reset ajustes', '¿Resetear ajustes a valores por defecto?', () => resetAjustes()));

    // Cloud stubs (PARTE 4)
    on($('#btnCloud'), 'click', () => openTab('tabAjustes'));
    on($('#btnCloudLogin'), 'click', () => toast('Cloud', 'Login Firebase en PARTE 4/4'));
    on($('#btnCloudLogout'), 'click', () => toast('Cloud', 'Logout Firebase en PARTE 4/4'));
    on($('#btnCloudSync'), 'click', () => toast('Cloud', 'Sync Firebase en PARTE 4/4'));

    // Global search
    on($('#btnGlobalSearch'), 'click', globalSearchRun);
    on($('#globalSearch'), 'keydown', (e) => {
      if (e.key === 'Enter'){ e.preventDefault(); globalSearchRun(); }
    });

    // Help
    on($('#btnHelp'), 'click', showHelp);
    $$('[data-close="help"]').forEach(el => on(el,'click',hideHelp));
    $$('[data-close="pdf"]').forEach(el => on(el,'click',closePdfModal));
    on($('#btnPdfCerrar'), 'click', closePdfModal);

    // Confirm
    on($('#confirmNo'), 'click', closeConfirm);
    on($('#confirmYes'), 'click', () => {
      const cb = CONFIRM_CB;
      closeConfirm();
      try { cb && cb(); } catch {}
    });
    $$('[data-close="confirm"]').forEach(el => on(el,'click',closeConfirm));

    // PDF viewer buttons (PARTE 4)
    on($('#btnPdfImprimir'), 'click', () => toast('PDF', 'Imprimir (PARTE 4)'));
    on($('#btnPdfAbrir'), 'click', () => toast('PDF', 'Abrir pestaña (PARTE 4)'));
    on($('#btnPdfCompartir'), 'click', () => toast('PDF', 'Compartir (PARTE 4)'));

    // Locks
    bindLocks();

    // Shortcuts
    bindShortcuts();
  }

  /* =========================================================
     26) BOOT
  ========================================================== */
  function boot(){
    seedIfEmpty();
    fillProviderUI();
    renderClienteSelect();
    renderTaraSelects();
    ensureProductDatalist();
    renderAjustes();

    // Facturas list pre
    renderFacturasList();

    // Abrir factura nueva si no hay actual
    setCurrentFactura(blankFactura());

    // version
    $('#appVersion') && ($('#appVersion').textContent = 'v1.0.0 (A)');

    // inicial tabs
    openTab('tabFactura');

    // listeners
    bindUI();

    toast('FACTU MIRAL', 'Listo (PARTE 3/4). PDF PRO + Cloud en PARTE 4/4.');
  }

  boot();

  // Exponer para debug
  window.FACTU_MIRAL = { S, CUR, saveCurrentFactura, setCurrentFactura };
})();
/* =========================================================
PARTE 4/4 — FACTU MIRAL (B/W PRO) — app.js (B) ✅
PEGAR **AL FINAL** de tu app.js (DESPUÉS de la PARTE 3/4)
- Activa: PDF PRO multipágina + “Suma y sigue” + Nº páginas
- Inserta QR en PDF (desde #qrCanvas)
- Visor PDF interno (sin descargar) + imprimir/abrir/compartir
- Cloud Firebase opcional REAL: login/logout/sync + subir PDF (Storage)
- Contabilidad: Dashboard mensual PRO (sin tocar tu contabilidad base)
========================================================= */
(() => {
  'use strict';

  /* =========================
     Helpers (safe, standalone)
  ========================= */
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const pad2 = n => String(n).padStart(2,'0');

  const parseNum = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const fmtMoney = (n) => {
    const v = (isFinite(n) ? n : 0);
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };
  const fmtNum2 = (n) => {
    const v = (isFinite(n) ? n : 0);
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDateES = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  };

  const parseMoneyFromText = (s) => {
    if (!s) return 0;
    const t = String(s).replace(/[^\d,.-]/g,'').replaceAll('.', '').replace(',', '.'); // es-ES
    const n = Number(t);
    return isFinite(n) ? n : 0;
  };

  const escapeHtml = (s) => (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");

  const toast = (title, msg='') => {
    const wrap = $('#toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast__title">${escapeHtml(title)}</div>${msg?`<div class="toast__msg">${escapeHtml(msg)}</div>`:''}`;
    wrap.appendChild(el);
    setTimeout(()=> el.style.opacity = '0.0', 3000);
    setTimeout(()=> el.remove(), 3600);
  };

  const LS = {
    provider : 'factumiral_provider_v1',
    clientes : 'factumiral_clientes_v1',
    productos: 'factumiral_productos_v1',
    taras    : 'factumiral_taras_v1',
    facturas : 'factumiral_facturas_v1',
    settings : 'factumiral_settings_v1',
    ventas   : 'factumiral_ventas_v1',
    pricehist: 'factumiral_pricehist_v1',
    lastPdf  : 'factumiral_last_pdf_v1',
    cloudSess: 'factumiral_cloud_session_v1'
  };

  const load = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const save = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  };

  /* =========================
     PDF: jsPDF loader (best-effort)
     - Si NO hay jsPDF -> fallback a vista imprimible HTML
  ========================= */
  async function ensureJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return true;

    // Intentar cargar desde CDN (si hay internet o SW cache)
    const inject = (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => res(true);
      s.onerror = () => rej(new Error('load fail ' + src));
      document.head.appendChild(s);
    });

    try {
      await inject('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      return !!(window.jspdf && window.jspdf.jsPDF);
    } catch {
      return false;
    }
  }

  /* =========================
     PDF: Open modal + actions
  ========================= */
  function openPdfModal(url){
    const modal = $('#pdfModal');
    const obj = $('#pdfObject');
    const frame = $('#pdfFrame');
    if (!modal) return;
    modal.classList.remove('is-hidden');
    if (obj) obj.data = url || '';
    if (frame) frame.src = url || '';
  }
  function closePdfModal(){
    const modal = $('#pdfModal');
    if (!modal) return;
    modal.classList.add('is-hidden');
  }

  function setLastPdf(url, blob){
    save(LS.lastPdf, { url, ts: Date.now() });
    // guardamos blob en memoria (no localStorage) para compartir
    window.__FACTU_LAST_PDF_BLOB = blob || null;
    window.__FACTU_LAST_PDF_URL = url || '';
  }

  async function shareLastPdf() {
    const blob = window.__FACTU_LAST_PDF_BLOB;
    if (!blob) { toast('Compartir', 'Primero genera el PDF'); return; }

    const file = new File([blob], 'factura.pdf', { type: 'application/pdf' });

    // Web Share (iOS/Android)
    if (navigator.canShare && navigator.canShare({ files:[file] })) {
      try {
        await navigator.share({ files:[file], title:'Factura', text:'Factura PDF' });
        return;
      } catch {
        // continuar a fallback
      }
    }
    // fallback: abrir y que el usuario comparta desde visor
    const url = window.__FACTU_LAST_PDF_URL;
    if (url) window.open(url, '_blank');
    toast('Compartir', 'Abierto en pestaña');
  }

  function printLastPdf(){
    const url = window.__FACTU_LAST_PDF_URL;
    if (!url) { toast('Imprimir', 'Primero genera el PDF'); return; }
    const w = window.open(url, '_blank');
    if (!w) { toast('Imprimir', 'Bloqueado por el navegador'); return; }
    // print when ready
    const t = setInterval(() => {
      try {
        if (w.document && w.document.readyState === 'complete') {
          clearInterval(t);
          w.focus();
          w.print();
        }
      } catch {}
    }, 300);
    setTimeout(()=>{ try{ clearInterval(t); }catch{} }, 6000);
  }

  function openLastPdf(){
    const url = window.__FACTU_LAST_PDF_URL || load(LS.lastPdf, null)?.url;
    if (!url) { toast('PDF', 'No hay PDF generado'); return; }
    openPdfModal(url);
  }

  /* =========================
     Leer factura desde DOM (GRID PRO)
  ========================= */
  function getFacturaDomData() {
    const numero = ($('#facNumero')?.value || '').trim();
    const fecha = ($('#facFecha')?.value || '').trim();
    const tags = ($('#facTags')?.value || '').trim();
    const notasInternas = ($('#facNotasInternas')?.value || '').trim();
    const observaciones = ($('#facObservaciones')?.value || '').trim();

    const cliente = {
      nombre: ($('#cliNombre')?.value || '').trim(),
      nif: ($('#cliNif')?.value || '').trim(),
      dir: ($('#cliDir')?.value || '').trim(),
      tel: ($('#cliTel')?.value || '').trim(),
      email: ($('#cliEmail')?.value || '').trim()
    };

    const provider = load(LS.provider, {});
    const settings = load(LS.settings, { ivaPct:4, transportePct:10, qrBase:'' });

    const transporteOn = !!$('#chkTransporte')?.checked;
    const transportePct = parseNum($('#transportePct')?.value) ?? (settings.transportePct ?? 10);

    const ivaIncluido = !!$('#chkIvaIncluido')?.checked;
    const ivaPct = parseNum($('#ivaPct')?.value) ?? (settings.ivaPct ?? 4);

    // Lineas
    const rows = $$('#gridBody .gridRow');
    const lineas = rows.map(row => {
      const prod = $('.input--prod', row)?.value?.trim() || '';
      const modo = $('.select', row)?.value || 'kg';

      // Inputs num: [cantidad, bruto]
      const nums = $$('.input--num', row);
      const cantidad = parseNum(nums[0]?.value);
      const bruto = parseNum(nums[1]?.value);

      const taraKg = parseNum($('.taraKg', row)?.value);
      const neto = parseNum($('.netoKg', row)?.value);
      const precio = parseNum($('.precio', row)?.value);

      // origen input (placeholder Origen en A)
      const origen = ($$('.input', row).find(x => x.placeholder === 'Origen')?.value || '').trim();

      // importe mostrado
      const impTxt = $('[data-importe]', row)?.textContent || '';
      const importeView = parseMoneyFromText(impTxt);

      return { producto: prod, modo, cantidad, bruto, taraKg, neto, precio, origen, importeView };
    }).filter(l => l.producto);

    // Totales UI (si existen)
    const subtotalUI = parseMoneyFromText($('#tSubtotal')?.textContent || '');
    const transporteUI = parseMoneyFromText($('#tTransporte')?.textContent || '');
    const ivaUI = parseMoneyFromText($('#tIva')?.textContent || '');
    const totalUI = parseMoneyFromText($('#tTotal')?.textContent || '');
    const pendienteUI = parseMoneyFromText($('#tPendiente')?.textContent || '');

    return {
      numero, fecha, tags, notasInternas, observaciones,
      cliente, provider, settings,
      transporteOn, transportePct,
      ivaIncluido, ivaPct,
      lineas,
      totalsUI: { subtotalUI, transporteUI, ivaUI, totalUI, pendienteUI }
    };
  }

  /* =========================
     PDF PRO multipágina + suma y sigue
  ========================= */
  function getQrDataUrlOrNull(){
    const canvas = $('#qrCanvas');
    try {
      if (!canvas) return null;
      // si canvas está en blanco, igualmente devuelve data url; validamos tamaño real rápido:
      const url = canvas.toDataURL('image/png');
      return (url && url.startsWith('data:image/png')) ? url : null;
    } catch {
      return null;
    }
  }

  function buildPrintableFallbackHTML(f) {
    const rows = f.lineas.map(l => {
      const modo = l.modo;
      const cant = l.cantidad ?? '';
      const bruto = l.bruto ?? '';
      const tara = l.taraKg ?? '';
      const neto = l.neto ?? '';
      const precio = l.precio ?? '';
      const imp = l.importeView ?? 0;
      return `
        <tr>
          <td>${escapeHtml(l.producto)}${l.origen?`<div class="sm">${escapeHtml(l.origen)}</div>`:''}</td>
          <td class="c">${escapeHtml(modo)}</td>
          <td class="r">${escapeHtml(cant ?? '')}</td>
          <td class="r">${escapeHtml(modo==='kg' ? (bruto ?? '') : '')}</td>
          <td class="r">${escapeHtml(modo==='kg' ? (tara ?? '') : '')}</td>
          <td class="r">${escapeHtml(modo==='kg' ? (neto ?? '') : '')}</td>
          <td class="r">${escapeHtml(precio ?? '')}</td>
          <td class="r">${escapeHtml(fmtMoney(imp))}</td>
        </tr>
      `;
    }).join('');

    const ivaLine = f.ivaIncluido
      ? `<div><strong>IVA:</strong> incluido en los precios</div>`
      : `<div><strong>IVA (${fmtNum2(f.ivaPct)}%):</strong> ${fmtMoney(f.totalsUI.ivaUI)}</div>`;

    return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(f.numero || 'Factura')}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:18px; color:#111}
  .row{display:flex; gap:16px; align-items:flex-start; justify-content:space-between}
  .box{border:1px solid #111; padding:10px; flex:1}
  h1{font-size:18px; margin:0 0 6px 0}
  .muted{color:#555; font-size:12px}
  table{width:100%; border-collapse:collapse; margin-top:10px}
  th,td{border:1px solid #111; padding:6px; font-size:12px; vertical-align:top}
  th{background:#f2f2f2}
  .r{text-align:right}
  .c{text-align:center}
  .sm{font-size:11px; color:#444; margin-top:2px}
  .tot{margin-top:10px; display:flex; justify-content:flex-end}
  .tot .box{max-width:320px}
  @media print{ body{margin:10mm} }
</style>
</head>
<body>
  <div class="row">
    <div class="box">
      <h1>FACTU MIRAL — FACTURA</h1>
      <div><strong>Nº:</strong> ${escapeHtml(f.numero||'')}</div>
      <div><strong>Fecha:</strong> ${escapeHtml(fmtDateES(f.fecha))}</div>
      ${f.tags?`<div><strong>Tags:</strong> ${escapeHtml(f.tags)}</div>`:''}
      <div class="muted">${escapeHtml(f.notasInternas||'')}</div>
    </div>
    <div class="box">
      <div><strong>Proveedor:</strong> ${escapeHtml(f.provider?.nombre||'')}</div>
      <div><strong>NIF:</strong> ${escapeHtml(f.provider?.nif||'')}</div>
      <div>${escapeHtml(f.provider?.dir||'')}</div>
      <div>${escapeHtml(f.provider?.tel||'')} ${f.provider?.email?`· ${escapeHtml(f.provider.email)}`:''}</div>
    </div>
    <div class="box">
      <div><strong>Cliente:</strong> ${escapeHtml(f.cliente?.nombre||'')}</div>
      <div><strong>NIF:</strong> ${escapeHtml(f.cliente?.nif||'')}</div>
      <div>${escapeHtml(f.cliente?.dir||'')}</div>
      <div>${escapeHtml(f.cliente?.tel||'')} ${f.cliente?.email?`· ${escapeHtml(f.cliente.email)}`:''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th><th>Modo</th><th>Cant</th><th>Bruto</th><th>Tara</th><th>Neto</th><th>Precio</th><th>Importe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="tot">
    <div class="box">
      <div><strong>Subtotal:</strong> ${escapeHtml(fmtMoney(f.totalsUI.subtotalUI))}</div>
      ${f.transporteOn?`<div><strong>Transporte (${fmtNum2(f.transportePct)}%):</strong> ${escapeHtml(fmtMoney(f.totalsUI.transporteUI))}</div>`:''}
      ${ivaLine}
      <div><strong>TOTAL:</strong> ${escapeHtml(fmtMoney(f.totalsUI.totalUI))}</div>
      <div><strong>Pendiente:</strong> ${escapeHtml(fmtMoney(f.totalsUI.pendienteUI))}</div>
      ${f.observaciones?`<div class="muted" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(f.observaciones)}</div>`:''}
    </div>
  </div>

  <script>window.print();</script>
</body>
</html>
    `.trim();
  }

  async function generatePdfPro() {
    // asegurar guardado antes de PDF (para que exista en facturas)
    $('#btnGuardarFactura')?.click?.();

    const f = getFacturaDomData();
    if (!f.numero) { toast('PDF', 'Falta Nº de factura'); return; }
    if (!f.fecha) { toast('PDF', 'Falta fecha'); return; }
    if (!f.lineas.length) { toast('PDF', 'No hay líneas'); return; }

    const ok = await ensureJsPDF();
    if (!ok) {
      // fallback offline: imprimir HTML
      toast('PDF', 'Sin jsPDF (offline). Abro vista imprimible.');
      const html = buildPrintableFallbackHTML(f);
      const w = window.open('', '_blank');
      if (!w) { toast('PDF', 'Bloqueado por el navegador'); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }

    const { jsPDF } = window.jspdf;

    // A4 portrait mm
    const doc = new jsPDF({ unit:'mm', format:'a4', compress:true });
    const W = 210, H = 297;
    const M = { l:12, r:12, t:12, b:12 };
    const usableW = W - M.l - M.r;

    // Column layout (B/W PRO)
    const cols = [
      { key:'prod',  label:'Producto', w:60 },
      { key:'modo',  label:'M', w:10 },
      { key:'cant',  label:'Cant', w:14 },
      { key:'bruto', label:'Bruto', w:16 },
      { key:'tara',  label:'Tara', w:14 },
      { key:'neto',  label:'Neto', w:16 },
      { key:'precio',label:'Precio', w:16 },
      { key:'imp',   label:'Importe', w:20 }
    ];
    const totalColsW = cols.reduce((a,c)=>a+c.w,0);
    const scale = usableW / totalColsW;
    cols.forEach(c => c.w = c.w * scale);

    const rowH = 7;
    const headH = 8;
    const footerH = 12;

    const qrUrl = getQrDataUrlOrNull();

    // Data rows
    const rows = f.lineas.map(l => {
      const modo = l.modo || 'kg';
      const cant = (l.cantidad ?? '');
      const bruto = (modo==='kg' ? (l.bruto ?? '') : '');
      const tara = (modo==='kg' ? (l.taraKg ?? '') : '');
      const neto = (modo==='kg' ? (l.neto ?? '') : '');
      const precio = (l.precio ?? '');
      const imp = (isFinite(l.importeView) ? l.importeView : 0);
      return {
        prod: l.producto + (l.origen ? ` (${l.origen})` : ''),
        modo,
        cant: cant === null ? '' : String(cant),
        bruto: bruto === null ? '' : String(bruto),
        tara: tara === null ? '' : String(tara),
        neto: neto === null ? '' : String(neto),
        precio: precio === null ? '' : String(precio),
        imp: fmtNum2(imp)
      };
    });

    // Pagination calc
    // Header space: we draw blocks + maybe QR (fixed)
    const headerYTop = M.t;
    const headerH = 58; // fijo
    const tableStartY = headerYTop + headerH + 6;

    // Last page totals area
    const totalsArea = 36; // espacio para totales + observaciones
    const maxBodyH_Last = H - M.b - footerH - tableStartY - totalsArea;
    const maxRowsLast = Math.max(1, Math.floor((maxBodyH_Last - headH) / rowH));

    const maxBodyH_Mid = H - M.b - footerH - tableStartY - 12; // suma y sigue
    const maxRowsMid = Math.max(1, Math.floor((maxBodyH_Mid - headH) / rowH));

    // Split pages ensuring last page can fit totals
    const pages = [];
    let i = 0;

    // If few rows, single page
    if (rows.length <= maxRowsLast) {
      pages.push({ rows: rows.slice(0), isLast:true });
    } else {
      // Fill middle pages with maxRowsMid, keep tail for last
      // Reserve last maxRowsLast
      const reserve = maxRowsLast;
      const midCap = maxRowsMid;

      while (i < rows.length - reserve) {
        const take = Math.min(midCap, (rows.length - reserve) - i);
        pages.push({ rows: rows.slice(i, i+take), isLast:false });
        i += take;
      }
      pages.push({ rows: rows.slice(i), isLast:true });
    }

    const totalPages = pages.length;

    function drawHeader(pageIndex, carryIn){
      // Title + invoice meta
      doc.setTextColor(0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(14);
      doc.text('FACTU MIRAL — FACTURA', M.l, headerYTop + 6);

      doc.setFont('helvetica','normal');
      doc.setFontSize(10);

      // Right box invoice
      const boxW = 70;
      const boxX = W - M.r - boxW;
      const boxY = headerYTop + 2;
      doc.rect(boxX, boxY, boxW, 20);
      doc.setFont('helvetica','bold');
      doc.text('Nº', boxX+3, boxY+6);
      doc.text('Fecha', boxX+3, boxY+12);
      doc.setFont('helvetica','normal');
      doc.text(String(f.numero||''), boxX+16, boxY+6);
      doc.text(fmtDateES(f.fecha), boxX+16, boxY+12);

      doc.setFont('helvetica','bold');
      doc.text(`Página ${pageIndex+1}/${totalPages}`, boxX+3, boxY+18);

      // Provider / Client boxes
      const leftBoxX = M.l;
      const leftBoxY = headerYTop + 12;
      const boxH = 30;
      const halfW = (W - M.l - M.r - 6) / 2;

      doc.rect(leftBoxX, leftBoxY, halfW, boxH);
      doc.rect(leftBoxX + halfW + 6, leftBoxY, halfW, boxH);

      doc.setFont('helvetica','bold');
      doc.text('Proveedor', leftBoxX+3, leftBoxY+6);
      doc.text('Cliente', leftBoxX + halfW + 9, leftBoxY+6);

      doc.setFont('helvetica','normal');
      const p = f.provider || {};
      const c = f.cliente || {};
      const provLines = [
        (p.nombre||''),
        `NIF: ${p.nif||''}`,
        (p.dir||''),
        [p.tel||'', p.email||''].filter(Boolean).join(' · ')
      ].filter(Boolean);

      const cliLines = [
        (c.nombre||''),
        `NIF: ${c.nif||''}`,
        (c.dir||''),
        [c.tel||'', c.email||''].filter(Boolean).join(' · ')
      ].filter(Boolean);

      doc.setFontSize(9);
      provLines.slice(0,4).forEach((t, k)=> doc.text(String(t).slice(0,60), leftBoxX+3, leftBoxY+11 + k*5));
      cliLines.slice(0,4).forEach((t, k)=> doc.text(String(t).slice(0,60), leftBoxX + halfW + 9, leftBoxY+11 + k*5));

      // Tags line
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      if (f.tags) doc.text(`Tags: ${String(f.tags).slice(0,110)}`, M.l, leftBoxY + boxH + 6);

      // QR (si existe)
      if (qrUrl) {
        try {
          const qrSize = 22;
          const qx = W - M.r - qrSize;
          const qy = leftBoxY + boxH + 2;
          doc.addImage(qrUrl, 'PNG', qx, qy, qrSize, qrSize, undefined, 'FAST');
          doc.setFontSize(8);
          doc.text('QR', qx + 7, qy + qrSize + 4);
        } catch {}
      }

      // Carry line
      if (carryIn > 0.0001) {
        doc.setFont('helvetica','bold');
        doc.setFontSize(10);
        doc.text(`Viene: ${fmtMoney(carryIn)}`, M.l, tableStartY - 2);
      }
    }

    function drawTableHead(y){
      doc.setDrawColor(0);
      doc.setFillColor(245,245,245);
      doc.setTextColor(0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);

      let x = M.l;
      // header row background
      doc.rect(M.l, y, usableW, headH, 'F');
      cols.forEach(col => {
        doc.rect(x, y, col.w, headH);
        doc.text(col.label, x + 2, y + 5.5);
        x += col.w;
      });
    }

    function drawRow(y, row, zebra){
      const fill = zebra ? [250,250,250] : [255,255,255];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);

      let x = M.l;
      // row bg
      doc.rect(M.l, y, usableW, rowH, 'F');

      cols.forEach(col => {
        doc.rect(x, y, col.w, rowH);
        const v = String(row[col.key] ?? '');
        if (col.key === 'prod') {
          const txt = v.length > 60 ? (v.slice(0,57)+'…') : v;
          doc.text(txt, x + 2, y + 5);
        } else {
          // right align numbers except modo
          if (col.key === 'modo') {
            doc.text(v, x + 2, y + 5);
          } else {
            const tx = x + col.w - 2;
            doc.text(v, tx, y + 5, { align:'right' });
          }
        }
        x += col.w;
      });
    }

    function drawFooter(pageIndex){
      const y = H - M.b - 6;
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.text(`FACTU MIRAL · ${f.numero || ''}`, M.l, y);
      doc.text(`Página ${pageIndex+1}/${totalPages}`, W - M.r, y, { align:'right' });
    }

    // Render pages with “Suma y sigue”
    let carry = 0;
    let globalSubtotal = 0;

    for (let pIdx=0; pIdx<pages.length; pIdx++){
      const page = pages[pIdx];
      if (pIdx > 0) doc.addPage();

      drawHeader(pIdx, carry);

      let y = tableStartY;
      drawTableHead(y);
      y += headH;

      let zebra = false;
      let pageSum = 0;

      page.rows.forEach(r => {
        zebra = !zebra;
        drawRow(y, r, zebra);
        y += rowH;
        pageSum += parseMoneyFromText(r.imp); // r.imp es string num2
      });

      pageSum = round2(pageSum);
      globalSubtotal = round2(globalSubtotal + pageSum);

      // Bottom area
      if (!page.isLast) {
        // SUMA Y SIGUE (cumulative)
        doc.setFont('helvetica','bold');
        doc.setFontSize(10);
        doc.text('SUMA Y SIGUE:', W - M.r - 60, H - M.b - footerH - 2);
        doc.text(fmtMoney(globalSubtotal), W - M.r, H - M.b - footerH - 2, { align:'right' });

        carry = globalSubtotal;
      } else {
        // Totales (usar UI, si no existen recalcular básico)
        const t = f.totalsUI;
        const subtotal = t.subtotalUI > 0 ? t.subtotalUI : globalSubtotal;

        const transporte = f.transporteOn
          ? (t.transporteUI > 0 ? t.transporteUI : round2(subtotal * ((parseNum(f.transportePct)||0)/100)))
          : 0;

        const iva = f.ivaIncluido
          ? 0
          : (t.ivaUI > 0 ? t.ivaUI : round2((subtotal + transporte) * ((parseNum(f.ivaPct)||0)/100)));

        const total = t.totalUI > 0 ? t.totalUI : round2(subtotal + transporte + iva);

        const pendiente = t.pendienteUI; // puede ser 0

        // Box totals
        const boxW = 78;
        const boxX = W - M.r - boxW;
        const boxY = H - M.b - footerH - 32;
        doc.setFontSize(10);
        doc.setFont('helvetica','bold');
        doc.rect(boxX, boxY, boxW, 32);

        let ty = boxY + 7;
        doc.text('Subtotal', boxX+3, ty);
        doc.text(fmtMoney(subtotal), boxX+boxW-3, ty, {align:'right'});

        ty += 6;
        doc.setFont('helvetica','normal');
        if (f.transporteOn){
          doc.text(`Transporte (${fmtNum2(f.transportePct)}%)`, boxX+3, ty);
          doc.text(fmtMoney(transporte), boxX+boxW-3, ty, {align:'right'});
          ty += 6;
        }

        if (f.ivaIncluido){
          doc.text('IVA', boxX+3, ty);
          doc.text('Incluido', boxX+boxW-3, ty, {align:'right'});
          ty += 6;
        } else {
          doc.text(`IVA (${fmtNum2(f.ivaPct)}%)`, boxX+3, ty);
          doc.text(fmtMoney(iva), boxX+boxW-3, ty, {align:'right'});
          ty += 6;
        }

        doc.setFont('helvetica','bold');
        doc.text('TOTAL', boxX+3, ty);
        doc.text(fmtMoney(total), boxX+boxW-3, ty, {align:'right'});
        ty += 6;

        doc.setFont('helvetica','normal');
        doc.text('Pendiente', boxX+3, ty);
        doc.text(fmtMoney(pendiente), boxX+boxW-3, ty, {align:'right'});

        // Observaciones (izquierda)
        const obs = (f.observaciones || '').trim();
        if (obs){
          doc.setFont('helvetica','normal');
          doc.setFontSize(9);
          const ox = M.l;
          const oy = H - M.b - footerH - 30;
          doc.text('Observaciones:', ox, oy);
          doc.setFontSize(8);
          const lines = doc.splitTextToSize(obs, usableW - boxW - 8);
          doc.text(lines.slice(0,6), ox, oy + 5);
        }
      }

      drawFooter(pIdx);
    }

    // Blob URL
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    // Guardar en factura (por numero) dentro de localStorage
    try {
      const all = load(LS.facturas, []);
      const idx = all.findIndex(x => (x.numero||'') === f.numero);
      if (idx >= 0) {
        all[idx].pdf = all[idx].pdf || {};
        all[idx].pdf.url = url;          // visor instantáneo (sin descargar)
        all[idx].pdf.createdAt = Date.now();
        save(LS.facturas, all);
      }
    } catch {}

    setLastPdf(url, blob);
    openPdfModal(url);
    toast('PDF', 'Generado (PRO multipágina)');
  }

  /* =========================
     Cloud Firebase (opcional) — REAL
  ========================= */
  async function ensureFirebaseCompat() {
    if (window.firebase?.apps?.length) return true;

    const settings = load(LS.settings, null);
    const cloud = settings?.cloud || {};
    if (!cloud.enabled) return false;

    // config mínimo
    const required = ['apiKey','authDomain','databaseURL','projectId','appId'];
    const missing = required.filter(k => !(cloud[k] || '').trim());
    if (missing.length) {
      toast('Cloud', 'Falta config Firebase en Ajustes');
      return false;
    }

    const inject = (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => res(true);
      s.onerror = () => rej(new Error('load fail ' + src));
      document.head.appendChild(s);
    });

    try {
      // Compat (más simple)
      await inject('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await inject('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
      await inject('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
      await inject('https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js');

      window.firebase.initializeApp({
        apiKey: cloud.apiKey,
        authDomain: cloud.authDomain,
        databaseURL: cloud.databaseURL,
        projectId: cloud.projectId,
        appId: cloud.appId,
        storageBucket: cloud.storageBucket || undefined
      });

      return true;
    } catch (e) {
      toast('Cloud', 'No se pudo cargar Firebase (offline)');
      return false;
    }
  }

  function getCloudUser(){
    try { return window.firebase?.auth()?.currentUser || null; } catch { return null; }
  }

  async function cloudLogin() {
    const ok = await ensureFirebaseCompat();
    if (!ok) return;

    const email = prompt('Email Firebase (Auth):') || '';
    if (!email.trim()) return;

    const pass = prompt('Password:') || '';
    if (!pass) return;

    const auth = window.firebase.auth();
    try {
      await auth.signInWithEmailAndPassword(email.trim(), pass);
      toast('Cloud', 'Login OK');
      save(LS.cloudSess, { email: email.trim(), ts: Date.now() });
      updateCloudDiag();
    } catch (e) {
      // si falla, ofrecer crear usuario
      const crear = confirm('Login falló. ¿Crear usuario con ese email?');
      if (!crear) return;
      try {
        await auth.createUserWithEmailAndPassword(email.trim(), pass);
        toast('Cloud', 'Usuario creado + login OK');
        save(LS.cloudSess, { email: email.trim(), ts: Date.now() });
        updateCloudDiag();
      } catch {
        toast('Cloud', 'Error Auth');
      }
    }
  }

  async function cloudLogout() {
    const ok = await ensureFirebaseCompat();
    if (!ok) return;
    try {
      await window.firebase.auth().signOut();
      toast('Cloud', 'Logout');
      updateCloudDiag();
    } catch {
      toast('Cloud', 'Error logout');
    }
  }

  function mergeById(localArr, remoteArr) {
    const map = new Map();
    (Array.isArray(localArr) ? localArr : []).forEach(o => {
      if (!o || !o.id) return;
      const ts = o.updatedAt || o.createdAt || 0;
      map.set(o.id, { obj:o, ts });
    });
    (Array.isArray(remoteArr) ? remoteArr : []).forEach(o => {
      if (!o || !o.id) return;
      const ts = o.updatedAt || o.createdAt || 0;
      const cur = map.get(o.id);
      if (!cur || ts > cur.ts) map.set(o.id, { obj:o, ts });
    });
    return Array.from(map.values()).map(x => x.obj);
  }

  async function cloudSync() {
    const ok = await ensureFirebaseCompat();
    if (!ok) return;

    const user = getCloudUser();
    if (!user) { toast('Cloud', 'Haz login'); return; }

    const db = window.firebase.database();
    const root = `factumiral/${user.uid}`;

    // local snapshot
    const local = {
      provider: load(LS.provider, {}),
      settings: load(LS.settings, {}),
      clientes: load(LS.clientes, []),
      productos: load(LS.productos, []),
      taras: load(LS.taras, []),
      facturas: load(LS.facturas, []),
      pricehist: load(LS.pricehist, {}),
      ventas: load(LS.ventas, []),
      ts: Date.now()
    };

    try {
      const snap = await db.ref(root).get();
      const remote = snap.exists() ? snap.val() : null;

      // merge
      let merged = JSON.parse(JSON.stringify(local));

      if (remote) {
        // provider/settings prefer ts if available
        const rts = remote.ts || 0;
        const lts = local.ts || 0;

        // arrays
        merged.clientes = mergeById(local.clientes, remote.clientes);
        merged.productos = mergeById(local.productos, remote.productos);
        merged.taras = mergeById(local.taras, remote.taras);
        merged.facturas = mergeById(local.facturas, remote.facturas);
        merged.ventas = mergeById(local.ventas, remote.ventas);

        // objetos: si remote más nuevo y no vacío
        if (rts > lts && remote.provider) merged.provider = remote.provider;
        if (rts > lts && remote.settings) merged.settings = Object.assign({}, local.settings||{}, remote.settings||{});

        // pricehist: merge simple
        merged.pricehist = Object.assign({}, (local.pricehist||{}), (remote.pricehist||{}));
        merged.ts = Math.max(lts, rts, Date.now());
      }

      // guardar local
      save(LS.provider, merged.provider);
      save(LS.settings, merged.settings);
      save(LS.clientes, merged.clientes);
      save(LS.productos, merged.productos);
      save(LS.taras, merged.taras);
      save(LS.facturas, merged.facturas);
      save(LS.pricehist, merged.pricehist);
      save(LS.ventas, merged.ventas);

      // subir a cloud (source of truth = merged)
      await db.ref(root).set(merged);

      toast('Cloud', 'Sync OK (recargando)');
      updateCloudDiag();

      // recarga para que el core (PARTE 3) re-levante estado
      setTimeout(()=> location.reload(), 500);
    } catch {
      toast('Cloud', 'Error sync');
    }
  }

  async function cloudUploadLastPdfForCurrentInvoice() {
    const ok = await ensureFirebaseCompat();
    if (!ok) return;

    const user = getCloudUser();
    if (!user) { toast('Cloud', 'Haz login'); return; }

    const blob = window.__FACTU_LAST_PDF_BLOB;
    const urlLocal = window.__FACTU_LAST_PDF_URL;
    if (!blob || !urlLocal) { toast('Cloud', 'Primero genera el PDF'); return; }

    const numero = ($('#facNumero')?.value || '').trim();
    if (!numero) { toast('Cloud', 'Falta Nº de factura'); return; }

    const storage = window.firebase.storage();
    const ref = storage.ref().child(`factumiral/${user.uid}/pdf/${numero}.pdf`);

    try {
      await ref.put(blob, { contentType:'application/pdf' });
      const dl = await ref.getDownloadURL();

      // guardar cloudUrl en factura local
      const all = load(LS.facturas, []);
      const idx = all.findIndex(x => (x.numero||'') === numero);
      if (idx >= 0) {
        all[idx].pdf = all[idx].pdf || {};
        all[idx].pdf.cloudUrl = dl;
        all[idx].pdf.cloudAt = Date.now();
        save(LS.facturas, all);
      }

      toast('Cloud', 'PDF subido');
    } catch {
      toast('Cloud', 'Error subiendo PDF');
    }
  }

  function updateCloudDiag(){
    const settings = load(LS.settings, {});
    const onEl = $('#diagCloud');
    if (onEl) onEl.textContent = settings?.cloud?.enabled ? 'On' : 'Off';

    const modeEl = $('#diagMode');
    const user = getCloudUser();
    if (modeEl) modeEl.textContent = user ? `Cloud (${user.email||'user'})` : 'Local';
  }

  /* =========================
     Contabilidad — Dashboard mensual PRO
  ========================= */
  function contabDashboardProRender(){
    const dash = $('#contabDashboard');
    if (!dash) return;

    // usar filtros del core (si existen)
    const desde = $('#contabDesde')?.value || '';
    const hasta = $('#contabHasta')?.value || '';
    const qCliente = ($('#contabCliente')?.value||'').trim().toLowerCase();
    const qTag = ($('#contabTag')?.value||'').trim().toLowerCase();

    const facturas = load(LS.facturas, []).filter(f => {
      const okD = !desde || (f.fecha||'') >= desde;
      const okH = !hasta || (f.fecha||'') <= hasta;
      const cli = ((f.clienteSnapshot?.nombre)||'').toLowerCase();
      const okC = !qCliente || cli.includes(qCliente);
      const okT = !qTag || ((f.tags||'').toLowerCase().includes(qTag));
      return okD && okH && okC && okT;
    });

    const monthKey = (iso) => (iso||'').slice(0,7) || '—';

    let total = 0, iva = 0, transporte = 0, subtotal = 0;
    let pendiente = 0, impagadas = 0;

    const byMonth = new Map();
    const byClient = new Map();
    const byTag = new Map();

    facturas.forEach(f => {
      const t = f.totals || {};
      subtotal += (t.subtotal || 0);
      transporte += (t.transporte || 0);
      iva += (t.iva || 0);
      total += (t.total || 0);
      pendiente += (t.pendiente || 0);
      if ((f.estado||'') !== 'pagada') impagadas++;

      const m = monthKey(f.fecha);
      byMonth.set(m, (byMonth.get(m)||0) + (t.total||0));

      const cli = (f.clienteSnapshot?.nombre) || '—';
      byClient.set(cli, (byClient.get(cli)||0) + (t.total||0));

      const tags = (f.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
      tags.forEach(tag => byTag.set(tag, (byTag.get(tag)||0) + (t.total||0)));
    });

    subtotal = round2(subtotal); transporte = round2(transporte); iva = round2(iva);
    total = round2(total); pendiente = round2(pendiente);

    const topClients = Array.from(byClient.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const topTags = Array.from(byTag.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const months = Array.from(byMonth.entries()).sort((a,b)=>a[0].localeCompare(b[0]));

    const barMax = Math.max(1, ...months.map(x=>x[1]));

    dash.innerHTML = `
      <div class="grid2">
        <div class="card">
          <div class="card__title">Resumen</div>
          <div class="kpis">
            <div class="kpi"><div class="kpi__l">Facturas</div><div class="kpi__v">${facturas.length}</div></div>
            <div class="kpi"><div class="kpi__l">Total</div><div class="kpi__v">${escapeHtml(fmtMoney(total))}</div></div>
            <div class="kpi"><div class="kpi__l">Pendiente</div><div class="kpi__v">${escapeHtml(fmtMoney(pendiente))}</div></div>
            <div class="kpi"><div class="kpi__l">Impagadas</div><div class="kpi__v">${impagadas}</div></div>
          </div>
          <div class="muted" style="margin-top:8px">
            Subtotal ${escapeHtml(fmtMoney(subtotal))} · Transporte ${escapeHtml(fmtMoney(transporte))} · IVA ${escapeHtml(fmtMoney(iva))}
          </div>
        </div>

        <div class="card">
          <div class="card__title">Totales por mes</div>
          <div class="bars">
            ${months.map(([m,v]) => {
              const w = Math.max(4, Math.round((v / barMax) * 100));
              return `
                <div class="barRow">
                  <div class="barLabel">${escapeHtml(m)}</div>
                  <div class="barTrack"><div class="barFill" style="width:${w}%"></div></div>
                  <div class="barVal">${escapeHtml(fmtMoney(v))}</div>
                </div>
              `;
            }).join('') || `<div class="muted">Sin datos</div>`}
          </div>
        </div>
      </div>

      <div class="grid2" style="margin-top:12px">
        <div class="card">
          <div class="card__title">Top clientes</div>
          <div class="miniTable">
            ${topClients.map(([name,v]) => `
              <div class="miniRow">
                <div class="miniName">${escapeHtml(name)}</div>
                <div class="miniVal">${escapeHtml(fmtMoney(v))}</div>
              </div>
            `).join('') || `<div class="muted">Sin datos</div>`}
          </div>
        </div>

        <div class="card">
          <div class="card__title">Top tags</div>
          <div class="miniTable">
            ${topTags.map(([name,v]) => `
              <div class="miniRow">
                <div class="miniName">${escapeHtml(name)}</div>
                <div class="miniVal">${escapeHtml(fmtMoney(v))}</div>
              </div>
            `).join('') || `<div class="muted">Sin tags</div>`}
          </div>
        </div>
      </div>
    `;
  }

  /* =========================
     Patch: interceptar botones (capturing)
     - Reemplaza stubs de PARTE 3 por funciones PRO
  ========================= */
  function hijackClick(id, fn){
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      try { fn(e); } catch {}
    }, true); // capturing
  }

  function initProPatch(){
    // PDF
    hijackClick('#btnPdf', async () => {
      await generatePdfPro();
    });

    hijackClick('#btnVerPdf', () => {
      // prefer cloudUrl si existe, si no blob url
      const numero = ($('#facNumero')?.value || '').trim();
      if (!numero) { toast('PDF', 'Falta Nº'); return; }
      const all = load(LS.facturas, []);
      const f = all.find(x => (x.numero||'') === numero);
      const url = f?.pdf?.url || f?.pdf?.cloudUrl || load(LS.lastPdf,null)?.url || '';
      if (!url) { toast('PDF', 'No hay PDF (genera primero)'); return; }
      openPdfModal(url);
    });

    hijackClick('#btnPdfImprimir', () => printLastPdf());
    hijackClick('#btnPdfAbrir', () => {
      const url = window.__FACTU_LAST_PDF_URL || load(LS.lastPdf,null)?.url;
      if (!url) { toast('PDF', 'Primero genera el PDF'); return; }
      window.open(url, '_blank');
    });
    hijackClick('#btnPdfCompartir', async () => shareLastPdf());

    // Modal close (por si el core no lo engancha)
    hijackClick('#btnPdfCerrar', () => closePdfModal());
    $$('[data-close="pdf"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); closePdfModal(); }, true);
    });

    // Cloud buttons
    hijackClick('#btnCloudLogin', async () => cloudLogin());
    hijackClick('#btnCloudLogout', async () => cloudLogout());
    hijackClick('#btnCloudSync', async () => cloudSync());
    hijackClick('#btnPdfNube', async () => cloudUploadLastPdfForCurrentInvoice());

    // Contabilidad dashboard PRO: refrescar al filtrar/abrir
    hijackClick('#btnContabFiltrar', () => {
      // dejar que el core haga tabla y KPI, pero metemos dashboard PRO
      setTimeout(()=> contabDashboardProRender(), 50);
    });
    hijackClick('#btnContabLimpiar', () => {
      setTimeout(()=> contabDashboardProRender(), 50);
    });

    // Cuando se abre el tab contabilidad, render pro
    $$('.tab[data-tab="tabContabilidad"]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(()=> contabDashboardProRender(), 120), true);
    });

    // Diag cloud
    updateCloudDiag();

    // Auto: si ya hay lastPdf, recuperar
    const last = load(LS.lastPdf, null);
    if (last?.url) window.__FACTU_LAST_PDF_URL = last.url;

    toast('PARTE 4/4', 'PDF PRO + Cloud + Dashboard activados');
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProPatch, { once:true });
  } else {
    initProPatch();
  }

})();
/* =========================================================
   PATCH — FIX INPUT PRECIO EN GRID (iOS + decimales + no salto)
   ✅ Pegar al FINAL de app.js
========================================================= */
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const parseNum = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  const fmt2es = (n) => {
    if (!isFinite(n)) return '';
    // 2 decimales y coma
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function applyPrecioInputFix(input){
    if (!input || input.__precioFixed) return;
    input.__precioFixed = true;

    // 1) Hacerlo "text" para permitir coma sin errores (iOS/ES)
    try { input.type = 'text'; } catch {}

    // 2) Teclado decimal móvil
    input.setAttribute('inputmode', 'decimal');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('pattern', '[0-9]*[.,]?[0-9]*');

    // 3) Mientras escribe: permitir solo dígitos + 1 coma/punto (sin formatear)
    input.addEventListener('input', () => {
      let v = input.value ?? '';
      // quitar espacios
      v = v.replace(/\s+/g, '');

      // permitir solo números y separadores
      v = v.replace(/[^\d.,-]/g, '');

      // si hay más de un separador decimal, dejar el primero
      const parts = v.split(/[.,]/);
      if (parts.length > 2) {
        v = parts[0] + ',' + parts.slice(1).join(''); // junta el resto
      }
      input.value = v;
    }, { passive: true });

    // 4) Al salir del campo: normaliza a 2 decimales (si hay número)
    input.addEventListener('blur', () => {
      const n = parseNum(input.value);
      if (n === null) return;
      input.value = fmt2es(n);
    }, { passive: true });
  }

  function scanGridAndFix(){
    // tu precio suele tener clase ".precio"
    $$('#gridBody .precio').forEach(applyPrecioInputFix);
  }

  // A) Aplicar ya
  scanGridAndFix();

  // B) Aplicar a nuevas filas (cuando añades líneas)
  const grid = $('#gridBody');
  if (grid && !grid.__precioObserver){
    grid.__precioObserver = true;
    const mo = new MutationObserver(() => scanGridAndFix());
    mo.observe(grid, { childList: true, subtree: true });
  }

  /* =========================
     FIX: NO SALTAR AL ESCRIBIR NÚMEROS EN PRECIO
     - Solo avanzar con Enter
     - Bloquea cualquier handler global que haga "jump" con dígitos
  ========================= */
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t) return;

    // Solo en precio (grid)
    const isPrecio = t.classList && t.classList.contains('precio');
    if (!isPrecio) return;

    // Si el core tiene "teclado pro" que avanza al escribir números,
    // aquí lo cortamos: dejamos escribir normal.
    const k = e.key;

    // Permitimos escritura normal: NO hacemos nada con dígitos, coma o punto.
    // Pero evitamos que otros listeners (del core) actúen sobre esas teclas.
    if (/^\d$/.test(k) || k === ',' || k === '.' || k === 'Backspace' || k === 'Delete' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.stopImmediatePropagation();
      return;
    }

    // Enter = avanzar (si tu core ya lo hace, esto lo refuerza sin romper)
    if (k === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();

      // buscar el siguiente input dentro de la misma fila y luego siguiente fila
      const row = t.closest('.gridRow');
      if (!row) return;

      const focusables = $$('input, select, textarea, button', row)
        .filter(el => !el.disabled && el.offsetParent !== null);

      const idx = focusables.indexOf(t);
      if (idx >= 0 && idx < focusables.length - 1) {
        focusables[idx + 1].focus();
      } else {
        // si es el último, ir a la siguiente fila primer campo
        const nextRow = row.nextElementSibling;
        if (nextRow && nextRow.classList.contains('gridRow')) {
          const next = $('input, select, textarea', nextRow);
          next && next.focus();
        }
      }
    }
  }, true); // CAPTURING: gana a listeners del core

})();
/* =========================================================
   PATCH FUERTE — PRECIO ACEPTA "." y "," (iOS + handlers bloqueando)
   ✅ Pegar al FINAL de app.js
========================================================= */
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function parseNumES(v){
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\s+/g,'').replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function fmt2ES(n){
    if (!Number.isFinite(n)) return '';
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sanitizeDecimalES(raw){
    let v = String(raw ?? '').replace(/\s+/g,'');
    // permitir solo dígitos y separadores
    v = v.replace(/[^\d.,-]/g, '');

    // convertir puntos a coma (para ES)
    v = v.replaceAll('.', ',');

    // permitir SOLO una coma
    const firstComma = v.indexOf(',');
    if (firstComma !== -1) {
      v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replaceAll(',', '');
    }
    // opcional: quitar '-' si no está al inicio
    if (v.includes('-')) {
      v = (v[0] === '-' ? '-' : '') + v.replaceAll('-', '');
    }
    return v;
  }

  function insertAtCursor(el, text){
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    const pos = start + text.length;
    try { el.setSelectionRange(pos, pos); } catch {}
  }

  function hardFixPrecioInput(input){
    if (!input || input.__hardPrecioFix) return;
    input.__hardPrecioFix = true;

    // FORZAR: text + teclado decimal
    try { input.type = 'text'; } catch {}
    input.setAttribute('inputmode', 'decimal');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', 'next');

    // IMPORTANTÍSIMO: si el core bloquea "."/"," en keydown,
    // aquí lo interceptamos y lo metemos nosotros.
    input.addEventListener('keydown', (e) => {
      const k = e.key;

      // Aceptar teclas decimales aunque estén bloqueadas por otros listeners
      if (k === '.' || k === ',' || k === 'Decimal') {
        e.preventDefault();
        e.stopImmediatePropagation();

        // si ya hay coma, no insertar otra
        if ((input.value || '').includes(',')) return;

        insertAtCursor(input, ',');
        // disparar input para recalcular
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // No tocar números normales
      if (/^\d$/.test(k)) return;

      // Dejar backspace, delete, flechas, etc.
      const ok = ['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab'];
      if (ok.includes(k)) return;

      // Enter: no lo anulamos aquí (tu core ya lo usa para avanzar)
    }, true); // capture

    // BEFOREINPUT: en iOS a veces entra por aquí
    input.addEventListener('beforeinput', (e) => {
      const data = e.data;

      if (data === '.' || data === ',') {
        e.preventDefault();
        e.stopImmediatePropagation();

        if ((input.value || '').includes(',')) return;
        insertAtCursor(input, ',');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, true);

    // INPUT: sanitizar manteniendo coma
    input.addEventListener('input', () => {
      const v = sanitizeDecimalES(input.value);
      if (v !== input.value) input.value = v;
    }, true);

    // PASTE: sanitizar
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const v = sanitizeDecimalES(txt);
      // insertar en cursor
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const before = input.value.slice(0, start);
      const after  = input.value.slice(end);
      input.value = sanitizeDecimalES(before + v + after);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);

    // BLUR: formatear a 2 decimales (opcional pero PRO)
    input.addEventListener('blur', () => {
      const n = parseNumES(input.value);
      if (n === null) return;
      input.value = fmt2ES(n);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);
  }

  function scan(){
    $$('#gridBody .precio').forEach(hardFixPrecioInput);
  }

  // aplicar ya
  scan();

  // aplicar a filas nuevas
  const grid = $('#gridBody');
  if (grid && !grid.__hardPrecioObs){
    grid.__hardPrecioObs = true;
    const mo = new MutationObserver(() => scan());
    mo.observe(grid, { childList:true, subtree:true });
  }

})();
/* =========================================================
   PATCH LAYOUT — META no pisa CLIENTE (Factura screen)
   Pegar al FINAL de app.js
========================================================= */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);

  const pickCard = (idSel) => {
    const el = $(idSel);
    if (!el) return null;
    return el.closest('.card,.panel,.box,.paper,.section,.tile') || el.parentElement;
  };

  const rectsOverlap = (a,b) => {
    if (!a || !b) return false;
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    return !(A.right < B.left || A.left > B.right || A.bottom < B.top || A.top > B.bottom);
  };

  function fixHeaderLayout(){
    const metaCard   = pickCard('#facNumero') || pickCard('#facFecha');
    const clienteCard= pickCard('#cliNombre');
    const provCard   = pickCard('#provNombre');
    const qrCanvas   = $('#qrCanvas');

    if (!metaCard || !clienteCard || !provCard) return;

    // Si NO hay solape, igual aplicamos la mejora (segura) pero sin mover demasiado
    const needsFix = rectsOverlap(metaCard, clienteCard) || rectsOverlap(metaCard, provCard);

    // Buscar contenedor común (donde estén las 3 cajas)
    const root = metaCard.parentElement;
    if (!root) return;

    // Evitar duplicar
    if (root.querySelector(':scope > .fm-invHeader')) {
      // solo aseguramos estilos anti-absolute
      metaCard.classList.add('fm-metaCard');
      metaCard.style.position = 'static';
      metaCard.style.top = metaCard.style.right = metaCard.style.left = metaCard.style.bottom = 'auto';
      return;
    }

    if (!needsFix) {
      // Aun así, cortar el absoluto si existe
      metaCard.classList.add('fm-metaCard');
      metaCard.style.position = 'static';
      metaCard.style.top = metaCard.style.right = metaCard.style.left = metaCard.style.bottom = 'auto';
      return;
    }

    // Crear estructura PRO
    const header = document.createElement('div');
    header.className = 'fm-invHeader';

    const metaRow = document.createElement('div');
    metaRow.className = 'fm-invMeta';

    const grid = document.createElement('div');
    grid.className = 'fm-invGrid';

    // Marcar meta card
    metaCard.classList.add('fm-metaCard');

    // Intentar detectar caja QR (si existe wrapper); si no, creamos uno pequeño
    let qrBox = qrCanvas ? (qrCanvas.closest('.card,.panel,.box,.paper,.section,.tile') || null) : null;
    if (!qrBox && qrCanvas) {
      qrBox = document.createElement('div');
      qrBox.className = 'card';
      qrBox.style.border = '1px solid #111';
      qrBox.style.borderRadius = '14px';
      qrBox.style.padding = '10px';
      qrBox.style.background = '#fff';
      qrBox.appendChild(qrCanvas);
    }

    // Insertar header antes del primer bloque
    const first = provCard;
    root.insertBefore(header, first);

    // Mover meta arriba
    metaRow.appendChild(metaCard);

    // Mover grid: prov | qr | cliente
    grid.appendChild(provCard);
    if (qrBox) grid.appendChild(qrBox);
    grid.appendChild(clienteCard);

    header.appendChild(metaRow);
    header.appendChild(grid);

    // Cortar cualquier absolute que pudiera causar solape
    metaCard.style.position = 'static';
    metaCard.style.top = metaCard.style.right = metaCard.style.left = metaCard.style.bottom = 'auto';
    metaCard.style.zIndex = 'auto';
  }

  // Ejecutar cuando cargue y también después de cambiar tamaño (móvil/rotación)
  const run = () => setTimeout(fixHeaderLayout, 80);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
  window.addEventListener('resize', run, { passive:true });
})();


