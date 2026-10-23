# VAIA Progress

## How to run the app

1. Open Claude Code (or Terminal) in the `~/Projects/vaia` folder.
2. Type `! npm run dev` in Claude Code (or `npm run dev` in Terminal) and press Enter.
3. The VAIA window opens. Quit it with **Cmd+Q**.

If you've just downloaded the code onto a new computer, run `npm install` once first.

Your browsing data (tabs, settings) is saved in `~/Library/Application Support/VAIA/`.

## Done

- [x] **Phase 0: Setup**: tools, GitHub, project skeleton (tag: none, first commit)
- [x] **Phase 1: A working browser window** (tag `v0.1.0`)
  - Vertical sidebar on the left; web pages float in a rounded card with a small margin
  - Back / forward / reload (turns into stop while loading) and a compact URL pill showing the domain
  - Click the URL pill (or ⌘L) to type a URL or search (Google by default)
  - Tabs listed vertically with favicon + title; click to switch, × on hover (or middle-click) to close
  - Shortcuts: ⌘T new tab, ⌘W close tab, ⌘L address bar, ⌘R reload, ⌘[ / ⌘] back/forward, ⌘+/⌘−/⌘0 page zoom
  - Tabs, their URLs and the selected tab are saved and restored on relaunch
  - Right-click on a page: open link in new tab, copy link, copy image, back/forward/reload, inspect

- [x] **Phase 2: Command Bar** (tag `v0.2.0`)
  - ⌘T (or "+ New Tab") opens a centered, frosted Command Bar over a blurred picture of the page
  - Results: open the typed address or search, matching open tabs ("Switch to Tab"), history, app commands, and live search suggestions
  - Commands so far: Copy URL, Toggle Sidebar, Reload, Go Back, Go Forward, Close Tab
  - ↑/↓ to move, Enter to choose, Esc (or click outside) to close; smooth open/close animation
  - Browsing history is now recorded (`history.json`)
  - ⇧⌘C copies the current URL with a "Copied URL" toast

- [x] **Phase 3: Favorites, Pinned and Today tabs** (tag `v0.3.0`)
  - Sidebar areas, top to bottom: **Favorites** (icon tiles, shared by all Spaces), **Pinned** (per Space, with folders), a divider with **Clear**, **+ New Tab**, then **Today** tabs
  - Drag and drop to reorder and to move tabs between all three areas; a line shows where it will land; drop onto the middle of a folder to put it inside
  - While dragging with no favorites yet, a "Drop here to add to Favorites" spot appears over the address bar
  - Pinned tabs and favorites remember their original page. If you browse away, the row shows "/ Page title" and a ↩ button (also in the right-click menu and Command Bar: "Return to Pinned Page")
  - Closing a pinned tab or favorite puts it to sleep (it stays in the sidebar); only Today tabs really close
  - Folders: create (right-click the pinned area, or Command Bar "New Folder"), rename (double-click), collapse/expand (click), delete (keeps the tabs), nest tabs inside
  - Right-click menus on tabs: Pin/Unpin, Add to/Remove from Favorites, Copy Link, Close/Put to Sleep, Delete
  - Command Bar commands: Pin Tab, Unpin Tab, Add to Favorites, Remove from Favorites, Return to Pinned Page, New Folder, Clear Today Tabs

## Next

- [ ] Phase 4: Spaces
- [ ] Phase 5: Auto-archive and Archive
- [ ] Phase 6: Split View
- [ ] Phase 7: Peek and Little window
- [ ] Phase 8: Sidebar and polish
- [ ] Phase 9: Boosts
- [ ] Phase 10: Ship it (icon, .dmg, GitHub Release), to do together

## Decisions made along the way

- **electron-vite** is used as the "Vite for Electron" build tool: one config builds the brain, the bridge and the UI.
- **Data is saved as a JSON file we write ourselves** (`vaia-state.json`) instead of electron-store. The newest electron-store only works in a newer module format that doesn't fit Electron's main process cleanly, and a ~40-line file saver is simpler. Saves are atomic (write to a temp file, then rename) so a crash can't corrupt your tabs.
- **The brain owns all data.** The UI asks for changes ("actions") and receives updates. This keeps every window in sync.
- **Tabs load lazily.** On relaunch only the tab you're looking at loads; the others load when you click them. This makes startup fast.
- **Web pages use their own storage area** (`persist:default`), separate from VAIA's own interface.
- **The user agent hides "Electron"** so websites treat VAIA like Chrome (some sites block unknown browsers).
- **Login popups** (like "Sign in with Google") open as real popup windows so they keep working; other links that open new windows become tabs.
- **Overlays use a page snapshot.** Web pages are always drawn on top of VAIA's interface, so nothing can float over a live page. When the Command Bar opens, VAIA takes a quick picture of the page, shows the picture (blurred) and hides the live page; closing the bar brings the live page back.
- **⌘T no longer creates an empty "New Tab".** A tab is created only when you pick something in the Command Bar, so no blank tabs pile up.
- **⌘L still edits the address in the sidebar** (the Phase 1 behaviour), while ⌘T is for new tabs.
- **A command ranks first** when its name starts with what you typed (e.g. "copy" → Copy URL); otherwise the address/search row is first.
- **"Clear" closes Today tabs for now**; in Phase 5 it will archive them instead so you can get them back.
- **Deleting a folder keeps its tabs** (they move to where the folder was), so nothing is lost by accident.
- **Favorites always use the default profile** (they're shared by every Space).
- **Right-click menus are native Mac menus**, so they can appear over web pages.
- **Keyboard shortcuts live in the Mac menu bar**, because menu shortcuts work even while a web page has keyboard focus.

## Needs Vanessa

_Nothing right now._
