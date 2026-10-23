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

## Folder map

```
vaia/
├── src/
│   ├── main/index.ts          ← the brain: creates the window
│   ├── preload/index.ts       ← the bridge: exposes window.vaia
│   ├── preload/api.d.ts       ← the "contract": what window.vaia contains
│   └── renderer/              ← the UI
│       ├── index.html
│       └── src/
│           ├── main.tsx       ← starts React
│           ├── App.tsx        ← the top-level screen
│           └── styles.css     ← colors, fonts, layout
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
