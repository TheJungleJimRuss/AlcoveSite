/**
 * Admin mode (ticket 02): loaded by content-loader.js only when an editor token is stored.
 * Plain-text in-place editing of [data-edit-key] elements, a changes panel with per-item revert,
 * per-page drafts in localStorage, a leave-page warning while dirty. Save (ticket 03) pushes the merged content.json to the
 * `content` branch through the GitHub contents API; the token only ever goes to api.github.com in the Authorization header.
 * Ticket 04: a Site Defaults panel (selects built from window.AlcoveTheme, defined in theme-preview.js) with live preview;
 * unsaved choices are a draft under their own key and are saved together with text edits under `defaults`.
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
  var DRAFT_KEY = DRAFT_PREFIX + (location.pathname.split('/').pop() || 'index.html');

  function start() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-edit-key]'));
    var byKey = {};
    var base = {};   // saved wording at unlock time: the revert target
    els.forEach(function (el) { if (!(el.dataset.editKey in byKey)) { byKey[el.dataset.editKey] = el; base[el.dataset.editKey] = el.textContent; } });
    var draft = {};  // key -> edited text, only where it differs from base

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
    var count = function () { return Object.keys(draft).length + Object.keys(defChanges()).length; };

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
    body.append(status, list, defs, actions, note);
    panel.append(toggle, body);
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
      status.textContent = n ? n + (n === 1 ? ' unsaved change' : ' unsaved changes') + '.' : 'No changes yet. Click any outlined text to edit it, or pick Site Defaults below.';
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
          byKey[k].textContent = base[k];
          delete draft[k];
          saveDraft();
          render();
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
      if (payload) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(payload); }
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
    var loadedBase = window.__alcoveBase || { sha: null, text: {}, defaults: {} };
    function conflict() { var e = new Error('conflict'); e.status = 409; return e; }
    function push(changes, defChg) {
      var merged;
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
          var clash = Object.keys(changes).some(function (k) { return lt[k] !== loadedBase.text[k]; }) ||
            Object.keys(defChg).some(function (k) { return ld[k] !== loadedBase.defaults[k]; });
          if (clash) throw conflict();
        }
        var text = (file.text && typeof file.text === 'object' && !Array.isArray(file.text)) ? file.text : {};
        Object.keys(changes).forEach(function (k) { text[k] = changes[k]; });
        file.text = text;
        if (!file.defaults || typeof file.defaults !== 'object' || Array.isArray(file.defaults)) file.defaults = {};
        Object.keys(defChg).forEach(function (k) { file.defaults[k] = defChg[k]; });
        var nt = Object.keys(changes).length, nd = Object.keys(defChg).length, parts = [];
        if (nt) parts.push(nt + (nt === 1 ? ' text change' : ' text changes'));
        if (nd) parts.push(nd + (nd === 1 ? ' default' : ' defaults'));
        var body = { message: 'Update site content (' + parts.join(', ') + ')', content: utf8.enc(JSON.stringify(file, null, 2) + '\n'), branch: BRANCH };
        if (sha) body.sha = sha;
        merged = { text: JSON.parse(JSON.stringify(file.text)), defaults: JSON.parse(JSON.stringify(file.defaults)) };
        return call('PUT', '/contents/content.json', body);
      }).then(function (p) {
        if (p.status !== 200 && p.status !== 201) throw httpError(p.status);
        loadedBase = { sha: p.data && p.data.content && p.data.content.sha, text: merged.text, defaults: merged.defaults };
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
      saving = true;
      setNote('Saving…');
      render();
      push(changes, defChg).then(function () {
        Object.keys(changes).forEach(function (k) {
          base[k] = changes[k];
          if (draft[k] === changes[k]) delete draft[k];
        });
        saveDraft();
        Object.keys(defChg).forEach(function (n) { savedDef[n] = defChg[n]; });
        saveDefDraft();
        setNote('Saved to the content branch. Changes go live after the developer merges to main.');
      }).catch(function (e) {
        var conflict = e && (e.status === 409 || e.status === 422);
        setNote(explain(e), conflict);
      }).then(function () { saving = false; render(); });
    });

    signOut.addEventListener('click', function () {
      if (count() && !window.confirm('Sign out and discard ' + count() + ' unsaved ' + (count() === 1 ? 'change' : 'changes') + '?')) return;
      try {
        localStorage.removeItem(TOKEN_KEY);
        Object.keys(localStorage).filter(function (k) { return k.indexOf(DRAFT_PREFIX) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }
      draft = {}; // nothing left to warn about
      chosen = savedDef; // defaults drafts are cleared with the other drafts above
      location.reload();
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
      if (t !== base[k]) draft[k] = t; else delete draft[k];
      saveDraft();
      render();
    }

    loadDraft();
    Object.keys(draft).forEach(function (k) { byKey[k].textContent = draft[k]; });

    els.forEach(function (el) {
      el.setAttribute('data-admin-edit', '');
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); // older engines: paste/Enter handled below
      el.tabIndex = 0;
      el.spellcheck = true;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') e.preventDefault();          // headings and paragraphs stay single text
        else if (e.key === 'Escape') el.blur();
      });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = oneLine((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
        if (t) document.execCommand('insertText', false, t);
      });
      el.addEventListener('drop', function (e) { e.preventDefault(); });
      el.addEventListener('input', function () { record(el); });
      el.addEventListener('blur', function () {
        var k = el.dataset.editKey;
        var t = el.textContent.trim();
        if (!t) t = base[k];             // an empty heading would break structure
        if (t !== el.textContent) el.textContent = t;
        record(el);
      });
    });
    // Editable text inside a link, <details> summary or button must not navigate or toggle while editing.
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-edit-key]')) e.preventDefault();
    }, true);

    window.addEventListener('beforeunload', function (e) {
      if (!count() || skipWarn) return;
      e.preventDefault();
      e.returnValue = '';
    });

    render();
  }

  // content-loader.js holds the page until saved text is applied; baseline must be the saved wording.
  if (document.documentElement.hasAttribute('data-content-pending')) {
    var mo = new MutationObserver(function () {
      if (!document.documentElement.hasAttribute('data-content-pending')) { mo.disconnect(); start(); }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-content-pending'] });
  } else start();
})();
