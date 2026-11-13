/**
 * Alcove Recording: booking inquiry backend (Google Apps Script, V8).
 * Deploy as a Web app (Execute as: Me, Access: Anyone). See docs/booking-setup.md.
 */
const CONFIG = {
  NOTIFY_EMAIL: 'alexanderjruss@gmail.com', // swap for Seth's at handoff
  NOTIFY_PHONE: '+1XXXXXXXXXX',             // placeholder, E.164 format
  SHEET_NAME: 'Alcove Booking Inquiries',
  MAX_FIELD_CHARS: 5000,
  MAX_FILES: 3,
  MAX_BYTES: 250 * 1024 * 1024,
  EXTENSIONS: ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'mp4', 'mov', 'webm'],
  ROOT_FOLDER_NAME: 'Alcove Demos',
};

const LABELS = {
  contactName: 'Name',
  artistName: 'Artist / band',
  artistEmail: 'Email',
  artistPhone: 'Phone',
  experienceLevel: 'Experience level',
  sessionType: 'Session type',
  anythingElse: 'Anything else?',
};

function doPost(e) {
  try {
    const raw = parseRequest_(e);
    if (raw.action === 'startUpload') return startUpload_(raw);
    if (raw.action === 'submitInquiry') return submitInquiry_(cleanFields_(raw), raw);
    return json_({ ok: false, error: 'Unknown request' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: err.userMessage || 'Server error' });
  }
}

// Step 1: open one Drive resumable upload session per file; the browser PUTs the bytes straight to Drive.
// Apps Script can't see request headers, so the page sends its own origin and we pass it on to Drive (CORS).
// Abuse guard: honeypot, file count/size/type caps, and an optional origin allowlist (Script Property ALLOWED_ORIGINS,
// comma-separated, e.g. https://alcoverecording.com). Abandoned uploads are swept daily by cleanStaging().
function startUpload_(raw) {
  if (raw.website) return json_({ ok: true, inquiryId: '', uploads: [] }); // honeypot: no slots, no hints
  const files = Array.isArray(raw.files) ? raw.files : [];
  if (files.length < 1 || files.length > CONFIG.MAX_FILES) return json_({ ok: false, error: 'Please attach 1 to ' + CONFIG.MAX_FILES + ' Demos.' });
  const origin = /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(String(raw.origin || '')) ? String(raw.origin) : '';
  const allowed = String(setting_('ALLOWED_ORIGINS') || '').split(',').map(function (o) { return o.trim(); }).filter(Boolean);
  if (allowed.length && allowed.indexOf(origin) === -1) return json_({ ok: false, error: 'Uploads are not available from this page.' });
  const inquiryId = Utilities.getUuid();
  const parent = stagingFolder_().getId();
  const token = ScriptApp.getOAuthToken();
  const uploads = files.map(function (f) {
    const name = String(f && f.name || '').slice(0, 200);
    const size = Number(f && f.size);
    const type = String(f && f.type || 'application/octet-stream');
    const ext = (name.split('.').pop() || '').toLowerCase();
    const badType = type !== 'application/octet-stream' && !/^(audio|video)\//.test(type);
    if (!name || CONFIG.EXTENSIONS.indexOf(ext) === -1 || badType) {
      throw userError_('One of those files is not a supported audio or video type.');
    }
    if (!(size > 0) || size > CONFIG.MAX_BYTES) throw userError_('Each Demo must be under 250MB.');
    const headers = {
      Authorization: 'Bearer ' + token,
      'X-Upload-Content-Type': type || 'application/octet-stream',
      'X-Upload-Content-Length': String(size),
    };
    if (origin) headers.Origin = origin;
    const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: headers,
      payload: JSON.stringify({ name: name, parents: [parent], appProperties: { inquiryId: inquiryId } }),
      muteHttpExceptions: true,
    });
    const url = res.getHeaders().Location || res.getHeaders().location;
    if (res.getResponseCode() !== 200 || !url) throw userError_('Could not start the upload. Please try again.');
    return { name: name, uploadUrl: url };
  });
  return json_({ ok: true, inquiryId: inquiryId, uploads: uploads });
}

const STAGING_MAX_AGE_HOURS = 24;

/** Daily job: trashes staging files older than 24 hours (Demos that never became part of a sent Inquiry). */
function cleanStaging() {
  const cutoff = Date.now() - STAGING_MAX_AGE_HOURS * 3600 * 1000;
  const it = stagingFolder_().getFiles();
  let removed = 0;
  while (it.hasNext()) {
    const f = it.next();
    if (f.getDateCreated().getTime() < cutoff) { f.setTrashed(true); removed++; }
  }
  console.log('cleanStaging: trashed ' + removed + ' file(s)');
  return removed;
}

/** Run once from the editor: installs the daily cleanStaging trigger (safe to re-run). */
function installCleanupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanStaging') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanStaging').timeBased().everyDays(1).atHour(3).create();
}

function userError_(msg) {
  const err = new Error(msg);
  err.userMessage = msg;
  return err;
}

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('ROOT_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function stagingFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('STAGING_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = rootFolder_().createFolder('staging');
  props.setProperty('STAGING_FOLDER_ID', folder.getId());
  return folder;
}

// Confirms each id is a staging file tagged with this inquiryId; returns [{id, name, size, url}].
function verifyDemos_(inquiryId, ids) {
  if (!/^[0-9a-f-]{36}$/.test(inquiryId || '')) throw userError_('Upload not recognised. Please try again.');
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > CONFIG.MAX_FILES) throw userError_('Please attach 1 to ' + CONFIG.MAX_FILES + ' Demos.');
  const staging = stagingFolder_().getId();
  const token = ScriptApp.getOAuthToken();
  return ids.map(function (rawId) {
    const id = String(rawId);
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) throw userError_('Upload not recognised. Please try again.');
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name,size,parents,appProperties', {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    const meta = res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null;
    if (!meta || !meta.appProperties || meta.appProperties.inquiryId !== inquiryId || (meta.parents || []).indexOf(staging) === -1) {
      throw userError_('Upload not recognised. Please try again.');
    }
    return { id: id, name: meta.name, size: Number(meta.size || 0), url: 'https://drive.google.com/file/d/' + id + '/view' };
  });
}

function moveDemos_(demos, data) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const folder = rootFolder_().createFolder((data.artistName || data.contactName || 'Inquiry') + ' ' + stamp);
  demos.forEach(function (d) { DriveApp.getFileById(d.id).moveTo(folder); });
  return folder;
}

function demoLines_(demos) {
  return demos.map(function (d) { return d.name + ' (' + formatSize_(d.size) + '): ' + d.url; });
}

function formatSize_(b) {
  return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}

// Step 3: the Inquiry itself, sent after every Demo has landed in staging.
function submitInquiry_(data, raw) {
  if (data.website) return json_({ ok: true }); // honeypot: pretend success
  if (!data.contactName) return json_({ ok: false, error: 'Please add your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.artistEmail || '')) {
    return json_({ ok: false, error: 'Please add a valid email.' });
  }
  if (!isUsPhone_(data.artistPhone)) {
    return json_({ ok: false, error: 'Please add a US phone number with 10 digits.' });
  }
  if (!data.experienceLevel || !data.sessionType) {
    return json_({ ok: false, error: 'Please choose an experience level and session type.' });
  }
  // A retry after a lost response (shaky Wi-Fi) must not fail or notify twice: the Demos have already left staging.
  const cache = CacheService.getScriptCache();
  const doneKey = 'done:' + String(raw.inquiryId || '').slice(0, 40);
  if (cache.get(doneKey)) return json_({ ok: true });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (cache.get(doneKey)) return json_({ ok: true });
    const demos = verifyDemos_(String(raw.inquiryId || ''), raw.fileIds);
    // Notify before moving the files: if the email fails, the Demos are still in staging and Try again works.
    sendEmail_(data, demos);
    cache.put(doneKey, '1', 21600);
    try { appendRow_(data, demos); } catch (err) { console.error(err); }
    try { moveDemos_(demos, data); } catch (err) { console.error(err); }
    try { sendText_(data); } catch (err) { console.error(err); }
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

// US numbers only (same rule as booking-form.js): 10 digits, area code 2-9, optional country code 1; a "+" must be "+1".
function isUsPhone_(value) {
  const v = String(value || '').trim();
  const digits = v.replace(/\D/g, '');
  if (v.charAt(0) === '+' && digits.length !== 11) return false;
  return /^1?[2-9]\d{9}$/.test(digits);
}

function parseRequest_(e) {
  try {
    return JSON.parse((e.postData && e.postData.contents) || '') || {};
  } catch (_) {
    return {};
  }
}

function cleanFields_(raw) {
  const data = {};
  Object.keys(LABELS).concat('website').forEach(function (k) {
    data[k] = String(raw[k] == null ? '' : raw[k]).trim().slice(0, CONFIG.MAX_FIELD_CHARS);
  });
  return data;
}

function setting_(key) {
  const fromProps = PropertiesService.getScriptProperties().getProperty(key);
  return fromProps || CONFIG[key] || '';
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  const ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
  props.setProperty('SHEET_ID', ss.getId());
  const sheet = ss.getSheets()[0];
  sheet.appendRow(['Timestamp'].concat(Object.keys(LABELS).map(function (k) { return LABELS[k]; }), ['Demos']));
  return sheet;
}

function appendRow_(data, demos) {
  const row = [new Date()].concat(Object.keys(LABELS).map(function (k) { return data[k]; }), [demoLines_(demos).join('\n')]);
  getSheet_().appendRow(row);
}

function sendEmail_(data, demos) {
  const lines = Object.keys(LABELS).map(function (k) { return LABELS[k] + ': ' + (data[k] || '(none)'); });
  lines.push('Demos:\n' + demoLines_(demos).join('\n'));
  MailApp.sendEmail({
    to: setting_('NOTIFY_EMAIL'),
    replyTo: data.artistEmail,
    subject: 'New session inquiry: ' + (data.artistName || data.contactName),
    body: lines.join('\n\n'),
  });
}

function sendText_(data) {
  const phone = setting_('NOTIFY_PHONE');
  const text = 'Alcove inquiry from ' + data.contactName + (data.artistName ? ' / ' + data.artistName : '') + ' (' + (data.sessionType || 'no session type') + '). Check email.';
  const props = PropertiesService.getScriptProperties();
  const sid = props.getProperty('TWILIO_SID');
  const token = props.getProperty('TWILIO_TOKEN');
  const from = props.getProperty('TWILIO_FROM');
  const gateway = props.getProperty('SMS_GATEWAY_EMAIL');
  if (sid && token && from && phone && phone.indexOf('X') === -1) {
    UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'post',
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
      payload: { To: phone, From: from, Body: text },
      muteHttpExceptions: true,
    });
  } else if (gateway) {
    MailApp.sendEmail(gateway, 'Alcove inquiry', text);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant permissions and send a sample inquiry with a tiny test Demo (full 3-step flow). */
function testSubmission() {
  const call = function (body) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(body) }, parameter: {} }).getContent());
  };
  const bytes = 'test demo';
  const start = call({ action: 'startUpload', files: [{ name: 'test-demo.mp3', type: 'audio/mpeg', size: bytes.length }] });
  if (!start.ok) throw new Error('startUpload failed: ' + JSON.stringify(start));
  const put = UrlFetchApp.fetch(start.uploads[0].uploadUrl, {
    method: 'put',
    contentType: 'audio/mpeg',
    payload: bytes,
    headers: { 'Content-Range': 'bytes 0-' + (bytes.length - 1) + '/' + bytes.length },
    muteHttpExceptions: true,
  });
  const fileId = JSON.parse(put.getContentText()).id;
  const res = call({
    action: 'submitInquiry',
    inquiryId: start.inquiryId,
    fileIds: [fileId],
    contactName: 'Test Person',
    artistName: 'Test Artist',
    artistEmail: 'test@example.com',
    artistPhone: '+1 (555) 123-4567',
    experienceLevel: 'First time',
    sessionType: 'Recording / Tracking',
    anythingElse: 'Sample inquiry from testSubmission().',
  });
  console.log(JSON.stringify(res));
}
