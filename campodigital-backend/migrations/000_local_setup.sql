-- Ejecuta este archivo una sola vez como administrador de MySQL.
-- Sustituye change_me por la misma contraseña que usarás en tu archivo .env.

CREATE DATABASE IF NOT EXISTS campodigital
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'campodigital'@'localhost'
  IDENTIFIED BY 'change_me';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON campodigital.* TO 'campodigital'@'localhost';

FLUSH PRIVILEGES;
