/**
 * Hausmeister Zeiterfassung - Zero-Dependency Sync Server
 * Runs a local server to sync data between devices and serve static assets.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/**
 * Reads entries from the JSON file safely.
 */
function readEntries() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading entries file:', err);
    return [];
  }
}

/**
 * Writes entries to the JSON file safely using temp-write and rename.
 */
function writeEntries(entries) {
  const tempFile = `${DATA_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(entries, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing entries file:', err);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
    return false;
  }
}

/**
 * Merges client entries with server entries using the lastModified timestamps.
 */
function mergeEntries(clientEntries, serverEntries) {
  const mergedMap = new Map();

  const processEntry = (entry) => {
    if (!entry || !entry.id) return;
    
    // Ensure entry has lastModified timestamp
    if (entry.lastModified === undefined) {
      entry.lastModified = Date.now();
    }
    
    const existing = mergedMap.get(entry.id);
    if (!existing || (entry.lastModified > existing.lastModified)) {
      mergedMap.set(entry.id, entry);
    }
  };

  // Process server entries first, then client entries (client with newer timestamp will overwrite)
  serverEntries.forEach(processEntry);
  clientEntries.forEach(processEntry);

  return Array.from(mergedMap.values());
}

// Create HTTP Server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight options request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---
  
  // GET /api/status - health check
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
    return;
  }

  // GET /api/entries - retrieve entries
  if (req.url === '/api/entries' && req.method === 'GET') {
    const entries = readEntries();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entries));
    return;
  }

  // POST /api/sync - merge and sync entries
  if (req.url === '/api/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const clientEntries = payload.entries;

        if (!Array.isArray(clientEntries)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload entries must be an array' }));
          return;
        }

        // Perform synchronous read, merge, write to prevent concurrency race conditions
        const serverEntries = readEntries();
        const mergedEntries = mergeEntries(clientEntries, serverEntries);
        const success = writeEntries(mergedEntries);

        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ entries: mergedEntries }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write merged database' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }));
      }
    });
    return;
  }

  // --- Static Files Serving ---
  
  // Resolve request path to local file path
  let reqPath = req.url.split('?')[0]; // Strip query parameters
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal attacks
  const filePath = path.join(__dirname, reqPath);
  const relative = path.relative(__dirname, filePath);
  const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

  if (!isSafe) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // File not found, serve index.html for SPA router routing (optional, fallback to 404)
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Serve file
    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Hausmeister Zeiterfassung Server running on http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop.`);
});
