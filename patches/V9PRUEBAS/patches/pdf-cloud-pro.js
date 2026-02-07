(() => {
  if (window.__FM_BTN_TEST__) return;
  window.__FM_BTN_TEST__ = true;

  const host = document.querySelector('.topbar__right') || document.body;

  const b = document.createElement('button');
  b.id = 'btnPdfProCloud';
  b.type = 'button';
  b.textContent = 'PDF PRO + CLOUD';

  // Estilo verde (sin tocar tu CSS)
  b.style.background = '#26d06a';
  b.style.color = '#000';
  b.style.border = '1px solid rgba(0,0,0,.25)';
  b.style.padding = '10px 12px';
  b.style.borderRadius = '12px';
  b.style.fontWeight = '800';
  b.style.cursor = 'pointer';

  host.appendChild(b);

  b.addEventListener('click', () => alert('✅ Botón OK: el patch se cargó bien'));
  console.log('✅ pdf-cloud-pro.js cargado correctamente');
})();
