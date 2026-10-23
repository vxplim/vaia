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

- [x] **Phase 4: Spaces** (tag `v0.4.0`)
  - Spaces = separate sets of pinned + Today tabs, each with a name, an emoji and a color theme that tints the sidebar and window
  - Switch with the icons at the bottom of the sidebar, a two-finger sideways swipe on the sidebar, or ⌃1…⌃9
  - Theme editor (click "…" next to the Space name, double-click a Space icon, or Command Bar "Edit Space Theme…"): name, emoji, 10 presets, 1–3 color gradient with a color wheel + brightness, Light / Auto / Dark
  - Optional **separate profile** per Space: its own cookies and logins (tested: a cookie set in one Space is invisible in another)
  - New Space: "+" in the Space bar, Spaces menu, or Command Bar "New Space"
  - Drag a tab onto a Space icon to move it there (hover a moment to switch to that Space and drop it exactly where you want)
  - Command Bar: "Switch to Space: …", "Move Tab to Space: …"
  - Space switching animates: the tab list slides, the background cross-fades

- [x] **Phase 5: Auto-archive and Archive** (tag `v0.5.0`)
  - Today tabs you haven't looked at for 12 hours are archived automatically (checked at start-up and every minute). Change it to 24 hours / 7 days / 30 days / never at the top of the Archive (and later in Settings)
  - Closed Today tabs and "Clear" also go to the Archive, so nothing is lost
  - Archive view (archive icon at the bottom-left of the sidebar, History menu → Archive…, or Command Bar "Open Archive"): grouped by day, searchable, click to reopen, × to remove, "Clear Archive"
  - ⇧⌘T reopens the most recently closed tab (in its original Space), repeatedly
  - Pinned tabs and favorites are never auto-archived; neither is anything on screen

- [x] **Phase 6: Split View** (tag `v0.6.0`)
  - Show 2–4 tabs side by side, each in its own rounded card
  - Create it by: dragging a tab from the sidebar onto the page (left or right half), right-click a tab → "Open in Split View", or ⌃⇧= (opens the Command Bar to pick a site or tab for the new pane)
  - Drag the thin dividers between panes to resize them (sizes are saved)
  - The pane you click is "focused" (ring around it): the address bar, ⌘R, ⌘W, etc. act on it
  - In the sidebar a split is one combined row with a segment per tab; × separates them back into normal tabs; right-click a segment for "Remove from Split View" / "Close Tab"
  - ⌘W closes just the focused pane; when one tab is left, the split turns back into a normal tab

- [x] **Phase 7: Peek and Little window** (tag `v0.7.0`)
  - **Peek**: in a pinned tab or favorite, clicking a link to a *different* website opens it in a floating card over the page. "Open as Tab" turns it into a real Today tab without reloading; × / Esc / clicking outside closes it
  - **Little window** (⌥⌘N, File menu, or Command Bar "New Little Window"): a small, minimal window with back/forward/reload, an address pill, and "Open in VAIA" to move the page into the main window as a tab (again without reloading)
  - ⌘W closes the Little window (or the Peek); ⌘L focuses the Little window's address pill
  - **Default browser**: VAIA menu → "Make VAIA Your Default Browser" (or Command Bar). Links clicked in other apps then open in a Little window. The app is set up to register for http/https links and .html files

## Next

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
- **"Clear" archives Today tabs** (it doesn't add them to the ⇧⌘T list, which is only for tabs you closed one by one).
- **"Not viewed" means not on screen**: the timer starts when you leave a tab, not when you opened it.
- **Deleting a folder keeps its tabs** (they move to where the folder was), so nothing is lost by accident.
- **Favorites always use the default profile** (they're shared by every Space).
- **Right-click menus are native Mac menus**, so they can appear over web pages.
- **Favorites stay put when switching Spaces** (they're shared), only the Space's own pinned/Today list slides.
- **Turning a separate profile off (or deleting a Space) erases that profile's cookies/logins**, so no stray logins are left behind.
- **No ⌃← / ⌃→ shortcuts for Spaces**: macOS already uses those to switch desktops. "Next/Previous Space" are in the Spaces menu instead.
- **Pinned tabs and favorites are copied (not moved) into a split**, so your pinned list never changes by accident.
- **Dragging a tab over the page freezes it into a picture** (like the Command Bar) so the page area can show the left/right drop zones.
- **Peek only triggers for links to other sites** (same-site links navigate the pinned tab as usual), and **never for sign-in pages** (accounts.*, login.*, /oauth, …) so logging in keeps working. It also ignores redirects that happen while a page is still loading.
- **"Make default browser" only works in the installed app**, not in `npm run dev` (in development it would register the bare Electron program as your browser). In dev it shows a toast explaining that.
- **Keyboard shortcuts live in the Mac menu bar**, because menu shortcuts work even while a web page has keyboard focus.

## Needs Vanessa

- **Default browser (after Phase 10 install):** open the installed VAIA, choose VAIA menu → "Make VAIA Your Default Browser", and click "Use VAIA" in the macOS prompt. This can't be done or tested from the development version.
