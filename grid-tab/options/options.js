const PRESET_ORDER = ['1x2', '2x1', '2x2', '3x2', '2x3'];
const CELL_LETTERS = 'ABCDEFGHIJ';

// ── Vue courante ──────────────────────────────────────────────────────────────

const viewList = document.getElementById('view-list');
const viewEdit = document.getElementById('view-edit');

function showList() {
  viewEdit.classList.add('hidden');
  viewList.classList.remove('hidden');
  renderList();
}

function showEdit(layout) {
  viewList.classList.add('hidden');
  viewEdit.classList.remove('hidden');
  populateForm(layout);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ── Preview SVG ───────────────────────────────────────────────────────────────

function buildListPreviewSVG(preset) {
  const { cols, rows } = PRESETS[preset];
  const W = 40, H = 30, gap = 2, pad = 2;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const rh = (H - pad * 2 - gap * (rows - 1)) / rows;
  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cw + gap);
      const y = pad + r * (rh + gap);
      rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${rh.toFixed(1)}" rx="2" fill="currentColor"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
}

function getSitesSummary(layout) {
  return layout.cells
    .flatMap((c) => c.tabs || [])
    .map((t) => t.label || t.url)
    .filter(Boolean)
    .join(' · ');
}

// ── Liste des layouts ─────────────────────────────────────────────────────────

async function renderList() {
  const layouts = await getLayouts();
  const container = document.getElementById('layouts-container');
  container.innerHTML = '';

  if (layouts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <span></span><span></span><span></span><span></span>
        </div>
        <div>Aucun layout pour l'instant.</div>
        <div>Clique sur <strong>+ Nouveau layout</strong> pour commencer.</div>
      </div>`;
    return;
  }

  layouts.forEach((layout) => {
    const sites = getSitesSummary(layout);
    const item = document.createElement('div');
    item.className = 'layout-item';
    item.innerHTML = `
      <div class="layout-item-preview">${buildListPreviewSVG(layout.preset)}</div>
      <div class="layout-item-info">
        <div class="layout-item-name">${layout.name}</div>
        ${sites ? `<div class="layout-item-sites">${sites}</div>` : ''}
      </div>
      <div class="layout-item-actions">
        <button class="btn-edit">Modifier</button>
        <button class="btn-delete">Supprimer</button>
      </div>
    `;
    item.querySelector('.btn-edit').addEventListener('click', () => showEdit(layout));

    // Suppression inline sans confirm()
    item.querySelector('.btn-delete').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirming) {
        deleteLayout(layout.id).then(renderList);
        return;
      }
      btn.dataset.confirming = '1';
      btn.textContent = 'Confirmer ?';
      btn.classList.add('btn-delete-confirm');

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-cancel-delete';
      cancelBtn.textContent = 'Annuler';
      btn.after(cancelBtn);

      const reset = () => {
        delete btn.dataset.confirming;
        btn.textContent = 'Supprimer';
        btn.classList.remove('btn-delete-confirm');
        cancelBtn.remove();
      };
      cancelBtn.addEventListener('click', reset);
      setTimeout(reset, 4000);
    });

    container.appendChild(item);
  });
}

// ── Formulaire d'édition ──────────────────────────────────────────────────────

let editingId = null;
let selectedPreset = '2x2';

// ── Éditeur de proportions ────────────────────────────────────────────────────

let colPcts = [50, 50];
let rowPcts = [50, 50];
const MIN_PCT = 10;

function initProportions(preset, layout) {
  const { cols, rows } = PRESETS[preset];

  if (layout && layout.colWeights && layout.colWeights.length === cols) {
    const total = layout.colWeights.reduce((a, b) => a + b, 0);
    colPcts = layout.colWeights.map((w) => (w / total) * 100);
  } else {
    colPcts = Array(cols).fill(100 / cols);
  }

  if (layout && layout.rowWeights && layout.rowWeights.length === rows) {
    const total = layout.rowWeights.reduce((a, b) => a + b, 0);
    rowPcts = layout.rowWeights.map((w) => (w / total) * 100);
  } else {
    rowPcts = Array(rows).fill(100 / rows);
  }
}

function syncProportionEditor() {
  const { cols, rows } = PRESETS[selectedPreset];
  const editor = document.getElementById('proportion-editor');
  const cells = editor.querySelectorAll('.pg-cell');
  const colHandles = editor.querySelectorAll('.pg-col-handle');
  const rowHandles = editor.querySelectorAll('.pg-row-handle');

  let y = 0;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c];
      cell.style.left = x + '%';
      cell.style.top = y + '%';
      cell.style.width = colPcts[c] + '%';
      cell.style.height = rowPcts[r] + '%';
      cell.querySelector('.pg-cell-pct').textContent =
        `${Math.round(colPcts[c])}% × ${Math.round(rowPcts[r])}%`;
      x += colPcts[c];
    }
    y += rowPcts[r];
  }

  for (let c = 0; c < colHandles.length; c++) {
    colHandles[c].style.left = colPcts.slice(0, c + 1).reduce((a, b) => a + b, 0) + '%';
  }
  for (let r = 0; r < rowHandles.length; r++) {
    rowHandles[r].style.top = rowPcts.slice(0, r + 1).reduce((a, b) => a + b, 0) + '%';
  }
}

function buildProportionEditor() {
  const { cols, rows } = PRESETS[selectedPreset];
  const editor = document.getElementById('proportion-editor');
  editor.innerHTML = '';

  let y = 0;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'pg-cell';
      cell.style.left = x + '%';
      cell.style.top = y + '%';
      cell.style.width = colPcts[c] + '%';
      cell.style.height = rowPcts[r] + '%';
      cell.innerHTML = `
        <span class="pg-cell-letter">${CELL_LETTERS[r * cols + c]}</span>
        <span class="pg-cell-pct">${Math.round(colPcts[c])}% × ${Math.round(rowPcts[r])}%</span>
      `;
      editor.appendChild(cell);
      x += colPcts[c];
    }
    y += rowPcts[r];
  }

  for (let c = 0; c < cols - 1; c++) {
    const handle = document.createElement('div');
    handle.className = 'pg-handle pg-col-handle';
    handle.style.left = colPcts.slice(0, c + 1).reduce((a, b) => a + b, 0) + '%';
    handle.addEventListener('mousedown', makeColDragHandler(c));
    editor.appendChild(handle);
  }

  for (let r = 0; r < rows - 1; r++) {
    const handle = document.createElement('div');
    handle.className = 'pg-handle pg-row-handle';
    handle.style.top = rowPcts.slice(0, r + 1).reduce((a, b) => a + b, 0) + '%';
    handle.addEventListener('mousedown', makeRowDragHandler(r));
    editor.appendChild(handle);
  }
}

function makeColDragHandler(colIdx) {
  return (e) => {
    e.preventDefault();
    const editor = document.getElementById('proportion-editor');
    const rect = editor.getBoundingClientRect();
    const startX = e.clientX;
    const startA = colPcts[colIdx];
    const startB = colPcts[colIdx + 1];
    const handle = e.currentTarget;
    handle.classList.add('dragging');

    const onMove = (e) => {
      const dx = ((e.clientX - startX) / rect.width) * 100;
      const sum = startA + startB;
      const newA = Math.max(MIN_PCT, Math.min(sum - MIN_PCT, startA + dx));
      colPcts[colIdx] = newA;
      colPcts[colIdx + 1] = sum - newA;
      syncProportionEditor();
    };
    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };
}

function makeRowDragHandler(rowIdx) {
  return (e) => {
    e.preventDefault();
    const editor = document.getElementById('proportion-editor');
    const rect = editor.getBoundingClientRect();
    const startY = e.clientY;
    const startA = rowPcts[rowIdx];
    const startB = rowPcts[rowIdx + 1];
    const handle = e.currentTarget;
    handle.classList.add('dragging');

    const onMove = (e) => {
      const dy = ((e.clientY - startY) / rect.height) * 100;
      const sum = startA + startB;
      const newA = Math.max(MIN_PCT, Math.min(sum - MIN_PCT, startA + dy));
      rowPcts[rowIdx] = newA;
      rowPcts[rowIdx + 1] = sum - newA;
      syncProportionEditor();
    };
    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };
}

function buildPreviewSVG(preset, size = 56) {
  const { cols, rows } = PRESETS[preset];
  const W = size, H = Math.round(size * 0.75);
  const gap = 3, pad = 3;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const rh = (H - pad * 2 - gap * (rows - 1)) / rows;

  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cw + gap);
      const y = pad + r * (rh + gap);
      rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${rh.toFixed(1)}" rx="2" fill="currentColor"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
}

function renderPresetSelector(current) {
  selectedPreset = current;
  const container = document.getElementById('preset-selector');
  container.innerHTML = '';

  PRESET_ORDER.forEach((preset) => {
    const opt = document.createElement('div');
    opt.className = 'preset-option' + (preset === current ? ' selected' : '');
    opt.dataset.preset = preset;
    opt.innerHTML = `${buildPreviewSVG(preset)}<span class="preset-label">${preset}</span>`;
    opt.addEventListener('click', () => {
      selectedPreset = preset;
      renderPresetSelector(preset);
      initProportions(preset, null);
      buildProportionEditor();
      renderCells(collectCurrentCells());
    });
    container.appendChild(opt);
  });
}

function collectCurrentCells() {
  return Array.from(document.querySelectorAll('#cells-container .cell-block')).map((block) => ({
    position: parseInt(block.dataset.pos, 10),
    tabs: Array.from(block.querySelectorAll('.tab-row')).map((row) => ({
      url: row.querySelector('.cell-url').value,
      label: row.querySelector('.cell-label').value,
    })),
  }));
}

function createTabRow(url = '', label = '', removable = false) {
  const row = document.createElement('div');
  row.className = 'tab-row';
  row.innerHTML = `
    <input type="url" class="cell-url" placeholder="https://…" value="${url}" />
    <input type="text" class="cell-label" placeholder="Label" value="${label}" maxlength="32" />
    ${removable ? '<button type="button" class="btn-remove-tab" title="Supprimer">✕</button>' : '<span class="tab-row-spacer"></span>'}
  `;
  if (removable) {
    row.querySelector('.btn-remove-tab').addEventListener('click', () => row.remove());
  }
  return row;
}

function renderCells(existingCells = []) {
  const { cols, rows } = PRESETS[selectedPreset];
  const count = cols * rows;
  const container = document.getElementById('cells-container');
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const existing = existingCells.find((c) => c.position === i);
    const tabs = existing ? existing.tabs || [] : [];

    const block = document.createElement('div');
    block.className = 'cell-block';
    block.dataset.pos = i;

    const header = document.createElement('div');
    header.className = 'cell-block-header';
    header.innerHTML = `<span class="cell-letter">${CELL_LETTERS[i]}</span><span class="cell-block-hint">Fenêtre ${CELL_LETTERS[i]}</span>`;
    block.appendChild(header);

    const tabList = document.createElement('div');
    tabList.className = 'tab-list';

    const firstTab = tabs[0] || {};
    tabList.appendChild(createTabRow(firstTab.url || '', firstTab.label || '', false));
    for (let t = 1; t < tabs.length; t++) {
      tabList.appendChild(createTabRow(tabs[t].url || '', tabs[t].label || '', true));
    }
    block.appendChild(tabList);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-tab';
    addBtn.textContent = '+ Ajouter un onglet';
    addBtn.addEventListener('click', () => {
      tabList.appendChild(createTabRow('', '', true));
    });
    block.appendChild(addBtn);

    container.appendChild(block);
  }
}

function populateForm(layout) {
  editingId = layout ? layout.id : null;
  document.getElementById('edit-title').textContent = layout ? `Modifier "${layout.name}"` : 'Nouveau layout';
  document.getElementById('input-name').value = layout ? layout.name : '';

  const preset = layout ? layout.preset : '2x2';
  const cells = layout ? layout.cells : [];
  renderPresetSelector(preset);
  initProportions(preset, layout);
  buildProportionEditor();
  renderCells(cells);
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('input-name').value.trim();
  if (!name) return;

  const cells = collectCurrentCells();

  const layout = {
    id: editingId || generateId(),
    name,
    preset: selectedPreset,
    colWeights: colPcts.map((p) => Math.round(p)),
    rowWeights: rowPcts.map((p) => Math.round(p)),
    cells,
  };

  await saveLayout(layout);
  showList();
});

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('btn-add').addEventListener('click', () => showEdit(null));
document.getElementById('btn-back').addEventListener('click', showList);
document.getElementById('btn-cancel').addEventListener('click', showList);

// ── Import / Export ───────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', async () => {
  const layouts = await getLayouts();
  const json = JSON.stringify(layouts, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'grid-tab-layouts.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import-trigger').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Format invalide');

    for (const layout of imported) {
      if (!layout.id) layout.id = generateId();
      await saveLayout(layout);
    }
    showToast(`${imported.length} layout(s) importé(s).`, 'success');
    renderList();
  } catch (err) {
    showToast(`Erreur d'import : ${err.message}`, 'error');
  }

  e.target.value = '';
});

// ── Init ──────────────────────────────────────────────────────────────────────

showList();
initThemeToggle('btn-theme');
