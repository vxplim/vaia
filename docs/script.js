// VAIA website: download links, feature tour tabs, idea form, gentle scroll reveals.
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
    if (arm) {
      document.getElementById('dl-arm').href = arm.browser_download_url;
      document.getElementById('dl-nav').href = arm.browser_download_url;
    }
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

// Idea form: sent by email through FormSubmit (no account or server needed).
// The address is put together here so it isn't sitting in the page for spam bots.
const inbox = ['itsvanessa.lim', 'gmail.com'].join('@');
const form = document.getElementById('idea-form');
const status = document.getElementById('form-status');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const message = String(data.get('message') || '').trim();
  if (!message) {
    status.textContent = 'Write a few words first ✿';
    form.message.focus();
    return;
  }
  if (data.get('_honey')) return;
  const kind = data.get('kind');
  const email = String(data.get('email') || '').trim();
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${inbox}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: `VAIA: new ${String(kind).toLowerCase()}`,
        _template: 'table',
        _captcha: 'false',
        type: kind,
        message,
        ...(email ? { email, _replyto: email } : {}),
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || String(result.success) === 'false') throw new Error(result.message || 'failed');
    form.reset();
    status.textContent = 'Thank you! Your message is on its way 💌';
  } catch {
    const body = encodeURIComponent(`${kind}:\n\n${message}`);
    status.innerHTML = `Hmm, that didn't send. <a href="mailto:${inbox}?subject=VAIA%20${encodeURIComponent(kind)}&body=${body}">Email it instead</a>.`;
  } finally {
    button.disabled = false;
  }
});

// Fade sections in as they scroll into view.
const revealables = document.querySelectorAll('.section h2, .card, .section .window, .steps li, details, .ideas');
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
