CREATE TABLE `sustav_varijable` (
  `id` int(11) unsigned NOT NULL,
  `varijabla` varchar(200) NOT NULL,
  `Naziv` varchar(200) NOT NULL,
  `opis` varchar(2048) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
