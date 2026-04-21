-- =========================================================
-- sustav_odgovori_razvoja_boje + sustav_odgovori_razvoja_poruke
-- Paleta (prednja/pozadinska boja s prozirnošću) i poruke razvojnog odgovora.
-- Pokrenuti jednom na bazi (InnoDB, utf8mb4).
-- =========================================================

CREATE TABLE IF NOT EXISTS `sustav_odgovori_razvoja_boje` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `redosljed` tinyint NOT NULL DEFAULT 0 COMMENT 'Redosljed prikaza i primjene podataka (0–255)',
  `fg_boja` varchar(64) NOT NULL DEFAULT '' COMMENT 'Prednja boja (npr. rgba(), #RRGGBBAA)',
  `bg_boja` varchar(64) NOT NULL DEFAULT '' COMMENT 'Pozadinska boja (npr. rgba(), #RRGGBBAA)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Boje za odgovore razvoja (tekst/pozadina, uklj. alfa)';

CREATE TABLE IF NOT EXISTS `sustav_odgovori_razvoja_poruke` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `redosljed` tinyint NOT NULL DEFAULT 0 COMMENT 'Redosljed prikaza i primjene podataka (0–255)',
  `boja` int(11) DEFAULT NULL COMMENT 'FK na sustav_odgovori_razvoja_boje.id; NULL ako nije vezano',
  `kod` tinyint NOT NULL DEFAULT 0,
  `tekst` varchar(250) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_sor_poruke_boja` (`boja`),
  CONSTRAINT `fk_sor_poruke_boja` FOREIGN KEY (`boja`) REFERENCES `sustav_odgovori_razvoja_boje` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Poruke / šifre za odgovore razvoja';
