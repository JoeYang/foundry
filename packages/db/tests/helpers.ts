import pg from 'pg';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '..', 'migrations');

const MIGRATE_URL =
  process.env.DB_URL_MIGRATE ?? 'postgres://foundry:foundry@localhost:5433/foundry';

/**
 * The drizzle migrator hard-codes "drizzle".__drizzle_migrations and uses
 * schema-qualified DDL for its own bookkeeping table — it does NOT respect
 * search_path for that table.  However, the application DDL (CREATE TABLE,
 * CREATE INDEX, CREATE TRIGGER …) is unqualified, so it lands in whatever
 * schema is first in search_path.
 *
 * Extensions and ENUM types are database-global, not schema-scoped.  They
 * already exist from the initial migration applied to the main DB, so we
 * must tolerate "already exists" errors for those statements.
 */

/** Statements that create database-global objects — safe to ignore if they already exist. */
const IDEMPOTENT_PREFIXES = [
  'CREATE EXTENSION',
  'CREATE TYPE',
  'GRANT USAGE ON TYPE',
];

function isIdempotentError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Postgres error codes: 42710 = duplicate_object, 42P06 = duplicate_schema
  const code = (err as NodeJS.ErrnoException & { code?: string }).code;
  return code === '42710' || code === '42P06';
}

function shouldIgnoreAlreadyExists(stmt: string): boolean {
  const trimmed = stmt.trim().toUpperCase();
  return IDEMPOTENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Split a SQL file into individual statements.  We must handle dollar-quoted
 * strings ($$…$$) correctly — a bare `;` inside a dollar-quoted body must NOT
 * be treated as a statement terminator.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    // Detect start of a dollar-quoted string: $tag$ where tag can be empty.
    if (sql[i] === '$') {
      const tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1); // e.g. "$$" or "$body$"
        const closeTag = sql.indexOf(tag, tagEnd + 1);
        if (closeTag !== -1) {
          // Consume the entire dollar-quoted block verbatim.
          current += sql.slice(i, closeTag + tag.length);
          i = closeTag + tag.length;
          continue;
        }
      }
    }

    // Line comment — consume to end of line.
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const eol = sql.indexOf('\n', i);
      if (eol === -1) {
        current += sql.slice(i);
        i = sql.length;
      } else {
        current += sql.slice(i, eol + 1);
        i = eol + 1;
      }
      continue;
    }

    // Statement terminator.
    if (sql[i] === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const remaining = current.trim();
  if (remaining) statements.push(remaining);

  return statements;
}

/** Read all SQL migration files in journal order and return individual statements. */
function loadMigrationStatements(): string[] {
  const journalPath = resolve(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
    entries: Array<{ tag: string }>;
  };

  const statements: string[] = [];
  for (const entry of journal.entries) {
    const sql = readFileSync(resolve(migrationsFolder, `${entry.tag}.sql`), 'utf-8');
    for (const stmt of splitStatements(sql)) {
      statements.push(stmt);
    }
  }
  return statements;
}

export interface TestSchemaContext {
  schemaName: string;
  pool: pg.Pool;
  close: () => Promise<void>;
}

/**
 * Create a fresh Postgres schema, run all migrations against it, and return
 * a pool whose search_path points at that schema.  Caller must invoke
 * `close()` in afterAll to drop the schema and release the pool.
 */
export async function createTestSchema(): Promise<TestSchemaContext> {
  const schemaName = `test_${randomBytes(6).toString('hex')}`;

  // Create the schema and grant access with the admin role.
  const adminPool = new pg.Pool({ connectionString: MIGRATE_URL });
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  await adminPool.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO foundry_app`);
  await adminPool.query(`GRANT CREATE ON SCHEMA "${schemaName}" TO foundry_app`);
  await adminPool.end();

  // Open the application pool scoped to the test schema.
  const pool = new pg.Pool({ connectionString: MIGRATE_URL });
  pool.on('connect', (client) => {
    // Unqualified DDL and DML will resolve to the test schema.
    client.query(`SET search_path TO "${schemaName}", public`);
  });

  // Run migrations statement-by-statement so we can tolerate already-existing
  // global objects (extensions, ENUM types) which are database-scoped.
  const statements = loadMigrationStatements();
  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        if (isIdempotentError(err) && shouldIgnoreAlreadyExists(stmt)) {
          // Global object already exists — fine, continue.
          continue;
        }
        throw err;
      }
    }
  } finally {
    client.release();
  }

  return {
    schemaName,
    pool,
    close: async () => {
      await pool.end();
      const cleanup = new pg.Pool({ connectionString: MIGRATE_URL });
      await cleanup.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await cleanup.end();
    },
  };
}
