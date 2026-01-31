/**
 * FACTU MIRAL - APP.JS (ALL-IN-ONE V2)
 * Funciones completas: Edición, Historial Precios, Visor PDF, Validaciones.
 */


// --- 0. DATA STORES ---
const STORAGE_KEY = 'factumiral_db_v2';

// Datos Iniciales (Reducidos para brevedad, en producción usar lista completa)
const DEFAULT_PRODUCTS_LIST = [
    "GRANNY FRANCIA", "MANZANA PINK LADY", "MANDARINA COLOMBE", "KIWI ZESPRI GOLD", "PARAGUAYO", "KIWI TOMASIN PLANCHA", "PERA RINCON DEL SOTO", "MELOCOTON PRIMERA",
    "MANZANA GOLDEN 24", "PLATANO CANARIO PRIMERA", "MANDARINA HOJA", "MANZANA GOLDEN 20", "NARANJA TOMASIN", "NECTARINA", "NUECES", "SANDIA", "LIMON SEGUNDA", "MANZANA FUJI",
    "NARANJA MESA SONRISA", "JENGIBRE", "BATATA", "AJO PRIMERA", "CEBOLLA NORMAL", "CALABAZA GRANDE", "PATATA LAVADA", "TOMATE CHERRY RAMA", "TOMATE CHERRY PERA", "TOMATE DANIELA", "TOMATE ROSA PRIMERA",
    "CEBOLLINO", "TOMATE ASURCADO MARRON", "TOMATE RAMA", "PIMIENTO PADRON", "ZANAHORIA", "PEPINO", "CEBOLLETA", "PUERROS", "BROCOLI", "JUDIA VERDE", "BERENJENA",
    "PIMIENTO ITALIANO VERDE", "PIMIENTO ITALIANO ROJO", "CHAMPIÑON", "UVA ROJA", "UVA BLANCA", "ALCACHOFA", "CALABACIN", "COLIFLOR", "BATAVIA", "ICEBERG",
    "MANDARINA SEGUNDA", "MANZANA GOLDEN 28", "NARANJA ZUMO", "KIWI SEGUNDA", "MANZANA ROYAL GALA 24", "PLATANO CANARIO SUELTO", "CEREZA", "FRESAS", "ARANDANOS"
];
// Convertimos lista plana a objetos si no existen
const DEFAULT_PRODUCTS = DEFAULT_PRODUCTS_LIST.map(name => ({
    id: Math.random().toString(36).substr(2, 9),
    name,
    price: 0,
    mode: 'kg',
    tare: 0,
    cost: 0,
    origin: 'Esp'
}));

const DEFAULT_CLIENTS = [
    { id: 'c1', nombre: 'Adnan Asif', nif: 'X7128589S', dir: 'C/ Padre Flórez 3, Burgos', pago: 'Efectivo' },
    { id: 'c2', nombre: 'Golden Garden', nif: '71281665L', dir: 'Trinidad, 12, 09003 Burgos' },
    { id: 'c3', nombre: 'Cuevas Palacios', nif: 'B10694792', dir: 'C/ San Lesmes, 1 – 09004 Burgos' },
    { id: 'c4', nombre: 'Al Pan Pan Burgos', nif: 'B09569344', dir: 'C/ Miranda, 17, 09002 Burgos' },
    { id: 'c5', nombre: 'Alesal Pan', nif: 'B09582420', dir: 'C/ San Lesmes 1, Burgos' },
    { id: 'c6', nombre: 'Riviera', nif: 'B16794893', dir: 'Paseo del Espolón, 09003 Burgos' },
    { id: 'c7', nombre: 'Café Bar Nuovo', nif: '120221393', dir: 'C/ San Juan de Ortega 14, 09007 Burgos' },
    { id: 'c8', nombre: 'Hermanos Marijuán', nif: 'B09425059', dir: 'Ctra Logroño Km 102' },
    { id: 'c9', nombre: 'Alameda Peralta', nif: 'E09578345', dir: 'C/ La Puebla, 6, 09004 Burgos' }
];

const DEFAULT_TARES = [
    { id: 't1', name: 'Caja Negra Plástico', value: 0.3 },
    { id: 't2', name: 'Caja Madera', value: 0.5 },
    { id: 't3', name: 'Cartón', value: 0.2 },
    { id: 't4', name: 'Caja Verde', value: 0.45 }
];

let db = {
    products: DEFAULT_PRODUCTS,
    clients: DEFAULT_CLIENTS,
    facturas: [],
    tares: DEFAULT_TARES,
    priceHistory: {}, // { clientId_prodName: lastPrice }
    settings: {
        pin: '8410',
        iva: 4,
        transport: 10,
        provider: {
            nombre: 'Mohammad Arslan Waris', nif: 'X6389988J', dir: 'Calle San Pablo 17, 09003 Burgos', tel: '631 667 893'
        }
    }
};

// Estado Local
let currentInvoiceId = null; // null = nueva

function loadDB() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            db = { ...db, ...parsed };
            // Merge arrays to ensure we have defaults if deleted by mistake or updates
            if (!db.products || db.products.length < 5) db.products = DEFAULT_PRODUCTS;
            if (!db.clients) db.clients = DEFAULT_CLIENTS;
        } catch (e) { console.error("Error loading DB", e); }
    }
    refreshAllLists();
}

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function refreshAllLists() {
    renderProducts();
    renderClients();
    renderTares();
    renderInvoicesList();
}

// --- 1. CORE & NAVIGATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadDB();
    setupNavigation();
    setupInvoiceGrid();
    setupActions();
    setupModals();
    updateDate();
});

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (btn.classList.contains('lock-protected')) {
                if (tab === 'accounting' || tab === 'sales') showLockScreen(tab);
            } else {
                showTab(tab);
            }
        });
    });
}

function showTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const uiBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (uiBtn) uiBtn.classList.add('active');
}

function updateDate() {
    const now = new Date();
    document.getElementById('date-display').textContent = now.toLocaleDateString('es-ES');
    if (!document.getElementById('inv-date').value) {
        document.getElementById('inv-date').valueAsDate = now;
    }
}

// --- 2. FACTURA & GRID PRO ---
let invoiceLines = [];
const DEFAULT_LINE_COUNT = 5;

function setupInvoiceGrid() {
    resetGrid();
    document.getElementById('btn-add-line').addEventListener('click', () => addLine());
    document.getElementById('btn-clear-lines').addEventListener('click', () => {
        if (confirm('¿Borrar todas las líneas?')) resetGrid();
    });

    // Listeners Globales Factura
    document.getElementById('chk-transport').addEventListener('change', calcTotals);
    document.getElementById('chk-iva-included').addEventListener('change', calcTotals);
}

function addLine(data = null) {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.className = 'grid-row';
    const idx = invoiceLines.length;

    // Last Price Check logic
    const clientId = document.getElementById('inv-client-id').value;

    tr.innerHTML = `
        <td>
            <input type="text" class="inp-prod" list="prod-list-global" placeholder="Producto" autocomplete="off">
            <span class="last-price-badge hidden">Ult: -</span>
        </td>
        <td>
            <select class="inp-mode">
                <option value="kg">KG</option>
                <option value="caja">CAJA</option>
                <option value="ud">UD</option>
            </select>
        </td>
        <td><input type="number" step="0.01" class="inp-cant col-num" value="${data ? data.cant : 0}"></td>
        <td><input type="number" step="0.01" class="inp-bruto col-num" value="${data ? data.bruto : 0}"></td>
        <td>
             <div style="display:flex; gap:2px;">
                <input type="number" step="0.01" class="inp-tara col-num" value="${data ? data.tara : 0}" style="width:50%">
                <select class="sel-tare-opts" style="width:50%; font-size:10px;"><option value="0">▼</option></select>
             </div>
        </td>
        <td><input type="number" step="0.01" class="inp-neto col-num" value="${data ? data.neto : 0}"></td>
        <td><input type="number" step="0.01" class="inp-price col-num" value="${data ? data.price : 0}"></td>
        <td><input type="text" class="inp-origin" placeholder="Esp" value="${data ? data.origin || 'Esp' : 'Esp'}"></td>
        <td class="col-num"><strong class="val-import">${data ? data.import : '0.00'}</strong></td>
        <td><button class="btn-xs btn-danger rm-line">X</button></td>
    `;

    tbody.appendChild(tr);
    invoiceLines.push({ el: tr });

    // Populate Tares
    const tareSel = tr.querySelector('.sel-tare-opts');
    db.tares.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.name;
        tareSel.appendChild(opt);
    });

    // Event Listeners
    const inputs = tr.querySelectorAll('input, select');
    inputs.forEach(inp => {
        inp.addEventListener('input', () => calcRow(tr));
        inp.addEventListener('keydown', (e) => handleGridEnter(e, tr));
    });

    // Product Autocomplete & Last Price
    const prodInput = tr.querySelector('.inp-prod');
    if (data && data.prod) prodInput.value = data.prod;

    prodInput.addEventListener('change', () => {
        const pName = prodInput.value;
        const prod = db.products.find(p => p.name === pName);
        if (prod) {
            // Apply defaults if new line
            if (parseFloat(tr.querySelector('.inp-price').value) === 0) {
                tr.querySelector('.inp-price').value = prod.price || 0;
            }
        }
        // Show Last Price info
        const cId = document.getElementById('inv-client-id').value;
        if (cId && pName) {
            const key = `${cId}_${pName}`;
            const lastPrice = db.priceHistory[key];
            const badge = tr.querySelector('.last-price-badge');
            if (lastPrice) {
                badge.textContent = `Ult: ${lastPrice}€`;
                badge.classList.remove('hidden');
                // Sugerir precio si está a 0
                if (parseFloat(tr.querySelector('.inp-price').value) === 0) {
                    tr.querySelector('.inp-price').value = lastPrice;
                    calcRow(tr);
                }
            } else {
                badge.classList.add('hidden');
            }
        }
    });

    // Tare Change
    tareSel.addEventListener('change', () => {
        const val = parseFloat(tareSel.value);
        if (val > 0) {
            // REGLA 5.4: Tara total = Nº envases * Tara ud. 
            // Si modo CAJA/KG, asumimos Cantidad = Nº Envases
            const cant = parseFloat(tr.querySelector('.inp-cant').value) || 0;
            const mode = tr.querySelector('.inp-mode').value;
            if (mode !== 'ud') {
                const totalTare = val * cant;
                tr.querySelector('.inp-tara').value = totalTare.toFixed(2);
                calcRow(tr);
            }
        }
    });

    tr.querySelector('.rm-line').addEventListener('click', () => {
        tr.remove();
        calcTotals();
    });
}

function handleGridEnter(e, tr) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const all = Array.from(tr.querySelectorAll('input, select'));
        const i = all.indexOf(e.target);
        if (i < all.length - 1) {
            all[i + 1].focus();
        } else {
            // Create new line if at last field
            addLine();
            // Focus new line first input
            setTimeout(() => {
                const rows = document.querySelectorAll('.grid-row');
                const last = rows[rows.length - 1];
                last.querySelector('input').focus();
            }, 50);
        }
    }
}

function resetGrid() {
    document.getElementById('lines-body').innerHTML = '';
    invoiceLines = [];
    currentInvoiceId = null;
    document.getElementById('inv-client-id').value = '';
    document.getElementById('client-info').innerHTML = '<span class="placeholder">Seleccione cliente...</span>';
    document.getElementById('inv-series').value = 'FA-' + new Date().getFullYear() + '-';

    // Global Datalist for products (Performance)
    if (!document.getElementById('prod-list-global')) {
        const dl = document.createElement('datalist');
        dl.id = 'prod-list-global';
        db.products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            dl.appendChild(opt);
        });
        document.body.appendChild(dl);
    }

    for (let i = 0; i < DEFAULT_LINE_COUNT; i++) addLine();
    calcTotals();
}

function calcRow(tr) {
    const mode = tr.querySelector('.inp-mode').value;
    const cant = parseFloat(tr.querySelector('.inp-cant').value) || 0;
    const bruto = parseFloat(tr.querySelector('.inp-bruto').value) || 0;
    const tara = parseFloat(tr.querySelector('.inp-tara').value) || 0;
    const price = parseFloat(tr.querySelector('.inp-price').value) || 0;
    const netInput = tr.querySelector('.inp-neto');

    let neto = 0;
    let importe = 0;

    // VALIDACION: Tara > Bruto
    if (tara > bruto && bruto > 0) {
        tr.querySelector('.inp-tara').style.color = 'red';
    } else {
        tr.querySelector('.inp-tara').style.color = 'black';
    }

    if (mode === 'kg') {
        neto = bruto - tara;
        if (neto < 0) neto = 0;
        netInput.value = neto.toFixed(2);
        importe = neto * price;
    } else if (mode === 'caja') {
        importe = cant * price;
        if (bruto > 0) {
            neto = bruto - tara;
            netInput.value = neto.toFixed(2);
        }
    } else { // UD
        importe = cant * price;
    }

    tr.querySelector('.val-import').textContent = importe.toFixed(2);
    calcTotals();
}

function calcTotals() {
    let subtotal = 0;
    document.querySelectorAll('.val-import').forEach(el => {
        subtotal += parseFloat(el.textContent);
    });

    document.getElementById('val-subtotal').textContent = subtotal.toFixed(2) + ' €';

    let transport = 0;
    if (document.getElementById('chk-transport').checked) {
        transport = subtotal * (db.settings.transport / 100);
    }
    document.getElementById('val-transport').textContent = transport.toFixed(2) + ' €';

    let base = subtotal + transport;
    let iva = 0;

    if (!document.getElementById('chk-iva-included').checked) {
        iva = base * (db.settings.iva / 100);
        document.getElementById('val-iva-label').textContent = `IVA (${db.settings.iva}%)`;
    } else {
        document.getElementById('val-iva-label').textContent = `IVA INCLUIDO`;
    }

    document.getElementById('val-iva').textContent = iva.toFixed(2) + ' €';

    const total = base + iva;
    document.getElementById('val-total').textContent = total.toFixed(2) + ' €';

    generateQRPreview(total);
}

// --- 3. FUNCIONES DE EDICIÓN Y GUARDADO ---
// Editar Factura desde Historial
function loadInvoiceForEdit(invId) {
    const inv = db.facturas.find(f => f.id === invId);
    if (!inv) return;

    currentInvoiceId = inv.id;
    document.getElementById('inv-series').value = inv.id; // Asumimos ID como serie
    document.getElementById('inv-date').value = inv.date;
    document.getElementById('inv-client-id').value = inv.clientId;
    document.getElementById('client-info').textContent = inv.clientName;
    document.getElementById('inv-notes').value = inv.notes || '';
    document.getElementById('chk-transport').checked = inv.hasTransport || false;
    document.getElementById('chk-iva-included').checked = inv.ivaIncluded || false;

    // Rebuild grid
    document.getElementById('lines-body').innerHTML = '';
    invoiceLines = [];
    inv.lines.forEach(line => addLine(line)); // Add lines with data

    calcTotals();
    showTab('invoice');
}

// Guardar Factura
document.getElementById('btn-save-invoice').addEventListener('click', () => {
    // Collect data
    const lines = [];
    document.querySelectorAll('#lines-body tr').forEach(tr => {
        const prod = tr.querySelector('.inp-prod').value;
        if (prod) {
            lines.push({
                prod,
                mode: tr.querySelector('.inp-mode').value,
                cant: tr.querySelector('.inp-cant').value,
                bruto: tr.querySelector('.inp-bruto').value,
                tara: tr.querySelector('.inp-tara').value,
                neto: tr.querySelector('.inp-neto').value,
                price: tr.querySelector('.inp-price').value,
                origin: tr.querySelector('.inp-origin').value,
                import: tr.querySelector('.val-import').textContent
            });

            // Save Price to History
            const clientId = document.getElementById('inv-client-id').value;
            if (clientId) {
                db.priceHistory[`${clientId}_${prod}`] = tr.querySelector('.inp-price').value;
            }
        }
    });

    if (lines.length === 0) { alert('Factura vacía'); return; }

    const invoiceData = {
        id: currentInvoiceId || (document.getElementById('inv-series').value + Date.now().toString().slice(-4)),
        date: document.getElementById('inv-date').value,
        clientId: document.getElementById('inv-client-id').value,
        clientName: document.getElementById('client-info').innerText,
        total: document.getElementById('val-total').textContent,
        notes: document.getElementById('inv-notes').value,
        hasTransport: document.getElementById('chk-transport').checked,
        ivaIncluded: document.getElementById('chk-iva-included').checked,
        lines: lines
    };

    if (currentInvoiceId) {
        // Update existing
        const idx = db.facturas.findIndex(f => f.id === currentInvoiceId);
        if (idx !== -1) db.facturas[idx] = invoiceData;
    } else {
        // Create new
        db.facturas.push(invoiceData);
    }

    saveDB();
    renderInvoicesList();
    alert(currentInvoiceId ? 'Factura Actualizada' : 'Factura Guardada');

    if (!currentInvoiceId) resetGrid(); // Only reset if new
    else currentInvoiceId = null; // Clear edit mode after save
});

document.getElementById('btn-reset-invoice').addEventListener('click', resetGrid);


// --- 4. VISUALIZACIÓN PDF (VISOR) ---
document.getElementById('btn-print-pdf').addEventListener('click', () => {
    const doc = generatePDFObject();
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    // Open in new window or modal
    window.open(url, '_blank', 'width=800,height=1000');
});

function generatePDFObject() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Custom Layout B/W PRO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text('FACTURA', 150, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const provider = document.getElementById('provider-info').innerText.split('\n');
    doc.text(provider, 14, 20);

    doc.setFont("helvetica", "bold");
    doc.text('CLIENTE:', 110, 40);
    doc.setFont("helvetica", "normal");
    const client = document.getElementById('client-info').innerText.split('\n');
    doc.text(client, 110, 45);

    doc.text(`Nº: ${document.getElementById('inv-series').value}`, 150, 30);
    doc.text(`Fecha: ${document.getElementById('inv-date').value}`, 150, 35);

    // Table
    const head = [['Producto', 'Modo', 'Cant', 'Bruto', 'Tara', 'Neto', 'Precio', 'Imp']];
    const body = [];

    document.querySelectorAll('#lines-body tr').forEach(tr => {
        if (tr.querySelector('.inp-prod').value) {
            body.push([
                tr.querySelector('.inp-prod').value,
                tr.querySelector('.inp-mode').value,
                tr.querySelector('.inp-cant').value,
                tr.querySelector('.inp-bruto').value,
                tr.querySelector('.inp-tara').value,
                tr.querySelector('.inp-neto').value,
                tr.querySelector('.inp-price').value,
                tr.querySelector('.val-import').textContent
            ]);
        }
    });

    doc.autoTable({
        head: head,
        body: body,
        startY: 65,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, lineColor: 0, lineWidth: 0.1 },
        headStyles: { fillColor: 240, textColor: 0, fontStyle: 'bold' }
    });

    // Totals
    let finalY = doc.lastAutoTable.finalY + 10;

    // Comments
    const notes = document.getElementById('inv-notes').value;
    if (notes) {
        doc.setFontSize(8);
        doc.text('Observaciones:', 14, finalY);
        doc.text(notes, 14, finalY + 5);
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${document.getElementById('val-total').textContent}`, 140, finalY + 10);

    // QR
    const canvas = document.getElementById('qr-canvas');
    if (canvas) {
        try {
            const qrData = canvas.toDataURL('image/png');
            doc.addImage(qrData, 'PNG', 90, 15, 18, 18);
        } catch (e) { }
    }

    // Paginación "Suma y sigue" handled by autoTable mostly, 
    // but explicit footer can be added via hooks if needed.
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Página ' + i + ' de ' + pageCount, 190, 290, { align: 'right' });
    }

    return doc;
}

// --- 5. RENDER LISTS & MODALS ---
function renderInvoicesList() {
    const tbody = document.getElementById('list-invoices');
    tbody.innerHTML = '';
    [...db.facturas].reverse().forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.id}</td>
            <td>${f.date}</td>
            <td>${f.clientName}</td>
            <td>${f.total}</td>
            <td><span class="badge-pro">PAGADA</span></td>
            <td>
                <button class="btn-xs" onclick="loadInvoiceForEdit('${f.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
// Expose global for onclick
window.loadInvoiceForEdit = loadInvoiceForEdit;

function renderProducts() {
    const div = document.getElementById('list-products');
    div.innerHTML = db.products.map(p => `
        <div class="card flex-row justify-between">
            <span>${p.name}</span>
            <span class="text-xs text-muted">${p.price} €/kg</span>
        </div>`).join('');
}

function renderClients() {
    const div = document.getElementById('list-clients');
    div.innerHTML = db.clients.map(c => `
        <div class="card">
            <strong>${c.nombre}</strong><br>
            <span class="text-xs text-muted">${c.nif}</span>
        </div>`).join('');
}

function renderTares() {
    const div = document.getElementById('list-tares');
    div.innerHTML = db.tares.map(t => `<div class="card flex-row justify-between"><strong>${t.name}</strong> <span>${t.value}kg</span></div>`).join('');
}

// Client Modal
function setupModals() {
    document.getElementById('btn-select-client').addEventListener('click', () => {
        const dialog = document.getElementById('modal-client-select');
        const list = document.getElementById('modal-client-list');
        list.innerHTML = '';
        db.clients.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${c.nombre}</strong> (${c.nif})`;
            li.onclick = () => {
                document.getElementById('inv-client-id').value = c.id;
                document.getElementById('client-info').innerHTML = `<strong>${c.nombre}</strong><br>${c.nif}<br>${c.dir || ''}`;
                dialog.close();
            };
            list.appendChild(li);
        });
        dialog.showModal();
    });
}

// --- 6. HELPERS ---
function generateQRPreview(total) {
    if (window.QRious) {
        new QRious({
            element: document.getElementById('qr-canvas'),
            value: `FACTURA|${db.settings.provider.nif}|${document.getElementById('inv-series').value}|${total.toFixed(2)}`,
            size: 100
        });
    }
}

function showLockScreen(type) {
    const pin = prompt("Introduce PIN:");
    if (pin === db.settings.pin) {
        document.getElementById(`tab-${type}`).classList.remove('hidden');
        document.getElementById(`tab-${type}`).classList.add('active');
        document.querySelector(`#tab-${type} .lock-screen`).classList.add('hidden');
        document.querySelector(`#tab-${type} > div:not(.lock-screen)`).classList.remove('hidden');
    } else {
        alert('PIN Incorrecto');
    }
}
