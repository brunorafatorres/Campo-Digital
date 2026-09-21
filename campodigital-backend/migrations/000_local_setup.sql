-- Execute este arquivo uma única vez como administrador do MySQL.
-- Substitua change_me pela mesma senha que será usada no arquivo .env.

CREATE DATABASE IF NOT EXISTS campodigital
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'campodigital'@'localhost'
  IDENTIFIED BY 'change_me';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON campodigital.* TO 'campodigital'@'localhost';

FLUSH PRIVILEGES;
