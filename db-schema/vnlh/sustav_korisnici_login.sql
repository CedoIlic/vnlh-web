CREATE TABLE `sustav_korisnici_login` (
  `id_korisnik` int(11) unsigned NOT NULL,
  `login` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `pass` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `pass_status` smallint(6) DEFAULT NULL COMMENT 'Status lozinke: 0 ok, 1 obavezna promjena lozinke, 2 Korisnik je blokiran',
  `login_neuspjesni_pokusaji` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Neuspjeli pokušaji prijave/promjene lozinke; reset pri uspjehu; 5+ -> pass_status=2',
  `broj_duznosti` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Broj redaka u sustav_korisnici za ovaj id_korisnik (održavaju triggeri)',
  PRIMARY KEY (`id_korisnik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
