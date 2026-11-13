/**
 * Content loader: applies saved Site Content (text) and Site Defaults (theme options) from content.json.
 * Only differences from the authored HTML / CSS are stored, so a missing, empty or malformed file changes nothing.
 *
 * Flash avoidance: this is a classic blocking script in <head>. It reads content.json with a synchronous XHR so the
 * defaults are known before theme-preview.js (also blocking) applies them, and before the parser reaches <body>.
 * Text can only be written once its elements exist, so when the file has text changes the page is held invisible
 * (html[data-content-pending], see wireframe.css) until DOMContentLoaded, when the text is applied in one pass.
 * An inline fetch() would be async and could not guarantee either. The file is one small same-origin JSON document.
 * Text goes in through textContent only, never innerHTML, so content can never inject markup.
 */
(function () {
  var root = document.documentElement;
  var content = { text: {}, defaults: {} };
  // Admin gate (ticket 02): the stored token is the switch. Read early because an unlocked editor loads the Content branch file.
  var TOKEN_KEY = 'alcove_admin_token';
  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* storage blocked: stay a visitor */ }

  function read(xhr) {
    if (xhr.status !== 200) return false;
    var data = JSON.parse(xhr.responseText);
    if (!data || data.version !== 1) return false;
    if (data.text && typeof data.text === 'object' && !Array.isArray(data.text)) content.text = data.text;
    if (data.defaults && typeof data.defaults === 'object' && !Array.isArray(data.defaults)) content.defaults = data.defaults;
    return true;
  }
  var loaded = false;
  if (token) {
    // Ticket 03: while unlocked, show saved-but-unmerged work from the Content branch. The token goes only to api.github.com,
    // in the Authorization header. Any failure falls back to the published file below.
    try {
      var bx = new XMLHttpRequest();
      bx.open('GET', 'https://api.github.com/repos/TheJungleJimRuss/AlcoveSite/contents/content.json?ref=content', false);
      bx.setRequestHeader('Accept', 'application/vnd.github+json'); // JSON form (not raw) so the file's sha comes with it
      bx.setRequestHeader('Authorization', 'Bearer ' + token);
      bx.send();
      if (bx.status === 200) {
        var meta = JSON.parse(bx.responseText);
        var raw = atob(String(meta.content).replace(/\s/g, '')), bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var fileText = new TextDecoder().decode(bytes);
        loaded = read({ status: 200, responseText: fileText });
        // admin.js detects conflicts against exactly what was loaded here (sha + per-key values).
        if (loaded) window.__alcoveBase = { sha: meta.sha, text: JSON.parse(JSON.stringify(content.text)), defaults: JSON.parse(JSON.stringify(content.defaults)) };
      }
    } catch (e) { content = { text: {}, defaults: {} }; loaded = false; window.__alcoveBase = null; }
  }
  if (!loaded) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'content.json', false);
      xhr.send();
      read(xhr);
      // No branch file at load (no token, no branch, or request failed): the published file is the base, sha unknown.
      window.__alcoveBase = { sha: null, text: JSON.parse(JSON.stringify(content.text)), defaults: JSON.parse(JSON.stringify(content.defaults)) };
    } catch (e) { /* missing or malformed: silently keep authored values */ }
  }

  // theme-preview.js reads these as the lowest-priority default (below the URL and, for admins, localStorage).
  window.__alcoveDefaults = content.defaults;

  // Without a stored token nothing of admin.js / admin.css is requested.
  // The token is the gate; this is only the switch. `?admin` without a token shows a tiny token prompt (styled in wireframe.css).
  var wantsAdmin = /(^|[?&])admin($|[=&])/.test(location.search);
  if (token) {
    window.__alcoveAdmin = true; // theme-preview.js (next script) shows the toolbar and honours editor localStorage
    document.addEventListener('DOMContentLoaded', function () {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'admin.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = 'admin.js';
      document.head.appendChild(js);
    });
  } else if (wantsAdmin) {
    document.addEventListener('DOMContentLoaded', function () {
      var form = document.createElement('form');
      form.id = 'admin-token-form';
      form.setAttribute('role', 'dialog');
      form.setAttribute('aria-label', 'Unlock admin mode');
      var label = document.createElement('label');
      label.textContent = 'Paste your admin token';
      var input = document.createElement('input');
      input.type = 'password';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.required = true;
      label.appendChild(input);
      var go = document.createElement('button');
      go.type = 'submit';
      go.textContent = 'Unlock';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', function () { form.remove(); });
      form.addEventListener('keydown', function (e) { if (e.key === 'Escape') form.remove(); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) return;
        try { localStorage.setItem(TOKEN_KEY, v); } catch (err) { return; }
        location.reload(); // reload so the toolbar and admin code start together
      });
      form.append(label, go, cancel);
      document.body.appendChild(form);
      input.focus();
    });
  }

  var keys = Object.keys(content.text).filter(function (k) { return typeof content.text[k] === 'string'; });
  if (!keys.length) return;
  root.setAttribute('data-content-pending', '');
  document.addEventListener('DOMContentLoaded', function () {
    keys.forEach(function (k) {
      var els = document.querySelectorAll('[data-edit-key="' + k.replace(/["\\]/g, '\\$&') + '"]');
      for (var i = 0; i < els.length; i++) els[i].textContent = content.text[k];
    });
    root.removeAttribute('data-content-pending');
  });
})();
