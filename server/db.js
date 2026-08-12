const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

function toMySQLDateTime(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map((value) => (
    typeof value === 'string' && ISO_DATETIME_RE.test(value) ? toMySQLDateTime(value) : value
  ));
}

function wrapQueryable(target) {
  const originalQuery = target.query.bind(target);
  target.query = (sql, params) => originalQuery(sql, normalizeParams(params));
  return target;
}

wrapQueryable(pool);

const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async (...args) => wrapQueryable(await originalGetConnection(...args));

module.exports = { pool };
