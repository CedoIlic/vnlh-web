-- Jednokratno: zadani interval osvježavanja tablice „Aktivne sesije” u sekundama (1–20).
-- Čita php/Alati_Sesije_Aktivne.php (VNLH_SUSTAV_VAR_SESIJA_INTERVAL_OSVJEZI_SEC = 109).
-- Ako red već postoji, samo ažurira varijabla (npr. 5).

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    109,
    '5',
    'Sesije: interval osvježavanja liste (s)',
    'Broj sekundi između automatskih osvježavanja tablice aktivnih sesija u Alatima. Cijeli broj od 1 do 20.'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);
