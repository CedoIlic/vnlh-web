-- Šifarnik dokumenata koji se mogu generirati iz forme Kandidat dokumenti (tab „Ostalo").
-- Redak veže PDF dokument na izvornu tablicu; forma prosljeđuje generatoru tekući id te tablice.
-- Produkcijski parnjak razvojnog konteksta u pdf_dokument (razvoj_tablica/razvoj_kolona/razvoj_izabrani_id):
-- razvojni vrijedi samo za preview dok se dokument slaže, ovdje dokument dobiva konkretan id od pozivača.
CREATE TABLE `kandidat_dokumenti_pred_print` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'PK retka šifarnika',
  `id_dokument`   int(11) unsigned NOT NULL COMMENT 'FK na pdf_dokument — dokument koji se generira',
  `naziv`         varchar(100) DEFAULT NULL COMMENT 'Prikazni naziv u tablici; NULL = koristi pdf_dokument.naziv',
  `izvor_tablica` varchar(64) NOT NULL COMMENT 'Tablica koja daje ključ dokumentu (npr. kandidat_dokumenti_001); vrijednost s popisa pdf_dozvoljeni_izvori_dokumenata — validira app, nikad ne ulazi u upit',
  `izvor_kolona`  varchar(64) NOT NULL DEFAULT 'id' COMMENT 'Ime ključne kolone izvorne tablice (deklaracija ugovora; sam id drži forma u kontekstu)',
  `redosljed`     int(11) NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza (0-100)',
  `aktivan`       tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Prikazuje li se redak u tablici: 0=Ne, 1=Da',
  `napomena`      varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kdpp_dokument_izvor` (`id_dokument`,`izvor_tablica`),
  CONSTRAINT `fk_kdpp_dokument` FOREIGN KEY (`id_dokument`) REFERENCES `pdf_dokument` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
