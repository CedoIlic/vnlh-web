CREATE TABLE `pdf_dokument_stavke` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ stavke',
  `dokument_id`      int(11) unsigned NOT NULL COMMENT 'FK na pdf_dokument',
  `redoslijed`       int(11) NOT NULL DEFAULT 0 COMMENT 'Poredak iscrtavanja unutar dokumenta',
  `zona`             enum('tijelo','zaglavlje','podnozje','naslovna') NOT NULL DEFAULT 'tijelo' COMMENT 'Zona stranice u koju se stavka crta',
  `okvir_id`         int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_template_okvir — kad je postavljen, stavka se renderira u tom vezanom tekst-bloku (prelijevanje punom širinom ispod bloka); NULL = obična zona',
  `vrsta`            enum('tekst','slika','tablica','linije') NOT NULL COMMENT 'Vrsta stavke: tekst, slika, tablica ili linije (linije = prazan prostor za ručno popunjavanje; koristi paragraf_id za visinu reda/boju + stupce linija_*/broj_linija; izvor_tip=linije)',
  `izvor_id`         int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_dozvoljeni_izvori (NULL kad izvor_tip=korisnicki)',
  `izvor_tip`        enum('staticki','dinamicki','po_vrijednosti','korisnicki','relacija_broj','relacija_lista','relacija_redak','relacija_grupe','relacija_csv','tablica_glasanja','linije') NOT NULL COMMENT 'staticki=fiksni red; dinamicki=id iz konteksta; po_vrijednosti=red po vrijednosti kolone; korisnicki=upisani tekst (literal_tekst); relacija_broj=broj redova 1-na-više veze (relacija_id) → mapa; relacija_lista=spojeni nazivi redova 1-na-više veze; relacija_redak=jedan redak po vezi iz predloška (redak_predlozak); relacija_grupe=grupirani popis po tipu (grupa: labela: imena); relacija_csv=jedan odlomak po id-u iz zarez-liste u koloni (link_kolona) bazne tablice (junction_tablica), predložak kao relacija_redak (+ %STUPANJ_BROJ%/%STUPANJ_NAZIV% cap tokeni, \\n=meki prijelom); tablica_glasanja=tablica rezultata glasanja (transponirano glasanje_1/2/3 iz kandidat_dokumenti_001 po kontekstu) — koristi tablica_stil_id; linije=bez dohvata, prazan prostor za ručno popunjavanje (vrsta=linije)',
  `izvor_red_id`     int(11) unsigned DEFAULT NULL COMMENT 'Fiksni id retka u izvoru (staticki)',
  `kontekst_kljuc`   varchar(64) DEFAULT NULL COMMENT 'Ključ konteksta za id pri generiranju (dinamicki)',
  `test_id`          int(11) unsigned DEFAULT NULL COMMENT 'Testni id retka za pregled dinamičkog izvora (preview; kontekst ima prednost)',
  `trazi_kolona`     varchar(64) DEFAULT NULL COMMENT 'Kolona po kojoj se traži red (kad izvor_tip=po_vrijednosti)',
  `trazi_vrijednost` varchar(255) DEFAULT NULL COMMENT 'Vrijednost koja se traži u trazi_kolona (točno podudaranje, ORDER BY id LIMIT 1; kad izvor_tip=po_vrijednosti)',
  `literal_tekst`    varchar(1024) DEFAULT NULL COMMENT 'Upisani tekst segmenta (kad izvor_tip=korisnicki); ^ = razmak',
  `paragraf_id`      int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_paragraf (kad vrsta=tekst)',
  `slika_stil_id`    int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_slika_stil (kad vrsta=slika)',
  `bez_kraja_odlomka` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Spajanje sa sljedećom tekst-stavkom iste zone (stil prve): 0=kraj odlomka; 1=isti red (inline); 2=novi red, isti odlomak (meki prijelom, bez razmaka odlomka)',
  `zadrzi_svoj_stil`  tinyint(1) NOT NULL DEFAULT 0 COMMENT 'U spojenom redu: ovaj segment zadržava VLASTITE znakovne atribute (font, veličina, boja, bold, italic, podcrtano) iz svog paragraf_id umjesto stila prve stavke; odlomački atributi i dalje iz prve. U okviru veličina ostaje početnog dijela (mreža).',
  `naziv_stavke`     varchar(255) DEFAULT NULL COMMENT 'Naziv/naslov stavke (npr. logo, naslov) — interna oznaka administratora',
  `preko_izvor_id`   int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_dozvoljeni_izvori — izvor (tablica.kolona) FK-stupca preko kojeg se dobije id (indirektni ključ, npr. eseji.autor); NULL = direktan dohvat',
  `mapa_vrijednosti` varchar(255) DEFAULT NULL COMMENT 'Mapiranje konačne vrijednosti, format "v:tekst;v:tekst" (npr. 0:Brat;1:Sestra); NULL = bez mapiranja',
  `format_datuma`    varchar(64) DEFAULT NULL COMMENT 'Uzorak formata datuma za izlaz (DD/D dan, MM/M mjesec broj, mmmm mjesec imenom, YYYY/YY godina, dddd dan u tjednu, HH/mm/ss vrijeme); prazno = sirova vrijednost',
  `fiksna_pozicija`  decimal(6,2) DEFAULT NULL COMMENT 'Fiksna početna pozicija sadržaja stavke u mm od lijevog ruba (tab u tijeku); u apsolutnom modu (fiksna_pozicija_y != -1) to je apsolutni X (mm od lijevog ruba stranice); NULL = bez',
  `fiksna_pozicija_y` decimal(6,2) DEFAULT NULL COMMENT 'Apsolutna Y pozicija stavke (mm od gornjeg ruba stranice). -1 ili NULL = u nastavku reda (tok, X ostaje tab); bilo koja druga vrijednost = apsolutno pozicioniranje na (fiksna_pozicija, fiksna_pozicija_y)',
  `sakrij_ako_prazno` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Ako je vrijednost stavke prazna, sakrij cijeli red (vrijedi i za spojene redove); bez placeholdera',
  `prazno_nacin`      enum('placeholder','crtica','izostavi') NOT NULL DEFAULT 'placeholder' COMMENT 'Ponašanje kad je vrijednost prazna: placeholder=sivi XXXXXXXX (dev); crtica="—" u stilu segmenta (obavezni podaci); izostavi=ništa (neobavezni, npr. drugi red adrese — nestaje i prefiks/sufiks)',
  `skupina`           smallint(5) unsigned DEFAULT NULL COMMENT 'Povezane stavke: sve stavke istog broja skupine su cjelina koja NESTAJE zajedno ako su svi PODACI (dinamički) u skupini prazni (npr. labela "Zvanje:" + podatak + separator). NULL = samostalna stavka',
  `prefiks`           varchar(16) DEFAULT NULL COMMENT 'Literal koji se doda ISPRED vrijednosti SAMO kad vrijednost postoji; ^ = razmak; NULL/prazno = bez',
  `sufiks`            varchar(16) DEFAULT NULL COMMENT 'Literal koji se doda IZA vrijednosti SAMO kad vrijednost postoji (npr. ", " iza drugog reda adrese); ^ = razmak; NULL/prazno = bez',
  `prijelom_prije`    tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Prijelom stranice PRIJE ove stavke (pdfmake pageBreak:before); vrijedi samo za tok u zoni tijelo (ne za apsolutne/okvir/zaglavlje/podnožje); prva stavka u lancu inline-spajanja nosi zastavicu za cijeli red',
  `prijelom_poslije`  tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Prijelom stranice POSLIJE ove stavke (pdfmake pageBreak:after); vrijedi samo za tok u zoni tijelo (ne za apsolutne/okvir/zaglavlje/podnožje); zadnja stavka u lancu inline-spajanja nosi zastavicu za cijeli red; zanemaruje se na zadnjoj stavci dokumenta (nema praznog zadnjeg lista)',
  `relacija_id`      int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_dozvoljeni_relacije (kad izvor_tip=relacija_broj/relacija_lista); bazni id dolazi iz konteksta (kontekst_kljuc)',
  `lista_nacin`      enum('zarez','novi_red','novi_odlomak') DEFAULT NULL COMMENT 'Spajanje liste (relacija_lista): zarez=lista_separator; novi_red=meki prijelom istog odlomka; novi_odlomak=svaki u svom odlomku',
  `lista_separator`  varchar(16) DEFAULT NULL COMMENT 'Separator za lista_nacin=zarez; NULL = ", " (^ = razmak)',
  `redak_predlozak`  varchar(512) DEFAULT NULL COMMENT 'Predložak retka (relacija_redak) / predložak imena (relacija_grupe): {j.kol} spojna, {c.kol[|mapa]} cilj, {tab} fiksna pozicija; ^ = razmak',
  `labela_bold`      tinyint(1) NOT NULL DEFAULT 0 COMMENT 'relacija_grupe: labela grupe (naziv tipa) podebljana',
  `podatak_paragraf_id` int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_paragraf — stil PODATKA (vrijednosti iz predloška) kod relacija_csv; literali ostaju u osnovnom (paragraf_id). NULL = cijeli redak u osnovnom stilu',
  `tablica_stil_id`  int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_tablica_stil — stil tablice kad vrsta=tablica',
  `broj_linija`      smallint(5) unsigned DEFAULT NULL COMMENT 'vrsta=linije: fiksan broj linija za popunjavanje (uklj. prvu/inline liniju)',
  `stil_linije`      enum('puno','crtkano','tockasto') DEFAULT NULL COMMENT 'vrsta=linije: izgled linije — puno (kontinuirano), crtkano (crtice), tockasto (točke)',
  `linija_debljina_mm` decimal(4,2) DEFAULT NULL COMMENT 'vrsta=linije: debljina linije u mm',
  `labela_u_istom_redu` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'vrsta=linije: 1=prva linija kreće desno od labele u istom redu; 0=labela (ako postoji) u svom redu, sve linije pune širine',
  `prva_linija_nacin` enum('margina','duzina','fiksni_x') DEFAULT NULL COMMENT 'vrsta=linije: kraj PRVE (inline) linije — margina=do desne margine; duzina=od kraja labele traje prva_linija_mm; fiksni_x=završava na X=prva_linija_mm (mm od lijevog ruba). Vrijedi samo kad labela_u_istom_redu=1',
  `prva_linija_mm`   decimal(6,2) DEFAULT NULL COMMENT 'vrsta=linije: vrijednost u mm za prva_linija_nacin (duzina=dužina, fiksni_x=X pozicija); ignorira se za margina',
  PRIMARY KEY (`id`),
  KEY `idx_dokument_redoslijed` (`dokument_id`, `redoslijed`),
  KEY `fk_stavka_izvor` (`izvor_id`),
  KEY `fk_stavka_preko_izvor` (`preko_izvor_id`),
  KEY `fk_stavka_paragraf` (`paragraf_id`),
  KEY `fk_stavka_slika_stil` (`slika_stil_id`),
  KEY `fk_stavka_relacija` (`relacija_id`),
  KEY `fk_stavka_okvir` (`okvir_id`),
  KEY `fk_stavka_podatak_paragraf` (`podatak_paragraf_id`),
  KEY `fk_stavka_tablica_stil` (`tablica_stil_id`),
  CONSTRAINT `fk_stavka_dokument`
    FOREIGN KEY (`dokument_id`) REFERENCES `pdf_dokument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_okvir`
    FOREIGN KEY (`okvir_id`) REFERENCES `pdf_template_okvir` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_izvor`
    FOREIGN KEY (`izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_preko_izvor`
    FOREIGN KEY (`preko_izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_paragraf`
    FOREIGN KEY (`paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_slika_stil`
    FOREIGN KEY (`slika_stil_id`) REFERENCES `pdf_slika_stil` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_relacija`
    FOREIGN KEY (`relacija_id`) REFERENCES `pdf_dozvoljeni_relacije` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_podatak_paragraf`
    FOREIGN KEY (`podatak_paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_tablica_stil`
    FOREIGN KEY (`tablica_stil_id`) REFERENCES `pdf_tablica_stil` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_prikaz_po_vrsti` CHECK (
    (`vrsta` = 'tekst' AND `paragraf_id` IS NOT NULL AND `slika_stil_id` IS NULL) OR
    (`vrsta` = 'slika' AND `slika_stil_id` IS NOT NULL AND `paragraf_id` IS NULL) OR
    (`vrsta` = 'tablica' AND `tablica_stil_id` IS NOT NULL AND `paragraf_id` IS NULL AND `slika_stil_id` IS NULL) OR
    (`vrsta` = 'linije' AND `paragraf_id` IS NOT NULL AND `slika_stil_id` IS NULL AND `tablica_stil_id` IS NULL)
  ),
  CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'       AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `relacija_id` IS NULL) OR
    (`izvor_tip` = 'dinamicki'      AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `relacija_id` IS NULL) OR
    (`izvor_tip` = 'po_vrijednosti' AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `trazi_kolona` IS NOT NULL AND `trazi_vrijednost` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL AND `relacija_id` IS NULL) OR
    (`izvor_tip` = 'korisnicki'     AND `izvor_id` IS NULL     AND `literal_tekst` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `relacija_id` IS NULL) OR
    (`izvor_tip` = 'relacija_broj'  AND `izvor_id` IS NULL     AND `relacija_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'relacija_lista' AND `izvor_id` IS NULL     AND `relacija_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'relacija_redak' AND `izvor_id` IS NULL     AND `relacija_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `redak_predlozak` IS NOT NULL) OR
    (`izvor_tip` = 'relacija_grupe' AND `izvor_id` IS NULL     AND `relacija_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `redak_predlozak` IS NOT NULL) OR
    (`izvor_tip` = 'relacija_csv'   AND `izvor_id` IS NULL     AND `relacija_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `redak_predlozak` IS NOT NULL) OR
    (`izvor_tip` = 'tablica_glasanja' AND `izvor_id` IS NULL   AND `relacija_id` IS NULL     AND `literal_tekst` IS NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL AND `tablica_stil_id` IS NOT NULL) OR
    (`izvor_tip` = 'linije'         AND `izvor_id` IS NULL     AND `relacija_id` IS NULL     AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
