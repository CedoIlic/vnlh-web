CREATE TABLE `pdf_dokument_stavke` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ stavke',
  `dokument_id`      int(11) unsigned NOT NULL COMMENT 'FK na pdf_dokument',
  `redoslijed`       int(11) NOT NULL DEFAULT 0 COMMENT 'Poredak iscrtavanja unutar dokumenta',
  `zona`             enum('tijelo','zaglavlje','podnozje','naslovna') NOT NULL DEFAULT 'tijelo' COMMENT 'Zona stranice u koju se stavka crta',
  `vrsta`            enum('tekst','slika') NOT NULL COMMENT 'Vrsta stavke: tekst ili slika',
  `izvor_id`         int(11) unsigned NOT NULL COMMENT 'FK na pdf_dozvoljeni_izvori',
  `izvor_tip`        enum('staticki','dinamicki') NOT NULL COMMENT 'staticki=fiksni red; dinamicki=id iz konteksta',
  `izvor_red_id`     int(11) unsigned DEFAULT NULL COMMENT 'Fiksni id retka u izvoru (staticki)',
  `kontekst_kljuc`   varchar(64) DEFAULT NULL COMMENT 'Ključ konteksta za id pri generiranju (dinamicki)',
  `paragraf_id`      int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_paragraf (kad vrsta=tekst)',
  `slika_stil_id`    int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_slika_stil (kad vrsta=slika)',
  `napomena`         varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`),
  KEY `idx_dokument_redoslijed` (`dokument_id`, `redoslijed`),
  KEY `fk_stavka_izvor` (`izvor_id`),
  KEY `fk_stavka_paragraf` (`paragraf_id`),
  KEY `fk_stavka_slika_stil` (`slika_stil_id`),
  CONSTRAINT `fk_stavka_dokument`
    FOREIGN KEY (`dokument_id`) REFERENCES `pdf_dokument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_izvor`
    FOREIGN KEY (`izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_paragraf`
    FOREIGN KEY (`paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_slika_stil`
    FOREIGN KEY (`slika_stil_id`) REFERENCES `pdf_slika_stil` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_prikaz_po_vrsti` CHECK (
    (`vrsta` = 'tekst' AND `paragraf_id` IS NOT NULL AND `slika_stil_id` IS NULL) OR
    (`vrsta` = 'slika' AND `slika_stil_id` IS NOT NULL AND `paragraf_id` IS NULL)
  ),
  CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'  AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL) OR
    (`izvor_tip` = 'dinamicki' AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
