/* =========================================================
   ARSLAN • FACTURAS KIWI PRO (V3.0 Cloud PDF Edition)
   ✅ UI PRO SaaS + mobile tabs
   ✅ Gestión + Contabilidad (reportes reales)
   ✅ Facturas editables (incluye fecha)
   ✅ PDF Local + PDF en nube
   ✅ Firebase Auth + Realtime DB + Storage
   ✅ Merge inteligente para no perder datos
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
  set,
  update,
  remove
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
  // 🔥 PEGA AQUÍ TU CONFIG REAL DE FIREBASE (Project settings → Web App)
  // apiKey: "...",
  // authDomain: "...",
  // databaseURL: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "..."
};

/* =========================
   1) Local Storage Keys
========================= */
const LS_KEY = "arslan_kiwi_pro_v3_state";
const LS_PREF = "arslan_kiwi_pro_v3_prefs";

/* =========================
   2) State
========================= */
let state = {
  clients: [],
  invoices: [],
  meta: {
    lastSyncAt: 0,
    schema: "v3"
  }
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
  editingClientId: null
};

let charts = {
  chart30: null,
  chartMonths: null
};

/* =========================
   3) Utils
========================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function now() { return Date.now(); }

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
}

function iconHTML(type){
  const map = {
    ok: "check-circle-2",
    warn: "alert-triangle",
    bad: "x-circle"
  };
  const name = map[type] || "info";
  return `<i data-lucide="${name}"></i>`;
}

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

function escapeHTML(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function safeLower(s){ return String(s||"").toLowerCase().trim(); }

function isDefaultFirebaseConfig(){
  return !FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey;
}

function cloudPathRoot(){
  if(!firebase.user) return null;
  return `users/${firebase.user.uid}/data`;
}

/* =========================
   4) Persistence (Local)
========================= */
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const obj = JSON.parse(raw);
      if(obj && obj.clients && obj.invoices){
        state = obj;
      }
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

function saveLocal(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function savePrefs(){
  localStorage.setItem(LS_PREF, JSON.stringify(prefs));
}

/* =========================
   5) Firebase init + auth
========================= */
function initFirebase(){
  if(isDefaultFirebaseConfig()){
    // no config
    return;
  }
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
  if(isDefaultFirebaseConfig()) {
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
  if(isDefaultFirebaseConfig()) {
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
   6) Cloud Sync (Realtime DB)
   - Merge inteligente para no perder
========================= */
function normalizeClient(c){
  return {
    id: c.id || uid("cli"),
    name: String(c.name||"").trim(),
    nif: String(c.nif||"").trim(),
    tags: Array.isArray(c.tags) ? c.tags : (String(c.tags||"").split(",").map(x=>x.trim()).filter(Boolean)),
    createdAt: c.createdAt || now(),
    updatedAt: now()
  };
}

function normalizeInvoice(inv){
  return {
    id: inv.id || uid("inv"),
    number: String(inv.number||genInvoiceNumber()).trim(),
    dateISO: inv.dateISO || ymd(),
    clientId: inv.clientId || "",
    clientNameCache: String(inv.clientNameCache||"").trim(),
    tag: String(inv.tag||"").trim(),
    amount: Number(inv.amount||0),
    status: inv.status || "PENDIENTE",
    notes: String(inv.notes||""),
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
    meta: { schema:"v3", lastSyncAt: now() }
  };

  const locClients = (localData?.clients||[]).map(normalizeClient);
  const cloClients = (cloudData?.clients||[]).map(normalizeClient);

  const locInv = (localData?.invoices||[]).map(normalizeInvoice);
  const cloInv = (cloudData?.invoices||[]).map(normalizeInvoice);

  // Clients merge:
  const mapClientById = new Map();
  const mapClientByName = new Map();

  function addClient(c){
    const keyName = safeLower(c.name);
    if(mapClientById.has(c.id)){
      const prev = mapClientById.get(c.id);
      // keep latest
      mapClientById.set(c.id, prev.updatedAt > c.updatedAt ? prev : c);
      return;
    }
    if(keyName && mapClientByName.has(keyName)){
      const prev = mapClientByName.get(keyName);
      const chosen = prev.updatedAt > c.updatedAt ? prev : c;
      mapClientById.set(chosen.id, chosen);
      mapClientByName.set(keyName, chosen);
      return;
    }
    mapClientById.set(c.id, c);
    if(keyName) mapClientByName.set(keyName, c);
  }

  [...cloClients, ...locClients].forEach(addClient);
  out.clients = Array.from(mapClientById.values());

  // Build client name remap (if same name diff id)
  const nameToId = new Map();
  out.clients.forEach(c => nameToId.set(safeLower(c.name), c.id));

  // Invoices merge:
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

  // Re-map clientId if needed by cache name:
  const mergedInv = Array.from(invById.values()).map(inv=>{
    const cname = safeLower(inv.clientNameCache);
    if(cname && nameToId.has(cname)){
      inv.clientId = nameToId.get(cname);
    }
    return inv;
  });

  out.invoices = mergedInv.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  return out;
}

async function syncFromCloud(){
  if(!prefs.cloudEnabled) return;
  initFirebase();
  if(!firebase.user || !firebase.db) return;

  try{
    const root = cloudPathRoot();
    const r = dbRef(firebase.db, root);
    const snap = await get(r);
    const cloudData = snap.exists() ? snap.val() : null;

    const merged = mergeData(state, cloudData);

    state = merged;
    saveLocal();

    // push merged back to cloud to ensure unified state
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
    const root = cloudPathRoot();
    await set(dbRef(firebase.db, root), state);
    state.meta.lastSyncAt = now();
    saveLocal();
    setCloudUI("green","Sincronizado ✅");
  }catch(err){
    setCloudUI("red","Error nube");
    toast("bad","Guardar nube", err?.message || "No se pudo guardar");
  }
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
   7) PDF Generation + Cloud Upload
========================= */
function buildPDF(invoice){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const margin = 42;
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ARSLAN • FACTURAS", margin, 62);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("KIWI PRO — Documento de Factura", margin, 82);

  doc.setDrawColor(180);
  doc.line(margin, 96, w - margin, 96);

  // Info block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Factura:", margin, 126);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.number || "-", margin + 70, 126);

  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", margin, 146);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.dateISO || "-", margin + 70, 146);

  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", margin, 166);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.clientNameCache || "-", margin + 70, 166);

  doc.setFont("helvetica", "bold");
  doc.text("Tag:", margin, 186);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.tag || "-", margin + 70, 186);

  doc.setFont("helvetica", "bold");
  doc.text("Estado:", margin, 206);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.status || "-", margin + 70, 206);

  // Table (simple)
  doc.autoTable({
    startY: 240,
    head: [["Concepto", "Importe"]],
    body: [[
      invoice.notes ? `Factura — ${invoice.notes}` : "Factura",
      `${fmtNum2(invoice.amount)} €`
    ]],
    styles: { fontSize: 11, cellPadding: 10 },
    headStyles: { fillColor: [22,163,74] },
    alternateRowStyles: { fillColor: [245,247,250] }
  });

  const lastY = doc.lastAutoTable.finalY + 18;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`TOTAL: ${fmtNum2(invoice.amount)} €`, margin, lastY + 18);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Documento generado por ARSLAN • KIWI PRO", margin, 815);

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

  // Generate PDF blob
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
  // Upload PDF and attach to invoice, then save to cloud
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
   8) CRUD
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
  // prevent deleting if invoices exist
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
  if(cli){
    x.clientNameCache = cli.name;
  }

  const idx = state.invoices.findIndex(i=>i.id===x.id);
  if(idx>=0){
    // keep existing pdf unless overwritten
    const prev = state.invoices[idx];
    x.pdf = x.pdf || prev.pdf || null;
    state.invoices[idx] = { ...prev, ...x, updatedAt: now() };
  }else{
    state.invoices.unshift(x);
  }

  saveLocal();

  // Cloud push data
  await pushToCloud();

  // Upload PDF if requested or autoPDF
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
   9) Rendering + Router
========================= */
function routeTo(route){
  ui.route = route;
  const titleMap = {
    dashboard: ["Dashboard","Resumen del negocio"],
    invoices: ["Facturas","Gestión de facturación + PDFs"],
    clients: ["Clientes","CRM simple + tags"],
    reports: ["Contabilidad","Reportes y rankings"],
    settings: ["Ajustes","Nube, backups y preferencias"]
  };

  $$(".nav-item").forEach(b=>{
    b.classList.toggle("active", b.dataset.route === route);
  });

  $$(".mobile-tabs .tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.route === route);
  });

  $("#pageTitle").textContent = titleMap[route]?.[0] || "ARSLAN";
  $("#pageSubtitle").textContent = titleMap[route]?.[1] || "";

  $$(".view").forEach(v=>v.classList.add("hidden"));
  $(`#view-${route}`).classList.remove("hidden");

  renderAll();
}

function renderAll(){
  // Theme
  document.body.classList.toggle("dark", prefs.theme === "dark");

  // Cloud UI
  if(!prefs.cloudEnabled){
    setCloudUI("gray", "Local (sin nube)");
  }else{
    if(isDefaultFirebaseConfig()){
      setCloudUI("red","Falta Firebase config");
    }else if(firebase.user){
      setCloudUI("green","Nube conectada ✅");
    }else{
      setCloudUI("red","Nube (sin login)");
    }
  }

  // Settings toggles
  $("#toggleCloud").checked = !!prefs.cloudEnabled;
  $("#toggleAutoPDF").checked = !!prefs.autoPDF;

  // Rebuild tags select options
  renderTagFilterOptions();
  renderInvoiceEditorOptions();

  // Views content
  renderDashboard();
  renderInvoices();
  renderClients();
  renderReports();

  lucide.createIcons();
}

function renderTagFilterOptions(){
  const tags = collectTags();
  const sel = $("#filterTag");
  const prev = sel.value;
  sel.innerHTML = `<option value="">Todos los tags</option>` + tags.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
  sel.value = prev;
}

function renderInvoiceEditorOptions(){
  // clients select
  const selC = $("#invClient");
  const selT = $("#invTag");

  selC.innerHTML = state.clients
    .sort((a,b)=> safeLower(a.name).localeCompare(safeLower(b.name)))
    .map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`)
    .join("");

  // tags list
  const tags = collectTags();
  const current = selT.value;
  selT.innerHTML = `<option value="">— Sin tag —</option>` + tags.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
  selT.value = current || "";
}

function collectTags(){
  const tags = new Set();
  state.clients.forEach(c=> (c.tags||[]).forEach(t=> tags.add(String(t).trim()).toString()));
  state.invoices.forEach(i=> { if(i.tag) tags.add(String(i.tag).trim()); });
  return Array.from(tags).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

function renderDashboard(){
  const today = ymd();
  const dtNow = new Date();
  const thisMonth = `${dtNow.getFullYear()}-${String(dtNow.getMonth()+1).padStart(2,"0")}`;

  // week range: last 7 days
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-6);
  const weekFrom = ymd(weekStart);

  const inv = filteredInvoicesBase();

  const invToday = inv.filter(i=>i.dateISO===today);
  const invWeek = inv.filter(i=>i.dateISO>=weekFrom && i.dateISO<=today);
  const invMonth = inv.filter(i=>i.dateISO.startsWith(thisMonth));
  const invPending = inv.filter(i=>i.status==="PENDIENTE");

  $("#kpiToday").textContent = fmtEUR(sum(invToday));
  $("#kpiTodayCount").textContent = `${invToday.length} facturas`;

  $("#kpiWeek").textContent = fmtEUR(sum(invWeek));
  $("#kpiWeekCount").textContent = `${invWeek.length} facturas`;

  $("#kpiMonth").textContent = fmtEUR(sum(invMonth));
  $("#kpiMonthCount").textContent = `${invMonth.length} facturas`;

  $("#kpiPending").textContent = fmtEUR(sum(invPending));
  $("#kpiPendingCount").textContent = `${invPending.length} facturas`;

  // Chart 30 days
  renderChart30(inv);

  // Top clients month
  renderTopClients(invMonth);
}

function sum(list){
  return list.reduce((a,x)=>a + Number(x.amount||0), 0);
}

function filteredInvoicesBase(){
  let list = [...state.invoices];

  // global search
  const q = safeLower(ui.search);
  if(q){
    list = list.filter(i=>{
      return safeLower(i.number).includes(q) ||
             safeLower(i.clientNameCache).includes(q) ||
             safeLower(i.tag).includes(q) ||
             String(i.amount||"").includes(q);
    });
  }

  // tag filter
  if(ui.tagFilter){
    list = list.filter(i=> (i.tag||"") === ui.tagFilter);
  }

  return list;
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
    days.push(key.slice(5)); // MM-DD
    const sumDay = list.filter(i=>i.dateISO===key).reduce((a,x)=>a+Number(x.amount||0),0);
    vals.push(sumDay);
  }

  const ctx = $("#chart30");
  if(!ctx) return;

  if(charts.chart30) charts.chart30.destroy();

  charts.chart30 = new Chart(ctx, {
    type:"line",
    data:{
      labels: days,
      datasets:[{
        label:"€",
        data: vals,
        tension:.35,
        fill:false
      }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        y:{ ticks:{ callback:(v)=> `${v}€` } }
      }
    }
  });
}

function renderTopClients(invMonth){
  const map = new Map();
  invMonth.forEach(i=>{
    const k = i.clientNameCache || "SIN CLIENTE";
    map.set(k, (map.get(k)||0) + Number(i.amount||0));
  });

  const arr = Array.from(map.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8);

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

  // filter chips
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
    const hasPDF = inv.pdf && inv.pdf.downloadURL;
    return `
      <tr>
        <td>${escapeHTML(inv.dateISO||"")}</td>
        <td><b>${escapeHTML(inv.number||"")}</b></td>
        <td>${escapeHTML(inv.clientNameCache||"")}</td>
        <td>${inv.tag ? `<span class="badge">${escapeHTML(inv.tag)}</span>` : `<span class="muted small">—</span>`}</td>
        <td>${fmtEUR(inv.amount||0)}</td>
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

  // totals per client
  const totals = new Map();
  state.invoices.forEach(i=>{
    totals.set(i.clientId, (totals.get(i.clientId)||0) + Number(i.amount||0));
  });

  const list = [...state.clients].sort((a,b)=>safeLower(a.name).localeCompare(safeLower(b.name)));

  tbody.innerHTML = list.map(c=>{
    const sumC = totals.get(c.id)||0;
    const tags = (c.tags||[]).map(t=>`<span class="badge">${escapeHTML(t)}</span>`).join(" ");
    return `
      <tr>
        <td><b>${escapeHTML(c.name)}</b></td>
        <td>${escapeHTML(c.nif||"")}</td>
        <td>${tags || `<span class="muted small">—</span>`}</td>
        <td>${fmtEUR(sumC)}</td>
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
  // months chart
  renderChartMonths();

  // default date range last 30
  if(!$("#repFrom").value){
    const d = new Date(); d.setDate(d.getDate()-30);
    $("#repFrom").value = ymd(d);
  }
  if(!$("#repTo").value){
    $("#repTo").value = ymd();
  }
}

function renderChartMonths(){
  const ctx = $("#chartMonths");
  if(!ctx) return;

  // group by YYYY-MM
  const map = new Map();
  state.invoices.forEach(i=>{
    const k = String(i.dateISO||"").slice(0,7);
    if(!k || k.length<7) return;
    map.set(k, (map.get(k)||0) + Number(i.amount||0));
  });

  const keys = Array.from(map.keys()).sort((a,b)=>a.localeCompare(b)).slice(-12);
  const vals = keys.map(k=>map.get(k)||0);

  if(charts.chartMonths) charts.chartMonths.destroy();

  charts.chartMonths = new Chart(ctx,{
    type:"bar",
    data:{
      labels: keys,
      datasets:[{ label:"€", data: vals }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ ticks:{ callback:(v)=> `${v}€` } } }
    }
  });
}

/* =========================
   10) Report generation (range)
========================= */
function runReport(){
  const from = $("#repFrom").value || "0000-00-00";
  const to = $("#repTo").value || "9999-99-99";

  const list = state.invoices.filter(i=> i.dateISO>=from && i.dateISO<=to);

  // ranking clients
  const mapC = new Map();
  list.forEach(i=>{
    const k = i.clientNameCache || "SIN CLIENTE";
    mapC.set(k, (mapC.get(k)||0) + Number(i.amount||0));
  });
  const arrC = Array.from(mapC.entries()).sort((a,b)=>b[1]-a[1]);

  $("#rankClients").innerHTML = arrC.length ? arrC.slice(0,20).map(([n,v],idx)=>`
    <div class="list-item">
      <div>
        <b>#${idx+1} ${escapeHTML(n)}</b><br>
        <small>${fmtEUR(v)}</small>
      </div>
      <span class="badge ok">${((v/sum(list))*100 || 0).toFixed(1)}%</span>
    </div>
  `).join("") : `<div class="muted">Sin datos en el rango.</div>`;

  // ranking tags
  const mapT = new Map();
  list.forEach(i=>{
    const k = i.tag ? i.tag : "SIN TAG";
    mapT.set(k, (mapT.get(k)||0) + Number(i.amount||0));
  });
  const arrT = Array.from(mapT.entries()).sort((a,b)=>b[1]-a[1]);

  $("#rankTags").innerHTML = arrT.length ? arrT.map(([t,v])=>`
    <div class="list-item">
      <div><b>${escapeHTML(t)}</b><br><small>${fmtEUR(v)}</small></div>
      <span class="badge">${((v/sum(list))*100 || 0).toFixed(1)}%</span>
    </div>
  `).join("") : `<div class="muted">Sin datos.</div>`;

  toast("ok","Reporte generado",`Rango ${from} → ${to}`);
}

/* =========================
   11) Modals
========================= */
function openModal(id){ $(`#${id}`).classList.remove("hidden"); lucide.createIcons(); }
function closeModal(id){ $(`#${id}`).classList.add("hidden"); }

function closeAllModals(){
  $$(".modal").forEach(m=>m.classList.add("hidden"));
}

function openInvoiceEditor(invoice){
  ui.editingInvoiceId = invoice?.id || null;

  $("#invModalTitle").textContent = invoice ? `✏️ Editar factura` : `🧾 Nueva factura`;

  $("#invDate").value = invoice?.dateISO || ymd();
  $("#invNumber").value = invoice?.number || genInvoiceNumber();

  // select client
  renderInvoiceEditorOptions();
  if(invoice?.clientId){
    $("#invClient").value = invoice.clientId;
  }else{
    // default first
    if(state.clients[0]) $("#invClient").value = state.clients[0].id;
  }

  $("#invTag").value = invoice?.tag || "";
  $("#invStatus").value = invoice?.status || "PENDIENTE";
  $("#invAmount").value = invoice?.amount != null ? Number(invoice.amount).toFixed(2) : "";
  $("#invNotes").value = invoice?.notes || "";

  const canView = !!(invoice?.pdf?.downloadURL);
  $("#btnInvViewPDF").disabled = !canView;

  openModal("modalInvoice");
}

function openClientEditor(client){
  ui.editingClientId = client?.id || null;
  $("#cliModalTitle").textContent = client ? "✏️ Editar cliente" : "👤 Nuevo cliente";

  $("#cliName").value = client?.name || "";
  $("#cliNIF").value = client?.nif || "";
  $("#cliTags").value = (client?.tags || []).join(", ");

  $("#btnCliDelete").style.display = client ? "inline-flex" : "none";

  openModal("modalClient");
}

function openPDF(url){
  $("#pdfFrame").src = url;
  openModal("modalPDF");
}

/* =========================
   12) Import/Export JSON + CSV
========================= */
function exportJSON(){
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ARSLAN_KIWI_BACKUP_${ymd()}_v3.json`;
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
  const rows = [
    ["dateISO","number","client","tag","amount","status","pdfURL"]
  ];
  state.invoices.forEach(i=>{
    rows.push([
      i.dateISO||"",
      i.number||"",
      i.clientNameCache||"",
      i.tag||"",
      String(i.amount||0),
      i.status||"",
      i.pdf?.downloadURL || ""
    ]);
  });
  const csv = rows.map(r=>r.map(x=> `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `FACTURAS_${ymd()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("ok","CSV exportado","Listo.");
}

/* =========================
   13) Events
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
      const copy = { ...inv, id: uid("inv"), number: genInvoiceNumber(), createdAt: now(), updatedAt: now(), pdf:null };
      await addOrUpdateInvoice(copy, {uploadPDF:false});
      toast("ok","Duplicada","Factura duplicada.");
    }

    if(act==="pdfLocal"){
      downloadPDFLocal(inv);
    }

    if(act==="pdfCloud"){
      await ensureInvoicePDFCloud(inv);
    }

    if(act==="viewPDF"){
      if(inv.pdf?.downloadURL) openPDF(inv.pdf.downloadURL);
    }

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
      if(!state.clients.length){
        toast("warn","Crea un cliente","Primero añade un cliente.");
        return;
      }
      openInvoiceEditor({
        id:null,
        dateISO: ymd(),
        number: genInvoiceNumber(),
        clientId: cli.id,
        clientNameCache: cli.name,
        tag: "",
        amount: 0,
        status:"PENDIENTE",
        notes:""
      });
    }
  });

  // client save/delete
  $("#btnCliSave").addEventListener("click", ()=>{
    const obj = {
      id: ui.editingClientId || uid("cli"),
      name: $("#cliName").value.trim(),
      nif: $("#cliNIF").value.trim(),
      tags: $("#cliTags").value.split(",").map(x=>x.trim()).filter(Boolean),
      updatedAt: now()
    };
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
  $("#btnInvSave").addEventListener("click", async ()=>{
    const id = ui.editingInvoiceId || uid("inv");
    const clientId = $("#invClient").value;

    const inv = {
      id,
      dateISO: $("#invDate").value || ymd(),
      number: $("#invNumber").value.trim() || genInvoiceNumber(),
      clientId,
      clientNameCache: getClientById(clientId)?.name || "",
      tag: $("#invTag").value || "",
      status: $("#invStatus").value || "PENDIENTE",
      amount: Number($("#invAmount").value || 0),
      notes: $("#invNotes").value.trim(),
      updatedAt: now()
    };

    await addOrUpdateInvoice(inv, { uploadPDF:false });
    closeModal("modalInvoice");
  });

  $("#btnInvDuplicate").addEventListener("click", async ()=>{
    if(!ui.editingInvoiceId){
      toast("warn","Duplica después","Primero guarda la factura.");
      return;
    }
    const inv = getInvoiceById(ui.editingInvoiceId);
    if(!inv) return;

    const copy = { ...inv, id: uid("inv"), number: genInvoiceNumber(), createdAt: now(), updatedAt: now(), pdf:null };
    await addOrUpdateInvoice(copy, {uploadPDF:false});
    toast("ok","Duplicada","Factura duplicada.");
  });

  $("#btnInvPDFLocal").addEventListener("click", ()=>{
    const inv = buildInvoiceFromEditor();
    downloadPDFLocal(inv);
  });

  $("#btnInvPDFCloud").addEventListener("click", async ()=>{
    // save first if not exists
    const inv = buildInvoiceFromEditor(true);
    await addOrUpdateInvoice(inv, {uploadPDF:false});
    await ensureInvoicePDFCloud(getInvoiceById(inv.id));
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
  document.addEventListener("keydown", async (e)=>{
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

function buildInvoiceFromEditor(forceId=false){
  const existingId = ui.editingInvoiceId;
  const id = existingId || (forceId ? uid("inv") : uid("inv"));
  const clientId = $("#invClient").value;

  return normalizeInvoice({
    id,
    dateISO: $("#invDate").value || ymd(),
    number: $("#invNumber").value.trim() || genInvoiceNumber(),
    clientId,
    clientNameCache: getClientById(clientId)?.name || "",
    tag: $("#invTag").value || "",
    status: $("#invStatus").value || "PENDIENTE",
    amount: Number($("#invAmount").value || 0),
    notes: $("#invNotes").value.trim(),
    updatedAt: now()
  });
}

/* =========================
   14) Boot
========================= */
function seedIfEmpty(){
  if(state.clients.length) return;

  // Demo client
  state.clients = [
    normalizeClient({ id:"cli_riviera", name:"RIVIERA", nif:"B16794893", tags:["Centro","Severo","Edificio","Tomillares"] }),
    normalizeClient({ id:"cli_braseros", name:"BRASEROS", nif:"", tags:["Centro","Severo","Edificio","Tomillares"] })
  ];

  state.invoices = [];
  saveLocal();
}

function init(){
  loadLocal();
  seedIfEmpty();

  // theme from prefs
  document.body.classList.toggle("dark", prefs.theme === "dark");

  // init firebase if cloud enabled
  if(prefs.cloudEnabled) initFirebase();

  bindEvents();
  routeTo("dashboard");
  renderAll();

  // start icons
  lucide.createIcons();
}

init();
