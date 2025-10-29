/* ===========================================================
   ARSLAN PRO V10.4 — KIWI Edition
   app.js — Base completa con Firebase Upload-Only + Logo Kiwi
   =========================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- HELPERS ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const money = n => (isNaN(n) ? 0 : n).toFixed(2).replace('.', ',') + ' €';
  const parseNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
  const nowISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => 'FA-' + new Date().toISOString().replace(/\D/g, '').slice(0, 12);

  /* ---------- VARIABLES GLOBALES ---------- */
  let clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  let productos = JSON.parse(localStorage.getItem('productos') || '[]');
  let facturas = JSON.parse(localStorage.getItem('facturas') || '[]');
  let priceHist = JSON.parse(localStorage.getItem('priceHist') || '{}');
/* ---------- AUTO RESTORE desde Firebase si localStorage está vacío ---------- */
(async () => {
  try {
    // Evita ejecutar dos veces
    if (window._restoreDone) return;
    window._restoreDone = true;

    if ((!clientes || !clientes.length) || (!productos || !productos.length)) {
      console.log('🔄 Restaurando datos desde Firebase...');
      const res = await fetch("https://arslan-pro-kiwi-default-rtdb.europe-west1.firebasedatabase.app/arslan_pro_v104.json");
      const data = await res.json();

      if (data && (data.clientes?.length || data.productos?.length)) {
        clientes = data.clientes || [];
        productos = data.productos || [];
        if (data.facturas) facturas = data.facturas;
        if (data.priceHist) priceHist = data.priceHist;

        localStorage.setItem('clientes', JSON.stringify(clientes));
        localStorage.setItem('productos', JSON.stringify(productos));
        localStorage.setItem('facturas', JSON.stringify(facturas));
        localStorage.setItem('priceHist', JSON.stringify(priceHist));

        console.log('✅ Datos restaurados automáticamente desde Firebase');
      } else {
        console.log('⚠️ No se encontraron datos válidos en Firebase');
      }
    }
  } catch (err) {
    console.warn('⚠️ Error al restaurar desde Firebase:', err);
  }
})();



  let lineas = [];
  let pagos = [];

  /* ---------- FIREBASE CONFIG (Upload Only) ---------- */
  const firebaseConfig = {
    databaseURL: "https://arslan-pro-kiwi-default-rtdb.europe-west1.firebasedatabase.app"
  };
// Evita duplicar inicialización
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
const db = firebase.database();


  const syncRef = db.ref('arslan_pro_v104');

  const syncDot = $('#syncDot');
  const syncText = $('#syncText');

  function setSyncState(state) {
    const el = $('#syncIndicator');
    el.classList.remove('sync-ok','sync-error');
    if (state === 'ok') { el.classList.add('sync-ok'); syncText.textContent = 'Synced'; }
    else if (state === 'error') { el.classList.add('sync-error'); syncText.textContent = 'Error'; }
    else { syncText.textContent = 'Sync'; }
  }

  async function firebaseUpload() {
    try {
      setSyncState('...');
      const data = { clientes, productos, facturas, priceHist, ts: Date.now() };
      await syncRef.set(data);
      setSyncState('ok');
    } catch (e) {
      console.error('Firebase upload error', e);
      setSyncState('error');
    }
  }

  // Auto-sync cada 60s y tras guardar factura
  setInterval(firebaseUpload, 60000);

  /* ---------- GUARDAR EN LOCAL Y FIREBASE ---------- */
  function saveAll() {
    localStorage.setItem('clientes', JSON.stringify(clientes));
    localStorage.setItem('productos', JSON.stringify(productos));
    localStorage.setItem('facturas', JSON.stringify(facturas));
    localStorage.setItem('priceHist', JSON.stringify(priceHist));
    firebaseUpload(); // solo subida
  }

  /* ---------- PESTAÑAS ---------- */
  $$('.tab').forEach(btn=>{
    btn.onclick=()=>{
      $$('.tab').forEach(t=>t.classList.remove('active'));
      btn.classList.add('active');
      const tab=btn.dataset.tab;
      $$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.tabPanel===tab));
    };
  });

  /* ---------- CLIENTES ---------- */
  function renderClientes() {
    const lista = $('#listaClientes');
    lista.innerHTML = '';
    clientes.forEach((c,i)=>{
      const div=document.createElement('div');
      div.className='item';
      div.innerHTML=`<span>${c.nombre}</span><span>${c.nif||''}</span>`;
      div.onclick=()=>{
        // al seleccionar cliente desde listado
        loadCliente(i);
        $('.tab[data-tab="factura"]').click();
      };
      lista.appendChild(div);
    });
    // refrescar selector principal
    const sel=$('#selCliente');
    sel.innerHTML='<option value="">— Seleccionar —</option>';
    clientes.forEach((c,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=c.nombre; sel.appendChild(o); });
  }

  function loadCliente(i){
    const c=clientes[i];
    if(!c) return;
    $('#selCliente').value=i;
    $('#cliNombre').value=c.nombre||'';
    $('#cliNif').value=c.nif||'';
    $('#cliDir').value=c.dir||'';
    $('#cliTel').value=c.tel||'';
    $('#cliEmail').value=c.email||'';
  }

  $('#selCliente').onchange=()=>{
    const i=parseInt($('#selCliente').value);
    if(!isNaN(i)) loadCliente(i);
  };

  $('#btnAddCliente').onclick=()=>{
    const nombre=prompt('Nombre cliente:');
    if(!nombre) return;
    const nuevo={nombre,nif:'',dir:'',tel:'',email:''};
    clientes.push(nuevo);
    saveAll();
    renderClientes();
  };

  $('#btnNuevoCliente').onclick=()=>{$('.tab[data-tab="clientes"]').click();};

  /* ---------- PRODUCTOS ---------- */
  function renderProductos(){
    const lista=$('#listaProductos');
    lista.innerHTML='';
    productos.forEach((p,i)=>{
      const row=document.createElement('div');
      row.className='product-row';
      row.innerHTML=`
        <span>${p.nombre}</span>
        <span>${p.modo||''}</span>
        <span>${p.kgCaja||''}</span>
        <span>${p.precio||''}</span>
        <span>${p.origen||''}</span>
        <button data-i="${i}" class="edit">✎</button>
        <button data-i="${i}" class="del">🗑</button>`;
      lista.appendChild(row);
    });
  }

  $('#btnAddProducto').onclick=()=>{
    const nombre=prompt('Nombre producto:');
    if(!nombre) return;
    const nuevo={nombre,modo:'kg',kgCaja:0,precio:0,origen:''};
    productos.push(nuevo);
    saveAll();
    renderProductos();
  };

  /* ---------- FACTURA ---------- */
  function nuevaFactura(){
    lineas=[];
    pagos=[];
    $('#lineasBody').innerHTML='';
    $('#subtotal').textContent='0,00 €';
    $('#transp').textContent='0,00 €';
    $('#iva').textContent='0,00 €';
    $('#total').textContent='0,00 €';
    $('#pendiente').textContent='0,00 €';
    $('#listaPagos').innerHTML='';
    $('#pagado').value='';
    $('#estado').value='pendiente';
    $('#metodoPago').value='Efectivo';
    $('#observaciones').value='';
  }
  $('#btnNueva').onclick=nuevaFactura;
  nuevaFactura();

  $('#btnAddLinea').onclick=()=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input list="productNamesList" class="prod" /></td>
      <td><select class="modo"><option>kg</option><option>caja</option><option>ud</option><option>manojo</option></select></td>
      <td><input type="number" class="cant" value="1" /></td>
      <td><input type="number" class="bruto" /></td>
      <td><input type="number" class="tara" /></td>
      <td><input type="number" class="neto" /></td>
      <td><input type="number" class="precio" /></td>
      <td><input class="origen" /></td>
      <td class="importe">0,00 €</td>
      <td><button class="del">✖</button></td>`;
    $('#lineasBody').appendChild(tr);
  };

  $('#btnVaciarLineas').onclick=()=>{$('#lineasBody').innerHTML='';};
  /* ---------- AUTOCOMPLETADO PRODUCTOS + DATALIST ---------- */
  function refreshProductDatalist(){
    const dl = $('#productNamesList');
    dl.innerHTML = '';
    (productos||[]).forEach(p=>{
      const opt=document.createElement('option');
      opt.value = p.nombre || p.name || '';
      dl.appendChild(opt);
    });
  }

  // Último precio registrado por producto (priceHist: { "Tomate": [{price, date}, ...] })
  function lastPrice(name){
    const arr = priceHist?.[name] || [];
    return arr.length ? arr[0].price : null;
  }
  function pushPriceHistory(name, price){
    if(!name || !(price>0)) return;
    const arr = priceHist[name] || [];
    arr.unshift({price, date: new Date().toISOString()});
    priceHist[name] = arr.slice(0,10);
    saveAll();
  }

  // Panel flotante con historial (aparece unos segundos)
  let ppTimer=null;
  function showPriceHistory(name){
    const panel = $('#pricePanel');
    const body = $('#ppBody');
    if(!panel || !body) return;
    const hist = priceHist?.[name] || [];
    panel.hidden = false;
    if(hist.length===0){
      body.innerHTML = `<div class="pp-row"><span>${name}</span><strong>Sin datos</strong></div>`;
    }else{
      body.innerHTML = `<div class="pp-row" style="justify-content:center"><strong>${name}</strong></div>` +
        hist.map(h=>`<div class="pp-row"><span>${new Date(h.date).toLocaleDateString()}</span><strong>${money(h.price)}</strong></div>`).join('');
    }
    if(ppTimer) clearTimeout(ppTimer);
    ppTimer = setTimeout(()=>{ panel.hidden = true; }, 4500);
  }

  /* ---------- RECALCULO DE LÍNEAS Y TOTALES ---------- */
  function captureLineas(){
    const rows = $$('#lineasBody tr');
    const out = [];
    rows.forEach(r=>{
      const prod = r.querySelector('.prod')?.value?.trim() || '';
      const modo = r.querySelector('.modo')?.value || 'kg';
      const cant = parseNum(r.querySelector('.cant')?.value || 0);
      const bruto = parseNum(r.querySelector('.bruto')?.value || 0);
      const tara  = parseNum(r.querySelector('.tara')?.value || 0);
      const neto  = parseNum(r.querySelector('.neto')?.value || 0);
      const precio= parseNum(r.querySelector('.precio')?.value || 0);
      const origen= r.querySelector('.origen')?.value?.trim() || '';

      // Cálculo de neto si no lo ponen (si hay bruto/tara → neto=bruto-tara; si modo=caja y hay kgCaja, neto=cant*kgCaja)
      let n = neto;
      if((bruto>0 || tara>0) && (bruto - tara) >= 0) n = +(bruto - tara).toFixed(2);
      if(n<=0){
        if(modo==='caja'){
          const p = productos.find(x => (x.nombre||'').toLowerCase() === prod.toLowerCase());
          const kgCaja = p?.kgCaja || 0;
          if(kgCaja>0) n = +(kgCaja * cant).toFixed(2);
        }else if(modo==='kg'){
          n = cant;
        }else{ // unidad / manojo
          n = cant;
        }
      }

      const importe = (modo==='ud' || modo==='manojo') ? (cant * precio) : (n * precio);

      // render importe
      const impCell = r.querySelector('.importe');
      if(impCell) impCell.textContent = money(isFinite(importe)?importe:0);

      out.push({ nombre:prod, modo, cant, bruto, tara, neto:n, precio, origen, importe: isFinite(importe)?importe:0 });
    });
    return out.filter(l => l.nombre && (l.cant>0 || l.neto>0 || l.bruto>0));
  }

  function recalc(){
    const ls = captureLineas();

    // Subtotal SIN transporte (como pediste)
    let subtotal = ls.reduce((a,l) => a + (l.importe||0), 0);

    // Transporte 10% (opcional)
    const aplicaTrans = $('#chkTransporte')?.checked;
    const transporte = aplicaTrans ? +(subtotal * 0.10).toFixed(2) : 0;

    // IVA 4% (aplicable si marcas "Aplicar IVA 4%")
    const ivaAplicado = $('#chkIvaAplicado')?.checked;
    const baseMasTrans = subtotal + transporte;
    const iva = ivaAplicado ? +(baseMasTrans * 0.04).toFixed(2) : 0;

    // Total
    const total = +(baseMasTrans + iva).toFixed(2);

    // Pagos
    const manual = parseNum($('#pagado')?.value || 0);
    const parciales = pagos.reduce((a,b)=>a + (b.amount||0),0);
    const pagado = +(manual + parciales).toFixed(2);
    const pendiente = +(Math.max(0, total - pagado)).toFixed(2);

    // Pintar totales
    $('#subtotal').textContent = money(subtotal);
    $('#transp').textContent   = money(transporte);
    $('#iva').textContent      = money(iva);
    $('#total').textContent    = money(total);
    $('#pendiente').textContent= money(pendiente);

    // Estado sugerido
    if(total<=0){ $('#estado').value='pendiente'; }
    else if(pagado<=0){ $('#estado').value='pendiente'; }
    else if(pagado<total){ $('#estado').value='parcial'; }
    else { $('#estado').value='pagado'; }

    // Pie PDF: si se aplica IVA 4%, NO mostrar “IVA incluido…”
    const foot = $('#pdf-foot-note');
    if(foot){
      if(ivaAplicado){
        foot.textContent = '';
      }else{
        const infoIncluido = $('#chkIvaIncluido')?.checked;
        foot.textContent = infoIncluido ? 'IVA incluido en los precios.' : '';
      }
    }

    // Rellenar la vista previa PDF
    fillPrintPreview(ls, {subtotal, transporte, iva, total});
  }

  // Eventos que fuerzan recálculo
  ['chkTransporte','chkIvaAplicado','chkIvaIncluido','pagado','estado','metodoPago','observaciones']
    .forEach(id => { const el=$('#'+id); if(el) el.addEventListener('input', recalc); });

  // Delegación de eventos en la tabla para inputs
  $('#lineasBody').addEventListener('input', e=>{
    const target = e.target;
    if(target.matches('.prod')){
      const name = target.value.trim();
      // autocargar precio/props si existe en catálogo
      const p = productos.find(x => (x.nombre||'').toLowerCase() === name.toLowerCase());
      const row = target.closest('tr');
      if(p){
        const modoEl = row.querySelector('.modo');
        const precioEl = row.querySelector('.precio');
        const origenEl = row.querySelector('.origen');
        if(p.modo && modoEl) modoEl.value = p.modo;
        const lp = lastPrice(p.nombre);
        if(precioEl){
          if(p.precio>0) precioEl.value = p.precio;
          else if(lp!=null) precioEl.value = lp;
        }
        if(origenEl && p.origen) origenEl.value = p.origen;
        showPriceHistory(p.nombre);
      }else{
        showPriceHistory(name);
      }
    }
    recalc();
  });

  // Eliminar línea
  $('#lineasBody').addEventListener('click', e=>{
    if(e.target.matches('.del')){
      e.target.closest('tr')?.remove();
      recalc();
    }
  });

  /* ---------- PREVIEW / PDF ---------- */
  function fillPrintPreview(lines, totals, fact=null){
    // Número / Fecha
    $('#p-num').textContent   = fact?.numero || '(Sin guardar)';
    $('#p-fecha').textContent = fact?.fecha  ? new Date(fact.fecha).toLocaleString() : new Date().toLocaleString();

    // Proveedor
    $('#p-prov').innerHTML = `
      <div><strong>${($('#provNombre').value||'')}</strong></div>
      <div>${($('#provNif').value||'')}</div>
      <div>${($('#provDir').value||'')}</div>
      <div>${($('#provTel').value||'')} · ${($('#provEmail').value||'')}</div>
    `;

    // Cliente
    $('#p-cli').innerHTML = `
      <div><strong>${($('#cliNombre').value||'')}</strong></div>
      <div>${($('#cliNif').value||'')}</div>
      <div>${($('#cliDir').value||'')}</div>
      <div>${($('#cliTel').value||'')} · ${($('#cliEmail').value||'')}</div>
    `;

    // Tabla
    const tbody = $('#p-tabla tbody');
    tbody.innerHTML = '';
    (lines||[]).forEach(l=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${l.nombre}</td>
        <td>${l.modo}</td>
        <td>${l.cant||''}</td>
        <td>${l.bruto?l.bruto.toFixed(2):''}</td>
        <td>${l.tara?l.tara.toFixed(2):''}</td>
        <td>${l.neto?l.neto.toFixed(2):''}</td>
        <td>${money(l.precio||0)}</td>
        <td>${l.origen||''}</td>
        <td>${money(l.importe||0)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Totales
    $('#p-sub').textContent = money(totals?.subtotal||0);
    $('#p-tra').textContent = money(totals?.transporte||0);
    $('#p-iva').textContent = money(totals?.iva||0);
    $('#p-tot').textContent = money(totals?.total||0);
    $('#p-estado').textContent = $('#estado')?.value || 'Impagada';
    $('#p-metodo').textContent = $('#metodoPago')?.value || 'Efectivo';
    $('#p-obs').textContent    = $('#observaciones')?.value || '—';

    // QR (nº factura | cliente | total | estado)
    try{
      const canvas = $('#p-qr');
      const numero = fact?.numero || '(Sin guardar)';
      const cliente= $('#cliNombre').value || '';
      const total  = totals?.total || 0;
      const estado = $('#estado').value;
      const payload = `ARSLAN|${numero}|${cliente}|${total}|${estado}`;
      if(window.QRCode && canvas){
        window.QRCode.toCanvas(canvas, payload, { width: 92, margin: 0 });
      }
    }catch(e){}
  }

  $('#btnImprimir').onclick = ()=>{
    recalc(); // asegurar totales al día
    const el = document.getElementById('printArea');
    const d = new Date();
    const file = `Factura-${($('#cliNombre').value||'Cliente').replace(/\s+/g,'')}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.pdf`;
    const opt = {
      margin:[10,10,10,10],
      filename:file,
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };
    window.html2pdf().set(opt).from(el).save();
  };

  /* ---------- PAGOS PARCIALES ---------- */
  function renderPagos(){
    const list = $('#listaPagos');
    list.innerHTML = '';
    if(pagos.length===0){
      list.innerHTML = `<div class="item">Sin pagos parciales.</div>`;
      return;
    }
    pagos.forEach((p,i)=>{
      const div=document.createElement('div');
      div.className='item';
      div.innerHTML = `<div>${new Date(p.date).toLocaleString()} · <strong>${money(p.amount)}</strong></div>
                       <button class="ghost" data-i="${i}">✖</button>`;
      div.querySelector('button').onclick=()=>{
        pagos.splice(i,1);
        renderPagos();
        recalc();
        saveAll();
      };
      list.appendChild(div);
    });
  }

  $('#btnAddPago').onclick = ()=>{
    const val = parseNum($('#inpPagoParcial').value || 0);
    if(!(val>0)) return;
    pagos.unshift({date:new Date().toISOString(), amount: val});
    $('#inpPagoParcial').value='';
    renderPagos();
    recalc();
    saveAll();
  };
  /* ---------- GUARDAR FACTURA ---------- */
  function genNum() { return uid(); }

  $('#btnGuardar').onclick = ()=>{
    const ls = captureLineas();
    if(ls.length===0){ alert('Añade al menos una línea.'); return; }

    // Empujar historial de precios
    ls.forEach(l=> pushPriceHistory(l.nombre, l.precio||0));

    // Recalcular para asegurar totales
    recalc();

    const numero = genNum();
    const fecha  = new Date().toISOString();

    const subtotal   = parseFloat(String($('#subtotal').textContent).replace(/[^\d.,]/g,'').replace(',','.'))||0;
    const transporte = parseFloat(String($('#transp').textContent).replace(/[^\d.,]/g,'').replace(',','.'))||0;
    const iva        = parseFloat(String($('#iva').textContent).replace(/[^\d.,]/g,'').replace(',','.'))||0;
    const total      = parseFloat(String($('#total').textContent).replace(/[^\d.,]/g,'').replace(',','.'))||0;

    const manual = parseNum($('#pagado').value||0);
    const parciales = pagos.reduce((a,b)=>a+(b.amount||0),0);
    const pagado = +(manual + parciales).toFixed(2);
    const pendiente = +(Math.max(0,total - pagado)).toFixed(2);

    const factura = {
      numero, fecha,
      proveedor:{
        nombre: $('#provNombre').value || '',
        nif:    $('#provNif').value    || '',
        dir:    $('#provDir').value    || '',
        tel:    $('#provTel').value    || '',
        email:  $('#provEmail').value  || '',
      },
      cliente:{
        nombre: $('#cliNombre').value || '',
        nif:    $('#cliNif').value    || '',
        dir:    $('#cliDir').value    || '',
        tel:    $('#cliTel').value    || '',
        email:  $('#cliEmail').value  || '',
      },
      lineas: ls,
      flags:{
        transporte: !!$('#chkTransporte').checked,
        ivaAplicado: !!$('#chkIvaAplicado').checked,
        ivaIncluidoMsg: !!$('#chkIvaIncluido')?.checked
      },
      estado: $('#estado').value || 'pendiente',
      metodo: $('#metodoPago').value || 'Efectivo',
      obs:    $('#observaciones').value || '',
      pagos:  [...pagos],
      totals:{ subtotal, transporte, iva, total, pagado, pendiente }
    };

    // Ajustar estado consistente
    if(total<=0) factura.estado='pendiente';
    else if(pagado<=0) factura.estado='pendiente';
    else if(pagado<total) factura.estado='parcial';
    else factura.estado='pagado';

    facturas.unshift(factura);
    saveAll();

    // Reset pagos parciales temporales
    pagos = [];
    renderPagos();

    alert(`Factura ${numero} guardada.`);
    renderFacturas();
    renderPendientes();
    drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();

    // Rellenar preview con la factura recién guardada
    fillPrintPreview(factura.lineas, factura.totals, factura);
  };

  /* ---------- LISTA DE FACTURAS ---------- */
  function badgeEstado(f){
    const t=f.totals?.total||0, p=f.totals?.pagado||0;
    if(p>=t) return `<span class="state-badge state-green">Pagada</span>`;
    if(p>0 && p<t) return `<span class="state-badge state-amber">Parcial</span>`;
    return `<span class="state-badge state-red">Impagada</span>`;
  }

  function renderFacturas(){
    const cont = $('#listaFacturas');
    if(!cont) return;
    cont.innerHTML = '';

    const q  = ($('#buscaCliente')?.value||'').toLowerCase();
    const fe = $('#filtroEstado')?.value || 'todas';

    let arr = facturas.slice();
    if(fe!=='todas') arr = arr.filter(f=>f.estado===fe);
    if(q) arr = arr.filter(f => (f.cliente?.nombre||'').toLowerCase().includes(q));

    if(arr.length===0){ cont.innerHTML = '<div class="item">No hay facturas.</div>'; return; }

    arr.slice(0,400).forEach((f,idx)=>{
      const fecha = new Date(f.fecha).toLocaleString();
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        <div>
          <strong>${f.numero}</strong> ${badgeEstado(f)}
          <div class="muted">${fecha} · ${f.cliente?.nombre||''}</div>
        </div>
        <div class="row">
          <strong>${money(f.totals?.total||0)}</strong>
          <button class="ghost" data-e="ver" data-i="${idx}">Ver</button>
          <button data-e="cobrar" data-i="${idx}">💶 Cobrar</button>
          <button class="ghost" data-e="parcial" data-i="${idx}">+ Parcial</button>
          <button class="ghost" data-e="pdf" data-i="${idx}">PDF</button>
        </div>`;
      cont.appendChild(div);
    });

    cont.querySelectorAll('button').forEach(b=>{
      const i = +b.dataset.i;
      b.onclick = ()=>{
        const f = facturas[i]; if(!f) return;

        if(b.dataset.e==='ver'){
          // Cargar a la vista de impresión
          fillPrintPreview(f.lineas, f.totals, f);
          document.querySelector('.tab[data-tab="factura"]').click();
          document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});

        }else if(b.dataset.e==='cobrar'){
          const tot = f.totals.total||0;
          f.totals.pagado = tot;
          f.totals.pendiente = 0;
          f.estado = 'pagado';
          (f.pagos??=[]).push({date:new Date().toISOString(), amount: tot});
          saveAll();
          renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();

        }else if(b.dataset.e==='parcial'){
          const max = (f.totals.total||0) - (f.totals.pagado||0);
          const val = parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
          if(val>0){
            f.pagos = f.pagos || [];
            f.pagos.push({date:new Date().toISOString(), amount: val});
            f.totals.pagado = +( (f.totals.pagado||0) + val ).toFixed(2);
            f.totals.pendiente = +( Math.max(0,(f.totals.total||0) - f.totals.pagado) ).toFixed(2);
            f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
            saveAll();
            renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
          }

        }else if(b.dataset.e==='pdf'){
          // Forzar render de la factura seleccionada y descargar PDF
          fillPrintPreview(f.lineas, f.totals, f);
          const el = document.getElementById('printArea');
          const dt = new Date(f.fecha);
          const nombreCliente=(f.cliente?.nombre||'Cliente').replace(/\s+/g,'');
          const filename=`Factura-${nombreCliente}-${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}.pdf`;
          const opt={ margin:[10,10,10,10], filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
          window.html2pdf().set(opt).from(el).save();
        }
      };
    });
  }

  $('#filtroEstado')?.addEventListener('input', renderFacturas);
  $('#buscaCliente')?.addEventListener('input', renderFacturas);

  /* ---------- PENDIENTES POR CLIENTE ---------- */
  function renderPendientes(){
    const tb = $('#tblPendientes tbody');
    if(!tb) return;
    tb.innerHTML='';

    const map = new Map(); // nombre -> {count,total,lastDate}
    facturas.forEach(f=>{
      const pend = f.totals?.pendiente||0;
      if(pend<=0) return;
      const nom = f.cliente?.nombre || '(s/cliente)';
      const cur = map.get(nom) || {count:0,total:0,lastDate:null};
      cur.count++;
      cur.total += pend;
      cur.lastDate = !cur.lastDate || new Date(f.fecha) > new Date(cur.lastDate) ? f.fecha : cur.lastDate;
      map.set(nom,cur);
    });

    let global=0;
    const rows=[...map.entries()].sort((a,b)=>b[1].total-a[1].total);
    rows.forEach(([nom,info])=>{
      global += info.total;
      const tr=document.createElement('tr');
      const color = info.total>500 ? 'state-red' : info.total>=100 ? 'state-amber' : 'state-green';
      tr.innerHTML = `
        <td>${nom}</td>
        <td>${info.count}</td>
        <td><span class="state-badge ${color}">${money(info.total)}</span></td>
        <td>${new Date(info.lastDate).toLocaleString()}</td>
        <td><button class="ghost" data-c="${nom}">Ver facturas</button></td>`;
      tb.appendChild(tr);
    });
    $('#resGlobal').textContent = money(global);

    tb.querySelectorAll('button').forEach(b=>{
      b.onclick=()=>{
        $('#buscaCliente').value=b.dataset.c||'';
        document.querySelector('.tab[data-tab="facturas"]').click();
        renderFacturas();
      };
    });
  }

  // Reset deudas actuales (cliente visible en formulario)
  $('#btnResetCliente')?.addEventListener('click', ()=>{
    const nombre = $('#cliNombre').value.trim();
    if(!nombre){ alert('Selecciona un cliente primero.'); return; }
    if(!confirm(`Resetear deudas de ${nombre}?`)) return;
    facturas.forEach(f=>{
      if((f.cliente?.nombre||'')===nombre){
        f.totals.pagado = f.totals.total;
        f.totals.pendiente = 0;
        f.estado = 'pagado';
      }
    });
    saveAll();
    renderPendientes(); renderFacturas(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
  });

  // Reset deudas global
  $('#btnResetGlobal')?.addEventListener('click', ()=>{
    if(!confirm('¿Resetear TODAS las deudas (marcar todo como pagado)?')) return;
    facturas.forEach(f=>{
      f.totals.pagado = f.totals.total;
      f.totals.pendiente = 0;
      f.estado = 'pagado';
    });
    saveAll();
    renderPendientes(); renderFacturas(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
  });

  /* ---------- VENTAS / KPIs / GRÁFICAS ---------- */
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
function drawCharts() {
  if (typeof Chart === 'undefined') return;

  // Destruir instancias previas si existen
  if (window.chart1) window.chart1.destroy();
  if (window.chart2) window.chart2.destroy();
  if (window.chartTop) window.chartTop.destroy();

  const daily = groupDaily(7);
  const monthly = groupMonthly(12);

  window.chart1 = new Chart(document.getElementById('chartDiario').getContext('2d'), {
    type: 'bar',
    data: {
      labels: daily.map(d => d.label),
      datasets: [{ label: 'Ventas diarias', data: daily.map(d => d.sum) }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  window.chart2 = new Chart(document.getElementById('chartMensual').getContext('2d'), {
    type: 'line',
    data: {
      labels: monthly.map(d => d.label),
      datasets: [{ label: 'Ventas mensuales', data: monthly.map(d => d.sum) }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}


  function drawTop(){
    if(typeof Chart==='undefined') return;
    const map=new Map(); // name -> total €
    facturas.forEach(f=>{
      (f.lineas||[]).forEach(l=>{
        map.set(l.nombre, (map.get(l.nombre)||0) + (l.importe||0));
      });
    });
    const pairs=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    const labels=pairs.map(p=>p[0]); const data=pairs.map(p=>p[1]);
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
  /* ---------- IMPORT / EXPORT / BACKUP ---------- */
  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function uploadJSON(cb){
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='application/json';
    inp.onchange=e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader();
      r.onload=()=>{
        try{ const obj=JSON.parse(r.result); cb(obj); }
        catch{ alert('JSON inválido'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  // Exportaciones
  $('#btnExportClientes')?.addEventListener('click', ()=>downloadJSON(clientes,'clientes-v104.json'));
  $('#btnExportProductos')?.addEventListener('click', ()=>downloadJSON(productos,'productos-v104.json'));
  $('#btnExportFacturas')?.addEventListener('click', ()=>downloadJSON(facturas,'facturas-v104.json'));

  // Importaciones
  $('#btnImportClientes')?.addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ clientes = arr; saveAll(); renderClientes(); }
  }));
  $('#btnImportProductos')?.addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ productos = arr; saveAll(); renderProductos(); refreshProductDatalist(); }
  }));
  $('#btnImportFacturas')?.addEventListener('click', ()=>uploadJSON(arr=>{
    if(Array.isArray(arr)){ facturas = arr; saveAll(); renderFacturas(); renderPendientes(); drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); }
  }));

  // Backup / Restore
  $('#btnBackup')?.addEventListener('click', ()=>{
    const payload={clientes, productos, facturas, priceHist, ts:new Date().toISOString(), version:'ARSLAN PRO V10.4'};
    downloadJSON(payload, `backup-${new Date().toISOString().slice(0,10)}.json`);
  });
  $('#btnRestore')?.addEventListener('click', ()=>{
    uploadJSON(payload=>{
      try{
        if(payload.clientes) clientes = payload.clientes;
        if(payload.productos) productos = payload.productos;
        if(payload.facturas) facturas = payload.facturas;
        if(payload.priceHist) priceHist = payload.priceHist;
        saveAll();
        renderAll();
        alert('Copia restaurada ✔️');
      }catch{ alert('Archivo de backup inválido'); }
    });
  });

  // Export Ventas CSV
  $('#btnExportVentas')?.addEventListener('click', ()=>{
    const rows=[['Cliente','Fecha','Nº','Total','Pagado','Pendiente','Estado']];
    facturas.forEach(f=>{
      rows.push([
        f.cliente?.nombre||'',
        new Date(f.fecha).toLocaleString(),
        f.numero,
        (f.totals?.total||0).toFixed(2).replace('.',','),
        (f.totals?.pagado||0).toFixed(2).replace('.',','),
        (f.totals?.pendiente||0).toFixed(2).replace('.',','),
        f.estado
      ]);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='ventas.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  /* ---------- BUSCAR LISTAS (Clientes / Productos) ---------- */
  $('#buscarCliente')?.addEventListener('input', ()=>{
    // simple re-render filtrado (renderClientes ya pinta todo, aquí hacemos filtro manual rápido)
    const q=($('#buscarCliente').value||'').toLowerCase();
    const cont=$('#listaClientes'); if(!cont) return;
    cont.innerHTML='';
    clientes
      .filter(c=>(c.nombre||'').toLowerCase().includes(q) || (c.nif||'').toLowerCase().includes(q) || (c.dir||'').toLowerCase().includes(q))
      .forEach((c,i)=>{
        const div=document.createElement('div'); div.className='item';
        div.innerHTML=`<span>${c.nombre}</span><span class="muted">${c.nif||''}</span>`;
        div.onclick=()=>{ loadCliente(i); document.querySelector('.tab[data-tab="factura"]').click(); };
        cont.appendChild(div);
      });
  });

  $('#buscarProducto')?.addEventListener('input', ()=>{
    const q=($('#buscarProducto').value||'').toLowerCase();
    const lista=$('#listaProductos'); if(!lista) return;
    lista.innerHTML='';
    productos
      .filter(p=>(p.nombre||'').toLowerCase().includes(q))
      .forEach((p,i)=>{
        const row=document.createElement('div');
        row.className='product-row';
        row.innerHTML=`
          <input class="p-nombre" value="${p.nombre||''}" />
          <select class="p-modo">
            <option value="">—</option>
            <option value="kg"${p.modo==='kg'?' selected':''}>kg</option>
            <option value="caja"${p.modo==='caja'?' selected':''}>caja</option>
            <option value="ud"${p.modo==='ud'?' selected':''}>ud</option>
            <option value="manojo"${p.modo==='manojo'?' selected':''}>manojo</option>
          </select>
          <input type="number" class="p-kgcaja" step="0.01" placeholder="Kg/caja" value="${p.kgCaja??''}">
          <input type="number" class="p-precio" step="0.01" placeholder="€ base" value="${p.precio??''}">
          <input class="p-origen" placeholder="Origen" value="${p.origen||''}">
          <button class="save" data-i="${i}">💾</button>
          <button class="del" data-i="${i}">✖</button>
        `;
        lista.appendChild(row);
      });
  });

  // Delegación de edición/borrado en productos
  $('#listaProductos')?.addEventListener('click', e=>{
    const i = +e.target.dataset.i;
    if(Number.isNaN(i)) return;
    if(e.target.classList.contains('del')){
      if(confirm('¿Eliminar producto?')){
        productos.splice(i,1);
        saveAll();
        renderProductos(); refreshProductDatalist();
      }
    }else if(e.target.classList.contains('save')){
      const row=e.target.closest('.product-row');
      const get = sel => row.querySelector(sel)?.value ?? '';
      productos[i] = {
        nombre: get('.p-nombre').trim(),
        modo:   get('.p-modo') || '',
        kgCaja: parseNum(get('.p-kgcaja')||0) || 0,
        precio: parseNum(get('.p-precio')||0) || 0,
        origen: get('.p-origen').trim() || ''
      };
      saveAll();
      renderProductos(); refreshProductDatalist();
    }
  });

  /* ---------- RENDER ALL ---------- */
  function renderAll(){
    renderClientes();
    renderProductos();
    renderFacturas();
    renderPendientes();
    drawKPIs(); drawCharts(); drawTop(); renderVentasCliente();
    refreshProductDatalist();
  }

  /* ---------- SEEDS INICIALES (si vacío) ---------- */
  function seedClientes(){
    if((clientes||[]).length) return;
    clientes = [
      {nombre:'Riviera — CONOR ESY SLU', nif:'B16794893', dir:'Paseo del Espolón, Burgos'},
      {nombre:'Alesal Pan / Café de Calle San Lesmes — Alesal Pan y Café S.L.', nif:'B09582420', dir:'C/ San Lesmes 1, Burgos'},
      {nombre:'Golden Garden — David Herrera Estalayo', nif:'71281665L', dir:'Trinidad, 12, 09003 Burgos'},
      {nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'},
      {nombre:'Hotel Cordon'},
      {nombre:'Romina — PREMIER'}
    ];
  }

  function seedProductos(){
    if((productos||[]).length) return;
    productos = [
      {nombre:'TOMATE DANIELA', modo:'kg', precio:0, kgCaja:0, origen:''},
      {nombre:'PLÁTANO CANARIO PRIMERA', modo:'caja', precio:0, kgCaja:22, origen:'Canarias'},
      {nombre:'AGUACATE GRANEL', modo:'kg', precio:0, kgCaja:0, origen:'España'},
      {nombre:'CILANTRO', modo:'manojo', precio:0, kgCaja:0, origen:''},
      {nombre:'LIMA', modo:'caja', precio:0, kgCaja:7, origen:'Brasil'},
      {nombre:'PATATA 10KG', modo:'caja', kgCaja:10, precio:0, origen:'España'}
    ];
  }

  function setProviderDefaults(){
    if(!$('#provNombre').value) $('#provNombre').value='Mohammad Arslan Waris';
    if(!$('#provNif').value)    $('#provNif').value='X6389988J';
    if(!$('#provDir').value)    $('#provDir').value='Calle San Pablo 17, 09003 Burgos';
    if(!$('#provTel').value)    $('#provTel').value='631 667 893';
    if(!$('#provEmail').value)  $('#provEmail').value='shaniwaris80@gmail.com';
  }

  /* ---------- ARRANQUE ---------- */
  (function boot(){
    // Si Firebase SDK no está cargado, evitamos fallos
    try{
      if(!(window.firebase && firebase.apps && firebase.apps.length)){
        // si no hay SDK, evitamos llamadas
        console.warn('Firebase SDK no encontrado: el modo sync quedará desactivado hasta que lo añadas en index.html');
      }
    }catch(e){}

    // Seeds si vacío
    if(!(clientes&&clientes.length)) seedClientes();
    if(!(productos&&productos.length)) seedProductos();

    // Guardamos seeds iniciales para persistir
    saveAll();

    // Proveedor default
    setProviderDefaults();

    // Datalist productos
    refreshProductDatalist();

    // 5 líneas iniciales
    for(let i=0;i<5;i++){
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><input list="productNamesList" class="prod" /></td>
        <td><select class="modo"><option>kg</option><option>caja</option><option>ud</option><option>manojo</option></select></td>
        <td><input type="number" class="cant" value="1" /></td>
        <td><input type="number" class="bruto" /></td>
        <td><input type="number" class="tara" /></td>
        <td><input type="number" class="neto" /></td>
        <td><input type="number" class="precio" /></td>
        <td><input class="origen" /></td>
        <td class="importe">0,00 €</td>
        <td><button class="del">✖</button></td>`;
      $('#lineasBody').appendChild(tr);
    }

    // Render general
    renderAll();
    // Primer recálculo
    recalc();

    // Refrescos por pestañas
    document.querySelector('.tab[data-tab="facturas"]')?.addEventListener('click', renderFacturas);
    document.querySelector('.tab[data-tab="pendientes"]')?.addEventListener('click', renderPendientes);
    document.querySelector('.tab[data-tab="ventas"]')?.addEventListener('click', ()=>{ drawKPIs(); drawCharts(); drawTop(); renderVentasCliente(); });
  })();

});
