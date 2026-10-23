# How VAIA Works (a beginner's guide)

## The big idea

VAIA is built with **Electron**. Electron bundles a real browser engine (Chromium, the engine inside Google Chrome) with **Node.js** (which lets JavaScript use your computer's files, windows, and so on). We write everything in **TypeScript**, which is JavaScript plus labels on our data so mistakes get caught early.

An Electron app has three parts that talk to each other:

```
┌───────────────────────┐      ┌──────────────┐      ┌───────────────────────┐
│  MAIN process          │ <──> │   PRELOAD     │ <──> │  RENDERER (the UI)     │
│  "the brain"           │      │  "the bridge" │      │  sidebar, command bar  │
│  windows, tabs, saving │      │  safe, typed  │      │  built with React      │
└───────────────────────┘      └──────────────┘      └───────────────────────┘
```

- **Main** (`src/main/`): creates the app window, and later manages tabs and saves your data. It can do powerful things, so the UI isn't allowed to touch it directly.
- **Preload** (`src/preload/`): a tiny bridge. It hands the UI a short list of approved functions (`window.vaia.…`). This is a key security rule: websites and the UI never get direct access to your computer.
- **Renderer** (`src/renderer/`): what you see. It's built with **React**, which builds screens out of small reusable pieces called "components".

Web pages themselves (Phase 1 onward) run in separate, locked-down views called **WebContentsView**, which sit next to the sidebar.

## How a tab gets on screen

1. You press ⌘T. The **menu** (`src/main/menu.ts`) catches it and tells the UI "open a new tab".
2. The UI asks the brain to run the action `tab/new` (through the bridge, `window.vaia.dispatch`).
3. The brain (`src/main/browser.ts`) adds the tab to your data and broadcasts the new data to the UI.
4. The UI redraws the sidebar, measures the rounded content card, and tells the brain "show tab X at these pixels" (`setPanes`).
5. The brain places that tab's web page view (a `WebContentsView`) exactly over the card.

## Things that float over web pages

A web page view is always drawn on top of VAIA's own interface. So whenever something must float over a page (the Command Bar, the Space editor, the Archive, Peek, the slid-out sidebar), the UI first asks the brain for a **picture** of the page (`capture`), shows that picture in the page's place (blurred), and only then hides the live page. Closing the panel brings the live page back. Toasts are different: the brain draws them in a tiny see-through view placed above everything.

## Folder map

```
vaia/
├── src/
│   ├── shared/                 ← code and types used by BOTH the brain and the UI
│   │   ├── types.ts            ← the shape of all data (tabs, spaces, settings, boosts…)
│   │   ├── api.ts              ← every action the UI can request + the window.vaia contract
│   │   ├── tree.ts             ← finding tabs inside folders / split views
│   │   ├── url.ts              ← typed text → URL or search; search engines
│   │   └── themes.ts           ← Space color presets and emoji
│   ├── main/                   ← the brain
│   │   ├── index.ts            ← start-up; connects the UI's requests to the brain
│   │   ├── browser.ts          ← windows, web page views, and all actions
│   │   ├── organize.ts         ← drag & drop, pinning, folders, split views
│   │   ├── store.ts            ← saving/loading your data (vaia-state.json)
│   │   ├── history.ts          ← browsing history (history.json)
│   │   ├── archive.ts          ← archived & recently closed tabs (archive.json)
│   │   ├── boosts.ts           ← turning a Boost into CSS; the "zap" picker
│   │   ├── adblock.ts          ← the ad & tracker blocker
│   │   └── menu.ts             ← Mac menu bar, keyboard shortcuts, right-click menus
│   ├── preload/index.ts        ← the bridge: exposes window.vaia
│   └── renderer/               ← the UI (React)
│       ├── index.html
│       └── src/
│           ├── main.tsx        ← picks which screen to show: main window, Little window or Settings
│           ├── App.tsx         ← the main window: sidebar, pages, and floating panels
│           ├── LittleApp.tsx   ← the Little window
│           ├── SettingsApp.tsx ← the Settings window
│           ├── state.ts        ← keeps the UI's copy of the data up to date
│           ├── commands.ts     ← Command Bar commands
│           ├── menus.ts        ← what's in each right-click menu
│           ├── dnd.tsx         ← drag and drop in the sidebar
│           ├── theme.ts        ← Space colors → CSS colors; color math
│           ├── styles.css      ← all the visual styling
│           └── components/
│               ├── Sidebar.tsx, UrlBar.tsx, TabRow.tsx, PinnedList.tsx, Favorites.tsx, SpaceBar.tsx
│               ├── Content.tsx       ← the page card(s), split dividers, drop zones
│               ├── CommandBar.tsx    ← ⌘T
│               ├── SpaceEditor.tsx, ColorWheel.tsx, Backdrop.tsx
│               ├── ArchivePanel.tsx, HistoryPanel.tsx, DownloadsPanel.tsx
│               ├── PeekLayer.tsx, FindBar.tsx, BoostPanel.tsx
│               └── Icons.tsx, Favicon.tsx
├── electron.vite.config.ts     ← build settings (Vite, the fast build tool)
├── electron-builder.yml        ← packaging settings for the Mac .app/.dmg
├── tsconfig*.json              ← TypeScript settings
├── package.json                ← project name, scripts, and list of tools used
├── node_modules/               ← downloaded tools (not uploaded to GitHub)
└── out/, dist/                 ← build output (not uploaded to GitHub)
```

## Where your data lives

Everything is stored on your Mac in `~/Library/Application Support/VAIA/`:
`vaia-state.json` (spaces, tabs, settings, boosts), `history.json`, `archive.json`, `downloads.json`, `adblock-engine.bin` (cached filter lists), plus each profile's cookies and site data. There are no accounts and no servers.

## Words you'll see

- **npm**: Node's package manager. It downloads tools and runs our scripts (`npm run dev`).
- **git / commit**: a commit is a saved snapshot of the code with a message.
- **push**: upload commits to GitHub.
- **tag**: a named bookmark on a commit, like `v0.1.0` for Phase 1.
- **IPC**: "inter-process communication", meaning messages sent between main and renderer.
- **Partition / profile**: a separate cookie jar. Spaces with "Separate profile" each get their own.
- **Boost**: your customizations for one website, applied every time a page from that site loads.
