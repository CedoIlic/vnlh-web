-- pdf_dozvoljeni_izvori_dokumenata_kolone — seed početnih dozvoljenih kolona po tablici.
-- Pokrenuti LOKALNO (Heidi) NAKON što postoji tablica pdf_dozvoljeni_izvori_dokumenata_kolone
-- i nakon seeda tablica (pdf_dozvoljeni_izvori_dokumenata sadrži 5 izvora).
-- INSERT IGNORE + UNIQUE(id_izvor,kolona) → idempotentno (ponovno pokretanje ne duplira).
-- Kolone se ionako mogu uređivati i kroz formu „Dozvoljeni izvori dokumenata".
-- Produkcija: tek uz izričitu dozvolu.

INSERT IGNORE INTO `pdf_dozvoljeni_izvori_dokumenata_kolone` (`id_izvor`, `kolona`)
SELECT d.`id`, k.`kolona`
FROM `pdf_dozvoljeni_izvori_dokumenata` d
JOIN (
  SELECT 'clanovi'            AS tablica, 'prezime'            AS kolona
  UNION ALL SELECT 'clanovi',            'ime'
  UNION ALL SELECT 'clanovi',            'sifra'
  UNION ALL SELECT 'loze',               'naziv'
  UNION ALL SELECT 'eseji',              'naslov_eseja'
  UNION ALL SELECT 'zapisnik_sa_radova', 'datum_radova'
  UNION ALL SELECT 'napredovanja',       'datum_napredovanja'
) k ON k.tablica = d.`tablica`;
