CREATE TABLE `pdf_template_okvir` (
  `id`           int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ okvira',
  `template_id`  int(11) unsigned NOT NULL COMMENT 'FK na pdf_template',
  `redoslijed`   int(11) NOT NULL DEFAULT 0 COMMENT 'Poredak u lancu prelijevanja teksta (1→2→3…); okviri vrijede SAMO na 1. stranici',
  `naziv`        varchar(50) DEFAULT NULL COMMENT 'Oznaka okvira (npr. „pored slike", „ispod") — interna oznaka administratora',
  `x_mm`         decimal(6,2) NOT NULL COMMENT 'Apsolutni X gornjeg-lijevog kuta okvira u mm (od lijevog ruba stranice)',
  `y_mm`         decimal(6,2) NOT NULL COMMENT 'Apsolutni Y gornjeg-lijevog kuta okvira u mm (od gornjeg ruba stranice)',
  `sirina_mm`    decimal(6,2) NOT NULL COMMENT 'Širina okvira u mm',
  `visina_mm`    decimal(6,2) NOT NULL COMMENT 'Visina okvira u mm',
  `y_meka`       tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Mekani gornji rub okvira (snap prvog retka na baseline mrežu prethodnog okvira); 0=tvrd vrh na zadanoj poziciji',
  PRIMARY KEY (`id`),
  KEY `idx_okvir_template_redoslijed` (`template_id`, `redoslijed`),
  CONSTRAINT `fk_okvir_template`
    FOREIGN KEY (`template_id`) REFERENCES `pdf_template` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
