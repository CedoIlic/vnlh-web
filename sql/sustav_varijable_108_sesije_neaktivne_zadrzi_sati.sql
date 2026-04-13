-- Jednokratno: koliko sati zadržati neaktivne retke (timeout, logout) u sustav_sesije_aktivne prije DELETE.
-- Čita php/Alati_Sesije_Aktivne.php (VNLH_SUSTAV_VAR_SESIJA_NEAKTIVNE_ZADRZI_SATI = 108).
-- Ako red već postoji, samo ažurira varijabla (npr. 24).

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    108,
    '24',
    'Sesije: zadrška neaktivnih (sati)',
    'Broj sati nakon kojeg se brišu retci sesija sa statusom timeout ili logout u tablici sustav_sesije_aktivne (čišćenje povijesti). Cijeli broj ≥ 1.'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);
