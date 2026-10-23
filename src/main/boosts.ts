// Boosts: per-website customizations (colors, font, zapped elements, custom CSS/JS).
import type { Boost } from '../shared/types'

export const EMPTY_BOOST: Boost = { enabled: true, zaps: [], css: '', js: '' }

/** Turn a Boost into a style sheet that's added to every page of that site. */
export function boostCss(boost: Boost): string {
  const rules: string[] = []
  if (boost.bgColor) {
    rules.push(
      `html, body, main, article, section, header, footer, nav, aside { background-color: ${boost.bgColor} !important; }`
    )
  }
  if (boost.textColor) {
    rules.push(
      `body, p, li, dt, dd, td, th, span, div, h1, h2, h3, h4, h5, h6, blockquote, label { color: ${boost.textColor} !important; }`
    )
  }
  if (boost.linkColor) rules.push(`a, a * { color: ${boost.linkColor} !important; }`)
  if (boost.font) {
    // Leave code and icon fonts alone so they don't turn into gibberish.
    rules.push(
      `body, body *:not(code):not(pre):not(kbd):not(samp):not(i):not([class*="icon"]):not([class*="Icon"]) { font-family: ${boost.font} !important; }`
    )
  }
  for (const selector of boost.zaps) rules.push(`${selector} { display: none !important; }`)
  if (boost.css.trim()) rules.push(boost.css)
  return rules.join('\n')
}

/**
 * Runs inside the web page: highlights whatever is under the mouse; a click
 * returns a CSS selector for that element, Esc returns null.
 */
export const ZAP_SCRIPT = `new Promise((resolve) => {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #ff5a4e;' +
    'background:rgba(255,90,78,.15);border-radius:4px;transition:all 60ms ease;display:none';
  const tip = document.createElement('div');
  tip.textContent = 'Click to zap · Esc to stop';
  tip.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:12px;transform:translateX(-50%);' +
    'padding:6px 12px;border-radius:999px;background:rgba(30,30,32,.9);color:#fff;' +
    'font:500 12px -apple-system,system-ui,sans-serif;pointer-events:none';
  document.documentElement.append(box, tip);
  let target = null;
  const describe = (el) => {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      let part = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(part + '#' + CSS.escape(el.id)); break; }
      const classes = [...el.classList].filter((c) => !/^(is-|has-)?(hover|active|focus|open|selected)/.test(c)).slice(0, 2);
      if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.');
      const parent = el.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === el.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(' > ');
  };
  const move = (e) => {
    target = e.target;
    if (!target || target === document.documentElement || target === document.body) { box.style.display = 'none'; return; }
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  const stop = (result) => {
    removeEventListener('mousemove', move, true);
    removeEventListener('click', click, true);
    removeEventListener('mousedown', block, true);
    removeEventListener('keydown', key, true);
    box.remove(); tip.remove();
    resolve(result);
  };
  const block = (e) => { e.preventDefault(); e.stopPropagation(); };
  const click = (e) => { block(e); stop(target ? describe(target) || null : null); };
  const key = (e) => { if (e.key === 'Escape') { block(e); stop(null); } };
  addEventListener('mousemove', move, true);
  addEventListener('mousedown', block, true);
  addEventListener('click', click, true);
  addEventListener('keydown', key, true);
  window.__vaiaStopZap = () => stop(null);
})`
