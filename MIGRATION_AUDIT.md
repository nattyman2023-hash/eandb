# Migration Audit

**Audit date:** 2026-08-12
**Audit scope:** `C:\Users\Natty\Desktop\Anti Grav\EandB\auto-care-buddy-19`
**Requested target:** React + Vite frontend -> `fetch("/api/...")` -> Node.js + Express -> Hostinger MySQL

## 1. Audit status and boundaries

This is a read-only Phase 1 audit. During this audit:

- No application source code was changed.
- No Supabase files, migrations, functions, or dependencies were deleted.
- No database was connected to or modified.
- No Hostinger connection was made.
- No deployment was performed.
- No secret values are reproduced in this document.

The Git repository root is the nested `auto-care-buddy-19` directory. Its parent directory also contains a small unrelated/ancillary `package.json` with only `mysql2`; the application repository and its Git root are the nested directory documented above.

The repository can show what the application is designed to do, but this audit cannot establish whether Supabase, Stripe, email, storage, or MySQL currently contain live production data because no external systems were accessed.

## 2. Executive summary

The application is not currently a clean Supabase deployment, but it is also not yet a clean implementation of the requested target architecture.

The current code has three overlapping layers:

1. A React 18 + Vite 8 single-page frontend with the existing UI and a large React Router route map.
2. A Node.js + Express + `mysql2/promise` backend that already implements a MySQL connection pool, custom JWT authentication, a generic compatibility query endpoint, local file storage, email queueing, and several function-like routes.
3. A retained Supabase compatibility/deployment layer: frontend call sites still use names such as `supabase.from()`, `supabase.auth`, `supabase.storage`, `supabase.functions.invoke()`, and `supabase.channel()`, while `src/integrations/supabase/client.ts` redirects that shape to the Express API. The `supabase/` directory still contains 47 PostgreSQL migrations and 17 deployable Edge Function directories, plus shared function code.

The practical migration baseline is therefore:

- **Frontend:** React/Vite is already present, but API calls must eventually move from the compatibility client to explicit REST calls under `/api`.
- **Backend:** Express/MySQL is already present, but the generic Supabase-like query endpoint and function compatibility routes need to become deliberate resource routes with complete authorization and transactions.
- **Database:** A MySQL schema exists in `database-schema-mysql.sql`, but there is no verified live-data export or migration runbook in this repository.
- **Supabase:** Still present in source, migrations, function code, naming, environment assumptions, and the frontend API shape.
- **Lovable:** Still present in build tooling, preview/PWA cleanup logic, metadata, old Edge Functions, and user-facing settings copy.
- **Hosting:** `deploy-hostinger.sh` describes a split deployment of static files on Hostinger and the API on Render. That conflicts with the requested Hostinger Node.js Web App target and must be redesigned after approval.

## 3. Current architecture answers

| Area | Current repository finding | Target implication |
|---|---|---|
| Frontend framework | React 18.3.1 with TypeScript and React Router DOM 6.30.1 | Preserve the UI and route behavior while replacing the data layer |
| Build system | Vite; `vite.config.ts`; `@vitejs/plugin-react`; `vite-plugin-pwa`; PostCSS; Tailwind CSS | Keep Vite, remove only Lovable-specific build integration |
| Current Vite version | Manifest declares `vite: ^8.0.0`; installed Vite metadata is Vite 8 | Pin/standardize the version during implementation if Hostinger build compatibility requires it |
| Node requirements | No `engines` field is declared. Installed Vite metadata requires `^20.19.0 || >=22.12.0`; installed Express requires `>=18` | Use a Hostinger-supported Node version satisfying Vite, preferably a current supported Node 20/22 line; declare it explicitly later |
| Frontend API base | `src/lib/apiClient.ts` uses `VITE_API_URL`, falling back to `http://localhost:3001` | Target production frontend should use same-origin `fetch("/api/...")`; no database or private provider credentials may be Vite variables |
| Backend | Existing CommonJS Express server in `server/src` | Refactor compatibility routes into explicit REST resources under `/api` |
| Database | MySQL schema and pool code already exist; no live connection was made | Hostinger MySQL remains the target; migration and verification are still required |
| Authentication provider | Current path is custom Express JWT + MySQL tables; legacy Supabase Auth assumptions remain in migrations/Edge Functions and stale frontend code | Keep auth entirely server-side; migrate users or require password reset depending on hash compatibility |
| Storage provider | Current Express compatibility path writes to local `server/uploads`; original design also has Supabase Storage buckets | Select durable Hostinger storage and migrate objects before cutover |
| Booking provider | No external booking provider found. Booking is custom UI + MySQL/Express compatibility routes, with a retained Supabase Edge Function implementation | Build a transactional `/api/bookings` workflow and preserve booking drafts, photos, status, and notifications |
| Payment provider | Stripe is the intended provider in legacy Edge Functions and package dependencies; current Express Stripe routes are stubs | Implement server-side Stripe checkout/webhook handling and migrate payment identifiers/statuses if live |
| Email provider | Current Express path uses Resend, MySQL `email_queue`, and a 10-second worker; legacy Edge Functions use Lovable email infrastructure | Keep one Node-side provider/queue and remove Lovable/Supabase email execution after migration |
| SMS provider | None found. No Twilio, MessageBird, Vonage, or other SMS integration is present | SMS is a new integration decision, not a direct provider migration |
| Admin functionality | Admin pages and role checks cover dashboard, jobs, customers, staff, catalog, chairs, waitlist, inventory, reports, expenses, settings, leads, products, and orders | Preserve routes/UI, but enforce all role and ownership rules in Express resource handlers |

## 4. Repository inventory

The application repository contains:

- `src/`: 162 tracked/source files discovered by `rg --files` excluding build/vendor output.
- `public/`: 12 files, including PWA assets, SEO files, service-worker files, placeholders, and branding.
- `server/`: 18 source/config files, including the Express application, routes, middleware, jobs, and MySQL helpers.
- `supabase/`: 85 files, including `config.toml`, 47 migrations, 17 function directories, and shared function code.
- `database-schema.sql`: consolidated PostgreSQL-oriented schema/history output.
- `database-schema-mysql.sql`: manually adapted MySQL schema intended for the Express replacement.
- `extract-migrations.cjs`: concatenates migration SQL into `database-schema.sql`; it is not a MySQL migration tool.
- `push-database.cjs`: ignored local script containing a database credential and destructive database operations. It was not executed.
- `deploy-hostinger.sh`: deployment instructions for Hostinger static hosting plus Render backend, which does not match the requested Hostinger Node.js Web App target.
- `.htaccess`: Apache SPA routing and static hosting configuration; relevant to the current static-frontend deployment model, not sufficient by itself for a Hostinger Node.js Web App.
- `.lovable/plan.md`: Lovable preview/PWA remediation notes.
- `dist/` and `node_modules/`: present locally; build/vendor output was not treated as source.

The repository has both `package-lock.json` files at the frontend root and `server/package-lock.json`. Both are lockfile version 3. The root `bun.lock` is also present and contains Lovable package-cache URLs and the `lovable-tagger` dependency.

## 5. Frontend audit

### 5.1 Framework, build, styling, and configuration

| File | Finding | Migration relevance |
|---|---|---|
| `package.json` | React 18, React DOM, React Router DOM, TypeScript, Vite, Vite React plugin, Vite PWA, Vitest, Tailwind, Radix/shadcn-style UI, React Query, Zod | The React/Vite foundation can remain |
| `package-lock.json` | Locks the frontend dependency tree and includes `@supabase/supabase-js` and `lovable-tagger` | Must be regenerated only after approved dependency changes |
| `bun.lock` | Alternate lockfile; includes `lovable-tagger` and Lovable-hosted package cache URLs | Decide whether to retain or remove this package manager lockfile later |
| `vite.config.ts` | React plugin, VitePWA, `@` alias, dev server port 8080, build metadata, and `componentTagger()` in development | Remove `lovable-tagger` and its plugin call later; preserve PWA/alias behavior unless intentionally changed |
| `postcss.config.js` | Tailwind CSS and Autoprefixer | No Supabase/Lovable dependency found; retain |
| `tailwind.config.ts` | Tailwind 3 theme, shadcn-style CSS variables, `tailwindcss-animate`; uses `require("tailwindcss-animate")` | No provider migration required; lint currently flags the `require` form |
| `components.json` | shadcn/ui configuration and aliases | No provider migration required |
| `index.html` | SPA root, SEO/schema metadata, manifest link, Google Fonts, and a Google Maps embed URL in Contact-related UI | Preserve UI; external Google resources are separate from Supabase/Lovable |
| `src/index.css` and UI components | Existing design system and visual styling | Explicitly out of scope for this phase; preserve |
| `public/` | PWA icons/manifest, robots/sitemap, placeholder, logo, and service-worker files | Audit stale worker and Lovable preview behavior before final deployment |

### 5.2 Current routes

Routes are defined in `src/App.tsx`. The existing route surface that must be preserved is:

**Public:**

- `/`
- `/areas/:borough`
- `/mobile-mechanic/:borough` (redirects to `/`)
- `/services`
- `/services/:service`
- `/book`
- `/contact`
- `/cart`
- `/shop`
- `/shop/:id`
- `/checkout`
- `/barbershop`
- `/braiding`
- `/hair-studio`
- `/kids`
- `/install`
- `/unsubscribe`

**Authentication:**

- `/auth`
- `/reset-password`

**Staff/customer:**

- `/mechanic`
- `/staff`
- `/staff/schedule`
- `/staff/waitlist`
- `/staff/clients`
- `/portal`
- `/portal/bookings`
- `/portal/style-diary`
- `/portal/settings`
- `/account`

**Admin:**

- `/admin` (redirects to `/dashboard`)
- `/dashboard`
- `/calendar`
- `/jobs`
- `/customers`
- `/customers-old`
- `/hair-profiles`
- `/vehicles` (redirects to `/hair-profiles`)
- `/messages`
- `/employees`
- `/employees/:id`
- `/payroll`
- `/service-catalog`
- `/service-manager`
- `/chairs`
- `/waitlist`
- `/inventory`
- `/reports`
- `/expenses`
- `/settings`
- `/leads`
- `/products`
- `/orders`
- `/cache-diagnostics`
- `*` (NotFound)

`AdminPage` and `ProtectedRoute` provide frontend wrappers, but the route wrappers do not consistently pass a required role. Backend authorization must therefore be the authoritative control.

### 5.3 Frontend data-access shape

`src/lib/apiClient.ts` is an important migration boundary. It currently provides a limited fake/compatibility Supabase client that translates the following shapes to Express:

- `db.from(table).select().eq()...`
- `db.auth.*`
- `db.storage.*`
- `db.functions.invoke(...)`
- `db.channel(...)` / `removeChannel(...)`

It uses `VITE_API_URL` or an absolute localhost fallback, stores JWT session material in `localStorage` under `eandb.auth.session`, and sends API requests to `/api/query`, `/api/auth`, `/api/storage`, and `/api/functions` under that base URL.

The current channel implementation is polling, not Supabase Realtime: `src/lib/apiClient.ts` uses a 20-second polling interval. This means the application does not currently require a WebSocket migration for the existing behavior, although its call sites still use Supabase Realtime names.

Known compatibility issue: `src/lib/bookings.ts` calls `db.auth.getUser()`, but the compatibility client does not implement `getUser()`; this is a runtime risk in the current abstraction.

The target frontend boundary should ultimately be explicit typed API functions or direct `fetch("/api/...")` calls. The target must not retain browser-to-MySQL access and must not place database credentials in `VITE_` variables.

## 6. Existing backend and API audit

### 6.1 Server entry points

| File | Current behavior | Target replacement/decision |
|---|---|---|
| `server/src/index.js` | Loads dotenv, configures CORS/JSON, mounts `/api/auth`, `/api/query`, `/api/storage`, `/api/functions`, starts a DB check, starts an email worker interval, and listens on `PORT` | Keep Express entry point, but make Hostinger startup/readiness and same-origin routing explicit |
| `server/src/db.js` | Creates a reusable `mysql2/promise` pool with `DB_*` values, pool limit 10, date strings, and datetime normalization | Align with Hostinger environment names and lifecycle; keep server-only pool |
| `server/src/middleware/auth.js` | Optional auth, required auth, and role middleware based on JWT | Retain the model; apply it consistently to all resource routes |
| `server/src/lib/tokens.js` | Short-lived JWT access tokens plus opaque refresh sessions | Retain or improve; define migration behavior for existing users and sessions |
| `server/src/routes/auth.js` | Custom signup/login/refresh/logout/session/password-reset/update-password against MySQL auth tables | This is the current auth implementation; harden rate limits, reset/session revocation, and data migration |
| `server/src/routes/query.js` | Generic PostgREST-like interpreter for allowlisted table operations and filters | Temporary compatibility layer; replace with explicit resource routes before production cutover |
| `server/src/authz/rules.js` | Express translation of Supabase-style table permissions/RLS | Rework into route-level authorization policies; do not rely on client-supplied filters for ownership |
| `server/src/routes/storage.js` | Local filesystem storage in `server/uploads` for three buckets, with signed URLs and path traversal checks | Use durable Hostinger storage or a documented persistent filesystem; migrate legacy objects |
| `server/src/routes/functions.js` | Express replacements for chat, booking, quote acceptance, invitations, emails, unsubscribe, and Stripe status/test stubs | Split into deliberate REST/action routes and implement missing transactions/payment behavior |
| `server/src/lib/transactionalEmail.js` | MySQL queue insertion and limited template registry | Keep as a Node-side service; add validation/idempotency and complete templates |
| `server/src/jobs/emailWorker.js` | Polls email queue every 10 seconds | Run as a supported Hostinger process or request-driven/cron worker; handle expired leases |
| `server/src/lib/email.js` | Resend provider using server-only `RESEND_API_KEY` and `EMAIL_FROM` | Keep Resend or choose an approved replacement; never expose key to Vite |
| `server/src/lib/emailTemplates.js` | HTML templates for booking confirmation, portal invite, admin message, and reschedule | Preserve behavior while moving all dispatch to Node |
| `server/AUTHZ_REFERENCE.md` | Human-readable authorization reference derived from Supabase migrations | Use as a migration reference, not as runtime enforcement |

### 6.2 Current backend routes

Mounted routes currently include:

**`/api/auth`:** `POST /signup`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /session`, `POST /reset-password-request`, `POST /reset-password`, `POST /update-password`.

**`/api/query`:** one `POST /` endpoint for generic table operations (`select`, `insert`, `update`, `upsert`, and `delete`) with allowlists and compatibility filters.

**`/api/storage`:** `POST /:bucket/upload`, `GET /:bucket/public/*filePath`, `POST /:bucket/sign`, `GET /:bucket/signed/:token`, `GET /:bucket/list`, and `POST /:bucket/remove`.

**`/api/functions`:**

- `POST /chat-assistant`
- `POST /create-booking`
- `POST /accept-quote`
- `POST /invite-employee`
- `POST /send-portal-invite`
- `POST /send-transactional-email`
- `POST /handle-email-unsubscribe`
- `POST /stripe-keys-status`
- `POST /stripe-test-connection`

**`/api/health`:** health endpoint exists. It returns `{ ok: true }` even when the DB check has failed, so it is not currently a reliable readiness check.

There is no dedicated current Express route for several business resources, including a first-class `/api/bookings`, `/api/contact`, `/api/payments`, or `/api/realtime` interface. Those are needed if the compatibility query/function layer is removed.

### 6.3 Backend security and correctness findings

These findings should be addressed during implementation, not silently carried into the target:

- `server/src/routes/query.js` checks `access.allow` on insert but does not consistently enforce `access.where` ownership scope on inserts. This can allow client-supplied foreign owner IDs for some tables, including relationship-sensitive records such as `order_items`, `issue_photos`, `time_entries`, `expenses`, `leave_requests`, and `swap_requests`.
- Invoice customer updates are described as signature-only in authorization comments, but the generic update handler does not enforce a signature-only column allowlist.
- Public insert rules for leads, waitlist, and booking drafts depend on application-layer assumptions rather than dedicated validated endpoints.
- `create-booking` writes multiple records without a transaction and currently hardcodes deposit behavior as disabled/zero.
- `accept-quote` also performs multiple writes without a transaction.
- Password update comments describe revoking other sessions, but the implementation does not revoke all other sessions.
- Auth routes have no visible rate limiting or brute-force protection.
- `storage.js` uses local disk, has a 20 MB in-memory upload buffer, does not visibly validate file content/type, and has no Hostinger durability guarantee in code.
- Signed storage URL expiry is not visibly capped.
- Email queue idempotency keys are recorded in payloads but not enforced as a database uniqueness/idempotency rule.
- Email worker leases can become stuck because the selection path is based on pending status while processing leases can expire.
- HTML email interpolation is not visibly escaped.
- Stripe status/test routes are stubs in Express even though Stripe is a declared server dependency.

## 7. Data model, migrations, and PostgreSQL behavior

### 7.1 Repository schema artifacts

The repository contains 47 files under `supabase/migrations/`. `database-schema.sql` is a concatenated PostgreSQL-oriented artifact generated by `extract-migrations.cjs`. `database-schema-mysql.sql` is the manually adapted MySQL schema used by the Express code.

The MySQL schema defines 43 tables:

`app_users`, `auth_sessions`, `password_reset_tokens`, `profiles`, `user_roles`, `customers`, `hair_profiles`, `chairs`, `service_catalog`, `service_addons`, `jobs`, `job_notes`, `job_photos`, `job_addons`, `time_entries`, `swap_requests`, `waitlist`, `estimates`, `invoices`, `invoice_items`, `leads`, `quotes`, `quote_items`, `lead_interactions`, `messages`, `issue_submissions`, `issue_photos`, `products`, `orders`, `order_items`, `cart_items`, `cart_sessions`, `inventory`, `booking_drafts`, `expenses`, `leave_requests`, `settings`, `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`, `email_dispatch_log`, and `email_queue`.

The MySQL schema explicitly replaces Supabase `auth.users` with `app_users`, stores UUID-like identifiers as `CHAR(36)`, maps PostgreSQL JSON/array concepts to MySQL JSON where applicable, and states that PostgreSQL RLS/functions/triggers/extensions/storage policies are skipped and reimplemented in Express. This is a design artifact, not proof that a Hostinger database has been initialized or populated.

### 7.2 Migration file inventory

The complete migration directory audited contains:

```text
supabase/migrations/20260316235820_cd4256cc-813f-474e-b0d7-4012f912929c.sql
supabase/migrations/20260317003542_ac8768d4-78cd-49f8-8acc-2f11421601db.sql
supabase/migrations/20260317010416_a7873304-ddcf-4e28-8609-a034d6085f2f.sql
supabase/migrations/20260317011232_44ce268a-985c-4590-82e9-76de1d3c2b6a.sql
supabase/migrations/20260317013531_3d8b51fa-ede9-4989-ac74-71cc636f8736.sql
supabase/migrations/20260317015149_7cf33286-44c7-4923-89f3-867004745a73.sql
supabase/migrations/20260317075731_a3873325-eff8-4fd5-85f8-0f4db1a24299.sql
supabase/migrations/20260317081041_d89039fe-aa9d-4515-97f6-bb465a6d3f48.sql
supabase/migrations/20260317090530_3d8fe661-b530-4855-8154-06695d8bfe74.sql
supabase/migrations/20260318181531_297d1952-3d42-4849-a10e-953bb3cf10ee.sql
supabase/migrations/20260318193127_3c41db32-719d-4702-9e02-d5de1b799bfc.sql
supabase/migrations/20260318193652_1dfdf96d-1c9b-404c-9ad4-55a21cb8e3d0.sql
supabase/migrations/20260318195658_c39d9bed-0646-4f30-a36c-fb3dc71b95da.sql
supabase/migrations/20260318200815_0319ff50-08a1-491b-af3f-2497349a80bc.sql
supabase/migrations/20260318201431_8aad8126-7822-48fb-8005-f4c5ae228338.sql
supabase/migrations/20260318202107_138667c7-ffd3-49d4-8d0d-765cc30b1e7b.sql
supabase/migrations/20260319183051_bc839ca6-f46c-4b38-b21a-ded6855c0d80.sql
supabase/migrations/20260324215415_30853384-3071-436a-86a3-0a6605a13812.sql
supabase/migrations/20260324221448_10cd5e82-0168-4dac-9342-60fc83df0be1.sql
supabase/migrations/20260324230552_3903da18-3794-41d4-9d12-e7ab5c7f0c89.sql
supabase/migrations/20260324232159_c5e04042-e10e-47d0-ba70-6eef08bc22e6.sql
supabase/migrations/20260324234553_10e2d533-78d3-4cac-8c22-4802261d06a0.sql
supabase/migrations/20260325000445_86892259-afae-4845-a3b3-906ea401ef09.sql
supabase/migrations/20260325002405_4c8ddc90-2a0f-499b-9d14-c20fc560dff7.sql
supabase/migrations/20260325011758_134f0449-ca58-4edd-bcfa-05a63b3f8644.sql
supabase/migrations/20260325143239_089b48b1-08fb-4aba-83ce-890feea571c3.sql
supabase/migrations/20260415231520_47453a81-59a5-4036-a0f4-aea096ffbaf7.sql
supabase/migrations/20260415232210_36391952-5f8a-43ba-9e30-a0977d5ff82e.sql
supabase/migrations/20260415233450_9547659a-5f3e-4010-8090-866179d483a7.sql
supabase/migrations/20260415233510_683bf083-b714-4a68-b1be-1dffea52bbfb.sql
supabase/migrations/20260416075505_3e4d8dda-b408-424a-b074-68e7f1cc2f60.sql
supabase/migrations/20260416082837_b3d14000-2b32-45ab-982d-ea8de6892374.sql
supabase/migrations/20260416100416_1c7f7362-6f35-4f61-9326-34c6b8fe305c.sql
supabase/migrations/20260416102852_e3bcd7c9-9113-4b12-9f1c-eaccf1c30b14.sql
supabase/migrations/20260511120451_9b2d53a7-fb86-4049-9a9f-cba16e903bc7.sql
supabase/migrations/20260511131632_d8d5cb94-4b0e-4880-8d52-40c4c38179a9.sql
supabase/migrations/20260511200123_8d1805ed-4b6c-46b9-8349-bede67e20395.sql
supabase/migrations/20260511200510_654faa6d-7cd3-4811-8f2a-967378f1a4e6.sql
supabase/migrations/20260511201518_email_infra.sql
supabase/migrations/20260511201846_1e579f56-96c4-4fa9-a1d1-1456077afe32.sql
supabase/migrations/20260511212229_4028275c-fb2f-459f-b588-fe7a8a9134c4.sql
supabase/migrations/20260511213445_9a953f94-46b8-4c8d-80e9-8cf4ac0936f0.sql
supabase/migrations/20260511215442_9ced414d-6c35-4c9a-b38f-02cdfc533f2a.sql
supabase/migrations/20260511222642_d6ff7dcc-ee83-4720-866c-8452283aa986.sql
supabase/migrations/20260511223740_65637bf2-1d65-47d6-82d7-bc0bfc47f620.sql
supabase/migrations/20260626091529_0269420a-1b4c-4137-99ba-1e1fefbadcf9.sql
supabase/migrations/20260626091554_cf97d5bf-ac78-4813-8c82-c19e2d464f32.sql
```

### 7.3 PostgreSQL functions, triggers, and RLS

The migrations define or replace these PostgreSQL functions:

- `public.has_role`
- `public.handle_new_user`
- `public.on_invoice_status_change`
- `public.recompute_profile_bookable`
- `public.trg_user_roles_bookable`
- `public.enqueue_email`
- `public.read_email_batch`
- `public.delete_email`
- `public.move_to_dlq`

They define these notable triggers:

- `on_auth_user_created`
- `invoices_status_sync`
- `user_roles_bookable_trigger`
- `update_inventory_updated_at`
- `update_leads_updated_at`
- `update_leave_requests_updated_at`
- `update_orders_updated_at`
- `update_products_updated_at`

RLS is enabled across the business and email infrastructure tables in the migrations. The final policy intent documented in `server/AUTHZ_REFERENCE.md` includes:

- Admin/self access for profiles and customers.
- Customer-owned access for hair profiles, jobs, invoices, messages, estimates, job photos, and related records.
- Admin/mechanic/customer scope for jobs and staff-only scope for time, leave, and swap records.
- Public read for selected catalog/product/settings data.
- Admin-only management for catalog, inventory, chairs, employees, quotes, and operational records.
- Public but constrained insertion for leads, waitlist, booking drafts, and selected booking-related data.
- Service-role-only access for email queue/log/suppression/token infrastructure.
- Storage policies for `job-photos`, `site-images`, `expense-receipts`, `issue-photos`, and `vehicle-photos`.

The migration history contains policies that are later dropped/replaced. The effective policy must be derived in migration order, not by reading only the first policy for a table. All of this behavior must become explicit Express authorization and MySQL transaction logic because MySQL will not reproduce Supabase RLS automatically.

## 8. Feature-by-feature audit

| Feature | Current implementation | Migration work required | Data migration? |
|---|---|---|---|
| Authentication | `server/src/routes/auth.js`; MySQL `app_users`, sessions, reset tokens; frontend still calls `supabase.auth` through compatibility client | Keep server-only auth, replace frontend calls with REST, decide hash/session migration and enforce rate limits | Yes for users, profiles, roles, and possibly active sessions; reset tokens should generally be invalidated |
| Admin functionality | React admin routes/pages plus `requireRole('admin')` and table rules | Create explicit admin APIs and enforce role/ownership server-side; frontend wrappers are not sufficient | Yes for admin users, profiles, roles, settings, operational records |
| Staff/mechanics | Staff portal, schedule, waitlist, clients, payroll/time/leave/swap | Preserve routes and UI; create staff resource APIs and strict staff ownership checks | Yes for profiles, roles, jobs, time, leave, swaps |
| Customers | Customer directory, customer portal, profiles, messages, jobs, hair profiles | Preserve UI; create customer APIs and ownership rules | Yes for customer records and linked history |
| Booking | `src/pages/Booking.tsx`, booking drafts, `/api/functions/create-booking`, legacy Edge Function | Implement `/api/bookings` transaction, availability validation, customer/profile/job/add-on writes, photo linking, notifications, and real deposit behavior | Yes for booking drafts/jobs/add-ons/photos/invoices/notifications |
| Contact forms | `src/pages/Contact.tsx` inserts customer/message through generic query path; Google Maps embed | Add a validated `/api/contact` or `/api/messages` endpoint with abuse controls and email notification | Existing customers/messages if live |
| Services | `service_catalog`, `service_addons`, settings, site images, public service routes | Add catalog/settings APIs and media URLs | Yes for catalog, add-ons, settings, and image files |
| Staff | Profiles, roles, job assignments, bookability triggers | Reproduce bookable/staff role logic in Express/MySQL | Yes |
| Payments | Legacy Stripe checkout/webhook Edge Functions; server package includes Stripe but Express status/test handlers are stubs; booking currently uses zero deposit | Implement Stripe checkout, webhook signature verification, idempotency, invoice/payment status updates, and server-only key handling | Yes for invoices and Stripe IDs/statuses if used; reconcile with Stripe directly |
| Email | Current Resend queue/worker; legacy Lovable email Edge Functions and Supabase queue RPCs | Keep one Node worker/provider, migrate queue/suppression/token state, remove old send path after cutover | Yes for queued/failed history and suppression/unsubscribe state |
| SMS | No provider or SMS implementation found | New design/integration if required | No existing SMS provider data identified |
| File uploads | Express local `server/uploads` compatibility layer plus legacy Supabase Storage usage | Choose durable Hostinger storage, enforce MIME/size/ownership rules, migrate objects and paths | Yes for files and path metadata |
| Realtime | Supabase-shaped channel calls are implemented as 20-second polling | Replace with polling endpoints or approved server push if needed; preserve visible behavior | No, unless event history is added |
| External AI | Current Express chat uses Anthropic; old Edge Function uses Lovable AI Gateway | Keep or replace Anthropic behind Node; remove Lovable gateway | Chat logs not found in schema; verify if external logs exist |
| Shop/orders/cart | MySQL-compatible tables and frontend query calls | Create product/order/cart APIs with session ownership and checkout/payment integration | Yes for products, inventory, orders, items, cart sessions/items |
| Leads/quotes | Admin pages and generic query operations; legacy accept-quote Edge Function and Express replacement | Create lead/quote APIs and transactional quote acceptance | Yes for leads, quotes, quote items, interactions |

## 9. Supabase dependency audit

The project has two different kinds of Supabase dependency: current source-level dependence on a Supabase-shaped compatibility API, and retained Supabase runtime artifacts that would still depend on Supabase if deployed or invoked.

### 9.1 Package and compatibility dependencies

| Exact file | Current use | Active? | Replacement | Existing data migration? |
|---|---|---:|---|---:|
| `package.json` | Declares `@supabase/supabase-js` `^2.99.2` as a frontend dependency | Installed/declared, but current compatibility client does not use it for normal frontend requests | Remove after all source imports and generated types are no longer needed | No direct data move; removing it must not remove data |
| `package-lock.json` | Locks `@supabase/supabase-js` and its transitive tree | Lockfile dependency | Regenerate after approved removal | No |
| `src/integrations/supabase/client.ts` | Exports the Express-backed `apiClient` under the name `supabase`; comments and API shape preserve Supabase semantics | Actively imported | Replace with a normal API client or typed REST modules; remove Supabase naming | No direct data move |
| `src/lib/apiClient.ts` | Implements `.from`, `.auth`, `.storage`, `.functions`, and polling `.channel` compatibility calls | Actively used by the whole frontend | Replace with explicit `/api` REST calls; retain only a neutral HTTP/auth helper if useful | No direct data move |
| `src/lib/supabase.ts` | Re-exports the compatibility object as `db` and `supabase` | Actively imported by many components/pages | Replace with neutral API modules/hooks | No direct data move |
| `src/integrations/supabase/types.ts` | Supabase-shaped generated/manual database types, including storage paths | Compile-time dependency for parts of the frontend | Replace with API DTO/types generated or maintained for Express/MySQL | No direct data move |
| `src/contexts/AuthContext.tsx` | Loads profiles/roles with `.from()` and listens with `supabase.auth` | Active | `fetch('/api/auth/session')` plus a neutral auth context/event model | User/profile/role migration required |
| `src/pages/Auth.tsx` | Uses `supabase.auth.signInWithPassword`, `signUp`, and reset request, plus roles query | Active | `/api/auth/login`, `/signup`, `/reset-password-request`, and role/session response | User/profile/role migration required |
| `src/pages/ResetPassword.tsx` | Uses compatibility `confirmPasswordReset` | Active | `/api/auth/reset-password` | Reset tokens should be reissued/invalidated, not copied blindly |
| `src/pages/Settings.tsx` | Uses `supabase.auth.updateUser` and function calls for Stripe checks | Active admin UI | `/api/auth/update-password`, `/api/payments/connection` | User sessions; payment configuration/status if live |
| `src/pages/portal/PortalSettings.tsx` | Uses `supabase.auth.updateUser` for password changes | Active | `/api/auth/update-password` | User/session migration |
| `src/pages/Customers.tsx` | Uses `.from()`, auth reset, function email/invite calls, and a stale direct Supabase password endpoint | Active admin page; stale direct endpoint also remains | Customer/admin REST APIs and `/api/auth` actions; remove direct Supabase URL/key use | Customer/user data; reset tokens reissued |
| `src/pages/Unsubscribe.tsx` | Uses stale `VITE_SUPABASE_URL`/publishable key fetch and compatibility function invocation | Route active, but the direct GET path is stale/broken against current Express POST route | Public `/api/email/unsubscribe` endpoint with signed token | Suppression/unsubscribe state must migrate |

### 9.2 Frontend Supabase-shaped call sites

The following exact files import `src/lib/supabase.ts` or the compatibility client and are active call sites for `.from()` operations. They require REST API migration even though requests currently terminate in Express:

```text
src/components/admin/ServiceAddonsManager.tsx
src/components/AdminSidebar.tsx
src/components/booking/BookingEditPanel.tsx
src/components/booking/BookingUpsell.tsx
src/components/booking/NewAppointmentDialog.tsx
src/components/booking/ServiceAddonsPicker.tsx
src/components/ExitIntentPopup.tsx
src/components/jobs/AppointmentCard.tsx
src/components/jobs/JobAddonsList.tsx
src/components/jobs/QuickReschedulePopover.tsx
src/components/PromoBar.tsx
src/contexts/AuthContext.tsx
src/hooks/useSiteImages.ts
src/lib/bookings.ts
src/lib/waitlist.ts
src/pages/AdminOrders.tsx
src/pages/AdminProducts.tsx
src/pages/Auth.tsx
src/pages/Booking.tsx
src/pages/BuyerAccount.tsx
src/pages/CalendarPage.tsx
src/pages/Cart.tsx
src/pages/ChairsStations.tsx
src/pages/Checkout.tsx
src/pages/ClientDirectory.tsx
src/pages/Contact.tsx
src/pages/Customers.tsx
src/pages/Dashboard.tsx
src/pages/EmployeeProfile.tsx
src/pages/Employees.tsx
src/pages/Expenses.tsx
src/pages/HairProfiles.tsx
src/pages/HomePage.tsx
src/pages/InventoryPage.tsx
src/pages/Jobs.tsx
src/pages/Leads.tsx
src/pages/Messages.tsx
src/pages/Payroll.tsx
src/pages/portal/PortalBookings.tsx
src/pages/portal/PortalDashboard.tsx
src/pages/portal/PortalSettings.tsx
src/pages/portal/PortalStyleDiary.tsx
src/pages/ProductDetail.tsx
src/pages/Reports.tsx
src/pages/ServiceCatalog.tsx
src/pages/ServiceCategoryPage.tsx
src/pages/ServiceManager.tsx
src/pages/ServicesDirectory.tsx
src/pages/Shop.tsx
src/pages/staff/StaffClients.tsx
src/pages/staff/StaffSchedule.tsx
src/pages/StaffPortal.tsx
src/pages/WaitlistPage.tsx
```

The exact files with direct `supabase.auth` calls are:

```text
src/contexts/AuthContext.tsx
src/pages/Auth.tsx
src/pages/Customers.tsx
src/pages/ResetPassword.tsx
src/pages/Settings.tsx
src/pages/Unsubscribe.tsx
src/pages/portal/PortalSettings.tsx
```

The exact files with direct `supabase.storage` calls are:

```text
src/hooks/useSiteImages.ts
src/pages/AdminProducts.tsx
src/pages/Booking.tsx
src/pages/Expenses.tsx
src/pages/Jobs.tsx
src/pages/portal/PortalStyleDiary.tsx
src/pages/ServicesDirectory.tsx
src/pages/ServiceManager.tsx
src/pages/StaffPortal.tsx
```

The exact files with direct `supabase.functions.invoke` calls are:

```text
src/components/LiveChat.tsx
src/pages/Booking.tsx
src/pages/Customers.tsx
src/pages/Dashboard.tsx
src/pages/Employees.tsx
src/pages/Jobs.tsx
src/pages/Settings.tsx
src/pages/Unsubscribe.tsx
```

The exact files with direct channel/realtime-shaped calls are:

```text
src/pages/CalendarPage.tsx
src/pages/Dashboard.tsx
src/pages/Jobs.tsx
src/pages/Messages.tsx
src/pages/WaitlistPage.tsx
src/pages/staff/StaffSchedule.tsx
```

No current frontend `.rpc()` call was found. PostgreSQL RPC usage remains in the Supabase email infrastructure/functions and must be replaced by Node services or direct parameterized MySQL operations.

### 9.3 Supabase configuration and Edge Functions

| Exact file/directory | Current use | Active? | Replacement | Existing data migration? |
|---|---|---:|---|---:|
| `supabase/config.toml` | Supabase project ID and JWT verification settings for Edge Functions | Runtime configuration if Supabase functions are deployed | Remove from the final architecture after cutover approval | No direct data move |
| `supabase/functions/_shared/` | Shared Deno/CORS/email/function helpers | Active for functions that import it if deployed | Move needed shared logic to Node modules | Depends on email/auth/payment state |
| `supabase/functions/accept-quote/index.ts` | Supabase service-role quote acceptance and customer/job creation | Retained legacy/deployable; current frontend reaches Express compatibility route | Transactional Express `/api/quotes/:id/accept` | Leads, quotes, customers, jobs |
| `supabase/functions/admin-change-password/index.ts` | Supabase Auth admin password change using service role | Retained legacy; `Customers.tsx` still references its old URL directly | Protected `/api/admin/users/:id/password` using Node auth tables | Users/sessions; reset other sessions |
| `supabase/functions/chat-assistant/index.ts` | Chat endpoint using Lovable AI Gateway and Supabase data | Retained legacy/deployable; current frontend reaches Anthropic-backed Express route | Node `/api/chat` using approved server-side provider | No chat table found; verify external logs |
| `supabase/functions/create-booking/index.ts` | Supabase service-role booking workflow and email | Retained legacy/deployable; current frontend reaches Express route | Transactional `/api/bookings` | Booking/customer/job/add-on/photo data |
| `supabase/functions/create-deposit-checkout/index.ts` | Stripe checkout session creation using Supabase data and Stripe secret | Retained legacy/deployable; current Express equivalent is absent | Server-side `/api/payments/checkout` | Invoice/payment/Stripe IDs if live |
| `supabase/functions/email-scheduler/index.ts` | Supabase email scheduling/queue work | Retained legacy/deployable | Node worker/cron against MySQL queue | Email queue/state/logs |
| `supabase/functions/handle-email-suppression/index.ts` | Lovable webhook verification and suppression processing | Retained legacy/deployable | Node Resend/provider webhook route | Suppressed emails and dispatch logs |
| `supabase/functions/handle-email-unsubscribe/index.ts` | Public unsubscribe token handling against Supabase | Retained legacy/deployable; current frontend also invokes compatibility route | Public Node `/api/email/unsubscribe` | Unsubscribe tokens, suppression state |
| `supabase/functions/invite-employee/index.ts` | Creates/invites employee using Supabase Auth/profile/role and Lovable-origin assumptions | Retained legacy/deployable; current frontend reaches Express route | Node admin employee invitation route | Users/profiles/roles/reset tokens |
| `supabase/functions/notify-waitlist/index.ts` | Waitlist notification workflow using Supabase data/service role | Retained legacy/deployable | Node waitlist service + email queue | Waitlist and email history |
| `supabase/functions/preview-transactional-email/index.ts` | Lovable-key-gated email preview | Retained legacy/deployable | Protected Node preview endpoint or remove | No, unless audit/history is required |
| `supabase/functions/process-email-queue/index.ts` | Supabase RPC queue reader and `@lovable.dev/email-js` sender | Retained legacy/deployable; conflicts with current Resend worker | Node queue worker using Resend or approved provider | Email queue/send state/logs/suppression |
| `supabase/functions/send-portal-invite/index.ts` | Creates portal invite/reset token and sends email via Supabase/Lovable path | Retained legacy/deployable; current frontend reaches Express route | Node portal invitation service | Users/reset tokens/email history |
| `supabase/functions/send-transactional-email/index.ts` | Supabase-authenticated transactional email enqueue/send flow | Retained legacy/deployable; current frontend reaches Express route | Node email API and queue | Queue/logs/suppression; template state |
| `supabase/functions/stripe-deposit-webhook/index.ts` | Public Stripe webhook updates Supabase booking/invoice state | Retained legacy/deployable | Node `/api/payments/stripe/webhook` with signature verification/idempotency | Invoice/payment records and Stripe event IDs |
| `supabase/functions/stripe-keys-status/index.ts` | Reports Stripe secret/publishable key status | Retained legacy/deployable; Express equivalent is a stub | Server-only configuration/status endpoint | No, except payment configuration audit |
| `supabase/functions/stripe-test-connection/index.ts` | Tests Stripe connection | Retained legacy/deployable; Express equivalent is a stub | Server-only Stripe health check | No |

All these Edge Functions import Supabase clients or use Supabase environment values. Their use of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and/or `SUPABASE_SERVICE_ROLE_KEY` is incompatible with the final architecture. The Node replacements must use only server-side MySQL pool access and server-only provider credentials.

### 9.4 Supabase storage dependency

The migrations reference these bucket names:

- `job-photos`
- `site-images`
- `expense-receipts`
- `issue-photos`
- `vehicle-photos`

The current Express compatibility route implements only `job-photos`, `site-images`, and `expense-receipts` in local disk storage (`server/src/routes/storage.js`). The original migration history contains additional `issue-photos` and `vehicle-photos` buckets and policies. The bucket policy history also changes over time, so final access rules must be based on intended business behavior, not just initial policies.

Files and metadata requiring migration include object path, bucket, MIME/type, size, ownership, linked database row, visibility, and any signed/public URL references. A Hostinger filesystem is only acceptable if its persistence, backup, permissions, and serving model are verified; otherwise use an approved durable object-storage alternative while keeping credentials server-side.

## 10. Lovable dependency audit

| Exact file | Current use | Active? | Replacement | Existing data migration? |
|---|---|---:|---|---:|
| `package.json` | Declares `lovable-tagger` `^1.1.13` | Installed dev dependency | Remove after Vite config no longer imports it | No |
| `package-lock.json` | Locks `lovable-tagger` | Lockfile dependency | Regenerate after approved removal | No |
| `bun.lock` | Locks `lovable-tagger` and contains Lovable package-cache URLs | Package metadata only unless Bun is used | Regenerate/remove according to the chosen package manager | No |
| `vite.config.ts` | Calls `componentTagger()` in development | Active in development mode | Remove the plugin and dependency; preserve standard React/Vite/PWA behavior | No |
| `playwright.config.ts` | Imports `lovable-agent-playwright-config/config` | Test config is present but unresolved in the installed dependency tree; `require.resolve` failed during audit | Replace with ordinary Playwright config or remove unused integration | No |
| `playwright-fixture.ts` | Imports `lovable-agent-playwright-config/fixture` | Same unresolved legacy test dependency | Replace with ordinary fixtures | No |
| `.lovable/plan.md` | Documents Lovable preview/PWA cache remediation | Not runtime code | Archive/remove only after approval and after preview cleanup is intentionally redesigned | No |
| `README.md` | Says “Welcome to your Lovable project” and is otherwise a placeholder | Documentation only | Replace with project/runbook documentation | No |
| `src/main.tsx` | Detects Lovable preview hosts and strips `__lovable_*`/preview auth URL parameters; resets preview caches/service workers | Active at application startup | Keep only generic safe URL cleanup if needed; remove Lovable host/token logic | No |
| `src/components/PwaUpdatePrompt.tsx` | Disables PWA registration for Lovable preview hosts and embedded previews | Active on runtime | Replace with deployment-agnostic preview/dev logic | No |
| `src/pages/Index.tsx` | Contains `data-lovable-blank-page-placeholder`; it is not the routed home page in `src/App.tsx` | File is not part of the current route path | Remove/rework only after confirming it is unused; no frontend redesign in this phase | No |
| `src/pages/Settings.tsx` | User-facing toasts tell an admin to ask Lovable to set Stripe secrets through a secure form | Active admin UI text; current Express Stripe checks are stubs | Replace with a server-admin configuration/health flow that never exposes secrets | Payment configuration/status may need verification |
| `supabase/functions/chat-assistant/index.ts` | Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY` | Active if deployed/invoked; not current Express path | Node-side approved AI provider, currently Anthropic route exists | No chat table found |
| `supabase/functions/process-email-queue/index.ts` | Imports `npm:@lovable.dev/email-js`, uses `LOVABLE_API_KEY` and optional `LOVABLE_SEND_URL` | Active if deployed/invoked; conflicts with current Resend worker | Node Resend worker/queue | Email queue/logs |
| `supabase/functions/preview-transactional-email/index.ts` | Uses Lovable API key as access gate | Active if deployed/invoked | Protected Node preview route or remove | No |
| `supabase/functions/handle-email-suppression/index.ts` | Imports `npm:@lovable.dev/webhooks-js` and verifies Lovable API-key HMAC | Active if deployed/invoked | Node/provider webhook verification | Suppression/log state |
| `supabase/functions/invite-employee/index.ts` | Builds a fallback origin ending in `.lovable.app` | Active if function is deployed/invoked | Use configured frontend origin only | User invite/reset state |
| `supabase/functions/send-transactional-email/index.ts` | Comments require a subdomain delegated to Lovable nameservers | Documentation/configuration assumption | Use the approved Node email domain/provider and DNS arrangement | Email delivery history may need reconciliation |
| `public/sw.js` | Clears caches and unregisters itself; related to stale PWA cleanup | Public asset may be requested directly; generated `eandb-app-sw.js` is the configured worker | Consolidate worker ownership after approval | No |
| `public/service-worker.js` | Imports `/sw.js` | Public legacy worker wrapper; no current registration was found | Remove/consolidate only after service-worker audit | No |

Lovable references also occur in comments and historical explanatory text. These are not all runtime dependencies, but they should be removed from the final operational documentation and user-facing UI after the corresponding behavior is replaced.

## 11. Environment and secret audit

### 11.1 Frontend environment names

Files:

- `.env`
- `.env.example`
- `.env.production`

The current frontend environment name is `VITE_API_URL`. The source also references stale Supabase variables that are not present in the current examples:

- `VITE_SUPABASE_PROJECT_ID` in `src/pages/Customers.tsx`
- `VITE_SUPABASE_URL` in `src/pages/Unsubscribe.tsx`
- `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/pages/Unsubscribe.tsx`

The final frontend should not contain database credentials, Supabase service keys, Stripe secret keys, JWT secrets, Resend keys, or any other private provider credential in `VITE_` variables. For the target same-origin design, `VITE_API_URL` may become unnecessary or be limited to an explicitly approved public API origin.

### 11.2 Backend environment names

Files:

- `server/.env`
- `server/.env.example`

The server references:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ANTHROPIC_API_KEY`
- `STORAGE_SIGN_SECRET`

These are server-side names. They must remain out of the frontend build and must be configured through Hostinger’s server environment management.

### 11.3 Legacy Supabase/Edge environment names

The Edge Functions reference `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret/publishable names, `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`, and related legacy email-provider values. These references are evidence of retained legacy execution paths and must not be copied into the target frontend or Node public environment.

## 12. Data migration inventory

No live row counts, object counts, or production exports were obtained. The following data classes are present in repository schemas/code and must be inventoried before cutover:

| Data class | Source representation | Target representation | Migration notes |
|---|---|---|---|
| Users/auth | Supabase `auth.users` assumed by original migrations/Edge Functions; MySQL `app_users` in replacement schema | `app_users`, `auth_sessions`, `password_reset_tokens` | Preserve UUIDs if possible; verify password-hash compatibility; invalidate or reissue reset/session tokens |
| Profiles/roles | `profiles`, `user_roles`, Supabase role function/RLS | Same-named MySQL tables | Preserve admin/mechanic/customer roles and bookability state |
| Customers | `customers` | `customers` | Preserve links to `user_id`, contact details, consent/suppression fields |
| Hair/vehicle/profile data | `hair_profiles`, vehicle-related legacy references | `hair_profiles` and any approved vehicle model | Confirm whether vehicle data is still required; migrate linked photos if present |
| Services | `service_catalog`, `service_addons`, `settings` | Same-named MySQL tables | Preserve active/promo/category/pricing/configuration values |
| Jobs/bookings | `jobs`, `job_notes`, `job_addons`, `job_photos`, `booking_drafts`, `time_entries`, `swap_requests`, `waitlist` | Same-named MySQL tables | Preserve status history, assignment, scheduling, ownership, drafts, and photo links |
| Estimates/invoices | `estimates`, `invoices`, `invoice_items` | Same-named MySQL tables | Reconcile totals/statuses/signatures and payment identifiers |
| Leads/quotes | `leads`, `quotes`, `quote_items`, `lead_interactions` | Same-named MySQL tables | Preserve quote state and acceptance relationships |
| Messages/issues | `messages`, `issue_submissions`, `issue_photos` | Same-named MySQL tables | Preserve inbound/outbound direction and issue attachments |
| Commerce | `products`, `orders`, `order_items`, `inventory`, `cart_items`, `cart_sessions` | Same-named MySQL tables | Migrate order history; treat active carts as a cutover decision |
| Expenses/leave | `expenses`, `leave_requests` | Same-named MySQL tables | Preserve staff ownership and receipt paths |
| Email | `email_queue`, `email_send_log`, `email_send_state`, `email_dispatch_log` | Same-named MySQL tables/Node worker | Decide what pending messages are safe to replay; enforce idempotency |
| Suppression/unsubscribe | `suppressed_emails`, `email_unsubscribe_tokens` | Same-named MySQL tables/Node endpoints | Preserve suppression to avoid unwanted mail |
| Settings | `settings` | `settings` | Verify payment/deposit/default booking settings |
| Storage objects | Supabase Storage object metadata and files in five referenced buckets; current local compatibility files | Hostinger durable storage and MySQL path metadata | Need export of files and object metadata; public/private behavior must be revalidated |
| Payments | Stripe external customer/payment/checkout/webhook identifiers, plus invoice fields | MySQL invoice/payment fields and Stripe reconciliation | Do not assume local DB is authoritative; reconcile with Stripe if live |

## 13. Required replacement matrix

| Supabase/Lovable capability | Current location | Target implementation |
|---|---|---|
| Supabase query client | `src/integrations/supabase/client.ts`, `src/lib/apiClient.ts`, `src/lib/supabase.ts` | Typed Express REST resources; frontend `fetch('/api/...')` |
| Supabase Auth | Compatibility auth plus legacy Edge Functions/migrations | Express auth routes, MySQL user/session tables, secure cookies or carefully managed tokens |
| Supabase database/RLS | `supabase/migrations/*.sql`, `server/authz/rules.js` | Hostinger MySQL schema plus explicit route authorization, ownership checks, transactions |
| Supabase Storage | Frontend storage calls, migration bucket policies | Durable Hostinger storage strategy, server-authorized upload/download, migrated object paths |
| Supabase Edge Functions | `supabase/functions/*/index.ts` | Express route modules and Node workers |
| Supabase RPC/email queues | Email migrations and Edge Functions | Parameterized MySQL queue operations and Node email worker |
| Supabase Realtime | Frontend channel calls; current polling shim | Explicit polling or approved Node push mechanism |
| Lovable component tagger | `vite.config.ts`, `package.json` | Standard Vite React build |
| Lovable preview cleanup | `src/main.tsx`, `src/components/PwaUpdatePrompt.tsx`, `.lovable/plan.md` | Generic deployment-safe PWA/cache behavior |
| Lovable AI Gateway | `supabase/functions/chat-assistant/index.ts` | Approved server-side Anthropic/other provider route |
| Lovable email SDK/webhooks | `supabase/functions/process-email-queue/index.ts`, `handle-email-suppression/index.ts` | Resend/approved provider through Node |
| Lovable payment setup copy | `src/pages/Settings.tsx` | Server-managed payment configuration and health checks |
| Render backend deployment | `deploy-hostinger.sh` comments/instructions | Hostinger Node.js Web App deployment and process/environment configuration |

## 14. Hosting audit

The requested hosting target is Hostinger Node.js Web App. The repository’s `deploy-hostinger.sh` currently describes a different arrangement:

- Frontend built and uploaded as static files to Hostinger `public_html`.
- Backend deployed separately to Render.
- Hostinger MySQL reached remotely by the Render API.
- `.env.production` is set to an onrender-style API URL.
- `.htaccess` is used for Apache SPA rewrites.

That script is not an implementation of the requested final topology. It must not be used as the final deployment plan without redesign. The target hosting audit still needs decisions on:

- Whether the Hostinger Node.js Web App serves both Vite build output and `/api` from one process.
- Node version selected and supported by Hostinger.
- Process/start command and working directory.
- HTTPS/same-origin API routing so the frontend can use `/api`.
- MySQL host/allowlist behavior inside Hostinger.
- Persistent storage path and backup strategy for uploads.
- Worker/cron support for email queue processing.
- Environment variable configuration and rotation.
- SPA fallback behavior for all existing routes.

## 15. Verification baseline captured during audit

These checks were read-only validation of the current repository state; no source fix was applied:

- TypeScript check: `npx tsc --noEmit -p tsconfig.app.json` passed.
- Tests: `npm test -- --reporter=dot` passed the existing test file with 1 test.
- Production build: `npm run build` passed when output was directed to a temporary directory outside the repository. The build reported a large main bundle (approximately 1.49 MB) and a PWA precache warning/large output.
- Server JavaScript syntax check passed.
- Lint: failed with 309 problems (271 errors, 38 warnings), mainly explicit `any` usage, hook/dependency warnings, and the `require` in `tailwind.config.ts`.
- Playwright configuration: the referenced `lovable-agent-playwright-config` package could not be resolved from the installed dependency tree.
- `npm audit --omit=dev --audit-level=high`: could not determine vulnerability status because the audit request failed TLS certificate verification in the environment.

These results are baseline findings, not Phase 1 fixes.

## 16. Recommended migration order after approval

This order is a planning recommendation only; no step below was executed during this audit.

1. Freeze and export source data from every live provider, including Supabase Auth/database/storage, Stripe, and email suppression/queue state.
2. Confirm the final Hostinger Node.js Web App topology, Node version, storage durability, worker model, and same-origin `/api` routing.
3. Establish a versioned MySQL migration system and reconcile `database-schema-mysql.sql` against the desired final schema.
4. Implement and test explicit Express REST resources with transactions and server-side authorization before removing the generic compatibility layer.
5. Implement auth migration and session/reset strategy; test admin, staff, customer, and anonymous flows.
6. Implement durable storage migration and secure upload/download behavior.
7. Implement email queue/provider and Stripe checkout/webhooks with idempotency and reconciliation.
8. Migrate frontend call sites from Supabase-shaped calls to typed `fetch('/api/...')` while preserving existing components and routes.
9. Remove Lovable/Supabase package/runtime references only after replacement paths are tested and data is verified.
10. Run full route, authz, booking, payment, email, upload, PWA, and Hostinger staging tests, then plan cutover and rollback.

## 17. Approval gate

This document is the requested Phase 1 migration audit. The application code, Supabase directory, database artifacts, environment files, and deployment configuration have not been changed by this audit.

**STOP: awaiting approval before any migration implementation, dependency removal, Supabase removal, database work, deployment work, or frontend API refactor.**
