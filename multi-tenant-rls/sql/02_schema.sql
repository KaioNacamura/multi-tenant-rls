-- Roda como app_owner.
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS organizations;

CREATE TABLE organizations (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE leads (
  id              bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  email           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_org_idx ON leads (organization_id);

-- A organização da requisição vem de uma variável de sessão.
-- current_setting(..., true) devolve NULL quando ela não foi definida,
-- e aí nenhuma linha passa no filtro.
CREATE FUNCTION current_org() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- USING filtra o que dá para ler, alterar e apagar.
-- WITH CHECK impede gravar linha de outra organização.
CREATE POLICY leads_por_organizacao ON leads
  USING (organization_id = current_org())
  WITH CHECK (organization_id = current_org());

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizacao_propria ON organizations
  USING (id = current_org());

GRANT SELECT ON organizations TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO app_user;
GRANT USAGE ON SEQUENCE leads_id_seq TO app_user;
