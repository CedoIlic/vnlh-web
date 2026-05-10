-- Dodijeljene dužnosti po jednom zapisniku radova (jedan član po dužnosti po zapisniku — primarni ključ par id_zapisnika + naziv_duznosti).
-- Vrijednosti enuma namjerno usklađene s ulogama u js/Zapisnik_CRUD.js (ZAPISNIK_DUZNOSNICI_REDOVI).
CREATE TABLE `zapisnik_sa_radova_duznosnici` (
  `id_zapisnika` int(11) unsigned NOT NULL COMMENT 'Zapisnik (veza na zapisnik_sa_radova.id).',
  `naziv_duznosti` enum(
    'Časni majstor',
    'Prvi nadzornik',
    'Drugi nadzornik',
    'Tajnik lože',
    'Govornik',
    'Majstor ceremonije',
    'Prvi đakon',
    'Drugi đakon',
    'Unutarnji čuvar hrama'
  ) NOT NULL COMMENT 'Vrsta dužnosti (jedinstven par s id_zapisnika).',
  `id_clana` int(11) unsigned NOT NULL COMMENT 'Član na dužnosti (veza na clanovi.id).',
  PRIMARY KEY (`id_zapisnika`, `naziv_duznosti`),
  KEY `fk_zsrd_clanovi` (`id_clana`),
  CONSTRAINT `fk_zsrd_zapisnik` FOREIGN KEY (`id_zapisnika`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrd_clanovi` FOREIGN KEY (`id_clana`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
