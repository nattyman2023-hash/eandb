// Mounted at /api/functions - one route per Supabase Edge Function these
// replace (see src/lib/apiClient.ts's functions.invoke, which POSTs JSON here
// and expects back { data, error } with error either null or { message }).
//
// These are privileged server-side orchestration routes analogous to the
// original Edge Functions running as service_role: they intentionally bypass
// the generic per-user authz layer in server/src/routes/query.js (e.g. guest
// booking creates a customer row with elevated trust). Every value is still
// parameterized with `?` - never string-interpolated - even though the authz
// layer itself is bypassed by design.
//
// Stripe/deposits are explicitly out of scope for this migration - there is
// no Stripe SDK usage anywhere in this file, and create-booking hardcodes
// deposit_required = false / deposit_amount = 0.

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const { pool } = require('../db');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { generateOpaqueToken, hashToken } = require('../lib/tokens');
const { sendTransactionalEmail } = require('../lib/transactionalEmail');

const router = express.Router();

// ---------------------------------------------------------------------------
// chat-assistant
// ---------------------------------------------------------------------------

// Copied verbatim from supabase/functions/chat-assistant/index.ts - specific
// to E and B (Selam Unisex Salon), must not be genericized.
const CHAT_SYSTEM_PROMPT = `You are Selam, a warm and concise virtual receptionist for E and B (Selam Unisex Salon) at 174 Claremont Road, Manchester M14 4TT.

You help with: services (barbering, hairdressing, braiding, treatments), pricing ranges, booking guidance, opening hours (Mon–Sat ~9am–7pm), location/parking, and product/aftercare advice.

Rules:
- Be brief: 1-3 short sentences. No long lists.
- Always offer to either book online (link: /book) or chat on WhatsApp for anything specific.
- Never invent precise prices for braiding (varies). Quote rough ranges only and recommend booking a free consult.
- If the user wants to book, encourage them to use the booking page.
- Never ask for sensitive info (card, password). Don't promise refunds — defer to staff.
- Use a friendly, modern Manchester salon tone. No emojis except occasionally a ✂️ or ✨.`;

router.post('/chat-assistant', optionalAuth, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ data: null, error: { message: 'AI not configured' } });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sanitized = messages
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-12); // cap context, matching the original

    if (sanitized.length === 0) {
      return res.status(400).json({ data: null, error: { message: 'No messages' } });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: CHAT_SYSTEM_PROMPT,
        messages: sanitized.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (response.status === 429) {
      return res.status(429).json({ data: null, error: { message: 'Busy right now — try again in a moment.' } });
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[chat-assistant] anthropic api error', response.status, text);
      return res.status(500).json({ data: null, error: { message: 'Chat unavailable' } });
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text ?? "Sorry, I didn't catch that.";

    return res.json({ data: { reply }, error: null });
  } catch (err) {
    console.error('[chat-assistant] error:', err);
    return res.status(500).json({ data: null, error: { message: 'Server error' } });
  }
});

// ---------------------------------------------------------------------------
// create-booking
// ---------------------------------------------------------------------------

router.post('/create-booking', optionalAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const { customer: customerInput, hair_profile, vehicle, job: jobInput, issue, fulfillment, addons } = body;

    if (!customerInput || typeof customerInput !== 'object' || !customerInput.name) {
      return res.status(400).json({ data: null, error: { message: 'customer.name is required' } });
    }
    if (!jobInput || typeof jobInput !== 'object') {
      return res.status(400).json({ data: null, error: { message: 'job is required' } });
    }

    const hairProfileInput = hair_profile || vehicle || {};
    const userId = req.user ? req.user.id : null;

    // 1. Customer - upsert-by-user_id when logged in, else a plain insert.
    let customerId;
    if (userId) {
      const [existingRows] = await pool.query('SELECT id FROM customers WHERE user_id = ?', [userId]);
      if (existingRows.length > 0) {
        customerId = existingRows[0].id;
        await pool.query(
          'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, postcode = ? WHERE id = ?',
          [
            customerInput.name,
            customerInput.phone || null,
            customerInput.email || null,
            customerInput.address || null,
            customerInput.postcode || null,
            customerId,
          ]
        );
      } else {
        customerId = crypto.randomUUID();
        await pool.query(
          'INSERT INTO customers (id, user_id, name, email, phone, address, postcode) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            customerId,
            userId,
            customerInput.name,
            customerInput.email || null,
            customerInput.phone || null,
            customerInput.address || null,
            customerInput.postcode || null,
          ]
        );
      }
    } else {
      customerId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO customers (id, name, email, phone, address, postcode) VALUES (?, ?, ?, ?, ?, ?)',
        [
          customerId,
          customerInput.name,
          customerInput.email || null,
          customerInput.phone || null,
          customerInput.address || null,
          customerInput.postcode || null,
        ]
      );
    }

    // 2. Hair profile - only if any field is actually provided.
    let hairProfileId = null;
    const hasHairData = hairProfileInput.preference || hairProfileInput.texture || hairProfileInput.goal;
    if (hasHairData) {
      hairProfileId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO hair_profiles (id, customer_id, preference, texture, goal) VALUES (?, ?, ?, ?, ?)',
        [hairProfileId, customerId, hairProfileInput.preference || '', hairProfileInput.texture || '', hairProfileInput.goal || '']
      );
    }

    // 3. Job - deposits are out of scope for this migration: always 0/false.
    const jobType = fulfillment && fulfillment.method === 'garage' ? 'garage' : 'mobile';
    const jobId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO jobs
         (id, customer_id, hair_profile_id, type, service_type, service_catalog_id, scheduled_at, notes, urgency, source, deposit_required, deposit_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        jobId,
        customerId,
        hairProfileId,
        jobType,
        jobInput.service_type || 'service',
        jobInput.service_catalog_id || null,
        jobInput.scheduled_at || null,
        jobInput.notes || null,
        jobInput.urgency || 'flexible',
        jobInput.source || null,
      ]
    );

    // 3b. Add-ons - server-revalidated against service_addons + service_catalog.
    // Client-submitted price/duration is never trusted; this mirrors the
    // original Edge Function's security property exactly.
    if (Array.isArray(addons) && addons.length > 0 && jobInput.service_catalog_id) {
      const requestedIds = Array.from(
        new Set(addons.map((a) => a && a.addon_service_id).filter((id) => typeof id === 'string' && id.length > 0))
      );

      if (requestedIds.length > 0) {
        const [linkRows] = await pool.query(
          `SELECT addon_id, discount_pct FROM service_addons WHERE service_id = ? AND addon_id IN (${requestedIds.map(() => '?').join(', ')})`,
          [jobInput.service_catalog_id, ...requestedIds]
        );
        const allowedMap = new Map();
        for (const r of linkRows) {
          const raw = Number(r.discount_pct ?? 0);
          const safeDiscount = Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 0;
          allowedMap.set(r.addon_id, safeDiscount);
        }

        const validIds = requestedIds.filter((id) => allowedMap.has(id));
        if (validIds.length > 0) {
          const [catRows] = await pool.query(
            `SELECT id, base_price, sale_price, is_on_promo, duration_minutes FROM service_catalog WHERE id IN (${validIds.map(() => '?').join(', ')})`,
            validIds
          );
          for (const s of catRows) {
            const list = s.is_on_promo && s.sale_price != null ? Number(s.sale_price) : Number(s.base_price || 0);
            const discount = allowedMap.get(s.id) || 0;
            const finalPrice = Number((list * (1 - discount / 100)).toFixed(2));
            await pool.query(
              'INSERT INTO job_addons (id, job_id, addon_service_id, price_snapshot, duration_minutes_snapshot) VALUES (?, ?, ?, ?, ?)',
              [crypto.randomUUID(), jobId, s.id, finalPrice, Number(s.duration_minutes || 0)]
            );
          }
        }
      }
    }

    // 4. Issue submission (optional).
    if (issue && issue.description) {
      const issueId = crypto.randomUUID();
      await pool.query('INSERT INTO issue_submissions (id, customer_id, hair_profile_id, description) VALUES (?, ?, ?, ?)', [
        issueId,
        customerId,
        hairProfileId,
        issue.description,
      ]);
      if (Array.isArray(issue.photo_paths) && issue.photo_paths.length > 0) {
        for (const path of issue.photo_paths) {
          await pool.query('INSERT INTO issue_photos (id, issue_id, storage_path) VALUES (?, ?, ?)', [
            crypto.randomUUID(),
            issueId,
            path,
          ]);
        }
      }
    }

    // 5. Booking confirmation email - always attempted now (no deposit gating,
    // since deposit_required can never be true anymore).
    if (customerInput.email) {
      try {
        await sendTransactionalEmail({
          templateName: 'booking-confirmation',
          recipientEmail: customerInput.email,
          idempotencyKey: `booking-confirm-${jobId}`,
          templateData: {
            name: customerInput.name,
            scheduledAt: jobInput.scheduled_at
              ? new Date(jobInput.scheduled_at).toLocaleString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/London',
                })
              : undefined,
            manageUrl: `${process.env.FRONTEND_URL || 'https://eandbhair.co.uk'}/portal/appointments`,
          },
        });
      } catch (e) {
        console.error('[create-booking] failed to send booking confirmation:', e.message);
      }
    }

    return res.json({ data: { customer_id: customerId, hair_profile_id: hairProfileId, job_id: jobId }, error: null });
  } catch (err) {
    console.error('[create-booking] error:', err);
    return res.status(400).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// accept-quote
// ---------------------------------------------------------------------------

router.post('/accept-quote', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { quote_id } = req.body || {};
    if (!quote_id) return res.status(400).json({ data: null, error: { message: 'quote_id is required' } });

    const [quoteRows] = await pool.query(
      `SELECT q.id, q.lead_id, q.status, q.location_type,
              l.name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
              l.service_requested AS lead_service_requested, l.source AS lead_source
       FROM quotes q
       JOIN leads l ON l.id = q.lead_id
       WHERE q.id = ?`,
      [quote_id]
    );
    const quote = quoteRows[0];
    if (!quote) return res.status(404).json({ data: null, error: { message: 'Quote not found' } });
    if (quote.status === 'Accepted') {
      return res.status(400).json({ data: null, error: { message: 'Quote already accepted' } });
    }

    // Create customer from the lead's details.
    const customerId = crypto.randomUUID();
    await pool.query('INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)', [
      customerId,
      quote.lead_name,
      quote.lead_phone || '',
      quote.lead_email || '',
    ]);

    // Create job (no hair profile auto-created from a quote, matching the original).
    await pool.query('INSERT INTO jobs (id, customer_id, hair_profile_id, notes, source, type) VALUES (?, ?, NULL, ?, ?, ?)', [
      crypto.randomUUID(),
      customerId,
      quote.lead_service_requested || '',
      `Quote Accepted - ${quote.lead_source}`,
      quote.location_type === 'mobile' ? 'mobile' : 'garage',
    ]);

    await pool.query('UPDATE quotes SET status = ? WHERE id = ?', ['Accepted', quote_id]);
    await pool.query('UPDATE leads SET status = ? WHERE id = ?', ['Converted', quote.lead_id]);

    return res.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('[accept-quote] error:', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// invite-employee / send-portal-invite shared helpers
// ---------------------------------------------------------------------------

// Ensures an app_users row exists for `email`, creating one with a random,
// never-used password hash if not (the invitee sets a real password via the
// emailed reset link, never via this hash).
async function ensureAppUser(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const [rows] = await pool.query('SELECT id FROM app_users WHERE email = ?', [normalizedEmail]);
  if (rows.length > 0) return { userId: rows[0].id, isNew: false };

  const userId = crypto.randomUUID();
  const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await pool.query('INSERT INTO app_users (id, email, password_hash) VALUES (?, ?, ?)', [userId, normalizedEmail, randomPasswordHash]);
  return { userId, isNew: true };
}

// Mirrors POST /api/auth/reset-password-request's token issuance exactly.
async function issuePasswordResetToken(userId) {
  const opaqueToken = generateOpaqueToken();
  await pool.query('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)', [
    crypto.randomUUID(),
    userId,
    hashToken(opaqueToken),
    new Date(Date.now() + 60 * 60 * 1000),
  ]);
  return opaqueToken;
}

function buildInviteUrl(opaqueToken) {
  return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${opaqueToken}`;
}

// ---------------------------------------------------------------------------
// invite-employee
// ---------------------------------------------------------------------------

router.post('/invite-employee', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { email, full_name, phone, pay_rate, role } = req.body || {};
    if (!email) return res.status(400).json({ data: null, error: { message: 'Email is required' } });
    const normalizedEmail = String(email).trim().toLowerCase();

    const { userId } = await ensureAppUser(normalizedEmail);

    // Ensure a profile row exists (upsert).
    const [existingProfileRows] = await pool.query('SELECT id FROM profiles WHERE user_id = ?', [userId]);
    if (existingProfileRows.length > 0) {
      await pool.query('UPDATE profiles SET phone = ?, pay_rate = ? WHERE user_id = ?', [phone || '', pay_rate || 0, userId]);
      if (full_name) {
        await pool.query('UPDATE profiles SET full_name = ? WHERE user_id = ?', [full_name, userId]);
      }
    } else {
      await pool.query('INSERT INTO profiles (id, user_id, full_name, email, phone, pay_rate) VALUES (?, ?, ?, ?, ?, ?)', [
        crypto.randomUUID(),
        userId,
        full_name || '',
        normalizedEmail,
        phone || '',
        pay_rate || 0,
      ]);
    }

    // Staff invitees default to 'mechanic'; admin if explicitly specified.
    const targetRole = role || 'mechanic';
    const [existingRoleRows] = await pool.query('SELECT id FROM user_roles WHERE user_id = ? AND role = ?', [userId, targetRole]);
    if (existingRoleRows.length === 0) {
      await pool.query('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [crypto.randomUUID(), userId, targetRole]);
    }

    const opaqueToken = await issuePasswordResetToken(userId);
    const inviteUrl = buildInviteUrl(opaqueToken);

    let inviteSent = false;
    try {
      const sendResult = await sendTransactionalEmail({
        templateName: 'portal-invite',
        recipientEmail: normalizedEmail,
        idempotencyKey: `staff-invite-${userId}`,
        templateData: { name: full_name || '', portalKind: 'staff', inviteUrl },
      });
      inviteSent = !!(sendResult && sendResult.data && sendResult.data.success);
    } catch (e) {
      console.error('[invite-employee] email send failed:', e.message);
    }

    return res.json({ data: { user_id: userId, email: normalizedEmail, invite_sent: inviteSent }, error: null });
  } catch (err) {
    console.error('[invite-employee] error:', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// send-portal-invite
// ---------------------------------------------------------------------------

router.post('/send-portal-invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { email, name, portalKind } = req.body || {};
    if (!email) return res.status(400).json({ data: null, error: { message: 'email required' } });
    const normalizedEmail = String(email).trim().toLowerCase();
    const kind = portalKind === 'staff' ? 'staff' : 'client';

    const { userId, isNew } = await ensureAppUser(normalizedEmail);
    // Matches the original: only assign the 'customer' role when a brand-new
    // user is being created for a client-portal invite. Existing users keep
    // whatever roles they already have.
    if (isNew && kind === 'client') {
      await pool.query('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [crypto.randomUUID(), userId, 'customer']);
    }

    const opaqueToken = await issuePasswordResetToken(userId);
    const inviteUrl = buildInviteUrl(opaqueToken);

    try {
      await sendTransactionalEmail({
        templateName: 'portal-invite',
        recipientEmail: normalizedEmail,
        idempotencyKey: `portal-invite-${kind}-${userId}-${Date.now()}`,
        templateData: { name, portalKind: kind, inviteUrl },
      });
    } catch (e) {
      console.error('[send-portal-invite] email send failed:', e.message);
    }

    return res.json({ data: { ok: true }, error: null });
  } catch (err) {
    console.error('[send-portal-invite] error:', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// send-transactional-email
// ---------------------------------------------------------------------------

// Admin-only: this triggers a real email send through the site's Resend
// account to an arbitrary recipient. The only legitimate frontend callers
// (Customers.tsx, Jobs.tsx) are already admin-only pages; create-booking and
// invite-employee/send-portal-invite call sendTransactionalEmail() directly
// in-process rather than through this HTTP route, so they're unaffected by
// this guard. Leaving this open (as the original Supabase function effectively
// was, via any valid JWT) would make it a spam relay for arbitrary addresses.
router.post('/send-transactional-email', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    const templateName = body.templateName || body.template_name;
    const recipientEmail = body.recipientEmail || body.recipient_email;
    const idempotencyKey = body.idempotencyKey || body.idempotency_key;
    const templateData = body.templateData && typeof body.templateData === 'object' ? body.templateData : {};

    if (!templateName) {
      return res.status(400).json({ data: null, error: { message: 'templateName is required' } });
    }

    const result = await sendTransactionalEmail({ templateName, recipientEmail, idempotencyKey, templateData });
    return res.status(result.status || 200).json({ data: result.data, error: result.error });
  } catch (err) {
    console.error('[send-transactional-email] error:', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// handle-email-unsubscribe
// ---------------------------------------------------------------------------

router.post('/handle-email-unsubscribe', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ data: null, error: { message: 'Token is required' } });

    const [rows] = await pool.query('SELECT token, email, used_at FROM email_unsubscribe_tokens WHERE token = ?', [token]);
    const record = rows[0];
    if (!record) return res.status(404).json({ data: null, error: { message: 'Invalid or expired token' } });
    if (record.used_at) {
      return res.json({ data: { success: false, reason: 'already_unsubscribed' }, error: null });
    }

    // Atomic check-and-update to avoid a TOCTOU double-unsubscribe.
    const [updateResult] = await pool.query('UPDATE email_unsubscribe_tokens SET used_at = NOW() WHERE token = ? AND used_at IS NULL', [
      token,
    ]);
    if (updateResult.affectedRows === 0) {
      return res.json({ data: { success: false, reason: 'already_unsubscribed' }, error: null });
    }

    const normalizedEmail = String(record.email).toLowerCase();
    await pool.query('INSERT INTO suppressed_emails (id, email, reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)', [
      crypto.randomUUID(),
      normalizedEmail,
      'unsubscribe',
    ]);

    return res.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('[handle-email-unsubscribe] error:', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// Stripe stubs - Stripe is explicitly out of scope for this migration. These
// exist only so src/pages/Settings.tsx's existing "not configured" UI renders
// without erroring; no Stripe SDK, no API calls, no deposit path.
// ---------------------------------------------------------------------------

router.post('/stripe-keys-status', requireAuth, requireRole('admin'), async (req, res) => {
  return res.json({
    data: { secretConfigured: false, publishableConfigured: false, secretMode: null },
    error: null,
  });
});

router.post('/stripe-test-connection', requireAuth, requireRole('admin'), async (req, res) => {
  return res.json({ data: { ok: false, error: 'Stripe is not set up for this site' }, error: null });
});

module.exports = router;
