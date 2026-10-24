<p align="center"><img src="build/icon.png" width="128" alt="VAIA icon"></p>

# VAIA

**A calm, sidebar-first browser for Mac.**

VAIA is a desktop web browser built around a vertical sidebar, a floating command bar, Spaces, and an uncluttered, card-like content area. It's an independent, original project built with Electron, React, and TypeScript.

![VAIA with its sidebar, favorites and a web page](screenshots/main.png)

## Download

**[⬇ Download the latest VAIA](https://github.com/vxplim/vaia/releases/latest)** from the Releases page, then pick the file for your Mac:

| Your Mac | File to download |
|---|---|
| Apple Silicon (M1, M2, M3, M4…) | `VAIA-<version>-arm64.dmg` |
| Intel | `VAIA-<version>-x64.dmg` |

Not sure which? Apple menu  → **About This Mac**. If "Chip" says Apple M-something, pick Apple Silicon.

## Install

1. Open the `.dmg` you downloaded and drag **VAIA** into the **Applications** folder.
2. Open VAIA from Applications. The first time, macOS says it can't verify the app (VAIA isn't signed with a paid Apple Developer ID yet). Click **Done** (not "Move to Trash").
3. Open **System Settings → Privacy & Security**, scroll down to "VAIA was blocked…" and click **Open Anyway**, then enter your Mac password and click **Open Anyway** again.
4. That's it. macOS remembers your choice, so from now on VAIA opens normally.

**Updating:** quit VAIA (⌘Q), open the new `.dmg`, drag VAIA into Applications and choose **Replace**. Your tabs, Spaces, passwords and settings are kept (they live in `~/Library/Application Support/VAIA`, not in the app). You may need "Open Anyway" once more.

Optional: make VAIA your default browser from the VAIA menu → **Make VAIA Your Default Browser**.

## Features

**Tabs & the sidebar**
- Vertical sidebar tabs, with web pages floating in a rounded card; tabs come back when you reopen VAIA
- Favorites (icon tiles), Pinned tabs with folders, and Today tabs, all with drag and drop
- **Tidy**: group Today tabs by website and close duplicates in one click (with Undo), or let Claude sort them into topic folders with your own API key
- Auto-archive of Today tabs you haven't viewed in a while, a searchable Archive, and ⇧⌘T to reopen closed tabs
- **Library** (⇧⌘L): Archive, Downloads, Media, Spaces, Boosts and To-do in one panel that slides out over the page
- Hideable sidebar (⌘S) that slides out smoothly when you rest at the left edge
- **Rename any tab**, unread badges on pinned tabs and favorites, ⌃Tab to flip between recent tabs, and **tab sleep** to save memory

**Spaces & look**
- Spaces with their own emoji and pastel theme on a clean black-and-white design: 12 presets, a color wheel, intensity (Whisper → Soft), tone (warmer ↔ cooler), gradients, light/dark/auto
- Optional **separate account per Space** (its own cookies, logins and passwords), set up when you create the Space, with **Sign in with Google**
- Switch Spaces with ⌃1…⌃9 or a two-finger swipe
- **Space menu** (⋯ next to the Space name, or right-click a Space icon): icon, name, theme, account, new folder, **export tabs as bookmarks**, delete
- **Library → Spaces**: all Spaces side by side; drag tabs between them

**Browsing**
- Command Bar (⌘T): open sites, search with suggestions, switch tabs, search history, run commands, add to-dos
- **Split View**: 2–4 tabs side by side or in a 2×2 grid, with presets (50/50, 70/30, 30/70, three columns, grid) and a toolbar on each pane
- Peek previews (also: hold Shift over a link), Little windows (⌥⌘N), and **private windows** (⇧⌘N)
- **Sound controls** on tabs and a **Mini Player** for the video, music or call you just left
- Built-in **PDF viewer**, **printing** (⌘P), full-screen video, picture in picture, Find in page (⌘F), spelling suggestions
- Friendly error pages, blocked certificate errors, and crash recovery

**Your stuff**
- **To-do list** per Space or everywhere: slide-out panel (⇧⌘K), sidebar section, and a pop-out window that can stay on top
- **Password manager** per account: saves and fills logins on the exact same site, encrypted with your Mac's Keychain, Touch ID to view, CSV import from Google Password Manager / Chrome
- **Downloads**: hover for recent files, click for a searchable page with thumbnails
- **Media**: your downloaded pictures, videos and PDFs (and, if you like, your Mac screenshots) as a grid with a large preview
- History, and bookmark import from Chrome, Safari or any exported bookmarks file

**Customizing & privacy**
- **Chrome extensions** from the Chrome Web Store, with toolbar buttons and popups
- **Site permissions**: VAIA asks before sites use your camera, microphone, location or notifications
- Built-in ad and tracker blocker
- **Boosts**: recolor any website, change its font, zap away elements, add your own CSS/JS
- Google sign-in compatibility (on by default; Settings → General)

Keyboard shortcuts: ⌘T, ⌘W, ⌘L, ⌃Tab, ⌘R, ⌘[ / ⌘], ⇧⌘T, ⇧⌘C, ⌘S, ⌘F, ⌘P, ⌃1…⌃9, ⌃⇧=, ⌥⌘N, ⇧⌘N, ⇧⌘K, ⌘Y, ⇧⌘L, ⇧⌘J, ⌘, (full list in Settings).

## Screenshots

| | |
|---|---|
| ![Command Bar](screenshots/command-bar.png) **Command Bar** (⌘T) | ![Split View](screenshots/split-view.png) **Split View** |
| ![Space themes](screenshots/spaces.png) **Spaces with their own themes** | |

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
| `npm run build:mac` | Packages VAIA into Mac `.dmg` installers for Apple Silicon and Intel (in `dist/`) |

## License

VAIA is free software, licensed under the [GNU General Public License v3.0](LICENSE). © 2026 Vanessa Minerva Lim.

You can use, study, share and change VAIA; if you share a changed version, you share its source code under the same licence. VAIA uses [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell) (GPL-3.0) for Chrome extension support.
