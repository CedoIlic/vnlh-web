CREATE TABLE `meni` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `naziv` varchar(50) NOT NULL,
  `opis` varchar(100) DEFAULT NULL,
  `napomena` text DEFAULT NULL,
  `html_fajl` varchar(100) DEFAULT NULL,
  `putanja` varchar(150) DEFAULT NULL,
  `ref` varchar(50) DEFAULT NULL,
  `meni_tip_id` int(11) DEFAULT NULL,
  `roditelj` int(11) DEFAULT 0,
  `redoslijed` int(11) DEFAULT 0,
  `device` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `aktivno` tinyint(1) DEFAULT 0,
  `test` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_meni_tip_id` (`meni_tip_id`),
  CONSTRAINT `fk_meni_meni_tip` FOREIGN KEY (`meni_tip_id`) REFERENCES `meni_tip` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
