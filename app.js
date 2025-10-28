/* =======================================================
   ARSLAN PRO V10.6 — CLOUD Supabase (Full Restore Mode)
   - Memoria total sincronizada (clientes, productos, facturas)
   - Restauración completa en arranque (reemplaza localStorage)
   - Backup automático diario en tabla `backups`
   - PDF profesional con logo kiwi solo en PDF
   - 4 paletas modernas + contraste corregido
   - Mismas funciones de V10.4+ con correcciones
======================================================= */
(function(){
"use strict";

/* ---------- CONFIG CLOUD ---------- */
const SUPABASE_URL = 'https://ajnvkscciswbzexppkqa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqbnZrc2NjaXN3YnpleHBwa3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDQzMzIsImV4cCI6MjA3NzIyMDMzMn0.v80vhgpWa-NNTQ2GJxQhWzmUe7ErOrSNrDKI0Y0WtX8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Tablas
const T_CLIENTES = 'clientes';
const T_PRODUCTOS = 'productos';
const T_FACTURAS = 'facturas';
const T_BACKUPS  = 'backups';

// (Opcional) bucket para PDFs (si existe y tiene permisos RLS abiertos)
const PDF_BUCKET = 'facturas-pdf';

/* ---------- HELPERS ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* ---------- KEYS (localStorage solo como cache) ---------- */
const K_CLIENTES='arslan_v106_clientes';
const K_PRODUCTOS='arslan_v106_productos';
const K_FACTURAS='arslan_v106_facturas';
const K_PRICEHIST='arslan_v106_pricehist';
const K_LAST_BACKUP='arslan_v106_last_backup_date';
const K_THEME='arslan_theme';
const K_DARK='arslan_dark';

function load(k, fallback){ try{ const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch{ return fallback; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- ESTADO ---------- */
let clientes  = [];
let productos = [];
let facturas  = [];
let priceHist = load(K_PRICEHIST, {});

let chart1=null, chart2=null, chartTop=null;
let pagosTemp = []; // {date, amount}

/* ---------- SEEDERS (para primer arranque si nube está vacía) ---------- */
function seedBaseIfNeeded(){
  if(!clientes.length){
    clientes = [
      {nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
      {nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
      {nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda 17, Bajo, 09002 Burgos', tel:'947 277 977', email:'bertiz.miranda@gmail.com'},
      {nombre:'Cuevas Palacios Restauración S.L. (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1 – 09004 Burgos', tel:'947 20 35 51'},
      {nombre:'Café Bar Nuovo (Einy Mercedes Olivo Jiménez)', nif:'120221393', dir:'C/ San Juan de Ortega 14, 09007 Burgos'},
      {nombre:'Hotel Cordon'},
      {nombre:'Domingo'},
      {nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
      {nombre:'Romina — PREMIER', dir:'C/ Madrid 42, Burgos'},
      {nombre:'Abbas — Locutorio Gamonal', dir:'C/ Derechos Humanos 45, Burgos'},
      {nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'}
    ];
  }
  if(!productos.length){
    const PRODUCT_NAMES = [
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
    productos = PRODUCT_NAMES.map(n=>({name:n}));
  }
}

/* ---------- PROVEEDOR DEFAULTS ---------- */
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

/* =======================================================
   📡 SUPABASE SYNC (Full Restore Mode)
======================================================= */
async function cloudPullAllAndReplace(){
  // CLIENTES
  let { data: C, error: eC } = await supabase.from(T_CLIENTES).select('data');
  if(eC){ console.warn('Pull clientes error', eC.message); C=[]; }
  clientes = (C||[]).map(r=>r.data||{}); // reemplazo completo
  // PRODUCTOS
  let { data: P, error: eP } = await supabase.from(T_PRODUCTOS).select('data');
  if(eP){ console.warn('Pull productos error', eP.message); P=[]; }
  productos = (P||[]).map(r=>r.data||{});
  // FACTURAS
  let { data: F, error: eF } = await supabase.from(T_FACTURAS).select('data');
  if(eF){ console.warn('Pull facturas error', eF.message); F=[]; }
  facturas = (F||[]).map(r=>r.data||{});

  // Si nube vacía, sembrar algo básico
  seedBaseIfNeeded();

  // Cache local (solo como espejo)
  save(K_CLIENTES, clientes);
  save(K_PRODUCTOS, productos);
  save(K_FACTURAS, facturas);
}

async function cloudReplaceTable(table, arrayData){
  // Borra todo y sube la versión actual (modo reemplazo total)
  await supabase.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000');
  if(arrayData.length){
    // Insertar en bloques si fuese muy grande
    const chunk = 500;
    for(let i=0;i<arrayData.length;i+=chunk){
      const slice = arrayData.slice(i, i+chunk).map(x=>({data:x}));
      const { error } = await supabase.from(table).insert(slice);
      if(error){ console.warn('Insert error on', table, error.message); break; }
    }
  }
}

async function cloudBackupDaily(){
  try{
    const last = localStorage.getItem(K_LAST_BACKUP)||'';
    const today = new Date().toISOString().slice(0,10);
    if(last===today) return; // ya hecho hoy
    const payload = {
      fecha: todayISO(),
      clientes, productos, facturas,
      version: 'ARSLAN PRO V10.6 CLOUD'
    };
    await supabase.from(T_BACKUPS).insert([{ data: payload }]);
    localStorage.setItem(K_LAST_BACKUP, today);
  }catch(e){ console.warn('Backup error', e.message); }
}

/* =======================================================
   🧱 UI DINÁMICA DE PANELES (clientes / productos / facturas / pendientes / ventas / resumen)
======================================================= */
function populateProductDatalist(){
  const dl=$('#productNamesList'); if(!dl) return;
  dl.innerHTML='';
  productos.forEach(p=>{ const o=document.createElement('option'); o.value=p.name; dl.appendChild(o); });
}

/* ---------- CLIENTES ---------- */
function renderClientesPanel(){
  const host = $('#clientesPanel'); if(!host) return;
  host.innerHTML = `
    <div class="title-row">
      <h3>Clientes</h3>
      <div class="row">
        <input id="buscarCliente" class="search" placeholder="Buscar cliente…" />
        <button id="btnAddCliente">+ Añadir</button>
        <button id="btnExportClientes" class="ghost">⤓ Exportar</button>
        <button id="btnImportClientes" class="ghost">⤒ Importar</button>
      </div>
    </div>
    <div id="listaClientes" class="list"></div>
  `;
  $('#btnAddCliente').addEventListener('click', ()=>{
    const nombre=prompt('Nombre del cliente:'); if(!nombre) return;
    const nif=prompt('NIF/CIF:')||''; const dir=prompt('Dirección:')||''; const tel=prompt('Teléfono:')||''; const email=prompt('Email:')||'';
    clientes.push({nombre,nif,dir,tel,email});
    save(K_CLIENTES, clientes);
    renderClientesSelect();
    renderClientesLista();
    cloudReplaceTable(T_CLIENTES, clientes); // sync
  });
  $('#btnExportClientes').addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v106.json'));
  $('#btnImportClientes').addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ clientes=arr; save(K_CLIENTES,clientes); renderClientesSelect(); renderClientesLista(); cloudReplaceTable(T_CLIENTES, clientes); }
  }));
  $('#buscarCliente').addEventListener('input', renderClientesLista);
  renderClientesLista();
}
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
      const c=clientes[i]; if(!c) return;
      if(b.dataset.e==='use'){
        $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
        switchTab('factura');
      }else if(b.dataset.e==='edit'){
        const nombre=prompt('Nombre',c.nombre||'')??c.nombre;
        const nif=prompt('NIF',c.nif||'')??c.nif;
        const dir=prompt('Dirección',c.dir||'')??c.dir;
        const tel=prompt('Tel',c.tel||'')??c.tel;
        const email=prompt('Email',c.email||'')??c.email;
        clientes[i]={nombre,nif,dir,tel,email};
        save(K_CLIENTES, clientes);
        renderClientesSelect(); renderClientesLista();
        cloudReplaceTable(T_CLIENTES, clientes);
      }else if(b.dataset.e==='del'){
        if(confirm('¿Eliminar cliente?')){
          clientes.splice(i,1);
          save(K_CLIENTES, clientes);
          renderClientesSelect(); renderClientesLista();
          cloudReplaceTable(T_CLIENTES, clientes);
        }
      }
    });
  });
}
$('#selCliente')?.addEventListener('change', ()=>{
  const i=$('#selCliente').value; if(i==='') return; const c=clientes[+i]; if(!c) return;
  $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
});

/* ---------- PRODUCTOS ---------- */
function renderProductosPanel(){
  const host = $('#productosPanel'); if(!host) return;
  host.innerHTML = `
    <div class="title-row">
      <h3>Productos</h3>
      <div class="row">
        <input id="buscarProducto" class="search" placeholder="Buscar producto…" />
        <button id="btnExportProductos" class="ghost">⤓ Exportar</button>
        <button id="btnImportProductos" class="ghost">⤒ Importar</button>
        <button id="btnAddProducto">+ Añadir</button>
      </div>
    </div>
    <div id="listaProductos" class="listaProductos"></div>
  `;
  $('#btnExportProductos').addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v106.json'));
  $('#btnImportProductos').addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ productos=arr; save(K_PRODUCTOS, productos); populateProductDatalist(); renderProductos(); cloudReplaceTable(T_PRODUCTOS, productos); }
  }));
  $('#btnAddProducto').addEventListener('click', ()=>{
    const name = prompt('Nombre del producto:'); if(!name) return;
    productos.push({name});
    save(K_PRODUCTOS,productos);
    populateProductDatalist(); renderProductos();
    cloudReplaceTable(T_PRODUCTOS, productos);
  });
  $('#buscarProducto').addEventListener('input', renderProductos);
  renderProductos();
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
        if(confirm('¿Eliminar producto?')){
          productos.splice(i,1);
          save(K_PRODUCTOS, productos);
          populateProductDatalist(); renderProductos();
          cloudReplaceTable(T_PRODUCTOS, productos);
        }
      }else{
        const row=b.closest('.product-row');
        const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();
        const name=get('name'); const mode=(get('mode')||null);
        const boxKgStr=get('boxKg'); const boxKg=boxKgStr===''?null:parseNum(boxKgStr);
        const priceStr=get('price'); const price=priceStr===''?null:parseNum(priceStr);
        const origin=get('origin')||null;
        productos[i]={name,mode,boxKg,price,origin};
        save(K_PRODUCTOS, productos);
        populateProductDatalist(); renderProductos();
        cloudReplaceTable(T_PRODUCTOS, productos);
      }
    });
  });
}

/* ---------- FACTURA: LINEAS ---------- */
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
    <td><input class="qty" type="number" step="1" placeholder="Cant." /></td>
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
  const baseMasTrans = subtotal + transporte;
  const iva = baseMasTrans * 0.04; // informativo
  const total = baseMasTrans;

  // pagado = pagosTemp + input manual
  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, total - pagadoTotal);

  $('#subtotal').textContent = money(subtotal);
  $('#transp').textContent = money(transporte);
  $('#iva').textContent = money(iva);
  $('#total').textContent = money(total);
  $('#pendiente').textContent = money(pendiente);

  // estado sugerido
  if(total<=0){ $('#estado').value='pendiente'; }
  else if(pagadoTotal<=0){ $('#estado').value='pendiente'; }
  else if(pagadoTotal<total){ $('#estado').value='parcial'; }
  else { $('#estado').value='pagado'; }

  // Pie de PDF
  const foot=$('#pdf-foot-note');
  if(foot){
    foot.textContent = $('#chkIvaIncluido')?.checked ? 'IVA incluido en los precios.' : 'IVA (4%) mostrado como informativo. Transporte 10% opcional.';
  }

  fillPrint(ls,{subtotal,transporte,iva,total},null,null);
  drawResumen(); // KPIs rápidos
}
;['chkTransporte','chkIvaIncluido','estado','pagado'].forEach(id=>$('#'+id)?.addEventListener('input', recalc));

function fillPrint(lines, totals, temp=null, f=null){
  $('#p-num').textContent = f?.numero || '(Sin guardar)';
  $('#p-fecha').textContent = (f?new Date(f.fecha):new Date()).toLocaleString();

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

/* ---------- GUARDAR / NUEVA / PDF (+ subida a Storage si está) ---------- */
function genNumFactura(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function saveFacturasCache(){ save(K_FACTURAS, facturas); }

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
  facturas.unshift(f);
  saveFacturasCache();

  // Sync nube (modo reemplazo total de tabla)
  await cloudReplaceTable(T_FACTURAS, facturas);

  pagosTemp = []; renderPagosTemp();
  alert(`Factura ${numero} guardada.`);
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

$('#btnImprimir')?.addEventListener('click', async ()=>{
  const element = document.getElementById('printArea');
  const d=new Date(); const file=`Factura-${($('#cliNombre').value||'Cliente').replace(/\s+/g,'')}-${fmtDateDMY(d)}.pdf`;
  const opt = { margin:[10,10,10,10], filename:file, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };

  // Generar y descargar
  const worker = window.html2pdf().set(opt).from(element).toPdf();
  await worker.get('pdf').then(pdf=>{
    // Descargar
    pdf.save(file);
  });

  // Intentar subir a Storage si existe bucket (no bloquea ni rompe si falla)
  try{
    const blob = await window.html2pdf().set({html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(element).outputPdf('blob');
    const path = `${new Date().toISOString().slice(0,10)}/${file}`;
    await supabase.storage.from(PDF_BUCKET).upload(path, blob, {contentType:'application/pdf', upsert:true});
  }catch(e){
    console.warn('Subida PDF omitida (bucket no existe o sin permisos):', e.message);
  }
});

/* ---------- LISTA DE FACTURAS ---------- */
function badgeEstado(f){
  const tot=f.totals?.total||0, pag=f.totals?.pagado||0;
  if(pag>=tot) return `<span class="badge ok">Pagada</span>`;
  if(pag>0 && pag<tot) return `<span class="badge warn">Parcial (${money(pag)} / ${money(tot)})</span>`;
  return `<span class="badge bad">Impagada</span>`;
}
function renderFacturasPanel(){
  const host=$('#facturasPanel'); if(!host) return;
  host.innerHTML = `
    <div class="title-row">
      <h3>Facturas</h3>
      <div class="row">
        <select id="filtroEstado">
          <option value="todas">Todas</option>
          <option value="pendiente">Impagadas</option>
          <option value="parcial">Parciales</option>
          <option value="pagado">Pagadas</option>
        </select>
        <input id="buscaCliente" class="search" placeholder="Buscar por cliente…" />
        <button id="btnExportFacturas" class="ghost">⤓ Exportar</button>
        <button id="btnImportFacturas" class="ghost">⤒ Importar</button>
      </div>
    </div>
    <div id="listaFacturas" class="list"></div>
  `;
  $('#filtroEstado').addEventListener('input', renderFacturas);
  $('#buscaCliente').addEventListener('input', renderFacturas);
  $('#btnExportFacturas').addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v106.json'));
  $('#btnImportFacturas').addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ facturas=arr; save(K_FACTURAS,facturas); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen(); cloudReplaceTable(T_FACTURAS, facturas); }
  }));
  renderFacturas();
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
    b.addEventListener('click', async ()=>{
      const f=facturas[i]; if(!f) return;
      if(b.dataset.e==='ver'){
        fillPrint(f.lineas,f.totals,null,f); switchTab('factura'); document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
      }else if(b.dataset.e==='cobrar'){
        const tot=f.totals.total||0;
        f.totals.pagado=tot; f.totals.pendiente=0; f.estado='pagado';
        (f.pagos??=[]).push({date:todayISO(), amount: tot});
        save(K_FACTURAS,facturas); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        await cloudReplaceTable(T_FACTURAS, facturas);
      }else if(b.dataset.e==='parcial'){
        const max=(f.totals.total||0)-(f.totals.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[]; f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          save(K_FACTURAS,facturas); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
          await cloudReplaceTable(T_FACTURAS, facturas);
        }
      }else if(b.dataset.e==='pdf'){
        fillPrint(f.lineas,f.totals,null,f);
        const dt=new Date(f.fecha);
        const nombreCliente=(f.cliente?.nombre||'Cliente').replace(/\s+/g,'');
        const filename=`Factura-${nombreCliente}-${fmtDateDMY(dt)}.pdf`;
        const opt={ margin:[10,10,10,10], filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
        const worker = window.html2pdf().set(opt).from(document.getElementById('printArea')).toPdf();
        await worker.get('pdf').then(pdf=>pdf.save(filename));
        try{
          const blob = await window.html2pdf().set({html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.getElementById('printArea')).outputPdf('blob');
          const path = `${new Date().toISOString().slice(0,10)}/${filename}`;
          await supabase.storage.from(PDF_BUCKET).upload(path, blob, {contentType:'application/pdf', upsert:true});
        }catch(e){ console.warn('Subida PDF omitida:', e.message); }
      }
    });
  });
}

/* ---------- PENDIENTES ---------- */
function renderPendientesPanel(){
  const host=$('#pendientesPanel'); if(!host) return;
  host.innerHTML = `
    <div class="title-row">
      <h3>Deudas por cliente</h3>
      <div class="row">
        <button id="btnResetCliente" class="ghost">Reset deudas del cliente actual</button>
        <button id="btnResetGlobal" class="ghost">Reset deudas global</button>
      </div>
    </div>
    <table class="calc-table" id="tblPendientes">
      <thead>
        <tr><th>Cliente</th><th>Nº facturas pendientes</th><th>Total pendiente</th><th>Última factura</th><th>Acciones</th></tr>
      </thead>
      <tbody></tbody>
    </table>
    <div class="pendiente total">Total pendiente global: <strong id="resGlobal">0,00 €</strong></div>
  `;
  $('#btnResetCliente').addEventListener('click', async ()=>{
    const nom = $('#cliNombre').value.trim(); if(!nom){ alert('Selecciona un cliente en Factura.'); return; }
    facturas.forEach(f=>{ if((f.cliente?.nombre||'')===nom){ f.totals.pagado=f.totals.total; f.totals.pendiente=0; f.estado='pagado'; } });
    save(K_FACTURAS,facturas); renderPendientes(); renderFacturas(); drawKPIs(); renderVentasCliente(); await cloudReplaceTable(T_FACTURAS, facturas);
  });
  $('#btnResetGlobal').addEventListener('click', async ()=>{
    if(!confirm('¿Marcar todas como pagadas?')) return;
    facturas.forEach(f=>{ f.totals.pagado=f.totals.total; f.totals.pendiente=0; f.estado='pagado'; });
    save(K_FACTURAS,facturas); renderPendientes(); renderFacturas(); drawKPIs(); renderVentasCliente(); await cloudReplaceTable(T_FACTURAS, facturas);
  });
  renderPendientes();
}
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
    const color = info.total>500 ? 'badge bad' : info.total>=100 ? 'badge warn' : 'badge ok';
    tr.innerHTML=`
      <td>${escapeHTML(nom)}</td>
      <td>${info.count}</td>
      <td><span class="${color}">${money(info.total)}</span></td>
      <td>${new Date(info.lastDate).toLocaleString()}</td>
      <td><button class="ghost" data-c="${escapeHTML(nom)}">Ver facturas</button></td>
    `;
    tb.appendChild(tr);
  });
  $('#resGlobal').textContent = money(global);

  tb.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const nombre=b.dataset.c;
      switchTab('facturas');
      $('#buscaCliente').value=nombre;
      renderFacturas();
    });
  });
}

/* ---------- VENTAS ---------- */
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
  $('#vHoy')?.textContent=money(hoy);
  $('#vSemana')?.textContent=money(semana);
  $('#vMes')?.textContent=money(mes);
  $('#vTotal')?.textContent=money(total);

  $('#rHoy')?.textContent=money(hoy);
  $('#rSemana')?.textContent=money(semana);
  $('#rMes')?.textContent=money(mes);
  $('#rTotal')?.textContent=money(total);
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
function renderVentasPanel(){
  const host=$('#ventasPanel'); if(!host) return;
  host.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Totales globales</h3>
        <div class="kpis">
          <div class="kpi"><span>Hoy</span><strong id="vHoy">0,00 €</strong></div>
          <div class="kpi"><span>Semana</span><strong id="vSemana">0,00 €</strong></div>
          <div class="kpi"><span>Mes</span><strong id="vMes">0,00 €</strong></div>
          <div class="kpi"><span>Total</span><strong id="vTotal">0,00 €</strong></div>
        </div>
      </div>
      <div class="card">
        <h3>Top 10 productos (total €)</h3>
        <canvas id="chartTop" height="160"></canvas>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h3>Ventas diarias (7 días)</h3>
        <canvas id="chartDiario" height="140"></canvas>
      </div>
      <div class="card">
        <h3>Ventas mensuales (12 meses)</h3>
        <canvas id="chartMensual" height="140"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="title-row">
        <h3>Detalle por cliente</h3>
        <div class="row">
          <button id="btnExportVentas" class="ghost">📤 Exportar CSV</button>
        </div>
      </div>
      <table class="calc-table" id="tblVentasCliente">
        <thead>
          <tr><th>Cliente</th><th>Hoy</th><th>Semana</th><th>Mes</th><th>Total</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  $('#btnExportVentas').addEventListener('click', exportVentasCSV);
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
}
function drawCharts(){
  if(typeof Chart==='undefined') return;
  const daily=groupDaily(7); const monthly=groupMonthly(12);
  if(chart1) chart1.destroy(); if(chart2) chart2.destroy();
  const ctx1 = document.getElementById('chartDiario')?.getContext?.('2d');
  const ctx2 = document.getElementById('chartMensual')?.getContext?.('2d');
  if(!ctx1 || !ctx2) return;
  chart1=new Chart(ctx1, {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
  chart2=new Chart(ctx2, {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
  const ctx = document.getElementById('chartTop')?.getContext?.('2d');
  if(!ctx) return;
  chartTop=new Chart(ctx, {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data} ]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
    const highlight = v.hoy>0 ? 'badge ok' : '';
    tr.innerHTML=`<td>${escapeHTML(nom)}</td><td class="${highlight}">${money(v.hoy)}</td><td>${money(v.semana)}</td><td>${money(v.mes)}</td><td><strong>${money(v.total)}</strong></td>`;
    tb.appendChild(tr);
  });
}

/* ---------- RESUMEN ---------- */
function renderResumenPanel(){
  const host=$('#resumenPanel'); if(!host) return;
  host.innerHTML = `
    <h3>Resumen rápido</h3>
    <div class="kpis">
      <div class="kpi"><span>Hoy</span><strong id="rHoy">0,00 €</strong></div>
      <div class="kpi"><span>Semana</span><strong id="rSemana">0,00 €</strong></div>
      <div class="kpi"><span>Mes</span><strong id="rMes">0,00 €</strong></div>
      <div class="kpi"><span>Total</span><strong id="rTotal">0,00 €</strong></div>
    </div>
    <div class="row actions mt8">
      <button id="btnBackup">Backup</button>
      <button id="btnRestore" class="ghost">Restaurar (desde nube)</button>
      <div class="row">
        <button class="ghost" data-theme="kiwi">Kiwi</button>
        <button class="ghost" data-theme="mint">Mint</button>
        <button class="ghost" data-theme="sand">Sand</button>
        <button class="ghost" data-theme="graphite">Graphite</button>
      </div>
      <div class="row">
        <button id="btnDark" class="ghost">🌙/🌞</button>
      </div>
    </div>
  `;
  drawResumen();
  $('#btnBackup').addEventListener('click', manualBackup);
  $('#btnRestore').addEventListener('click', async ()=>{ await cloudPullAllAndReplace(); renderAll(); alert('Datos restaurados desde la nube.'); });
  host.querySelectorAll('button[data-theme]').forEach(b=>{
    b.addEventListener('click', ()=>{ document.body.setAttribute('data-theme', b.dataset.theme); localStorage.setItem(K_THEME, b.dataset.theme); });
  });
  $('#btnDark').addEventListener('click', ()=>{
    const cur = localStorage.getItem(K_DARK)==='true';
    const next = !cur; localStorage.setItem(K_DARK, String(next));
    if(next){ document.body.classList.add('dark-mode'); } else { document.body.classList.remove('dark-mode'); }
  });
}
function drawResumen(){ drawKPIs(); }

/* ---------- EXPORT / IMPORT ---------- */
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

/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- BACKUP MANUAL ---------- */
async function manualBackup(){
  try{
    const payload={fecha: todayISO(), clientes, productos, facturas, version:'ARSLAN PRO V10.6 CLOUD'};
    await supabase.from(T_BACKUPS).insert([{ data: payload }]);
    alert('Backup guardado en la nube (tabla backups).');
  }catch(e){ alert('Error al guardar backup: '+e.message); }
}

/* ---------- RENDER ALL ---------- */
function renderAll(){
  renderClientesSelect();
  renderClientesPanel();
  renderProductosPanel();
  renderFacturasPanel();
  renderPendientesPanel();
  renderVentasPanel();
  renderResumenPanel();
  populateProductDatalist();

  // 5 líneas iniciales si vacío
  const tb=$('#lineasBody'); if(tb && tb.children.length===0){ for(let i=0;i<5;i++) addLinea(); }
  renderPagosTemp();
  recalc();
}

/* ---------- BOOT (async) ---------- */
(async function boot(){
  // Tema guardado
  const th = localStorage.getItem(K_THEME) || 'kiwi';
  document.body.setAttribute('data-theme', th);
  if(localStorage.getItem(K_DARK)==='true') document.body.classList.add('dark-mode');

  // Pull desde nube y restauración completa
  await cloudPullAllAndReplace();

  // Defaults proveedor
  setProviderDefaultsIfEmpty();

  // Render UI
  renderAll();

  // Backup automático (una vez al día)
  await cloudBackupDaily();
})();
})();
