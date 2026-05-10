-- =========================================================
-- Samo ponovni poziv wrapper migracije (mali upload / mysql stdin).
--
-- Pretpostavlja da su procedure već ostale u bazi nakon što si jednom
-- pokrenuo vnlh_migracija_pk_fk_unsigned.sql (mysql klijent s DELIMITER $$).
--
-- Primjeri na serveru SSH:
--   mysql -u DIGITAL_USER -p digital_vnlh < sql/vnlh_migracija_pk_fk_unsigned_samo_CALL.sql
--   mysql -u DIGITAL_USER -p digital_vnlh -e "CALL vnlh_migrate_unsigned_pk_fk();"
--
-- Pozor ako je UNSIGNED migracija već uspješno završena: ponovni CALL može baciti grešku
-- ALTER tipova. Koristi tek kad znaš što radiš ili kad je prijašnji pokušaj pukao nakon FK dropa.
-- =========================================================

SET NAMES utf8mb4;

CALL vnlh_migrate_unsigned_pk_fk();
