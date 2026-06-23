CREATE TABLE `sustav_drzave` (
  `kod` char(2) NOT NULL COMMENT 'ISO 3166-1 alpha-2 šifra zemlje, mala slova (hr, it, fr, gb…). Koristi se za render zastave i kao cilj FK-a iz sustav_jezici.drzava_kod. Razlikuje se od jezične šifre (sustav_jezici.kod).',
  `naziv` varchar(80) NOT NULL COMMENT 'Hrvatski naziv države za prikaz u selectu (korisnik bira po nazivu, ne po ISO šifri). Jedinstven.',
  `slika_naziv` varchar(150) DEFAULT NULL COMMENT 'Naziv sloga u sustav_slike_tekstovi koji nosi zastavu ove države (npr. "Zastava Srbija"). Serve-endpoint dohvaća sliku po tom nazivu; admin tako zna kako nazvati slog. Prazno = bez slike (prazan okvir).',
  `aktivan` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = država ponuđena u selectu izbora zastave; 0 = u šifrarniku ali skrivena iz izbora. Zasad aktivne: EU-27 + Srbija, BiH, Crna Gora, Sjeverna Makedonija.',
  PRIMARY KEY (`kod`),
  UNIQUE KEY `uq_sustav_drzave_naziv` (`naziv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
