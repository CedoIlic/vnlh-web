CREATE TABLE `pdf_dozvoljeni_izvori_dokumenata` (
  `id`       int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ zapisa',
  `tablica`  varchar(64) NOT NULL COMMENT 'Naziv tablice dozvoljene kao izvor (subjekt) dokumenta u razvojnom bloku PDF_Dokument',
  `napomena` varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pdizd_tablica` (`tablica`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
