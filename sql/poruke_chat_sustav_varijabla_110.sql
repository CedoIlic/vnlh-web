-- =============================================================
-- Chat: dopušteni korisnici (sustav_varijable id = 110)
-- Kolona varijabla = lista id_korisnik (sustav_korisnici / clanovi.id), odvojena zarezom.
-- Izvršiti ručno na bazi ako red još ne postoji; prilagoditi ID-jeve.
-- PHP: php/poruke_chat_sesija.php → poruke_chat_dozvoljen_za_korisnika()
-- =============================================================

-- Primjer: INSERT ako ne postoji (prilagodi vrijednost)
-- INSERT INTO sustav_varijable (id, varijabla) VALUES (110, '214,228,291,299')
--   ON DUPLICATE KEY UPDATE varijabla = VALUES(varijabla);

-- Primjer: samo ažuriranje
-- UPDATE sustav_varijable SET varijabla = '214,228' WHERE id = 110;
