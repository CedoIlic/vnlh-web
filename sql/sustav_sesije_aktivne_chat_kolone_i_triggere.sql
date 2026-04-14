-- =========================================================
-- sustav_sesije_aktivne – chat kolone + triggeri (mail vs Chat poruka)
--
-- Pokreni NAKON što postoje: sustav_sesije_poruke.brisano, sustav_sesije_aktivne.ima_neprocitanih
-- i postojeći triggeri trg_poruke_after_* (iz sustav_sesije_aktivne_ima_neprocitanih.sql).
--
-- Ovaj skript: dodaje kolone za chat UI i nepročitane chat poruke; DROP + CREATE triggera
-- tako da se ima_neprocitanih odnosi samo na tip = 'Poruka' (modal Poruke), a ima_chat_neprocitanih
-- samo na tip = 'Chat poruka' (chat). Bez miješanja tipova.
--
-- Svi triggeri su jednostavni (jedan UPDATE po triggeru) – nema DELIMITER / BEGIN,
-- radi u HeidiSQL, DBeaver, phpMyAdmin (izvrši cijeli skript odjednom).
-- =========================================================

ALTER TABLE sustav_sesije_aktivne
  ADD COLUMN IF NOT EXISTS ima_chat_neprocitanih TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = postoji nepročitana Chat poruka (tip=Chat poruka, status=Novo, brisano=0) za id_korisnik ove sesije kao primatelja.',
  ADD COLUMN IF NOT EXISTS chat_modal_otvoren TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = chat modal otvoren (poruke_chat_modal_status.php akcija=otvori). 0 = zatvoreno (zatvori ili slanje koje zatvara modal).',
  ADD COLUMN IF NOT EXISTS chat_modal_sugovornik_id INT NOT NULL DEFAULT 0
    COMMENT 'sustav_korisnici.id_korisnik sugovornika u otvorenom chat modalu; 0 ako modal nije otvoren.';


DROP TRIGGER IF EXISTS trg_poruke_after_insert;

CREATE TRIGGER trg_poruke_after_insert
AFTER INSERT ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(NEW.status = 'Novo' AND NEW.brisano = 0 AND NEW.tip = 'Poruka', 1, sa.ima_neprocitanih),
       sa.ima_chat_neprocitanih = IF(NEW.status = 'Novo' AND NEW.brisano = 0 AND NEW.tip = 'Chat poruka', 1, sa.ima_chat_neprocitanih)
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND NEW.status = 'Novo'
   AND NEW.brisano = 0;


DROP TRIGGER IF EXISTS trg_poruke_after_update;

CREATE TRIGGER trg_poruke_after_update
AFTER UPDATE ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(
         OLD.status = 'Novo'
         AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1))
         AND OLD.tip = 'Poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = NEW.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Poruka'
         ),
         0,
         sa.ima_neprocitanih
       ),
       sa.ima_chat_neprocitanih = IF(
         OLD.tip = 'Chat poruka'
         AND OLD.status = 'Novo'
         AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1))
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = NEW.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Chat poruka'
         ),
         0,
         sa.ima_chat_neprocitanih
       )
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo'
   AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1));


DROP TRIGGER IF EXISTS trg_poruke_after_delete;

CREATE TRIGGER trg_poruke_after_delete
AFTER DELETE ON sustav_sesije_poruke
FOR EACH ROW
UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(
         OLD.status = 'Novo'
         AND OLD.tip = 'Poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = OLD.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Poruka'
         ),
         0,
         sa.ima_neprocitanih
       ),
       sa.ima_chat_neprocitanih = IF(
         OLD.status = 'Novo'
         AND OLD.tip = 'Chat poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = OLD.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Chat poruka'
         ),
         0,
         sa.ima_chat_neprocitanih
       )
 WHERE sa.id_korisnik = OLD.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo';
