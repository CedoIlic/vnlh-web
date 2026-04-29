CREATE TABLE `radovi_drzave_gostiju` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `naziv` varchar(50) DEFAULT NULL COMMENT 'Država (naziv države ili kratki opis)',
  `redosljed` smallint(6) DEFAULT NULL COMMENT 'Redosljed prikaza',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
