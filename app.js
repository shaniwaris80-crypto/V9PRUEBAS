/* =======================================================
   ARSLAN PRO V10.4 — KIWI Edition (Full + Firebase)
   ======================================================= */

(function(){
"use strict";

/* ---------- FIREBASE CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyC5w6I_hK3f-Nz0Mp09Or3VESmaD_c5dm0",
  authDomain: "arslan-pro-kiwi.firebaseapp.com",
  databaseURL: "https://arslan-pro-kiwi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "arslan-pro-kiwi",
  storageBucket: "arslan-pro-kiwi.firebasestorage.app",
  messagingSenderId: "768704045481",
  appId: "1:768704045481:web:c20d2e35f41c8a6fd0f1b9"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---------- HELPERS ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const money = n => (isNaN(n)?0:n).toFixed(2).replace('.', ',') + " €";
const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const escapeHTML = s => String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const todayISO = () => new Date().toISOString();
const fmtDateDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const unMoney = s => parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')) || 0;
const uid = ()=>'c'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);

/* ---------- KEYS ---------- */
const K_CLIENTES='arslan_v104_clientes';
const K_PRODUCTOS='arslan_v104_productos';
const K_FACTURAS='arslan_v104_facturas';
const K_PRICEHIST='arslan_v104_pricehist';

/* ---------- ESTADO LOCAL ---------- */
let clientes  = load(K_CLIENTES, []);
let productos = load(K_PRODUCTOS, []);
let facturas  = load(K_FACTURAS, []);
let priceHist = load(K_PRICEHIST, {});

function load(k, fallback){ try{ const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch{ return fallback; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- FIREBASE SYNC ---------- */
function syncFromFirebase() {
  db.ref('arslan_pro_v104').once('value').then(snap => {
    const data = snap.val() || {};
    if (data.clientes) { clientes = data.clientes; save(K_CLIENTES, clientes); }
    if (data.productos) { productos = data.productos; save(K_PRODUCTOS, productos); }
    if (data.facturas) { facturas = data.facturas; save(K_FACTURAS, facturas); }
    if (data.priceHist) { priceHist = data.priceHist; save(K_PRICEHIST, priceHist); }
    console.log('✅ Sincronizado desde Firebase');
    renderAll(); recalc();
  }).catch(err => console.error('❌ Error al leer Firebase:', err));
}

function syncToFirebase() {
  const data = { clientes, productos, facturas, priceHist, ts: todayISO() };
  db.ref('arslan_pro_v104').set(data)
    .then(()=>console.log('☁️ Guardado en Firebase'))
    .catch(e=>console.error('⚠️ Error al guardar Firebase', e));
}

// Llamada inicial y guardado periódico
syncFromFirebase();
setInterval(syncToFirebase, 10000);
/* ---------- TABS ---------- */
function switchTab(id){
  $$('button.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('section.panel').forEach(p=>p.classList.toggle('active', p.dataset.tabPanel===id));
  if(id==='ventas'){ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  if(id==='pendientes'){ renderPendientes(); }
  if(id==='resumen'){ drawResumen(); }
}
$$('button.tab').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- CLIENTES ---------- */
function uniqueByName(arr){
  const map=new Map();
  arr.forEach(c=>{ const k=(c.nombre||'').trim().toLowerCase(); if(k && !map.has(k)) map.set(k,c); });
  return [...map.values()];
}
function ensureClienteIds(){
  clientes.forEach(c=>{ if(!c.id) c.id=uid(); });
}
function seedClientesIfEmpty(){
  if(clientes.length) return ensureClienteIds();
  clientes = uniqueByName([
    {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
    {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda 17, Burgos'},
    {id:uid(), nombre:'Hotel Cordon'},
    {id:uid(), nombre:'Bar Tropical'},
  ]);
  save(K_CLIENTES, clientes);
}

function renderClientesSelect(){
  const sel = $('#selCliente');
  if(!sel) return;
  sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
  [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).forEach(c=>{
    const o=document.createElement('option');
    o.value=c.id; o.textContent=c.nombre||'(Sin nombre)';
    sel.appendChild(o);
  });
}

$('#selCliente')?.addEventListener('change', ()=>{
  const id=$('#selCliente').value;
  const c=clientes.find(x=>x.id===id);
  if(c) fillClientFields(c);
});

function fillClientFields(c){
  $('#cliNombre').value=c.nombre||'';
  $('#cliNif').value=c.nif||'';
  $('#cliDir').value=c.dir||'';
  $('#cliTel').value=c.tel||'';
  $('#cliEmail').value=c.email||'';
}

/* ---------- PRODUCTOS ---------- */
function saveProductos(){ save(K_PRODUCTOS, productos); }
function populateProductDatalist(){
  const dl=$('#productNamesList'); if(!dl) return;
  dl.innerHTML='';
  productos.forEach(p=>{ const o=document.createElement('option'); o.value=p.name; dl.appendChild(o); });
}

/* ---------- FACTURA ---------- */
function findProducto(name){ return productos.find(p=>(p.name||'').toLowerCase()===String(name).toLowerCase()); }
function addLinea(){
  const tb = $('#lineasBody');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="name" list="productNamesList" placeholder="Producto" /></td>
    <td><select class="mode"><option value="">—</option><option>kg</option><option>unidad</option><option>caja</option></select></td>
    <td><input class="qty" type="number" step="1" /></td>
    <td><input class="gross" type="number" step="0.01" /></td>
    <td><input class="tare"  type="number" step="0.01" /></td>
    <td><input class="net"   type="number" step="0.01" disabled /></td>
    <td><input class="price" type="number" step="0.01" /></td>
    <td><input class="origin" placeholder="Origen" /></td>
    <td><input class="amount" disabled /></td>
    <td><button class="del">✕</button></td>
  `;
  tb.appendChild(tr);

  const inputs=['name','mode','qty','gross','tare','price'].map(cls=>tr.querySelector('.'+cls));
  inputs.forEach(i=>i.addEventListener('input', recalc));
  tr.querySelector('.del').addEventListener('click', ()=>{ tr.remove(); recalc(); });
}
$('#btnAddLinea')?.addEventListener('click', addLinea);

/* ---------- CÁLCULOS ---------- */
function captureLineas(){
  return $$('#lineasBody tr').map(r=>{
    const name=r.querySelector('.name').value.trim();
    const mode=r.querySelector('.mode').value.trim();
    const qty=parseNum(r.querySelector('.qty').value||0);
    const gross=parseNum(r.querySelector('.gross').value||0);
    const tare=parseNum(r.querySelector('.tare').value||0);
    const net=Math.max(0,gross-tare);
    const price=parseNum(r.querySelector('.price').value||0);
    const origin=r.querySelector('.origin').value.trim();
    return {name,mode,qty,gross,tare,net,price,origin};
  }).filter(l=>l.name);
}
function lineImporte(l){ return (l.mode==='unidad')?l.qty*l.price:l.net*l.price; }

function recalc(){
  const ls=captureLineas();
  let subtotal=0;
  ls.forEach(l=>subtotal+=lineImporte(l));
  const transporte=$('#chkTransporte')?.checked?subtotal*0.10:0;
  const baseMasTrans=subtotal+transporte;
  const iva=baseMasTrans*0.04;
  const total=baseMasTrans;
  $('#subtotal').textContent=money(subtotal);
  $('#transp').textContent=money(transporte);
  $('#iva').textContent=money(iva);
  $('#total').textContent=money(total);
  fillPrint(ls,{subtotal,transporte,iva,total});
}

['chkTransporte','chkIvaIncluido'].forEach(id=>$('#'+id)?.addEventListener('input',recalc));

/* ---------- PDF / IMPRESIÓN ---------- */
function fillPrint(lines, totals){
  const tbody=$('#p-tabla tbody');
  tbody.innerHTML='';
  (lines||[]).forEach(l=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${escapeHTML(l.name)}</td>
      <td>${escapeHTML(l.mode||'')}</td>
      <td>${l.qty||''}</td>
      <td>${l.gross||''}</td>
      <td>${l.tare||''}</td>
      <td>${l.net||''}</td>
      <td>${money(l.price)}</td>
      <td>${escapeHTML(l.origin||'')}</td>
      <td>${money(lineImporte(l))}</td>`;
    tbody.appendChild(tr);
  });
  $('#p-sub').textContent=money(totals.subtotal);
  $('#p-tra').textContent=money(totals.transporte);
  $('#p-iva').textContent=money(totals.iva);
  $('#p-tot').textContent=money(totals.total);
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
function hidePanelSoon(){ clearTimeout(hidePanelSoon.t); hidePanelSoon.t=setTimeout(()=>$('#pricePanel')?.setAttribute('hidden',''), 4500); }

/* ---------- LISTADO DE CLIENTES (panel) ---------- */
function renderClientesLista(){
  const cont = $('#listaClientes'); if(!cont) return;
  cont.innerHTML='';
  const q = ($('#buscarCliente')?.value||'').toLowerCase();
  const arr = [...clientes].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  const view = q ? arr.filter(c=>(c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q) || (c.dir||'').toLowerCase().includes(q)) : arr;
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
    b.addEventListener('click', ()=>{
      const i=clientes.findIndex(x=>x.id===id); if(i<0) return;
      if(b.dataset.e==='use'){
        const c=clientes[i]; if(!c) return;
        fillClientFields(c); switchTab('factura');
      }else if(b.dataset.e==='edit'){
        const c=clientes[i];
        const nombre=prompt('Nombre',c.nombre||'')??c.nombre;
        const nif=prompt('NIF',c.nif||'')??c.nif;
        const dir=prompt('Dirección',c.dir||'')??c.dir;
        const tel=prompt('Tel',c.tel||'')??c.tel;
        const email=prompt('Email',c.email||'')??c.email;
        clientes[i]={...c,nombre,nif,dir,tel,email}; save(K_CLIENTES, clientes); renderClientesSelect(); renderClientesLista();
      }else{
        if(confirm('¿Eliminar cliente?')){ clientes.splice(i,1); save(K_CLIENTES, clientes); renderClientesSelect(); renderClientesLista(); }
      }
    });
  });
}
$('#buscarCliente')?.addEventListener('input', renderClientesLista);
$('#btnAddCliente')?.addEventListener('click', ()=>{
  const nombre=prompt('Nombre del cliente:'); if(!nombre) return;
  const nif=prompt('NIF/CIF:')||''; const dir=prompt('Dirección:')||''; const tel=prompt('Teléfono:')||''; const email=prompt('Email:')||'';
  clientes.push({id:uid(), nombre,nif,dir,tel,email}); save(K_CLIENTES, clientes); renderClientesSelect(); renderClientesLista();
});

/* ---------- LISTADO DE PRODUCTOS (panel) ---------- */
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
  const name=prompt('Producto:'); if(!name) return;
  productos.push({name,mode:'',boxKg:null,price:null,origin:''});
  saveProductos(); populateProductDatalist(); renderProductos();
});

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

/* ---------- GUARDAR / NUEVA / PDF ---------- */
function genNumFactura(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `FA-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function saveFacturas(){ save(K_FACTURAS, facturas); }

$('#btnGuardar')?.addEventListener('click', ()=>{
  const ls=captureLineas(); if(ls.length===0){ alert('Añade al menos una línea.'); return; }
  const numero=genNumFactura(); const now=todayISO();
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

  const f={
    numero, fecha:now,
    proveedor:{nombre:$('#provNombre').value,nif:$('#provNif').value,dir:$('#provDir').value,tel:$('#provTel').value,email:$('#provEmail').value},
    cliente:{nombre:$('#cliNombre').value,nif:$('#cliNif').value,dir:$('#cliDir').value,tel:$('#cliTel').value,email:$('#cliEmail').value},
    lineas:ls,
    flags:{transporte:$('#chkTransporte').checked, ivaIncluido:$('#chkIvaIncluido').checked},
    estado, metodo:$('#metodoPago').value, obs:$('#observaciones').value,
    totals:{subtotal,transporte,iva,total,pagado:pagadoTotal,pendiente},
    pagos
  };
  facturas.unshift(f); saveFacturas(); syncToFirebase();

  pagosTemp = []; renderPagosTemp();
  alert(`Factura ${numero} guardada.`);
  renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
  fillPrint(ls,{subtotal,transporte,iva,total});
});

$('#btnNueva')?.addEventListener('click', ()=>{
  const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea();
  $('#chkTransporte').checked=false; $('#chkIvaIncluido').checked=true; $('#estado').value='pendiente';
  $('#pagado').value=''; $('#metodoPago').value='Efectivo'; $('#observaciones').value='';
  pagosTemp=[]; renderPagosTemp();
  recalc();
});

$('#btnImprimir')?.addEventListener('click', ()=>{
  recalc();
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
        fillPrint(f.lineas,f.totals); switchTab('factura'); document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
      }else if(b.dataset.e==='cobrar'){
        const tot=f.totals.total||0;
        f.totals.pagado=tot; f.totals.pendiente=0; f.estado='pagado';
        (f.pagos??=[]).push({date:todayISO(), amount: tot});
        saveFacturas(); syncToFirebase(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
      }else if(b.dataset.e==='parcial'){
        const max=(f.totals.total||0)-(f.totals.pagado||0);
        const val=parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
        if(val>0){
          f.pagos=f.pagos||[]; f.pagos.push({date:todayISO(), amount:val});
          f.totals.pagado=(f.totals.pagado||0)+val;
          f.totals.pendiente=Math.max(0,(f.totals.total||0)-f.totals.pagado);
          f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
          saveFacturas(); syncToFirebase(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
        }
      }else if(b.dataset.e==='pdf'){
        fillPrint(f.lineas,f.totals);
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

/* ---------- VENTAS / KPIs / GRÁFICOS ---------- */
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
  const c1=document.getElementById('chartDiario'); const c2=document.getElementById('chartMensual');
  if(!c1 || !c2) return;
  chart1=new Chart(c1.getContext('2d'), {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
  chart2=new Chart(c2.getContext('2d'), {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
  const c=document.getElementById('chartTop'); if(!c) return;
  chartTop=new Chart(c.getContext('2d'), {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data} ]}, options:{responsive:true, plugins:{legend:{display:false}}}});
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
        if(obj.clientes){ clientes=obj.clientes; clientes.forEach(c=>{ if(!c.id) c.id=uid(); }); }
        if(obj.productos) productos=obj.productos;
        if(obj.facturas) facturas=obj.facturas;
        if(obj.priceHist) priceHist=obj.priceHist;
        save(K_CLIENTES,clientes); save(K_PRODUCTOS,productos); save(K_FACTURAS,facturas); save(K_PRICEHIST,priceHist);
        syncToFirebase();
        renderAll(); recalc();
        alert('Copia restaurada ✔️');
      }catch{ alert('JSON inválido'); }
    }; reader.readAsText(f);
  };
  inp.click();
});
$('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-arslan-v104.json'));
$('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ clientes=uniqueByName(arr).map(c=>({...c, id:c.id||uid()})); save(K_CLIENTES,clientes); syncToFirebase(); renderClientesSelect(); renderClientesLista(); } }));
$('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-arslan-v104.json'));
$('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ productos=arr; save(K_PRODUCTOS,productos); syncToFirebase(); populateProductDatalist(); renderProductos(); } }));
$('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-arslan-v104.json'));
$('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{ if(Array.isArray(arr)){ facturas=arr; save(K_FACTURAS,facturas); syncToFirebase(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); } }));

function downloadJSON(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function uploadJSON(cb){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ cb(JSON.parse(r.result)); }catch{ alert('JSON inválido'); } }; r.readAsText(f); };
  inp.click();
}
$('#btnExportVentas')?.addEventListener('click', ()=>{
  const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
  facturas.forEach(f=>{
    rows.push([f.cliente?.nombre||'', new Date(f.fecha).toLocaleString(), f.numero, (f.totals?.total||0), (f.totals?.pagado||0), (f.totals?.pendiente||0), f.estado]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ventas.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

/* ---------- PROVIDER DEFAULTS ---------- */
function setProviderDefaultsIfEmpty(){
  if(!$('#provNombre').value) $('#provNombre').value = 'Mohammad Arslan Waris';
  if(!$('#provNif').value)    $('#provNif').value    = 'X6389988J';
  if(!$('#provDir').value)    $('#provDir').value    = 'Calle San Pablo 17, 09003 Burgos';
  if(!$('#provTel').value)    $('#provTel').value    = '631 667 893';
  if(!$('#provEmail').value)  $('#provEmail').value  = 'shaniwaris80@gmail.com';
}

/* ---------- SEED PRODUCTS (si vacío) ---------- */
const PRODUCT_NAMES = [
 "TOMATE DANIELA","PLÁTANO CANARIO PRIMERA","AGUACATE GRANEL","CILANTRO","LIMA","PATATA 10KG",
 "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PERA RINCON DEL SOTO","MELOCOTON PRIMERA",
 "TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","PUERROS","BROCOLI","JUDIA VERDE","BERENJENA",
 "PIMIENTO ITALIANO VERDE","PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA","ALCACHOFA","CALABACIN","COLIFLOR","BATAVIA","ICEBERG",
 "MANDARINA SEGUNDA","NARANJA ZUMO","PLATANO CANARIO SUELTO","FRESAS","ARANDANOS","PEREJIL","CEBOLLA NORMAL","CEBOLLA DULCE","CEBOLLA ROJA"
];
function seedProductsIfEmpty(){
  if(productos.length) return;
  productos = PRODUCT_NAMES.map(n=>({name:n}));
  // ejemplos con caja:
  const p = productos.find(x=>x.name==='PATATA 10KG'); if(p){ p.mode='caja'; p.boxKg=10; p.origin='España'; }
  const l = productos.find(x=>x.name==='LIMA'); if(l){ l.mode='caja'; l.boxKg=7; l.origin='Brasil'; }
  const c = productos.find(x=>x.name==='CILANTRO'); if(c){ c.mode='unidad'; }
  save(K_PRODUCTOS, productos);
}

/* ---------- EVENTOS GENERALES ---------- */
$('#btnVaciarLineas')?.addEventListener('click', ()=>{ if(confirm('¿Vaciar líneas?')){ const tb=$('#lineasBody'); tb.innerHTML=''; for(let i=0;i<5;i++) addLinea(); recalc(); }});
$('#btnNuevoCliente')?.addEventListener('click', ()=>switchTab('clientes'));

/* ---------- RENDER / RESUMEN ---------- */
function renderAll(){
  renderClientesSelect(); renderClientesLista();
  populateProductDatalist(); renderProductos(); renderFacturas(); renderPendientes();
  drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
}
function drawResumen(){ drawKPIs(); }

/* ---------- BOOT ---------- */
(function boot(){
  // semillas si está vacío local (o tras primera carga sin datos remotos)
  if(!clientes?.length){
    clientes = [
      {id:uid(), nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, 09003 Burgos'},
      {id:uid(), nombre:'Al Pan Pan Burgos, S.L.', nif:'B09569344', dir:'C/ Miranda 17, Burgos'},
      {id:uid(), nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, Burgos'},
      {id:uid(), nombre:'Café Bar Nuovo', dir:'C/ San Juan de Ortega 14, 09007 Burgos'}
    ];
    save(K_CLIENTES, clientes);
  }
  clientes.forEach(c=>{ if(!c.id) c.id=uid(); });

  seedProductsIfEmpty();
  setProviderDefaultsIfEmpty();

  // 5 líneas iniciales
  const tb=$('#lineasBody'); if(tb && tb.children.length===0){ for(let i=0;i<5;i++) addLinea(); }

  renderPagosTemp();
  renderAll(); recalc();

  // Verificación tardía
  window.addEventListener('load', ()=>setTimeout(()=>{ try{
    populateProductDatalist(); renderProductos(); renderClientesSelect(); renderClientesLista(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); recalc();
  }catch(e){ console.error('Init error',e); } }, 350));
})();
})(); // end IIFE

