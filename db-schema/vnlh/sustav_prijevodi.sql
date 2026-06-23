CREATE TABLE `sustav_prijevodi` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Interni id.',
  `id_kljuc` int(11) unsigned NOT NULL COMMENT 'FK na sustav_prijevodi_kljucevi.',
  `id_jezik` int(11) unsigned NOT NULL COMMENT 'FK na sustav_jezici.',
  `tekst` varchar(1000) NOT NULL COMMENT 'Prijevod ključa na taj jezik.',
  `izvor` enum('rucno','ai') NOT NULL DEFAULT 'rucno' COMMENT 'rucno = ljudski; ai = strojni (treba reviziju). Zadani (master) jezik se NE sprema ovdje — uzima se izvorni_tekst ključa.',
  `izvor_hash` char(32) DEFAULT NULL COMMENT 'MD5 izvornog (master/hr) teksta PROTIV KOJEG je ovaj prijevod napravljen. Ako != kljuc.izvorni_hash → izvor se promijenio → prijevod zastario. Pri (re)prijevodu se postavi na trenutni kljuc.izvorni_hash.',
  `prijevod_test` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = TEST/draft prijevod gotov (za test sučelja). Vidljiv samo u razvoju (VNLH_RAZVOJ=1).',
  `prijevod` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = PRODUKCIJSKI (kvalitetan) prijevod gotov. Vidljiv u produkciji.',
  `zastarjelo` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = "potreban prijevod": izvor_hash != kljuc.izvorni_hash (izvor se promijenio nakon ovog prijevoda). Postavlja rutina skeniranja.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sustav_prijevodi_kljuc_jezik` (`id_kljuc`,`id_jezik`),
  KEY `ix_sp_id_jezik` (`id_jezik`),
  CONSTRAINT `fk_sp_kljuc` FOREIGN KEY (`id_kljuc`) REFERENCES `sustav_prijevodi_kljucevi` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sp_jezik` FOREIGN KEY (`id_jezik`) REFERENCES `sustav_jezici` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
