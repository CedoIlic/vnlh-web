-- Dodaje stupac redosljed odmah iza id (poredak za kasnije liste / primjene).
-- Pokrenuti jednom na postojećoj bazi ako tablica već postoji bez ove kolone.

ALTER TABLE `Sustav_Odgovori_Razvoja_Boje`
  ADD COLUMN `redosljed` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Redosljed prikaza i primjene podataka (0–255)'
    AFTER `id`;
