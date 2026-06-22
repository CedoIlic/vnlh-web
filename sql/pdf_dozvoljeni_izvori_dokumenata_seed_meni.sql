-- pdf_dozvoljeni_izvori_dokumenata — kreiranje tablice + seed + meni unos + prava za novu formu.
-- Pokrenuti LOKALNO (Heidi) u jednom prolazu. Produkcija: tek uz izričitu dozvolu.
-- NAPOMENA: izvor istine za shemu je Skeema (db-schema/vnlh/pdf_dozvoljeni_izvori_dokumenata.sql);
--   CREATE ispod (IF NOT EXISTS) samo je radi praktičnog pokretanja cijele skripte odjednom.

-- 0) Tablica (idempotentno — ne smeta ako je Skeema već kreirala)
CREATE TABLE IF NOT EXISTS `pdf_dozvoljeni_izvori_dokumenata` (
  `id`       int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Jedinstveni ključ zapisa',
  `tablica`  varchar(64) NOT NULL COMMENT 'Naziv tablice dozvoljene kao izvor (subjekt) dokumenta u razvojnom bloku PDF_Dokument',
  `napomena` varchar(1024) DEFAULT NULL COMMENT 'Slobodna bilješka administratora',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pdizd_tablica` (`tablica`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 1) Početni dozvoljeni izvori (subjekti dokumenta)
INSERT INTO `pdf_dozvoljeni_izvori_dokumenata` (`tablica`) VALUES
  ('clanovi'),
  ('eseji'),
  ('loze'),
  ('napredovanja'),
  ('zapisnik_sa_radova');

-- 2) Meni unos (sibling forme „PDF Dozvoljeni izvori", roditelj 115, meni_tip 4, desktop only)
INSERT INTO `meni`
  (`naziv`, `opis`, `napomena`, `html_fajl`, `putanja`, `ref`, `meni_tip_id`, `roditelj`, `redoslijed`, `device`, `aktivno`, `test`)
VALUES
  ('PDF Dozvoljeni izvori dokumenata',
   'Popis tablica dozvoljenih kao izvor (subjekt) dokumenta u razvojnom bloku',
   '',
   'PDF_Dozvoljeni_izvori_dokumenata_CRUD.html',
   'html/',
   'pdf_dozvoljeni_izvori_dokumenata_crud',
   4, 115, 55, 1, 1, 1);

-- 3) Kopiraj CRUD prava (tip 4 = upis/izmjena, tip 5 = brisanje) s postojeće forme
--    „PDF Dozvoljeni izvori" na novu formu, za SVE dužnosnike koji ih imaju.
--    Pokrenuti NAKON unosa meni reda (korak 2). Bez ovoga su CRUD tipke skrivene.
INSERT INTO `duznosnici_ogranicenja`
  (`id_duznosnik`, `id_tip_ogranicenja`, `id_tip_obred_funkcionalnost`, `vrijednost`)
SELECT o.`id_duznosnik`, o.`id_tip_ogranicenja`, m_new.`id`, o.`vrijednost`
FROM `duznosnici_ogranicenja` o
JOIN `meni` m_old ON m_old.`html_fajl` = 'PDF_Whitelist_CRUD.html'
JOIN `meni` m_new ON m_new.`html_fajl` = 'PDF_Dozvoljeni_izvori_dokumenata_CRUD.html'
WHERE o.`id_tip_obred_funkcionalnost` = m_old.`id`
  AND o.`id_tip_ogranicenja` IN (4, 5);
