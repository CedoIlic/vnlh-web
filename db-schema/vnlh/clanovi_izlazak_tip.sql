CREATE TABLE `clanovi_izlazak_tip` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK tipa izlaska iz lože',
  `redosljed` int(11) NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza (0-100)',
  `kljuc` int(11) NOT NULL DEFAULT 0 COMMENT 'Ključ tipa izlaska (0-100)',
  `naziv` varchar(50) NOT NULL COMMENT 'Naziv tipa izlaska iz lože',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
