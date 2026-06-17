-- pdf_dokument_stavke: test_id — testni id retka za pregled dinamickog izvora pri slaganju dokumenta.
-- Kad je izvor_tip=dinamicki a kontekst nema id (uredjivanje/preview), koristi se test_id da se
-- vidi pravi podatak (slika/tekst) umjesto sive plohe. U stvarnom generiranju kontekst ima prednost.

ALTER TABLE `pdf_dokument_stavke`
  ADD COLUMN `test_id` int(11) unsigned DEFAULT NULL
    COMMENT 'Testni id retka za pregled dinamickog izvora (preview; kontekst ima prednost)' AFTER `kontekst_kljuc`;
