/* ===========================================================
   ARSLAN PRO V10.4 — KIWI Edition (Full Upgrade)
   Sistema de gestión y facturación profesional
   =========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- HELPERS ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const money = n => (isNaN(n) ? 0 : n).toFixed(2).replace('.', ',') + ' €';
  const parseNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const nowDate = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  /* ---------- SPLASH ---------- */
  const splash = $('#splash');
  setTimeout(() => splash.classList.add('fade-out'), 1200);

  /* ---------- TABS ---------- */
  $$('.tab').forEach(btn =>
    btn.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.panel').forEach(p => {
        p.classList.toggle('active', p.dataset.tabPanel === tab);
      });
    })
  );

  /* ---------- BASE DE DATOS LOCAL ---------- */
  const DB = {
    clientes: JSON.parse(localStorage.getItem('clientes') || '[]'),
    productos: JSON.parse(localStorage.getItem('productos') || '[]'),
    facturas: JSON.parse(localStorage.getItem('facturas') || '[]'),
    priceHist: JSON.parse(localStorage.getItem('priceHist') || '{}')
  };

  const saveDB = () => {
    for (const k in DB) localStorage.setItem(k, JSON.stringify(DB[k]));
  };

  /* ---------- PRODUCTOS ---------- */
  const PRODUCT_NAMES = [
    "GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO",
    "KIWI TOMASIN PLANCHA","PERA RINCON DEL SOTO","MELOCOTON PRIMERA","AGUACATE GRANEL","MARACUYÁ",
    "MANZANA GOLDEN 24","PLATANO CANARIO PRIMERA","MANDARINA HOJA","MANZANA GOLDEN 20","NARANJA TOMASIN",
    "NECTARINA","NUECES","SANDIA","LIMON SEGUNDA","MANZANA FUJI","NARANJA MESA SONRISA","JENGIBRE",
    "BATATA","AJO PRIMERA","CEBOLLA NORMAL","CALABAZA GRANDE","PATATA LAVADA","TOMATE CHERRY RAMA",
    "TOMATE CHERRY PERA","TOMATE DANIELA","TOMATE ROSA PRIMERA","CEBOLLINO","TOMATE ASURCADO MARRON",
    "TOMATE RAMA","PIMIENTO PADRON","ZANAHORIA","PEPINO","CEBOLLETA","PUERROS","BROCOLI","JUDIA VERDE",
    "BERENJENA","PIMIENTO ITALIANO VERDE","PIMIENTO ITALIANO ROJO","CHAMPIÑON","UVA ROJA","UVA BLANCA",
    "ALCACHOFA","CALABACIN","COLIFLOR","BATAVIA","ICEBERG","MANDARINA SEGUNDA","MANZANA GOLDEN 28",
    "NARANJA ZUMO","KIWI SEGUNDA","MANZANA ROYAL GALA 24","PLATANO CANARIO SUELTO","CEREZA","FRESAS",
    "ARANDANOS","ESPINACA","PEREJIL","CILANTRO","ACELGAS","PIMIENTO VERDE","PIMIENTO ROJO","MACHO VERDE",
    "MACHO MADURO","YUCA","AVOCADO","CEBOLLA ROJA","MENTA","HABANERO","RABANITOS","POMELO","PAPAYA",
    "REINETA 28","NISPERO","ALBARICOQUE","TOMATE PERA","TOMATE BOLA","TOMATE PINK","VALVENOSTA GOLDEN",
    "MELOCOTON ROJO","MELON GALIA","APIO","NARANJA SANHUJA","LIMON PRIMERA","MANGO","MELOCOTON AMARILLO",
    "VALVENOSTA ROJA","PIÑA","NARANJA HOJA","PERA CONFERENCIA SEGUNDA","CEBOLLA DULCE","TOMATE ASURCADO AZUL",
    "ESPARRAGOS BLANCOS","ESPARRAGOS TRIGUEROS","REINETA PRIMERA","AGUACATE PRIMERA","COCO","NECTARINA SEGUNDA",
    "REINETA 24","NECTARINA CARNE BLANCA","GUINDILLA","REINETA VERDE","PATATA 25KG","PATATA 5 KG",
    "TOMATE RAFF","REPOLLO","KIWI ZESPRI","PARAGUAYO SEGUNDA","MELON","REINETA 26","TOMATE ROSA","MANZANA CRIPS",
    "ALOE VERA PIEZAS","TOMATE ENSALADA","PATATA 10KG","MELON BOLLO","CIRUELA ROJA","LIMA","GUINEO VERDE",
    "SETAS","BANANA","BONIATO","FRAMBUESA","BREVAS","PERA AGUA","YAUTIA","YAME","OKRA","MANZANA MELASSI",
    "CACAHUETE","SANDIA NEGRA","SANDIA RAYADA","HIGOS","KUMATO","KIWI CHILE","MELOCOTON AMARILLO SEGUNDA",
    "HIERBABUENA","REMOLACHA","LECHUGA ROMANA","CEREZA","KAKI","CIRUELA CLAUDIA","PERA LIMONERA",
    "CIRUELA AMARILLA","HIGOS BLANCOS","UVA ALVILLO","LIMON EXTRA","PITAHAYA ROJA","HIGO CHUMBO",
    "CLEMENTINA","GRANADA","NECTARINA PRIMERA BIS","CHIRIMOYA","UVA CHELVA","PIMIENTO CALIFORNIA VERDE",
    "KIWI TOMASIN","PIMIENTO CALIFORNIA ROJO","MANDARINA SATSUMA","CASTAÑA","CAKI","MANZANA KANZI",
    "PERA ERCOLINA","NABO","UVA ALVILLO NEGRA","CHAYOTE","ROYAL GALA 28","MANDARINA PRIMERA","PIMIENTO PINTON",
    "MELOCOTON AMARILLO DE CALANDA","HINOJOS","MANDARINA DE HOJA","UVA ROJA PRIMERA","UVA BLANCA PRIMERA"
  ];

  if (!DB.productos.length) {
    DB.productos = PRODUCT_NAMES.map(n => ({ nombre: n, modo: 'kg', kgCaja: '', precio: '' }));
    saveDB();
  }

  /* ---------- CLIENTES ---------- */
  if (!DB.clientes.length) {
    DB.clientes = [
      { nombre: "RIVIERA", nif: "B16794893", dir: "Paseo del Espolón, Burgos" },
      { nombre: "Alesal Pan / Café de Calle San Lesmes", nif: "B09582420", dir: "C/ San Lesmes 1" },
      { nombre: "Al Pan Pan Burgos S.L.", nif: "B09569344", dir: "C/ Miranda 17 Bajo" },
      { nombre: "Cuevas Palacios Restauración S.L. (Con/sentidos)", nif: "B10694792", dir: "C/ San Lesmes 1" },
      { nombre: "Café Bar Nuovo", nif: "120221393", dir: "C/ San Juan de Ortega 14" },
      { nombre: "Hotel Cordon" },
      { nombre: "Vaivén Hostelería" },
      { nombre: "Grupo Resicare" },
      { nombre: "Carlos Alameda Peralta & Seis Más" },
      { nombre: "Tabalou Development SLU", nif: "B09567769" },
      { nombre: "Golden Garden", nif: "71281665L", dir: "Trinidad 12, Burgos" },
      { nombre: "Adnan Asif", nif: "X7128589S", dir: "C/ Padre Flórez 3, Burgos" },
      { nombre: "Romina" },
      { nombre: "Abbas" },
      { nombre: "Nadeem Bhai" },
      { nombre: "Mehmood" },
      { nombre: "Aslam" },
      { nombre: "Imran Khan" },
      { nombre: "Domingo" }
    ];
    saveDB();
  }

  /* ---------- CARGAR SELECT CLIENTE ---------- */
  const selCliente = $('#selCliente');
  const cargarClientes = () => {
    selCliente.innerHTML = '<option value="">Seleccionar cliente...</option>' +
      DB.clientes.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
  };
  cargarClientes();

  /* ---------- NUEVA FACTURA ---------- */
  const lineas = $('#lineas');
  const addLinea = (data = {}) => {
    const div = document.createElement('div');
    div.className = 'linea';
    div.innerHTML = `
      <select class="producto">${DB.productos.map(p => `<option>${p.nombre}</option>`).join('')}</select>
      <select class="modo"><option>kg</option><option>unidad</option><option>caja</option></select>
      <input type="number" class="cant" min="0" />
      <input type="number" class="pesoBruto" step="0.01" placeholder="Peso" />
      <input type="number" class="tara" step="0.01" placeholder="Tara" />
      <input type="text" class="origen" placeholder="Origen" />
      <input type="number" class="precio" step="0.01" placeholder="Precio" />
      <span class="importe">0 €</span>
      <button class="del">✖</button>
    `;
    div.querySelector('.del').onclick = () => div.remove();
    div.querySelectorAll('input,select').forEach(el =>
      el.addEventListener('input', calcularTotales)
    );
    lineas.appendChild(div);
  };
  $('#btnAddLinea').onclick = () => addLinea();
  $('#btnVaciarLineas').onclick = () => (lineas.innerHTML = '');

  /* ---------- CÁLCULOS ---------- */
  const calcularTotales = () => {
    let subtotal = 0;
    $$('.linea').forEach(l => {
      const cant = parseNum(l.querySelector('.cant').value);
      const pesoBruto = parseNum(l.querySelector('.pesoBruto').value);
      const tara = parseNum(l.querySelector('.tara').value);
      const precio = parseNum(l.querySelector('.precio').value);
      const neto = pesoBruto > 0 ? pesoBruto - tara : cant;
      const importe = neto * precio;
      l.querySelector('.importe').textContent = money(importe);
      subtotal += importe;
    });
    const transporte = $('#chkTransporte').checked ? subtotal * 0.1 : 0;
    const iva = $('#chkIvaIncluido').checked ? (subtotal + transporte) * 0.04 : 0;
    const total = subtotal + transporte + iva;
    $('#subtotal').textContent = money(subtotal);
    $('#transp').textContent = money(transporte);
    $('#iva').textContent = money(iva);
    $('#total').textContent = money(total);

    const pagado = parseNum($('#pagado').value);
    const pendiente = total - pagado;
    $('#pendiente').textContent = money(pendiente);
  };
  $$('#chkTransporte, #chkIvaIncluido, #pagado').forEach(e => e.addEventListener('input', calcularTotales));

  /* ---------- GUARDAR FACTURA ---------- */
  $('#btnGuardar').onclick = () => {
    const factura = {
      num: 'FA-' + Date.now(),
      fecha: nowDate(),
      cliente: selCliente.value || $('#cliNombre').value,
      subtotal: $('#subtotal').textContent,
      total: $('#total').textContent,
      estado: $('#estado').value,
      pagado: $('#pagado').value,
      pendiente: $('#pendiente').textContent,
      metodo: $('#metodoPago').value,
      observaciones: $('#observaciones').value
    };
    DB.facturas.push(factura);
    saveDB();
    alert('✅ Factura guardada');
  };

  /* ---------- PDF ---------- */
  $('#btnImprimir').onclick = () => {
    const opt = {
      margin: 0.5,
      filename: 'factura-' + Date.now() + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from($('#printArea')).save();
  };

  /* ---------- BACKUP ---------- */
  $('#btnBackup').onclick = () => {
    const blob = new Blob([JSON.stringify(DB)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup-arslan.json';
    a.click();
  };
  $('#btnRestore').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const data = JSON.parse(reader.result);
        Object.assign(DB, data);
        saveDB();
        alert('♻️ Datos restaurados');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* ---------- LOGO FIJO ---------- */
  const logo = document.createElement('img');
  logo.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Kiwi_aka.jpg/240px-Kiwi_aka.jpg';
  logo.alt = 'Kiwi';
  logo.id = 'kiwiLogo';
  document.body.appendChild(logo);
  logo.addEventListener('click', () => {
    document.querySelector('[data-tab="factura"]').click();
  });
});
