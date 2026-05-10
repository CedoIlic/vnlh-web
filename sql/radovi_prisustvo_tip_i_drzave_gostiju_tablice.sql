-- =============================================================================
-- ARHIV / JEDNOKRATNO: dvije lookup tablice za Zapisnik i CRUD-e.
--
-- IZVOR ISTINE za shemu: db-schema/vnlh/radovi_prisustvo_tip.sql i
-- db-schema/vnlh/radovi_drzave_gostiju.sql (Skeema). Prije primjene na bazi
-- provjeri postoje li tablice; ovaj DDL je samo za ručno usklađivanje stare
-- baze ako još nisu kreirane — ne kopirati naspram zastarjelog modela bez
-- pregleda (CREATE ne koristi IF NOT EXISTS).
--
-- Datum usklađivanja s db-schema: int(11) unsigned na PK kao u Skeemi.
-- =============================================================================

CREATE TABLE `radovi_prisustvo_tip` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv` varchar(50) DEFAULT NULL COMMENT 'Naziv tipa unosa prisustva',
  `redosljed` smallint(6) DEFAULT NULL COMMENT 'Redosljed prikaza',
  `duznosnik_ok` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Ako je 1, može obnašati dužnost',
  `slobodan_unos` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Ako je 1, slobodan upis imena, lože i države',
  `svi_clanovi_obedijncije` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Ako je 1, svi članovi obedijencije u izvor',
  `boja_prikaza` varchar(16) DEFAULT NULL COMMENT 'Boja u kojoj se ispisuje taj tip prisustva',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radovi_drzave_gostiju` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv` varchar(50) DEFAULT NULL COMMENT 'Država (naziv države ili kratki opis)',
  `redosljed` smallint(6) DEFAULT NULL COMMENT 'Redosljed prikaza',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
