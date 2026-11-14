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
  var content = { text: {}, defaults: {}, media: {}, songs: null, songsRaw: undefined };
  var clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
  var baseOf = function (sha) { return { sha: sha, text: clone(content.text), defaults: clone(content.defaults), media: clone(content.media), songs: clone(content.songsRaw) }; };
  // Admin gate (ticket 02): the stored token is the switch. Read early because an unlocked editor loads the Content branch file.
  var TOKEN_KEY = 'alcove_admin_token';
  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* storage blocked: stay a visitor */ }

  // Songs (admin-media ticket 03): ordered [{ title, file }], 1 to 20, file a plain media/ audio path, title a short non-empty string.
  // All or nothing: any bad entry makes the whole list invalid and the authored Work list stays. Titles are only ever set with textContent.
  var SAFE_SONG = /^media\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(?:mp3|m4a|wav|ogg|webm)$/;
  function validSongs(list) {
    if (!Array.isArray(list) || list.length < 1 || list.length > 20) return false;
    return list.every(function (s) {
      return s && typeof s === 'object' && !Array.isArray(s) && typeof s.title === 'string' && s.title.trim().length > 0 && s.title.length <= 120 &&
        typeof s.file === 'string' && SAFE_SONG.test(s.file) && s.file.indexOf('..') < 0;
    });
  }
  function read(xhr) {
    if (xhr.status !== 200) return false;
    var data = JSON.parse(xhr.responseText);
    if (!data || data.version !== 1) return false;
    if (data.text && typeof data.text === 'object' && !Array.isArray(data.text)) content.text = data.text;
    if (data.defaults && typeof data.defaults === 'object' && !Array.isArray(data.defaults)) content.defaults = data.defaults;
    // Media slots (admin-media ticket 01): slot key -> repo path under images/. Anything else is ignored at apply time.
    if (data.media && typeof data.media === 'object' && !Array.isArray(data.media)) content.media = data.media;
    content.songsRaw = data.songs; // what the file holds, valid or not: admin.js compares it to detect conflicts
    if (validSongs(data.songs)) content.songs = data.songs.map(function (s) { return { title: s.title, file: s.file }; });
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
        if (loaded) window.__alcoveBase = baseOf(meta.sha);
      }
    } catch (e) { content = { text: {}, defaults: {}, media: {}, songs: null, songsRaw: undefined }; loaded = false; window.__alcoveBase = null; }
  }
  if (!loaded) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'content.json', false);
      xhr.send();
      read(xhr);
      // No branch file at load (no token, no branch, or request failed): the published file is the base, sha unknown.
      window.__alcoveBase = baseOf(null);
    } catch (e) { /* missing or malformed: silently keep authored values */ }
  }

  // theme-preview.js reads these as the lowest-priority default (below the URL and, for admins, localStorage).
  window.__alcoveDefaults = content.defaults;
  // record-player.js (Work) builds the Crate from this; null keeps the authored sleeves.
  window.__alcoveSongs = content.songs;

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

  // Only plain repo paths are accepted: photos and posters under images/, audio and video clips under media/. No traversal, no URLs, no schemes.
  var SAFE_IMG = /^images\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(?:jpe?g|png|webp|svg)$/;
  var SAFE_CLIP = /^media\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(?:mp3|m4a|wav|ogg|webm|mp4)$/;
  var safe = function (v, re) { return typeof v === 'string' && re.test(v) && v.indexOf('..') < 0; };
  var mediaKeys = Object.keys(content.media).filter(function (k) { return safe(content.media[k], SAFE_IMG) || safe(content.media[k], SAFE_CLIP); });
  var keys = Object.keys(content.text).filter(function (k) { return typeof content.text[k] === 'string'; });
  if (!keys.length && !mediaKeys.length && !content.songs) return;
  root.setAttribute('data-content-pending', '');
  var esc = function (k) { return k.replace(/["\\]/g, '\\$&'); };
  function applyMedia(slot, path) {
    var box = slot.closest && slot.closest('.photo-slot');
    if (slot.tagName === 'IMG') {
      var authored = slot.getAttribute('src');
      slot.addEventListener('error', function () { if (slot.getAttribute('src') === path) slot.setAttribute('src', authored); }, { once: true }); // file not there (yet): keep the authored photo
      slot.setAttribute('src', path);
    } else {
      // CSS background photo (home hero): the authored rule stays the fallback; the saved file is layered on through the style object, not markup.
      var probe = new Image();
      probe.onload = function () { slot.style.backgroundImage = 'url("' + path + '")'; };
      probe.src = path;
    }
    if (box) box.classList.remove('photo-slot'); // a real photo replaces the dashed placeholder frame
  }
  // Clip slots (admin-media ticket 02): <video src>, a video's poster, or the A/B deck's <audio data-src>. The authored value stays the fallback.
  function applyClip(el, path) {
    if (el.tagName === 'VIDEO') {
      var authored = el.getAttribute('src');
      el.addEventListener('error', function () { if (el.getAttribute('src') === path && authored) el.setAttribute('src', authored); }, { once: true });
      el.setAttribute('src', path);
    } else {
      el.setAttribute('data-src-fallback', el.getAttribute('data-src') || ''); // ab-compare.js falls back to this if the saved file will not load
      el.setAttribute('data-src', path);
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    keys.forEach(function (k) {
      var els = document.querySelectorAll('[data-edit-key="' + esc(k) + '"]');
      for (var i = 0; i < els.length; i++) els[i].textContent = content.text[k];
    });
    mediaKeys.forEach(function (k) {
      var els = document.querySelectorAll('[data-media-slot="' + esc(k) + '"]');
      if (!safe(content.media[k], SAFE_IMG)) return;
      for (var i = 0; i < els.length; i++) applyMedia(els[i], content.media[k]);
      var ps = document.querySelectorAll('[data-media-poster="' + esc(k) + '"]');
      for (var j = 0; j < ps.length; j++) ps[j].setAttribute('poster', content.media[k]);
    });
    mediaKeys.forEach(function (k) {
      if (!safe(content.media[k], SAFE_CLIP)) return;
      var cs = document.querySelectorAll('[data-media-clip="' + esc(k) + '"]');
      for (var i = 0; i < cs.length; i++) applyClip(cs[i], content.media[k]);
    });
    root.removeAttribute('data-content-pending');
  });
})();
