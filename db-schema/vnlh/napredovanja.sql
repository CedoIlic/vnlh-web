CREATE TABLE `napredovanja` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_clanovi` int(11) NOT NULL,
  `id_stupanj` int(11) NOT NULL,
  `id_tip_napredovanja` int(11) DEFAULT NULL,
  `id_loza_napredovanja` int(11) DEFAULT NULL,
  `datum_napredovanja` date DEFAULT NULL,
  `loza_napredovanja` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_napredovanja_clanovi` (`id_clanovi`),
  KEY `fk_napredovanja_stupnjevi` (`id_stupanj`),
  KEY `fk_napredovanja_tip` (`id_tip_napredovanja`),
  KEY `fk_napredovanja_loze` (`id_loza_napredovanja`),
  CONSTRAINT `fk_napredovanja_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_napredovanja_loze` FOREIGN KEY (`id_loza_napredovanja`) REFERENCES `loze` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_napredovanja_stupnjevi` FOREIGN KEY (`id_stupanj`) REFERENCES `stupnjevi` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_napredovanja_tip` FOREIGN KEY (`id_tip_napredovanja`) REFERENCES `napredovanja_tip` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
