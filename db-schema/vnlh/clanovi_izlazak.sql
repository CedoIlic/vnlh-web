CREATE TABLE `clanovi_izlazak` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ključ sloga',
  `id_clan` int(11) unsigned NOT NULL COMMENT 'Id člana koji mijenja ili napušta ložu - obedijenciju',
  `id_loza_odlaska` int(11) unsigned NOT NULL COMMENT 'Id Lože koju član napušta',
  `id_loza_dolaska` int(11) unsigned DEFAULT NULL COMMENT 'Id lože u koju član dolazi',
  `id_izlazak_tip` int(11) unsigned NOT NULL COMMENT 'Id tipova napuštanja lože',
  `datum_ulaska` date DEFAULT NULL COMMENT 'Datum kada je član ušao u ložu koju je napustio',
  `datum_izlaska` date NOT NULL COMMENT 'Datum kada je član napustio matičnu ložu',
  `napomena` varchar(1024) NOT NULL DEFAULT '' COMMENT 'Napomena uz izlazak/prelazak člana',
  PRIMARY KEY (`id`),
  KEY `ix_clanovi_izlazak_clan` (`id_clan`),
  KEY `ix_clanovi_izlazak_loza_odlaska` (`id_loza_odlaska`),
  KEY `ix_clanovi_izlazak_loza_dolaska` (`id_loza_dolaska`),
  KEY `ix_clanovi_izlazak_tip` (`id_izlazak_tip`),
  CONSTRAINT `fk_clanovi_izlazak_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_izlazak_loza_odlaska` FOREIGN KEY (`id_loza_odlaska`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_izlazak_loza_dolaska` FOREIGN KEY (`id_loza_dolaska`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_izlazak_tip` FOREIGN KEY (`id_izlazak_tip`) REFERENCES `clanovi_izlazak_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
