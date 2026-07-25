-- Dodatni podaci kandidata koji nedostaju za popunjavanje PDF obrazaca + napomena; jedan zapis po članu (1:1).
-- Tab „Ostalo" u formi Kandidat dokumenti; kolone se dodaju kako se ukaže potreba pojedinog obrasca.
CREATE TABLE `kandidat_dokumenti_ostalo` (
  `id`       int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK zapisa',
  `id_clan`  int(11) unsigned NOT NULL COMMENT 'ID člana (veza na clanovi.id); jedinstven (1 zapis po članu)',
  `planirani_datum_inicijacije` date DEFAULT NULL COMMENT 'Podaci za oporuku i prisegu: planirani datum inicijacije kandidata',
  `ispis_imena_kandidata` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Ispis imena kandidata na obrascima: 0=Ne, 1=Da',
  `napomena` varchar(1024) DEFAULT NULL COMMENT 'Slobodna napomena uz kandidata',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kdost_clan` (`id_clan`),
  CONSTRAINT `fk_kdost_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
