/* ===========================================================
   ARSLAN PRO V10.4 — MONO Edition (App.js NUEVO)
   ✅ SIN Supabase / SIN Firebase
   ✅ SIN Backup/Restore
   ✅ IVA 4% SIEMPRE SUMADO AL TOTAL
   ✅ Transporte 10% opcional
   ✅ Edición de facturas (cambiar fecha, cliente, líneas, pagos)
   ✅ Mantiene: Clientes, Productos, Facturas, Pendientes, Ventas, Gráficos, CSV
   ✅ NO se elimina ninguna función clave
=========================================================== */

(function(){
"use strict";

/* =========================
   HELPERS
========================= */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

const parseNum = v => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const money = n => {
  const x = (isNaN(n) ? 0 : n);
  return x.toFixed(2).replace(".", ",") + " €";
};

const unMoney = s => {
  return parseFloat(String(s ?? "")
    .replace(/\./g,'')
    .replace(',','.')
    .replace(/[^\d.]/g,'')) || 0;
};

const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));

const uid = ()=>'id_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);

const nowISO = () => new Date().toISOString();

const fmtDateDMY = d => {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
};

/* =========================
   STORAGE KEYS
========================= */
const K_CLIENTES  = 'arslan_v104_clientes';
const K_PRODUCTOS = 'arslan_v104_productos';
const K_FACTURAS  = 'arslan_v104_facturas';
const K_PRICEHIST = 'arslan_v104_pricehist';

function load(k, fallback){
  try{
    const v = JSON.parse(localStorage.getItem(k) || '');
    return (v ?? fallback);
  }catch{
    return fallback;
  }
}
function save(k, v){
  localStorage.setItem(k, JSON.stringify(v));
}

/* =========================
   ESTADO GLOBAL
========================= */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});

// pagos parciales en factura actual
let pagosTemp = []; // [{date, amount}]

// modo edición factura
let editMode = {
  active:false,
  invoiceId:null
};

/* =========================
   SEED (Clientes / Productos)
========================= */
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
  if(clientes.length) { ensureClienteIds(); return; }

  clientes = uniqueByName([
    {id:uid(), nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos', pago:'Efectivo'},
    {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {id:uid(), nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda, 17 Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
    {id:uid(), nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid(), nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'}
  ]);

  save(K_CLIENTES, clientes);
}

const PRODUCT_NAMES = [
  "TOMATE RAMA","TOMATE PERA","TOMATE DANIELA","TOMATE ROSA","TOMATE BOLA","TOMATE CHERRY RAMA",
  "ICEBERG","BATAVIA","BROCOLI","JUDIA VERDE","CEBOLLETA","PEPINO","PIMIENTO PADRON","ZANAHORIA",
  "PATATA LAVADA","BONIATO","FRESAS","MANDARINA HOJA","NARANJA ZUMO","PERA RINCON DEL SOTO",
  "MANZANA GOLDEN 24","MANZANA GOLDEN 28","MANZANA PINK LADY","UVA ROJA","UVA BLANCA","KIWI"
];

function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({ name:n, mode:"kg", boxkg:null, price:null, origin:null }));
  save(K_PRODUCTOS, productos);
}

/* =========================
   DEFAULT PROVEEDOR
========================= */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre')?.value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif')?.value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir')?.value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel')?.value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail')?.value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* =========================
   TABS
========================= */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));

  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* =========================
   PRICE HISTORY
========================= */
function lastPrice(name){
  const arr = priceHist[name];
  return arr?.length ? arr[0].price : null;
}
function pushPriceHistory(name, price){
  if(!name || !(price>0)) return;
  const arr = priceHist[name] || [];
  arr.unshift({price, date: nowISO()});
  priceHist[name] = arr.slice(0,10);
  save(K_PRICEHIST, priceHist);
}

/* =========================
   CLIENTES UI
========================= */
function saveClientes(){ save(K_CLIENTES, clientes); }

function renderClientesSelect(){
  const sel = $('#selCliente'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  arr.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.nombre||'(Sin nombre)';
    sel.appendChild(opt);
  });
}

function fillClientFields(c){
  if(!c) return;
  $('#cliNombre').value = c.nombre||'';
  $('#cliNif').value    = c.nif||'';
  $('#cliDir').value    = c.dir||'';
  $('#cliTel').value    = c.tel||'';
  $('#cliEmail').value  = c.email||'';
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

  view.forEach(c=>{
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
        $('#selCliente').value = clientes[i].id;
        switchTab('factura');

      }else if(b.dataset.e==='edit'){
        const c=clientes[i];
        const nombre = prompt('Nombre', c.nombre||''); if(nombre===null) return;
        const nif    = prompt('NIF', c.nif||'');       if(nif===null) return;
        const dir    = prompt('Dirección', c.dir||''); if(dir===null) return;
        const tel    = prompt('Tel', c.tel||'');       if(tel===null) return;
        const email  = prompt('Email', c.email||'');   if(email===null) return;

        clientes[i]={...c,nombre,nif,dir,tel,email};
        saveClientes();
        renderClientesSelect();
        renderClientesLista();

      }else if(b.dataset.e==='del'){
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

$('#buscarCliente')?.addEventListener('input', renderClientesLista);

$('#selCliente')?.addEventListener('change', ()=>{
  const id = $('#selCliente').value;
  if(!id) return;
  const c = clientes.find(x=>x.id===id);
  if(!c) return;
  fillClientFields(c);
});

/* =========================
   PRODUCTOS UI
========================= */
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
  const view = q
    ? productos.filter(p=>(p.name||'').toLowerCase().includes(q))
    : productos;

  cont.innerHTML='';

  if(view.length===0){
    cont.innerHTML='<div class="item">Sin resultados.</div>';
    return;
  }

  view.forEach((p, idx)=>{
    const row=document.createElement('div');
    row.className='product-row';
    row.innerHTML=`
      <input value="${escapeHTML(p.name||'')}" data-f="name" />
      <select data-f="mode">
        <option value="">—</option>
        <option value="kg"${p.mode==='kg'?' selected':''}>kg</option>
        <option value="unidad"${p.mode==='unidad'?' selected':''}>unidad</option>
        <option value="caja"${p.mode==='caja'?' selected':''}>caja</option>
      </select>
      <input type="number" step="0.01" data-f="boxkg" placeholder="Kg/caja" value="${p.boxkg ?? ''}" />
      <input type="number" step="0.01" data-f="price" placeholder="€ base" value="${p.price ?? ''}" />
      <input data-f="origin" placeholder="Origen" value="${escapeHTML(p.origin||'')}" />
      <button data-e="save" data-i="${idx}">💾 Guardar</button>
      <button class="ghost" data-e="del" data-i="${idx}">✖</button>
    `;
    cont.appendChild(row);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const i=+b.dataset.i;
    b.addEventListener('click', ()=>{
      if(b.dataset.e==='del'){
        if(confirm('¿Eliminar producto?')){
          productos.splice(i,1);
          saveProductos();
          populateProductDatalist();
          renderProductos();
        }
        return;
      }

      // SAVE
      const row=b.closest('.product-row');
      const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();

      const name = get('name');
      const mode = get('mode') || null;

      const boxkgStr = get('boxkg');
      const boxkg = boxkgStr==='' ? null : parseNum(boxkgStr);

      const priceStr = get('price');
      const price = priceStr==='' ? null : parseNum(priceStr);

      const origin = get('origin') || null;

      productos[i] = { name, mode, boxkg, price, origin };
      saveProductos();
      populateProductDatalist();
      renderProductos();
    });
  });
}

$('#buscarProducto')?.addEventListener('input', renderProductos);

$('#btnAddProducto')?.addEventListener('click', ()=>{
  productos.unshift({ name:'NUEVO PRODUCTO', mode:'kg', boxkg:null, price:null, origin:null });
  saveProductos();
  populateProductDatalist();
  renderProductos();
});

/* =========================
   FIN PARTE 1/3
   (Sigue con: líneas factura + recálculo IVA siempre + edición facturas)
========================= */
/* =========================
   FACTURA — LÍNEAS + RECÁLCULO (IVA SIEMPRE)
========================= */

/* ---------- FIX UI: eliminar IVA botón y forzar IVA SIEMPRE ---------- */
function enforceIvaAlways(){
  // checkbox IVA incluido (lo dejamos fijo siempre)
  const chk = $('#chkIvaIncluido');
  if(chk){
    chk.checked = true;
    chk.disabled = true;
    chk.parentElement && (chk.parentElement.style.opacity = "0.65");
  }

  // botón sumar IVA (ya no existe en lógica, lo ocultamos si está)
  const btn = $('#btnSumarIVA');
  if(btn){
    btn.style.display = "none";
  }
}

/* ---------- Buscar producto por nombre ---------- */
function findProducto(name){
  return productos.find(p => (p.name||'').toLowerCase() === String(name||'').toLowerCase());
}

/* ---------- Añadir línea ---------- */
function addLinea(data=null){
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
    <td><input class="qty" type="number" step="1" placeholder="Cant." /></td>
    <td><input class="gross" type="number" step="0.01" placeholder="Bruto" /></td>
    <td><input class="tare" type="number" step="0.01" placeholder="Tara" /></td>
    <td><input class="net" type="number" step="0.01" placeholder="Neto" disabled /></td>
    <td><input class="price" type="number" step="0.01" placeholder="Precio" /></td>
    <td><input class="origin" placeholder="Origen" /></td>
    <td><input class="amount" placeholder="Importe" disabled /></td>
    <td><button class="del">✕</button></td>
  `;
  tb.appendChild(tr);

  const name  = tr.querySelector('.name');
  const mode  = tr.querySelector('.mode');
  const qty   = tr.querySelector('.qty');
  const gross = tr.querySelector('.gross');
  const tare  = tr.querySelector('.tare');
  const net   = tr.querySelector('.net');
  const price = tr.querySelector('.price');
  const origin= tr.querySelector('.origin');
  const amount= tr.querySelector('.amount');

  // Cargar data si viene (editar/ver factura)
  if(data){
    name.value = data.name || '';
    mode.value = data.mode || '';
    qty.value  = (data.qty ?? '') !== 0 ? (data.qty ?? '') : (data.qty === 0 ? '' : '');
    gross.value= (data.gross ?? '') !== 0 ? (data.gross ?? '') : '';
    tare.value = (data.tare ?? '') !== 0 ? (data.tare ?? '') : '';
    net.value  = (data.net ?? '') !== 0 ? (data.net ?? '') : '';
    price.value= (data.price ?? '') !== 0 ? (data.price ?? '') : '';
    origin.value = data.origin || '';
  }

  // Autocompletar datos al elegir producto
  name.addEventListener('change', ()=>{
    const p=findProducto(name.value.trim());
    if(p){
      if(p.mode) mode.value=p.mode;
      if(p.price!=null && !price.value) price.value=p.price;
      if(p.origin && !origin.value) origin.value=p.origin;

      // si no hay precio base, usar historial
      const lp=lastPrice(p.name);
      if(lp!=null && !price.value) price.value=lp;
    }
    recalcLine();
  });

  [mode, qty, gross, tare, price].forEach(inp=>inp.addEventListener('input', recalcLine));

  tr.querySelector('.del').addEventListener('click', ()=>{
    tr.remove();
    recalc();
  });

  function recalcLine(){
    const m=(mode.value||'').toLowerCase();

    const q = Math.max(0, Math.floor(parseNum(qty.value||0)));
    const g = Math.max(0, parseNum(gross.value||0));
    const t = Math.max(0, parseNum(tare.value||0));
    const pr= Math.max(0, parseNum(price.value||0));

    let n=0;

    // Neto calculado
    if(g>0 || t>0){
      n=Math.max(0, g-t);
    }else{
      if(m==='caja'){
        const p=findProducto(name.value.trim());
        const kg = p?.boxkg || 0;
        n = q * kg;
      }else if(m==='kg'){
        n = q;
      }else if(m==='unidad'){
        n = q;
      }
    }

    net.value = n ? n.toFixed(2) : '';

    // Importe
    const amt = (m==='unidad') ? (q*pr) : (n*pr);
    amount.value = (amt>0) ? amt.toFixed(2) : '';

    recalc();
  }

  // recalcular al crear
  if(!data) recalc();
}

/* ---------- Capturar líneas ---------- */
function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const name  = r.querySelector('.name').value.trim();
    const mode  = r.querySelector('.mode').value.trim().toLowerCase();
    const qty   = Math.max(0, Math.floor(parseNum(r.querySelector('.qty').value||0)));
    const gross = Math.max(0, parseNum(r.querySelector('.gross').value||0));
    const tare  = Math.max(0, parseNum(r.querySelector('.tare').value||0));
    const net   = Math.max(0, parseNum(r.querySelector('.net').value||0));
    const price = Math.max(0, parseNum(r.querySelector('.price').value||0));
    const origin= r.querySelector('.origin').value.trim();

    return {name,mode,qty,gross,tare,net,price,origin};
  }).filter(l => l.name && (l.qty>0 || l.net>0 || l.gross>0));
}

function lineImporte(l){
  return (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
}

/* =========================
   PAGOS PARCIALES (FACTURA ACTUAL)
========================= */
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
  const amt=parseNum($('#inpPagoParcial').value||0);
  if(!(amt>0)) return;
  pagosTemp.unshift({date: nowISO(), amount: amt});
  $('#inpPagoParcial').value='';
  renderPagosTemp();
  recalc();
});

/* =========================
   RECÁLCULO (IVA SIEMPRE)
========================= */
function calcTotals(lines){
  // subtotal de líneas
  let subtotal=0;
  lines.forEach(l=> subtotal+=lineImporte(l));

  // transporte opcional
  const transporte = $('#chkTransporte')?.checked ? (subtotal*0.10) : 0;

  // IVA SIEMPRE
  const base = subtotal + transporte;
  const iva = base * 0.04;
  const total = base + iva;

  return {subtotal, transporte, iva, total};
}

function recalc(){
  const lines=captureLineas();
  const totals=calcTotals(lines);

  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, totals.total - pagadoTotal);

  $('#subtotal').textContent = money(totals.subtotal);
  $('#transp').textContent   = money(totals.transporte);
  $('#iva').textContent      = money(totals.iva);
  $('#total').textContent    = money(totals.total);
  $('#pendiente').textContent= money(pendiente);

  // estado auto (pero si estás editando, permite)
  const estadoSel = $('#estado');
  if(estadoSel){
    if(totals.total<=0) estadoSel.value='pendiente';
    else if(pagadoTotal<=0) estadoSel.value='pendiente';
    else if(pagadoTotal<totals.total) estadoSel.value='parcial';
    else estadoSel.value='pagado';
  }

  // pie PDF
  const foot=$('#pdf-foot-note');
  if(foot){
    foot.textContent = 'IVA (4%) incluido y sumado al total. Transporte 10% opcional.';
  }

  // refrescar vista PDF en tiempo real
  fillPrint(lines, totals, null, null);

  drawResumen();
}

['chkTransporte','estado','pagado'].forEach(id=>{
  $('#'+id)?.addEventListener('input', recalc);
});

/* =========================
   PRINT / PDF RELLENO + QR
========================= */
function fillPrint(lines, totals, _temp=null, f=null){
  $('#p-num').textContent = f?.numero || (editMode.active ? '(EDITANDO...)' : '(Sin guardar)');
  $('#p-fecha').textContent = (f?.fecha ? new Date(f.fecha) : new Date()).toLocaleString();

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

  const tbody = $('#p-tabla tbody');
  if(tbody){
    tbody.innerHTML='';
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
        <td>${money(lineImporte(l))}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  $('#p-sub').textContent = money(totals?.subtotal||0);
  $('#p-tra').textContent = money(totals?.transporte||0);
  $('#p-iva').textContent = money(totals?.iva||0);
  $('#p-tot').textContent = money(totals?.total||0);

  $('#p-estado').textContent = f?.estado || $('#estado')?.value || 'pendiente';
  $('#p-metodo').textContent = f?.metodo || $('#metodoPago')?.value || 'Efectivo';
  $('#p-obs').textContent = f?.obs || ($('#observaciones')?.value||'—');

  // QR básico
  try{
    const canvas = $('#p-qr');
    if(canvas && window.QRCode){
      const numero = f?.numero || (editMode.active ? 'EDIT' : 'TEMP');
      const cliente = f?.cliente?.nombre || $('#cliNombre').value || '';
      const payload = `ARSLAN-Factura|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado').textContent}`;
      window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
    }
  }catch(e){}
}

/* =========================
   NUM FACTURA + FACTURAS SAVE
========================= */
function genNumFactura(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function saveFacturas(){
  save(K_FACTURAS, facturas);
}

/* =========================
   MODO EDICIÓN (Badge)
========================= */
function setEditBadge(active, numero){
  // crea badge encima del panel factura
  const panel = document.querySelector('section.panel[data-tab-panel="factura"]');
  if(!panel) return;

  let badge = panel.querySelector('#editBadge');
  if(!badge){
    badge = document.createElement('div');
    badge.id = "editBadge";
    badge.className = "edit-badge";
    badge.style.display = "none";
    badge.innerHTML = `
      <div>✏️ EDITANDO FACTURA: <strong id="editBadgeNum">—</strong></div>
      <div class="row">
        <button id="btnGuardarEdicion" class="small">💾 Guardar cambios</button>
        <button id="btnCancelarEdicion" class="ghost small">Cancelar</button>
        <button id="btnCambiarFecha" class="ghost small">📅 Cambiar fecha</button>
      </div>
    `;
    panel.insertBefore(badge, panel.firstChild);
  }

  badge.style.display = active ? "flex" : "none";
  badge.querySelector('#editBadgeNum').textContent = numero || "—";

  // bind botones una sola vez
  if(!badge.dataset.bound){
    badge.dataset.bound = "1";

    badge.querySelector('#btnGuardarEdicion').addEventListener('click', ()=>{
      saveEdicionFacturaActual();
    });

    badge.querySelector('#btnCancelarEdicion').addEventListener('click', ()=>{
      if(confirm("¿Cancelar edición? Se perderán cambios NO guardados.")){
        cancelEditMode();
      }
    });

    badge.querySelector('#btnCambiarFecha').addEventListener('click', ()=>{
      if(!editMode.active) return;
      const f = facturas.find(x=>x.id===editMode.invoiceId);
      if(!f) return;
      const nueva = prompt("Nueva fecha ISO (ej: 2026-01-26T10:30:00.000Z)\n\nSi quieres fácil: escribe 'HOY'");
      if(!nueva) return;

      if(String(nueva).trim().toUpperCase()==='HOY'){
        f.fecha = nowISO();
      }else{
        // valida fecha
        const test = new Date(nueva);
        if(isNaN(test.getTime())){
          alert("Fecha inválida. Usa formato ISO o escribe HOY.");
          return;
        }
        f.fecha = test.toISOString();
      }

      saveFacturas();
      renderFacturas();
      renderPendientes();
      drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();

      // refrescar pdf
      fillPrint(f.lineas, f.totals, null, f);
      alert("✅ Fecha cambiada y guardada.");
    });
  }
}

/* =========================
   GUARDAR (NUEVA) O GUARDAR (EDITADA)
========================= */
function buildFacturaObject(existing=null){
  const ls = captureLineas();
  const totals = calcTotals(ls);

  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, totals.total - pagadoTotal);

  const estado = (pagadoTotal<=0) ? 'pendiente' : (pagadoTotal<totals.total ? 'parcial' : 'pagado');

  const base = {
    id: existing?.id || uid(),
    numero: existing?.numero || genNumFactura(),
    fecha: existing?.fecha || nowISO(),

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

    lineas: ls,

    transporte: $('#chkTransporte').checked,
    ivaIncluido: true, // SIEMPRE

    estado: estado,
    metodo: $('#metodoPago').value,
    obs: $('#observaciones').value,

    totals:{
      subtotal: totals.subtotal,
      transporte: totals.transporte,
      iva: totals.iva,
      total: totals.total,
      pagado: pagadoTotal,
      pendiente: pendiente
    },

    pagos: [...pagosTemp]
  };

  return base;
}

/* Guardar NUEVA */
$('#btnGuardar')?.addEventListener('click', ()=>{
  // Si está editando, NO guardar como nueva
  if(editMode.active){
    alert("Estás en modo edición. Usa: ✅ Guardar cambios.");
    return;
  }

  const ls=captureLineas();
  if(ls.length===0){
    alert("Añade al menos una línea.");
    return;
  }

  // guarda historial de precios
  ls.forEach(l=> pushPriceHistory(l.name, l.price));

  const f = buildFacturaObject(null);

  facturas.unshift(f);
  saveFacturas();

  pagosTemp = [];
  renderPagosTemp();

  alert(`✅ Factura guardada: ${f.numero}`);

  renderFacturas();
  renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();

  fillPrint(f.lineas, f.totals, null, f);
});

/* Guardar CAMBIOS en factura editada */
function saveEdicionFacturaActual(){
  if(!editMode.active) return;

  const idx = facturas.findIndex(x=>x.id===editMode.invoiceId);
  if(idx<0){
    alert("No se encontró la factura para editar.");
    cancelEditMode();
    return;
  }

  const old = facturas[idx];

  // guarda historial de precios (por si cambiaste precios)
  const ls=captureLineas();
  ls.forEach(l=> pushPriceHistory(l.name, l.price));

  // construye nuevo manteniendo ID/NUMERO/FECHA (salvo que se haya cambiado)
  const updated = buildFacturaObject(old);
  updated.numero = old.numero; // NO cambia número
  updated.fecha  = old.fecha;  // NO cambia fecha salvo botón de cambiar fecha

  // guarda
  facturas[idx] = updated;
  saveFacturas();

  alert(`✅ Cambios guardados en: ${updated.numero}`);

  // salir edición
  editMode.active=false;
  editMode.invoiceId=null;
  setEditBadge(false);

  pagosTemp=[];
  renderPagosTemp();

  renderFacturas();
  renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();

  fillPrint(updated.lineas, updated.totals, null, updated);
}

/* Cancelar edición */
function cancelEditMode(){
  editMode.active=false;
  editMode.invoiceId=null;
  setEditBadge(false);

  pagosTemp=[];
  renderPagosTemp();

  // vuelve a "nueva"
  clearFacturaForm();
}

/* Limpiar formulario factura */
function clearFacturaForm(){
  const tb=$('#lineasBody');
  if(tb) tb.innerHTML='';

  for(let i=0;i<5;i++) addLinea();

  $('#chkTransporte').checked=false;
  $('#pagado').value='';
  $('#metodoPago').value='Efectivo';
  $('#observaciones').value='';
  $('#estado').value='pendiente';

  $('#selCliente').value='';
  $('#cliNombre').value='';
  $('#cliNif').value='';
  $('#cliDir').value='';
  $('#cliTel').value='';
  $('#cliEmail').value='';

  pagosTemp=[];
  renderPagosTemp();

  recalc();
}

/* Nueva factura */
$('#btnNueva')?.addEventListener('click', ()=>{
  if(editMode.active){
    if(!confirm("Estás editando una factura. ¿Salir del modo edición y crear nueva?")){
      return;
    }
    cancelEditMode();
  }
  clearFacturaForm();
});

/* PDF */
$('#btnImprimir')?.addEventListener('click', ()=>{
  recalc(); // asegura totals ok

  const element = document.getElementById('printArea');
  if(!element){ alert("No se encontró zona de impresión."); return; }

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

/* Vaciar líneas */
$('#btnVaciarLineas')?.addEventListener('click', ()=>{
  if(confirm("¿Vaciar líneas?")){
    const tb=$('#lineasBody');
    if(tb) tb.innerHTML='';
    for(let i=0;i<5;i++) addLinea();
    recalc();
  }
});

/* Añadir línea */
$('#btnAddLinea')?.addEventListener('click', addLinea);

/* Abrir listado clientes */
$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));

/* =========================
   FIN PARTE 2/3
   (Sigue con: lista facturas + pendientes + ventas + export/import)
========================= */
/* =========================
   CLIENTES + PRODUCTOS + FACTURAS + PENDIENTES + VENTAS
   (SIN NUBE / SIN BACKUP-RESTORE)
========================= */

/* ---------- MODO EDICIÓN GLOBAL ---------- */
const editMode = {
  active: false,
  invoiceId: null
};

/* ---------- Ocultar botones NO deseados (backup/restore/sync supabase) ---------- */
function disableUnwantedButtons(){
  const b1 = $('#btnBackup');  if(b1){ b1.style.display='none'; }
  const b2 = $('#btnRestore'); if(b2){ b2.style.display='none'; }
  const bs = $('#btnSyncSupabase'); if(bs){ bs.style.display='none'; }
}

/* ---------- CLIENTES (CRUD) ---------- */
function saveClientes(){ save(K_CLIENTES, clientes); }

function renderClientesSelect(){
  const sel = $('#selCliente'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  arr.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.nombre||'(Sin nombre)';
    sel.appendChild(opt);
  });
}

function renderClientesLista(){
  const cont = $('#listaClientes'); if(!cont) return;
  cont.innerHTML='';

  const q = ($('#buscarCliente')?.value || '').toLowerCase();
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

  view.forEach(c=>{
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
      const c=clientes[i];

      if(b.dataset.e==='use'){
        fillClientFields(c);
        $('#selCliente').value=c.id;
        switchTab('factura');
      }

      if(b.dataset.e==='edit'){
        const nombre = prompt('Nombre', c.nombre||''); if(nombre===null) return;
        const nif    = prompt('NIF/CIF', c.nif||'');  if(nif===null) return;
        const dir    = prompt('Dirección', c.dir||'');if(dir===null) return;
        const tel    = prompt('Teléfono', c.tel||''); if(tel===null) return;
        const email  = prompt('Email', c.email||'');  if(email===null) return;

        clientes[i] = {...c, nombre, nif, dir, tel, email};
        saveClientes();
        renderClientesSelect();
        renderClientesLista();
      }

      if(b.dataset.e==='del'){
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

$('#buscarCliente')?.addEventListener('input', renderClientesLista);

$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre = prompt('Nombre del cliente:');
  if(!nombre) return;

  const nif   = prompt('NIF/CIF:') || '';
  const dir   = prompt('Dirección:') || '';
  const tel   = prompt('Teléfono:') || '';
  const email = prompt('Email:') || '';

  clientes.push({ id: uid(), nombre, nif, dir, tel, email });
  saveClientes();
  renderClientesSelect();
  renderClientesLista();
});

/* Usar cliente desde selector */
$('#selCliente')?.addEventListener('change', ()=>{
  const id = $('#selCliente').value;
  if(!id) return;
  const c = clientes.find(x=>x.id===id);
  if(!c) return;
  fillClientFields(c);
});

/* ---------- PRODUCTOS (CRUD) ---------- */
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

  view.forEach((p,idx)=>{
    const row=document.createElement('div');
    row.className='product-row';
    row.innerHTML=`
      <input value="${escapeHTML(p.name||'')}" data-f="name"/>
      <select data-f="mode">
        <option value="">—</option>
        <option value="kg"${p.mode==='kg'?' selected':''}>kg</option>
        <option value="unidad"${p.mode==='unidad'?' selected':''}>unidad</option>
        <option value="caja"${p.mode==='caja'?' selected':''}>caja</option>
      </select>
      <input type="number" step="0.01" data-f="boxkg" placeholder="Kg/caja" value="${p.boxkg??''}"/>
      <input type="number" step="0.01" data-f="price" placeholder="€ base" value="${p.price??''}"/>
      <input data-f="origin" placeholder="Origen" value="${escapeHTML(p.origin||'')}"/>
      <button data-e="save" data-i="${idx}">💾</button>
      <button class="ghost" data-e="del" data-i="${idx}">✖</button>
    `;
    cont.appendChild(row);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const i=+b.dataset.i;

    b.addEventListener('click', ()=>{
      if(b.dataset.e==='del'){
        if(confirm('¿Eliminar producto?')){
          productos.splice(i,1);
          saveProductos();
          populateProductDatalist();
          renderProductos();
        }
        return;
      }

      const row=b.closest('.product-row');
      const get=f=>row.querySelector(`[data-f="${f}"]`)?.value?.trim() || '';

      const name = get('name');
      const mode = get('mode') || null;
      const boxkgStr = get('boxkg');
      const priceStr = get('price');
      const origin = get('origin') || null;

      const boxkg = boxkgStr==='' ? null : parseNum(boxkgStr);
      const price = priceStr==='' ? null : parseNum(priceStr);

      productos[i] = {name, mode, boxkg, price, origin};
      saveProductos();
      populateProductDatalist();
      renderProductos();
    });
  });
}

$('#buscarProducto')?.addEventListener('input', renderProductos);

$('#btnAddProducto')?.addEventListener('click', ()=>{
  const name = prompt('Nombre producto:');
  if(!name) return;

  productos.unshift({ name: name.trim() });
  saveProductos();
  populateProductDatalist();
  renderProductos();
});

/* ---------- IMPORT / EXPORT (sin backup global) ---------- */
function downloadJSON(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function uploadJSON(cb){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='application/json';
  inp.onchange=e=>{
    const f=e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        cb(JSON.parse(r.result));
      }catch{
        alert('JSON inválido');
      }
    };
    r.readAsText(f);
  };
  inp.click();
}

$('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v104.json'));
$('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(!Array.isArray(arr)) return alert('Formato inválido');
  clientes = uniqueByName(arr).map(c=>({...c, id:c.id||uid()}));
  saveClientes();
  renderClientesSelect();
  renderClientesLista();
}));

$('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v104.json'));
$('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(!Array.isArray(arr)) return alert('Formato inválido');
  productos = arr;
  saveProductos();
  populateProductDatalist();
  renderProductos();
}));

$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v104.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(!Array.isArray(arr)) return alert('Formato inválido');
  facturas = arr.map(f=>({...f, id: f.id || uid()}));
  saveFacturas();
  renderFacturas();
  renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
}));

/* ---------- FACTURAS LISTA (VER / EDITAR / FECHA / COBROS) ---------- */
function badgeEstado(f){
  const tot = f.totals?.total || 0;
  const pag = f.totals?.pagado || 0;

  if(pag >= tot && tot>0) return `<span class="state-badge state-green">Pagada</span>`;
  if(pag > 0 && pag < tot) return `<span class="state-badge state-amber">Parcial</span>`;
  return `<span class="state-badge state-red">Impagada</span>`;
}

function loadFacturaToForm(f, editable=false){
  if(!f) return;

  // aplica edit badge
  editMode.active = !!editable;
  editMode.invoiceId = editable ? f.id : null;
  setEditBadge(!!editable, f.numero);

  // proveedor/cliente
  $('#provNombre').value = f.proveedor?.nombre || '';
  $('#provNif').value    = f.proveedor?.nif || '';
  $('#provDir').value    = f.proveedor?.dir || '';
  $('#provTel').value    = f.proveedor?.tel || '';
  $('#provEmail').value  = f.proveedor?.email || '';

  $('#cliNombre').value = f.cliente?.nombre || '';
  $('#cliNif').value    = f.cliente?.nif || '';
  $('#cliDir').value    = f.cliente?.dir || '';
  $('#cliTel').value    = f.cliente?.tel || '';
  $('#cliEmail').value  = f.cliente?.email || '';

  // check transporte
  $('#chkTransporte').checked = !!f.transporte;

  // método / obs
  $('#metodoPago').value = f.metodo || 'Efectivo';
  $('#observaciones').value = f.obs || '';

  // pagos
  pagosTemp = Array.isArray(f.pagos) ? [...f.pagos] : [];
  renderPagosTemp();

  // pagado manual = 0 (lo guardamos todo por pagos parciales)
  $('#pagado').value = '';

  // líneas
  const tb=$('#lineasBody');
  tb.innerHTML='';
  (f.lineas||[]).forEach(l=> addLinea(l));
  if((f.lineas||[]).length === 0){
    for(let i=0;i<5;i++) addLinea();
  }

  // recalcular y rellenar PDF
  recalc();
  fillPrint(f.lineas, calcTotals(f.lineas||[]), null, f);

  switchTab('factura');
  document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
}

function renderFacturas(){
  const cont=$('#listaFacturas'); if(!cont) return;
  cont.innerHTML='';

  const q  = ($('#buscaCliente')?.value||'').toLowerCase();
  const fe = $('#filtroEstado')?.value || 'todas';

  let arr = facturas.slice();

  if(fe!=='todas') arr = arr.filter(f=>f.estado===fe);
  if(q) arr = arr.filter(f => (f.cliente?.nombre||'').toLowerCase().includes(q) || (f.numero||'').toLowerCase().includes(q));

  if(arr.length===0){
    cont.innerHTML='<div class="item">No hay facturas.</div>';
    return;
  }

  arr.slice(0,500).forEach(f=>{
    const fecha = new Date(f.fecha).toLocaleString();
    const div=document.createElement('div');
    div.className='item';
    div.innerHTML=`
      <div>
        <strong>${escapeHTML(f.numero)}</strong> ${badgeEstado(f)}
        <div class="muted">${fecha} · ${escapeHTML(f.cliente?.nombre||'')}</div>
      </div>
      <div class="row">
        <strong>${money(f.totals?.total||0)}</strong>
        <button class="ghost" data-e="ver" data-id="${f.id}">Ver</button>
        <button class="ghost" data-e="edit" data-id="${f.id}">Editar</button>
        <button data-e="cobrar" data-id="${f.id}">💶 Cobrar</button>
        <button class="ghost" data-e="parcial" data-id="${f.id}">+ Parcial</button>
        <button class="ghost" data-e="fecha" data-id="${f.id}">📅 Fecha</button>
        <button class="ghost" data-e="pdf" data-id="${f.id}">PDF</button>
      </div>
    `;
    cont.appendChild(div);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const id=b.dataset.id;
    const f=facturas.find(x=>x.id===id);
    if(!f) return;

    b.addEventListener('click', ()=>{
      const act=b.dataset.e;

      if(act==='ver'){
        loadFacturaToForm(f, false);
      }

      if(act==='edit'){
        loadFacturaToForm(f, true);
      }

      if(act==='cobrar'){
        const tot=f.totals?.total||0;
        f.totals.pagado=tot;
        f.totals.pendiente=0;
        f.estado='pagado';
        f.pagos = Array.isArray(f.pagos)?f.pagos:[];
        f.pagos.push({date: nowISO(), amount: tot});

        saveFacturas();
        renderFacturas();
        renderPendientes();
        drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
      }

      if(act==='parcial'){
        const max = (f.totals?.total||0) - (f.totals?.pagado||0);
        const val = parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos = Array.isArray(f.pagos) ? f.pagos : [];
          f.pagos.push({date: nowISO(), amount: val});

          f.totals.pagado = (f.totals.pagado||0) + val;
          f.totals.pendiente = Math.max(0, (f.totals.total||0) - f.totals.pagado);

          f.estado = f.totals.pendiente>0 ? 'parcial' : 'pagado';

          saveFacturas();
          renderFacturas();
          renderPendientes();
          drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
      }

      if(act==='fecha'){
        const nueva = prompt("Nueva fecha ISO (ej: 2026-01-26T10:30:00.000Z)\n\nEscribe HOY para poner fecha actual:");
        if(!nueva) return;

        if(String(nueva).trim().toUpperCase()==='HOY'){
          f.fecha = nowISO();
        }else{
          const test = new Date(nueva);
          if(isNaN(test.getTime())){
            alert("Fecha inválida.");
            return;
          }
          f.fecha = test.toISOString();
        }

        saveFacturas();
        renderFacturas();
        renderPendientes();
        drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
      }

      if(act==='pdf'){
        // asegurar PDF de esa factura
        fillPrint(f.lineas, f.totals, null, f);

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

  const map=new Map();
  facturas.forEach(f=>{
    const pend = f.totals?.pendiente||0;
    if(pend<=0) return;

    const nom = f.cliente?.nombre || '(Sin cliente)';
    const cur = map.get(nom) || {count:0,total:0,lastDate:null};

    cur.count++;
    cur.total += pend;
    cur.lastDate = !cur.lastDate || new Date(f.fecha)>new Date(cur.lastDate) ? f.fecha : cur.lastDate;

    map.set(nom,cur);
  });

  const rows=[...map.entries()].sort((a,b)=>b[1].total-a[1].total);
  let global=0;

  rows.forEach(([nom,info])=>{
    global += info.total;

    // semáforo
    const color = info.total>500 ? 'state-red' : (info.total>=100 ? 'state-amber' : 'state-green');

    const tr=document.createElement('tr');
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
      $('#buscaCliente').value = nombre;
      switchTab('facturas');
      renderFacturas();
    });
  });
}

/* ---------- VENTAS (KPIs + Charts + Top + Tabla) ---------- */
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
function startOfWeek(d=new Date()){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1); }

function drawKPIs(){
  const now=new Date();
  const hoy = sumBetween(startOfDay(now), endOfDay(now));
  const semana = sumBetween(startOfWeek(now), endOfDay(now));
  const mes = sumBetween(startOfMonth(now), endOfDay(now));
  const total = facturas.reduce((a,f)=>a+(f.totals?.total||0),0);

  $('#vHoy').textContent = money(hoy);
  $('#vSemana').textContent = money(semana);
  $('#vMes').textContent = money(mes);
  $('#vTotal').textContent = money(total);

  $('#rHoy').textContent = money(hoy);
  $('#rSemana').textContent = money(semana);
  $('#rMes').textContent = money(mes);
  $('#rTotal').textContent = money(total);
}

let chart1=null, chart2=null, chartTop=null;

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
    const k=(f.fecha||'').slice(0,10);
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

  const c1=document.getElementById('chartDiario');
  const c2=document.getElementById('chartMensual');
  if(!c1 || !c2) return;

  chart1=new Chart(c1.getContext('2d'),{
    type:'bar',
    data:{
      labels:daily.map(d=>d.label),
      datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]
    },
    options:{responsive:true, plugins:{legend:{display:false}}}
  });

  chart2=new Chart(c2.getContext('2d'),{
    type:'line',
    data:{
      labels:monthly.map(d=>d.label),
      datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]
    },
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

function drawTop(){
  if(typeof Chart==='undefined') return;
  const c=document.getElementById('chartTop');
  if(!c) return;

  const map=new Map();
  facturas.forEach(f=>{
    (f.lineas||[]).forEach(l=>{
      const amt = (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
      map.set(l.name, (map.get(l.name)||0) + amt);
    });
  });

  const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=pairs.map(p=>p[0]);
  const data=pairs.map(p=>p[1]);

  if(chartTop) chartTop.destroy();

  chartTop=new Chart(c.getContext('2d'),{
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

  const byClient=new Map();

  facturas.forEach(f=>{
    const nom=f.cliente?.nombre||'(sin cliente)';
    const d=new Date(f.fecha);
    const tot=f.totals?.total||0;

    const cur=byClient.get(nom)||{hoy:0,semana:0,mes:0,total:0};

    if(d>=sDay && d<=eDay) cur.hoy += tot;
    if(d>=sWeek&& d<=eWeek) cur.semana += tot;
    if(d>=sMonth&&d<=eMonth) cur.mes += tot;
    cur.total += tot;

    byClient.set(nom,cur);
  });

  [...byClient.entries()]
    .sort((a,b)=>b[1].total-a[1].total)
    .forEach(([nom,v])=>{
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

/* Export CSV ventas */
function exportVentasCSV(){
  const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
  facturas.forEach(f=>{
    rows.push([
      f.cliente?.nombre||'',
      new Date(f.fecha).toLocaleString(),
      f.numero||'',
      (f.totals?.total||0),
      (f.totals?.pagado||0),
      (f.totals?.pendiente||0),
      f.estado||''
    ]);
  });

  const csv=rows
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

/* ---------- Reset deudas (cliente / global) ---------- */
$('#btnResetGlobal')?.addEventListener('click', ()=>{
  if(!confirm("¿Resetear pendientes GLOBAL? (NO borra facturas, solo marca como pagadas)")) return;

  facturas.forEach(f=>{
    f.totals = f.totals || {};
    f.totals.pagado = f.totals.total || 0;
    f.totals.pendiente = 0;
    f.estado='pagado';
  });

  saveFacturas();
  renderFacturas();
  renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
});

$('#btnResetCliente')?.addEventListener('click', ()=>{
  const nombre = ($('#cliNombre')?.value || '').trim();
  if(!nombre) return alert("Selecciona o escribe un cliente primero (en Factura).");

  if(!confirm(`¿Resetear pendientes solo de: ${nombre}?`)) return;

  facturas.forEach(f=>{
    if((f.cliente?.nombre||'') === nombre){
      f.totals = f.totals || {};
      f.totals.pagado = f.totals.total || 0;
      f.totals.pendiente = 0;
      f.estado='pagado';
    }
  });

  saveFacturas();
  renderFacturas();
  renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
});

/* ---------- RESUMEN ---------- */
function drawResumen(){
  drawKPIs();
}

/* ---------- Render ALL ---------- */
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

/* ---------- Inyectar CSS mínimo para edit badge (si el style no lo trae) ---------- */
(function injectEditBadgeCSS(){
  const style=document.createElement('style');
  style.textContent=`
    .edit-badge{
      display:flex;justify-content:space-between;align-items:center;gap:10px;
      border:1px solid var(--border);
      background:var(--row);
      padding:10px 12px;
      border-radius:12px;
      margin:0 0 12px 0;
      box-shadow:var(--shadow);
      flex-wrap:wrap;
    }
    .edit-badge .small{
      padding:8px 10px;
      font-size:13px;
      border-radius:10px;
    }
  `;
  document.head.appendChild(style);
})();

/* ---------- BOOT FINAL ---------- */
(function bootFinal(){
  // 1) semillas
  seedClientesIfEmpty();
  ensureClienteIds();
  seedProductsIfEmpty();

  // 2) defaults proveedor
  setProviderDefaultsIfEmpty();

  // 3) IVA siempre
  enforceIvaAlways();

  // 4) ocultar nube/backup
  disableUnwantedButtons();

  // 5) si no hay líneas, crea 5
  const tb=$('#lineasBody');
  if(tb && tb.children.length===0){
    for(let i=0;i<5;i++) addLinea();
  }

  // 6) pagos UI
  renderPagosTemp();

  // 7) render global
  renderAll();
  recalc();
})();
