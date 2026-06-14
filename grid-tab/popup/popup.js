function buildPreviewSVG(preset) {
  const { cols, rows } = PRESETS[preset];
  const W = 48, H = 36, gap = 2, pad = 2;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const rh = (H - pad * 2 - gap * (rows - 1)) / rows;

  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cw + gap);
      const y = pad + r * (rh + gap);
      rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${rh.toFixed(1)}" rx="1" fill="#45475a"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
}

function activateLayout(layoutId) {
  chrome.runtime.sendMessage({ action: 'activateLayout', layoutId });
  window.close();
}

function renderLayouts(layouts) {
  const list = document.getElementById('layout-list');
  list.innerHTML = '';

  if (layouts.length === 0) {
    list.innerHTML = '<p class="empty-state">Aucun layout.<br>Crée-en un via le bouton +</p>';
    return;
  }

  layouts.forEach((layout) => {
    const card = document.createElement('div');
    card.className = 'layout-card';
    card.innerHTML = `
      <div class="preset-preview">${buildPreviewSVG(layout.preset)}</div>
      <div class="layout-info">
        <div class="layout-name">${layout.name}</div>
        <div class="layout-preset-label">${layout.preset}</div>
      </div>
    `;
    card.addEventListener('click', () => activateLayout(layout.id));
    list.appendChild(card);
  });
}

document.getElementById('btn-new').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('btn-manage').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('btn-close-all').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'closeAll' });
  window.close();
});

getLayouts().then(renderLayouts);
