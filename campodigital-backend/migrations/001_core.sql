CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('PRODUCTOR', 'ADMIN') NOT NULL DEFAULT 'PRODUCTOR',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS actividades_productivas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(500) NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_actividades_usuario_nombre (usuario_id, nombre),
  CONSTRAINT fk_actividades_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS categorias_financieras (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('INGRESO', 'GASTO') NOT NULL,
  es_sistema BOOLEAN NOT NULL DEFAULT FALSE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  propietario_clave BIGINT UNSIGNED
    GENERATED ALWAYS AS (COALESCE(usuario_id, 0)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_categorias_propietario_nombre_tipo (propietario_clave, nombre, tipo),
  KEY idx_categorias_usuario_tipo (usuario_id, tipo),
  CONSTRAINT ck_categorias_propietario
    CHECK (
      (es_sistema = TRUE AND usuario_id IS NULL)
      OR (es_sistema = FALSE AND usuario_id IS NOT NULL)
    ),
  CONSTRAINT fk_categorias_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_financieros (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  actividad_productiva_id BIGINT UNSIGNED NULL,
  categoria_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('INGRESO', 'GASTO') NOT NULL,
  valor DECIMAL(15, 2) NOT NULL,
  fecha DATE NOT NULL,
  descripcion VARCHAR(500) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movimientos_usuario_fecha (usuario_id, fecha DESC),
  KEY idx_movimientos_usuario_tipo_fecha (usuario_id, tipo, fecha DESC),
  KEY idx_movimientos_categoria (categoria_id),
  CONSTRAINT ck_movimientos_valor_positivo CHECK (valor > 0),
  CONSTRAINT fk_movimientos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT fk_movimientos_actividad
    FOREIGN KEY (actividad_productiva_id) REFERENCES actividades_productivas (id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL,
  CONSTRAINT fk_movimientos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias_financieras (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE = InnoDB;

INSERT IGNORE INTO categorias_financieras (usuario_id, nombre, tipo, es_sistema)
VALUES
  (NULL, 'Venta de producción', 'INGRESO', TRUE),
  (NULL, 'Otros ingresos', 'INGRESO', TRUE),
  (NULL, 'Insumos', 'GASTO', TRUE),
  (NULL, 'Transporte', 'GASTO', TRUE),
  (NULL, 'Mano de obra', 'GASTO', TRUE),
  (NULL, 'Otros gastos', 'GASTO', TRUE);
