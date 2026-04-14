-- =========================================================
-- sustav_sesije_aktivne_ima_neprocitanih.sql
--
-- Sve-u-jednom skripta: dodaje kolonu ima_neprocitanih na
-- sustav_sesije_aktivne i kreira tri triggera na
-- sustav_sesije_poruke koji automatski ažuriraju taj flag.
--
-- Funkcionalnost kolone:
--   Boolean flag (0/1) koji indicira postoje li nepročitane
--   poruke za korisnika u toj sesiji. Polling endpoint
--   (0-Poruke_neprocitane.php) čita samo ovaj flag (UNIQUE KEY
--   lookup po session_id) umjesto COUNT(*) na tablici poruka.
--
-- Tko postavlja flag:
--   - trg_poruke_after_insert  → SET 1 pri INSERT sa status='Novo' i brisano=0
--   - trg_poruke_after_update  → SET 0 kad nema više nepročitanih (status ili brisano)
--   - trg_poruke_after_delete  → SET 0 kad nema više nepročitanih (fizičko brisanje u SQL-u)
--   - Login.php                → inicijalno 1 ili 0 pri loginu
--
-- Single-statement triggeri (bez BEGIN...END) – ne zahtijevaju
-- DELIMITER promjenu, rade u svim klijentima.
--
-- NAPOMENA: Pokrenuti jednom na bazi. Idempotentno – IF NOT EXISTS
--           i DROP TRIGGER IF EXISTS sprječavaju greške pri
--           ponovnom pokretanju.
--
-- Kolona sustav_sesije_poruke.brisano (KORAK 0): brisanje = 1, red ostaje;
-- u povijesti samo brisano=0; s 1 se ne prikazuju nigdje. Triggeri broje nepročitano uz brisano=0.
--
-- Chat: nakon ovog skripta pokreni sql/sustav_sesije_aktivne_chat_kolone_i_triggere.sql
-- (kolone ima_chat_neprocitanih, chat_modal_* i zamjena triggera za split mail vs Chat poruka).
-- =========================================================


-- =========================================================
-- KORAK 0: Poruke – kolona brisano (0 = aktivna, 1 = logički obrisana nit)
-- =========================================================
ALTER TABLE sustav_sesije_poruke
  ADD COLUMN IF NOT EXISTS brisano TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Brisanje postavlja 1 i ne briše red. Povijest/API: samo brisano=0. S brisano=1 poruke se ne prikazuju – kao da ne postoje. 0-Poruke_brisi; triggeri broje nepročitano samo uz 0.';


-- =========================================================
-- KORAK 1: Dodaj kolonu ako već ne postoji
-- =========================================================
ALTER TABLE sustav_sesije_aktivne
  ADD COLUMN IF NOT EXISTS ima_neprocitanih TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Flag nepročitanih poruka (0=nema, 1=ima). Ažuriraju triggeri na sustav_sesije_poruke i Login.php pri loginu. Polling čita samo ovaj flag umjesto COUNT(*) na tablici poruka.';


-- =========================================================
-- KORAK 2: Trigger AFTER INSERT
-- Nova poruka sa statusom 'Novo' → flag=1 za primatelja.
-- =========================================================
DROP TRIGGER IF EXISTS trg_poruke_after_insert;

CREATE TRIGGER trg_poruke_after_insert
AFTER INSERT ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = 1
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND NEW.status = 'Novo'
   AND NEW.brisano = 0;


-- =========================================================
-- KORAK 3: Trigger AFTER UPDATE
-- Status iz 'Novo' u drugo → ako nema više nepročitanih, flag=0.
-- =========================================================
DROP TRIGGER IF EXISTS trg_poruke_after_update;

CREATE TRIGGER trg_poruke_after_update
AFTER UPDATE ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = 0
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo'
   AND (
        NEW.status <> 'Novo'
        OR (OLD.brisano = 0 AND NEW.brisano = 1)
   )
   AND NOT EXISTS (
       SELECT 1 FROM sustav_sesije_poruke sp
        WHERE sp.id_primatelj = NEW.id_primatelj
          AND sp.status = 'Novo'
          AND sp.brisano = 0
   );


-- =========================================================
-- KORAK 4: Trigger AFTER DELETE
-- Obrisana 'Novo' poruka → ako nema više nepročitanih, flag=0.
-- =========================================================
DROP TRIGGER IF EXISTS trg_poruke_after_delete;

CREATE TRIGGER trg_poruke_after_delete
AFTER DELETE ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = 0
 WHERE sa.id_korisnik = OLD.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo'
   AND NOT EXISTS (
       SELECT 1 FROM sustav_sesije_poruke sp
        WHERE sp.id_primatelj = OLD.id_primatelj
          AND sp.status = 'Novo'
          AND sp.brisano = 0
   );
