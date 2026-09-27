const mysql = require('mysql2/promise');

// Only used for storing website enquiries (contact_messages). No bookings,
// customers or payments are stored here: those belong to WubSync.
const configured = Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);

const pool = configured
  ? mysql.createPool({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  })
  : null;

module.exports = { pool };
