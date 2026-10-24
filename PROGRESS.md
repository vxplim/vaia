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

- [x] **Phase 8: Sidebar and polish** (tag `v0.8.0`)
  - ⌘S (or the sidebar button at the top-left) hides the sidebar; the page then fills the window and the window buttons hide too. Hover the far-left edge to slide the sidebar out over the page; it tucks away when you move off it or pick a tab. ⌘L with the sidebar hidden slides it out to type an address
  - Toasts ("Copied URL", "Downloading …") now float above web pages
  - Right-click a tab: Pin/Unpin, Add to Favorites, Open in Split View, **Duplicate**, Copy Link, **Move to Space ▸**, Close
  - **Settings window** (⌘, or VAIA menu → Settings…): search engine (Google / DuckDuckGo / Bing / Ecosia), archive timing, Peek on/off, ad blocker, default browser, each Space's theme (Edit… opens the theme editor), clear browsing data (history / cache / cookies / archive, across all profiles), keyboard shortcuts list
  - **Downloads**: files save to your Downloads folder; the ↓ button at the bottom of the sidebar (or ⇧⌘J) opens a popover with progress, open, show in Finder, cancel, clear. A progress line shows on the button while downloading
  - **History** page (⌘Y, History menu, or Command Bar): grouped by day, searchable, click to open, remove entries, clear all
  - **Find in page** (⌘F): match count, Enter / ⌘G next, ⇧Enter / ⇧⌘G previous, Esc closes
  - **Ad blocker** (Settings or Command Bar "Toggle Ad Blocker"): Ghostery's open-source engine with the EasyList ad + tracker lists, for every profile. Tested: an ad script is blocked when on and loads when off
  - Animations: tabs fold away when closed with ×, the sidebar slides in, plus the existing Command Bar / Space / panel animations

- [x] **Phase 9: Boosts** (tag `v0.9.0`)
  - Per-website customization, saved per site and switchable on/off
  - Open it with the ⚡︎ button on the address pill (it shows an orange dot when the site is Boosted), View menu → "Boost This Site…", or Command Bar "Boost This Site". The editor opens in the sidebar so you see changes live
  - Colors: background, text and link color (× returns to the site's own color)
  - Font: system, serif, rounded, monospace, Helvetica, Avenir
  - **Zap**: click "Zap elements", then click things on the page to hide them (Esc to stop); each zapped item is listed and can be restored
  - Custom CSS (applied as you type) and custom JavaScript (runs each time a page on that site loads; "Run now" to try it)
  - Command Bar "Zap Elements on This Page" jumps straight into zapping

- [x] **Phase 10: Ship it** (tag `v1.0.0`)
  - Original app icon: two cream leaves forming a "V" on a sage-green rounded square (`build/icon.svg`, rendered to `build/icon.png`; electron-builder turns it into the Mac `.icns`). Also shown in the Dock during `npm run dev`
  - Name "VAIA" everywhere, version 1.0.0, About VAIA panel
  - `npm run build:mac` builds `dist/VAIA-1.0.0-arm64.dmg` (Apple Silicon) and `dist/VAIA-1.0.0-x64.dmg` (Intel)
  - The packaged app was launched and tested (runs as VAIA 1.0.0, no errors)
  - README with download/install steps ("Open Anyway") and screenshots in `/screenshots`
  - GitHub Release v1.0.0 with both `.dmg` files and release notes; repo description and topics set

- [x] **Phase 11: Tidy + To-do** (tag `v1.1.0`)
  - **Tidy** (broom button next to "Clear", Command Bar "Tidy Today Tabs", or View menu): groups Today tabs from the same website into a folder named after the site (only with 2+ tabs), closes exact duplicate addresses, and keeps everything else in order. A toast with **Undo** stays for 6 seconds and puts Today back exactly as it was
  - **AI Tidy** (off by default): Settings → "Use AI to Tidy" + your Claude API key. Sends only tab titles and website names to Claude (model `claude-opus-5-5`), which returns topic folders and shorter tab names. No key, no internet, or any error → Simple Tidy, with a toast saying why
  - The API key is encrypted with your Mac's Keychain (Electron safeStorage) in `claude-key.bin` in VAIA's data folder. Never in the JSON file, never in the code
  - **To-do list**, one shared list with three views that stay in sync:
    - Slide-out panel: the ✓ button at the bottom of the sidebar, or **⇧⌘K**. "This Space" (this Space's + Everywhere to-dos) and "All" (every to-do, marked with its Space emoji)
    - Sidebar section under Pinned: this Space's unfinished to-dos (Settings → "Show to-dos in the sidebar"; collapsible)
    - Pop-out window (the ↗ button in the panel) with an "Always on top" pin
  - Each to-do: text, done, due date, linked page, and a Space or "Everywhere". Right-click a to-do to edit, set a due date, move it to another Space, link/unlink the current page, or delete it. Double-click to edit the text
  - Command Bar: type `todo buy milk` and press Enter. The second row adds it with the current page linked. Clicking a linked to-do opens that page (switching to it if it's already open)
  - Due dates show "Today" / "Overdue" / "Tomorrow" / a date. The ✓ button shows how many are due today or overdue
  - Checked items fade into a collapsed "Done" section and are deleted 7 days later. Drag to reorder

- [x] **Phase 12: Everyday browser essentials** (tag `v1.2.0`)
  - **Site permissions**: sites no longer get anything automatically. Camera, microphone, location, notifications, clipboard reading, MIDI, idle detection, window management and opening other apps show a small Allow / Block sheet with "Remember for this site". Anything else is blocked. Settings → Site permissions lists remembered sites (change to Allow / Block / Ask, reset a site, or reset all). macOS's own camera/microphone/location explanations are in the app's Info.plist
  - **Chrome extensions**: install from the Chrome Web Store ("Add to Chrome" works, with a VAIA confirmation). Extension buttons appear at the top of the sidebar, popups open below them, and the puzzle button turns extensions on/off, removes them, or opens the store. Also in Settings → Extensions. Tested with Dark Reader (installs, darkens pages, popup opens, on/off works), both in development and in the packaged app
  - **PDFs** open in Chromium's built-in viewer instead of downloading
  - **Print** with ⌘P (File menu, right-click menu, or Command Bar). The Mac print dialog can also save as PDF
  - **Private window** (⇧⌘N): a dark purple window with a "Private" badge. No history, nothing saved, links stay inside it, its own temporary cookie jar wiped when it closes (checked: your normal profile never sees its cookies)
  - **Full-screen video** fills the whole screen: VAIA makes the window full screen and the page covers the sidebar and margins, then puts everything back
  - **Friendly error pages**: "can't find this site", "you're offline", "refused to connect", "took too long", "blocked", with Try again / Go back. **Certificate problems are blocked** with a warning and only "Go back" (or "Close tab"). **Crashed pages** show a card with Reload
  - **Spelling**: right-click a misspelled word for suggestions and "Add to Dictionary"
  - **Import bookmarks** (Settings → Import bookmarks): from Chrome, Safari, or an exported .html file, into a pinned folder (keeping folders) or into Favorites (bookmarks bar links, up to 24)
  - **Picture in picture** already worked; added "Picture in Picture" to the right-click menu on videos

### Which extensions work

- ✅ **Work well:** extensions that change how pages look or add buttons/popups. Tested: Dark Reader. Expected to work: uBlock Origin Lite, Bitwarden (in-popup use), Grammarly-style page helpers, JSON viewers, Return YouTube Dislike, Tampermonkey-style script managers (mostly), translators.
- ⚠️ **Partly work:** extensions using right-click menu items (contextMenus.update isn't supported), keyboard shortcuts (`chrome.commands` isn't supported), or many tab features (no tab groups, discarding).
- ❌ **Don't work:** extensions that talk to an app on your Mac ("native messaging", e.g. 1Password's desktop integration), DevTools panels, extensions that replace the new tab page, Chrome sign-in/sync features, and extensions needing `chrome.webRequest` while VAIA's own ad blocker is on (they conflict: turn VAIA's blocker off if you use one).
- Extensions only run in your normal profile, not in Spaces with a separate profile or private windows (Electron doesn't support extensions in temporary sessions).

- [x] **Phase 13: Look & feel** (tag `v1.3.0`)
  - VAIA's own interface is clean black and white: white surfaces, black text and icons, dark-gray secondary text, thin light-gray borders and soft shadows. The Command Bar, panels, popovers, Settings and buttons all use the same shared colors (`--ui-*` in styles.css). Dark mode is the inverse (near-black, white text)
  - Spaces keep a pastel color on top: 12 new presets (Lilac, Peach, Mint, Sky, Butter, Rose, Fog, Sage, Coral, Seafoam, and two gentle gradients, Haze and Sunrise) plus the color wheel
  - Theme editor: **Intensity** (Whisper → Soft), **Tone** (Warmer ↔ Cooler, double-click to reset), **Gradient** on/off, Light / Auto / Dark, and a live mini-preview. Old Spaces keep working (missing settings use defaults)
  - **Settings → Appearance**: pick a Space, same controls, live preview
  - Hidden sidebar slide-out: rest ~150ms at the left edge, the page is frozen into a picture first, *then* the sidebar slides in (ease-out) with a soft shadow. It stays open through brief slips (~0.3s grace, ~0.6s if the pointer leaves the window), slides away smoothly, and brushing past the edge doesn't open it

## Next ideas (not started)

- Signing + notarization with an Apple Developer ID ($99/year) so there's no "Open Anyway" step
- Auto-updates (electron-updater reading GitHub Releases; needs signing first)

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
- **⌘S now toggles the sidebar** (as requested), so "Save Page" isn't available.
- **Toasts are drawn by the brain** in a tiny see-through view placed on top of everything, because nothing in the normal interface can float above a live web page.
- **Downloads go straight to ~/Downloads** without asking; a name clash gets " (1)", " (2)", …
- **The filter lists for the ad blocker are downloaded the first time you turn it on** (needs internet once) and cached in VAIA's data folder.
- **Boost styles use normal (author) style sheets with `!important`**. Electron's stronger "user" style sheets can't be removed again, which would make turning a Boost off impossible.
- **Boost JavaScript only runs when a page loads** (or with "Run now"), so editing it doesn't run half-typed code.
- **The app is "ad-hoc" signed** (a free self-signature). Without any signature Apple Silicon Macs report the app as "damaged"; with it, macOS only asks you to "Open Anyway" once. Apple's "hardened runtime" is off because it only matters for notarization.
- **Both Apple Silicon and Intel installers are built** as separate `.dmg` files (smaller than one combined "universal" app).
- **Tidy folders are named after the website** (e.g. `github.com`), and running Tidy again adds new tabs from that site to the same folder. Folders can now live in Today too (drag them around like pinned folders); a Today folder disappears when its last tab is closed or archived.
- **Duplicates are exact address matches.** The tab on screen is always the one kept. Closed duplicates don't go to the Archive (an identical tab is still open), but Undo brings them back.
- **AI Tidy only uses Claude's answer if your tabs didn't change while it was thinking**; otherwise it falls back to Simple Tidy. It regroups all of Today (including old Tidy folders), so Undo is the safety net. Shorter names are kept until that tab goes to a different website.
- **AI Tidy uses the Anthropic SDK** with structured JSON output (so the answer always has the right shape), low effort (it's a simple sorting job), and the API's automatic fallback model if Claude declines a request.
- **The to-do sidebar section shows Everywhere to-dos too** (same as the panel's "This Space"), and hides itself when there's nothing to do.
- **New to-dos go to the top of the list.** The ✓ badge counts due-today/overdue to-dos from every Space, so nothing slips through.
- **Deleting a Space keeps its to-dos** by turning them into Everywhere to-dos.
- **The to-do panel freezes the page into a picture** while it's open (like the other panels). For a list that stays visible while you browse, use the pop-out window.
- **Permission prompts are native Mac sheets** (they appear over web pages and need no extra code). Without "Remember for this site", the answer lasts until VAIA quits. Private windows never remember answers.
- **Always allowed without asking**, as in Chrome: full screen, pointer lock, writing to the clipboard, DRM video (Netflix etc.), storage access for embedded logins.
- **Screen sharing (`getDisplayMedia`) isn't supported yet**, so sites asking for it are blocked (simpler version chosen).
- **Extensions use the free GPL-3.0 licence option** of electron-chrome-extensions (see "Needs Vanessa").
- **Extensions only in the normal profile**, so the Chrome Web Store support is set up once, for your main cookie jar.
- **A private window is one page with its own address bar** (like a Little window), not a full sidebar window, the simplest version that's truly private. Each private window has its own temporary cookie jar.
- **Error pages are written into Chromium's blank error page**, so the tab keeps the address it tried to open (Try again works, and the address bar shows what failed).
- **Safari keeps its bookmarks file private** (macOS Full Disk Access). Instead of asking for that, VAIA explains how to export from Safari and import the file.
- **Imported bookmarks become sleeping pinned tabs**: nothing loads until you click one.
- **The window is opaque white/near-black tinted by the Space's pastel** (no more see-through frosted glass), for the clean black-and-white look. Intensity mixes the pastel into white: Whisper ≈ 12%, Soft = the full pastel. In dark mode the pastel is a subtle tint on near-black.
- **Tone shifts the colors toward a warm peach or a cool blue** (up to 40%), rather than rotating the hue, so pastels stay pastel.
- **A Space set to Dark looks dark even if the Mac is in light mode** (and vice versa); the Settings window follows the Mac's setting.
- **Black is the accent color** (switches, selected buttons, checked to-dos); red stays for overdue/danger and the Private window stays purple.
- **The slide-out sidebar waits for the page picture before sliding in.** Before, it animated *behind* the live page and then popped into view (the flicker).
- **Keyboard shortcuts live in the Mac menu bar**, because menu shortcuts work even while a web page has keyboard focus.

## Known limitations (simpler versions chosen)

- The tab-close animation plays when you click × (⌘W closes instantly).
- The ⇧⌘T "recently closed" list holds Today tabs; closing a pinned tab only puts it to sleep, so there's nothing to reopen.
- Back/forward history of each tab isn't restored after quitting VAIA (the page itself is).
- Favorites always use the default profile, even when viewed from a Space with a separate profile.
- Peek decides "another site" by comparing the last two parts of the domain (e.g. `news.example.com` and `example.com` count as the same site); unusual domains like `example.co.uk` may be treated as the same site as other `.co.uk` sites.

## Needs Vanessa

- **Licence decision (important before sharing VAIA):** the Chrome-extension library (electron-chrome-extensions) is GPL-3.0 unless you buy its "Patron" licence. VAIA's own code is MIT, but the *app you'd distribute* now includes GPL code, so anyone you give it to must be able to get VAIA's source under GPL terms. Options: (a) change VAIA's LICENSE to GPL-3.0 and make the repo public (simplest, free), (b) sponsor the author on GitHub for the Patron licence, or (c) remove extension support. Nothing has been published since this was added, so there's no rush, but decide before the next release.
- **Camera, microphone and location:** test them on a real site (e.g. a video call on meet.google.com, or "my location" on a map). macOS will ask once whether VAIA may use the camera/microphone/location; click Allow. (The automated tests skipped these so no real macOS prompts popped up on your Mac.)
- **Safari bookmarks:** in Safari choose File → Export → Bookmarks…, then VAIA → Settings → Import bookmarks → From a File….

- **Try AI Tidy with your own key:** create a key at console.anthropic.com (API Keys), then VAIA → Settings → paste it into "Claude API key" → Save, and switch on "Use AI to Tidy". It was tested with a fake key (it correctly fell back to Simple Tidy); a real key needs your account. Each Tidy is one small request (a few cents at most).
- **Keychain prompt:** the first time the installed VAIA reads your saved key (or after an update), macOS may ask "VAIA wants to use … VAIA Safe Storage". Click **Always Allow** (it may ask for your Mac password). This happens because VAIA isn't signed with a paid Developer ID.

- **Default browser (after Phase 10 install):** open the installed VAIA, choose VAIA menu → "Make VAIA Your Default Browser", and click "Use VAIA" in the macOS prompt. This can't be done or tested from the development version.
