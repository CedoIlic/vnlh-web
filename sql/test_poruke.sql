-- =========================================================
-- test_poruke.sql
-- Testne poruke za sustav poruka (sustav_sesije_poruke).
-- Primatelj: 228, Pošiljatelji: 214, 228, 291, 299 (postojeći)
--   + 9901, 9902, 9903, 9904, 9905, 9906 (nepostojeći u bazi).
-- Razgovori: 1001–1010 (po jedan za svakog pošiljaoca).
-- Status: mješavina 'Novo' i 'Pročitano' za raznolike scenarije.
-- NAPOMENA: Pokrenuti samo na test bazi!
-- =========================================================

-- Brisanje svih postojećih poruka prije umetanja testnih
DELETE FROM sustav_sesije_poruke;

-- Razgovor 1001: 214 → 228 (5 poruka + 1 odgovor od 228)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1001, 214, 228, 'test-sess-214', 'Bok, jesi li pogledao onaj izvještaj?', '2026-04-10 08:15:00', 'Pročitano', 'Poruka'),
  (1001, 228, 214, 'test-sess-228', 'Jesam, izgleda OK. Imam par komentara.', '2026-04-10 08:22:00', 'Pročitano', 'Poruka'),
  (1001, 214, 228, 'test-sess-214', 'Super, pošalji mi komentare kad stigneš.', '2026-04-10 08:30:00', 'Pročitano', 'Poruka'),
  (1001, 214, 228, 'test-sess-214', 'Btw, sastanak je pomaknut na 14h.', '2026-04-10 09:45:00', 'Novo', 'Poruka'),
  (1001, 214, 228, 'test-sess-214', 'Javi se kad budeš slobodan.', '2026-04-10 10:00:00', 'Novo', 'Poruka');

-- Razgovor 1002: 291 → 228 (5 poruka + 2 odgovora od 228)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1002, 291, 228, 'test-sess-291', 'Trebam pomoć oko unosa novih članaka.', '2026-04-11 10:00:00', 'Pročitano', 'Poruka'),
  (1002, 228, 291, 'test-sess-228', 'Naravno, šta točno ne radi?', '2026-04-11 10:05:00', 'Pročitano', 'Poruka'),
  (1002, 291, 228, 'test-sess-291', 'Forma se ne sprema, javlja grešku 200.', '2026-04-11 10:08:00', 'Pročitano', 'Poruka'),
  (1002, 228, 291, 'test-sess-228', 'Probaj osvježiti stranicu i ponovo.', '2026-04-11 10:12:00', 'Novo', 'Poruka'),
  (1002, 291, 228, 'test-sess-291', 'Radi! Hvala puno.', '2026-04-11 10:20:00', 'Novo', 'Poruka'),
  (1002, 291, 228, 'test-sess-291', 'Još jedno pitanje – gdje se vidi statistika?', '2026-04-11 14:30:00', 'Novo', 'Poruka'),
  (1002, 291, 228, 'test-sess-291', 'Nema veze, našao sam. Pozdrav!', '2026-04-11 14:45:00', 'Novo', 'Poruka');

-- Razgovor 1003: 299 → 228 (4 poruke)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1003, 299, 228, 'test-sess-299', 'Molim te provjeri pristup za novog korisnika.', '2026-04-12 07:30:00', 'Novo', 'Poruka'),
  (1003, 299, 228, 'test-sess-299', 'ID korisnika je 350.', '2026-04-12 07:31:00', 'Novo', 'Poruka'),
  (1003, 299, 228, 'test-sess-299', 'Trebao bi imati ulogu "Operater".', '2026-04-12 07:32:00', 'Novo', 'Poruka'),
  (1003, 299, 228, 'test-sess-299', 'Hvala unaprijed!', '2026-04-12 07:33:00', 'Novo', 'Poruka');

-- Razgovor 1004: 228 → 214 (228 inicira razgovor, 214 odgovara)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1004, 228, 214, 'test-sess-228', 'Hej, imaš li broj od dobavljača?', '2026-04-12 09:00:00', 'Pročitano', 'Poruka'),
  (1004, 214, 228, 'test-sess-214', 'Da, šaljem ti na mail.', '2026-04-12 09:10:00', 'Novo', 'Poruka'),
  (1004, 228, 214, 'test-sess-228', 'Odlično, hvala!', '2026-04-12 09:12:00', 'Pročitano', 'Poruka'),
  (1004, 214, 228, 'test-sess-214', 'Nema na čemu. Javi ako treba još nešto.', '2026-04-12 09:15:00', 'Novo', 'Poruka');

-- Razgovor 1005: 9901 (nepostojeći) → 228 (3 poruke, sve nove)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1005, 9901, 228, 'test-sess-9901', 'Pozdrav, imam pitanje o pristupu sustavu.', '2026-04-12 10:00:00', 'Novo', 'Poruka'),
  (1005, 9901, 228, 'test-sess-9901', 'Ne mogu se prijaviti s novim podatcima.', '2026-04-12 10:02:00', 'Novo', 'Poruka'),
  (1005, 9901, 228, 'test-sess-9901', 'Možete li resetirati lozinku?', '2026-04-12 10:05:00', 'Novo', 'Poruka');

-- Razgovor 1006: 9902 (nepostojeći) → 228 (2 poruke, pročitane)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1006, 9902, 228, 'test-sess-9902', 'Bok, javili su mi da upisuješ nove artikle.', '2026-04-11 15:00:00', 'Pročitano', 'Poruka'),
  (1006, 9902, 228, 'test-sess-9902', 'Možeš li dodati i kategoriju "Alati"?', '2026-04-11 15:10:00', 'Pročitano', 'Poruka');

-- Razgovor 1007: 9903 (nepostojeći) → 228 (2 poruke, mješavina)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1007, 9903, 228, 'test-sess-9903', 'Trebam izvoz podataka za Q1 2026.', '2026-04-12 11:00:00', 'Pročitano', 'Poruka'),
  (1007, 9903, 228, 'test-sess-9903', 'Može li u Excel formatu?', '2026-04-12 11:05:00', 'Novo', 'Poruka');

-- Razgovor 1008: 9904 (nepostojeći) → 228 (3 poruke + 1 odgovor 228)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1008, 9904, 228, 'test-sess-9904', 'Dobar dan, prijavljujem grešku u izvještaju.', '2026-04-10 14:00:00', 'Pročitano', 'Poruka'),
  (1008, 228, 9904, 'test-sess-228', 'Hvala na prijavi, istražujem.', '2026-04-10 14:30:00', 'Pročitano', 'Poruka'),
  (1008, 9904, 228, 'test-sess-9904', 'Super, javite kad bude riješeno.', '2026-04-10 14:35:00', 'Pročitano', 'Poruka'),
  (1008, 9904, 228, 'test-sess-9904', 'Podsjetnik – greška još nije ispravljena.', '2026-04-12 08:00:00', 'Novo', 'Poruka');

-- Razgovor 1009: 9905 (nepostojeći) → 228 (1 poruka, nova)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1009, 9905, 228, 'test-sess-9905', 'Kratko pitanje – koji je rok za unos podataka?', '2026-04-12 12:00:00', 'Novo', 'Poruka');

-- Razgovor 1010: 9906 (nepostojeći) → 228 (2 poruke, sve pročitane)
INSERT INTO sustav_sesije_poruke
  (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip)
VALUES
  (1010, 9906, 228, 'test-sess-9906', 'Mogu li dobiti pristup modulu za fakture?', '2026-04-09 09:00:00', 'Pročitano', 'Poruka'),
  (1010, 9906, 228, 'test-sess-9906', 'Trebam to za kraj mjeseca.', '2026-04-09 09:05:00', 'Pročitano', 'Poruka');

-- =========================================================
-- Ukupno: 10 razgovora, ~35 poruka
-- Postojeći pošiljatelji: 214, 291, 299
-- Nepostojeći pošiljatelji: 9901, 9902, 9903, 9904, 9905, 9906
-- Nepročitane (status='Novo') za korisnika 228: ~14 poruka
-- =========================================================
