-- =========================================================
-- Uklanjanje migracijskih rutina ostavljenih nakon deploya.
--
-- Pokreni nakon što je UNSIGNED migracija uspješno završena i ne želiš
-- držati vnlh_* procedure/funkciju na produkciji.
--
--   mysql ... digital_vnlh < sql/vnlh_migracija_pk_fk_unsigned_cleanup.sql
-- =========================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS vnlh_migrate_unsigned_pk_fk;
DROP PROCEDURE IF EXISTS vnlh_restore_skeema_fks;
DROP FUNCTION IF EXISTS vnlh_fk_exists;
DROP PROCEDURE IF EXISTS vnlh_drop_fks_touching_migration_set;
DROP PROCEDURE IF EXISTS vnlh_alter_table_if_exists;
