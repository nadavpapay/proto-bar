// Zero-dependency static server for a deployed prototype (Railway, Render — anything that runs
// `node server.cjs` with a $PORT). Serves Vite's `dist` with an index.html fallback for SPA
// routes, path-traversal-guarded, bound to 0.0.0.0. Plus one thing a plain static host cannot do:
//
// THE NOTES INBOX. Review notes belong in `notes.json` in the repo, where the agent reads them.
// Notes written on THIS deployment cannot go there — it is a container on the other side of the
// internet — so what reviewers do here lands in an inbox on a volume mounted at /data, which
// survives every redeploy. What this link SHOWS is the repo's `notes.json` (deployed with the
// app) with the inbox laid over it, so nobody's note disappears when the dev server collects it.
// The rules are `notes-sync.ts`'s, copied here in plain JS so this file needs nothing but node —
// change one, change the other.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// ── The notes inbox ─────────────────────────────────────────────────────────
//
// The volume, or the app folder when there is no volume (a local `node server.cjs`).
// Notes are the only writes this server ever does.
const NOTES_DIR = process.env.NOTES_DIR || (fs.existsSync('/data') ? '/data' : __dirname);
const INBOX = path.join(NOTES_DIR, 'notes-inbox.json');
// The repo's notes, as deployed. Read-only here; the dev server is what writes it.
const REPO_NOTES = process.env.NOTES_FILE || path.join(__dirname, 'notes.json');
const MAX_BODY = 512 * 1024;   // a note is a sentence; this is thousands of them
const MAX_NOTES = 500;         // the endpoint is public, so it has a ceiling
const MAX_TEXT = 4000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
// A collected entry counts until the server restarts after it was collected: a restart is a
// deploy, and a deploy brings a repo file that already has it.
const STARTED = new Date().toISOString();

function readList(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // no file yet, or a corrupt one — either way, start empty
  }
}

function writeInbox(entries) {
  // Temp file then rename: a half-written notes file is worse than no notes file,
  // and rename is the only atomic operation a filesystem gives you for free.
  const tmp = INBOX + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, INBOX);
}

const live = (e) => !e.collected || e.collected > STARTED;

function strip(e) {
  const { saved: _saved, collected: _collected, ...note } = e;
  return note;
}

function same(a, b) {
  if (!a) return false;
  const norm = (n) => JSON.stringify(Object.keys(n).sort().map((k) => [k, n[k]]));
  return norm(a) === norm(b);
}

/** The repo's notes with the live entries laid over them. */
function view(entries) {
  const out = new Map(readList(REPO_NOTES).map((n) => [n.id, n]));
  for (const e of entries) {
    if (!live(e)) continue;
    if (e.deleted === true) out.delete(e.id);
    else out.set(e.id, strip(e));
  }
  return [...out.values()];
}

/** Anyone can post to a deployed link, so every field is checked and capped. */
function clean(n) {
  if (!n || typeof n !== 'object') return null;
  if (typeof n.id !== 'string' || !ID.test(n.id)) return null;
  if (typeof n.text !== 'string' || typeof n.screen !== 'string' || typeof n.viewport !== 'string') return null;
  if (typeof n.x !== 'number' || typeof n.y !== 'number' || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return null;
  const note = {
    id: n.id,
    screen: n.screen.slice(0, 200),
    viewport: n.viewport.slice(0, 40),
    x: n.x,
    y: n.y,
    text: n.text.slice(0, MAX_TEXT),
    at: typeof n.at === 'string' ? n.at.slice(0, 40) : new Date().toISOString(),
  };
  if (n.done === true) note.done = true;
  if (typeof n.by === 'string' && n.by.trim()) note.by = n.by.trim().slice(0, 80);
  if (typeof n.scope === 'string' && n.scope) note.scope = n.scope.slice(0, 80);
  if (n.context && typeof n.context === 'object') {
    const ctx = {};
    for (const [k, v] of Object.entries(n.context).slice(0, 12)) if (typeof v === 'string') ctx[k.slice(0, 40)] = v.slice(0, 120);
    note.context = ctx;
  }
  return note;
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, done) {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try { done(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch (err) { done(err); }
  });
}

function notesEndpoint(req, res, query) {
  if (req.method === 'GET') {
    const entries = readList(INBOX);
    // The dev server's collect: what it has not taken yet, stamps and all.
    if (query.get('inbox')) return json(res, 200, { store: 'inbox', entries: entries.filter((e) => !e.collected) });
    return json(res, 200, { store: 'inbox', notes: view(entries) });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false });

  return readBody(req, (err, body) => {
    if (err || !Array.isArray(body)) return json(res, 400, { ok: false, error: 'not an array' });
    const now = new Date().toISOString();
    const entries = readList(INBOX).filter(live);

    // The dev server took these into the repo. Marked, not deleted — this link goes on
    // showing them until its own copy of the repo file has them.
    if (query.get('collected')) {
      const seen = new Map(body.map((t) => [t && t.id, t && t.saved]));
      writeInbox(entries.map((e) => (!e.collected && seen.get(e.id) === e.saved ? { ...e, collected: now } : e)));
      return json(res, 200, { ok: true });
    }

    // A reviewer's whole list. Whatever differs from what this link shows becomes an entry;
    // whatever is missing from it is recorded as deleted.
    // One bad note and nothing is applied: a list with a note missing reads as that note deleted.
    const posted = body.map(clean);
    if (posted.some((n) => !n)) return json(res, 400, { ok: false, error: 'not a list of notes' });
    const shown = view(entries);
    const byId = new Map(shown.map((n) => [n.id, n]));
    const out = new Map(entries.map((e) => [e.id, e]));
    const kept = new Set();
    for (const n of posted) {
      kept.add(n.id);
      // Compared as cleaned, so a repo note carrying a field of the job's own does not read
      // as changed every time anyone posts.
      if (!same(clean(byId.get(n.id)), n)) out.set(n.id, { ...n, saved: now });
    }
    for (const n of shown) if (!kept.has(n.id)) out.set(n.id, { id: n.id, deleted: true, saved: now });
    if (out.size > MAX_NOTES) return json(res, 400, { ok: false, error: 'too many notes' });
    writeInbox([...out.values()]);
    return json(res, 200, { ok: true, store: 'inbox', notes: view([...out.values()]) });
  });
}

// ── Static files ────────────────────────────────────────────────────────────

function sendIndex(res) {
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const [rawPath, rawQuery] = (req.url || '/').split('?');
  if (decodeURIComponent(rawPath) === (process.env.NOTES_ROUTE || '/__notes')) {
    return notesEndpoint(req, res, new URLSearchParams(rawQuery || ''));
  }

  let rel = decodeURIComponent(rawPath);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  const filePath = path.normalize(path.join(ROOT, rel));
  // path-traversal guard
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { sendIndex(res); return; } // SPA-style fallback to index.html
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`serving ${ROOT} on ${PORT}`));
