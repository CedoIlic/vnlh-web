CREATE TABLE `zapisnik_boje_u_listi` (
  `id`     tinyint(3) unsigned NOT NULL,
  `naziv`  varchar(50)         NOT NULL,
  `opis`   varchar(1024)       DEFAULT NULL,
  `boja`    char(9) DEFAULT NULL COMMENT 'Boja teksta (fg, #RRGGBBAA)',
  `boja_bg` char(9) DEFAULT NULL COMMENT 'Boja podloge (bg, #RRGGBBAA)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
