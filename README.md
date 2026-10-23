# VAIA

**A calm, sidebar-first browser for Mac.**

VAIA is a desktop web browser built around a vertical sidebar, a floating command bar, Spaces, and an uncluttered, card-like content area. It's an independent, original project built with Electron, React, and TypeScript.

> 🚧 **Status:** early development (Phase 0: setup). See [PROGRESS.md](PROGRESS.md).

## Planned features

- Vertical sidebar tabs (no tab bar)
- Command Bar (Cmd+T)
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
