require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.join(rootDir, 'database-schema-mysql.sql');
const migrationsDir = path.join(__dirname, 'migrations');
const destructiveSql = /\b(?:DROP\s+(?:DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM)\b/i;

async function loadMigrations() {
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return [
    { id: '0001_initial_schema', file: baselinePath },
    ...migrationFiles.map((name) => ({ id: name.replace(/\.sql$/, ''), file: path.join(migrationsDir, name) })),
  ];
}

async function main() {
  const migrations = await loadMigrations();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    const [appliedRows] = await connection.query('SELECT id FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) {
        console.log(`[db:migrate] already applied: ${migration.id}`);
        continue;
      }
      const sql = await fs.readFile(migration.file, 'utf8');
      if (destructiveSql.test(sql)) throw new Error(`Refusing destructive SQL in migration ${migration.id}`);
      console.log(`[db:migrate] applying: ${migration.id}`);
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    console.log('[db:migrate] complete');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[db:migrate] failed: ${error.message}`);
  process.exitCode = 1;
});
