-- Jednokratno na postojećoj bazi: dodaje boja_prikaza nakon duznosnik_ok.
-- Sprema se npr. #RRGGBBAA (boja + alpha 0–255 u heksu), NULL = nije definirano.

ALTER TABLE `radovi_prisustvo_tip`
  ADD COLUMN `boja_prikaza` varchar(16) DEFAULT NULL
    COMMENT 'Boja u kojoj se ispisuje taj tip prisustva'
  AFTER `duznosnik_ok`;
