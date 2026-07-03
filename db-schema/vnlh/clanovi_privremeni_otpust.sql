CREATE TABLE `clanovi_privremeni_otpust` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ključ sloga',
  `id_clan` int(11) unsigned NOT NULL COMMENT 'Id člana na privremenom otpustu',
  `datum_od` date NOT NULL COMMENT 'Datum početka privremenog otpusta',
  `datum_do` date NOT NULL COMMENT 'Datum kraja privremenog otpusta',
  `napomena` varchar(1024) NOT NULL DEFAULT '' COMMENT 'Razlog i napomena uz privremeni otpust',
  `prvi_upis` datetime DEFAULT NULL COMMENT 'Datum i vrijeme prvog upisa sloga',
  `id_prvog_upisa` int(11) unsigned DEFAULT NULL COMMENT 'Id člana koji je prvi upisao slog',
  `zadnja_izmjena` datetime DEFAULT NULL COMMENT 'Datum i vrijeme zadnje izmjene sloga',
  `id_zadnje_izmjene` int(11) unsigned DEFAULT NULL COMMENT 'Id člana koji je zadnji izmijenio slog',
  PRIMARY KEY (`id`),
  KEY `ix_clanovi_privremeni_otpust_clan` (`id_clan`),
  KEY `ix_clanovi_privremeni_otpust_prvi_upis` (`id_prvog_upisa`),
  KEY `ix_clanovi_privremeni_otpust_zadnja_izmjena` (`id_zadnje_izmjene`),
  CONSTRAINT `fk_clanovi_privremeni_otpust_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_privremeni_otpust_prvi_upis` FOREIGN KEY (`id_prvog_upisa`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_privremeni_otpust_zadnja_izmjena` FOREIGN KEY (`id_zadnje_izmjene`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Povijest privremenih otpusta članova';
