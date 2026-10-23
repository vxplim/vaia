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

## Folder map

```
vaia/
├── src/
│   ├── shared/                ← code and types used by BOTH the brain and the UI
│   │   ├── types.ts           ← the shape of all data (tabs, spaces, settings…)
│   │   ├── api.ts             ← the list of actions the UI can request
│   │   ├── tree.ts            ← helpers to find tabs inside folders/splits
│   │   └── url.ts             ← turning typed text into a URL or a search
│   ├── main/                  ← the brain
│   │   ├── index.ts           ← app start-up, connects the UI's requests
│   │   ├── browser.ts         ← window, web page views, all tab actions
│   │   ├── store.ts           ← saving/loading your data to disk
│   │   └── menu.ts            ← Mac menu bar + keyboard shortcuts
│   ├── preload/index.ts       ← the bridge: exposes window.vaia
│   └── renderer/              ← the UI (React)
│       ├── index.html
│       └── src/
│           ├── main.tsx       ← starts React
│           ├── App.tsx        ← the top-level screen
│           ├── state.ts       ← keeps the UI's copy of the data up to date
│           ├── theme.ts       ← turns a Space's colors into CSS colors
│           ├── styles.css     ← all the visual styling
│           └── components/    ← Sidebar, UrlBar, TabRow, Content, icons…
├── electron.vite.config.ts    ← build settings (Vite, the fast build tool)
├── electron-builder.yml       ← packaging settings for the Mac .app/.dmg
├── tsconfig*.json             ← TypeScript settings
├── package.json               ← project name, scripts, and list of tools used
├── node_modules/              ← downloaded tools (not uploaded to GitHub)
└── out/, dist/                ← build output (not uploaded to GitHub)
```

## Words you'll see

- **npm**: Node's package manager. It downloads tools and runs our scripts (`npm run dev`).
- **git / commit**: a commit is a saved snapshot of the code with a message.
- **push**: upload commits to GitHub.
- **tag**: a named bookmark on a commit, like `v0.1.0` for Phase 1.
- **IPC**: "inter-process communication", meaning messages sent between main and renderer.
