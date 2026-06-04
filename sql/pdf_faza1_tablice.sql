-- PDF Generator: Faza 1 - kreiranje svih tablica (redoslijed po FK ovisnostima)
-- Primijeni na: lokalna baza vnlh

-- 1. pdf_fontovi
CREATE TABLE IF NOT EXISTS `pdf_fontovi` (
  `id`             int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ fonta',
  `naziv`          varchar(50) NOT NULL COMMENT 'Ljudski naziv fonta, npr. "Roboto", "Liberation Serif"',
  `pdfmake_kljuc`  varchar(50) NOT NULL COMMENT 'Točan ključ u pdfMake.fonts',
  `tip`            enum('serif','sans') NOT NULL COMMENT 'Kategorija fonta',
  `podrzana_pisma` json NOT NULL COMMENT 'Pisma koja font pokriva, npr. ["latin"]',
  `aktivan`        tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Je li font dostupan (1=da)',
  `napomena`       varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. pdf_dozvoljeni_izvori
CREATE TABLE IF NOT EXISTS `pdf_dozvoljeni_izvori` (
  `id`           int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ izvora',
  `naziv`        varchar(100) NOT NULL COMMENT 'Opis izvora za admina',
  `tablica`      varchar(64) NOT NULL COMMENT 'Naziv tablice',
  `kolona`       varchar(64) NOT NULL COMMENT 'Naziv kolone',
  `tip_podatka`  enum('tekst','slika') NOT NULL COMMENT 'Vrsta podatka',
  `napomena`     varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. pdf_paragraf
CREATE TABLE IF NOT EXISTS `pdf_paragraf` (
  `id`                       int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv`                    varchar(50) NOT NULL,
  `font_id`                  int(11) unsigned NOT NULL,
  `velicina_pt`              decimal(5,2) NOT NULL DEFAULT 12.00,
  `bold`                     tinyint(1) NOT NULL DEFAULT 0,
  `italic`                   tinyint(1) NOT NULL DEFAULT 0,
  `podcrtano`                tinyint(1) NOT NULL DEFAULT 0,
  `boja`                     varchar(7) NOT NULL DEFAULT '#000000',
  `boja_pozadine`            varchar(7) DEFAULT NULL,
  `pozadina_cijeli_red`      tinyint(1) NOT NULL DEFAULT 0,
  `traka_padding_lijevo_mm`  decimal(5,2) NOT NULL DEFAULT 0.00,
  `traka_padding_desno_mm`   decimal(5,2) NOT NULL DEFAULT 0.00,
  `traka_padding_gore_mm`    decimal(5,2) NOT NULL DEFAULT 0.00,
  `traka_padding_dolje_mm`   decimal(5,2) NOT NULL DEFAULT 0.00,
  `poravnanje`               enum('left','right','center','justify') NOT NULL DEFAULT 'left',
  `prored`                   decimal(4,2) NOT NULL DEFAULT 1.00,
  `razmak_prije_mm`          decimal(5,2) NOT NULL DEFAULT 0.00,
  `razmak_poslije_mm`        decimal(5,2) NOT NULL DEFAULT 0.00,
  `uvlaka_lijevo_mm`         decimal(5,2) NOT NULL DEFAULT 0.00,
  `uvlaka_desno_mm`          decimal(5,2) NOT NULL DEFAULT 0.00,
  `uvlaka_prvi_red_mm`       decimal(5,2) NOT NULL DEFAULT 0.00,
  `napomena`                 varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_paragraf_font` (`font_id`),
  CONSTRAINT `fk_paragraf_font` FOREIGN KEY (`font_id`) REFERENCES `pdf_fontovi` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. pdf_slika_stil
CREATE TABLE IF NOT EXISTS `pdf_slika_stil` (
  `id`                 int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv`              varchar(50) NOT NULL,
  `sirina_mm`          decimal(6,2) NOT NULL,
  `visina_mm`          decimal(6,2) NOT NULL,
  `skaliranje`         enum('uklopi','razvuci') NOT NULL DEFAULT 'uklopi',
  `okvir`              tinyint(1) NOT NULL DEFAULT 0,
  `okvir_boja`         varchar(7) DEFAULT NULL,
  `okvir_debljina_mm`  decimal(4,2) DEFAULT NULL,
  `prozirnost`         tinyint unsigned NOT NULL DEFAULT 100,
  `pozicioniranje`     enum('u_tijeku','usidreno','apsolutno') NOT NULL DEFAULT 'u_tijeku',
  `poravnanje_h`       enum('lijevo','centar','desno') DEFAULT NULL,
  `poravnanje_v`       enum('gore','centar','dolje') DEFAULT NULL,
  `pozicija_x_mm`      decimal(6,2) DEFAULT NULL,
  `pozicija_y_mm`      decimal(6,2) DEFAULT NULL,
  `potiskuje`          tinyint(1) NOT NULL DEFAULT 1,
  `napomena`           varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. pdf_template
CREATE TABLE IF NOT EXISTS `pdf_template` (
  `id`                        int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv`                     varchar(50) NOT NULL,
  `format_papira`             enum('A4','A5','A3','Letter','Legal','custom') NOT NULL DEFAULT 'A4',
  `sirina_mm`                 decimal(6,2) DEFAULT NULL,
  `visina_mm`                 decimal(6,2) DEFAULT NULL,
  `orijentacija`              enum('portrait','landscape') NOT NULL DEFAULT 'portrait',
  `margina_gore_mm`           decimal(5,2) NOT NULL DEFAULT 20.00,
  `margina_dolje_mm`          decimal(5,2) NOT NULL DEFAULT 20.00,
  `margina_lijevo_mm`         decimal(5,2) NOT NULL DEFAULT 20.00,
  `margina_desno_mm`          decimal(5,2) NOT NULL DEFAULT 20.00,
  `zaglavlje`                 tinyint(1) NOT NULL DEFAULT 0,
  `zaglavlje_visina_mm`       decimal(5,2) NOT NULL DEFAULT 0.00,
  `zaglavlje_padding_mm`      decimal(5,2) NOT NULL DEFAULT 0.00,
  `zaglavlje_primjena`        enum('prva','svaka') NOT NULL DEFAULT 'svaka',
  `podnozje`                  tinyint(1) NOT NULL DEFAULT 0,
  `podnozje_visina_mm`        decimal(5,2) NOT NULL DEFAULT 0.00,
  `podnozje_padding_mm`       decimal(5,2) NOT NULL DEFAULT 0.00,
  `podnozje_od_stranice`      smallint(6) NOT NULL DEFAULT 1,
  `broj_stranice`             tinyint(1) NOT NULL DEFAULT 0,
  `broj_stranice_format`      varchar(100) NOT NULL DEFAULT 'Stranica #S od #U',
  `broj_stranice_zona`        enum('podnozje','zaglavlje') NOT NULL DEFAULT 'podnozje',
  `broj_stranice_poravnanje`  enum('lijevo','centar','desno') NOT NULL DEFAULT 'centar',
  `naslovna_stranica`         tinyint(1) NOT NULL DEFAULT 0,
  `dvostran`                  tinyint(1) NOT NULL DEFAULT 0,
  `vezna_margina_mm`          decimal(5,2) NOT NULL DEFAULT 0.00,
  `napomena`                  varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. pdf_dokument
CREATE TABLE IF NOT EXISTS `pdf_dokument` (
  `id`          int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv`       varchar(100) NOT NULL,
  `template_id` int(11) unsigned NOT NULL,
  `opis`        varchar(255) DEFAULT NULL,
  `aktivan`     tinyint(1) NOT NULL DEFAULT 1,
  `created_at`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `napomena`    varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dokument_template` (`template_id`),
  CONSTRAINT `fk_dokument_template` FOREIGN KEY (`template_id`) REFERENCES `pdf_template` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. pdf_dokument_stavke
CREATE TABLE IF NOT EXISTS `pdf_dokument_stavke` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT,
  `dokument_id`      int(11) unsigned NOT NULL,
  `redoslijed`       int(11) NOT NULL DEFAULT 0,
  `zona`             enum('tijelo','zaglavlje','podnozje','naslovna') NOT NULL DEFAULT 'tijelo',
  `vrsta`            enum('tekst','slika') NOT NULL,
  `izvor_id`         int(11) unsigned NOT NULL,
  `izvor_tip`        enum('staticki','dinamicki') NOT NULL,
  `izvor_red_id`     int(11) unsigned DEFAULT NULL,
  `kontekst_kljuc`   varchar(64) DEFAULT NULL,
  `paragraf_id`      int(11) unsigned DEFAULT NULL,
  `slika_stil_id`    int(11) unsigned DEFAULT NULL,
  `napomena`         varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dokument_redoslijed` (`dokument_id`, `redoslijed`),
  KEY `fk_stavka_izvor` (`izvor_id`),
  KEY `fk_stavka_paragraf` (`paragraf_id`),
  KEY `fk_stavka_slika_stil` (`slika_stil_id`),
  CONSTRAINT `fk_stavka_dokument`
    FOREIGN KEY (`dokument_id`) REFERENCES `pdf_dokument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_izvor`
    FOREIGN KEY (`izvor_id`) REFERENCES `pdf_dozvoljeni_izvori` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_paragraf`
    FOREIGN KEY (`paragraf_id`) REFERENCES `pdf_paragraf` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_stavka_slika_stil`
    FOREIGN KEY (`slika_stil_id`) REFERENCES `pdf_slika_stil` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_prikaz_po_vrsti` CHECK (
    (`vrsta` = 'tekst' AND `paragraf_id` IS NOT NULL AND `slika_stil_id` IS NULL) OR
    (`vrsta` = 'slika' AND `slika_stil_id` IS NOT NULL AND `paragraf_id` IS NULL)
  ),
  CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'  AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL) OR
    (`izvor_tip` = 'dinamicki' AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Početni podaci
INSERT IGNORE INTO `pdf_fontovi` (`naziv`, `pdfmake_kljuc`, `tip`, `podrzana_pisma`, `aktivan`) VALUES
('Roboto',           'Roboto',          'sans',  '["latin"]', 1),
('Liberation Serif', 'LiberationSerif', 'serif', '["latin"]', 1);
