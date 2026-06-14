const STORAGE_KEY = 'layouts';

const PRESETS = {
  '1x2': { cols: 1, rows: 2 },
  '2x1': { cols: 2, rows: 1 },
  '2x2': { cols: 2, rows: 2 },
  '3x2': { cols: 3, rows: 2 },
  '2x3': { cols: 2, rows: 3 },
};

function getLayouts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const layouts = (result[STORAGE_KEY] || []).map((l) => ({
        ...l,
        cells: (l.cells || []).map((cell) =>
          cell.tabs ? cell : { position: cell.position, tabs: [{ url: cell.url || '', label: cell.label || '' }] }
        ),
      }));
      resolve(layouts);
    });
  });
}

const SESSION_KEY = 'activeWindowIds';

function getDisplayWorkArea() {
  return new Promise((resolve) => {
    chrome.system.display.getInfo({}, (displays) => {
      const primary = displays.find((d) => d.isPrimary) || displays[0];
      resolve(primary.workArea);
    });
  });
}

async function closeLayoutWindows() {
  const session = await chrome.storage.session.get(SESSION_KEY);
  const ids = session[SESSION_KEY] || [];
  await Promise.all(ids.map((id) => chrome.windows.remove(id).catch(() => {})));
  await chrome.storage.session.remove(SESSION_KEY);
}

async function activateLayout(layoutId) {
  const layouts = await getLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  if (!layout) return;

  await closeLayoutWindows();

  const workArea = await getDisplayWorkArea();
  const { cols, rows } = PRESETS[layout.preset];

  const cw = layout.colWeights && layout.colWeights.length === cols ? layout.colWeights : Array(cols).fill(1);
  const rh = layout.rowWeights && layout.rowWeights.length === rows ? layout.rowWeights : Array(rows).fill(1);
  const totalCW = cw.reduce((a, b) => a + b, 0);
  const totalRH = rh.reduce((a, b) => a + b, 0);

  const colWidths = cw.map((w) => Math.round((workArea.width * w) / totalCW));
  const rowHeights = rh.map((w) => Math.round((workArea.height * w) / totalRH));
  colWidths[cols - 1] = workArea.width - colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
  rowHeights[rows - 1] = workArea.height - rowHeights.slice(0, -1).reduce((a, b) => a + b, 0);

  const colOffsets = colWidths.map((_, i) => colWidths.slice(0, i).reduce((a, b) => a + b, 0));
  const rowOffsets = rowHeights.map((_, i) => rowHeights.slice(0, i).reduce((a, b) => a + b, 0));

  const windowIds = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = layout.cells[r * cols + c];
      if (!cell) continue;
      const urls = (cell.tabs || []).map((t) => t.url).filter(Boolean);
      if (urls.length === 0) continue;
      const win = await chrome.windows.create({
        url: urls,
        left: workArea.left + colOffsets[c],
        top: workArea.top + rowOffsets[r],
        width: colWidths[c],
        height: rowHeights[r],
        type: 'normal',
      });
      windowIds.push(win.id);
    }
  }

  await chrome.storage.session.set({ [SESSION_KEY]: windowIds });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'activateLayout') {
    activateLayout(msg.layoutId).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.action === 'closeAll') {
    closeLayoutWindows().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const session = await chrome.storage.session.get(SESSION_KEY);
  const ids = session[SESSION_KEY] || [];
  await chrome.storage.session.set({ [SESSION_KEY]: ids.filter((id) => id !== windowId) });
});

// ── Omnibox ───────────────────────────────────────────────────────────────────

chrome.omnibox.setDefaultSuggestion({
  description: 'Grid Tab — tape un nom de layout et appuie sur Entrée',
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const layouts = await getLayouts();
  const query = text.trim().toLowerCase();

  const suggestions = [];

  if (!query || 'close'.startsWith(query)) {
    suggestions.push({ content: 'close', description: 'Fermer toutes les fenêtres' });
  }

  const matches = query
    ? layouts.filter((l) => l.name.toLowerCase().includes(query))
    : layouts;

  suggestions.push(...matches.map((l) => ({ content: l.id, description: l.name })));

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text) => {
  if (text.trim().toLowerCase() === 'close') {
    await closeLayoutWindows();
    return;
  }
  const layouts = await getLayouts();
  const layout =
    layouts.find((l) => l.id === text) ||
    layouts.find((l) => l.name.toLowerCase() === text.trim().toLowerCase());
  if (layout) {
    await activateLayout(layout.id);
  }
});
