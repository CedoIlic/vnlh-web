-- Jednokratno na postojećoj bazi: dodaje kolonu duznosnik_ok u radovi_prisustvo_tip (nakon redosljeda).
-- Ako kolona već postoji, pokreni samo ako ALTER nije već primijenjen.

ALTER TABLE `radovi_prisustvo_tip`
  ADD COLUMN `duznosnik_ok` smallint(6) NOT NULL DEFAULT 0
    COMMENT 'Ako je 1, može obnašati dužnost'
  AFTER `redosljed`;
