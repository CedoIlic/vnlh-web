CREATE TABLE `pdf_dozvoljeni_izvori_dokumenata_kolone` (
  `id`       int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ zapisa',
  `id_izvor` int(11) unsigned NOT NULL COMMENT 'FK na pdf_dozvoljeni_izvori_dokumenata.id (tablica izvora)',
  `kolona`   varchar(64) NOT NULL COMMENT 'Naziv kolone te tablice dozvoljene za pretragu/prikaz u razvojnom bloku PDF_Dokument',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pdizdk_izvor_kolona` (`id_izvor`, `kolona`),
  CONSTRAINT `fk_pdizdk_izvor` FOREIGN KEY (`id_izvor`) REFERENCES `pdf_dozvoljeni_izvori_dokumenata` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
