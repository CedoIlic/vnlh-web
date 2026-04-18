-- Jednokratno: stanka (ms) debounce za polja „Traži“ / „Pronađi“ u Napredovanja_CRUD i Duznosnici_Osobe_CRUD.
-- Čita js/0-Common.js (vnlhLoadPronadjiStankaMsFromVar114 → common_sustav_varijable.php?id=114).

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    114,
    '1000',
    'Stanka pretrage (ms)',
    'Broj milisekundi čekanja nakon tipkanja u poljima Traži/Pronađi prije filtriranja tablice (debounce).'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);
