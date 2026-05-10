CREATE TABLE `sustav_odgovori_razvoja_boje` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `redosljed` tinyint(4) NOT NULL DEFAULT 0 COMMENT 'Redosljed prikaza i primjene podataka (0–255)',
  `fg_boja` varchar(64) NOT NULL DEFAULT '' COMMENT 'Prednja boja (npr. rgba(), #RRGGBBAA)',
  `bg_boja` varchar(64) NOT NULL DEFAULT '' COMMENT 'Pozadinska boja (npr. rgba(), #RRGGBBAA)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Boje za odgovore razvoja (tekst/pozadina, uklj. alfa)';
