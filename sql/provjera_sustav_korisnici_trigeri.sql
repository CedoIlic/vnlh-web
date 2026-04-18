-- =============================================================================
-- Provjera sheme sustav_korisnici / sustav_korisnici_login i triggera broj_duznosti
-- (read-only dijelovi + opcijski test u transakciji koji se rollbacka).
-- Pokreni na istoj bazi kao aplikacija; zalijepi izlaz u chat.
--
-- HeidiSQL: ako pokreneš cijelu datoteku, svaka naredba dobije ZASEBNU karticu
-- rezultata ispod (1. Rezultat, 2. Rezultat, …). Samo prva kartica nije "sve" —
-- klikni ostale kartice ili koristi donji "brzi pregled u jednom rezultatu".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) BRZI PREGLED U JEDNOM REZULTATU (preporučeno za zalijepljivanje u chat)
--     Jedan red: verzija, baza, PK tablice dodjela, popis triggera, neslaganja.
-- -----------------------------------------------------------------------------
SELECT
  VERSION() AS mysql_version,
  DATABASE() AS trenutna_baza,
  (
    SELECT GROUP_CONCAT(`COLUMN_NAME` ORDER BY `ORDINAL_POSITION` SEPARATOR ',')
    FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'sustav_korisnici'
      AND `CONSTRAINT_NAME` = 'PRIMARY'
  ) AS pk_sustav_korisnici_stupci,
  (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'sustav_korisnici_login'
      AND `COLUMN_NAME` = 'broj_duznosti'
  ) AS ima_stupac_broj_duznosti_u_login,
  (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`TRIGGERS`
    WHERE `TRIGGER_SCHEMA` = DATABASE()
      AND `EVENT_OBJECT_TABLE` = 'sustav_korisnici'
  ) AS broj_triggera_na_sustav_korisnici,
  (
    SELECT GROUP_CONCAT(`TRIGGER_NAME` ORDER BY `TRIGGER_NAME` SEPARATOR ', ')
    FROM `INFORMATION_SCHEMA`.`TRIGGERS`
    WHERE `TRIGGER_SCHEMA` = DATABASE()
      AND `EVENT_OBJECT_TABLE` = 'sustav_korisnici'
  ) AS imena_triggera,
  (
    SELECT COUNT(*)
    FROM `sustav_korisnici_login` `l`
    LEFT JOIN (
      SELECT `id_korisnik`, COUNT(*) AS `cnt`
      FROM `sustav_korisnici`
      GROUP BY `id_korisnik`
    ) `s` ON `s`.`id_korisnik` = `l`.`id_korisnik`
    WHERE `l`.`broj_duznosti` <> IFNULL(`s`.`cnt`, 0)
  ) AS broj_korisnika_s_pogresnim_broj_duznosti,
  (SELECT COUNT(*) FROM `sustav_korisnici_login`) AS ukupno_korisnika_u_login,
  (SELECT COUNT(*) FROM `sustav_korisnici`) AS ukupno_redaka_dodjela;

-- -----------------------------------------------------------------------------
-- 1) Verzija servera i aktivna baza
-- -----------------------------------------------------------------------------
SELECT VERSION() AS mysql_version, DATABASE() AS trenutna_baza;

-- -----------------------------------------------------------------------------
-- 2) Definicije tablica (očekivano: PK na sustav_korisnici = id_korisnik + id_duznosnik;
--    sustav_korisnici_login ima broj_duznosti)
-- -----------------------------------------------------------------------------
SHOW CREATE TABLE `sustav_korisnici`;
SHOW CREATE TABLE `sustav_korisnici_login`;

-- -----------------------------------------------------------------------------
-- 3) Triggeri vezani uz tablicu sustav_korisnici (očekana imena iz migracije)
-- -----------------------------------------------------------------------------
SELECT
  `TRIGGER_NAME`,
  `EVENT_MANIPULATION`,
  `ACTION_TIMING`,
  `EVENT_OBJECT_TABLE`,
  `ACTION_STATEMENT`
FROM `INFORMATION_SCHEMA`.`TRIGGERS`
WHERE `TRIGGER_SCHEMA` = DATABASE()
  AND `EVENT_OBJECT_TABLE` = 'sustav_korisnici'
ORDER BY `TRIGGER_NAME`;

-- Ako gornji upit vrati 0 redaka, triggeri nisu instalirani (pokreni korak 7 iz
-- sql/sustav_korisnici_login_i_dodjele_migracija.sql).

-- -----------------------------------------------------------------------------
-- 4) Konzistentnost: broj_duznosti u login tablici vs stvaran broj dodjela
--     (svaki red gdje se ne poklapa = problem ili triggeri nisu radili)
-- -----------------------------------------------------------------------------
SELECT
  `l`.`id_korisnik`,
  `l`.`broj_duznosti` AS broj_u_login,
  COUNT(`s`.`id_duznosnik`) AS broj_stvarni
FROM `sustav_korisnici_login` `l`
LEFT JOIN `sustav_korisnici` `s` ON `s`.`id_korisnik` = `l`.`id_korisnik`
GROUP BY `l`.`id_korisnik`, `l`.`broj_duznosti`
HAVING `l`.`broj_duznosti` <> COUNT(`s`.`id_duznosnik`)
ORDER BY `l`.`id_korisnik`;

-- Prazan rezultat = sve se poklapa (ili nema redaka u login).

-- -----------------------------------------------------------------------------
-- 5) Sažetak: koliko korisnika ima koliko dodjela (brzi pregled)
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS ukupno_korisnika_u_login,
  SUM(`broj_duznosti`) AS zbroj_broj_duznosti_stupac
FROM `sustav_korisnici_login`;

SELECT COUNT(*) AS ukupno_redaka_dodjela FROM `sustav_korisnici`;

-- -----------------------------------------------------------------------------
-- 6) OPCIJSKI test triggera (mijenja podatke pa ih vraća – pokreni samo ako smiješ)
--     Zamijeni @test_korisnik i @test_duznosnik s ID-jevima koji POSTOJE u sustavu
--     (npr. iz sustav_korisnici ili iz test okruženja). Ako nemaš test ID-jeve,
--     preskoči ovaj blok.
-- -----------------------------------------------------------------------------
/*
SET @test_korisnik := 0;
SET @test_duznosnik := 0;

START TRANSACTION;

SELECT `broj_duznosti` AS prije_insert FROM `sustav_korisnici_login` WHERE `id_korisnik` = @test_korisnik;

INSERT INTO `sustav_korisnici` (`id_korisnik`, `id_duznosnik`) VALUES (@test_korisnik, @test_duznosnik);

SELECT `broj_duznosti` AS nakon_insert FROM `sustav_korisnici_login` WHERE `id_korisnik` = @test_korisnik;

DELETE FROM `sustav_korisnici` WHERE `id_korisnik` = @test_korisnik AND `id_duznosnik` = @test_duznosnik;

SELECT `broj_duznosti` AS nakon_delete FROM `sustav_korisnici_login` WHERE `id_korisnik` = @test_korisnik;

ROLLBACK;
*/
