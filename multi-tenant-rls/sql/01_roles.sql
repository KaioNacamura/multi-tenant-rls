-- Dois papéis no banco:
--   app_owner: dono das tabelas, roda as migrations.
--   app_user:  o que a aplicação usa no dia a dia. Não é dono de nada
--              e não tem BYPASSRLS, então as políticas valem para ele.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    CREATE ROLE app_owner LOGIN PASSWORD 'owner_pass';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'user_pass' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT CREATE, USAGE ON SCHEMA public TO app_owner;
