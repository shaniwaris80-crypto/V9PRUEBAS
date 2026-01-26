/* =========================================================
   ARSLAN • FACTURAS KIWI PRO (V3.1)
   ✅ Tabla de productos (kg/caja/ud/manojo)
   ✅ Tara + Origen + Precio unitario
   ✅ IVA 4% automático
   ✅ Subtotal + IVA + Total
   ✅ Datos proveedor + datos cliente completos en PDF
   ✅ PDF local + PDF guardado en nube (Firebase Storage)
   ✅ Realtime DB guarda: clientes, facturas, totales, tags, estado, fecha...
   ✅ Facturas editables: fecha, productos, precios, tara, origen...
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getDatabase,
  ref as dbRef,
  get,
  set
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import {
  getStorage,
  ref as stRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

/* =========================
   0) FIREBASE CONFIG (PEGA AQUÍ)
========================= */
const FIREBASE_CONFIG = {
  // apiKey: "...",
  // authDomain: "...",
  // databaseURL: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "..."
};

/* =========================
   1) Datos PROVEEDOR (TU EMPRESA)
========================= */
const SUPPLIER = {
  name: "Mohammad Arslan Waris",
  nif: "X6389988J",
  address: "Calle San Pablo 17, 09002 Burgos",
  phone: "631 667 893",
  email: "shaniwaris80@gmail.com"
};

/* =========================
   2) IVA
========================= */
const VAT_RATE = 0.04; // 4%

/* =========================
   3) LocalStorage
========================= */
const LS_KEY = "arslan_kiwi_pro_v31_state";
const LS_PREF = "arslan_kiwi_pro_v31_prefs";

/* =========================
   4) State
========================= */
let state = {
  clients: [],
  invoices: [],
  meta: { schema: "v3.1", lastSyncAt: 0 }
};

let prefs = {
  theme: "light",
  cloudEnabled: false,
  autoPDF: true
};

let firebase = {
  app: null,
  auth: null,
  db: null,
  st: null,
  user: null
};

let ui = {
  route: "dashboard",
  invoiceFilter: "all",
  tagFilter: "",
  search: "",
  editingInvoiceId: null,
  editingClientId: null,
  editorItems: []
};

let charts = {
  chart30: null,
  chartMonths: null
};

/* =========================
   5) Utils
========================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function now(){ return Date.now(); }

function escapeHTML(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function safeLower(s){ return String(s||"").toLowerCase().trim(); }

function fmtEUR(n){
  const x = Number(n||0);
  return x.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}
function fmtNum2(n){
  const x = Number(n||0);
  return x.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function ymd(d){
  const dt = d ? new Date(d) : new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function genInvoiceNumber(){
  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  const hh = String(dt.getHours()).padStart(2,"0");
  const mi = String(dt.getMinutes()).padStart(2,"0");
  return `FA-${yyyy}${mm}${dd}${hh}${mi}`;
}

function uid(prefix){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 28);
}

function toast(type, title, msg){
  const wrap = $("#toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type||""}`;
  el.innerHTML = `
    <div class="ticon">${iconHTML(type)}</div>
    <div>
      <b>${escapeHTML(title||"Info")}</b><br>
      <small>${escapeHTML(msg||"")}</small>
    </div>
  `;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(4px)"; }, 2600);
  setTimeout(()=>{ el.remove(); }, 3200);
  lucide.createIcons();
}
function iconHTML(type){
  const map = { ok:"check-circle-2", warn:"alert-triangle", bad:"x-circle" };
  return `<i data-lucide="${map[type] || "info"}"></i>`;
}

function isDefaultFirebaseConfig(){
  return !FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey;
}

function cloudPathRoot(){
  if(!firebase.user) return null;
  return `users/${firebase.user.uid}/data`;
}

function setCloudUI(color, text){
  const dot = $("#cloudDot");
  const t = $("#cloudText");
  if(!dot || !t) return;

  dot.classList.remove("gray","green","yellow","red");
  dot.classList.add(color || "gray");
  t.textContent = text || "Local (sin nube)";
}

/* =========================
   6) Persistence
========================= */
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const obj = JSON.parse(raw);
      if(obj && obj.clients && obj.invoices) state = obj;
    }
  }catch(e){}

  try{
    const rawp = localStorage.getItem(LS_PREF);
    if(rawp){
      const obj = JSON.parse(rawp);
      prefs = { ...prefs, ...obj };
    }
  }catch(e){}
}

function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function savePrefs(){ localStorage.setItem(LS_PREF, JSON.stringify(prefs)); }

/* =========================
   7) Firebase
========================= */
function initFirebase(){
  if(isDefaultFirebaseConfig()) return;
  if(firebase.app) return;

  firebase.app = initializeApp(FIREBASE_CONFIG);
  firebase.auth = getAuth(firebase.app);
  firebase.db = getDatabase(firebase.app);
  firebase.st = getStorage(firebase.app);

  onAuthStateChanged(firebase.auth, async (user)=>{
    firebase.user = user || null;
    if(firebase.user){
      setCloudUI("yellow", "Sincronizando…");
      await syncFromCloud();
      setCloudUI("green", "Nube conectada ✅");
      toast("ok","Nube conectada","Sincronizado correctamente.");
    }else{
      setCloudUI(prefs.cloudEnabled ? "red" : "gray", prefs.cloudEnabled ? "Nube (sin login)" : "Local (sin nube)");
    }
    renderAll();
  });
}

async function cloudLogin(email, pass){
  initFirebase();
  if(isDefaultFirebaseConfig()){
    toast("bad","Falta Firebase config","Pega tu config en app.js");
    return;
  }
  try{
    await signInWithEmailAndPassword(firebase.auth, email, pass);
    closeModal("modalCloud");
  }catch(err){
    toast("bad","Error login", err?.message || "No se pudo iniciar sesión");
  }
}

async function cloudRegister(email, pass){
  initFirebase();
  if(isDefaultFirebaseConfig()){
    toast("bad","Falta Firebase config","Pega tu config en app.js");
    return;
  }
  try{
    await createUserWithEmailAndPassword(firebase.auth, email, pass);
    closeModal("modalCloud");
  }catch(err){
    toast("bad","Error registro", err?.message || "No se pudo crear cuenta");
  }
}

async function cloudLogout(){
  if(!firebase.auth || !firebase.user){
    toast("warn","Nube","No hay sesión abierta.");
    return;
  }
  await signOut(firebase.auth);
  toast("ok","Nube","Sesión cerrada.");
  renderAll();
}

/* =========================
   8) Model: Clients + Items + Invoice
========================= */
function normalizeClient(c){
  return {
    id: c.id || uid("cli"),
    name: String(c.name||"").trim(),
    nif: String(c.nif||"").trim(),
    address: String(c.address||"").trim(),
    email: String(c.email||"").trim(),
    phone: String(c.phone||"").trim(),
    tags: Array.isArray(c.tags) ? c.tags : String(c.tags||"").split(",").map(x=>x.trim()).filter(Boolean),
    createdAt: c.createdAt || now(),
    updatedAt: now()
  };
}

function normalizeItem(it){
  const qty = Number(it.qty || 0);
  const price = Number(it.unitPrice || 0);
  return {
    name: String(it.name||"").trim(),
    unit: it.unit || "kg",           // kg / caja / ud / manojo
    qty: isFinite(qty) ? qty : 0,
    unitPrice: isFinite(price) ? price : 0,
    tara: Number(it.tara || 0) || 0, // tara kg (opcional)
    origin: String(it.origin||"").trim()
  };
}

function calcInvoiceTotals(items){
  const clean = (items||[]).map(normalizeItem).filter(i => i.name || i.qty || i.unitPrice);
  const subtotal = clean.reduce((a, x) => a + (Number(x.qty||0) * Number(x.unitPrice||0)), 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  return { cleanItems: clean, subtotal, vat, total };
}

function normalizeInvoice(inv){
  const items = Array.isArray(inv.items) ? inv.items : [];
  const t = calcInvoiceTotals(items);

  return {
    id: inv.id || uid("inv"),
    number: String(inv.number||genInvoiceNumber()).trim(),
    dateISO: inv.dateISO || ymd(),

    clientId: inv.clientId || "",
    clientNameCache: String(inv.clientNameCache||"").trim(),

    tag: String(inv.tag||"").trim(),
    status: inv.status || "PENDIENTE",
    notes: String(inv.notes||"").trim(),

    // ITEMS
    items: t.cleanItems,

    // CONTABILIDAD
    subtotal: Number(inv.subtotal ?? t.subtotal),
    vatRate: VAT_RATE,
    vatAmount: Number(inv.vatAmount ?? t.vat),
    total: Number(inv.total ?? t.total),

    createdAt: inv.createdAt || now(),
    updatedAt: now(),

    pdf: inv.pdf || null
  };
}

/* Dedup invoices:
   1) by id
   2) by (dateISO + number + clientNameCache)
*/
function invoiceSignature(inv){
  return `${inv.dateISO}__${safeLower(inv.number)}__${safeLower(inv.clientNameCache)}`;
}

function mergeData(localData, cloudData){
  const out = {
    clients: [],
    invoices: [],
    meta: { schema:"v3.1", lastSyncAt: now() }
  };

  const locClients = (localData?.clients||[]).map(normalizeClient);
  const cloClients = (cloudData?.clients||[]).map(normalizeClient);

  const locInv = (localData?.invoices||[]).map(normalizeInvoice);
  const cloInv = (cloudData?.invoices||[]).map(normalizeInvoice);

  // Clients merge
  const byId = new Map();
  const byName = new Map();

  function addClient(c){
    const keyName = safeLower(c.name);
    if(byId.has(c.id)){
      const prev = byId.get(c.id);
      byId.set(c.id, prev.updatedAt > c.updatedAt ? prev : c);
      return;
    }
    if(keyName && byName.has(keyName)){
      const prev = byName.get(keyName);
      const chosen = prev.updatedAt > c.updatedAt ? prev : c;
      byId.set(chosen.id, chosen);
      byName.set(keyName, chosen);
      return;
    }
    byId.set(c.id, c);
    if(keyName) byName.set(keyName, c);
  }

  [...cloClients, ...locClients].forEach(addClient);
  out.clients = Array.from(byId.values());

  const nameToId = new Map();
  out.clients.forEach(c => nameToId.set(safeLower(c.name), c.id));

  // Invoices merge
  const invById = new Map();
  const invBySig = new Map();

  function addInvoice(inv){
    const sig = invoiceSignature(inv);
    if(invById.has(inv.id)){
      const prev = invById.get(inv.id);
      invById.set(inv.id, prev.updatedAt > inv.updatedAt ? prev : inv);
      return;
    }
    if(invBySig.has(sig)){
      const prev = invBySig.get(sig);
      const chosen = prev.updatedAt > inv.updatedAt ? prev : inv;
      invById.set(chosen.id, chosen);
      invBySig.set(sig, chosen);
      return;
    }
    invById.set(inv.id, inv);
    invBySig.set(sig, inv);
  }

  [...cloInv, ...locInv].forEach(addInvoice);

  out.invoices = Array.from(invById.values()).map(inv=>{
    const cname = safeLower(inv.clientNameCache);
    if(cname && nameToId.has(cname)) inv.clientId = nameToId.get(cname);
    return inv;
  }).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  return out;
}

/* =========================
   9) Cloud Sync
========================= */
async function syncFromCloud(){
  if(!prefs.cloudEnabled) return;
  initFirebase();
  if(!firebase.user || !firebase.db) return;

  try{
    const root = cloudPathRoot();
    const snap = await get(dbRef(firebase.db, root));
    const cloudData = snap.exists() ? snap.val() : null;

    const merged = mergeData(state, cloudData);
    state = merged;
    saveLocal();

    // push merged back
    await set(dbRef(firebase.db, root), merged);
    state.meta.lastSyncAt = now();
    saveLocal();
  }catch(err){
    setCloudUI("red","Error nube");
    toast("bad","Sync nube", err?.message || "Error al sincronizar");
  }
}

async function pushToCloud(){
  if(!prefs.cloudEnabled) return;
  initFirebase();
  if(!firebase.user || !firebase.db) return;
  try{
    setCloudUI("yellow","Guardando…");
    await set(dbRef(firebase.db, cloudPathRoot()), state);
    state.meta.lastSyncAt = now();
    saveLocal();
    setCloudUI("green","Sincronizado ✅");
  }catch(err){
    setCloudUI("red","Error nube");
    toast("bad","Guardar nube", err?.message || "No se pudo guardar");
  }
}

/* =========================
   10) PDF PRO (Proveedor + Cliente + Tabla Items + IVA 4%)
========================= */
function buildPDF(invoice){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const margin = 42;
  const w = doc.internal.pageSize.getWidth();

  const cli = getClientById(invoice.clientId) || null;

  // Header
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("ARSLAN • FACTURA", margin, 52);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("KIWI PRO — Facturación y Contabilidad", margin, 68);
  doc.setTextColor(0);

  doc.setDrawColor(180);
  doc.line(margin, 80, w-margin, 80);

  // Left: Supplier
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text("PROVEEDOR", margin, 104);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`${SUPPLIER.name}`, margin, 120);
  doc.text(`NIF: ${SUPPLIER.nif}`, margin, 134);
  doc.text(`${SUPPLIER.address}`, margin, 148);
  doc.text(`Tel: ${SUPPLIER.phone}`, margin, 162);
  doc.text(`Email: ${SUPPLIER.email}`, margin, 176);

  // Right: Invoice summary
  const rx = w/2 + 40;
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text("FACTURA", rx, 104);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`Nº: ${invoice.number}`, rx, 120);
  doc.text(`Fecha: ${invoice.dateISO}`, rx, 134);
  doc.text(`Estado: ${invoice.status}`, rx, 148);
  doc.text(`Tag: ${invoice.tag || "-"}`, rx, 162);

  // Client block
  doc.setDrawColor(200);
  doc.line(margin, 192, w-margin, 192);

  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text("CLIENTE", margin, 212);

  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`${cli?.name || invoice.clientNameCache || "-"}`, margin, 228);
  doc.text(`NIF: ${cli?.nif || "-"}`, margin, 242);
  doc.text(`${cli?.address || "-"}`, margin, 256);

  if(cli?.email) doc.text(`Email: ${cli.email}`, margin, 270);
  if(cli?.phone) doc.text(`Tel: ${cli.phone}`, margin, 284);

  // Items table
  const rows = (invoice.items||[]).map(it=>{
    const lineTotal = Number(it.qty||0) * Number(it.unitPrice||0);
    return [
      it.name || "",
      it.unit || "",
      fmtNum2(it.qty||0),
      `${fmtNum2(it.unitPrice||0)} €`,
      it.tara ? fmtNum2(it.tara) : "",
      it.origin || "",
      `${fmtNum2(lineTotal)} €`
    ];
  });

  doc.autoTable({
    startY: 310,
    head: [["Producto", "Ud", "Cant", "Precio", "Tara", "Origen", "Importe"]],
    body: rows.length ? rows : [["(Sin productos)", "", "", "", "", "", ""]],
    styles: { fontSize: 9.5, cellPadding: 7 },
    headStyles: { fillColor: [22,163,74] },
    alternateRowStyles: { fillColor: [245,247,250] },
    columnStyles: {
      0: { cellWidth: 190 },
      1: { cellWidth: 34 },
      2: { cellWidth: 44, halign:"right" },
      3: { cellWidth: 58, halign:"right" },
      4: { cellWidth: 44, halign:"right" },
      5: { cellWidth: 64 },
      6: { cellWidth: 58, halign:"right" }
    }
  });

  const after = doc.lastAutoTable.finalY + 18;

  // Totals
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text(`Subtotal: ${fmtNum2(invoice.subtotal||0)} €`, w-margin-170, after);
  doc.text(`IVA 4%: ${fmtNum2(invoice.vatAmount||0)} €`, w-margin-170, after+16);
  doc.setFontSize(13);
  doc.text(`TOTAL: ${fmtNum2(invoice.total||0)} €`, w-margin-170, after+36);

  // Notes
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.setTextColor(80);
  if(invoice.notes){
    doc.text(`Notas: ${invoice.notes}`, margin, after+22);
  }
  doc.setTextColor(0);

  // Footer
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Documento generado por ARSLAN • KIWI PRO", margin, 815);
  doc.text("IVA aplicado: 4% (IVA incluido en totales)", w-margin-210, 815);
  doc.setTextColor(0);

  return doc;
}

function downloadPDFLocal(invoice){
  const doc = buildPDF(invoice);
  doc.save(`${invoice.number || "factura"}.pdf`);
  toast("ok","PDF generado","Descargado en tu dispositivo.");
}

async function uploadPDFToCloud(invoice){
  initFirebase();
  if(!prefs.cloudEnabled){
    toast("warn","Nube OFF","Activa la nube en Ajustes.");
    return null;
  }
  if(!firebase.user || !firebase.st){
    toast("warn","Nube","Inicia sesión en Nube.");
    return null;
  }

  const doc = buildPDF(invoice);
  const blob = doc.output("blob");

  const path = `invoices/${firebase.user.uid}/${invoice.id}.pdf`;
  const refFile = stRef(firebase.st, path);

  setCloudUI("yellow","Subiendo PDF…");
  await uploadBytes(refFile, blob, { contentType:"application/pdf" });
  const url = await getDownloadURL(refFile);

  setCloudUI("green","PDF en nube ✅");
  toast("ok","PDF en nube","Subido correctamente.");
  return { storagePath: path, downloadURL: url, updatedAt: now() };
}

async function ensureInvoicePDFCloud(invoice){
  const pdfInfo = await uploadPDFToCloud(invoice);
  if(!pdfInfo) return;

  const idx = state.invoices.findIndex(x=>x.id===invoice.id);
  if(idx >= 0){
    state.invoices[idx].pdf = pdfInfo;
    state.invoices[idx].updatedAt = now();
    saveLocal();
  }
  await pushToCloud();
  renderAll();
}

/* =========================
   11) CRUD
========================= */
function getClientById(id){
  return state.clients.find(c=>c.id===id) || null;
}
function getInvoiceById(id){
  return state.invoices.find(i=>i.id===id) || null;
}

function addOrUpdateClient(client){
  const c = normalizeClient(client);
  const idx = state.clients.findIndex(x=>x.id===c.id);
  if(idx>=0) state.clients[idx] = { ...state.clients[idx], ...c, updatedAt: now() };
  else state.clients.push(c);
  saveLocal();
  pushToCloud();
  renderAll();
}

async function deleteClient(id){
  const used = state.invoices.some(i=>i.clientId===id);
  if(used){
    toast("warn","No se puede","Este cliente tiene facturas.");
    return;
  }
  state.clients = state.clients.filter(c=>c.id!==id);
  saveLocal();
  await pushToCloud();
  renderAll();
  toast("ok","Cliente eliminado","Listo.");
}

async function addOrUpdateInvoice(inv, opts={uploadPDF:false}){
  const x = normalizeInvoice(inv);

  // cache client name
  const cli = getClientById(x.clientId);
  if(cli) x.clientNameCache = cli.name;

  const idx = state.invoices.findIndex(i=>i.id===x.id);
  if(idx>=0){
    const prev = state.invoices[idx];
    x.pdf = x.pdf || prev.pdf || null;
    state.invoices[idx] = { ...prev, ...x, updatedAt: now() };
  }else{
    state.invoices.unshift(x);
  }

  saveLocal();
  await pushToCloud();

  const shouldUpload = prefs.cloudEnabled && firebase.user && (opts.uploadPDF || prefs.autoPDF);
  if(shouldUpload){
    await ensureInvoicePDFCloud(x);
  }

  renderAll();
  toast("ok","Factura guardada","Gestión + Contabilidad actualizadas.");
}

async function deleteInvoice(id){
  state.invoices = state.invoices.filter(i=>i.id!==id);
  saveLocal();
  await pushToCloud();
  renderAll();
  toast("ok","Factura eliminada","Listo.");
}

/* =========================
   12) UI: Items editor
========================= */
function newItem(){
  return normalizeItem({ name:"", unit:"kg", qty:1, unitPrice:0, tara:0, origin:"" });
}

function renderItemsGrid(){
  const wrap = $("#itemsGrid");
  if(!wrap) return;

  wrap.innerHTML = ui.editorItems.map((it, idx)=>`
    <div class="item-row" data-idx="${idx}">
      <input class="input" data-f="name" placeholder="Producto" value="${escapeHTML(it.name)}" />
      <select class="select" data-f="unit">
        ${["kg","caja","ud","manojo"].map(u=>`<option value="${u}" ${it.unit===u?"selected":""}>${u}</option>`).join("")}
      </select>
      <input class="input" data-f="qty" type="number" step="0.01" value="${it.qty}" />
      <input class="input" data-f="unitPrice" type="number" step="0.01" value="${it.unitPrice}" />
      <input class="input" data-f="tara" type="number" step="0.01" value="${it.tara}" />
      <input class="input" data-f="origin" placeholder="Origen" value="${escapeHTML(it.origin)}" />
      <button class="item-del" data-act="del"><i data-lucide="trash-2"></i></button>
    </div>
  `).join("");

  wrap.querySelectorAll(".item-row").forEach(row=>{
    row.addEventListener("input",(e)=>{
      const idx = Number(row.dataset.idx);
      const el = e.target;
      const f = el.dataset.f;
      if(!f) return;

      const cur = ui.editorItems[idx];
      if(!cur) return;

      if(f==="qty" || f==="unitPrice" || f==="tara"){
        cur[f] = Number(el.value || 0);
      }else{
        cur[f] = el.value;
      }
      ui.editorItems[idx] = normalizeItem(cur);
      updateTotalsUI();
    });

    row.addEventListener("click",(e)=>{
      const b = e.target.closest("button");
      if(!b) return;
      if(b.dataset.act==="del"){
        const idx = Number(row.dataset.idx);
        ui.editorItems.splice(idx,1);
        if(ui.editorItems.length===0) ui.editorItems.push(newItem());
        renderItemsGrid();
        updateTotalsUI();
      }
    });
  });

  lucide.createIcons();
  updateTotalsUI();
}

function updateTotalsUI(){
  const t = calcInvoiceTotals(ui.editorItems);
  $("#tSubtotal").textContent = fmtEUR(t.subtotal);
  $("#tIVA").textContent = fmtEUR(t.vat);
  $("#tTotal").textContent = fmtEUR(t.total);
}

/* =========================
   13) Router + Render
========================= */
function routeTo(route){
  ui.route = route;

  const titleMap = {
    dashboard: ["Dashboard","Resumen del negocio"],
    invoices: ["Facturas","Gestión + PDFs guardados en nube"],
    clients: ["Clientes","Datos completos + tags"],
    reports: ["Contabilidad","Totales por mes, cliente y tags"],
    settings: ["Ajustes","Nube, backups y preferencias"]
  };

  $$(".nav-item").forEach(b=> b.classList.toggle("active", b.dataset.route===route));
  $$(".mobile-tabs .tab").forEach(t=> t.classList.toggle("active", t.dataset.route===route));

  $("#pageTitle").textContent = titleMap[route]?.[0] || "ARSLAN";
  $("#pageSubtitle").textContent = titleMap[route]?.[1] || "";

  $$(".view").forEach(v=>v.classList.add("hidden"));
  $(`#view-${route}`).classList.remove("hidden");

  renderAll();
}

function collectTags(){
  const tags = new Set();
  state.clients.forEach(c => (c.tags||[]).forEach(t=> tags.add(String(t).trim())));
  state.invoices.forEach(i => { if(i.tag) tags.add(String(i.tag).trim()); });
  return Array.from(tags).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

function renderTagFilterOptions(){
  const tags = collectTags();
  const sel = $("#filterTag");
  const prev = sel.value;
  sel.innerHTML = `<option value="">Todos los tags</option>` + tags.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
  sel.value = prev;
}

function renderInvoiceEditorOptions(){
  const selC = $("#invClient");
  const selT = $("#invTag");

  selC.innerHTML = state.clients
    .sort((a,b)=> safeLower(a.name).localeCompare(safeLower(b.name)))
    .map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`)
    .join("");

  const tags = collectTags();
  const current = selT.value;
  selT.innerHTML = `<option value="">— Sin tag —</option>` + tags.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
  selT.value = current || "";
}

function filteredInvoicesBase(){
  let list = [...state.invoices];

  const q = safeLower(ui.search);
  if(q){
    list = list.filter(i=>{
      return safeLower(i.number).includes(q) ||
        safeLower(i.clientNameCache).includes(q) ||
        safeLower(i.tag).includes(q) ||
        String(i.total||"").includes(q);
    });
  }

  if(ui.tagFilter){
    list = list.filter(i => (i.tag||"") === ui.tagFilter);
  }
  return list;
}

function renderAll(){
  document.body.classList.toggle("dark", prefs.theme === "dark");

  if(!prefs.cloudEnabled){
    setCloudUI("gray","Local (sin nube)");
  }else{
    if(isDefaultFirebaseConfig()) setCloudUI("red","Falta Firebase config");
    else if(firebase.user) setCloudUI("green","Nube conectada ✅");
    else setCloudUI("red","Nube (sin login)");
  }

  $("#toggleCloud").checked = !!prefs.cloudEnabled;
  $("#toggleAutoPDF").checked = !!prefs.autoPDF;

  renderTagFilterOptions();
  renderInvoiceEditorOptions();

  renderDashboard();
  renderInvoices();
  renderClients();
  renderReports();

  lucide.createIcons();
}

/* =========================
   14) Dashboard + Reports
========================= */
function sumTotals(list){
  return list.reduce((a,x)=>a + Number(x.total||0), 0);
}

function renderDashboard(){
  const today = ymd();
  const dtNow = new Date();
  const thisMonth = `${dtNow.getFullYear()}-${String(dtNow.getMonth()+1).padStart(2,"0")}`;

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-6);
  const weekFrom = ymd(weekStart);

  const inv = filteredInvoicesBase();

  const invToday = inv.filter(i=>i.dateISO===today);
  const invWeek = inv.filter(i=>i.dateISO>=weekFrom && i.dateISO<=today);
  const invMonth = inv.filter(i=>i.dateISO.startsWith(thisMonth));
  const invPending = inv.filter(i=>i.status==="PENDIENTE");

  $("#kpiToday").textContent = fmtEUR(sumTotals(invToday));
  $("#kpiTodayCount").textContent = `${invToday.length} facturas`;

  $("#kpiWeek").textContent = fmtEUR(sumTotals(invWeek));
  $("#kpiWeekCount").textContent = `${invWeek.length} facturas`;

  $("#kpiMonth").textContent = fmtEUR(sumTotals(invMonth));
  $("#kpiMonthCount").textContent = `${invMonth.length} facturas`;

  $("#kpiPending").textContent = fmtEUR(sumTotals(invPending));
  $("#kpiPendingCount").textContent = `${invPending.length} facturas`;

  renderChart30(inv);
  renderTopClients(invMonth);
}

function renderChart30(list){
  const days = [];
  const vals = [];
  const base = new Date();
  base.setDate(base.getDate()-29);

  for(let k=0;k<30;k++){
    const d = new Date(base);
    d.setDate(base.getDate()+k);
    const key = ymd(d);
    days.push(key.slice(5));
    const sumDay = list.filter(i=>i.dateISO===key).reduce((a,x)=>a+Number(x.total||0),0);
    vals.push(sumDay);
  }

  const ctx = $("#chart30");
  if(!ctx) return;

  if(charts.chart30) charts.chart30.destroy();

  charts.chart30 = new Chart(ctx, {
    type:"line",
    data:{ labels: days, datasets:[{ label:"€", data: vals, tension:.35, fill:false }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:(v)=> `${v}€` } } } }
  });
}

function renderTopClients(invMonth){
  const map = new Map();
  invMonth.forEach(i=>{
    const k = i.clientNameCache || "SIN CLIENTE";
    map.set(k, (map.get(k)||0) + Number(i.total||0));
  });

  const arr = Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const wrap = $("#topClients");
  wrap.innerHTML = arr.length ? arr.map(([name,val])=>`
    <div class="list-item">
      <div><b>${escapeHTML(name)}</b><br><small>${fmtEUR(val)}</small></div>
      <span class="badge ok">TOP</span>
    </div>
  `).join("") : `<div class="muted">Sin datos.</div>`;
}

function renderInvoices(){
  const tbody = $("#invoiceTable");
  if(!tbody) return;

  let list = filteredInvoicesBase();

  const today = ymd();
  const dtNow = new Date();
  const thisMonth = `${dtNow.getFullYear()}-${String(dtNow.getMonth()+1).padStart(2,"0")}`;

  if(ui.invoiceFilter==="pending") list = list.filter(i=>i.status==="PENDIENTE");
  if(ui.invoiceFilter==="paid") list = list.filter(i=>i.status==="PAGADO");
  if(ui.invoiceFilter==="today") list = list.filter(i=>i.dateISO===today);
  if(ui.invoiceFilter==="month") list = list.filter(i=>i.dateISO.startsWith(thisMonth));

  list.sort((a,b)=> (b.dateISO||"").localeCompare(a.dateISO||"") || (b.createdAt||0)-(a.createdAt||0));

  tbody.innerHTML = list.map(inv=>{
    const badgeClass = inv.status==="PAGADO" ? "ok" : "warn";
    const hasPDF = !!(inv.pdf && inv.pdf.downloadURL);
    return `
      <tr>
        <td>${escapeHTML(inv.dateISO||"")}</td>
        <td><b>${escapeHTML(inv.number||"")}</b></td>
        <td>${escapeHTML(inv.clientNameCache||"")}</td>
        <td>${inv.tag ? `<span class="badge">${escapeHTML(inv.tag)}</span>` : `<span class="muted small">—</span>`}</td>
        <td><b>${fmtEUR(inv.total||0)}</b></td>
        <td><span class="badge ${badgeClass}">${escapeHTML(inv.status)}</span></td>
        <td>
          <div class="actions">
            <button class="btn" data-act="edit" data-id="${inv.id}"><i data-lucide="pencil"></i></button>
            <button class="btn" data-act="dup" data-id="${inv.id}"><i data-lucide="copy"></i></button>
            <button class="btn" data-act="pdfLocal" data-id="${inv.id}"><i data-lucide="file-down"></i></button>
            <button class="btn ${hasPDF?"":"ghost"}" data-act="pdfCloud" data-id="${inv.id}">
              <i data-lucide="cloud-upload"></i>
            </button>
            <button class="btn ${hasPDF?"":"ghost"}" data-act="viewPDF" data-id="${inv.id}" ${hasPDF?"":"disabled"}>
              <i data-lucide="eye"></i>
            </button>
            <button class="btn danger" data-act="del" data-id="${inv.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

function renderClients(){
  const tbody = $("#clientTable");
  if(!tbody) return;

  const totals = new Map();
  state.invoices.forEach(i=>{
    totals.set(i.clientId, (totals.get(i.clientId)||0) + Number(i.total||0));
  });

  const list = [...state.clients].sort((a,b)=>safeLower(a.name).localeCompare(safeLower(b.name)));

  tbody.innerHTML = list.map(c=>{
    const sumC = totals.get(c.id)||0;
    const tags = (c.tags||[]).map(t=>`<span class="badge">${escapeHTML(t)}</span>`).join(" ");
    return `
      <tr>
        <td><b>${escapeHTML(c.name)}</b></td>
        <td>${escapeHTML(c.nif||"")}</td>
        <td>${escapeHTML(c.address||"")}</td>
        <td>${tags || `<span class="muted small">—</span>`}</td>
        <td><b>${fmtEUR(sumC)}</b></td>
        <td>
          <div class="actions">
            <button class="btn" data-cact="edit" data-id="${c.id}"><i data-lucide="pencil"></i></button>
            <button class="btn" data-cact="newInv" data-id="${c.id}"><i data-lucide="plus"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

function renderReports(){
  renderChartMonths();
  if(!$("#repFrom").value){
    const d = new Date(); d.setDate(d.getDate()-30);
    $("#repFrom").value = ymd(d);
  }
  if(!$("#repTo").value) $("#repTo").value = ymd();
}

function renderChartMonths(){
  const ctx = $("#chartMonths");
  if(!ctx) return;

  const map = new Map();
  state.invoices.forEach(i=>{
    const k = String(i.dateISO||"").slice(0,7);
    if(!k || k.length<7) return;
    map.set(k, (map.get(k)||0) + Number(i.total||0));
  });

  const keys = Array.from(map.keys()).sort((a,b)=>a.localeCompare(b)).slice(-12);
  const vals = keys.map(k=>map.get(k)||0);

  if(charts.chartMonths) charts.chartMonths.destroy();

  charts.chartMonths = new Chart(ctx,{
    type:"bar",
    data:{ labels: keys, datasets:[{ label:"€", data: vals }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:(v)=> `${v}€` } } } }
  });
}

function runReport(){
  const from = $("#repFrom").value || "0000-00-00";
  const to = $("#repTo").value || "9999-99-99";

  const list = state.invoices.filter(i=> i.dateISO>=from && i.dateISO<=to);
  const totalRange = sumTotals(list);

  const mapC = new Map();
  list.forEach(i=>{
    const k = i.clientNameCache || "SIN CLIENTE";
    mapC.set(k, (mapC.get(k)||0) + Number(i.total||0));
  });
  const arrC = Array.from(mapC.entries()).sort((a,b)=>b[1]-a[1]);

  $("#rankClients").innerHTML = arrC.length ? arrC.slice(0,20).map(([n,v],idx)=>`
    <div class="list-item">
      <div>
        <b>#${idx+1} ${escapeHTML(n)}</b><br>
        <small>${fmtEUR(v)}</small>
      </div>
      <span class="badge ok">${totalRange ? ((v/totalRange)*100).toFixed(1) : "0.0"}%</span>
    </div>
  `).join("") : `<div class="muted">Sin datos en el rango.</div>`;

  const mapT = new Map();
  list.forEach(i=>{
    const k = i.tag ? i.tag : "SIN TAG";
    mapT.set(k, (mapT.get(k)||0) + Number(i.total||0));
  });
  const arrT = Array.from(mapT.entries()).sort((a,b)=>b[1]-a[1]);

  $("#rankTags").innerHTML = arrT.length ? arrT.map(([t,v])=>`
    <div class="list-item">
      <div><b>${escapeHTML(t)}</b><br><small>${fmtEUR(v)}</small></div>
      <span class="badge">${totalRange ? ((v/totalRange)*100).toFixed(1) : "0.0"}%</span>
    </div>
  `).join("") : `<div class="muted">Sin datos.</div>`;

  toast("ok","Reporte generado",`Rango ${from} → ${to}`);
}

/* =========================
   15) Modals
========================= */
function openModal(id){ $(`#${id}`).classList.remove("hidden"); lucide.createIcons(); }
function closeModal(id){ $(`#${id}`).classList.add("hidden"); }

function closeAllModals(){ $$(".modal").forEach(m=>m.classList.add("hidden")); }

function openPDF(url){
  $("#pdfFrame").src = url;
  openModal("modalPDF");
}

function openClientEditor(client){
  ui.editingClientId = client?.id || null;
  $("#cliModalTitle").textContent = client ? "✏️ Editar cliente" : "👤 Nuevo cliente";

  $("#cliName").value = client?.name || "";
  $("#cliNIF").value = client?.nif || "";
  $("#cliAddress").value = client?.address || "";
  $("#cliEmail").value = client?.email || "";
  $("#cliPhone").value = client?.phone || "";
  $("#cliTags").value = (client?.tags || []).join(", ");

  $("#btnCliDelete").style.display = client ? "inline-flex" : "none";
  openModal("modalClient");
}

function openInvoiceEditor(invoice){
  ui.editingInvoiceId = invoice?.id || null;

  $("#invModalTitle").textContent = invoice ? "✏️ Editar factura" : "🧾 Nueva factura";
  $("#invDate").value = invoice?.dateISO || ymd();
  $("#invNumber").value = invoice?.number || genInvoiceNumber();

  renderInvoiceEditorOptions();

  if(invoice?.clientId){
    $("#invClient").value = invoice.clientId;
  }else{
    if(state.clients[0]) $("#invClient").value = state.clients[0].id;
  }

  $("#invTag").value = invoice?.tag || "";
  $("#invStatus").value = invoice?.status || "PENDIENTE";
  $("#invNotes").value = invoice?.notes || "";

  ui.editorItems = (invoice?.items && invoice.items.length) ? invoice.items.map(normalizeItem) : [newItem()];
  renderItemsGrid();

  const canView = !!(invoice?.pdf?.downloadURL);
  $("#btnInvViewPDF").disabled = !canView;

  openModal("modalInvoice");
}

/* =========================
   16) Export/Import
========================= */
function exportJSON(){
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ARSLAN_KIWI_BACKUP_${ymd()}_v31.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("ok","Backup JSON","Exportado correctamente.");
}

function importJSONFile(file){
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const obj = JSON.parse(reader.result);
      const merged = mergeData(state, obj);
      state = merged;
      saveLocal();
      await pushToCloud();
      renderAll();
      toast("ok","Importación OK","Merge inteligente aplicado.");
    }catch(e){
      toast("bad","Importación falló","JSON inválido.");
    }
  };
  reader.readAsText(file);
}

function exportInvoicesCSV(){
  const rows = [["dateISO","number","client","tag","subtotal","iva4","total","status","pdfURL"]];
  state.invoices.forEach(i=>{
    rows.push([
      i.dateISO||"",
      i.number||"",
      i.clientNameCache||"",
      i.tag||"",
      String(i.subtotal||0),
      String(i.vatAmount||0),
      String(i.total||0),
      i.status||"",
      i.pdf?.downloadURL || ""
    ]);
  });
  const csv = rows.map(r=>r.map(x=> `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `FACTURAS_${ymd()}_v31.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("ok","CSV exportado","Listo.");
}

/* =========================
   17) Events
========================= */
function bindEvents(){
  // nav
  $$(".nav-item").forEach(b=> b.addEventListener("click", ()=> routeTo(b.dataset.route)));
  $$(".mobile-tabs .tab").forEach(t=> t.addEventListener("click", ()=> routeTo(t.dataset.route)));

  // sidebar hamburger mobile
  $("#btnHamburger").addEventListener("click", ()=>{
    $("#sidebar").classList.toggle("open");
  });

  // global search
  $("#globalSearch").addEventListener("input", (e)=>{
    ui.search = e.target.value;
    renderAll();
  });

  // theme
  $("#btnToggleTheme").addEventListener("click", ()=>{
    prefs.theme = prefs.theme === "dark" ? "light" : "dark";
    savePrefs();
    renderAll();
  });

  // quick backups
  $("#btnQuickBackup").addEventListener("click", exportJSON);
  $("#btnQuickImport").addEventListener("click", ()=> $("#fileImport").click());

  // cloud modal
  $("#btnCloudLogin").addEventListener("click", ()=>{
    if(!prefs.cloudEnabled){
      toast("warn","Nube OFF","Activa nube en Ajustes primero.");
      routeTo("settings");
      return;
    }
    openModal("modalCloud");
  });

  $("#btnCloudSignIn").addEventListener("click", ()=>{
    cloudLogin($("#cloudEmail").value.trim(), $("#cloudPass").value);
  });

  $("#btnCloudRegister").addEventListener("click", ()=>{
    cloudRegister($("#cloudEmail").value.trim(), $("#cloudPass").value);
  });

  // settings toggles
  $("#toggleCloud").addEventListener("change", async (e)=>{
    prefs.cloudEnabled = !!e.target.checked;
    savePrefs();

    if(prefs.cloudEnabled){
      initFirebase();
      if(isDefaultFirebaseConfig()){
        toast("bad","Falta Firebase config","Pega tu config en app.js");
      }else{
        toast("ok","Nube activada","Inicia sesión para sincronizar.");
        openModal("modalCloud");
      }
    }else{
      toast("ok","Nube desactivada","Ahora trabajas en local.");
    }
    renderAll();
  });

  $("#toggleAutoPDF").addEventListener("change", (e)=>{
    prefs.autoPDF = !!e.target.checked;
    savePrefs();
    renderAll();
  });

  $("#btnForceSync").addEventListener("click", async ()=>{
    await syncFromCloud();
    renderAll();
    toast("ok","Sync completo","Datos actualizados.");
  });

  $("#btnCloudLogout").addEventListener("click", cloudLogout);

  // new invoice
  $("#btnNewInvoice").addEventListener("click", ()=>{
    if(!state.clients.length){
      toast("warn","Crea un cliente","Primero añade un cliente.");
      routeTo("clients");
      return;
    }
    openInvoiceEditor(null);
  });

  // new client
  $("#btnNewClient").addEventListener("click", ()=> openClientEditor(null));

  // chips filters
  $$(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      $$(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      ui.invoiceFilter = ch.dataset.filter;
      renderAll();
    });
  });

  // tag filter
  $("#filterTag").addEventListener("change",(e)=>{
    ui.tagFilter = e.target.value;
    renderAll();
  });

  // invoice table actions
  $("#invoiceTable").addEventListener("click", async (e)=>{
    const btn = e.target.closest("button");
    if(!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if(!id || !act) return;

    const inv = getInvoiceById(id);
    if(!inv) return;

    if(act==="edit") openInvoiceEditor(inv);

    if(act==="dup"){
      const copy = normalizeInvoice({
        ...inv,
        id: uid("inv"),
        number: genInvoiceNumber(),
        createdAt: now(),
        updatedAt: now(),
        pdf: null
      });
      await addOrUpdateInvoice(copy, {uploadPDF:false});
      toast("ok","Duplicada","Factura duplicada.");
    }

    if(act==="pdfLocal") downloadPDFLocal(inv);
    if(act==="pdfCloud") await ensureInvoicePDFCloud(inv);
    if(act==="viewPDF"){ if(inv.pdf?.downloadURL) openPDF(inv.pdf.downloadURL); }

    if(act==="del"){
      const ok = confirm("¿Eliminar factura? Esto no se puede deshacer.");
      if(ok) await deleteInvoice(inv.id);
    }
  });

  // client table actions
  $("#clientTable").addEventListener("click",(e)=>{
    const btn = e.target.closest("button");
    if(!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.cact;
    if(!id || !act) return;
    const cli = getClientById(id);
    if(!cli) return;

    if(act==="edit") openClientEditor(cli);
    if(act==="newInv"){
      openInvoiceEditor({
        id:null,
        dateISO: ymd(),
        number: genInvoiceNumber(),
        clientId: cli.id,
        clientNameCache: cli.name,
        tag: "",
        status:"PENDIENTE",
        notes:"",
        items:[newItem()]
      });
    }
  });

  // client save/delete
  $("#btnCliSave").addEventListener("click", ()=>{
    const obj = normalizeClient({
      id: ui.editingClientId || uid("cli"),
      name: $("#cliName").value.trim(),
      nif: $("#cliNIF").value.trim(),
      address: $("#cliAddress").value.trim(),
      email: $("#cliEmail").value.trim(),
      phone: $("#cliPhone").value.trim(),
      tags: $("#cliTags").value.split(",").map(x=>x.trim()).filter(Boolean),
      updatedAt: now()
    });

    if(!obj.name){
      toast("warn","Falta nombre","Escribe el nombre del cliente.");
      return;
    }
    addOrUpdateClient(obj);
    closeModal("modalClient");
  });

  $("#btnCliDelete").addEventListener("click", async ()=>{
    if(!ui.editingClientId) return;
    const ok = confirm("¿Eliminar cliente? (solo si no tiene facturas)");
    if(!ok) return;
    await deleteClient(ui.editingClientId);
    closeModal("modalClient");
  });

  // invoice editor buttons
  $("#btnAddItem").addEventListener("click", ()=>{
    ui.editorItems.push(newItem());
    renderItemsGrid();
  });

  $("#btnInvSave").addEventListener("click", async ()=>{
    const inv = buildInvoiceFromEditor(ui.editingInvoiceId || uid("inv"));
    await addOrUpdateInvoice(inv, {uploadPDF:false});
    closeModal("modalInvoice");
  });

  $("#btnInvDuplicate").addEventListener("click", async ()=>{
    if(!ui.editingInvoiceId){
      toast("warn","Duplica después","Primero guarda la factura.");
      return;
    }
    const inv = getInvoiceById(ui.editingInvoiceId);
    if(!inv) return;

    const copy = normalizeInvoice({
      ...inv,
      id: uid("inv"),
      number: genInvoiceNumber(),
      createdAt: now(),
      updatedAt: now(),
      pdf: null
    });

    await addOrUpdateInvoice(copy, {uploadPDF:false});
    toast("ok","Duplicada","Factura duplicada.");
  });

  $("#btnInvPDFLocal").addEventListener("click", ()=>{
    const inv = buildInvoiceFromEditor(ui.editingInvoiceId || uid("inv"));
    const temp = normalizeInvoice(inv);
    downloadPDFLocal(temp);
  });

  $("#btnInvPDFCloud").addEventListener("click", async ()=>{
    const id = ui.editingInvoiceId || uid("inv");
    const inv = buildInvoiceFromEditor(id);

    await addOrUpdateInvoice(inv, {uploadPDF:false});
    const saved = getInvoiceById(id);
    if(saved) await ensureInvoicePDFCloud(saved);
  });

  $("#btnInvViewPDF").addEventListener("click", ()=>{
    const inv = ui.editingInvoiceId ? getInvoiceById(ui.editingInvoiceId) : null;
    if(inv?.pdf?.downloadURL) openPDF(inv.pdf.downloadURL);
  });

  // reports
  $("#btnRunReport").addEventListener("click", runReport);

  // backups
  $("#btnExportJSON").addEventListener("click", exportJSON);
  $("#btnImportJSON").addEventListener("click", ()=> $("#fileImport").click());
  $("#fileImport").addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) importJSONFile(f);
    e.target.value = "";
  });

  // export csv
  $("#btnExportInvoicesCSV").addEventListener("click", exportInvoicesCSV);

  // refresh chart
  $("#btnRefreshChart").addEventListener("click", ()=> renderAll());

  // modal close buttons
  $$("[data-close]").forEach(b=>{
    b.addEventListener("click", ()=> closeModal(b.dataset.close));
  });

  // close modal on bg click
  $$(".modal").forEach(m=>{
    m.addEventListener("click", (e)=>{
      if(e.target === m) m.classList.add("hidden");
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeAllModals();

    if(e.ctrlKey && e.key.toLowerCase() === "n"){
      e.preventDefault();
      $("#btnNewInvoice").click();
    }

    if(e.ctrlKey && e.key.toLowerCase() === "s"){
      const invOpen = !$("#modalInvoice").classList.contains("hidden");
      if(invOpen){
        e.preventDefault();
        $("#btnInvSave").click();
      }
    }
  });
}

function buildInvoiceFromEditor(id){
  const clientId = $("#invClient").value;
  const client = getClientById(clientId);

  const t = calcInvoiceTotals(ui.editorItems);

  return normalizeInvoice({
    id,
    dateISO: $("#invDate").value || ymd(),
    number: $("#invNumber").value.trim() || genInvoiceNumber(),
    clientId,
    clientNameCache: client?.name || "",
    tag: $("#invTag").value || "",
    status: $("#invStatus").value || "PENDIENTE",
    notes: $("#invNotes").value.trim(),
    items: t.cleanItems,
    subtotal: t.subtotal,
    vatAmount: t.vat,
    total: t.total,
    updatedAt: now()
  });
}

/* =========================
   18) Seed: Todos tus clientes (precargados)
========================= */
function seedIfEmpty(){
  if(state.clients.length) return;

  const clients = [
    // RIVIERA
    {
      id: "cli_riviera",
      name: "RIVIERA (CONOR ESY SLU)",
      nif: "B16794893",
      address: "Paseo del Espolón, 09003 Burgos",
      email: "",
      phone: "",
      tags: ["Centro","Severo","Edificio","Tomillares"]
    },

    // GOLDEN GARDEN
    {
      id: "cli_golden_garden",
      name: "GOLDEN GARDEN",
      nif: "71281665L",
      address: "Trinidad, 12, 09003, Burgos",
      email: "",
      phone: "",
      tags: ["IVA incluido"]
    },

    // CON/SENTIDOS
    {
      id: "cli_consentidos",
      name: "Con/sentidos (Cuevas Palacios Restauración S.L.)",
      nif: "B10694792",
      address: "C/ San Lesmes, 1 - 09004 Burgos",
      email: "",
      phone: "947 20 35 51",
      tags: []
    },

    // AL PAN PAN (ALESAL PAN / CAFÉ SAN LESMES)
    {
      id: "cli_alesal_pan",
      name: "Alesal Pan y Café S.L",
      nif: "B09582420",
      address: "Calle San Lesmes 1, Burgos",
      email: "bertiz.miranda@gmail.com",
      phone: "947277977",
      tags: ["ALESAL PAN","CAFÉ SAN LESMES"]
    },

    // AL PAN PAN BURGOS SL (otra ficha si quieres separarla)
    {
      id: "cli_alpanpan_burgos",
      name: "Al Pan Pan Burgos, S.L.",
      nif: "B09569344",
      address: "C/ Miranda, 17 Bajo, 09002 Burgos",
      email: "bertiz.miranda@gmail.com",
      phone: "947277977",
      tags: []
    },

    // CAFE BAR NUOVO
    {
      id: "cli_nuovo",
      name: "CAFE BAR NUOVO",
      nif: "120221393",
      address: "C/ San Juan de Ortega 14, 09007 Burgos",
      email: "",
      phone: "",
      tags: []
    }
  ];

  state.clients = clients.map(normalizeClient);
  state.invoices = [];
  saveLocal();
}

/* =========================
   19) Boot
========================= */
function init(){
  loadLocal();
  seedIfEmpty();

  if(prefs.cloudEnabled) initFirebase();

  bindEvents();
  routeTo("dashboard");
  renderAll();
  lucide.createIcons();
}

init();
