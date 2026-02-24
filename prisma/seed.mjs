import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO "Branch" ("id", "name", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING', ['branch_santiago', 'Santiago']);
    await client.query('INSERT INTO "Branch" ("id", "name", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING', ['branch_temuco', 'Temuco']);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
