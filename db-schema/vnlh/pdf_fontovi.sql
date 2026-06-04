CREATE TABLE `pdf_fontovi` (
  `id`             int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ fonta',
  `naziv`          varchar(50) NOT NULL COMMENT 'Ljudski naziv fonta, npr. "Roboto", "Liberation Serif"',
  `pdfmake_kljuc`  varchar(50) NOT NULL COMMENT 'Točan ključ u pdfMake.fonts; mora se podudarati (npr. "LiberationSerif")',
  `tip`            enum('serif','sans') NOT NULL COMMENT 'Kategorija fonta: serif ili sans-serif',
  `podrzana_pisma` json NOT NULL COMMENT 'Pisma koja font pokriva, npr. ["latin"] ili ["latin","cyrillic"]',
  `aktivan`        tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Je li font dostupan za izbor (1=da, 0=ne)',
  `napomena`       varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
