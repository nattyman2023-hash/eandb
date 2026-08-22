const { Resend } = require('resend');

let client = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// Low-level send used by both auth flows (Phase 2) and the transactional
// email queue worker (Phase 6). Never throws on provider failure - callers
// decide how to handle a failed send (the queue worker retries; auth flows
// log and continue so a broken email provider never blocks login/signup).
async function sendEmail({ to, subject, html }) {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set - skipping email to ${to}: ${subject}`);
    return { success: false, error: 'Email provider not configured' };
  }
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'E and B <notifications@eandb.co.uk>',
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Reset your E and B password',
    html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

module.exports = { sendEmail, sendPasswordResetEmail };
