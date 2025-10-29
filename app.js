/* ===========================================================
   ARSLAN PRO V10.4 — KIWI FULL Firebase Edition
   🥝 Integración completa con:
   - Firebase (Realtime DB + Auth Anónima)
   - LocalStorage y sincronización cruzada
   - IVA toggle dinámico + Reset ventas y pendientes
   - PDF profesional con logo KIWI
=========================================================== */

// ---------- 🔥 FIREBASE CORE ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5w6I_hK3f-Nz0Mp09Or3VESmaD_c5dm0",
  authDomain: "arslan-pro-kiwi.firebaseapp.com",
  databaseURL: "https://arslan-pro-kiwi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "arslan-pro-kiwi",
  storageBucket: "arslan-pro-kiwi.firebasestorage.app",
  messagingSenderId: "768704045481",
  appId: "1:768704045481:web:668acb151a2181368864b8"
};

// Inicialización ordenada
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth();

// Autenticación anónima segura
signInAnonymously(auth)
  .then(()=>console.log("✅ Conectado a Firebase (modo anónimo seguro)"))
  .catch(err=>console.error("❌ Error autenticación Firebase", err));

/* ===========================================================
   📦 SINCRONIZACIÓN CLOUD
=========================================================== */
async function cloudGet(path){
  try{
    const snap = await get(ref(db,path));
    return snap.exists()?snap.val():null;
  }catch(e){console.warn("Cloud GET error →",path,e);return null;}
}
async function cloudSet(path,data){
  try{await set(ref(db,path),data);}
  catch(e){console.warn("Cloud SET error →",path,e);}
}

/* ===========================================================
   🧭 CORE LOCAL + HELPERS
=========================================================== */
document.addEventListener("DOMContentLoaded",async()=>{

  // --- helpers básicos ---
  const $  = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const money = n => (isNaN(n)?0:n).toFixed(2).replace('.',',')+" €";
  const parseNum = v => {
    const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?0:n;
  };

  // --- datasets principales ---
  let clientes  = JSON.parse(localStorage.getItem("arslan_clientes"))  || {};
  let productos = JSON.parse(localStorage.getItem("arslan_productos")) || {};
  let facturas  = JSON.parse(localStorage.getItem("arslan_facturas"))  || {};
  let priceHist = JSON.parse(localStorage.getItem("arslan_priceHist")) || {};
  let meta      = JSON.parse(localStorage.getItem("arslan_meta"))      || {num:1};

  // --- guardado local ---
  function saveLocal(){
    localStorage.setItem("arslan_clientes",JSON.stringify(clientes));
    localStorage.setItem("arslan_productos",JSON.stringify(productos));
    localStorage.setItem("arslan_facturas",JSON.stringify(facturas));
    localStorage.setItem("arslan_priceHist",JSON.stringify(priceHist));
    localStorage.setItem("arslan_meta",JSON.stringify(meta));
  }

  // --- sincronización cloud inicial ---
  async function initialCloudMerge(){
    const [cl,pr,fa,ph,me] = await Promise.all([
      cloudGet("arslan_pro_v104/clientes"),
      cloudGet("arslan_pro_v104/productos"),
      cloudGet("arslan_pro_v104/facturas"),
      cloudGet("arslan_pro_v104/priceHist"),
      cloudGet("arslan_pro_v104/meta")
    ]);
    if(cl) clientes = cl;
    if(pr) productos = pr;
    if(fa) facturas = fa;
    if(ph) priceHist = ph;
    if(me) meta = me;
    saveLocal();
    console.log("☁️ Datos sincronizados desde Firebase");
  }

  await initialCloudMerge();

  // --- sincronización en tiempo real ---
  ["clientes","productos","facturas","priceHist","meta"].forEach(key=>{
    onValue(ref(db,"arslan_pro_v104/"+key),snap=>{
      if(snap.exists()){
        console.log("🔄 Actualización remota:",key);
        if(key==="clientes")  clientes=snap.val();
        if(key==="productos") productos=snap.val();
        if(key==="facturas")  facturas=snap.val();
        if(key==="priceHist") priceHist=snap.val();
        if(key==="meta")      meta=snap.val();
        saveLocal(); renderUI();
      }
    });
  });

  /* ===========================================================
     🖥️ INTERFAZ GENERAL
  ========================================================== */
  function renderUI(){
    renderClientes();
    renderProductos();
    renderFacturas();
    renderPendientes();
    renderVentas();
  }

  renderUI();

  // --- cambio de pestaña ---
  $$('.tab').forEach(btn=>{
    btn.onclick=()=>{
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab=btn.dataset.tab;
      $$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.tabPanel===tab));
    };
  });

  /* ===========================================================
     🧾 NUEVA FACTURA / RESETEO
  ========================================================== */
  $('#btnNueva').onclick=()=>{
    $('#lineasBody').innerHTML='';
    ['subtotal','total','transp','iva','pendiente'].forEach(id=>$('#'+id).textContent='0,00 €');
    $('#observaciones').value='';
    $('#estado').value='pendiente';
  };
  /* ===========================================================
     📦 MODELOS + IDS
  ========================================================== */
  const uid = () => 'ID' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);

  // Asegurar mapas (no arrays) para evitar desalineo por índice
  if (Array.isArray(clientes))  clientes  = Object.fromEntries(clientes.map(c=>[uid(),c]));
  if (Array.isArray(productos)) productos = Object.fromEntries(productos.map(p=>[uid(),p]));
  if (Array.isArray(facturas))  facturas  = Object.fromEntries(facturas.map(f=>[uid(),f]));
  if (typeof priceHist!=='object' || priceHist===null) priceHist = {};

  /* ===========================================================
     🧮 FACTURA: LÍNEAS + CÁLCULO
  ========================================================== */
  const dl = document.createElement('datalist'); dl.id='productNamesList';
  document.body.appendChild(dl);

  function populateProductDatalist(){
    dl.innerHTML='';
    Object.values(productos).forEach(p=>{
      const o=document.createElement('option');
      o.value = p.name || '';
      dl.appendChild(o);
    });
  }

  function addLinea(init = {}){
    const tb = $('#lineasBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="name" list="productNamesList" placeholder="Producto" value="${init.name||''}"></td>
      <td>
        <select class="mode">
          <option value=""></option>
          <option value="kg"${init.mode==='kg'?' selected':''}>kg</option>
          <option value="unidad"${init.mode==='unidad'?' selected':''}>unidad</option>
          <option value="caja"${init.mode==='caja'?' selected':''}>caja</option>
        </select>
      </td>
      <td><input class="qty" type="number" step="1" value="${init.qty??''}" placeholder="Cant."></td>
      <td><input class="gross" type="number" step="0.01" value="${init.gross??''}" placeholder="Bruto"></td>
      <td><input class="tare"  type="number" step="0.01" value="${init.tare??''}"  placeholder="Tara"></td>
      <td><input class="net"   type="number" step="0.01" value="${init.net??''}"   placeholder="Neto" disabled></td>
      <td><input class="price" type="number" step="0.01" value="${init.price??''}" placeholder="Precio"></td>
      <td><input class="origin" value="${init.origin||''}" placeholder="Origen"></td>
      <td><input class="amount" placeholder="Importe" disabled></td>
      <td><button class="del">✕</button></td>
    `;
    tb.appendChild(tr);

    const name   = tr.querySelector('.name');
    const mode   = tr.querySelector('.mode');
    const qty    = tr.querySelector('.qty');
    const gross  = tr.querySelector('.gross');
    const tare   = tr.querySelector('.tare');
    const net    = tr.querySelector('.net');
    const price  = tr.querySelector('.price');
    const origin = tr.querySelector('.origin');
    const amount = tr.querySelector('.amount');

    function showPriceHist(){
      const n = (name.value||'').trim();
      if(!n) return;
      const hist = priceHist[n] || [];
      // pequeño panel flotante (ya estilado en style.css)
      let panel = $('#pricePanel');
      if(!panel){
        panel = document.createElement('aside');
        panel.id='pricePanel';
        panel.innerHTML = `<div class="pp-title">Historial de precios</div><div id="ppBody"></div>`;
        document.body.appendChild(panel);
      }
      const body = panel.querySelector('#ppBody');
      if(hist.length===0){
        body.innerHTML = `<div class="pp-row"><span>${n}</span><strong>Sin datos</strong></div>`;
      }else{
        body.innerHTML = `<div class="pp-row" style="justify-content:center"><strong>${n}</strong></div>` +
          hist.slice(0,10).map(h=>`<div class="pp-row"><span>${new Date(h.date).toLocaleDateString()}</span><strong>${money(h.price)}</strong></div>`).join('');
      }
      panel.hidden = false;
      clearTimeout(showPriceHist.t);
      showPriceHist.t = setTimeout(()=> panel.hidden = true, 4500);
    }

    name.addEventListener('focus', showPriceHist);
    price.addEventListener('focus', showPriceHist);

    name.addEventListener('change', ()=>{
      const n = (name.value||'').trim().toLowerCase();
      const prod = Object.values(productos).find(p=>(p.name||'').toLowerCase()===n);
      if(prod){
        if(prod.mode) mode.value = prod.mode;
        if(prod.price!=null && price.value==='') price.value = prod.price;
        if(prod.origin) origin.value = prod.origin;
        const lp = (priceHist[prod.name]?.[0]?.price);
        if(lp!=null && price.value==='') price.value = lp;
      }
      recalc();
    });

    [mode,qty,gross,tare,price].forEach(i=>i.addEventListener('input', recalc));

    tr.querySelector('.del').onclick = ()=>{ tr.remove(); recalc(); };
  }

  function captureLineas(){
    return $$('#lineasBody tr').map(r=>{
      const l = {
        name:   r.querySelector('.name').value.trim(),
        mode:   r.querySelector('.mode').value,
        qty:    Math.max(0, Math.floor(parseNum(r.querySelector('.qty').value||0))),
        gross:  Math.max(0, parseNum(r.querySelector('.gross').value||0)),
        tare:   Math.max(0, parseNum(r.querySelector('.tare').value||0)),
        net:    Math.max(0, parseNum(r.querySelector('.net').value||0)),
        price:  Math.max(0, parseNum(r.querySelector('.price').value||0)),
        origin: r.querySelector('.origin').value.trim()
      };
      // recalcular net y amount aquí para consistencia
      let n=0;
      if(l.gross>0 || l.tare>0) n = Math.max(0, l.gross - l.tare);
      else if(l.mode==='caja'){
        const prod = Object.values(productos).find(p=>(p.name||'').toLowerCase()===l.name.toLowerCase());
        const kg = prod?.boxKg || 0;
        n = l.qty * kg;
      }else if(l.mode==='kg'){ n = l.qty; }
      else if(l.mode==='unidad'){ n = l.qty; }
      l.net = n;
      l.amount = (l.mode==='unidad') ? (l.qty*l.price) : (l.net*l.price);
      return l;
    }).filter(l=> l.name && (l.qty>0 || l.gross>0 || l.net>0));
  }

  function recalc(){
    const lines = captureLineas();
    // pintar neto e importe en UI
    $$('#lineasBody tr').forEach((r,i)=>{
      const l = lines[i];
      if(!l) return;
      r.querySelector('.net').value    = l.net ? l.net.toFixed(2) : '';
      r.querySelector('.amount').value = l.amount ? l.amount.toFixed(2) : '';
    });

    let subtotal = lines.reduce((a,l)=>a+(l.amount||0),0);
    const transporte = $('#chkTransporte')?.checked ? subtotal*0.10 : 0;
    const applyIVA   = $('#chkIVA4')?.checked;
    const base       = subtotal + transporte;
    const iva        = applyIVA ? base*0.04 : 0;
    const total      = base + iva;

    $('#subtotal').textContent = money(subtotal);
    $('#transp').textContent   = money(transporte);
    $('#iva').textContent      = money(iva);
    $('#total').textContent    = money(total);

    // pendiente (manual pagado)
    const pagado = parseNum($('#pagado').value||0);
    const pendiente = Math.max(0, total - pagado);
    $('#pendiente').textContent = money(pendiente);

    // estado sugerido
    if(total<=0){ $('#estado').value='pendiente'; }
    else if(pagado<=0){ $('#estado').value='pendiente'; }
    else if(pagado<total){ $('#estado').value='parcial'; }
    else { $('#estado').value='pagado'; }

    // update pie PDF
    const foot = $('#pdf-foot-note');
    if(foot){
      foot.textContent = applyIVA ? 'IVA (4%) aplicado sobre base imponible. Transporte 10% opcional.' : 'IVA incluido en los precios.';
    }

    fillPrint(lines, {subtotal, transporte, iva, total});
  }

  // listeners de totales
  ['chkTransporte','chkIVA4','pagado','estado','metodoPago','observaciones'].forEach(id=>{
    const el = $('#'+id);
    if(el) el.addEventListener('input', recalc);
  });

  /* ===========================================================
     🧾 RELLENO PDF + QR
  ========================================================== */
  function fillPrint(lines, totals, f=null){
    $('#p-num').textContent   = f?.numero || '(Sin guardar)';
    $('#p-fecha').textContent = (f ? new Date(f.fecha) : new Date()).toLocaleString();

    $('#p-prov').innerHTML = `
      <div><strong>${($('#provNombre').value||'')}</strong></div>
      <div>${($('#provNif').value||'')}</div>
      <div>${($('#provDir').value||'')}</div>
      <div>${($('#provTel').value||'')} · ${($('#provEmail').value||'')}</div>
    `;
    $('#p-cli').innerHTML = `
      <div><strong>${($('#cliNombre').value||'')}</strong></div>
      <div>${($('#cliNif').value||'')}</div>
      <div>${($('#cliDir').value||'')}</div>
      <div>${($('#cliTel').value||'')} · ${($('#cliEmail').value||'')}</div>
    `;

    const tbody = $('#p-tabla tbody');
    tbody.innerHTML = '';
    (lines||[]).forEach(l=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${l.name}</td>
        <td>${l.mode||''}</td>
        <td>${l.qty||''}</td>
        <td>${l.gross?l.gross.toFixed(2):''}</td>
        <td>${l.tare?l.tare.toFixed(2):''}</td>
        <td>${l.net?l.net.toFixed(2):''}</td>
        <td>${money(l.price)}</td>
        <td>${l.origin||''}</td>
        <td>${money(l.amount||0)}</td>
      `;
      tbody.appendChild(tr);
    });

    $('#p-sub').textContent   = money(totals?.subtotal||0);
    $('#p-tra').textContent   = money(totals?.transporte||0);
    $('#p-iva').textContent   = money(totals?.iva||0);
    $('#p-tot').textContent   = money(totals?.total||0);
    $('#p-estado').textContent= $('#estado').value || 'Impagada';
    $('#p-metodo').textContent= $('#metodoPago').value || 'Efectivo';
    $('#p-obs').textContent   = $('#observaciones').value || '—';

    // QR
    try{
      const canvas = $('#p-qr');
      const numero = f?.numero || '(Sin guardar)';
      const cliente= $('#cliNombre').value || '';
      const payload = `ARSLAN|${numero}|${cliente}|${money(totals?.total||0)}|${$('#p-estado').textContent}`;
      window.QRCode.toCanvas(canvas, payload, {width:92, margin:0});
    }catch(e){}
  }

  /* ===========================================================
     💾 GUARDAR FACTURA (local + cloud) + PDF
  ========================================================== */
  function pushPriceHistoryLine(lines){
    lines.forEach(l=>{
      if(!l.name || !(l.price>0)) return;
      const arr = priceHist[l.name] || [];
      arr.unshift({price:l.price, date:new Date().toISOString()});
      priceHist[l.name] = arr.slice(0,10);
    });
  }

  async function syncAllToCloud(){
    await Promise.all([
      cloudSet('arslan_pro_v104/clientes', clientes),
      cloudSet('arslan_pro_v104/productos', productos),
      cloudSet('arslan_pro_v104/facturas', facturas),
      cloudSet('arslan_pro_v104/priceHist', priceHist),
      cloudSet('arslan_pro_v104/meta', meta),
    ]);
  }

  $('#btnGuardar').onclick = async ()=>{
    const lines = captureLineas();
    if(lines.length===0){ alert('Añade al menos una línea.'); return; }

    // totales actuales de UI
    const subtotal   = parseNum($('#subtotal').textContent.replace('€',''));
    const transporte = parseNum($('#transp').textContent.replace('€',''));
    const iva        = parseNum($('#iva').textContent.replace('€',''));
    const total      = parseNum($('#total').textContent.replace('€',''));

    const id = uid();
    const numero = `FA-${new Date().toISOString().replace(/[^\d]/g,'').slice(0,14)}`;
    const f = {
      id, numero, fecha: new Date().toISOString(),
      proveedor: {
        nombre: $('#provNombre').value, nif: $('#provNif').value,
        dir: $('#provDir').value, tel: $('#provTel').value, email: $('#provEmail').value
      },
      cliente: {
        nombre: $('#cliNombre').value, nif: $('#cliNif').value,
        dir: $('#cliDir').value, tel: $('#cliTel').value, email: $('#cliEmail').value
      },
      lineas: lines,
      flags: { transporte: $('#chkTransporte').checked, iva4: $('#chkIVA4').checked },
      estado: $('#estado').value,
      metodo: $('#metodoPago').value,
      obs: $('#observaciones').value,
      totals: { subtotal, transporte, iva, total, pagado: parseNum($('#pagado').value||0), pendiente: parseNum($('#pendiente').textContent.replace('€','')) }
    };

    // guardar local
    facturas[id] = f;
    // historial precios
    pushPriceHistoryLine(lines);
    saveLocal();

    // cloud
    await syncAllToCloud();

    alert(`Factura ${f.numero} guardada ✔`);
    renderFacturas();
    renderPendientes();
    renderVentas();

    // Rellenar y generar PDF inmediatamente si quieres
    fillPrint(lines, f.totals, f);
  };

  $('#btnImprimir').onclick = ()=>{
    const el = document.getElementById('printArea');
    const cli = ($('#cliNombre').value||'Cliente').replace(/\s+/g,'');
    const dt  = new Date();
    const file= `Factura-${cli}-${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}.pdf`;
    const opt = { margin:[10,10,10,10], filename:file, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
    window.html2pdf().set(opt).from(el).save();
  };

  $('#btnAddLinea').onclick = ()=> addLinea();
  $('#btnVaciarLineas').onclick = ()=>{
    if(confirm('¿Vaciar líneas?')){
      $('#lineasBody').innerHTML='';
      for(let i=0;i<5;i++) addLinea();
      recalc();
    }
  };

  // 5 líneas iniciales si vacío
  if(!$('#lineasBody').children.length){
    for(let i=0;i<5;i++) addLinea();
  }
  populateProductDatalist();
  recalc();
  /* ===========================================================
     👤 CLIENTES (IDs estables, sin errores de selección)
  ========================================================== */
  function renderClientesSelect(){
    const sel = $('#selCliente');
    if(!sel) return;
    sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
    // ordenar por nombre
    const entries = Object.entries(clientes).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));
    entries.forEach(([id,c])=>{
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = c.nombre || '(Sin nombre)';
      sel.appendChild(opt);
    });
  }

  $('#selCliente').addEventListener('change', ()=>{
    const id = $('#selCliente').value;
    if(!id) return;
    const c = clientes[id];
    if(!c) return;
    $('#cliNombre').value = c.nombre||'';
    $('#cliNif').value    = c.nif||'';
    $('#cliDir').value    = c.dir||'';
    $('#cliTel').value    = c.tel||'';
    $('#cliEmail').value  = c.email||'';
  });

  function renderClientesLista(){
    const cont = $('#listaClientes');
    if(!cont) return;
    cont.innerHTML='';
    const q = ($('#buscarCliente')?.value||'').toLowerCase();
    let arr = Object.entries(clientes);
    if(q){
      arr = arr.filter(([id,c])=>(c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q) || (c.dir||'').toLowerCase().includes(q));
    }
    if(arr.length===0){ cont.innerHTML='<div class="item">Sin clientes.</div>'; return; }
    arr.sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));
    arr.forEach(([id,c])=>{
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `
        <div>
          <strong>${c.nombre||'(Sin nombre)'}</strong>
          <div class="muted">${c.nif||''} · ${c.dir||''}</div>
        </div>
        <div class="row">
          <button class="ghost" data-e="use"  data-id="${id}">Usar</button>
          <button class="ghost" data-e="edit" data-id="${id}">Editar</button>
          <button class="ghost" data-e="del"  data-id="${id}">Borrar</button>
        </div>
      `;
      cont.appendChild(row);
    });

    cont.querySelectorAll('button').forEach(b=>{
      const id = b.dataset.id;
      b.onclick = async ()=>{
        const c = clientes[id]; if(!c) return;
        if(b.dataset.e==='use'){
          $('#cliNombre').value = c.nombre||'';
          $('#cliNif').value    = c.nif||'';
          $('#cliDir').value    = c.dir||'';
          $('#cliTel').value    = c.tel||'';
          $('#cliEmail').value  = c.email||'';
          document.querySelector('[data-tab="factura"]').click();
        }else if(b.dataset.e==='edit'){
          const nombre = prompt('Nombre', c.nombre||''); if(nombre===null) return;
          const nif    = prompt('NIF/CIF', c.nif||'');  if(nif===null) return;
          const dir    = prompt('Dirección', c.dir||'');if(dir===null) return;
          const tel    = prompt('Teléfono', c.tel||''); if(tel===null) return;
          const email  = prompt('Email', c.email||'');  if(email===null) return;
          clientes[id]={nombre,nif,dir,tel,email}; saveLocal();
          await cloudSet('arslan_pro_v104/clientes', clientes);
          renderClientesSelect(); renderClientesLista();
        }else{
          if(confirm('¿Eliminar cliente?')){
            delete clientes[id]; saveLocal();
            await cloudSet('arslan_pro_v104/clientes', clientes);
            renderClientesSelect(); renderClientesLista();
          }
        }
      };
    });
  }

  $('#btnAddCliente').onclick = async ()=>{
    const nombre = prompt('Nombre del cliente:'); if(!nombre) return;
    const nif = prompt('NIF/CIF:')||''; const dir=prompt('Dirección:')||''; const tel=prompt('Teléfono:')||''; const email=prompt('Email:')||'';
    const id = uid();
    clientes[id] = {nombre,nif,dir,tel,email};
    saveLocal(); await cloudSet('arslan_pro_v104/clientes', clientes);
    renderClientesSelect(); renderClientesLista();
  };
  $('#buscarCliente')?.addEventListener('input', renderClientesLista);

  /* ===========================================================
     🥝 PRODUCTOS
  ========================================================== */
  function renderProductos(){
    const cont = $('#listaProductos'); if(!cont) return;
    cont.innerHTML='';
    const q = ($('#buscarProducto')?.value||'').toLowerCase();
    let arr = Object.entries(productos);
    if(q){ arr = arr.filter(([id,p])=>(p.name||'').toLowerCase().includes(q)); }
    if(arr.length===0){ cont.innerHTML='<div class="item">Sin resultados.</div>'; return; }

    arr.sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||''));
    arr.forEach(([id,p])=>{
      const row=document.createElement('div'); row.className='product-row';
      row.innerHTML=`
        <input value="${p.name||''}" data-f="name">
        <select data-f="mode">
          <option value=""></option>
          <option value="kg"${p.mode==='kg'?' selected':''}>kg</option>
          <option value="unidad"${p.mode==='unidad'?' selected':''}>unidad</option>
          <option value="caja"${p.mode==='caja'?' selected':''}>caja</option>
        </select>
        <input type="number" step="0.01" data-f="boxKg" placeholder="Kg/caja" value="${p.boxKg??''}">
        <input type="number" step="0.01" data-f="price" placeholder="€ base" value="${p.price??''}">
        <input data-f="origin" placeholder="Origen" value="${p.origin||''}">
        <button data-e="save" data-id="${id}">💾 Guardar</button>
        <button class="ghost" data-e="del" data-id="${id}">✖</button>
      `;
      cont.appendChild(row);
    });

    cont.querySelectorAll('button').forEach(b=>{
      const id = b.dataset.id;
      b.onclick = async ()=>{
        if(b.dataset.e==='del'){
          if(confirm('¿Eliminar producto?')){
            delete productos[id]; saveLocal();
            await cloudSet('arslan_pro_v104/productos', productos);
            populateProductDatalist(); renderProductos();
          }
        }else{
          const row=b.closest('.product-row');
          const get=f=>row.querySelector(`[data-f="${f}"]`).value.trim();
          const name=get('name'); const mode=(get('mode')||'');
          const boxKgStr=get('boxKg'); const boxKg=boxKgStr===''?null:parseNum(boxKgStr);
          const priceStr=get('price'); const price=priceStr===''?null:parseNum(priceStr);
          const origin=get('origin')||null;
          productos[id]={name,mode,boxKg,price,origin}; saveLocal();
          await cloudSet('arslan_pro_v104/productos', productos);
          populateProductDatalist(); renderProductos();
        }
      };
    });
  }
  $('#buscarProducto')?.addEventListener('input', renderProductos);
  /* ===========================================================
     📚 FACTURAS (lista, ver, cobrar, parcial, PDF)
  ========================================================== */
  function badgeEstado(f){
    const tot=f.totals?.total||0, pag=f.totals?.pagado||0;
    if(pag>=tot) return `<span class="state-badge state-green">Pagada</span>`;
    if(pag>0 && pag<tot) return `<span class="state-badge state-amber">Parcial (${money(pag)} / ${money(tot)})</span>`;
    return `<span class="state-badge state-red">Impagada</span>`;
  }

  function renderFacturas(){
    const cont = $('#listaFacturas'); if(!cont) return;
    const filtro = $('#filtroEstado')?.value || 'todas';
    const q = ($('#buscaCliente')?.value||'').toLowerCase();
    cont.innerHTML='';

    let arr = Object.values(facturas);
    if(filtro!=='todas') arr = arr.filter(f=>f.estado===filtro);
    if(q) arr = arr.filter(f=>(f.cliente?.nombre||'').toLowerCase().includes(q));

    if(arr.length===0){ cont.innerHTML='<div class="item">No hay facturas.</div>'; return; }

    // ordenar por fecha desc
    arr.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
    arr.slice(0,500).forEach(f=>{
      const fecha = new Date(f.fecha).toLocaleString();
      const div = document.createElement('div'); div.className='item';
      div.innerHTML = `
        <div>
          <strong>${f.numero}</strong> ${badgeEstado(f)}
          <div class="muted">${fecha} · ${f.cliente?.nombre||''}</div>
        </div>
        <div class="row">
          <strong>${money(f.totals?.total||0)}</strong>
          <button class="ghost" data-e="ver" data-id="${f.id}">Ver</button>
          <button data-e="cobrar" data-id="${f.id}">💶 Cobrar</button>
          <button class="ghost" data-e="parcial" data-id="${f.id}">+ Parcial</button>
          <button class="ghost" data-e="pdf" data-id="${f.id}">PDF</button>
        </div>`;
      cont.appendChild(div);
    });

    cont.querySelectorAll('button').forEach(b=>{
      const id=b.dataset.id;
      b.onclick = async ()=>{
        const f = facturas[id]; if(!f) return;
        if(b.dataset.e==='ver'){
          // volcar factura en PDF preview
          $('#cliNombre').value = f.cliente?.nombre||'';
          $('#cliNif').value    = f.cliente?.nif||'';
          $('#cliDir').value    = f.cliente?.dir||'';
          $('#cliTel').value    = f.cliente?.tel||'';
          $('#cliEmail').value  = f.cliente?.email||'';

          $('#provNombre').value= f.proveedor?.nombre||'';
          $('#provNif').value   = f.proveedor?.nif||'';
          $('#provDir').value   = f.proveedor?.dir||'';
          $('#provTel').value   = f.proveedor?.tel||'';
          $('#provEmail').value = f.proveedor?.email||'';

          $('#lineasBody').innerHTML='';
          (f.lineas||[]).forEach(l=> addLinea(l));
          $('#chkTransporte').checked = !!f.flags?.transporte;
          const ivaToggle = ensureIvaToggle();
          ivaToggle.checked = !!f.flags?.iva4;

          $('#pagado').value = f.totals?.pagado||0;
          $('#estado').value = f.estado||'pendiente';
          $('#metodoPago').value = f.metodo||'Efectivo';
          $('#observaciones').value = f.obs||'';

          recalc();
          document.querySelector('[data-tab="factura"]').click();
          document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
        }else if(b.dataset.e==='cobrar'){
          const tot=f.totals?.total||0;
          f.totals.pagado = tot;
          f.totals.pendiente = 0;
          f.estado='pagado';
          facturas[id]=f; saveLocal(); await cloudSet('arslan_pro_v104/facturas', facturas);
          renderFacturas(); renderPendientes(); renderVentas();
        }else if(b.dataset.e==='parcial'){
          const max=(f.totals?.total||0) - (f.totals?.pagado||0);
          const val = parseFloat(prompt(`Importe abonado (pendiente ${money(max)}):`)||'0');
          if(val>0){
            f.totals.pagado = (f.totals.pagado||0) + val;
            f.totals.pendiente = Math.max(0,(f.totals.total||0)-f.totals.pagado);
            f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
            facturas[id]=f; saveLocal(); await cloudSet('arslan_pro_v104/facturas', facturas);
            renderFacturas(); renderPendientes(); renderVentas();
          }
        }else if(b.dataset.e==='pdf'){
          // mostrar y descargar
          fillPrint(f.lineas, f.totals, f);
          const dt=new Date(f.fecha);
          const filename=`Factura-${(f.cliente?.nombre||'Cliente').replace(/\s+/g,'')}-${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}.pdf`;
          const opt={ margin:[10,10,10,10], filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
          window.html2pdf().set(opt).from(document.getElementById('printArea')).save();
        }
      };
    });
  }
  $('#filtroEstado')?.addEventListener('input', renderFacturas);
  $('#buscaCliente')?.addEventListener('input', renderFacturas);

  /* ===========================================================
     🧾 PENDIENTES (tabla + resets)
  ========================================================== */
  function renderPendientes(){
    const tb=$('#tblPendientes tbody'); if(!tb) return;
    tb.innerHTML='';
    const map=new Map(); // cliente -> {count,total,lastDate,ids[]}
    Object.values(facturas).forEach(f=>{
      const pend=f.totals?.pendiente||0; if(pend<=0) return;
      const nom=f.cliente?.nombre||'(s/cliente)';
      const cur=map.get(nom)||{count:0,total:0,lastDate:null,ids:[]};
      cur.count++; cur.total+=pend; cur.ids.push(f.id);
      cur.lastDate = !cur.lastDate || new Date(f.fecha)>new Date(cur.lastDate) ? f.fecha : cur.lastDate;
      map.set(nom,cur);
    });
    let global=0;
    [...map.entries()].sort((a,b)=>b[1].total-a[1].total).forEach(([nom,info])=>{
      global+=info.total;
      const tr=document.createElement('tr');
      const color = info.total>500 ? 'state-red' : info.total>=100 ? 'state-amber' : 'state-green';
      tr.innerHTML=`
        <td>${nom}</td>
        <td>${info.count}</td>
        <td><span class="state-badge ${color}">${money(info.total)}</span></td>
        <td>${new Date(info.lastDate).toLocaleString()}</td>
        <td>
          <button class="ghost" data-e="ver" data-c="${encodeURIComponent(nom)}">Ver</button>
          <button data-e="reset" data-c="${encodeURIComponent(nom)}">✔ Marcar pagado</button>
        </td>
      `;
      tb.appendChild(tr);
    });
    $('#resGlobal').textContent = money(global);

    tb.querySelectorAll('button').forEach(b=>{
      const nom = decodeURIComponent(b.dataset.c||'');
      b.onclick = async ()=>{
        if(b.dataset.e==='ver'){
          $('#buscaCliente').value = nom;
          document.querySelector('[data-tab="facturas"]').click();
          renderFacturas();
        }else{
          if(!confirm(`Marcar todo lo pendiente de "${nom}" como pagado?`)) return;
          // actualizar facturas de ese cliente
          Object.values(facturas).forEach(f=>{
            if((f.cliente?.nombre||'')===nom){
              f.totals.pagado = f.totals.total||0;
              f.totals.pendiente = 0;
              f.estado = 'pagado';
            }
          });
          saveLocal(); await cloudSet('arslan_pro_v104/facturas', facturas);
          renderPendientes(); renderFacturas(); renderVentas();
        }
      };
    });

    // botones globales existentes
    $('#btnResetCliente')?.addEventListener('click', ()=>{
      alert('Usa el botón "✔ Marcar pagado" de la fila del cliente en la tabla de pendientes.');
    });
    $('#btnResetGlobal')?.onclick = async ()=>{
      if(!confirm('Marcar TODAS las facturas como pagadas?')) return;
      // descarga backup antes
      downloadJSON(facturas, `backup-facturas-${new Date().toISOString().slice(0,10)}.json`);
      Object.values(facturas).forEach(f=>{
        f.totals.pagado=f.totals.total||0; f.totals.pendiente=0; f.estado='pagado';
      });
      saveLocal(); await cloudSet('arslan_pro_v104/facturas', facturas);
      renderPendientes(); renderFacturas(); renderVentas();
    };
  }

  /* ===========================================================
     📈 VENTAS (KPIs + gráficas + export)
  ========================================================== */
  function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
  function startOfWeek(d=new Date()){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
  function startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1); }

  function sumBetween(d1,d2){
    let sum=0; Object.values(facturas).forEach(f=>{ const d=new Date(f.fecha); if(d>=d1 && d<=d2) sum+=(f.totals?.total||0); });
    return sum;
  }

  function drawKPIs(){
    const now=new Date();
    const hoy = sumBetween(startOfDay(now), endOfDay(now));
    const semana = sumBetween(startOfWeek(now), endOfDay(now));
    const mes = sumBetween(startOfMonth(now), endOfDay(now));
    const total = Object.values(facturas).reduce((a,f)=>a+(f.totals?.total||0),0);
    ['vHoy','rHoy'].forEach(id=>$('#'+id).textContent=money(hoy));
    ['vSemana','rSemana'].forEach(id=>$('#'+id).textContent=money(semana));
    ['vMes','rMes'].forEach(id=>$('#'+id).textContent=money(mes));
    ['vTotal','rTotal'].forEach(id=>$('#'+id).textContent=money(total));
  }

  let chart1, chart2, chartTop;
  function groupDaily(n=7){
    const now=new Date(); const buckets=[];
    for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10); buckets.push({k,label:k.slice(5),sum:0}); }
    Object.values(facturas).forEach(f=>{ const k=f.fecha.slice(0,10); const b=buckets.find(x=>x.k===k); if(b) b.sum+=(f.totals?.total||0); });
    return buckets;
  }
  function groupMonthly(n=12){
    const now=new Date(); const buckets=[];
    for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setMonth(d.getMonth()-i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; buckets.push({k,label:k,sum:0}); }
    Object.values(facturas).forEach(f=>{ const d=new Date(f.fecha); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const b=buckets.find(x=>x.k===k); if(b) b.sum+=(f.totals?.total||0); });
    return buckets;
  }

  function drawCharts(){
    if(typeof Chart==='undefined') return;
    const daily=groupDaily(7); const monthly=groupMonthly(12);
    if(chart1) chart1.destroy(); if(chart2) chart2.destroy();
    const c1 = document.getElementById('chartDiario'); if(c1){
      chart1 = new Chart(c1.getContext('2d'), {type:'bar', data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
    }
    const c2 = document.getElementById('chartMensual'); if(c2){
      chart2 = new Chart(c2.getContext('2d'), {type:'line', data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
    }
  }

  function drawTop(){
    if(typeof Chart==='undefined') return;
    const map=new Map();
    Object.values(facturas).forEach(f=>{
      (f.lineas||[]).forEach(l=>{
        const amt = (l.mode==='unidad') ? l.qty*l.price : l.net*l.price;
        map.set(l.name,(map.get(l.name)||0)+amt);
      });
    });
    const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    const labels=pairs.map(p=>p[0]); const data=pairs.map(p=>p[1]);
    if(chartTop) chartTop.destroy();
    const c = document.getElementById('chartTop');
    if(c){
      chartTop=new Chart(c.getContext('2d'), {type:'bar', data:{labels, datasets:[{label:'Top productos (€)', data}]}, options:{responsive:true, plugins:{legend:{display:false}}}});
    }
  }

  function renderVentas(){
    drawKPIs(); drawCharts(); drawTop();
    // tabla por cliente (mes)
    const tb=$('#tblVentasCliente tbody'); if(!tb) return;
    tb.innerHTML='';
    const now=new Date();
    const sDay=startOfDay(now), eDay=endOfDay(now);
    const sWeek=startOfWeek(now), eWeek=endOfDay(now);
    const sMonth=startOfMonth(now), eMonth=endOfDay(now);

    const byClient=new Map();
    Object.values(facturas).forEach(f=>{
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
      tr.innerHTML=`<td>${nom}</td><td class="${highlight}">${money(v.hoy)}</td><td>${money(v.semana)}</td><td>${money(v.mes)}</td><td><strong>${money(v.total)}</strong></td>`;
      tb.appendChild(tr);
    });
  }

  // Export CSV
  function exportVentasCSV(){
    const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
    Object.values(facturas).forEach(f=>{
      rows.push([f.cliente?.nombre||'', new Date(f.fecha).toLocaleString(), f.numero, (f.totals?.total||0), (f.totals?.pagado||0), (f.totals?.pendiente||0), f.estado]);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ventas.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  $('#btnExportVentas')?.addEventListener('click', exportVentasCSV);

  // Reset VENTAS (opcional, añade un botón si no existe)
  function ensureResetVentasButton(){
    if(document.getElementById('btnResetVentas')) return;
    const resumenPanel = document.querySelector('[data-tab-panel="resumen"] .row.actions');
    if(!resumenPanel) return;
    const btn = document.createElement('button');
    btn.id='btnResetVentas';
    btn.className='ghost';
    btn.textContent='Reset ventas (archiva y limpia)';
    resumenPanel.appendChild(btn);
    btn.onclick = async ()=>{
      if(!confirm('Se hará un BACKUP JSON y se limpiarán TODAS las facturas. Continuar?')) return;
      downloadJSON(facturas, `backup-facturas-${new Date().toISOString().slice(0,10)}.json`);
      facturas = {}; saveLocal(); await cloudSet('arslan_pro_v104/facturas', facturas);
      renderFacturas(); renderPendientes(); renderVentas();
      alert('Ventas reseteadas. Backup descargado.');
    };
  }
  ensureResetVentasButton();
