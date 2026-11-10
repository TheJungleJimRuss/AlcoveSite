/**
 * Theme Preview Toolbar Engine — Alcove Recording
 * Zero-dependency, accessible, client-side theme switcher with localStorage persistence.
 */
(function () {
  const PALETTES = {
    'warm-analog': {
      name: 'Warm Analog Studio',
      swatches: ['#FAF6EE', '#D97706', '#1C1814'],
      vars: {
        '--bg-page': '#FAF6EE',
        '--bg-surface': '#FFFFFF',
        '--bg-accent': '#F0EAE1',
        '--text-main': '#1C1814',
        '--text-muted': '#6B635B',
        '--accent-primary': '#D97706',
        '--border-color': '#E5DCD0',
        '--border-focus': '#D97706'
      }
    },
    'indie-cassette': {
      name: 'Indie Cassette / Sunset',
      swatches: ['#13111C', '#E05A47', '#F5EFEB'],
      vars: {
        '--bg-page': '#13111C',
        '--bg-surface': '#1C1929',
        '--bg-accent': '#262238',
        '--text-main': '#F5EFEB',
        '--text-muted': '#9E97B0',
        '--accent-primary': '#E05A47',
        '--border-color': '#302B45',
        '--border-focus': '#E05A47'
      }
    },
    'golden-hour': {
      name: 'Golden Hour Room',
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
    'midnight-console': {
      name: 'Midnight Console',
      swatches: ['#0D131C', '#F59E0B', '#EDF3F8'],
      vars: {
        '--bg-page': '#0D131C',
        '--bg-surface': '#151E2B',
        '--bg-accent': '#1D2A3C',
        '--text-main': '#EDF3F8',
        '--text-muted': '#8496AA',
        '--accent-primary': '#F59E0B',
        '--border-color': '#243348',
        '--border-focus': '#F59E0B'
      }
    }
  };

  const FONTS = {
    'editorial': {
      name: 'Warm Editorial (Jakarta + Inter)',
      vars: {
        '--font-heading': "'Plus Jakarta Sans', system-ui, sans-serif",
        '--font-sans': "'Inter', system-ui, sans-serif",
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
    'modernist': {
      name: 'Friendly Modernist (Outfit + Jakarta)',
      vars: {
        '--font-heading': "'Outfit', system-ui, sans-serif",
        '--font-sans': "'Plus Jakarta Sans', system-ui, sans-serif",
        '--font-mono': "'JetBrains Mono', monospace"
      }
    }
  };

  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  let activePalette = (urlParams && urlParams.get('theme')) || localStorage.getItem('alcove_theme_palette') || 'warm-analog';
  let activeFont = (urlParams && urlParams.get('font')) || localStorage.getItem('alcove_theme_font') || 'editorial';

  function applyTheme() {
    const root = document.documentElement;
    const pVars = (PALETTES[activePalette] || PALETTES['warm-analog']).vars;
    const fVars = (FONTS[activeFont] || FONTS['editorial']).vars;

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
