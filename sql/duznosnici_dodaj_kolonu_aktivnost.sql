-- =========================================================
-- Tablica: duznosnici — kolona aktivnost (0/1)
-- Baza: vnlh (pokreni u kontekstu te baze ili: USE vnlh;)
--
-- Stanja:
--   0 = nije aktivan
--   1 = aktivan (zadano za postojeće i nove retke)
--
-- Jednokratno izvršavanje. Ako kolona već postoji, ALTER će baciti grešku —
-- tada preskoči ili ručno ukloni kolonu prije ponovnog pokretanja.
-- =========================================================

USE vnlh;

ALTER TABLE duznosnici
  ADD COLUMN aktivnost TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '0 = nije aktivan, 1 = aktivan'
    AFTER naziv,
  ADD CONSTRAINT chk_duznosnici_aktivnost CHECK (aktivnost IN (0, 1));

-- Provjera (opcionalno):
-- DESCRIBE duznosnici;
-- SELECT id, naziv, aktivnost, id_nadredjeni FROM duznosnici LIMIT 10;
