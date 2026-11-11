/**
 * Theme Preview Toolbar Engine — Alcove Recording
 * Zero-dependency, accessible, client-side theme switcher with localStorage persistence.
 */
(function () {
  const PALETTES = {
    'golden-hour': {
      name: 'Golden Hour Room (Favorite)',
      swatches: ['#FDFBF7', '#4D7C5F', '#242E20'],
      vars: {
        '--bg-page': '#FDFBF7',
        '--bg-surface': '#FFFFFF',
        '--bg-accent': '#F4EFE6',
        '--text-main': '#242E20',
        '--text-muted': '#5D6B57',
        '--accent-primary': '#4D7C5F',
        '--border-color': '#E0DACF',
        '--border-focus': '#4D7C5F'
      }
    },
    'terracotta': {
      name: 'Terracotta Studio',
      swatches: ['#F7F4EE', '#C85A32', '#231D19'],
      vars: {
        '--bg-page': '#F7F4EE',
        '--bg-surface': '#FFFFFF',
        '--bg-accent': '#EFE9DC',
        '--text-main': '#231D19',
        '--text-muted': '#6E5E52',
        '--accent-primary': '#C85A32',
        '--border-color': '#E2D9CB',
        '--border-focus': '#C85A32'
      }
    },
    'sundown-room': {
      name: 'Sundown Live Room (Twilight Dark)',
      swatches: ['#1A1D1A', '#E5A93C', '#F2EFE9'],
      vars: {
        '--bg-page': '#1A1D1A',
        '--bg-surface': '#242924',
        '--bg-accent': '#2E352E',
        '--text-main': '#F2EFE9',
        '--text-muted': '#9EAAA0',
        '--accent-primary': '#E5A93C',
        '--border-color': '#374037',
        '--border-focus': '#E5A93C'
      }
    },
    'laurel-canyon': {
      name: 'Laurel Canyon (Vintage Folk)',
      swatches: ['#FBF7EE', '#B86B28', '#262016'],
      vars: {
        '--bg-page': '#FBF7EE',
        '--bg-surface': '#FFFDF9',
        '--bg-accent': '#F2E9D4',
        '--text-main': '#262016',
        '--text-muted': '#6B5E4B',
        '--accent-primary': '#B86B28',
        '--border-color': '#E3D6BF',
        '--border-focus': '#B86B28'
      }
    },
    'deep-vinyl': {
      name: 'Deep Vinyl Midnight (Late Night)',
      swatches: ['#11141E', '#FF7A59', '#F0F2FA'],
      vars: {
        '--bg-page': '#11141E',
        '--bg-surface': '#181C2A',
        '--bg-accent': '#22273B',
        '--text-main': '#F0F2FA',
        '--text-muted': '#8C94B0',
        '--accent-primary': '#FF7A59',
        '--border-color': '#2D344E',
        '--border-focus': '#FF7A59'
      }
    },
    'desert-sound': {
      name: 'Desert Sound City (Agave Teal)',
      swatches: ['#F6F4F0', '#2C7A7B', '#1C2321'],
      vars: {
        '--bg-page': '#F6F4F0',
        '--bg-surface': '#FFFFFF',
        '--bg-accent': '#ECE7DF',
        '--text-main': '#1C2321',
        '--text-muted': '#576561',
        '--accent-primary': '#2C7A7B',
        '--border-color': '#DAD3C7',
        '--border-focus': '#2C7A7B'
      }
    }
  };

  const FONTS = {
    'warm-editorial': {
      name: 'Warm Studio Editorial (Fraunces Serif)',
      vars: {
        '--font-heading': "'Fraunces', serif",
        '--font-sans': "'Plus Jakarta Sans', system-ui, sans-serif",
        '--font-mono': "'JetBrains Mono', monospace"
      }
    },
    'modernist': {
      name: 'Friendly Modernist (Outfit + Jakarta)',
      vars: {
        '--font-heading': "'Outfit', system-ui, sans-serif",
        '--font-sans': "'Plus Jakarta Sans', system-ui, sans-serif",
        '--font-mono': "'JetBrains Mono', monospace"
      }
    },
    'indie': {
      name: 'Indie Album Liner (Space Grotesk)',
      vars: {
        '--font-heading': "'Space Grotesk', system-ui, sans-serif",
        '--font-sans': "'Inter', system-ui, sans-serif",
        '--font-mono': "'Space Mono', monospace"
      }
    },
    'bricolage-groove': {
      name: 'Modern Heritage (Bricolage Grotesque)',
      vars: {
        '--font-heading': "'Bricolage Grotesque', sans-serif",
        '--font-sans': "'Inter', system-ui, sans-serif",
        '--font-mono': "'Space Mono', monospace"
      }
    }
  };

  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  let rawPalette = (urlParams && urlParams.get('theme')) || localStorage.getItem('alcove_theme_palette') || 'golden-hour';
  if (rawPalette === 'dusty-moss') rawPalette = 'terracotta';
  let activePalette = PALETTES[rawPalette] ? rawPalette : 'golden-hour';

  let rawFont = (urlParams && urlParams.get('font')) || localStorage.getItem('alcove_theme_font') || 'warm-editorial';
  let activeFont = FONTS[rawFont] ? rawFont : 'warm-editorial';

  function applyTheme() {
    const root = document.documentElement;
    const pVars = (PALETTES[activePalette] || PALETTES['golden-hour']).vars;
    const fVars = (FONTS[activeFont] || FONTS['modernist']).vars;

    Object.entries({ ...pVars, ...fVars }).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });

    document.querySelectorAll('[data-palette-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.paletteBtn === activePalette ? 'true' : 'false');
    });
    document.querySelectorAll('[data-font-btn]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.fontBtn === activeFont ? 'true' : 'false');
    });
  }

  function exportCSS() {
    const pVars = PALETTES[activePalette].vars;
    const fVars = FONTS[activeFont].vars;
    const lines = [':root {'];
    Object.entries({ ...pVars, ...fVars }).forEach(([k, v]) => {
      lines.push(`  ${k}: ${v};`);
    });
    lines.push('}');
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
        localStorage.setItem('alcove_theme_palette', activePalette);
        applyTheme();
        return;
      }
      const fBtn = e.target.closest('[data-font-btn]');
      if (fBtn) {
        activeFont = fBtn.dataset.fontBtn;
        localStorage.setItem('alcove_theme_font', activeFont);
        applyTheme();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
