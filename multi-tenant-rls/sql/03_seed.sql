-- Roda como app_owner. O dono da tabela não é barrado pela política
-- (não usamos FORCE ROW LEVEL SECURITY), por isso o seed funciona.
TRUNCATE leads, organizations RESTART IDENTITY;

INSERT INTO organizations (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Clínica Alfa'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Academia Beta');

INSERT INTO leads (organization_id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'joao@alfa.test'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'maria@alfa.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'pedro@beta.test');
