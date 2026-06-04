CREATE TABLE `pdf_slika_stil` (
  `id`                 int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ stila slike',
  `naziv`              varchar(50) NOT NULL COMMENT 'Naziv stila, npr. "Logo 3x3"',
  `sirina_mm`          decimal(6,2) NOT NULL COMMENT 'Širina okvira slike u mm',
  `visina_mm`          decimal(6,2) NOT NULL COMMENT 'Visina okvira slike u mm',
  `skaliranje`         enum('uklopi','razvuci') NOT NULL DEFAULT 'uklopi' COMMENT 'uklopi=čuva proporcije; razvuci=popuni okvir',
  `okvir`              tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Ima li slika okvir',
  `okvir_boja`         varchar(7) DEFAULT NULL COMMENT 'Hex boja okvira',
  `okvir_debljina_mm`  decimal(4,2) DEFAULT NULL COMMENT 'Debljina okvira u mm',
  `prozirnost`         tinyint unsigned NOT NULL DEFAULT 100 COMMENT 'Prozirnost slike 0-100%',
  `pozicioniranje`     enum('u_tijeku','usidreno','apsolutno') NOT NULL DEFAULT 'u_tijeku' COMMENT 'Način pozicioniranja slike',
  `poravnanje_h`       enum('lijevo','centar','desno') DEFAULT NULL COMMENT 'Horizontalno poravnanje (u_tijeku/usidreno)',
  `poravnanje_v`       enum('gore','centar','dolje') DEFAULT NULL COMMENT 'Vertikalno poravnanje (usidreno)',
  `pozicija_x_mm`      decimal(6,2) DEFAULT NULL COMMENT 'X koordinata u mm (apsolutno)',
  `pozicija_y_mm`      decimal(6,2) DEFAULT NULL COMMENT 'Y koordinata u mm (apsolutno)',
  `potiskuje`          tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=gura sadržaj; 0=lebdi',
  `napomena`           varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
