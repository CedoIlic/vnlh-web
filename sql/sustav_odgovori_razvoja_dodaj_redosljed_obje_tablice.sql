-- Jednim prolazom dodaje stupac `redosljed` na obje tablice (ako već postoji, MySQL prijavi grešku – preskoči taj ALTER).
-- Rješava grešku 1054 (Unknown column 'redosljed'...) u aplikaciji ako su tablice kreirane prije uvođenja stupca.

ALTER TABLE `sustav_odgovori_razvoja_boje`
  ADD COLUMN `redosljed` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Redosljed prikaza i primjene podataka (0–255)'
    AFTER `id`;

ALTER TABLE `sustav_odgovori_razvoja_poruke`
  ADD COLUMN `redosljed` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Redosljed prikaza i primjene podataka (0–255)'
    AFTER `id`;
