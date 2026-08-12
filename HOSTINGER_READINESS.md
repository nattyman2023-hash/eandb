# Hostinger Readiness

Status: migration implemented and locally validated. No Hostinger connection, production database migration, or deployment was performed.

## Runtime architecture

- Frontend: React 18.3.1 with React Router, built by Vite 8.0.0.
- Backend: Node.js + Express in `server/index.js`.
- Database target: Hostinger MySQL through the server-side `mysql2/promise` pool in `server/db.js`.
- Browser data access: same-origin `fetch('/api/...')` through `src/lib/apiClient.ts`; no browser-to-MySQL access.
- Authentication: server-side JWT sessions backed by MySQL `app_users` and `auth_sessions`.
- Storage: server-side file storage under `server/uploads/`, with signed access routes.
- Booking provider: no external booking provider; bookings are handled by the Express API and MySQL.
- Payments: optional server-side Stripe integration in `server/src/routes/payments.js`.
- Email: optional Resend integration and server-side email queue worker; no SMS provider is configured.
- Realtime: no provider dependency remains. Former realtime subscriptions are represented by the neutral client compatibility layer and should be replaced with polling or explicit API refreshes where live updates are required.

Node requirements are `^20.19.0 || >=22.12.0`, matching Vite 8. The local validation runtime was Node v24.15.0.

## Commands and files

| Setting | Value |
|---|---|
| Install | `npm ci` |
| Development | `npm run dev` |
| Build | `npm run build` |
| Start | `npm start` |
| Lint | `npm run lint` |
| Database migration | `npm run db:migrate` |
| Server entry | `server/index.js` |
| Static output | `dist/` |
| Package lock | Present: `package-lock.json` |

`npm start` does not run migrations. `server/migrate.js` is the only migration runner and must be invoked manually.

## Required Hostinger environment variables

Set these in the Hostinger Node.js Web App environment settings. Do not put database credentials in frontend `.env` files or `VITE_` variables.

```text
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
NODE_ENV=production
```

The application also supports these server-only operational variables when the related feature is enabled:

```text
PORT=<Hostinger-provided port>
JWT_SECRET=<long random secret>
FRONTEND_URL=https://your-domain.example
RESEND_API_KEY=<optional>
EMAIL_FROM=<optional sender>
ANTHROPIC_API_KEY=<optional chat integration>
STORAGE_SIGN_SECRET=<optional; defaults to JWT_SECRET>
STRIPE_SECRET_KEY=<optional>
STRIPE_PUBLISHABLE_KEY=<optional>
STRIPE_WEBHOOK_SECRET=<optional>
EMAIL_WORKER_ENABLED=true
```

No database connection variable other than the five `DB_*` variables above is used. No `VITE_DB_PASSWORD`, `VITE_DATABASE_URL`, or `VITE_MYSQL_PASSWORD` variable is created.

## API routes

API routes are registered before static files and the SPA fallback.

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/services`
- `POST /api/contact`
- `POST /api/bookings`
- `POST /api/admin/users/password`
- `GET /api/email/unsubscribe`
- `POST /api/email/unsubscribe`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/reset-password-request`
- `POST /api/auth/reset-password`
- `POST /api/auth/update-password`
- `POST /api/query`
- `/api/storage/:bucket/*` for upload, list, signed URLs, public reads, and removal
- `GET /api/payments/status`
- `POST /api/payments/test`
- `POST /api/payments/checkout`
- `POST /api/payments/stripe/webhook`
- `/api/functions/*` compatibility action routes for chat, booking, quotes, invitations, transactional email, and unsubscribe handling; these are Express routes, not Edge Functions.

The existing frontend route inventory remains in `src/App.tsx`, including public pages, booking, contact, shop/checkout, auth, staff, portal, and admin routes. The migration preserves those paths and the existing UI structure.

## Database migration plan

- `database-schema-mysql.sql` is the additive baseline migration, registered as `0001_initial_schema` by `server/migrate.js`.
- It uses `CREATE TABLE IF NOT EXISTS` for the MySQL application tables, including users/sessions, customers, services, jobs/bookings, staff, messages, payments/orders, uploads, and email queue data.
- `schema_migrations` tracks applied migrations.
- Destructive statements (`DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, and `DELETE FROM`) are rejected by the runner.
- The historical `supabase/migrations/` directory is retained as a source/archive for data and authorization review. It is not loaded by the Express server.
- Existing production data still requires an approved export/transform/import process from the former Supabase schema into MySQL. No data was connected to or migrated during this work.

Data requiring migration includes customer and user records, password/account state, staff roles, service catalog and add-ons, bookings/jobs and notes, waitlist, hair profiles, messages/contact submissions, quotes/estimates/invoices, products/orders/inventory, expenses/time entries, email suppression/queue records, and uploaded files. PostgreSQL functions, RLS policies, Auth sessions, Storage objects, and Realtime subscriptions require application-level replacements rather than direct table copying.

## Supabase and Lovable replacement status

Active runtime dependencies were removed or replaced as follows:

- `package.json`, `package-lock.json`: removed `@supabase/supabase-js` and `lovable-tagger`; added Express/MySQL/server dependencies.
- `vite.config.ts`: removed the Lovable component tagger and added the local `/api` development proxy.
- `src/lib/apiClient.ts`: neutral same-origin API/auth/storage/query compatibility client.
- `src/lib/supabase.ts`, `src/integrations/supabase/client.ts`, and `src/integrations/supabase/types.ts`: removed after all active imports were migrated.
- `src/**/*.ts` and `src/**/*.tsx`: active data calls now go through the neutral API client or explicit `/api/...` calls; the website layout, branding, images, and route declarations were preserved.
- `supabase/functions/**`: removed after their active behavior was ported to Express in `server/src/routes/functions.js`, `server/src/routes/resources.js`, and `server/src/routes/payments.js`.
- `supabase/config.toml`: removed because Edge Functions are no longer deployed.
- `.lovable/plan.md`, `bun.lock`, Lovable preview cleanup, and Lovable-specific test helpers: removed or replaced with local Vite/Playwright configuration.
- `public/sw.js`: removed its former Lovable-domain cleanup behavior; the PWA code is now provider-neutral.

Remaining text references are historical or explanatory only: the archived `supabase/migrations/` files, the legacy PostgreSQL `database-schema.sql`, migration provenance comments in `database-schema-mysql.sql` and `extract-migrations.cjs`, `server/AUTHZ_REFERENCE.md`, and comments describing the origins of the Express ports. There are no active Supabase/Lovable package entries, imports, client calls, Edge Function deployments, or browser runtime dependencies.

## Validation results

- `npm install`: passed during dependency installation.
- `npm ci`: passed; 888 packages installed and 0 vulnerabilities reported by npm.
- `npm run build`: passed with Vite 8.0.0. Vite emitted only the existing large-chunk advisory.
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npm run lint`: does not pass. It reports 260 findings (236 errors, 24 warnings), primarily existing explicit-`any`, React hooks, and configuration issues across the pre-existing frontend. This is recorded rather than hidden by disabling lint globally.
- `npm start`: server entry started successfully in production mode for the smoke test.
- `GET /`: returned the production HTML shell with HTTP 200.
- `GET /book`: returned the SPA shell with HTTP 200.
- `GET /api/health`: returned HTTP 200 and exactly `{ "status": "ok" }`.
- `GET /api/not-found`: returned a JSON 404 without a stack trace.
- Invalid `POST /api/bookings` and `POST /api/contact`: returned HTTP 400 validation responses without a database connection.
- Browser bundle scan: no database credential names or server secret names were found in `dist/assets`.
- `npm run db:migrate`: intentionally not run. No live or Hostinger database was contacted.

## Exact Hostinger deployment settings

Create a Hostinger **Node.js Web App** using the repository root as the application root:

- Node version: 20.19.x or newer in the Node 20 line, or 22.12.x or newer.
- Package manager: npm.
- Build command: `npm ci && npm run build`.
- Start command: `npm start`.
- Server entry: `server/index.js`.
- Application port: use Hostinger's injected `PORT`; the server defaults to 3000 locally and binds to `0.0.0.0`.
- Static/output directory: `dist/`, served by Express. Do not configure this as a static-only `public_html` upload.
- Environment: set the server variables listed above in hPanel; never commit real `.env` files.
- Database: create/select the Hostinger MySQL database, set its five `DB_*` variables, and verify connectivity only after deployment configuration is complete.
- Migrations: review the generated SQL against a staging/approved database first, then run `npm run db:migrate` manually. Do not add it to the start command or automatic deployment hook.
- Health check after deployment: `https://your-domain.example/api/health`.

No automatic deployment was performed.
