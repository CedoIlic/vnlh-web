-- Stupci stila tablice: izgled stupca (širina/poravnanje/padding/prefix/sufiks) + tekst zaglavlja.
-- Vrijednost ćelije dolazi POZICIJSKI iz delimitiranog reda stavke (redoslijed = poredak stupaca).
CREATE TABLE `pdf_tablica_stil_kolona` (
  `id`                    int(11) unsigned NOT NULL AUTO_INCREMENT,
  `tablica_stil_id`       int(11) unsigned NOT NULL COMMENT 'FK pdf_tablica_stil (stil kojem stupac pripada)',
  `redoslijed`            int(11) NOT NULL DEFAULT 0 COMMENT 'Poredak stupca (lijevo→desno); pozicijsko punjenje iz delimitiranog reda',
  `naziv`                 varchar(50) DEFAULT NULL COMMENT 'Interna oznaka stupca (administrator)',
  `zaglavlje`             varchar(100) DEFAULT NULL COMMENT 'Tekst u redu zaglavlja',
  `sirina_tip`            enum('fiksna','popuni') NOT NULL DEFAULT 'popuni' COMMENT 'Fiksna (sirina_mm) / popuni (pdfmake *)',
  `sirina_mm`             decimal(6,2) DEFAULT NULL COMMENT 'Širina kad sirina_tip=fiksna (mm)',
  `zag_orijentacija`      enum('lijevo','centar','desno') NOT NULL DEFAULT 'lijevo' COMMENT 'Poravnanje ćelije zaglavlja',
  `zag_padding_lijevo_mm` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding zaglavlja — lijevo',
  `zag_padding_desno_mm`  decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding zaglavlja — desno',
  `zag_prefix`            varchar(50) DEFAULT NULL COMMENT 'Tekst ispred zaglavlja',
  `zag_sufiks`            varchar(50) DEFAULT NULL COMMENT 'Tekst iza zaglavlja',
  `pod_orijentacija`      enum('lijevo','centar','desno') NOT NULL DEFAULT 'lijevo' COMMENT 'Poravnanje ćelije podataka',
  `pod_padding_lijevo_mm` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding podataka — lijevo',
  `pod_padding_desno_mm`  decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding podataka — desno',
  `pod_prefix`            varchar(50) DEFAULT NULL COMMENT 'Tekst ispred vrijednosti',
  `pod_sufiks`            varchar(50) DEFAULT NULL COMMENT 'Tekst iza vrijednosti',
  PRIMARY KEY (`id`),
  KEY `fk_tablica_kolona_stil` (`tablica_stil_id`),
  KEY `idx_tablica_kolona_red` (`tablica_stil_id`, `redoslijed`),
  CONSTRAINT `fk_tablica_kolona_stil` FOREIGN KEY (`tablica_stil_id`) REFERENCES `pdf_tablica_stil` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
