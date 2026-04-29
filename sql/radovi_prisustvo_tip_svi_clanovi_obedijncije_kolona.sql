-- Jednokratno na postojećoj bazi: dodaje svi_clanovi_obedijncije nakon slobodan_unos (prije boja_prikaza).
-- 1 = u izvornu listu uključeni svi članovi obedijencije (Zapisnik / prisustvo).

ALTER TABLE `radovi_prisustvo_tip`
  ADD COLUMN `svi_clanovi_obedijncije` smallint(6) NOT NULL DEFAULT 0
    COMMENT 'Ako je 1, svi članovi obedijencije u izvor'
  AFTER `slobodan_unos`;
