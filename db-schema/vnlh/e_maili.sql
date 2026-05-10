CREATE TABLE `e_maili` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clanovi` int(11) unsigned DEFAULT NULL,
  `id_email_tip` int(11) unsigned DEFAULT NULL,
  `email` varchar(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `ix_emaili_id_clanovi` (`id_clanovi`),
  KEY `ix_emaili_id_email_tip` (`id_email_tip`),
  CONSTRAINT `fk_emaili_clanovi` FOREIGN KEY (`id_clanovi`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emaili_email_tip` FOREIGN KEY (`id_email_tip`) REFERENCES `email_tip` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
