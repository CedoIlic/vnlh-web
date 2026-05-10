CREATE TABLE `duznosnici` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `naziv` varchar(150) NOT NULL,
  `aktivnost` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = nije aktivan, 1 = aktivan',
  `razina` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Razina hijerarhije (0=nije postavljeno, 1–99 u formi)',
  `id_nadredjeni` int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_duznosnici_id_nadredjeni` (`id_nadredjeni`),
  CONSTRAINT `chk_duznosnici_aktivnost` CHECK (`aktivnost` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
