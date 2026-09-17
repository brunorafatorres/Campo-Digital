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
  categoria_sugerida_id BIGINT UNSIGNED NULL,
  confianza_ia DECIMAL(5, 2) NULL,
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
    ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_categoria_sugerida
    FOREIGN KEY (categoria_sugerida_id) REFERENCES categorias_financieras (id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL,
  CONSTRAINT ck_movimientos_confianza_ia
    CHECK (confianza_ia IS NULL OR confianza_ia BETWEEN 0 AND 100)
) ENGINE = InnoDB;

-- Compatibilidade com o esquema elaborado na primeira etapa do TCC.
-- CREATE TABLE IF NOT EXISTS não altera tabelas que já existiam. Por isso,
-- instalações anteriores podem possuir activo/es_global e não possuir as
-- colunas activa/es_sistema usadas pela aplicação atual.
SET @schema_name = DATABASE();

SET @has_activity_active = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'actividades_productivas'
     AND COLUMN_NAME = 'activa'
);
SET @sql = IF(
  @has_activity_active = 0,
  'ALTER TABLE actividades_productivas ADD COLUMN activa BOOLEAN NOT NULL DEFAULT TRUE AFTER descripcion',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_system_flag = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'categorias_financieras'
     AND COLUMN_NAME = 'es_sistema'
);
SET @sql = IF(
  @has_system_flag = 0,
  'ALTER TABLE categorias_financieras ADD COLUMN es_sistema BOOLEAN NOT NULL DEFAULT FALSE AFTER tipo',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_category_active = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'categorias_financieras'
     AND COLUMN_NAME = 'activa'
);
SET @sql = IF(
  @has_category_active = 0,
  'ALTER TABLE categorias_financieras ADD COLUMN activa BOOLEAN NOT NULL DEFAULT TRUE AFTER es_sistema',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_legacy_global = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'categorias_financieras'
     AND COLUMN_NAME = 'es_global'
);
SET @sql = IF(
  @has_legacy_global > 0,
  'UPDATE categorias_financieras SET es_sistema = es_global',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_legacy_active = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'categorias_financieras'
     AND COLUMN_NAME = 'activo'
);
SET @sql = IF(
  @has_legacy_active > 0,
  'UPDATE categorias_financieras SET activa = activo',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_suggested_category = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'movimientos_financieros'
     AND COLUMN_NAME = 'categoria_sugerida_id'
);
SET @sql = IF(
  @has_suggested_category = 0,
  'ALTER TABLE movimientos_financieros ADD COLUMN categoria_sugerida_id BIGINT UNSIGNED NULL AFTER fecha',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_ai_confidence = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'movimientos_financieros'
     AND COLUMN_NAME = 'confianza_ia'
);
SET @sql = IF(
  @has_ai_confidence = 0,
  'ALTER TABLE movimientos_financieros ADD COLUMN confianza_ia DECIMAL(5,2) NULL AFTER categoria_sugerida_id',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @seed_sql = IF(
  @has_legacy_global > 0,
  'INSERT IGNORE INTO categorias_financieras (usuario_id, nombre, tipo, es_sistema, es_global) VALUES
    (NULL, ''Venda de producao'', ''INGRESO'', TRUE, TRUE),
    (NULL, ''Outras receitas'', ''INGRESO'', TRUE, TRUE),
    (NULL, ''Sementes e mudas'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Racao e alimentacao animal'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Combustivel'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Fertilizantes e insumos'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Manutencao de equipamentos'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Transporte'', ''GASTO'', TRUE, TRUE),
    (NULL, ''Outros gastos'', ''GASTO'', TRUE, TRUE)',
  'INSERT IGNORE INTO categorias_financieras (usuario_id, nombre, tipo, es_sistema) VALUES
    (NULL, ''Venta de producción'', ''INGRESO'', TRUE),
    (NULL, ''Otros ingresos'', ''INGRESO'', TRUE),
    (NULL, ''Insumos'', ''GASTO'', TRUE),
    (NULL, ''Transporte'', ''GASTO'', TRUE),
    (NULL, ''Mano de obra'', ''GASTO'', TRUE),
    (NULL, ''Otros gastos'', ''GASTO'', TRUE)'
);
PREPARE migration_statement FROM @seed_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
