CREATE TABLE `sustav_prijevodi_kljucevi` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Interni id ključa.',
  `kljuc` varchar(150) NOT NULL COMMENT 'Hijerarhijski ključ <modul>.<sekcija>.<element> (npr. drzave_crud.tablica.naziv, global.gumb.upis). Jedinstven, stabilan — ne mijenjati nakon prijevoda.',
  `izvor` enum('Forma','Baza','Poruka') NOT NULL DEFAULT 'Forma' COMMENT 'Odakle string dolazi: Forma = UI tekst forme; Baza = DB-vođeni sadržaj (odgođeno); Poruka = modal poruka (0-Poruke).',
  `ime_forme` varchar(80) DEFAULT NULL COMMENT 'Naziv forme za prikaz adminu pri reviziji (npr. "Države"). "Globalno" za dijeljene UI ključeve; NULL za Baza/Poruka.',
  `naziv_fajla` varchar(120) DEFAULT NULL COMMENT 'HTML datoteka forme (npr. "Drzave_CRUD.html"). Za scoping rječnika i detekciju zastarjelih ključeva po formi. NULL za global/Baza/Poruka.',
  `tip` enum('naslov','labela','placeholder','gumb','zaglavlje_tablice','opcija','modal','popup','poruka','ostalo') NOT NULL DEFAULT 'ostalo' COMMENT 'Vrsta kontrole/teksta. Proširivo (dodavanje vrijednosti = mali ALTER).',
  `kontrola` varchar(100) DEFAULT NULL COMMENT 'Ime/identifikator kontrole u kodu: id elementa (npr. "edit_jezik"), gumb ("btnUpisi"), ključ stupca tablice ("naziv") ili data-i18n cilj. Veže ključ na točnu kontrolu.',
  `izvorni_tekst` varchar(1000) NOT NULL COMMENT 'Izvorni (hrvatski/master) tekst; osnova za AI prijevod i referenca adminu.',
  `izvorni_hash` char(32) DEFAULT NULL COMMENT 'MD5 izvornog teksta. Rutina skeniranja forme usporedi s tekstom kontrole u kodu; razlika → master izmijenjen → osvježi i označi prijevode zastarjelo.',
  `napomena` varchar(500) DEFAULT NULL COMMENT 'Kontekst za prevoditelja/AI (npr. "gumb, max ~12 znakova", "naslov stupca").',
  `zadnji_skan` datetime DEFAULT NULL COMMENT 'Vrijeme zadnjeg skeniranja u kojem je ključ pronađen. Stari datum = kandidat za uklanjanje (kontrola nestala).',
  `aktivan` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = označen za uklanjanje (kontrola nestala), zadržan dok se brisanje ne potvrdi.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sustav_prijevodi_kljucevi_kljuc` (`kljuc`),
  KEY `ix_spk_naziv_fajla` (`naziv_fajla`),
  KEY `ix_spk_izvor` (`izvor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
