-- =============================================================
-- Poruke: primatelji za način „Slanje poruke razvoju” (gumb ključa u modalu).
-- sustav_varijable.id = 1002: kolona varijabla = jedan ili više id_korisnika (sustav_korisnici.id),
--   odvojeni zarezom i/ili razmacima (PHP: php/0-Poruke_posalji.php – svi brojevi u stringu, bez duplikata).
-- ENUM u INSERT: tip = 'Poruka razvoju' (vidi sql/sustav_sesije_poruke_komentari_kolona.sql).
-- Izvršiti ručno na bazi ako red ne postoji; prilagoditi ID-jeve primatelja.
-- =============================================================

-- Primjer: INSERT (jedan primatelj)
-- INSERT INTO sustav_varijable (id, varijabla) VALUES (1002, '299')
--   ON DUPLICATE KEY UPDATE varijabla = VALUES(varijabla);

-- Primjer: više primatelja (isti tekst ide svima u jednom slanju)
-- UPDATE sustav_varijable SET varijabla = '214, 228, 299' WHERE id = 1002;
