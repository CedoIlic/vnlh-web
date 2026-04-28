CREATE TABLE `clanovi_zastavice` (
  `id` tinyint(3) unsigned NOT NULL,
  `naziv` varchar(50) NOT NULL,
  `opis` varchar(1024) DEFAULT NULL,
  `boja` char(9) DEFAULT NULL,
  `aktivnost` tinyint(3) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
