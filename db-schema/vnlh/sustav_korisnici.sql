CREATE TABLE `sustav_korisnici` (
  `id_korisnik` int(11) unsigned NOT NULL,
  `id_duznosnik` int(11) unsigned NOT NULL,
  PRIMARY KEY (`id_korisnik`,`id_duznosnik`),
  UNIQUE KEY `uq_sustav_korisnici_duznosnik` (`id_duznosnik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
