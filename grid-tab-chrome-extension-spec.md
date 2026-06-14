# Spec Projet — Extension Chrome "Grid Tab"

## Contexte

Extension Chrome permettant d'ouvrir un onglet dédié qui affiche plusieurs sites web simultanément dans une grille. L'utilisateur configure des layouts nommés (ex: "Morning Setup" en 2×2 : Gmail, Notion, Calendar, Slack) et les active en un clic depuis la popup de l'extension.

---

## Contrainte technique clé

La plupart des sites bloquent leur affichage en iframe via des headers HTTP :
- `X-Frame-Options: SAMEORIGIN` ou `DENY`
- `Content-Security-Policy: frame-ancestors 'none'`

**Solution** : L'extension utilise l'API `chrome.declarativeNetRequest` (Manifest V3) pour supprimer ces headers des réponses HTTP avant que le navigateur les applique. Cela nécessite la permission `<all_urls>` — l'utilisateur verra une alerte à l'installation ("Lire et modifier les données sur tous les sites"). ~95% des sites fonctionneront. Les ~5% restants qui détectent les iframes côté JS (ex: certaines pages bancaires) ne fonctionneront pas.

---

## Fonctionnalités

### F1 — Grid Tab
- Onglet dédié (`chrome-extension://…/grid/grid.html`)
- Affiche les iframes du layout actif en CSS Grid
- Barre supérieure fine avec : nom du layout, sélecteur de layout, bouton Settings
- Chaque cellule affiche l'iframe + une petite barre de titre avec le label du site

### F2 — Layouts
- Un layout = un nom + un preset de grille + une URL (+ label optionnel) par cellule
- Presets disponibles : **1×2**, **2×1**, **2×2**, **3×2**, **2×3**
- Nombre de layouts illimité, stockés dans `chrome.storage.sync`

### F3 — Popup (clic sur l'icône)
- Liste des layouts sauvegardés avec aperçu visuel du preset
- Clic sur un layout → ouvre/navigue vers le Grid Tab avec ce layout
- Bouton "Nouveau layout" → ouvre la page Options
- Bouton "Gérer les layouts" → ouvre la page Options

### F4 — Page Options (configuration)
- Créer, modifier, supprimer, réordonner les layouts
- Pour chaque layout :
  - Nom libre
  - Sélection visuelle du preset (grille cliquable)
  - Pour chaque cellule : champ URL + champ label
- Import / export JSON des layouts (backup)

---

## Architecture de l'extension

```
grid-tab/
├── manifest.json
├── background/
│   └── service-worker.js       # Gestion des règles declarativeNetRequest
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── grid/
│   ├── grid.html               # L'onglet principal avec les iframes
│   ├── grid.css
│   └── grid.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── shared/
│   └── storage.js              # CRUD layouts (utilisé par popup + options + grid)
├── rules/
│   └── rules.json              # Règles statiques declarativeNetRequest
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

---

## Manifest V3 — Permissions requises

```json
{
  "manifest_version": 3,
  "name": "Grid Tab",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
    "tabs"
  ],
  "host_permissions": ["<all_urls>"],
  "action": { "default_popup": "popup/popup.html" },
  "background": { "service_worker": "background/service-worker.js" },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  }
}
```

---

## Modèle de données

```typescript
// Stocké dans chrome.storage.sync sous la clé "layouts"
interface Layout {
  id: string;           // UUID
  name: string;         // ex: "Morning Setup"
  preset: Preset;       // "1x2" | "2x1" | "2x2" | "3x2" | "2x3"
  cells: Cell[];        // longueur = cols * rows du preset
}

interface Cell {
  position: number;     // index dans la grille (row-major)
  url: string;          // ex: "https://gmail.com"
  label: string;        // ex: "Gmail"
}

type Preset = "1x2" | "2x1" | "2x2" | "3x2" | "2x3";

// Preset → { cols, rows }
const PRESETS = {
  "1x2": { cols: 1, rows: 2 },
  "2x1": { cols: 2, rows: 1 },
  "2x2": { cols: 2, rows: 2 },
  "3x2": { cols: 3, rows: 2 },
  "2x3": { cols: 2, rows: 3 },
};
```

---

## Règles declarativeNetRequest (`rules/rules.json`)

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        { "header": "X-Frame-Options", "operation": "remove" },
        { "header": "Content-Security-Policy", "operation": "remove" }
      ]
    },
    "condition": {
      "resourceTypes": ["sub_frame"]
    }
  }
]
```

> ⚠️ Ces règles ne s'appliquent qu'aux `sub_frame` (iframes), pas aux requêtes de navigation principale.

---

## UX — Flux principal

```
1. Clic icône → Popup
   └─ Affiche liste des layouts
      └─ Clic layout → Grid Tab s'ouvre (ou se met à jour)

2. Grid Tab
   ├─ Barre top : [Morning Setup ▾] [⚙ Settings]
   └─ Grille CSS avec iframes

3. Modifier les layouts
   └─ Popup > "Gérer" → Options Page
      ├─ Liste des layouts (drag-to-reorder)
      └─ Formulaire par layout
```

---

## Wireframes

### Popup
```
┌─────────────────────────┐
│  Grid Tab          [+]  │
├─────────────────────────┤
│ ▣ Morning Setup         │
│   [■][■]                │
│   [■][■]  2×2           │
├─────────────────────────┤
│ ▣ Research              │
│   [■][■][■]             │
│   [■][■][■]  3×2        │
├─────────────────────────┤
│ ▣ Focus                 │
│   [■■■■]  1×2           │
├─────────────────────────┤
│         [Gérer]         │
└─────────────────────────┘
```

### Grid Tab (layout 2×2)
```
┌──────────────────────────────────────────────────┐
│  Morning Setup ▾                        [⚙ Edit] │
├──────────────────────┬───────────────────────────┤
│ Gmail                │ Notion                    │
│                      │                           │
│      <iframe>        │       <iframe>            │
│                      │                           │
├──────────────────────┼───────────────────────────┤
│ Calendar             │ Slack                     │
│                      │                           │
│      <iframe>        │       <iframe>            │
│                      │                           │
└──────────────────────┴───────────────────────────┘
```

### Options — Éditeur de layout
```
┌──────────────────────────────────────────────────┐
│  ← Retour    Modifier "Morning Setup"            │
├──────────────────────────────────────────────────┤
│  Nom :  [Morning Setup               ]           │
│                                                  │
│  Preset :                                        │
│  ┌────┐ ┌─┬─┐ ┌─┬─┐ ┌─┬─┬─┐ ┌─┬─┐             │
│  │    │ │ │ │ │ │ │ │ │ │ │ │ │ │ │             │
│  │1×2 │ ├─┤ │ ├─┼─┤ ├─┼─┼─┤ ├─┼─┤             │
│  │    │ │ │ │ │ │ │ │ │ │ │ │ │ │ │             │
│  └────┘ └─┴─┘ └─┴─┘ └─┴─┴─┘ └─┴─┘             │
│          2×1   2×2    3×2    2×3                 │
│  [✓ sélectionné : 2×2]                           │
│                                                  │
│  Cellules :                                      │
│  [A] Gmail    https://mail.google.com    [✎][✕] │
│  [B] Notion   https://notion.so          [✎][✕] │
│  [C] Calendar https://calendar.google.com[✎][✕] │
│  [D] Slack    https://app.slack.com      [✎][✕] │
│                                                  │
│              [Annuler]  [Sauvegarder]            │
└──────────────────────────────────────────────────┘
```

---

## Checklist de vérification

| Test | Attendu |
|------|---------|
| Installer en mode développeur (`chrome://extensions`) | Icône visible, pas d'erreur console |
| Créer un layout 2×2 avec Gmail / Notion / Calendar / Slack | Sauvegardé dans `chrome.storage.sync` |
| Cliquer le layout depuis la popup | Grid Tab s'ouvre avec 4 iframes |
| Gmail s'affiche dans l'iframe | Header stripping opérationnel |
| Modifier un layout depuis Options | Changement reflété dans Grid Tab |
| Supprimer un layout | Disparaît de la popup |
| Export JSON → réimport | Layouts restaurés à l'identique |
| Site anti-iframe JS (ex: page bancaire) | Message d'erreur affiché dans la cellule |

---

## Limites connues

- **Sites avec détection JS** (`window.top !== window.self`) : non contournables, ~5% des sites
- **Suppression du header CSP complet** : peut casser certains sites qui s'appuient sur CSP pour autre chose que le framing — à monitorer
- **`chrome.storage.sync`** : limite de 100KB total / 8KB par item — suffisant pour des dizaines de layouts

---

## Stack technique

| Composant | Choix |
|-----------|-------|
| Language | Vanilla JS + HTML/CSS (pas de framework) |
| Layout | CSS Grid natif |
| Manifest | V3 (obligatoire Chrome Web Store) |
| Stockage | `chrome.storage.sync` |
| Build | Aucun (fichiers statiques directs) |
| Évolution possible | TypeScript si la codebase grossit |
