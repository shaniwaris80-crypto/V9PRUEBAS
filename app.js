/* =========================================================
   ARSLAN • FACTURAS RÁPIDAS (AUTO VOCAB)
   - Filas rápidas producto/cant/precio
   - Autocompletar REAL desde vocabulario ARSLAN LISTAS (localStorage)
   - Enter navega y crea filas
   - Bulk paste: pegar lista en bloque y genera filas
   - PDF + WhatsApp TXT
   - Guardado historial + export/import JSON
========================================================= */

(() => {
  "use strict";

  /* ===========================
     DOM
  =========================== */
  const $ = (q, el=document) => el.querySelector(q);

  const invNumber = $("#invNumber");
  const invDate   = $("#invDate");
  const invClient = $("#invClient");
  const invNotes  = $("#invNotes");
  const invVat    = $("#invVat");

  const linesBody = $("#linesBody");
  const preview   = $("#preview");

  const tSubtotal = $("#tSubtotal");
  const tVat      = $("#tVat");
  const tTotal    = $("#tTotal");

  const bulkBox   = $("#bulkBox");
  const historyEl = $("#history");

  const btnNew       = $("#btnNew");
  const btnSave      = $("#btnSave");
  const btnClear     = $("#btnClear");
  const btnPDF       = $("#btnPDF");
  const btnWA        = $("#btnWA");
  const btnAddLine   = $("#btnAddLine");
  const btnResetLines= $("#btnResetLines");
  const btnBulk      = $("#btnBulk");
  const btnBulkClear = $("#btnBulkClear");
  const btnExport    = $("#btnExport");
  const importFile   = $("#importFile");

  const btnTheme     = $("#btnTheme");
  const btnHelp      = $("#btnHelp");
  const modalHelp    = $("#modalHelp");
  const btnCloseHelp = $("#btnCloseHelp");

  /* ===========================
     STORAGE KEYS
  =========================== */
  const LS_THEME   = "ARSLAN_FACTURAS_THEME";
  const LS_DRAFT   = "ARSLAN_FACTURAS_DRAFT";
  const LS_HISTORY = "ARSLAN_FACTURAS_HISTORY"; // array
  const APP_VER    = "ARSLAN_FACTURAS_V1.0_AUTO_VOCAB";

  /* ===========================
     STATE
  =========================== */
  let LINES = [];
  let CURRENT_ID = null;

  /* =========================================================
     ✅ AUTOCOMPLETE REAL (VOCABULARIO ARSLAN LISTAS)
========================================================= */

  let ARSLAN_VOCAB = [];
  let ARSLAN_VOCAB_READY = false;

  function normSearch(s){
    return String(s || "")
      .toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniq(arr){
    const set = new Set();
    const out = [];
    for(const x of arr){
      const k = normSearch(x);
      if(!k) continue;
      if(set.has(k)) continue;
      set.add(k);
      out.push(String(x).trim());
    }
    return out;
  }

  function tryParseAnyVocab(raw){
    const out = [];
    const txt = String(raw || "").trim();
    if(!txt) return out;

    if(txt.includes("\n") && txt.length < 200000 && !txt.startsWith("{") && !txt.startsWith("[")){
      const lines = txt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      for(const l of lines) out.push(l);
      return out;
    }

    try{
      const j = JSON.parse(txt);

      if(Array.isArray(j)){
        for(const x of j){
          if(typeof x === "string") out.push(x);
          else if(x && typeof x === "object"){
            if(x.name) out.push(String(x.name));
            else if(x.product) out.push(String(x.product));
            else if(x.label) out.push(String(x.label));
          }
        }
        return out;
      }

      if(j && typeof j === "object"){
        const possibleArrays = [j.words, j.vocab, j.vocabulary, j.products, j.items, j.list].filter(Boolean);
        for(const arr of possibleArrays){
          if(Array.isArray(arr)){
            for(const x of arr){
              if(typeof x === "string") out.push(x);
              else if(x?.name) out.push(String(x.name));
            }
          }
        }

        const keys = Object.keys(j);
        if(keys.length && keys.length < 50000){
          // heurística: si parece diccionario de productos
          const sample = keys.slice(0, 20).join(" ");
          if(sample && sample.toUpperCase() === sample){
            out.push(...keys);
          }
        }
        return out;
      }
    }catch(e){
      // no JSON -> ignore
    }

    return out;
  }

  function loadArslanVocabFromLocalStorage(){
    const candidates = [
      "ARS_VOCAB",
      "ARSLAN_VOCAB",
      "arslan_vocab",
      "vocabulario",
      "VOCABULARIO",
      "arslan_listas_vocab",
      "arslan_words",
      "words",
      "PRODUCTOS_STD",
      "PRODUCTOS",
      "ARS_PRODUCTS"
    ];

    const found = [];

    for(const key of candidates){
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      const parsed = tryParseAnyVocab(raw);
      if(parsed.length) found.push(...parsed);
    }

    // buscar dinámico
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k) continue;
      const kk = k.toLowerCase();
      if(!(kk.includes("vocab") || kk.includes("producto") || kk.includes("word") || kk.includes("std"))) continue;
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      const parsed = tryParseAnyVocab(raw);
      if(parsed.length) found.push(...parsed);
    }

    return uniq(found);
  }

  function initArslanVocab(){
    try{
      ARSLAN_VOCAB = loadArslanVocabFromLocalStorage();
      ARSLAN_VOCAB_READY = ARSLAN_VOCAB.length > 0;
      // console.log("VOCAB OK:", ARSLAN_VOCAB.length);
    }catch(e){
      ARSLAN_VOCAB = [];
      ARSLAN_VOCAB_READY = false;
    }
  }

  function getVocabSuggestions(query, limit=10){
    const q = normSearch(query);
    if(!q || !ARSLAN_VOCAB_READY) return [];

    const starts = [];
    const contains = [];

    for(const name of ARSLAN_VOCAB){
      const n = normSearch(name);
      if(!n) continue;

      if(n.startsWith(q)) starts.push(name);
      else if(n.includes(q)) contains.push(name);

      if(starts.length >= limit) break;
    }

    return starts.concat(contains).slice(0, limit);
  }

  function attachAutocomplete(inputEl, onPick){
    let panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.zIndex = "99999";
    panel.style.display = "none";
    panel.style.maxHeight = "240px";
    panel.style.overflow = "auto";
    panel.style.border = "1px solid color-mix(in srgb, var(--text) 10%, transparent)";
    panel.style.background = "var(--card, #fff)";
    panel.style.borderRadius = "14px";
    panel.style.boxShadow = "0 10px 30px rgba(0,0,0,.12)";
    panel.style.padding = "6px";
    panel.style.minWidth = "240px";

    document.body.appendChild(panel);

    let activeIndex = -1;
    let lastList = [];

    function positionPanel(){
      const r = inputEl.getBoundingClientRect();
      panel.style.left = (r.left + window.scrollX) + "px";
      panel.style.top  = (r.bottom + window.scrollY + 6) + "px";
      panel.style.width = Math.max(r.width, 260) + "px";
    }

    function hide(){
      panel.style.display = "none";
      panel.innerHTML = "";
      activeIndex = -1;
      lastList = [];
    }

    function show(list){
      positionPanel();
      panel.innerHTML = "";
      lastList = list.slice();

      list.forEach((name, idx)=>{
        const item = document.createElement("div");
        item.style.padding = "10px 12px";
        item.style.borderRadius = "12px";
        item.style.cursor = "pointer";
        item.style.fontSize = "14px";
        item.style.userSelect = "none";
        item.textContent = name;

        item.onmouseenter = ()=>{
          activeIndex = idx;
          paintActive();
        };

        item.onclick = ()=>{
          onPick(name);
          hide();
        };

        panel.appendChild(item);
      });

      paintActive();
      panel.style.display = list.length ? "block" : "none";
    }

    function paintActive(){
      const children = Array.from(panel.children);
      children.forEach((c, i)=>{
        c.style.background = (i === activeIndex)
          ? "color-mix(in srgb, var(--text) 8%, transparent)"
          : "transparent";
      });
    }

    function refresh(){
      const val = inputEl.value || "";
      const list = getVocabSuggestions(val, 10);
      if(!list.length){
        hide();
        return;
      }
      activeIndex = 0;
      show(list);
    }

    inputEl.addEventListener("focus", ()=>{
      if(!ARSLAN_VOCAB_READY) return;
      refresh();
    });

    inputEl.addEventListener("input", ()=>{
      if(!ARSLAN_VOCAB_READY) return;
      refresh();
    });

    inputEl.addEventListener("blur", ()=>{
      setTimeout(()=>hide(), 150);
    });

    inputEl.addEventListener("keydown", (e)=>{
      if(panel.style.display !== "block") return;

      if(e.key === "ArrowDown"){
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, lastList.length - 1);
        paintActive();
        return;
      }
      if(e.key === "ArrowUp"){
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        paintActive();
        return;
      }
      if(e.key === "Enter"){
        if(activeIndex >= 0 && lastList[activeIndex]){
          e.preventDefault();
          onPick(lastList[activeIndex]);
          hide();
        }
        return;
      }
      if(e.key === "Escape"){
        hide();
        return;
      }
    });

    window.addEventListener("resize", ()=>{
      if(panel.style.display === "block") positionPanel();
    });

    window.addEventListener("scroll", ()=>{
      if(panel.style.display === "block") positionPanel();
    }, { passive:true });
  }

  /* ===========================
     HELPERS
  =========================== */
  function pad(n){ return String(n).padStart(2,"0"); }

  function nowInvoiceNumber(){
    const d = new Date();
    const y = d.getFullYear();
    const m = pad(d.getMonth()+1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `FA-${y}${m}${day}${hh}${mm}`;
  }

  function safeText(s){
    return String(s ?? "").replace(/\s+/g," ").trim();
  }

  function toNum(x){
    if(x === null || x === undefined) return 0;
    const s = String(x).replace(",",".").replace(/[^\d.-]/g,"");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function money(n){
    const v = isFinite(n) ? n : 0;
    return v.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " €";
  }

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function uid(){
    return "inv_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  function setTheme(theme){
    if(theme === "light"){
      document.documentElement.setAttribute("data-theme","light");
    }else{
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem(LS_THEME, theme);
  }

  function getTheme(){
    return localStorage.getItem(LS_THEME) || "dark";
  }

  /* ===========================
     LINES
  =========================== */
  function newLine(){
    return {
      id: "ln_" + Math.random().toString(16).slice(2),
      name: "",
      qty: 1,
      price: 0,
      unit: "kg"
    };
  }

  function ensureMinLines(n=12){
    while(LINES.length < n) LINES.push(newLine());
  }

  function lineTotal(line){
    return toNum(line.qty) * toNum(line.price);
  }

  /* ===========================
     RENDER
  =========================== */
  function render(){
    // render lines
    linesBody.innerHTML = "";
    LINES.forEach((it, idx) => {
      linesBody.appendChild(renderRow(it, idx));
    });

    recalc();
    renderPreview();
    saveDraft();
  }

  function renderRow(it, idx){
    const tr = document.createElement("tr");

    // delete
    const tdDel = document.createElement("td");
    const del = document.createElement("button");
    del.className = "delBtn";
    del.textContent = "🗑";
    del.title = "Borrar fila (Alt+Supr)";
    del.onclick = () => {
      LINES.splice(idx, 1);
      if(LINES.length === 0) LINES.push(newLine());
      ensureMinLines(12);
      render();
    };
    tdDel.appendChild(del);

    // name
    const tdName = document.createElement("td");
    const inName = document.createElement("input");
    inName.className = "input";
    inName.type = "text";
    inName.placeholder = "Producto (autocompletar)";
    inName.value = it.name || "";
    tdName.appendChild(inName);

    // qty
    const tdQty = document.createElement("td");
    const inQty = document.createElement("input");
    inQty.className = "input";
    inQty.type = "number";
    inQty.inputMode = "decimal";
    inQty.step = "0.01";
    inQty.placeholder = "1";
    inQty.value = (it.qty ?? 1);
    tdQty.appendChild(inQty);

    // price
    const tdPrice = document.createElement("td");
    const inPrice = document.createElement("input");
    inPrice.className = "input";
    inPrice.type = "number";
    inPrice.inputMode = "decimal";
    inPrice.step = "0.01";
    inPrice.placeholder = "0.00";
    inPrice.value = (it.price ?? 0);
    tdPrice.appendChild(inPrice);

    // unit
    const tdUnit = document.createElement("td");
    const inUnit = document.createElement("select");
    inUnit.className = "input";
    const units = ["kg","caja","ud","manojo","bolsa","pieza"];
    units.forEach(u=>{
      const op = document.createElement("option");
      op.value = u;
      op.textContent = u;
      inUnit.appendChild(op);
    });
    inUnit.value = it.unit || "kg";
    tdUnit.appendChild(inUnit);

    // total
    const tdTotal = document.createElement("td");
    tdTotal.className = "tdRight";
    const totalEl = document.createElement("b");
    totalEl.textContent = money(lineTotal(it));
    tdTotal.appendChild(totalEl);

    // EVENTS
    function updateLine(){
      it.name  = safeText(inName.value);
      it.qty   = toNum(inQty.value);
      it.price = toNum(inPrice.value);
      it.unit  = inUnit.value || "kg";
      totalEl.textContent = money(lineTotal(it));
      recalc();
      renderPreview();
      saveDraft();
    }

    inName.addEventListener("input", updateLine);
    inQty.addEventListener("input", updateLine);
    inPrice.addEventListener("input", updateLine);
    inUnit.addEventListener("change", updateLine);

    // ✅ AUTOCOMPLETE REAL
    attachAutocomplete(inName, (picked)=>{
      inName.value = picked;
      it.name = safeText(picked);
      updateLine();

      // saltar al precio
      setTimeout(() => inPrice.focus(), 10);
    });

    // KEYBOARD FLOW
    const focusables = [inName, inQty, inPrice, inUnit];

    function focusNext(currentIndex){
      const next = focusables[currentIndex+1];
      if(next){
        next.focus();
      }else{
        // si estamos al final -> siguiente fila producto
        const nextRow = linesBody.children[idx+1];
        if(nextRow){
          const nextInput = nextRow.querySelector("input");
          if(nextInput) nextInput.focus();
        }else{
          // si no hay siguiente -> crear nueva fila y focus
          addLineAndFocus();
        }
      }
    }

    function addLineAndFocus(){
      LINES.push(newLine());
      ensureMinLines(12);
      render();
      setTimeout(()=>{
        const lastRow = linesBody.lastElementChild;
        const inp = lastRow?.querySelector("input");
        if(inp) inp.focus();
      }, 30);
    }

    // Enter navegación rápida
    [inName, inQty, inPrice].forEach((el, pos)=>{
      el.addEventListener("keydown", (e)=>{
        // ctrl+enter -> nueva fila
        if(e.key === "Enter" && e.ctrlKey){
          e.preventDefault();
          addLineAndFocus();
          return;
        }

        // alt+delete -> borrar fila
        if((e.key === "Delete" || e.key === "Backspace") && e.altKey){
          e.preventDefault();
          del.click();
          return;
        }

        // enter normal -> next
        if(e.key === "Enter"){
          e.preventDefault();

          // si estamos en precio y es la ultima fila -> nueva fila
          if(el === inPrice && idx === LINES.length - 1){
            addLineAndFocus();
            return;
          }

          // si estamos en precio y la siguiente fila existe -> producto de siguiente fila
          if(el === inPrice){
            const nextRow = linesBody.children[idx+1];
            if(nextRow){
              const nextName = nextRow.querySelector("td:nth-child(2) input");
              if(nextName) nextName.focus();
              return;
            }
          }

          focusNext(pos);
        }
      });
    });

    // si cambias unidad y pulsas enter -> siguiente fila
    inUnit.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        const nextRow = linesBody.children[idx+1];
        if(nextRow){
          const nextName = nextRow.querySelector("td:nth-child(2) input");
          if(nextName) nextName.focus();
        }else{
          LINES.push(newLine());
          ensureMinLines(12);
          render();
          setTimeout(()=>{
            const lastRow = linesBody.lastElementChild;
            const inp = lastRow?.querySelector("input");
            if(inp) inp.focus();
          }, 30);
        }
      }
    });

    tr.appendChild(tdDel);
    tr.appendChild(tdName);
    tr.appendChild(tdQty);
    tr.appendChild(tdPrice);
    tr.appendChild(tdUnit);
    tr.appendChild(tdTotal);

    return tr;
  }

  /* ===========================
     TOTALS + PREVIEW
  =========================== */
  function recalc(){
    const sub = LINES
      .filter(l => safeText(l.name) !== "" && (toNum(l.qty) !== 0))
      .reduce((a, l) => a + lineTotal(l), 0);

    const vatP = toNum(invVat.value);
    const vatE = sub * (vatP / 100);
    const total = sub + vatE;

    tSubtotal.textContent = money(sub);
    tVat.textContent = money(vatE);
    tTotal.textContent = money(total);
  }

  function renderPreview(){
    const header = [
      `📌 ${safeText(invClient.value) || "CLIENTE"}`,
      `🧾 ${safeText(invNumber.value) || "(sin número)"}`,
      `📅 ${invDate.value || ""}`,
      ""
    ].join("\n");

    const lines = LINES
      .filter(l => safeText(l.name) !== "" && toNum(l.qty) !== 0)
      .map(l => {
        const q = toNum(l.qty);
        const p = toNum(l.price);
        const u = safeText(l.unit || "");
        const t = q * p;
        return `- ${q} ${u}  ${safeText(l.name)}  @ ${p.toFixed(2)}€  =  ${t.toFixed(2)}€`;
      })
      .join("\n");

    const sub = tSubtotal.textContent;
    const iva = tVat.textContent;
    const tot = tTotal.textContent;

    const footer = [
      "",
      `Subtotal: ${sub}`,
      `IVA: ${iva}`,
      `TOTAL: ${tot}`
    ].join("\n");

    preview.textContent = header + lines + footer;
  }

  /* ===========================
     DRAFT SAVE/LOAD
  =========================== */
  function saveDraft(){
    const data = packInvoice(false);
    localStorage.setItem(LS_DRAFT, JSON.stringify(data));
  }

  function loadDraft(){
    const raw = localStorage.getItem(LS_DRAFT);
    if(!raw) return false;
    try{
      const data = JSON.parse(raw);
      applyInvoice(data);
      return true;
    }catch(e){
      return false;
    }
  }

  /* ===========================
     PACK/APPLY
  =========================== */
  function packInvoice(includeId=true){
    const number = safeText(invNumber.value) || nowInvoiceNumber();
    const data = {
      ver: APP_VER,
      id: includeId ? (CURRENT_ID || uid()) : null,
      number,
      date: invDate.value,
      client: safeText(invClient.value),
      notes: safeText(invNotes.value),
      vat: toNum(invVat.value),
      lines: clone(LINES),
      savedAt: Date.now()
    };
    return data;
  }

  function applyInvoice(data){
    CURRENT_ID = data?.id || null;
    invNumber.value = data?.number || "";
    invDate.value   = data?.date || "";
    invClient.value = data?.client || "";
    invNotes.value  = data?.notes || "";
    invVat.value    = (data?.vat ?? 4);

    LINES = Array.isArray(data?.lines) ? data.lines.map(x=>({
      id: x.id || ("ln_" + Math.random().toString(16).slice(2)),
      name: safeText(x.name),
      qty: toNum(x.qty || 0),
      price: toNum(x.price || 0),
      unit: safeText(x.unit || "kg") || "kg"
    })) : [];

    if(LINES.length === 0) LINES.push(newLine());
    ensureMinLines(12);
    render();
  }

  /* ===========================
     HISTORY
  =========================== */
  function getHistory(){
    try{
      return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
    }catch(e){
      return [];
    }
  }

  function setHistory(arr){
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
  }

  function upsertHistory(inv){
    const list = getHistory();
    const id = inv.id || uid();
    inv.id = id;

    const idx = list.findIndex(x => x.id === id);
    if(idx >= 0) list[idx] = inv;
    else list.unshift(inv);

    // cap
    if(list.length > 200) list.length = 200;

    setHistory(list);
    renderHistory();
  }

  function deleteFromHistory(id){
    const list = getHistory().filter(x => x.id !== id);
    setHistory(list);
    renderHistory();
  }

  function renderHistory(){
    const list = getHistory();
    historyEl.innerHTML = "";

    if(list.length === 0){
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No hay facturas guardadas todavía.";
      historyEl.appendChild(empty);
      return;
    }

    list.forEach(inv=>{
      const div = document.createElement("div");
      div.className = "hItem";

      const left = document.createElement("div");
      left.className = "hLeft";

      const title = document.createElement("div");
      title.className = "hTitle";
      title.textContent = inv.number || "(sin número)";

      const sub = document.createElement("div");
      sub.className = "hSub";
      const d = inv.date || "";
      const c = inv.client || "Cliente";
      sub.textContent = `${d} • ${c}`;

      left.appendChild(title);
      left.appendChild(sub);

      const btns = document.createElement("div");
      btns.className = "hBtns";

      const bLoad = document.createElement("button");
      bLoad.className = "btn ghost";
      bLoad.textContent = "Cargar";
      bLoad.onclick = () => applyInvoice(inv);

      const bPdf = document.createElement("button");
      bPdf.className = "btn ghost";
      bPdf.textContent = "PDF";
      bPdf.onclick = () => makePDF(inv);

      const bDel = document.createElement("button");
      bDel.className = "btn ghost";
      bDel.textContent = "Borrar";
      bDel.onclick = () => deleteFromHistory(inv.id);

      btns.appendChild(bLoad);
      btns.appendChild(bPdf);
      btns.appendChild(bDel);

      div.appendChild(left);
      div.appendChild(btns);

      historyEl.appendChild(div);
    });
  }

  /* ===========================
     BULK PARSE
  =========================== */
  function parseBulkLines(text){
    const lines = String(text || "")
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);

    const out = [];

    for(const line of lines){
      // try: "3 TOMATE PERA"
      // try: "1,5 kg TOMATE"
      // try: "TOMATE PERA"

      let qty = 1;
      let unit = "kg";
      let name = line;

      // tokens
      const tokens = line.split(/\s+/);

      // si primer token es número
      const n0 = toNum(tokens[0]);
      if(tokens.length >= 2 && n0 !== 0){
        qty = n0;
        name = tokens.slice(1).join(" ");
      }else{
        // si empieza por "1,5KG" pegado
        const m = tokens[0].match(/^(\d+(?:[.,]\d+)?)(kg|ud|caja|manojo|bolsa|pieza)$/i);
        if(m){
          qty = toNum(m[1]);
          unit = m[2].toLowerCase();
          name = tokens.slice(1).join(" ");
        }
      }

      // unidad en el texto
      const maybeUnit = name.match(/\b(kg|ud|uds|caja|manojo|bolsa|pieza|piezas)\b/i);
      if(maybeUnit){
        const u = maybeUnit[1].toLowerCase();
        unit = (u === "uds") ? "ud" : (u === "piezas" ? "pieza" : u);
        name = name.replace(new RegExp("\\b"+maybeUnit[1]+"\\b","i"), "").trim();
      }

      out.push({
        name: safeText(name),
        qty: qty,
        unit: unit,
        price: 0
      });
    }

    return out.filter(x => x.name);
  }

  function insertBulk(){
    const list = parseBulkLines(bulkBox.value);
    if(list.length === 0) return;

    // Insert rows in first empty spots
    let idx = 0;
    for(let i=0; i<LINES.length && idx<list.length; i++){
      if(!safeText(LINES[i].name)){
        LINES[i].name = list[idx].name;
        LINES[i].qty  = list[idx].qty;
        LINES[i].unit = list[idx].unit;
        // price stays 0
        idx++;
      }
    }

    // if still remaining add new lines
    while(idx < list.length){
      LINES.push({
        id: "ln_" + Math.random().toString(16).slice(2),
        name: list[idx].name,
        qty: list[idx].qty,
        price: 0,
        unit: list[idx].unit
      });
      idx++;
    }

    ensureMinLines(12);
    render();

    // focus first row price to go fast
    setTimeout(()=>{
      const firstRow = linesBody.querySelector("tr");
      const price = firstRow?.querySelector("td:nth-child(4) input");
      if(price) price.focus();
    }, 60);
  }

  /* ===========================
     PDF
  =========================== */
  function makePDF(dataMaybe){
    const data = dataMaybe ? clone(dataMaybe) : packInvoice(true);
    if(!data.number) data.number = nowInvoiceNumber();

    const lines = (data.lines || [])
      .filter(l => safeText(l.name) && toNum(l.qty) !== 0)
      .map(l => ({
        name: safeText(l.name),
        qty: toNum(l.qty),
        unit: safeText(l.unit || "kg"),
        price: toNum(l.price),
        total: toNum(l.qty) * toNum(l.price)
      }));

    const sub = lines.reduce((a,x)=>a+x.total,0);
    const vatP = toNum(data.vat);
    const vatE = sub * (vatP/100);
    const tot  = sub + vatE;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:"a4" });

    const margin = 40;

    doc.setFont("helvetica","bold");
    doc.setFontSize(14);
    doc.text("ARSLAN • FACTURA", margin, 54);

    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.text(`Nº: ${data.number}`, margin, 74);
    doc.text(`Fecha: ${data.date || ""}`, margin, 90);
    doc.text(`Cliente: ${data.client || ""}`, margin, 106);

    if(data.notes){
      doc.text(`Notas: ${data.notes}`, margin, 122);
    }

    const tableY = data.notes ? 144 : 130;

    doc.autoTable({
      startY: tableY,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [22,163,74] },
      head: [["Producto","Cant.","Unidad","Precio","Total"]],
      body: lines.map(x => [
        x.name,
        String(x.qty).replace(".",","),
        x.unit,
        x.price.toFixed(2) + " €",
        x.total.toFixed(2) + " €"
      ])
    });

    const y = doc.lastAutoTable.finalY + 18;
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text(`Subtotal: ${sub.toFixed(2)} €`, 360, y);
    doc.text(`IVA (${vatP.toFixed(2)}%): ${vatE.toFixed(2)} €`, 360, y + 16);
    doc.setFontSize(12);
    doc.text(`TOTAL: ${tot.toFixed(2)} €`, 360, y + 36);

    // footer
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.text("IVA incluido / según condiciones acordadas.", margin, 810);

    doc.save(`${data.number}.pdf`);
  }

  /* ===========================
     WHATSAPP
  =========================== */
  function toWhatsAppText(){
    const number = safeText(invNumber.value) || "(sin número)";
    const date = invDate.value || "";
    const client = safeText(invClient.value) || "CLIENTE";

    const lines = LINES
      .filter(l => safeText(l.name) && toNum(l.qty) !== 0)
      .map(l => {
        const q = toNum(l.qty);
        const u = safeText(l.unit||"");
        const p = toNum(l.price);
        const t = q*p;
        return `• ${q} ${u} ${safeText(l.name)} — ${p.toFixed(2)}€ = ${t.toFixed(2)}€`;
      })
      .join("\n");

    const sub = tSubtotal.textContent;
    const iva = tVat.textContent;
    const tot = tTotal.textContent;

    const text =
`🧾 FACTURA ARSLAN
Cliente: ${client}
Nº: ${number}
Fecha: ${date}

${lines}

Subtotal: ${sub}
IVA: ${iva}
TOTAL: ${tot}`;

    return text;
  }

  function sendWhatsApp(){
    const text = toWhatsAppText();
    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  }

  /* ===========================
     ACTIONS
  =========================== */
  function newInvoice(){
    CURRENT_ID = null;
    invNumber.value = "";
    invClient.value = "";
    invNotes.value  = "";
    invVat.value    = 4;

    const d = new Date();
    invDate.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    LINES = [];
    ensureMinLines(12);
    render();

    // focus first product input
    setTimeout(()=>{
      const first = linesBody.querySelector("tr td:nth-child(2) input");
      if(first) first.focus();
    }, 80);
  }

  function clearAll(){
    if(!confirm("¿Limpiar todo el contenido actual?")) return;
    newInvoice();
    bulkBox.value = "";
    saveDraft();
  }

  function saveInvoice(){
    const data = packInvoice(true);
    if(!data.number) data.number = nowInvoiceNumber();
    invNumber.value = data.number;

    // update CURRENT_ID
    CURRENT_ID = data.id;

    upsertHistory(data);
    saveDraft();

    toast("✅ Factura guardada");
  }

  function addLine(){
    LINES.push(newLine());
    ensureMinLines(12);
    render();
    setTimeout(()=>{
      const lastRow = linesBody.lastElementChild;
      const inp = lastRow?.querySelector("td:nth-child(2) input");
      if(inp) inp.focus();
    }, 40);
  }

  function resetLines(){
    if(!confirm("¿Resetear filas? (deja 12 filas vacías)")) return;
    LINES = [];
    ensureMinLines(12);
    render();
  }

  /* ===========================
     EXPORT/IMPORT
  =========================== */
  function exportJSON(){
    const list = getHistory();
    const payload = {
      ver: APP_VER,
      exportedAt: new Date().toISOString(),
      invoices: list
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "arslan_facturas_export.json";
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 4000);
  }

  function importJSONFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const payload = JSON.parse(reader.result);
        const invs = Array.isArray(payload?.invoices) ? payload.invoices : [];
        if(invs.length === 0) throw new Error("JSON sin invoices");

        const current = getHistory();
        const map = new Map(current.map(x => [x.id, x]));
        invs.forEach(x => {
          const id = x.id || uid();
          x.id = id;
          map.set(id, x);
        });

        const merged = Array.from(map.values())
          .sort((a,b)=> (b.savedAt||0) - (a.savedAt||0));

        setHistory(merged.slice(0, 300));
        renderHistory();
        toast("✅ Importado correctamente");
      }catch(e){
        alert("❌ Error importando JSON");
      }
    };
    reader.readAsText(file);
  }

  /* ===========================
     TOAST SIMPLE
  =========================== */
  let toastTimer = null;
  function toast(msg){
    let el = document.getElementById("toastArslan");
    if(!el){
      el = document.createElement("div");
      el.id = "toastArslan";
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "22px";
      el.style.transform = "translateX(-50%)";
      el.style.background = "rgba(0,0,0,.80)";
      el.style.color = "#fff";
      el.style.padding = "10px 14px";
      el.style.borderRadius = "14px";
      el.style.fontWeight = "700";
      el.style.fontSize = "13px";
      el.style.zIndex = "999999";
      el.style.border = "1px solid rgba(255,255,255,.15)";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity = "0"; }, 1500);
  }

  /* ===========================
     EVENTS
  =========================== */
  function bindEvents(){
    btnNew.onclick = () => newInvoice();
    btnSave.onclick = () => saveInvoice();
    btnClear.onclick = () => clearAll();

    btnPDF.onclick = () => makePDF();
    btnWA.onclick  = () => sendWhatsApp();

    btnAddLine.onclick = () => addLine();
    btnResetLines.onclick = () => resetLines();

    btnBulk.onclick = () => insertBulk();
    btnBulkClear.onclick = () => bulkBox.value = "";

    btnExport.onclick = () => exportJSON();

    importFile.addEventListener("change", (e)=>{
      const f = e.target.files?.[0];
      if(!f) return;
      importJSONFile(f);
      importFile.value = "";
    });

    // auto recalc on header changes
    [invNumber, invDate, invClient, invNotes, invVat].forEach(el=>{
      el.addEventListener("input", ()=>{
        recalc();
        renderPreview();
        saveDraft();
      });
    });

    btnTheme.onclick = () => {
      const cur = getTheme();
      setTheme(cur === "light" ? "dark" : "light");
    };

    btnHelp.onclick = () => {
      modalHelp.style.display = "flex";
    };
    btnCloseHelp.onclick = () => {
      modalHelp.style.display = "none";
    };
    modalHelp.addEventListener("click", (e)=>{
      if(e.target === modalHelp) modalHelp.style.display = "none";
    });

    // Global shortcuts
    document.addEventListener("keydown", (e)=>{
      // Ctrl+S guardar
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
        e.preventDefault();
        saveInvoice();
      }
      // Ctrl+P PDF
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p"){
        e.preventDefault();
        makePDF();
      }
      // Ctrl+Enter nueva fila
      if(e.ctrlKey && e.key === "Enter"){
        e.preventDefault();
        addLine();
      }
    });
  }

  /* ===========================
     INIT
  =========================== */
  function init(){
    setTheme(getTheme());
    initArslanVocab();
    bindEvents();
    renderHistory();

    const d = new Date();
    invDate.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    // init lines
    ensureMinLines(12);

    // load draft if exists
    const loaded = loadDraft();
    if(!loaded){
      render();
    }else{
      renderHistory();
    }

    toast(ARSLAN_VOCAB_READY ? `✅ Vocab cargado (${ARSLAN_VOCAB.length})` : "⚠️ Vocab no encontrado");
  }

  init();

})();
