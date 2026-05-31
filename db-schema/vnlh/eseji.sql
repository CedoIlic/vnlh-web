-- Eseji članova; loža kojoj esej pripada, autor, stupanj i tekst.
CREATE TABLE `eseji` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `loza` int(11) unsigned NOT NULL COMMENT 'ID lože kojoj pripada esej',
  `autor` int(11) unsigned NOT NULL COMMENT 'ID autora eseja',
  `stupanj` int(11) unsigned NOT NULL COMMENT 'Stupanj kojem je esej namjenjen',
  `kljucne_rijeci` text DEFAULT NULL COMMENT 'Izbor ključnih riječi iz sadržaja eseja',
  `esej` text DEFAULT NULL COMMENT 'Tekst eseja',
  `javno_dostupan` smallint(6) NOT NULL DEFAULT 0 COMMENT '0 ako esej pripada isključivo loži, 1 ako je dostupan svim ložama',
  `upisao` int(11) unsigned DEFAULT NULL COMMENT 'ID onoga ko je inicijalno upisao esej',
  `vrijeme_upisa` datetime DEFAULT NULL COMMENT 'Vrijeme sa servera kada je esej upisan',
  PRIMARY KEY (`id`),
  KEY `fk_es_loza` (`loza`),
  KEY `fk_es_autor` (`autor`),
  KEY `fk_es_stupanj` (`stupanj`),
  KEY `fk_es_upisao` (`upisao`),
  FULLTEXT KEY `ft_eseji_kljucne_rijeci` (`kljucne_rijeci`),
  CONSTRAINT `fk_es_loza` FOREIGN KEY (`loza`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_es_autor` FOREIGN KEY (`autor`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_es_stupanj` FOREIGN KEY (`stupanj`) REFERENCES `stupnjevi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_es_upisao` FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
