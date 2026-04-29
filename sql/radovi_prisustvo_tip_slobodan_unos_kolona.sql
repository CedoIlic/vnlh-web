-- Jednokratno na postojećoj bazi: dodaje slobodan_unos nakon duznosnik_ok (prije boja_prikaza).
-- 1 = dopušten slobodan upis imena, lože i države u zapisniku prisustva.

ALTER TABLE `radovi_prisustvo_tip`
  ADD COLUMN `slobodan_unos` smallint(6) NOT NULL DEFAULT 0
    COMMENT 'Ako je 1, slobodan upis imena, lože i države'
  AFTER `duznosnik_ok`;
