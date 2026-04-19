-- Jednim prolazom dodaje stupac `redosljed` na obje tablice (ako već postoji, MySQL prijavi grešku – preskoči taj ALTER).
-- Rješava grešku 1054 (Unknown column 'redosljed'...) u aplikaciji ako su tablice kreirane prije uvođenja stupca.

ALTER TABLE `Sustav_Odgovori_Razvoja_Boje`
  ADD COLUMN `redosljed` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Redosljed prikaza i primjene podataka (0–255)'
    AFTER `id`;

ALTER TABLE `Sustav_Odgovori_Razvoja_Poruke`
  ADD COLUMN `redosljed` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Redosljed prikaza i primjene podataka (0–255)'
    AFTER `id`;
