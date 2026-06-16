-- sustav_slike_tekstovi: sustavske slike i tekstovi (npr. logo, fiksni tekstualni/PDF blokovi).
-- naziv jedinstven (NOT NULL); tip_podatka kategorizira sadrzaj; podatak (longblob) drzi bajtove
-- slike/teksta/PDF bloka; mime za slike/PDF.
CREATE TABLE `sustav_slike_tekstovi` (
  `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ',
  `naziv`       varchar(150) NOT NULL COMMENT 'Naziv stavke (jedinstven; npr. "Logo VNLH")',
  `tip_podatka` enum('Slika JPG','Slika PNG','Slika WEBP','Tekst','PDF blok') NOT NULL COMMENT 'Vrsta sadržaja',
  `mime`        varchar(32) DEFAULT NULL COMMENT 'MIME tip (za slike/PDF)',
  `podatak`     longblob DEFAULT NULL COMMENT 'Sadržaj: bajtovi slike / teksta / PDF bloka',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_naziv` (`naziv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
