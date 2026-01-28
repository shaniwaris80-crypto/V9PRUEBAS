/* =========================================================
   ARSLAN • FACTURAS — KIWI EDITION (B/W)
   app.js — PARTE 1/3
   - Offline-first LocalStorage
   - Datos: proveedor + clientes + vocab + productos
   - CÁLCULOS CORREGIDOS (pesos/precios) sin errores
========================================================= */

/* =========================
   0) Keys + state
========================= */
const K = {
  PROVIDER:'arslan_kiwi_provider',
  CLIENTS :'arslan_kiwi_clients',
  PRODUCTS:'arslan_kiwi_products',
  INVOICES:'arslan_kiwi_invoices',
  SETTINGS:'arslan_kiwi_settings'
};

const state = {
  provider: null,
  clients: [],
  products: {},      // key -> product
  invoices: [],
  activeInvoiceId: '',
  settings: null,

  // UI helpers
  tempPdfUrl: '',
  cloud: { enabled:false, ready:false, user:null, firebase:null },
  unlockedAccounting: false
};

/* =========================
   1) Utils
========================= */
const $ = (s)=> document.querySelector(s);
const $$ = (s)=> Array.from(document.querySelectorAll(s));
const on = (el, ev, fn)=> el && el.addEventListener(ev, fn);

function escHtml(s){
  return String(s??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function toast(msg){
  const t = $('#toast');
  if(!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>{ t.style.opacity='0'; }, 1400);
}

function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function toNum(v){
  if(v === null || v === undefined) return 0;
  if(typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim().replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function r2(n){ return Math.round((toNum(n) + Number.EPSILON) * 100) / 100; }
function r3(n){ return Math.round((toNum(n) + Number.EPSILON) * 1000) / 1000; }

function fmt2(n){
  const x = r2(n);
  return x.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtEUR(n){
  return `${fmt2(n)} €`;
}

/* =========================
   2) Cents-math (evita errores)
   - qtyM: cantidad * 1000 (milesimas)
   - priceC: precio * 100 (céntimos)
   - amountC = round(qtyM * priceC / 1000)
========================= */
function toQtyM(x){ return Math.round(r3(x) * 1000); }
function toPriceC(x){ return Math.round(r2(x) * 100); }

function mulQtyPriceToCents(qty, price){
  const qtyM = toQtyM(qty);
  const priceC = toPriceC(price);
  const cents = Math.round((qtyM * priceC) / 1000);
  return cents;
}
function centsToEUR(c){ return r2((toNum(c) / 100)); }

/* =========================
   3) Defaults (Proveedor + Clientes + Settings)
========================= */
function defaultProvider(){
  return {
    name: 'Mohammad Arslan Waris',
    nif: 'X6389988J',
    addr: 'Calle San Pablo 17, 09003 Burgos',
    phone: '631 667 893',
    email: 'shaniwaris80@gmail.com'
  };
}

function defaultSettings(){
  return {
    ivaPercent: 4,
    transportPercent: 10,
    pinAccounting: '8410',        // puedes cambiarlo en Ajustes
    firebase: { apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'', storageBucket:'' }
  };
}

function defaultClients(){
  // Incluye los clientes que tenemos guardados en tu sistema/memoria + algunos comunes.
  // Puedes añadir todos los tuyos desde la pestaña Clientes.
  return [
    { id:'cli_riviera', name:'RIVIERA', fiscalName:'CONOR ESY SLU', nif:'B16794893', addr:'Paseo del Espolón, 09003 Burgos', phone:'', email:'', notes:'' },
    { id:'cli_alesal', name:'ALESAL PAN / CAFÉ DE CALLE SAN LESMES', fiscalName:'Alesal Pan y Café S.L', nif:'B09582420', addr:'Calle San Lesmes 1, Burgos', phone:'', email:'', notes:'' },
    { id:'cli_consentidos', name:'Con/sentidos', fiscalName:'Cuevas Palacios Restauración S.L.', nif:'B10694792', addr:'C/ San Lesmes, 1 - 09004 Burgos', phone:'947 20 35 51', email:'', notes:'' },
    { id:'cli_alpanpan', name:'AL PAN PAN', fiscalName:'Al Pan Pan Burgos, S.L.', nif:'B09569344', addr:'C/ Miranda, 17 Bajo, 09002 Burgos', phone:'947277977', email:'bertiz.miranda@gmail.com', notes:'' },
    { id:'cli_nuovo', name:'CAFE BAR NUOVO', fiscalName:'CAFE BAR NUOVO', nif:'120221393', addr:'C/ San Juan de Ortega 14, 09007 Burgos', phone:'', email:'', notes:'' },
    { id:'cli_goldengarden', name:'Golden Garden', fiscalName:'David Herrera Estalayo', nif:'71281665L', addr:'Trinidad, 12, 09003, Burgos', phone:'', email:'', notes:'IVA incluido en precios (sin desglose)' }
  ];
}

/* =========================
   4) Vocab (autocomplete)
========================= */
const VOCAB = `
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
CEBOLLA ROJA
MENTA
HABANERO
RABANITOS
POMELO
PAPAYA
NISPERO
ALBARICOQUE
TOMATE PERA
TOMATE BOLA
TOMATE PINK
MELOCOTON ROJO
MELON GALIA
APIO
NARANJA SANHUJA
LIMON PRIMERA
MANGO
MELOCOTON AMARILLO
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
GUINDILLA
PATATA 25KG
PATATA 5 KG
TOMATE RAFF
REPOLLO
KIWI ZESPRI
PARAGUAYO SEGUNDA
MELON
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
HIERBABUENA
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
MANZANA KANZI
PERA ERCOLINA
NABO
CHAYOTE
ROYAL GALA 28
MANDARINA PRIMERA
PIMIENTO PINTON
HINOJOS
UVA ROJA PRIMERA
UVA BLANCA PRIMERA
`.trim().split('\n').map(s=>s.trim()).filter(Boolean);

function normalizeProdName(s){
  return String(s||'')
    .toUpperCase()
    .replace(/\s+/g,' ')
    .trim();
}

function buildDefaultProductsFromVocab(){
  const out = {};
  for(const name0 of VOCAB){
    const name = normalizeProdName(name0);
    const key = name
      .replaceAll('Ñ','N')
      .replace(/[^A-Z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .slice(0,60);

    if(out[key]) continue;

    out[key] = {
      key,
      name,
      defaultMode: guessMode(name), // kg/ud/caja
      kgPerBox: guessKgPerBox(name),
      priceKg: 0,
      priceBox: 0,
      priceUd: 0,
      costKg: 0,
      origin: '',
      history: [] // {ts, mode, price, note}
    };
  }
  return out;
}

function guessMode(name){
  const n = String(name||'');
  if(/PATATA\s+\d+\s?KG/.test(n)) return 'caja';
  if(/ALOE VERA PIEZAS|PIÑA|COCO|PAPAYA|MELON|SANDIA|BREVAS|HIGOS/.test(n)) return 'ud';
  return 'kg';
}
function guessKgPerBox(name){
  const m = String(name||'').match(/(\d+)\s?KG/);
  if(m) return toNum(m[1]);
  if(/BONIATO/.test(name)) return 10;
  return 0;
}

/* =========================
   5) Cálculo de línea (FIX)
   Reglas:
   - modo kg: usa neto si hay, si no bruto-tara; importe = neto * precio(€/kg)
   - modo ud: neto = cant; importe = cant * precio(€/ud)
   - modo caja: si neto>0 => importe = neto * precio(€/kg)
               si neto==0 => importe = cant * precio(€/caja)
     neto se auto-calcula por:
       a) bruto-tara si bruto>0
       b) si no, cant*kgPerBox si kgPerBox>0
       c) si no, neto manual
========================= */
function calcLine(ln){
  if(!ln) return ln;

  const mode = ln.mode || 'kg';

  // Cant = nº envases/cajas (para tara por envase)
  const cant  = toNum(ln.cant);

  const bruto = toNum(ln.bruto);
  const taraU = toNum(ln.tara);      // 👈 tara POR ENVASE (kg)
  let neto    = toNum(ln.neto);

  const locked = !!ln.netoLocked;

  const p = ln.productKey ? state.products?.[ln.productKey] : null;
  const kgPerBox = toNum(p?.kgPerBox);

  // ✅ Tara TOTAL (kg) = tara por envase × cant (si cant>0)
  // Si cant está vacío, asume 1 envase
  const envases = (cant > 0 ? cant : 1);
  const taraTotal = (mode === 'ud') ? 0 : (taraU * envases);

  // neto desde bruto/taraTotal
  const netoFromBruto = (bruto > 0 || taraTotal > 0) ? Math.max(0, bruto - taraTotal) : 0;

  if(mode === 'ud'){
    // ud: neto = cant (unidades)
    neto = cant > 0 ? cant : 0;
    ln.bruto = 0; ln.tara = 0;
    ln.neto = r3(neto);
    ln.netoLocked = true;
    ln.taraTotal = 0;
  }
  else if(mode === 'kg'){
    if(!locked){
      // si hay bruto, calcula neto con tara total
      if(netoFromBruto > 0) neto = netoFromBruto;
      // si no hay bruto, respeta neto manual
    }
    ln.neto = r3(neto);
    ln.taraTotal = r3(taraTotal); // 👈 guardamos tara total para PDF/tabla
  }
  else {
    // caja: neto auto por bruto-taraTotal o cant*kgPerBox
    if(!locked){
      if(netoFromBruto > 0) neto = netoFromBruto;
      else if(kgPerBox > 0 && cant > 0) neto = cant * kgPerBox;
    }
    ln.neto = r3(neto);
    ln.taraTotal = r3(taraTotal);
  }

  const price = toNum(ln.price);

  // ✅ IMPORTE: ud => cant×precio ; kg/caja => neto×precio
  let amountC = 0;
  if(mode === 'ud'){
    amountC = mulQtyPriceToCents(cant, price);
  } else {
    amountC = mulQtyPriceToCents(ln.neto, price);
  }

  ln.amount = centsToEUR(amountC);

  ln.cant  = r3(cant);
  ln.bruto = r3(bruto);
  ln.tara  = r3(taraU);   // 👈 se mantiene como tara por envase (lo que tecleas)
  ln.price = r2(price);

  return ln;
}


/* =========================
   6) Totales factura (FIX)
========================= */
function computeInvoiceTotals(inv){
  const ivaP = toNum(state.settings?.ivaPercent ?? 4) / 100;
  const trP  = toNum(state.settings?.transportPercent ?? 10) / 100;

  let subtotalC = 0;

  (inv.lines||[]).forEach(ln=>{
    if(!(ln.productName || ln.productKey)) return;
    calcLine(ln);
    subtotalC += Math.round(toNum(ln.amount) * 100);
  });

  const useTransport = !!inv.transport;
  const transportC = useTransport ? Math.round(subtotalC * trP) : 0;

  const ivaIncluido = !!inv.ivaIncluido;
  const baseC = subtotalC + transportC;

  const ivaC = ivaIncluido ? 0 : Math.round(baseC * ivaP);
  const totalC = baseC + ivaC;

  // pagos
  let paidC = 0;
  (inv.payments||[]).forEach(p=>{
    paidC += Math.round(toNum(p.amount)*100);
  });

  const pendingC = Math.max(0, totalC - paidC);

  return {
    subtotal: centsToEUR(subtotalC),
    transport: centsToEUR(transportC),
    iva: centsToEUR(ivaC),
    total: centsToEUR(totalC),
    paid: centsToEUR(paidC),
    pending: centsToEUR(pendingC)
  };
}

/* =========================
   7) Storage load/save
========================= */
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
function saveLocal(){
  saveJSON(K.PROVIDER, state.provider);
  saveJSON(K.CLIENTS, state.clients);
  saveJSON(K.PRODUCTS, state.products);
  saveJSON(K.INVOICES, state.invoices);
  saveJSON(K.SETTINGS, state.settings);
}

/* =========================
   8) Factura default (5 líneas)
========================= */
function makeEmptyLine(){
  return {
    id: uid('ln'),
    productKey:'',
    productName:'',
    mode:'kg',
    cant:0,
    bruto:0,
    tara:0,
    neto:0,
    netoLocked:false,
    price:0,
    origin:'',
    amount:0
  };
}

function autoInvoiceNumber(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  const y = d.getFullYear();
  const m = pad(d.getMonth()+1);
  const da = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `FA-${y}${m}${da}${h}${mi}`;
}

function todayISO(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function createInvoice(){
  const inv = {
    id: uid('inv'),
    number: autoInvoiceNumber(),
    dateISO: todayISO(),
    clientId: '',
    clientNameCache: '',
    tags: '',
    notes: '',
    obs: '',
    transport: false,
    ivaIncluido: false,

    payments: [],
    status: 'pendiente',
    method: 'Efectivo',

    lines: [makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine()],

    // cloud/pdf
    pdfUrl: '',
    updatedAt: Date.now(),
    createdAt: Date.now()
  };
  return inv;
}

function getClientById(id){
  return state.clients.find(c=>c.id===id) || null;
}

function getCurrentInvoice(){
  return state.invoices.find(i=>i.id===state.activeInvoiceId) || null;
}

function ensureCurrentInvoice(){
  if(!state.invoices.length){
    const inv = createInvoice();
    state.invoices.push(inv);
    state.activeInvoiceId = inv.id;
    return;
  }
  if(!state.activeInvoiceId || !getCurrentInvoice()){
    state.activeInvoiceId = state.invoices[0].id;
  }
}

/* =========================
   9) BOOT (solo carga datos)
   - El render y UI se hace en PARTE 2/3
========================= */
function bootBase(){
  state.provider = loadJSON(K.PROVIDER, defaultProvider());
  state.clients  = loadJSON(K.CLIENTS, defaultClients());
  state.settings = loadJSON(K.SETTINGS, defaultSettings());

  const prod = loadJSON(K.PRODUCTS, null);
  state.products = prod && typeof prod === 'object' ? prod : buildDefaultProductsFromVocab();

  state.invoices = loadJSON(K.INVOICES, []);
  ensureCurrentInvoice();
}

window.__ARSLAN_BOOT = function(){
  bootBase();
  // PARTE 2 añade render completo + eventos
};

window.addEventListener('DOMContentLoaded', ()=>{
  window.__ARSLAN_BOOT();
});
/* =========================================================
   app.js — PARTE 2/3
   - UI completa: tabs + listados + editor facturas
   - GRID PRO sin scroll horizontal (2 filas dentro de cada línea)
   - Autocomplete teclado ↑ ↓ Enter (NO sustituye automático)
   - Productos inteligentes (modo/origen/precio si vacío) + historial últimos 5
   - Contabilidad local (PIN)
   - Stubs Cloud/PDF/WhatsApp (se completan en PARTE 3/3)
========================================================= */

/* =========================
   10) PATCH cálculo (FIX CAJA)
   CAJA = neto(kg) × precio(€/kg) SIEMPRE
========================= */
function calcLine(ln){
  if(!ln) return ln;

  const mode = ln.mode || 'kg';
  const cant = toNum(ln.cant);
  const bruto = toNum(ln.bruto);
  const tara  = toNum(ln.tara);
  let neto = toNum(ln.neto);

  const locked = !!ln.netoLocked;
  const netoFromBruto = (bruto > 0 || tara > 0) ? Math.max(0, bruto - tara) : 0;

  const p = ln.productKey ? state.products?.[ln.productKey] : null;
  const kgPerBox = toNum(p?.kgPerBox);

  if(mode === 'ud'){
    // ud: neto = cant
    neto = cant > 0 ? cant : 0;
    ln.bruto = 0; ln.tara = 0;
    ln.neto = r3(neto);
    ln.netoLocked = true;
  }
  else if(mode === 'kg'){
    if(!locked){
      if(netoFromBruto > 0) neto = netoFromBruto;
      // si no hay bruto/tara, respeta neto manual
    }
    ln.neto = r3(neto);
  }
  else {
    // caja: neto auto por bruto-tara o cant*kgPerBox, y SIEMPRE importe = neto*precio(€/kg)
    if(!locked){
      if(netoFromBruto > 0) neto = netoFromBruto;
      else if(kgPerBox > 0 && cant > 0) neto = cant * kgPerBox;
      // si no, respeta neto tecleado
    }
    ln.neto = r3(neto);
  }

  const price = toNum(ln.price);

  // importe en céntimos sin flotantes
  let amountC = 0;
  if(mode === 'ud'){
    amountC = mulQtyPriceToCents(cant, price);      // cant × €/ud
  } else {
    amountC = mulQtyPriceToCents(ln.neto, price);   // neto(kg) × €/kg (kg y caja)
  }

  ln.amount = centsToEUR(amountC);

  ln.cant = r3(cant);
  ln.bruto = r3(bruto);
  ln.tara = r3(tara);
  ln.price = r2(price);

  return ln;
}

/* =========================
   11) Tabs + modal
========================= */
function showTab(id){
  $$('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab === id));
  $$('.panel').forEach(p=> p.classList.toggle('show', p.id === id));
}
function openModal(sel){ const m=$(sel); if(m) m.classList.add('show'); }
function closeModal(sel){ const m=$(sel); if(m) m.classList.remove('show'); }

/* =========================
   12) Autocomplete (NO sustituye automático)
========================= */
function createSuggestUI(host){
  const wrap = document.createElement('div');
  wrap.className = 'suggestList';
  wrap.style.display = 'none';
  host.appendChild(wrap);
  return wrap;
}

function attachAutocomplete(input, { getItems, onPick }){
  if(!input) return;

  const host = input.closest('.suggest') || input.parentElement;
  host.classList.add('suggest');
  const listEl = createSuggestUI(host);

  let items = [];
  let active = -1;
  let open = false;

  function close(){
    open = false;
    active = -1;
    listEl.style.display = 'none';
    listEl.innerHTML = '';
  }

  function render(){
    listEl.innerHTML = '';
    if(!items.length){ close(); return; }
    open = true;
    listEl.style.display = 'block';
    items.forEach((it, idx)=>{
      const div = document.createElement('div');
      div.className = 'suggestItem' + (idx===active ? ' active' : '');
      div.innerHTML = escHtml(it.label || it.name || '');
      div.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        onPick(it);
        close();
      });
      listEl.appendChild(div);
    });
  }

  function refresh(){
    const q = normalizeProdName(input.value || '');
    items = getItems(q);
    active = items.length ? 0 : -1;
    render();
  }

  input.addEventListener('input', ()=>{
    refresh();
  });

  input.addEventListener('keydown', (e)=>{
    if(!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){
      refresh();
      return;
    }
    if(!open) return;

    if(e.key === 'ArrowDown'){
      e.preventDefault();
      active = Math.min(items.length-1, active+1);
      render();
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      active = Math.max(0, active-1);
      render();
    } else if(e.key === 'Enter'){
      e.preventDefault();
      const it = items[active];
      if(it){
        onPick(it);
        close();
      }
    } else if(e.key === 'Escape'){
      e.preventDefault();
      close();
    }
  });

  input.addEventListener('blur', ()=>{
    setTimeout(close, 120);
  });

  return { close, refresh };
}

function suggestProducts(q){
  if(!q) return [];
  const out = [];
  const qn = q;
  // Prioriza startsWith
  for(const key in state.products){
    const p = state.products[key];
    if(!p?.name) continue;
    const name = p.name;
    if(name.startsWith(qn)){
      out.push({ key, label: name });
      if(out.length>=20) break;
    }
  }
  if(out.length < 20){
    for(const key in state.products){
      const p = state.products[key];
      if(!p?.name) continue;
      const name = p.name;
      if(!name.startsWith(qn) && name.includes(qn)){
        out.push({ key, label: name });
        if(out.length>=20) break;
      }
    }
  }
  return out;
}

/* =========================
   13) Render: selects
========================= */
function renderAllClientSelects(){
  const selects = [$('#invClient'), $('#accClient')].filter(Boolean);
  const options = ['<option value="">— Seleccionar cliente —</option>']
    .concat(state.clients
      .slice()
      .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
      .map(c=> `<option value="${escHtml(c.id)}">${escHtml(c.name || c.fiscalName || c.id)}</option>`))
    .join('');

  selects.forEach(sel=>{
    const cur = sel.value;
    sel.innerHTML = options;
    if(cur) sel.value = cur;
  });
}

/* =========================
   14) Facturas: listado
========================= */
function invoiceDisplayClient(inv){
  const c = getClientById(inv.clientId);
  return c?.name || inv.clientNameCache || '';
}

function renderInvoiceList(){
  const box = $('#invoiceList');
  if(!box) return;

  const q = normalizeProdName($('#invSearch')?.value || '');
  const list = (state.invoices||[])
    .slice()
    .sort((a,b)=> (b.dateISO||'').localeCompare(a.dateISO||'') || (b.createdAt||0)-(a.createdAt||0))
    .filter(inv=>{
      if(!q) return true;
      const hay = `${inv.number||''} ${invoiceDisplayClient(inv)} ${inv.tags||''}`.toUpperCase();
      return hay.includes(q);
    });

  box.innerHTML = list.map(inv=>{
    const t = computeInvoiceTotals(inv);
    const active = inv.id === state.activeInvoiceId;
    return `
      <div class="invItem ${active ? 'active':''}" data-id="${escHtml(inv.id)}">
        <div class="invTop">
          <div class="invNum">${escHtml(inv.number || '(sin nº)')}</div>
          <div class="badge">${escHtml(fmt2(t.total))} €</div>
        </div>
        <div class="invMeta">
          <span class="badge">${escHtml(inv.dateISO||'')}</span>
          <span class="badge">${escHtml(invoiceDisplayClient(inv) || '—')}</span>
          ${inv.tags ? `<span class="badge">${escHtml(inv.tags)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<div class="muted tiny">Sin facturas.</div>`;

  $$('.invItem').forEach(el=>{
    el.addEventListener('click', ()=>{
      state.activeInvoiceId = el.dataset.id;
      ensureCurrentInvoice();
      renderInvoiceUI();
      renderInvoiceList();
      saveLocal();
    });
  });
}

/* =========================
   15) Factura: render editor
========================= */
function setProviderUI(){
  $('#provName').value = state.provider.name || '';
  $('#provNif').value  = state.provider.nif || '';
  $('#provAddr').value = state.provider.addr || '';
  $('#provPhone').value= state.provider.phone || '';
  $('#provEmail').value= state.provider.email || '';
}

function setClientInlineUI(client){
  $('#cliName').value = client?.name || '';
  $('#cliNif').value = client?.nif || '';
  $('#cliAddr').value = client?.addr || '';
  $('#cliPhone').value = client?.phone || '';
  $('#cliEmail').value = client?.email || '';
}

function ensureInvoiceLines(inv){
  if(!Array.isArray(inv.lines)) inv.lines = [];
  // por defecto 5 líneas
  while(inv.lines.length < 5) inv.lines.push(makeEmptyLine());
}

function renderInvoiceUI(){
  const inv = getCurrentInvoice();
  if(!inv) return;

  ensureInvoiceLines(inv);

  // provider
  setProviderUI();

  // client select
  renderAllClientSelects();
  $('#invClient').value = inv.clientId || '';

  const client = getClientById(inv.clientId);
  setClientInlineUI(client);

  // meta
  $('#invDate').value = inv.dateISO || todayISO();
  $('#invNumber').value = inv.number || '';
  $('#invTags').value = inv.tags || '';
  $('#invNotes').value = inv.notes || '';
  $('#invObs').value = inv.obs || '';

  $('#chkTransport').checked = !!inv.transport;
  $('#chkIvaIncluido').checked = !!inv.ivaIncluido;

  $('#payStatus').value = inv.status || 'pendiente';
  $('#payMethod').value = inv.method || 'Efectivo';

  // QR preview
  renderQR(inv);

  // lines
  renderLines(inv);

  // totals + preview
  recalcInvoiceTotalsAndUI(true);
}

function renderLines(inv){
  const body = $('#linesBody');
  if(!body) return;

  body.innerHTML = '';

  inv.lines.forEach((ln)=>{
    if(!ln.id) ln.id = uid('ln');
    if(!ln.mode) ln.mode = 'kg';
    if(typeof ln._open !== 'boolean') ln._open = false;

    const p = ln.productKey ? state.products?.[ln.productKey] : null;
    const last = getLastPriceHint(p, ln.mode);

    const taraTotal = (ln.mode === 'ud') ? 0 : (toNum(ln.taraTotal) || (toNum(ln.tara) * (toNum(ln.cant) || 1)));

    const card = document.createElement('div');
    card.className = 'lineCard' + (ln._open ? ' open' : '');
    card.dataset.id = ln.id;

    card.innerHTML = `
      <div class="lineTopRow">
        <div class="suggest lineProdWrap fieldBox">
          <div class="fieldLab">Producto</div>
          <input class="input lnProd" placeholder="Escribe y elige con ↑ ↓ Enter" value="${escHtml(ln.productName||'')}" />
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Modo</div>
          <select class="input lnMode">
            <option value="kg" ${ln.mode==='kg'?'selected':''}>kg</option>
            <option value="caja" ${ln.mode==='caja'?'selected':''}>caja</option>
            <option value="ud" ${ln.mode==='ud'?'selected':''}>ud</option>
          </select>
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Precio</div>
          <input class="input lnPrice" inputmode="decimal" placeholder="€" value="${ln.price?escHtml(String(ln.price).replace('.',',')):''}" />
        </div>

        <div class="amountBox2">
          <div class="fieldLab">Importe</div>
          <div class="amountVal lnAmountVal">${escHtml(fmt2(ln.amount||0))} €</div>
        </div>

        <button class="iconBtn lnMore" title="Más / menos">${ln._open ? '▴' : '▾'}</button>
        <button class="iconBtn lnDel" title="Eliminar">×</button>
      </div>

      <div class="lineBottomWrap">
        <div class="fieldBox">
          <div class="fieldLab">${ln.mode==='ud' ? 'Unidades' : 'Envases/Cajas'}</div>
          <input class="input lnCant" inputmode="decimal" placeholder="Cant." value="${ln.cant?escHtml(String(ln.cant).replace('.',',')):''}" />
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Bruto (kg)</div>
          <input class="input lnBruto" inputmode="decimal" placeholder="kg" value="${ln.bruto?escHtml(String(ln.bruto).replace('.',',')):''}" />
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Tara / envase (kg)</div>
          <input class="input lnTara" inputmode="decimal" placeholder="kg" value="${ln.tara?escHtml(String(ln.tara).replace('.',',')):''}" />
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Neto (kg)</div>
          <input class="input lnNeto" inputmode="decimal" placeholder="auto" value="${ln.neto?escHtml(String(ln.neto).replace('.',',')):''}" />
        </div>

        <div class="fieldBox">
          <div class="fieldLab">Origen</div>
          <input class="input lnOrigin" placeholder="Origen" value="${escHtml(ln.origin||'')}" />
        </div>

        <div class="fieldHint">
          <span>Último (solo pantalla): <b>${escHtml(last)}</b></span>
          <span>Tara total: <b class="lnTaraTotal">${escHtml(fmt2(taraTotal))}</b> kg</span>
        </div>
      </div>
    `;

    body.appendChild(card);

    // Autocomplete (NO sustituye automático)
    const inpProd = card.querySelector('.lnProd');
    attachAutocomplete(inpProd, {
      getItems: (q)=> suggestProducts(q),
      onPick: (it)=>{
        const prod = state.products[it.key];
        if(!prod) return;

        ln.productKey = prod.key;
        ln.productName = prod.name;

        ln.mode = prod.defaultMode || ln.mode || 'kg';
        if(!ln.origin) ln.origin = prod.origin || '';

        if(!toNum(ln.price)){
          const px = priceForMode(prod, ln.mode);
          if(px > 0) ln.price = px;
        }

        if(ln.mode === 'ud'){
          ln.netoLocked = true;
          ln.bruto = 0; ln.tara = 0;
        }

        calcLine(ln);
        inv.updatedAt = Date.now();
        saveLocal();

        renderInvoiceUI();
      }
    });

    bindLineEvents(inv, ln, card);
  });
}

function bindLineEvents(inv, ln, card){
  const elMode  = card.querySelector('.lnMode');
  const elCant  = card.querySelector('.lnCant');
  const elPrice = card.querySelector('.lnPrice');
  const elBruto = card.querySelector('.lnBruto');
  const elTara  = card.querySelector('.lnTara');
  const elNeto  = card.querySelector('.lnNeto');
  const elOrig  = card.querySelector('.lnOrigin');
  const elDel   = card.querySelector('.lnDel');
  const elMore  = card.querySelector('.lnMore');

  const elAmount = card.querySelector('.lnAmountVal');
  const elTaraTot= card.querySelector('.lnTaraTotal');

  function applyModeUI(){
    const mode = elMode.value;

    const isUd = (mode === 'ud');

    // En ud: deshabilitar bruto/tara/neto (neto = cant)
    elBruto.disabled = isUd;
    elTara.disabled  = isUd;
    elNeto.disabled  = false; // neto puede quedar editable (pero lo bloqueamos en calcLine)

    if(isUd){
      elBruto.value = '';
      elTara.value = '';
    }
  }

  const sync = ()=>{
    ln.mode  = elMode.value;
    ln.cant  = toNum(elCant.value);
    ln.price = toNum(elPrice.value);

    ln.bruto = toNum(elBruto.value);
    ln.tara  = toNum(elTara.value);

    // neto manual => lock
    const raw = (elNeto.value || '').trim();
    if(raw !== ''){
      ln.neto = toNum(raw);
      ln.netoLocked = true;
    }else{
      ln.neto = 0;
      ln.netoLocked = false;
    }

    ln.origin = elOrig.value || '';

    applyModeUI();

    // ✅ cálculo completo (incluye tara por envase × cant si usas el patch de taraTotal)
    calcLine(ln);

    // si auto neto, pintarlo
    if(!ln.netoLocked && (ln.mode === 'kg' || ln.mode === 'caja')){
      elNeto.value = ln.neto ? String(ln.neto).replace('.',',') : '';
    }
    if(ln.mode === 'ud'){
      elNeto.value = ln.neto ? String(ln.neto).replace('.',',') : '';
    }

    const taraTotal = (ln.mode === 'ud') ? 0 : (toNum(ln.taraTotal) || (toNum(ln.tara) * (toNum(ln.cant) || 1)));
    if(elTaraTot) elTaraTot.textContent = fmt2(taraTotal);

    if(elAmount) elAmount.textContent = `${fmt2(ln.amount||0)} €`;

    inv.updatedAt = Date.now();
    recalcInvoiceTotalsAndUI(false);
    saveLocal();
  };

  ['input','change'].forEach(ev=>{
    elMode.addEventListener(ev, sync);
    elCant.addEventListener(ev, sync);
    elPrice.addEventListener(ev, sync);
    elBruto.addEventListener(ev, sync);
    elTara.addEventListener(ev, sync);
    elNeto.addEventListener(ev, sync);
    elOrig.addEventListener(ev, sync);
  });

  elDel.addEventListener('click', ()=>{
    inv.lines = (inv.lines||[]).filter(x=> x.id !== ln.id);
    if(inv.lines.length < 1) inv.lines = [makeEmptyLine()];
    inv.updatedAt = Date.now();
    saveLocal();
    renderInvoiceUI();
    renderInvoiceList();
  });

  elMore.addEventListener('click', ()=>{
    ln._open = !ln._open;
    inv.updatedAt = Date.now();
    saveLocal();
    renderInvoiceUI();
  });

  applyModeUI();
}


        // - netoLocked: si cambia a ud, bloquea; si cambia a kg/caja, respeta
        if(ln.mode === 'ud'){
          ln.netoLocked = true;
          ln.bruto = 0; ln.tara = 0;
        }

        // refrescar UI de esa línea
        renderInvoiceUI();
        inv.updatedAt = Date.now();
        saveLocal();
      }
    });

    // binds
    bindLineEvents(inv, ln, row);
  });
}

function bindLineEvents(inv, ln, row){
  const elMode = row.querySelector('.lnMode');
  const elCant = row.querySelector('.lnCant');
  const elPrice= row.querySelector('.lnPrice');
  const elBruto= row.querySelector('.lnBruto');
  const elTara = row.querySelector('.lnTara');
  const elNeto = row.querySelector('.lnNeto');
  const elOrig = row.querySelector('.lnOrigin');
  const elDel  = row.querySelector('.lnDel');

  const sync = ()=>{
    ln.mode = elMode.value;

    ln.cant = toNum(elCant.value);
    ln.price = toNum(elPrice.value);

    ln.bruto = toNum(elBruto.value);
    ln.tara  = toNum(elTara.value);

    // neto manual: si el usuario toca neto => lock
    const netoRaw = elNeto.value.trim();
    if(netoRaw !== ''){
      ln.neto = toNum(netoRaw);
      ln.netoLocked = true;
    } else {
      // si lo vacía, desbloquea para auto
      ln.neto = 0;
      ln.netoLocked = false;
    }

    ln.origin = elOrig.value;

    // reglas extra: ud bloquea
    if(ln.mode === 'ud'){
      ln.netoLocked = true;
      ln.bruto = 0; ln.tara = 0;
      elBruto.value = '';
      elTara.value = '';
    }

    calcLine(ln);

    // pintar neto calculado si está en auto
    if(!ln.netoLocked && (ln.mode === 'kg' || ln.mode === 'caja')){
      elNeto.value = ln.neto ? String(ln.neto).replace('.',',') : '';
    }

    row.querySelector('.lnAmount').textContent = `${fmt2(ln.amount||0)} €`;

    inv.updatedAt = Date.now();
    recalcInvoiceTotalsAndUI(false);
    saveLocal();
  };

  ['change','input'].forEach(ev=>{
    elMode.addEventListener(ev, sync);
    elCant.addEventListener(ev, sync);
    elPrice.addEventListener(ev, sync);
    elBruto.addEventListener(ev, sync);
    elTara.addEventListener(ev, sync);
    elNeto.addEventListener(ev, sync);
    elOrig.addEventListener(ev, sync);
  });

  elDel.addEventListener('click', ()=>{
    // no dejes 0 líneas, al menos 1
    inv.lines = (inv.lines||[]).filter(x=> x.id !== ln.id);
    if(inv.lines.length < 1) inv.lines = [makeEmptyLine()];
    inv.updatedAt = Date.now();
    renderInvoiceUI();
    renderInvoiceList();
    saveLocal();
  });
}

/* =========================
   16) Productos inteligentes: precio/historial
========================= */
function priceForMode(prod, mode){
  if(!prod) return 0;
  if(mode === 'ud') return toNum(prod.priceUd || 0);
  if(mode === 'caja' || mode === 'kg') return toNum(prod.priceKg || 0); // FIX: caja trabaja €/kg
  return 0;
}

function getLastPriceHint(prod, mode){
  if(!prod) return '—';
  const h = Array.isArray(prod.history) ? prod.history : [];
  const last = h.slice().reverse().find(x=> x && (x.mode===mode || mode==='caja' && x.mode==='kg'));
  if(last) return `${fmt2(last.price)}€ (${new Date(last.ts).toLocaleDateString('es-ES')})`;
  const p = priceForMode(prod, mode);
  return p ? `${fmt2(p)}€ (guardado)` : '—';
}

function pushPriceHistory(prod, mode, price, note=''){
  if(!prod) return;
  const h = Array.isArray(prod.history) ? prod.history : [];
  h.push({ ts: Date.now(), mode, price: r2(price), note });
  // mantener últimas 5
  prod.history = h.slice(-5);
}

/* =========================
   17) Totales + pagos + preview
========================= */
function recalcInvoiceTotalsAndUI(force){
  const inv = getCurrentInvoice();
  if(!inv) return;

  // recalcula todas las líneas (garantiza)
  (inv.lines||[]).forEach(ln=> calcLine(ln));

  const t = computeInvoiceTotals(inv);

  $('#tSubtotal').textContent = fmtEUR(t.subtotal);
  $('#tTransport').textContent = fmtEUR(t.transport);
  $('#tIva').textContent = inv.ivaIncluido ? '— (incluido)' : fmtEUR(t.iva);
  $('#tTotal').textContent = fmtEUR(t.total);
  $('#tPending').textContent = fmtEUR(t.pending);

  renderPayments(inv);
  renderPreview(inv, t);

  if(force) saveLocal();
}

function renderPayments(inv){
  const box = $('#payList');
  if(!box) return;
  const pays = Array.isArray(inv.payments) ? inv.payments : [];
  box.innerHTML = pays.map((p, idx)=>{
    return `
      <div class="totRow">
        <span>${escHtml(new Date(p.ts).toLocaleDateString('es-ES'))}</span>
        <b>${escHtml(fmt2(p.amount))} €</b>
        <button class="btn ghost" data-i="${idx}" style="padding:6px 10px;border-radius:999px;">x</button>
      </div>
    `;
  }).join('') || `<div class="muted tiny">Sin pagos parciales.</div>`;

  box.querySelectorAll('button[data-i]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const i = Number(b.dataset.i);
      inv.payments.splice(i,1);
      inv.updatedAt = Date.now();
      recalcInvoiceTotalsAndUI(true);
      renderInvoiceList();
    });
  });
}

function renderPreview(inv, t){
  const box = $('#invoicePreview');
  if(!box) return;

  const cli = getClientById(inv.clientId);

  const lines = (inv.lines||[])
    .filter(ln => (ln.productName||ln.productKey))
    .slice(0, 6)
    .map(ln=>{
      const mode = ln.mode || 'kg';
      const neto = toNum(ln.neto);
      const price = toNum(ln.price);
      const amount = toNum(ln.amount);

      // “últimos precios” no se imprimen: aquí sí los puedes ver
      const p = ln.productKey ? state.products?.[ln.productKey] : null;
      const hint = getLastPriceHint(p, mode);

      const qtyLabel = (mode==='ud') ? `${fmt2(ln.cant)} ud` :
                      (mode==='caja') ? `${fmt2(ln.cant)} caja · neto ${fmt2(neto)}kg` :
                      `${fmt2(neto)} kg`;

      return `<div style="display:flex;justify-content:space-between;gap:8px;margin:4px 0;">
        <div style="flex:1;">
          <b>${escHtml(ln.productName||'')}</b>
          <div class="muted tiny">${escHtml(qtyLabel)} · ${escHtml(fmt2(price))}€</div>
          <div class="muted tiny">Último: ${escHtml(hint)}</div>
        </div>
        <div style="min-width:110px;text-align:right;font-weight:800;">${escHtml(fmt2(amount))}€</div>
      </div>`;
    }).join('');

  box.innerHTML = `
    <div class="muted tiny">${escHtml(inv.number||'')}</div>
    <div style="font-weight:900;margin:4px 0;">${escHtml(cli?.name || inv.clientNameCache || '— Cliente —')}</div>
    <div class="muted tiny">${escHtml(inv.dateISO||'')}</div>
    <hr class="hr" style="margin:10px 0;"/>
    ${lines || `<div class="muted tiny">Sin líneas.</div>`}
    <hr class="hr" style="margin:10px 0;"/>
    <div style="display:flex;justify-content:space-between;">
      <span style="font-weight:900;">TOTAL</span>
      <span style="font-weight:900;">${escHtml(fmt2(t.total))}€</span>
    </div>
  `;
}

/* =========================
   18) QR AEAT (pantalla)
   (Formato “robusto” y estable: texto compacto)
========================= */
function buildQrText(inv){
  const cli = getClientById(inv.clientId);
  const t = computeInvoiceTotals(inv);

  // Texto compacto (lo que importa):
  // Emisor NIF, Nº, Fecha, Total, Cliente NIF, Tags (opcional)
  const parts = [
    `EMI_NIF=${state.provider.nif||''}`,
    `FAC=${inv.number||''}`,
    `FEC=${inv.dateISO||''}`,
    `TOT=${fmt2(t.total)}`,
    `CLI_NIF=${cli?.nif || ''}`
  ];
  if(inv.tags) parts.push(`TAGS=${inv.tags}`);
  return parts.join('|');
}

function renderQR(inv){
  const box = $('#qrBox');
  if(!box) return;
  box.innerHTML = '';
  const txt = buildQrText(inv);
  // eslint-disable-next-line no-undef
  new QRCode(box, { text: txt, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  box.dataset.qrText = txt;
}

/* =========================
   19) Clientes TAB
========================= */
let selectedClientId = '';

function renderClientList(){
  const box = $('#clientList');
  if(!box) return;
  const q = normalizeProdName($('#cliSearch')?.value || '');

  const list = state.clients
    .slice()
    .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    .filter(c=>{
      if(!q) return true;
      const hay = `${c.name||''} ${c.fiscalName||''} ${c.nif||''} ${c.addr||''}`.toUpperCase();
      return hay.includes(q);
    });

  box.innerHTML = list.map(c=>{
    const active = c.id === selectedClientId;
    return `<div class="itemSimple ${active?'active':''}" data-id="${escHtml(c.id)}">
      <b>${escHtml(c.name||c.fiscalName||c.id)}</b>
      <div class="muted tiny">${escHtml(c.nif||'')} · ${escHtml(c.addr||'')}</div>
    </div>`;
  }).join('') || `<div class="muted tiny">Sin clientes.</div>`;

  box.querySelectorAll('[data-id]').forEach(el=>{
    el.addEventListener('click', ()=>{
      selectedClientId = el.dataset.id;
      const c = getClientById(selectedClientId);
      fillClientEditor(c);
      renderClientList();
    });
  });
}

function fillClientEditor(c){
  $('#cliId').value = c?.id || '';
  $('#cliEditName').value = c?.name || '';
  $('#cliEditAlias').value = c?.fiscalName || '';
  $('#cliEditNif').value = c?.nif || '';
  $('#cliEditAddr').value = c?.addr || '';
  $('#cliEditPhone').value = c?.phone || '';
  $('#cliEditEmail').value = c?.email || '';
  $('#cliEditNotes').value = c?.notes || '';
}

function readClientEditor(){
  const id = $('#cliId').value || uid('cli');
  return {
    id,
    name: ($('#cliEditName').value || '').trim(),
    fiscalName: ($('#cliEditAlias').value || '').trim(),
    nif: ($('#cliEditNif').value || '').trim(),
    addr: ($('#cliEditAddr').value || '').trim(),
    phone: ($('#cliEditPhone').value || '').trim(),
    email: ($('#cliEditEmail').value || '').trim(),
    notes: ($('#cliEditNotes').value || '').trim()
  };
}

/* =========================
   20) Productos TAB
========================= */
let selectedProdKey = '';

function renderProductList(){
  const box = $('#productList');
  if(!box) return;
  const q = normalizeProdName($('#prodSearch')?.value || '');

  const keys = Object.keys(state.products||{})
    .sort((a,b)=> (state.products[a]?.name||'').localeCompare(state.products[b]?.name||''));

  const list = keys
    .map(k=> state.products[k])
    .filter(p=>{
      if(!q) return true;
      const hay = `${p.name||''} ${p.key||''}`.toUpperCase();
      return hay.includes(q);
    })
    .slice(0, 400);

  box.innerHTML = list.map(p=>{
    const active = p.key === selectedProdKey;
    return `<div class="itemSimple ${active?'active':''}" data-key="${escHtml(p.key)}">
      <b>${escHtml(p.name||p.key)}</b>
      <div class="muted tiny">kg/caja/ud · kgCaja:${escHtml(String(p.kgPerBox||0))} · €/kg:${escHtml(String(p.priceKg||0))}</div>
    </div>`;
  }).join('') || `<div class="muted tiny">Sin productos.</div>`;

  box.querySelectorAll('[data-key]').forEach(el=>{
    el.addEventListener('click', ()=>{
      selectedProdKey = el.dataset.key;
      fillProductEditor(state.products[selectedProdKey]);
      renderProductList();
    });
  });
}

function fillProductEditor(p){
  $('#prodKey').value = p?.key || '';
  $('#prodName').value = p?.name || '';
  $('#prodMode').value = p?.defaultMode || 'kg';
  $('#prodKgBox').value = p?.kgPerBox ? String(p.kgPerBox).replace('.',',') : '';
  $('#prodPriceKg').value = p?.priceKg ? String(p.priceKg).replace('.',',') : '';
  $('#prodPriceBox').value = p?.priceBox ? String(p.priceBox).replace('.',',') : '';
  $('#prodPriceUd').value = p?.priceUd ? String(p.priceUd).replace('.',',') : '';
  $('#prodCost').value = p?.costKg ? String(p.costKg).replace('.',',') : '';
  $('#prodOrigin').value = p?.origin || '';

  const h = Array.isArray(p?.history) ? p.history : [];
  $('#prodHistory').innerHTML = h.length
    ? h.slice().reverse().map(x=>{
        const d = new Date(x.ts).toLocaleString('es-ES');
        return `<div>• <b>${escHtml(x.mode)}</b>: ${escHtml(fmt2(x.price))}€ <span class="muted tiny">(${escHtml(d)})</span></div>`;
      }).join('')
    : '—';
}

function readProductEditor(existingKey){
  const name = normalizeProdName($('#prodName').value || '');
  const key = existingKey || (name
      .replaceAll('Ñ','N')
      .replace(/[^A-Z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .slice(0,60)) || uid('prd');

  const pOld = state.products[key] || null;

  const pNew = {
    key,
    name,
    defaultMode: $('#prodMode').value || 'kg',
    kgPerBox: toNum($('#prodKgBox').value),
    priceKg: toNum($('#prodPriceKg').value),
    priceBox: toNum($('#prodPriceBox').value),
    priceUd: toNum($('#prodPriceUd').value),
    costKg: toNum($('#prodCost').value),
    origin: ($('#prodOrigin').value || '').trim(),
    history: Array.isArray(pOld?.history) ? pOld.history.slice() : []
  };

  // historial: si cambia precioKg/priceUd
  if(pOld){
    if(toNum(pOld.priceKg) !== toNum(pNew.priceKg) && toNum(pNew.priceKg) > 0){
      pushPriceHistory(pNew, 'kg', pNew.priceKg, 'edit');
    }
    if(toNum(pOld.priceUd) !== toNum(pNew.priceUd) && toNum(pNew.priceUd) > 0){
      pushPriceHistory(pNew, 'ud', pNew.priceUd, 'edit');
    }
  }else{
    if(toNum(pNew.priceKg)>0) pushPriceHistory(pNew, 'kg', pNew.priceKg, 'new');
    if(toNum(pNew.priceUd)>0) pushPriceHistory(pNew, 'ud', pNew.priceUd, 'new');
  }

  // mantener solo últimas 5
  pNew.history = (pNew.history||[]).slice(-5);

  return pNew;
}

/* =========================
   21) Contabilidad (PIN) — local
========================= */
function renderAccountingLockedState(){
  const tbody = $('#accTable tbody');
  if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">Bloqueado 🔒</td></tr>`;
  $('#accSales').textContent = '0,00 €';
  $('#accIva').textContent = '0,00 €';
  $('#accN').textContent = '0';
  $('#accMargin').textContent = '0,00 €';
}

function getInvoiceCost(inv){
  let costC = 0;
  (inv.lines||[]).forEach(ln=>{
    if(!(ln.productKey||ln.productName)) return;
    calcLine(ln);
    const p = ln.productKey ? state.products?.[ln.productKey] : null;
    const c = toNum(p?.costKg || 0);
    if(!c) return;

    if((ln.mode||'kg') === 'ud'){
      // coste ud: cant × costeKg (si lo usas como €/ud también)
      // si quieres diferente, pon costKg = coste por unidad en productos ud
      costC += mulQtyPriceToCents(toNum(ln.cant), c);
    } else {
      costC += mulQtyPriceToCents(toNum(ln.neto), c);
    }
  });
  return centsToEUR(costC);
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

  let salesC = 0;
  let ivaC = 0;
  let costC = 0;

  const rows = invs.map(inv=>{
    const t = computeInvoiceTotals(inv);
    const totalC = Math.round(toNum(t.total)*100);
    salesC += totalC;

    // IVA solo si no incluido
    if(!inv.ivaIncluido){
      ivaC += Math.round(toNum(t.iva)*100);
    }

    const c = getInvoiceCost(inv);
    const cC = Math.round(toNum(c)*100);
    costC += cC;

    const cli = getClientById(inv.clientId);
    return `
      <tr>
        <td>${escHtml(inv.dateISO||'')}</td>
        <td>${escHtml(inv.number||'')}</td>
        <td>${escHtml(cli?.name || inv.clientNameCache || '')}</td>
        <td style="text-align:right;">${escHtml(fmt2(toNum(t.total)))}</td>
        <td style="text-align:right;">${escHtml(fmt2(toNum(c)))}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="5" class="muted">Sin resultados.</td></tr>`;

  const marginC = salesC - costC;

  $('#accSales').textContent = fmtEUR(centsToEUR(salesC));
  $('#accIva').textContent = fmtEUR(centsToEUR(ivaC));
  $('#accN').textContent = String(invs.length);
  $('#accMargin').textContent = fmtEUR(centsToEUR(marginC));
}

/* =========================
   22) Import/Export
========================= */
function doExport(){
  const payload = {
    ts: Date.now(),
    provider: state.provider,
    clients: state.clients,
    products: state.products,
    invoices: state.invoices,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ARSLAN_KIWI_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Export OK');
}

async function doImportFile(file){
  try{
    const txt = await file.text();
    const data = JSON.parse(txt);

    if(data.provider) state.provider = data.provider;
    if(Array.isArray(data.clients)) state.clients = data.clients;
    if(data.products && typeof data.products === 'object') state.products = data.products;
    if(Array.isArray(data.invoices)) state.invoices = data.invoices;
    if(data.settings) state.settings = { ...defaultSettings(), ...data.settings };

    ensureCurrentInvoice();
    saveLocal();

    // re-render todo
    renderAllClientSelects();
    renderInvoiceUI();
    renderInvoiceList();
    renderClientList();
    renderProductList();
    renderSettingsUI();
    renderAccounting();

    toast('Import OK');
  }catch(e){
    alert('Import error: ' + (e?.message || e));
  }
}

/* =========================
   23) Ajustes UI
========================= */
function renderSettingsUI(){
  $('#setPin').value = state.settings.pinAccounting || '';
  $('#setIva').value = String(state.settings.ivaPercent ?? 4).replace('.',',');
  $('#setTransport').value = String(state.settings.transportPercent ?? 10).replace('.',',');

  const fb = state.settings.firebase || {};
  $('#fbApiKey').value = fb.apiKey || '';
  $('#fbAuthDomain').value = fb.authDomain || '';
  $('#fbDatabaseURL').value = fb.databaseURL || '';
  $('#fbProjectId').value = fb.projectId || '';
  $('#fbAppId').value = fb.appId || '';
  $('#fbStorageBucket').value = fb.storageBucket || '';
}

function isFirebaseConfigured(){
  const fb = state.settings.firebase || {};
  return !!(fb.apiKey && fb.authDomain && fb.databaseURL && fb.projectId && fb.appId);
}

/* =========================
   24) Stubs (PARTE 3 los reemplaza)
========================= */
async function generatePDF(){ alert('Falta PARTE 3/3 (PDF PRO).'); }
function sendWhatsApp(){ alert('Falta PARTE 3/3 (WhatsApp PRO).'); }
async function cloudSync(){ alert('Falta PARTE 3/3 (Cloud).'); }
function updateCloudUIStatus(){
  const el = $('#cloudInfo');
  if(!el) return;
  el.textContent = isFirebaseConfigured() ? 'Cloud: listo (sin login)' : 'Cloud: OFF (local)';
}

/* =========================
   25) Bind UI (eventos)
========================= */
function bindTabs(){
  $$('.tab').forEach(b=>{
    b.addEventListener('click', ()=>{
      showTab(b.dataset.tab);
      if(b.dataset.tab === 'tabContabilidad'){
        renderAccounting();
      }
    });
  });
}

function bindInvoiceMeta(){
  const inv = getCurrentInvoice();
  if(!inv) return;

  on($('#invClient'),'change', ()=>{
    const inv = getCurrentInvoice();
    if(!inv) return;
    inv.clientId = $('#invClient').value || '';
    const c = getClientById(inv.clientId);
    inv.clientNameCache = c?.name || '';
    setClientInlineUI(c);
    inv.updatedAt = Date.now();
    renderQR(inv);
    recalcInvoiceTotalsAndUI(true);
    renderInvoiceList();
  });

  on($('#invDate'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.dateISO = $('#invDate').value || todayISO();
    inv.updatedAt = Date.now();
    renderQR(inv);
    renderInvoiceList();
    saveLocal();
  });

  on($('#invNumber'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.number = $('#invNumber').value || '';
    inv.updatedAt = Date.now();
    renderQR(inv);
    renderInvoiceList();
    saveLocal();
  });

  on($('#invTags'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.tags = $('#invTags').value || '';
    inv.updatedAt = Date.now();
    renderQR(inv);
    renderInvoiceList();
    saveLocal();
  });

  on($('#invNotes'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.notes = $('#invNotes').value || '';
    inv.updatedAt = Date.now();
    saveLocal();
  });

  on($('#invObs'),'input', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.obs = $('#invObs').value || '';
    inv.updatedAt = Date.now();
    saveLocal();
  });

  on($('#chkTransport'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.transport = $('#chkTransport').checked;
    inv.updatedAt = Date.now();
    recalcInvoiceTotalsAndUI(true);
    renderInvoiceList();
  });

  on($('#chkIvaIncluido'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.ivaIncluido = $('#chkIvaIncluido').checked;
    inv.updatedAt = Date.now();
    recalcInvoiceTotalsAndUI(true);
    renderInvoiceList();
  });

  on($('#payStatus'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.status = $('#payStatus').value || 'pendiente';
    inv.updatedAt = Date.now();
    saveLocal();
    renderInvoiceList();
  });

  on($('#payMethod'),'change', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    inv.method = $('#payMethod').value || 'Efectivo';
    inv.updatedAt = Date.now();
    saveLocal();
  });
}

function bindInvoiceButtons(){
  on($('#btnNewInvoice'),'click', ()=>{
    const inv = createInvoice();
    state.invoices.unshift(inv);
    state.activeInvoiceId = inv.id;
    saveLocal();
    renderInvoiceUI();
    renderInvoiceList();
    toast('Nueva factura');
  });

  on($('#btnDupInvoice'),'click', ()=>{
    const cur = getCurrentInvoice();
    if(!cur) return;
    const copy = JSON.parse(JSON.stringify(cur));
    copy.id = uid('inv');
    copy.number = autoInvoiceNumber();
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.pdfUrl = '';
    copy.payments = [];
    state.invoices.unshift(copy);
    state.activeInvoiceId = copy.id;
    saveLocal();
    renderInvoiceUI();
    renderInvoiceList();
    toast('Duplicada');
  });

  on($('#btnDelInvoice'),'click', ()=>{
    const cur = getCurrentInvoice();
    if(!cur) return;
    if(!confirm('Eliminar factura?')) return;
    state.invoices = state.invoices.filter(x=> x.id !== cur.id);
    ensureCurrentInvoice();
    saveLocal();
    renderInvoiceUI();
    renderInvoiceList();
    toast('Eliminada');
  });

  on($('#btnSaveInvoice'),'click', ()=>{
    const inv = getCurrentInvoice();
    if(!inv) return;

    // cache cliente
    const c = getClientById(inv.clientId);
    inv.clientNameCache = c?.name || inv.clientNameCache || '';

    // “últimos precios”: actualizar historial de producto (pantalla), pero NO imprime
    (inv.lines||[]).forEach(ln=>{
      if(!ln.productKey) return;
      if(!toNum(ln.price)) return;
      const p = state.products[ln.productKey];
      if(!p) return;

      const mode = (ln.mode==='caja') ? 'kg' : (ln.mode||'kg'); // caja usa €/kg
      // si cambia respecto a guardado, guarda histórico
      const current = (mode==='ud') ? toNum(p.priceUd) : toNum(p.priceKg);
      if(toNum(ln.price) !== current){
        if(mode==='ud') p.priceUd = r2(ln.price);
        else p.priceKg = r2(ln.price);
        pushPriceHistory(p, mode, ln.price, 'factura');
      }
    });

    inv.updatedAt = Date.now();
    renderQR(inv);
    saveLocal();

    renderInvoiceUI();
    renderInvoiceList();
    renderProductList();

    toast('Guardada ✅');
  });

  on($('#btnAddLine'),'click', ()=>{
    const inv = getCurrentInvoice();
    if(!inv) return;
    inv.lines.push(makeEmptyLine());
    inv.updatedAt = Date.now();
    renderInvoiceUI();
    saveLocal();
  });

  on($('#btnClearLines'),'click', ()=>{
    const inv = getCurrentInvoice();
    if(!inv) return;
    if(!confirm('Vaciar líneas?')) return;
    inv.lines = [makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine(), makeEmptyLine()];
    inv.updatedAt = Date.now();
    renderInvoiceUI();
    renderInvoiceList();
    saveLocal();
  });

  on($('#btnAddPay'),'click', ()=>{
    const inv = getCurrentInvoice();
    if(!inv) return;
    const v = toNum($('#payAmount').value);
    if(!v) return;
    inv.payments = Array.isArray(inv.payments) ? inv.payments : [];
    inv.payments.push({ ts: Date.now(), amount: r2(v) });
    $('#payAmount').value = '';
    inv.updatedAt = Date.now();
    recalcInvoiceTotalsAndUI(true);
    renderInvoiceList();
    toast('Pago añadido');
  });

  // QR buttons
  on($('#btnRegenQR'),'click', ()=>{
    const inv = getCurrentInvoice(); if(!inv) return;
    renderQR(inv);
    toast('QR OK');
  });
  on($('#btnCopyQR'),'click', async ()=>{
    const box = $('#qrBox');
    const txt = box?.dataset.qrText || '';
    try{
      await navigator.clipboard.writeText(txt);
      toast('Copiado');
    }catch{
      alert(txt);
    }
  });

  // PDF/Whats/Cloud (stubs ahora)
  on($('#btnPDF'),'click', ()=> generatePDF());
  on($('#btnWhats'),'click', ()=> sendWhatsApp());
  on($('#btnSync'),'click', ()=> cloudSync());
}

function bindProviderClientInline(){
  on($('#btnSaveProvider'),'click', ()=>{
    state.provider.name = $('#provName').value.trim();
    state.provider.nif  = $('#provNif').value.trim();
    state.provider.addr = $('#provAddr').value.trim();
    state.provider.phone= $('#provPhone').value.trim();
    state.provider.email= $('#provEmail').value.trim();
    saveLocal();
    toast('Proveedor guardado');
  });

  on($('#btnNewClientInline'),'click', ()=>{
    setClientInlineUI(null);
    $('#invClient').value = '';
    const inv = getCurrentInvoice();
    if(inv){
      inv.clientId = '';
      inv.clientNameCache = '';
      inv.updatedAt = Date.now();
      renderQR(inv);
      recalcInvoiceTotalsAndUI(true);
      renderInvoiceList();
    }
  });

  on($('#btnSaveClientInline'),'click', ()=>{
    // si hay seleccionado, edita; si no, crea
    const inv = getCurrentInvoice();
    const sel = $('#invClient').value || '';

    const obj = {
      id: sel || uid('cli'),
      name: ($('#cliName').value || '').trim(),
      fiscalName: '',
      nif: ($('#cliNif').value || '').trim(),
      addr: ($('#cliAddr').value || '').trim(),
      phone: ($('#cliPhone').value || '').trim(),
      email: ($('#cliEmail').value || '').trim(),
      notes: ''
    };

    const i = state.clients.findIndex(c=>c.id===obj.id);
    if(i>=0) state.clients[i] = { ...state.clients[i], ...obj };
    else state.clients.push(obj);

    if(inv){
      inv.clientId = obj.id;
      inv.clientNameCache = obj.name;
      inv.updatedAt = Date.now();
    }

    saveLocal();
    renderAllClientSelects();
    $('#invClient').value = obj.id;
    renderInvoiceUI();
    renderInvoiceList();
    renderClientList();
    toast('Cliente guardado');
  });
}

function bindClientsTab(){
  on($('#cliSearch'),'input', renderClientList);

  on($('#btnNewClient'),'click', ()=>{
    selectedClientId = '';
    fillClientEditor({ id:'', name:'', fiscalName:'', nif:'', addr:'', phone:'', email:'', notes:'' });
    toast('Nuevo cliente');
  });

  on($('#btnSaveClient'),'click', ()=>{
    const obj = readClientEditor();
    const i = state.clients.findIndex(c=>c.id===obj.id);
    if(i>=0) state.clients[i] = { ...state.clients[i], ...obj };
    else state.clients.push(obj);
    selectedClientId = obj.id;

    saveLocal();
    renderAllClientSelects();
    renderClientList();
    renderInvoiceUI();
    toast('Cliente guardado');
  });

  on($('#btnDelClient'),'click', ()=>{
    if(!selectedClientId) return;
    if(!confirm('Eliminar cliente?')) return;
    state.clients = state.clients.filter(c=>c.id!==selectedClientId);
    selectedClientId = '';
    saveLocal();
    renderAllClientSelects();
    renderClientList();
    renderInvoiceUI();
    toast('Cliente eliminado');
  });
}

function bindProductsTab(){
  on($('#prodSearch'),'input', renderProductList);

  on($('#btnNewProd'),'click', ()=>{
    selectedProdKey = '';
    fillProductEditor({ key:'', name:'', defaultMode:'kg', kgPerBox:0, priceKg:0, priceBox:0, priceUd:0, costKg:0, origin:'', history:[] });
    toast('Nuevo producto');
  });

  on($('#btnSaveProd'),'click', ()=>{
    const existingKey = ($('#prodKey').value || '').trim();
    const pNew = readProductEditor(existingKey || null);

    // si cambió key por nombre, mover
    if(existingKey && existingKey !== pNew.key){
      delete state.products[existingKey];
    }
    state.products[pNew.key] = pNew;
    selectedProdKey = pNew.key;

    saveLocal();
    renderProductList();
    fillProductEditor(pNew);
    toast('Producto guardado');
  });

  on($('#btnDelProd'),'click', ()=>{
    const k = ($('#prodKey').value || '').trim();
    if(!k) return;
    if(!confirm('Eliminar producto?')) return;
    delete state.products[k];
    selectedProdKey = '';
    saveLocal();
    renderProductList();
    fillProductEditor(null);
    toast('Producto eliminado');
  });
}

function bindSettingsTab(){
  on($('#btnSaveSettings'),'click', ()=>{
    state.settings.pinAccounting = ($('#setPin').value || '').trim() || '8410';
    state.settings.ivaPercent = toNum($('#setIva').value) || 4;
    state.settings.transportPercent = toNum($('#setTransport').value) || 10;
    saveLocal();
    recalcInvoiceTotalsAndUI(true);
    renderInvoiceList();
    toast('Ajustes guardados');
  });

  on($('#btnSaveFirebase'),'click', ()=>{
    state.settings.firebase = {
      apiKey: ($('#fbApiKey').value || '').trim(),
      authDomain: ($('#fbAuthDomain').value || '').trim(),
      databaseURL: ($('#fbDatabaseURL').value || '').trim(),
      projectId: ($('#fbProjectId').value || '').trim(),
      appId: ($('#fbAppId').value || '').trim(),
      storageBucket: ($('#fbStorageBucket').value || '').trim()
    };
    saveLocal();
    updateCloudUIStatus();
    toast('Firebase guardado');
  });

  on($('#btnTestFirebase'),'click', ()=>{
    alert(isFirebaseConfigured() ? 'Firebase: OK (config detectada)' : 'Firebase: incompleto');
  });
}

function bindAccountingTab(){
  on($('#btnUnlock'),'click', ()=>{
    const pin = ($('#pinInput').value || '').trim();
    if(pin && pin === String(state.settings.pinAccounting || '')){
      state.unlockedAccounting = true;
      $('#accStatus').textContent = 'Desbloqueado ✅';
      toast('Contabilidad ON');
      renderAccounting();
    }else{
      alert('PIN incorrecto');
    }
  });

  on($('#btnLock'),'click', ()=>{
    state.unlockedAccounting = false;
    $('#accStatus').textContent = 'Bloqueado 🔒';
    renderAccountingLockedState();
    toast('Bloqueado');
  });

  on($('#accFrom'),'change', renderAccounting);
  on($('#accTo'),'change', renderAccounting);
  on($('#accClient'),'change', renderAccounting);
  on($('#btnAccCalc'),'click', renderAccounting);
}

/* =========================
   26) Import/Export binds + Login modal
========================= */
function bindTopActions(){
  on($('#btnExport'),'click', doExport);

  on($('#btnImport'),'click', ()=>{
    $('#fileImport').click();
  });

  on($('#fileImport'),'change', ()=>{
    const f = $('#fileImport').files?.[0];
    if(f) doImportFile(f);
    $('#fileImport').value = '';
  });

  on($('#btnCloudLogin'),'click', ()=> openModal('#loginModal'));
  on($('#btnCloseLogin'),'click', ()=> closeModal('#loginModal'));
  on($('#loginModal'),'click', (e)=>{
    if(e.target && e.target.id === 'loginModal') closeModal('#loginModal');
  });
}

/* =========================
   27) Search invoice list
========================= */
function bindInvoiceSearch(){
  on($('#invSearch'),'input', renderInvoiceList);
}

/* =========================
   28) Boot UI (completa PARTE 1)
========================= */
(function bootUI(){
  const OLD = window.__ARSLAN_BOOT;
  window.__ARSLAN_BOOT = function(){
    if(typeof OLD === 'function') OLD();

    // renders
    renderSettingsUI();
    renderAllClientSelects();
    ensureCurrentInvoice();
    renderInvoiceUI();
    renderInvoiceList();
    renderClientList();
    renderProductList();
    updateCloudUIStatus();

    // binds
    bindTabs();
    bindTopActions();
    bindInvoiceSearch();
    bindInvoiceButtons();
    bindInvoiceMeta();
    bindProviderClientInline();
    bindClientsTab();
    bindProductsTab();
    bindSettingsTab();
    bindAccountingTab();

    // contabilidad bloqueada
    renderAccountingLockedState();
  };
})();
/* =========================================================
   app.js — PARTE 3/3
   - PDF PRO: Proveedor (izq) + QR (centro) + Cliente (der) + LOGO
   - Tabla GRID en PDF (Producto / modo / cant / bruto / tara / neto / precio / origen / importe)
   - Últimos precios: SOLO PANTALLA (NO PDF)
   - WhatsApp PRO: texto + (WebShare PDF si soportado)
   - Cloud Firebase (REST): Login + Sync + guardar PDFs en Storage (si config)
========================================================= */

/* =========================
   30) Helpers PDF / texto
========================= */
function safeFileName(s){
  return String(s||'')
    .replace(/[\\/:*?"<>|]+/g,'-')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,120);
}

function dataUrlToImageType(dataUrl){
  if(!dataUrl) return null;
  const m = String(dataUrl).match(/^data:image\/(png|jpeg|jpg);base64,/i);
  if(!m) return null;
  const t = m[1].toLowerCase();
  return (t === 'jpg') ? 'JPEG' : (t === 'jpeg') ? 'JPEG' : 'PNG';
}

function mmText(doc, txt, x, y, maxW){
  const s = String(txt ?? '');
  if(!maxW) { doc.text(s, x, y); return; }
  // cortar simple para evitar overflow
  const w = doc.getTextWidth(s);
  if(w <= maxW) { doc.text(s, x, y); return; }
  let out = s;
  while(out.length > 0 && doc.getTextWidth(out + '…') > maxW) out = out.slice(0,-1);
  doc.text(out + '…', x, y);
}

function fmtQty(v){
  const n = toNum(v);
  if(!n) return '';
  return fmt2(n);
}

function buildInvoiceWhatsappText(inv){
  const cli = getClientById(inv.clientId);
  const t = computeInvoiceTotals(inv);

  const lines = (inv.lines||[])
    .filter(ln => (ln.productName||ln.productKey))
    .map(ln=>{
      const mode = ln.mode || 'kg';
      const name = ln.productName || '';
      const price = toNum(ln.price);
      const amount = toNum(ln.amount);
      let qty = '';
      if(mode === 'ud') qty = `${fmt2(toNum(ln.cant))} ud`;
      else if(mode === 'caja') qty = `${fmt2(toNum(ln.cant))} caja · neto ${fmt2(toNum(ln.neto))}kg`;
      else qty = `${fmt2(toNum(ln.neto))} kg`;

      return `- ${name} | ${mode} | ${qty} | ${fmt2(price)}€ | ${fmt2(amount)}€`;
    });

  const header = [
    `*FACTURA* ${inv.number || ''}`,
    `Fecha: ${inv.dateISO || ''}`,
    `Cliente: ${cli?.name || inv.clientNameCache || ''}`,
    inv.tags ? `Tags: ${inv.tags}` : '',
    '—',
  ].filter(Boolean).join('\n');

  const footer = [
    '—',
    `Subtotal: ${fmt2(toNum(t.subtotal))}€`,
    inv.transport ? `Transporte (${state.settings.transportPercent||10}%): ${fmt2(toNum(t.transport))}€` : '',
    inv.ivaIncluido ? `IVA: incluido en precios` : `IVA (${state.settings.ivaPercent||4}%): ${fmt2(toNum(t.iva))}€`,
    `*TOTAL: ${fmt2(toNum(t.total))}€*`,
    '',
    `Estado: ${inv.status || 'pendiente'} · Método: ${inv.method || 'Efectivo'}`
  ].filter(Boolean).join('\n');

  return `${header}\n${lines.join('\n')}\n${footer}`.trim();
}

/* =========================
   31) PDF PRO (B/W)
   - layout: Proveedor izq / QR centro / Cliente der
   - tabla grid y totales
========================= */
async function generatePDF(){
  const inv = getCurrentInvoice();
  if(!inv) return;

  if(!window.jspdf || !window.jspdf.jsPDF){
    alert('Falta jsPDF en index.html');
    return;
  }

  (inv.lines||[]).forEach(ln => calcLine(ln));
  const t = computeInvoiceTotals(inv);
  const cli = getClientById(inv.clientId);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const usableW = W - 2*M;

  // ===== Header banda negra
  doc.setFillColor(10,10,10);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text('FACTURA', M, 14);

  doc.setFontSize(11);
  const num = inv.number || '';
  const numW = doc.getTextWidth(num);
  doc.text(num, W - M - numW, 14);

  // ===== Logo (opcional) en header (esquina)
  const logo = state.settings.logoDataURL || '';
  const logoType = dataUrlToImageType(logo);
  if(logo && logoType){
    try{ doc.addImage(logo, logoType, W - M - 12, 5, 10, 10); }catch{}
  }

  // ===== cajas: proveedor izq / QR centro / cliente der
  doc.setTextColor(0,0,0);
  const topY = 26;
  const boxH = 34;
  const leftW = 72;
  const rightW = 72;
  const leftX = M;
  const rightX = W - M - rightW;
  const qrSize = 26;
  const qrX = (W - qrSize)/2;
  const qrY = topY + 4;

  doc.setLineWidth(0.3);
  doc.setDrawColor(0,0,0);

  // sombras suaves (fake) con gris claro detrás
  doc.setFillColor(248,248,248);
  doc.rect(leftX+0.8, topY+0.8, leftW, boxH, 'F');
  doc.rect(rightX+0.8, topY+0.8, rightW, boxH, 'F');

  // cajas principales blancas
  doc.setFillColor(255,255,255);
  doc.rect(leftX, topY, leftW, boxH, 'F');
  doc.rect(rightX, topY, rightW, boxH, 'F');

  // Títulos
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('EMISOR', leftX+2, topY+7);
  doc.text('CLIENTE', rightX+2, topY+7);

  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  doc.text(state.provider.name || '', leftX+2, topY+13);
  doc.text(state.provider.nif || '',  leftX+2, topY+18);
  doc.text(state.provider.addr || '', leftX+2, topY+23);
  doc.text(`${state.provider.phone||''}`, leftX+2, topY+28);

  doc.text(cli?.name || inv.clientNameCache || '', rightX+2, topY+13);
  doc.text(cli?.nif || '', rightX+2, topY+18);
  doc.text(cli?.addr || '', rightX+2, topY+23);
  doc.text(`${cli?.phone||''}`, rightX+2, topY+28);

  // QR con marco
  doc.setFillColor(255,255,255);
  doc.rect(qrX-2, qrY-2, qrSize+4, qrSize+4, 'F');
  doc.rect(qrX-2, qrY-2, qrSize+4, qrSize+4);

  let qrDataURL = '';
  try{
    const canvas = $('#qrBox')?.querySelector('canvas');
    if(canvas) qrDataURL = canvas.toDataURL('image/png');
  }catch{}

  if(qrDataURL){
    try{ doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize); }
    catch{ doc.rect(qrX, qrY, qrSize, qrSize); }
  }else{
    doc.rect(qrX, qrY, qrSize, qrSize);
  }

  // ===== Meta row
  let y = topY + boxH + 10;
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text(`Fecha: ${inv.dateISO || ''}`, M, y);

  doc.setFont('helvetica','normal');
  const tags = inv.tags ? `Tags: ${inv.tags}` : '';
  if(tags){
    const tw = doc.getTextWidth(tags);
    doc.text(tags, W - M - tw, y);
  }

  y += 8;

  // ===== Tabla bonita (zebra)
  const cols = [
    { k:'product', w:74, t:'Producto' },
    { k:'mode',    w:10, t:'Modo' },
    { k:'cant',    w:10, t:'Cant' },
    { k:'bruto',   w:12, t:'Br' },
    { k:'tara',    w:12, t:'Ta' },
    { k:'neto',    w:12, t:'Ne' },
    { k:'price',   w:12, t:'€' },
    { k:'origin',  w:26, t:'Origen' },
    { k:'amount',  w:18, t:'Importe' },
  ];

  const tableX = M;
  const rowH = 7;

  function drawHeaderRow(y){
    doc.setFillColor(245,245,245);
    doc.rect(tableX, y, usableW, rowH, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    let x = tableX;
    cols.forEach(c=>{
      doc.rect(x, y, c.w, rowH);
      doc.text(c.t, x+1.2, y+4.8);
      x += c.w;
    });
    return y + rowH;
  }

  function drawDataRow(y, r, zebra){
    if(zebra){
      doc.setFillColor(252,252,252);
      doc.rect(tableX, y, usableW, rowH, 'F');
    }
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);

    let x = tableX;
    cols.forEach((c, idx)=>{
      doc.rect(x, y, c.w, rowH);
      const text = String(r[idx] ?? '');
      if(c.k === 'amount'){
        const w = doc.getTextWidth(text);
        doc.text(text, x + c.w - 1.2 - w, y + 4.8);
      }else{
        mmText(doc, text, x + 1.2, y + 4.8, c.w - 2.4);
      }
      x += c.w;
    });
    return y + rowH;
  }

  y = drawHeaderRow(y);

  const rows = (inv.lines||[])
    .filter(ln => (ln.productName||ln.productKey))
    .map(ln=>{
      const mode = ln.mode || 'kg';
      const taraTotal = (mode === 'ud') ? '' : fmt2(toNum(ln.taraTotal) || (toNum(ln.tara) * (toNum(ln.cant) || 1)));
      const bruto = (mode === 'ud') ? '' : fmt2(toNum(ln.bruto));
      const neto  = (mode === 'ud') ? fmt2(toNum(ln.cant)) : fmt2(toNum(ln.neto));
      const cant  = fmt2(toNum(ln.cant));
      const price = fmt2(toNum(ln.price));
      const amount= fmt2(toNum(ln.amount));

      return [
        (ln.productName||''),
        mode,
        cant,
        bruto,
        taraTotal,
        neto,
        price,
        (ln.origin||''),
        amount
      ];
    });

  const bottomLimit = H - 55;
  let zebra = false;

  for(const r of rows){
    if(y > bottomLimit){
      doc.addPage();
      y = M;
      y = drawHeaderRow(y);
    }
    zebra = !zebra;
    y = drawDataRow(y, r, zebra);
  }

  // ===== Totales box pro
  y += 10;
  if(y > H - 45){ doc.addPage(); y = M; }

  const boxW = 78;
  const boxX = W - M - boxW;
  const boxY = y;

  doc.setFillColor(245,245,245);
  doc.rect(boxX, boxY, boxW, 30, 'F');
  doc.rect(boxX, boxY, boxW, 30);

  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`Subtotal: ${fmt2(toNum(t.subtotal))} €`, boxX+3, boxY+8);
  doc.text(inv.transport ? `Transporte: ${fmt2(toNum(t.transport))} €` : `Transporte: 0,00 €`, boxX+3, boxY+14);
  doc.text(inv.ivaIncluido ? `IVA: incluido` : `IVA (${state.settings.ivaPercent||4}%): ${fmt2(toNum(t.iva))} €`, boxX+3, boxY+20);

  doc.setFont('helvetica','bold');
  doc.text(`TOTAL: ${fmt2(toNum(t.total))} €`, boxX+3, boxY+27);

  // ===== Firma / sello
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('Firma y sello:', M, boxY + 10);
  doc.setLineWidth(0.3);
  doc.line(M, boxY + 14, M + 80, boxY + 14);

  // ===== Footer con páginas
  const pages = doc.internal.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(80,80,80);
    const foot = inv.ivaIncluido ? 'IVA incluido en los precios.' : 'IVA no incluido en precios.';
    doc.text(foot, M, H - 10);
    const s = `Página ${p}/${pages}`;
    const sw = doc.getTextWidth(s);
    doc.text(s, W - M - sw, H - 10);
  }

  // ===== Blob + descarga
  const pdfBlob = doc.output('blob');
  const fileName = safeFileName(`${inv.number || 'FACTURA'}_${inv.dateISO || ''}.pdf`) || 'FACTURA.pdf';

  inv.pdfLastGeneratedAt = Date.now();
  inv.pdfFileName = fileName;
  inv.updatedAt = Date.now();
  saveLocal();
  renderInvoiceList();

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  toast('PDF PRO generado ✅');

  // ===== Subir PDF a nube si hay login + storage
  try{
    if(state.cloud?.uid && state.cloud?.idToken && isFirebaseConfigured() && state.settings.firebase?.storageBucket){
      const path = buildStoragePdfPath(inv, state.cloud.uid);
      const dl = await uploadPdfToFirebaseStorage(pdfBlob, path, state.cloud.idToken, state.settings.firebase.storageBucket);
      if(dl){
        inv.pdfUrl = dl.url;
        inv.pdfPath = dl.path;
        inv.updatedAt = Date.now();
        saveLocal();
        await cloudPushInvoice(inv);
        toast('PDF guardado en nube ☁️');
      }
    }
  }catch(e){
    console.warn('PDF cloud error', e);
  }
}

    return rowH;
  }

  // header
  y += drawRow(y, col.map(c=>c.t), true);

  // rows
  const printable = (inv.lines||[])
    .filter(ln => (ln.productName||ln.productKey))
    .map(ln=>{
      const mode = ln.mode || 'kg';
      return [
        (ln.productName||''),
        mode,
        (mode==='ud') ? fmtQty(ln.cant) : fmtQty(ln.cant),
        fmtQty(ln.bruto),
fmtQty(toNum(ln.taraTotal) || (toNum(ln.tara) * (toNum(ln.cant) || 1))),
        fmtQty(ln.neto),
        fmtQty(ln.price),
        (ln.origin||''),
        fmtQty(ln.amount),
      ];
    });

  const bottomLimit = pageH - 45;

  for(const r of printable){
    if(y > bottomLimit){
      doc.addPage();
      y = M;
      y += drawRow(y, col.map(c=>c.t), true);
    }
    y += drawRow(y, r, false);
  }

  // totales
  y += 6;
  if(y > pageH - 40){ doc.addPage(); y = M; }

  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  mmText(doc, 'TOTALES', M, y, 60);

  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  y += 6;

  const totalsX = pageW - M - 70;
  const totalsW = 70;

  doc.rect(totalsX, y-4, totalsW, 30);
  doc.setFont('helvetica','normal');

  doc.text(`Subtotal: ${fmt2(toNum(t.subtotal))} €`, totalsX+2, y+2);
  doc.text(inv.transport ? `Transporte: ${fmt2(toNum(t.transport))} €` : `Transporte: 0,00 €`, totalsX+2, y+8);

  if(inv.ivaIncluido){
    doc.text(`IVA: incluido`, totalsX+2, y+14);
  }else{
    doc.text(`IVA (${state.settings.ivaPercent||4}%): ${fmt2(toNum(t.iva))} €`, totalsX+2, y+14);
  }

  doc.setFont('helvetica','bold');
  doc.text(`TOTAL: ${fmt2(toNum(t.total))} €`, totalsX+2, y+22);

  // estado/método/obs (sin “últimos precios”)
  doc.setFont('helvetica','normal');
  const meta2Y = y + 32;
  const status = inv.status || 'pendiente';
  const method = inv.method || 'Efectivo';
  const obs = inv.obs || '';

  mmText(doc, `Estado: ${status} · Método: ${method}`, M, meta2Y, pageW - 2*M);
  if(obs){
    mmText(doc, `Obs: ${obs}`, M, meta2Y+5, pageW - 2*M);
  }

  // pie
  doc.setFontSize(8);
  doc.setTextColor(80,80,80);
  const foot = inv.ivaIncluido ? 'IVA incluido en los precios.' : 'IVA no incluido en precios.';
  doc.text(foot, M, pageH - 10);
  doc.text(`Página 1/1`, pageW - M - 20, pageH - 10);

  // Blob + descarga
  const pdfBlob = doc.output('blob');
  const fileName = safeFileName(`${inv.number || 'FACTURA'}_${inv.dateISO || ''}.pdf`) || 'FACTURA.pdf';

  // metadata local
  inv.pdfLastGeneratedAt = Date.now();
  inv.pdfFileName = fileName;
  inv.updatedAt = Date.now();
  saveLocal();
  renderInvoiceList();

  // descarga
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  toast('PDF generado ✅');

  // Si Cloud activo y logged: subir PDF a Storage y guardar url
  try{
    if(state.cloud?.uid && state.cloud?.idToken && isFirebaseConfigured() && state.settings.firebase?.storageBucket){
      const path = buildStoragePdfPath(inv, state.cloud.uid);
      const dl = await uploadPdfToFirebaseStorage(pdfBlob, path, state.cloud.idToken, state.settings.firebase.storageBucket);
      if(dl){
        inv.pdfUrl = dl.url;
        inv.pdfPath = dl.path;
        inv.updatedAt = Date.now();
        saveLocal();
        await cloudPushInvoice(inv); // guarda también en DB
        toast('PDF guardado en nube ☁️');
      }
    }
  }catch(e){
    console.warn('PDF cloud error', e);
  }
}

function buildStoragePdfPath(inv, uid){
  const n = safeFileName(inv.number || inv.id || 'factura');
  const d = inv.dateISO || todayISO();
  return `arslan_kiwi_pdfs/${uid}/${d}_${n}.pdf`;
}

/* =========================
   32) WhatsApp PRO
========================= */
async function sendWhatsApp(){
  const inv = getCurrentInvoice();
  if(!inv) return;

  const text = buildInvoiceWhatsappText(inv);

  // Intento: Web Share (móvil) con PDF (si existe ya)
  // Si no existe, genera PDF primero (sin bloquear)
  let sharedFile = null;

  try{
    // generar PDF blob “rápido” (igual que generatePDF, pero sin download)
    if(window.jspdf?.jsPDF && navigator.canShare && navigator.share){
      const pdfBlob = await quickPdfBlob(inv);
      if(pdfBlob){
        const fileName = safeFileName(`${inv.number || 'FACTURA'}.pdf`) || 'FACTURA.pdf';
        const f = new File([pdfBlob], fileName, { type:'application/pdf' });
        if(navigator.canShare({ files:[f] })){
          sharedFile = f;
          await navigator.share({ title: fileName, text, files:[f] });
          toast('Compartido ✅');
          return;
        }
      }
    }
  }catch(e){
    console.warn('Share fail', e);
  }

  // Fallback: WhatsApp texto
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, '_blank');
  toast(sharedFile ? 'WhatsApp + PDF' : 'WhatsApp TXT');
}

async function quickPdfBlob(inv){
  // genera un PDF mínimo consistente (misma estructura) sin download
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text(inv.number || 'FACTURA', 12, 18);
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(`Fecha: ${inv.dateISO||''}`, 12, 26);
    const t = computeInvoiceTotals(inv);
    doc.text(`Total: ${fmt2(toNum(t.total))} €`, 12, 34);

    return doc.output('blob');
  }catch{
    return null;
  }
}

/* =========================
   33) CLOUD FIREBASE (REST)
   - Login email/pass
   - Token refresh
   - RTDB merge sync
   - Storage upload PDF
========================= */
const K_AUTH = 'arslan_kiwi_auth';

function decodeJwtExp(token){
  try{
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return (json?.exp ? Number(json.exp) : 0) * 1000;
  }catch{
    return 0;
  }
}

function loadAuth(){
  try{
    const v = JSON.parse(localStorage.getItem(K_AUTH)||'null');
    if(!v) return null;
    return v;
  }catch{
    return null;
  }
}

function saveAuth(a){
  localStorage.setItem(K_AUTH, JSON.stringify(a));
}

function clearAuth(){
  localStorage.removeItem(K_AUTH);
}

async function firebaseSignIn(email, password){
  const fb = state.settings.firebase || {};
  if(!fb.apiKey) throw new Error('Firebase apiKey falta');

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(fb.apiKey)}`;
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken:true })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data?.error?.message || 'LOGIN_ERROR');

  const idToken = data.idToken;
  const refreshToken = data.refreshToken;
  const uid = data.localId;

  const exp = decodeJwtExp(idToken);

  return { uid, email, idToken, refreshToken, exp };
}

async function firebaseRefresh(refreshToken){
  const fb = state.settings.firebase || {};
  if(!fb.apiKey) throw new Error('Firebase apiKey falta');

  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(fb.apiKey)}`;
  const body = new URLSearchParams();
  body.set('grant_type','refresh_token');
  body.set('refresh_token', refreshToken);

  const res = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data?.error?.message || 'REFRESH_ERROR');

  const idToken = data.id_token;
  const exp = decodeJwtExp(idToken);

  return {
    uid: data.user_id,
    idToken,
    refreshToken: data.refresh_token,
    exp
  };
}

async function getValidIdToken(){
  const auth = state.cloud || loadAuth();
  if(!auth?.idToken || !auth?.refreshToken) return null;

  const now = Date.now();
  const exp = auth.exp || 0;

  // refrescar si quedan <2 minutos
  if(exp && now < exp - 120000){
    state.cloud = auth;
    return auth.idToken;
  }

  try{
    const ref = await firebaseRefresh(auth.refreshToken);
    const merged = { ...auth, ...ref, exp: ref.exp || decodeJwtExp(ref.idToken) };
    state.cloud = merged;
    saveAuth(merged);
    return merged.idToken;
  }catch(e){
    console.warn('refresh failed', e);
    return null;
  }
}

function rtdbBaseUrl(){
  const fb = state.settings.firebase || {};
  if(!fb.databaseURL) return '';
  return String(fb.databaseURL).replace(/\/$/,'');
}

function cloudRootPath(){
  // puedes cambiarlo en ajustes si luego quieres
  const root = state.settings.cloudRoot || 'arslan_facturas_kiwi';
  return root;
}

function cloudPathFor(uid, leaf){
  return `${cloudRootPath()}/users/${uid}/data/${leaf}`;
}

async function rtdbGet(path, token){
  const base = rtdbBaseUrl();
  if(!base) throw new Error('databaseURL falta');
  const url = `${base}/${path}.json?auth=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`GET ${res.status}`);
  return await res.json();
}

async function rtdbPut(path, token, value){
  const base = rtdbBaseUrl();
  if(!base) throw new Error('databaseURL falta');
  const url = `${base}/${path}.json?auth=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method:'PUT',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(value)
  });
  if(!res.ok) throw new Error(`PUT ${res.status}`);
  return await res.json();
}

async function rtdbPatch(path, token, value){
  const base = rtdbBaseUrl();
  if(!base) throw new Error('databaseURL falta');
  const url = `${base}/${path}.json?auth=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(value)
  });
  if(!res.ok) throw new Error(`PATCH ${res.status}`);
  return await res.json();
}

/* =========================
   34) Storage upload PDF (REST)
========================= */
async function uploadPdfToFirebaseStorage(blob, path, idToken, bucket){
  if(!bucket) return null;

  const encoded = encodeURIComponent(path);
  const meta = {
    name: path,
    contentType: 'application/pdf'
  };

  const boundary = '----arslanKiwiBoundary' + Math.random().toString(16).slice(2);
  const dash = '--' + boundary;

  const part1 =
    `${dash}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(meta)}\r\n`;

  const part2Header =
    `${dash}\r\n` +
    `Content-Type: application/pdf\r\n\r\n`;

  const part3 = `\r\n${dash}--\r\n`;

  const body = new Blob([part1, part2Header, blob, part3], { type:`multipart/related; boundary=${boundary}` });

  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&name=${encoded}`;

  const res = await fetch(url, {
    method:'POST',
    headers:{
      'Authorization': `Bearer ${idToken}`
    },
    body
  });

  const data = await res.json();
  if(!res.ok) throw new Error(data?.error?.message || 'STORAGE_UPLOAD_ERROR');

  // url descarga pública con token
  const tokens = data.downloadTokens || '';
  const token = tokens.split(',')[0] || '';
  const dlUrl = token
    ? `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`
    : '';

  return { url: dlUrl, path };
}

/* =========================
   35) Cloud: Push/Pull + Merge
========================= */
function ensureMetaUpdated(o){
  if(!o || typeof o !== 'object') return o;
  if(!o.updatedAt) o.updatedAt = Date.now();
  return o;
}

function mergeByUpdatedAt(localMap, remoteMap, keyField){
  // localMap: array o object
  // remoteMap: array o object
  const out = {};

  const add = (obj)=>{
    if(!obj) return;
    const k = keyField ? obj[keyField] : obj.id;
    if(!k) return;
    const cur = out[k];
    if(!cur) out[k] = obj;
    else{
      const a = toNum(cur.updatedAt);
      const b = toNum(obj.updatedAt);
      out[k] = (b >= a) ? obj : cur;
    }
  };

  // local
  if(Array.isArray(localMap)) localMap.forEach(add);
  else if(localMap && typeof localMap === 'object') Object.values(localMap).forEach(add);

  // remote
  if(Array.isArray(remoteMap)) remoteMap.forEach(add);
  else if(remoteMap && typeof remoteMap === 'object') Object.values(remoteMap).forEach(add);

  return out;
}

async function cloudPushAll(){
  const token = await getValidIdToken();
  if(!token) throw new Error('No login');

  const uid = state.cloud.uid;
  if(!uid) throw new Error('No uid');

  // asegurar updatedAt
  ensureMetaUpdated(state.provider);
  state.clients.forEach(c=> ensureMetaUpdated(c));
  Object.values(state.products||{}).forEach(p=> ensureMetaUpdated(p));
  (state.invoices||[]).forEach(inv=> ensureMetaUpdated(inv));

  await rtdbPut(cloudPathFor(uid,'provider'), token, state.provider);
  await rtdbPut(cloudPathFor(uid,'clients'), token, state.clients);
  await rtdbPut(cloudPathFor(uid,'products'), token, state.products);

  // invoices: guardar mapa por id (mejor merge)
  const invMap = {};
  (state.invoices||[]).forEach(inv=> { invMap[inv.id] = inv; });

  await rtdbPut(cloudPathFor(uid,'invoices'), token, invMap);

  // índice ligero (cliente/tag/número/importe/pdf)
  const idx = {};
  (state.invoices||[]).forEach(inv=>{
    const tot = computeInvoiceTotals(inv);
    idx[inv.id] = {
      id: inv.id,
      number: inv.number || '',
      dateISO: inv.dateISO || '',
      clientId: inv.clientId || '',
      clientNameCache: inv.clientNameCache || '',
      tags: inv.tags || '',
      total: r2(toNum(tot.total)),
      status: inv.status || 'pendiente',
      method: inv.method || 'Efectivo',
      pdfUrl: inv.pdfUrl || '',
      updatedAt: inv.updatedAt || Date.now()
    };
  });
  await rtdbPut(cloudPathFor(uid,'invoice_index'), token, idx);
}

async function cloudPullMerge(){
  const token = await getValidIdToken();
  if(!token) throw new Error('No login');
  const uid = state.cloud.uid;
  if(!uid) throw new Error('No uid');

  const remoteProvider = await rtdbGet(cloudPathFor(uid,'provider'), token);
  const remoteClients  = await rtdbGet(cloudPathFor(uid,'clients'), token);
  const remoteProducts = await rtdbGet(cloudPathFor(uid,'products'), token);
  const remoteInvoices = await rtdbGet(cloudPathFor(uid,'invoices'), token);

  // provider: el más nuevo
  if(remoteProvider){
    const a = toNum(state.provider.updatedAt);
    const b = toNum(remoteProvider.updatedAt);
    if(b >= a) state.provider = remoteProvider;
  }

  // clients: merge por id
  const mergedClients = mergeByUpdatedAt(state.clients, remoteClients, 'id');
  state.clients = Object.values(mergedClients);

  // products: merge por key
  const mergedProducts = mergeByUpdatedAt(state.products, remoteProducts, 'key');
  state.products = mergedProducts;

  // invoices: merge por id (map)
  const localInvMap = {};
  (state.invoices||[]).forEach(inv=> { localInvMap[inv.id] = inv; });
  const mergedInvMap = mergeByUpdatedAt(localInvMap, remoteInvoices, 'id');
  state.invoices = Object.values(mergedInvMap);

  // asegurar factura activa
  ensureCurrentInvoice();
  saveLocal();

  // re-render
  renderAllClientSelects();
  renderInvoiceUI();
  renderInvoiceList();
  renderClientList();
  renderProductList();
  renderAccounting();

  toast('Sync OK ✅');
}

async function cloudPushInvoice(inv){
  const token = await getValidIdToken();
  if(!token) return;
  const uid = state.cloud.uid;
  if(!uid) return;

  ensureMetaUpdated(inv);

  // PATCH single invoice
  const patch = {};
  patch[inv.id] = inv;
  await rtdbPatch(cloudPathFor(uid,'invoices'), token, patch);

  // update index
  const tot = computeInvoiceTotals(inv);
  const idxPatch = {};
  idxPatch[inv.id] = {
    id: inv.id,
    number: inv.number || '',
    dateISO: inv.dateISO || '',
    clientId: inv.clientId || '',
    clientNameCache: inv.clientNameCache || '',
    tags: inv.tags || '',
    total: r2(toNum(tot.total)),
    status: inv.status || 'pendiente',
    method: inv.method || 'Efectivo',
    pdfUrl: inv.pdfUrl || '',
    updatedAt: inv.updatedAt || Date.now()
  };
  await rtdbPatch(cloudPathFor(uid,'invoice_index'), token, idxPatch);
}

/* =========================
   36) Cloud public API (botón Sync)
========================= */
async function cloudSync(){
  if(!navigator.onLine){
    toast('Sin internet (modo local)');
    return;
  }

  if(!isFirebaseConfigured()){
    toast('Cloud OFF (config incompleta)');
    return;
  }

  if(!state.cloud?.uid){
    toast('Cloud: inicia sesión');
    openModal('#loginModal');
    return;
  }

  try{
    await cloudPullMerge();
    await cloudPushAll();
    toast('Nube sincronizada ☁️');
  }catch(e){
    console.warn('cloudSync error', e);
    alert('Cloud error: ' + (e?.message || e));
  }
}

function updateCloudUIStatus(){
  const info = $('#cloudInfo');
  const s = $('#cloudStatus');
  const on = isFirebaseConfigured();
  const logged = !!state.cloud?.uid;

  if(info) info.textContent = on ? (logged ? `Cloud: ON (${state.cloud.email||state.cloud.uid})` : 'Cloud: listo (login)') : 'Cloud: OFF (local)';
  if(s) s.textContent = logged ? 'Conectado' : 'Desconectado';
}

/* =========================
   37) Login UI bind + auto restore
========================= */
async function doCloudLogin(){
  const email = ($('#loginEmail')?.value || '').trim();
  const pass  = ($('#loginPass')?.value || '').trim();
  if(!email || !pass){
    alert('Email y contraseña');
    return;
  }

  try{
    const auth = await firebaseSignIn(email, pass);
    state.cloud = auth;
    saveAuth(auth);
    updateCloudUIStatus();
    closeModal('#loginModal');

    // pull al entrar
    await cloudPullMerge();
    toast('Login OK ☁️');
  }catch(e){
    alert('Login error: ' + (e?.message || e));
  }
}

function doCloudLogout(){
  state.cloud = null;
  clearAuth();
  updateCloudUIStatus();
  toast('Logout');
}

function restoreCloudSession(){
  const a = loadAuth();
  if(a?.uid && a?.idToken){
    state.cloud = a;
  }else{
    state.cloud = null;
  }
  updateCloudUIStatus();
}

/* =========================
   38) Mejora lista facturas: badge PDF
   (override suave de renderInvoiceList)
========================= */
const __oldRenderInvoiceList = window.renderInvoiceList;
function renderInvoiceList(){
  const box = $('#invoiceList');
  if(!box) return;

  const q = normalizeProdName($('#invSearch')?.value || '');
  const list = (state.invoices||[])
    .slice()
    .sort((a,b)=> (b.dateISO||'').localeCompare(a.dateISO||'') || (b.createdAt||0)-(a.createdAt||0))
    .filter(inv=>{
      if(!q) return true;
      const hay = `${inv.number||''} ${invoiceDisplayClient(inv)} ${inv.tags||''}`.toUpperCase();
      return hay.includes(q);
    });

  box.innerHTML = list.map(inv=>{
    const t = computeInvoiceTotals(inv);
    const active = inv.id === state.activeInvoiceId;
    const hasPdf = !!(inv.pdfUrl || inv.pdfLastGeneratedAt);
    return `
      <div class="invItem ${active ? 'active':''}" data-id="${escHtml(inv.id)}">
        <div class="invTop">
          <div class="invNum">${escHtml(inv.number || '(sin nº)')}</div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${hasPdf ? `<div class="badge">PDF</div>` : ''}
            <div class="badge">${escHtml(fmt2(t.total))} €</div>
          </div>
        </div>
        <div class="invMeta">
          <span class="badge">${escHtml(inv.dateISO||'')}</span>
          <span class="badge">${escHtml(invoiceDisplayClient(inv) || '—')}</span>
          ${inv.tags ? `<span class="badge">${escHtml(inv.tags)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<div class="muted tiny">Sin facturas.</div>`;

  $$('.invItem').forEach(el=>{
    el.addEventListener('click', ()=>{
      state.activeInvoiceId = el.dataset.id;
      ensureCurrentInvoice();
      renderInvoiceUI();
      renderInvoiceList();
      saveLocal();
    });
  });
}
window.renderInvoiceList = renderInvoiceList;

/* =========================
   39) Añadir logo en Ajustes (opcional)
   - Si existe input #logoFile en Ajustes, guarda base64
========================= */
function bindLogoUploadIfExists(){
  const input = $('#logoFile');
  const btnClear = $('#btnClearLogo');

  if(input){
    input.addEventListener('change', async ()=>{
      const f = input.files?.[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        state.settings.logoDataURL = String(reader.result||'');
        saveLocal();
        toast('Logo guardado');
      };
      reader.readAsDataURL(f);
      input.value = '';
    });
  }

  if(btnClear){
    btnClear.addEventListener('click', ()=>{
      state.settings.logoDataURL = '';
      saveLocal();
      toast('Logo eliminado');
    });
  }
}

/* =========================
   40) Boot extender (login/persist)
========================= */
(function bootUI_part3(){
  const OLD = window.__ARSLAN_BOOT;
  window.__ARSLAN_BOOT = function(){
    if(typeof OLD === 'function') OLD();

    // restaurar sesión cloud si existe
    restoreCloudSession();

    // bind login
    const btnDo = $('#btnDoLogin');
    const btnOut = $('#btnLogout');

    if(btnDo) btnDo.addEventListener('click', doCloudLogin);
    if(btnOut) btnOut.addEventListener('click', doCloudLogout);

    // enter en pass
    const pass = $('#loginPass');
    if(pass) pass.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') doCloudLogin();
    });

    // logo
    bindLogoUploadIfExists();

    // refresh cloud status
    updateCloudUIStatus();
  };
})();

/* =========================
   41) Ejecutar boot final
========================= */
try{
  if(typeof window.__ARSLAN_BOOT === 'function'){
    window.__ARSLAN_BOOT();
  }
}catch(e){
  console.error('BOOT error', e);
}
