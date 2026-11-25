BEGIN;
-- El espacio de nombres permite instalar EventPass junto a una base anterior.
CREATE SCHEMA IF NOT EXISTS eventpass;
SET LOCAL search_path TO eventpass, pg_catalog;

CREATE TABLE IF NOT EXISTS usuarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identificacion varchar(40) NOT NULL UNIQUE CHECK (btrim(identificacion) <> ''),
  nombre varchar(150) NOT NULL CHECK (btrim(nombre) <> ''),
  usuario varchar(80) NOT NULL UNIQUE CHECK (usuario = lower(btrim(usuario)) AND usuario <> ''),
  password_hash text NOT NULL CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'),
  rol text NOT NULL CHECK (rol IN ('ADMINISTRADOR','ORGANIZADOR','CLIENTE')),
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  version_sesion integer NOT NULL DEFAULT 1,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eventos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(48) NOT NULL UNIQUE CHECK (btrim(codigo) <> ''),
  organizador_id integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nombre varchar(150) NOT NULL CHECK (btrim(nombre) <> ''),
  descripcion varchar(3000) NOT NULL CHECK (btrim(descripcion) <> ''),
  categoria varchar(80) NOT NULL CHECK (btrim(categoria) <> ''),
  ubicacion varchar(200) NOT NULL CHECK (btrim(ubicacion) <> ''),
  fecha date NOT NULL, hora time(0) NOT NULL,
  capacidad_total integer NOT NULL CHECK (capacidad_total > 0),
  estado text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','ACTIVO','CERRADO')),
  creado_en timestamptz NOT NULL DEFAULT now(), actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipos_entrada (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento_id integer NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT,
  nombre varchar(100) NOT NULL CHECK (btrim(nombre) <> ''),
  precio numeric(12,2) NOT NULL CHECK (precio BETWEEN 0 AND 9999999999.99),
  capacidad_asignada integer NOT NULL CHECK (capacidad_asignada >= 0),
  cantidad_disponible integer NOT NULL CHECK (cantidad_disponible BETWEEN 0 AND capacidad_asignada),
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, evento_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tipos_nombre_evento ON tipos_entrada(evento_id, lower(nombre));

CREATE TABLE IF NOT EXISTS compras (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text NOT NULL UNIQUE DEFAULT ('CP-' || upper(gen_random_uuid()::text)),
  cliente_id integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  usuario_responsable_id integer REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo_entrada_id integer NOT NULL REFERENCES tipos_entrada(id) ON DELETE RESTRICT,
  solicitud_id uuid NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  cantidad_entradas integer NOT NULL CHECK (cantidad_entradas > 0),
  valor_total numeric(22,2) NOT NULL CHECK (valor_total >= 0 AND valor_total <> 'NaN'::numeric),
  estado text NOT NULL DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA','CANCELADA')),
  UNIQUE (cliente_id, solicitud_id), UNIQUE (id, tipo_entrada_id)
);

CREATE TABLE IF NOT EXISTS entradas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text NOT NULL UNIQUE DEFAULT ('EP-' || upper(gen_random_uuid()::text)),
  compra_id integer NOT NULL, evento_id integer NOT NULL, tipo_entrada_id integer NOT NULL,
  precio_pagado numeric(12,2) NOT NULL CHECK (precio_pagado BETWEEN 0 AND 9999999999.99),
  fecha_generacion timestamptz NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'EMITIDA' CHECK (estado IN ('EMITIDA','UTILIZADA','CANCELADA','REEMPLAZADA')),
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE RESTRICT,
  FOREIGN KEY (compra_id, tipo_entrada_id) REFERENCES compras(id, tipo_entrada_id) ON DELETE RESTRICT,
  FOREIGN KEY (tipo_entrada_id, evento_id) REFERENCES tipos_entrada(id, evento_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS eventos_agenda ON eventos(estado,fecha,hora);
CREATE INDEX IF NOT EXISTS eventos_organizador ON eventos(organizador_id);
CREATE INDEX IF NOT EXISTS compras_cliente ON compras(cliente_id,fecha DESC);
CREATE INDEX IF NOT EXISTS compras_tipo ON compras(tipo_entrada_id);
CREATE INDEX IF NOT EXISTS entradas_por_compra ON entradas(compra_id,estado);
CREATE INDEX IF NOT EXISTS entradas_por_evento ON entradas(evento_id,estado);
CREATE INDEX IF NOT EXISTS entradas_por_tipo ON entradas(tipo_entrada_id,estado);

CREATE OR REPLACE FUNCTION actualizar_marca() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
BEGIN
  NEW.actualizado_en := clock_timestamp();
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER usuarios_marca BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION actualizar_marca();
CREATE OR REPLACE TRIGGER eventos_marca BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION actualizar_marca();

-- Todos los cambios de cupo de un evento se serializan sobre la misma fila.
CREATE OR REPLACE FUNCTION comprobar_asignacion() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
DECLARE total integer; otras bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.evento_id <> OLD.evento_id THEN
    RAISE check_violation USING MESSAGE='El evento de un tipo es inmutable.';
  END IF;
  SELECT capacidad_total INTO total FROM eventos WHERE id=NEW.evento_id FOR UPDATE;
  SELECT COALESCE(sum(capacidad_asignada),0) INTO otras FROM tipos_entrada
    WHERE evento_id=NEW.evento_id AND id <> NEW.id;
  IF otras + NEW.capacidad_asignada > total THEN
    RAISE check_violation USING CONSTRAINT='aforo_asignacion', MESSAGE='Las asignaciones exceden el aforo.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.cantidad_disponible := NEW.capacidad_asignada;
  ELSE
    NEW.cantidad_disponible := OLD.cantidad_disponible + (NEW.capacidad_asignada - OLD.capacidad_asignada);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tipo_cupo BEFORE INSERT OR UPDATE OF capacidad_asignada, evento_id ON tipos_entrada
  FOR EACH ROW EXECUTE FUNCTION comprobar_asignacion();

CREATE OR REPLACE FUNCTION comprobar_aforo() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
BEGIN
  IF NEW.capacidad_total < (SELECT COALESCE(sum(capacidad_asignada),0) FROM tipos_entrada WHERE evento_id=NEW.id) THEN
    RAISE check_violation USING CONSTRAINT='aforo_asignacion', MESSAGE='El aforo no cubre las asignaciones.';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER evento_cupo BEFORE UPDATE OF capacidad_total ON eventos
  FOR EACH ROW EXECUTE FUNCTION comprobar_aforo();

-- Un único recuento por localidad y sentencia, incluso en compras de varias unidades.
-- La reserva de tipo se mantiene hasta el fin de la transacción.
CREATE OR REPLACE FUNCTION recalcular_existencias() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
BEGIN
  PERFORM id FROM tipos_entrada WHERE id IN (SELECT tipo_entrada_id FROM lote) ORDER BY id FOR UPDATE;
  WITH vendidos AS (
    SELECT afectados.tipo_entrada_id, count(i.id)::integer AS cantidad
    FROM (SELECT DISTINCT tipo_entrada_id FROM lote) afectados
    LEFT JOIN entradas i ON i.tipo_entrada_id=afectados.tipo_entrada_id AND i.estado IN ('EMITIDA','UTILIZADA')
    GROUP BY afectados.tipo_entrada_id
  )
  UPDATE tipos_entrada t SET cantidad_disponible=t.capacidad_asignada-v.cantidad
    FROM vendidos v WHERE t.id=v.tipo_entrada_id AND t.cantidad_disponible<>t.capacidad_asignada-v.cantidad;
  RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER entrada_emision AFTER INSERT ON entradas REFERENCING NEW TABLE AS lote
  FOR EACH STATEMENT EXECUTE FUNCTION recalcular_existencias();
CREATE OR REPLACE TRIGGER entrada_transicion AFTER UPDATE ON entradas REFERENCING NEW TABLE AS lote
  FOR EACH STATEMENT EXECUTE FUNCTION recalcular_existencias();
CREATE OR REPLACE TRIGGER entrada_baja AFTER DELETE ON entradas REFERENCING OLD TABLE AS lote
  FOR EACH STATEMENT EXECUTE FUNCTION recalcular_existencias();

CREATE OR REPLACE FUNCTION comprobar_disponible() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
DECLARE ocupadas integer;
BEGIN
  SELECT count(*)::integer INTO ocupadas FROM entradas
  WHERE tipo_entrada_id=NEW.id AND estado IN ('EMITIDA','UTILIZADA');
  IF NEW.cantidad_disponible <> NEW.capacidad_asignada-ocupadas THEN
    RAISE check_violation USING MESSAGE='La disponibilidad se deriva de los cupos asignados y las entradas vigentes.';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tipo_inventario BEFORE UPDATE OF cantidad_disponible ON tipos_entrada
  FOR EACH ROW EXECUTE FUNCTION comprobar_disponible();

CREATE OR REPLACE FUNCTION mantener_referencias_entrada() RETURNS trigger LANGUAGE plpgsql SET search_path TO eventpass, pg_catalog AS $$
BEGIN
  IF (NEW.compra_id,NEW.evento_id,NEW.tipo_entrada_id,NEW.codigo,NEW.precio_pagado) IS DISTINCT FROM
     (OLD.compra_id,OLD.evento_id,OLD.tipo_entrada_id,OLD.codigo,OLD.precio_pagado) THEN
    RAISE check_violation USING MESSAGE='La identidad y el precio de una entrada emitida son inmutables.';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER entrada_identidad BEFORE UPDATE OF compra_id,evento_id,tipo_entrada_id,codigo,precio_pagado ON entradas
  FOR EACH ROW EXECUTE FUNCTION mantener_referencias_entrada();
COMMIT;
