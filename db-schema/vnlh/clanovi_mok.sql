-- MOK — osobni karton člana: kratke bilješke koje o članu upisuju njegovi nadređeni (1:N po članu).
-- DISKRECIJA (2026-07-28): bilješku čita onaj tko zadovolji sva tri uvjeta — autor je (`upisao`), ulogiran je
-- pod istom dužnošću pod kojom ju je zapisao (`upisao_duznost`), i član je još u loži iz zapisa
-- (`clanovi.loza` = `id_loza_clan`). Prelazak ČLANA u drugu ložu odsijeca stare bilješke.
-- Iznimka je kontrolna razina (dužnosti iz sustav_varijable 127): ona ČITA sve, ali ne mijenja i ne briše.
-- Izmjena/brisanje: samo autor, unutar roka od `datum_upisa` (mjeseci u sustav_varijable 128) i dok mu je vidljiva.
-- Pravo na formu imaju samo Časni majstori (razina 4) — rješava se pravima nad menijem, ne kodom.
CREATE TABLE `clanovi_mok` (
  `id`                   int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Ključ sloga',
  `id_clan`              int(11) unsigned NOT NULL COMMENT 'Član na kojeg se bilješka odnosi (clanovi.id)',
  `id_loza_clan`         int(11) unsigned DEFAULT NULL COMMENT 'Loža ČLANA u trenutku upisa (kopija clanovi.loza) — uvjet vidljivosti: mora biti jednaka današnjoj clanovi.loza',
  `upisao`               int(11) unsigned DEFAULT NULL COMMENT 'Autor bilješke kao osoba (clanovi.id iz sesije); nositelj prava na izmjenu/brisanje',
  `upisao_duznost`       int(11) unsigned DEFAULT NULL COMMENT 'Dužnost autora u trenutku upisa (duznosnici.id iz sesije) — uvjet vidljivosti: čita ju samo autor ulogiran pod tom dužnošću',
  `id_loza_upisao`       int(11) unsigned DEFAULT NULL COMMENT 'Loža AUTORA u trenutku upisa — povijesni zapis, NIJE uvjet vidljivosti (bilo do 2026-07-28)',
  `tekst`                text DEFAULT NULL COMMENT 'Sadržaj bilješke (slobodan tekst, bez naslova i kategorije)',
  `datum_upisa`          datetime DEFAULT NULL COMMENT 'Vrijeme upisa sa servera; od njega se broji rok za izmjenu i brisanje',
  `datum_zadnje_izmjene` datetime DEFAULT NULL COMMENT 'Vrijeme zadnje izmjene sa servera; NULL = nikad mijenjano (rok se i dalje broji od datum_upisa)',
  PRIMARY KEY (`id`),
  KEY `ix_clanovi_mok_clan` (`id_clan`),
  KEY `ix_clanovi_mok_upisao` (`upisao`),
  KEY `ix_clanovi_mok_loza_upisao` (`id_loza_upisao`),
  KEY `fk_clanovi_mok_loza_clan` (`id_loza_clan`),
  KEY `fk_clanovi_mok_duznost` (`upisao_duznost`),
  CONSTRAINT `fk_clanovi_mok_clan` FOREIGN KEY (`id_clan`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_mok_loza_clan` FOREIGN KEY (`id_loza_clan`) REFERENCES `loze` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_mok_upisao` FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_mok_duznost` FOREIGN KEY (`upisao_duznost`) REFERENCES `duznosnici` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_clanovi_mok_loza_upisao` FOREIGN KEY (`id_loza_upisao`) REFERENCES `loze` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='MOK — osobne bilješke nadređenih o članu (diskrecija po autoru i loži)';
