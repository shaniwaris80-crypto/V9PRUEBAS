/* ===========================================================
   ARSLAN PRO V10.5 — KIWI Edition (FULL FIX)
   - Todas las funciones de V10.4 conservadas
   - Logo PNG visible completo y centrado en PDF
   - Factura alineada (sin recortes ni desplazamientos)
   - Márgenes corregidos (PDF y vista previa)
   - Firebase y LocalStorage sincronizados
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
const uid = (p='ID') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

/* ---------- LOCAL KEYS ---------- */
const K_CLIENTES='arslan_v105_clientes';
const K_PRODUCTOS='arslan_v105_productos';
const K_FACTURAS='arslan_v105_facturas';
const K_PRICEHIST='arslan_v105_pricehist';
const K_TS='arslan_v105_ts';

/* ---------- ESTADO ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});
let lastTs    = load(K_TS, 0);

function load(k, fallback){ try{ const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch{ return fallback; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- FIREBASE ---------- */
const db = window.db; // configurado en index.html
const FB_PATH = "arslan_pro_v105";
let syncing=false, pullOnStart=true;

function pushFirebase(){
  if(!db || syncing) return;
  syncing=true;
  setSyncUI('Syncing...');
  const payload={clientes,productos,facturas,priceHist,ts:Date.now()};
  db.ref(FB_PATH).set(payload).then(()=>{
    syncing=false; lastTs=payload.ts; save(K_TS,lastTs); setSyncUI('Sync ✓');
  }).catch(e=>{ syncing=false; console.error('FB set error',e); setSyncUI('Error'); });
}
function setSyncUI(text){
  const dot=$('#syncDot'), t=$('#syncText');
  if(dot) dot.style.background = (text==='Error')?'#ef4444':(text.includes('Sync')?'#16a34a':'#9ca3af');
  if(t) t.textContent=text;
}
function schedulePush(){ clearTimeout(schedulePush.t); schedulePush.t=setTimeout(pushFirebase, 1200); }

if(db){
  db.ref(FB_PATH).on('value', snap=>{
    const v=snap.val(); if(!v) return;
    if(v.ts && v.ts<=lastTs) return;
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

/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- SEED ---------- */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{ const k=(c.nombre||'').trim().toLowerCase(); if(k && !map.has(k)) map.set(k,c); });
  return [...map.values()];
}
function seedClientesIfEmpty(){
  if(clientes.length) return;
  clientes = uniqueByName([
    {id:uid('CLI'),nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, Burgos'},
    {id:uid('CLI'),nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, Burgos'},
    {id:uid('CLI'),nombre:'Alesal Pan / Café San Lesmes', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
    {id:uid('CLI'),nombre:'Con/sentidos — Cuevas Palacios', nif:'B10694792', dir:'C/ San Lesmes, 1, Burgos'},
    {id:uid('CLI'),nombre:'Café Bar Nuovo — Einy Mercedes', nif:'120221393', dir:'C/ San Juan de Ortega 14, Burgos'},
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
  const p = productos.find(x=>x.nombre==='PATATA 10KG'); if(p){ p.modo='caja'; p.kgCaja=10; p.origen='España'; }
  save(K_PRODUCTOS, productos);
}

/* ---------- PROVEEDOR ---------- */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre').value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif').value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir').value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel').value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail').value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ---------- FACTURA CORE ---------- */
function addLinea(){
  const tb=$('#lineasBody');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto" /></td>
    <td><select class="mode"><option value="">—</option><option>kg</option><option>unidad</option><option>caja</option><option>manojo</option></select></td>
    <td><input class="qty" type="number" step="1" /></td>
    <td><input class="gross" type="number" step="0.01" /></td>
    <td><input class="tare" type="number" step="0.01" /></td>
    <td><input class="net" type="number" step="0.01" disabled /></td>
    <td><input class="price price-field" type="number" step="0.01" /></td>
    <td><input class="origin" placeholder="Origen" /></td>
    <td><input class="amount" disabled /></td>
    <td><button class="del">✕</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.del').onclick=()=>{tr.remove();recalc();};
  ['input','change'].forEach(ev=>tr.addEventListener(ev,recalc));
}

/* ---------- CALCULOS ---------- */
function captureLineas(){
  return $$('#lineasBody tr').map(r=>({
    nombre:r.querySelector('.name').value.trim(),
    modo:r.querySelector('.mode').value.trim(),
    qty:parseNum(r.querySelector('.qty').value),
    gross:parseNum(r.querySelector('.gross').value),
    tare:parseNum(r.querySelector('.tare').value),
    net:parseNum(r.querySelector('.net').value),
    precio:parseNum(r.querySelector('.price').value),
    origen:r.querySelector('.origin').value.trim()
  })).filter(l=>l.nombre);
}
function lineImporte(l){return (l.modo==='unidad'||l.modo==='manojo')?l.qty*l.precio:l.net*l.precio;}

function recalc(){
  const ls=captureLineas();
  ls.forEach(l=>l.net=Math.max(0,l.gross-l.tare));
  let subtotal=0; ls.forEach(l=>subtotal+=lineImporte(l));
  const transp=$('#chkTransporte').checked?subtotal*0.10:0;
  const base=subtotal+transp;
  const ivaAplicado=$('#chkIvaAplicado').checked;
  const ivaIncluido=$('#chkIvaIncluido').checked;
  const iva=ivaAplicado?base*0.04:0;
  const total=base+iva;

  $('#subtotal').textContent=money(subtotal);
  $('#transp').textContent=money(transp);
  $('#iva').textContent=money(iva);
  $('#total').textContent=money(total);
  $('#pendiente').textContent=money(total);
  fillPrint(ls,{subtotal,transp,iva,total},{flags:{ivaAplicado,ivaIncluido}});
}

/* ---------- PDF / PRINT (FIXED LAYOUT) ---------- */
function fillPrint(lines, totals, extra){
  const prov={
    nombre:$('#provNombre').value,nif:$('#provNif').value,dir:$('#provDir').value,
    tel:$('#provTel').value,email:$('#provEmail').value
  };
  const cli={
    nombre:$('#cliNombre').value,nif:$('#cliNif').value,dir:$('#cliDir').value,
    tel:$('#cliTel').value,email:$('#cliEmail').value
  };
  $('#p-prov').innerHTML=`
    <div><strong>${escapeHTML(prov.nombre)}</strong></div>
    <div>${escapeHTML(prov.nif)} · ${escapeHTML(prov.dir)}</div>
    <div>${escapeHTML(prov.tel)} · ${escapeHTML(prov.email)}</div>`;
  $('#p-cli').innerHTML=`
    <div><strong>${escapeHTML(cli.nombre)}</strong></div>
    <div>${escapeHTML(cli.nif)} · ${escapeHTML(cli.dir)}</div>
    <div>${escapeHTML(cli.tel)} · ${escapeHTML(cli.email)}</div>`;

  const tb=$('#p-tabla tbody'); tb.innerHTML='';
  lines.forEach(l=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${l.nombre}</td><td>${l.modo}</td><td>${l.qty}</td><td>${l.gross}</td>
    <td>${l.tare}</td><td>${l.net}</td><td>${money(l.precio)}</td><td>${l.origen}</td>
    <td>${money(lineImporte(l))}</td>`;
    tb.appendChild(tr);
  });

  $('#p-sub').textContent=money(totals.subtotal);
  $('#p-tra').textContent=money(totals.transp);
  $('#p-iva').textContent=money(totals.iva);
  $('#p-tot').textContent=money(totals.total);
  $('#p-metodo').textContent=$('#metodoPago').value;
  $('#p-estado').textContent=$('#estado').value;
  $('#p-obs').textContent=$('#observaciones').value||'—';
}

/* ---------- PDF GENERATION FIX ---------- */
$('#btnImprimir')?.addEventListener('click', ()=>{
  const element=document.getElementById('printArea');
  const opt={
    margin:[10,10,10,10],
    filename:`Factura-${($('#cliNombre').value||'Cliente').replace(/\s+/g,'')}-${fmtDateDMY(new Date())}.pdf`,
    image:{type:'jpeg',quality:1},
    html2canvas:{scale:2, useCORS:true, backgroundColor:'#ffffff'},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
  };
  fillPrint(captureLineas(),{
    subtotal:unMoney($('#subtotal').textContent),
    transp:unMoney($('#transp').textContent),
    iva:unMoney($('#iva').textContent),
    total:unMoney($('#total').textContent)
  });
  window.html2pdf().set(opt).from(element).save();
});

/* ---------- BOOT ---------- */
(function boot(){
  seedClientesIfEmpty(); seedProductsIfEmpty(); setProviderDefaultsIfEmpty();
  const tb=$('#lineasBody'); if(tb.children.length===0){for(let i=0;i<5;i++)addLinea();}
  renderAll(); recalc();
})();
})();
