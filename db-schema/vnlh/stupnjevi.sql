CREATE TABLE `stupnjevi` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_obred` int(11) unsigned NOT NULL,
  `stupanj` int(11) NOT NULL DEFAULT 0,
  `naziv` varchar(50) NOT NULL DEFAULT '',
  `slika` longblob DEFAULT NULL,
  `slika_mime` varchar(32) DEFAULT NULL,
  `slika_thumbnail` mediumblob DEFAULT NULL,
  `slika_thumbnail_mime` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stupnjevi_id_obred` (`id_obred`),
  CONSTRAINT `fk_stupnjevi_obredi_id_obred` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
