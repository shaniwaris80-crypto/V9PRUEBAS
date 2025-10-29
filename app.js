/* =======================================================
   ARSLAN PRO V10.4 — KIWI Edition (FULL PACK)
   - Logo en PDF + multipágina con “Suma y sigue…” + paginado
   - Paletas (Kiwi, Graphite, Sand, Mint) con memoria
   - Numeración continua de facturas (FA-000001…)
   - IVA incluido / IVA añadido (conmutado por checkbox existente)
   - Copia/Restaurar + Auto-backup diario
   - Pagos parciales + pendientes + KPIs + gráficos
   - Cliente añadido: “Restauración Hermanos Marijuán, S.L.U.”
   - PDF visible (fix “PDF en blanco”), captura área #printArea
======================================================= */
(function(){
"use strict";

/* ------------------ SELECTORES & HELPERS ------------------ */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money   = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum= v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
function downloadJSON(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function uploadJSON(cb){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(r.result); cb(obj); }catch{ alert('JSON inválido'); } }; r.readAsText(f);
  };
  inp.click();
}

/* ------------------ STORAGE KEYS ------------------ */
const K_CLIENTES   = 'arslan_v104_clientes';
const K_PRODUCTOS  = 'arslan_v104_productos';
const K_FACTURAS   = 'arslan_v104_facturas';
const K_PRICEHIST  = 'arslan_v104_pricehist';
const K_THEME      = 'arslan_v104_theme';
const K_SEQ        = 'arslan_v104_seq';
const K_BACKUPS    = 'arslan_v104_auto_backups'; // lista de backups (metadatos)

/* ------------------ ESTADO ------------------ */
function load(k, fallback){ 
  try{ 
    const raw = localStorage.getItem(k);
    if(!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback; 
  } catch{ 
    return fallback; 
  } 
}
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});
let autoBackups = load(K_BACKUPS, []);

/* ------------------ TEMAS / PALETAS ------------------ */
/* Paletas: aplicamos CSS variables en :root dinámicamente */
const PALETTES = {
  kiwi:     { '--accent':'#22c55e', '--text':'#111111', '--bg':'#ffffff' },
  graphite: { '--accent':'#1f2937', '--text':'#0b1222', '--bg':'#f8fafc' },
  sand:     { '--accent':'#d97706', '--text':'#1f2937', '--bg':'#fffef9' },
  mint:     { '--accent':'#34d399', '--text':'#102a43', '--bg':'#f7fffb' }
};
function applyPalette(name){
  const pal = PALETTES[name] || PALETTES.kiwi;
  const root=document.documentElement;
  Object.entries(pal).forEach(([k,v])=>root.style.setProperty(k,v));
  save(K_THEME, name);
}
function initPalette(){
  const saved = load(K_THEME, 'kiwi');
  applyPalette(saved);
  // Si existen botones de UI en el HTML (opcional):
  $$('#palette button[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=>applyPalette(btn.dataset.theme));
  });
}

/* ------------------ SPLASH ------------------ */
// Eliminado en FULL PACK (no dependemos del splash). Si existiera, lo ocultamos.
window.addEventListener('load', ()=>{ $('#splash')?.remove(); });

/* ------------------ TABS ------------------ */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
  if(id==='facturas'){ renderFacturas(); }
  if(id==='productos'){ renderProductos(); }
  if(id==='clientes'){ renderClientesLista(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ------------------ SEED CLIENTES/PRODUCTOS ------------------ */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{ const k=(c.nombre||'').trim().toLowerCase(); if(k && !map.has(k)) map.set(k,c); });
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
    {nombre:'Hotel Cordon'},{nombre:'Vaivén Hostelería'},{nombre:'Grupo Resicare'},{nombre:'Carlos Alameda Peralta & Seis Más'},
    {nombre:'Tabalou Development SLU', nif:'ES B09567769'},
    {nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
    {nombre:'Romina — PREMIER', dir:'C/ Madrid 42, Burgos'},
    {nombre:'Abbas — Locutorio Gamonal', dir:'C/ Derechos Humanos 45, Burgos'},
    {nombre:'Nadeem Bhai — RIA Locutorio', dir:'C/ Vitoria 137, Burgos'},
    {nombre:'Mehmood — Mohsin Telecom', dir:'C/ Vitoria 245, Burgos'},
    {nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'},
    {nombre:'Imran Khan — Estambul', dir:'Avda. del Cid, Burgos'},
    {nombre:'Waqas Sohail', dir:'C/ Vitoria, Burgos'},
    {nombre:'Malik — Locutorio Malik', dir:'C/ Progreso, Burgos'},
    {nombre:'Angela', dir:'C/ Madrid, Burgos'},
    {nombre:'Aslam — Locutorio Aslam', dir:'Avda. del Cid, Burgos'},
    {nombre:'Victor Pelu — Tienda Centro', dir:'Burgos Centro'},
    {nombre:'Domingo'},{nombre:'Bar Tropical'},
    {nombre:'Bar Punta Cana — PUNTA CANA', dir:'C/ Los Titos, Burgos'},
    {nombre:'Jose — Alimentación Patxi', dir:'C/ Camino Casa la Vega 33, Burgos'},
    {nombre:'Ideal — Ideal Supermercado', dir:'Avda. del Cid, Burgos'}
  ]);
  // ➕ Cliente oficial añadido (sin alias/comercial):
  clientes.push({
    nombre: 'Restauración Hermanos Marijuán, S.L.U.',
    nif: 'B09425059',
    dir: 'Carretera Logroño Km 102, 09193 Castrillo del Val (Burgos)',
    provincia: 'Burgos',
    email: 'info@restaurantelosbraseros.com'
  });
  save(K_CLIENTES, clientes);
}
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
function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({name:n}));
  save(K_PRODUCTOS, productos);
}

/* ------------------ TUS DATOS PREDETERMINADOS ------------------ */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre')?.value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif')?.value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir')?.value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel')?.value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail')?.value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ------------------ HISTORIAL PRECIOS ------------------ */
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

/* ------------------ CLIENTES UI ------------------ */
function saveClientes(){ save(K_CLIENTES, clientes); }
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
$('#selCliente')?.addEventListener('change', (e)=>{
  const i=+e.target.value; const c=clientes[i]; if(!c) return;
  $('#cliNombre').value=c.nombre||''; $('#cliNif').value=c.nif||''; $('#cliDir').value=c.dir||''; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||'';
});
$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre=prompt('Nombre / Razón social:'); if(!nombre) return;
  const nif=prompt('CIF/NIF (opcional):')||'';
  const dir=prompt('Dirección (opcional):')||'';
  const tel=prompt('Tel (opcional):')||'';
  const email=prompt('Email (opcional):')||'';
  clientes.push({nombre,nif,dir,tel,email}); saveClientes(); renderClientesSelect(); renderClientesLista();
});

/* ------------------ PRODUCTOS UI ------------------ */
function saveProductos(){ save(K_PRODUCTOS, productos); }
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
$('#btnAddProducto')?.addEventListener('click', ()=>{
  productos.push({name:'', mode:'', boxKg:null, price:null, origin:''});
  saveProductos(); renderProductos(); populateProductDatalist();
});

/* ------------------ FACTURA: LÍNEAS ------------------ */
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

/* ------------------ PAGOS PARCIALES (UI) ------------------ */
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
/* ------------------ RECÁLCULO + ESTADOS + PDF PREVIEW ------------------ */
function recalc(){
  const ls=captureLineas();
  let subtotal=0; ls.forEach(l=> subtotal+=lineImporte(l));
  const transporte = $('#chkTransporte')?.checked ? subtotal*0.10 : 0;

  // IVA incluido (informativo) vs IVA añadido (si desmarcas el checkbox)
  const ivaBase = subtotal + transporte;
  const ivaCalc = ivaBase * 0.04;
  const ivaIncluido = $('#chkIvaIncluido')?.checked !== false; // true (por defecto) = solo informativo

  const iva = ivaCalc;
  const total = ivaIncluido ? (subtotal + transporte) : (subtotal + transporte + ivaCalc);

  // pagado = pagosTemp + input manual
  const manual = parseNum($('#pagado')?.value||0);
  const parcial = pagosTemp.reduce((a,b)=>a+(b.amount||0),0);
  const pagadoTotal = manual + parcial;
  const pendiente = Math.max(0, total - pagadoTotal);

  $('#subtotal').textContent = money(subtotal);
  $('#transp').textContent   = money(transporte);
  $('#iva').textContent      = money(iva);
  $('#total').textContent    = money(total);
  $('#pendiente').textContent= money(pendiente);

  // estado sugerido
  if(total<=0){ $('#estado').value='pendiente'; }
  else if(pagadoTotal<=0){ $('#estado').value='pendiente'; }
  else if(pagadoTotal<total){ $('#estado').value='parcial'; }
  else { $('#estado').value='pagado'; }

  // Pie informativo PDF
  const foot=$('#pdf-foot-note');
  if(foot){
    foot.textContent = ivaIncluido
      ? 'IVA incluido en los precios. El 10% de transporte es opcional.'
      : 'IVA (4%) añadido a la base (precios sin IVA). Transporte 10% opcional.';
  }

  fillPrint(ls,{subtotal,transporte,iva,total},{pagado:pagadoTotal,pendiente});
  drawResumen(); // KPIs rápidos
}
;['chkTransporte','chkIvaIncluido','estado','pagado'].forEach(id=>$('#'+id)?.addEventListener('input', recalc));

function fillPrint(lines, totals, _temp=null, f=null){
  $('#p-num').textContent = f?.numero || '(Sin guardar)';
  $('#p-fecha').textContent = (f?new Date(f.fecha):new Date()).toLocaleString();

  $('#p-prov').innerHTML = `
    <div><strong>${escapeHTML(f?.proveedor?.nombre || $('#provNombre')?.value || '')}</strong></div>
    <div>${escapeHTML(f?.proveedor?.nif || $('#provNif')?.value || '')}</div>
    <div>${escapeHTML(f?.proveedor?.dir || $('#provDir')?.value || '')}</div>
    <div>${escapeHTML(f?.proveedor?.tel || $('#provTel')?.value || '')} · ${escapeHTML(f?.proveedor?.email || $('#provEmail')?.value || '')}</div>
  `;
  $('#p-cli').innerHTML = `
    <div><strong>${escapeHTML(f?.cliente?.nombre || $('#cliNombre')?.value || '')}</strong></div>
    <div>${escapeHTML(f?.cliente?.nif || $('#cliNif')?.value || '')}</div>
    <div>${escapeHTML(f?.cliente?.dir || $('#cliDir')?.value || '')}</div>
    <div>${escapeHTML(f?.cliente?.tel || $('#cliTel')?.value || '')} · ${escapeHTML(f?.cliente?.email || $('#cliEmail')?.value || '')}</div>
  `;

  const tbody = $('#p-tabla tbody'); if(tbody){ tbody.innerHTML=''; }
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
    tbody?.appendChild(tr);
  });

  $('#p-sub')?.textContent = money(totals?.subtotal||0);
  $('#p-tra')?.textContent = money(totals?.transporte||0);
  $('#p-iva')?.textContent = money(totals?.iva||0);
  $('#p-tot')?.textContent = money(totals?.total||0);
  $('#p-estado')?.textContent = f?.estado || $('#estado')?.value || 'Impagada';
  $('#p-metodo')?.textContent = f?.metodo || $('#metodoPago')?.value || 'Efectivo';
  $('#p-obs')?.textContent = f?.obs || ($('#observaciones')?.value||'—');

  // QR con datos básicos
  try{
    const canvas = $('#p-qr');
    const numero = f?.numero || '(Sin guardar)';
    const cliente = f?.cliente?.nombre || $('#cliNombre')?.value || '';
    const payload = `ARSLAN-Factura|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado')?.textContent||''}`;
    window.QRCode?.toCanvas(canvas, payload, {width:92, margin:0});
  }catch(e){}
}

/* ------------------ NUMERACIÓN CONTINUA ------------------ */
function nextSeq(){
  let n = load(K_SEQ, 0);
  n = (typeof n==='number'? n : parseInt(n||'0',10)) + 1;
  save(K_SEQ, n);
  return 'FA-' + String(n).padStart(6,'0');
}

/* ------------------ GUARDAR / NUEVA / PDF ------------------ */
function saveFacturas(){ save(K_FACTURAS, facturas); }

$('#btnGuardar')?.addEventListener('click', ()=>{
  const ls=captureLineas(); if(ls.length===0){ alert('Añade al menos una línea.'); return; }
  const numero=nextSeq(); const now=todayISO();
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
    proveedor:{nombre:$('#provNombre')?.value,nif:$('#provNif')?.value,dir:$('#provDir')?.value,tel:$('#provTel')?.value,email:$('#provEmail')?.value},
    cliente:{nombre:$('#cliNombre')?.value,nif:$('#cliNif')?.value,dir:$('#cliDir')?.value,tel:$('#cliTel')?.value,email:$('#cliEmail')?.value},
    lineas:ls, transporte:$('#chkTransporte')?.checked, ivaIncluido:$('#chkIvaIncluido')?.checked,
    estado, metodo:$('#metodoPago')?.value, obs:$('#observaciones')?.value,
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
  $('#chkTransporte').checked=false; $('#chkIvaIncluido').checked=true; $('#estado').value='pendiente';
  $('#pagado').value=''; $('#metodoPago').value='Efectivo'; $('#observaciones').value='';
  pagosTemp=[]; renderPagosTemp();
  recalc();
});

/* ------------------ PDF con paginado + “Suma y sigue…” ------------------ */
function generatePDFFromPrintArea(factura=null){
  const area = document.getElementById('printArea');
  if(!area){ alert('No se encontró el área de impresión.'); return; }

  // Asegurar que el área sea visible y sin transformaciones raras:
  const previousDisplay = area.style.display;
  area.style.display = 'block';

  const d=new Date(factura?.fecha || Date.now());
  const nombreCliente=(factura?.cliente?.nombre || $('#cliNombre')?.value || 'Cliente').replace(/\s+/g,'');
  const filename=`Factura-${nombreCliente}-${fmtDateDMY(d)}.pdf`;
  const opt = {
    margin:[10,10,10,10],
    filename,
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true,scrollY:0},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
  };

  // html2pdf → multipágina + pie “Suma y sigue…” + paginación:
  window.html2pdf().set(opt).from(area).toPdf().get('pdf').then(pdf=>{
    const total = pdf.internal.getNumberOfPages();
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(9);

    for(let i=1;i<=total;i++){
      pdf.setPage(i);
      // texto de página
      pdf.text(`Página ${i} de ${total}`, w-30, h-8);
      // “Suma y sigue…” en todas menos la última
      if(i<total){
        pdf.text('Suma y sigue…', 14, h-8);
      }
      // Pie técnico
      pdf.text('ARSLAN PRO KIWI Edition V10.4', 14, h-4);
      const ts = new Date().toLocaleString();
      pdf.text(ts, w-40, h-4);
    }
    pdf.save(filename);
    // Restituir display
    area.style.display = previousDisplay;
  }).catch(err=>{
    area.style.display = previousDisplay;
    console.error(err);
    alert('Error al generar el PDF.');
  });
}
$('#btnImprimir')?.addEventListener('click', ()=>{
  // si se está viendo una factura guardada, usamos sus datos para nombre archivo
  const current = facturas.find(f=> f.numero === $('#p-num')?.textContent);
  generatePDFFromPrintArea(current||null);
});

/* ------------------ LISTA FACTURAS + DUPLICAR ------------------ */
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

  arr.slice(0,500).forEach((f,idx)=>{
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
        <button class="ghost" data-e="dup" data-i="${idx}">↻ Duplicar</button>
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
        const max=f.totals.total-(f.totals.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[]; f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          saveFacturas(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen();
        }
      }else if(b.dataset.e==='dup'){
        // Duplicar como nueva factura sin número (se asignará al guardar)
        const copia = JSON.parse(JSON.stringify(f));
        const tb=$('#lineasBody'); tb.innerHTML='';
        (copia.lineas||[]).forEach(()=>addLinea());
        // rellenamos inputs
        $('#cliNombre').value=copia.cliente?.nombre||'';
        $('#cliNif').value=copia.cliente?.nif||'';
        $('#cliDir').value=copia.cliente?.dir||'';
        $('#cliTel').value=copia.cliente?.tel||'';
        $('#cliEmail').value=copia.cliente?.email||'';
        const rows=$$('#lineasBody tr');
        (copia.lineas||[]).forEach((l,ix)=>{
          const r=rows[ix];
          r.querySelector('.name').value=l.name||'';
          r.querySelector('.mode').value=l.mode||'';
          r.querySelector('.qty').value=l.qty||'';
          r.querySelector('.gross').value=l.gross||'';
          r.querySelector('.tare').value=l.tare||'';
          r.querySelector('.net').value=l.net||'';
          r.querySelector('.price').value=l.price||'';
          r.querySelector('.origin').value=l.origin||'';
        });
        $('#chkTransporte').checked=!!copia.transporte;
        $('#chkIvaIncluido').checked=!!copia.ivaIncluido;
        $('#metodoPago').value=copia.metodo||'Efectivo';
        $('#observaciones').value=copia.obs||'';
        pagosTemp=[]; renderPagosTemp();
        switchTab('factura'); recalc();
      }else if(b.dataset.e==='pdf'){
        fillPrint(f.lineas,f.totals,null,f);
        generatePDFFromPrintArea(f);
      }
    });
  });
}
$('#filtroEstado')?.addEventListener('input', renderFacturas);
$('#buscaCliente')?.addEventListener('input', renderFacturas);
$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v104.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ facturas=arr; saveFacturas(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); drawResumen(); } }));

/* ------------------ PENDIENTES ------------------ */
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

/* ------------------ KPIs / CHARTS / TOP ------------------ */
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
  chart1=new Chart(document.getElementById('chartDiario')?.getContext('2d'), {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
  chart2=new Chart(document.getElementById('chartMensual')?.getContext('2d'), {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
  chartTop=new Chart(document.getElementById('chartTop')?.getContext('2d'), {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data} ]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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

/* ------------------ BACKUP/RESTORE + AUTOBACKUP ------------------ */
$('#btnBackup')?.addEventListener('click', ()=>{
  const payload={clientes, productos, facturas, priceHist, fecha: todayISO(), version:'ARSLAN PRO V10.4'};
  const filename=`backup-${fmtDateDMY(new Date())}.json`;
  downloadJSON(payload, filename);
});
$('#btnRestore')?.addEventListener('click', ()=>{
  uploadJSON(obj=>{
    try{
      if(obj.clientes) clientes=obj.clientes;
      if(obj.productos) productos=obj.productos;
      if(obj.facturas) facturas=obj.facturas;
      if(obj.priceHist) priceHist=obj.priceHist;
      save(K_CLIENTES,clientes); save(K_PRODUCTOS,productos); save(K_FACTURAS,facturas); save(K_PRICEHIST,priceHist);
      renderAll(); alert('Copia restaurada ✔️');
    }catch{ alert('JSON inválido'); }
  });
});

// Auto-backup diario (mantener últimos 10 metadatos)
function doAutoBackup(){
  const snapshot = {fecha: todayISO(), counts: {clientes:clientes.length, productos:productos.length, facturas:facturas.length}};
  autoBackups.unshift(snapshot);
  autoBackups = autoBackups.slice(0,10);
  save(K_BACKUPS, autoBackups);
  // backup pesado opcional cada N días -> se podría serializar todo y guardar en otro key si deseas.
}
// intenta una vez por día (simple):
(function scheduleDaily(){
  const last = autoBackups[0]?.fecha?.slice(0,10);
  const today = todayISO().slice(0,10);
  if(last!==today) doAutoBackup();
})();

/* ------------------ EXPORT VENTAS CSV ------------------ */
$('#btnExportVentas')?.addEventListener('click', ()=>{
  const rows=[['Cliente','Hoy','Semana','Mes','Total']];
  const tb=$('#tblVentasCliente tbody'); if(tb){
    tb.querySelectorAll('tr').forEach(tr=>{
      const tds=[...tr.querySelectorAll('td')].map(td=>td.textContent.replace(/\s+/g,' ').trim());
      rows.push(tds);
    });
  }
  const csv = rows.map(r=>r.map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ventas-por-cliente-${fmtDateDMY(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href);
});

/* ------------------ RESUMEN RÁPIDO ------------------ */
function drawResumen(){ try{ drawKPIs(); }catch{} }
/* ------------------ RENDER INICIAL + EVENTOS ------------------ */
function renderAll(){
  seedClientesIfEmpty();
  seedProductsIfEmpty();
  setProviderDefaultsIfEmpty();
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

document.addEventListener('DOMContentLoaded', ()=>{
  initPalette();           // aplica paleta guardada
  renderAll();
  // 5 líneas por defecto al abrir
  const tb=$('#lineasBody'); if(tb && tb.children.length===0){ for(let i=0;i<5;i++) addLinea(); }
  // Botones factura
  $('#btnAddLinea')?.addEventListener('click', addLinea);
  $('#btnVaciarLineas')?.addEventListener('click', ()=>{ $('#lineasBody').innerHTML=''; recalc(); });
  // Ir a clientes
  $('#btnNuevoCliente')?.addEventListener('click', ()=>{ switchTab('clientes'); renderClientesLista(); });
  // Primer recálculo
  recalc();
});

})();
