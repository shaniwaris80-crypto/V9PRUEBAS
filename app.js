/* =========================================================
   ARSLAN — FACTURAS (FULL SCREEN) + PRODUCTOS + HISTORIAL
   ✅ Facturas pantalla completa (100vh)
   ✅ 1 línea por producto (sin wrap)
   ✅ Autocomplete recomendado (NO auto-sustituye)
   ✅ Productos: precio + kg/caja + historial últimas 5
   ✅ localStorage listo para merge con nube luego
========================================================= */

(function(){
  "use strict";

  // =========================
  // ✅ VOCABULARIO (TU LISTA)
  // =========================
  const VOCAB_TEXT = `
MANZANA PINK LADY
MANDARINA COLOMBE
MANDARINA PLASENCIA 
MANDARINA USOPRADES 
MANZANA GRNNY SMITH 
NARANJA MESA USOPRADES
NARANJA ZUMO USOPRADES
MANZANA STORY 
GUAYABA
ROMANESCU 
PATATA AGRIA 
PATATA MONALISA
PATATA SPUNTA
CEBOLLINO
ENELDO
REMOLACHA
LECHUGA ROBLE
ESCAROLA
GUISANTES 
KIWI MARIPOSA
AGUACATE LISO
KIWI ZESPRI GOLD
PARAGUAYO 
KIWI TOMASIN PLANCHA
PERA RINCON DEL SOTO
MELOCOTON PRIMERA
AGUACATE GRANEL
MARACUYA
MANZANA GOLDEN 24
PLATANO CANARIO PRIMERA
MANDARINA HOJA
MANZANA GOLDEN 20
NARANJA TOMASIN
NECTARINA
NUECES
SANDIA
LIMON SEGUNDA
MANZANA FUJI
NARANJA MESA SONRISA
JENGIBRE
BATATA
AJO PRIMERA
CEBOLLA NORMAL
CALABAZA GRANDE
PATATA LAVADA
TOMATE CHERRY RAMA
TOMATE CHERRY PERA
TOMATE DANIELA
TOMATE ROSA PRIMERA
CEBOLLINO
TOMATE ASURCADO MARRON
TOMATE RAMA
PIMIENTO PADRON
ZANAHORIA
PEPINO
CEBOLLETA
PUERROS
BROCOLI
JUDIA VERDE
BERENJENA
PIMIENTO ITALIANO VERDE
PIMIENTO ITALIANO ROJO
CHAMPINON
UVA ROJA
UVA BLANCA
ALCACHOFA
CALABACIN
COLIFLOR
BATAVIA
ICEBERG
MANDARINA SEGUNDA
MANZANA GOLDEN 28
NARANJA ZUMO
KIWI SEGUNDA
MANZANA ROYAL GALA 24
PLATANO CANARIO SUELTO
CEREZA
FRESAS
ARANDANOS
ESPINACA
PEREJIL
CILANTRO
ACELGAS
PIMIENTO VERDE
PIMIENTO ROJO
MACHO VERDE
MACHO MADURO
YUCA
AVOCADO
PERA CONFERENCIA PRIMERA BIS
REINETA PARDA
POMELO CHINO
MANDARINA TABALET
BERZA
COL DE BRUSELAS
NUECES SEGUNDA 
ESCAROLA 
CEBOLLA ROJA
MENTA
HABANERO
RABANITOS
POMELO
PAPAYA
REINETA 28
NISPERO
ALBARICOQUE
TOMATE PERA
TOMATE BOLA
TOMATE PINK
VALVENOSTA GOLDEN
MELOCOTON ROJO
MELON GALIA
APIO
NARANJA SANHUJA
LIMON PRIMERA
MANGO
MELOCOTON AMARILLO
VALVENOSTA ROJA
PINA
NARANJA HOJA
PERA CONFERENCIA SEGUNDA
CEBOLLA DULCE
TOMATE ASURCADO AZUL
ESPARRAGOS BLANCOS
ESPARRAGOS TRIGUEROS
REINETA PRIMERA
AGUACATE PRIMERA
COCO
NECTARINA SEGUNDA
REINETA 24
NECTARINA CARNE BLANCA
GUINDILLA
REINETA VERDE
PATATA 25KG
PATATA 5 KG
TOMATE RAFF
REPOLLO
KIWI ZESPRI
PARAGUAYO SEGUNDA
MELON
REINETA 26
TOMATE ROSA
MANZANA CRISPS
ALOE VERA PIEZAS
TOMATE ENSALADA
PATATA 10KG
MELON BOLLO
CIRUELA ROJA
LIMA
GUINEO VERDE
SETAS
BANANA
BONIATO
FRAMBUESA
BREVAS
PERA AGUA
YAUTIA
YAME
OKRA
MANZANA MELASSI
CACAHUETE
SANDIA NEGRA
SANDIA RAYADA
HIGOS
KUMATO
KIWI CHILE
MELOCOTON AMARILLO SEGUNDA
HIERBABUENA
REMOLACHA
LECHUGA ROMANA
KAKI
CIRUELA CLAUDIA
PERA LIMONERA
CIRUELA AMARILLA
HIGOS BLANCOS
UVA ALVILLO
LIMON EXTRA
PITAHAYA ROJA
HIGO CHUMBO
CLEMENTINA
GRANADA
NECTARINA PRIMERA BIS
CHIRIMOYA
UVA CHELVA
PIMIENTO CALIFORNIA VERDE
KIWI TOMASIN
PIMIENTO CALIFORNIA ROJO
MANDARINA SATSUMA
CASTANA
CAKI
MANZANA KANZI
PERA ERCOLINA
NABO
UVA ALVILLO NEGRA
CHAYOTE
ROYAL GALA 28
MANDARINA PRIMERA
PIMIENTO PINTON
MELOCOTON AMARILLO DE CALANDA
HINOJOS
MANDARINA DE HOJA
UVA ROJA PRIMERA
UVA BLANCA PRIMERA
`;

  function buildVocab(text){
    const arr = text.split("\n")
      .map(s => (s||"").trim())
      .filter(Boolean)
      .map(s => s.replace(/\s+/g," ").toUpperCase());

    // quitar duplicados manteniendo orden
    const seen = new Set();
    const out = [];
    for(const w of arr){
      if(!seen.has(w)){
        seen.add(w);
        out.push(w);
      }
    }
    return out;
  }

  const VOCAB = buildVocab(VOCAB_TEXT);

  // =========================
  // ✅ STORAGE KEYS
  // =========================
  const LS_PRODUCTS = "arslan_products_catalog_v1";
  const LS_INVOICES  = "arslan_invoices_local_v1";

  // =========================
  // ✅ HELPERS
  // =========================
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function euro(n){
    const x = Number(n || 0);
    return x.toLocaleString("es-ES", {minimumFractionDigits:2, maximumFractionDigits:2}) + " €";
  }

  function nowISO(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function uid(prefix="id"){
    return prefix + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function safeParse(json, fallback){
    try{ return JSON.parse(json); }catch(e){ return fallback; }
  }

  // =========================
  // ✅ PRODUCTS CATALOG
  // =========================
  function loadProducts(){
    const raw = localStorage.getItem(LS_PRODUCTS);
    const obj = safeParse(raw, {});
    // aseguramos estructura
    return obj && typeof obj === "object" ? obj : {};
  }

  function saveProducts(obj){
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(obj));
  }

  function upsertProduct(name, patch){
    const key = normName(name);
    if(!key) return;

    const products = loadProducts();
    const prev = products[key] || {
      name: key,
      unit: "kg",      // kg | ud | caja
      kgPerBox: 0,
      price: 0,
      history: []      // {price, ts}
    };

    const next = {...prev, ...patch, name: key};

    // historial (últimas 5)
    if(patch && Object.prototype.hasOwnProperty.call(patch, "price")){
      const p = Number(patch.price || 0);
      const last = next.history?.[0]?.price;
      if(last !== p){
        const item = {price:p, ts:Date.now()};
        const hist = Array.isArray(next.history) ? next.history.slice() : [];
        hist.unshift(item);
        next.history = hist.slice(0,5);
      }
    }

    products[key] = next;
    saveProducts(products);
  }

  function getProduct(name){
    const products = loadProducts();
    const key = normName(name);
    return products[key] || null;
  }

  function normName(s){
    return (s||"").trim().replace(/\s+/g," ").toUpperCase();
  }

  // =========================
  // ✅ INVOICES
  // =========================
  function loadInvoices(){
    return safeParse(localStorage.getItem(LS_INVOICES), []);
  }
  function saveInvoices(arr){
    localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
  }

  // =========================
  // ✅ UI: Tabs
  // =========================
  function initTabs(){
    $$(".tab").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        $$(".tab").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;
        $$(".screen").forEach(s=>s.classList.remove("active"));
        $("#tab-"+tab).classList.add("active");
      });
    });
  }

  // =========================
  // ✅ AUTOCOMPLETE (NO auto sustitución)
  // =========================
  function attachAutocomplete(inputEl, onPick){
    // Wrap para dropdown
    const wrap = document.createElement("div");
    wrap.className = "ac-wrap";
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);

    const list = document.createElement("div");
    list.className = "ac-list";
    list.style.display = "none";
    wrap.appendChild(list);

    let items = [];
    let activeIndex = -1;

    function close(){
      list.style.display = "none";
      list.innerHTML = "";
      items = [];
      activeIndex = -1;
    }

    function open(){
      if(items.length){
        list.style.display = "block";
      } else {
        close();
      }
    }

    function render(){
      list.innerHTML = "";
      items.forEach((txt, idx)=>{
        const div = document.createElement("div");
        div.className = "ac-item" + (idx === activeIndex ? " active" : "");
        div.textContent = txt;
        div.addEventListener("mousedown", (e)=>{
          e.preventDefault();
          pick(idx);
        });
        list.appendChild(div);
      });
      open();
    }

    function pick(idx){
      const value = items[idx];
      if(!value) return;
      // ✅ NO reemplazamos por escribir solo: pero si el usuario selecciona, sí se pone
      inputEl.value = value;
      close();
      if(typeof onPick === "function") onPick(value);
    }

    function update(){
      const q = normName(inputEl.value);
      if(!q){
        close();
        return;
      }
      // filtrado suave
      const max = 30;
      const hits = [];
      for(const w of VOCAB){
        if(w.includes(q)){
          hits.push(w);
          if(hits.length >= max) break;
        }
      }
      items = hits;
      activeIndex = hits.length ? 0 : -1;
      render();
    }

    inputEl.addEventListener("input", ()=>{
      update();
    });

    inputEl.addEventListener("keydown", (e)=>{
      if(list.style.display !== "block") return;

      if(e.key === "ArrowDown"){
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        render();
      } else if(e.key === "ArrowUp"){
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if(e.key === "Enter"){
        // ✅ si dropdown abierto, Enter selecciona la opción activa
        e.preventDefault();
        pick(activeIndex);
      } else if(e.key === "Escape"){
        close();
      }
    });

    document.addEventListener("click", (e)=>{
      if(!wrap.contains(e.target)) close();
    });
  }

  // =========================
  // ✅ FACTURA: líneas
  // =========================
  const lineasWrap = $("#lineasWrap");

  function newLinea(data={}){
    const row = document.createElement("div");
    row.className = "line-row";

    const colQty = document.createElement("div");
    colQty.className = "col qty";
    colQty.innerHTML = `<input inputmode="decimal" type="number" step="0.01" value="${data.qty ?? 1}">`;

    const colName = document.createElement("div");
    colName.className = "col name";
    colName.innerHTML = `<input type="text" placeholder="Escribe producto..." value="${data.name ?? ""}">`;

    const colUnit = document.createElement("div");
    colUnit.className = "col unit";
    colUnit.innerHTML = `
      <select>
        <option value="kg">kg</option>
        <option value="ud">ud</option>
        <option value="caja">caja</option>
      </select>
    `;

    const colKgBox = document.createElement("div");
    colKgBox.className = "col kgbox";
    colKgBox.innerHTML = `<input inputmode="decimal" type="number" step="0.01" placeholder="0" value="${data.kgPerBox ?? ""}">`;

    const colPrice = document.createElement("div");
    colPrice.className = "col price";
    colPrice.innerHTML = `<input inputmode="decimal" type="number" step="0.01" placeholder="0.00" value="${data.price ?? ""}">`;

    const colTotal = document.createElement("div");
    colTotal.className = "col total";
    colTotal.innerHTML = `<div class="badgeTotal">0,00 €</div>`;

    const colDel = document.createElement("div");
    colDel.className = "col del";
    colDel.innerHTML = `<button class="delBtn" title="Borrar">✕</button>`;

    row.appendChild(colQty);
    row.appendChild(colName);
    row.appendChild(colUnit);
    row.appendChild(colKgBox);
    row.appendChild(colPrice);
    row.appendChild(colTotal);
    row.appendChild(colDel);

    // set default unit
    const unitSel = $("select", colUnit);
    unitSel.value = data.unit || "kg";

    // refs
    const inQty = $("input", colQty);
    const inName = $("input", colName);
    const inKgBox = $("input", colKgBox);
    const inPrice = $("input", colPrice);
    const totalBox = $(".badgeTotal", colTotal);

    // autocomplete (recomendado)
    attachAutocomplete(inName, (picked)=>{
      const prod = getProduct(picked);
      if(prod){
        // ✅ NO sustituye automáticamente mientras escribes
        // Pero si el usuario selecciona una opción, entonces:
        unitSel.value = prod.unit || "kg";
        if(prod.unit === "caja"){
          inKgBox.value = Number(prod.kgPerBox||0) ? prod.kgPerBox : "";
        }
        if(Number(prod.price||0)){
          inPrice.value = prod.price;
        }
      }
      computeRow();
      // siguiente foco a precio
      setTimeout(()=> inPrice.focus(), 0);
    });

    function computeRow(){
      const qty = Number(inQty.value || 0);
      const price = Number(inPrice.value || 0);
      const unit = unitSel.value;
      const kgBox = Number(inKgBox.value || 0);

      let lineTotal = 0;

      if(unit === "caja"){
        // caja -> qty cajas * kgBox * price (asumimos precio por kg)
        lineTotal = qty * (kgBox > 0 ? kgBox : 0) * price;
      } else {
        // kg o ud -> qty * price
        lineTotal = qty * price;
      }

      totalBox.textContent = euro(lineTotal);
      updateTotals();
    }

    [inQty, inPrice, inKgBox].forEach(el=>{
      el.addEventListener("input", computeRow);
    });
    unitSel.addEventListener("change", ()=>{
      // si cambia a caja, habilitar kgBox
      if(unitSel.value === "caja"){
        inKgBox.disabled = false;
        inKgBox.placeholder = "Kg/Caja";
      } else {
        inKgBox.disabled = true;
        inKgBox.value = "";
      }
      computeRow();
    });

    // inicial: si no es caja, kgbox disabled
    if(unitSel.value !== "caja"){
      inKgBox.disabled = true;
      inKgBox.value = "";
    }

    // delete
    $(".delBtn", colDel).addEventListener("click", ()=>{
      row.remove();
      updateTotals();
    });

    // Enter = saltar por campos / crear nueva línea
    row.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      const focusable = [inQty, inName, unitSel, inKgBox, inPrice].filter(x=>!x.disabled);
      const idx = focusable.indexOf(document.activeElement);
      if(idx >= 0 && idx < focusable.length - 1){
        e.preventDefault();
        focusable[idx+1].focus();
      } else {
        e.preventDefault();
        addLinea();
      }
    });

    // compute first
    computeRow();

    // auto guardar producto si cambia precio (cuando deja de escribir)
    inPrice.addEventListener("change", ()=>{
      const nm = normName(inName.value);
      if(!nm) return;
      upsertProduct(nm, {
        unit: unitSel.value,
        kgPerBox: Number(inKgBox.value||0),
        price: Number(inPrice.value||0)
      });
      renderProducts(); // refresca historial
    });

    inKgBox.addEventListener("change", ()=>{
      const nm = normName(inName.value);
      if(!nm) return;
      upsertProduct(nm, {
        unit: unitSel.value,
        kgPerBox: Number(inKgBox.value||0),
        price: Number(inPrice.value||0)
      });
      renderProducts();
    });

    unitSel.addEventListener("change", ()=>{
      const nm = normName(inName.value);
      if(!nm) return;
      upsertProduct(nm, {
        unit: unitSel.value,
        kgPerBox: Number(inKgBox.value||0),
        price: Number(inPrice.value||0)
      });
      renderProducts();
    });

    return row;
  }

  function addLinea(){
    const row = newLinea({qty:1});
    lineasWrap.appendChild(row);
    // focus producto
    const nameInput = row.querySelector(".col.name input");
    setTimeout(()=>nameInput.focus(),0);
  }

  // =========================
  // ✅ Totales
  // =========================
  function updateTotals(){
    let subtotal = 0;

    $$(".line-row").forEach(row=>{
      const qty = Number(row.querySelector(".col.qty input")?.value || 0);
      const name = row.querySelector(".col.name input")?.value || "";
      const unit = row.querySelector(".col.unit select")?.value || "kg";
      const kgBox = Number(row.querySelector(".col.kgbox input")?.value || 0);
      const price = Number(row.querySelector(".col.price input")?.value || 0);

      let lt = 0;
      if(unit === "caja"){
        lt = qty * (kgBox > 0 ? kgBox : 0) * price;
      } else {
        lt = qty * price;
      }
      subtotal += lt;
    });

    const ivaPct = Number($("#invIva").value || 0);
    const ivaEuro = subtotal * (ivaPct/100);
    const total = subtotal + ivaEuro;

    $("#subTotal").textContent = euro(subtotal);
    $("#ivaEuro").textContent = euro(ivaEuro);
    $("#grandTotal").textContent = euro(total);
  }

  // =========================
  // ✅ Guardar / Limpiar factura
  // =========================
  function getFacturaData(){
    const cliente = ($("#invCliente").value || "").trim();
    const dateISO = $("#invFecha").value || nowISO();
    const numero = ($("#invNumero").value || "").trim();

    const lines = $$(".line-row").map(row=>{
      const qty = Number(row.querySelector(".col.qty input")?.value || 0);
      const name = normName(row.querySelector(".col.name input")?.value || "");
      const unit = row.querySelector(".col.unit select")?.value || "kg";
      const kgPerBox = Number(row.querySelector(".col.kgbox input")?.value || 0);
      const price = Number(row.querySelector(".col.price input")?.value || 0);

      let total = 0;
      if(unit === "caja"){
        total = qty * (kgPerBox>0?kgPerBox:0) * price;
      } else {
        total = qty * price;
      }

      return { qty, name, unit, kgPerBox, price, total };
    }).filter(l => l.name && l.qty > 0);

    let subtotal = lines.reduce((a,b)=>a + (b.total||0), 0);
    const ivaPct = Number($("#invIva").value || 0);
    const ivaEuro = subtotal * (ivaPct/100);
    const total = subtotal + ivaEuro;

    return {
      id: uid("inv"),
      cliente,
      dateISO,
      numero,
      ivaPct,
      subtotal,
      ivaEuro,
      total,
      lines,
      createdAt: Date.now()
    };
  }

  function clearFactura(){
    $("#invCliente").value = "";
    $("#invNumero").value = "";
    $("#invFecha").value = nowISO();
    $("#invIva").value = 0;
    lineasWrap.innerHTML = "";
    addLinea();
    updateTotals();
  }

  function guardarFactura(){
    const data = getFacturaData();
    if(!data.cliente){
      alert("Pon un cliente primero.");
      $("#invCliente").focus();
      return;
    }
    if(!data.lines.length){
      alert("Añade al menos 1 producto.");
      return;
    }

    const arr = loadInvoices();
    arr.unshift(data);
    saveInvoices(arr);

    alert("✅ Factura guardada en local.");
  }

  // =========================
  // ✅ PRODUCTOS TAB
  // =========================
  const productsWrap = $("#productsWrap");

  function renderProducts(){
    const q = normName($("#prodSearch").value || "");
    const catalog = loadProducts();

    const names = Object.keys(catalog)
      .sort((a,b)=>a.localeCompare(b));

    const filtered = q ? names.filter(n=>n.includes(q)) : names;

    productsWrap.innerHTML = "";

    if(!filtered.length){
      const empty = document.createElement("div");
      empty.style.color = "var(--muted)";
      empty.style.fontWeight = "800";
      empty.style.padding = "10px";
      empty.textContent = "No hay productos guardados todavía. Cambia precio en una línea de factura o pulsa + Nuevo.";
      productsWrap.appendChild(empty);
      return;
    }

    filtered.forEach(name=>{
      const p = catalog[name];

      const row = document.createElement("div");
      row.className = "prod-row";

      const cName = document.createElement("div");
      cName.className = "pcol pname";
      cName.innerHTML = `<input class="input" value="${p.name}" />`;

      const cUnit = document.createElement("div");
      cUnit.className = "pcol punit";
      cUnit.innerHTML = `
        <select class="input">
          <option value="kg">kg</option>
          <option value="ud">ud</option>
          <option value="caja">caja</option>
        </select>
      `;

      const cKg = document.createElement("div");
      cKg.className = "pcol pkgbox";
      cKg.innerHTML = `<input class="input" inputmode="decimal" type="number" step="0.01" placeholder="Kg/Caja" value="${p.kgPerBox || ""}" />`;

      const cPrice = document.createElement("div");
      cPrice.className = "pcol pprice";
      cPrice.innerHTML = `<input class="input" inputmode="decimal" type="number" step="0.01" placeholder="Precio" value="${p.price || ""}" />`;

      const cHist = document.createElement("div");
      cHist.className = "pcol phist";
      const hist = document.createElement("div");
      hist.className = "hist";

      const arr = Array.isArray(p.history) ? p.history.slice(0,5) : [];
      if(arr.length){
        arr.forEach(h=>{
          const sp = document.createElement("span");
          const date = new Date(h.ts || Date.now());
          const dd = String(date.getDate()).padStart(2,"0");
          const mm = String(date.getMonth()+1).padStart(2,"0");
          sp.textContent = `${(Number(h.price||0)).toFixed(2)}€ · ${dd}/${mm}`;
          hist.appendChild(sp);
        });
      } else {
        const sp = document.createElement("span");
        sp.textContent = "sin historial";
        hist.appendChild(sp);
      }
      cHist.appendChild(hist);

      const cBtn = document.createElement("div");
      cBtn.className = "pcol pbtn";
      cBtn.innerHTML = `
        <button class="btn primary">Guardar</button>
        <button class="btn danger" style="margin-top:8px">Borrar</button>
      `;

      row.appendChild(cName);
      row.appendChild(cUnit);
      row.appendChild(cKg);
      row.appendChild(cPrice);
      row.appendChild(cHist);
      row.appendChild(cBtn);

      // set unit
      const sel = cUnit.querySelector("select");
      sel.value = p.unit || "kg";

      const inName = cName.querySelector("input");
      const inKg = cKg.querySelector("input");
      const inPrice = cPrice.querySelector("input");

      // si no es caja, kg disabled
      function syncKgEnabled(){
        if(sel.value === "caja"){
          inKg.disabled = false;
        } else {
          inKg.disabled = true;
          inKg.value = "";
        }
      }
      syncKgEnabled();
      sel.addEventListener("change", syncKgEnabled);

      // botones
      const btnSave = cBtn.querySelectorAll("button")[0];
      const btnDel  = cBtn.querySelectorAll("button")[1];

      btnSave.addEventListener("click", ()=>{
        const nm = normName(inName.value);
        if(!nm){ alert("Nombre vacío"); return; }
        upsertProduct(nm, {
          unit: sel.value,
          kgPerBox: Number(inKg.value||0),
          price: Number(inPrice.value||0)
        });
        renderProducts();
      });

      btnDel.addEventListener("click", ()=>{
        const nm = normName(inName.value);
        if(!nm) return;
        const cat = loadProducts();
        delete cat[nm];
        saveProducts(cat);
        renderProducts();
      });

      productsWrap.appendChild(row);
    });
  }

  function nuevoProducto(){
    // crea uno vacío con nombre sugerido
    const base = "NUEVO PRODUCTO";
    let name = base;
    const cat = loadProducts();
    let i = 1;
    while(cat[name]){
      i++;
      name = `${base} ${i}`;
    }
    upsertProduct(name, {unit:"kg", kgPerBox:0, price:0});
    renderProducts();
  }

  function exportProductos(){
    const data = loadProducts();
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arslan_productos.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importProductos(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      const obj = safeParse(reader.result, null);
      if(!obj || typeof obj !== "object"){
        alert("JSON inválido");
        return;
      }
      // merge
      const current = loadProducts();
      const merged = {...current, ...obj};
      saveProducts(merged);
      alert("✅ Productos importados/mezclados.");
      renderProducts();
    };
    reader.readAsText(file);
  }

  // =========================
  // ✅ INIT
  // =========================
  function init(){
    initTabs();

    // fecha por defecto
    $("#invFecha").value = nowISO();

    // botones factura
    $("#btnAddLinea").addEventListener("click", addLinea);
    $("#btnGuardarFactura").addEventListener("click", guardarFactura);
    $("#btnLimpiarFactura").addEventListener("click", clearFactura);
    $("#invIva").addEventListener("input", updateTotals);

    // primera línea
    addLinea();

    // productos
    $("#prodSearch").addEventListener("input", renderProducts);
    $("#btnNuevoProducto").addEventListener("click", nuevoProducto);
    $("#btnExportProductos").addEventListener("click", exportProductos);

    $("#btnImportProductos").addEventListener("click", ()=>{
      $("#importFile").click();
    });
    $("#importFile").addEventListener("change", (e)=>{
      const f = e.target.files?.[0];
      if(f) importProductos(f);
      e.target.value = "";
    });

    renderProducts();
    updateTotals();
  }

  init();

})();
