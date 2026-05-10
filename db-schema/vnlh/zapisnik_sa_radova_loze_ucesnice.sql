-- Učesničke lože po jednom zapisu zapisnika s radova.
CREATE TABLE `zapisnik_sa_radova_loze_ucesnice` (
  `id_zapisnika` int(11) unsigned NOT NULL COMMENT 'Zapisnik (veza na zapisnik_sa_radova.id).',
  `id_loza` int(11) unsigned NOT NULL COMMENT 'Loža učesnica (veza na loze.id).',
  PRIMARY KEY (`id_zapisnika`, `id_loza`),
  KEY `fk_zsrlu_loza` (`id_loza`),
  CONSTRAINT `fk_zsrlu_rad` FOREIGN KEY (`id_zapisnika`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrlu_loza` FOREIGN KEY (`id_loza`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
