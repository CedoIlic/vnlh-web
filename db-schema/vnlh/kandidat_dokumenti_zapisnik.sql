CREATE TABLE `kandidat_dokumenti_zapisnik` (
  `id`              int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clan`         int(11) unsigned NOT NULL COMMENT 'Kandidat (clanovi.id)',
  `id_zapisnik_tip` int(11) unsigned NOT NULL COMMENT 'Tip zapisnika (kandidat_dokumenti_zapisnik_tip.id)',
  `id_zapisnik`     int(11) unsigned NOT NULL COMMENT 'Vezani zapisnik s radova (zapisnik_sa_radova.id)',
  `biljeska`        varchar(256) DEFAULT NULL COMMENT 'Bilješka administratora',
  `datum_upisa`     datetime DEFAULT NULL COMMENT 'Vrijeme upisa (server)',
  `upisao`          int(11) unsigned DEFAULT NULL COMMENT 'Tko je upisao (clanovi.id)',
  PRIMARY KEY (`id`),
  KEY `fk_kdzap_clan` (`id_clan`),
  KEY `fk_kdzap_tip` (`id_zapisnik_tip`),
  KEY `fk_kdzap_zapisnik` (`id_zapisnik`),
  KEY `fk_kdzap_upisao` (`upisao`),
  CONSTRAINT `fk_kdzap_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kdzap_tip` FOREIGN KEY (`id_zapisnik_tip`) REFERENCES `kandidat_dokumenti_zapisnik_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kdzap_zapisnik` FOREIGN KEY (`id_zapisnik`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kdzap_upisao` FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
