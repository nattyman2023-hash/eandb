const express = require('express');
const Stripe = require('stripe');

const { pool } = require('../db');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { sendTransactionalEmail } = require('../lib/transactionalEmail');

const router = express.Router();

function stripeClient() {
  return process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
}

router.get('/status', requireAuth, requireRole('admin'), (req, res) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY;
  return res.json({
    data: {
      secretConfigured: Boolean(secret),
      publishableConfigured: Boolean(publishable),
      secretMode: secret ? (secret.startsWith('sk_test_') ? 'test' : 'live') : null,
    },
    error: null,
  });
});

router.post('/test', requireAuth, requireRole('admin'), async (req, res) => {
  const stripe = stripeClient();
  if (!stripe) return res.json({ data: { ok: false, error: 'STRIPE_SECRET_KEY not set' }, error: null });
  try {
    const account = await stripe.accounts.retrieve();
    return res.json({
      data: {
        ok: true,
        accountName: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email || account.id,
        livemode: !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_'),
      },
      error: null,
    });
  } catch (error) {
    return res.json({ data: { ok: false, error: error.message || 'Stripe rejected key' }, error: null });
  }
});

router.post('/checkout', optionalAuth, async (req, res) => {
  const stripe = stripeClient();
  if (!stripe) return res.status(503).json({ data: null, error: { message: 'Stripe is not configured' } });
  const { job_id: jobId, amount, service_name: serviceName } = req.body || {};
  const numericAmount = Number(amount);
  if (!jobId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ data: null, error: { message: 'job_id and a positive amount are required' } });
  }

  try {
    const [rows] = await pool.query(
      `SELECT j.id, c.email, c.name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       WHERE j.id = ?`,
      [jobId]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ data: null, error: { message: 'Job not found' } });

    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:8080';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${origin}/booking?deposit=success&job=${encodeURIComponent(jobId)}`,
      cancel_url: `${origin}/booking?deposit=cancelled&job=${encodeURIComponent(jobId)}`,
      customer_email: job.email || undefined,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: `Deposit — ${serviceName || 'Appointment'}` },
          unit_amount: Math.round(numericAmount * 100),
        },
        quantity: 1,
      }],
      metadata: { job_id: jobId },
      payment_intent_data: { metadata: { job_id: jobId } },
    });
    await pool.query('UPDATE jobs SET stripe_checkout_session_id = ? WHERE id = ?', [session.id, jobId]);
    return res.json({ data: { url: session.url, session_id: session.id }, error: null });
  } catch (error) {
    console.error('[/api/payments/checkout]', error);
    return res.status(400).json({ data: null, error: { message: error.message || 'Stripe checkout failed' } });
  }
});

router.post('/stripe/webhook', async (req, res) => {
  const stripe = stripeClient();
  if (!stripe) return res.status(503).send('Stripe is not configured');
  let event;
  try {
    const signature = req.get('stripe-signature');
    if (!process.env.STRIPE_WEBHOOK_SECRET || !signature) return res.status(400).send('Webhook signature is required');
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type !== 'checkout.session.completed') return res.send('ignored');
  const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
  if (session.payment_status !== 'paid') return res.send('not paid');
  const jobId = session.metadata?.job_id;
  if (!jobId) return res.send('no job id');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE jobs
       SET deposit_paid_amount = ?, deposit_paid_at = NOW(), stripe_payment_intent_id = ?, status = 'confirmed'
       WHERE id = ?`,
      [(session.amount_total || 0) / 100, session.payment_intent || null, jobId]
    );
    const [rows] = await connection.query(
      `SELECT j.scheduled_at, c.email, c.name
       FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.id = ?`,
      [jobId]
    );
    await connection.commit();
    const customer = rows[0];
    if (customer?.email) {
      await sendTransactionalEmail({
        templateName: 'booking-confirmation',
        recipientEmail: customer.email,
        idempotencyKey: `booking-confirm-${jobId}`,
        templateData: { name: customer.name, scheduledAt: customer.scheduled_at, manageUrl: `${process.env.FRONTEND_URL || ''}/portal/bookings` },
      }).catch((error) => console.error('[stripe webhook] email failed:', error.message));
    }
    return res.send('ok');
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('[/api/payments/stripe/webhook]', error);
    return res.status(500).send('Webhook processing failed');
  } finally {
    connection.release();
  }
});

module.exports = router;
