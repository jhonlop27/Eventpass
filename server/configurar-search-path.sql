-- Ejecutar en la base de EventPass con el mismo usuario que abrirá el Query Tool.
DO $config$
BEGIN
  IF pg_catalog.to_regnamespace('eventpass') IS NULL THEN
    RAISE EXCEPTION 'La base % no contiene el esquema eventpass. Comprueba la conexión o ejecuta db:init.', current_database();
  END IF;
  EXECUTE pg_catalog.format(
    'ALTER ROLE %I IN DATABASE %I SET search_path TO eventpass, pg_catalog',
    current_user, current_database()
  );
END
$config$;

-- ALTER ROLE se aplica al reconectar. SET habilita también esta sesión.
SET search_path TO eventpass, pg_catalog;
