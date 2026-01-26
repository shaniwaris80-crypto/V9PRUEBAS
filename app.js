/* =========================================================
   ARSLAN • KIWI FACTURAS PRO (FULL)
   ✅ Auth Email/Pass
   ✅ RTDB Nube
   ✅ Merge inteligente local + cloud
   ✅ Clientes + Tags PRO
   ✅ Facturas editables + pagos parciales
   ✅ PDF PRO (jsPDF + AutoTable + QR)
   ✅ Guardar PDF en Firebase Storage + URL en factura
   ✅ WhatsApp PRO
   ✅ Contabilidad avanzada (mes/tag/ranking)
========================================================= */

/* -----------------------------
   0) Utils
----------------------------- */
const $ = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));

const LS_KEY = "arslan_kiwi_facturas_pro_v1";
const LS_SETTINGS = "arslan_kiwi_facturas_settings_v1";

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
function now(){ return Date.now(); }
function safe(s){ return (s ?? "").toString().trim(); }
function clamp0(n){ n=Number(n||0); return isFinite(n)?n:0; }
function eur(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}
function num2(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ el.hidden = true; }, 2200);
}
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

function ymd(date){
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}
function fmtDateES(iso){
  if(!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function formatFechaHora(dateISO, createdAt){
  try{
    const d = createdAt ? new Date(createdAt) : (dateISO ? new Date(dateISO+"T09:00:00") : new Date());
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    const ss = String(d.getSeconds()).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const mo = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    return `${dd}/${mo}/${yy}, ${hh}:${mm}:${ss}`;
  }catch(e){ return ""; }
}

/* -----------------------------
   1) Default data (Clientes)
----------------------------- */
const DEFAULT_DATA = {
  version: "KIWI_FACTURAS_PRO_V1",
  updatedAt: now(),
  clients: [
    {
      id: "cli_riviera",
      name: "CONOR ESY SLU (RIVIERA)",
      nif: "B16794893",
      addr: "Paseo del Espolón",
      city: "09003 Burgos",
      phone: "",
      email: "",
      tags: ["RIVIERA","Centro","Severo","Edificio","Tomillares"]
    },
    {
      id: "cli_golden",
      name: "David Herrera Estalayo (Golden Garden)",
      nif: "71281665L",
      addr: "Trinidad, 12",
      city: "09003 Burgos",
      phone: "",
      email: "",
      tags: ["GOLDEN","IVA INCLUIDO"]
    },
    {
      id: "cli_cons",
      name: "Cuevas Palacios Restauración S.L. (Con/sentidos)",
      nif: "B10694792",
      addr: "C/ San Lesmes, 1",
      city: "09004 Burgos",
      phone: "947203551",
      email: "",
      tags: ["CONSENTIDOS"]
    },
    {
      id: "cli_alpanpan",
      name: "Alesal Pan y Café S.L. (ALESAL PAN / CAFÉ SAN LESMES)",
      nif: "B09582420",
      addr: "Calle San Lesmes 1",
      city: "Burgos",
      phone: "",
      email: "bertiz.miranda@gmail.com",
      tags: ["ALESAL","SAN LESMES"]
    },
    {
      id: "cli_nuovo",
      name: "CAFE BAR NUOVO",
      nif: "120221393",
      addr: "C/ San Juan de Ortega 14",
      city: "09007 Burgos",
      phone: "",
      email: "",
      tags: ["NUOVO"]
    },
    {
      id: "cli_adnan",
      name: "Adnan Asif",
      nif: "X7128589S",
      addr: "Calle Padre Flórez 3",
      city: "Burgos",
      phone: "",
      email: "",
      tags: ["EFECTIVO"]
    }
  ],
  invoices: []
};

/* -----------------------------
   2) Settings (Proveedor + plantilla)
----------------------------- */
function loadSettings(){
  const raw = localStorage.getItem(LS_SETTINGS);
  const base = {
    supplier: {
      name: "Mohammad Arslan Waris",
      nif: "X6389988J",
      addr: "Calle San Pablo 17, 09003 Burgos",
      tel: "631 667 893",
      email: "shaniwaris80@gmail.com"
    },
    ivaDefault: 4,
    numberTpl: "FA-YYYYMMDDHHMM",
    pdfNote: "IVA incluido en los precios."
  };
  if(!raw) return base;
  try{
    const obj = JSON.parse(raw);
    return { ...base, ...obj, supplier: { ...base.supplier, ...(obj.supplier||{}) } };
  }catch(e){ return base; }
}
function saveSettings(s){
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

/* -----------------------------
   3) Local State
----------------------------- */
let settings = loadSettings();

let state = loadLocal() || deepClone(DEFAULT_DATA);
let user = null; // firebase user
let activeTab = "facturas";
let invFilterStatus = "all";
let editingInvoiceId = null;
let editingClientId = null;

function loadLocal(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return null;
  try{ return JSON.parse(raw); } catch(e){ return null; }
}
function saveLocal(){
  state.updatedAt = now();
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* -----------------------------
   4) Firebase (MODULAR)
   ✅ Pega tu config aquí
----------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  getDatabase, ref as dbRef, get, set, update, remove
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

import {
  getStorage, ref as stRef,
  uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// ✅ TU FIREBASE CONFIG (CAMBIA ESTO)
const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI",
  databaseURL: "PEGAR_AQUI",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
};

const appFB = initializeApp(firebaseConfig);
const auth = getAuth(appFB);
const db = getDatabase(appFB);
const storage = getStorage(appFB);

/* -----------------------------
   5) Cloud helpers
----------------------------- */
function cloudPath(p){ return `/users/${user.uid}/data/${p}`; }

async function cloudGet(){
  const snap = await get(dbRef(db, cloudPath("root")));
  return snap.exists() ? snap.val() : null;
}
async function cloudSetRoot(obj){
  await set(dbRef(db, cloudPath("root")), obj);
}
async function cloudUpdateRoot(obj){
  await update(dbRef(db, cloudPath("root")), obj);
}
async function cloudWipe(){
  await remove(dbRef(db, cloudPath("root")));
}

function isDefaultEmpty(st){
  const inv = (st?.invoices || []).length;
  const cl = (st?.clients || []).length;
  return inv === 0 && cl <= 1;
}

/* -----------------------------
   6) Merge inteligente (local + cloud)
   - Dedup facturas por:
     1) id
     2) (dateISO + number + clientNameCache)
   - Merge clientes por:
     1) id
     2) name case-insensitive
   - Remap clientId si se unifica cliente
----------------------------- */
function normalizeClientName(n){
  return safe(n).toLowerCase().replace(/\s+/g," ").trim();
}
function invoiceKey(inv){
  const a = safe(inv.dateISO);
  const b = safe(inv.number);
  const c = safe(inv.clientNameCache || inv.clientName || "");
  return `${a}||${b}||${c}`.toLowerCase();
}

function mergeClients(localClients, cloudClients){
  const out = [];
  const mapId = new Map();
  const mapName = new Map();
  const remap = new Map(); // oldId -> newId

  function addOrMerge(c){
    const id = c.id || uid("cli");
    const nameN = normalizeClientName(c.name);
    const byId = mapId.get(id);
    const byName = mapName.get(nameN);

    if(byId){
      Object.assign(byId, c, { id });
      return byId;
    }
    if(byName){
      // unificar: remap id antiguo hacia el id existente
      if(id !== byName.id) remap.set(id, byName.id);
      Object.assign(byName, c, { id: byName.id });
      return byName;
    }
    const obj = { ...c, id };
    out.push(obj);
    mapId.set(id, obj);
    mapName.set(nameN, obj);
    return obj;
  }

  (cloudClients || []).forEach(addOrMerge);
  (localClients || []).forEach(addOrMerge);

  return { clients: out, remap };
}

function mergeInvoices(localInv, cloudInv, clientRemap){
  const out = [];
  const byId = new Map();
  const byKey = new Map();

  function addOrMerge(inv){
    const id = inv.id || uid("inv");
    const key = invoiceKey(inv);

    // remap clientId
    const cid = inv.clientId;
    if(cid && clientRemap?.has(cid)){
      inv.clientId = clientRemap.get(cid);
    }

    if(byId.has(id)){
      const ex = byId.get(id);
      // merge: toma el más nuevo por updatedAt
      const newer = (inv.updatedAt || 0) >= (ex.updatedAt || 0) ? inv : ex;
      Object.assign(ex, newer, { id: ex.id });
      return ex;
    }

    if(byKey.has(key)){
      const ex = byKey.get(key);
      if(id !== ex.id){
        // si chocan, elige el más nuevo
        const newer = (inv.updatedAt || 0) >= (ex.updatedAt || 0) ? inv : ex;
        Object.assign(ex, newer, { id: ex.id });
      }
      return ex;
    }

    const obj = { ...inv, id };
    out.push(obj);
    byId.set(id, obj);
    byKey.set(key, obj);
    return obj;
  }

  (cloudInv || []).forEach(addOrMerge);
  (localInv || []).forEach(addOrMerge);

  // ordenar por createdAt desc
  out.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return out;
}

function mergeLocalCloud(local, cloud){
  const L = deepClone(local || DEFAULT_DATA);
  const C = deepClone(cloud || DEFAULT_DATA);

  const { clients, remap } = mergeClients(L.clients, C.clients);
  const invoices = mergeInvoices(L.invoices, C.invoices, remap);

  return {
    version: L.version || C.version || "KIWI_FACTURAS_PRO_V1",
    updatedAt: Math.max(L.updatedAt||0, C.updatedAt||0, now()),
    clients,
    invoices
  };
}

/* -----------------------------
   7) Data helpers
----------------------------- */
function getClientById(id){
  return state.clients.find(c=>c.id===id) || null;
}
function getInvoiceById(id){
  return state.invoices.find(i=>i.id===id) || null;
}

function parseTags(txt){
  return safe(txt)
    .split(",")
    .map(s=>s.trim())
    .filter(Boolean);
}

function calcLine(it){
  const mode = safe(it.mode || "kg").toLowerCase();
  const qty = clamp0(it.qty);
  const bruto = clamp0(it.bruto);
  const tara = clamp0(it.tara);
  let neto = clamp0(it.neto);

  if(mode === "kg"){
    // neto = bruto - tara (si no lo pone)
    if(!it._netoManual){
      neto = Math.max(0, bruto - tara);
    }
  }else{
    // caja o ud: neto = qty
    if(!it._netoManual){
      neto = qty;
    }
  }

  const price = clamp0(it.price);
  const amount = neto * price;

  return { ...it, mode, qty, bruto, tara, neto, price, amount };
}

function calcInvoice(inv){
  const items = (inv.items || []).map(calcLine);
  const subtotal = items.reduce((a,b)=>a + clamp0(b.amount), 0);
  const transport = clamp0(inv.transport);
  const ivaPct = clamp0(inv.ivaPct);
  const iva = subtotal * (ivaPct/100);
  const total = subtotal + transport + iva;

  const paid = (inv.payments || []).reduce((a,p)=>a + clamp0(p.amount), 0);
  const due = Math.max(0, total - paid);

  let status = inv.status;
  if(due <= 0.005 && total > 0) status = "pagada";
  else if(paid > 0.01 && due > 0.01) status = "parcial";
  else status = "pendiente";

  return { ...inv, items, subtotal, iva, total, paid, due, status };
}

function ensureInvoiceDefaults(inv){
  const d = new Date();
  const numTpl = settings.numberTpl || "FA-YYYYMMDDHHMM";

  function makeNumber(){
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth()+1).padStart(2,"0");
    const DD = String(d.getDate()).padStart(2,"0");
    const HH = String(d.getHours()).padStart(2,"0");
    const MI = String(d.getMinutes()).padStart(2,"0");
    return numTpl
      .replace("YYYY", String(YYYY))
      .replace("MM", MM)
      .replace("DD", DD)
      .replace("HH", HH)
      .replace("MM", MI); // (sí, MM se reutiliza, está bien visual)
  }

  return calcInvoice({
    id: inv.id || uid("inv"),
    number: inv.number || makeNumber(),
    dateISO: inv.dateISO || ymd(new Date()),
    createdAt: inv.createdAt || now(),
    updatedAt: now(),
    clientId: inv.clientId || (state.clients[0]?.id || ""),
    clientNameCache: inv.clientNameCache || "",
    tags: Array.isArray(inv.tags) ? inv.tags : [],
    method: inv.method || "Efectivo",
    status: inv.status || "pendiente",
    notes: inv.notes || "",
    transport: clamp0(inv.transport),
    ivaPct: inv.ivaPct != null ? clamp0(inv.ivaPct) : clamp0(settings.ivaDefault),
    payments: Array.isArray(inv.payments) ? inv.payments : [],
    pdfUrl: inv.pdfUrl || "",
    pdfPath: inv.pdfPath || "",
    items: Array.isArray(inv.items) ? inv.items : [
      { id: uid("it"), name:"", mode:"kg", qty:1, bruto:0, tara:0, neto:0, price:0, origin:"", _netoManual:false }
    ]
  });
}

/* -----------------------------
   8) PDF PRO (igual a tu modelo)
----------------------------- */
function buildQRDataURL(text, size=120){
  try{
    const qr = new QRious({ value: text || "ARSLAN-KIWI", size, level:"H" });
    return qr.toDataURL("image/png");
  }catch(e){ return null; }
}

function drawKiwiBadge(doc, x, y, r){
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);

  doc.setFillColor(34, 197, 94);
  doc.circle(x, y, r, "F");

  doc.setFillColor(255,255,255);
  doc.circle(x, y, r*0.62, "F");

  doc.setFillColor(17,24,39);
  const pts = [
    [-0.18, -0.08], [0.10, -0.18], [0.22, 0.05], [-0.05, 0.20],
    [-0.25, 0.10], [0.00, -0.28], [0.18, 0.18]
  ];
  pts.forEach(([dx,dy])=> doc.circle(x + dx*r, y + dy*r, r*0.06, "F"));
}

async function generateInvoicePDF_KIWI(invRaw){
  const inv = calcInvoice(invRaw);
  const client = getClientById(inv.clientId);

  const { jsPDF } = window.jspdf || {};
  if(!jsPDF) throw new Error("jsPDF no está cargado.");

  const doc = new jsPDF({ unit:"mm", format:"a4", orientation:"portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const supplier = settings.supplier || {};

  const cardX = 12, cardY = 10, cardW = W - 24, cardH = H - 18;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.6);
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6);

  drawKiwiBadge(doc, cardX + 14, cardY + 38, 7.5);

  doc.setFont("helvetica","bold");
  doc.setFontSize(22);
  doc.text("FACTURA", cardX + 28, cardY + 30);

  doc.setFontSize(14);
  doc.text(safe(supplier.name), cardX + 28, cardY + 40);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(safe(supplier.nif),  cardX + 28, cardY + 47);
  doc.text(safe(supplier.addr), cardX + 28, cardY + 54);
  doc.text(`${safe(supplier.tel)} ·`, cardX + 28, cardY + 61);
  doc.text(safe(supplier.email), cardX + 28, cardY + 68);

  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(`Nº: ${safe(inv.number)}`, cardX + cardW - 72, cardY + 18);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(`Fecha: ${formatFechaHora(inv.dateISO, inv.createdAt)}`, cardX + cardW - 72, cardY + 26);

  // Cliente bloque derecha
  const cx = cardX + cardW - 96;
  const cy = cardY + 38;

  doc.setFont("helvetica","normal");
  doc.setFontSize(13);
  doc.text("Cliente:", cx, cy);

  const clientName = safe(client?.name || inv.clientNameCache || "CLIENTE");
  const clientNif = safe(client?.nif || "");
  const clientAddr = safe(client?.addr || "");
  const clientCity = safe(client?.city || "");
  const clientPhone = safe(client?.phone || "");
  const clientEmail = safe(client?.email || "");

  doc.setFont("helvetica","bold");
  doc.setFontSize(12.5);
  const nameLines = doc.splitTextToSize(clientName, 92);
  doc.text(nameLines, cx, cy + 8);

  let yClient = cy + 8 + (nameLines.length * 5.2);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  if(clientNif){ doc.text(clientNif, cx, yClient); yClient += 6; }
  if(clientAddr){ doc.text(clientAddr, cx, yClient); yClient += 6; }
  if(clientCity){ doc.text(clientCity, cx, yClient); yClient += 6; }
  if(clientPhone){ doc.text(clientPhone + " ·", cx, yClient); yClient += 6; }
  if(clientEmail){
    const mailLines = doc.splitTextToSize(clientEmail, 92);
    doc.text(mailLines, cx, yClient);
    yClient += mailLines.length * 5.2;
  }

  // QR abajo derecha
  const qrText = safe(inv.pdfUrl || `ARSLAN|${inv.number}|${clientName}|${inv.total}`);
  const qrUrl = buildQRDataURL(qrText, 120);
  if(qrUrl){
    doc.addImage(qrUrl, "PNG", cardX + cardW - 40, cardY + 72, 30, 30);
  }

  // Tabla
  const tableTop = cardY + 110;
  const head = [[ "Producto","Modo","Cant.","Bruto","Tara","Neto","Precio","Origen","Importe" ]];

  const body = (inv.items || []).map(it => ([
    safe(it.name),
    safe(it.mode),
    String(it.qty || ""),
    it.bruto ? num2(it.bruto) : "",
    it.tara ? num2(it.tara) : "",
    it.neto ? num2(it.neto) : "",
    it.price ? `${num2(it.price)} €` : "",
    safe(it.origin),
    eur(it.amount || 0)
  ]));

  doc.autoTable({
    startY: tableTop,
    head,
    body,
    theme: "grid",
    margin: { left: cardX + 6, right: cardX + 6 },
    styles: {
      font: "helvetica",
      fontSize: 10.5,
      cellPadding: 2.2,
      lineColor: [209,213,219],
      lineWidth: 0.3,
      textColor: [17,24,39],
      valign: "middle"
    },
    headStyles: {
      fillColor: [243,244,246],
      textColor: [17,24,39],
      fontStyle: "bold",
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 22 },
      8: { cellWidth: 25, halign: "right" }
    },
    didParseCell(data){
      if(data.section === "body"){
        const i = data.row.index;
        if(i % 2 === 1) data.cell.styles.fillColor = [250,250,251];
      }
    }
  });

  const afterTableY = doc.lastAutoTable.finalY + 8;

  doc.setFont("helvetica","normal");
  doc.setFontSize(14);
  doc.text(`Subtotal: ${eur(inv.subtotal)}`, cardX + 8, afterTableY);
  doc.text(`Transporte: ${eur(inv.transport)}`, cardX + 8, afterTableY + 8);
  doc.text(`IVA (${num2(inv.ivaPct)}%): ${eur(inv.iva)}`, cardX + 8, afterTableY + 16);

  doc.setFont("helvetica","bold");
  doc.text(`Total: ${eur(inv.total)}`, cardX + 8, afterTableY + 26);

  doc.setFont("helvetica","normal");
  doc.setFontSize(14);
  doc.text(`Estado: ${safe(inv.status)}`, cardX + cardW - 74, afterTableY);
  doc.text(`Método: ${safe(inv.method)}`, cardX + cardW - 74, afterTableY + 8);
  doc.text(`Obs.: ${safe(inv.notes||"—")}`, cardX + cardW - 74, afterTableY + 16);

  doc.setFont("helvetica","normal");
  doc.setFontSize(11);
  doc.setTextColor(107,114,128);
  doc.text(safe(settings.pdfNote || "IVA incluido en los precios."), cardX + cardW - 70, afterTableY + 30);

  // footer páginas
  const pages = doc.internal.getNumberOfPages();
  for(let p=1; p<=pages; p++){
    doc.setPage(p);
    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.setTextColor(107,114,128);
    doc.text(`Página ${p} / ${pages}`, cardX + cardW - 30, cardY + cardH - 6);
  }
  doc.setTextColor(17,24,39);

  const filename = `${safe(inv.number).replace(/[^\w\-\.]/g,"_")}.pdf`;
  const blob = doc.output("blob");

  return { doc, blob, filename, inv };
}

async function uploadInvoicePDFToCloud({ invId, blob, filename }){
  const path = `arslan_facturas_pdfs/${user.uid}/${invId}/${filename}`;
  const r = stRef(storage, path);
  await uploadBytes(r, blob, { contentType:"application/pdf" });
  const url = await getDownloadURL(r);
  return { url, path };
}

async function regenerateAndSavePDF(invId){
  const inv = getInvoiceById(invId);
  if(!inv) throw new Error("Factura no encontrada");
  const { blob, filename, inv:calcInv } = await generateInvoicePDF_KIWI(inv);

  const up = await uploadInvoicePDFToCloud({ invId, blob, filename });

  // guardar url en factura
  const idx = state.invoices.findIndex(x=>x.id===invId);
  state.invoices[idx] = { ...calcInv, pdfUrl: up.url, pdfPath: up.path, updatedAt: now() };
  saveLocal();

  await cloudSaveAll(); // nube
  toast("✅ PDF guardado en nube");
  window.open(up.url, "_blank", "noopener");
}

/* -----------------------------
   9) Cloud save/load
----------------------------- */
async function cloudSaveAll(){
  if(!user) return;
  const payload = {
    version: state.version,
    updatedAt: now(),
    clients: state.clients,
    invoices: state.invoices
  };
  await cloudSetRoot(payload);
}

async function cloudSyncSmart(){
  if(!user) return;
  toast("☁️ Sincronizando...");

  const cloud = await cloudGet();
  const local = state;

  // si nube tiene datos y local está vacío -> traer nube
  if(cloud && !isDefaultEmpty(cloud) && isDefaultEmpty(local)){
    state = deepClone(cloud);
    saveLocal();
    toast("✅ Cargado desde nube");
    renderAll();
    return;
  }

  // merge bidireccional
  const merged = mergeLocalCloud(local, cloud);
  state = merged;
  saveLocal();
  await cloudSetRoot(merged);
  toast("✅ Sync OK (merge)");
  renderAll();
}

/* -----------------------------
   10) UI render
----------------------------- */
function renderTabs(){
  $$(".tab").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab===activeTab);
  });
  $$(".panel").forEach(p=>{
    p.classList.toggle("show", p.id === `tab-${activeTab}`);
  });
}
function setTab(tab){
  activeTab = tab;
  renderTabs();
}

function renderClientSelects(){
  const opts = [`<option value="">(Todos)</option>`]
    .concat(state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`));
  $("#invClientFilter").innerHTML = opts.join("");

  const optsEd = state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`);
  $("#edClient").innerHTML = optsEd.join("");

  // Report tag select
  const allTags = collectAllTags();
  $("#invTagFilter").innerHTML = [`<option value="">(Todos)</option>`]
    .concat(allTags.map(t=>`<option value="${escapeHtmlAttr(t)}">${escapeHtml(t)}</option>`)).join("");

  $("#repTag").innerHTML = [`<option value="">(Todos)</option>`]
    .concat(allTags.map(t=>`<option value="${escapeHtmlAttr(t)}">${escapeHtml(t)}</option>`)).join("");
}

function collectAllTags(){
  const set = new Set();
  state.clients.forEach(c=>(c.tags||[]).forEach(t=>set.add(t)));
  state.invoices.forEach(i=>(i.tags||[]).forEach(t=>set.add(t)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}
function escapeHtmlAttr(s){
  return escapeHtml(s).replace(/"/g,"&quot;");
}

function statusBadge(status){
  if(status==="pagada") return `<span class="badge ok">PAGADA</span>`;
  if(status==="parcial") return `<span class="badge warn">PARCIAL</span>`;
  return `<span class="badge bad">PENDIENTE</span>`;
}

function tagsHtml(arr){
  const tags = (arr||[]).slice(0,6);
  return tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
}

function matchFilters(inv){
  // status
  if(invFilterStatus !== "all" && inv.status !== invFilterStatus) return false;

  const s = safe($("#invSearch").value).toLowerCase();
  const clientFilter = $("#invClientFilter").value;
  const tagFilter = $("#invTagFilter").value;
  const month = $("#invMonthFilter").value; // YYYY-MM

  if(clientFilter && inv.clientId !== clientFilter) return false;
  if(tagFilter && !(inv.tags||[]).includes(tagFilter)) return false;

  if(month){
    if(!safe(inv.dateISO).startsWith(month)) return false;
  }

  if(s){
    const client = getClientById(inv.clientId);
    const hay = [
      inv.number,
      inv.clientNameCache,
      client?.name,
      (inv.tags||[]).join(" ")
    ].join(" ").toLowerCase();
    if(!hay.includes(s)) return false;
  }

  return true;
}

function renderInvoices(){
  const tbody = $("#invoiceTbody");
  tbody.innerHTML = "";

  const list = state.invoices
    .map(calcInvoice)
    .filter(matchFilters)
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  list.forEach(inv=>{
    const client = getClientById(inv.clientId);
    const pdfBtn = inv.pdfUrl
      ? `<button class="btn ghost" data-openpdf="${inv.id}">📎 Ver</button>`
      : `<span class="muted">—</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(inv.number)}</b></td>
      <td>${escapeHtml(fmtDateES(inv.dateISO))}</td>
      <td>${escapeHtml(client?.name || inv.clientNameCache || "—")}</td>
      <td>${tagsHtml(inv.tags)}</td>
      <td>${statusBadge(inv.status)}</td>
      <td class="right"><b>${eur(inv.total)}</b></td>
      <td class="right">${eur(inv.paid)}</td>
      <td class="right">${eur(inv.due)}</td>
      <td>${pdfBtn}</td>
      <td>
        <button class="btn" data-edit="${inv.id}">Editar</button>
        <button class="btn" data-pdf="${inv.id}">PDF</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b=>{
    b.addEventListener("click", ()=>openInvoiceEditor(b.dataset.edit));
  });
  tbody.querySelectorAll("[data-pdf]").forEach(b=>{
    b.addEventListener("click", ()=>makePDFLocal(b.dataset.pdf));
  });
  tbody.querySelectorAll("[data-openpdf]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const inv = getInvoiceById(b.dataset.openpdf);
      if(inv?.pdfUrl) window.open(inv.pdfUrl, "_blank", "noopener");
    });
  });
}

function renderClients(){
  const tbody = $("#clientsTbody");
  tbody.innerHTML = "";

  state.clients
    .slice()
    .sort((a,b)=>safe(a.name).localeCompare(safe(b.name)))
    .forEach(c=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(c.name)}</b></td>
        <td>${escapeHtml(c.nif||"")}</td>
        <td>${escapeHtml(c.addr||"")}</td>
        <td>${escapeHtml(c.phone||"")}</td>
        <td>${escapeHtml(c.email||"")}</td>
        <td>${tagsHtml(c.tags)}</td>
        <td><button class="btn" data-cl="${c.id}">Editar</button></td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-cl]").forEach(b=>{
    b.addEventListener("click", ()=>openClientEditor(b.dataset.cl));
  });
}

function renderSettings(){
  $("#setSupName").value = safe(settings.supplier?.name);
  $("#setSupNif").value = safe(settings.supplier?.nif);
  $("#setSupAddr").value = safe(settings.supplier?.addr);
  $("#setSupTel").value = safe(settings.supplier?.tel);
  $("#setSupEmail").value = safe(settings.supplier?.email);
  $("#setIvaDefault").value = clamp0(settings.ivaDefault);
  $("#setNumberTpl").value = safe(settings.numberTpl);
  $("#setPdfNote").value = safe(settings.pdfNote);
}

function renderReports(){
  const month = $("#repMonth").value || new Date().toISOString().slice(0,7);
  const tag = $("#repTag").value || "";

  const invs = state.invoices.map(calcInvoice).filter(inv=>{
    if(!safe(inv.dateISO).startsWith(month)) return false;
    if(tag && !(inv.tags||[]).includes(tag)) return false;
    return true;
  });

  const sumTotal = invs.reduce((a,b)=>a + clamp0(b.total),0);
  const sumPaid  = invs.reduce((a,b)=>a + clamp0(b.paid),0);
  const sumDue   = invs.reduce((a,b)=>a + clamp0(b.due),0);

  $("#kIn").textContent = eur(sumTotal);
  $("#kPaid").textContent = eur(sumPaid);
  $("#kDue").textContent = eur(sumDue);

  // list
  const repTbody = $("#repTbody");
  repTbody.innerHTML = "";
  invs
    .sort((a,b)=>(b.total||0)-(a.total||0))
    .forEach(inv=>{
      const cl = getClientById(inv.clientId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(inv.number)}</b></td>
        <td>${escapeHtml(cl?.name || inv.clientNameCache || "—")}</td>
        <td>${statusBadge(inv.status)}</td>
        <td class="right"><b>${eur(inv.total)}</b></td>
        <td class="right">${eur(inv.paid)}</td>
        <td class="right">${eur(inv.due)}</td>
      `;
      repTbody.appendChild(tr);
    });

  // ranking clientes
  const byClient = new Map();
  invs.forEach(inv=>{
    const key = inv.clientId || "—";
    byClient.set(key, (byClient.get(key)||0) + clamp0(inv.total));
  });
  const rankClients = Array.from(byClient.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,12);

  $("#rankClients").innerHTML = rankClients.map(([cid, total])=>{
    const cl = getClientById(cid);
    return `
      <div class="miniItem">
        <div class="left">
          <div class="title">${escapeHtml(cl?.name || "—")}</div>
          <div class="sub">${month}</div>
        </div>
        <div class="amt">${eur(total)}</div>
      </div>
    `;
  }).join("");

  // ranking tags
  const byTag = new Map();
  invs.forEach(inv=>{
    (inv.tags||[]).forEach(t=>{
      byTag.set(t, (byTag.get(t)||0) + clamp0(inv.total));
    });
  });
  const rankTags = Array.from(byTag.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,12);

  $("#rankTags").innerHTML = rankTags.map(([t,total])=>`
    <div class="miniItem">
      <div class="left">
        <div class="title">${escapeHtml(t)}</div>
        <div class="sub">${month}</div>
      </div>
      <div class="amt">${eur(total)}</div>
    </div>
  `).join("");
}

function renderAll(){
  renderTabs();
  renderClientSelects();
  renderInvoices();
  renderClients();
  renderSettings();
  renderReports();
}

/* -----------------------------
   11) Editors
----------------------------- */
function openInvoiceEditor(id){
  editingInvoiceId = id;
  const inv0 = getInvoiceById(id);
  const inv = ensureInvoiceDefaults(inv0 || { id });

  // cache client name
  const cl = getClientById(inv.clientId);
  inv.clientNameCache = safe(cl?.name || inv.clientNameCache);

  // write back in state if new
  if(!inv0){
    state.invoices.unshift(inv);
    saveLocal();
  }else{
    const idx = state.invoices.findIndex(x=>x.id===id);
    state.invoices[idx] = inv;
    saveLocal();
  }

  $("#invoiceEditor").hidden = false;
  $("#edTitle").textContent = `Factura: ${inv.number}`;
  $("#edSub").textContent = `${fmtDateES(inv.dateISO)} • ${inv.clientNameCache || "—"}`;

  $("#edNumber").value = inv.number;
  $("#edDate").value = inv.dateISO;
  $("#edClient").value = inv.clientId;
  $("#edTags").value = (inv.tags||[]).join(", ");
  $("#edMethod").value = inv.method || "Efectivo";
  $("#edStatus").value = inv.status || "pendiente";
  $("#edTransport").value = num2(inv.transport).replace(".","").replace(",","."); // visual
  $("#edIvaPct").value = num2(inv.ivaPct).replace(".","").replace(",",".");
  $("#edNotes").value = inv.notes || "";

  // Whats
  $("#waPhone").value = safe(cl?.phone || "");
  $("#waMsg").value = `Hola, te envío la factura ${inv.number}. Gracias.`;

  renderLines(inv);
  renderPayments(inv);
  renderInvoiceKPIs(inv);
}

function closeInvoiceEditor(){
  editingInvoiceId = null;
  $("#invoiceEditor").hidden = true;
}

function renderInvoiceKPIs(inv){
  const c = calcInvoice(inv);
  $("#mTotal").textContent = eur(c.total);
  $("#mPaid").textContent = eur(c.paid);
  $("#mDue").textContent = eur(c.due);
}

function renderPayments(inv){
  const list = $("#payList");
  const payments = (inv.payments || []).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  list.innerHTML = payments.length ? payments.map(p=>`
    <div class="miniItem">
      <div class="left">
        <div class="title">${escapeHtml(p.method || "Pago")}</div>
        <div class="sub">${escapeHtml(p.dateISO || "")}</div>
      </div>
      <div class="amt">${eur(p.amount||0)}</div>
    </div>
  `).join("") : `<div class="muted">No hay pagos aún.</div>`;
}

function renderLines(inv){
  const tbody = $("#linesTbody");
  tbody.innerHTML = "";

  (inv.items || []).forEach((it, idx)=>{
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input data-k="name" data-i="${idx}" value="${escapeHtmlAttr(it.name||"")}" placeholder="Producto..." /></td>
      <td>
        <select data-k="mode" data-i="${idx}">
          <option value="kg" ${it.mode==="kg"?"selected":""}>kg</option>
          <option value="caja" ${it.mode==="caja"?"selected":""}>caja</option>
          <option value="ud" ${it.mode==="ud"?"selected":""}>ud</option>
        </select>
      </td>
      <td class="right"><input data-k="qty" data-i="${idx}" type="number" inputmode="decimal" step="0.01" value="${it.qty ?? 0}" /></td>
      <td class="right"><input data-k="bruto" data-i="${idx}" type="number" inputmode="decimal" step="0.01" value="${it.bruto ?? 0}" /></td>
      <td class="right"><input data-k="tara" data-i="${idx}" type="number" inputmode="decimal" step="0.01" value="${it.tara ?? 0}" /></td>
      <td class="right"><input data-k="neto" data-i="${idx}" type="number" inputmode="decimal" step="0.01" value="${it.neto ?? 0}" /></td>
      <td class="right"><input data-k="price" data-i="${idx}" type="number" inputmode="decimal" step="0.01" value="${it.price ?? 0}" /></td>
      <td><input data-k="origin" data-i="${idx}" value="${escapeHtmlAttr(it.origin||"")}" placeholder="Origen..." /></td>
      <td class="right"><b>${eur(it.amount||0)}</b></td>
      <td><button class="btn danger" data-del="${idx}">✖</button></td>
    `;
    tbody.appendChild(row);
  });

  // listeners input
  tbody.querySelectorAll("input, select").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      const inv = getInvoiceById(editingInvoiceId);
      if(!inv) return;

      const it = inv.items[i];
      if(!it) return;

      if(k==="name" || k==="mode" || k==="origin"){
        it[k] = safe(inp.value);
      }else{
        it[k] = Number(inp.value || 0);
      }

      // neto manual si el usuario escribe neto
      if(k==="neto") it._netoManual = true;
      if(k==="bruto" || k==="tara" || k==="qty" || k==="mode" || k==="price"){
        // si cambia, neto deja de ser manual si no tocó neto
        // (solo si no escribió neto manual antes)
      }

      inv.items[i] = calcLine(it);
      const c = calcInvoice(inv);
      inv.subtotal = c.subtotal;
      inv.iva = c.iva;
      inv.total = c.total;
      inv.paid = c.paid;
      inv.due = c.due;
      inv.status = c.status;
      inv.updatedAt = now();

      saveLocal();
      renderLines(inv);
      renderInvoiceKPIs(inv);
      renderInvoices();
    });
  });

  // delete line
  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.del);
      const inv = getInvoiceById(editingInvoiceId);
      if(!inv) return;
      inv.items.splice(idx,1);
      if(inv.items.length===0){
        inv.items.push({ id: uid("it"), name:"", mode:"kg", qty:1, bruto:0, tara:0, neto:0, price:0, origin:"", _netoManual:false });
      }
      const c = calcInvoice(inv);
      Object.assign(inv, c, { updatedAt: now() });
      saveLocal();
      renderLines(inv);
      renderInvoiceKPIs(inv);
      renderInvoices();
    });
  });
}

function openClientEditor(id){
  editingClientId = id;
  const c = getClientById(id);
  if(!c) return;

  $("#clientEditor").hidden = false;
  $("#clTitle").textContent = `Cliente: ${c.name}`;

  $("#clName").value = c.name || "";
  $("#clNif").value = c.nif || "";
  $("#clAddr").value = c.addr || "";
  $("#clCity").value = c.city || "";
  $("#clPhone").value = c.phone || "";
  $("#clEmail").value = c.email || "";
  $("#clTags").value = (c.tags||[]).join(", ");
}

function closeClientEditor(){
  editingClientId = null;
  $("#clientEditor").hidden = true;
}

/* -----------------------------
   12) Actions
----------------------------- */
function createNewInvoice(){
  const inv = ensureInvoiceDefaults({
    id: uid("inv"),
    dateISO: ymd(new Date()),
    clientId: state.clients[0]?.id || "",
    tags: [],
    items: [
      { id: uid("it"), name:"", mode:"kg", qty:1, bruto:0, tara:0, neto:0, price:0, origin:"", _netoManual:false }
    ]
  });
  const cl = getClientById(inv.clientId);
  inv.clientNameCache = safe(cl?.name || "");
  state.invoices.unshift(inv);
  saveLocal();
  renderInvoices();
  openInvoiceEditor(inv.id);
}

function duplicateLastInvoice(){
  const last = state.invoices[0];
  if(!last){ createNewInvoice(); return; }

  const base = deepClone(last);
  base.id = uid("inv");
  base.number = ensureInvoiceDefaults({}).number; // nuevo número
  base.dateISO = ymd(new Date());
  base.createdAt = now();
  base.updatedAt = now();
  base.payments = [];
  base.status = "pendiente";
  base.pdfUrl = "";
  base.pdfPath = "";

  state.invoices.unshift(ensureInvoiceDefaults(base));
  saveLocal();
  renderInvoices();
  openInvoiceEditor(base.id);
}

async function makePDFLocal(invId){
  try{
    const inv = getInvoiceById(invId);
    if(!inv) return;
    const { doc, filename } = await generateInvoicePDF_KIWI(inv);
    doc.save(filename);
  }catch(e){
    console.error(e);
    toast("❌ Error PDF");
  }
}

async function makePDFCloud(invId){
  try{
    if(!user){ toast("⚠️ Inicia sesión"); return; }
    await regenerateAndSavePDF(invId);
  }catch(e){
    console.error(e);
    toast("❌ Error guardando PDF nube");
  }
}

function sendWhatsApp(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;
  const phone = safe($("#waPhone").value).replace(/\D/g,"");
  if(!phone){ toast("⚠️ Falta teléfono"); return; }

  const msg = safe($("#waMsg").value) || `Factura ${inv.number}`;
  const link = inv.pdfUrl ? `\n\n📎 PDF: ${inv.pdfUrl}` : "";
  const text = (msg + link).trim();

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

function addPayment(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;

  const amount = clamp0($("#payAmount").value);
  const dateISO = safe($("#payDate").value) || ymd(new Date());
  const method = safe($("#payMethod").value) || "Transferencia";
  if(amount <= 0){ toast("⚠️ Importe inválido"); return; }

  inv.payments = inv.payments || [];
  inv.payments.push({
    id: uid("pay"),
    amount,
    dateISO,
    method,
    createdAt: now()
  });

  const c = calcInvoice(inv);
  Object.assign(inv, c, { updatedAt: now() });

  saveLocal();
  renderPayments(inv);
  renderInvoiceKPIs(inv);
  renderInvoices();

  $("#payAmount").value = "";
  $("#payDate").value = "";
  toast("✅ Pago añadido");
}

function autoNet(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;
  inv.items = (inv.items||[]).map(it=>{
    it._netoManual = false;
    return calcLine(it);
  });
  const c = calcInvoice(inv);
  Object.assign(inv, c, { updatedAt: now() });
  saveLocal();
  renderLines(inv);
  renderInvoiceKPIs(inv);
  renderInvoices();
  toast("🧠 Neto auto aplicado");
}

function addLine(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;
  inv.items.push({ id: uid("it"), name:"", mode:"kg", qty:1, bruto:0, tara:0, neto:0, price:0, origin:"", _netoManual:false });
  saveLocal();
  renderLines(inv);
}

function saveEditorInvoice(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;

  inv.number = safe($("#edNumber").value) || inv.number;
  inv.dateISO = safe($("#edDate").value) || inv.dateISO;
  inv.clientId = safe($("#edClient").value) || inv.clientId;
  inv.tags = parseTags($("#edTags").value);
  inv.method = safe($("#edMethod").value) || "Efectivo";
  inv.status = safe($("#edStatus").value) || inv.status;
  inv.transport = clamp0($("#edTransport").value);
  inv.ivaPct = clamp0($("#edIvaPct").value);
  inv.notes = safe($("#edNotes").value);

  const cl = getClientById(inv.clientId);
  inv.clientNameCache = safe(cl?.name || inv.clientNameCache);

  const c = calcInvoice(inv);
  Object.assign(inv, c, { updatedAt: now() });

  saveLocal();
  renderAll();
  toast("✅ Factura guardada");
}

async function deleteInvoice(){
  const inv = getInvoiceById(editingInvoiceId);
  if(!inv) return;
  if(!confirm("¿Eliminar factura?")) return;

  // Si tiene PDF, borrar Storage (opcional)
  if(user && inv.pdfPath){
    try{
      await deleteObject(stRef(storage, inv.pdfPath));
    }catch(e){
      // ignorar si no existe
    }
  }

  state.invoices = state.invoices.filter(x=>x.id!==editingInvoiceId);
  saveLocal();
  closeInvoiceEditor();
  renderInvoices();
  toast("🗑️ Eliminada");
  if(user) await cloudSaveAll();
}

function createClient(){
  const c = {
    id: uid("cli"),
    name: "Nuevo cliente",
    nif: "",
    addr: "",
    city: "",
    phone: "",
    email: "",
    tags: []
  };
  state.clients.push(c);
  saveLocal();
  renderClients();
  renderClientSelects();
  openClientEditor(c.id);
}

function saveClient(){
  const c = getClientById(editingClientId);
  if(!c) return;

  c.name = safe($("#clName").value) || c.name;
  c.nif = safe($("#clNif").value);
  c.addr = safe($("#clAddr").value);
  c.city = safe($("#clCity").value);
  c.phone = safe($("#clPhone").value);
  c.email = safe($("#clEmail").value);
  c.tags = parseTags($("#clTags").value);

  // actualizar clientNameCache en facturas del cliente
  state.invoices.forEach(inv=>{
    if(inv.clientId === c.id){
      inv.clientNameCache = c.name;
    }
  });

  saveLocal();
  renderAll();
  toast("✅ Cliente guardado");
}

function deleteClient(){
  const c = getClientById(editingClientId);
  if(!c) return;
  if(!confirm("¿Eliminar cliente?")) return;

  // evitar borrar si hay facturas
  const used = state.invoices.some(inv=>inv.clientId===c.id);
  if(used){
    alert("⚠️ No se puede borrar: hay facturas asociadas.");
    return;
  }

  state.clients = state.clients.filter(x=>x.id!==c.id);
  saveLocal();
  closeClientEditor();
  renderAll();
  toast("🗑️ Cliente eliminado");
}

function saveSettingsUI(){
  settings.supplier = {
    name: safe($("#setSupName").value),
    nif: safe($("#setSupNif").value),
    addr: safe($("#setSupAddr").value),
    tel: safe($("#setSupTel").value),
    email: safe($("#setSupEmail").value)
  };
  settings.ivaDefault = clamp0($("#setIvaDefault").value);
  settings.numberTpl = safe($("#setNumberTpl").value) || "FA-YYYYMMDDHHMM";
  settings.pdfNote = safe($("#setPdfNote").value) || "IVA incluido en los precios.";
  saveSettings(settings);
  toast("✅ Ajustes guardados");
}

function exportJSON(){
  const data = {
    settings,
    state
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ARSLAN_KIWI_FACTURAS_EXPORT_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function importJSONFile(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(obj.settings) settings = { ...settings, ...obj.settings };
      if(obj.state){
        state = mergeLocalCloud(state, obj.state);
      }
      saveSettings(settings);
      saveLocal();
      renderAll();
      toast("✅ Importado");
    }catch(e){
      console.error(e);
      toast("❌ JSON inválido");
    }
  };
  reader.readAsText(file);
}

function resetLocal(){
  if(!confirm("¿Limpiar datos locales? (NO borra nube)")) return;
  localStorage.removeItem(LS_KEY);
  state = deepClone(DEFAULT_DATA);
  saveLocal();
  renderAll();
  toast("🧹 Local limpio");
}

async function wipeCloud(){
  if(!user){ toast("⚠️ Inicia sesión"); return; }
  const ok = prompt("Escribe BORRAR para eliminar la nube:");
  if(ok !== "BORRAR") return;
  await cloudWipe();
  toast("⚠️ Nube borrada");
}

/* -----------------------------
   13) Events
----------------------------- */
function bindUI(){
  // tabs
  $$(".tab").forEach(b=>{
    b.addEventListener("click", ()=>{
      setTab(b.dataset.tab);
    });
  });

  // login
  $("#btnLogin").addEventListener("click", async ()=>{
    const email = safe($("#loginEmail").value);
    const pass = safe($("#loginPass").value);
    if(!email || !pass){ toast("⚠️ Falta email/contraseña"); return; }
    try{
      await signInWithEmailAndPassword(auth, email, pass);
    }catch(e){
      console.error(e);
      toast("❌ Login error");
      alert(e.message);
    }
  });

  $("#btnRegister").addEventListener("click", async ()=>{
    const email = safe($("#loginEmail").value);
    const pass = safe($("#loginPass").value);
    if(!email || !pass){ toast("⚠️ Falta email/contraseña"); return; }
    try{
      await createUserWithEmailAndPassword(auth, email, pass);
    }catch(e){
      console.error(e);
      toast("❌ Registro error");
      alert(e.message);
    }
  });

  $("#btnLogout").addEventListener("click", async ()=>{
    await signOut(auth);
  });

  // global actions
  $("#btnSync").addEventListener("click", async ()=>{
    if(!user){ toast("⚠️ Inicia sesión"); return; }
    await cloudSyncSmart();
  });

  $("#btnExportJson").addEventListener("click", exportJSON);

  $("#btnImportJson").addEventListener("click", ()=>{
    $("#fileImport").click();
  });

  $("#fileImport").addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) importJSONFile(f);
    e.target.value = "";
  });

  // facturas actions
  $("#btnNewInvoice").addEventListener("click", createNewInvoice);
  $("#btnNewFromTemplate").addEventListener("click", duplicateLastInvoice);
  $("#fabNew").addEventListener("click", createNewInvoice);

  // filter chips
  $$(".chip").forEach(c=>{
    c.addEventListener("click", ()=>{
      $$(".chip").forEach(x=>x.classList.remove("active"));
      c.classList.add("active");
      invFilterStatus = c.dataset.filter;
      renderInvoices();
    });
  });

  // filters inputs
  ["invSearch","invClientFilter","invTagFilter","invMonthFilter"].forEach(id=>{
    $("#"+id).addEventListener("input", renderInvoices);
    $("#"+id).addEventListener("change", renderInvoices);
  });

  // invoice editor buttons
  $("#btnEdClose").addEventListener("click", closeInvoiceEditor);
  $("#btnEdSave").addEventListener("click", async ()=>{
    saveEditorInvoice();
    if(user) await cloudSaveAll();
  });
  $("#btnEdDelete").addEventListener("click", async ()=>{
    await deleteInvoice();
    if(user) await cloudSaveAll();
  });

  $("#btnAddLine").addEventListener("click", addLine);
  $("#btnAutoNet").addEventListener("click", autoNet);

  $("#btnMakePDFLocal").addEventListener("click", ()=>makePDFLocal(editingInvoiceId));
  $("#btnMakePDFCloud").addEventListener("click", ()=>makePDFCloud(editingInvoiceId));

  $("#btnSendWA").addEventListener("click", sendWhatsApp);

  $("#btnAddPayment").addEventListener("click", async ()=>{
    addPayment();
    if(user) await cloudSaveAll();
  });

  // clients
  $("#btnNewClient").addEventListener("click", createClient);
  $("#btnClClose").addEventListener("click", closeClientEditor);
  $("#btnClSave").addEventListener("click", async ()=>{
    saveClient();
    if(user) await cloudSaveAll();
  });
  $("#btnClDelete").addEventListener("click", async ()=>{
    deleteClient();
    if(user) await cloudSaveAll();
  });

  // reports
  $("#btnRefreshReports").addEventListener("click", renderReports);
  $("#repMonth").addEventListener("change", renderReports);
  $("#repTag").addEventListener("change", renderReports);

  // settings
  $("#btnSaveSettings").addEventListener("click", saveSettingsUI);
  $("#btnResetLocal").addEventListener("click", resetLocal);
  $("#btnDangerWipeCloud").addEventListener("click", wipeCloud);

  // editor selects update
  $("#edClient").addEventListener("change", ()=>{
    const inv = getInvoiceById(editingInvoiceId);
    if(!inv) return;
    inv.clientId = $("#edClient").value;
    const cl = getClientById(inv.clientId);
    inv.clientNameCache = safe(cl?.name || "");
    $("#waPhone").value = safe(cl?.phone || "");
    saveLocal();
    renderInvoices();
  });
}

/* -----------------------------
   14) Auth state
----------------------------- */
onAuthStateChanged(auth, async (u)=>{
  user = u || null;

  if(user){
    $("#loginWrap").hidden = true;
    $("#app").hidden = false;
    $("#btnLogout").hidden = false;
    $("#userChip").hidden = false;

    $("#uEmail").textContent = user.email || "—";
    $("#uUid").textContent = user.uid.slice(0,10) + "…";

    // sync automático al entrar
    try{
      await cloudSyncSmart();
    }catch(e){
      console.error(e);
      toast("⚠️ No se pudo sync (revisa permisos)");
    }
  }else{
    $("#loginWrap").hidden = false;
    $("#app").hidden = true;
    $("#btnLogout").hidden = true;
    $("#userChip").hidden = true;
  }
});

/* -----------------------------
   15) Init
----------------------------- */
function init(){
  // first boot
  if(!loadLocal()){
    saveLocal();
  }

  bindUI();

  // defaults UI
  $("#repMonth").value = new Date().toISOString().slice(0,7);
  $("#invMonthFilter").value = "";
  $("#invSearch").value = "";

  renderAll();
}
init();
