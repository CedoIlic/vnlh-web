-- =============================================================
-- provjera_tip_poruke_chat_integritet.sql
-- READ-ONLY dijagnostika: tipovi u sustav_sesije_poruke + triggeri (Poruka vs Chat poruka).
-- Pokreni u HeidiSQL / DBeaver / mysql CLI na bazi npr. vnlh.
--
-- Napomena iz sheme (sustav_sesije_poruke_komentari_kolona.sql):
--   tip ENUM('Poruka', 'Poruka razvoju', 'Chat poruka')
-- PHP 0-Poruke_*.php filtrira strogo tip = 'Poruka' (ne uključuje 'Poruka razvoju').
-- =============================================================

-- 1) Koje vrijednosti tipa stvarno postoje (aktivni retci)?
SELECT tip, COUNT(*) AS broj_redaka
  FROM sustav_sesije_poruke
 WHERE brisano = 0
 GROUP BY tip
 ORDER BY tip;

-- 2) Neočekivane ili NULL vrijednosti (ako ENUM dopušta legacy)?
SELECT id, id_razgovor, id_posiljatelj, id_primatelj, tip, status, LEFT(poruka, 40) AS pocetak
  FROM sustav_sesije_poruke
 WHERE brisano = 0
   AND (tip IS NULL OR tip NOT IN ('Poruka', 'Poruka razvoju', 'Chat poruka'));

-- 3) Parovi koji imaju I mail I chat (isti korisnici, oba tipa) – očekivano OK, odvojeni API-jevi.
SELECT LEAST(p1.id_posiljatelj, p1.id_primatelj) AS a,
       GREATEST(p1.id_posiljatelj, p1.id_primatelj) AS b,
       SUM(p1.tip = 'Poruka') AS poruka_mail,
       SUM(p1.tip = 'Chat poruka') AS poruka_chat
  FROM sustav_sesije_poruke p1
 WHERE p1.brisano = 0
   AND p1.tip IN ('Poruka', 'Chat poruka')
 GROUP BY a, b
HAVING poruka_mail > 0 AND poruka_chat > 0
 ORDER BY b, a
 LIMIT 50;

-- 4) Triggeri na sustav_sesije_poruke – provjeri sadrži li mail granu 'Poruka' (ne samo <> Chat).
SELECT TRIGGER_NAME,
       ACTION_TIMING,
       EVENT_MANIPULATION,
       ACTION_STATEMENT
  FROM information_schema.TRIGGERS
 WHERE TRIGGER_SCHEMA = DATABASE()
   AND EVENT_OBJECT_TABLE = 'sustav_sesije_poruke'
   AND TRIGGER_NAME LIKE 'trg_poruke%'
 ORDER BY TRIGGER_NAME;

-- Ručno u rezultatu stupca ACTION_STATEMENT traži:
--   ima_neprocitanih: ... NEW.tip = 'Poruka' ... i NOT EXISTS ... sp.tip = 'Poruka'
--   ima_chat_neprocitanih: ... 'Chat poruka' ...
-- Ako još piše NEW.tip <> 'Chat poruka', ponovno pokreni sql/sustav_sesije_aktivne_chat_kolone_i_triggere.sql
