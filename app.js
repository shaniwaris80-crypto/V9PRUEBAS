/* =======================================================
   ARSLAN PRO V10.6.1 — KIWI Cloud Stable
   - Base V10.4 + correcciones + Supabase Sync
   - Sin splash; logo Kiwi solo en PDF
   - 4 paletas + modo oscuro
   - Totales y estados corregidos
   - PDF A4 con QR; pagos parciales; pendientes; ventas+top
   - Export/Import JSON/CSV + Backup/Restore
======================================================= */
(function(){
"use strict";

/* ---------- SUPABASE (Cloud Sync) ---------- */
const SUPABASE_URL = 'https://ajnvkscciswbzexppkqa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqbnZrc2NjaXN3YnpleHBwa3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDQzMzIsImV4cCI6MjA3NzIyMDMzMn0.v80vhgpWa-NNTQ2GJxQhWzmUe7ErOrSNrDKI0Y0WtX8';
// Carga desde CDN (ya tienes el script de html) o UMD en window.supabase
// Fallback por si usas ESM bundler
let supabase;
try {
  supabase = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;
} catch(e){ supabase = null; }

/* ---------- HELPERS ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* ---------- KEYS (Local) ---------- */
const K_CLIENTES='arslan_v106_clientes';
const K_PRODUCTOS='arslan_v106_productos';
const K_FACTURAS='arslan_v106_facturas';
const K_PRICEHIST='arslan_v106_pricehist';
const K_LASTSYNC='arslan_v106_lastsync';

function load(k, fallback){ try{ const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch{ return fallback; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- ESTADO ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});

/* ---------- SEED CLIENTES/PRODUCTOS ---------- */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{ const k=(c.nombre||c.name||'').trim().toLowerCase(); if(k && !map.has(k)) map.set(k,c); });
  return [...map.values()];
}
function seedClientesIfEmpty(){
  if(clientes.length) return;
  clientes = uniqueByName([
    {nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda 17, Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
    {nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
    {nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
    {nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {nombre:'Romina — PREMIER', dir:'C/ Madrid 42, Burgos'},
    {nombre:'Abbas — Locutorio Gamonal', dir:'C/ Derechos Humanos 45, Burgos'},
    {nombre:'Nadeem Bhai — RIA Locutorio', dir:'C/ Vitoria 137, Burgos'},
    {nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'},
    {nombre:'Domingo'}, {nombre:'Hotel Cordon'}, {nombre:'Vaivén Hostelería'}
  ]);
  save(K_CLIENTES, clientes);
}
const PRODUCT_NAMES = [
  "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA",
  "AGUACATE GRANEL","MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA","MANDARINA HOJA","NARANJA ZUMO","TOMATE DANIELA","BROCOLI","PEPINO","ZANAHORIA","CEBOLLA NORMAL",
  "CEBOLLA DULCE","POMELO","PAPAYA","MANGO","VALVENOSTA GOLDEN","AGUACATE PRIMERA","BATAVIA","ICEBERG","APIO","PUERROS","PIMIENTO ITALIANO VERDE","PIMIENTO ROJO",
  "TOMATE RAFF","REPOLLO","LIMA","GUINDILLA","HABANERO","SETAS","CHAMPIÑON","UVA ROJA","UVA BLANCA"
];
function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({name:n}));
  save(K_PRODUCTOS, productos);
}

/* ---------- PROVIDER DEFAULTS (tus datos) ---------- */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre').value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif').value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir').value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel').value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail').value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ---------- HISTORIAL DE PRECIOS ---------- */
function lastPrice(name){ const arr = priceHist[name]; return arr?.length ? arr[0].price : null; }
function pushPriceHistory(name, price){
  if(!name || !(price>0)) return;
  const arr = priceHist[name] || [];
  arr.unshift({price, date: todayISO()});
  priceHist[name] = arr.slice(0,10);
  save(K_PRICEHIST, priceHist);
  // Cloud (best-effort)
  cloudPriceHistUpsert(name, arr.slice(0,10)).catch(()=>{});
}
function renderPriceHistory(name){
  const panel=$('#pricePanel'), body=$('#ppBody'); if(!panel||!body) return;
  panel.removeAttribute('hidden');
  const hist=priceHist[name]||[];
  if(hist.length===0){ body.innerHTML=`<div class="pp-row"><span>${escapeHTML(name)}</span><strong>Sin datos</strong></div>`; hidePanelSoon(); return; }
  body.innerHTML=`<div class="pp-row" style="justify-content:center"><strong>${escapeHTML(name)}</strong></div>` +
    hist.map(h=>`<div class="pp-row"><span>${fmtDateDMY(new Date(h.date))}</span><strong>${money(h.price)}</strong></div>`).join('');
  hidePanelSoon();
}
function hidePanelSoon(){ clearTimeout(hidePanelSoon.t); hidePanelSoon.t=setTimeout(()=>$('#pricePanel')?.setAttribute('hidden',''), 4200); }

/* ---------- UI: CLIENTES ---------- */
function saveClientes(){ save(K_CLIENTES, clientes); cloudClientesUpsert(clientes).catch(()=>{}); }
function renderClientesSelect(){
  const sel = $('#selCliente'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).forEach((c,i)=>{
    const opt=document.createElement('option'); opt.value=i; opt.textContent=c.nombre||`Cliente ${i+1}`; sel.appendChild(opt);
  });
}
function renderClientesLista(){
  const cont = $('#listaClientes'); if(!cont) return;
  cont.innerHTML='';
  const q = ($('#buscarCliente')?.value||'').toLowerCase();
  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  const view = q ? arr.filter(c=>(c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q) || (c.dir||'').toLowerCase().includes(q)) : arr;
  if(view.length===0){ cont.innerHTML='<div class="item">Sin clientes.</div>'; return; }
  view.forEach((c,idx)=>{
    const row=document.createElement('div'); row.className='item';
    row.innerHTML=`
      <div>
        <strong>${escapeHTML(c.nombre||'(Sin nombre)')}</strong>
        <div class="muted">${escapeHTML(c.nif||'')} · ${escapeHTML(c.dir||'')}</div>
      </div>
      <div class="row">
        <button class="ghost" data-e="use" data-i="${idx}">Usar</button>
        <button class="ghost" data-e="edit" data-i="${idx}">Editar</button>
        <button class="ghost" data-e="del" data-i="${idx}">Borrar</button>
      </div>
    `;
    cont.appendChild(row);
  });
  cont.querySelectorAll('button').forEach(b=>{
    const i=+b.dataset.i;
    b.addEventListener('click', ()=>{
      if(b.dataset.e==='use'){
        const c=clientes[i]; if(!c) return;
        $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
        switchTab('factura');
      }else if(b.dataset.e==='edit'){
        const c=clientes[i];
        const nombre=prompt('Nombre',c.nombre||'')??c.nombre;
        const nif=prompt('NIF',c.nif||'')??c.nif;
        const dir=prompt('Dirección',c.dir||'')??c.dir;
        const tel=prompt('Tel',c.tel||'')??c.tel;
        const email=prompt('Email',c.email||'')??c.email;
        clientes[i]={nombre,nif,dir,tel,email}; saveClientes(); renderClientesSelect(); renderClientesLista();
      }else{
        if(confirm('¿Eliminar cliente?')){ clientes.splice(i,1); saveClientes(); renderClientesSelect(); renderClientesLista(); }
      }
    });
  });
}

/* ---------- UI: PRODUCTOS ---------- */
function saveProductos(){ save(K_PRODUCTOS, productos); cloudProductosUpsert(productos).catch(()=>{}); }
function populateProductDatalist(){
  const dl=$('#productNamesList'); if(!dl) return;
  dl.innerHTML='';
  productos.forEach(p=>{ const o=document.createElement('option'); o.value=p.name; dl.appendChild(o); });
}
function renderProductos(){
  const cont = $('#listaProductos'); if(!cont) return;
  const q = ($('#buscarProducto')?.value||'').toLowerCase();
  const view = q ? productos.filter(p=>(p.name||'').toLowerCase().includes(q)) : productos;
  cont.innerHTML='';
  if(view.length===0){ cont.innerHTML='<div class="item">Sin resultados.</div>'; return; }
  view.forEach((p,idx)=>{
    const row=document.createElement('div'); row.className='product-row';
    row.innerHTML=`
      <input value="${escapeHTML(p.name||'')}" data-f="name" />
      <select data-f="mode">
        <option value="">—</option><option value="kg"${p.mode==='kg'?' selected':''}>kg</option><option value="unidad"${p.mode==='unidad'?' selected':''}>unidad</option><option value="caja"${p.mode==='caja'?' selected':''}>caja</option>
      </select>
      <input type="number" step="0.01" data-f="boxKg" placeholder="Kg/caja" value="${p.boxKg??''}" />
      <input type="number" step="0.01" data-f="price" placeholder="€ base" value="${p.price??''}" />
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
        if(confirm('¿Eliminar producto?')){ productos.splice(i,1); saveProductos(); populateProductDatalist(); renderProductos(); }
      }else{
        const row=b.closest('.product-row');
        const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();
        const name=get('name'); const mode=(get('mode')||null);
        const boxKgStr=get('boxKg'); const boxKg=boxKgStr===''?null:parseNum(boxKgStr);
        const priceStr=get('price'); const price=priceStr===''?null:parseNum(priceStr);
        const origin=get('origin')||null;
        productos[i]={name,mode,boxKg,price,origin}; saveProductos(); populateProductDatalist(); renderProductos();
      }
    });
  });
}
$('#buscarProducto')?.addEventListener('input', renderProductos);

/* ---------- FACTURA: LÍNEAS ---------- */
function findProducto(name){ return productos.find(p=>(p.name||'').toLowerCase()===String(name).toLowerCase()); }
function addLinea(){
  const tb = $('#lineasBody'); if(!tb) return;
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto (↓ para ver lista)" /></td>
    <td>
      <select class="mode">
        <option value="">—</option><option value="kg">kg</option><option value="unidad">unidad</option><option value="caja">caja</option>
      </select>
    </td>
    <td><input class="qty" type="number" step="1"  placeholder="Cant." /></td>
    <td><input class="gross" type="number" step="0.01" placeholder="Bruto" /></td>
    <td><input class="tare"  type="number" step="0.01" placeholder="Tara" /></td>
    <td><input class="net"   type="number" step="0.01" placeholder="Neto" disabled /></td>
    <td><input class="price" type="number" step="0.01" placeholder="Precio" /></td>
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

  const showHist=()=>{ const n=name.value.trim(); if(n) renderPriceHistory(n); };
  name.addEventListener('focus', showHist);
  price.addEventListener('focus', showHist);

  name.addEventListener('change', ()=>{
    const p=findProducto(name.value.trim());
    if(p){
      if(p.mode) mode.value=p.mode;
      if(p.price!=null) price.value=p.price;
      if(p.origin) origin.value=p.origin;
      const lp=lastPrice(p.name); if(lp!=null && !p.price) price.value=lp;
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

    if(g>0 || t>0){ n=Math.max(0,g-t); }
    else if(m==='caja'){ const p=findProducto(name.value); const kg=p?.boxKg||0; n=q*kg; }
    else if(m==='kg'){ n=q; }
    else if(m==='unidad'){ n=q; }

    net.value = n ? n.toFixed(2) : '';
    const amt = (m==='unidad') ? q*pr : n*pr;
    amount.value = amt>0 ? amt.toFixed(2) : '';
    recalc();
  }
}
function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const name=r.querySelector('.name').value.trim();
    const mode=r.querySelector('.mode').value.trim().toLowerCase();
    const qty=Math.max(0, Math.floor(parseNum(r.querySelector('.qty').value||0)));
    const gross=Math.max(0, parseNum(r.querySelector('.gross').value||0));
    const tare=Math.max(0, parseNum(r.querySelector('.tare').value||0));
    const net=Math.max(0, parseNum(r.querySelector('.net').value||0));
    const price=Math.max(0, parseNum(r.querySelector('.price').value||0));
    const origin=r.querySelector('.origin').value.trim();
    return {name,mode,qty,gross,tare,net,price,origin};
  }).filter(l=> l.name && (l.qty>0 || l.net>0 || l.gross>0) );
}
function lineImporte(l){ return (l.mode==='unidad') ? l.qty*l.price : l.net*l.price; }

/* ---------- PAGOS PARCIALES ---------- */
let pagosTemp = []; // {date, amount}
function renderPagosTemp(){
  const list=$('#listaPagos'); if(!list) return;
  list.innerHTML='';
  if(pagosTemp.length===0){ list.innerHTML='<div class="item">Sin pagos parciales.</div>'; return; }
  pagosTemp.forEach((p,i)=>{
    const div=document.createElement('div'); div.className='item';
    div.innerHTML=`<div>${fmtDateDMY(new Date(p.date))} · <strong>${money(p.amount)}</strong></div><button class="ghost" data-i="${i}">✖</button>`;
    list.appendChild(div);
  });
  list.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{ pagosTemp.splice(+b.dataset.i,1); renderPagosTemp(); recalc(); });
  });
}
$('#btnAddPago')?.addEventListener('click', ()=>{
  const amt=parseNum($('#inpPagoParcial').value||0); if(!(amt>0)) return;
  pagosTemp.unshift({date: todayISO(), amount: amt});
  $('#inpPagoParcial').value='';
  renderPagosTemp(); recalc();
});

/* ---------- RECÁLCULO + PDF FILL + ESTADO ---------- */
function recalc() {
  const ls = captureLineas();
  let subtotal = 0;
  ls.forEach(l => subtotal += lineImporte(l));

  // Transporte + IVA
  const transporte = $('#chkTransporte')?.checked ? subtotal * 0.10 : 0;
  const baseMasTrans = subtotal + transporte;
  const iva = baseMasTrans * 0.04; // informativo
  const total = baseMasTrans;

  // Pagos: manual + parciales
  const manual = parseNum($('#pagado')?.value || 0);
  const parcial = pagosTemp.reduce((a, b) => a + (b.amount || 0), 0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, total - pagadoTotal);

  // Mostrar totales en pantalla
  $('#subtotal').textContent = money(subtotal);
  $('#transp').textContent = money(transporte);
  $('#iva').textContent = money(iva);
  $('#total').textContent = money(total);
  $('#pendiente').textContent = money(pendiente);

  // ---------- ESTADO AUTOMÁTICO ----------
  const estadoEl = document.querySelector('#estado');
  if (estadoEl) {
    if (total <= 0) {
      estadoEl.value = 'pendiente';
    } else if (pagadoTotal <= 0) {
      estadoEl.value = 'pendiente';
    } else if (pagadoTotal < total) {
      estadoEl.value = 'parcial';
    } else {
      estadoEl.value = 'pagado';
    }
  }

  // ---------- PIE DE PDF ----------
  const foot = document.querySelector('#pdf-foot-note');
  if (foot) {
    foot.textContent = document.querySelector('#chkIvaIncluido')?.checked
      ? 'IVA incluido en los precios.'
      : 'IVA (4%) mostrado como informativo. Transporte 10% opcional.';
  }

  // Actualizar área de impresión
  fillPrint(ls, { subtotal, transporte, iva, total }, { pagado: pagadoTotal, pendiente });

  // Actualizar paneles de resumen
  drawResumen();
}

  // Pie de PDF
  const foot = document.querySelector('#pdf-foot-note');
  if (foot) {
    foot.textContent = document.querySelector('#chkIvaIncluido')?.checked
      ? 'IVA incluido en los precios.'
      : 'IVA (4%) mostrado como informativo. Transporte 10% opcional.';
  }

  fillPrint(ls,{subtotal,transporte,iva,total},null,null);
  drawResumen(); // KPIs rápidos
}
['chkTransporte','chkIvaIncluido','estado','pagado'].forEach(id => {   const el = document.getElementById(id);   if (el) el.addEventListener('input', recalc); });

function fillPrint(lines, totals, _temp=null, f=null){
  $('#p-num').textContent = f?.numero || '(Sin guardar)';
  $('#p-fecha').textContent = (f?new Date(f.fecha):new Date()).toLocaleString();

  // Encabezado PDF (tus datos + cliente)
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
    const payload = `FACTURA|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado').textContent}`;
    window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
  }catch(e){}
}

/* ---------- GUARDAR / NUEVA / PDF ---------- */
function genNumFactura(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function saveFacturasLocal(){ save(K_FACTURAS, facturas); }

$('#btnGuardar')?.addEventListener('click', async ()=>{
  const ls=captureLineas(); if(ls.length===0){ alert('Añade al menos una línea.'); return; }
  const numero=genNumFactura(); const now=todayISO();
  ls.forEach(l=> pushPriceHistory(l.name, l.price));

  const subtotal=unMoney($('#subtotal').textContent);
  const transporte=unMoney($('#transp').textContent);
  const iva=unMoney($('#iva').textContent);
  const total=unMoney($('#total').textContent);

  const manual = parseNum($('#pagado').value||0);
  const pagos = [...pagosTemp]; // copiar
  const pagadoParcial = pagos.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + pagadoParcial;
  const pendiente=Math.max(0,total-pagadoTotal);

  const estado = (pagadoTotal<=0) ? 'pendiente' : (pagadoTotal<total ? 'parcial' : 'pagado');

  const f={
    numero, fecha:now,
    proveedor:{nombre:$('#provNombre').value,nif:$('#provNif').value,dir:$('#provDir').value,tel:$('#provTel').value,email:$('#provEmail').value},
    cliente:{nombre:$('#cliNombre').value,nif:$('#cliNif').value,dir:$('#cliDir').value,tel:$('#cliTel').value,email:$('#cliEmail').value},
    lineas:ls, transporte:$('#chkTransporte').checked, ivaIncluido:$('#chkIvaIncluido').checked,
    estado, metodo:$('#metodoPago').value, obs:$('#observaciones').value,
    totals:{subtotal,transporte,iva,total,pagado:pagadoTotal,pendiente},
    pagos // historial de pagos parciales
  };

  facturas.unshift(f); saveFacturasLocal();
  pagosTemp = []; renderPagosTemp();
  alert(`Factura ${numero} guardada.`);

  // Cloud sync
  cloudFacturaInsert(f).catch(()=>{});
  renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
  fillPrint(ls,{subtotal,transporte,iva,total},null,f);
});

$('#btnNueva')?.addEventListener('click', ()=>{
  const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea();
  $('#chkTransporte').checked=false; $('#chkIvaIncluido').checked=true; $('#estado').value='pendiente';
  $('#pagado').value=''; $('#metodoPago').value='Efectivo'; $('#observaciones').value='';
  pagosTemp=[]; renderPagosTemp();
  recalc();
});

$('#btnImprimir')?.addEventListener('click', ()=>{
  const element = document.getElementById('printArea');
  const d=new Date(); const file=`Factura-${($('#cliNombre').value||'Cliente').replace(/\s+/g,'')}-${fmtDateDMY(d)}.pdf`;
  const opt = { margin:[10,10,10,10], filename:file, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
  window.html2pdf().set(opt).from(element).save();
});

/* ---------- LISTA DE FACTURAS ---------- */
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
  if(arr.length===0){ cont.innerHTML='<div class="item">No hay facturas.</div>'; return; }

  arr.slice(0,400).forEach((f,idx)=>{
    const fecha=new Date(f.fecha).toLocaleString();
    const div=document.createElement('div'); div.className='item';
    div.innerHTML=`
      <div>
        <strong>${escapeHTML(f.numero)}</strong> ${badgeEstado(f)}
        <div class="muted">${fecha} · ${escapeHTML(f.cliente?.nombre||'')}</div>
      </div>
      <div class="row">
        <strong>${money(f.totals.total)}</strong>
        <button class="ghost" data-e="ver" data-i="${idx}">Ver</button>
        <button data-e="cobrar" data-i="${idx}">💶 Cobrar</button>
        <button class="ghost" data-e="parcial" data-i="${idx}">+ Parcial</button>
        <button class="ghost" data-e="pdf" data-i="${idx}">PDF</button>
      </div>`;
    cont.appendChild(div);
  });

  cont.querySelectorAll('button').forEach(b=>{
    const i=+b.dataset.i;
    b.addEventListener('click', ()=>{
      const f=facturas[i]; if(!f) return;
      if(b.dataset.e==='ver'){
        fillPrint(f.lineas,f.totals,null,f); switchTab('factura'); document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
      }else if(b.dataset.e==='cobrar'){
        const tot=f.totals.total||0;
        f.totals.pagado=tot; f.totals.pendiente=0; f.estado='pagado';
        (f.pagos??=[]).push({date:todayISO(), amount: tot});
        saveFacturasLocal(); cloudFacturaUpsert(f).catch(()=>{});
        renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
      }else if(b.dataset.e==='parcial'){
        const max=f.totals.total-(f.totals.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[]; f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          saveFacturasLocal(); cloudFacturaUpsert(f).catch(()=>{});
          renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
      }else if(b.dataset.e==='pdf'){
        fillPrint(f.lineas,f.totals,null,f);
        const dt=new Date(f.fecha);
        const nombreCliente=(f.cliente?.nombre||'Cliente').replace(/\s+/g,'');
        const filename=`Factura-${nombreCliente}-${fmtDateDMY(dt)}.pdf`;
        const opt={ margin:[10,10,10,10], filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
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
  const map=new Map(); // cliente -> {count, total, lastDate}
  facturas.forEach(f=>{
    const pend=f.totals?.pendiente||0; if(pend<=0) return;
    const nom=f.cliente?.nombre||'(s/cliente)';
    const cur=map.get(nom)||{count:0,total:0,lastDate:null};
    cur.count++; cur.total+=pend; cur.lastDate = !cur.lastDate || new Date(f.fecha)>new Date(cur.lastDate) ? f.fecha : cur.lastDate;
    map.set(nom,cur);
  });
  let global=0;
  const rows=[...map.entries()].sort((a,b)=>b[1].total-a[1].total);
  rows.forEach(([nom,info])=>{
    global+=info.total;
    const tr=document.createElement('tr');
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
    if(d>=d1 && d<d2 && (!filterClient || (f.cliente?.nombre||'')===filterClient)) sum+=(f.totals?.total||0);
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
  const now=new Date(); const buckets=[];
  for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10); buckets.push({k,label:k.slice(5),sum:0}); }
  facturas.forEach(f=>{ const k=f.fecha.slice(0,10); const b=buckets.find(x=>x.k===k); if(b) b.sum+=(f.totals?.total||0); });
  return buckets;
}
function groupMonthly(n=12){
  const now=new Date(); const buckets=[];
  for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setMonth(d.getMonth()-i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; buckets.push({k,label:k,sum:0}); }
  facturas.forEach(f=>{ const d=new Date(f.fecha); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const b=buckets.find(x=>x.k===k); if(b) b.sum+=(f.totals?.total||0); });
  return buckets;
}
function drawCharts(){
  if(typeof Chart==='undefined') return;
  const daily=groupDaily(7); const monthly=groupMonthly(12);
  if(chart1) chart1.destroy(); if(chart2) chart2.destroy();
  chart1=new Chart(document.getElementById('chartDiario').getContext('2d'), {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
  chart2=new Chart(document.getElementById('chartMensual').getContext('2d'), {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
}
function drawTop(){
  if(typeof Chart==='undefined') return;
  const map=new Map(); // name -> total €
  facturas.forEach(f=>{
    (f.lineas||[]).forEach(l=>{
      const amt = (l.mode==='unidad') ? l.qty*l.price : l.net*l.price;
      map.set(l.name,(map.get(l.name)||0)+amt);
    });
  });
  const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=pairs.map(p=>p[0]); const data=pairs.map(p=>p[1]);
  if(chartTop) chartTop.destroy();
  chartTop=new Chart(document.getElementById('chartTop').getContext('2d'), {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data} ]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
    const d=new Date(f.fecha); const tot=f.totals?.total||0;
    const cur=byClient.get(nom)||{hoy:0,semana:0,mes:0,total:0};
    if(d>=sDay && d<=eDay) cur.hoy+=tot;
    if(d>=sWeek&&d<=eWeek) cur.semana+=tot;
    if(d>=sMonth&&d<=eMonth) cur.mes+=tot;
    cur.total+=tot;
    byClient.set(nom,cur);
  });

  [...byClient.entries()].sort((a,b)=>b[1].total-a[1].total).forEach(([nom,v])=>{
    const tr=document.createElement('tr');
    const highlight = v.hoy>0 ? 'state-green' : '';
    tr.innerHTML=`<td>${escapeHTML(nom)}</td><td class="${highlight}">${money(v.hoy)}</td><td>${money(v.semana)}</td><td>${money(v.mes)}</td><td><strong>${money(v.total)}</strong></td>`;
    tb.appendChild(tr);
  });
}

/* ---------- BACKUP/RESTORE + EXPORTS ---------- */
$('#btnBackup')?.addEventListener('click', ()=>{
  const payload={clientes, productos, facturas, priceHist, fecha: todayISO(), version:'ARSLAN PRO V10.6.1'};
  const filename=`backup-${fmtDateDMY(new Date())}.json`;
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  cloudBackupInsert(payload).catch(()=>{});
});
$('#btnRestore')?.addEventListener('click', ()=>{
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader(); reader.onload=()=>{
      try{
        const obj=JSON.parse(reader.result);
        if(obj.clientes) clientes=obj.clientes;
        if(obj.productos) productos=obj.productos;
        if(obj.facturas) facturas=obj.facturas;
        if(obj.priceHist) priceHist=obj.priceHist;
        save(K_CLIENTES,clientes); save(K_PRODUCTOS,productos); save(K_FACTURAS,facturas); save(K_PRICEHIST,priceHist);
        renderAll(); alert('Copia restaurada ✔️');
      }catch{ alert('JSON inválido'); }
    }; reader.readAsText(f);
  };
  inp.click();
});
$('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v106.json'));
$('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ clientes=uniqueByName(arr); saveClientes(); renderClientesSelect(); renderClientesLista(); } }));
$('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v106.json'));
$('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ productos=arr; saveProductos(); populateProductDatalist(); renderProductos(); } }));
$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v106.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ facturas=arr; saveFacturasLocal(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen(); } }));
$('#btnExportVentas')?.addEventListener('click', exportVentasCSV);

function downloadJSON(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function uploadJSON(cb){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ cb(JSON.parse(r.result)); }catch{ alert('JSON inválido'); } }; r.readAsText(f); };
  inp.click();
}
function exportVentasCSV(){
  const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
  facturas.forEach(f=>{
    rows.push([f.cliente?.nombre||'', new Date(f.fecha).toLocaleString(), f.numero, (f.totals?.total||0), (f.totals?.pagado||0), (f.totals?.pendiente||0), f.estado]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ventas.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ---------- EVENTOS GENERALES ---------- */
$('#btnAddLinea')?.addEventListener('click', addLinea);
$('#btnVaciarLineas')?.addEventListener('click', ()=>{ if(confirm('¿Vaciar líneas?')){ const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea(); recalc(); }});
$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));
$('#selCliente')?.addEventListener('change', ()=>{
  const i=$('#selCliente').value; if(i==='') return; const c=clientes[+i]; if(!c) return;
  $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
});
$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre=prompt('Nombre del cliente:'); if(!nombre) return;
  const nif=prompt('NIF/CIF:')||''; const dir=prompt('Dirección:')||''; const tel=prompt('Teléfono:')||''; const email=prompt('Email:')||'';
  clientes.push({nombre,nif,dir,tel,email}); saveClientes(); renderClientesSelect(); renderClientesLista();
});
$('#buscarCliente')?.addEventListener('input', renderClientesLista);

/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- RESUMEN ---------- */
function renderAll(){
  renderClientesSelect(); renderClientesLista();
  populateProductDatalist(); renderProductos(); renderFacturas(); renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
}
function drawResumen(){ drawKPIs(); }

/* ---------- CLOUD SYNC (Supabase) ---------- */
// NOTA: exige tablas con RLS activas para anonymous insert/select/update de tu proyecto.

async function cloudClientesUpsert(arr){
  if(!supabase) return;
  // Estrategia: borrado y carga total pequeña (clientes es lista chica).
  await supabase.from('clientes').delete().neq('nombre','__never__');
  if(arr?.length){
    const payload = arr.map(c=>({
      nombre: c.nombre||null, nif: c.nif||null, dir: c.dir||null, tel: c.tel||null, email: c.email||null
    }));
    await supabase.from('clientes').insert(payload);
  }
}
async function cloudProductosUpsert(arr){
  if(!supabase) return;
  await supabase.from('productos').delete().neq('name','__never__');
  if(arr?.length){
    const payload = arr.map(p=>({
      name: p.name||null, mode: p.mode||null, boxKg: p.boxKg??null, price: p.price??null, origin: p.origin||null
    }));
    await supabase.from('productos').insert(payload);
  }
}
async function cloudFacturaInsert(f){
  if(!supabase) return;
  await supabase.from('facturas').insert({
    numero: f.numero, fecha: f.fecha, proveedor: f.proveedor, cliente: f.cliente,
    lineas: f.lineas, transporte: !!f.transporte, ivaIncluido: !!f.ivaIncluido,
    estado: f.estado, metodo: f.metodo, obs: f.obs, totals: f.totals, pagos: f.pagos||[]
  });
}
async function cloudFacturaUpsert(f){
  if(!supabase) return;
  await supabase.from('facturas').upsert({
    numero: f.numero, fecha: f.fecha, proveedor: f.proveedor, cliente: f.cliente,
    lineas: f.lineas, transporte: !!f.transporte, ivaIncluido: !!f.ivaIncluido,
    estado: f.estado, metodo: f.metodo, obs: f.obs, totals: f.totals, pagos: f.pagos||[]
  }, { onConflict: 'numero' });
}
async function cloudPriceHistUpsert(name, arr){
  if(!supabase) return;
  await supabase.from('price_hist').upsert({ name, hist: arr||[] }, { onConflict: 'name' });
}
async function cloudBackupInsert(payload){
  if(!supabase) return;
  await supabase.from('backups').insert({ fecha: payload.fecha, data: payload, tag: 'manual' });
}

// Pull inicial desde cloud (si hay)
async function cloudInitialPull(){
  if(!supabase) return;
  try{
    const [{ data: cList }, { data: pList }, { data: fList }, { data: hList }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre',{ascending:true}),
      supabase.from('productos').select('*').order('name',{ascending:true}),
      supabase.from('facturas').select('*').order('fecha',{ascending:false}).limit(600),
      supabase.from('price_hist').select('*')
    ]);

    if(Array.isArray(cList) && cList.length){ clientes = cList.map(c=>({nombre:c.nombre,nif:c.nif,dir:c.dir,tel:c.tel,email:c.email})); save(K_CLIENTES, clientes); }
    if(Array.isArray(pList) && pList.length){ productos = pList.map(p=>({name:p.name,mode:p.mode,boxKg:p.boxKg,price:p.price,origin:p.origin})); save(K_PRODUCTOS, productos); }
    if(Array.isArray(fList) && fList.length){ facturas = fList.map(f=>({
      numero:f.numero,fecha:f.fecha,proveedor:f.proveedor,cliente:f.cliente,lineas:f.lineas,
      transporte:f.transporte,ivaIncluido:f.ivaIncluido,estado:f.estado,metodo:f.metodo,obs:f.obs,
      totals:f.totals,pagos:f.pagos||[]
    })); save(K_FACTURAS, facturas); }
    if(Array.isArray(hList) && hList.length){
      const obj={}; hList.forEach(h=>{ obj[h.name]=h.hist||[]; }); priceHist=obj; save(K_PRICEHIST, priceHist);
    }
    save(K_LASTSYNC, todayISO());
  }catch(e){ console.warn('Cloud pull error', e); }
}

/* ---------- PALETAS + DARK MODE (4 paletas) ---------- */
(function(){
  const PALETAS = {
    kiwi:    {bg:'#ffffff', text:'#1f2937', accent:'#22c55e', border:'#e5e7eb'},
    graphite:{bg:'#111827', text:'#f9fafb', accent:'#3b82f6', border:'#374151'},
    sand:    {bg:'#fdf6e3', text:'#3f3f46', accent:'#ca8a04', border:'#e7e5e4'},
    mint:    {bg:'#ecfdf5', text:'#064e3b', accent:'#10b981', border:'#a7f3d0'}
  };
  const bar = document.createElement('div');
  bar.id = 'colorToolbar';
  bar.innerHTML = `
    <style>
      #colorToolbar{
        position:fixed; bottom:12px; right:12px; z-index:9999;
        display:flex; gap:6px; background:rgba(255,255,255,.7);
        border:1px solid #ccc; border-radius:8px; padding:6px 10px; 
        box-shadow:0 2px 5px rgba(0,0,0,.2); backdrop-filter:blur(6px);
      }
      #colorToolbar button{
        width:28px; height:28px; border-radius:50%; border:none; cursor:pointer;
        transition:transform .2s; outline:none;
      }
      #colorToolbar button:hover{ transform:scale(1.2); }
      #colorToolbar .dark-toggle{ width:auto; padding:0 10px; font-size:13px; font-weight:600; border-radius:6px; background:#222; color:#fff; }
    </style>
  `;
  document.body.appendChild(bar);
  for(const [name,p] of Object.entries(PALETAS)){
    const b=document.createElement('button');
    b.title=name; b.style.background=p.accent;
    b.onclick=()=>aplicarTema(name);
    bar.appendChild(b);
  }
  const toggle=document.createElement('button');
  toggle.className='dark-toggle';
  toggle.textContent='🌞/🌙';
  toggle.onclick=()=>toggleDark();
  bar.appendChild(toggle);

  function aplicarTema(nombre){
    const pal=PALETAS[nombre];
    if(!pal) return;
    for(const [k,v] of Object.entries(pal)){
      document.documentElement.style.setProperty(`--${k}`, v);
    }
    localStorage.setItem('arslan_tema', nombre);
  }
  function toggleDark(){
    const isDark=document.body.classList.toggle('dark-mode');
    localStorage.setItem('arslan_dark', isDark);
    document.body.style.background=isDark?'#111':'var(--bg)';
    document.body.style.color=isDark?'#f9fafb':'var(--text)';
  }
  const guardadoTema = localStorage.getItem('arslan_tema') || 'kiwi';
  const guardadoDark = localStorage.getItem('arslan_dark') === 'true';
  aplicarTema(guardadoTema);
  if(guardadoDark) toggleDark();
})();

/* ---------- BOOT ---------- */
(async function boot(){
  // Sin splash
  // Datos base
  seedClientesIfEmpty();
  seedProductsIfEmpty();
  setProviderDefaultsIfEmpty();

  // 5 líneas iniciales
  const tb=$('#lineasBody'); if(tb && tb.children.length===0){ for(let i=0;i<5;i++) addLinea(); }

  renderPagosTemp();
  renderAll(); recalc();

  // Pull cloud inicial (best-effort)
  await cloudInitialPull();
  renderAll(); recalc();

  // Render por si recursos tardan
  window.addEventListener('load', ()=>setTimeout(()=>{ try{
    populateProductDatalist(); renderProductos(); renderClientesSelect(); renderClientesLista(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); recalc();
  }catch(e){ console.error('Init error',e); } }, 500));
})();
})();
