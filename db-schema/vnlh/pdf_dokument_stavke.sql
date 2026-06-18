CREATE TABLE `pdf_dokument_stavke` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ stavke',
  `dokument_id`      int(11) unsigned NOT NULL COMMENT 'FK na pdf_dokument',
  `redoslijed`       int(11) NOT NULL DEFAULT 0 COMMENT 'Poredak iscrtavanja unutar dokumenta',
  `zona`             enum('tijelo','zaglavlje','podnozje','naslovna') NOT NULL DEFAULT 'tijelo' COMMENT 'Zona stranice u koju se stavka crta',
  `vrsta`            enum('tekst','slika') NOT NULL COMMENT 'Vrsta stavke: tekst ili slika',
  `izvor_id`         int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_dozvoljeni_izvori (NULL kad izvor_tip=korisnicki)',
  `izvor_tip`        enum('staticki','dinamicki','po_vrijednosti','korisnicki') NOT NULL COMMENT 'staticki=fiksni red; dinamicki=id iz konteksta; po_vrijednosti=red po vrijednosti kolone; korisnicki=upisani tekst (literal_tekst)',
  `izvor_red_id`     int(11) unsigned DEFAULT NULL COMMENT 'Fiksni id retka u izvoru (staticki)',
  `kontekst_kljuc`   varchar(64) DEFAULT NULL COMMENT 'Ključ konteksta za id pri generiranju (dinamicki)',
  `test_id`          int(11) unsigned DEFAULT NULL COMMENT 'Testni id retka za pregled dinamičkog izvora (preview; kontekst ima prednost)',
  `trazi_kolona`     varchar(64) DEFAULT NULL COMMENT 'Kolona po kojoj se traži red (kad izvor_tip=po_vrijednosti)',
  `trazi_vrijednost` varchar(255) DEFAULT NULL COMMENT 'Vrijednost koja se traži u trazi_kolona (točno podudaranje, ORDER BY id LIMIT 1; kad izvor_tip=po_vrijednosti)',
  `literal_tekst`    varchar(1024) DEFAULT NULL COMMENT 'Upisani tekst segmenta (kad izvor_tip=korisnicki); ^ = razmak',
  `paragraf_id`      int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_paragraf (kad vrsta=tekst)',
  `slika_stil_id`    int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_slika_stil (kad vrsta=slika)',
  `bez_kraja_odlomka` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Spajanje sa sljedećom tekst-stavkom iste zone (stil prve): 0=kraj odlomka; 1=isti red (inline); 2=novi red, isti odlomak (meki prijelom, bez razmaka odlomka)',
  `naziv_stavke`     varchar(255) DEFAULT NULL COMMENT 'Naziv/naslov stavke (npr. logo, naslov) — interna oznaka administratora',
  `preko_izvor_id`   int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_dozvoljeni_izvori — izvor (tablica.kolona) FK-stupca preko kojeg se dobije id (indirektni ključ, npr. eseji.autor); NULL = direktan dohvat',
  `mapa_vrijednosti` varchar(255) DEFAULT NULL COMMENT 'Mapiranje konačne vrijednosti, format "v:tekst;v:tekst" (npr. 0:Brat;1:Sestra); NULL = bez mapiranja',
  PRIMARY KEY (`id`),
  KEY `idx_dokument_redoslijed` (`dokument_id`, `redoslijed`),
  KEY `fk_stavka_izvor` (`izvor_id`),
  KEY `fk_stavka_preko_izvor` (`preko_izvor_id`),
  KEY `fk_stavka_paragraf` (`paragraf_id`),
  KEY `fk_stavka_slika_stil` (`slika_stil_id`),
  CONSTRAINT `fk_stavka_dokument`
    FOREIGN KEY (`dokument_id`) REFERENCES `pdf_dokument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_izvor`
    FOREIGN KEY (`izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_preko_izvor`
    FOREIGN KEY (`preko_izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_paragraf`
    FOREIGN KEY (`paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_slika_stil`
    FOREIGN KEY (`slika_stil_id`) REFERENCES `pdf_slika_stil` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_prikaz_po_vrsti` CHECK (
    (`vrsta` = 'tekst' AND `paragraf_id` IS NOT NULL AND `slika_stil_id` IS NULL) OR
    (`vrsta` = 'slika' AND `slika_stil_id` IS NOT NULL AND `paragraf_id` IS NULL)
  ),
  CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'       AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'dinamicki'      AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'po_vrijednosti' AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `trazi_kolona` IS NOT NULL AND `trazi_vrijednost` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL) OR
    (`izvor_tip` = 'korisnicki'     AND `izvor_id` IS NULL     AND `literal_tekst` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
