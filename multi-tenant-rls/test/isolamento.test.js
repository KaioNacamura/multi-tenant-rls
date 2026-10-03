import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Conecta como app_user, o papel que a aplicação usaria.
const adminUrl = process.env.ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/rls_demo";
const userUrl = adminUrl.replace(/\/\/[^@]+@/, "//app_user:user_pass@");
const ownerUrl = adminUrl.replace(/\/\/[^@]+@/, "//app_owner:owner_pass@");

const ALFA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETA = "bbbbbbbb-0000-0000-0000-000000000002";

const pool = new pg.Pool({ connectionString: userUrl, max: 2 });

// Cada operação roda numa transação com SET LOCAL: a organização
// vale só até o COMMIT e não vaza para a próxima requisição que usar
// a mesma conexão do pool.
async function comoOrganizacao(orgId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (orgId) {
      await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    }
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  // Volta os dados ao estado inicial antes de testar.
  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(await readFile(new URL("../sql/03_seed.sql", import.meta.url), "utf8"));
  await owner.end();

  const { rows } = await pool.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user");
  // Se o papel pudesse ignorar o RLS, os testes abaixo não provariam nada.
  expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
});

afterAll(async () => {
  await pool.end();
});

describe("leitura", () => {
  it("Alfa vê só os leads da Alfa", async () => {
    const emails = await comoOrganizacao(ALFA, async (c) =>
      (await c.query("SELECT email FROM leads ORDER BY email")).rows.map((r) => r.email),
    );
    expect(emails).toEqual(["joao@alfa.test", "maria@alfa.test"]);
  });

  it("Beta vê só os leads da Beta", async () => {
    const emails = await comoOrganizacao(BETA, async (c) =>
      (await c.query("SELECT email FROM leads")).rows.map((r) => r.email),
    );
    expect(emails).toEqual(["pedro@beta.test"]);
  });

  it("filtrar pelo id da outra empresa não adianta", async () => {
    const linhas = await comoOrganizacao(ALFA, async (c) =>
      (await c.query("SELECT * FROM leads WHERE organization_id = $1", [BETA])).rows,
    );
    expect(linhas).toHaveLength(0);
  });

  it("sem organização definida não aparece nada", async () => {
    const linhas = await comoOrganizacao(null, async (c) => (await c.query("SELECT * FROM leads")).rows);
    expect(linhas).toHaveLength(0);
  });

  it("a organização não fica presa na conexão depois do COMMIT", async () => {
    await comoOrganizacao(ALFA, async (c) => c.query("SELECT 1"));
    const linhas = await comoOrganizacao(null, async (c) => (await c.query("SELECT * FROM leads")).rows);
    expect(linhas).toHaveLength(0);
  });
});

describe("escrita", () => {
  it("Alfa não consegue gravar lead em nome da Beta", async () => {
    await expect(
      comoOrganizacao(ALFA, (c) =>
        c.query("INSERT INTO leads (organization_id, email) VALUES ($1, 'intruso@x.test')", [BETA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Alfa não consegue apagar nem alterar lead da Beta", async () => {
    const apagados = await comoOrganizacao(ALFA, async (c) =>
      (await c.query("DELETE FROM leads WHERE organization_id = $1", [BETA])).rowCount,
    );
    const alterados = await comoOrganizacao(ALFA, async (c) =>
      (await c.query("UPDATE leads SET email = 'x@x.test' WHERE organization_id = $1", [BETA])).rowCount,
    );
    expect(apagados).toBe(0);
    expect(alterados).toBe(0);
  });

  it("Alfa não consegue mover um lead seu para a Beta", async () => {
    await expect(
      comoOrganizacao(ALFA, (c) =>
        c.query("UPDATE leads SET organization_id = $1 WHERE email = 'joao@alfa.test'", [BETA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Alfa grava normalmente na própria organização", async () => {
    const total = await comoOrganizacao(ALFA, async (c) => {
      await c.query("INSERT INTO leads (organization_id, email) VALUES ($1, 'novo@alfa.test')", [ALFA]);
      const { rows } = await c.query("SELECT count(*)::int AS n FROM leads");
      await c.query("DELETE FROM leads WHERE email = 'novo@alfa.test'");
      return rows[0].n;
    });
    expect(total).toBe(3);
  });
});
