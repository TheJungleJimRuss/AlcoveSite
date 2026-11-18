/**
 * Admin mode (ticket 02): loaded by content-loader.js only when an editor token is stored.
 * Plain-text in-place editing of [data-edit-key] elements, a changes panel with per-item revert,
 * per-page drafts in localStorage, a leave-page warning while dirty. Save (ticket 03) pushes the merged content.json to the
 * `content` branch through the GitHub contents API; the token only ever goes to api.github.com in the Authorization header.
 * Ticket 04: a Site Defaults panel (selects built from window.AlcoveTheme, defined in theme-preview.js) with live preview;
 * unsaved choices are a draft under their own key and are saved together with text edits under `defaults`.
 * Admin media ticket 01: every [data-media-slot] photo gets a Replace control while Edit mode is on. The chosen photo is shrunk with a canvas
 * (about 2000px long edge), previewed in place and staged in IndexedDB (localStorage is too small); Save uploads each new file under images/
 * (slug + short content hash) with a contents PUT BEFORE the content.json PUT, so live content never points at a missing file.
 * Admin media ticket 02: the same flow for audio and video. Slots: [data-media-clip] (the Work session video's src; the A/B deck's memo and
 * master clips) and [data-media-poster] (the video's poster, handled as a photo). Clips are uploaded unchanged under media/ after type and
 * size checks, staged as Blobs, previewed in place, and base64-encoded only at upload time in chunks (no giant string in memory).
 * Admin media ticket 03: Songs on Work. While Edit mode is on, a Songs list (title inputs, Move up / Move down / Remove, and an Add form with a
 * title and an audio file) edits the Crate live through window.AlcoveRecordPlayer. A new song's audio is staged like a clip (Blob, IndexedDB,
 * preview from a blob URL) under media/ (slug + short content hash); Save uploads new audio first, then writes the whole ordered `songs` list
 * with content.json. The working list, titles and order are kept as a draft in localStorage next to the text drafts.
 * Admin media ticket 06: Sleeve covers. While Edit mode is on, one Replace cover button follows the Sleeve sticking out of the pile (it is
 * a sibling in .rp-stage, never inside the Sleeve button). A chosen picture is shrunk to 1200px (JPEG), previewed on the Sleeve at once,
 * staged in IndexedDB under cover:<song file>, kept in the songs draft, and uploaded as images/cover-<slug>-<hash>.jpg before content.json;
 * the song's `cover` is saved next to its title and file. The Add song form takes an optional cover. Covers can be replaced, not removed.
 * Text is only ever read and written through textContent, never innerHTML.
 */
(function () {
  'use strict';
  var TOKEN_KEY = 'alcove_admin_token';
  var DRAFT_PREFIX = 'alcove_admin_draft:';
  var API = 'https://api.github.com/repos/TheJungleJimRuss/AlcoveSite';
  var REPO_NAME = 'TheJungleJimRuss/AlcoveSite';
  var BRANCH = 'content';
  var DEFAULTS_DRAFT_KEY = DRAFT_PREFIX + 'defaults';
  // One size cap for every kind of media (photos, audio and video). Lower it if GitHub rejects big uploads.
  var MAX_MEDIA_BYTES = 90 * 1024 * 1024;
  var MAX_PHOTO_EDGE = 2000;
  var MAX_COVER_EDGE = 1200; // a Sleeve is at most about 400px wide, so this is 3x
  window.AlcoveAdmin = { MAX_MEDIA_BYTES: MAX_MEDIA_BYTES };
  var DRAFT_KEY = DRAFT_PREFIX + (location.pathname.split('/').pop() || 'index.html');

  function start() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-edit-key]'));
    var byKey = {};  // key -> every element carrying it (shared nav/footer keys appear more than once; they edit together)
    var base = {};   // saved wording at unlock time: the revert target
    els.forEach(function (el) {
      var k = el.dataset.editKey;
      if (!(k in byKey)) { byKey[k] = []; base[k] = el.textContent; }
      byKey[k].push(el);
    });
    var setAll = function (k, t) { byKey[k].forEach(function (e) { if (e.textContent !== t) e.textContent = t; }); };
    var EDIT_KEY = 'alcove_admin_edit';
    var editOn = false;
    try { editOn = sessionStorage.getItem(EDIT_KEY) === '1'; } catch (e) { /* off */ }
    var draft = {};  // key -> edited text, only where it differs from base
    var staged = {}; // slot key -> { blob, path, name, url } photos chosen but not saved yet

    function loadDraft() {
      try {
        var d = JSON.parse(localStorage.getItem(DRAFT_KEY));
        if (d && d.version === 1 && d.text && typeof d.text === 'object') {
          Object.keys(d.text).forEach(function (k) {
            if (k in byKey && typeof d.text[k] === 'string' && d.text[k] !== base[k]) draft[k] = d.text[k];
          });
        }
      } catch (e) { /* no draft */ }
    }
    function saveDraft() {
      try {
        if (Object.keys(draft).length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, text: draft }));
        else localStorage.removeItem(DRAFT_KEY);
      } catch (e) { /* storage full or blocked: edits still work in memory */ }
    }
    // Site Defaults: `savedDef` is what visitors get now (the last saved file); `chosen` is the previewed value per option.
    var theme = window.AlcoveTheme;
    var savedDef = theme ? theme.saved() : {};
    var chosen = theme ? theme.get() : {};
    var optNames = theme ? Object.keys(theme.options) : [];
    function defChanges() {
      var out = {};
      optNames.forEach(function (n) { if (chosen[n] !== savedDef[n]) out[n] = chosen[n]; });
      return out;
    }
    function saveDefDraft() {
      try {
        var d = defChanges();
        if (Object.keys(d).length) localStorage.setItem(DEFAULTS_DRAFT_KEY, JSON.stringify({ version: 1, defaults: d }));
        else localStorage.removeItem(DEFAULTS_DRAFT_KEY);
      } catch (e) { /* storage blocked: choices still work in memory */ }
    }
    var count = function () { return Object.keys(draft).length + Object.keys(defChanges()).length + Object.keys(staged).length + songChanges().length; };

    // ---- panel ----
    var panel = document.createElement('aside');
    panel.id = 'alcove-admin';
    panel.setAttribute('aria-label', 'Admin mode');
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'admin-body');
    var body = document.createElement('div');
    body.id = 'admin-body';
    body.hidden = true;
    var status = document.createElement('p');
    status.className = 'admin-status';
    status.setAttribute('role', 'status');
    var list = document.createElement('ul');
    list.className = 'admin-changes';
    var defs = document.createElement('fieldset');
    defs.className = 'admin-defaults';
    var defsLegend = document.createElement('legend');
    defsLegend.textContent = 'Site Defaults';
    defs.appendChild(defsLegend);
    var selects = {};
    optNames.forEach(function (n) {
      var row = document.createElement('label');
      var name = document.createElement('span');
      name.textContent = theme.options[n].label;
      var sel = document.createElement('select');
      sel.name = n;
      Object.keys(theme.options[n].values).forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = theme.options[n].values[v];
        sel.appendChild(o);
      });
      sel.value = chosen[n];
      sel.addEventListener('change', function () {
        if (!theme.set(n, sel.value)) return;
        chosen[n] = sel.value;
        saveDefDraft();
        render();
      });
      selects[n] = sel;
      row.append(name, sel);
      defs.appendChild(row);
    });
    var defRevert = document.createElement('button');
    defRevert.type = 'button';
    defRevert.className = 'admin-defaults-revert';
    defRevert.textContent = 'Revert to saved';
    defRevert.addEventListener('click', function () {
      optNames.forEach(function (n) { chosen[n] = savedDef[n]; theme.set(n, savedDef[n]); selects[n].value = savedDef[n]; });
      saveDefDraft();
      render();
    });
    defs.appendChild(defRevert);
    var actions = document.createElement('div');
    actions.className = 'admin-actions';
    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'admin-save';
    save.disabled = true;
    save.textContent = 'Save';
    var note = document.createElement('p');
    note.className = 'admin-note';
    note.setAttribute('role', 'status');
    var signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'admin-signout';
    signOut.textContent = 'Sign out';
    actions.append(save, signOut);
    var mediaWarn = document.createElement('p');
    mediaWarn.className = 'admin-media-warning';
    mediaWarn.setAttribute('role', 'status');
    var mediaErr = document.createElement('p');
    mediaErr.className = 'admin-media-error';
    mediaErr.setAttribute('role', 'alert');
    body.append(status, mediaErr, mediaWarn, list, defs, actions, note);
    // Edit mode switch: always visible in the panel header. While off the site behaves normally.
    var editSwitch = document.createElement('button');
    editSwitch.type = 'button';
    editSwitch.className = 'admin-edit-switch';
    editSwitch.setAttribute('role', 'switch');
    var editName = document.createElement('span');
    editName.textContent = 'Edit mode';
    var editState = document.createElement('span');
    editState.setAttribute('aria-hidden', 'true'); // the switch's own checked state is announced instead
    editSwitch.append(editName, editState);
    panel.append(toggle, editSwitch, body);
    document.body.appendChild(panel);

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
    });

    // Esc closes the open panel and returns focus to its toggle (editable text handles its own Esc, which blurs).
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || body.hidden) return;
      toggle.setAttribute('aria-expanded', 'false');
      body.hidden = true;
      toggle.focus();
    });

    var saving = false, skipWarn = false;
    function render() {
      var n = count();
      save.textContent = n ? 'Save ' + n + (n === 1 ? ' change' : ' changes') : 'Save';
      save.disabled = !n || saving;
      toggle.textContent = 'Admin · ' + n + (n === 1 ? ' change' : ' changes');
      defRevert.disabled = !Object.keys(defChanges()).length;
      optNames.forEach(function (o) { if (selects[o].value !== chosen[o]) selects[o].value = chosen[o]; });
      editSwitch.setAttribute('aria-checked', String(editOn));
      editState.textContent = editOn ? ': on' : ': off';
      status.textContent = n ? n + (n === 1 ? ' unsaved change' : ' unsaved changes') + '.' : (editOn ? 'No changes yet. Click any outlined text to edit it, or pick Site Defaults below.' : 'No changes yet. Turn Edit mode on to change text, or pick Site Defaults below.');
      while (list.firstChild) list.removeChild(list.firstChild);
      Object.keys(draft).forEach(function (k) {
        var li = document.createElement('li');
        var what = document.createElement('span');
        what.className = 'admin-change-text';
        what.textContent = draft[k];
        what.title = k;
        var rev = document.createElement('button');
        rev.type = 'button';
        rev.textContent = 'Revert';
        rev.setAttribute('aria-label', 'Revert ' + k);
        rev.addEventListener('click', function () {
          setAll(k, base[k]);
          delete draft[k];
          saveDraft();
          render();
          var next = list.querySelector('button');
          (next || toggle).focus();
        });
        li.append(what, rev);
        list.appendChild(li);
      });
      Object.keys(staged).forEach(function (k) {
        var li = document.createElement('li');
        var what = document.createElement('span');
        what.className = 'admin-change-text';
        what.textContent = changeLabel(k);
        what.title = k;
        var rev = document.createElement('button');
        rev.type = 'button';
        rev.textContent = 'Revert';
        rev.setAttribute('aria-label', 'Revert ' + changeLabel(k));
        rev.addEventListener('click', function () {
          unstage(k);
          render();
          var next = list.querySelector('button');
          (next || toggle).focus();
        });
        li.append(what, rev);
        list.appendChild(li);
      });
      songChanges().forEach(function (c) {
        var li = document.createElement('li');
        var what = document.createElement('span');
        what.className = 'admin-change-text';
        what.textContent = songLabel(c);
        what.title = songLabel(c);
        var rev = document.createElement('button');
        rev.type = 'button';
        rev.textContent = 'Revert';
        rev.setAttribute('aria-label', 'Revert ' + songLabel(c));
        rev.addEventListener('click', function () {
          revertSong(c);
          var next = list.querySelector('button');
          (next || toggle).focus();
        });
        li.append(what, rev);
        list.appendChild(li);
      });
    }

    // ---- save (ticket 03) ----
    function setNote(text, reload) {
      note.textContent = text;
      if (reload) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Reload and reapply';
        b.addEventListener('click', function () { skipWarn = true; location.reload(); }); // drafts stay in localStorage and reapply on load
        note.append(' ', b);
      }
    }
    function call(method, path, payload) {
      var token = null;
      try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* handled by 401 path */ }
      var headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };
      var init = { method: method, headers: headers };
      if (payload) { headers['Content-Type'] = 'application/json'; init.body = payload instanceof Blob ? payload : JSON.stringify(payload); }
      return fetch(API + path, init).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) { return { status: res.status, data: data }; });
      });
    }
    function httpError(status) { var e = new Error('http ' + status); e.status = status; return e; }
    var utf8 = {
      enc: function (t) { var b = new TextEncoder().encode(t), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); },
      dec: function (b64) { var s = atob(b64.replace(/\s/g, '')), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }
    };
    // What this editor loaded from the Content branch at unlock: file sha plus per-key values. A save conflicts only when the
    // branch moved on AND one of the keys/defaults being saved now differs from this base. Updated after each successful save.
    var loadedBase = window.__alcoveBase || { sha: null, text: {}, defaults: {}, media: {}, songs: undefined };
    if (!loadedBase.media) loadedBase.media = {};
    function conflict() { var e = new Error('conflict'); e.status = 409; return e; }
    // Base64 in 768 KB slices (a multiple of 3 bytes, so no padding mid-stream). Each encoded slice goes straight into a Blob,
    // so a 90 MB clip never exists as one huge JS string; the request body is a Blob of those pieces.
    var CHUNK = 3 * 256 * 1024;
    function encodeSlice(buf) {
      var u = new Uint8Array(buf), s = '';
      for (var i = 0; i < u.length; i += 8190) s += String.fromCharCode.apply(null, u.subarray(i, i + 8190));
      return btoa(s);
    }
    function uploadBody(name, blob, onProgress) {
      var parts = ['{"message":' + JSON.stringify('Add ' + name) + ',"branch":"' + BRANCH + '","content":"'];
      var step = function (from) {
        if (from >= blob.size) return Promise.resolve();
        return blob.slice(from, from + CHUNK).arrayBuffer().then(function (buf) {
          parts.push(new Blob([encodeSlice(buf)]));
          if (onProgress) onProgress(Math.min(1, (from + CHUNK) / blob.size));
          return step(from + CHUNK);
        });
      };
      return step(0).then(function () { parts.push('"}'); return new Blob(parts, { type: 'application/json' }); });
    }
    // One new media file: PUT it. A failure names the file.
    function uploadFile(path, blob, onProgress) {
      var name = path.split('/').pop();
      if (!DELETABLE.test(path) || path.indexOf('..') >= 0) return Promise.reject(Object.assign(new Error('bad path'), { file: name })); // only plain images/ or media/ paths are ever written
      var fail = function (e) { if (e && !e.file) e.file = name; throw e; };
      return uploadBody(name, blob, onProgress).then(function (body) {
        return call('PUT', '/contents/' + path, body);
      }).then(function (p) {
        if (p.status === 200 || p.status === 201) return;
        if (p.status !== 422) throw httpError(p.status);
        // 422 with no sha: the name may already exist. The name carries a content hash, so an existing file is identical; confirm before trusting it.
        return call('GET', '/contents/' + path + '?ref=' + BRANCH).then(function (g) { if (g.status !== 200) throw httpError(p.status); });
      }).catch(fail);
    }
    // ---- cleanup after a successful Save (ticket 04) ----
    // Only plain repo media paths (the loader's whitelist) are ever deleted; textures, the logo and anything else are out of reach.
    var DELETABLE = /^(?:images\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(?:jpe?g|png|webp|svg)|media\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(?:mp3|m4a|wav|ogg|webm|mp4))$/;
    var PAGES = ['index.html', 'work.html', 'about.html', 'contact.html'];
    // Every images/ or media/ path mentioned in the four pages and their stylesheets as SERVED (not the live DOM, which the loader has
    // already rewritten): authored defaults, fallbacks, CSS hero. Any fetch failure means "unknown", so nothing is deleted.
    function authoredRefs() {
      var found = {};
      var scan = function (t) { (t.match(/(?:images|media)\/[A-Za-z0-9._-]+/g) || []).forEach(function (m) { found[m] = true; }); };
      var get = function (u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('unreadable'); return r.text(); }); };
      return Promise.all(PAGES.map(function (p) {
        return get(p).then(function (html) {
          scan(html);
          var sheets = [], re = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi, m;
          while ((m = re.exec(html))) { var h = /href=["']?([^"'\s>]+)/i.exec(m[0]); if (h && !/^(?:[a-z]+:)?\/\//i.test(h[1])) sheets.push(h[1]); }
          return Promise.all(sheets.map(function (u) { return get(u).then(scan); }));
        });
      })).then(function () { return found; });
    }
    // Delete each replaced/removed file nothing references any more. Never throws; resolves with { removed, failed }.
    function cleanup(candidates, merged) {
      var res = { removed: [], failed: [] };
      var list = candidates.filter(function (p, i) { return candidates.indexOf(p) === i && DELETABLE.test(p) && p.indexOf('..') < 0; });
      if (!list.length) return Promise.resolve(res);
      var used = {};
      Object.keys(merged.media || {}).forEach(function (k) { used[merged.media[k]] = true; });
      if (Array.isArray(merged.songs)) merged.songs.forEach(function (s) { if (s) { used[s.file] = true; if (typeof s.cover === 'string') used[s.cover] = true; } });
      return authoredRefs().then(function (refs) {
        var chain = Promise.resolve();
        list.filter(function (p) { return !used[p] && !refs[p]; }).forEach(function (p) {
          chain = chain.then(function () {
            return call('GET', '/contents/' + p + '?ref=' + BRANCH).then(function (g) {
              if (g.status === 404) return;   // already gone
              if (g.status !== 200 || !g.data || !g.data.sha) throw httpError(g.status);
              return call('DELETE', '/contents/' + p, { message: 'Remove unused ' + p.split('/').pop(), sha: g.data.sha, branch: BRANCH }).then(function (d) {
                if (d.status !== 200) throw httpError(d.status);
                res.removed.push(p);
              });
            }).catch(function () { res.failed.push(p.split('/').pop()); });
          });
        });
        return chain;
      }).catch(function () { res.failed.push('(could not check which files are still in use)'); }).then(function () { return res; });
    }
    function push(changes, defChg, mediaChg, songChg) {
      var merged, candidates = [];
      return call('GET', '/branches/' + BRANCH).then(function (r) {
        if (r.status === 200) return;
        if (r.status !== 404) throw httpError(r.status);
        return call('GET', '/git/ref/heads/main').then(function (m) {
          if (m.status !== 200 || !m.data || !m.data.object) throw httpError(m.status);
          return call('POST', '/git/refs', { ref: 'refs/heads/' + BRANCH, sha: m.data.object.sha });
        }).then(function (c) { if (c.status !== 201) throw httpError(c.status); });
      }).then(function () {
        return call('GET', '/contents/content.json?ref=' + BRANCH);
      }).then(function (f) {
        var sha, file = { version: 1, text: {}, defaults: {} };
        if (f.status === 200 && f.data && typeof f.data.content === 'string') {
          sha = f.data.sha;
          var parsed;
          try { parsed = JSON.parse(utf8.dec(f.data.content)); } catch (e) { throw new Error('malformed'); }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('malformed');
          file = parsed;
        } else if (f.status !== 404) throw httpError(f.status);
        file.version = 1;
        if (sha !== loadedBase.sha) {
          var lt = (file.text && typeof file.text === 'object' && !Array.isArray(file.text)) ? file.text : {};
          var ld = (file.defaults && typeof file.defaults === 'object' && !Array.isArray(file.defaults)) ? file.defaults : {};
          var lm = (file.media && typeof file.media === 'object' && !Array.isArray(file.media)) ? file.media : {};
          var clash = Object.keys(changes).some(function (k) { return lt[k] !== loadedBase.text[k]; }) ||
            Object.keys(mediaChg).some(function (k) { return lm[k] !== loadedBase.media[k]; }) ||
            Object.keys(defChg).some(function (k) { return ld[k] !== loadedBase.defaults[k]; }) ||
            (!!songChg && JSON.stringify(file.songs) !== JSON.stringify(loadedBase.songs));
          if (clash) throw conflict();
        }
        var text = (file.text && typeof file.text === 'object' && !Array.isArray(file.text)) ? file.text : {};
        Object.keys(changes).forEach(function (k) { text[k] = changes[k]; });
        file.text = text;
        if (!file.defaults || typeof file.defaults !== 'object' || Array.isArray(file.defaults)) file.defaults = {};
        Object.keys(defChg).forEach(function (k) { file.defaults[k] = defChg[k]; });
        if (!file.media || typeof file.media !== 'object' || Array.isArray(file.media)) { if (Object.keys(mediaChg).length) file.media = {}; else delete file.media; }
        var mkeys = Object.keys(mediaChg);
        // Cleanup candidates (ticket 04): what the branch file pointed at before this Save and no longer will.
        mkeys.forEach(function (k) { var o = file.media[k]; if (typeof o === 'string' && o !== mediaChg[k].path) candidates.push(o); });
        if (songChg && Array.isArray(file.songs)) file.songs.forEach(function (s) {
          if (s && typeof s.file === 'string') candidates.push(s.file);
          if (s && typeof s.cover === 'string') candidates.push(s.cover);
        });
        mkeys.forEach(function (k) { file.media[k] = mediaChg[k].path; });
        if (songChg) file.songs = songChg.list;
        var nt = Object.keys(changes).length, nd = Object.keys(defChg).length, nm = mkeys.length, parts = [];
        if (nt) parts.push(nt + (nt === 1 ? ' text change' : ' text changes'));
        if (nd) parts.push(nd + (nd === 1 ? ' default' : ' defaults'));
        if (nm) parts.push(nm + (nm === 1 ? ' media file' : ' media files'));
        if (songChg) parts.push('songs');
        var body = { message: 'Update site content (' + parts.join(', ') + ')', content: utf8.enc(JSON.stringify(file, null, 2) + '\n'), branch: BRANCH };
        if (sha) body.sha = sha;
        merged = { text: JSON.parse(JSON.stringify(file.text)), defaults: JSON.parse(JSON.stringify(file.defaults)), media: JSON.parse(JSON.stringify(file.media || {})), songs: file.songs === undefined ? undefined : JSON.parse(JSON.stringify(file.songs)) };
        // Files first, one at a time; content.json last, so the live content never points at a file that is not there.
        var uploads = mkeys.map(function (k) { return { path: mediaChg[k].path, blob: mediaChg[k].blob }; });
        if (songChg) songChg.uploads.forEach(function (u) { uploads.push({ path: u.file, blob: u.blob }); }); // song audio and covers
        var chain = Promise.resolve();
        uploads.forEach(function (u, i) {
          chain = chain.then(function () {
            var label = 'Uploading file ' + (i + 1) + ' of ' + uploads.length + ': ' + u.path.split('/').pop();
            setNote(label + '…');
            return uploadFile(u.path, u.blob, u.blob.size > CHUNK * 4 ? function (f) { setNote(label + ' (' + Math.round(f * 100) + '%)…'); } : null);
          });
        });
        return chain.then(function () { setNote('Saving…'); return call('PUT', '/contents/content.json', body); });
      }).then(function (p) {
        if (p.status !== 200 && p.status !== 201) throw httpError(p.status);
        loadedBase = { sha: p.data && p.data.content && p.data.content.sha, text: merged.text, defaults: merged.defaults, media: merged.media, songs: merged.songs };
        return { candidates: candidates, merged: merged };
      });
    }
    function explain(e) {
      var s = e && e.status;
      if (e && e.message === 'malformed') return 'The content file on the content branch is not valid JSON, so nothing was saved. Ask the developer to fix it. Your changes are kept here.';
      if (s === 409 || s === 422) return 'The content branch changed while you were editing, so nothing was saved and nothing was overwritten. Your changes are kept here. Reload to get the latest wording; your edits are re-applied on top.';
      if (s === 401) return 'GitHub did not accept the token. It may be wrong or expired. Sign out and paste a new one. Your changes are kept here.';
      if (s === 403) return 'The token is valid but is not allowed to save. It needs Contents read and write permission on ' + REPO_NAME + '. Your changes are kept here.';
      if (s === 404) return 'The repository ' + REPO_NAME + ' was not found, or the token cannot see it. Check the token was made for this repository. Your changes are kept here.';
      if (typeof s === 'number') return 'GitHub returned an error (' + s + '). Nothing was saved. Your changes are kept here; try again in a moment.';
      return 'Could not reach GitHub. Check your connection and try again. Your changes are kept here.';
    }
    save.addEventListener('click', function () {
      if (saving || !count()) return;
      var changes = {};
      Object.keys(draft).forEach(function (k) { changes[k] = draft[k]; });
      var defChg = defChanges();
      var mediaChg = {};
      Object.keys(staged).forEach(function (k) { mediaChg[k] = staged[k]; });
      var songChg = songChanges().length ? { list: songs.map(songEntry), uploads: [], staged: songs.filter(function (x) { return x.staged; }), covered: songs.filter(function (x) { return x.cstage; }) } : null;
      if (songChg) {
        songChg.staged.forEach(function (x) { songChg.uploads.push({ file: x.file, blob: x.blob }); });
        songChg.covered.forEach(function (x) { songChg.uploads.push({ file: x.cstage.path, blob: x.cstage.blob }); });
      }
      saving = true;
      setNote('Saving…');
      render();
      var after = null;
      push(changes, defChg, mediaChg, songChg).then(function (r) {
        after = r;
        if (songChg) markSongsSaved(songChg);
        Object.keys(mediaChg).forEach(function (k) { if (staged[k] === mediaChg[k]) markSaved(k); });
        Object.keys(changes).forEach(function (k) {
          base[k] = changes[k];
          if (draft[k] === changes[k]) delete draft[k];
        });
        saveDraft();
        Object.keys(defChg).forEach(function (n) { savedDef[n] = defChg[n]; });
        saveDefDraft();
        setNote('Saved to the content branch. Changes go live in a minute or two, once the site redeploys.');
        // Content is saved; tidy up old files softly. Nothing here can fail the Save.
        if (after && after.candidates.length) {
          return cleanup(after.candidates, after.merged).then(function (c) {
            if (c.failed.length) setNote('Saved to the content branch. Changes go live in a minute or two, once the site redeploys. Old files that could not be removed (harmless, the site works): ' + c.failed.join(', ') + '.');
          });
        }
      }).catch(function (e) {
        var conflict = e && (e.status === 409 || e.status === 422) && !e.file;
        setNote((e && e.file ? 'Could not upload ' + e.file + '. ' : '') + explain(e), conflict);
      }).then(function () { saving = false; render(); });
    });

    signOut.addEventListener('click', function () {
      if (count() && !window.confirm('Sign out and discard ' + count() + ' unsaved ' + (count() === 1 ? 'change' : 'changes') + '?')) return;
      var go = function () { location.reload(); };
      var cleared = idb('readwrite', function (st) { st.clear(); }).then(go, go);
      try {
        localStorage.removeItem(TOKEN_KEY);
        Object.keys(localStorage).filter(function (k) { return k.indexOf(DRAFT_PREFIX) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }
      draft = {}; // nothing left to warn about
      staged = {};
      songs = songBase.map(newSong);
      chosen = savedDef; // defaults drafts are cleared with the other drafts above
      void cleared; // reloads once the staged photos are cleared
    });

    // ---- editing ----
    var oneLine = function (t) { return t.replace(/[\r\n]+/g, ' '); };
    // Browsers may add <br>/<div> on Enter or odd pastes; flatten back to a single text node, caret at end.
    function flatten(el) {
      var t = oneLine(el.textContent);
      if (el.children.length || el.textContent !== t) {
        el.textContent = t;
        var r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        var sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      return t;
    }
    function record(el) {
      var k = el.dataset.editKey, t = flatten(el);
      setAll(k, t); // other elements sharing this key follow
      if (t !== base[k]) draft[k] = t; else delete draft[k];
      saveDraft();
      render();
    }


    // ---- media slots: photos (ticket 01), audio and video clips (ticket 02) ----
    var slotEls = {};  // key -> the element that shows the slot
    var kindOf = {};   // key -> 'photo' | 'poster' | 'video' | 'audio'
    var slotBase = {}; // key -> what the slot shows now (authored or saved), the revert target
    var slotBox = {};  // key -> had the dashed placeholder frame
    var CLIP_LABELS = { 'work.video.session': 'Session video', 'work.video.poster': 'Session video poster', 'work.ab.memo': 'A/B voice memo clip', 'work.ab.master': 'A/B finished master clip' };
    function currentValue(k) {
      var el = slotEls[k];
      if (kindOf[k] === 'video') return el.getAttribute('src');
      if (kindOf[k] === 'poster') return el.getAttribute('poster');
      if (kindOf[k] === 'audio') return el.getAttribute('data-src');
      return el.tagName === 'IMG' ? el.getAttribute('src') : el.style.backgroundImage;
    }
    function addSlot(k, el, kind) {
      if (k in slotEls) return;
      slotEls[k] = el; kindOf[k] = kind;
      slotBase[k] = currentValue(k);
      var box = kind === 'photo' ? el.closest('.photo-slot') : null;
      slotBox[k] = !!box;
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-media-slot]'), function (el) { addSlot(el.dataset.mediaSlot, el, 'photo'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-media-clip]'), function (el) { addSlot(el.dataset.mediaClip, el, el.tagName === 'VIDEO' ? 'video' : 'audio'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-media-poster]'), function (el) { addSlot(el.dataset.mediaPoster, el, 'poster'); });
    function slotLabel(k) { var el = slotEls[k]; return CLIP_LABELS[k] || (el && el.getAttribute('alt')) || (k === 'index.photo.hero' ? 'Home hero photo' : k); }
    function changeLabel(k) { return (kindOf[k] === 'video' ? 'Video: ' : kindOf[k] === 'audio' ? 'Audio: ' : 'Photo: ') + slotLabel(k); }
    function isImg(k) { return kindOf[k] === 'photo' || kindOf[k] === 'poster'; }
    // `value` is a URL (repo path or blob:); for the home hero's CSS background the caller passes the url("...") form.
    function showSlot(k, value, isBlob) {
      var el = slotEls[k], kind = kindOf[k];
      if (!el) return;
      if (kind === 'video') el.setAttribute('src', value);
      else if (kind === 'poster') el.setAttribute('poster', value);
      else if (kind === 'audio') {
        // The A/B deck plays from el.src (a blob it fetched, or this staged blob) and reloads from data-src.
        el.setAttribute('data-src', value);
        el.pause();
        el.src = value;
        el.preload = 'auto';
        el.load();
      } else if (el.tagName === 'IMG') { if (window.__alcoveSetImgSrc) window.__alcoveSetImgSrc(el, value); else { el.removeAttribute('srcset'); el.setAttribute('src', value); } }
      else el.style.backgroundImage = isBlob ? 'url("' + value + '")' : value;
    }
    function framed(k, on) { var box = slotEls[k] && slotEls[k].closest('.media-box'); if (box && slotBox[k]) box.classList.toggle('photo-slot', on); }
    function unstage(k) {
      var st = staged[k];
      if (!st) return;
      delete staged[k];
      showSlot(k, slotBase[k] || '');
      if (!slotBase[k] && kindOf[k] === 'photo' && slotEls[k].tagName !== 'IMG') slotEls[k].style.removeProperty('background-image');
      framed(k, true);
      URL.revokeObjectURL(st.url);
      idb('readwrite', function (store) { store.delete(k); }).catch(function () { /* nothing was kept */ });
    }
    function markSaved(k) {
      delete staged[k];
      slotBase[k] = currentValue(k); // revert target is what is shown now (the preview blob stays valid)
      slotBox[k] = false;
      idb('readwrite', function (store) { store.delete(k); }).catch(function () { /* ignore */ });
    }
    // IndexedDB holds the chosen files across a reload. Any failure rejects; callers carry on in memory.
    function idb(mode, run) {
      return new Promise(function (resolve, reject) {
        try {
          var open = indexedDB.open('alcove_admin', 1);
          open.onupgradeneeded = function () { open.result.createObjectStore('media'); };
          open.onerror = function () { reject(open.error || new Error('idb')); };
          open.onsuccess = function () {
            try {
              var db = open.result, tx = db.transaction('media', mode), st = tx.objectStore('media'), out = run(st);
              tx.oncomplete = function () { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
              tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error('idb')); };
            } catch (e) { reject(e); }
          };
        } catch (e) { reject(e); }
      });
    }
    function warnNoKeep() { mediaWarn.textContent = 'This browser cannot keep chosen files across a reload. Keep this page open until you Save, or pick the file again after reloading.'; }
    function mediaError(msg) {
      mediaErr.textContent = msg;
      if (msg && body.hidden) { toggle.setAttribute('aria-expanded', 'true'); body.hidden = false; }
    }
    function bad(msg) { var e = new Error(msg); e.user = true; return e; }
    var PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    var EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
    // Clips: extension decides the kind; a browser-reported type, when present, must agree.
    var CLIP_EXT = {
      audio: { mp3: ['audio/mpeg', 'audio/mp3'], m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'], wav: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], ogg: ['audio/ogg', 'application/ogg'], webm: ['audio/webm', 'video/webm'] },
      video: { mp4: ['video/mp4'], webm: ['video/webm'] }
    };
    var CLIP_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg' };
    var CLIP_HELP = { audio: 'That file is not audio this site can use. Choose an MP3, M4A, WAV, OGG or WebM audio file.', video: 'That file is not a video this site can use. Choose an MP4 or WebM video.' };
    function megabytes(n) { return (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB'; }
    function tooLarge(file) { return bad('That file is too large (' + megabytes(file.size) + '). The limit is ' + megabytes(MAX_MEDIA_BYTES) + '.'); }
    // Audio or video: checked by type and size only, then staged unchanged. Resolves { blob, ext }.
    function processClip(file, kind) {
      var ext = (file.name.split('.').pop() || '').toLowerCase(), table = CLIP_EXT[kind], mimes = table[ext];
      if (!mimes || (file.type && mimes.indexOf(file.type.toLowerCase()) < 0)) return Promise.reject(bad(CLIP_HELP[kind]));
      if (file.size > MAX_MEDIA_BYTES) return Promise.reject(tooLarge(file));
      var type = file.type || CLIP_MIME[ext] || (kind === 'video' ? 'video/webm' : 'audio/webm');
      return Promise.resolve({ blob: file.slice(0, file.size, type), ext: ext });
    }
    // Resolves { blob, ext }. Rejections carry a message safe to show (e.user).
    // cover = true (Sleeve covers): same type and size checks, but no SVG; shrunk to MAX_COVER_EDGE and always saved as JPEG.
    function processPhoto(file, cover) {
      var type = file.type, ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!PHOTO_TYPES[type] && !(type === '' && EXT_TYPES[ext])) return Promise.reject(bad(cover ? 'That file is not a picture this site can use. Choose a JPG, PNG or WebP image.' : 'That file is not a photo this site can use. Choose a JPG, PNG, WebP or SVG image.'));
      if (!PHOTO_TYPES[type]) type = EXT_TYPES[ext];
      if (cover && type === 'image/svg+xml') return Promise.reject(bad('A cover has to be a JPG, PNG or WebP picture.'));
      if (file.size > MAX_MEDIA_BYTES) return Promise.reject(tooLarge(file));
      var unreadable = function () { return bad('Could not read that photo. Try a different file.'); };
      if (cover) type = 'image/jpeg';
      if (type === 'image/svg+xml') {
        return file.text().then(function (t) {
          if (!/<svg[\s>]/i.test(t)) throw unreadable();
          return { blob: new Blob([file], { type: type }), ext: 'svg' };
        });
      }
      return createImageBitmap(file).catch(function () { throw unreadable(); }).then(function (bm) {
        var scale = Math.min(1, (cover ? MAX_COVER_EDGE : MAX_PHOTO_EDGE) / Math.max(bm.width, bm.height));
        var w = Math.max(1, Math.round(bm.width * scale)), h = Math.max(1, Math.round(bm.height * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');
        if (cover) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); } // a PNG with transparency must not turn black as a JPEG
        cx.drawImage(bm, 0, 0, w, h);
        if (bm.close) bm.close();
        return new Promise(function (resolve, reject) {
          c.toBlob(function (b) { if (b) resolve(b); else reject(unreadable()); }, type, 0.86);
        });
      }).then(function (blob) { return { blob: blob, ext: PHOTO_TYPES[blob.type] || PHOTO_TYPES[type] }; });
    }
    // Slug + short content hash. A big clip is hashed from its size plus its first and last 2 MB, so it is never read whole into memory.
    function newName(file, blob, ext, fallback) {
      var base = file.name.split(/[\\/]/).pop().replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || fallback;
      var EDGE = 2 * 1024 * 1024;
      var sample = blob.size > 2 * EDGE ? new Blob([blob.slice(0, EDGE), blob.slice(blob.size - EDGE), String(blob.size)]) : blob;
      var hash = (window.crypto && crypto.subtle) ? sample.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); }).then(function (d) {
        return Array.prototype.map.call(new Uint8Array(d).subarray(0, 4), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }) : Promise.resolve(Math.random().toString(16).slice(2, 10).padEnd(8, '0'));
      return hash.then(function (h) { return base + '-' + h + '.' + ext; });
    }
    function dirOf(k) { return (kindOf[k] === 'video' || kindOf[k] === 'audio') ? 'media/' : 'images/'; }
    function isBackground(k) { return kindOf[k] === 'photo' && slotEls[k].tagName !== 'IMG'; }
    function stageFile(k, blob, name) {
      if (staged[k]) { URL.revokeObjectURL(staged[k].url); }
      var url = URL.createObjectURL(blob);
      staged[k] = { blob: blob, path: dirOf(k) + name, name: name, url: url };
      showSlot(k, url, true);
      framed(k, false);
      idb('readwrite', function (store) { store.put({ blob: blob, path: dirOf(k) + name }, k); }).catch(warnNoKeep);
    }
    function choose(k, input) {
      var file = input.files && input.files[0];
      mediaError('');
      mediaWarn.textContent = '';
      if (!file) return;
      var work = isImg(k) ? processPhoto(file) : processClip(file, kindOf[k]);
      var fallback = kindOf[k] === 'video' ? 'video' : kindOf[k] === 'audio' ? 'clip' : 'photo';
      work.then(function (r) {
        return newName(file, r.blob, r.ext, fallback).then(function (name) { stageFile(k, r.blob, name); });
      }).catch(function (e) { mediaError(e && e.user ? e.message : 'Could not use that file. Try a different one.'); })
        .then(function () { input.value = ''; render(); });
    }
    // Restore files staged before a reload (this page's slots only).
    var restoreKeys = idb('readonly', function (store) {
      var out = { result: [] }, req = store.openCursor();
      req.onsuccess = function () { var c = req.result; if (c) { out.result.push({ key: c.key, value: c.value }); c.continue(); } };
      return out;
    });
    restoreKeys.then(function (rows) {
      rows.forEach(function (r) {
        var v = r.value;
        if (!(r.key in slotEls) || staged[r.key] || !v || !(v.blob instanceof Blob) || typeof v.path !== 'string' || v.path.indexOf(dirOf(r.key)) !== 0 || !DELETABLE.test(v.path) || v.path.indexOf('..') >= 0) return; // stored paths get the same whitelist as new ones
        var url = URL.createObjectURL(v.blob);
        staged[r.key] = { blob: v.blob, path: v.path, name: v.path.split('/').pop(), url: url };
        showSlot(r.key, url, true);
        framed(r.key, false);
      });
      if (rows.length) render();
    }, function () { /* no IndexedDB: nothing to restore */ });
    restoreKeys.then(function (rows) { restoreSongsDraft(rows); }, function () { restoreSongsDraft([]); });


    // ---- songs (ticket 03) ----
    var RP = window.AlcoveRecordPlayer;
    var songsOn = !!RP;
    var SONGS_DRAFT_KEY = DRAFT_PREFIX + 'songs';
    var MAX_SONGS = 20;
    var songId = 0;
    var songBase = songsOn ? RP.getSongs() : []; // what visitors get now: [{ title, file }]
    // cover = the saved path (or undefined); coverShown = a blob URL of it kept after Save (the redeploy takes a minute); cstage = a chosen, unsaved cover.
    function newSong(x) { return { id: ++songId, title: x.title, file: x.file, cover: x.cover, coverShown: null, cstage: null, staged: false, blob: null, url: null }; }
    function songEntry(x) { var o = { title: x.title.trim(), file: x.file }, c = x.cstage ? x.cstage.path : x.cover; if (c) o.cover = c; return o; }
    var coverOf = function (x) { return x.cstage ? x.cstage.url : x.coverShown || x.cover; };
    var songs = songBase.map(newSong);            // the working list the editor changes
    var songsUI = null, songErr = '', pendingFocus = null;
    var songTitle = function (x) { return x.title.trim(); };
    function songChanges() {
      if (!songsOn) return [];
      var out = [], inBase = {}, inWork = {};
      songBase.forEach(function (b) { inBase[b.file] = b; });
      songs.forEach(function (w) { inWork[w.file] = w; });
      songs.forEach(function (w) {
        if (!inBase[w.file]) out.push({ type: 'added', song: w });
        else {
          if (inBase[w.file].title !== songTitle(w)) out.push({ type: 'renamed', song: w, from: inBase[w.file].title });
          if (w.cstage) out.push({ type: 'cover', song: w });
        }
      });
      songBase.forEach(function (b, i) { if (!inWork[b.file]) out.push({ type: 'removed', base: b, index: i }); });
      var a = songBase.filter(function (b) { return inWork[b.file]; }).map(function (b) { return b.file; });
      var c = songs.filter(function (w) { return inBase[w.file]; }).map(function (w) { return w.file; });
      if (a.join('\n') !== c.join('\n')) out.push({ type: 'order' });
      return out;
    }
    function songLabel(c) {
      if (c.type === 'added') return 'Song added: ' + songTitle(c.song);
      if (c.type === 'removed') return 'Song removed: ' + c.base.title;
      if (c.type === 'renamed') return 'Song renamed: ' + c.from + ' to ' + songTitle(c.song);
      if (c.type === 'cover') return 'Cover changed: ' + songTitle(c.song);
      return 'Song order changed';
    }
    function dropCover(x) {
      if (!x.cstage) return;
      URL.revokeObjectURL(x.cstage.url);
      x.cstage = null;
      idb('readwrite', function (st) { st.delete('cover:' + x.file); }).catch(function () { /* nothing was kept */ });
    }
    function dropStagedSong(x) {
      dropCover(x);
      if (x.url) URL.revokeObjectURL(x.url);
      if (x.staged) idb('readwrite', function (st) { st.delete('song:' + x.file); }).catch(function () { /* nothing was kept */ });
    }
    function saveSongsDraft() {
      try {
        if (songChanges().length) localStorage.setItem(SONGS_DRAFT_KEY, JSON.stringify({ version: 1, songs: songs.map(function (x) { return { title: x.title, file: x.file, staged: x.staged, cpath: x.cstage ? x.cstage.path : undefined }; }) }));
        else localStorage.removeItem(SONGS_DRAFT_KEY);
      } catch (e) { /* storage blocked: edits still work in memory */ }
    }
    // Every change to the working list ends here: the Crate follows, the draft is kept, the editor and Save count refresh.
    function songsChanged(keepRows) {
      if (songsOn) RP.setSongs(songs.map(function (x) { return { title: songTitle(x) || x.prev || ' ', file: x.url || x.file, cover: coverOf(x) }; }));
      saveSongsDraft();
      if (!keepRows) renderSongs();
      render();
    }
    function revertSong(c) {
      if (c.type === 'added') { songs = songs.filter(function (x) { return x !== c.song; }); dropStagedSong(c.song); }
      else if (c.type === 'removed') songs.splice(Math.min(c.index, songs.length), 0, newSong(c.base));
      else if (c.type === 'renamed') c.song.title = c.from;
      else if (c.type === 'cover') dropCover(c.song); // back to the previous cover, or the pattern if it had none
      else {
        var order = {}, slots = [], base = [];
        songBase.forEach(function (b, i) { order[b.file] = i; });
        songs.forEach(function (w, i) { if (w.file in order) { slots.push(i); base.push(w); } });
        base.sort(function (p, q) { return order[p.file] - order[q.file]; });
        slots.forEach(function (i, k) { songs[i] = base[k]; });
      }
      songsChanged();
    }
    function markSongsSaved(chg) {
      songBase = chg.list.map(function (x) { return x.cover ? { title: x.title, file: x.file, cover: x.cover } : { title: x.title, file: x.file }; });
      songs.forEach(function (x) {
        if (x.cstage && chg.covered.indexOf(x) >= 0 && songEntry(x).cover === x.cstage.path) {
          x.cover = x.cstage.path; x.coverShown = x.cstage.url; x.cstage = null; // the preview stays; it is what the Sleeve shows until the site redeploys
          idb('readwrite', function (st) { st.delete('cover:' + x.file); }).catch(function () { /* ignore */ });
        }
        if (x.staged && chg.staged.indexOf(x) >= 0) { x.staged = false; idb('readwrite', function (st) { st.delete('song:' + x.file); }).catch(function () { /* ignore */ }); }
      });
      saveSongsDraft();
      renderSongs();
    }
    function setSongErr(t) { songErr = t || ''; if (songsUI) songsUI.msg.textContent = songMsg(); }
    function songMsg() {
      if (songErr) return songErr;
      if (songs.length >= MAX_SONGS) return 'You have ' + MAX_SONGS + ' songs, the most the Work page can show. Remove one to add another.';
      if (songs.length <= 1) return 'Keep at least one song: the last one cannot be removed.';
      return '';
    }
    function renderSongs() {
      if (!songsUI) return;
      var ui = songsUI;
      while (ui.list.firstChild) ui.list.removeChild(ui.list.firstChild);
      songs.forEach(function (x, i) {
        var li = document.createElement('li');
        li.className = 'admin-song';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'admin-song-title';
        input.maxLength = 120;
        input.value = x.title;
        input.setAttribute('aria-label', 'Title of song ' + (i + 1));
        x.prev = x.title.trim() || x.prev || '';
        var btn = function (cls, text, label, disabled, fn) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = cls;
          b.textContent = text;
          b.setAttribute('aria-label', label + ': ' + songTitle(x));
          b.dataset.label = label;
          b.disabled = disabled;
          b.addEventListener('click', fn);
          return b;
        };
        var up = btn('admin-song-up', 'Move up', 'Move up', i === 0, function () { moveSong(x, -1); });
        var down = btn('admin-song-down', 'Move down', 'Move down', i === songs.length - 1, function () { moveSong(x, 1); });
        var rm = btn('admin-song-remove', 'Remove', 'Remove', songs.length <= 1, function () { removeSong(x); });
        input.addEventListener('input', function () {
          x.title = input.value;
          if (x.title.trim()) x.prev = x.title.trim();
          [up, down, rm].forEach(function (b) { b.setAttribute('aria-label', b.dataset.label + ': ' + songTitle(x)); });
          songsChanged(true);
        });
        input.addEventListener('blur', function () {
          if (x.title.trim()) { if (x.title !== x.title.trim()) { x.title = x.title.trim(); input.value = x.title; songsChanged(true); } return; }
          x.title = x.prev || 'Untitled'; // a song always has a title
          input.value = x.title;
          songsChanged(true);
        });
        li.append(input, up, down, rm);
        ui.list.appendChild(li);
        x.row = li;
      });
      ui.add.disabled = songs.length >= MAX_SONGS;
      ui.msg.textContent = songMsg();
      if (pendingFocus) {
        var row = pendingFocus.song.row, want = row && row.querySelector(pendingFocus.cls);
        if (want && want.disabled) want = row.querySelector(pendingFocus.cls === '.admin-song-up' ? '.admin-song-down' : '.admin-song-up');
        (want || ui.title).focus();
        pendingFocus = null;
      }
    }
    function moveSong(x, d) {
      var i = songs.indexOf(x), j = i + d;
      if (i < 0 || j < 0 || j >= songs.length) return;
      songs.splice(i, 1);
      songs.splice(j, 0, x);
      pendingFocus = { song: x, cls: d < 0 ? '.admin-song-up' : '.admin-song-down' };
      setSongErr('');
      songsChanged();
    }
    function removeSong(x) {
      if (songs.length <= 1) return;
      var i = songs.indexOf(x);
      songs.splice(i, 1);
      dropStagedSong(x);
      pendingFocus = songs.length ? { song: songs[Math.min(i, songs.length - 1)], cls: '.admin-song-remove' } : null;
      setSongErr('');
      songsChanged();
    }
    // Covers: shrunk to 1200px JPEG, named images/cover-<slug>-<hash>.jpg by code, staged under cover:<song file>.
    function processCover(file) {
      return processPhoto(file, true).then(function (r) {
        return newName(file, r.blob, 'jpg', 'cover').then(function (name) { return { blob: r.blob, path: 'images/cover-' + name }; });
      });
    }
    function setCoverStage(x, blob, path) {
      if (x.cstage) URL.revokeObjectURL(x.cstage.url);
      x.cstage = { blob: blob, path: path, url: URL.createObjectURL(blob) };
      idb('readwrite', function (st) { st.put({ blob: blob, path: path }, 'cover:' + x.file); }).catch(warnNoKeep);
    }
    function addSongFromForm() {
      var ui = songsUI;
      if (!ui) return;
      var title = ui.title.value.trim(), file = ui.file.files && ui.file.files[0];
      setSongErr('');
      mediaWarn.textContent = '';
      if (songs.length >= MAX_SONGS) { setSongErr(songMsg()); return; }
      if (!title) { setSongErr('Give the song a title.'); return; }
      if (!file) { setSongErr('Choose an audio file for the song.'); return; }
      var cfile = ui.cover.files && ui.cover.files[0];
      var cover = cfile ? processCover(cfile) : Promise.resolve(null); // optional; a bad cover stops the add with its own message
      cover.then(function (cv) { return processClip(file, 'audio').then(function (r) { return { cv: cv, r: r }; }); }).then(function (both) {
        var r = both.r;
        return newName(file, r.blob, r.ext, 'song').then(function (name) {
          var path = 'media/' + name;
          if (songs.some(function (x) { return x.file === path; })) throw bad('That file is already in the list.');
          var x = newSong({ title: title, file: path });
          x.staged = true; x.blob = r.blob; x.url = URL.createObjectURL(r.blob);
          songs.push(x);
          idb('readwrite', function (st) { st.put({ blob: r.blob, path: path }, 'song:' + path); }).catch(warnNoKeep);
          if (both.cv) setCoverStage(x, both.cv.blob, both.cv.path);
          ui.title.value = '';
          ui.file.value = '';
          ui.cover.value = '';
          songsChanged();
        });
      }).catch(function (e) { setSongErr(e && e.user ? e.message : 'Could not use that file. Try a different one.'); });
    }
    function buildSongsUI() {
      var rp = document.querySelector('.record-player');
      if (!songsOn || !rp || !rp.parentNode) return;
      var sec = document.createElement('section');
      sec.className = 'admin-songs';
      sec.setAttribute('aria-labelledby', 'admin-songs-h');
      var h = document.createElement('h3');
      h.id = 'admin-songs-h';
      h.textContent = 'Songs';
      var help = document.createElement('p');
      help.className = 'admin-songs-help';
      help.textContent = 'Rename, reorder or remove songs here, or add a new one. The Crate above changes right away; Save in the Admin panel makes it live.';
      var ol = document.createElement('ol');
      ol.className = 'admin-song-list';
      var fs = document.createElement('fieldset');
      fs.className = 'admin-song-new';
      var lg = document.createElement('legend');
      lg.textContent = 'Add a song';
      var tl = document.createElement('label'), tt = document.createElement('span'), ti = document.createElement('input');
      tt.textContent = 'Title';
      ti.type = 'text'; ti.className = 'admin-song-new-title'; ti.maxLength = 80; ti.autocomplete = 'off';
      tl.append(tt, ti);
      var fl = document.createElement('label'), ft = document.createElement('span'), fi = document.createElement('input');
      ft.textContent = 'Audio file (MP3, M4A, WAV, OGG or WebM)';
      fi.type = 'file'; fi.className = 'admin-song-new-file'; fi.accept = ACCEPT.audio;
      fl.append(ft, fi);
      var cl = document.createElement('label'), ct = document.createElement('span'), ci = document.createElement('input');
      ct.textContent = 'Cover picture (optional: JPG, PNG or WebP)';
      ci.type = 'file'; ci.className = 'admin-song-new-cover'; ci.accept = 'image/jpeg,image/png,image/webp';
      cl.append(ct, ci);
      var add = document.createElement('button');
      add.type = 'button'; add.className = 'admin-song-add'; add.textContent = 'Add song';
      add.addEventListener('click', addSongFromForm);
      fs.append(lg, tl, fl, cl, add);
      var msg = document.createElement('p');
      msg.className = 'admin-song-msg';
      msg.setAttribute('role', 'alert');
      sec.append(h, help, ol, fs, msg);
      rp.parentNode.insertBefore(sec, rp.nextSibling);
      songsUI = { list: ol, title: ti, file: fi, cover: ci, add: add, msg: msg };
      renderSongs();
    }
    // Draft: titles, order and removals live in localStorage; staged audio lives in IndexedDB (restored with the other staged files).
    function restoreSongsDraft(rows) {
      var d;
      try { d = JSON.parse(localStorage.getItem(SONGS_DRAFT_KEY)); } catch (e) { return; }
      if (!songsOn || !d || d.version !== 1 || !Array.isArray(d.songs) || d.songs.length < 1 || d.songs.length > MAX_SONGS) return;
      var blobs = {}, covers = {}, inBase = {}, out = [];
      rows.forEach(function (r) {
        if (typeof r.key !== 'string' || !r.value || !(r.value.blob instanceof Blob)) return;
        if (r.key.indexOf('song:') === 0) blobs[r.key.slice(5)] = r.value.blob;
        else if (r.key.indexOf('cover:') === 0) covers[r.key.slice(6)] = r.value; // { blob, path }
      });
      songBase.forEach(function (b) { inBase[b.file] = b; });
      d.songs.forEach(function (e) {
        if (!e || typeof e.title !== 'string' || !e.title.trim() || typeof e.file !== 'string' || e.file.indexOf('media/') !== 0 || !DELETABLE.test(e.file) || e.file.indexOf('..') >= 0) return;
        if (out.some(function (x) { return x.file === e.file; })) return;
        var x = newSong({ title: e.title.trim(), file: e.file, cover: inBase[e.file] && inBase[e.file].cover });
        if (inBase[e.file]) out.push(x);
        else if (blobs[e.file]) { x.staged = true; x.blob = blobs[e.file]; x.url = URL.createObjectURL(x.blob); out.push(x); }
        var cv = covers[e.file]; // a staged cover comes back only with the same whitelist as a new one
        if (out.indexOf(x) >= 0 && typeof e.cpath === 'string' && cv && cv.path === e.cpath && e.cpath.indexOf('images/cover-') === 0 && DELETABLE.test(e.cpath) && e.cpath.indexOf('..') < 0) setCoverStage(x, cv.blob, cv.path);
      });
      if (!out.length) return;
      songs = out;
      songsChanged();
    }

    // ---- Replace cover (ticket 06): one button over the Sleeve sticking out of the pile ----
    var coverUI = null;
    function songOfFront() {
      var f = RP && RP.getFront && RP.getFront();
      if (!f) return null;
      return songs.filter(function (x) { return (x.url || x.file) === f.dataset.src; })[0] || null;
    }
    function placeCover() {
      var ui = coverUI, f = RP.getFront(), x = songOfFront();
      if (!ui) return;
      ui.btn.hidden = !f || !x;
      if (ui.btn.hidden) return;
      var r = f.getBoundingClientRect(), sr = ui.stage.getBoundingClientRect();
      ui.btn.setAttribute('aria-label', 'Replace cover: ' + (songTitle(x) || x.prev || 'song'));
      ui.btn.style.left = Math.max(4, r.left - sr.left + r.width * 0.06) + 'px'; // over the visible left part of the Sleeve
      ui.btn.style.top = (r.top - sr.top + (r.height - ui.btn.offsetHeight) / 2) + 'px';
    }
    // The Sleeve slides for about half a second after a flip: follow it frame by frame, then stop.
    function followCover() {
      var ui = coverUI;
      if (!ui) return;
      ui.until = performance.now() + 700;
      if (ui.raf) return;
      var tick = function () { ui.raf = 0; placeCover(); if (coverUI === ui && performance.now() < ui.until) ui.raf = requestAnimationFrame(tick); };
      tick();
    }
    function chooseCover() {
      var ui = coverUI, x = songOfFront(), file = ui && ui.input.files && ui.input.files[0];
      mediaError('');
      mediaWarn.textContent = '';
      if (!file || !x) { if (ui) ui.input.value = ''; return; }
      processCover(file).then(function (c) {
        if (songs.indexOf(x) < 0) return; // the song was removed meanwhile
        setCoverStage(x, c.blob, c.path);
        songsChanged(true);
      }).catch(function (e) { mediaError(e && e.user ? e.message : 'Could not use that file. Try a different one.'); })
        .then(function () { if (ui) ui.input.value = ''; render(); });
    }
    function buildCoverUI() {
      var rp = document.querySelector('.record-player'), stage = rp && rp.querySelector('.rp-stage');
      if (!songsOn || !stage || !RP.getFront) return;
      var input = document.createElement('input');
      input.type = 'file'; input.className = 'admin-cover-input'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; input.tabIndex = -1;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'admin-cover-replace'; btn.textContent = 'Replace cover';
      btn.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', chooseCover);
      stage.append(btn, input);
      var ui = coverUI = { btn: btn, input: input, stage: stage, rp: rp, until: 0, raf: 0, follow: followCover };
      rp.addEventListener('rp-layout', ui.follow);
      window.addEventListener('resize', ui.follow);
      followCover();
    }
    function teardownCover() {
      var ui = coverUI;
      coverUI = null;
      if (!ui) return;
      ui.rp.removeEventListener('rp-layout', ui.follow);
      window.removeEventListener('resize', ui.follow);
      if (ui.raf) cancelAnimationFrame(ui.raf);
    }

    // Replace controls exist only while Edit mode is on.
    var ACCEPT = {
      photo: 'image/jpeg,image/png,image/webp,image/svg+xml',
      audio: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.webm',
      video: 'video/mp4,video/webm,.mp4,.webm'
    };
    function syncControls(on) {
      Array.prototype.forEach.call(document.querySelectorAll('.admin-replace, .admin-replace-input, .admin-songs, .admin-cover-replace, .admin-cover-input'), function (n) { n.remove(); });
      songsUI = null;
      teardownCover();
      Array.prototype.forEach.call(document.querySelectorAll('.admin-media-host'), function (n) { n.classList.remove('admin-media-host'); });
      if (!on) return;
      buildSongsUI();
      buildCoverUI();
      Object.keys(slotEls).forEach(function (k) {
        var el = slotEls[k], kind = kindOf[k];
        var host = kind === 'audio' ? (el.closest('.ab-player') || el.parentElement) : kind === 'video' || kind === 'poster' ? (el.closest('.media-box') || el.parentElement) : el.tagName === 'IMG' ? (el.closest('.media-box') || el.parentElement) : el.parentElement;
        if (!host) return;
        host.classList.add('admin-media-host');
        var input = document.createElement('input');
        input.type = 'file';
        input.className = 'admin-replace-input';
        input.accept = ACCEPT[isImg(k) ? 'photo' : kind];
        input.hidden = true;
        input.tabIndex = -1;
        input.dataset.for = k;
        input.addEventListener('change', function () { choose(k, input); });
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'admin-replace';
        b.dataset.for = k;
        b.dataset.kind = kind === 'audio' ? (k.slice(-5) === '.memo' ? 'memo' : 'master') : kind;
        b.textContent = kind === 'video' ? 'Replace video' : kind === 'poster' ? 'Replace poster' : kind === 'audio' ? (b.dataset.kind === 'memo' ? 'Replace memo' : 'Replace master') : el.tagName === 'IMG' ? 'Replace photo' : 'Replace hero photo';
        b.setAttribute('aria-label', 'Replace ' + (kind === 'photo' ? 'photo: ' : '') + slotLabel(k));
        b.addEventListener('click', function () { input.click(); });
        host.append(b, input);
      });
    }

    loadDraft();
    Object.keys(draft).forEach(function (k) { setAll(k, draft[k]); });

    // Edit mode on: keyed text becomes outlined, focusable, plain-text editable. Off: the elements are untouched again.
    var unhidden = []; // aria-hidden ancestors opened while editing (focusable text must not sit inside one)
    function setEdit(on) {
      editOn = on;
      try { sessionStorage.setItem(EDIT_KEY, on ? '1' : '0'); } catch (e) { /* remembered only in memory */ }
      if (!on && document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-edit-key]')) document.activeElement.blur();
      els.forEach(function (el) {
        if (on) {
          el.setAttribute('data-admin-edit', '');
          el.setAttribute('contenteditable', 'plaintext-only');
          if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); // older engines: paste/Enter handled below
          el.tabIndex = 0;
          el.spellcheck = true;
          var h = el.closest('[aria-hidden="true"]');
          if (h && unhidden.indexOf(h) < 0) { h.removeAttribute('aria-hidden'); unhidden.push(h); }
        } else {
          el.removeAttribute('data-admin-edit');
          el.removeAttribute('contenteditable');
          el.removeAttribute('tabindex');
          el.removeAttribute('spellcheck');
        }
      });
      syncControls(on);
      if (!on) { unhidden.forEach(function (h) { h.setAttribute('aria-hidden', 'true'); }); unhidden = []; }
      render();
    }
    editSwitch.addEventListener('click', function () { setEdit(!editOn); });

    els.forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (!editOn) return;
        if (e.key === 'Enter') e.preventDefault();          // headings and paragraphs stay single text
        else if (e.key === 'Escape') el.blur();
        else if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Inside a <button> or <summary> the browser treats Space as "activate" and types nothing; insert it ourselves.
          e.preventDefault();
          document.execCommand('insertText', false, ' ');
        }
      });
      // A space typed inside a button or summary must not activate it.
      el.addEventListener('keyup', function (e) { if (editOn) e.stopPropagation(); });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = oneLine((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
        if (t) document.execCommand('insertText', false, t);
      });
      el.addEventListener('drop', function (e) { e.preventDefault(); });
      el.addEventListener('input', function () { record(el); });
      el.addEventListener('blur', function () {
        if (!editOn) return;
        var k = el.dataset.editKey;
        var t = el.textContent.trim();
        if (!t) t = base[k];             // an empty heading would break structure
        if (t !== el.textContent) el.textContent = t;
        record(el);
      });
    });
    // While Edit mode is on, a click on text (or on the button, link or tab that holds it) edits the text instead of
    // running the control: no navigation, no play, no filter change. Capture phase, so the control's own handlers never run.
    document.addEventListener('click', function (e) {
      if (!editOn || !e.target.closest) return;
      var hit = e.target.closest('[data-edit-key]');
      if (!hit) {
        var host = e.target.closest('a, button, summary, [role="switch"], [role="button"]');
        if (!host || panel.contains(host)) return;
        hit = host.querySelector('[data-edit-key]');
        if (!hit) return; // a control with no editable text (transport keys) keeps working
      }
      e.preventDefault();
      e.stopPropagation();
      if (hit !== e.target.closest('[data-edit-key]')) hit.focus();
    }, true);

    window.addEventListener('beforeunload', function (e) {
      if (!count() || skipWarn) return;
      e.preventDefault();
      e.returnValue = '';
    });

    setEdit(editOn);
  }

  // content-loader.js holds the page until saved text is applied; baseline must be the saved wording.
  if (document.documentElement.hasAttribute('data-content-pending')) {
    var mo = new MutationObserver(function () {
      if (!document.documentElement.hasAttribute('data-content-pending')) { mo.disconnect(); start(); }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-content-pending'] });
  } else start();
})();
