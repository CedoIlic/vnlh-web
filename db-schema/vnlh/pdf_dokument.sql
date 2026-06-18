CREATE TABLE `pdf_dokument` (
  `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ dokumenta',
  `naziv`       varchar(100) NOT NULL COMMENT 'Prepoznatljiv naziv dokumenta',
  `template_id` int(11) unsigned NOT NULL COMMENT 'FK na pdf_template',
  `opis`        varchar(255) DEFAULT NULL COMMENT 'Opcionalni opis dokumenta',
  `aktivan`     tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Je li dokument dostupan za generiranje',
  `created_at`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Vrijeme kreiranja',
  `napomena`    varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  `broj_stranice_paragraf_id` int(11) unsigned DEFAULT NULL COMMENT 'FK na pdf_paragraf — stil teksta brojača stranica (NULL = zadani font); poravnanje ostaje iz template.broj_stranice_poravnanje',
  PRIMARY KEY (`id`),
  KEY `fk_dokument_template` (`template_id`),
  KEY `fk_dokument_broj_paragraf` (`broj_stranice_paragraf_id`),
  CONSTRAINT `fk_dokument_template` FOREIGN KEY (`template_id`) REFERENCES `pdf_template` (`id`),
  CONSTRAINT `fk_dokument_broj_paragraf` FOREIGN KEY (`broj_stranice_paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
