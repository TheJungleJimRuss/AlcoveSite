// Contact page booking form: validation, Demo file list, direct-to-Drive chunked upload, then the Inquiry POST.
// Flow (ADR 0002): startUpload -> PUT chunks to Drive -> submitInquiry. Not-connected placeholder makes no requests.
(() => {
  const form = document.getElementById('booking-form');
  if (!form) return;
  const status = document.getElementById('booking-status');
  const button = form.querySelector('button[type="submit"]');
  const phone = form.elements.artistPhone;
  const demoInput = document.getElementById('demo-input');
  const demoDrop = document.getElementById('demo-drop');
  const demoBrowse = document.getElementById('demo-browse');
  const demoList = document.getElementById('demo-list');
  const demoError = document.getElementById('demo-error');
  const progress = document.getElementById('demo-progress');

  const MAX_FILES = 3;
  const MAX_BYTES = 250 * 1024 * 1024;
  const CHUNK = 8 * 1024 * 1024; // must stay a multiple of 256KB (Drive resumable requirement)
  const EXTENSIONS = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'mp4', 'mov', 'webm'];
  const COPY = {
    sending: 'Sending…',
    success: "Thanks! Your message is on its way to Seth. He'll get back to you within 24–48 hours.",
    error: 'Something went wrong sending your message. Please try again, or email Seth directly.',
    uploadError: "Your Demo didn't finish uploading. Everything you typed is still here. Press Try again to pick up where it left off, or email Seth directly.",
    retrying: 'Connection hiccup. Retrying…',
    tryAgain: 'Try again',
    notConnected: "Online booking isn't connected yet. Please email Seth using the direct contact details below.",
    phoneShort: 'Enter a US phone number with 10 digits, like (555) 123-4567.',
    noDemo: 'Add at least one Demo so Seth can hear your music. A phone voice memo is perfect.',
    tooMany: `You can attach up to ${MAX_FILES} Demos. Remove one to add another.`,
  };
  const wrongType = (n) => `${n} isn't a supported type. Use an audio file (m4a, mp3, wav, aac, ogg) or a video (mp4, mov, webm).`;
  const tooBig = (n) => `${n} is over 250MB. Try a shorter clip or a smaller file.`;
  const empty = (n) => `${n} looks empty. Pick a different file.`;
  const unreadable = (n) => `${n} couldn't be read. Save the recording on your phone first, then pick it with Browse Files.`;
  const SNAPSHOT_MAX = 64 * 1024 * 1024;

  // The form ships hidden so nothing can post without JavaScript; the noscript notice covers that case.
  form.hidden = false;
  form.noValidate = true; // the submit handler runs reportValidity itself, so the Demo check can run alongside the field checks

  const setStatus = (state, text) => {
    status.dataset.state = state;
    status.textContent = text;
  };

  // aria-invalid + error message linking, only while :user-invalid
  const syncField = (el) => {
    const id = el.dataset && el.dataset.error;
    if (!id) return;
    const invalid = el.matches(':user-invalid');
    if (invalid) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter((t) => t && t !== id);
    if (invalid) ids.push(id);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };
  ['blur', 'input', 'change'].forEach((t) => form.addEventListener(t, (e) => syncField(e.target), true));
  form.addEventListener('invalid', (e) => setTimeout(() => syncField(e.target), 0), true);

  // phone: US numbers only, in any format. 10 digits (area code can't start with 0 or 1), optionally led by the country code 1.
  // A leading "+" must be "+1", so a 10-digit number from another country can't slip through.
  const isUsPhone = (value) => {
    const v = value.trim();
    const digits = v.replace(/\D/g, '');
    if (v.startsWith('+') && digits.length !== 11) return false;
    return /^1?[2-9]\d{9}$/.test(digits);
  };
  const checkPhone = () => {
    phone.setCustomValidity(phone.value.trim() && !isUsPhone(phone.value) ? COPY.phoneShort : '');
  };
  // Formats as the artist types: (555) 123-4567, or +1 (555) 123-4567 when it starts with 1. A number that can't be a US
  // number (another country code, too many digits) is left as typed, so the error message explains it instead.
  const formatPhone = (value) => {
    let d = value.replace(/\D/g, '');
    if (value.trim().startsWith('+') && d[0] !== '1') return value;
    let cc = '';
    if (d[0] === '1') { cc = '+1'; d = d.slice(1); }
    if (d.length > 10) return value;
    const body = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
      : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}`
      : d.length ? `(${d}` : '';
    return cc && body ? `${cc} ${body}` : cc || body;
  };
  phone.addEventListener('input', (e) => {
    if (!e.isComposing) {
      const before = phone.value;
      const atEnd = phone.selectionStart === before.length;
      const digitsBefore = before.slice(0, phone.selectionStart).replace(/\D/g, '').length;
      const next = formatPhone(before);
      if (next !== before) {
        phone.value = next;
        let pos = next.length;
        if (!atEnd) { // keep the caret after the same digit it was after
          pos = 0;
          for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++;
        }
        phone.setSelectionRange(pos, pos);
      }
    }
    checkPhone();
  });
  checkPhone();

  // ---- Demo file list ----
  let files = [];
  let busy = false;
  let job = null; // upload sessions + progress kept after a failure so "Try again" resumes instead of restarting
  const idleLabel = button.textContent;
  const locked = () => busy || !!job; // the file list is frozen while an upload is in flight or waiting on Try again

  const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const showDemoError = (msgs) => {
    demoError.textContent = msgs.join(' ');
    demoError.hidden = !msgs.length;
    demoBrowse.setAttribute('aria-describedby', msgs.length ? 'demo-hint demo-error' : 'demo-hint');
  };
  const renderList = () => {
    demoList.replaceChildren(...files.map((f, i) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'demo-name';
      name.textContent = f.name;
      const size = document.createElement('span');
      size.className = 'demo-size';
      size.textContent = fmtSize(f.size);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'demo-remove';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', `Remove ${f.name}`);
      rm.disabled = locked();
      rm.addEventListener('click', () => {
        files.splice(i, 1);
        renderList();
        showDemoError([]);
        demoBrowse.focus();
      });
      li.append(name, size, rm);
      return li;
    }));
  };
  // A recording made on the spot (Android sound recorder, camera) can be a temporary file that the browser can no longer
  // read, or whose size has changed, by the time Send is pressed. So copy small files into memory as soon as they are added.
  let pending = Promise.resolve();
  const snapshot = (f) => {
    if (f.size > SNAPSHOT_MAX) return;
    const done = f.arrayBuffer().then((buf) => {
      const i = files.indexOf(f);
      if (i === -1) return;
      if (!buf.byteLength) throw new Error('empty');
      files[i] = new File([buf], f.name, { type: f.type, lastModified: f.lastModified });
      if (files[i].size !== f.size) renderList();
    }).catch(() => {
      const i = files.indexOf(f);
      if (i === -1) return;
      files.splice(i, 1);
      renderList();
      showDemoError([unreadable(f.name)]);
    });
    pending = pending.then(() => done);
  };
  const addFiles = (incoming) => {
    if (locked()) return;
    const msgs = [];
    for (const f of incoming) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const mimeOk = !f.type || /^(audio|video)\//.test(f.type);
      if (!EXTENSIONS.includes(ext) || !mimeOk) msgs.push(wrongType(f.name));
      else if (f.size === 0) msgs.push(empty(f.name));
      else if (f.size > MAX_BYTES) msgs.push(tooBig(f.name));
      else if (files.length >= MAX_FILES) { if (!msgs.includes(COPY.tooMany)) msgs.push(COPY.tooMany); }
      else { files.push(f); snapshot(f); }
    }
    renderList();
    showDemoError(msgs);
  };
  // Files only on Android: Chrome adds Camera, Camcorder and Sound Recorder to the chooser whenever `accept` holds an audio
  // or video type (extensions count too). A lone generic type opens the plain Files picker, unfiltered; addFiles still
  // checks the type. Source: Chromium ui/android SelectFileDialog.java (acceptsType / GENERIC_TYPE).
  if (/Android/i.test(navigator.userAgent)) demoInput.accept = 'application/octet-stream';
  demoBrowse.addEventListener('click', () => demoInput.click());
  demoInput.addEventListener('change', () => {
    addFiles([...demoInput.files]);
    demoInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) => demoDrop.addEventListener(t, (e) => { e.preventDefault(); if (!locked()) demoDrop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach((t) => demoDrop.addEventListener(t, (e) => { e.preventDefault(); demoDrop.classList.remove('is-dragover'); }));
  demoDrop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  form.addEventListener('reset', () => { files = []; job = null; button.textContent = idleLabel; syncLock(); renderList(); showDemoError([]); progress.hidden = true; progress.value = 0; });

  // ---- Network ----
  const post = async (data) => {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
    });
    const json = res.ok ? await res.json() : null;
    if (!json || json.ok !== true) throw new Error(`Booking request failed (${res.status})`);
    return json;
  };

  // One PUT of bytes [start, end) to a Drive resumable session. Resolves { status, range, text }.
  const putChunk = (url, blob, start, end, total, onBytes, query = false) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Range', query ? `bytes */${total}` : `bytes ${start}-${end - 1}/${total}`);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.status === 308 ? xhr.getResponseHeader('Range') : null, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(query ? null : blob.slice(start, end));
  });

  // Asks Drive how many bytes it has (empty PUT with "bytes */total"). Resolves { id } if the file is already complete, else { offset }.
  const queryOffset = async (url, size) => {
    const res = await putChunk(url, new Blob([]), 0, 0, size, () => {}, true);
    if (res.status === 200 || res.status === 201) return { id: JSON.parse(res.text || '{}').id || null, offset: size };
    if (res.status === 308) {
      const m = /bytes=0-(\d+)/.exec(res.range || '');
      return { offset: m ? Number(m[1]) + 1 : 0 };
    }
    throw retryable(`Offset query failed (${res.status})`, res.status);
  };
  const retryable = (msg, status) => Object.assign(new Error(msg), { fatal: status >= 400 && status < 500 && status !== 408 && status !== 429 });
  const delays = () => window.__bookingRetryDelays || [1000, 3000, 7000];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Uploads one file in CHUNK pieces, keeping its resume state on `p` ({ offset, id }); returns the Drive file id.
  // A network error or 5xx asks Drive for the real offset and carries on, a few times with backoff. A 4xx (expired session) is fatal.
  const uploadFile = async (file, url, p, onBytes, onRetry) => {
    let fails = 0;
    let needQuery = false;
    while (!p.id) {
      try {
        if (needQuery) {
          const q = await queryOffset(url, file.size);
          needQuery = false;
          if (q.id) { p.id = q.id; break; }
          p.offset = q.offset;
          onBytes(p.offset);
        }
        const end = Math.min(p.offset + CHUNK, file.size);
        const base = p.offset;
        const res = await putChunk(url, file, base, end, file.size, (loaded) => onBytes(base + loaded));
        if (res.status === 200 || res.status === 201) {
          const id = JSON.parse(res.text || '{}').id;
          if (!id) throw new Error('Drive did not return a file id');
          p.id = id;
          onBytes(file.size);
          break;
        }
        if (res.status !== 308) throw retryable(`Upload failed (${res.status})`, res.status);
        const m = /bytes=0-(\d+)/.exec(res.range || '');
        const next = m ? Number(m[1]) + 1 : 0;
        if (next <= base) throw new Error('Upload made no progress');
        p.offset = next;
        onBytes(next);
        fails = 0;
      } catch (err) {
        const wait = delays()[fails];
        if (err.fatal || wait === undefined) throw err;
        fails++;
        needQuery = true;
        onRetry();
        await sleep(wait);
      }
    }
    return p.id;
  };

  const warnUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
  const syncLock = () => {
    demoBrowse.disabled = locked();
    demoList.querySelectorAll('button').forEach((b) => { b.disabled = locked(); });
  };
  const setBusy = (on) => {
    busy = on;
    button.disabled = on;
    syncLock();
    if (on) window.addEventListener('beforeunload', warnUnload);
    else window.removeEventListener('beforeunload', warnUnload);
  };

  const TEXT_FIELDS = ['contactName', 'artistName', 'artistEmail', 'artistPhone', 'experienceLevel', 'sessionType', 'anythingElse', 'website'];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true; // hold off a second press while the last in-memory copies finish
    await pending;
    busy = false;
    const fieldsOk = form.reportValidity();
    if (!files.length) {
      showDemoError([COPY.noDemo]);
      if (fieldsOk) demoBrowse.focus();
    }
    if (!fieldsOk || !files.length) return;
    if (form.action.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
      setStatus('error', COPY.notConnected);
      status.focus();
      return;
    }
    let stage = 'upload';
    setBusy(true);
    button.textContent = COPY.sending;
    progress.hidden = false;
    try {
      const fields = Object.fromEntries(TEXT_FIELDS.map((k) => [k, form.elements[k].value]));
      const resuming = !!job;
      if (!job) {
        setStatus('pending', 'Getting ready to upload your Demo…');
        progress.value = 0;
        const sent = files.slice();
        const start = await post({
          action: 'startUpload',
          website: fields.website,
          origin: location.origin, // Apps Script can't read request headers; Drive needs it to allow the browser PUTs
          files: sent.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        });
        if (!Array.isArray(start.uploads) || start.uploads.length !== sent.length || !start.inquiryId) throw new Error('No upload slots returned');
        job = { start, sent, items: sent.map(() => ({ offset: 0, id: null })) };
      }
      const { start, sent, items } = job;

      const total = sent.reduce((n, f) => n + f.size, 0);
      const doneBytes = (i) => (items[i].id ? sent[i].size : items[i].offset);
      const plural = sent.length > 1 ? 's' : '';
      let lastAnnounced = 0;
      const report = (i, n) => {
        const sum = sent.reduce((acc, _, k) => acc + (k === i ? Math.max(n, items[k].offset) : doneBytes(k)), 0);
        const pct = Math.min(100, Math.floor((sum / total) * 100));
        progress.value = Math.max(progress.value, pct);
        if (pct >= lastAnnounced + 10 || pct === 100) { // announce in 10% steps, not every tick
          lastAnnounced = pct;
          setStatus('pending', `Uploading your Demo${plural}… ${pct}%`);
        }
      };
      setStatus('pending', `${resuming ? 'Resuming' : 'Uploading'} your Demo${plural}… ${Math.floor(progress.value)}%`);
      for (let i = 0; i < sent.length; i++) {
        await uploadFile(sent[i], start.uploads[i].uploadUrl, items[i], (n) => report(i, n), () => setStatus('pending', COPY.retrying)).catch((err) => {
          if (err.fatal) job = null; // the upload session is gone, so Try again must start fresh
          throw err;
        });
      }

      stage = 'send';
      setStatus('pending', COPY.sending);
      await post({ action: 'submitInquiry', inquiryId: start.inquiryId, ...fields, fileIds: items.map((p) => p.id) });
      job = null;
      form.reset();
      setStatus('success', COPY.success);
    } catch (err) {
      console.warn('Booking form submit failed:', err);
      // contact.html?debug shows the technical reason, for support on phones where the console can't be seen
      const detail = /[?&]debug\b/.test(location.search) ? ` [${stage}: ${err && err.message}]` : '';
      setStatus('error', (stage === 'upload' ? COPY.uploadError : COPY.error) + detail);
      progress.hidden = true;
    } finally {
      setBusy(false);
      button.textContent = job ? COPY.tryAgain : idleLabel;
      status.focus();
    }
  });
})();
