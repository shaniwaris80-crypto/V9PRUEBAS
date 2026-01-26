/* ===========================================================
   PARTE 1/3 — ARSLAN PRO V10.4 (MONO Edition) — app.js
   ✅ SIN Supabase/Firebase
   ✅ IVA 4% SIEMPRE sumado al total
   ✅ Editar factura + Cambiar fecha (en listado Facturas)
   ✅ Todo localStorage + Historial de precios + Pendientes + Ventas + PDF + QR
=========================================================== */

(function(){
"use strict";

/* ---------- HELPERS ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;
const uid = ()=>'id_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);

function load(k, fallback){
  try{
    const v = JSON.parse(localStorage.getItem(k) || '');
    return v ?? fallback;
  }catch{
    return fallback;
  }
}
function save(k, v){
  localStorage.setItem(k, JSON.stringify(v));
}

/* ---------- KEYS ---------- */
const K_CLIENTES  = 'arslan_v104_clientes';
const K_PRODUCTOS = 'arslan_v104_productos';
const K_FACTURAS  = 'arslan_v104_facturas';
const K_PRICEHIST = 'arslan_v104_pricehist';

/* ---------- ESTADO ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});

let pagosTemp = [];                 // pagos UI temporales
let editingIndex = null;            // null = nueva / number = editando factura
let editingId = null;               // id interno de factura editada

/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));

  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
  if(id==='facturas'){ renderFacturas(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- SEED CLIENTES ---------- */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{
    const k=(c.nombre||'').trim().toLowerCase();
    if(k && !map.has(k)) map.set(k,c);
  });
  return [...map.values()];
}
function ensureClienteIds(){
  clientes.forEach(c=>{ if(!c.id) c.id=uid(); });
}
function seedClientesIfEmpty(){
  if(clientes.length) return ensureClienteIds();
  clientes = uniqueByName([
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo'},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
    {id:uid(), nombre:'Restauración Hermanos Marijuán S.L.U. (Restaurante Los Braseros)', nif:'B09425059', dir:'Carretera Logroño Km 102, 09193 Castrillo del Val, Burgos', email:'info@restaurantelosbraseros.com'},
    {id:uid(), nombre:'Alameda Peralta Carlos y otros C.B.', nif:'E09578345', dir:'C/ La Puebla, 6, 09004 Burgos (España)', email:'info@hotelcordon.com'}
  ]);
  save(K_CLIENTES, clientes);
}

/* ---------- SEED PRODUCTOS (solo si vacío) ---------- */
const PRODUCT_NAMES = [
  "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA",
  "AGUACATE GRANEL","MARACUYÁ","MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA","MANDARINA HOJA","NARANJA TOMASIN","LIMON SEGUNDA","JENGIBRE","BATATA","AJO PRIMERA",
  "CEBOLLA NORMAL","PATATA LAVADA","TOMATE CHERRY RAMA","TOMATE DANIELA","TOMATE ROSA PRIMERA","TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO",
  "CEBOLLETA","BROCOLI","JUDIA VERDE","BERENJENA","PIMIENTO ITALIANO VERDE","UVA BLANCA","ALCACHOFA","COLIFLOR","BATAVIA","ICEBERG","NARANJA ZUMO",
  "CEREZA","FRESAS","ARANDANOS","PEREJIL","CILANTRO","PIMIENTO VERDE","PIMIENTO ROJO","MACHO VERDE","MACHO MADURO","YUCA","CEBOLLA ROJA",
  "RABANITOS","PAPAYA","NISPERO","TOMATE PERA","TOMATE BOLA","TOMATE PINK","VALVENOSTA GOLDEN","PIÑA","NARANJA HOJA","CEBOLLA DULCE",
  "ESPARRAGOS TRIGUEROS","TOMATE RAFF","REPOLLO","KIWI ZESPRI","MELON","MANZANA CRIPS","ALOE VERA PIEZAS","LIMA","GUINEO VERDE","BANANA","BONIATO",
  "YAUTIA","YAME","OKRA","SANDIA RAYADA","HIERBABUENA","REMOLACHA","LECHUGA ROMANA","PITAHAYA ROJA","CLEMENTINA","GRANADA","CHIRIMOYA",
  "PIMIENTO CALIFORNIA VERDE","PIMIENTO CALIFORNIA ROJO","NABO","CHAYOTE"
];

function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({name:n}));
  save(K_PRODUCTOS, productos);
}

/* ---------- PROVIDER DEFAULTS ---------- */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre')?.value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif')?.value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir')?.value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel')?.value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail')?.value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ---------- FECHA FACTURA (UI) ---------- */
function setFechaFacturaDefault(){
  const el = $('#inpFechaFactura');
  if(!el) return;
  if(el.value) return;

  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  el.value = local;
}
function getFechaISOFromInput(){
  const el=$('#inpFechaFactura');
  if(!el || !el.value) return todayISO();
  const d = new Date(el.value);
  return isNaN(d.getTime()) ? todayISO() : d.toISOString();
}
function setFechaInputFromISO(iso){
  const el=$('#inpFechaFactura');
  if(!el) return;
  const d=new Date(iso);
  if(isNaN(d.getTime())) return setFechaFacturaDefault();
  const pad=n=>String(n).padStart(2,'0');
  el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- HISTORIAL DE PRECIOS ---------- */
function lastPrice(name){
  const arr = priceHist[name];
  return arr?.length ? arr[0].price : null;
}
function pushPriceHistory(name, price){
  if(!name || !(price>0)) return;
  const arr = priceHist[name] || [];
  arr.unshift({price, date: todayISO()});
  priceHist[name] = arr.slice(0,10);
  save(K_PRICEHIST, priceHist);
}
function hidePanelSoon(){
  clearTimeout(hidePanelSoon.t);
  hidePanelSoon.t=setTimeout(()=>$('#pricePanel')?.setAttribute('hidden',''), 4800);
}
function renderPriceHistory(name){
  const panel=$('#pricePanel'), body=$('#ppBody');
  if(!panel||!body) return;
  panel.removeAttribute('hidden');

  const hist=priceHist[name]||[];
  if(hist.length===0){
    body.innerHTML=`<div class="pp-row"><span>${escapeHTML(name)}</span><strong>Sin datos</strong></div>`;
    hidePanelSoon();
    return;
  }
  body.innerHTML =
    `<div class="pp-row" style="justify-content:center"><strong>${escapeHTML(name)}</strong></div>` +
    hist.map(h=>`<div class="pp-row"><span>${fmtDateDMY(new Date(h.date))}</span><strong>${money(h.price)}</strong></div>`).join('');

  hidePanelSoon();
}

/* ---------- CLIENTES UI ---------- */
function saveClientes(){ save(K_CLIENTES, clientes); }

function renderClientesSelect(){
  const sel = $('#selCliente'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  arr.forEach((c)=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.nombre||'(Sin nombre)';
    sel.appendChild(opt);
  });
}

function fillClientFields(c){
  $('#cliNombre').value=c.nombre||'';
  $('#cliNif').value=c.nif||'';
  $('#cliDir').value=c.dir||'';
  $('#cliTel').value=c.tel||'';
  $('#cliEmail').value=c.email||'';
}

function renderClientesLista(){
  const cont = $('#listaClientes'); if(!cont) return;
  cont.innerHTML='';
  const q = ($('#buscarCliente')?.value||'').toLowerCase();

  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  const view = q
    ? arr.filter(c =>
        (c.nombre||'').toLowerCase().includes(q) ||
        (c.nif||'').toLowerCase().includes(q) ||
        (c.dir||'').toLowerCase().includes(q)
      )
    : arr;

  if(view.length===0){
    cont.innerHTML='<div class="item">Sin clientes.</div>';
    return;
  }

  view.forEach((c)=>{
    const row=document.createElement('div');
    row.className='item';
    row.innerHTML=`
      <div>
        <strong>${escapeHTML(c.nombre||'(Sin nombre)')}</strong>
        <div class="muted">${escapeHTML(c.nif||'')} · ${escapeHTML(c.dir||'')}</div>
      </div>
      <div class="row">
        <button class="ghost" data-e="use" data-id="${c.id}">Usar</button>
        <button class="ghost" data-e="edit" data-id="${c.id}">Editar</button>
        <button class="ghost" data-e="del" data-id="${c.id}">Borrar</button>
      </div>
    `;
    cont.appendChild(row);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const id=b.dataset.id;
    b.addEventListener('click', ()=>{
      const i=clientes.findIndex(x=>x.id===id);
      if(i<0) return;

      if(b.dataset.e==='use'){
        fillClientFields(clientes[i]);
        switchTab('factura');
      }else if(b.dataset.e==='edit'){
        const c=clientes[i];
        const nombre=prompt('Nombre',c.nombre||'') ?? c.nombre;
        const nif=prompt('NIF',c.nif||'') ?? c.nif;
        const dir=prompt('Dirección',c.dir||'') ?? c.dir;
        const tel=prompt('Tel',c.tel||'') ?? c.tel;
        const email=prompt('Email',c.email||'') ?? c.email;
        clientes[i]={...c,nombre,nif,dir,tel,email};
        saveClientes();
        renderClientesSelect();
        renderClientesLista();
      }else{
        if(confirm('¿Eliminar cliente?')){
          clientes.splice(i,1);
          saveClientes();
          renderClientesSelect();
          renderClientesLista();
        }
      }
    });
  });
}

/* ---------- PRODUCTOS UI (continúa en PARTE 2/3...) ---------- */

// ✅ IMPORTANTE:
// Te entrego la PARTE 2/3 con:
// - Productos UI completo + Fixes
// - Líneas de factura + Recalc IVA siempre
// - Guardar nueva / Guardar cambios (editar)
// - Render Facturas con Editar y Cambiar fecha
// - PDF, Pendientes, Ventas, Charts

/* ---------- BOOT BASICO ---------- */
function renderAllBasic(){
  renderClientesSelect();
  renderClientesLista();
}

(function boot(){
  seedClientesIfEmpty();
  ensureClienteIds();
  seedProductsIfEmpty();
  setProviderDefaultsIfEmpty();
  setFechaFacturaDefault();
  renderAllBasic();
/* ===========================================================
   PARTE 2/3 — ARSLAN PRO V10.4 (MONO Edition) — app.js
   ✅ Productos UI completo
   ✅ Líneas factura + IVA 4% SIEMPRE
   ✅ Guardar + Editar factura + Cambiar fecha
   ✅ PDF + Pendientes + Ventas + Charts
=========================================================== */

/* ---------- PRODUCTOS UI ---------- */
function saveProductos(){ save(K_PRODUCTOS, productos); }

function populateProductDatalist(){
  const dl=$('#productNamesList'); if(!dl) return;
  dl.innerHTML='';
  productos.forEach(p=>{
    const o=document.createElement('option');
    o.value=p.name;
    dl.appendChild(o);
  });
}

function renderProductos(){
  const cont = $('#listaProductos'); if(!cont) return;
  const q = ($('#buscarProducto')?.value||'').toLowerCase();
  const view = q ? productos.filter(p=>(p.name||'').toLowerCase().includes(q)) : productos;

  cont.innerHTML='';
  if(view.length===0){
    cont.innerHTML='<div class="item">Sin resultados.</div>';
    return;
  }

  view.forEach((p)=>{
    const row=document.createElement('div');
    row.className='product-row';
    row.dataset.id = p.id || (p.id = uid());

    row.innerHTML=`
      <input value="${escapeHTML(p.name||'')}" data-f="name" />
      <select data-f="mode">
        <option value="">—</option>
        <option value="kg"${p.mode==='kg'?' selected':''}>kg</option>
        <option value="unidad"${p.mode==='unidad'?' selected':''}>unidad</option>
        <option value="caja"${p.mode==='caja'?' selected':''}>caja</option>
      </select>
      <input type="number" step="0.01" data-f="boxkg" placeholder="Kg/caja" value="${p.boxkg??''}" />
      <input type="number" step="0.01" data-f="price" placeholder="€ base" value="${p.price??''}" />
      <input data-f="origin" placeholder="Origen" value="${escapeHTML(p.origin||'')}" />
      <button data-e="save">💾</button>
      <button class="ghost" data-e="del">✖</button>
    `;
    cont.appendChild(row);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const row=b.closest('.product-row');
    const id=row?.dataset.id;
    b.addEventListener('click', ()=>{
      const i=productos.findIndex(x=>(x.id||'')===id);
      if(i<0) return;

      if(b.dataset.e==='del'){
        if(confirm('¿Eliminar producto?')){
          productos.splice(i,1);
          saveProductos();
          populateProductDatalist();
          renderProductos();
        }
        return;
      }

      // guardar
      const get = f => row.querySelector(`[data-f="${f}"]`)?.value ?? '';
      const name = String(get('name')).trim();
      const mode = String(get('mode')).trim() || null;

      const boxkgStr = String(get('boxkg')).trim();
      const boxkg = boxkgStr==='' ? null : parseNum(boxkgStr);

      const priceStr = String(get('price')).trim();
      const price = priceStr==='' ? null : parseNum(priceStr);

      const origin = String(get('origin')).trim() || null;

      productos[i] = { ...productos[i], id, name, mode, boxkg, price, origin };
      saveProductos();
      populateProductDatalist();
      renderProductos();
    });
  });
}

$('#buscarProducto')?.addEventListener('input', renderProductos);

$('#btnAddProducto')?.addEventListener('click', ()=>{
  const name = (prompt('Nombre del producto:')||'').trim();
  if(!name) return;
  const mode = (prompt('Modo (kg/unidad/caja) [opcional]:')||'').trim().toLowerCase();
  const boxkg = parseNum(prompt('Kg/caja (solo si es caja) [opcional]:')||'');
  const price = parseNum(prompt('Precio base € [opcional]:')||'');
  const origin = (prompt('Origen [opcional]:')||'').trim();

  productos.unshift({
    id: uid(),
    name,
    mode: (mode==='kg'||mode==='unidad'||mode==='caja') ? mode : null,
    boxkg: boxkg>0 ? boxkg : null,
    price: price>0 ? price : null,
    origin: origin || null
  });

  saveProductos();
  populateProductDatalist();
  renderProductos();
});

/* ---------- FACTURA: LÍNEAS ---------- */
function findProducto(name){
  return productos.find(p=>(p.name||'').toLowerCase()===String(name||'').toLowerCase());
}

function addLinea(){
  const tb = $('#lineasBody'); if(!tb) return;
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto (↓ para ver lista)" /></td>
    <td>
      <select class="mode">
        <option value="">—</option>
        <option value="kg">kg</option>
        <option value="unidad">unidad</option>
        <option value="caja">caja</option>
      </select>
    </td>
    <td><input class="qty" type="number" step="1" min="0" placeholder="Cant." /></td>
    <td><input class="gross" type="number" step="0.01" min="0" placeholder="Bruto" /></td>
    <td><input class="tare"  type="number" step="0.01" min="0" placeholder="Tara" /></td>
    <td><input class="net"   type="number" step="0.01" placeholder="Neto" disabled /></td>
    <td><input class="price" type="number" step="0.01" min="0" placeholder="Precio" /></td>
    <td><input class="origin" placeholder="Origen (opcional)" /></td>
    <td><input class="amount" placeholder="Importe" disabled /></td>
    <td><button class="del">✕</button></td>
  `;
  tb.appendChild(tr);

  const name=tr.querySelector('.name');
  const mode=tr.querySelector('.mode');
  const qty=tr.querySelector('.qty');
  const gross=tr.querySelector('.gross');
  const tare=tr.querySelector('.tare');
  const net=tr.querySelector('.net');
  const price=tr.querySelector('.price');
  const origin=tr.querySelector('.origin');
  const amount=tr.querySelector('.amount');

  const showHist=()=>{
    const n=name.value.trim();
    if(n) renderPriceHistory(n);
  };
  name.addEventListener('focus', showHist);
  price.addEventListener('focus', showHist);

  name.addEventListener('change', ()=>{
    const p=findProducto(name.value.trim());
    if(p){
      if(p.mode) mode.value=p.mode;
      if(p.price!=null) price.value=p.price;
      if(p.origin) origin.value=p.origin;

      const lp=lastPrice(p.name);
      if(lp!=null && !(parseNum(price.value)>0)) price.value = lp;

      renderPriceHistory(p.name);
    }
    recalcLine();
  });

  [mode, qty, gross, tare, price].forEach(i=>i.addEventListener('input', recalcLine));
  tr.querySelector('.del').addEventListener('click', ()=>{ tr.remove(); recalc(); });

  function recalcLine(){
    const m=(mode.value||'').toLowerCase();
    const q=Math.max(0, Math.floor(parseNum(qty.value||0)));
    const g=Math.max(0, parseNum(gross.value||0));
    const t=Math.max(0, parseNum(tare.value||0));
    const pr=Math.max(0, parseNum(price.value||0));

    let n=0;

    // Neto por bruto-tara
    if(g>0 || t>0){
      n=Math.max(0,g-t);
    }else{
      // Si es caja, usa kg/caja si está definido en producto
      if(m==='caja'){
        const p=findProducto(name.value);
        const kg=(p?.boxkg||0);
        n = q * kg;
      }else if(m==='kg'){
        n = q;
      }else if(m==='unidad'){
        n = q;
      }
    }

    net.value = n ? n.toFixed(2) : '';

    // Importes: unidad => qty*price, resto => net*price
    const amt = (m==='unidad') ? q*pr : n*pr;
    amount.value = amt>0 ? amt.toFixed(2) : '';

    recalc();
  }
}

function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const name=(r.querySelector('.name')?.value||'').trim();
    const mode=(r.querySelector('.mode')?.value||'').trim().toLowerCase();
    const qty=Math.max(0, Math.floor(parseNum(r.querySelector('.qty')?.value||0)));
    const gross=Math.max(0, parseNum(r.querySelector('.gross')?.value||0));
    const tare=Math.max(0, parseNum(r.querySelector('.tare')?.value||0));
    const net=Math.max(0, parseNum(r.querySelector('.net')?.value||0));
    const price=Math.max(0, parseNum(r.querySelector('.price')?.value||0));
    const origin=(r.querySelector('.origin')?.value||'').trim();
    return {name,mode,qty,gross,tare,net,price,origin};
  }).filter(l=> l.name && (l.qty>0 || l.net>0 || l.gross>0));
}

function lineImporte(l){
  return (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
}

/* ---------- PAGOS PARCIALES EN UI ---------- */
function renderPagosTemp(){
  const list=$('#listaPagos'); if(!list) return;
  list.innerHTML='';
  if(pagosTemp.length===0){
    list.innerHTML='<div class="item">Sin pagos parciales.</div>';
    return;
  }
  pagosTemp.forEach((p,i)=>{
    const div=document.createElement('div');
    div.className='item';
    div.innerHTML=`
      <div>${fmtDateDMY(new Date(p.date))} · <strong>${money(p.amount)}</strong></div>
      <button class="ghost" data-i="${i}">✖</button>
    `;
    list.appendChild(div);
  });
  list.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      pagosTemp.splice(+b.dataset.i,1);
      renderPagosTemp();
      recalc();
    });
  });
}

$('#btnAddPago')?.addEventListener('click', ()=>{
  const amt=parseNum($('#inpPagoParcial')?.value||0);
  if(!(amt>0)) return;
  pagosTemp.unshift({date: todayISO(), amount: amt});
  $('#inpPagoParcial').value='';
  renderPagosTemp();
  recalc();
});

/* ---------- IVA SIEMPRE + RECÁLCULO ---------- */
function recalc(){
  const ls=captureLineas();
  let subtotal=0;
  ls.forEach(l=> subtotal += lineImporte(l));

  const transporte = $('#chkTransporte')?.checked ? subtotal*0.10 : 0;

  // ✅ IVA 4% SIEMPRE (sobre subtotal + transporte)
  const base = subtotal + transporte;
  const iva = base * 0.04;

  // ✅ Total SIEMPRE incluye IVA
  const total = base + iva;

  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, total - pagadoTotal);

  $('#subtotal').textContent = money(subtotal);
  $('#transp').textContent = money(transporte);
  $('#iva').textContent = money(iva);
  $('#total').textContent = money(total);
  $('#pendiente').textContent = money(pendiente);

  // Estado automático
  if(total<=0) $('#estado').value='pendiente';
  else if(pagadoTotal<=0) $('#estado').value='pendiente';
  else if(pagadoTotal<total) $('#estado').value='parcial';
  else $('#estado').value='pagado';

  const foot=$('#pdf-foot-note');
  if(foot) foot.textContent = 'IVA 4% incluido en el total. Transporte 10% opcional.';

  fillPrint(ls,{subtotal,transporte,iva,total},null,null);
  drawResumen();
}

;['chkTransporte','estado','pagado','inpFechaFactura'].forEach(id=>{
  $('#'+id)?.addEventListener('input', recalc);
});

/* ---------- PDF FILL ---------- */
function fillPrint(lines, totals, _temp=null, f=null){
  $('#p-num').textContent = f?.numero || '(Sin guardar)';
  $('#p-fecha').textContent = (f?new Date(f.fecha):new Date(getFechaISOFromInput())).toLocaleString();

  $('#p-prov').innerHTML = `
    <div><strong>${escapeHTML(f?.proveedor?.nombre || $('#provNombre').value || '')}</strong></div>
    <div>${escapeHTML(f?.proveedor?.nif || $('#provNif').value || '')}</div>
    <div>${escapeHTML(f?.proveedor?.dir || $('#provDir').value || '')}</div>
    <div>${escapeHTML(f?.proveedor?.tel || $('#provTel').value || '')} · ${escapeHTML(f?.proveedor?.email || $('#provEmail').value || '')}</div>
  `;
  $('#p-cli').innerHTML = `
    <div><strong>${escapeHTML(f?.cliente?.nombre || $('#cliNombre').value || '')}</strong></div>
    <div>${escapeHTML(f?.cliente?.nif || $('#cliNif').value || '')}</div>
    <div>${escapeHTML(f?.cliente?.dir || $('#cliDir').value || '')}</div>
    <div>${escapeHTML(f?.cliente?.tel || $('#cliTel').value || '')} · ${escapeHTML(f?.cliente?.email || $('#cliEmail').value || '')}</div>
  `;

  const tbody = $('#p-tabla tbody'); tbody.innerHTML='';
  (lines||[]).forEach(l=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(l.name)}</td>
      <td>${escapeHTML(l.mode||'')}</td>
      <td>${l.qty||''}</td>
      <td>${l.gross?l.gross.toFixed(2):''}</td>
      <td>${l.tare?l.tare.toFixed(2):''}</td>
      <td>${l.net?l.net.toFixed(2):''}</td>
      <td>${money(l.price)}</td>
      <td>${escapeHTML(l.origin||'')}</td>
      <td>${money((l.mode==='unidad') ? l.qty*l.price : l.net*l.price)}</td>
    `;
    tbody.appendChild(tr);
  });

  $('#p-sub').textContent = money(totals?.subtotal||0);
  $('#p-tra').textContent = money(totals?.transporte||0);
  $('#p-iva').textContent = money(totals?.iva||0);
  $('#p-tot').textContent = money(totals?.total||0);

  $('#p-estado').textContent = f?.estado || $('#estado')?.value || 'Impagada';
  $('#p-metodo').textContent = f?.metodo || $('#metodoPago')?.value || 'Efectivo';
  $('#p-obs').textContent = f?.obs || ($('#observaciones')?.value||'—');

  // QR con datos básicos
  try{
    const canvas = $('#p-qr');
    const numero = f?.numero || '(Sin guardar)';
    const cliente = f?.cliente?.nombre || $('#cliNombre').value || '';
    const payload = `ARSLAN-Factura|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado').textContent}`;
    window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
  }catch(e){}
}

/* ---------- NUEVA / GUARDAR / EDITAR ---------- */
function genNumFactura(){
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function saveFacturas(){ save(K_FACTURAS, facturas); }

function setEditBadge(){
  const b = $('#editBadge');
  if(!b) return;
  if(editingIndex===null) b.textContent = '';
  else b.textContent = '✏️ Editando factura';
}

function clearFacturaUI(){
  const tb=$('#lineasBody');
  if(tb) tb.innerHTML='';

  for(let i=0;i<5;i++) addLinea();

  $('#chkTransporte').checked=false;
  $('#estado').value='pendiente';
  $('#pagado').value='';
  $('#metodoPago').value='Efectivo';
  $('#observaciones').value='';

  pagosTemp=[];
  renderPagosTemp();

  setFechaFacturaDefault();

  editingIndex=null;
  editingId=null;
  setEditBadge();

  recalc();
}

$('#btnNueva')?.addEventListener('click', ()=>{
  clearFacturaUI();
});

$('#btnGuardar')?.addEventListener('click', ()=>{
  const ls=captureLineas();
  if(ls.length===0){
    alert('Añade al menos una línea.');
    return;
  }

  // historial precios
  ls.forEach(l=> pushPriceHistory(l.name, l.price));

  const subtotal=unMoney($('#subtotal').textContent);
  const transporte=unMoney($('#transp').textContent);
  const iva=unMoney($('#iva').textContent);
  const total=unMoney($('#total').textContent);

  const manual = parseNum($('#pagado').value||0);
  const pagos = [...pagosTemp];
  const pagadoParcial = pagos.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + pagadoParcial;
  const pendiente=Math.max(0,total-pagadoTotal);
  const estado = (pagadoTotal<=0) ? 'pendiente' : (pagadoTotal<total ? 'parcial' : 'pagado');

  const fecha = getFechaISOFromInput();

  const facturaObj = {
    id: editingId || uid(),
    numero: (editingIndex===null) ? genNumFactura() : (facturas[editingIndex]?.numero || genNumFactura()),
    fecha,
    proveedor:{
      nombre:$('#provNombre').value,
      nif:$('#provNif').value,
      dir:$('#provDir').value,
      tel:$('#provTel').value,
      email:$('#provEmail').value
    },
    cliente:{
      nombre:$('#cliNombre').value,
      nif:$('#cliNif').value,
      dir:$('#cliDir').value,
      tel:$('#cliTel').value,
      email:$('#cliEmail').value
    },
    lineas:ls,
    transporte:$('#chkTransporte').checked,
    estado,
    metodo:$('#metodoPago').value,
    obs:$('#observaciones').value,
    totals:{subtotal,transporte,iva,total,pagado:pagadoTotal,pendiente},
    pagos
  };

  if(editingIndex===null){
    // ✅ NUEVA
    facturas.unshift(facturaObj);
    alert(`Factura ${facturaObj.numero} guardada.`);
  }else{
    // ✅ GUARDAR CAMBIOS
    facturas[editingIndex] = facturaObj;
    alert(`Factura ${facturaObj.numero} actualizada ✔️`);
  }

  saveFacturas();

  // reset pagos UI temporales tras guardar
  pagosTemp=[];
  renderPagosTemp();

  renderFacturas();
  renderPendientes();
  drawKPIs();
  drawCharts();
  drawTop();
  renderVentasCliente();
  drawResumen();

  fillPrint(ls,{subtotal,transporte,iva,total},null,facturaObj);

  // salir de modo edición tras guardar
  editingIndex=null;
  editingId=null;
  setEditBadge();
});

$('#btnImprimir')?.addEventListener('click', ()=>{
  recalc();
  const element = document.getElementById('printArea');
  const d=new Date();
  const file=`Factura-${($('#cliNombre').value||'Cliente').replace(/\s+/g,'')}-${fmtDateDMY(d)}.pdf`;
  const opt = {
    margin:[10,10,10,10],
    filename:file,
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
  };
  window.html2pdf().set(opt).from(element).save();
});

/* ---------- LISTA DE FACTURAS (Ver / Cobrar / Parcial / PDF / Editar / Cambiar fecha) ---------- */
function badgeEstado(f){
  const tot=f.totals?.total||0, pag=f.totals?.pagado||0;
  if(pag>=tot) return `<span class="state-badge state-green">Pagada</span>`;
  if(pag>0 && pag<tot) return `<span class="state-badge state-amber">Parcial (${money(pag)} / ${money(tot)})</span>`;
  return `<span class="state-badge state-red">Impagada</span>`;
}

function renderFacturas(){
  const cont=$('#listaFacturas'); if(!cont) return;
  cont.innerHTML='';

  const q=($('#buscaCliente')?.value||'').toLowerCase();
  const fe=$('#filtroEstado')?.value||'todas';
  let arr=facturas.slice();

  if(fe!=='todas') arr=arr.filter(f=>f.estado===fe);
  if(q) arr=arr.filter(f=>(f.cliente?.nombre||'').toLowerCase().includes(q));

  if(arr.length===0){
    cont.innerHTML='<div class="item">No hay facturas.</div>';
    return;
  }

  // importante: el índice real en facturas
  const indexMap = arr.map(a => facturas.findIndex(x => (x.id && a.id) ? x.id===a.id : x.numero===a.numero));

  arr.slice(0,450).forEach((f,idx)=>{
    const realIndex = indexMap[idx];
    const fecha=new Date(f.fecha).toLocaleString();

    const div=document.createElement('div');
    div.className='item';

    div.innerHTML=`
      <div>
        <strong>${escapeHTML(f.numero)}</strong> ${badgeEstado(f)}
        <div class="muted">${fecha} · ${escapeHTML(f.cliente?.nombre||'')}</div>
      </div>
      <div class="row">
        <strong>${money(f.totals?.total||0)}</strong>
        <button class="ghost" data-e="ver" data-i="${realIndex}">Ver</button>
        <button data-e="cobrar" data-i="${realIndex}">💶 Cobrar</button>
        <button class="ghost" data-e="parcial" data-i="${realIndex}">+ Parcial</button>
        <button class="ghost" data-e="pdf" data-i="${realIndex}">PDF</button>
        <button class="ghost" data-e="edit" data-i="${realIndex}">✏️ Editar</button>
        <button class="ghost" data-e="date" data-i="${realIndex}">📅 Fecha</button>
      </div>
    `;

    cont.appendChild(div);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const i=+b.dataset.i;
    b.addEventListener('click', ()=>{
      const f=facturas[i];
      if(!f) return;

      if(b.dataset.e==='ver'){
        fillPrint(f.lineas,f.totals,null,f);
        switchTab('factura');
        document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
        return;
      }

      if(b.dataset.e==='cobrar'){
        const tot=f.totals?.total||0;
        f.totals.pagado=tot;
        f.totals.pendiente=0;
        f.estado='pagado';
        (f.pagos??=[]).push({date:todayISO(), amount: tot});
        saveFacturas();
        renderFacturas();
        renderPendientes();
        drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        return;
      }

      if(b.dataset.e==='parcial'){
        const max=(f.totals?.total||0)-(f.totals?.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[];
          f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          saveFacturas();
          renderFacturas();
          renderPendientes();
          drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
        return;
      }

      if(b.dataset.e==='pdf'){
        fillPrint(f.lineas,f.totals,null,f);
        const dt=new Date(f.fecha);
        const nombreCliente=(f.cliente?.nombre||'Cliente').replace(/\s+/g,'');
        const filename=`Factura-${nombreCliente}-${fmtDateDMY(dt)}.pdf`;
        const opt={
          margin:[10,10,10,10],
          filename,
          image:{type:'jpeg',quality:0.98},
          html2canvas:{scale:2,useCORS:true},
          jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
        };
        window.html2pdf().set(opt).from(document.getElementById('printArea')).save();
        return;
      }

      if(b.dataset.e==='edit'){
        // ✅ ENTRAR EN MODO EDICIÓN
        editingIndex = i;
        editingId = f.id || uid();
        setEditBadge();

        // cargar datos
        $('#provNombre').value = f.proveedor?.nombre || '';
        $('#provNif').value    = f.proveedor?.nif || '';
        $('#provDir').value    = f.proveedor?.dir || '';
        $('#provTel').value    = f.proveedor?.tel || '';
        $('#provEmail').value  = f.proveedor?.email || '';

        $('#cliNombre').value  = f.cliente?.nombre || '';
        $('#cliNif').value     = f.cliente?.nif || '';
        $('#cliDir').value     = f.cliente?.dir || '';
        $('#cliTel').value     = f.cliente?.tel || '';
        $('#cliEmail').value   = f.cliente?.email || '';

        setFechaInputFromISO(f.fecha);

        $('#chkTransporte').checked = !!f.transporte;
        $('#estado').value = f.estado || 'pendiente';
        $('#metodoPago').value = f.metodo || 'Efectivo';
        $('#observaciones').value = f.obs || '';

        // pagos
        pagosTemp = (Array.isArray(f.pagos) ? [...f.pagos] : []);
        renderPagosTemp();

        // cargar líneas
        const tb=$('#lineasBody');
        tb.innerHTML='';
        (f.lineas||[]).forEach(l=>{
          addLinea();
          const r=tb.lastElementChild;
          r.querySelector('.name').value = l.name || '';
          r.querySelector('.mode').value = l.mode || '';
          r.querySelector('.qty').value = l.qty || '';
          r.querySelector('.gross').value = l.gross || '';
          r.querySelector('.tare').value = l.tare || '';
          r.querySelector('.net').value = l.net || '';
          r.querySelector('.price').value = l.price || '';
          r.querySelector('.origin').value = l.origin || '';
        });

        // asegurar mínimo 5
        while(tb.children.length<5) addLinea();

        recalc();
        switchTab('factura');
        document.getElementById('lineasBody')?.scrollIntoView({behavior:'smooth'});
        return;
      }

      if(b.dataset.e==='date'){
        const current = new Date(f.fecha);
        const newVal = prompt(
          'Nueva fecha ISO (ej: 2026-01-26T10:30:00.000Z)\n\nO escribe una fecha local tipo: 2026-01-26 10:30',
          current.toISOString()
        );

        if(!newVal) return;

        // aceptar formato libre
        let newDate = new Date(newVal);
        if(isNaN(newDate.getTime())){
          // probar con formato "YYYY-MM-DD HH:mm"
          const fixed = String(newVal).trim().replace(' ', 'T');
          newDate = new Date(fixed);
        }
        if(isNaN(newDate.getTime())){
          alert('Fecha inválida.');
          return;
        }

        f.fecha = newDate.toISOString();
        saveFacturas();
        renderFacturas();
        renderPendientes();
        drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        return;
      }
    });
  });
}

$('#filtroEstado')?.addEventListener('input', renderFacturas);
$('#buscaCliente')?.addEventListener('input', renderFacturas);

/* ---------- PENDIENTES ---------- */
function renderPendientes(){
  const tb=$('#tblPendientes tbody'); if(!tb) return;
  tb.innerHTML='';

  const map=new Map(); // cliente -> {count, total, lastDate}
  facturas.forEach(f=>{
    const pend=f.totals?.pendiente||0;
    if(pend<=0) return;
    const nom=f.cliente?.nombre||'(s/cliente)';
    const cur=map.get(nom)||{count:0,total:0,lastDate:null};
    cur.count++;
    cur.total+=pend;
    cur.lastDate = !cur.lastDate || new Date(f.fecha)>new Date(cur.lastDate) ? f.fecha : cur.lastDate;
    map.set(nom,cur);
  });

  let global=0;
  const rows=[...map.entries()].sort((a,b)=>b[1].total-a[1].total);

  rows.forEach(([nom,info])=>{
    global+=info.total;
    const tr=document.createElement('tr');

    // semáforo simple
    const color = info.total>500 ? 'state-red' : info.total>=100 ? 'state-amber' : 'state-green';

    tr.innerHTML=`
      <td>${escapeHTML(nom)}</td>
      <td>${info.count}</td>
      <td><span class="state-badge ${color}">${money(info.total)}</span></td>
      <td>${new Date(info.lastDate).toLocaleString()}</td>
      <td><button class="ghost" data-c="${escapeHTML(nom)}">Ver facturas</button></td>
    `;
    tb.appendChild(tr);
  });

  $('#resGlobal').textContent = money(global);

  tb.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const nombre=b.dataset.c;
      $('#buscaCliente').value=nombre;
      switchTab('facturas');
      renderFacturas();
    });
  });
}

/* ---------- VENTAS (KPIs, gráficos, top, por cliente) ---------- */
function sumBetween(d1,d2,filterClient=null){
  let sum=0;
  facturas.forEach(f=>{
    const d=new Date(f.fecha);
    if(d>=d1 && d<d2 && (!filterClient || (f.cliente?.nombre||'')===filterClient)){
      sum += (f.totals?.total||0);
    }
  });
  return sum;
}
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d=new Date()){
  const x=new Date(d);
  const day=(x.getDay()+6)%7; // lunes=0
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1); }

function drawKPIs(){
  const now=new Date();
  const hoy = sumBetween(startOfDay(now), endOfDay(now));
  const semana = sumBetween(startOfWeek(now), endOfDay(now));
  const mes = sumBetween(startOfMonth(now), endOfDay(now));
  const total = facturas.reduce((a,f)=>a+(f.totals?.total||0),0);

  $('#vHoy').textContent=money(hoy);
  $('#vSemana').textContent=money(semana);
  $('#vMes').textContent=money(mes);
  $('#vTotal').textContent=money(total);

  $('#rHoy').textContent=money(hoy);
  $('#rSemana').textContent=money(semana);
  $('#rMes').textContent=money(mes);
  $('#rTotal').textContent=money(total);
}

let chart1, chart2, chartTop;
function groupDaily(n=7){
  const now=new Date();
  const buckets=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(now);
    d.setDate(d.getDate()-i);
    const k=d.toISOString().slice(0,10);
    buckets.push({k,label:k.slice(5),sum:0});
  }
  facturas.forEach(f=>{
    const k=String(f.fecha||'').slice(0,10);
    const b=buckets.find(x=>x.k===k);
    if(b) b.sum += (f.totals?.total||0);
  });
  return buckets;
}
function groupMonthly(n=12){
  const now=new Date();
  const buckets=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(now);
    d.setMonth(d.getMonth()-i);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    buckets.push({k,label:k,sum:0});
  }
  facturas.forEach(f=>{
    const d=new Date(f.fecha);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const b=buckets.find(x=>x.k===k);
    if(b) b.sum += (f.totals?.total||0);
  });
  return buckets;
}

function drawCharts(){
  if(typeof Chart==='undefined') return;
  const daily=groupDaily(7);
  const monthly=groupMonthly(12);

  if(chart1) chart1.destroy();
  if(chart2) chart2.destroy();

  chart1=new Chart(document.getElementById('chartDiario').getContext('2d'), {
    type:'bar',
    data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]},
    options:{responsive:true, plugins:{legend:{display:false}}}
  });

  chart2=new Chart(document.getElementById('chartMensual').getContext('2d'), {
    type:'line',
    data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]},
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

function drawTop(){
  if(typeof Chart==='undefined') return;
  const map=new Map(); // name -> total €
  facturas.forEach(f=>{
    (f.lineas||[]).forEach(l=>{
      const amt = (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
      map.set(l.name,(map.get(l.name)||0)+amt);
    });
  });
  const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=pairs.map(p=>p[0]);
  const data=pairs.map(p=>p[1]);

  if(chartTop) chartTop.destroy();
  chartTop=new Chart(document.getElementById('chartTop').getContext('2d'), {
    type:'bar',
    data:{labels, datasets:[{label:'Top productos (€)', data}]},
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

function renderVentasCliente(){
  const tb=$('#tblVentasCliente tbody'); if(!tb) return;
  tb.innerHTML='';

  const now=new Date();
  const sDay=startOfDay(now), eDay=endOfDay(now);
  const sWeek=startOfWeek(now), eWeek=endOfDay(now);
  const sMonth=startOfMonth(now), eMonth=endOfDay(now);

  const byClient=new Map(); // cliente -> {hoy,semana,mes,total}
  facturas.forEach(f=>{
    const nom=f.cliente?.nombre||'(s/cliente)';
    const d=new Date(f.fecha);
    const tot=f.totals?.total||0;
    const cur=byClient.get(nom)||{hoy:0,semana:0,mes:0,total:0};

    if(d>=sDay && d<=eDay) cur.hoy+=tot;
    if(d>=sWeek&& d<=eWeek) cur.semana+=tot;
    if(d>=sMonth&&d<=eMonth) cur.mes+=tot;
    cur.total+=tot;

    byClient.set(nom,cur);
  });

  [...byClient.entries()].sort((a,b)=>b[1].total-a[1].total).forEach(([nom,v])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${escapeHTML(nom)}</td>
      <td>${money(v.hoy)}</td>
      <td>${money(v.semana)}</td>
      <td>${money(v.mes)}</td>
      <td><strong>${money(v.total)}</strong></td>
    `;
    tb.appendChild(tr);
  });
}

/* ---------- EVENTOS GENERALES ---------- */
$('#btnAddLinea')?.addEventListener('click', addLinea);

$('#btnVaciarLineas')?.addEventListener('click', ()=>{
  if(confirm('¿Vaciar líneas?')){
    const tb=$('#lineasBody');
    tb.innerHTML='';
    for(let i=0;i<5;i++) addLinea();
    recalc();
  }
});

$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));

$('#selCliente')?.addEventListener('change', ()=>{
  const id=$('#selCliente')?.value;
  if(!id) return;
  const c=clientes.find(x=>x.id===id);
  if(!c) return;
  fillClientFields(c);
  recalc();
});

$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre=(prompt('Nombre del cliente:')||'').trim();
  if(!nombre) return;

  const nif = (prompt('NIF/CIF:')||'').trim();
  const dir = (prompt('Dirección:')||'').trim();
  const tel = (prompt('Teléfono:')||'').trim();
  const email = (prompt('Email:')||'').trim();

  clientes.push({ id: uid(), nombre, nif, dir, tel, email });
  saveClientes();
  renderClientesSelect();
  renderClientesLista();
});

/* ---------- RESUMEN ---------- */
function drawResumen(){
  drawKPIs();
}

/* ===========================================================
   PARTE 3/3:
   - Import/Export JSON (clientes/productos/facturas) (manteniendo botones)
   - Export CSV ventas
   - Reset deudas cliente/global (botones pendientes)
   - RenderAll() completo + Boot final correcto
   - Fix final de order y auto-load
=========================================================== */
/* ===========================================================
   PARTE 3/3 — ARSLAN PRO V10.4 (MONO Edition) — app.js
   ✅ Helpers de fecha + Edición completa estable
   ✅ Export CSV ventas (sin backup/restore)
   ✅ RenderAll + Boot final (cierre correcto)
   ✅ Atajos teclado PRO (Enter / Ctrl+Enter / Alt+S / Alt+N)
=========================================================== */

/* ---------- FECHA FACTURA (input seguro) ---------- */
function ensureFechaFacturaInput(){
  const el = $('#inpFechaFactura');
  if(!el) return;

  // si no tiene value, lo ponemos
  if(!el.value){
    const d=new Date();
    // input type datetime-local: YYYY-MM-DDTHH:mm
    const pad=n=>String(n).padStart(2,'0');
    el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function setFechaFacturaDefault(){
  const el = $('#inpFechaFactura');
  if(!el) return;
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setFechaInputFromISO(iso){
  const el = $('#inpFechaFactura');
  if(!el) return;
  try{
    const d=new Date(iso);
    if(isNaN(d.getTime())) return;
    const pad=n=>String(n).padStart(2,'0');
    el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch(e){}
}

function getFechaISOFromInput(){
  const el = $('#inpFechaFactura');
  if(!el || !el.value) return todayISO();
  // datetime-local devuelve "YYYY-MM-DDTHH:mm"
  const d = new Date(el.value);
  if(isNaN(d.getTime())) return todayISO();
  return d.toISOString();
}

/* ---------- EDIT MODE FLAGS (seguro global interno) ---------- */
if(typeof window.editingIndex === 'undefined') window.editingIndex = null;
if(typeof window.editingId === 'undefined') window.editingId = null;
let editingIndex = window.editingIndex;
let editingId = window.editingId;

function syncEditGlobals(){
  window.editingIndex = editingIndex;
  window.editingId = editingId;
}

/* ---------- CLIENTES: BUSCADOR LIVE ---------- */
$('#buscarCliente')?.addEventListener('input', renderClientesLista);

/* ---------- EXPORT CSV VENTAS (mantiene función pro) ---------- */
function exportVentasCSV(){
  const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado','Método']];
  facturas.forEach(f=>{
    rows.push([
      f.cliente?.nombre||'',
      new Date(f.fecha).toLocaleString(),
      f.numero||'',
      (f.totals?.total||0),
      (f.totals?.pagado||0),
      (f.totals?.pendiente||0),
      f.estado||'',
      f.metodo||''
    ]);
  });

  const csv = rows
    .map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='ventas.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$('#btnExportVentas')?.addEventListener('click', exportVentasCSV);

/* ---------- ATAJOS TECLADO PRO ---------- */
function focusNextInputInRow(current){
  // Busca el siguiente input/select dentro de la misma fila <tr>
  const tr = current.closest('tr');
  if(!tr) return false;

  const focusables = Array.from(tr.querySelectorAll('input,select,textarea,button'))
    .filter(el => !el.disabled && el.type!=='button' && el.className!=='del');

  const idx = focusables.indexOf(current);
  if(idx>=0 && idx < focusables.length-1){
    focusables[idx+1].focus();
    focusables[idx+1].select?.();
    return true;
  }

  // si no hay más en esa fila, salta al primer campo de la siguiente fila
  const nextTr = tr.nextElementSibling;
  if(nextTr){
    const nxt = nextTr.querySelector('input,select,textarea');
    if(nxt){
      nxt.focus();
      nxt.select?.();
      return true;
    }
  }
  return false;
}

document.addEventListener('keydown', (e)=>{
  // Alt+S = Guardar
  if(e.altKey && (e.key==='s' || e.key==='S')){
    e.preventDefault();
    $('#btnGuardar')?.click();
    return;
  }
  // Alt+N = Nueva factura
  if(e.altKey && (e.key==='n' || e.key==='N')){
    e.preventDefault();
    $('#btnNueva')?.click();
    return;
  }
  // Ctrl+Enter = Añadir línea
  if(e.ctrlKey && e.key==='Enter'){
    e.preventDefault();
    $('#btnAddLinea')?.click();
    return;
  }

  // Enter = saltar al siguiente input en líneas (sin enviar)
  if(e.key==='Enter'){
    const el = document.activeElement;
    if(!el) return;
    const insideLines = el.closest('#lineasBody');
    if(insideLines){
      e.preventDefault();
      // si es botón del, no
      if(el.classList?.contains('del')) return;
      // intenta mover
      const moved = focusNextInputInRow(el);
      if(!moved){
        // si no movió, añade nueva línea y enfoca producto
        addLinea();
        const tb = $('#lineasBody');
        const last = tb?.lastElementChild;
        const inp = last?.querySelector('.name');
        inp?.focus();
      }
    }
  }
});

/* ---------- REPARACIÓN PEQUEÑA: INCREMENTOS RÁPIDOS EN CANTIDAD ---------- */
document.addEventListener('click', (e)=>{
  const t=e.target;
  if(!(t instanceof HTMLElement)) return;

  // Click en cantidad = selecciona todo rápido
  if(t.classList?.contains('qty') || t.classList?.contains('price') || t.classList?.contains('gross') || t.classList?.contains('tare')){
    try{ t.select?.(); }catch(err){}
  }
});

/* ---------- BOTÓN: LIMPIAR BÚSQUEDA FACTURAS ---------- */
$('#btnClearSearch')?.addEventListener('click', ()=>{
  const b=$('#buscaCliente');
  if(b){ b.value=''; renderFacturas(); }
});

/* ---------- RENDER GLOBAL ---------- */
function renderAll(){
  renderClientesSelect();
  renderClientesLista();

  populateProductDatalist();
  renderProductos();

  renderFacturas();
  renderPendientes();

  drawKPIs();
  drawCharts();
  drawTop();
  renderVentasCliente();

  drawResumen();
}

/* ---------- BOOT FINAL (SIN CLOUD, 100% LOCAL) ---------- */
(function finalBoot(){
  // asegurar defaults
  seedClientesIfEmpty();
  ensureClienteIds();
  seedProductsIfEmpty();
  setProviderDefaultsIfEmpty();

  // fecha input
  ensureFechaFacturaInput();

  // líneas
  const tb=$('#lineasBody');
  if(tb && tb.children.length===0){
    for(let i=0;i<5;i++) addLinea();
  }

  // pagos temp
  renderPagosTemp();

  // Render todo
  renderAll();

  // Recalcula
  recalc();

  // Inicializa badge edit si existe
  setEditBadge?.();

  // sincroniza globals
  syncEditGlobals();

  console.log('✅ ARSLAN PRO V10.4 (MONO Edition) — App cargada OK');
})();

/* ---------- CIERRE DEL IIFE PRINCIPAL (del PARTE 1) ---------- */
})(); // ✅ Este es el CIERRE CORRECTO FINAL
