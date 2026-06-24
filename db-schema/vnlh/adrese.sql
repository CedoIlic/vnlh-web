CREATE TABLE `adrese` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clanovi` int(11) unsigned DEFAULT NULL,
  `id_adrese_tip` int(11) unsigned DEFAULT NULL,
  `id_drzave_adrese` int(11) unsigned DEFAULT NULL,
  `adresa_1` varchar(50) NOT NULL DEFAULT '',
  `adresa_2` varchar(50) NOT NULL DEFAULT '',
  `grad` varchar(50) NOT NULL DEFAULT '',
  `posta` varchar(6) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `ix_adrese_id_clanovi` (`id_clanovi`),
  KEY `ix_adrese_id_adrese_tip` (`id_adrese_tip`),
  KEY `ix_adrese_id_drzave_adrese` (`id_drzave_adrese`),
  CONSTRAINT `fk_adrese_adrese_tip` FOREIGN KEY (`id_adrese_tip`) REFERENCES `adrese_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_adrese_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_adrese_drzave_adresa` FOREIGN KEY (`id_drzave_adrese`) REFERENCES `drzave_adresa` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
