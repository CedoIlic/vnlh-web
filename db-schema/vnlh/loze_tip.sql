CREATE TABLE `loze_tip` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_obred` int(11) NOT NULL,
  `naziv` varchar(50) NOT NULL,
  `redosljed` int(11) NOT NULL DEFAULT 0,
  `id_pozivatelja` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_loze_tip_obredi` (`id_obred`),
  CONSTRAINT `fk_loze_tip_obredi` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
