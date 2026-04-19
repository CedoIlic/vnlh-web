-- Kolona razina u tablici duznosnici (0 = nije postavljeno; u UI unos 1–99).
-- Pokrenuti jednom na bazi prije korištenja Duznosnici_CRUD s poljem Razina.

ALTER TABLE duznosnici
  ADD COLUMN razina TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Razina hijerarhije (0=nije postavljeno, 1–99 u formi)'
  AFTER aktivnost;
