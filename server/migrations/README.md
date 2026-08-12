# MySQL migrations

`npm run db:migrate` is the only command that applies database migrations. It is never called by `server/index.js`.

The existing additive baseline is `database-schema-mysql.sql` at the repository root and is recorded as migration `0001_initial_schema`. New migration files in this directory must be applied in filename order and must be additive. The migration runner rejects `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, and `DELETE FROM` statements.

Do not run `npm run db:migrate` against the live Hostinger database until the schema and data migration plan has been approved and a backup/rollback plan exists.
