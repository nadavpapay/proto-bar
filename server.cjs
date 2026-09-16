// Zero-dependency static server for a deployed prototype (Railway, Render — anything that runs
// `node server.cjs` with a $PORT). Serves Vite's `dist` with an index.html fallback for SPA
// routes, path-traversal-guarded, bound to 0.0.0.0. Plus one thing a plain static host cannot do:
//
// THE NOTES INBOX. Review notes belong in `notes.json` in the repo, where the agent reads them.
// Notes written on THIS deployment cannot go there — it is a container on the other side of the
// internet — so they land here instead, on a volume mounted at /data so they survive every
// redeploy, and the dev server drains them into the repo file the next time it is asked for notes
// (see `vite-notes.ts`, its `inbox` option). This is an inbox, not a store: what is drained is
// deleted, so the repo file stays the one record and a note deleted there does not come back.
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
const NOTES = path.join(NOTES_DIR, 'notes-inbox.json');
const MAX_BODY = 512 * 1024;   // a note is a sentence; this is thousands of them
const MAX_NOTES = 500;         // the endpoint is public, so it has a ceiling

function readNotes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(NOTES, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // no file yet, or a corrupt one — either way, start empty
  }
}

function writeNotes(notes) {
  // Temp file then rename: a half-written notes file is worse than no notes file,
  // and rename is the only atomic operation a filesystem gives you for free.
  const tmp = NOTES + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(notes, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, NOTES);
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function notesEndpoint(req, res, query) {
  if (req.method === 'GET') {
    return json(res, 200, { store: 'inbox', notes: readNotes() });
  }

  if (req.method === 'POST') {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const notes = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!Array.isArray(notes)) throw new Error('not an array');
        if (notes.length > MAX_NOTES) throw new Error('too many notes');
        writeNotes(notes);
        json(res, 200, { ok: true, store: 'inbox', count: notes.length });
      } catch (err) {
        json(res, 400, { ok: false, error: String(err) });
      }
    });
    return;
  }

  // Used by the dev server once it has copied notes into the repo file. Only the
  // ids it names are removed, so a note written a second ago is not lost to a
  // drain that started before it.
  if (req.method === 'DELETE') {
    const ids = new Set((query.get('ids') || '').split(',').filter(Boolean));
    const kept = readNotes().filter((n) => !ids.has(n.id));
    writeNotes(kept);
    return json(res, 200, { ok: true, remaining: kept.length });
  }

  return json(res, 405, { ok: false });
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
  if (decodeURIComponent(rawPath) === '/__notes') {
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
