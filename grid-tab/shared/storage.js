const STORAGE_KEY = 'layouts';

const PRESETS = {
  '1x2': { cols: 1, rows: 2 },
  '2x1': { cols: 2, rows: 1 },
  '2x2': { cols: 2, rows: 2 },
  '3x2': { cols: 3, rows: 2 },
  '2x3': { cols: 2, rows: 3 },
};

function generateId() {
  return crypto.randomUUID();
}

// Migration : ancien format {url, label} → nouveau {tabs: [{url, label}]}
function migrateCell(cell) {
  if (cell.tabs) return cell;
  return { position: cell.position, tabs: [{ url: cell.url || '', label: cell.label || '' }] };
}

function getLayouts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const layouts = (result[STORAGE_KEY] || []).map((l) => ({
        ...l,
        cells: (l.cells || []).map(migrateCell),
      }));
      resolve(layouts);
    });
  });
}

function saveLayout(layout) {
  return getLayouts().then((layouts) => {
    const idx = layouts.findIndex((l) => l.id === layout.id);
    if (idx >= 0) {
      layouts[idx] = layout;
    } else {
      layouts.push(layout);
    }
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: layouts }, resolve);
    });
  });
}

function deleteLayout(id) {
  return getLayouts().then((layouts) => {
    const filtered = layouts.filter((l) => l.id !== id);
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: filtered }, resolve);
    });
  });
}

function reorderLayouts(orderedIds) {
  return getLayouts().then((layouts) => {
    const map = Object.fromEntries(layouts.map((l) => [l.id, l]));
    const reordered = orderedIds.map((id) => map[id]).filter(Boolean);
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: reordered }, resolve);
    });
  });
}
