-- =========================================================
-- Migracija signed → UNSIGNED za PK/FK stupce (MariaDB/MySQL InnoDB).
--
-- Izvori istine za tipove ključeva: db-schema/vnlh/*.sql (Skeema).
-- Jedna logika za lokalnu i produkcijsku bazu: koristi DATABASE().
--
-- Zašto postupak:
-- 1. InnoDB zahtijeva potpuno usklađene tipove (uklj. UNSIGNED) uz FK.
-- 2. Na lokalu MCP je pokazao 0 InnoDB FK-ova u information_schema dok
--    Skeema i produkcija mogu FK imati — zato skidamo sve FK koji diraju ovaj skup
--    tablica ako postoje, radimo MODIFY, pa vraćamo FK-e iz Skeeme.
-- 3. Tablice na produkciji koje lokacija još nema: ALTER se ne izvrši (preskoči ako
--    tablica nedostaje). Detaljni popis nedostataka: pokrenite
--    sql/vnlh_unsigned_pregled_ocekivane_tablice.sql na istoj bazi.
--
-- AUTOMACIJA AGENTA: Baza-Test-Razlika.sh ovdje nije mogao SSH na produkciju;
-- skup tablica za „očekivano” usklađen je s popisom u pregledu gore.
--
-- PRIJE IZVRŠENJA (ručno):
-- - Backup (npr. Baza-Bekap_na_lokalno_racunalo.sh na produkciji).
-- - Provjera negativnih vrijednosti na stupcima koje migrirate (MIN < 0).
--
-- NAKON USPJEHA: skeema pull s tog servera ili ručno uskladiti db-schema/vnlh.
--
-- ------------------------------------------------------------
-- Kako pokrenuti skriptu (češća greška #1064 na '$$'):
-- "`$$`" i naredba "DELIMITER $$" obrađuju se u mysql/mariadb *klijentu*, ne na serveru.
-- Ako GUI pošalje tekst na server bez promjene delimitera, pojavit će se SQL Error (1064)
-- kod "`$$`". Rješenje jedno od sljedećih:
--
-- • Windows: dvoklik ili cmd na sql/vnlh_migracija_pk_fk_unsigned_pokretanje.bat
--   (prilagodi put do mysql.exe i ime baze unutar .bat ako treba — tipično XAMPP `vnlh`).
--
-- • Command line (isto kao .bat ručno):
--     "\"C:\\xampp\\mysql\\bin\\mysql.exe\" -u root -p vnlh < sql\\vnlh_migracija_pk_fk_unsigned.sql"
--     (prilagodi put, korisnika i ime baze; zamisli \\ ili navodnike ako put ima razmake.)
--
-- • HeidiSQL: u editoru postavi delimiter upita na $$ PRIJE izvršenja i izvrši CIJELI
--   dokument kao jedan upit — ne kopirati iz HTML/chata („snipped” briše delimiter i UNION).
--   Ako Heidi automatski promijeni "END $$" u "END ;", skripta je nevažeća.
--
-- • phpMyAdmin često ne podržava DELIMITER kako treba — koristi mysql.exe ili .bat.
--
-- Wrapper procedura vnlh_migrate_unsigned_pk_fk():
--   Cijeli tijek (drop FK, MODIFY, restore FK) je u jednoj proceduri. Nakon što
--   ovu datoteku jednom učitaš klijentom koji poštuje DELIMITER (mysql preko SSH),
--   procedure ostaju u bazi — ponovni pokušaj bez slanja cijelog SQL-a:
--     mysql -u ... -p digital_vnlh < sql/vnlh_migracija_pk_fk_unsigned_samo_CALL.sql
--   ili: mysql ... -e "CALL vnlh_migrate_unsigned_pk_fk();"
--   Nakon uspjeha opcionalno ukloni objekte: vnlh_migracija_pk_fk_unsigned_cleanup.sql
-- ------------------------------------------------------------
-- =========================================================

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS vnlh_alter_table_if_exists $$
-- Izvršava ALTER samo ako BASE TABLE postoji u trenutnoj bazi (produkcija može
-- imati užu shemu od razvoja).
CREATE PROCEDURE vnlh_alter_table_if_exists(IN p_table VARCHAR(64), IN p_body TEXT)
BEGIN
  DECLARE n INT DEFAULT 0;
  SELECT COUNT(*) INTO n
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table
    AND TABLE_TYPE = 'BASE TABLE';
  IF n > 0 THEN
    SET @vnlh_alter_q = CONCAT('ALTER TABLE `', p_table, '` ', p_body);
    PREPARE vnlh_alter_stmt FROM @vnlh_alter_q;
    EXECUTE vnlh_alter_stmt;
    DEALLOCATE PREPARE vnlh_alter_stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS vnlh_drop_fks_touching_migration_set $$
-- Briše sve InnoDB vanjske ključeve gdje je child ILI parent u skupu tablica iz
-- db-schema/vnlh (36 imena). Sigurno je višekratno pokretanje lokalno bez FK-ova
-- (prazan kursor).
CREATE PROCEDURE vnlh_drop_fks_touching_migration_set()
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_cons VARCHAR(64);
  DECLARE v_tbl VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT rc.CONSTRAINT_NAME, rc.TABLE_NAME
    FROM information_schema.REFERENTIAL_CONSTRAINTS rc
    WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
      AND EXISTS (
        SELECT 1
        FROM (
          SELECT 'adrese' AS n
          UNION ALL SELECT 'adrese_tip'
          UNION ALL SELECT 'clanovi'
          UNION ALL SELECT 'clanovi_porijeklo'
          UNION ALL SELECT 'clanovi_zastavice'
          UNION ALL SELECT 'drzave'
          UNION ALL SELECT 'drzave_adresa'
          UNION ALL SELECT 'duznosnici'
          UNION ALL SELECT 'duznosnici_ogranicenja'
          UNION ALL SELECT 'duznosnici_prava'
          UNION ALL SELECT 'duznosnici_tip'
          UNION ALL SELECT 'email_tip'
          UNION ALL SELECT 'e_maili'
          UNION ALL SELECT 'jezici'
          UNION ALL SELECT 'loze'
          UNION ALL SELECT 'loze_tip'
          UNION ALL SELECT 'loze_tip_stupanj_enum'
          UNION ALL SELECT 'meni'
          UNION ALL SELECT 'meni_tip'
          UNION ALL SELECT 'napredovanja'
          UNION ALL SELECT 'napredovanja_tip'
          UNION ALL SELECT 'obredi'
          UNION ALL SELECT 'radovi_drzave_gostiju'
          UNION ALL SELECT 'radovi_prisustvo_tip'
          UNION ALL SELECT 'radovi_tip'
          UNION ALL SELECT 'regije'
          UNION ALL SELECT 'stupnjevi'
          UNION ALL SELECT 'sustav_korisnici'
          UNION ALL SELECT 'sustav_korisnici_login'
          UNION ALL SELECT 'sustav_odgovori_razvoja_boje'
          UNION ALL SELECT 'sustav_odgovori_razvoja_poruke'
          UNION ALL SELECT 'sustav_sesije_aktivne'
          UNION ALL SELECT 'sustav_sesije_poruke'
          UNION ALL SELECT 'sustav_varijable'
          UNION ALL SELECT 'telefoni'
          UNION ALL SELECT 'telefoni_tip'
        ) tabs
        WHERE tabs.n = rc.TABLE_NAME OR tabs.n = rc.REFERENCED_TABLE_NAME
      );
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  OPEN cur;
  drop_loop: LOOP
    FETCH cur INTO v_cons, v_tbl;
    IF v_done = 1 THEN
      LEAVE drop_loop;
    END IF;
    BEGIN
      DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
      SET @vnlh_drop_sql = CONCAT('ALTER TABLE `', v_tbl, '` DROP FOREIGN KEY `', v_cons, '`');
      PREPARE vnlh_drop_stmt FROM @vnlh_drop_sql;
      EXECUTE vnlh_drop_stmt;
      DEALLOCATE PREPARE vnlh_drop_stmt;
    END;
  END LOOP;
  CLOSE cur;
END $$

DROP FUNCTION IF EXISTS vnlh_fk_exists $$
-- Vraća 1 ako istoimeni InnoDB FK već postoji u trenutnoj bazi, inače 0.
CREATE FUNCTION vnlh_fk_exists(p_name VARCHAR(64)) RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE n INT DEFAULT 0;
  SELECT COUNT(*) INTO n
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = p_name
    AND CONSTRAINT_TYPE = 'FOREIGN KEY';
  RETURN n;
END $$

DROP PROCEDURE IF EXISTS vnlh_restore_skeema_fks $$
-- Vraća FK-e točno po db-schema/vnlh; svaki ADD samo ako obje tablice postoje i
-- istoimeni constraint još ne postoji (npr. lokalna baza bez FK-ova dobije ih).
CREATE PROCEDURE vnlh_restore_skeema_fks()
BEGIN
  DECLARE n_regije INT;
  DECLARE n_drzave INT;
  DECLARE n_loze INT;
  DECLARE n_cnt INT;

  -- regije → drzave
  SELECT COUNT(*) INTO n_regije FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE';
  SELECT COUNT(*) INTO n_drzave FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE';
  IF n_regije > 0 AND n_drzave > 0 THEN
    IF vnlh_fk_exists('regije_ibfk_1') = 0 THEN
      SET @vnlh_sql = 'ALTER TABLE `regije` ADD CONSTRAINT `regije_ibfk_1` FOREIGN KEY (`id_drzava`) REFERENCES `drzave` (`id`)';
      PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
  END IF;

  -- loze → drzave, drzave_adresa, obredi, regije
  SELECT COUNT(*) INTO n_loze FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE';
  SELECT COUNT(*) INTO n_regije FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE';
  SELECT COUNT(*) INTO n_drzave FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE';
  IF n_loze > 0 AND n_drzave > 0 THEN
    IF vnlh_fk_exists('fk_loze_id_drzava') = 0 THEN
      SET @vnlh_sql = 'ALTER TABLE `loze` ADD CONSTRAINT `fk_loze_id_drzava` FOREIGN KEY (`id_drzava`) REFERENCES `drzave` (`id`) ON UPDATE CASCADE';
      PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
  END IF;
  IF n_loze > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_loze_id_drzava_adrese') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `loze` ADD CONSTRAINT `fk_loze_id_drzava_adrese` FOREIGN KEY (`id_drzava_adrese`) REFERENCES `drzave_adresa` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_loze_id_obred') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `loze` ADD CONSTRAINT `fk_loze_id_obred` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;
  IF n_loze > 0 AND n_regije > 0 THEN
    IF vnlh_fk_exists('loze_ibfk_1') = 0 THEN
      SET @vnlh_sql = 'ALTER TABLE `loze` ADD CONSTRAINT `loze_ibfk_1` FOREIGN KEY (`id_regija`) REFERENCES `regije` (`id`)';
      PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
  END IF;

  -- napredovanja
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_napredovanja_clanovi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `napredovanja` ADD CONSTRAINT `fk_napredovanja_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_napredovanja_loze') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `napredovanja` ADD CONSTRAINT `fk_napredovanja_loze` FOREIGN KEY (`id_loza_napredovanja`) REFERENCES `loze` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_napredovanja_stupnjevi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `napredovanja` ADD CONSTRAINT `fk_napredovanja_stupnjevi` FOREIGN KEY (`id_stupanj`) REFERENCES `stupnjevi` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_napredovanja_tip') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `napredovanja` ADD CONSTRAINT `fk_napredovanja_tip` FOREIGN KEY (`id_tip_napredovanja`) REFERENCES `napredovanja_tip` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- stupnjevi → obredi
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_stupnjevi_obredi_id_obred') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `stupnjevi` ADD CONSTRAINT `fk_stupnjevi_obredi_id_obred` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- loze_tip → obredi
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_loze_tip_obredi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `loze_tip` ADD CONSTRAINT `fk_loze_tip_obredi` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- meni → meni_tip
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_meni_meni_tip') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `meni` ADD CONSTRAINT `fk_meni_meni_tip` FOREIGN KEY (`meni_tip_id`) REFERENCES `meni_tip` (`id`)';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- duznosnici_prava
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_duznosnici_prava_duznosnici') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `duznosnici_prava` ADD CONSTRAINT `fk_duznosnici_prava_duznosnici` FOREIGN KEY (`duznost`) REFERENCES `duznosnici` (`id`)';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_duznosnici_prava_meni') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `duznosnici_prava` ADD CONSTRAINT `fk_duznosnici_prava_meni` FOREIGN KEY (`pravo`) REFERENCES `meni` (`id`)';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- e_maili
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_emaili_clanovi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `e_maili` ADD CONSTRAINT `fk_emaili_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_emaili_email_tip') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `e_maili` ADD CONSTRAINT `fk_emaili_email_tip` FOREIGN KEY (`id_email_tip`) REFERENCES `email_tip` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- telefoni
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_telefoni_clanovi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `telefoni` ADD CONSTRAINT `fk_telefoni_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_telefoni_telefoni_tip') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `telefoni` ADD CONSTRAINT `fk_telefoni_telefoni_tip` FOREIGN KEY (`id_telefoni_tip`) REFERENCES `telefoni_tip` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- adrese
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_adrese_adrese_tip') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `adrese` ADD CONSTRAINT `fk_adrese_adrese_tip` FOREIGN KEY (`id_adrese_tip`) REFERENCES `adrese_tip` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_adrese_clanovi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `adrese` ADD CONSTRAINT `fk_adrese_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_adrese_drzave_adresa') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `adrese` ADD CONSTRAINT `fk_adrese_drzave_adresa` FOREIGN KEY (`id_drzave_adrese`) REFERENCES `drzave_adresa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- clanovi (FK prema drugim tablicama; na_prijedlog je self-FK)
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_adrese') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_adrese` FOREIGN KEY (`adresa`) REFERENCES `adrese` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_drzave') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_drzave` FOREIGN KEY (`drzava`) REFERENCES `drzave` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_emaili') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_emaili` FOREIGN KEY (`e_mail`) REFERENCES `e_maili` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_loze') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_loze` FOREIGN KEY (`loza`) REFERENCES `loze` (`id`) ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    IF vnlh_fk_exists('fk_clanovi_na_prijedlog') = 0 THEN
      SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_na_prijedlog` FOREIGN KEY (`na_prijedlog`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
      PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_porijeklo') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_porijeklo` FOREIGN KEY (`porijeklo`) REFERENCES `clanovi_porijeklo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_stupnjevi') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_stupnjevi` FOREIGN KEY (`stupanj`) REFERENCES `stupnjevi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_clanovi_telefoni') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `clanovi` ADD CONSTRAINT `fk_clanovi_telefoni` FOREIGN KEY (`telefon`) REFERENCES `telefoni` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- sustav_odgovori_razvoja_poruke → boje
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_sor_poruke_boja') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `sustav_odgovori_razvoja_poruke` ADD CONSTRAINT `fk_sor_poruke_boja` FOREIGN KEY (`boja`) REFERENCES `sustav_odgovori_razvoja_boje` (`id`) ON DELETE SET NULL ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;

  -- sustav_sesije_aktivne → login
  SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE';
  IF n_cnt > 0 THEN
    SELECT COUNT(*) INTO n_cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE';
    IF n_cnt > 0 THEN
      IF vnlh_fk_exists('fk_ssa_korisnik') = 0 THEN
        SET @vnlh_sql = 'ALTER TABLE `sustav_sesije_aktivne` ADD CONSTRAINT `fk_ssa_korisnik` FOREIGN KEY (`id_korisnik`) REFERENCES `sustav_korisnici_login` (`id_korisnik`) ON DELETE CASCADE ON UPDATE CASCADE';
        PREPARE s FROM @vnlh_sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;
END $$

-- ========== Jedna ulazna točka za cijelu migraciju (bez phpMyAdmina) ==========
DROP PROCEDURE IF EXISTS vnlh_migrate_unsigned_pk_fk $$
CREATE PROCEDURE vnlh_migrate_unsigned_pk_fk()
BEGIN
  -- Isti tijek kao u prijašnjem slijedu CALL-ova nakon instalacije helpera.

  CALL vnlh_drop_fks_touching_migration_set();

-- --------- MODIFY: PK, FK iz Skeeme, te logički ID-jevi koji moraju pratiti PK --
-- Izvan koraka: meni.roditelj/redoslijed, loze.id_tip_loze, stupnjevi.stupanj,
-- loze_tip_stupanj_enum, duznosnici_ogranicenja polimorfni stupci — vidi plan u repou.

CALL vnlh_alter_table_if_exists(
  'adrese',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_clanovi` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_adrese_tip` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_drzave_adrese` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('adrese_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'clanovi',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `loza` int(11) unsigned NOT NULL, MODIFY COLUMN `drzava` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `porijeklo` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `stupanj` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `telefon` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `e_mail` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `adresa` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `na_prijedlog` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('clanovi_porijeklo', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('drzave', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('drzave_adresa', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'duznosnici',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_nadredjeni` int(11) unsigned NOT NULL DEFAULT 0'
);
CALL vnlh_alter_table_if_exists('duznosnici_ogranicenja', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'duznosnici_prava',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `duznost` int(11) unsigned NOT NULL, MODIFY COLUMN `pravo` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists('duznosnici_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('email_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'e_maili',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_clanovi` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_email_tip` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('jezici', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'loze',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_regija` int(11) unsigned NOT NULL, MODIFY COLUMN `id_obred` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_drzava` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_drzava_adrese` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists(
  'loze_tip',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_obred` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists(
  'meni',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `meni_tip_id` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('meni_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'napredovanja',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_clanovi` int(11) unsigned NOT NULL, MODIFY COLUMN `id_stupanj` int(11) unsigned NOT NULL, MODIFY COLUMN `id_tip_napredovanja` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_loza_napredovanja` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('napredovanja_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('obredi', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('radovi_drzave_gostiju', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('radovi_prisustvo_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists('radovi_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'regije',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_drzava` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists(
  'stupnjevi',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_obred` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists(
  'sustav_korisnici',
  'MODIFY COLUMN `id_korisnik` int(11) unsigned NOT NULL, MODIFY COLUMN `id_duznosnik` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists('sustav_korisnici_login', 'MODIFY COLUMN `id_korisnik` int(11) unsigned NOT NULL');
CALL vnlh_alter_table_if_exists('sustav_odgovori_razvoja_boje', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');
CALL vnlh_alter_table_if_exists(
  'sustav_odgovori_razvoja_poruke',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `boja` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists(
  'sustav_sesije_aktivne',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_korisnik` int(11) unsigned NOT NULL, MODIFY COLUMN `chat_modal_sugovornik_id` int(11) unsigned NOT NULL DEFAULT 0'
);
CALL vnlh_alter_table_if_exists(
  'sustav_sesije_poruke',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_razgovor` int(11) unsigned NOT NULL DEFAULT 0, MODIFY COLUMN `id_posiljatelj` int(11) unsigned NOT NULL, MODIFY COLUMN `id_primatelj` int(11) unsigned NOT NULL'
);
CALL vnlh_alter_table_if_exists('sustav_varijable', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL');
CALL vnlh_alter_table_if_exists(
  'telefoni',
  'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT, MODIFY COLUMN `id_clanovi` int(11) unsigned DEFAULT NULL, MODIFY COLUMN `id_telefoni_tip` int(11) unsigned DEFAULT NULL'
);
CALL vnlh_alter_table_if_exists('telefoni_tip', 'MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT');

  CALL vnlh_restore_skeema_fks();
END $$

DELIMITER ;

-- Instalacija + jednokratno izvršenje (isto kao prije: jedan mysql < ova datoteka).
CALL vnlh_migrate_unsigned_pk_fk();

-- Objekti ostaju u bazi za ponovni CALL (mali sql/vnlh_migracija_pk_fk_unsigned_samo_CALL.sql ili -e).
-- Ukloni rutine nakon potvrđenog uspjeha: sql/vnlh_migracija_pk_fk_unsigned_cleanup.sql
--
-- VAŽNO: ne pokretati CIJELU ovu datoteku ponovno na bazi koja je već prošla migraciju
-- (isti CALL bi ponovno pokušao ALTER na unsigned tipovima i može baciti grešku).
