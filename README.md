# E & B Hair website

Marketing site for E & B Hair (https://eandbhair.co.uk). It shows the salon, its
services and starting prices, and sends every booking to WubSync at
https://booking.eandbhair.co.uk/book/eandb. It has no booking system, checkout,
accounts or database of its own.

## How services get here

WubSync's CRM is the source of truth. `scripts/fetch-catalogue.mjs` reads the public
catalogue (`/api/v1/book/eandb/catalogue`) at build time, writes the snapshot
`src/data/catalogue.json` and regenerates `public/sitemap.xml`. At runtime
`server/index.js` serves `/api/catalogue`, refreshed from WubSync at most every
5 minutes, and pages swap in that live copy. Change a service in the CRM, not here.

## Commands

```bash
npm ci
npm run dev     # Vite on :8080, proxies /api to :3000
npm start       # production server (serves dist/ and /api)
npm run build   # fetch catalogue -> vite build -> prerender -> verify built output
```

The build fails if a page loses its SEO tags, the service list or prices drift from
the CRM snapshot, or anything like a local checkout, cart or booking link appears.
