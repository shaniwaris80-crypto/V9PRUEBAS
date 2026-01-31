// --- DATOS INICIALES ---
const PRODUCTOS_BASE = ["GRANNY FRANCIA","MANZANA PINK LADY","MANDARINA COLOMBE","KIWI ZESPRI GOLD","PARAGUAYO","CEREZA","PLATANO CANARIO","TOMATE ROSA","PATATA LAVADA"];
const CLIENTES_BASE = [
    {id:'1', nombre:'Adnan Asif', nif:'X7128589S', dir:'C/ Padre Flórez 3, Burgos'},
    {id:'2', nombre:'Golden Garden', nif:'71281665L', dir:'Trinidad, 12, Burgos'},
    {id:'3', nombre:'Cuevas Palacios (Con/sentidos)', nif:'B10694792', dir:'C/ San Lesmes, 1, Burgos'}
];

let dbFacturas = JSON.parse(localStorage.getItem('factu_miral_db')) || [];
let currentLineId = 0;

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Cargar Clientes en Select
    const sel = document.getElementById('cli-select');
    sel.innerHTML = '<option value="">-- Elegir Cliente --</option>';
    CLIENTES_BASE.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
    
    // Cargar Datalist de Productos
    const dl = document.getElementById('lista-productos');
    PRODUCTOS_BASE.forEach(p => dl.innerHTML += `<option value="${p}">`);
    
    reiniciarLineas();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    if(tabId === 'listado') renderHistorial();
}

// --- LÓGICA DE LÍNEAS ---
function agregarLinea() {
    const container = document.getElementById('lineas-factura');
    const div = document.createElement('div');
    div.className = 'linea-pro';
    div.id = `row-${currentLineId}`;
    div.innerHTML = `
        <input type="text" list="lista-productos" class="l-prod" placeholder="Producto">
        <select class="l-modo" onchange="calcularFila(${currentLineId})"><option value="kg">Kg</option><option value="caja">Caja</option><option value="ud">Ud</option></select>
        <input type="number" class="l-cant" value="1" oninput="calcularFila(${currentLineId})">
        <input type="number" class="l-bruto" placeholder="Bruto" oninput="calcularFila(${currentLineId})">
        <input type="number" class="l-tara" placeholder="Tara" readonly>
        <input type="number" class="l-neto" placeholder="Neto" oninput="calcularFila(${currentLineId}, true)">
        <input type="number" class="l-pre" placeholder="€" oninput="calcularFila(${currentLineId})">
        <input type="number" class="l-tot" placeholder="0.00" readonly>
    `;
    container.appendChild(div);
    currentLineId++;
}

function calcularFila(id, esNetoManual = false) {
    const row = document.getElementById(`row-${id}`);
    const modo = row.querySelector('.l-modo').value;
    const cant = parseFloat(row.querySelector('.l-cant').value) || 0;
    const bruto = parseFloat(row.querySelector('.l-bruto').value) || 0;
    const precio = parseFloat(row.querySelector('.l-pre').value) || 0;
    
    let tara = 0;
    if(modo === 'kg') {
        tara = cant * 0.30; // TARA AUTOMÁTICA
        row.querySelector('.l-tara').value = tara.toFixed(2);
        if(!esNetoManual) row.querySelector('.l-neto').value = (bruto - tara).toFixed(2);
    } else {
        row.querySelector('.l-tara').value = 0;
        row.querySelector('.l-neto').value = bruto;
    }

    const neto = parseFloat(row.querySelector('.l-neto').value) || 0;
    const totalFila = (modo === 'kg') ? neto * precio : cant * precio;
    
    row.querySelector('.l-tot').value = totalFila.toFixed(2);
    calcTotalFinal();
}

function calcTotalFinal() {
    let sub = 0;
    document.querySelectorAll('.l-tot').forEach(inp => sub += parseFloat(inp.value) || 0);
    
    const iva = document.getElementById('iva-toggle').checked ? sub * 0.04 : 0;
    const trans = document.getElementById('trans-toggle').checked ? sub * 0.10 : 0;
    
    document.getElementById('res-sub').innerText = sub.toFixed(2);
    document.getElementById('res-iva').innerText = iva.toFixed(2);
    document.getElementById('res-trans').innerText = trans.toFixed(2);
    document.getElementById('res-total').innerText = (sub + iva + trans).toFixed(2);
}

// --- ACCIONES ---
function seleccionarCliente() {
    const id = document.getElementById('cli-select').value;
    const c = CLIENTES_BASE.find(x => x.id === id);
    if(c) {
        document.getElementById('c-nom').value = c.nombre;
        document.getElementById('c-nif').value = c.nif;
        document.getElementById('c-dir').value = c.dir;
    }
}

function guardarFactura() {
    const factura = {
        id: "FA-" + Date.now(),
        fecha: new Date().toLocaleDateString(),
        cliente: document.getElementById('c-nom').value,
        total: document.getElementById('res-total').innerText,
        metodo: document.getElementById('f-metodo').value,
        tienda: document.getElementById('f-tags').value || "San Pablo"
    };
    dbFacturas.push(factura);
    localStorage.setItem('factu_miral_db', JSON.stringify(dbFacturas));
    generarQR();
    alert("Factura Guardada en LocalStorage");
}

function generarQR() {
    const qrDiv = document.getElementById("qrcode");
    qrDiv.innerHTML = "";
    new QRCode(qrDiv, {
        text: `FactuMiral|${document.getElementById('res-total').innerText}€|${document.getElementById('c-nom').value}`,
        width: 100, height: 100
    });
}

function reiniciarLineas() {
    document.getElementById('lineas-factura').innerHTML = "";
    document.getElementById('factura-num-display').innerText = "FA-" + Math.floor(Math.random()*9000+1000);
    for(let i=0; i<5; i++) agregarLinea();
    calcTotalFinal();
}

// --- CONTABILIDAD ---
function accederConta() {
    if(document.getElementById('pin-input').value === "8410") {
        document.getElementById('conta-lock').style.display = 'none';
        document.getElementById('conta-panel').style.display = 'block';
        renderConta('Global');
    } else {
        alert("PIN INCORRECTO");
    }
}

function renderConta(filtro) {
    let filtradas = (filtro === 'Global') ? dbFacturas : dbFacturas.filter(f => f.tienda.includes(filtro));
    
    let total = 0, efec = 0, tarj = 0;
    filtradas.forEach(f => {
        let t = parseFloat(f.total);
        total += t;
        if(f.metodo === 'Efectivo') efec += t;
        else tarj += t;
    });

    document.getElementById('s-total').innerText = total.toFixed(2) + "€";
    document.getElementById('s-efec').innerText = efec.toFixed(2) + "€";
    document.getElementById('s-tarj').innerText = tarj.toFixed(2) + "€";
}

function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("FACTURA: " + document.getElementById('factura-num-display').innerText, 10, 20);
    doc.setFontSize(10);
    doc.text("Proveedor: " + document.getElementById('p-nom').value, 10, 30);
    doc.text("Cliente: " + document.getElementById('c-nom').value, 10, 40);
    doc.text("------------------------------------------------------------------", 10, 45);
    
    let y = 55;
    document.querySelectorAll('.linea-pro').forEach(row => {
        let p = row.querySelector('.l-prod').value;
        let t = row.querySelector('.l-tot').value;
        if(p) {
            doc.text(`${p} ........................... ${t}€`, 10, y);
            y += 7;
        }
    });
    
    doc.text("------------------------------------------------------------------", 10, y + 5);
    doc.text("TOTAL FACTURA: " + document.getElementById('res-total').innerText + "€", 10, y + 15);
    doc.save("Factura_Miral.pdf");
}

function enviarWhatsApp() {
    const msg = `🍒 *FACTU MIRAL*%0A*Factura:* ${document.getElementById('factura-num-display').innerText}%0A*Cliente:* ${document.getElementById('c-nom').value}%0A*Total:* ${document.getElementById('res-total').innerText}€`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}
