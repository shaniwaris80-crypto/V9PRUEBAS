/* ===========================================================
   ARSLAN PRO V10.4 KIWI EDITION — FULL PACK FINAL
   -----------------------------------------------------------
   Funciones incluidas:
   - Gestión completa de facturas, productos y clientes
   - ID único por cliente
   - Redondeo opcional (formato europeo)
   - PDF multipágina con suma y sigue + numeración
   - Backup/Restore + selector de paleta
   - Modo blanco/negro con acento verde
=========================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- CONFIGURACIÓN GENERAL ---------- */
  const formatoEuropeo = true; // cambiar a false para usar formato internacional
  const money = n => {
    n = isNaN(n) ? 0 : Number(n);
    return formatoEuropeo
      ? n.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'
      : n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  };
  const parseNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const genId = (prefix="C") => prefix + Math.random().toString(36).substring(2,9);
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const K_CLIENTES = 'clientes', K_PRODUCTOS = 'productos', K_FACTURAS = 'facturas';

  /* ---------- UTILIDADES ---------- */
  function save(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ console.error(e);} }
  function load(k,fallback){ 
    try{
      const raw = localStorage.getItem(k);
      if(!raw) return fallback;
      const v = JSON.parse(raw);
      return v ?? fallback;
    }catch{return fallback;}
  }

  /* ---------- VARIABLES GLOBALES ---------- */
  let clientes = load(K_CLIENTES, []);
  let productos = load(K_PRODUCTOS, []);
  let facturas = load(K_FACTURAS, []);
  let lineas = [];

  /* ---------- FUNCIÓN DE INICIALIZACIÓN ---------- */
  function renderAll(){
    seedClientesIfEmpty();
    seedProductsIfEmpty();
    renderClientesSelect();
    renderClientesLista();
    renderProductos();
    renderFacturas();
    renderPendientes();
    drawResumen();
    drawCharts();
  }

  /* ---------- SEMILLAS INICIALES ---------- */
  function seedClientesIfEmpty(){
    if(clientes.length) return;
    clientes = [
      {id:genId(),nombre:'Golden Garden — David Herrera Estalayo',nif:'71281665L',dir:'Trinidad, 12, 09003 Burgos'},
      {id:genId(),nombre:'Alesal Pan y Café S.L.',nif:'B09582420',dir:'C/ San Lesmes 1, Burgos'},
      {id:genId(),nombre:'Con/sentidos — Cuevas Palacios Restauración S.L.',nif:'B10694792',dir:'C/ San Lesmes 1, Burgos'},
      {id:genId(),nombre:'Al Pan Pan Burgos S.L.',nif:'B09569344',dir:'C/ Miranda 17, Bajo, Burgos'},
      {id:genId(),nombre:'Restauración Hermanos Marijuán, S.L.U.',nif:'B09425059',dir:'Carretera Logroño Km 102, 09193 Castrillo del Val (Burgos)',provincia:'Burgos',email:'info@restaurantelosbraseros.com'}
    ];
    save(K_CLIENTES,clientes);
  }

  function seedProductsIfEmpty(){
    if(productos.length) return;
    productos = [
      {nombre:'PLÁTANO CANARIO',mode:'kg',price:1.20},
      {nombre:'NARANJA ZUMO',mode:'kg',price:0.95},
      {nombre:'KIWI ZESPRI',mode:'kg',price:2.40},
      {nombre:'AGUACATE',mode:'kg',price:2.60}
    ];
    save(K_PRODUCTOS,productos);
  }

  /* ---------- CLIENTES ---------- */
  function renderClientesSelect(){
    const sel = $('#selCliente');
    sel.innerHTML = '<option value="">Seleccionar cliente…</option>' +
      clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  $('#selCliente').addEventListener('change', e=>{
    const cli = clientes.find(c=>c.id===e.target.value);
    if(!cli) return;
    $('#cliNombre').value = cli.nombre || '';
    $('#cliNif').value = cli.nif || '';
    $('#cliDir').value = cli.dir || '';
    $('#cliTel').value = cli.tel || '';
    $('#cliEmail').value = cli.email || '';
  });

  function renderClientesLista(){
    const cont = $('#listaClientes');
    cont.innerHTML = '';
    clientes.forEach(c=>{
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `<strong>${c.nombre}</strong><span>${c.nif||''}</span>`;
      cont.appendChild(div);
    });
  }

  $('#btnAddCliente').addEventListener('click',()=>{
    const nombre = prompt('Nombre cliente:');
    if(!nombre) return;
    const nuevo = {id:genId(),nombre};
    clientes.push(nuevo);
    save(K_CLIENTES,clientes);
    renderClientesSelect();
    renderClientesLista();
  });

  /* ---------- PRODUCTOS ---------- */
  function renderProductos(){
    const cont = $('#listaProductos');
    cont.innerHTML = '';
    productos.forEach(p=>{
      const row = document.createElement('div');
      row.className='product-row';
      row.innerHTML = `
        <div>${p.nombre}</div>
        <div>${p.mode}</div>
        <div>${p.price??''}</div>
        <div><button class="edit">✏️</button></div>
      `;
      cont.appendChild(row);
    });
  }

  $('#btnAddProducto').addEventListener('click',()=>{
    const nombre = prompt('Nombre producto:');
    if(!nombre) return;
    productos.push({nombre,mode:'kg',price:0});
    save(K_PRODUCTOS,productos);
    renderProductos();
  });

  /* ---------- FACTURA ---------- */
  $('#btnAddLinea').addEventListener('click',()=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input class="prod" list="productNamesList"></td>
      <td><select class="mode"><option>kg</option><option>ud</option><option>caja</option></select></td>
      <td><input class="cant" type="number" min="0"></td>
      <td><input class="bruto" type="number" min="0"></td>
      <td><input class="tara" type="number" min="0"></td>
      <td><input class="neto" type="number" min="0"></td>
      <td><input class="precio" type="number" min="0" step="0.01"></td>
      <td><input class="origen"></td>
      <td class="importe">0,00 €</td>
      <td><button class="del">✖</button></td>`;
    $('#lineasBody').appendChild(tr);
  });

  $('#lineasBody').addEventListener('input',e=>{
    if(e.target.closest('tr')) recalc();
  });
  $('#lineasBody').addEventListener('click',e=>{
    if(e.target.classList.contains('del')){
      e.target.closest('tr').remove(); recalc();
    }
  });
  /* ---------- CÁLCULO DE TOTALES + ESTADO ---------- */
  function captureLineas(){
    const rows = $$('#lineasBody tr');
    const list = [];
    rows.forEach(r=>{
      const name   = r.querySelector('.prod')?.value?.trim() || '';
      const mode   = r.querySelector('.mode')?.value || 'kg';
      const cant   = parseNum(r.querySelector('.cant')?.value || 0);
      const bruto  = parseNum(r.querySelector('.bruto')?.value || 0);
      const tara   = parseNum(r.querySelector('.tara')?.value || 0);
      const netoIn = parseNum(r.querySelector('.neto')?.value || 0);
      const precio = parseNum(r.querySelector('.precio')?.value || 0);
      const origen = r.querySelector('.origen')?.value?.trim() || '';
      let neto = 0;
      if(bruto>0 || tara>0) neto = Math.max(0, bruto - tara);
      else neto = netoIn>0 ? netoIn : cant;

      const importe = (mode==='ud') ? cant*precio : neto*precio;
      const obj = {name, mode, cant, bruto, tara, neto, precio, origen, importe};
      list.push(obj);

      const tdImp = r.querySelector('.importe');
      if(tdImp) tdImp.textContent = money(importe);
    });
    return list.filter(x=>x.name);
  }

  function recalc(){
    const list = captureLineas();
    let subtotal = 0;
    list.forEach(l=> subtotal += l.importe);

    const transporte = $('#chkTransporte')?.checked ? subtotal*0.10 : 0;
    const base = subtotal + transporte;
    const iva = base * 0.04;

    const ivaIncluido = $('#chkIvaIncluido')?.checked ?? true;
    const total = ivaIncluido ? base : (base + iva);

    $('#subtotal').textContent = money(subtotal);
    $('#transp').textContent   = money(transporte);
    $('#iva').textContent      = money(iva);
    $('#total').textContent    = money(total);

    // estado sugerido según pagos
    const pagadoManual = parseNum($('#pagado')?.value || 0);
    const pagadoParcial = (window._pagosTemp||[]).reduce((a,b)=>a+(b.amount||0),0);
    const pagadoTotal = pagadoManual + pagadoParcial;
    const pendiente = Math.max(0, total - pagadoTotal);
    $('#pendiente').textContent = money(pendiente);

    if(total<=0)        $('#estado').value = 'pendiente';
    else if(pagadoTotal<=0)     $('#estado').value = 'pendiente';
    else if(pagadoTotal<total)  $('#estado').value = 'parcial';
    else                         $('#estado').value = 'pagado';

    // Pie informativo del PDF
    const foot = $('#pdf-foot-note');
    if(foot){
      foot.textContent = ivaIncluido
        ? 'IVA incluido en los precios. El 10% de transporte es opcional.'
        : 'IVA (4%) añadido a los importes. Transporte +10% opcional.';
    }

    // Pre-rellenar “printArea”
    fillPrintArea(list, {subtotal, transporte, iva, total});
  }

  ['chkTransporte','chkIvaIncluido','estado','pagado'].forEach(id=>{
    const el = $('#'+id);
    if(el) el.addEventListener('input', recalc);
  });

  /* ---------- PAGOS PARCIALES (TEMP) ---------- */
  window._pagosTemp = []; // {date, amount}
  function renderPagosTemp(){
    const list = $('#listaPagos');
    if(!list) return;
    list.innerHTML = '';
    if(window._pagosTemp.length===0){
      list.innerHTML = '<div class="item">Sin pagos parciales.</div>';
      return;
    }
    window._pagosTemp.forEach((p,i)=>{
      const div=document.createElement('div');
      div.className='item';
      const dt = new Date(p.date).toLocaleString();
      div.innerHTML = `<div>${dt} · <strong>${money(p.amount)}</strong></div><button class="ghost" data-i="${i}">✖</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const i = +b.dataset.i;
        window._pagosTemp.splice(i,1);
        renderPagosTemp(); recalc();
      });
    });
  }

  $('#btnAddPago')?.addEventListener('click', ()=>{
    const amt = parseNum($('#inpPagoParcial')?.value || 0);
    if(!(amt>0)) return;
    window._pagosTemp.unshift({date: new Date().toISOString(), amount: amt});
    $('#inpPagoParcial').value = '';
    renderPagosTemp(); recalc();
  });

  /* ---------- RELLENO DEL ÁREA DE IMPRESIÓN ---------- */
  function fillPrintArea(lines, totals, factura=null){
    const prov = {
      nombre: $('#provNombre')?.value || '',
      nif:    $('#provNif')?.value || '',
      dir:    $('#provDir')?.value || '',
      tel:    $('#provTel')?.value || '',
      email:  $('#provEmail')?.value || ''
    };
    const cli = {
      nombre: $('#cliNombre')?.value || '',
      nif:    $('#cliNif')?.value || '',
      dir:    $('#cliDir')?.value || '',
      tel:    $('#cliTel')?.value || '',
      email:  $('#cliEmail')?.value || ''
    };
    const numero = factura?.numero || '(Sin guardar)';
    const fecha  = factura?.fecha ? new Date(factura.fecha).toLocaleString() : new Date().toLocaleString();

    $('#p-num').textContent = numero;
    $('#p-fecha').textContent = fecha;

    $('#p-prov').innerHTML = `
      <div><strong>${prov.nombre}</strong></div>
      <div>${prov.nif}</div>
      <div>${prov.dir}</div>
      <div>${prov.tel} · ${prov.email}</div>
    `;
    $('#p-cli').innerHTML = `
      <div><strong>${cli.nombre}</strong></div>
      <div>${cli.nif||''}</div>
      <div>${cli.dir||''}</div>
      <div>${cli.tel||''} · ${cli.email||''}</div>
    `;

    const tbody = $('#p-tabla tbody');
    if(tbody){
      tbody.innerHTML = '';
      (lines||[]).forEach(l=>{
        const tr=document.createElement('tr');
        tr.innerHTML = `
          <td>${l.name}</td>
          <td>${l.mode}</td>
          <td>${l.cant||''}</td>
          <td>${l.bruto?l.bruto.toFixed(2):''}</td>
          <td>${l.tara?l.tara.toFixed(2):''}</td>
          <td>${l.neto?l.neto.toFixed(2):''}</td>
          <td>${money(l.precio)}</td>
          <td>${l.origen||''}</td>
          <td>${money(l.importe)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    $('#p-sub')?.textContent = money(totals?.subtotal||0);
    $('#p-tra')?.textContent = money(totals?.transporte||0);
    $('#p-iva')?.textContent = money(totals?.iva||0);
    $('#p-tot')?.textContent = money(totals?.total||0);
    $('#p-estado')?.textContent = ($('#estado')?.value || 'pendiente');
    $('#p-metodo')?.textContent = ($('#metodoPago')?.value || 'Efectivo');
    $('#p-obs')?.textContent = ($('#observaciones')?.value || '—');

    // QR básico
    try{
      const canvas = $('#p-qr');
      const payload = `ARSLAN|${numero}|${cli.nombre}|${totals?.total||0}`;
      window.QRCode?.toCanvas(canvas, payload, {width:92, margin:0});
    }catch(e){}
  }

  /* ---------- NUMERACIÓN CONTINUA ---------- */
  const K_SEQ = 'facturas_seq_v104';
  function nextSeq(){
    let n = parseInt(localStorage.getItem(K_SEQ)||'0',10);
    n = isNaN(n) ? 1 : (n+1);
    localStorage.setItem(K_SEQ, String(n));
    return 'FA-' + String(n).padStart(6,'0');
  }

  /* ---------- GUARDAR / NUEVA / PDF ---------- */
  function saveFacturas(){ save(K_FACTURAS, facturas); }

  $('#btnGuardar').addEventListener('click', ()=>{
    const lines = captureLineas();
    if(lines.length===0){ alert('Añade al menos una línea.'); return; }

    const numero = nextSeq();
    const now = new Date().toISOString();

    // Totales actuales desde UI
    const subtotal   = parseNum($('#subtotal')?.textContent.replace(/[^\d,.-]/g,'').replace(',','.')) || 0;
    const transporte = parseNum($('#transp')?.textContent.replace(/[^\d,.-]/g,'').replace(',','.')) || 0;
    const iva        = parseNum($('#iva')?.textContent.replace(/[^\d,.-]/g,'').replace(',','.')) || 0;
    const total      = parseNum($('#total')?.textContent.replace(/[^\d,.-]/g,'').replace(',','.')) || 0;

    const pagadoManual = parseNum($('#pagado')?.value || 0);
    const pagos = (window._pagosTemp||[]).slice();
    const pagadoParcial = pagos.reduce((a,b)=>a+(b.amount||0),0);
    const pagado = pagadoManual + pagadoParcial;
    const pendiente = Math.max(0, total - pagado);
    const estado = (pendiente<=0) ? 'pagado' : (pagado>0 ? 'parcial' : 'pendiente');

    const cliSelId = $('#selCliente')?.value || null;
    const cliObj = clientes.find(c=>c.id===cliSelId);

    const factura = {
      numero, fecha: now,
      proveedor:{
        nombre: $('#provNombre')?.value || '',
        nif:    $('#provNif')?.value || '',
        dir:    $('#provDir')?.value || '',
        tel:    $('#provTel')?.value || '',
        email:  $('#provEmail')?.value || ''
      },
      cliente:{
        id:   cliObj?.id || null,
        nombre: $('#cliNombre')?.value || '',
        nif:    $('#cliNif')?.value || '',
        dir:    $('#cliDir')?.value || '',
        tel:    $('#cliTel')?.value || '',
        email:  $('#cliEmail')?.value || ''
      },
      lineas: lines,
      chk: {transporte: !!$('#chkTransporte')?.checked, ivaIncluido: !!$('#chkIvaIncluido')?.checked},
      totals: {subtotal, transporte, iva, total, pagado, pendiente},
      estado,
      metodo: $('#metodoPago')?.value || 'Efectivo',
      obs: $('#observaciones')?.value || '',
      pagos
    };

    facturas.unshift(factura);
    saveFacturas();
    window._pagosTemp = [];
    renderPagosTemp();

    alert(`Factura ${numero} guardada.`);
    renderFacturas();
    renderPendientes();
    drawResumen();
    drawCharts();

    // Previsualizar en printArea
    fillPrintArea(lines, {subtotal,transporte,iva,total}, factura);
  });

  $('#btnNueva').addEventListener('click', ()=>{
    $('#lineasBody').innerHTML='';
    for(let i=0;i<5;i++){ $('#btnAddLinea').click(); }
    $('#chkTransporte').checked = false;
    $('#chkIvaIncluido').checked = true;
    $('#estado').value = 'pendiente';
    $('#pagado').value = '';
    $('#metodoPago').value = 'Efectivo';
    $('#observaciones').value = '';
    window._pagosTemp = [];
    renderPagosTemp();
    recalc();
  });

  // Generación PDF con html2pdf + pie “Suma y sigue…” + numeración
  function generatePDF(factura=null){
    const area = document.getElementById('printArea');
    if(!area){ alert('No se encontró printArea'); return; }

    const d = factura?.fecha ? new Date(factura.fecha) : new Date();
    const clienteNom = (factura?.cliente?.nombre || $('#cliNombre')?.value || 'Cliente').replace(/\s+/g,'');
    const filename = `Factura-${clienteNom}-${d.toISOString().slice(0,10)}.pdf`;

    const opt = {
      margin:[10,10,10,10],
      filename,
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,scrollY:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };

    window.html2pdf().set(opt).from(area).toPdf().get('pdf').then(pdf=>{
      const total = pdf.internal.getNumberOfPages();
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(9);
      for(let i=1;i<=total;i++){
        pdf.setPage(i);
        pdf.text(`Página ${i} de ${total}`, w-30, h-8);
        if(i<total) pdf.text('Suma y sigue…', 14, h-8);
        pdf.text('ARSLAN PRO KIWI Edition V10.4', 14, h-4);
        pdf.text(new Date().toLocaleString(), w-42, h-4);
      }
      pdf.save(filename);
    }).catch(e=>{
      console.error(e);
      alert('Error al generar PDF');
    });
  }

  $('#btnImprimir').addEventListener('click', ()=>{
    const num = $('#p-num')?.textContent || '';
    const factura = facturas.find(f=>f.numero===num) || null;
    generatePDF(factura);
  });

  /* ---------- LISTADO DE FACTURAS ---------- */
  function renderFacturas(){
    const cont = $('#listaFacturas');
    cont.innerHTML = '';
    const estado = ($('#filtroEstado')?.value || 'todas');
    const q = ($('#buscaCliente')?.value || '').toLowerCase();

    let arr = facturas.slice();
    if(estado!=='todas') arr = arr.filter(f=>f.estado===estado);
    if(q) arr = arr.filter(f=>(f.cliente?.nombre||'').toLowerCase().includes(q));

    if(arr.length===0){
      cont.innerHTML = '<div class="item">No hay facturas</div>';
      return;
    }

    arr.slice(0,500).forEach((f,idx)=>{
      const fecha = new Date(f.fecha).toLocaleString();
      const badge = f.estado==='pagado' ? 'state-green' : (f.estado==='parcial' ? 'state-amber' : 'state-red');
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div>
          <strong>${f.numero}</strong> <span class="state-badge ${badge}">${f.estado}</span>
          <div class="muted">${fecha} · ${f.cliente?.nombre||''}</div>
        </div>
        <div class="row">
          <strong>${money(f.totals.total||0)}</strong>
          <button class="ghost" data-e="ver" data-i="${idx}">Ver</button>
          <button class="ghost" data-e="parcial" data-i="${idx}">+ Parcial</button>
          <button class="ghost" data-e="dup" data-i="${idx}">↻ Duplicar</button>
          <button class="ghost" data-e="pdf" data-i="${idx}">PDF</button>
        </div>
      `;
      cont.appendChild(div);
    });

    cont.querySelectorAll('button').forEach(b=>{
      const i = +b.dataset.i;
      b.addEventListener('click', ()=>{
        const f = facturas[i]; if(!f) return;
        if(b.dataset.e==='ver'){
          fillPrintArea(f.lineas, f.totals, f);
          // Llevar al tab Factura
          document.querySelector('button.tab[data-tab="factura"]')?.click();
          document.getElementById('printArea')?.scrollIntoView({behavior:'smooth'});
        }else if(b.dataset.e==='pdf'){
          fillPrintArea(f.lineas, f.totals, f);
          generatePDF(f);
        }else if(b.dataset.e==='dup'){
          // Duplicar en editor
          $('#lineasBody').innerHTML='';
          (f.lineas||[]).forEach(()=>$('#btnAddLinea').click());
          const rows=$$('#lineasBody tr');
          (f.lineas||[]).forEach((l,ix)=>{
            const r=rows[ix];
            r.querySelector('.prod').value = l.name || '';
            r.querySelector('.mode').value = l.mode || 'kg';
            r.querySelector('.cant').value = l.cant || 0;
            r.querySelector('.bruto').value= l.bruto || 0;
            r.querySelector('.tara').value = l.tara || 0;
            r.querySelector('.neto').value = l.neto || 0;
            r.querySelector('.precio').value= l.precio || 0;
            r.querySelector('.origen').value= l.origen || '';
          });
          $('#cliNombre').value = f.cliente?.nombre||'';
          $('#cliNif').value    = f.cliente?.nif||'';
          $('#cliDir').value    = f.cliente?.dir||'';
          $('#cliTel').value    = f.cliente?.tel||'';
          $('#cliEmail').value  = f.cliente?.email||'';
          $('#chkTransporte').checked = !!f.chk?.transporte;
          $('#chkIvaIncluido').checked= !!f.chk?.ivaIncluido;
          $('#metodoPago').value = f.metodo || 'Efectivo';
          $('#observaciones').value = f.obs || '';
          window._pagosTemp = [];
          renderPagosTemp();
          document.querySelector('button.tab[data-tab="factura"]')?.click();
          recalc();
        }else if(b.dataset.e==='parcial'){
          const max = (f.totals.total||0) - (f.totals.pagado||0);
          const val = parseNum(prompt(`Importe abonado (pendiente ${money(max)}):`)||0);
          if(val>0){
            f.pagos = f.pagos || [];
            f.pagos.push({date:new Date().toISOString(), amount: val});
            f.totals.pagado = (f.totals.pagado||0)+val;
            f.totals.pendiente = Math.max(0,(f.totals.total||0)-(f.totals.pagado||0));
            f.estado = f.totals.pendiente>0 ? (f.totals.pagado>0?'parcial':'pendiente') : 'pagado';
            saveFacturas();
            renderFacturas();
            renderPendientes();
            drawResumen();
            drawCharts();
          }
        }
      });
    });
  }

  $('#filtroEstado')?.addEventListener('input', renderFacturas);
  $('#buscaCliente')?.addEventListener('input', renderFacturas);

  /* ---------- PENDIENTES ---------- */
  function renderPendientes(){
    const tb = $('#tblPendientes tbody');
    tb.innerHTML = '';
    const map = new Map(); // cliente -> {count,total,last}
    facturas.forEach(f=>{
      const pend = f.totals?.pendiente||0;
      if(pend<=0) return;
      const nom = f.cliente?.nombre || '(s/cliente)';
      const cur = map.get(nom) || {count:0,total:0,last:null};
      cur.count++;
      cur.total += pend;
      cur.last = (!cur.last || new Date(f.fecha)>new Date(cur.last)) ? f.fecha : cur.last;
      map.set(nom,cur);
    });

    let global = 0;
    const rows = [...map.entries()].sort((a,b)=>b[1].total-a[1].total);
    rows.forEach(([nom,info])=>{
      global += info.total;
      const tr = document.createElement('tr');
      const cls = info.total>500 ? 'state-red' : info.total>=100 ? 'state-amber' : 'state-green';
      tr.innerHTML = `
        <td>${nom}</td>
        <td>${info.count}</td>
        <td><span class="state-badge ${cls}">${money(info.total)}</span></td>
        <td>${new Date(info.last).toLocaleString()}</td>
        <td><button class="ghost" data-c="${nom}">Ver</button></td>
      `;
      tb.appendChild(tr);
    });
    $('#resGlobal').textContent = money(global);

    tb.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        $('#buscaCliente').value = b.dataset.c || '';
        document.querySelector('button.tab[data-tab="facturas"]')?.click();
        renderFacturas();
      });
    });
  }

  /* ---------- KPI + GRÁFICOS ---------- */
  function sumBetween(d1,d2){
    let sum=0;
    facturas.forEach(f=>{
      const d = new Date(f.fecha);
      if(d>=d1 && d<=d2) sum += (f.totals?.total||0);
    });
    return sum;
  }
  function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
  function startOfWeek(d=new Date()){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
  function startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1); }

  function drawResumen(){
    const now = new Date();
    $('#vHoy').textContent    = money(sumBetween(startOfDay(now), endOfDay(now)));
    $('#vSemana').textContent = money(sumBetween(startOfWeek(now), endOfDay(now)));
    $('#vMes').textContent    = money(sumBetween(startOfMonth(now), endOfDay(now)));
    const total = facturas.reduce((a,f)=>a+(f.totals?.total||0),0);
    $('#vTotal').textContent  = money(total);
    // espejo en Resumen
    $('#rHoy').textContent = $('#vHoy').textContent;
    $('#rSemana').textContent = $('#vSemana').textContent;
    $('#rMes').textContent = $('#vMes').textContent;
    $('#rTotal').textContent = $('#vTotal').textContent;
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

  let chartDia, chartMes;
  function drawCharts(){
    if(typeof Chart==='undefined') return;
    const daily = groupDaily(7), monthly = groupMonthly(12);
    if(chartDia) chartDia.destroy();
    if(chartMes) chartMes.destroy();
    chartDia = new Chart(document.getElementById('chartDiario')?.getContext('2d'), {
      type:'bar',
      data:{labels:daily.map(d=>d.label), datasets:[{label:'Ventas diarias', data:daily.map(d=>d.sum)}]},
      options:{responsive:true, plugins:{legend:{display:false}}}
    });
    chartMes = new Chart(document.getElementById('chartMensual')?.getContext('2d'), {
      type:'line',
      data:{labels:monthly.map(d=>d.label), datasets:[{label:'Ventas mensuales', data:monthly.map(d=>d.sum)}]},
      options:{responsive:true, plugins:{legend:{display:false}}}
    });
  }

  /* ---------- BACKUP / RESTORE ---------- */
  $('#btnBackup')?.addEventListener('click', ()=>{
    const payload = {clientes, productos, facturas, fecha:new Date().toISOString(), version:'V10.4'};
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  $('#btnRestore')?.addEventListener('click', ()=>{
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='application/json';
    inp.onchange = e=>{
      const f = e.target.files[0]; if(!f) return;
      const r = new FileReader();
      r.onload = ()=>{
        try{
          const obj = JSON.parse(r.result);
          clientes = obj.clientes||clientes;
          productos = obj.productos||productos;
          facturas = obj.facturas||facturas;
          save(K_CLIENTES, clientes);
          save(K_PRODUCTOS, productos);
          save(K_FACTURAS, facturas);
          renderFacturas(); renderPendientes(); drawResumen(); drawCharts();
          renderClientesSelect(); renderClientesLista(); renderProductos();
          alert('Copia restaurada correctamente');
        }catch(e){ alert('Archivo inválido'); }
      };
      r.readAsText(f);
    };
    inp.click();
  });

  /* ---------- PALETAS (BOTONES ESQUINA SUPERIOR DERECHA) ---------- */
  function applyTheme(theme){
    const r = document.documentElement;
    const colors = {
      kiwi:     ['#22c55e','#ffffff','#111111','#e5e7eb','#f8f9fb'],
      graphite: ['#1f2937','#f9fafb','#111111','#d1d5db','#f3f4f6'],
      sand:     ['#d97706','#fff7ed','#111111','#fde68a','#fef3c7'],
      mint:     ['#34d399','#ecfdf5','#111111','#d1fae5','#f0fdfa']
    };
    const c = colors[theme] || colors.kiwi;
    r.style.setProperty('--accent', c[0]);
    r.style.setProperty('--bg',     c[1]);
    r.style.setProperty('--text',   c[2]);
    r.style.setProperty('--border', c[3]);
    r.style.setProperty('--row',    c[4]);
    localStorage.setItem('theme', theme);
  }
  const savedTheme = localStorage.getItem('theme') || 'kiwi';
  applyTheme(savedTheme);
  $$('#palette button[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=> applyTheme(btn.dataset.theme));
  });
  /* ---------- CAMBIO DE PESTAÑAS ---------- */
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const tab = btn.dataset.tab;
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $$('.panel').forEach(p=>p.classList.add('hidden'));
      document.getElementById(tab)?.classList.remove('hidden');
    });
  });

  /* ---------- AUTO BACKUP DIARIO ---------- */
  function autoBackup(){
    const day = new Date().toISOString().slice(0,10);
    const key = 'autoBackup_'+day;
    if(localStorage.getItem(key)) return; // ya hecho
    const payload = {clientes,productos,facturas,fecha:new Date().toISOString()};
    localStorage.setItem(key, JSON.stringify(payload));
    console.log('Backup diario guardado', key);
  }
  autoBackup();

  /* ---------- ANIMACIONES SUAVES ---------- */
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) e.target.classList.add('fadeIn');
    });
  });
  $$('.card,.calc-table tr').forEach(el=>observer.observe(el));

  /* ---------- DETECCIÓN DE TEMA OSCURO AUTOMÁTICO ---------- */
  if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
    applyTheme('graphite');
  }

  /* ---------- INICIALIZACIÓN COMPLETA ---------- */
  renderAll();
  $('#btnNueva')?.click();
  recalc();
});
