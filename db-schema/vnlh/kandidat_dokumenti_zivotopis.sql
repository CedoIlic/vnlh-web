-- Životopis kandidata; jedan zapis po članu (1:1), tekst životopisa.
CREATE TABLE `kandidat_dokumenti_zivotopis` (
  `id`        int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clan`   int(11) unsigned NOT NULL COMMENT 'ID člana (veza na clanovi.id); jedinstven (1 životopis po članu)',
  `zivotopis` text DEFAULT NULL COMMENT 'Tekst životopisa kandidata',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kdz_clan` (`id_clan`),
  CONSTRAINT `fk_kdz_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
