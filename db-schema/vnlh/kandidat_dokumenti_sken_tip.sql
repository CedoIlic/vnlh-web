CREATE TABLE `kandidat_dokumenti_sken_tip` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK tipa skeniranog dokumenta kandidata',
  `naziv` varchar(50) NOT NULL COMMENT 'Naziv tipa skeniranog dokumenta za kandidata',
  `redosljed` int(11) NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza (0-100)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
