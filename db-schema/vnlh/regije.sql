CREATE TABLE `regije` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_drzava` int(11) NOT NULL,
  `naziv` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_regije_drzava_naziv` (`id_drzava`,`naziv`),
  UNIQUE KEY `regije_unique_drzava_naziv` (`id_drzava`,`naziv`),
  CONSTRAINT `regije_ibfk_1` FOREIGN KEY (`id_drzava`) REFERENCES `drzave` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
