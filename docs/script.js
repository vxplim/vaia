// VAIA website: download links, feature tour tabs, gentle scroll reveals.
document.documentElement.classList.add('js');

// Point the download buttons straight at the newest .dmg files.
// If GitHub can't be reached, the buttons keep linking to the releases page.
(async () => {
  try {
    const res = await fetch('https://api.github.com/repos/vxplim/vaia/releases/latest');
    if (!res.ok) return;
    const release = await res.json();
    const dmg = (arch) => release.assets.find((a) => a.name.endsWith(`${arch}.dmg`));
    const arm = dmg('arm64');
    const intel = dmg('x64');
    if (arm) document.getElementById('dl-arm').href = arm.browser_download_url;
    if (intel) document.getElementById('dl-intel').href = intel.browser_download_url;
    if (release.tag_name) document.getElementById('dl-version').textContent = `Version ${release.tag_name.replace(/^v/, '')}`;
  } catch {
    // Offline or rate-limited: the fallback links still work.
  }
})();

// Feature tour: accessible tabs (click, or arrow keys).
const tabs = [...document.querySelectorAll('.tour-tabs [role="tab"]')];
function select(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });
}

// The idea form isn't connected until there's a Tally link.
const tally = document.getElementById('tally');
if (tally?.hasAttribute('data-tally-placeholder')) {
  tally.addEventListener('click', (e) => {
    e.preventDefault();
    tally.textContent = 'Form coming soon ✿';
  });
}

// Fade sections in as they scroll into view.
const revealables = document.querySelectorAll('.section h2, .group, .section .window, .steps li, details, .ideas, .keys');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  for (const el of revealables) {
    el.classList.add('reveal');
    io.observe(el);
  }
}
