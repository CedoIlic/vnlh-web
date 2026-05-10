-- =========================================================
-- Provjera negativnih vrijednosti prije migracije UNSIGNED
--
-- Kolone odgovaraju MODIFY dijelu u sql/vnlh_migracija_pk_fk_unsigned.sql.
-- Za svaki par tablica + stupac:
--   • ako tablica ne postoji — red s napomenom (npr. produkcija bez deploya);
--   • ako stupac ne postoji — red s napomenom (uža šema);
--   • inače broji retke gdje je stupac IS NOT NULL i < 0.
--
-- Pokretanje (nakon USE ime_baze;): izvrši cijelu skriptu ili samo poziv CALL na dnu.
-- Dva rezultatska skupa: puni pregled zatim samo stupci s negativnih_redaka > 0.
--
-- Ako HeidiSQL/phpMyAdmin i dalje siječe upite i javlja 1064 za '$$':
-- koristi sql/vnlh_migracija_unsigned_provjera_negativnih_gui.sql (isti stupci, bez procedura).
--
-- Kad mijenjaš migracijske MODIFY stupce — uskladi UNION u kursoru s migracijskom datotekom.
--
-- ------------------------------------------------------------
-- Isti problem kao kod vnlh_migracija_pk_fk_unsigned.sql: `DELIMITER $$` i završeci `$$`
-- obrađuje samo mysql/mariadb klijent, ne sve GUI-jeve. Bez toga dobiješ 1064 kod `$$`.
-- • Preporuka: naredbeni redak (XAMPP):
--     "...\\mysql.exe" -u root -p vnlh < ...\\sql\\vnlh_migracija_unsigned_provjera_negativnih.sql
-- • HeidiSQL: postavi delimiter upita na $$, pa F9 nad CIJELIM dokumentom od prve do zadnje linije.
-- • Ne izrezivaj skriptu; ne kopiraj samo izrezak — UNION ALL mora ostati cijeli.
-- ------------------------------------------------------------
-- =========================================================

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS vnlh_unsigned_provjera_negativnih $$
CREATE PROCEDURE vnlh_unsigned_provjera_negativnih()
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_tab VARCHAR(128);
  DECLARE v_col VARCHAR(128);
  DECLARE v_has_tbl INT;
  DECLARE v_has_col INT;

  DECLARE cur CURSOR FOR
    SELECT 'adrese' AS t, 'id' AS c
    UNION ALL SELECT 'adrese', 'id_clanovi'
    UNION ALL SELECT 'adrese', 'id_adrese_tip'
    UNION ALL SELECT 'adrese', 'id_drzave_adrese'
    UNION ALL SELECT 'adrese_tip', 'id'
    UNION ALL SELECT 'clanovi', 'id'
    UNION ALL SELECT 'clanovi', 'loza'
    UNION ALL SELECT 'clanovi', 'drzava'
    UNION ALL SELECT 'clanovi', 'porijeklo'
    UNION ALL SELECT 'clanovi', 'stupanj'
    UNION ALL SELECT 'clanovi', 'telefon'
    UNION ALL SELECT 'clanovi', 'e_mail'
    UNION ALL SELECT 'clanovi', 'adresa'
    UNION ALL SELECT 'clanovi', 'na_prijedlog'
    UNION ALL SELECT 'clanovi_porijeklo', 'id'
    UNION ALL SELECT 'drzave', 'id'
    UNION ALL SELECT 'drzave_adresa', 'id'
    UNION ALL SELECT 'duznosnici', 'id'
    UNION ALL SELECT 'duznosnici', 'id_nadredjeni'
    UNION ALL SELECT 'duznosnici_ogranicenja', 'id'
    UNION ALL SELECT 'duznosnici_prava', 'id'
    UNION ALL SELECT 'duznosnici_prava', 'duznost'
    UNION ALL SELECT 'duznosnici_prava', 'pravo'
    UNION ALL SELECT 'duznosnici_tip', 'id'
    UNION ALL SELECT 'email_tip', 'id'
    UNION ALL SELECT 'e_maili', 'id'
    UNION ALL SELECT 'e_maili', 'id_clanovi'
    UNION ALL SELECT 'e_maili', 'id_email_tip'
    UNION ALL SELECT 'jezici', 'id'
    UNION ALL SELECT 'loze', 'id'
    UNION ALL SELECT 'loze', 'id_regija'
    UNION ALL SELECT 'loze', 'id_obred'
    UNION ALL SELECT 'loze', 'id_drzava'
    UNION ALL SELECT 'loze', 'id_drzava_adrese'
    UNION ALL SELECT 'loze_tip', 'id'
    UNION ALL SELECT 'loze_tip', 'id_obred'
    UNION ALL SELECT 'meni', 'id'
    UNION ALL SELECT 'meni', 'meni_tip_id'
    UNION ALL SELECT 'meni_tip', 'id'
    UNION ALL SELECT 'napredovanja', 'id'
    UNION ALL SELECT 'napredovanja', 'id_clanovi'
    UNION ALL SELECT 'napredovanja', 'id_stupanj'
    UNION ALL SELECT 'napredovanja', 'id_tip_napredovanja'
    UNION ALL SELECT 'napredovanja', 'id_loza_napredovanja'
    UNION ALL SELECT 'napredovanja_tip', 'id'
    UNION ALL SELECT 'obredi', 'id'
    UNION ALL SELECT 'radovi_drzave_gostiju', 'id'
    UNION ALL SELECT 'radovi_prisustvo_tip', 'id'
    UNION ALL SELECT 'radovi_tip', 'id'
    UNION ALL SELECT 'regije', 'id'
    UNION ALL SELECT 'regije', 'id_drzava'
    UNION ALL SELECT 'stupnjevi', 'id'
    UNION ALL SELECT 'stupnjevi', 'id_obred'
    UNION ALL SELECT 'sustav_korisnici', 'id_korisnik'
    UNION ALL SELECT 'sustav_korisnici', 'id_duznosnik'
    UNION ALL SELECT 'sustav_korisnici_login', 'id_korisnik'
    UNION ALL SELECT 'sustav_odgovori_razvoja_boje', 'id'
    UNION ALL SELECT 'sustav_odgovori_razvoja_poruke', 'id'
    UNION ALL SELECT 'sustav_odgovori_razvoja_poruke', 'boja'
    UNION ALL SELECT 'sustav_sesije_aktivne', 'id'
    UNION ALL SELECT 'sustav_sesije_aktivne', 'id_korisnik'
    UNION ALL SELECT 'sustav_sesije_aktivne', 'chat_modal_sugovornik_id'
    UNION ALL SELECT 'sustav_sesije_poruke', 'id'
    UNION ALL SELECT 'sustav_sesije_poruke', 'id_razgovor'
    UNION ALL SELECT 'sustav_sesije_poruke', 'id_posiljatelj'
    UNION ALL SELECT 'sustav_sesije_poruke', 'id_primatelj'
    UNION ALL SELECT 'sustav_varijable', 'id'
    UNION ALL SELECT 'telefoni', 'id'
    UNION ALL SELECT 'telefoni', 'id_clanovi'
    UNION ALL SELECT 'telefoni', 'id_telefoni_tip'
    UNION ALL SELECT 'telefoni_tip', 'id';

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  DROP TEMPORARY TABLE IF EXISTS vnlh_neg_rezultat;
  CREATE TEMPORARY TABLE vnlh_neg_rezultat (
    tablica VARCHAR(128) NOT NULL,
    stupac VARCHAR(128) NOT NULL,
    tablica_postoji TINYINT(1) NOT NULL DEFAULT 0,
    stupac_postoji TINYINT(1) NOT NULL DEFAULT 0,
    negativnih_redaka BIGINT NOT NULL DEFAULT 0,
    napomena VARCHAR(255) DEFAULT NULL
  ) ENGINE=InnoDB;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_tab, v_col;
    IF v_done = 1 THEN
      LEAVE read_loop;
    END IF;

    SELECT COUNT(*) INTO v_has_tbl
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = v_tab
      AND TABLE_TYPE = 'BASE TABLE';

    IF v_has_tbl = 0 THEN
      INSERT INTO vnlh_neg_rezultat(tablica, stupac, tablica_postoji, stupac_postoji, negativnih_redaka, napomena)
      VALUES (v_tab, v_col, 0, 0, 0, 'tablica ne postoji na ovoj bazi');
    ELSE
      SELECT COUNT(*) INTO v_has_col
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = v_tab
        AND COLUMN_NAME = v_col;

      IF v_has_col = 0 THEN
        INSERT INTO vnlh_neg_rezultat(tablica, stupac, tablica_postoji, stupac_postoji, negativnih_redaka, napomena)
        VALUES (v_tab, v_col, 1, 0, 0, 'stupac ne postoji na ovoj bazi — provjeri verziju sheme');
      ELSE
        SET @vq = CONCAT(
          'SELECT COUNT(*) INTO @vn FROM `', v_tab, '` ',
          'WHERE (`', v_col, '` IS NOT NULL AND `', v_col, '` < 0)'
        );
        SET @vn = NULL;
        PREPARE pst FROM @vq;
        EXECUTE pst;
        DEALLOCATE PREPARE pst;

        INSERT INTO vnlh_neg_rezultat(tablica, stupac, tablica_postoji, stupac_postoji, negativnih_redaka, napomena)
        VALUES (v_tab, v_col, 1, 1, COALESCE(@vn, 0), NULL);
      END IF;
    END IF;
  END LOOP;
  CLOSE cur;

  SELECT DATABASE() AS baza_pregledana, NOW() AS vrijeme_pregleda;

  SELECT
    tablica,
    stupac,
    tablica_postoji,
    stupac_postoji,
    negativnih_redaka,
    napomena
  FROM vnlh_neg_rezultat
  ORDER BY tablica, stupac;

  SELECT
    tablica,
    stupac,
    tablica_postoji,
    stupac_postoji,
    negativnih_redaka,
    napomena
  FROM vnlh_neg_rezultat
  WHERE negativnih_redaka > 0
  ORDER BY negativnih_redaka DESC, tablica, stupac;

  DROP TEMPORARY TABLE IF EXISTS vnlh_neg_rezultat;
END$$

DELIMITER ;

CALL vnlh_unsigned_provjera_negativnih();

DROP PROCEDURE IF EXISTS vnlh_unsigned_provjera_negativnih;
