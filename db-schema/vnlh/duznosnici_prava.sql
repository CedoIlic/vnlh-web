CREATE TABLE `duznosnici_prava` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `duznost` int(11) NOT NULL,
  `pravo` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_duznosnici_prava_duznost_pravo` (`duznost`,`pravo`),
  KEY `fk_duznosnici_prava_meni` (`pravo`),
  KEY `fk_duznosnici_prava_duznosnici` (`duznost`),
  CONSTRAINT `fk_duznosnici_prava_duznosnici` FOREIGN KEY (`duznost`) REFERENCES `duznosnici` (`id`),
  CONSTRAINT `fk_duznosnici_prava_meni` FOREIGN KEY (`pravo`) REFERENCES `meni` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
