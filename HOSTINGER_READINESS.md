# Hostinger deployment

| Setting | Value |
|---|---|
| Application root | repository root |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` (`server/index.js`) |
| Node | `^20.19.0 \|\| >=22.12.0` |
| Environment | `NODE_ENV=production`; Hostinger provides `PORT` |

No database, email provider or secrets are required. Any `DB_*`, `JWT_SECRET`,
`STRIPE_*`, `RESEND_*` or `ANTHROPIC_API_KEY` variables left over from the retired
local booking system are unused and can be removed from the Hostinger panel.

The build needs outbound HTTPS to `booking.eandbhair.co.uk`. If WubSync is
unreachable at build time it builds from the committed snapshot and prints a warning.

## After deploy

- `https://eandbhair.co.uk/api/health` returns `{"status":"ok"}`
- `https://eandbhair.co.uk/api/catalogue` lists the current services with `"stale": false`
- `https://www.eandbhair.co.uk/` 301s to `https://eandbhair.co.uk/`
- `https://eandbhair.co.uk/book` 301s to `https://booking.eandbhair.co.uk/book/eandb`
