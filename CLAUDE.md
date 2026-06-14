# Grid Tab — Chrome Extension

Extension Chrome qui affiche plusieurs sites web simultanément dans une grille configurable via des layouts nommés.

## Architecture

```
grid-tab/
├── manifest.json
├── background/
│   └── service-worker.js       # Règles declarativeNetRequest
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── grid/
│   ├── grid.html               # Onglet principal avec les iframes
│   ├── grid.css
│   └── grid.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── shared/
│   └── storage.js              # CRUD layouts (partagé popup + options + grid)
├── rules/
│   └── rules.json              # Règles statiques declarativeNetRequest
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

## Stack

- **Language** : Vanilla JS + HTML/CSS (pas de framework, pas de build)
- **Layout** : CSS Grid natif
- **Manifest** : V3 (requis Chrome Web Store)
- **Stockage** : `chrome.storage.sync`

## Installation / test

Charger en mode développeur : `chrome://extensions` → "Charger l'extension non empaquetée" → pointer sur le dossier `grid-tab/`.

Aucune étape de build requise — fichiers statiques directs.

## Contrainte technique clé

La plupart des sites bloquent leur affichage en iframe (`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`). L'extension utilise `chrome.declarativeNetRequest` pour supprimer ces headers sur les `sub_frame` avant que le navigateur les applique.

- Nécessite `<all_urls>` → alerte à l'installation normale
- ~95% des sites fonctionnent
- ~5% qui détectent les iframes côté JS (ex: certaines pages bancaires) ne fonctionneront pas — afficher un message d'erreur dans la cellule concernée

## Modèle de données

Stocké dans `chrome.storage.sync` sous la clé `"layouts"`.

```js
// Layout
{
  id: string,      // UUID
  name: string,    // ex: "Morning Setup"
  preset: Preset,  // "1x2" | "2x1" | "2x2" | "3x2" | "2x3"
  cells: Cell[],   // longueur = cols * rows du preset
}

// Cell
{
  position: number, // index row-major dans la grille
  url: string,      // ex: "https://gmail.com"
  label: string,    // ex: "Gmail"
}

// Presets → { cols, rows }
const PRESETS = {
  "1x2": { cols: 1, rows: 2 },
  "2x1": { cols: 2, rows: 1 },
  "2x2": { cols: 2, rows: 2 },
  "3x2": { cols: 3, rows: 2 },
  "2x3": { cols: 2, rows: 3 },
};
```

## Permissions manifest.json

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "declarativeNetRequest", "declarativeNetRequestWithHostAccess", "tabs"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_popup": "popup/popup.html" },
  "background": { "service_worker": "background/service-worker.js" },
  "options_ui": { "page": "options/options.html", "open_in_tab": true }
}
```

## Règles declarativeNetRequest (`rules/rules.json`)

```json
[{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      { "header": "X-Frame-Options", "operation": "remove" },
      { "header": "Content-Security-Policy", "operation": "remove" }
    ]
  },
  "condition": { "resourceTypes": ["sub_frame"] }
}]
```

## Fonctionnalités par fichier

| Fichier | Responsabilité |
|---------|---------------|
| `popup.js` | Liste layouts + aperçu preset, ouvre le Grid Tab au clic, navigation vers Options |
| `grid.js` | Affiche les iframes du layout actif, barre top avec sélecteur de layout |
| `options.js` | CRUD layouts, sélection visuelle preset, import/export JSON |
| `storage.js` | Abstraction `chrome.storage.sync` — lire/écrire/supprimer les layouts |
| `service-worker.js` | Initialise les règles declarativeNetRequest au démarrage |

## Limites connues

- Suppression du header CSP complet peut casser des sites qui l'utilisent pour autre chose que le framing
- `chrome.storage.sync` : 100KB total / 8KB par item (largement suffisant pour des dizaines de layouts)
- Sites avec `window.top !== window.self` : non contournables
