-- =========================================================
-- Popis tablica na MySQL/MariaDB serveru
--
-- U phpMyAdminu: odaberi bazu u lijevom izborniku, pa pokreni ovaj skript.
-- Iz mysql klijenta:  USE ime_baze;   pa izvrši skriptu.
--
-- Varijanta A: samo imena (trenutna baza = ona iz USE ili odabrana u phpMyAdminu)
-- =========================================================

SHOW TABLES;

-- =========================================================
-- Varijanta B: imena tablica s dodatcima (InnoDB, redovi, kreirano…)
-- =========================================================

SELECT
    TABLE_NAME      AS tablica,
    ENGINE          AS engine,
    TABLE_ROWS      AS procjena_redaka,
    TABLE_COLLATION AS collation,
    CREATE_TIME     AS kreirano
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- =========================================================
-- Varijanta C: sve korisničke baze na serveru + broj tablica po bazi
-- (zahtijeva dovoljna prava; na dijeljenom hostu možda ne radi)
-- =========================================================

-- SELECT
--     TABLE_SCHEMA AS baza,
--     COUNT(*)     AS broj_tablica
-- FROM information_schema.TABLES
-- WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
--   AND TABLE_TYPE = 'BASE TABLE'
-- GROUP BY TABLE_SCHEMA
-- ORDER BY TABLE_SCHEMA;
