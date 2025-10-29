/* =======================================================
   ARSLAN PRO V10.4 — KIWI Edition (Full)
   - Mantiene TODAS las funciones
   - Selección de clientes SIN errores (IDs estables)
   - IVA 4% opcional; si aplica, no mostrar "IVA incluido"
   - PDF pro con logo kiwi; QR robusto
   - Firebase Realtime (compat) auto-sync
   - Arranque DOMContentLoaded para evitar null refs
======================================================== */

window.addEventListener('DOMContentLoaded', () => {
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
const uid = (p='ID') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

/* ---------- KEYS ---------- */
const K_CLIENTES='arslan_v104_clientes';
const K_PRODUCTOS='arslan_v104_productos';
const K_FACTURAS='arslan_v104_facturas';
const K_PRICEHIST='arslan_v104_pricehist';
const K_TS='arslan_v104_ts';

/* ---------- ESTADO ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});
let lastTs    = load(K_TS, 0);

function load(k, fallback){ try{ const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch{ return fallback; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- FIREBASE ---------- */
const db = window.db; // puesto en index.html (expuesto en DOMContentLoaded)
const FB_PATH = "arslan_pro_v104";
let syncing=false, pullOnStart=true;

function pushFirebase(){
  if(!window.db || syncing) return;
  syncing=true;
  setSyncUI('Syncing...');
  const payload={clientes,productos,facturas,priceHist,ts:Date.now()};
  window.db.ref(FB_PATH).set(payload).then(()=>{
    syncing=false; lastTs=payload.ts; save(K_TS,lastTs); setSyncUI('Sync ✓');
  }).catch(e=>{ syncing=false; console.error('FB set error',e); setSyncUI('Error'); });
}
function setSyncUI(text){
  const dot=$('#syncDot'), t=$('#syncText');
  if(dot) dot.style.background = (text==='Error')?'#ef4444':(text.includes('Sync')?'#16a34a':'#9ca3af');
  if(t) t.textContent=text;
}
function schedulePush(){ clearTimeout(schedulePush.t); schedulePush.t=setTimeout(pushFirebase, 1200); }

if(window.db){
  window.db.ref(FB_PATH).on('value', snap=>{
    const v=snap.val(); if(!v) return;
    if(v.ts && v.ts<=lastTs) return; // ya tenemos más nuevo
    // Pull (solo al cargar o si detectas cambios externos)
    clientes=v.clientes||clientes;
    productos=v.productos||productos;
    facturas=v.facturas||facturas;
    priceHist=v.priceHist||priceHist;
    lastTs=v.ts||Date.now();
    save(K_CLIENTES,clientes); save(K_PRODUCTOS,productos); save(K_FACTURAS,facturas); save(K_PRICEHIST,priceHist); save(K_TS,lastTs);
    if(pullOnStart){ console.log('✅ Datos restaurados automáticamente desde Firebase'); pullOnStart=false; }
    renderAll(); recalc();
  });
}

/* ---------- SPLASH & TABS (sin splash, directo) ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- SEED DATA ---------- */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{ const k=(c.nombre||'').trim().toLowerCase(); if(k && !map.has(k)) map.set(k,c); });
  return [...map.values()];
}
function seedClientesIfEmpty(){
  if(clientes.length) return;
  clientes = uniqueByName([
    {id:uid('CLI'),nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid('CLI'),nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid('CLI'),nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {id:uid('CLI'),nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos'},
    {id:uid('CLI'),nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
    {id:uid('CLI'),nombre:'Hotel Cordon'},
    {id:uid('CLI'),nombre:'Romina — PREMIER'},
    {id:uid('CLI'),nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'}
  ]);
  save(K_CLIENTES, clientes);
}
const PRODUCT_NAMES = [
 "TOMATE DANIELA","PLÁTANO CANARIO PRIMERA","AGUACATE GRANEL","CILANTRO","LIMA","PATATA 10KG",
 "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PERA RINCON DEL SOTO","MELOCOTON PRIMERA",
 "TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","PUERROS","BROCOLI","JUDIA VERDE","BERENJENA",
 "PIMIENTO ITALIANO VERDE","PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA","ALCACHOFA","CALABACIN","COLIFLOR","BATAVIA","ICEBERG",
 "MANDARINA SEGUNDA","NARANJA ZUMO","PLATANO CANARIO SUELTO","FRESAS","ARANDANOS","PEREJIL","CEBOLLA NORMAL","CEBOLLA DULCE","CEBOLLA ROJA"
];
function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({id:uid('PROD'),nombre:n,modo:'',kgCaja:null,precio:null,origen:''}));
  // ejemplos con caja:
  const p = productos.find(x=>x.nombre==='PATATA 10KG'); if(p){ p.modo='caja'; p.kgCaja=10; p.origen='España'; }
  const l = productos.find(x=>x.nombre==='LIMA'); if(l){ l.modo='caja'; l.kgCaja=7; l.origen='Brasil'; }
  const c = productos.find(x=>x.nombre==='CILANTRO'); if(c){ c.modo='manojo'; }
  save(K_PRODUCTOS, productos);
}

/* ---------- PROVIDER DEFAULTS ---------- */
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
  save(K_PRICEHIST, priceHist); schedulePush();
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
function hidePanelSoon(){ clearTimeout(hidePanelSoon.t); hidePanelSoon.t=setTimeout(()=>$('#pricePanel')?.setAttribute('hidden',''), 4800); }

/* ---------- CLIENTES UI (IDs estables) ---------- */
function saveClientes(){ save(K_CLIENTES, clientes); schedulePush(); }
function renderClientesSelect(){
  const sel = $('#selCliente'); if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).forEach((c)=>{
    const opt=document.createElement('option'); opt.value=c.id; opt.textContent=c.nombre||'(Sin nombre)'; sel.appendChild(opt);
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
      const i=clientes.findIndex(x=>x.id===id); if(i<0) return;
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
        clientes[i]={...c,nombre,nif,dir,tel,email}; saveClientes(); renderClientesSelect(); renderClientesLista();
      }else{
        if(confirm('¿Eliminar cliente?')){ clientes.splice(i,1); saveClientes(); renderClientesSelect(); renderClientesLista(); }
      }
    });
  });
}
$('#buscarCliente')?.addEventListener('input', renderClientesLista);
$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre=prompt('Nombre del cliente:'); if(!nombre) return;
  const nif=prompt('NIF/CIF:')||''; const dir=prompt('Dirección:')||''; const tel=prompt('Teléfono:')||''; const email=prompt('Email:')||'';
  clientes.push({id:uid('CLI'),nombre,nif,dir,tel,email}); saveClientes(); renderClientesSelect(); renderClientesLista();
});
$('#selCliente')?.addEventListener('change', ()=>{
  const id=$('#selCliente').value; if(!id) return; const c=clientes.find(x=>x.id===id); if(!c) return;
  $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
});

/* ---------- PRODUCTOS UI ---------- */
function saveProductos(){ save(K_PRODUCTOS, productos); schedulePush(); }
function populateProductDatalist(){
  const dl=$('#productNamesList'); if(!dl) return;
  dl.innerHTML='';
  productos.forEach(p=>{ const o=document.createElement('option'); o.value=p.nombre; dl.appendChild(o); });
}
function renderProductos(){
  const cont = $('#listaProductos'); if(!cont) return;
  const q = ($('#buscarProducto')?.value||'').toLowerCase();
  const view = q ? productos.filter(p=>(p.nombre||'').toLowerCase().includes(q)) : productos;
  cont.innerHTML='';
  if(view.length===0){ cont.innerHTML='<div class="item">Sin resultados.</div>'; return; }
  view.forEach((p)=>{
    const row=document.createElement('div'); row.className='product-row';
    row.innerHTML=`
      <input value="${escapeHTML(p.nombre||'')}" data-f="nombre" />
      <select data-f="modo">
        <option value="">—</option><option value="kg"${p.modo==='kg'?' selected':''}>kg</option><option value="unidad"${p.modo==='unidad'?' selected':''}>unidad</option><option value="caja"${p.modo==='caja'?' selected':''}>caja</option><option value="manojo"${p.modo==='manojo'?' selected':''}>manojo</option>
      </select>
      <input type="number" step="0.01" data-f="kgCaja" placeholder="Kg/caja" value="${p.kgCaja??''}" />
      <input type="number" step="0.01" data-f="precio" placeholder="€ base" value="${p.precio??''}" />
      <input data-f="origen" placeholder="Origen" value="${escapeHTML(p.origen||'')}" />
      <button data-e="save" data-id="${p.id}">💾 Guardar</button>
      <button class="ghost" data-e="del" data-id="${p.id}">✖</button>
    `;
    cont.appendChild(row);
  });
  cont.querySelectorAll('button').forEach(b=>{
    const id=b.dataset.id;
    b.addEventListener('click', ()=>{
      const i=productos.findIndex(x=>x.id===id); if(i<0) return;
      if(b.dataset.e==='del'){
        if(confirm('¿Eliminar producto?')){ productos.splice(i,1); saveProductos(); populateProductDatalist(); renderProductos(); }
      }else{
        const row=b.closest('.product-row');
        const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();
        const nombre=get('nombre'); const modo=(get('modo')||null);
        const kgCajaStr=get('kgCaja'); const kgCaja=kgCajaStr===''?null:parseNum(kgCajaStr);
        const precioStr=get('precio'); const precio=precioStr===''?null:parseNum(precioStr);
        const origen=get('origen')||null;
        productos[i]={...productos[i],nombre,modo,kgCaja,precio,origen}; saveProductos(); populateProductDatalist(); renderProductos();
      }
    });
  });
}
$('#buscarProducto')?.addEventListener('input', renderProductos);
$('#btnAddProducto')?.addEventListener('click', ()=>{
  const nombre=prompt("Producto:"); if(!nombre) return;
  productos.push({id:uid('PROD'),nombre,modo:'',kgCaja:null,precio:null,origen:''});
  saveProductos(); populateProductDatalist(); renderProductos();
});

/* ---------- FACTURA: LÍNEAS ---------- */
function findProductoByName(name){ return productos.find(p=>(p.nombre||'').toLowerCase()===String(name).toLowerCase()); }
function addLinea(){
  const tb = $('#lineasBody'); if(!tb) return;
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto (↓ para ver lista)" /></td>
    <td>
      <select class="mode">
        <option value="">—</option><option value="kg">kg</option><option value="unidad">unidad</option><option value="caja">caja</option><option value="manojo">manojo</option>
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
    const p=findProductoByName(name.value.trim());
    if(p){
      if(p.modo) mode.value=p.modo;
      if(p.precio!=null) price.value=p.precio;
      if(p.origen) origin.value=p.origen;
      const lp=lastPrice(p.nombre); if(lp!=null && !p.precio) price.value=lp;
      renderPriceHistory(p.nombre);
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
    else if(m==='caja'){ const p=findProductoByName(name.value); const kg=p?.kgCaja||0; n=q*kg; }
    else if(m==='kg'){ n=q; }
    else if(m==='unidad' || m==='manojo'){ n=q; }

    net.value = n ? n.toFixed(2) : '';
    const amt = (m==='unidad' || m==='manojo') ? q*pr : n*pr;
    amount.value = amt>0 ? amt.toFixed(2) : '';
    recalc();
  }
}
function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const nombre=r.querySelector('.name').value.trim();
    const modo=r.querySelector('.mode').value.trim().toLowerCase();
    const qty=Math.max(0, Math.floor(parseNum(r.querySelector('.qty').value||0)));
    const gross=Math.max(0, parseNum(r.querySelector('.gross').value||0));
    const tare=Math.max(0, parseNum(r.querySelector('.tare').value||0));
    const net=Math.max(0, parseNum(r.querySelector('.net').value||0));
    const precio=Math.max(0, parseNum(r.querySelector('.price').value||0));
    const origen=r.querySelector('.origin').value.trim();
    return {nombre,modo,qty,gross,tare,net,precio,origen};
  }).filter(l=> l.nombre && (l.qty>0 || l.net>0 || l.gross>0) );
}
function lineImporte(l){ return (l.modo==='unidad' || l.modo==='manojo') ? l.qty*l.precio : l.net*l.precio; }

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
function recalc(){
  const ls=captureLineas();
  let subtotal=0; ls.forEach(l=> subtotal+=lineImporte(l));
  const transporte = $('#chkTransporte')?.checked ? subtotal*0.10 : 0;
  const base = subtotal + transporte;

  const ivaAplicado = $('#chkIvaAplicado')?.checked;
  const ivaIncluidoMsg = $('#chkIvaIncluido')?.checked;
  const iva = ivaAplicado ? base * 0.04 : 0;
  const total = base + iva;

  // pagado = pagosTemp + input manual
  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, total - pagadoTotal);

  $('#subtotal') && ($('#subtotal').textContent = money(subtotal));
  $('#transp') && ($('#transp').textContent = money(transporte));
  $('#iva') && ($('#iva').textContent = money(iva));
  $('#total') && ($('#total').textContent = money(total));
  $('#pendiente') && ($('#pendiente').textContent = money(pendiente));

  // estado sugerido
  if($('#estado')){
    if(total<=0){ $('#estado').value='pendiente'; }
    else if(pagadoTotal<=0){ $('#estado').value='pendiente'; }
    else if(pagadoTotal<total){ $('#estado').value='parcial'; }
    else { $('#estado').value='pagado'; }
  }

  // Pie PDF: si aplica IVA → no mensaje "incluido"; si no, depende del check "IVA incluido"
  const foot=$('#pdf-foot-note');
  if(foot){
    foot.textContent = ivaAplicado ? '' : (ivaIncluidoMsg ? 'IVA incluido en los precios.' : '');
  }

  fillPrint(ls,{subtotal,transporte,iva,total},{pagado:pagadoTotal,pendiente},{flags:{ivaAplicado,ivaIncluidoMsg}});
  drawResumen(); // KPIs rápidos
}
;['chkTransporte','chkIvaAplicado','chkIvaIncluido','estado','pagado'].forEach(id=>$('#'+id)?.addEventListener('input', recalc));

function fillPrint(lines, totals, temp=null, extra=null){
  $('#p-num') && ($('#p-num').textContent = extra?.numero || '(Sin guardar)');
  $('#p-fecha') && ($('#p-fecha').textContent = (extra?new Date(extra.fecha):new Date()).toLocaleString());

  if($('#p-prov')){
    $('#p-prov').innerHTML = `
      <div><strong>${escapeHTML(extra?.proveedor?.nombre || $('#provNombre').value || '')}</strong></div>
      <div>${escapeHTML(extra?.proveedor?.nif || $('#provNif').value || '')}</div>
      <div>${escapeHTML(extra?.proveedor?.dir || $('#provDir').value || '')}</div>
      <div>${escapeHTML(extra?.proveedor?.tel || $('#provTel').value || '')} · ${escapeHTML(extra?.proveedor?.email || $('#provEmail').value || '')}</div>
    `;
  }
  if($('#p-cli')){
    $('#p-cli').innerHTML = `
      <div><strong>${escapeHTML(extra?.cliente?.nombre || $('#cliNombre').value || '')}</strong></div>
      <div>${escapeHTML(extra?.cliente?.nif || $('#cliNif').value || '')}</div>
      <div>${escapeHTML(extra?.cliente?.dir || $('#cliDir').value || '')}</div>
      <div>${escapeHTML(extra?.cliente?.tel || $('#cliTel').value || '')} · ${escapeHTML(extra?.cliente?.email || $('#cliEmail').value || '')}</div>
    `;
  }

  const tbody = $('#p-tabla tbody'); if(tbody){ tbody.innerHTML='';
    (lines||[]).forEach(l=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(l.nombre)}</td>
        <td>${escapeHTML(l.modo||'')}</td>
        <td>${l.qty||''}</td>
        <td>${l.gross?l.gross.toFixed(2):''}</td>
        <td>${l.tare?l.tare.toFixed(2):''}</td>
        <td>${l.net?l.net.toFixed(2):''}</td>
        <td>${money(l.precio)}</td>
        <td>${escapeHTML(l.origen||'')}</td>
        <td>${money((l.modo==='unidad'||l.modo==='manojo') ? l.qty*l.precio : l.net*l.precio)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  $('#p-sub') && ($('#p-sub').textContent = money(totals?.subtotal||0));
  $('#p-tra') && ($('#p-tra').textContent = money(totals?.transporte||0));
  $('#p-iva') && ($('#p-iva').textContent = money(totals?.iva||0));
  $('#p-tot') && ($('#p-tot').textContent = money(totals?.total||0));
  $('#p-estado') && ($('#p-estado').textContent = extra?.estado || $('#estado')?.value || 'Impagada');
  $('#p-metodo') && ($('#p-metodo').textContent = extra?.metodo || $('#metodoPago')?.value || 'Efectivo');
  $('#p-obs') && ($('#p-obs').textContent = extra?.obs || ($('#observaciones')?.value||'—'));

  // QR con datos básicos (robusto)
  try{
    const canvas = document.getElementById('p-qr');
    if (canvas && window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      const numero = extra?.numero || '(Sin guardar)';
      const cliente = extra?.cliente?.nombre || $('#cliNombre').value || '';
      const payload = `ARSLAN|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado')?.textContent||''}`;
      window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
    }
  }catch(e){ console.warn('QR no generado:', e); }
}

/* ---------- GUARDAR / NUEVA / PDF ---------- */
function genNumFactura(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`; }
function saveFacturas(){ save(K_FACTURAS, facturas); schedulePush(); }

$('#btnGuardar')?.addEventListener('click', ()=>{
  const ls=captureLineas(); if(ls.length===0){ alert('Añade al menos una línea.'); return; }
  const numero=genNumFactura(); const now=todayISO();
  ls.forEach(l=> pushPriceHistory(l.nombre, l.precio));

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
    lineas:ls,
    flags:{transporte:$('#chkTransporte').checked, ivaAplicado:$('#chkIvaAplicado').checked, ivaIncluidoMsg:$('#chkIvaIncluido').checked},
    estado, metodo:$('#metodoPago').value, obs:$('#observaciones').value,
    totals:{subtotal,transporte,iva,total,pagado:pagadoTotal,pendiente},
    pagos // historial de pagos parciales
  };
  facturas.unshift(f); saveFacturas();
  pagosTemp = []; renderPagosTemp();
  alert(`Factura ${numero} guardada.`);
  renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
  fillPrint(ls,{subtotal,transporte,iva,total},null,f);
});

$('#btnNueva')?.addEventListener('click', ()=>{
  const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea();
  $('#chkTransporte').checked=false; $('#chkIvaAplicado').checked=false; $('#chkIvaIncluido').checked=true; $('#estado').value='pendiente';
  $('#pagado').value=''; $('#metodoPago').value='Efectivo'; $('#observaciones').value='';
  pagosTemp=[]; renderPagosTemp();
  recalc();
});

$('#btnImprimir')?.addEventListener('click', ()=>{
  // Asegura que el área PDF está actualizada
  const ls=captureLineas();
  const subtotal=unMoney($('#subtotal').textContent);
  const transporte=unMoney($('#transp').textContent);
  const iva=unMoney($('#iva').textContent);
  const total=unMoney($('#total').textContent);
  fillPrint(ls,{subtotal,transporte,iva,total},null,null);

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
        saveFacturas(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
      }else if(b.dataset.e==='parcial'){
        const max=(f.totals.total||0)-(f.totals.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[]; f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          saveFacturas(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
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
  $('#resGlobal') && ($('#resGlobal').textContent = money(global));

  tb.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const nombre=b.dataset.c;
      $('#buscaCliente').value=nombre;
      switchTab('facturas');
      renderFacturas();
    });
  });
}

/* ---------- VENTAS/KPIs/GRÁFICOS/TOP ---------- */
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
  $('#vHoy') && ($('#vHoy').textContent=money(hoy));
  $('#vSemana') && ($('#vSemana').textContent=money(semana));
  $('#vMes') && ($('#vMes').textContent=money(mes));
  $('#vTotal') && ($('#vTotal').textContent=money(total));

  $('#rHoy') && ($('#rHoy').textContent=money(hoy));
  $('#rSemana') && ($('#rSemana').textContent=money(semana));
  $('#rMes') && ($('#rMes').textContent=money(mes));
  $('#rTotal') && ($('#rTotal').textContent=money(total));
}

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

function destroyIfChart(c){ if(c && typeof c.destroy==='function'){ c.destroy(); } }

function drawCharts(){
  if(typeof Chart==='undefined' || !document.getElementById('chartDiario') || !document.getElementById('chartMensual')) return;
  const daily=groupDaily(7); const monthly=groupMonthly(12);
  destroyIfChart(window.chart1); destroyIfChart(window.chart2);
  const ctx1=document.getElementById('chartDiario').getContext('2d');
  const ctx2=document.getElementById('chartMensual').getContext('2d');
  if(!ctx1 || !ctx2) return;

  window.chart1=new Chart(ctx1, {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
  window.chart2=new Chart(ctx2, {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});

  drawTop();
}
function drawTop(){
  if(typeof Chart==='undefined' || !document.getElementById('chartTop')) return;
  const map=new Map(); // name -> total €
  facturas.forEach(f=>{
    (f.lineas||[]).forEach(l=>{
      const amt = (l.modo==='unidad'||l.modo==='manojo') ? l.qty*l.precio : l.net*l.precio;
      map.set(l.nombre,(map.get(l.nombre)||0)+amt);
    });
  });
  const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=pairs.map(p=>p[0]); const data=pairs.map(p=>p[1]);
  destroyIfChart(window.chartTop);
  const ctx=document.getElementById('chartTop').getContext('2d'); if(!ctx) return;
  window.chartTop=new Chart(ctx, {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data} ]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
  const payload={clientes, productos, facturas, priceHist, fecha: todayISO(), version:'ARSLAN PRO V10.4'};
  const filename=`backup-${fmtDateDMY(new Date())}.json`;
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
        renderAll(); recalc(); schedulePush();
        alert('Copia restaurada ✔️');
      }catch{ alert('JSON inválido'); }
    }; reader.readAsText(f);
  };
  inp.click();
});
$('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v104.json'));
$('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ // asignar id a los que no tengan
  arr=arr.map(c=>({id:c.id||uid('CLI'), ...c})); clientes=uniqueByName(arr); save(K_CLIENTES,clientes); renderClientesSelect(); renderClientesLista(); schedulePush(); } }));
$('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v104.json'));
$('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ productos=arr.map(p=>({id:p.id||uid('PROD'),...p})); save(K_PRODUCTOS,productos); populateProductDatalist(); renderProductos(); schedulePush(); } }));
$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v104.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ facturas=arr; save(K_FACTURAS,facturas); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen(); schedulePush(); } }));
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

/* ---------- EXTRA: RESETEO FACTORY ---------- */
document.getElementById('btnFactoryReset')?.addEventListener('click', () => {
  if (!confirm('Esto borrará clientes, productos y facturas locales. ¿Continuar?')) return;
  localStorage.removeItem(K_CLIENTES);
  localStorage.removeItem(K_PRODUCTOS);
  localStorage.removeItem(K_FACTURAS);
  localStorage.removeItem(K_PRICEHIST);
  localStorage.removeItem(K_TS);
  // Resiembra y render
  clientes = []; productos = []; facturas = []; priceHist = {}; lastTs = 0;
  seedClientesIfEmpty(); seedProductsIfEmpty();
  save(K_CLIENTES, clientes); save(K_PRODUCTOS, productos); save(K_FACTURAS, facturas); save(K_PRICEHIST, priceHist); save(K_TS, lastTs);
  renderAll(); recalc();
  alert('Datos restaurados a valores de fábrica ✔️');
});

/* ---------- EVENTOS GENERALES ---------- */
$('#btnAddLinea')?.addEventListener('click', addLinea);
$('#btnVaciarLineas')?.addEventListener('click', ()=>{ if(confirm('¿Vaciar líneas?')){ const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea(); recalc(); }});
$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));

/* ---------- RESUMEN / RENDER ---------- */
function renderAll(){
  renderClientesSelect(); renderClientesLista();
  populateProductDatalist(); renderProductos(); renderFacturas(); renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
}
function drawResumen(){ drawKPIs(); }

/* ---------- BOOT ---------- */
(function boot(){
  // Siembra inicial
  seedClientesIfEmpty();
  seedProductsIfEmpty();

  // proveedor por defecto (tus datos)
  setProviderDefaultsIfEmpty();

  // 5 líneas iniciales
  const tb=$('#lineasBody');
  if(tb && tb.children.length===0){ for(let i=0;i<5;i++) addLinea(); }

  renderPagosTemp();
  renderAll(); recalc();

  // Verificación inicial tardía
  window.addEventListener('load', ()=>setTimeout(()=>{ try{
    populateProductDatalist(); renderProductos(); renderClientesSelect(); renderClientesLista(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); recalc();
  }catch(e){ console.error('Init error',e); } }, 400));
})();
})(); // IIFE
}); // DOMContentLoaded

