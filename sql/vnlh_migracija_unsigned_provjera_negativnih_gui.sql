-- =========================================================
-- Provjera negativnih (bez DELIMITERA / bez procedura) — HeidiSQL, phpMyAdmin
--
-- Isti stupci kao u sql/vnlh_migracija_unsigned_provjera_negativnih.sql
--
-- Zašto: neki GUI dijeli skriptu na više upita nakon točka-zareza i ne poštuje
-- 'DELIMITER $$', pa PROCEDURE pukne (1064 oko '$$').
--
-- Ova datoteka ima tri obična SELECT-a razdvojena točka-zarezom — pokreni sve odjednom.
--
-- Oslanja se na CASE WHEN (ne IF): IF na nekim serverima računa obje grane pa COUNT
-- nad nepostojećom tablicom baci 1146, CASE skoči na prvom WHEN.
--
-- Kad mijenjaš MODIFY u migraciji, uskadi ovaj UNION ili pokreni Python gen skriptu.
--
-- Za ručno lijepljenje čuvaj razmak između * i FROM te između napomena i FROM.
-- U phpMyAdminu koristi Uvezi datoteku — ne kopiraj cijeli UNION u tekst polje.
--
-- =========================================================

SET NAMES utf8mb4;

SELECT DATABASE() AS baza_pregledana, NOW() AS vrijeme_pregleda;

SELECT * FROM (
SELECT
    'adrese' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_adrese_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_adrese_tip` IS NOT NULL AND `id_adrese_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_drzave_adrese' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_drzave_adrese` IS NOT NULL AND `id_drzave_adrese` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'loza' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `loza` IS NOT NULL AND `loza` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `drzava` IS NOT NULL AND `drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'porijeklo' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `porijeklo` IS NOT NULL AND `porijeklo` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'stupanj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `stupanj` IS NOT NULL AND `stupanj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'telefon' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `telefon` IS NOT NULL AND `telefon` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'e_mail' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `e_mail` IS NOT NULL AND `e_mail` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'adresa' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `adresa` IS NOT NULL AND `adresa` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'na_prijedlog' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `na_prijedlog` IS NOT NULL AND `na_prijedlog` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi_porijeklo' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi_porijeklo` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'drzave' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `drzave` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'drzave_adresa' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `drzave_adresa` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici' AS tablica,
    'id_nadredjeni' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici` WHERE `id_nadredjeni` IS NOT NULL AND `id_nadredjeni` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_ogranicenja' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_ogranicenja` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'duznost' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `duznost` IS NOT NULL AND `duznost` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'pravo' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `pravo` IS NOT NULL AND `pravo` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'email_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `email_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id_email_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id_email_tip` IS NOT NULL AND `id_email_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'jezici' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `jezici` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_regija' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_regija` IS NOT NULL AND `id_regija` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_drzava` IS NOT NULL AND `id_drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_drzava_adrese' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_drzava_adrese` IS NOT NULL AND `id_drzava_adrese` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze_tip' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze_tip` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni' AS tablica,
    'meni_tip_id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni` WHERE `meni_tip_id` IS NOT NULL AND `meni_tip_id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_stupanj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_stupanj` IS NOT NULL AND `id_stupanj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_tip_napredovanja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_tip_napredovanja` IS NOT NULL AND `id_tip_napredovanja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_loza_napredovanja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_loza_napredovanja` IS NOT NULL AND `id_loza_napredovanja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'obredi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `obredi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_drzave_gostiju' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_drzave_gostiju` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_prisustvo_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_prisustvo_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'regije' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `regije` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'regije' AS tablica,
    'id_drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `regije` WHERE `id_drzava` IS NOT NULL AND `id_drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'stupnjevi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `stupnjevi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'stupnjevi' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `stupnjevi` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici' AS tablica,
    'id_duznosnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici` WHERE `id_duznosnik` IS NOT NULL AND `id_duznosnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici_login' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici_login` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_boje' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_boje` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_poruke' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_poruke` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_poruke' AS tablica,
    'boja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_poruke` WHERE `boja` IS NOT NULL AND `boja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'chat_modal_sugovornik_id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `chat_modal_sugovornik_id` IS NOT NULL AND `chat_modal_sugovornik_id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_razgovor' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_razgovor` IS NOT NULL AND `id_razgovor` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_posiljatelj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_posiljatelj` IS NOT NULL AND `id_posiljatelj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_primatelj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_primatelj` IS NOT NULL AND `id_primatelj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_varijable' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_varijable` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id_telefoni_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id_telefoni_tip` IS NOT NULL AND `id_telefoni_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
) AS vnlh_neg_union ORDER BY tablica, stupac;

SELECT tablica, stupac, tablica_postoji, stupac_postoji, negativnih_redaka, napomena FROM (
SELECT
    'adrese' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_adrese_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_adrese_tip` IS NOT NULL AND `id_adrese_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_adrese_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese' AS tablica,
    'id_drzave_adrese' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese` WHERE `id_drzave_adrese` IS NOT NULL AND `id_drzave_adrese` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese' AND COLUMN_NAME = 'id_drzave_adrese') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'adrese_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `adrese_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adrese_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'loza' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `loza` IS NOT NULL AND `loza` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'loza') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `drzava` IS NOT NULL AND `drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'porijeklo' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `porijeklo` IS NOT NULL AND `porijeklo` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'porijeklo') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'stupanj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `stupanj` IS NOT NULL AND `stupanj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'stupanj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'telefon' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `telefon` IS NOT NULL AND `telefon` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'telefon') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'e_mail' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `e_mail` IS NOT NULL AND `e_mail` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'e_mail') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'adresa' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `adresa` IS NOT NULL AND `adresa` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'adresa') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi' AS tablica,
    'na_prijedlog' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi` WHERE `na_prijedlog` IS NOT NULL AND `na_prijedlog` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi' AND COLUMN_NAME = 'na_prijedlog') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'clanovi_porijeklo' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `clanovi_porijeklo` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clanovi_porijeklo' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'drzave' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `drzave` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'drzave_adresa' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `drzave_adresa` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drzave_adresa' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici' AS tablica,
    'id_nadredjeni' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici` WHERE `id_nadredjeni` IS NOT NULL AND `id_nadredjeni` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici' AND COLUMN_NAME = 'id_nadredjeni') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_ogranicenja' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_ogranicenja` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_ogranicenja' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'duznost' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `duznost` IS NOT NULL AND `duznost` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'duznost') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_prava' AS tablica,
    'pravo' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_prava` WHERE `pravo` IS NOT NULL AND `pravo` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_prava' AND COLUMN_NAME = 'pravo') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'duznosnici_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `duznosnici_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'duznosnici_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'email_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `email_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'e_maili' AS tablica,
    'id_email_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `e_maili` WHERE `id_email_tip` IS NOT NULL AND `id_email_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'e_maili' AND COLUMN_NAME = 'id_email_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'jezici' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `jezici` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jezici' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_regija' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_regija` IS NOT NULL AND `id_regija` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_regija') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_drzava` IS NOT NULL AND `id_drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze' AS tablica,
    'id_drzava_adrese' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze` WHERE `id_drzava_adrese` IS NOT NULL AND `id_drzava_adrese` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze' AND COLUMN_NAME = 'id_drzava_adrese') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'loze_tip' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `loze_tip` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loze_tip' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni' AS tablica,
    'meni_tip_id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni` WHERE `meni_tip_id` IS NOT NULL AND `meni_tip_id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni' AND COLUMN_NAME = 'meni_tip_id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'meni_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `meni_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meni_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_stupanj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_stupanj` IS NOT NULL AND `id_stupanj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_stupanj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_tip_napredovanja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_tip_napredovanja` IS NOT NULL AND `id_tip_napredovanja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_tip_napredovanja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja' AS tablica,
    'id_loza_napredovanja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja` WHERE `id_loza_napredovanja` IS NOT NULL AND `id_loza_napredovanja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja' AND COLUMN_NAME = 'id_loza_napredovanja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'napredovanja_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `napredovanja_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'napredovanja_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'obredi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `obredi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obredi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_drzave_gostiju' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_drzave_gostiju` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_drzave_gostiju' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_prisustvo_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_prisustvo_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_prisustvo_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'radovi_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `radovi_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radovi_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'regije' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `regije` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'regije' AS tablica,
    'id_drzava' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `regije` WHERE `id_drzava` IS NOT NULL AND `id_drzava` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regije' AND COLUMN_NAME = 'id_drzava') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'stupnjevi' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `stupnjevi` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'stupnjevi' AS tablica,
    'id_obred' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `stupnjevi` WHERE `id_obred` IS NOT NULL AND `id_obred` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stupnjevi' AND COLUMN_NAME = 'id_obred') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici' AS tablica,
    'id_duznosnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici` WHERE `id_duznosnik` IS NOT NULL AND `id_duznosnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici' AND COLUMN_NAME = 'id_duznosnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_korisnici_login' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_korisnici_login` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_korisnici_login' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_boje' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_boje` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_boje' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_poruke' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_poruke` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_odgovori_razvoja_poruke' AS tablica,
    'boja' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_odgovori_razvoja_poruke` WHERE `boja` IS NOT NULL AND `boja` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_odgovori_razvoja_poruke' AND COLUMN_NAME = 'boja') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'id_korisnik' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `id_korisnik` IS NOT NULL AND `id_korisnik` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'id_korisnik') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_aktivne' AS tablica,
    'chat_modal_sugovornik_id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_aktivne` WHERE `chat_modal_sugovornik_id` IS NOT NULL AND `chat_modal_sugovornik_id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_aktivne' AND COLUMN_NAME = 'chat_modal_sugovornik_id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_razgovor' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_razgovor` IS NOT NULL AND `id_razgovor` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_razgovor') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_posiljatelj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_posiljatelj` IS NOT NULL AND `id_posiljatelj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_posiljatelj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_sesije_poruke' AS tablica,
    'id_primatelj' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_sesije_poruke` WHERE `id_primatelj` IS NOT NULL AND `id_primatelj` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_sesije_poruke' AND COLUMN_NAME = 'id_primatelj') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'sustav_varijable' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `sustav_varijable` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sustav_varijable' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id_clanovi' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id_clanovi` IS NOT NULL AND `id_clanovi` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_clanovi') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni' AS tablica,
    'id_telefoni_tip' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni` WHERE `id_telefoni_tip` IS NOT NULL AND `id_telefoni_tip` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni' AND COLUMN_NAME = 'id_telefoni_tip') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
 UNION ALL 
SELECT
    'telefoni_tip' AS tablica,
    'id' AS stupac,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') AS tablica_postoji,
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') AS stupac_postoji,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 0
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM `telefoni_tip` WHERE `id` IS NOT NULL AND `id` < 0)
    END AS negativnih_redaka,
    CASE
      WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND TABLE_TYPE = 'BASE TABLE') = 0 THEN 'tablica ne postoji na ovoj bazi'
      WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'telefoni_tip' AND COLUMN_NAME = 'id') = 0 THEN 'stupac ne postoji na ovoj bazi — provjeri verziju sheme'
      ELSE NULL
    END AS napomena
) AS vnlh_only_problems WHERE negativnih_redaka > 0 ORDER BY negativnih_redaka DESC, tablica, stupac;
