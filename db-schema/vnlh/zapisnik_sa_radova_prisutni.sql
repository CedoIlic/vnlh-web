-- Retci prisutnosti vezani na zapis zapisnika.
-- Naziv stupca id_prisustvo_tip istorijski/kratak; funkcijska veza je na radovi_prisustvo_tip (isti model kao kod Zapisnik CRUD tipova prisustva).
CREATE TABLE `zapisnik_sa_radova_prisutni` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_zapisnika` int(11) unsigned NOT NULL COMMENT 'Zapisnik (veza na zapisnik_sa_radova.id).',
  `id_clana` int(11) unsigned DEFAULT NULL COMMENT 'Član ako pripada obedijenciji; NULL ako osoba dolazi izvan obedijencije.',
  `id_prisustvo_tip` int(11) unsigned NOT NULL COMMENT 'Tip zapisa/prisustva (veza na radovi_prisustvo_tip.id).',
  `ime_i_prezime` varchar(250) DEFAULT NULL COMMENT 'Ime i prezime ako dolazi izvan obedijencije ili za prikaz slobodnog unosa.',
  `loza` varchar(250) DEFAULT NULL COMMENT 'Naziv lože ako dolazi izvan obedijencije (tekstualno).',
  `id_drzave` int(11) unsigned DEFAULT NULL COMMENT 'Država gosta ako postoji (veza na radovi_drzave_gostiju.id).',
  PRIMARY KEY (`id`),
  KEY `fk_zsrp_zapisnik` (`id_zapisnika`),
  KEY `fk_zsrp_clan` (`id_clana`),
  KEY `fk_zsrp_tip` (`id_prisustvo_tip`),
  KEY `fk_zsrp_drzava` (`id_drzave`),
  CONSTRAINT `fk_zsrp_clanovi` FOREIGN KEY (`id_clana`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_drzava_radovi` FOREIGN KEY (`id_drzave`) REFERENCES `radovi_drzave_gostiju` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_radovi_prisustvo_tip` FOREIGN KEY (`id_prisustvo_tip`) REFERENCES `radovi_prisustvo_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_zapisnik` FOREIGN KEY (`id_zapisnika`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
