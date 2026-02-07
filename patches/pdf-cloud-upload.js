/* patches/pdf-cloud-pro.js
   BOTÓN VERDE: "PDF PRO + CLOUD"
   - Genera PDF PRO (jsPDF + AutoTable)
   - Sube a Firebase Storage
   - Guarda pdfUrl (Local + RTDB pdfIndex)
   NO TOCA app.js
*/

(async () => {
  'use strict';
  if (window.__FM_PDF_PRO_CLOUD__) return;
  window.__FM_PDF_PRO_CLOUD__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const log = (...a) => console.log('[PDF PRO + CLOUD]', ...a);

  // ========= CSS del botón (verde) =========
  (function injectCss(){
    const id = 'fmPdfProCloudCss';
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id;
    st.textContent = `
      .btn--green{
        background:#26d06a !important;
        color:#000 !important;
        border:1px solid rgba(0,0,0,.18) !important;
        font-weight:800 !important;
      }
      .btn--green:hover{ filter: brightness(0.98); }
      .btn--green:active{ transform: translateY(1px); }
    `;
    document.head.appendChild(st);
  })();

  // ========= Firebase CONFIG (la tuya) =========
  const firebaseConfig = {
    apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
    authDomain: "factumiral.firebaseapp.com",
    projectId: "factumiral",
    storageBucket: "factumiral.firebasestorage.app",
    messagingSenderId: "576821038417",
    appId: "1:576821038417:web:aba329f36563134bb01770",
    measurementId: "G-HJVL8ET49L",
    databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
  };

  // ========= Cargar Firebase modular =========
  const [appMod, authMod, storageMod, dbMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js"),
    import("https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js"),
  ]);

  const { initializeApp, getApps, getApp } = appMod;
  const { getAuth } = authMod;
  const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = storageMod;
  const { getDatabase, ref: dRef, set: dbSet } = dbMod;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const db = getDatabase(app, firebaseConfig.databaseURL);

  // ========= Cargar jsPDF + AutoTable (CDN) =========
  function loadScript(url){
    return new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => res(true);
      s.onerror = () => rej(new Error('No se pudo cargar: ' + url));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibs(){
    // jsPDF UMD
    if (!window.jspdf?.jsPDF) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    // AutoTable
    if (!window.jspdf?.jsPDF?.API?.autoTable) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
    }
  }

  // ========= Helpers para leer valores =========
  const firstVal = (selectors) => {
    for (const s of selectors){
      const el = $(s);
      const v = (el?.value ?? el?.textContent ?? '').toString().trim();
      if (v) return v;
    }
    return '';
  };

  const parseNum = (v) => {
    const s = (v ?? '').toString().trim().replace(/\s/g,'').replace(',','.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const eur = (n) => {
    const v = (Number(n)||0);
    return v.toFixed(2).replace('.',',') + ' €';
  };

  // ========= Lee datos de factura (DOM) =========
  function readInvoiceFromDom(){
    const num = firstVal(['#numFactura','#facturaNum','#facNum','input[name="numFactura"]']) || `FA-${Date.now()}`;
    const fecha = firstVal(['#fechaFactura','#facFecha','input[name="fechaFactura"]']);

    const prov = {
      nombre: firstVal(['#provNombre','input#provNombre']),
      nif:    firstVal(['#provNif','input#provNif']),
      dir:    firstVal(['#provDir','input#provDir']),
      tel:    firstVal(['#provTel','input#provTel']),
      email:  firstVal(['#provEmail','input#provEmail']),
    };

    const cli = {
      nombre: firstVal(['#cliNombre','#clienteNombre','input#cliNombre','input#clienteNombre']),
      nif:    firstVal(['#cliNif','#clienteNif','input#cliNif','input#clienteNif']),
      dir:    firstVal(['#cliDir','#clienteDir','input#cliDir','input#clienteDir']),
      tel:    firstVal(['#cliTel','#clienteTel','input#cliTel','input#clienteTel']),
      email:  firstVal(['#cliEmail','#clienteEmail','input#cliEmail','input#clienteEmail']),
    };

    const tags = firstVal(['#tags','#facTags','input#tags','input#facTags']);
    const obs  = firstVal(['#observaciones','#obs','#facObs','textarea#observaciones','textarea#obs','textarea#facObs']);

    // --- líneas (heurística robusta)
    const rows = [];
    const containers = [
      '#gridBody', '#lineasBody', '#linesBody', '#gridPro', '.gridPro', 'table'
    ].map(s => $(s)).filter(Boolean);

    const seen = new Set();
    const pick = (root, sels) => firstVal(sels.map(x => x.replace('{root}', '')).map(ss => ss.startsWith('#') ? ss : ss).map(ss => ss));

    const findInRow = (r, selList) => {
      for (const s of selList){
        const el = r.querySelector(s);
        if (el){
          const v = (el.value ?? el.textContent ?? '').toString().trim();
          if (v) return v;
        }
      }
      return '';
    };

    const rowCandidates = [];
    for (const c of containers){
      rowCandidates.push(...Array.from(c.querySelectorAll('tr,[data-row],.row,.gridRow,.line')));
    }

    for (const r of rowCandidates){
      if (seen.has(r)) continue; seen.add(r);

      const producto = findInRow(r, [
        '[data-col="producto"] input','input[data-col="producto"]','input[name*="prod"]','input[id*="prod"]',
        'input[placeholder*="Producto"]'
      ]);

      // si no hay producto, saltar
      if (!producto) continue;

      const modo = findInRow(r, [
        '[data-col="modo"] select','select[data-col="modo"]','select[name*="modo"]','select[id*="modo"]'
      ]) || findInRow(r, ['input[data-col="modo"]','input[name*="modo"]']);

      const cantidad = findInRow(r, [
        '[data-col="cantidad"] input','input[data-col="cantidad"]','input[name*="cant"]','input[id*="cant"]','input[placeholder*="Cantidad"]'
      ]);

      const bruto = findInRow(r, [
        '[data-col="bruto"] input','input[data-col="bruto"]','input[name*="bruto"]','input[id*="bruto"]'
      ]);

      const tara = findInRow(r, [
        '[data-col="tara"] input','input[data-col="tara"]','input[name*="tara"]','input[id*="tara"]'
      ]);

      const neto = findInRow(r, [
        '[data-col="neto"] input','input[data-col="neto"]','input[name*="neto"]','input[id*="neto"]'
      ]);

      const precio = findInRow(r, [
        '[data-col="precio"] input','input[data-col="precio"]','input[name*="precio"]','input[id*="precio"]','input[placeholder*="Precio"]'
      ]);

      const origen = findInRow(r, [
        '[data-col="origen"] input','input[data-col="origen"]','input[name*="origen"]','input[id*="origen"]'
      ]);

      const importe = findInRow(r, [
        '[data-col="importe"] input','input[data-col="importe"]','input[name*="importe"]','input[id*="importe"]','input[placeholder*="Importe"]'
      ]);

      rows.push({ producto, modo, cantidad, bruto, tara, neto, precio, origen, importe });
    }

    return { num, fecha, tags, obs, prov, cli, rows };
  }

  // ========= PDF PRO =========
  async function buildPdfBlob(data){
    await ensurePdfLibs();
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;

    // Header
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text('FACTURA', M, 44);

    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.line(M, 54, W - M, 54);

    doc.setFontSize(10);
    doc.setFont('helvetica','normal');

    // Caja meta arriba derecha
    const metaX = W - M - 200;
    const metaY = 22;
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.roundedRect(metaX, metaY, 200, 48, 8, 8);
    doc.text(`Nº: ${data.num}`, metaX + 10, metaY + 18);
    if (data.fecha) doc.text(`Fecha: ${data.fecha}`, metaX + 10, metaY + 34);

    // Proveedor izquierda
    let y = 78;
    doc.setFont('helvetica','bold'); doc.text('Proveedor', M, y); y += 14;
    doc.setFont('helvetica','normal');
    const p = data.prov || {};
    const provLines = [
      p.nombre, p.nif ? `NIF: ${p.nif}` : '', p.dir, p.tel ? `Tel: ${p.tel}` : '', p.email ? `Email: ${p.email}` : ''
    ].filter(Boolean);
    provLines.forEach((t)=>{ doc.text(t, M, y); y += 13; });

    // Cliente derecha
    let y2 = 78;
    const cx = W/2 + 10;
    doc.setFont('helvetica','bold'); doc.text('Cliente', cx, y2); y2 += 14;
    doc.setFont('helvetica','normal');
    const c = data.cli || {};
    const cliLines = [
      c.nombre, c.nif ? `NIF/CIF: ${c.nif}` : '', c.dir, c.tel ? `Tel: ${c.tel}` : '', c.email ? `Email: ${c.email}` : ''
    ].filter(Boolean);
    cliLines.forEach((t)=>{ doc.text(t, cx, y2); y2 += 13; });

    // Tags
    const tags = (data.tags || '').trim();
    if (tags) {
      doc.setFont('helvetica','bold');
      doc.text('Tags:', M, 160);
      doc.setFont('helvetica','normal');
      doc.text(tags, M + 40, 160);
    }

    // Tabla
    const startY = 178;
    const body = (data.rows && data.rows.length)
      ? data.rows.map(r => [
          r.producto || '',
          r.modo || '',
          r.cantidad || '',
          r.bruto || '',
          r.tara || '',
          r.neto || '',
          r.precio || '',
          r.origen || '',
          r.importe || ''
        ])
      : [['(Sin líneas detectadas en el grid)', '', '', '', '', '', '', '', '']];

    doc.autoTable({
      startY,
      head: [[
        'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe'
      ]],
      body,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [0,0,0], textColor: [255,255,255] },
      alternateRowStyles: { fillColor: [245,245,245] },
      didDrawPage: (d) => {
        // Pie con numeración
        const page = doc.internal.getNumberOfPages();
        doc.setFontSize(9);
        doc.setFont('helvetica','normal');
        doc.text(`Página ${page}`, W - M, doc.internal.pageSize.getHeight() - 18, { align:'right' });
      }
    });

    // Totales (calculados desde importe si existe)
    const sum = (data.rows || []).reduce((acc, r)=> acc + parseNum(r.importe), 0);
    const afterTableY = doc.lastAutoTable.finalY + 14;

    doc.setFont('helvetica','bold');
    doc.text('TOTAL:', W - M - 120, afterTableY);
    doc.setFont('helvetica','normal');
    doc.text(eur(sum), W - M, afterTableY, { align:'right' });

    // Observaciones
    if ((data.obs || '').trim()){
      doc.setFont('helvetica','bold');
      doc.text('Observaciones', M, afterTableY + 28);
      doc.setFont('helvetica','normal');
      const text = (data.obs || '').trim();
      const lines = doc.splitTextToSize(text, W - 2*M);
      doc.text(lines, M, afterTableY + 44);
    }

    return doc.output('blob');
  }

  // ========= Subida a Storage + index en RTDB =========
  async function uploadPdfToCloud(blob, numFactura){
    const u = auth.currentUser;
    if (!u) throw new Error('NO_AUTH');

    const safeNum = sanitize(numFactura);
    const path = `factumiral/${u.uid}/pdf/${safeNum}.pdf`;

    const r = sRef(storage, path);
    await uploadBytes(r, blob, { contentType: 'application/pdf' });
    const url = await getDownloadURL(r);

    // Index en RTDB (no rompe tu app aunque no lo use)
    await dbSet(dRef(db, `factumiral/${u.uid}/pdfIndex/${safeNum}`), {
      numFactura: safeNum,
      url,
      path,
      ts: Date.now()
    });

    return { url, path, safeNum };
  }

  // ========= Guardar url en factura local (si se encuentra) =========
  function savePdfUrlLocal(numFactura, pdfUrl, pdfPath){
    const target = String(numFactura).trim();
    const tryParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

    for (const k of Object.keys(localStorage)){
      const raw = localStorage.getItem(k);
      if (!raw || raw[0] !== '[') continue;
      const arr = tryParse(raw);
      if (!Array.isArray(arr)) continue;

      const idx = arr.findIndex(f => String(f?.num ?? f?.numero ?? f?.numFactura ?? f?.id ?? '').trim() === target);
      if (idx >= 0){
        arr[idx].pdfUrl = pdfUrl;
        arr[idx].pdfPath = pdfPath;
        arr[idx].pdfUpdatedAt = Date.now();
        localStorage.setItem(k, JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key: k } }));
        return { ok:true, key:k };
      }
    }

    // fallback
    const idx = tryParse(localStorage.getItem('fm_pdfindex') || '{}') || {};
    idx[target] = { url: pdfUrl, path: pdfPath, ts: Date.now() };
    localStorage.setItem('fm_pdfindex', JSON.stringify(idx));
    return { ok:false, key:'fm_pdfindex' };
  }

  // ========= Modal visor (sin blob navigation rara) =========
  function openPdfInModal(url){
    let modal = $('#fmPdfProCloudModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'fmPdfProCloudModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML = `
      <div style="width:min(980px,100%);height:min(92vh,100%);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;">
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee;">
          <strong>PDF (Cloud)</strong>
          <div style="display:flex;gap:8px;">
            <button id="fmPdfProCloudClose" style="padding:8px 10px;border:1px solid #ddd;background:#f5f5f5;border-radius:10px;cursor:pointer;">Cerrar</button>
          </div>
        </div>
        <iframe id="fmPdfProCloudFrame" style="flex:1;border:0;width:100%;" referrerpolicy="no-referrer"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.remove(); });
    $('#fmPdfProCloudClose').addEventListener('click', ()=> modal.remove());
    $('#fmPdfProCloudFrame').src = url;
  }

  // ========= Botón verde =========
  function injectButton(){
    if ($('#btnPdfProCloud')) return;

    const host = document.querySelector('.topbar__right') || document.body;
    const b = document.createElement('button');
    b.id = 'btnPdfProCloud';
    b.type = 'button';
    b.className = 'btn btn--green';
    b.textContent = 'PDF PRO + CLOUD';
    b.title = 'Genera un PDF profesional y lo sube a Firebase Storage';

    host.appendChild(b);

    b.addEventListener('click', async () => {
      try{
        // necesita login
        if (!auth.currentUser){
          alert('Primero entra en Cloud (correo + contraseña) para subir PDFs.');
          $('#btnCloud')?.click();
          return;
        }

        b.disabled = true;
        b.textContent = 'Generando…';

        const data = readInvoiceFromDom();
        const blob = await buildPdfBlob(data);

        b.textContent = 'Subiendo…';
        const up = await uploadPdfToCloud(blob, data.num);

        const saved = savePdfUrlLocal(data.num, up.url, up.path);

        b.textContent = '✅ Subido';
        setTimeout(()=>{ b.textContent = 'PDF PRO + CLOUD'; b.disabled = false; }, 900);

        // abrir visor cloud
        openPdfInModal(up.url);

        log('OK', { factura: data.num, storagePath: up.path, saved });

      } catch (e){
        console.error(e);
        b.disabled = false;
        b.textContent = 'PDF PRO + CLOUD';
        alert('❌ Error: ' + (e?.code || e?.message || e));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton, { once:true });
  } else {
    injectButton();
  }

  log('Patch PDF PRO + CLOUD listo ✅');
})();
