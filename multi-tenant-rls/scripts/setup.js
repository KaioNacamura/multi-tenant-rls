// Cria os papéis, as tabelas e os dados de exemplo.
// ADMIN_URL precisa ser um usuário que pode criar papéis (o postgres, por exemplo).
import { readFile } from "node:fs/promises";
import pg from "pg";

const adminUrl = process.env.ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/rls_demo";
const ownerUrl = adminUrl.replace(/\/\/[^@]+@/, "//app_owner:owner_pass@");

async function run(url, file) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(await readFile(new URL(`../sql/${file}`, import.meta.url), "utf8"));
    console.log(`ok  ${file}`);
  } finally {
    await client.end();
  }
}

await run(adminUrl, "01_roles.sql");
await run(ownerUrl, "02_schema.sql");
await run(ownerUrl, "03_seed.sql");
