-- Životopis kandidata; jedan zapis po članu (1:1), tekst životopisa.
CREATE TABLE `kandidat_dokumenti_zivotopis` (
  `id`        int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_clan`   int(11) unsigned NOT NULL COMMENT 'ID člana (veza na clanovi.id); jedinstven (1 životopis po članu)',
  `id_loza`   int(11) unsigned DEFAULT NULL COMMENT 'ID lože kandidata (denormalizirano iz clanovi.loza) — most za PDF (logo/ime lože) u jednom skoku',
  `zivotopis` text DEFAULT NULL COMMENT 'Tekst životopisa kandidata',
  `dokument_prored` decimal(3,2) DEFAULT NULL COMMENT 'Extra prored u tijelu teksta (rješavanje lošeg završetka dokumenta).',
  `upisao` int(11) unsigned DEFAULT NULL COMMENT 'ID onoga ko je inicijalno upisao životopis',
  `vrijeme_upisa` datetime DEFAULT NULL COMMENT 'Vrijeme sa servera kada je životopis upisan',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kdz_clan` (`id_clan`),
  KEY `fk_kdz_upisao` (`upisao`),
  KEY `fk_kdz_loza` (`id_loza`),
  CONSTRAINT `fk_kdz_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_kdz_upisao` FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_kdz_loza` FOREIGN KEY (`id_loza`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
