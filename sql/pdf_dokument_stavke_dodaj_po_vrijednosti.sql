-- pdf_dokument_stavke: treci nacin dohvata retka — "po_vrijednosti".
-- Uz staticki (fiksni id) i dinamicki (id iz konteksta), red se moze naci i pretragom kolone:
--   SELECT {kolona} FROM {tablica} WHERE {trazi_kolona} = {trazi_vrijednost} ORDER BY id LIMIT 1
-- trazi_vrijednost ide kao bound parametar; trazi_kolona se u backendu validira (postoji u tablici).

ALTER TABLE `pdf_dokument_stavke`
  MODIFY COLUMN `izvor_tip` enum('staticki','dinamicki','po_vrijednosti') NOT NULL
    COMMENT 'staticki=fiksni red; dinamicki=id iz konteksta; po_vrijednosti=red po vrijednosti kolone',
  ADD COLUMN `trazi_kolona` varchar(64) DEFAULT NULL
    COMMENT 'Kolona po kojoj se traži red (kad izvor_tip=po_vrijednosti)' AFTER `kontekst_kljuc`,
  ADD COLUMN `trazi_vrijednost` varchar(255) DEFAULT NULL
    COMMENT 'Vrijednost koja se traži u trazi_kolona (točno podudaranje, ORDER BY id LIMIT 1; kad izvor_tip=po_vrijednosti)' AFTER `trazi_kolona`;

ALTER TABLE `pdf_dokument_stavke` DROP CONSTRAINT `chk_izvor_po_tipu`;

ALTER TABLE `pdf_dokument_stavke`
  ADD CONSTRAINT `chk_izvor_po_tipu` CHECK (
    (`izvor_tip` = 'staticki'       AND `izvor_red_id` IS NOT NULL AND `kontekst_kljuc` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'dinamicki'      AND `kontekst_kljuc` IS NOT NULL AND `izvor_red_id` IS NULL AND `trazi_kolona` IS NULL AND `trazi_vrijednost` IS NULL) OR
    (`izvor_tip` = 'po_vrijednosti' AND `trazi_kolona` IS NOT NULL AND `trazi_vrijednost` IS NOT NULL AND `izvor_red_id` IS NULL AND `kontekst_kljuc` IS NULL)
  );
