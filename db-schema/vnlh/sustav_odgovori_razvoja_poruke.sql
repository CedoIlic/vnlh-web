CREATE TABLE `sustav_odgovori_razvoja_poruke` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `redosljed` tinyint(4) NOT NULL DEFAULT 0 COMMENT 'Redosljed prikaza i primjene podataka (0–255)',
  `boja` int(11) DEFAULT NULL COMMENT 'FK na Sustav_Odgovori_Razvoja_Boje.id; NULL ako nije vezano',
  `kod` tinyint(4) NOT NULL DEFAULT 0,
  `tekst` varchar(250) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_sor_poruke_boja` (`boja`),
  CONSTRAINT `fk_sor_poruke_boja` FOREIGN KEY (`boja`) REFERENCES `sustav_odgovori_razvoja_boje` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Poruke / šifre za odgovore razvoja';
