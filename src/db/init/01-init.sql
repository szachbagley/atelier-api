-- Docker MySQL initialization. The mysql:8.0 image already creates the
-- database and user from MYSQL_* environment variables; this script pins the
-- charset/collation and grants, and is idempotent for fresh volumes.

CREATE DATABASE IF NOT EXISTS atelier
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'atelier'@'%' IDENTIFIED BY 'localpassword';
GRANT ALL PRIVILEGES ON atelier.* TO 'atelier'@'%';
FLUSH PRIVILEGES;
