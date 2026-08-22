// Plain-HTML template registry used by transactionalEmail.js. Replaces the
// React-Email components from supabase/functions/_shared/transactional-email-templates
// with simple inline-styled HTML strings - no rendering library needed.
//
// Only the 4 templates actually referenced from src/**/*.tsx call sites are
// implemented here (booking-confirmation, portal-invite, admin-message,
// booking-rescheduled). The ~9 scheduler-only templates (booking-reminder-24h,
// cart-abandoned, order-confirmation, etc.) belong to the email-scheduler cron
// function, which is out of scope for this migration.

function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function unsubscribeFooter(unsubscribeToken) {
  if (!unsubscribeToken) return '';
  return `<p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">Don't want these emails? <a href="${frontendUrl()}/unsubscribe?token=${unsubscribeToken}" style="color:#888;">Unsubscribe</a></p>`;
}

function wrap(innerHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.5;">${innerHtml}</div>`;
}

function button(url, label) {
  if (!url) return '';
  return `<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${label}</a></p>`;
}

const TEMPLATES = {
  'booking-confirmation': {
    subject: 'Your E and B booking is confirmed',
    render: ({ name, scheduledAt, manageUrl } = {}) =>
      wrap(`
        <h1 style="font-size:20px;">Booking confirmed${name ? `, ${name}` : ''}!</h1>
        <p>Thanks for booking with E and B.</p>
        ${scheduledAt ? `<p>Your appointment is scheduled for <strong>${scheduledAt}</strong>.</p>` : ''}
        ${button(manageUrl, 'Manage your appointment')}
        <p>See you soon!</p>
      `),
  },

  'portal-invite': {
    subject: 'You’re invited to the E and B portal',
    render: ({ name, portalKind, inviteUrl } = {}) =>
      wrap(`
        <h1 style="font-size:20px;">Welcome${name ? `, ${name}` : ''}!</h1>
        <p>You've been invited to the E and B ${portalKind === 'staff' ? 'staff' : 'client'} portal.</p>
        ${button(inviteUrl, 'Set your password')}
        <p>This link will expire in 1 hour. If you didn't expect this invite, you can ignore this email.</p>
      `),
  },

  'admin-message': {
    subject: (data = {}) => data.subject || 'A message from E and B',
    render: ({ name, subject, body, unsubscribeToken } = {}) =>
      wrap(`
        <h1 style="font-size:20px;">${subject || 'A message for you'}</h1>
        <p>Hi ${name || 'there'},</p>
        <p style="white-space:pre-wrap;">${body || ''}</p>
        ${unsubscribeFooter(unsubscribeToken)}
      `),
  },

  'booking-rescheduled': {
    subject: 'Your E and B appointment has been rescheduled',
    render: ({ name, serviceName, scheduledAt, reason, manageUrl, unsubscribeToken } = {}) =>
      wrap(`
        <h1 style="font-size:20px;">Appointment rescheduled</h1>
        <p>Hi ${name || 'there'},</p>
        <p>Your ${serviceName ? `<strong>${serviceName}</strong> ` : ''}appointment has been rescheduled to <strong>${scheduledAt || 'a new time'}</strong>.</p>
        ${reason ? `<p>Note from the salon: ${reason}</p>` : ''}
        ${button(manageUrl, 'View your appointments')}
        ${unsubscribeFooter(unsubscribeToken)}
      `),
  },
};

module.exports = { TEMPLATES };
