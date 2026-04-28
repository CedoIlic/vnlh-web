CREATE TABLE `sustav_korisnici` (
  `id_korisnik` int(11) NOT NULL,
  `id_duznosnik` int(11) NOT NULL,
  PRIMARY KEY (`id_korisnik`,`id_duznosnik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
