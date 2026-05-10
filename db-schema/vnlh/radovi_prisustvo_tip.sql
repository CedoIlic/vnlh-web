-- Tablica: tipovi unosa prisustva (Zapisnik / Radovi).

-- ODLUKA — ime stupca `svi_clanovi_obedijncije`:
-- U imenu stupca (identifier) izostavljeno je slovo u odnosu na pravilan pojam „obedijencije”; smisao je ispravno
-- opisan u SQL COMMENT-u na stupcu.

-- Ostavljeno je namjerno radi kompatibilnosti s PHP/JS i postojećim bazama. Preimenovanje u ispravan oblik zahtijevalo bi
-- migraciju ALTER + refaktor svih referenci u repou i vanjskim skriptama.

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
