CREATE TABLE `pdf_dozvoljeni_relacije` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ relacije',
  `naziv`            varchar(128) NOT NULL COMMENT 'Opis relacije za admina, npr. "Zapisnik → lože učesnice"',
  `junction_tablica` varchar(64) NOT NULL COMMENT 'Spojna (1-na-više) tablica, npr. zapisnik_sa_radova_loze_ucesnice',
  `fk_baza_kolona`   varchar(64) NOT NULL COMMENT 'Kolona spojne tablice koja veže na bazni id iz konteksta (npr. id_zapisnika)',
  `link_kolona`      varchar(64) NOT NULL COMMENT 'Kolona spojne tablice koja veže na ciljni red (npr. id_loza)',
  `ciljni_izvor_id`  int(11) unsigned NOT NULL COMMENT 'FK na pdf_dozvoljeni_izvori — izvor (tablica.kolona) iz kojeg se čita naziv cilja po id = link_kolona (kod relacija_redak služi i kao anchor ciljne tablice)',
  `sort_kolona`      varchar(64) DEFAULT NULL COMMENT 'Kolona spojne tablice za ORDER BY (relacija_redak); NULL = redoslijed po vezi',
  `suffix_fk_kolona`     varchar(64) DEFAULT NULL COMMENT 'Uvjetni sufiks (relacija_redak): FK kolona CILJA koja se uspoređuje (npr. clanovi.loza); NULL = bez sufiksa',
  `suffix_izvor_id`      int(11) unsigned DEFAULT NULL COMMENT 'Logički FK na pdf_dozvoljeni_izvori — tablica.kolona naziva sufiksa (npr. loze.naziv), slijedi se po suffix_fk_kolona',
  `suffix_bazni_izvor_id` int(11) unsigned DEFAULT NULL COMMENT 'Logički FK na pdf_dozvoljeni_izvori — bazna tablica.kolona za usporedbu (npr. zapisnik_sa_radova.id_domacin), čita se po baznom id',
  `suffix_format`        varchar(64) DEFAULT NULL COMMENT 'Format sufiksa, {v}=naziv; NULL = ", {v}" (^ = razmak). Dodaje se samo kad suffix_fk_kolona != bazna vrijednost',
  `grupa_tablica`        varchar(64) DEFAULT NULL COMMENT 'Tablica tipova/grupa (relacija_grupe), npr. radovi_prisustvo_tip; NULL = bez grupiranja',
  `grupa_label_kolona`   varchar(64) DEFAULT NULL COMMENT 'Kolona labele grupe (npr. naziv) iz grupa_tablica',
  `grupa_sort_kolona`    varchar(64) DEFAULT NULL COMMENT 'Kolona za poredak grupa (npr. redosljed); NULL = po id grupe',
  `diskriminator_kolona` varchar(64) DEFAULT NULL COMMENT 'Kolona spojne tablice koja veže redak na grupu (grupa.id), npr. id_prisustvo_tip',
  `fallback_kolona`      varchar(64) DEFAULT NULL COMMENT 'Kolona spojne tablice s gotovim nazivom kad cilj (clanovi) nije popunjen, npr. ime_i_prezime',
  `fallback_predlozak`   varchar(512) DEFAULT NULL COMMENT 'Predložak imena za fallback (gost) kad cilj nije popunjen: {j.kol} / {j.kol->tbl.kol2} (FK-skok); ima prednost pred fallback_kolona',
  `napomena`         varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`),
  KEY `fk_relacija_ciljni_izvor` (`ciljni_izvor_id`),
  CONSTRAINT `fk_relacija_ciljni_izvor`
    FOREIGN KEY (`ciljni_izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
