-- =========================================================
-- Jednokratno kreiranje tablica: zapisnik s radova (+ pomoćne).
--
-- Izvor istine za skladu s repom: db-schema/vnlh/zapisnik_sa_radova*.sql
--
-- Preduvjeti prije pokretanja:
--   • Tablice loze, obredi, stupnjevi, radovi_tip, clanovi moraju postojati.
--   • Tablice radovi_prisustvo_tip i radovi_drzave_gostiju moraju postojati prije
--     `zapisnik_sa_radova_prisutni` (foreign key).
--
-- Redoslijed: matična tablica, pa pomoćne koje ne ovise o prisutnima, na kraju prisutni.
-- =========================================================

SET NAMES utf8mb4;

-- === isječak: zapisnik_sa_radova.sql ===
-- Zapisi zapisnika s radova (matična tablica).
CREATE TABLE `zapisnik_sa_radova` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primarni ključ zapisa; ostale tablice se vežu stupcem id_zapisnika ili logički na ovaj id.',
  `id_domacin` int(11) unsigned NOT NULL COMMENT 'Loža domaćin radova (veza na loze.id).',
  `id_obred` int(11) unsigned NOT NULL COMMENT 'Obred u kojem loža radi (veza na obredi.id).',
  `id_stupanj` int(11) unsigned NOT NULL COMMENT 'Stupanj radova (veza na stupnjevi.id).',
  `id_tip_radova` int(11) unsigned NOT NULL COMMENT 'Tip radova (veza na radovi_tip.id), ne mijenja se sa stupnjem.',
  `datum_radova` date DEFAULT NULL COMMENT 'Datum održavanja radova; NULL ako datum još nije unesen.',
  `ovjera_prije_casni` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Čekboks potvrde časnog majstora prije prihvaćanja na radovima (0/1).',
  `ovjera_prije_inspektor` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Čekboks potvrde nadležnog inspektora prije prihvaćanja na radovima (0/1).',
  `ovjera_poslije_casni` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Čekboks potvrde časnog majstora nakon prihvaćanja na radovima (0/1).',
  `ovjera_poslije_tajnik` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Čekboks potvrde tajnika nakon prihvaćanja na radovima (0/1).',
  `ovjera_poslije_govornik` smallint(6) NOT NULL DEFAULT 0 COMMENT 'Čekboks potvrde govornika nakon prihvaćanja na radovima (0/1).',
  `sazetak` text DEFAULT NULL COMMENT 'Sažetak (kratki pregled) sadržaja zapisnika; puni tekst u stupcu zapisnik.',
  `zapisnik` text DEFAULT NULL COMMENT 'Puni tekst zapisnika.',
  PRIMARY KEY (`id`),
  FULLTEXT KEY `ft_zapisnik_sa_radova_sazetak` (`sazetak`),
  KEY `fk_zsr_domacin_loze` (`id_domacin`),
  KEY `fk_zsr_obredi` (`id_obred`),
  KEY `fk_zsr_stupnjevi` (`id_stupanj`),
  KEY `fk_zsr_radovi_tip` (`id_tip_radova`),
  CONSTRAINT `fk_zsr_domacin_loze` FOREIGN KEY (`id_domacin`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsr_obredi` FOREIGN KEY (`id_obred`) REFERENCES `obredi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsr_radovi_tip` FOREIGN KEY (`id_tip_radova`) REFERENCES `radovi_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsr_stupnjevi` FOREIGN KEY (`id_stupanj`) REFERENCES `stupnjevi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- === isječak: zapisnik_sa_radova_loze_ucesnice.sql ===
CREATE TABLE `zapisnik_sa_radova_loze_ucesnice` (
  `id_zapisnika` int(11) unsigned NOT NULL COMMENT 'Zapisnik (veza na zapisnik_sa_radova.id).',
  `id_loza` int(11) unsigned NOT NULL COMMENT 'Loža učesnica (veza na loze.id).',
  PRIMARY KEY (`id_zapisnika`, `id_loza`),
  KEY `fk_zsrlu_loza` (`id_loza`),
  CONSTRAINT `fk_zsrlu_rad` FOREIGN KEY (`id_zapisnika`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrlu_loza` FOREIGN KEY (`id_loza`) REFERENCES `loze` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- === isječak: zapisnik_sa_radova_duznosnici.sql ===
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

-- === isječak: zapisnik_sa_radova_prisutni.sql ===
CREATE TABLE `zapisnik_sa_radova_prisutni` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `id_zapisnika` int(11) unsigned NOT NULL COMMENT 'Zapisnik (veza na zapisnik_sa_radova.id).',
  `id_clana` int(11) unsigned DEFAULT NULL COMMENT 'Član ako pripada obedijenciji; NULL ako osoba dolazi izvan obedijencije.',
  `id_prisustvo_tip` int(11) unsigned NOT NULL COMMENT 'Tip zapisa/prisustva (veza na radovi_prisustvo_tip.id).',
  `ime_i_prezime` varchar(250) DEFAULT NULL COMMENT 'Ime i prezime ako dolazi izvan obedijencije ili za prikaz slobodnog unosa.',
  `loza` varchar(250) DEFAULT NULL COMMENT 'Naziv lože ako dolazi izvan obedijencije (tekstualno).',
  `id_drzave` int(11) unsigned DEFAULT NULL COMMENT 'Država gosta ako postoji (veza na radovi_drzave_gostiju.id).',
  PRIMARY KEY (`id`),
  KEY `fk_zsrp_zapisnik` (`id_zapisnika`),
  KEY `fk_zsrp_clan` (`id_clana`),
  KEY `fk_zsrp_tip` (`id_prisustvo_tip`),
  KEY `fk_zsrp_drzava` (`id_drzave`),
  CONSTRAINT `fk_zsrp_clanovi` FOREIGN KEY (`id_clana`) REFERENCES `clanovi` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_drzava_radovi` FOREIGN KEY (`id_drzave`) REFERENCES `radovi_drzave_gostiju` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_radovi_prisustvo_tip` FOREIGN KEY (`id_prisustvo_tip`) REFERENCES `radovi_prisustvo_tip` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_zsrp_zapisnik` FOREIGN KEY (`id_zapisnika`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
