/* =========================================================
   ARSLAN — PONER PRECIOS (PRO B/W)
   prices.js — Editor externo
   - Lee catálogo desde ?pack= (LZString base64)
   - Permite editar precios rápido
   - Genera link de vuelta con SOLO precios (y solo cambios opcional)
========================================================= */

const LS_KEY = "arslan_prices_editor_v1";

const $ = (q) => document.querySelector(q);
const rowsEl = $("#rows");
const searchEl = $("#search");
const onlyChangedEl = $("#onlyChanged");
const pillInfo = $("#pillInfo");
const metaText = $("#metaText");
const linkBox = $("#linkBox");
const linkMsg = $("#linkMsg");

const btnExport = $("#btnExport");
const btnImport = $("#btnImport");
const fileImport = $("#fileImport");
const btnReset = $("#btnReset");
const btnCopyBackLink = $("#btnCopyBackLink");
const btnCopyLinkBox = $("#btnCopyLinkBox");

function nowISO(){
  const d = new Date();
  return d.toISOString();
}

function safeJSONParse(s){
  try{ return JSON.parse(s); } catch(e){ return null; }
}

function fmt2(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return "";
  return String(Math.round(x * 100) / 100);
}

function normalizeName(s){
  return (s || "").trim().replace(/\s+/g," ").toUpperCase();
}

function getBaseUrl(){
  // base actual de prices.html
  const u = new URL(location.href);
  u.hash = "";
  u.search = "";
  return u.toString();
}

function getMainAppGuess(){
  // si el editor está en la misma carpeta, la app suele estar en index.html
  const u = new URL(location.href);
  u.pathname = u.pathname.replace(/\/[^/]*$/, "/index.html");
  u.hash = "";
  // el main app importará ?prices=...
  return u.toString();
}

function lzDecompressParam(param){
  if(!param) return null;
  try{
    const json = LZString.decompressFromEncodedURIComponent(param);
    return safeJSONParse(json);
  }catch(e){
    return null;
  }
}

function lzCompress(obj){
  const json = JSON.stringify(obj);
  return LZString.compressToEncodedURIComponent(json);
}

function loadInitialPack(){
  // 1) ?pack=... (catálogo enviado por la app principal)
  const u = new URL(location.href);
  const pack = u.searchParams.get("pack");
  if(pack){
    const data = lzDecompressParam(pack);
    if(data && typeof data === "object"){
      return { data, source: "pack" };
    }
  }

  // 2) localStorage (última sesión del editor)
  const ls = safeJSONParse(localStorage.getItem(LS_KEY) || "null");
  if(ls && typeof ls === "object"){
    return { data: ls, source: "local" };
  }

  // 3) fallback: vacío
  return { data: null, source: "empty" };
}

function saveLS(payload){
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

function defaultPayload(){
  return {
    meta: {
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source: "empty",
      note: "Editor externo",
      // opcional: referencia a la app principal
      mainApp: getMainAppGuess()
    },
    products: [], // [{id,name,unitDefault,kgBox,priceKg,priceBox,priceUnit, history?}]
    edits: {}     // { key: {unitDefault,kgBox,priceKg,priceBox,priceUnit, editedAt} }
  };
}

let STATE = defaultPayload();

function hydrate(){
  const init = loadInitialPack();
  if(init.data){
    // Normalizamos estructura
    const data = init.data;
    const payload = defaultPayload();

    payload.meta = Object.assign(payload.meta, data.meta || {});
    payload.meta.source = init.source;
    payload.meta.loadedAt = nowISO();

    // productos
    const products = Array.isArray(data.products) ? data.products : [];
    payload.products = products.map((p, i) => {
      const name = normalizeName(p.name || p.nombre || "");
      const id = (p.id || p.key || `p_${i}_${name}`).toString();
      return {
        id,
        name,
        unitDefault: (p.unitDefault || p.unit || "kg"),
        kgBox: (p.kgBox ?? p.kgPerBox ?? ""),
        priceKg: (p.priceKg ?? ""),
        priceBox: (p.priceBox ?? ""),
        priceUnit: (p.priceUnit ?? ""),
        history: Array.isArray(p.history) ? p.history.slice(0,5) : []
      };
    });

    // edits existentes (si vienen)
    payload.edits = (data.edits && typeof data.edits === "object") ? data.edits : {};

    STATE = payload;
    saveLS(STATE);
  }else{
    // cargamos LS si existe, si no default
    const ls = safeJSONParse(localStorage.getItem(LS_KEY) || "null");
    if(ls && typeof ls === "object"){
      STATE = Object.assign(defaultPayload(), ls);
    }else{
      STATE = defaultPayload();
    }
  }

  // meta UI
  metaText.textContent =
    `Fuente: ${STATE.meta.source || "—"} • Productos: ${STATE.products.length} • ` +
    `Actualizado: ${(STATE.meta.updatedAt || "").slice(0,19).replace("T"," ") || "—"}`;
}

function getEditKey(prod){
  return prod.id || prod.name;
}

function markEdited(prod, patch){
  const key = getEditKey(prod);
  STATE.edits[key] = Object.assign({}, STATE.edits[key] || {}, patch, { editedAt: nowISO() });
  STATE.meta.updatedAt = nowISO();
  saveLS(STATE);
  updatePill();
}

function updatePill(){
  const n = Object.keys(STATE.edits || {}).length;
  pillInfo.textContent = `${n} cambios`;
}

function filterProducts(){
  const q = normalizeName(searchEl.value);
  const onlyChanged = !!onlyChangedEl.checked;

  return STATE.products.filter(p => {
    if(q && !p.name.includes(q)) return false;

    if(onlyChanged){
      const key = getEditKey(p);
      return !!(STATE.edits && STATE.edits[key]);
    }
    return true;
  });
}

function makeRow(prod){
  const key = getEditKey(prod);
  const edit = (STATE.edits && STATE.edits[key]) ? STATE.edits[key] : {};

  const unitDefault = edit.unitDefault ?? prod.unitDefault ?? "kg";
  const kgBox = edit.kgBox ?? prod.kgBox ?? "";
  const priceKg = edit.priceKg ?? prod.priceKg ?? "";
  const priceBox = edit.priceBox ?? prod.priceBox ?? "";
  const priceUnit = edit.priceUnit ?? prod.priceUnit ?? "";

  const row = document.createElement("div");
  row.className = "g-row";

  row.innerHTML = `
    <div class="colProd">
      <div style="font-weight:900">${prod.name}</div>
      <div class="muted mini" style="margin-top:2px">ID: ${prod.id}</div>
    </div>

    <div class="colUnit">
      <select data-k="unitDefault" data-id="${prod.id}">
        <option value="kg">kg</option>
        <option value="caja">caja</option>
        <option value="unidad">unidad</option>
      </select>
    </div>

    <div class="colKgBox">
      <input data-k="kgBox" data-id="${prod.id}" type="number" inputmode="decimal" step="0.01" placeholder="Kg/caja">
    </div>

    <div class="colKg">
      <input data-k="priceKg" data-id="${prod.id}" type="number" inputmode="decimal" step="0.01" placeholder="€/kg">
    </div>

    <div class="colBox">
      <input data-k="priceBox" data-id="${prod.id}" type="number" inputmode="decimal" step="0.01" placeholder="€/caja">
    </div>

    <div class="colUnit colUnitPrice">
      <input data-k="priceUnit" data-id="${prod.id}" type="number" inputmode="decimal" step="0.01" placeholder="€/ud">
    </div>

    <div class="colStatus">
      <div class="status">
        <span class="badge">${edit.editedAt ? "EDITADO" : "—"}</span>
        <span class="muted" style="font-size:11px">${edit.editedAt ? edit.editedAt.slice(0,19).replace("T"," ") : ""}</span>
      </div>
    </div>
  `;

  // set values
  row.querySelector(`select[data-id="${prod.id}"][data-k="unitDefault"]`).value = unitDefault;

  const setV = (k, v) => {
    const el = row.querySelector(`[data-id="${prod.id}"][data-k="${k}"]`);
    if(!el) return;
    el.value = (v === null || v === undefined) ? "" : String(v);
  };

  setV("kgBox", kgBox);
  setV("priceKg", priceKg);
  setV("priceBox", priceBox);
  setV("priceUnit", priceUnit);

  // Enter -> next input/select
  const focusables = [...row.querySelectorAll("select, input")];
  focusables.forEach((el, idx) => {
    el.addEventListener("keydown", (ev) => {
      if(ev.key === "Enter"){
        ev.preventDefault();
        // siguiente campo dentro de la fila; si es el último, saltamos a la siguiente fila primer campo editable
        const next = focusables[idx + 1];
        if(next){
          next.focus();
          next.select?.();
        }else{
          const all = [...document.querySelectorAll("#rows select, #rows input")];
          const pos = all.indexOf(el);
          if(pos >= 0 && all[pos+1]){
            all[pos+1].focus();
            all[pos+1].select?.();
          }
        }
      }
    });

    el.addEventListener("input", () => onEditField(el, prod));
    el.addEventListener("change", () => onEditField(el, prod));
  });

  return row;
}

function onEditField(el, prod){
  const k = el.getAttribute("data-k");
  if(!k) return;

  let v = el.value;

  // Normalizar números
  if(k === "kgBox" || k === "priceKg" || k === "priceBox" || k === "priceUnit"){
    if(v === "") v = "";
    else{
      const num = Number(String(v).replace(",", "."));
      v = Number.isFinite(num) ? fmt2(num) : "";
    }
  }

  if(k === "unitDefault"){
    // select
    v = el.value || "kg";
  }

  markEdited(prod, { [k]: v });
  renderLinkBox(); // live update link
}

function render(){
  rowsEl.innerHTML = "";
  const list = filterProducts();
  const frag = document.createDocumentFragment();
  list.forEach(p => frag.appendChild(makeRow(p)));
  rowsEl.appendChild(frag);

  updatePill();
  renderLinkBox();
}

function buildBackPayload(){
  // Genera SOLO productos con precio o cambios (según checkbox)
  const onlyChanged = !!onlyChangedEl.checked;

  const edits = STATE.edits || {};
  const updates = [];

  for(const p of STATE.products){
    const key = getEditKey(p);
    const e = edits[key];
    if(!e){
      if(onlyChanged) continue;
    }

    // Mezcla base + edit
    const unitDefault = (e?.unitDefault ?? p.unitDefault ?? "kg");
    const kgBox = (e?.kgBox ?? p.kgBox ?? "");
    const priceKg = (e?.priceKg ?? p.priceKg ?? "");
    const priceBox = (e?.priceBox ?? p.priceBox ?? "");
    const priceUnit = (e?.priceUnit ?? p.priceUnit ?? "");

    // Regla: "si no se asigna precio se ignora"
    const hasAnyPrice =
      (priceKg !== "" && priceKg !== null && priceKg !== undefined) ||
      (priceBox !== "" && priceBox !== null && priceBox !== undefined) ||
      (priceUnit !== "" && priceUnit !== null && priceUnit !== undefined);

    if(!hasAnyPrice) continue;

    // Si onlyChanged, exigir que haya edit para ese producto
    if(onlyChanged && !e) continue;

    updates.push({
      id: p.id,
      name: p.name,
      unitDefault,
      kgBox,
      priceKg,
      priceBox,
      priceUnit,
      editedAt: e?.editedAt || nowISO()
    });
  }

  return {
    meta: {
      kind: "arslan_prices_updates_v1",
      createdAt: nowISO(),
      source: STATE.meta.source || "editor",
      mainApp: STATE.meta.mainApp || getMainAppGuess(),
      count: updates.length
    },
    updates
  };
}

function makeBackLink(){
  const payload = buildBackPayload();
  const comp = lzCompress(payload);
  const main = (STATE.meta.mainApp || getMainAppGuess());
  const u = new URL(main);
  u.searchParams.set("prices", comp);
  // también ponemos hash por compatibilidad
  u.hash = `prices=${comp}`;
  return u.toString();
}

function renderLinkBox(){
  const link = makeBackLink();
  linkBox.value = link;
  const payload = buildBackPayload();
  linkMsg.textContent = `Incluye ${payload.meta.count} productos con precio. (Solo cambios: ${onlyChangedEl.checked ? "SI" : "NO"})`;
}

function doCopy(text){
  navigator.clipboard?.writeText(text).then(() => {
    linkMsg.textContent = "✅ Copiado al portapapeles.";
  }).catch(() => {
    // fallback
    linkBox.select();
    document.execCommand("copy");
    linkMsg.textContent = "✅ Copiado (fallback).";
  });
}

function exportJSON(){
  const payload = buildBackPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `arslan_prices_updates_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importJSONFile(file){
  const fr = new FileReader();
  fr.onload = () => {
    const data = safeJSONParse(fr.result);
    if(!data){
      linkMsg.textContent = "❌ JSON inválido.";
      return;
    }

    // Puede ser pack completo (products[]) o updates
    if(Array.isArray(data.products)){
      // pack completo
      const comp = lzCompress(data);
      const u = new URL(getBaseUrl());
      u.searchParams.set("pack", comp);
      location.href = u.toString();
      return;
    }

    if(Array.isArray(data.updates)){
      // aplicar updates al editor como edits
      for(const up of data.updates){
        const id = up.id;
        const prod = STATE.products.find(p => p.id === id) || STATE.products.find(p => p.name === normalizeName(up.name || ""));
        if(!prod) continue;
        markEdited(prod, {
          unitDefault: up.unitDefault ?? "",
          kgBox: up.kgBox ?? "",
          priceKg: up.priceKg ?? "",
          priceBox: up.priceBox ?? "",
          priceUnit: up.priceUnit ?? ""
        });
      }
      render();
      linkMsg.textContent = "✅ Updates importados.";
      return;
    }

    linkMsg.textContent = "⚠️ JSON no reconocido (esperaba products[] o updates[]).";
  };
  fr.readAsText(file);
}

function resetAll(){
  localStorage.removeItem(LS_KEY);
  // recarga limpia manteniendo pack si existe
  const u = new URL(location.href);
  if(u.searchParams.get("pack")){
    location.reload();
  }else{
    location.href = getBaseUrl();
  }
}

/* =========================
   INIT
========================= */
hydrate();
render();

/* =========================
   EVENTS
========================= */
searchEl.addEventListener("input", render);
onlyChangedEl.addEventListener("change", render);

btnCopyBackLink.addEventListener("click", () => {
  doCopy(linkBox.value || makeBackLink());
});

btnCopyLinkBox.addEventListener("click", () => {
  doCopy(linkBox.value || "");
});

btnExport.addEventListener("click", exportJSON);

btnImport.addEventListener("click", () => fileImport.click());
fileImport.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if(f) importJSONFile(f);
  e.target.value = "";
});

btnReset.addEventListener("click", () => {
  if(confirm("¿Resetear el editor? (borra cambios locales del editor)")){
    resetAll();
  }
});
