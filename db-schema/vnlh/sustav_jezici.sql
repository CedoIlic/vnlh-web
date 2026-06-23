CREATE TABLE `sustav_jezici` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primarni ključ jezika; interni identifikator. Na njega se veže id_jezik u sustav_korisnici_login (jezik korisnika) i u tablici prijevoda (sustav_prijevodi). Ne mijenja se.',
  `kod` varchar(10) NOT NULL COMMENT 'Šifra jezika, mala slova, BCP-47 lite (npr. hr, en, it, fr). Jedinstvena; ključ za dohvat rječnika prijevoda i za kod/URL. Stabilna — ne mijenjati nakon što su prijevodi povezani.',
  `drzava_kod` char(2) DEFAULT NULL COMMENT 'ISO šifra zemlje za zastavu jezika (FK → sustav_drzave.kod). Razlikuje se od kod (jezik): en može imati gb ili us. NULL = bez zastave.',
  `naziv` varchar(50) NOT NULL COMMENT 'Naziv jezika za prikaz korisniku (na hrvatskom): Hrvatski, Engleski, Talijanski… Jedinstven. Slobodan za uređivanje (ne utječe na povezivanje prijevoda — to radi kod preko kolone kod).',
  `naziv_izvorni` varchar(80) DEFAULT NULL COMMENT 'Naziv jezika na samom tom jeziku/pismu (autonim/endonim): Hrvatski, English, Italiano, Français, Српски, Ελληνικά, 中文. Koristi ga prebacivač jezika i korisničke liste (uvijek u izvornom pismu). Prazno = fallback na naziv.',
  `zadani` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Zadani (fallback) jezik aplikacije. Točno JEDAN redak smije imati 1. Koristi se kad korisnik nema postavljen jezik ili kad prijevod za traženi jezik ne postoji. Postavljanje 1 na jedan redak backend forme mora maknuti 1 sa svih ostalih.',
  `aktivan` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = jezik je ponuđen korisnicima (izbornik/postavke). 0 = skriven, ali zadržan u bazi (postojeći prijevodi i veze ostaju netaknuti). Zadani jezik (zadani=1) mora biti aktivan.',
  `redoslijed` smallint(5) unsigned NOT NULL DEFAULT 0 COMMENT 'Redoslijed prikaza u izbornicima/listama (manji broj = prije). Pri jednakoj vrijednosti sekundarno sortiranje po nazivu.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sustav_jezici_kod` (`kod`),
  UNIQUE KEY `uq_sustav_jezici_naziv` (`naziv`),
  KEY `ix_sustav_jezici_drzava_kod` (`drzava_kod`),
  CONSTRAINT `fk_sustav_jezici_drzava` FOREIGN KEY (`drzava_kod`) REFERENCES `sustav_drzave` (`kod`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
