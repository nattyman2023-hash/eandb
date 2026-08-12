-- =====================================================================
-- MySQL 8 schema for auto-care-buddy-19
-- Regenerated from supabase/migrations/*.sql (47 files) applied in
-- filename order, cross-checked against the live-schema snapshot in
-- src/integrations/supabase/types.ts (Supabase-generated types reflect
-- the actual final-state column list for every table).
--
-- Conventions used throughout this file:
--   uuid              -> CHAR(36)  (app generates the UUID string before INSERT;
--                                    no DEFAULT is defined on the column)
--   jsonb / json      -> JSON
--   text[] (pg array) -> JSON (stored as a JSON array)
--   Postgres enum     -> inline MySQL ENUM(...) on the column (few call sites
--                          per enum, so a lookup table would be overkill)
--   timestamptz       -> DATETIME (application assumes UTC everywhere)
--   now()             -> CURRENT_TIMESTAMP
--   numeric           -> DECIMAL(10,2) unless a migration implies otherwise
--   boolean           -> TINYINT(1)
--   gen_random_uuid() column default -> dropped (app generates UUIDs pre-insert)
--
-- Skipped on purpose (handled elsewhere, not portable to MySQL DDL):
--   RLS policies (CREATE POLICY / ENABLE ROW LEVEL SECURITY)       -> see server/AUTHZ_REFERENCE.md
--   Postgres functions/triggers (has_role, update_updated_at_column,
--     on_invoice_status_change, trg_user_roles_bookable, etc.)     -> reimplemented in Express
--   Extensions (pgmq, pg_cron, pg_net, supabase_vault)             -> replaced by email_queue table below
--   storage.buckets / storage.objects policies                    -> see server/AUTHZ_REFERENCE.md
--
-- NOTE: Postgres trigger handle_new_user (auto-create profile + default
-- 'customer' role on signup) has no MySQL equivalent — reimplemented in
-- the Express signup route, not in this schema.
--
-- NOTE: There is no `users` table in this schema. Supabase Auth
-- (auth.users) is being replaced by an Express-managed auth layer that
-- is out of scope for this file. `profiles.user_id` is treated as the
-- canonical application user identifier; columns that referenced
-- auth.users(id) in Postgres (jobs.assigned_to, time_entries.mechanic_id,
-- expenses.employee_id, leave_requests.staff_id, job_photos.uploaded_by,
-- job_notes.author_id, lead_interactions.author_id, leads.assigned_to,
-- swap_requests.from_mechanic_id/to_mechanic_id, orders.user_id,
-- customers.user_id) are kept as plain CHAR(36) with NO foreign key,
-- exactly matching the original Postgres schema (none of those columns
-- had an actual FK constraint to auth.users either).
--
-- REVIEW markers below flag every assumption made where the source
-- migrations did not fully specify a detail (most commonly: FK ON DELETE
-- behavior for the handful of tables that predate the tracked migration
-- history, since their CREATE TABLE statements are not in this repo).
-- =====================================================================

SET FOREIGN_KEY_CHECKS=0;

-- ==================================================
-- Auth (replaces Supabase's auth.users + GoTrue session/reset handling,
-- which has no MySQL/Express equivalent out of the box)
-- ==================================================

CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_app_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens, stored hashed so a stolen DB dump can't be replayed directly.
-- Deleting a row (logout / password change) revokes that session.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auth_sessions_user (user_id),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_reset_token_hash (token_hash),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Core Identity & Customer Tables
-- ==================================================

-- Profiles table (predates tracked migrations; columns reconstructed from
-- ALTER TABLE statements across the migration history + types.ts)
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  pay_rate DECIMAL(10,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  skills JSON DEFAULT (JSON_ARRAY()),        -- was text[] DEFAULT '{}'
  postcode VARCHAR(20) DEFAULT '',
  bookable TINYINT(1) NOT NULL DEFAULT 1,    -- false for super_admin, kept in sync by app (was trg_user_roles_bookable)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_id (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles table (predates tracked migrations; no CREATE TABLE found in
-- history, reconstructed from types.ts + ON CONFLICT (user_id, role) usage)
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin','mechanic','customer','super_admin') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers table (predates tracked migrations)
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) DEFAULT NULL,             -- app user id; no FK (see header note); unique when present
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  address VARCHAR(500) DEFAULT NULL,
  postcode VARCHAR(20) DEFAULT NULL,
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_customers_user_id_unique (user_id),  -- was a partial unique index (WHERE user_id IS NOT NULL);
                                                       -- MySQL unique indexes already allow multiple NULLs, so this is equivalent
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Vehicles / "hair_profiles" (renamed mid-project — see REVIEW)
-- ==================================================
-- REVIEW: This table was originally `vehicles` (vrm/make/model/mileage/
-- mot_expiry/last_service_date/annual_service_required) and was renamed to
-- `hair_profiles` with columns renamed vrm->preference, make->texture,
-- model->goal, and all car-only columns dropped (migration
-- 20260511212229). The live schema really is named `hair_profiles` on a
-- car-care app — this is preserved as-is per the current live schema.
CREATE TABLE IF NOT EXISTS hair_profiles (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  texture VARCHAR(255) NOT NULL DEFAULT '',
  preference VARCHAR(255) NOT NULL DEFAULT '',
  goal VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hp_customer (customer_id),
  CONSTRAINT fk_hair_profiles_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Chairs / Service Catalog / Add-ons
-- ==================================================

CREATE TABLE IF NOT EXISTS chairs (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  zone VARCHAR(100) NOT NULL DEFAULT 'Barbershop',
  zones JSON NOT NULL DEFAULT (JSON_ARRAY('Barbershop')), -- was text[] DEFAULT ARRAY['Barbershop']; GIN index on zones has no MySQL equivalent
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_catalog (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  estimated_hours DECIMAL(5,2) DEFAULT 1,
  category VARCHAR(100) DEFAULT 'general',
  duration_minutes INT DEFAULT 45,
  is_active TINYINT(1) DEFAULT 1,
  is_seasonal TINYINT(1) DEFAULT 0,
  description TEXT,
  icon VARCHAR(100),
  target_audience VARCHAR(100) NOT NULL DEFAULT 'Unisex',
  featured_style TINYINT(1) NOT NULL DEFAULT 0,
  image_url VARCHAR(500) DEFAULT NULL,
  deposit_required TINYINT(1) NOT NULL DEFAULT 1,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  upsell_product_id CHAR(36) DEFAULT NULL,  -- no FK in original schema (added without REFERENCES clause)
  is_on_promo TINYINT(1) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10,2) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_addons (
  id CHAR(36) NOT NULL,
  service_id CHAR(36) NOT NULL,   -- no FK in original schema (added without REFERENCES clause)
  addon_id CHAR(36) NOT NULL,     -- no FK in original schema (added without REFERENCES clause)
  sort_order INT NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_addon (service_id, addon_id),
  KEY idx_service_addons_service (service_id),
  CONSTRAINT chk_service_addons_distinct CHECK (service_id <> addon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Jobs & Scheduling
-- ==================================================

-- Jobs table (predates tracked migrations; columns reconstructed from
-- dozens of ALTER TABLE statements + types.ts final-state snapshot)
CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  hair_profile_id CHAR(36) DEFAULT NULL,     -- was vehicle_id, renamed with the vehicles->hair_profiles migration
  service_catalog_id CHAR(36) DEFAULT NULL,
  chair_id CHAR(36) DEFAULT NULL,
  assigned_to CHAR(36) DEFAULT NULL,         -- app user id (mechanic); no FK (see header note)
  status ENUM('pending','confirmed','in_progress','completed','paid') NOT NULL DEFAULT 'pending',
  type ENUM('mobile','garage') NOT NULL DEFAULT 'garage',
  service_type ENUM('service','repair','diagnostics') NOT NULL DEFAULT 'service',
  urgency VARCHAR(50) NOT NULL DEFAULT 'flexible',
  progress VARCHAR(100) DEFAULT NULL,        -- app-level values: in_chair | halfway | done
  source VARCHAR(100) DEFAULT NULL,
  notes TEXT,
  pay_type VARCHAR(50) NOT NULL DEFAULT 'hourly',
  pay_amount DECIMAL(10,2) DEFAULT NULL,
  deposit_required TINYINT(1) NOT NULL DEFAULT 0,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_paid_at DATETIME DEFAULT NULL,
  stripe_checkout_session_id VARCHAR(255) DEFAULT NULL,
  stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
  allow_overlap TINYINT(1) NOT NULL DEFAULT 0,
  manage_token VARCHAR(255) DEFAULT NULL,
  scheduled_at DATETIME DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_j_customer (customer_id),
  KEY idx_j_status (status),
  KEY idx_j_assigned (assigned_to),
  KEY idx_jobs_chair_id (chair_id),
  KEY idx_jobs_service_catalog_id (service_catalog_id),
  KEY idx_jobs_manage_token (manage_token),
  KEY idx_jobs_stripe_session (stripe_checkout_session_id),
  CONSTRAINT fk_jobs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE, -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
  CONSTRAINT fk_jobs_hair_profile FOREIGN KEY (hair_profile_id) REFERENCES hair_profiles(id) ON DELETE SET NULL, -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
  CONSTRAINT fk_jobs_service_catalog FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id) ON DELETE SET NULL,
  CONSTRAINT fk_jobs_chair FOREIGN KEY (chair_id) REFERENCES chairs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_notes (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  author_id CHAR(36) DEFAULT NULL,           -- app user id; no FK (see header note)
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jn_job (job_id),
  CONSTRAINT fk_job_notes_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job photos table (predates tracked migrations; photo_type/visible_to_customer added later)
CREATE TABLE IF NOT EXISTS job_photos (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  caption VARCHAR(500) DEFAULT NULL,
  photo_type VARCHAR(50) DEFAULT 'documentation',
  visible_to_customer TINYINT(1) DEFAULT 0,
  uploaded_by CHAR(36) DEFAULT NULL,         -- app user id; no FK (see header note)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jp_job (job_id),
  CONSTRAINT fk_job_photos_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_addons (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,               -- REVIEW: no FK in original Postgres schema either (column declared without REFERENCES)
  addon_service_id CHAR(36) NOT NULL,     -- REVIEW: no FK in original Postgres schema either
  price_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_minutes_snapshot INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ja_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS time_entries (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) DEFAULT NULL,           -- made nullable in migration 20260317081041
  mechanic_id CHAR(36) NOT NULL,          -- app user id; no FK (see header note)
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME DEFAULT NULL,
  duration_seconds INT DEFAULT 0,
  notes TEXT DEFAULT NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_te_job (job_id),
  KEY idx_te_mechanic (mechanic_id),
  CONSTRAINT fk_time_entries_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS swap_requests (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  from_mechanic_id CHAR(36) NOT NULL,     -- app user id; no FK (see header note)
  to_mechanic_id CHAR(36) DEFAULT NULL,   -- app user id; no FK (see header note)
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reason TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_sr_job (job_id),
  CONSTRAINT fk_swap_requests_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waitlist (
  id CHAR(36) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting',
  estimated_wait_minutes INT DEFAULT 15,
  assigned_chair_id CHAR(36) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  customer_id CHAR(36) DEFAULT NULL,
  service_catalog_id CHAR(36) DEFAULT NULL,  -- no FK in original schema (added without REFERENCES clause)
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wl_chair (assigned_chair_id),
  KEY idx_wl_customer (customer_id),
  CONSTRAINT fk_waitlist_chair FOREIGN KEY (assigned_chair_id) REFERENCES chairs(id) ON DELETE SET NULL,
  CONSTRAINT fk_waitlist_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Invoicing & Estimates
-- ==================================================

CREATE TABLE IF NOT EXISTS estimates (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) DEFAULT NULL,
  customer_id CHAR(36) NOT NULL,
  items JSON NOT NULL DEFAULT (JSON_ARRAY()),
  labor_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  travel_cost DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_e_customer (customer_id),
  KEY idx_e_job (job_id),
  CONSTRAINT fk_estimates_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_estimates_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices table (predates tracked migrations; signature/payment_method/status
-- value 'archived' added later)
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('draft','sent','paid','archived') NOT NULL DEFAULT 'draft',
  payment_method VARCHAR(100) DEFAULT NULL,
  signature TEXT DEFAULT NULL,
  stripe_id VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_i_job (job_id),
  CONSTRAINT fk_invoices_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice items table (predates tracked migrations)
CREATE TABLE IF NOT EXISTS invoice_items (
  id CHAR(36) NOT NULL,
  invoice_id CHAR(36) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  type VARCHAR(50) NOT NULL DEFAULT 'labor',
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ii_invoice (invoice_id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
  CONSTRAINT chk_invoice_items_type CHECK (type IN ('labor','parts','misc','Labour','Parts','Misc'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Leads, Quotes & Sales Pipeline
-- ==================================================

CREATE TABLE IF NOT EXISTS leads (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  service_requested VARCHAR(255) DEFAULT '',
  source VARCHAR(100) NOT NULL DEFAULT 'Web',
  status VARCHAR(50) NOT NULL DEFAULT 'New',
  priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
  ai_score INT NOT NULL DEFAULT 0,
  assigned_to CHAR(36) DEFAULT NULL,       -- app user id; no FK (see header note)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_l_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotes (
  id CHAR(36) NOT NULL,
  lead_id CHAR(36) NOT NULL,
  estimated_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  parts_cost_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until DATE DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  location_type VARCHAR(50) NOT NULL DEFAULT 'garage',
  estimated_date DATE DEFAULT NULL,
  signature TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_q_lead (lead_id),
  CONSTRAINT fk_quotes_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_items (
  id CHAR(36) NOT NULL,
  quote_id CHAR(36) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT 'labor',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_qi_quote (quote_id),
  CONSTRAINT fk_quote_items_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_interactions (
  id CHAR(36) NOT NULL,
  lead_id CHAR(36) NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'Note',
  content TEXT NOT NULL,
  author_id CHAR(36) DEFAULT NULL,          -- app user id; no FK (see header note)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_li_lead (lead_id),
  CONSTRAINT fk_lead_interactions_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Customer Communication & Issue Reporting
-- ==================================================

-- Messages table (predates tracked migrations)
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  direction ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_m_customer (customer_id),
  CONSTRAINT fk_messages_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE -- REVIEW: ON DELETE behavior assumed (predates tracked migrations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS issue_submissions (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  hair_profile_id CHAR(36) DEFAULT NULL,    -- was vehicle_id
  description TEXT NOT NULL DEFAULT (''), -- TEXT can't take a literal default in MySQL, only an expression default
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_is_customer (customer_id),
  KEY idx_is_hair_profile (hair_profile_id),
  CONSTRAINT fk_issue_submissions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_submissions_hair_profile FOREIGN KEY (hair_profile_id) REFERENCES hair_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS issue_photos (
  id CHAR(36) NOT NULL,
  issue_id CHAR(36) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ip_issue (issue_id),
  CONSTRAINT fk_issue_photos_issue FOREIGN KEY (issue_id) REFERENCES issue_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- E-commerce (Products, Orders, Cart)
-- ==================================================

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  compare_at_price DECIMAL(10,2) DEFAULT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Hair Care',
  tags JSON DEFAULT (JSON_ARRAY()),          -- was text[] DEFAULT '{}'
  image_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_on_promo TINYINT(1) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10,2) DEFAULT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  sku VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) DEFAULT NULL,             -- app user id; no FK (see header note)
  customer_id CHAR(36) DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_name VARCHAR(255) DEFAULT NULL,
  shipping_address VARCHAR(500) DEFAULT NULL,
  shipping_phone VARCHAR(50) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_o_customer (customer_id),
  KEY idx_o_user (user_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)  -- no ON DELETE clause in source migration -> defaults to RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oi_order (order_id),
  KEY idx_oi_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) -- no ON DELETE clause in source migration -> defaults to RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id CHAR(36) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  service_catalog_id CHAR(36) DEFAULT NULL,
  quantity INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ci_session (session_id),
  CONSTRAINT fk_cart_items_service FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_sessions (
  session_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  reminder_sent_at DATETIME DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  KEY idx_cart_sessions_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'other',
  quantity INT DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  image_path VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Booking / Cart Abandonment Follow-up
-- ==================================================

CREATE TABLE IF NOT EXISTS booking_drafts (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT NULL,
  service_catalog_id CHAR(36) DEFAULT NULL,
  scheduled_at DATETIME DEFAULT NULL,
  step INT NOT NULL DEFAULT 1,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  reminder_sent_at DATETIME DEFAULT NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_token CHAR(36) NOT NULL,    -- was uuid DEFAULT gen_random_uuid(); app must generate this value
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_drafts_lastseen (last_seen_at), -- REVIEW: source was a partial index (WHERE completed = false AND reminder_sent_at IS NULL); MySQL has no partial indexes, so this is a full index on last_seen_at only
  CONSTRAINT fk_booking_drafts_service FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- HR (Staff Expenses & Leave)
-- ==================================================

CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,           -- app user id; no FK (see header note)
  description VARCHAR(500) NOT NULL DEFAULT '',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(100) NOT NULL DEFAULT 'other',
  receipt_path VARCHAR(500) DEFAULT NULL,
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ex_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  id CHAR(36) NOT NULL,
  staff_id CHAR(36) NOT NULL,              -- app user id; no FK (see header note)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Holiday',
  reason TEXT DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  decline_reason TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lr_staff (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Settings
-- ==================================================

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(255) NOT NULL,
  `value` TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================
-- Email Infrastructure
-- (Postgres used the pgmq extension for queueing; see email_queue below)
-- ==================================================

CREATE TABLE IF NOT EXISTS email_send_log (
  id CHAR(36) NOT NULL,
  message_id VARCHAR(255) DEFAULT NULL,
  template_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_send_log_created (created_at),
  KEY idx_email_send_log_recipient (recipient_email),
  KEY idx_email_send_log_message (message_id),
  CONSTRAINT chk_email_send_log_status CHECK (status IN ('pending','sent','suppressed','failed','bounced','complained','dlq'))
  -- REVIEW: Postgres also enforced a partial UNIQUE index (message_id) WHERE status = 'sent'
  -- to guarantee at most one 'sent' row per message_id. MySQL has no partial/filtered unique
  -- indexes; this invariant must be enforced in the Express email-worker application logic instead.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_send_state (
  id TINYINT NOT NULL DEFAULT 1,
  retry_after_until DATETIME DEFAULT NULL,
  batch_size INT NOT NULL DEFAULT 10,
  send_delay_ms INT NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INT NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INT NOT NULL DEFAULT 60,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_email_send_state_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO email_send_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS suppressed_emails (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(20) NOT NULL,
  metadata JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppressed_emails_email (email),
  CONSTRAINT chk_suppressed_emails_reason CHECK (reason IN ('unsubscribe','bounce','complaint'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unsubscribe_token (token),
  UNIQUE KEY uq_unsubscribe_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_dispatch_log (
  id CHAR(36) NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_dispatch_dedupe (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Replacement for Postgres pgmq-backed queues (auth_emails, transactional_emails,
-- and their _dlq variants), previously driven via the enqueue_email / read_email_batch /
-- delete_email / move_to_dlq RPC wrappers around pgmq.send / pgmq.read / pgmq.delete.
-- The Express email worker should implement equivalent semantics against this table:
--   enqueue_email    -> INSERT
--   read_email_batch -> SELECT ... WHERE status='pending' AND (visible_until IS NULL OR visible_until < NOW())
--                       ORDER BY id LIMIT batch_size FOR UPDATE, then UPDATE visible_until/attempts
--   delete_email     -> DELETE (or UPDATE status='done')
--   move_to_dlq      -> INSERT INTO email_queue (queue_name='<name>_dlq', ...) + DELETE original row
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  queue_name VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  visible_until DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_queue_status (queue_name, status, visible_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
