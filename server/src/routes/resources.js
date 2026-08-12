const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const { pool } = require('../../db');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Request failed';
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  const text = value.trim();
  if (text.length > maxLength) {
    const error = new Error(`${field} is too long`);
    error.status = 400;
    throw error;
  }
  return text;
}

router.get('/services', async (req, res) => {
  try {
    const [services] = await pool.query(
      'SELECT * FROM service_catalog WHERE is_active = 1 ORDER BY category, name'
    );
    const [addons] = await pool.query(
      `SELECT sa.*, sc.name AS service_name, a.name AS addon_name
       FROM service_addons sa
       LEFT JOIN service_catalog sc ON sc.id = sa.service_id
       LEFT JOIN service_catalog a ON a.id = sa.addon_id
       ORDER BY sa.sort_order, a.name`
    );
    return res.json({ data: { services, addons }, error: null });
  } catch (error) {
    console.error('[/api/services]', error);
    return res.status(500).json({ data: null, error: { message: 'Unable to load services' } });
  }
});

router.post('/contact', optionalAuth, async (req, res) => {
  let connection;
  try {
    const body = req.body || {};
    const name = requireText(body.name, 'Name', 100);
    const email = requireText(body.email, 'Email', 255);
    const phone = requireText(body.phone, 'Phone number', 50);
    const message = requireText(body.message, 'Message', 2000);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      const error = new Error('Invalid email address');
      error.status = 400;
      throw error;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query(
      'SELECT id FROM customers WHERE email = ? OR phone = ? ORDER BY created_at DESC LIMIT 1',
      [email, phone]
    );
    const customerId = existing[0]?.id || crypto.randomUUID();
    if (existing[0]) {
      await connection.query(
        'UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?',
        [name, email, phone, customerId]
      );
    } else {
      await connection.query(
        'INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)',
        [customerId, name, email, phone]
      );
    }
    await connection.query(
      'INSERT INTO messages (id, customer_id, direction, content) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), customerId, 'inbound', `[Website Contact Form] ${message}`]
    );
    await connection.commit();
    return res.status(201).json({ data: { customer_id: customerId }, error: null });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    const status = error.status || 500;
    if (status === 500) console.error('[/api/contact]', error);
    return res.status(status).json({ data: null, error: { message: status === 500 ? 'Unable to send message' : errorMessage(error) } });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/admin/users/password', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const userId = requireText(req.body?.userId, 'userId', 100);
    const newPassword = requireText(req.body?.newPassword, 'newPassword', 200);
    if (newPassword.length < 6) {
      const error = new Error('Password must be at least 6 characters');
      error.status = 400;
      throw error;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const [result] = await pool.query('UPDATE app_users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    if (!result.affectedRows) return res.status(404).json({ data: null, error: { message: 'User not found' } });
    await pool.query('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
    return res.json({ data: { success: true }, error: null });
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('[/api/admin/users/password]', error);
    return res.status(status).json({ data: null, error: { message: status === 500 ? 'Unable to update password' : errorMessage(error) } });
  }
});

router.get('/email/unsubscribe', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const [rows] = await pool.query(
      'SELECT used_at FROM email_unsubscribe_tokens WHERE token = ?',
      [token]
    );
    if (!rows[0]) return res.json({ valid: false, reason: 'invalid_token' });
    if (rows[0].used_at) return res.json({ valid: false, reason: 'already_unsubscribed' });
    return res.json({ valid: true });
  } catch (error) {
    console.error('[/api/email/unsubscribe GET]', error);
    return res.status(500).json({ valid: false, reason: 'server_error' });
  }
});

router.post('/email/unsubscribe', async (req, res) => {
  try {
    const token = req.body?.token;
    const [rows] = await pool.query(
      'SELECT email, used_at FROM email_unsubscribe_tokens WHERE token = ?',
      [token]
    );
    const record = rows[0];
    if (!record) return res.status(404).json({ data: null, error: { message: 'Invalid or expired token' } });
    if (record.used_at) return res.json({ data: { success: false, reason: 'already_unsubscribed' }, error: null });
    const [updated] = await pool.query(
      'UPDATE email_unsubscribe_tokens SET used_at = NOW() WHERE token = ? AND used_at IS NULL',
      [token]
    );
    if (!updated.affectedRows) return res.json({ data: { success: false, reason: 'already_unsubscribed' }, error: null });
    await pool.query(
      'INSERT INTO suppressed_emails (id, email, reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
      [crypto.randomUUID(), String(record.email).toLowerCase(), 'unsubscribe']
    );
    return res.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('[/api/email/unsubscribe POST]', error);
    return res.status(500).json({ data: null, error: { message: 'Unable to process unsubscribe request' } });
  }
});

module.exports = router;
