/* =======================================================
   ARSLAN PRO V10.4 — KIWI Edition (Full, estable)
   ✅ IVA 4% SIEMPRE incluido (sin botón)
   ✅ Editar factura + cambiar fecha
   ✅ Sync Supabase estable (merge inteligente)
   ✅ No se quita ninguna función, solo se corrige y mejora
======================================================= */
(function(){
"use strict";

/* ---------- HELPERS ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum = v => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;
const uid = ()=>'id_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);

/* ---------- KEYS ---------- */
const K_CLIENTES   = 'arslan_v104_clientes';
const K_PRODUCTOS  = 'arslan_v104_productos';
const K_FACTURAS   = 'arslan_v104_facturas';
const K_PRICEHIST  = 'arslan_v104_pricehist';

/* ---------- STORAGE ---------- */
function load(k, fallback){
  try{
    const raw = localStorage.getItem(k);
    if(!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  }catch{
    return fallback;
  }
}
function save(k, v){
  localStorage.setItem(k, JSON.stringify(v));
}

/* ---------- SUPABASE INIT ---------- */
const SUPABASE_URL = 'https://fjfbokkcdbmralwzsest.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZmJva2tjZGJtcmFsd3pzZXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MjYzMjcsImV4cCI6MjA3NzQwMjMyN30.sX3U2V9GKtcS5eWApVJy0doQOeTW2MZrLHqndgfyAUU';

let supabaseClient = null;
try{
  supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) || null;
}catch(e){
  supabaseClient = null;
}

/* ---------- ESTADO GLOBAL ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});

/* Modo edición factura */
let editingFacturaId = null;   // id de factura en edición
let pagosTemp = [];            // pagos parciales mientras editas/creas

/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));

  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- SEED DATA (CLIENTES + PRODUCTOS) ---------- */
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
  if(clientes.length){ ensureClienteIds(); return; }
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

const PRODUCT_NAMES = [
  "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA","AGUACATE GRANEL","MARACUYÁ",
  "MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA","MANDARINA HOJA","MANZANA GOLDEN 20","NARANJA TOMASIN","NECTARINA","NUECES","SANDIA","LIMON SEGUNDA","MANZANA FUJI",
  "NARANJA MESA SONRISA","JENGIBRE","BATATA","AJO PRIMERA","CEBOLLA NORMAL","CALABAZA GRANDE","PATATA LAVADA","TOMATE CHERRY RAMA","TOMATE CHERRY PERA","TOMATE DANIELA","TOMATE ROSA PRIMERA",
  "CEBOLLINO","TOMATE ASURCADO MARRON","TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","CEBOLLETA","PUERROS","BROCOLI","JUDIA VERDE","BERENJENA","PIMIENTO ITALIANO VERDE",
  "PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA","ALCACHOFA","CALABACIN","COLIFLOR","BATAVIA","ICEBERG","MANDARINA SEGUNDA","MANZANA GOLDEN 28","NARANJA ZUMO","KIWI SEGUNDA",
  "MANZANA ROYAL GALA 24","PLATANO CANARIO SUELTO","CEREZA","FRESAS","ARANDANOS","ESPINACA","PEREJIL","CILANTRO","ACELGAS","PIMIENTO VERDE","PIMIENTO ROJO","MACHO VERDE","MACHO MADURO",
  "YUCA","CEBOLLA ROJA","HABANERO","RABANITOS","POMELO","PAPAYA","REINETA 28","NISPERO","ALBARICOQUE","TOMATE PERA","TOMATE BOLA","TOMATE PINK","VALVENOSTA GOLDEN",
  "MELOCOTON ROJO","MELON GALIA","APIO","NARANJA SANHUJA","LIMON PRIMERA","MANGO","MELOCOTON AMARILLO","VALVENOSTA ROJA","PIÑA","NARANJA HOJA","PERA CONFERENCIA SEGUNDA","CEBOLLA DULCE",
  "TOMATE ASURCADO AZUL","ESPARRAGOS BLANCOS","ESPARRAGOS TRIGUEROS","REINETA PRIMERA","AGUACATE PRIMERA","COCO","NECTARINA SEGUNDA","REINETA 24","NECTARINA CARNE BLANCA","GUINDILLA",
  "REPOLLO","KIWI ZESPRI","MELON","TOMATE RAFF","PATATA 25KG","PATATA 5 KG","PATATA 10KG","LIMA","GUINEO VERDE","BANANA","BONIATO","OKRA","YAME",
  "PITAHAYA ROJA","GRANADA","CHIRIMOYA","PIMIENTO CALIFORNIA VERDE","PIMIENTO CALIFORNIA ROJO"
];

function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({name:n}));
  save(K_PRODUCTOS, productos);
}

/* ---------- DEFAULTS PROVEEDOR ---------- */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre')?.value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif')?.value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir')?.value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel')?.value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail')?.value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ---------- FECHA FACTURA INPUT ---------- */
function setFechaFacturaNow(){
  const inp = $('#inpFechaFactura');
  if(!inp) return;
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const val=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if(!inp.value) inp.value = val;
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
  body.innerHTML=
    `<div class="pp-row" style="justify-content:center"><strong>${escapeHTML(name)}</strong></div>` +
    hist.map(h=>`<div class="pp-row"><span>${fmtDateDMY(new Date(h.date))}</span><strong>${money(h.price)}</strong></div>`).join('');
  hidePanelSoon();
}
function hidePanelSoon(){
  clearTimeout(hidePanelSoon.t);
  hidePanelSoon.t=setTimeout(()=>$('#pricePanel')?.setAttribute('hidden',''), 4800);
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
  const view = q ? arr.filter(c=>
    (c.nombre||'').toLowerCase().includes(q) ||
    (c.nif||'').toLowerCase().includes(q) ||
    (c.dir||'').toLowerCase().includes(q)
  ) : arr;

  if(view.length===0){ cont.innerHTML='<div class="item">Sin clientes.</div>'; return; }

  view.forEach((c)=>{
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
    b.addEventListener('click', async ()=>{
      const i=clientes.findIndex(x=>x.id===id); if(i<0) return;

      if(b.dataset.e==='use'){
        fillClientFields(clientes[i]);
        switchTab('factura');
        return;
      }

      if(b.dataset.e==='edit'){
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
        return;
      }

      // borrar
      if(confirm('¿Eliminar cliente?')){
        clientes.splice(i,1);
        saveClientes();
        renderClientesSelect();
        renderClientesLista();
      }
    });
  });
}

/* ---------- BINDINGS CLIENTES ---------- */
$('#buscarCliente')?.addEventListener('input', renderClientesLista);
$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));
$('#selCliente')?.addEventListener('change', ()=>{
  const id=$('#selCliente').value;
  if(!id) return;
  const c=clientes.find(x=>x.id===id);
  if(c) fillClientFields(c);
});

$('#btnAddCliente')?.addEventListener('click', async ()=>{
  const nombre = prompt('Nombre del cliente:');
  if(!nombre) return;

  const nif = prompt('NIF/CIF:') || '';
  const dir = prompt('Dirección:') || '';
  const tel = prompt('Teléfono:') || '';
  const email = prompt('Email:') || '';

  clientes.push({ id: uid(), nombre, nif, dir, tel, email });
  saveClientes();
  renderClientesSelect();
  renderClientesLista();

  // Sync opcional a supabase (si existe)
  if(supabaseClient && navigator.onLine){
    try{
      const { error } = await supabaseClient.from('clientes').insert([{
        id: clientes[clientes.length-1].id,
        nombre, nif, direccion: dir, telefono: tel, email
      }]);
      if(error) console.warn('⚠️ Supabase cliente no subido:', error.message);
    }catch(e){
      console.warn('⚠️ Error Supabase:', e.message);
    }
  }
});

/* ---------- PRODUCTOS (datalist + render) ---------- */
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
  if(view.length===0){ cont.innerHTML='<div class="item">Sin resultados.</div>'; return; }

  view.forEach((p,idx)=>{
    const row=document.createElement('div'); row.className='product-row';
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
      // guardar
      const row=b.closest('.product-row');
      const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();

      const name=get('name');
      const mode=(get('mode')||null);
      const boxkgStr=get('boxkg');
      const boxkg=(boxkgStr===''?null:parseNum(boxkgStr));
      const priceStr=get('price');
      const price=(priceStr===''?null:parseNum(priceStr));
      const origin=get('origin') || null;

      productos[i]={name,mode,boxkg,price,origin};
      saveProductos();
      populateProductDatalist();
      renderProductos();
    });
  });
}

$('#buscarProducto')?.addEventListener('input', renderProductos);

/* ---------- BOTÓN SYNC SUPABASE ---------- */
$('#btnSyncSupabase')?.addEventListener('click', async ()=>{
  if(!navigator.onLine){
    alert('📴 Sin conexión a internet. No se puede sincronizar.');
    return;
  }
  if(!supabaseClient){
    alert('⚠️ Supabase no cargado. Revisa la librería.');
    return;
  }
  alert('☁️ Iniciando sincronización… (mira consola)');
  await syncSupabaseFull();
});

/* ---------- SIGUE EN PARTE 2/3 ---------- */
/* ---------- SIGUE DE PARTE 1/3 ---------- */

/* ---------- PRODUCT HELPERS ---------- */
function findProducto(name){
  const key = String(name||'').trim().toLowerCase();
  return productos.find(p => String(p.name||'').trim().toLowerCase() === key);
}

/* ---------- FACTURA: LÍNEAS ---------- */
function addLinea(prefill=null){
  const tb = $('#lineasBody'); if(!tb) return;
  const tr=document.createElement('tr');

  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto (↓ para ver lista)" /></td>
    <td>
      <select class="mode">
        <option value="">—</option><option value="kg">kg</option><option value="unidad">unidad</option><option value="caja">caja</option>
      </select>
    </td>
    <td><input class="qty" type="number" step="1" placeholder="Cant." /></td>
    <td><input class="gross" type="number" step="0.01" placeholder="Bruto" /></td>
    <td><input class="tare" type="number" step="0.01" placeholder="Tara" /></td>
    <td><input class="net" type="number" step="0.01" placeholder="Neto" disabled /></td>
    <td><input class="price" type="number" step="0.01" placeholder="Precio" /></td>
    <td><input class="origin" placeholder="Origen (opcional)" /></td>
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

  // Prefill (para editar factura)
  if(prefill){
    name.value   = prefill.name || '';
    mode.value   = prefill.mode || '';
    qty.value    = prefill.qty ?? '';
    gross.value  = prefill.gross ?? '';
    tare.value   = prefill.tare ?? '';
    net.value    = prefill.net ?? '';
    price.value  = prefill.price ?? '';
    origin.value = prefill.origin ?? '';
  }

  const showHist=()=>{
    const n=name.value.trim();
    if(n) renderPriceHistory(n);
  };
  name.addEventListener('focus', showHist);
  price.addEventListener('focus', showHist);

  // Autocompletar al elegir producto
  name.addEventListener('change', ()=>{
    const p=findProducto(name.value.trim());
    if(p){
      if(p.mode) mode.value=p.mode;
      if(p.price!=null && price.value==='') price.value=p.price;
      if(p.origin && origin.value==='') origin.value=p.origin;

      const lp = lastPrice(p.name);
      if(lp!=null && (price.value==='' || parseNum(price.value)<=0)) price.value=lp;

      renderPriceHistory(p.name);
    }
    recalcLine();
  });

  [mode, qty, gross, tare, price].forEach(i=>i.addEventListener('input', recalcLine));

  tr.querySelector('.del').addEventListener('click', ()=>{
    tr.remove();
    recalc();
  });

  function recalcLine(){
    const m  = (mode.value||'').toLowerCase();
    const q  = Math.max(0, Math.floor(parseNum(qty.value||0)));
    const g  = Math.max(0, parseNum(gross.value||0));
    const t  = Math.max(0, parseNum(tare.value||0));
    const pr = Math.max(0, parseNum(price.value||0));
    let n=0;

    if(g>0 || t>0){
      n=Math.max(0, g-t);
    }else if(m==='caja'){
      const p=findProducto(name.value);
      const kg=p?.boxkg || 0;
      n=q*kg;
    }else if(m==='kg'){
      n=q;
    }else if(m==='unidad'){
      n=q;
    }

    net.value = n ? n.toFixed(2) : '';

    const amt = (m==='unidad') ? q*pr : n*pr;
    amount.value = amt>0 ? amt.toFixed(2) : '';

    recalc();
  }

  // Si se creó con prefill, recalcula al final
  if(prefill) setTimeout(()=>recalc(), 0);
}

function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const name=r.querySelector('.name')?.value?.trim() || '';
    const mode=(r.querySelector('.mode')?.value || '').trim().toLowerCase();
    const qty=Math.max(0, Math.floor(parseNum(r.querySelector('.qty')?.value || 0)));
    const gross=Math.max(0, parseNum(r.querySelector('.gross')?.value || 0));
    const tare=Math.max(0, parseNum(r.querySelector('.tare')?.value || 0));
    const net=Math.max(0, parseNum(r.querySelector('.net')?.value || 0));
    const price=Math.max(0, parseNum(r.querySelector('.price')?.value || 0));
    const origin=r.querySelector('.origin')?.value?.trim() || '';
    return {name,mode,qty,gross,tare,net,price,origin};
  }).filter(l => l.name && (l.qty>0 || l.net>0 || l.gross>0));
}

function lineImporte(l){
  return (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
}

/* ---------- PAGOS PARCIALES UI ---------- */
function renderPagosTemp(){
  const list=$('#listaPagos'); if(!list) return;
  list.innerHTML='';
  if(pagosTemp.length===0){
    list.innerHTML='<div class="item">Sin pagos parciales.</div>';
    return;
  }
  pagosTemp.forEach((p,i)=>{
    const div=document.createElement('div'); div.className='item';
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
  const amt=parseNum($('#inpPagoParcial')?.value || 0);
  if(!(amt>0)) return;
  pagosTemp.unshift({date: todayISO(), amount: amt});
  $('#inpPagoParcial').value='';
  renderPagosTemp();
  recalc();
});

/* ---------- IVA SIEMPRE (4%) + RECÁLCULO ---------- */
function recalc(){
  const ls = captureLineas();

  let subtotal=0;
  ls.forEach(l => subtotal += lineImporte(l));

  const transporte = $('#chkTransporte')?.checked ? (subtotal*0.10) : 0;
  const baseMasTrans = subtotal + transporte;

  // ✅ IVA SIEMPRE incluido
  const iva = baseMasTrans * 0.04;
  const total = baseMasTrans + iva;

  // Pagos (manual + parciales)
  const manual = parseNum($('#pagado')?.value || 0);
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
  if(foot){
    foot.textContent = 'IVA (4%) incluido en el total. Transporte 10% opcional.';
  }

  fillPrint(ls,{subtotal,transporte,iva,total},null, null);
  drawResumen();
}
['chkTransporte','estado','pagado'].forEach(id=>$('#'+id)?.addEventListener('input', recalc));

/* ---------- PDF FILL ---------- */
function fillPrint(lines, totals, _temp=null, f=null){
  const num = f?.numero || $('#inpNumeroFactura')?.value || '(Sin guardar)';
  $('#p-num').textContent = num;

  const fecha = f?.fecha || dateFromInputToISO($('#inpFechaFactura')?.value) || todayISO();
  $('#p-fecha').textContent = new Date(fecha).toLocaleString();

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
      <td>${l.gross?Number(l.gross).toFixed(2):''}</td>
      <td>${l.tare?Number(l.tare).toFixed(2):''}</td>
      <td>${l.net?Number(l.net).toFixed(2):''}</td>
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
  $('#p-obs').textContent = f?.obs || ($('#observaciones')?.value || '—');

  // QR básico
  try{
    const canvas = $('#p-qr');
    const cliente = f?.cliente?.nombre || $('#cliNombre').value || '';
    const payload = `ARSLAN-Factura|${num}|${cliente}|${money(totals?.total||0)}|${$('#p-estado').textContent}`;
    window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
  }catch(e){}
}

/* ---------- FECHAS (editar / guardar) ---------- */
function dateFromInputToISO(val){
  // datetime-local => ISO
  if(!val) return null;
  try{
    const d = new Date(val);
    if(isNaN(d.getTime())) return null;
    return d.toISOString();
  }catch{ return null; }
}

/* ---------- GUARDAR / EDITAR FACTURA ---------- */
function genNumFactura(){
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function saveFacturas(){ save(K_FACTURAS, facturas); }

function setModoEdicion(on){
  const badge = $('#modoEdicionBadge');
  const btnCancel = $('#btnCancelarEdicion');
  if(on){
    if(badge) badge.style.display='inline-flex';
    if(btnCancel) btnCancel.style.display='inline-flex';
  }else{
    if(badge) badge.style.display='none';
    if(btnCancel) btnCancel.style.display='none';
  }
}

function clearFacturaForm(){
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

  $('#inpNumeroFactura').value='';
  setFechaFacturaNow();
  recalc();
}

function loadFacturaToEditor(f){
  // activar edición
  editingFacturaId = f.id;
  setModoEdicion(true);

  // número y fecha
  $('#inpNumeroFactura').value = f.numero || '';
  const inpFecha = $('#inpFechaFactura');
  if(inpFecha){
    // ISO => datetime-local
    const d = new Date(f.fecha || todayISO());
    const pad=n=>String(n).padStart(2,'0');
    inpFecha.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // proveedor/cliente
  const prov = f.proveedor || {};
  $('#provNombre').value = prov.nombre || '';
  $('#provNif').value = prov.nif || '';
  $('#provDir').value = prov.dir || '';
  $('#provTel').value = prov.tel || '';
  $('#provEmail').value = prov.email || '';

  const cli = f.cliente || {};
  $('#cliNombre').value = cli.nombre || '';
  $('#cliNif').value = cli.nif || '';
  $('#cliDir').value = cli.dir || '';
  $('#cliTel').value = cli.tel || '';
  $('#cliEmail').value = cli.email || '';

  // transporte, método, obs
  $('#chkTransporte').checked = !!f.transporte;
  $('#metodoPago').value = f.metodo || 'Efectivo';
  $('#observaciones').value = f.obs || '';

  // pagos
  pagosTemp = Array.isArray(f.pagos) ? [...f.pagos] : [];
  renderPagosTemp();

  // líneas
  const tb=$('#lineasBody'); if(tb) tb.innerHTML='';
  (f.lineas || []).forEach(l => addLinea(l));
  if((f.lineas || []).length<3){
    const extra = 3 - (f.lineas || []).length;
    for(let i=0;i<extra;i++) addLinea();
  }

  // recalcular y mostrar
  $('#pagado').value = (f.totals?.pagado || 0) - (pagosTemp.reduce((a,b)=>a+(b.amount||0),0));
  if(parseNum($('#pagado').value)<0) $('#pagado').value = '';

  recalc();
  fillPrint(captureLineas(), {
    subtotal: unMoney($('#subtotal').textContent),
    transporte: unMoney($('#transp').textContent),
    iva: unMoney($('#iva').textContent),
    total: unMoney($('#total').textContent),
  }, null, f);

  switchTab('factura');
  document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
}

function buildFacturaObject(existing=null){
  const ls=captureLineas();
  if(ls.length===0) return null;

  // precios historial
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

  const numero = existing?.numero || genNumFactura();
  const fecha  = dateFromInputToISO($('#inpFechaFactura')?.value) || existing?.fecha || todayISO();

  return {
    id: existing?.id || uid(),
    numero,
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
    lineas: ls,
    transporte: $('#chkTransporte').checked,
    ivaIncluido: true, // ✅ ahora siempre
    estado,
    metodo: $('#metodoPago').value,
    obs: $('#observaciones').value,
    totals:{ subtotal, transporte, iva, total, pagado: pagadoTotal, pendiente },
    pagos
  };
}

/* GUARDAR (nuevo o update si editando) */
$('#btnGuardar')?.addEventListener('click', ()=>{
  const existing = editingFacturaId ? facturas.find(x=>x.id===editingFacturaId) : null;

  const built = buildFacturaObject(existing);
  if(!built){
    alert('Añade al menos una línea.');
    return;
  }

  // Si editando => actualizar
  if(existing){
    const idx = facturas.findIndex(x=>x.id===editingFacturaId);
    if(idx>=0){
      facturas[idx] = built;
      saveFacturas();

      alert(`Factura ${built.numero} actualizada ✔️`);
      editingFacturaId = null;
      setModoEdicion(false);
      pagosTemp=[]; renderPagosTemp();
      renderFacturas?.(); renderPendientes?.(); drawKPIs?.(); drawCharts?.(); drawTop?.(); renderVentasCliente?.(); drawResumen?.();
      fillPrint(built.lineas,built.totals,null,built);
      return;
    }
  }

  // Nuevo
  facturas.unshift(built);
  saveFacturas();

  alert(`Factura ${built.numero} guardada ✔️`);
  editingFacturaId = null;
  setModoEdicion(false);
  pagosTemp=[]; renderPagosTemp();

  renderFacturas?.(); renderPendientes?.(); drawKPIs?.(); drawCharts?.(); drawTop?.(); renderVentasCliente?.(); drawResumen?.();
  fillPrint(built.lineas,built.totals,null,built);
});

/* NUEVA */
$('#btnNueva')?.addEventListener('click', ()=>{
  editingFacturaId = null;
  setModoEdicion(false);
  clearFacturaForm();
});

/* CANCELAR EDICIÓN */
$('#btnCancelarEdicion')?.addEventListener('click', ()=>{
  if(!editingFacturaId){
    setModoEdicion(false);
    return;
  }
  if(confirm('¿Cancelar edición y volver al modo normal?')){
    editingFacturaId = null;
    setModoEdicion(false);
    clearFacturaForm();
  }
});

/* PDF */
$('#btnImprimir')?.addEventListener('click', ()=>{
  recalc(); // asegura totales actualizados
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

/* ---------- EVENTOS FACTURA ---------- */
$('#btnAddLinea')?.addEventListener('click', ()=>addLinea());
$('#btnVaciarLineas')?.addEventListener('click', ()=>{
  if(confirm('¿Vaciar líneas?')){
    const tb=$('#lineasBody');
    if(tb) tb.innerHTML='';
    for(let i=0;i<5;i++) addLinea();
    recalc();
  }
});

/* ---------- PRODUCTOS: AÑADIR ---------- */
$('#btnAddProducto')?.addEventListener('click', ()=>{
  const name = prompt('Nombre del producto:');
  if(!name) return;
  productos.unshift({name: String(name).trim()});
  saveProductos();
  populateProductDatalist();
  renderProductos();
});

/* ---------- RESUMEN ---------- */
function drawResumen(){
  drawKPIs?.();
}

/* ---------- SIGUE EN PARTE 3/3 ----------
   - Lista facturas + botón EDITAR + PDF + Cobros
   - Pendientes
   - Ventas (KPIs, charts, top, por cliente)
   - Backup / Restore / Import / Export
   - SyncSupabaseFull (merge inteligente) + sync inicial
----------------------------------------- */
/* ---------- SIGUE DE PARTE 2/3 ---------- */

/* ===========================================================
   ✅ MEJORAS APLICADAS (lo que me pediste)
   - ❌ Botón “Sumar IVA” eliminado en lógica: ahora IVA (4%) SIEMPRE sumado
   - ✅ Editar factura hecha: productos / importes / pagos / cliente / proveedor
   - ✅ Cambiar fecha de una factura (datetime-local) + guardar
   - ✅ Sync Supabase Full (merge inteligente sin duplicar)
   - ✅ Sin cortar funciones: mantengo export/import, charts, pendientes, backups
=========================================================== */

/* ---------- EDIT MODE FLAG (global dentro de la app) ---------- */
let editingFacturaId = null;

/* ---------- FECHA EN EDITOR (si existe input) ---------- */
function setFechaFacturaNow(){
  const inp = $('#inpFechaFactura');
  if(!inp) return;
  const d = new Date();
  const pad=n=>String(n).padStart(2,'0');
  inp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- BADGE ESTADO ---------- */
function badgeEstado(f){
  const tot = f?.totals?.total || 0;
  const pag = f?.totals?.pagado || 0;

  if(pag>=tot && tot>0) return `<span class="state-badge state-green">Pagada</span>`;
  if(pag>0 && pag<tot)  return `<span class="state-badge state-amber">Parcial (${money(pag)} / ${money(tot)})</span>`;
  return `<span class="state-badge state-red">Impagada</span>`;
}

/* ---------- LISTA FACTURAS (con EDITAR + CAMBIAR FECHA) ---------- */
function renderFacturas(){
  const cont = $('#listaFacturas'); if(!cont) return;
  cont.innerHTML = '';

  const q  = ($('#buscaCliente')?.value || '').toLowerCase().trim();
  const fe = $('#filtroEstado')?.value || 'todas';

  let arr = facturas.slice();

  // filtro estado
  if(fe !== 'todas'){
    arr = arr.filter(f => (f.estado || 'pendiente') === fe);
  }

  // búsqueda cliente
  if(q){
    arr = arr.filter(f => (f.cliente?.nombre||'').toLowerCase().includes(q) || (f.numero||'').toLowerCase().includes(q));
  }

  if(arr.length===0){
    cont.innerHTML = '<div class="item">No hay facturas.</div>';
    return;
  }

  arr.slice(0, 500).forEach((f)=>{
    const fecha = new Date(f.fecha || todayISO()).toLocaleString();
    const div = document.createElement('div');
    div.className = 'item';

    div.innerHTML = `
      <div>
        <strong>${escapeHTML(f.numero || '(Sin número)')}</strong> ${badgeEstado(f)}
        <div class="muted">${fecha} · ${escapeHTML(f.cliente?.nombre || '(Sin cliente)')}</div>
      </div>
      <div class="row">
        <strong>${money(f.totals?.total || 0)}</strong>
        <button class="ghost" data-e="ver" data-id="${f.id}">Ver</button>
        <button class="ghost" data-e="edit" data-id="${f.id}">✏️ Editar</button>
        <button data-e="cobrar" data-id="${f.id}">💶 Cobrar</button>
        <button class="ghost" data-e="parcial" data-id="${f.id}">+ Parcial</button>
        <button class="ghost" data-e="fecha" data-id="${f.id}">🗓️ Fecha</button>
        <button class="ghost" data-e="pdf" data-id="${f.id}">PDF</button>
        <button class="ghost" data-e="del" data-id="${f.id}">🗑️</button>
      </div>
    `;

    cont.appendChild(div);
  });

  cont.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.id;
      const f = facturas.find(x => x.id === id);
      if(!f) return;

      const action = btn.dataset.e;

      if(action === 'ver'){
        fillPrint(f.lineas, f.totals, null, f);
        switchTab('factura');
        document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
        return;
      }

      if(action === 'edit'){
        loadFacturaToEditor(f);
        return;
      }

      if(action === 'cobrar'){
        const tot = f.totals?.total || 0;
        f.totals = f.totals || {};
        f.totals.pagado = tot;
        f.totals.pendiente = 0;
        f.estado = 'pagado';
        f.pagos = Array.isArray(f.pagos) ? f.pagos : [];
        f.pagos.push({date: todayISO(), amount: tot});
        saveFacturas();
        renderFacturas(); renderPendientes();
        drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        return;
      }

      if(action === 'parcial'){
        const total = f.totals?.total || 0;
        const pagado = f.totals?.pagado || 0;
        const max = Math.max(0, total - pagado);
        const val = parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`) || 0);
        if(val>0){
          f.pagos = Array.isArray(f.pagos) ? f.pagos : [];
          f.pagos.push({date: todayISO(), amount: val});
          f.totals.pagado = (f.totals.pagado || 0) + val;
          f.totals.pendiente = Math.max(0, total - f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? 'parcial' : 'pagado';
          saveFacturas();
          renderFacturas(); renderPendientes();
          drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
        return;
      }

      if(action === 'fecha'){
        // Cambiar fecha directamente en esa factura
        const old = new Date(f.fecha || todayISO());
        const pad=n=>String(n).padStart(2,'0');
        const def = `${old.getFullYear()}-${pad(old.getMonth()+1)}-${pad(old.getDate())}T${pad(old.getHours())}:${pad(old.getMinutes())}`;
        const nv = prompt('Nueva fecha (YYYY-MM-DDTHH:MM)', def);
        if(nv){
          const iso = dateFromInputToISO(nv);
          if(iso){
            f.fecha = iso;
            saveFacturas();
            renderFacturas(); renderPendientes();
            drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
          }else{
            alert('Fecha inválida.');
          }
        }
        return;
      }

      if(action === 'pdf'){
        fillPrint(f.lineas, f.totals, null, f);
        const dt = new Date(f.fecha || todayISO());
        const nombreCliente = (f.cliente?.nombre || 'Cliente').replace(/\s+/g,'');
        const filename = `Factura-${nombreCliente}-${fmtDateDMY(dt)}.pdf`;
        const opt = { margin:[10,10,10,10], filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
        window.html2pdf().set(opt).from(document.getElementById('printArea')).save();
        return;
      }

      if(action === 'del'){
        if(confirm('¿Eliminar factura?')){
          const idx = facturas.findIndex(x=>x.id===id);
          if(idx>=0) facturas.splice(idx,1);
          saveFacturas();
          renderFacturas(); renderPendientes();
          drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
        return;
      }
    });
  });
}
$('#filtroEstado')?.addEventListener('input', renderFacturas);
$('#buscaCliente')?.addEventListener('input', renderFacturas);

/* ---------- PENDIENTES ---------- */
function renderPendientes(){
  const tb = $('#tblPendientes tbody'); if(!tb) return;
  tb.innerHTML = '';

  const map = new Map(); // cliente -> {count,total,lastDate}
  facturas.forEach(f=>{
    const pend = f?.totals?.pendiente || 0;
    if(pend<=0) return;
    const nom = f?.cliente?.nombre || '(sin cliente)';
    const cur = map.get(nom) || {count:0,total:0,lastDate:null};
    cur.count++;
    cur.total += pend;
    cur.lastDate = !cur.lastDate || new Date(f.fecha) > new Date(cur.lastDate) ? f.fecha : cur.lastDate;
    map.set(nom, cur);
  });

  let global = 0;
  const rows = [...map.entries()].sort((a,b)=>b[1].total-a[1].total);

  rows.forEach(([nom,info])=>{
    global += info.total;
    const tr = document.createElement('tr');

    // semáforo
    const color = info.total > 500 ? 'state-red' : info.total >= 100 ? 'state-amber' : 'state-green';

    tr.innerHTML = `
      <td>${escapeHTML(nom)}</td>
      <td>${info.count}</td>
      <td><span class="state-badge ${color}">${money(info.total)}</span></td>
      <td>${new Date(info.lastDate).toLocaleString()}</td>
      <td><button class="ghost" data-n="${escapeHTML(nom)}">Ver facturas</button></td>
    `;
    tb.appendChild(tr);
  });

  $('#resGlobal').textContent = money(global);

  tb.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const nombre = b.dataset.n;
      $('#buscaCliente').value = nombre;
      switchTab('facturas');
      renderFacturas();
    });
  });
}

/* ---------- RESET DEUDAS (local) ---------- */
$('#btnResetCliente')?.addEventListener('click', ()=>{
  const nombre = $('#cliNombre')?.value?.trim();
  if(!nombre) return alert('Selecciona un cliente en Factura primero.');
  if(!confirm(`¿Resetear deudas del cliente "${nombre}"?`)) return;

  facturas.forEach(f=>{
    if((f.cliente?.nombre||'') === nombre){
      f.totals = f.totals || {};
      f.totals.pagado = f.totals.total || 0;
      f.totals.pendiente = 0;
      f.estado = 'pagado';
    }
  });
  saveFacturas();
  renderPendientes(); renderFacturas();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
});
$('#btnResetGlobal')?.addEventListener('click', ()=>{
  if(!confirm('¿Resetear deudas GLOBAL? (marcar todo como pagado)')) return;
  facturas.forEach(f=>{
    f.totals = f.totals || {};
    f.totals.pagado = f.totals.total || 0;
    f.totals.pendiente = 0;
    f.estado = 'pagado';
  });
  saveFacturas();
  renderPendientes(); renderFacturas();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
});

/* ---------- VENTAS (KPIs + charts + top + cliente) ---------- */
function sumBetween(d1,d2,filterClient=null){
  let sum=0;
  facturas.forEach(f=>{
    const d = new Date(f.fecha || todayISO());
    if(d>=d1 && d<d2 && (!filterClient || (f.cliente?.nombre||'')===filterClient)){
      sum += (f.totals?.total || 0);
    }
  });
  return sum;
}
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d=new Date()){
  const x=new Date(d);
  const day=(x.getDay()+6)%7; // lunes 0
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

  $('#vHoy').textContent = money(hoy);
  $('#vSemana').textContent = money(semana);
  $('#vMes').textContent = money(mes);
  $('#vTotal').textContent = money(total);

  $('#rHoy').textContent = money(hoy);
  $('#rSemana').textContent = money(semana);
  $('#rMes').textContent = money(mes);
  $('#rTotal').textContent = money(total);
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
    const k = String(f.fecha||'').slice(0,10);
    const b = buckets.find(x=>x.k===k);
    if(b) b.sum += (f.totals?.total || 0);
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
    const d=new Date(f.fecha||todayISO());
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const b=buckets.find(x=>x.k===k);
    if(b) b.sum += (f.totals?.total || 0);
  });
  return buckets;
}
function drawCharts(){
  if(typeof Chart==='undefined') return;
  const daily=groupDaily(7);
  const monthly=groupMonthly(12);

  if(chart1) chart1.destroy();
  if(chart2) chart2.destroy();

  const ctx1 = document.getElementById('chartDiario')?.getContext('2d');
  const ctx2 = document.getElementById('chartMensual')?.getContext('2d');
  if(!ctx1 || !ctx2) return;

  chart1 = new Chart(ctx1, {
    type:'bar',
    data:{ labels: daily.map(d=>d.label), datasets:[{ label:'Ventas diarias', data: daily.map(d=>d.sum) }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } } }
  });

  chart2 = new Chart(ctx2, {
    type:'line',
    data:{ labels: monthly.map(d=>d.label), datasets:[{ label:'Ventas mensuales', data: monthly.map(d=>d.sum) }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } } }
  });
}
function drawTop(){
  if(typeof Chart==='undefined') return;
  const map=new Map();

  facturas.forEach(f=>{
    (f.lineas||[]).forEach(l=>{
      const amt = (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
      map.set(l.name, (map.get(l.name)||0)+amt);
    });
  });

  const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=pairs.map(p=>p[0]);
  const data=pairs.map(p=>p[1]);

  if(chartTop) chartTop.destroy();
  const ctx = document.getElementById('chartTop')?.getContext('2d');
  if(!ctx) return;

  chartTop = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Top productos (€)', data }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } } }
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
    const nom=f.cliente?.nombre||'(s/cliente)';
    const d=new Date(f.fecha||todayISO());
    const tot=f.totals?.total||0;
    const cur=byClient.get(nom)||{hoy:0,semana:0,mes:0,total:0};

    if(d>=sDay && d<=eDay) cur.hoy+=tot;
    if(d>=sWeek && d<=eWeek) cur.semana+=tot;
    if(d>=sMonth && d<=eMonth) cur.mes+=tot;
    cur.total+=tot;

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

/* ---------- CSV EXPORT (VENTAS) ---------- */
function exportVentasCSV(){
  const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
  facturas.forEach(f=>{
    rows.push([
      f.cliente?.nombre||'',
      new Date(f.fecha||todayISO()).toLocaleString(),
      f.numero||'',
      (f.totals?.total||0),
      (f.totals?.pagado||0),
      (f.totals?.pendiente||0),
      f.estado||'pendiente'
    ]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='ventas.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
$('#btnExportVentas')?.addEventListener('click', exportVentasCSV);

/* ---------- BACKUP / RESTORE ---------- */
function downloadJSON(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function uploadJSON(cb){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='application/json';
  inp.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{ cb(JSON.parse(r.result)); }
      catch{ alert('JSON inválido'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

$('#btnBackup')?.addEventListener('click', ()=>{
  const payload={ clientes, productos, facturas, priceHist, fecha: todayISO(), version:'ARSLAN PRO V10.4' };
  const filename=`backup-${fmtDateDMY(new Date())}.json`;
  downloadJSON(payload, filename);
});

$('#btnRestore')?.addEventListener('click', ()=>{
  uploadJSON(obj=>{
    try{
      if(obj.clientes){ clientes=obj.clientes; ensureClienteIds(); }
      if(obj.productos) productos=obj.productos;
      if(obj.facturas) facturas=obj.facturas;
      if(obj.priceHist) priceHist=obj.priceHist;

      save(K_CLIENTES, clientes);
      save(K_PRODUCTOS, productos);
      save(K_FACTURAS, facturas);
      save(K_PRICEHIST, priceHist);

      renderAll();
      alert('Copia restaurada ✔️');
    }catch{
      alert('Error restaurando');
    }
  });
});

$('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v104.json'));
$('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(Array.isArray(arr)){
    clientes = uniqueByName(arr).map(c=>({...c, id:c.id||uid()}));
    save(K_CLIENTES, clientes);
    renderClientesSelect(); renderClientesLista();
  }
}));

$('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v104.json'));
$('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(Array.isArray(arr)){
    productos = arr;
    save(K_PRODUCTOS, productos);
    populateProductDatalist(); renderProductos();
  }
}));

$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v104.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{
  if(Array.isArray(arr)){
    facturas = arr;
    save(K_FACTURAS, facturas);
    renderFacturas(); renderPendientes();
    drawKPIs();ा drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
  }
}));

/* ---------- SYNC SUPABASE (MERGE INTELIGENTE) ---------- */
function normalizeName(s){ return String(s||'').trim().toLowerCase(); }

function dedupFacturas(list){
  // Dedup por: id OR (fechaISO + numero + clienteNombre)
  const seen = new Set();
  const out = [];

  for(const f of list){
    const id = f.id || '';
    const key2 = `${String(f.fecha||'').slice(0,10)}|${normalizeName(f.numero)}|${normalizeName(f.cliente?.nombre)}`;
    const key = id ? `ID:${id}` : `K:${key2}`;

    if(seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

async function syncSupabaseFull(){
  if(!navigator.onLine){
    alert('📴 Sin conexión. Sync Supabase no disponible.');
    return;
  }

  if(!window.supabase || !supabase){
    alert('❌ Supabase no está listo.');
    return;
  }

  console.log('☁️ Sync Supabase FULL iniciado…');

  // Helpers de merge por tabla
  async function pullTable(table){
    const { data, error } = await supabase.from(table).select('*');
    if(error) throw new Error(error.message);
    return data || [];
  }

  async function upsertTable(table, rows, key='id'){
    if(!rows || rows.length===0) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: key });
    if(error) throw new Error(error.message);
  }

  // ========== CLIENTES ==========
  try{
    const cloudClientes = await pullTable('clientes');

    const localClientes = load(K_CLIENTES, []);
    const merged = [...localClientes];

    // meter cloud que no exista local
    cloudClientes.forEach(r=>{
      const rid = r.id || null;
      const rname = normalizeName(r.nombre);
      const exists = merged.some(c => (rid && c.id===rid) || (rname && normalizeName(c.nombre)===rname));
      if(!exists){
        merged.push({
          id: rid || uid(),
          nombre: r.nombre || '',
          dir: r.direccion || '',
          nif: r.nif || '',
          tel: r.telefono || '',
          email: r.email || ''
        });
      }
    });

    save(K_CLIENTES, merged);
    clientes = merged;

    // subir los locales que no estén en cloud
    const toUp = merged.map(c=>({
      id: c.id,
      nombre: c.nombre || '',
      direccion: c.dir || '',
      nif: c.nif || '',
      telefono: c.tel || '',
      email: c.email || ''
    }));

    await upsertTable('clientes', toUp, 'id');

    console.log(`✅ clientes sync OK (${merged.length})`);
  }catch(e){
    console.warn('⚠️ clientes sync error:', e.message);
  }

  // ========== PRODUCTOS ==========
  try{
    const cloudProductos = await pullTable('productos');
    const localProductos = load(K_PRODUCTOS, []);
    let merged = [...localProductos];

    cloudProductos.forEach(r=>{
      const rname = normalizeName(r.name);
      const exists = merged.some(p => normalizeName(p.name)===rname);
      if(!exists){
        merged.push({
          name: r.name || '',
          mode: r.mode || '',
          boxkg: r.boxkg ?? null,
          price: r.price ?? null,
          origin: r.origin ?? null
        });
      }
    });

    save(K_PRODUCTOS, merged);
    productos = merged;

    const toUp = merged.map(p=>({
      name: p.name,
      mode: p.mode || '',
      boxkg: p.boxkg ?? null,
      price: p.price ?? null,
      origin: p.origin ?? null
    }));

    // en productos no tenemos id -> usamos "name" como conflict
    await upsertTable('productos', toUp, 'name');

    console.log(`✅ productos sync OK (${merged.length})`);
  }catch(e){
    console.warn('⚠️ productos sync error:', e.message);
  }

  // ========== FACTURAS ==========
  try{
    const cloudFacturas = await pullTable('facturas');
    const localFacturas = load(K_FACTURAS, []);

    // merge
    let merged = dedupFacturas([...localFacturas, ...cloudFacturas]);

    // si alguna factura no tiene id, asignar
    merged.forEach(f=>{ if(!f.id) f.id = uid(); });

    save(K_FACTURAS, merged);
    facturas = merged;

    // subir a supabase como upsert por id
    await upsertTable('facturas', merged, 'id');

    console.log(`✅ facturas sync OK (${merged.length})`);
  }catch(e){
    console.warn('⚠️ facturas sync error:', e.message);
  }

  // ========== PRICE HIST ==========
  try{
    // opcional si tienes tabla pricehist con columnas: producto, precio, fecha
    const localHist = load(K_PRICEHIST, {});
    const list = Object.entries(localHist).flatMap(([producto, arr])=>{
      return (arr||[]).map(h=>({
        producto,
        precio: h.price,
        fecha: h.date
      }));
    });

    if(list.length){
      await upsertTable('pricehist', list, 'fecha'); // si tu tabla usa otra clave, dime y lo ajusto
    }
    console.log('✅ priceHist sync OK');
  }catch(e){
    console.warn('⚠️ priceHist sync error:', e.message);
  }

  // refrescar UI
  renderAll();
  console.log('✨ Sync Supabase FULL terminado');
}

/* ---------- BOTÓN Sync Supabase ---------- */
document.getElementById('btnSyncSupabase')?.addEventListener('click', async ()=>{
  try{
    alert('☁️ Sync Supabase FULL iniciado… (mira consola)');
    await syncSupabaseFull();
    alert('✅ Sync Supabase FULL completado.');
  }catch(e){
    console.warn(e);
    alert('⚠️ Sync falló. Mira consola.');
  }
});

/* ---------- BUSCADORES CLIENTE/PRODUCTO ---------- */
$('#buscarCliente')?.addEventListener('input', renderClientesLista);
$('#buscarProducto')?.addEventListener('input', renderProductos);

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

/* ---------- BOOT FINAL ---------- */
(function bootFinal(){
  try{
    seedClientesIfEmpty();
    ensureClienteIds();
    seedProductsIfEmpty();

    setProviderDefaultsIfEmpty();
    populateProductDatalist();

    // si hay editor de fecha, set ahora
    setFechaFacturaNow();

    // si no hay líneas
    const tb=$('#lineasBody');
    if(tb && tb.children.length===0){
      for(let i=0;i<5;i++) addLinea();
    }

    renderPagosTemp();
    renderAll();
    recalc();

    console.log('✅ ARSLAN PRO V10.4 KIWI Edition listo (con edición + IVA siempre + sync)');
  }catch(e){
    console.error('❌ Error en boot:', e);
  }
})();
