<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ARSLAN PRO V10.4 — KIWI Edition</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
</head>
<body>

  <!-- SPLASH -->
  <div id="splash">
    <img src="logo-kiwi.png" alt="Kiwi" />
    <h1>ARSLAN PRO</h1>
    <p>V10.4 — KIWI Edition</p>
  </div>

  <header class="topbar">
    <div class="brand">
      <img src="logo-kiwi.png" alt="KIWI" />
      <span>ARSLAN PRO <small>V10.4</small></span>
    </div>
    <nav class="tabs">
      <button class="active" data-tab="factura">Factura</button>
      <button data-tab="clientes">Clientes</button>
      <button data-tab="facturas">Facturas</button>
      <button data-tab="pendientes">Pendientes</button>
      <button data-tab="ventas">Ventas</button>
      <button data-tab="resumen">Resumen</button>
    </nav>
  </header>

  <main class="container">

    <!-- FACTURA -->
    <section class="panel active" data-panel="factura">
      <div class="grid2">
        <div class="card">
          <h3>Proveedor</h3>
          <input id="provNombre" placeholder="Nombre proveedor" />
          <input id="provNif" placeholder="NIF/CIF" />
          <input id="provDir" placeholder="Dirección" />
          <input id="provTel" placeholder="Teléfono" />
          <input id="provEmail" placeholder="Email" />
        </div>
        <div class="card">
          <h3>Cliente</h3>
          <div class="row gap">
            <select id="selCliente" class="grow"></select>
            <button id="btnAddCliente" class="ghost">+ Nuevo</button>
          </div>
          <input id="cliNombre" placeholder="Nombre cliente" />
          <input id="cliNif" placeholder="NIF/CIF" />
          <input id="cliDir" placeholder="Dirección" />
          <input id="cliTel" placeholder="Teléfono" />
          <input id="cliEmail" placeholder="Email" />
        </div>
      </div>

      <div class="card">
        <div class="title-row">
          <h3>Cuadro de cálculo</h3>
          <div class="row gap">
            <button id="btnAddLinea">+ Añadir línea</button>
            <button id="btnVaciarLineas" class="ghost">Vaciar</button>
          </div>
        </div>

        <datalist id="productNamesList"></datalist>

        <div class="table-wrap">
          <table class="calc-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Modo</th>
                <th>Cant.</th>
                <th>Bruto (kg)</th>
                <th>Tara (kg)</th>
                <th>Neto (kg)</th>
                <th>Precio</th>
                <th>Origen</th>
                <th>Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="lineasBody"></tbody>
          </table>
        </div>
      </div>

      <div class="grid3">
        <div class="card">
          <h3>💶 Totales factura</h3>
          <label class="check"><input type="checkbox" id="chkTransporte" /> Añadir transporte 10%</label>
          <label class="check"><input type="checkbox" id="chkIvaIncluido" checked /> IVA 4% incluido (informativo)</label>

          <div class="totals-grid">
            <div>Subtotal</div><div id="subtotal">0,00 €</div>
            <div>Transporte</div><div id="transp">0,00 €</div>
            <div>IVA (4%)</div><div id="iva">0,00 €</div>
            <div class="big">TOTAL</div><div class="big" id="total">0,00 €</div>
          </div>
        </div>

        <div class="card">
          <h3>Pagos</h3>
          <div class="row gap">
            <input id="inpPagoParcial" type="number" step="0.01" placeholder="Importe parcial" />
            <button id="btnAddPago" class="ghost">+ Añadir pago</button>
          </div>
          <div id="listaPagos" class="list small"></div>
          <label class="mt8">Pagado manual
            <input id="pagado" type="number" step="0.01" />
          </label>
          <label>Estado
            <select id="estado">
              <option value="pendiente">Impagada</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagada</option>
            </select>
          </label>
          <label>Método
            <select id="metodoPago">
              <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>
            </select>
          </label>
          <div class="pendiente">Pendiente: <strong id="pendiente">0,00 €</strong></div>
        </div>

        <div class="card">
          <h3>Observaciones</h3>
          <textarea id="observaciones" rows="6" placeholder="Notas, condiciones, etc."></textarea>
        </div>
      </div>

      <div class="row actions">
        <button id="btnGuardar">💾 Guardar</button>
        <button id="btnImprimir">🖨️ Generar PDF</button>
        <button id="btnNueva" class="ghost">🧾 Nueva</button>
      </div>

      <!-- Área PDF -->
      <div id="printArea" class="print">
        <div class="pdf-header">
          <div class="pdf-brand">
            <img src="logo-kiwi.png" alt="Kiwi" />
            <div>
              <h2>ARSLAN PRO</h2>
              <div id="p-prov"></div>
            </div>
          </div>
          <div class="pdf-meta">
            <div><span>Nº Factura:</span> <strong id="p-num"></strong></div>
            <div><span>Fecha:</span> <strong id="p-fecha"></strong></div>
            <div><span>Cliente:</span><div id="p-cli"></div></div>
            <canvas id="p-qr" width="92" height="92"></canvas>
          </div>
        </div>

        <table id="p-tabla">
          <thead>
            <tr>
              <th>Producto</th><th>Modo</th><th>Cant.</th><th>Bruto</th><th>Tara</th><th>Neto</th><th>Precio</th><th>Origen</th><th>Importe</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <div class="pdf-totales">
          <div>
            <div>Subtotal: <strong id="p-sub">0,00 €</strong></div>
            <div>Transporte: <strong id="p-tra">0,00 €</strong></div>
            <div>IVA (4%): <strong id="p-iva">0,00 €</strong></div>
            <div class="big">Total: <strong id="p-tot">0,00 €</strong></div>
          </div>
          <div>
            <div>Estado: <strong id="p-estado">Impagada</strong></div>
            <div>Método: <strong id="p-metodo">Efectivo</strong></div>
            <div>Obs.: <span id="p-obs">—</span></div>
          </div>
        </div>

        <div class="pdf-foot" id="pdf-foot-note">IVA incluido en los precios.</div>
      </div>

    </section>

    <!-- CLIENTES -->
    <section class="panel" data-panel="clientes">
      <div class="card">
        <div class="title-row">
          <h3>Clientes</h3>
          <div class="row gap">
            <input id="buscarCliente" class="search grow" placeholder="Buscar cliente…" />
            <button id="btnExportClientes" class="ghost">⤓ Exportar</button>
            <button id="btnImportClientes" class="ghost">⤒ Importar</button>
          </div>
        </div>
        <div id="listaClientes" class="list"></div>
      </div>
    </section>

    <!-- FACTURAS -->
    <section class="panel" data-panel="facturas">
      <div class="card">
        <div class="title-row">
          <h3>Facturas</h3>
          <div class="row gap">
            <select id="filtroEstado">
              <option value="todas">Todas</option>
              <option value="pendiente">Impagadas</option>
              <option value="parcial">Parciales</option>
              <option value="pagado">Pagadas</option>
            </select>
            <input id="buscaCliente" class="search grow" placeholder="Buscar por cliente…" />
            <button id="btnExportFacturas" class="ghost">⤓ Exportar</button>
            <button id="btnImportFacturas" class="ghost">⤒ Importar</button>
          </div>
        </div>
        <div id="listaFacturas" class="list"></div>
      </div>
    </section>

    <!-- PENDIENTES -->
    <section class="panel" data-panel="pendientes">
      <div class="card">
        <div class="title-row">
          <h3>Deudas por cliente</h3>
          <div class="row gap">
            <button id="btnResetCliente" class="ghost">Reset deudas del cliente actual</button>
            <button id="btnResetGlobal" class="ghost">Reset deudas global</button>
          </div>
        </div>
        <table class="calc-table" id="tblPendientes">
          <thead>
            <tr><th>Cliente</th><th>Nº facturas pendientes</th><th>Total pendiente</th><th>Última factura</th><th>Acciones</th></tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="pendiente total">Total pendiente global: <strong id="resGlobal">0,00 €</strong></div>
      </div>
    </section>

    <!-- VENTAS -->
    <section class="panel" data-panel="ventas">
      <div class="grid2">
        <div class="card">
          <h3>Totales globales</h3>
          <div class="kpis">
            <div class="kpi"><span>Hoy</span><strong id="vHoy">0,00 €</strong></div>
            <div class="kpi"><span>Semana</span><strong id="vSemana">0,00 €</strong></div>
            <div class="kpi"><span>Mes</span><strong id="vMes">0,00 €</strong></div>
            <div class="kpi"><span>Total</span><strong id="vTotal">0,00 €</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Top productos (total €)</h3>
          <canvas id="chartTop" height="160"></canvas>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3>Ventas diarias (7 días)</h3>
          <canvas id="chartDiario" height="140"></canvas>
        </div>
        <div class="card">
          <h3>Ventas mensuales (12 meses)</h3>
          <canvas id="chartMensual" height="140"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="title-row">
          <h3>Detalle por cliente</h3>
          <div class="row gap">
            <input id="ventasFiltroMes" type="month" />
            <button id="btnExportVentas" class="ghost">📤 Exportar CSV</button>
          </div>
        </div>
        <table class="calc-table" id="tblVentasCliente">
          <thead>
            <tr><th>Cliente</th><th>Hoy</th><th>Semana</th><th>Mes</th><th>Total</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <!-- RESUMEN -->
    <section class="panel" data-panel="resumen">
      <div class="card">
        <h3>Resumen rápido</h3>
        <div class="kpis">
          <div class="kpi"><span>Hoy</span><strong id="rHoy">0,00 €</strong></div>
          <div class="kpi"><span>Semana</span><strong id="rSemana">0,00 €</strong></div>
          <div class="kpi"><span>Mes</span><strong id="rMes">0,00 €</strong></div>
          <div class="kpi"><span>Total</span><strong id="rTotal">0,00 €</strong></div>
        </div>
        <div class="row actions mt8">
          <button id="btnBackup">Backup</button>
          <button id="btnRestore" class="ghost">Restaurar</button>
        </div>
      </div>
    </section>

  </main>

  <script src="app.js"></script>
</body>
</html>
