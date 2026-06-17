-- pdf_dokument_stavke: cetvrti izvor_tip — "korisnicki" (upisani tekst u stavci).
-- Uz staticki/dinamicki/po_vrijednosti, segment teksta moze biti i rucno upisan literal:
--   izvor_tip='korisnicki' -> vrijednost = literal_tekst (bez izvora; izvor_id IS NULL).
-- Marker '^' u literal_tekst zamjenjuje se razmakom u generatoru (za rubne razmake; literal se trima).
-- bez_kraja_odlomka: kad je 1, sljedeca tekst-stavka istog zona spaja se inline u isti odlomak
--   (stil cijele linije = prve stavke u nizu; prazne vrijednosti se preskacu).

ALTER TABLE `pdf_dokument_stavke`
  MODIFY COLUMN `izvor_tip` enum('staticki','dinamicki','po_vrijednosti','korisnicki') NOT NULL
    COMMENT 'staticki=fiksni red; dinamicki=id iz konteksta; po_vrijednosti=red po vrijednosti kolone; korisnicki=upisani tekst (literal_tekst)',
  MODIFY COLUMN `izvor_id` int(11) unsigned DEFAULT NULL
    COMMENT 'FK na pdf_dozvoljeni_izvori (NULL kad izvor_tip=korisnicki)',
  ADD COLUMN `literal_tekst` varchar(1024) DEFAULT NULL
    COMMENT 'Upisani tekst segmenta (kad izvor_tip=korisnicki); ^ = razmak' AFTER `trazi_vrijednost`,
  ADD COLUMN `bez_kraja_odlomka` tinyint(1) NOT NULL DEFAULT 0
    COMMENT 'Kad 1, sljedeca tekst-stavka istog zona spaja se inline u isti odlomak (stil prve)' AFTER `slika_stil_id`;

ALTER TABLE `pdf_dokument_stavke` DROP CONSTRAINT `chk_izvor_po_tipu`;

ALTER TABLE `pdf_dokument_stavke`
  ADD CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'       AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'dinamicki'      AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'po_vrijednosti' AND `izvor_id` IS NOT NULL AND `literal_tekst` IS NULL AND `trazi_kolona` IS NOT NULL AND `trazi_vrijednost` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL) OR
    (`izvor_tip` = 'korisnicki'     AND `izvor_id` IS NULL     AND `literal_tekst` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL)
  );
