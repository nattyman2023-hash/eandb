require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');

const { fetchCatalogue } = require('./catalogue');

// E & B marketing site. Serves the prerendered pages and a cached copy of the
// WubSync public catalogue. It has no database: booking, payments, accounts and the
// salon CRM all live in WubSync, and enquiries go by email, WhatsApp or phone.

const PORT = process.env.PORT || 3000;
const BOOKING_URL = 'https://booking.eandbhair.co.uk/book/eandb';
const BOOKING_ORIGIN = 'https://booking.eandbhair.co.uk';
const CANONICAL_ORIGIN = 'https://eandbhair.co.uk';
const distPath = path.resolve(__dirname, '../dist');
const snapshotPath = path.resolve(__dirname, '../src/data/catalogue.json');
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// eandbhair.co.uk is the canonical host. Only page requests on www are moved, so
// API posts are never turned into GETs and booking.eandbhair.co.uk is untouched.
app.use((req, res, next) => {
  const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
  if (isPageRequest && req.hostname?.toLowerCase() === 'www.eandbhair.co.uk') {
    return res.redirect(301, `${CANONICAL_ORIGIN}${req.originalUrl}`);
  }
  return next();
});

// Retired local booking, shop and account routes. Old links and bookmarks go
// somewhere useful instead of a dead page.
const RETIRED_ROUTES = [
  [/^\/book(?:\/.*)?$/, BOOKING_URL],
  [/^\/(?:cart|checkout)\/?$/, '/services'],
  [/^\/shop(?:\/.*)?$/, '/services'],
  [/^\/services\/(?:hairdressing|braiding|hair-treatments)\/?$/, '/services'],
  [/^\/(?:braiding|hair-studio|kids|barbershop)\/?$/, '/services'],
  [/^\/(?:about|appointments)\/?$/, '/'],
  [/^\/(?:portal|account|auth|reset-password|unsubscribe|install)(?:\/.*)?$/, BOOKING_URL],
  [/^\/(?:admin|dashboard)(?:\/.*)?$/, `${BOOKING_ORIGIN}/admin/login`],
  [/^\/(?:staff|mechanic)(?:\/.*)?$/, `${BOOKING_ORIGIN}/staff`],
];

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const match = RETIRED_ROUTES.find(([pattern]) => pattern.test(req.path));
  return match ? res.redirect(301, match[1]) : next();
});

// ---------------------------------------------------------------------------
// Catalogue: WubSync is the source of truth. Refreshed at most every 5 minutes;
// if WubSync is unreachable the last good copy (or the build snapshot) is served
// and flagged stale so the page can say so.
// ---------------------------------------------------------------------------

let cached = null;
try {
  cached = { catalogue: JSON.parse(fs.readFileSync(snapshotPath, 'utf8')), loadedAt: 0, stale: true };
} catch (error) {
  console.error('[catalogue] no build snapshot available:', error.message);
}
let refreshing = null;

// After a failed refresh the stale copy counts as fresh for one minute, so an
// outage costs one WubSync request a minute rather than one per page view.
async function getCatalogue() {
  if (cached && Date.now() - cached.loadedAt < CATALOGUE_TTL_MS) return cached;
  if (!refreshing) {
    refreshing = fetchCatalogue()
      .then((catalogue) => {
        cached = { catalogue, loadedAt: Date.now(), stale: false };
        return cached;
      })
      .catch((error) => {
        console.error('[catalogue] WubSync refresh failed:', error.message);
        if (cached) cached = { ...cached, stale: true, loadedAt: Date.now() - CATALOGUE_TTL_MS + 60 * 1000 };
        return cached;
      })
      .finally(() => { refreshing = null; });
  }
  // Serve a known copy immediately and refresh in the background once one exists.
  if (cached && cached.loadedAt > 0) return cached;
  return refreshing;
}

const api = express.Router();

api.get('/health', (req, res) => res.json({ status: 'ok' }));

api.get('/catalogue', async (req, res) => {
  const current = await getCatalogue();
  if (!current) return res.status(503).json({ error: 'Catalogue unavailable' });
  res.set('Cache-Control', 'public, max-age=60');
  return res.json({ catalogue: current.catalogue, stale: current.stale });
});

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

app.use(express.static(distPath, {
  index: false,
  // Prerendered routes live at dist/<route>/index.html. Without this, static would
  // 301 /services/x to /services/x/, away from the canonical URL.
  redirect: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (path.basename(filePath) === 'eandb-app-sw.js') res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Every real page is prerendered. A service added in WubSync since the last build
// gets the client-rendered shell; anything else gets the NotFound page with a 404.
app.get(/^(?!\/api(?:\/|$)).*/, async (req, res, next) => {
  const notFound = () => res.status(404).set('Cache-Control', 'no-cache').sendFile(path.join(distPath, '404.html'), (error) => {
    if (error) next(error);
  });
  const routeDocument = path.resolve(distPath, `.${req.path}`, 'index.html');
  if (!routeDocument.startsWith(`${distPath}${path.sep}`)) return notFound();

  return res.set('Cache-Control', 'no-cache').sendFile(routeDocument, async (routeError) => {
    if (!routeError) return;
    if (res.headersSent) return next(routeError);
    const serviceSlug = req.path.match(/^\/services\/([a-z0-9-]+)\/?$/)?.[1];
    if (serviceSlug) {
      const current = await getCatalogue().catch(() => null);
      if (current?.catalogue.services.some((service) => service.slug === serviceSlug)) {
        return res.sendFile(path.join(distPath, 'app-shell.html'), (error) => { if (error) next(error); });
      }
    }
    return notFound();
  });
});

app.use((err, req, res, next) => {
  console.error('[server] request failed:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  return res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? (status >= 500 ? 'Internal server error.' : 'Invalid request.') : err.message,
  });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E & B Hair site listening on port ${PORT}`);
  });
}

module.exports = app;
