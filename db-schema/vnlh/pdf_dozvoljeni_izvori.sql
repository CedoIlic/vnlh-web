CREATE TABLE `pdf_dozvoljeni_izvori` (
  `id`           int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ izvora',
  `naziv`        varchar(100) NOT NULL COMMENT 'Opis izvora za admina, npr. "Logo lože", "Ime lože"',
  `tablica`      varchar(64) NOT NULL COMMENT 'Naziv tablice iz koje se čita podatak',
  `kolona`       varchar(64) NOT NULL COMMENT 'Naziv kolone iz koje se čita podatak',
  `tip_podatka`  enum('tekst','slika') NOT NULL COMMENT 'Vrsta podatka: tekst ili slika (BLOB+MIME)',
  `napomena`     varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
