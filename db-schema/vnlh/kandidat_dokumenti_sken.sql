CREATE TABLE `kandidat_dokumenti_sken` (
  `id`           int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clan`      int(11) unsigned NOT NULL COMMENT 'Kandidat (clanovi.id)',
  `id_sken_tip`  int(11) unsigned NOT NULL COMMENT 'Tip skeniranog dokumenta (kandidat_dokumenti_sken_tip.id)',
  `biljeska`     varchar(256) DEFAULT NULL COMMENT 'Bilješka administratora',
  `podatak_mime` varchar(32) DEFAULT NULL COMMENT 'MIME spremljenog dokumenta (application/pdf)',
  `dokument`     longblob DEFAULT NULL COMMENT 'Sadržaj skena (PDF)',
  `datum_upisa`  datetime DEFAULT NULL COMMENT 'Vrijeme upisa (server)',
  `upisao`       int(11) unsigned DEFAULT NULL COMMENT 'Tko je upisao (clanovi.id)',
  PRIMARY KEY (`id`),
  KEY `fk_kds_clan` (`id_clan`),
  KEY `fk_kds_tip` (`id_sken_tip`),
  KEY `fk_kds_upisao` (`upisao`),
  CONSTRAINT `fk_kds_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kds_tip` FOREIGN KEY (`id_sken_tip`) REFERENCES `kandidat_dokumenti_sken_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kds_upisao` FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
