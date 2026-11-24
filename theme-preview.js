/**
 * Theme Preview Toolbar Engine — Alcove Recording
 * Zero-dependency, accessible, client-side theme switcher with localStorage persistence.
 */
(function () {
  const PALETTES = {
    // Seth's suggested palettes (sampled from his swatches; backgrounds are derived tints/shades)
    'seth-olive-orange': {
      name: 'Olive & Orange (Light)',
      swatches: ['#FBF3E2', '#762E1A', '#575021', '#F58448', '#EDC070'],
      vars: {
        '--key-lift-pct': '55%',
        '--primary-lift': '22%',
        '--primary-shade': '12%',
        '--on-accent': '#FFFBF2',
        '--bg-page': '#FBF3E2',
        '--bg-surface': '#FFFBF2',
        '--bg-accent': '#F6E3BC',
        '--text-main': '#3B1A0F',
        '--text-muted': '#575021',
        '--accent-primary': '#762E1A',
        '--accent-secondary': '#F58448',
        '--accent-tertiary': '#575021',
        '--tint-1': '#EDC070',
        '--tint-2': '#F1A65A',
        '--border-color': '#E8CE98',
        '--border-focus': '#F58448',
        '--fader-mark': '#F58448'
      }
    },
    'seth-olive-orange-dark': {
      name: 'Olive & Orange (Dark)',
      swatches: ['#1F1A0C', '#F58448', '#EDC070', '#F1A65A', '#575021'],
      vars: {
        '--key-lift-pct': '10%',
        '--primary-lift': '0%',
        '--primary-shade': '0%',
        '--on-accent': '#1A100C',
        '--bg-page': '#1F1A0C',
        '--bg-surface': '#292212',
        '--bg-accent': '#342C17',
        '--text-main': '#FBF0D8',
        '--text-muted': '#D4BC86',
        '--accent-primary': '#F58448',
        '--accent-secondary': '#EDC070',
        '--accent-tertiary': '#B5B84F',
        '--tint-1': '#575021',
        '--tint-2': '#762E1A',
        '--border-color': '#4A4220',
        '--border-focus': '#EDC070',
        '--fader-mark': '#F58448'
      }
    },
    'seth-sage-coral': {
      name: 'Sage & Coral (Light)',
      swatches: ['#FFF5E0', '#723D45', '#472D2E', '#E16C5B', '#C8CAA3'],
      vars: {
        '--key-lift-pct': '55%',
        '--primary-lift': '22%',
        '--primary-shade': '12%',
        '--on-accent': '#FFFBF2',
        '--bg-page': '#FFF5E0',
        '--bg-surface': '#FFFBF3',
        '--bg-accent': '#EEEBCF',
        '--text-main': '#472D2E',
        '--text-muted': '#723D45',
        '--accent-primary': '#723D45',
        '--accent-secondary': '#E16C5B',
        '--accent-tertiary': '#6B6F43',
        '--tint-1': '#C8CAA3',
        '--tint-2': '#FEE0A6',
        '--border-color': '#D6D6B4',
        '--border-focus': '#E16C5B',
        '--fader-mark': '#E16C5B'
      }
    },
    'seth-sage-coral-dark': {
      name: 'Sage & Coral (Dark)',
      swatches: ['#2A1B1D', '#E16C5B', '#FEE0A6', '#C8CAA3', '#723D45'],
      vars: {
        '--key-lift-pct': '10%',
        '--primary-lift': '0%',
        '--primary-shade': '0%',
        '--on-accent': '#1A100C',
        '--bg-page': '#2A1B1D',
        '--bg-surface': '#352326',
        '--bg-accent': '#412B2F',
        '--text-main': '#FEEFD0',
        '--text-muted': '#C8CAA3',
        '--accent-primary': '#E16C5B',
        '--accent-secondary': '#FEE0A6',
        '--accent-tertiary': '#C8CAA3',
        '--tint-1': '#723D45',
        '--tint-2': '#A5A67F',
        '--border-color': '#5A3A40',
        '--border-focus': '#FEE0A6',
        '--fader-mark': '#E16C5B'
      }
    }
  };

  const FONTS = {
    'retro-display': {
      name: 'Retro Display (Shrikhand)',
      vars: {
        '--font-display': "'Shrikhand', 'Fraunces', Georgia, serif",
        '--font-heading': "'Fraunces', Georgia, serif",
        '--font-sans': "'Fraunces', Georgia, serif",
        '--font-mono': "'Fraunces', Georgia, serif"
      }
    },
    'warm-editorial': {
      name: 'Fraunces',
      vars: {
        '--font-display': "'Fraunces', Georgia, serif",
        '--font-heading': "'Fraunces', Georgia, serif",
        '--font-sans': "'Fraunces', Georgia, serif",
        '--font-mono': "'Fraunces', Georgia, serif"
      }
    }
  };

  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  // The toolbar has no public entry point: visitors never see it, and editors use the admin panel (admin.js).
  // It exists only as a developer tool (tests/texture-check.mjs) on a local host with `?devtoolbar`.
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const devToolbar = isLocalHost && !!(urlParams && urlParams.has('devtoolbar'));
  const isAdmin = devToolbar; // per-device toolbar choices (localStorage) apply only to the dev toolbar
  // Site Defaults saved in content.json (content-loader.js). Priority: URL param > admin localStorage > Site Default > built-in.
  const SITE_DEFAULTS = (window.__alcoveDefaults && typeof window.__alcoveDefaults === 'object') ? window.__alcoveDefaults : {};
  // An unlocked editor (token) uses the admin panel instead of the toolbar: per-device toolbar choices are ignored so the
  // panel's "current default" is exact; only the panel's own unsaved draft (below) layers over the saved defaults.
  const editorUnlocked = !!window.__alcoveAdmin;
  const DRAFT_KEY = 'alcove_admin_draft:defaults';
  let draftDefaults = {};
  if (editorUnlocked) {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (d && d.version === 1 && d.defaults && typeof d.defaults === 'object' && !Array.isArray(d.defaults)) draftDefaults = d.defaults;
    } catch (e) { /* no draft */ }
  }
  function readStored(key) {
    if (!isAdmin || editorUnlocked) return null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  const pick = (options, ...candidates) => candidates.find(v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(options, v));
  let activePalette = pick(PALETTES, urlParams && urlParams.get('theme'), readStored('alcove_theme_palette'), draftDefaults.palette, SITE_DEFAULTS.palette) || 'seth-olive-orange';
  let activeFont = pick(FONTS, urlParams && urlParams.get('font'), readStored('alcove_theme_font'), draftDefaults.font, SITE_DEFAULTS.font) || 'retro-display';

  const SURFACES = {
    metal: 'Brushed Metal',
    'metal-subtle': 'Metal (Subtle)'
  };
  let activeSurface = pick(SURFACES, urlParams && urlParams.get('surface'), readStored('alcove_theme_surface'), draftDefaults.surface, SITE_DEFAULTS.surface) || 'metal';


  const FILM_GRAINS = { off: 'Off', subtle: 'Subtle', medium: 'Medium', high: 'High' };
  let activeFilm = pick(FILM_GRAINS, urlParams && urlParams.get('film'), readStored('alcove_theme_film'), draftDefaults.filmGrain, SITE_DEFAULTS.filmGrain) || 'off';

  const CURSOR_SHADOWS = { off: 'Off', soft: 'Soft', strong: 'Strong' };
  let activeCursor = pick(CURSOR_SHADOWS, urlParams && urlParams.get('cursor'), readStored('alcove_theme_cursor'), draftDefaults.cursorShadow, SITE_DEFAULTS.cursorShadow) || 'off';

  function applyTheme() {
    const root = document.documentElement;
    root.dataset.surface = activeSurface;
    root.dataset.film = activeFilm;
    root.dataset.cursorShadow = activeCursor;
    root.dataset.scheme = activePalette.endsWith('-dark') ? 'dark' : 'light';
    const pVars = (PALETTES[activePalette] || PALETTES['seth-olive-orange']).vars;
    const fVars = (FONTS[activeFont] || FONTS['retro-display']).vars;

    Object.entries({ ...pVars, ...fVars }).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });

    document.querySelectorAll('[data-palette-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.paletteBtn === activePalette ? 'true' : 'false');
    });
    document.querySelectorAll('[data-font-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.fontBtn === activeFont ? 'true' : 'false');
    });
    document.querySelectorAll('[data-surface-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.surfaceBtn === activeSurface ? 'true' : 'false');
    });
    document.querySelectorAll('[data-film-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.filmBtn === activeFilm ? 'true' : 'false');
    });
    document.querySelectorAll('[data-cursor-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.cursorBtn === activeCursor ? 'true' : 'false');
    });
  }

  // Option definitions shared with the admin panel (admin.js), so they are never duplicated there.
  const BUILTIN = { palette: 'seth-olive-orange', font: 'retro-display', surface: 'metal', filmGrain: 'off', cursorShadow: 'off' };
  const OPTIONS = {
    palette: { label: 'Color palette', values: Object.fromEntries(Object.entries(PALETTES).map(([k, p]) => [k, p.name])) },
    font: { label: 'Typography', values: Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.name])) },
    surface: { label: 'Surface', values: SURFACES },
    filmGrain: { label: 'Film grain', values: FILM_GRAINS },
    cursorShadow: { label: 'Cursor shadow', values: CURSOR_SHADOWS }
  };
  window.AlcoveTheme = {
    options: OPTIONS,
    // Values every visitor gets today: the saved Site Defaults over the built-in look (no URL, no draft).
    saved: () => Object.fromEntries(Object.keys(OPTIONS).map(k => [k, pick(OPTIONS[k].values, SITE_DEFAULTS[k]) || BUILTIN[k]])),
    get: () => ({ palette: activePalette, font: activeFont, surface: activeSurface, filmGrain: activeFilm, cursorShadow: activeCursor }),
    // Live preview only; nothing is stored here.
    set(name, value) {
      if (!OPTIONS[name] || !Object.prototype.hasOwnProperty.call(OPTIONS[name].values, value)) return false;
      if (name === 'palette') activePalette = value;
      else if (name === 'font') activeFont = value;
      else if (name === 'surface') activeSurface = value;
      else if (name === 'filmGrain') activeFilm = value;
      else if (name === 'cursorShadow') activeCursor = value;
      applyTheme();
      return true;
    }
  };

  function exportCSS() {
    const pVars = PALETTES[activePalette].vars;
    const fVars = FONTS[activeFont].vars;
    const lines = [':root {'];
    Object.entries({ ...pVars, ...fVars }).forEach(([k, v]) => {
      lines.push(`  ${k}: ${v};`);
    });
    lines.push('}');
    lines.push('');
    lines.push(`/* Surface: set <html data-surface="${activeSurface}"> (metal | metal-subtle; metal is the default) */`);
    lines.push(`/* Film grain: set <html data-film="${activeFilm}"> (off | subtle | medium | high; off is the default) */`);
    lines.push(`/* Cursor shadow: set <html data-cursor-shadow="${activeCursor}"> (off | soft | strong; off is the default) */`);
    lines.push(`/* Scheme: set <html data-scheme="${activePalette.endsWith('-dark') ? 'dark' : 'light'}"> */`);
    return lines.join('\n');
  }

  function initUI() {
    const dock = document.createElement('div');
    dock.id = 'theme-dock';
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', 'Design Theme Selector');

    dock.innerHTML = `
      <button type="button" class="theme-dock-toggle" aria-expanded="false" aria-controls="theme-panel" id="theme-toggle">
        <span aria-hidden="true">🎨</span> Themes
      </button>
      <div class="theme-dock-panel" id="theme-panel" role="dialog" aria-labelledby="theme-heading" aria-modal="false">
        <div class="theme-dock-header">
          <span id="theme-heading" class="theme-dock-title">Design Preview Toolbar</span>
          <button type="button" class="theme-dock-close" aria-label="Close theme panel">&times;</button>
        </div>
        <div class="theme-section">
          <div class="theme-section-title">Color Palettes</div>
          <div class="theme-option-grid" role="toolbar" aria-label="Palettes">
            ${Object.entries(PALETTES).map(([k, p]) => `
              <button type="button" class="theme-btn" data-palette-btn="${k}" aria-pressed="${k === activePalette}">
                <span>${p.name}</span>
                <span class="palette-swatches">
                  ${p.swatches.map(s => `<span class="swatch-dot" style="background:${s}"></span>`).join('')}
                </span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="theme-section">
          <div class="theme-section-title">Typography Pairings</div>
          <div class="theme-option-grid" role="toolbar" aria-label="Typography">
            ${Object.entries(FONTS).map(([k, f]) => `
              <button type="button" class="theme-btn" data-font-btn="${k}" aria-pressed="${k === activeFont}">
                <span>${f.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="theme-section">
          <div class="theme-section-title">Surface</div>
          <div class="theme-option-grid" role="toolbar" aria-label="Surface">
            ${Object.entries(SURFACES).map(([k, label]) => `
              <button type="button" class="theme-btn" data-surface-btn="${k}" aria-pressed="${k === activeSurface}">
                <span>${label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="theme-section">
          <div class="theme-section-title">Film Grain</div>
          <div class="theme-option-grid" role="toolbar" aria-label="Film Grain">
            ${Object.entries(FILM_GRAINS).map(([k, label]) => `
              <button type="button" class="theme-btn" data-film-btn="${k}" aria-pressed="${k === activeFilm}">
                <span>${label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="theme-section">
          <div class="theme-section-title">Cursor Shadow</div>
          <div class="theme-option-grid" role="toolbar" aria-label="Cursor Shadow">
            ${Object.entries(CURSOR_SHADOWS).map(([k, label]) => `
              <button type="button" class="theme-btn" data-cursor-btn="${k}" aria-pressed="${k === activeCursor}">
                <span>${label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <button type="button" class="theme-copy-btn" id="theme-copy-css">
          <span>📋</span> Copy Active CSS
        </button>
      </div>
    `;
    document.body.appendChild(dock);

    const toggle = dock.querySelector('#theme-toggle');
    const panel = dock.querySelector('#theme-panel');
    const closeBtn = dock.querySelector('.theme-dock-close');
    const copyBtn = dock.querySelector('#theme-copy-css');

    function togglePanel(open) {
      const isOpen = open !== undefined ? open : !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    toggle.addEventListener('click', () => togglePanel());
    closeBtn.addEventListener('click', () => togglePanel(false));
    if (urlParams && (urlParams.get('open-themes') === '1' || urlParams.has('open-themes'))) {
      togglePanel(true);
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) togglePanel(false);
    });

    dock.addEventListener('click', e => {
      const pBtn = e.target.closest('[data-palette-btn]');
      if (pBtn) {
        activePalette = pBtn.dataset.paletteBtn;
        try { localStorage.setItem('alcove_theme_palette', activePalette); } catch (err) { /* ignore */ }
        applyTheme();
        return;
      }
      const fBtn = e.target.closest('[data-font-btn]');
      if (fBtn) {
        activeFont = fBtn.dataset.fontBtn;
        try { localStorage.setItem('alcove_theme_font', activeFont); } catch (err) { /* ignore */ }
        applyTheme();
        return;
      }
      const sBtn = e.target.closest('[data-surface-btn]');
      if (sBtn) {
        activeSurface = sBtn.dataset.surfaceBtn;
        try { localStorage.setItem('alcove_theme_surface', activeSurface); } catch (err) { /* ignore */ }
        applyTheme();
        return;
      }
      const filmBtn = e.target.closest('[data-film-btn]');
      if (filmBtn) {
        activeFilm = filmBtn.dataset.filmBtn;
        try { localStorage.setItem('alcove_theme_film', activeFilm); } catch (err) { /* ignore */ }
        applyTheme();
        return;
      }
      const curBtn = e.target.closest('[data-cursor-btn]');
      if (curBtn) {
        activeCursor = curBtn.dataset.cursorBtn;
        try { localStorage.setItem('alcove_theme_cursor', activeCursor); } catch (err) { /* ignore */ }
        applyTheme();
        return;
      }
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(exportCSS());
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span>✓</span> Copied to Clipboard!';
        setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
      } catch (err) {
        prompt('Copy the CSS below:', exportCSS());
      }
    });
  }

  // Early theme application to prevent flash of unstyled theme
  applyTheme();

  if (devToolbar && !editorUnlocked) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  }
})();

/* Skip the cross-document view transition when navigating to the page we're already on. */
window.addEventListener("pageswap", (event) => {
  if (!event.viewTransition || !event.activation) return;
  const from = new URL(event.activation.from.url);
  const to = new URL(event.activation.entry.url);
  const norm = (u) => u.pathname.replace(/\/index\.html$/, "/") + u.search;
  if (norm(from) === norm(to)) event.viewTransition.skipTransition();
});
