-- =====================================================
-- create_app_user.sql
-- Kreiranje MySQL korisnika za VNLH WEB aplikaciju.
--
-- UPUTE:
-- 1. Zamijeni 'PROMIJENI_LOZINKU' s jakom lozinkom prije pokretanja.
-- 2. Pokreni kao root korisnik na produkcijskom serveru.
-- 3. Istu lozinku upiši u php/vnlh_db_connect.php ($password).
-- 4. Nakon pokretanja provjeri prava: SHOW GRANTS FOR 'vnlh_app'@'localhost';
-- =====================================================

-- Kreiranje korisnika (samo lokalna konekcija – aplikacija i baza su na istom serveru)
CREATE USER 'vnlh_app'@'localhost' IDENTIFIED BY 'PROMIJENI_LOZINKU';

-- Prava: samo CRUD operacije na vnlh bazi (bez CREATE, DROP, ALTER, GRANT itd.)
GRANT SELECT, INSERT, UPDATE, DELETE ON vnlh.* TO 'vnlh_app'@'localhost';

-- Primjena prava
FLUSH PRIVILEGES;
