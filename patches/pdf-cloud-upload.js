/* patches/pdf-pro-cloud.js
   PDF PRO + SUBIDA A FIREBASE STORAGE
   - No usa tu generador roto
   - Lee factura actual desde LocalStorage
   - Genera PDF profesional (jsPDF + AutoTable + QR)
   - Sube a Storage y guarda pdfUrl en la factura
*/

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

const $ = (s, r=document) => r.querySelector(s);
const log = (...a) => console.log('[PDF PRO+CLOUD]', ...a);

function num(x){
  if (x === null || x === undefined) return 0;
  const s = String(x).trim().replace(/\s+/g,'').replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
function esc(s){ return String(s ?? '').trim(); }

function findArrayKeyWithInvoices(){
  const preferred = ['factumiral_facturas','fm_facturas','arslan_v104_facturas','facturas'];
  for (const k of preferred) {
    const v = localStorage.getItem(k);
    if (v && v.trim().startsWith('[') && v.includes('FA-')) return k;
  }
  for (const k of Object.keys(localStorage)){
    const v = localStorage.getItem(k);
    if (v && v.length > 200 && v.trim().startsWith('[') && v.includes('FA-')) return k;
  }
  return null;
}
function safeParse(raw){ try { return JSON.parse(raw); } catch { return null; } }

function getCurrentInvoiceNumberFromDOM(){
  const cand = ['#numFactura','#facturaNum','#facNum','#invoiceNum','input[name="numFactura"]','input[name="facturaNum"]'];
  for (const s of cand){
    const el = $(s);
    const v = (el?.value || el?.textContent || '').trim();
    if (v) return v;
  }
  // fallback
  const any = Array.from(document.querySelectorAll('input,span,div'))
    .map(x => (x.value || x.textContent || '').trim())
    .find(t => /^FA-\d{10,}/.test(t));
  return any || '';
}

function pickInvoice(){
  const key = findArrayKeyWithInvoices();
  if (!key) return { key:null, list:[], invoice:null };

  const list = safeParse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(list)) return { key, list:[], invoice:null };

  const curNum = getCurrentInvoiceNumberFromDOM();
  if (curNum){
    const i = list.find(x => String(x?.num ?? x?.numero ?? x?.id ?? '').trim() === curNum.trim());
    if (i) return { key, list, invoice:i };
  }

  // fallback: última factura
  const last = list[list.length - 1] || null;
  return { key, list, invoice:last };
}

function getProviderClientSettingsFallback(){
  // intenta sacar de DOM si existe
  const prov = {
    nombre: esc($('#provNombre')?.value),
    nif: esc($('#provNif')?.value),
    dir: esc($('#provDir')?.value),
    tel: esc($('#provTel')?.value),
    email: esc($('#provEmail')?.value),
  };
  const cli = {
    nombre: esc($('#cliNombre')?.value || $('#clienteNombre')?.value),
    nif: esc($('#cliNif')?.value || $('#clienteNif')?.value),
    dir: esc($('#cliDir')?.value || $('#clienteDir')?.value),
    tel: esc($('#cliTel')?.value || $('#clienteTel')?.value),
    email: esc($('#cliEmail')?.value || $('#clienteEmail')?.value),
  };
  const st = {
    ivaPct: num($('#setIva')?.value || 4),
    transportePct: num($('#setTrans')?.value || 10),
    transporteOn: !!$('#chkTransporte')?.checked,
    ivaIncluido: !!$('#chkIvaIncluido')?.checked,
  };
  return { prov, cli, st };
}

function normalizeLines(inv){
  const raw = inv?.lineas || inv?.lines || inv?.items || inv?.rows || inv?.productos || [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((r) => {
    const prod = esc(r?.producto ?? r?.name ?? r?.nombre ?? '');
    const modo = esc(r?.modo ?? r?.mode ?? '');
    const cant = num(r?.cantidad ?? r?.qty ?? r?.cant);
    const bruto = num(r?.bruto ?? r?.kgBruto ?? r?.pesoBruto);
    const tara = num(r?.tara ?? r?.taraTotal ?? r?.kgTara);
    const neto = (r?.neto !== undefined && r?.neto !== null && String(r?.neto).trim() !== '')
      ? num(r?.neto)
      : Math.max(0, bruto - tara);
    const precio = num(r?.precio ?? r?.price ?? r?.precioKg ?? r?.precioCaja ?? r?.precioUd);
    const origen = esc(r?.origen ?? r?.origin ?? '');
    const importe = (r?.importe !== undefined && r?.importe !== null && String(r?.importe).trim() !== '')
      ? num(r?.importe)
      : (modo === 'caja' || modo === 'CAJA') ? cant * precio
        : (modo === 'ud' || modo === 'UD') ? cant * precio
        : neto * precio;
    return { prod, modo: modo || 'kg', cant, bruto, tara, neto, precio, origen, importe };
  }).filter(x => x.prod);
}

function ddmmyyyy(isoLike){
  const s = esc(isoLike);
  if (!s) return '';
  // soporta YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

async function ensureLibs(){
  // jsPDF UMD + AutoTable + QRCode
  const load = (url) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => res(true);
    s.onerror = () => rej(new Error('No se pudo cargar: ' + url));
    document.head.appendChild(s);
  });

  if (!window.jspdf?.jsPDF){
    await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!window.jspdf?.jsPDF?.API?.autoTable){
    await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
  }
  if (!window.QRCode){
    await load('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
  }
}

function makeQrDataUrl(text){
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  document.body.appendChild(host);

  // QRCodeJS crea canvas dentro
  // tamaño 140 para buena calidad
  const qr = new window.QRCode(host, { text, width: 140, height: 140, correctLevel: window.QRCode.CorrectLevel.M });
  const canvas = host.querySelector('canvas');
  const dataUrl = canvas ? canvas.toDataURL('image/png') : null;

  try{ qr.clear(); } catch {}
  host.remove();
  return dataUrl;
}

function openUrlModal(url){
  let modal = $('#fmPdfCloudModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'fmPdfCloudModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;';
  modal.innerHTML = `
    <div style="width:min(980px,100%);height:min(92vh,100%);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;">
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee;">
        <strong>PDF en la nube</strong>
        <div style="display:flex;gap:8px;">
          <a href="${url}" target="_blank" rel="noopener" style="padding:8px 10px;border:1px solid #000;background:#34c759;color:#000;border-radius:10px;text-decoration:none;">Abrir pestaña</a>
          <button id="fmPdfCloudClose" style="padding:8px 10px;border:1px solid #ddd;background:#f5f5f5;border-radius:10px;cursor:pointer;">Cerrar</button>
        </div>
      </div>
      <iframe style="flex:1;border:0;width:100%;" src="${url}"></iframe>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) modal.remove(); });
  $('#fmPdfCloudClose')?.addEventListener('click', ()=> modal.remove());
}

async function generatePdfBlobPro(invoice, fallback){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  const lines = normalizeLines(invoice);
  const { prov, cli, st } = fallback;

  const numFac = esc(invoice?.num ?? invoice?.numero ?? getCurrentInvoiceNumberFromDOM() ?? `FA-${Date.now()}`);
  const fecha = ddmmyyyy(invoice?.fecha ?? invoice?.date ?? '');

  const subtotal = lines.reduce((a,x)=>a + num(x.importe), 0);
  const transOn = (invoice?.transporteOn !== undefined) ? !!invoice?.transporteOn : st.transporteOn;
  const transPct = (invoice?.transportePct !== undefined) ? num(invoice?.transportePct) : st.transportePct;
  const ivaIncl = (invoice?.ivaIncluido !== undefined) ? !!invoice?.ivaIncluido : st.ivaIncluido;
  const ivaPct = (invoice?.ivaPct !== undefined) ? num(invoice?.ivaPct) : st.ivaPct;

  const transporte = transOn ? subtotal * (transPct/100) : 0;
  const base = subtotal + transporte;
  const iva = ivaIncl ? 0 : base * (ivaPct/100);
  const total = base + iva;

  // QR AEAT (fallback): texto compacto
  const provNif = esc(invoice?.provNif ?? prov.nif);
  const qrText = `NIF:${provNif}|FAC:${numFac}|F:${fecha||''}|T:${total.toFixed(2)}`;
  let qrDataUrl = null;
  try{ qrDataUrl = makeQrDataUrl(qrText); } catch {}

  // ====== Header PRO ======
  doc.setDrawColor(0);
  doc.setLineWidth(1);

  // Título
  doc.setFont('helvetica','bold');
  doc.setFontSize(20);
  doc.text('FACTURA', 40, 46);

  // Caja meta (num/fecha/total) arriba derecha
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.rect(360, 24, 195, 60);
  doc.text(`Nº: ${numFac}`, 370, 42);
  if (fecha) doc.text(`Fecha: ${fecha}`, 370, 56);
  doc.setFont('helvetica','bold');
  doc.text(`TOTAL: ${total.toFixed(2)} €`, 370, 74);

  // 3 columnas: proveedor / QR / cliente
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);

  // cajas
  doc.rect(40, 95, 240, 95);
  doc.rect(290, 95, 90, 95);
  doc.rect(390, 95, 165, 95);

  doc.text('Proveedor', 50, 113);
  doc.text('QR', 320, 113);
  doc.text('Cliente', 400, 113);

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);

  const pNombre = esc(invoice?.provNombre ?? prov.nombre);
  const pDir    = esc(invoice?.provDir ?? prov.dir);
  const pTel    = esc(invoice?.provTel ?? prov.tel);
  const pEmail  = esc(invoice?.provEmail ?? prov.email);

  const cNombre = esc(invoice?.cliNombre ?? cli.nombre);
  const cDir    = esc(invoice?.cliDir ?? cli.dir);
  const cTel    = esc(invoice?.cliTel ?? cli.tel);
  const cEmail  = esc(invoice?.cliEmail ?? cli.email);
  const cNif    = esc(invoice?.cliNif ?? cli.nif);

  let y = 130;
  const t = (tx) => { doc.text(tx, 50, y); y += 14; };
  if (pNombre) t(pNombre);
  if (provNif) t(`NIF: ${provNif}`);
  if (pDir)    t(pDir);
  if (pTel)    t(`Tel: ${pTel}`);
  if (pEmail)  t(pEmail);

  let y2 = 130;
  const t2 = (tx) => { doc.text(tx, 400, y2); y2 += 14; };
  if (cNombre) t2(cNombre);
  if (cNif)    t2(`NIF/CIF: ${cNif}`);
  if (cDir)    t2(cDir);
  if (cTel)    t2(`Tel: ${cTel}`);
  if (cEmail)  t2(cEmail);

  if (qrDataUrl){
    doc.addImage(qrDataUrl, 'PNG', 302, 120, 76, 76);
    doc.setFontSize(7);
    doc.text(qrText.slice(0, 28) + '…', 292, 190);
  } else {
    doc.setFontSize(9);
    doc.text('QR no disponible', 300, 145);
  }

  // ====== Tabla líneas ======
  const body = lines.length ? lines.map(l => [
    l.prod,
    l.modo,
    l.cant ? String(l.cant) : '',
    l.bruto ? l.bruto.toFixed(2) : '',
    l.tara ? l.tara.toFixed(2) : '',
    l.neto ? l.neto.toFixed(2) : '',
    l.precio ? l.precio.toFixed(2) : '',
    l.origen || '',
    l.importe ? l.importe.toFixed(2) : ''
  ]) : [['(Sin líneas)', '', '', '', '', '', '', '', '']];

  doc.autoTable({
    startY: 210,
    head: [[ 'Producto','Modo','Cant','Bruto','Tara','Neto','Precio','Origen','Importe' ]],
    body,
    styles: { font:'helvetica', fontSize:9, cellPadding:5, lineWidth:0.5, lineColor:[0,0,0] },
    headStyles: { fillColor:[0,0,0], textColor:[255,255,255] },
    alternateRowStyles: { fillColor:[245,245,245] },
    columnStyles: { 0:{cellWidth:150}, 7:{cellWidth:70}, 8:{halign:'right'} },
    margin: { left:40, right:40 },
    didDrawPage: (data) => {
      // Footer: página
      const pages = doc.getNumberOfPages();
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      doc.text(`Página ${page}/${pages}`, 40, 820);
    }
  });

  // ====== Totales ======
  const endY = doc.lastAutoTable.finalY + 12;
  const boxY = Math.min(endY, 740);

  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  doc.rect(360, boxY, 195, 80);

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.text(`Subtotal: ${subtotal.toFixed(2)} €`, 370, boxY + 22);
  if (transOn) doc.text(`Transporte (${transPct.toFixed(0)}%): ${transporte.toFixed(2)} €`, 370, boxY + 38);
  if (!ivaIncl) doc.text(`IVA (${ivaPct.toFixed(0)}%): ${iva.toFixed(2)} €`, 370, boxY + 54);
  else doc.text('IVA incluido', 370, boxY + 54);

  doc.setFont('helvetica','bold');
  doc.text(`TOTAL: ${total.toFixed(2)} €`, 370, boxY + 72);

  return doc.output('blob');
}

async function uploadToStorage(blob, invoiceNumber){
  const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js');
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js');
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js');

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);

  const u = auth.currentUser;
  if (!u) throw new Error('NO_AUTH');

  const safeNum = String(invoiceNumber || `FA-${Date.now()}`).replace(/[^\w\-]+/g,'_').slice(0, 80);
  const path = `factumiral/${u.uid}/facturas/${safeNum}.pdf`;

  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType:'application/pdf' });
  const url = await getDownloadURL(r);
  return { url, path };
}

function savePdfUrlIntoInvoice(key, list, invoice, pdfUrl, pdfPath){
  const numFac = String(invoice?.num ?? invoice?.numero ?? '').trim();
  const idx = list.findIndex(x => String(x?.num ?? x?.numero ?? x?.id ?? '').trim() === numFac);
  if (idx < 0) return false;

  list[idx].pdfUrl = pdfUrl;
  list[idx].pdfPath = pdfPath;
  list[idx].pdfUpdatedAt = Date.now();

  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('fmcloud:changed', { detail: { key } }));
  return true;
}

function injectButton(){
  const right = document.querySelector('.topbar__right') || document.body;
  if ($('#btnPdfCloudPro')) return;

  const btn = document.createElement('button');
  btn.id = 'btnPdfCloudPro';
  btn.type = 'button';
  btn.textContent = 'PDF+NUBE PRO';
  // Verde con texto negro (como pediste)
  btn.style.cssText = 'padding:10px 12px;border:1px solid #000;background:#34c759;color:#000;border-radius:12px;font-weight:700;cursor:pointer;';

  right.appendChild(btn);

  btn.addEventListener('click', async () => {
    try{
      await ensureLibs();

      const picked = pickInvoice();
      if (!picked.invoice) return alert('No encuentro ninguna factura guardada (LocalStorage). Guarda una factura primero.');

      const fallback = getProviderClientSettingsFallback();
      const blob = await generatePdfBlobPro(picked.invoice, fallback);

      const invoiceNumber = String(picked.invoice?.num ?? picked.invoice?.numero ?? getCurrentInvoiceNumberFromDOM() ?? `FA-${Date.now()}`);
      const { url, path } = await uploadToStorage(blob, invoiceNumber);

      const saved = savePdfUrlIntoInvoice(picked.key, picked.list, picked.invoice, url, path);

      if (!saved) {
        // fallback: índice externo por si no encuentra estructura exacta
        const idx = safeParse(localStorage.getItem('fm_pdfindex') || '{}') || {};
        idx[invoiceNumber] = { url, path, ts: Date.now() };
        localStorage.setItem('fm_pdfindex', JSON.stringify(idx));
      }

      openUrlModal(url);
      alert('✅ PDF PRO subido a Storage y listo.');

    } catch (e){
      console.error(e);
      if (String(e?.message||e).includes('NO_AUTH')){
        alert('Primero LOGIN en Cloud (Firebase) para poder subir a Storage.');
        $('#btnCloud')?.click();
        return;
      }
      alert('❌ Error PDF+Nube PRO: ' + (e?.message || e));
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectButton, { once:true });
} else {
  injectButton();
}

log('PDF PRO+CLOUD listo ✅');
