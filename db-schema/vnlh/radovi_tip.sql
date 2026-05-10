CREATE TABLE `radovi_tip` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv` varchar(50) DEFAULT NULL COMMENT 'Tip radova, redovni, izvanrdni, svečani',
  `redosljed` smallint(6) DEFAULT NULL COMMENT 'Redosljed prikaza u selectu',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
