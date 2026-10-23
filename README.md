# VAIA

**A calm, sidebar-first browser for Mac.**

VAIA is a desktop web browser built around a vertical sidebar, a floating command bar, Spaces, and an uncluttered, card-like content area. It's an independent, original project built with Electron, React, and TypeScript.

> 🚧 **Status:** in development. Phases 1–2 of 10 are done. See [PROGRESS.md](PROGRESS.md).

## Features

- ✅ Vertical sidebar tabs with favicons, and web pages that float in a rounded card
- ✅ Compact address pill: type a URL or search
- ✅ Tabs restored when you reopen the app
- ✅ Command Bar (⌘T): open sites, search with suggestions, switch tabs, search history, run commands
- ✅ Keyboard shortcuts: ⌘T, ⌘W, ⌘L, ⌘R, ⌘[, ⌘] and ⇧⌘C (copy URL)

### Coming next

- Favorites, Pinned tabs with folders, and Today tabs
- Spaces with their own colors, themes, and optional separate profiles
- Auto-archiving of old tabs
- Split View, Peek, and Little window
- Boosts: per-site customization
- Ad blocking

## Screenshots

_Coming soon._

## Run it from the code

You need [Node.js](https://nodejs.org) (version 22 or newer).

```bash
git clone https://github.com/vxplim/vaia.git
cd vaia
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs VAIA in development mode with live reload |
| `npm run build` | Checks the code for errors and builds it |
| `npm run build:mac` | Packages VAIA into a Mac `.app` and `.dmg` (in `dist/`) |

## License

[MIT](LICENSE) © Vanessa Minerva Lim
