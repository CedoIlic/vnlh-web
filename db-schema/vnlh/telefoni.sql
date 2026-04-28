CREATE TABLE `telefoni` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_clanovi` int(11) DEFAULT NULL,
  `id_telefoni_tip` int(11) DEFAULT NULL,
  `telefon` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `ix_telefoni_id_clanovi` (`id_clanovi`),
  KEY `ix_telefoni_id_telefoni_tip` (`id_telefoni_tip`),
  CONSTRAINT `fk_telefoni_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_telefoni_telefoni_tip` FOREIGN KEY (`id_telefoni_tip`) REFERENCES `telefoni_tip` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
