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
│   │   ├── tidy.ts             ← Tidy: group Today tabs, close duplicates
│   │   ├── ai.ts               ← AI Tidy (Claude) and the encrypted API key
│   │   ├── permissions.ts      ← camera/location/... prompts and remembered answers
│   │   ├── extensions.ts       ← Chrome extensions and the Chrome Web Store
│   │   ├── bookmarks.ts        ← importing bookmarks from Chrome, Safari or a file
│   │   ├── errorPage.ts        ← the friendly "can't load this page" page
│   │   ├── passwords.ts        ← the encrypted password manager
│   │   ├── store.ts            ← saving/loading your data (vaia-state.json)
│   │   ├── history.ts          ← browsing history (history.json)
│   │   ├── archive.ts          ← archived & recently closed tabs (archive.json)
│   │   ├── boosts.ts           ← turning a Boost into CSS; the "zap" picker
│   │   ├── adblock.ts          ← the ad & tracker blocker
│   │   └── menu.ts             ← Mac menu bar, keyboard shortcuts, right-click menus
│   ├── preload/index.ts        ← the bridge: exposes window.vaia
│   ├── preload/passwords.ts    ← runs in web pages: spots logins, fills saved ones
│   └── renderer/               ← the UI (React)
│       ├── index.html
│       └── src/
│           ├── main.tsx        ← picks which screen to show: main window, Little window or Settings
│           ├── App.tsx         ← the main window: sidebar, pages, and floating panels
│           ├── LittleApp.tsx   ← the Little window
│           ├── SettingsApp.tsx ← the Settings window
│           ├── TodoApp.tsx     ← the pop-out to-do window
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
│               ├── TodoList.tsx, TodoPanel.tsx, TodoSection.tsx  ← the to-do list's pieces
│               └── Icons.tsx, Favicon.tsx
├── build/icon.svg, icon.png    ← the app icon (the SVG is the source, the PNG is what gets packaged)
├── screenshots/                ← pictures used in the README
├── electron.vite.config.ts     ← build settings (Vite, the fast build tool)
├── electron-builder.yml        ← packaging settings for the Mac .app/.dmg
├── tsconfig*.json              ← TypeScript settings
├── package.json                ← project name, scripts, and list of tools used
├── node_modules/               ← downloaded tools (not uploaded to GitHub)
└── out/, dist/                 ← build output (not uploaded to GitHub)
```

## Tidy and the to-do list

- **Tidy** lives in `src/main/tidy.ts`. Before changing anything, the brain saves a copy of the Today list; the toast's **Undo** button simply puts that copy back.
- **AI Tidy** (`src/main/ai.ts`) sends Claude a numbered list like `3. Flights to Lisbon — google.com` and asks for an answer in a fixed JSON shape: which numbers go in which folder, and shorter names. VAIA then rebuilds Today from that answer. Your API key is encrypted by macOS (the Keychain) before it's written to disk, and only the brain can read it; the interface only ever learns "a key is saved".
- **To-dos** are one list in `vaia-state.json`. The panel, the sidebar section and the pop-out window are three views of that same list, so checking something off in one updates the others instantly.

## Permissions, extensions, private windows

- **Permissions** (`src/main/permissions.ts`): every cookie jar has a "permission handler". When a page asks for something (say, the camera), Electron asks the handler; VAIA shows an Allow / Block sheet, remembers the answer in `permissions.json` if you tick the box, and blocks anything it doesn't recognise.
- **Extensions** (`src/main/extensions.ts`): two open-source libraries do the heavy lifting. One adds the `chrome.*` APIs extensions expect (tabs, popups, storage, …) and the other makes the Chrome Web Store's "Add to Chrome" button work. Installed extensions live in `Extensions/` in VAIA's data folder. The buttons in the sidebar are a ready-made `<browser-action-list>` element that the library provides.
- **Private windows** use a cookie jar whose name doesn't start with `persist:`, which tells Electron to keep it in memory only. VAIA also wipes it when the window closes, and never records history for it.
- **Error pages** (`src/main/errorPage.ts`): when a page can't load, Chromium shows a blank page; VAIA writes its own friendly page into it. Its buttons are special `vaia-page:` links that the brain catches.
- **Bookmarks** (`src/main/bookmarks.ts`): Chrome's bookmarks are a JSON file, Safari's are an Apple "property list", and exported files are HTML. All three are turned into the same simple tree of folders and links first.

## Passwords

- `src/preload/passwords.ts` runs inside every web page (except in private windows), in a separate "isolated world" the page's own code can't see. It notices when you submit a login form and tells the brain; when you click into a login field it asks the brain for a saved login for exactly that site.
- The brain (`src/main/passwords.ts`) double-checks every request (is it the page's main frame? is the page really on that site?), asks you before saving, and keeps everything in `passwords.bin`, encrypted by macOS's Keychain. Showing a password in Settings needs Touch ID first.

## How the Mac app is made

`npm run build:mac` does three things:

1. **Builds** the code (TypeScript → plain JavaScript in `out/`).
2. **Packages** it with **electron-builder**: it copies a ready-made Electron program, renames it VAIA, puts our code and the icon inside, and creates `VAIA.app`.
3. **Wraps** the app in a `.dmg` (a Mac disk image, the "drag to Applications" window). There's one for Apple Silicon Macs and one for Intel Macs.

The app gets an **ad-hoc signature**: a free self-signature that proves the files haven't been changed since packaging. Apple Silicon Macs won't run apps without one. It isn't an official Apple **Developer ID** signature, so macOS asks you to "Open Anyway" the first time. Removing that step means **signing** with a Developer ID and **notarizing** (sending the app to Apple to scan), which needs the $99/year Apple Developer Program.

## Where your data lives

Everything is stored on your Mac in `~/Library/Application Support/VAIA/`:
`vaia-state.json` (spaces, tabs, settings, boosts, to-dos), `history.json`, `archive.json`, `downloads.json`, `permissions.json` (site permissions), `claude-key.bin` (your Claude API key, encrypted), `passwords.bin` (saved passwords, encrypted), `Extensions/` (installed extensions), `adblock-engine.bin` (cached filter lists), plus each profile's cookies and site data. There are no accounts and no servers.

## Words you'll see

- **npm**: Node's package manager. It downloads tools and runs our scripts (`npm run dev`).
- **git / commit**: a commit is a saved snapshot of the code with a message.
- **push**: upload commits to GitHub.
- **tag**: a named bookmark on a commit, like `v0.1.0` for Phase 1.
- **IPC**: "inter-process communication", meaning messages sent between main and renderer.
- **Partition / profile**: a separate cookie jar. Spaces with "Separate profile" each get their own.
- **.dmg**: a Mac disk image, the usual way Mac apps are downloaded.
- **Release**: a download page on GitHub tied to a tag (like `v1.0.0`), with the `.dmg` files attached.
- **Code signing / notarization**: Apple's way of proving who made an app and that it was scanned for malware.
- **Boost**: your customizations for one website, applied every time a page from that site loads.
